// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title MBC20Marketplace — P2P orderbook for mbc-20 tokens (USDC + ETH)
/// @notice Sellers list tokens at a fixed price in USDC or ETH. Buyers fill orders.
///         Designed to work with fee-on-transfer tokens (MBC20Token has 2% trading fee).
///         No additional marketplace fee — the token's built-in fee handles burn/team/reward.
///         No admin, no pause, no upgrade.
contract MBC20Marketplace {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

    struct Order {
        address seller;
        address token;
        uint256 amount;        // tokens remaining (actual received after sell fee)
        uint256 pricePerToken; // price per token in payment currency's smallest unit
        address paymentToken;  // USDC address for USDC, address(0) for ETH
        bool active;
    }

    Order[] public orders;

    event Listed(uint256 indexed orderId, address indexed seller, address token, uint256 listed, uint256 received, uint256 pricePerToken, address paymentToken);
    event Bought(uint256 indexed orderId, address indexed buyer, uint256 amount, uint256 received, uint256 totalPaid);
    event Cancelled(uint256 indexed orderId);

    error OrderNotActive();
    error NotSeller();
    error ZeroAmount();
    error InsufficientOrderAmount();
    error InvalidPaymentToken();
    error InsufficientPayment();
    error ETHTransferFailed();
    error NoETHExpected();

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    /// @notice List tokens for sale (handles fee-on-transfer: order tracks actual received)
    /// @param token The mbc-20 ERC-20 token address
    /// @param amount Number of tokens to sell (before any transfer fee)
    /// @param pricePerToken Price per token in payment currency's smallest unit
    /// @param paymentToken USDC address for USDC payment, address(0) for ETH payment
    function list(address token, uint256 amount, uint256 pricePerToken, address paymentToken) external returns (uint256) {
        if (amount == 0) revert ZeroAmount();
        if (paymentToken != address(0) && paymentToken != address(usdc)) revert InvalidPaymentToken();

        // Measure actual received (token may charge sell fee on transfer)
        uint256 balBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balBefore;

        uint256 orderId = orders.length;
        orders.push(Order({
            seller: msg.sender,
            token: token,
            amount: received,
            pricePerToken: pricePerToken,
            paymentToken: paymentToken,
            active: true
        }));

        emit Listed(orderId, msg.sender, token, amount, received, pricePerToken, paymentToken);
        return orderId;
    }

    /// @notice Buy tokens from an order (partial fills allowed)
    /// @param orderId The order to buy from
    /// @param amount Number of tokens to buy from the order
    function buy(uint256 orderId, uint256 amount) external payable {
        Order storage order = orders[orderId];
        if (!order.active) revert OrderNotActive();
        if (amount == 0) revert ZeroAmount();
        if (amount > order.amount) revert InsufficientOrderAmount();

        uint256 totalPayment = (amount * order.pricePerToken) / 1e18;

        // Effects before interactions (CEI pattern)
        order.amount -= amount;
        if (order.amount == 0) order.active = false;

        // Payment
        if (order.paymentToken == address(0)) {
            // ETH payment
            if (msg.value < totalPayment) revert InsufficientPayment();
            (bool ok, ) = order.seller.call{value: totalPayment}("");
            if (!ok) revert ETHTransferFailed();
            // Refund excess ETH
            if (msg.value > totalPayment) {
                (bool refundOk, ) = msg.sender.call{value: msg.value - totalPayment}("");
                if (!refundOk) revert ETHTransferFailed();
            }
        } else {
            // USDC payment — reject accidental ETH
            if (msg.value > 0) revert NoETHExpected();
            usdc.safeTransferFrom(msg.sender, order.seller, totalPayment);
        }

        // Transfer tokens: marketplace → buyer (buy fee deducted by token's _update)
        uint256 buyerBefore = IERC20(order.token).balanceOf(msg.sender);
        IERC20(order.token).safeTransfer(msg.sender, amount);
        uint256 buyerReceived = IERC20(order.token).balanceOf(msg.sender) - buyerBefore;

        emit Bought(orderId, msg.sender, amount, buyerReceived, totalPayment);
    }

    /// @notice Cancel your listing and get tokens back
    /// @param orderId The order to cancel
    function cancel(uint256 orderId) external {
        Order storage order = orders[orderId];
        if (!order.active) revert OrderNotActive();
        if (order.seller != msg.sender) revert NotSeller();

        order.active = false;
        IERC20(order.token).safeTransfer(msg.sender, order.amount);

        emit Cancelled(orderId);
    }

    /// @notice Get total number of orders
    function orderCount() external view returns (uint256) {
        return orders.length;
    }

    /// @notice Get active orders for a token (view helper for frontend)
    function getActiveOrders(address token, uint256 offset, uint256 limit)
        external view returns (Order[] memory result, uint256 total)
    {
        uint256 count = 0;
        for (uint256 i = 0; i < orders.length; i++) {
            if (orders[i].active && orders[i].token == token) count++;
        }
        total = count;

        if (count == 0 || offset >= count) {
            result = new Order[](0);
            return (result, total);
        }

        uint256 size = limit < count - offset ? limit : count - offset;
        result = new Order[](size);
        uint256 found = 0;
        uint256 added = 0;
        for (uint256 i = 0; i < orders.length && added < size; i++) {
            if (orders[i].active && orders[i].token == token) {
                if (found >= offset) {
                    result[added] = orders[i];
                    added++;
                }
                found++;
            }
        }
    }
}
