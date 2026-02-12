// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./MBC20TokenV2.sol";

/// @title MBC20FactoryV2 — Permissionless token deployment
/// @notice Anyone can deploy an mbc-20 token on-chain by burning CLAW.
///         The deployer earns 1% of all trading fees for their token.
contract MBC20FactoryV2 {
    address public immutable claimManager; // ClaimManagerV2
    IERC20 public immutable clawToken;     // CLAW token (burned on deploy)

    uint256 public deploymentCost; // CLAW to burn per deployment
    address public admin;          // can update cost, then renounce

    struct TokenInfo {
        address token;
        address deployer;
        uint256 maxSupply;
        uint256 clawBurned;
    }

    /// tick hash => TokenInfo
    mapping(bytes32 => TokenInfo) public tokenInfo;

    /// All deployed token addresses (for enumeration)
    address[] public allTokens;

    event TokenCreated(
        string tick,
        address indexed token,
        address indexed deployer,
        uint256 maxSupply,
        uint256 clawBurned
    );
    event DeploymentCostUpdated(uint256 oldCost, uint256 newCost);
    event AdminRenounced();

    error TokenAlreadyExists();
    error InsufficientCLAW();
    error OnlyAdmin();
    error OnlyClaimManager();

    constructor(
        address _claimManager,
        address _clawToken,
        uint256 _deploymentCost
    ) {
        claimManager = _claimManager;
        clawToken = IERC20(_clawToken);
        deploymentCost = _deploymentCost;
        admin = msg.sender;
    }

    // ═══════════════════ Admin ═══════════════════

    modifier onlyAdmin() {
        if (msg.sender != admin) revert OnlyAdmin();
        _;
    }

    function setDeploymentCost(uint256 newCost) external onlyAdmin {
        emit DeploymentCostUpdated(deploymentCost, newCost);
        deploymentCost = newCost;
    }

    function renounceAdmin() external onlyAdmin {
        admin = address(0);
        emit AdminRenounced();
    }

    // ═══════════════════ Permissionless Deploy ═══════════════════

    /// @notice Deploy a new mbc-20 token on-chain by burning CLAW
    /// @param tick The mbc-20 tick name
    /// @param maxSupply Max supply from the deploy inscription
    /// @return The deployed token address
    function createToken(
        string calldata tick,
        uint256 maxSupply
    ) external returns (address) {
        bytes32 tickHash = keccak256(bytes(tick));
        if (tokenInfo[tickHash].token != address(0)) revert TokenAlreadyExists();

        // Burn CLAW as deployment cost
        uint256 cost = deploymentCost;
        if (cost > 0) {
            // Transfer CLAW from deployer, then burn it
            clawToken.transferFrom(msg.sender, address(this), cost);
            // Burn by sending to address(0) — CLAW has burn() but we use
            // the MBC20Token burn function directly
            MBC20TokenV2(address(clawToken)).burn(cost);
        }

        // Deploy new token: deployer = msg.sender (earns 1% fees)
        MBC20TokenV2 token = new MBC20TokenV2(
            string.concat("mbc-20: ", tick),
            tick,
            maxSupply,
            claimManager,   // minter
            msg.sender,     // deployer (fee recipient)
            msg.sender      // owner (can setPool, then renounce)
        );

        address tokenAddr = address(token);

        tokenInfo[tickHash] = TokenInfo({
            token: tokenAddr,
            deployer: msg.sender,
            maxSupply: maxSupply,
            clawBurned: cost
        });

        allTokens.push(tokenAddr);

        emit TokenCreated(tick, tokenAddr, msg.sender, maxSupply, cost);
        return tokenAddr;
    }

    // ═══════════════════ Views ═══════════════════

    function getToken(string calldata tick) external view returns (address) {
        return tokenInfo[keccak256(bytes(tick))].token;
    }

    function getDeployer(string calldata tick) external view returns (address) {
        return tokenInfo[keccak256(bytes(tick))].deployer;
    }

    function totalTokens() external view returns (uint256) {
        return allTokens.length;
    }
}
