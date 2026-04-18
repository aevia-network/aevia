// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PersistencePool
 * @notice Holds cUSDC deposits from creators and distributes them to Provider
 *         Nodes proportional to the off-chain Proof-of-Relay bytes served
 *         during each epoch.
 *
 * @dev Economic model — Storj-style, adapted to Aevia:
 *   - Creators deposit cUSDC into the pool (tagged with a manifestCid for
 *     audit; the tag does NOT partition funds — deposits pool globally).
 *   - A single coordinator address (multisig in production) submits
 *     Settlements for each epoch:
 *       submitSettlement(merkleRoot, providers[], bytesServed[], totalRewards)
 *     The Merkle root commits to the off-chain receipt set; providers[] and
 *     bytesServed[] are parallel arrays sorted by provider address.
 *   - The contract allocates totalRewards proportionally to bytesServed[]
 *     into `claims[settlementId][provider]`.
 *   - Each provider pulls their share via claim(settlementId). A settlement
 *     can be claimed exactly once per provider.
 *
 * Why not distribute on submission?
 *   - Push-payment patterns are vulnerable to reverting recipients. Pull
 *     payments let one malicious provider not block others.
 *   - Matches Compound/Aave unstake patterns — operators know the convention.
 *
 * Invariants:
 *   1. sum(claims) per settlement ≤ settlement.totalRewards.
 *   2. A (settlement, provider) pair can be claimed exactly once.
 *   3. Pool balance never goes negative — claim fails if contract has
 *      insufficient balance (shouldn't happen if totalRewards ≤ deposited).
 *   4. Zero-address providers are rejected at settlement time.
 *   5. Coordinator cannot rug — coordinator only assigns allocations,
 *      cannot redirect funds to arbitrary recipients.
 */
contract PersistencePool {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------

    struct Settlement {
        bytes32 merkleRoot;
        uint64 timestamp;
        uint256 totalRewards;
        uint256 totalBytes;
        uint256 providerCount;
    }

    // ---------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------

    /// @notice cUSDC (or any ERC-20) used for deposits + payouts. Immutable.
    IERC20 public immutable rewardToken;

    /// @notice Address authorised to submit settlements. Intended to be a
    ///         multisig in production; single address in M6 MVP.
    address public coordinator;

    /// @notice Auto-incrementing settlement ID. Zero is reserved as
    ///         "unset" so mappings work naturally.
    uint256 public settlementCount;

    /// @notice Settlement records indexed by ID starting at 1.
    mapping(uint256 id => Settlement) private _settlements;

    /// @notice Per-settlement, per-provider allocation (cUSDC wei).
    mapping(uint256 settlementId => mapping(address provider => uint256 allocation)) private _allocations;

    /// @notice Tracks which (settlement, provider) pairs have been claimed.
    mapping(uint256 settlementId => mapping(address provider => bool claimed)) private _claimed;

    /// @notice Cumulative bytes-served per provider across all settlements.
    mapping(address provider => uint256 bytesServed) public cumulativeBytesServed;

    /// @notice Cumulative rewards paid per provider.
    mapping(address provider => uint256 rewardsPaid) public cumulativeRewardsPaid;

    /// @notice Cumulative deposits tagged with a manifest CID (audit only).
    mapping(bytes32 manifestCid => uint256 deposited) public depositsByCid;

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event Deposited(address indexed from, bytes32 indexed manifestCid, uint256 amount);
    event CoordinatorUpdated(address indexed previous, address indexed current);
    event SettlementSubmitted(
        uint256 indexed settlementId,
        bytes32 indexed merkleRoot,
        uint256 totalRewards,
        uint256 totalBytes,
        uint256 providerCount
    );
    event AllocationRecorded(
        uint256 indexed settlementId, address indexed provider, uint256 bytesServed, uint256 allocation
    );
    event Claimed(uint256 indexed settlementId, address indexed provider, uint256 amount);

    // ---------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------

    error NotCoordinator();
    error ZeroAmount();
    error ZeroAddress();
    error LengthMismatch();
    error ZeroTotalBytes();
    error ZeroProviders();
    error AlreadyClaimed();
    error NothingToClaim();
    error InsufficientPoolBalance();

    // ---------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------

    modifier onlyCoordinator() {
        if (msg.sender != coordinator) revert NotCoordinator();
        _;
    }

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    constructor(IERC20 _rewardToken, address _coordinator) {
        if (address(_rewardToken) == address(0)) revert ZeroAddress();
        if (_coordinator == address(0)) revert ZeroAddress();
        rewardToken = _rewardToken;
        coordinator = _coordinator;
        emit CoordinatorUpdated(address(0), _coordinator);
    }

    // ---------------------------------------------------------------
    // External: state-changing
    // ---------------------------------------------------------------

    /**
     * @notice Deposit `amount` of rewardToken into the pool, tagged with
     *         `manifestCid` for audit. The tag does NOT partition funds;
     *         all deposits pool globally.
     * @dev Caller must have approved the pool for at least `amount`.
     */
    function deposit(bytes32 manifestCid, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        depositsByCid[manifestCid] += amount;
        emit Deposited(msg.sender, manifestCid, amount);
    }

    /**
     * @notice Submit a settlement for an epoch. Allocates totalRewards among
     *         providers proportional to bytesServed.
     * @dev Reverts on any shape inconsistency. Zero addresses in providers
     *      are rejected. Allocations <= totalRewards by construction of
     *      integer division — leftover dust stays in the pool for the next
     *      epoch.
     */
    function submitSettlement(
        bytes32 merkleRoot,
        address[] calldata providers,
        uint256[] calldata bytesServed,
        uint256 totalRewards
    )
        external
        onlyCoordinator
        returns (uint256 settlementId)
    {
        uint256 n = providers.length;
        if (n == 0) revert ZeroProviders();
        if (n != bytesServed.length) revert LengthMismatch();
        if (totalRewards == 0) revert ZeroAmount();
        if (rewardToken.balanceOf(address(this)) < totalRewards) revert InsufficientPoolBalance();

        // Sum bytes and validate provider addresses in one pass.
        uint256 totalBytes;
        for (uint256 i = 0; i < n;) {
            if (providers[i] == address(0)) revert ZeroAddress();
            totalBytes += bytesServed[i];
            unchecked {
                ++i;
            }
        }
        if (totalBytes == 0) revert ZeroTotalBytes();

        unchecked {
            settlementId = ++settlementCount;
        }

        _settlements[settlementId] = Settlement({
            merkleRoot: merkleRoot,
            timestamp: uint64(block.timestamp),
            totalRewards: totalRewards,
            totalBytes: totalBytes,
            providerCount: n
        });

        emit SettlementSubmitted(settlementId, merkleRoot, totalRewards, totalBytes, n);

        // Allocate proportional rewards. Use OpenZeppelin's safe math
        // (solidity 0.8 overflow checks) to catch any arithmetic issue.
        for (uint256 i = 0; i < n;) {
            uint256 share = (totalRewards * bytesServed[i]) / totalBytes;
            address provider = providers[i];
            _allocations[settlementId][provider] = share;
            cumulativeBytesServed[provider] += bytesServed[i];
            emit AllocationRecorded(settlementId, provider, bytesServed[i], share);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Pull the cUSDC allocated to `msg.sender` by settlement `settlementId`.
     * @dev Claims can happen exactly once per (settlement, provider) pair.
     */
    function claim(uint256 settlementId) external returns (uint256 amount) {
        amount = _allocations[settlementId][msg.sender];
        if (amount == 0) revert NothingToClaim();
        if (_claimed[settlementId][msg.sender]) revert AlreadyClaimed();

        _claimed[settlementId][msg.sender] = true;
        cumulativeRewardsPaid[msg.sender] += amount;

        rewardToken.safeTransfer(msg.sender, amount);
        emit Claimed(settlementId, msg.sender, amount);
    }

    /// @notice Transfer coordinator role. Only current coordinator can call.
    function setCoordinator(address newCoordinator) external onlyCoordinator {
        if (newCoordinator == address(0)) revert ZeroAddress();
        address previous = coordinator;
        coordinator = newCoordinator;
        emit CoordinatorUpdated(previous, newCoordinator);
    }

    // ---------------------------------------------------------------
    // External: views
    // ---------------------------------------------------------------

    function getSettlement(uint256 settlementId) external view returns (Settlement memory) {
        return _settlements[settlementId];
    }

    function allocationOf(uint256 settlementId, address provider) external view returns (uint256) {
        return _allocations[settlementId][provider];
    }

    function hasClaimed(uint256 settlementId, address provider) external view returns (bool) {
        return _claimed[settlementId][provider];
    }

    function poolBalance() external view returns (uint256) {
        return rewardToken.balanceOf(address(this));
    }
}
