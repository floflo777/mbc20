// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MBC20Token.sol";

/// @title MBC20Factory — Deploys one ERC-20 per mbc-20 tick
/// @notice Only the ClaimManager can create tokens and mint through them.
contract MBC20Factory {
    address public immutable claimManager;
    address public immutable teamWallet;
    address public immutable rewardPool;
    address public immutable tokenAdmin; // owner of deployed tokens (can setPool, startLaunch)

    /// tick hash => token address
    mapping(bytes32 => address) public tokens;

    event TokenCreated(string tick, address token, uint256 maxSupply);

    error OnlyClaimManager();
    error TokenAlreadyExists();

    constructor(address _claimManager, address _teamWallet, address _rewardPool) {
        claimManager = _claimManager;
        teamWallet = _teamWallet;
        rewardPool = _rewardPool;
        tokenAdmin = msg.sender; // deployer becomes admin of all tokens
    }

    function createToken(
        string calldata tick,
        uint256 maxSupply
    ) external returns (address) {
        if (msg.sender != claimManager) revert OnlyClaimManager();

        bytes32 tickHash = keccak256(bytes(tick));
        if (tokens[tickHash] != address(0)) revert TokenAlreadyExists();

        MBC20Token token = new MBC20Token(
            string.concat("mbc-20: ", tick),
            tick,
            maxSupply,
            claimManager,
            teamWallet,
            rewardPool,
            tokenAdmin
        );

        tokens[tickHash] = address(token);
        emit TokenCreated(tick, address(token), maxSupply);
        return address(token);
    }

    function getToken(string calldata tick) external view returns (address) {
        return tokens[keccak256(bytes(tick))];
    }
}
