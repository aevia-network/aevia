// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IContentRegistry } from "./IContentRegistry.sol";
import { IRiskOracle } from "./IRiskOracle.sol";

/**
 * @title BoostRouter
 * @notice Non-custodial splitter that routes paid amplification (boosts)
 *         across four recipients — creator, Persistence Pool, LLC treasury,
 *         Council fund — in a single atomic transaction.
 *
 * @dev Specified normatively in `docs/protocol-spec/8-economic-architecture.md`
 *      §4. The contract enforces the invariants from §7 that are
 *      contract-expressible:
 *
 *      INV-6  — MUST NOT hold USDC balance between transactions.
 *      INV-9  — every boost MUST emit an auditable event.
 *      INV-11 — boost MUST revert if R(c) >= θ_feed (RFC-6).
 *      §4.3  — split parameters are Council-governable; LLC cannot
 *              unilaterally redirect boost flow.
 *      §4.2  — creator/pool/llc/council split MUST sum to 10_000 bps.
 *
 *      The contract is intentionally stateless beyond governance parameters
 *      and immutable destinations. All USDC received by the contract
 *      during a boost is disbursed in the same transaction; a revert
 *      in any of the four transfers rolls back the entire boost.
 *
 *      This contract is un-audited at the time of this commit. Mainnet
 *      deployment is gated on external audit and on the foundation
 *      structuring tracked by ADR 0007.
 */
contract BoostRouter {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------
    // Immutable destinations
    // ---------------------------------------------------------------

    /// @notice USDC on Base L2 (0x833589... on mainnet; testnet
    ///         deployments set this to the Circle sepolia USDC).
    IERC20 public immutable usdc;

    /// @notice ContentRegistry used to resolve manifestHash → creator address.
    IContentRegistry public immutable registry;

    /// @notice RiskOracle read for the θ_feed gate (RFC-6 §7).
    IRiskOracle public immutable oracle;

    /// @notice Persistence Pool contract. Receives `poolBps` of every boost.
    address public immutable persistencePool;

    /// @notice LLC operational treasury multisig. Receives `llcBps`.
    address public immutable llcTreasury;

    /// @notice Council fund multisig. Receives `councilBps`.
    address public immutable councilFund;

    // ---------------------------------------------------------------
    // Governance-mutable state
    // ---------------------------------------------------------------

    /// @notice Council multisig authorized to change the split.
    ///         Specified in RFC-7 §4; must be a multisig with ≥7/12 threshold
    ///         in production.
    address public council;

    /// @notice Split in basis points. MUST sum to 10_000.
    uint16 public creatorBps;
    uint16 public poolBps;
    uint16 public llcBps;
    uint16 public councilBps;

    // ---------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------

    /// @notice Basis point denominator (100% = 10_000 bps).
    uint16 public constant BPS_TOTAL = 10_000;

    /// @notice θ_feed threshold from RFC-6 §7.1 default (0.3 = 3_000 bps).
    ///         A boost MUST revert if R(c) >= this value. The threshold
    ///         is Council-governable per RFC-7 §4; however, this contract
    ///         pins it to the default to keep the invariant contract-local.
    ///         A future RFC / redeploy may parameterize this if needed.
    uint16 public constant THETA_FEED_BPS = 3_000;

    /// @notice Minimum boost amount to prevent dust-spam (RFC-8 §8.2).
    ///         $0.50 USDC (USDC has 6 decimals).
    uint256 public constant MIN_BOOST = 500_000;

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    /// @notice Emitted on every successful boost. Payload contains the
    ///         four computed amounts so indexers do not need to replay
    ///         the split arithmetic.
    event Boost(
        bytes32 indexed manifestHash,
        address indexed from,
        address indexed creator,
        uint256 amount,
        uint256 creatorAmount,
        uint256 poolAmount,
        uint256 llcAmount,
        uint256 councilAmount
    );

    /// @notice Emitted when the Council updates the split.
    event SplitUpdated(
        uint16 creatorBps,
        uint16 poolBps,
        uint16 llcBps,
        uint16 councilBps,
        address indexed updatedBy
    );

    /// @notice Emitted when the Council address itself is rotated.
    event CouncilUpdated(address indexed previous, address indexed current);

    // ---------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------

    error ZeroAddress();
    error SplitInvalidSum(uint16 got);
    error NotCouncil();
    error BelowMinimumBoost(uint256 amount, uint256 minimum);
    error UnregisteredManifest(bytes32 manifestHash);
    error RiskScoreAboveThreshold(bytes32 manifestHash, uint16 scoreBps);

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    /**
     * @param _usdc            Circle USDC on Base.
     * @param _registry        ContentRegistry for creator lookup.
     * @param _oracle          RiskOracle for θ_feed gate.
     * @param _persistencePool PersistencePool contract address.
     * @param _llcTreasury     LLC multisig that receives operator share.
     * @param _councilFund     Council multisig that receives governance share.
     * @param _council         Address authorized to change split parameters.
     */
    constructor(
        IERC20 _usdc,
        IContentRegistry _registry,
        IRiskOracle _oracle,
        address _persistencePool,
        address _llcTreasury,
        address _councilFund,
        address _council
    ) {
        if (address(_usdc) == address(0)) revert ZeroAddress();
        if (address(_registry) == address(0)) revert ZeroAddress();
        if (address(_oracle) == address(0)) revert ZeroAddress();
        if (_persistencePool == address(0)) revert ZeroAddress();
        if (_llcTreasury == address(0)) revert ZeroAddress();
        if (_councilFund == address(0)) revert ZeroAddress();
        if (_council == address(0)) revert ZeroAddress();

        usdc = _usdc;
        registry = _registry;
        oracle = _oracle;
        persistencePool = _persistencePool;
        llcTreasury = _llcTreasury;
        councilFund = _councilFund;
        council = _council;

        // Defaults per RFC-8 §4.3: 50% / 30% / 19% / 1%.
        creatorBps = 5_000;
        poolBps = 3_000;
        llcBps = 1_900;
        councilBps = 100;
    }

    // ---------------------------------------------------------------
    // Boost (primary user-facing action)
    // ---------------------------------------------------------------

    /**
     * @notice Boost `amount` USDC to amplify content identified by `manifestHash`.
     *         The amount is pulled from `msg.sender` (requires prior `approve`)
     *         and atomically split across creator / pool / LLC / council
     *         according to the current split parameters.
     *
     *         Reverts if:
     *         - amount is below `MIN_BOOST` (dust spam defense, RFC-8 §8.2)
     *         - manifest is not registered on ContentRegistry
     *         - R(c) from RiskOracle is >= `THETA_FEED_BPS` (editorial gate,
     *           RFC-8 INV-11)
     *
     *         Caller typically a viewer or a creator self-boosting. This
     *         contract does not distinguish; §4.5 of RFC-8 documents that
     *         boost() is symmetric.
     *
     * @param manifestHash The canonical manifest hash (RFC-1 §5).
     * @param amount       USDC amount (6 decimals) to boost.
     */
    function boost(bytes32 manifestHash, uint256 amount) external {
        if (amount < MIN_BOOST) revert BelowMinimumBoost(amount, MIN_BOOST);

        if (!registry.isRegistered(manifestHash)) {
            revert UnregisteredManifest(manifestHash);
        }

        uint16 rBps = oracle.scoreBps(manifestHash);
        if (rBps >= THETA_FEED_BPS) {
            revert RiskScoreAboveThreshold(manifestHash, rBps);
        }

        address creator = registry.ownerOf(manifestHash);

        // Compute splits. We use unchecked arithmetic only for the bps
        // multiplications where overflow is impossible given the bps
        // invariant (sum <= 10_000 and amount is uint256). The final
        // subtraction for `creatorAmount` guarantees that the sum of the
        // four equals exactly `amount` even if the bps multiplications
        // have rounding-down remainders.
        uint256 poolAmount = (amount * poolBps) / BPS_TOTAL;
        uint256 llcAmount = (amount * llcBps) / BPS_TOTAL;
        uint256 councilAmount = (amount * councilBps) / BPS_TOTAL;
        uint256 creatorAmount = amount - poolAmount - llcAmount - councilAmount;

        // Pull the full amount from the caller first. Then distribute.
        // Using SafeERC20 for standard-non-conforming USDC wrappers.
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Atomic fan-out. Any revert rolls the whole tx back.
        usdc.safeTransfer(creator, creatorAmount);
        usdc.safeTransfer(persistencePool, poolAmount);
        usdc.safeTransfer(llcTreasury, llcAmount);
        usdc.safeTransfer(councilFund, councilAmount);

        emit Boost(
            manifestHash,
            msg.sender,
            creator,
            amount,
            creatorAmount,
            poolAmount,
            llcAmount,
            councilAmount
        );
    }

    // ---------------------------------------------------------------
    // Governance (Council only)
    // ---------------------------------------------------------------

    /**
     * @notice Update the split parameters. Only callable by the Council
     *         multisig. The four values MUST sum to exactly 10_000 bps.
     *
     * @dev This function is Council-governable per RFC-8 §4.3 + RFC-7 §4.
     *      The LLC treasury address is not a signer and cannot call this.
     */
    function setSplit(uint16 _creatorBps, uint16 _poolBps, uint16 _llcBps, uint16 _councilBps)
        external
    {
        if (msg.sender != council) revert NotCouncil();

        uint32 total = uint32(_creatorBps) + uint32(_poolBps) + uint32(_llcBps) + uint32(_councilBps);
        if (total != BPS_TOTAL) revert SplitInvalidSum(uint16(total));

        creatorBps = _creatorBps;
        poolBps = _poolBps;
        llcBps = _llcBps;
        councilBps = _councilBps;

        emit SplitUpdated(_creatorBps, _poolBps, _llcBps, _councilBps, msg.sender);
    }

    /**
     * @notice Rotate the Council address. Only callable by the current
     *         Council multisig. Useful when the Council signer-set
     *         changes (RFC-7 bootstrap → elected rotation).
     */
    function setCouncil(address _council) external {
        if (msg.sender != council) revert NotCouncil();
        if (_council == address(0)) revert ZeroAddress();
        address previous = council;
        council = _council;
        emit CouncilUpdated(previous, _council);
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    /**
     * @notice Preview the four split amounts for a given `amount` under
     *         the current bps parameters. Pure view; no state change.
     *         Useful for UIs that want to display the split to viewers
     *         before they confirm a boost.
     */
    function previewSplit(uint256 amount)
        external
        view
        returns (uint256 creatorAmount, uint256 poolAmount, uint256 llcAmount, uint256 councilAmount)
    {
        poolAmount = (amount * poolBps) / BPS_TOTAL;
        llcAmount = (amount * llcBps) / BPS_TOTAL;
        councilAmount = (amount * councilBps) / BPS_TOTAL;
        creatorAmount = amount - poolAmount - llcAmount - councilAmount;
    }
}
