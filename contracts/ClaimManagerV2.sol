// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./MBC20FactoryV2.sol";
import "./MBC20TokenV2.sol";

/// @title ClaimManagerV2 — Signature-based claiming + deployer-controlled airdrop
/// @notice Users submit a backend signature to claim their mbc-20 tokens on-chain.
///         The backend signs (wallet, tick, totalAmount, nonce) after verifying the indexer.
///         No ETH claim fee. Per-wallet per-token nonces.
///         Only the deployer of each token can batch airdrop.
contract ClaimManagerV2 {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    MBC20FactoryV2 public immutable factory;
    address public immutable signer;

    /// wallet => tick hash => amount already claimed
    mapping(address => mapping(bytes32 => uint256)) public claimed;

    /// wallet => tick hash => nonce (per-wallet per-token replay protection)
    mapping(address => mapping(bytes32 => uint256)) public nonces;

    event Claimed(address indexed wallet, string tick, uint256 amount);

    error InvalidSignature();
    error NothingToClaim();
    error InvalidNonce();
    error TokenNotFound();
    error OnlyDeployer();
    error LengthMismatch();

    constructor(address _factory, address _signer) {
        factory = MBC20FactoryV2(_factory);
        signer = _signer;
    }

    /// @notice Claim mbc-20 tokens using a backend signature (no ETH fee)
    /// @param tick The mbc-20 tick name
    /// @param totalAmount Total amount claimable (cumulative, not incremental)
    /// @param nonce Per-wallet per-token replay protection nonce
    /// @param signature Backend EIP-191 signature
    function claim(
        string calldata tick,
        uint256 totalAmount,
        uint256 nonce,
        bytes calldata signature
    ) external {
        bytes32 tickHash = keccak256(bytes(tick));

        // Verify nonce (per-wallet per-token)
        if (nonce != nonces[msg.sender][tickHash]) revert InvalidNonce();

        // Verify signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(msg.sender, tick, totalAmount, nonce, block.chainid)
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        if (ethSignedHash.recover(signature) != signer) revert InvalidSignature();

        // Calculate delta
        uint256 alreadyClaimed = claimed[msg.sender][tickHash];
        if (totalAmount <= alreadyClaimed) revert NothingToClaim();
        uint256 delta = totalAmount - alreadyClaimed;

        // Update state
        claimed[msg.sender][tickHash] = totalAmount;
        nonces[msg.sender][tickHash] = nonce + 1;

        // Mint tokens
        address tokenAddr = factory.getToken(tick);
        if (tokenAddr == address(0)) revert TokenNotFound();
        MBC20TokenV2(tokenAddr).mint(msg.sender, delta);

        emit Claimed(msg.sender, tick, delta);
    }

    /// @notice Batch airdrop tokens — only the deployer of each token can call
    /// @dev Uses cumulative claimed tracking — safe to call after users have already claimed
    /// @param tick The mbc-20 tick name
    /// @param wallets Array of recipient addresses
    /// @param amounts Array of cumulative total amounts
    function batchAirdrop(
        string calldata tick,
        address[] calldata wallets,
        uint256[] calldata amounts
    ) external {
        if (wallets.length != amounts.length) revert LengthMismatch();

        // Only the deployer of this token can airdrop
        address tokenDeployer = factory.getDeployer(tick);
        if (msg.sender != tokenDeployer) revert OnlyDeployer();

        address tokenAddr = factory.getToken(tick);
        if (tokenAddr == address(0)) revert TokenNotFound();

        bytes32 tickHash = keccak256(bytes(tick));

        for (uint256 i = 0; i < wallets.length; i++) {
            uint256 alreadyClaimed = claimed[wallets[i]][tickHash];
            if (amounts[i] > alreadyClaimed) {
                uint256 delta = amounts[i] - alreadyClaimed;
                claimed[wallets[i]][tickHash] = amounts[i];
                MBC20TokenV2(tokenAddr).mint(wallets[i], delta);
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
