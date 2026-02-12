// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./MBC20Factory.sol";
import "./MBC20Token.sol";

/// @title ClaimManager — Signature-based token claiming
/// @notice Users submit a backend signature to claim their mbc-20 tokens on-chain.
///         The backend signs (wallet, tick, totalAmount, nonce) after verifying the indexer.
///         The contract mints the delta between totalAmount and what was already claimed.
contract ClaimManager {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    MBC20Factory public immutable factory;
    address public immutable signer;
    address public immutable treasury;
    uint256 public immutable claimFee; // in wei (ETH)

    /// wallet => tick hash => amount already claimed
    mapping(address => mapping(bytes32 => uint256)) public claimed;

    /// wallet => nonce (replay protection)
    mapping(address => uint256) public nonces;

    event Claimed(address indexed wallet, string tick, uint256 amount);
    event TokenInitialized(string tick, address token);

    error InvalidSignature();
    error NothingToClaim();
    error InvalidNonce();
    error InsufficientFee();
    error OnlyTreasury();
    error LengthMismatch();
    error TokenNotFound();

    constructor(
        address _factory,
        address _signer,
        address _treasury,
        uint256 _claimFee
    ) {
        factory = MBC20Factory(_factory);
        signer = _signer;
        treasury = _treasury;
        claimFee = _claimFee;
    }

    /// @notice Initialize a token on-chain (called once per tick, anyone can call)
    /// @param tick The mbc-20 tick name
    /// @param maxSupply Max supply from the deploy inscription
    function initToken(string calldata tick, uint256 maxSupply) external {
        address token = factory.createToken(tick, maxSupply);
        emit TokenInitialized(tick, token);
    }

    /// @notice Claim mbc-20 tokens using a backend signature
    /// @param tick The mbc-20 tick name
    /// @param totalAmount Total amount claimable (cumulative, not incremental)
    /// @param nonce Replay protection nonce
    /// @param signature Backend EIP-191 signature
    function claim(
        string calldata tick,
        uint256 totalAmount,
        uint256 nonce,
        bytes calldata signature
    ) external payable {
        if (msg.value < claimFee) revert InsufficientFee();
        if (nonce != nonces[msg.sender]) revert InvalidNonce();

        // Verify signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(msg.sender, tick, totalAmount, nonce, block.chainid)
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        if (ethSignedHash.recover(signature) != signer) revert InvalidSignature();

        // Calculate delta
        bytes32 tickHash = keccak256(bytes(tick));
        uint256 alreadyClaimed = claimed[msg.sender][tickHash];
        if (totalAmount <= alreadyClaimed) revert NothingToClaim();
        uint256 delta = totalAmount - alreadyClaimed;

        // Update state
        claimed[msg.sender][tickHash] = totalAmount;
        nonces[msg.sender] = nonce + 1;

        // Mint tokens
        address tokenAddr = factory.getToken(tick);
        MBC20Token(tokenAddr).mint(msg.sender, delta);

        // Send fee to treasury
        if (msg.value > 0) {
            (bool sent, ) = treasury.call{value: msg.value}("");
            require(sent);
        }

        emit Claimed(msg.sender, tick, delta);
    }

    /// @notice Airdrop tokens to multiple wallets (treasury only, no fee)
    /// @dev Uses same cumulative claimed tracking — safe to call after users have already claimed
    /// @param tick The mbc-20 tick name
    /// @param wallets Array of recipient addresses
    /// @param amounts Array of cumulative total amounts (same semantics as claim totalAmount)
    function batchAirdrop(
        string calldata tick,
        address[] calldata wallets,
        uint256[] calldata amounts
    ) external {
        if (msg.sender != treasury) revert OnlyTreasury();
        if (wallets.length != amounts.length) revert LengthMismatch();

        address tokenAddr = factory.getToken(tick);
        if (tokenAddr == address(0)) revert TokenNotFound();

        bytes32 tickHash = keccak256(bytes(tick));

        for (uint256 i = 0; i < wallets.length; i++) {
            uint256 alreadyClaimed = claimed[wallets[i]][tickHash];
            if (amounts[i] > alreadyClaimed) {
                uint256 delta = amounts[i] - alreadyClaimed;
                claimed[wallets[i]][tickHash] = amounts[i];
                MBC20Token(tokenAddr).mint(wallets[i], delta);
                emit Claimed(wallets[i], tick, delta);
            }
        }
    }

    /// @notice Check how much a wallet can still claim for a tick
    function claimable(
        address wallet,
        string calldata tick,
        uint256 totalAmount
    ) external view returns (uint256) {
        uint256 alreadyClaimed = claimed[wallet][keccak256(bytes(tick))];
        return totalAmount > alreadyClaimed ? totalAmount - alreadyClaimed : 0;
    }
}
