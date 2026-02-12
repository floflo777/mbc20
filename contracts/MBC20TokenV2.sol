// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MBC20TokenV2 — ERC-20 with trading fees: 1% burn + 1% deployer
/// @notice Deployed by MBC20FactoryV2. Only the ClaimManagerV2 can mint.
///
/// Fee structure:
///   - Base trading fee: 2% on buys and sells (to/from pool addresses)
///   - Fee split: 1% burned, 1% to deployer (token creator earns fees)
///   - Burn discount: users burn tokens to reduce their personal fee (up to 2% = fee-free)
///   - Discount reduction order: burn first, then deployer
///   - Wallet-to-wallet transfers are always fee-free.
///
/// Admin can set pool addresses, then renounce ownership.
contract MBC20TokenV2 is ERC20 {
    uint256 public immutable maxSupply;
    address public immutable minter;   // ClaimManagerV2
    address public immutable deployer; // fee recipient (token creator)

    // ═══════════════════ Fee config (in BPS of trade amount) ═══════════════════
    uint256 public constant BASE_FEE_BPS    = 200; // 2% total
    uint256 public constant BURN_BPS        = 100; // 1% burn
    uint256 public constant DEPLOYER_BPS    = 100; // 1% to deployer

    // ═══════════════════ Pool tracking ═══════════════════
    mapping(address => bool) public isPool;
    address public owner;

    // ═══════════════════ Burn tracking (for fee discount) ═══════════════════
    mapping(address => uint256) public burnedByUser;

    // ═══════════════════ Errors ═══════════════════
    error OnlyMinter();
    error ExceedsMaxSupply();
    error OnlyOwner();
    error ZeroAddress();
    error ZeroAmount();

    // ═══════════════════ Events ═══════════════════
    event PoolSet(address indexed pool, bool status);
    event OwnershipRenounced();
    event Burned(address indexed user, uint256 amount, uint256 totalBurned);

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _maxSupply,
        address _minter,
        address _deployer,
        address _owner
    ) ERC20(_name, _symbol) {
        maxSupply = _maxSupply;
        minter = _minter;
        deployer = _deployer;
        owner = _owner;
    }

    // ═══════════════════ Admin ═══════════════════

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    function setPool(address pool, bool status) external onlyOwner {
        if (pool == address(0)) revert ZeroAddress();
        isPool[pool] = status;
        emit PoolSet(pool, status);
    }

    function renounceOwnership() external onlyOwner {
        owner = address(0);
        emit OwnershipRenounced();
    }

    // ═══════════════════ Minting ═══════════════════

    function mint(address to, uint256 amount) external {
        if (msg.sender != minter) revert OnlyMinter();
        if (totalSupply() + amount > maxSupply) revert ExceedsMaxSupply();
        _mint(to, amount);
    }

    // ═══════════════════ Burn for fee discount ═══════════════════

    /// @notice Burn tokens to permanently reduce your trading fee
    function burn(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _burn(msg.sender, amount);
        burnedByUser[msg.sender] += amount;
        emit Burned(msg.sender, amount, burnedByUser[msg.sender]);
    }

    // ═══════════════════ Fee discount tiers ═══════════════════

    /// @notice Get fee discount in BPS based on total burned amount
    /// @return Discount in basis points (max 200 = 2% = full fee waiver)
    function getBurnDiscountBPS(address user) public view returns (uint256) {
        uint256 burned = burnedByUser[user] / 1e18; // whole token units
        if (burned >= 10000) return 200;  // 2.0% off -> 0% fee
        if (burned >= 5000)  return 150;  // 1.5% off -> 0.5% fee
        if (burned >= 1000)  return 100;  // 1.0% off -> 1% fee
        if (burned >= 500)   return 50;   // 0.5% off -> 1.5% fee
        if (burned >= 200)   return 20;   // 0.2% off -> 1.8% fee
        if (burned >= 100)   return 10;   // 0.1% off -> 1.9% fee
        return 0;
    }

    // ═══════════════════ Core transfer with fees ═══════════════════

    function _update(address from, address to, uint256 amount) internal override {
        // Mints (from=0) and burns (to=0) — no fee
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }

        bool isSell = isPool[to];
        bool isBuy  = isPool[from];

        // Wallet-to-wallet transfer — no fee
        if (!isSell && !isBuy) {
            super._update(from, to, amount);
            return;
        }

        // Determine trader for discount lookup
        address trader = isBuy ? to : from;
        uint256 discount = getBurnDiscountBPS(trader);

        // Calculate per-component BPS with ordered reduction: burn -> deployer
        uint256 burnFee     = BURN_BPS;
        uint256 deployerFee = DEPLOYER_BPS;

        if (discount > 0) {
            uint256 d = discount;
            // Reduce burn first
            if (d >= burnFee) { d -= burnFee; burnFee = 0; } else { burnFee -= d; d = 0; }
            // Then deployer
            if (d >= deployerFee) { deployerFee = 0; } else { deployerFee -= d; }
        }

        uint256 burnAmt     = (amount * burnFee) / 10000;
        uint256 deployerAmt = (amount * deployerFee) / 10000;
        uint256 totalFee    = burnAmt + deployerAmt;

        if (burnAmt > 0)     super._update(from, address(0), burnAmt);
        if (deployerAmt > 0) super._update(from, deployer, deployerAmt);

        // Send remaining to recipient
        super._update(from, to, amount - totalFee);
    }
}
