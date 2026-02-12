// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title TokenLock — Time-locked token vault
/// @notice Tokens sent here cannot be withdrawn until the unlock timestamp.
///         No admin, no early withdrawal, no upgrade. Fully trustless.
contract TokenLock {
    using SafeERC20 for IERC20;

    address public immutable beneficiary;
    uint256 public immutable unlockTime;
    IERC20 public immutable token;

    error TooEarly();
    error NotBeneficiary();

    constructor(address _token, address _beneficiary, uint256 _unlockTime) {
        token = IERC20(_token);
        beneficiary = _beneficiary;
        unlockTime = _unlockTime;
    }

    /// @notice Withdraw all tokens after unlock time
    function withdraw() external {
        if (block.timestamp < unlockTime) revert TooEarly();
        if (msg.sender != beneficiary) revert NotBeneficiary();
        uint256 balance = token.balanceOf(address(this));
        token.safeTransfer(beneficiary, balance);
    }

    /// @notice View how many tokens are locked
    function lockedBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// @notice View seconds remaining until unlock
    function timeRemaining() external view returns (uint256) {
        if (block.timestamp >= unlockTime) return 0;
        return unlockTime - block.timestamp;
    }
}
