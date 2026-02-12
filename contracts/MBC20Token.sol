// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MBC20Token — ERC-20 with trading fees and burn-for-discount
/// @notice Deployed by MBC20Factory. Only the ClaimManager can mint.
///
/// Fee structure:
///   - Base trading fee: 2% on buys and sells (to/from pool addresses)
///   - Fee split: 1% burn, 0.5% team (founder), 0.5% reward pool (future allocations)
///   - Burn discount: users burn tokens to reduce their personal fee (up to 2% = fee-free)
///   - Discount reduction order: burn first, then reward pool, then team
///   - Wallet-to-wallet transfers are always fee-free.
///
/// Admin can set pool addresses, then renounce ownership.
contract MBC20Token is ERC20 {
    uint256 public immutable maxSupply;
    address public immutable minter; // ClaimManager

    // ═══════════════════ Fee config (in BPS of trade amount) ═══════════════════
    uint256 public constant BASE_FEE_BPS = 200;   // 2% total
    uint256 public constant BURN_BPS     = 100;    // 1% burn
    uint256 public constant TEAM_BPS     = 50;     // 0.5% founder
    uint256 public constant REWARD_BPS   = 50;     // 0.5% future allocations

    // ═══════════════════ Addresses ═══════════════════
    address public teamWallet;
    address public rewardPool;

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
        address _teamWallet,
        address _rewardPool,
        address _owner
    ) ERC20(_name, _symbol) {
        maxSupply = _maxSupply;
        minter = _minter;
        teamWallet = _teamWallet;
        rewardPool = _rewardPool;
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
        if (burned >= 10000) return 200;  // 2.0% off → 0% fee
        if (burned >= 5000)  return 150;  // 1.5% off → 0.5% fee
        if (burned >= 1000)  return 100;  // 1.0% off → 1% fee
        if (burned >= 500)   return 50;   // 0.5% off → 1.5% fee
        if (burned >= 200)   return 20;   // 0.2% off → 1.8% fee
        if (burned >= 100)   return 10;   // 0.1% off → 1.9% fee
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

        // Calculate per-component BPS with ordered reduction: burn → reward → team
        uint256 burnFee   = BURN_BPS;
        uint256 rewardFee = REWARD_BPS;
        uint256 teamFee   = TEAM_BPS;

        if (discount > 0) {
            uint256 d = discount;
            // Reduce burn first
            if (d >= burnFee) { d -= burnFee; burnFee = 0; } else { burnFee -= d; d = 0; }
            // Then reward pool
            if (d >= rewardFee) { d -= rewardFee; rewardFee = 0; } else { rewardFee -= d; d = 0; }
            // Then team (founder) last
            if (d >= teamFee) { teamFee = 0; } else { teamFee -= d; }
        }

        uint256 burnAmt   = (amount * burnFee) / 10000;
        uint256 rewardAmt = (amount * rewardFee) / 10000;
        uint256 teamAmt   = (amount * teamFee) / 10000;
        uint256 totalFee  = burnAmt + rewardAmt + teamAmt;

        if (burnAmt > 0)   super._update(from, address(0), burnAmt);
        if (teamAmt > 0)   super._update(from, teamWallet, teamAmt);
        if (rewardAmt > 0) super._update(from, rewardPool, rewardAmt);

        // Send remaining to recipient
        super._update(from, to, amount - totalFee);
    }
}
