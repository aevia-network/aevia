// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { IRiskOracle } from "./IRiskOracle.sol";

/**
 * @title RiskOracle
 * @notice On-chain publication of the Risk Score R(c) specified in
 *         RFC-6 `docs/protocol-spec/6-risk-score.md` §8. Consumers
 *         (notably `BoostRouter`, per RFC-8 §4.4) read scores from
 *         this contract in-transaction to gate editorial decisions
 *         (feed surfacing, subsidy eligibility, paid amplification).
 *
 * @dev Roles:
 *      - `scoringService`: publishes scores. Key rotation is NOT
 *        unilateral; only the Council may rotate it (RFC-6 §8.4).
 *      - `council`: contests scores, resolves contests, rotates
 *        the scoring service key, and can rotate itself.
 *
 *      Invariants (RFC-6 §8 + §11):
 *      - Score components and composite are in [0, 10_000] bps.
 *      - `isAbsolute == true` implies `r == 10_000` (category [b]
 *        or [c] trigger — RFC-4 hard exclusions).
 *      - While a manifest has an active contest, new publishScore
 *        calls for that manifest MUST revert. Only resolveContest
 *        may update a contested score.
 *      - `updatedAt` MUST lie within a fresh window around
 *        `block.timestamp` — published-in-the-future and
 *        ancient-published both rejected. Default skew = 1 hour.
 *
 *      The narrow `IRiskOracle` interface (a single `scoreBps`
 *      method) is the contract that `BoostRouter` consumes. The
 *      full surface (struct `Score`, freshness, contest state) is
 *      available to consumers who need it.
 *
 *      This contract is un-audited at commit time. Mainnet
 *      deployment is gated on external audit, per ADR 0008 for
 *      the `BoostRouter` that depends on this oracle.
 */
contract RiskOracle is IRiskOracle {
    // ---------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------

    /**
     * @notice Full Score record as specified in RFC-6 §8.2.
     * @dev `r` is the composite R(c); `rLegal`, `rAbuse`, `rValues`
     *      are the three components per RFC-6 §3. `classifierVersion`
     *      binds the score to a specific version of the off-chain
     *      scoring pipeline for reproducibility (RFC-6 §6.3).
     *      `isAbsolute == true` short-circuits the composite to
     *      `r = 10_000` per RFC-4 hard exclusions.
     */
    struct Score {
        uint16 r;
        uint16 rLegal;
        uint16 rAbuse;
        uint16 rValues;
        uint64 updatedAt;
        bytes32 classifierVersion;
        bool isAbsolute;
    }

    // ---------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------

    /// @notice Current Score per manifestHash. A hash with no record
    ///         returns the default (all-zero) Score, which maps to
    ///         "no signal" for downstream consumers.
    mapping(bytes32 manifestHash => Score) private _scores;

    /// @notice Active contest id per manifestHash. Zero means no
    ///         active contest. A non-zero value locks publishScore
    ///         for that manifest until resolveContest clears it.
    mapping(bytes32 manifestHash => bytes32 contestId) private _activeContest;

    /// @notice Address authorized to publish scores (the Scoring
    ///         service signer per RFC-6 §8.4). Rotatable only by
    ///         the Council via `rotateScoringServiceKey`.
    address public scoringService;

    /// @notice Council multisig. Contests, resolves contests,
    ///         rotates the scoring service key, and rotates itself.
    ///         Intended to be the same multisig that governs
    ///         `BoostRouter.council` in production.
    address public council;

    // ---------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------

    /// @notice Basis point denominator (100% = 10_000 bps).
    uint16 public constant BPS_MAX = 10_000;

    /// @notice Maximum allowed skew between `Score.updatedAt` and
    ///         `block.timestamp` when publishing. Default = 1 hour.
    ///         Protects against clock-skewed or replay-published
    ///         scores (future or ancient). RFC-6 §11.4.
    uint64 public constant MAX_PUBLISH_SKEW = 3600;

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    /// @notice Emitted when a score is published or updated for
    ///         `manifestHash`. Indexed fields match RFC-6 §8.2.
    event ScorePublished(
        bytes32 indexed manifestHash,
        uint16 r,
        uint16 rLegal,
        uint16 rAbuse,
        uint16 rValues,
        uint64 updatedAt,
        bytes32 indexed classifierVersion,
        bool isAbsolute
    );

    /// @notice Emitted when the Council opens a contest for a score.
    ///         Further publishScore calls for this manifest are
    ///         rejected until the contest is resolved.
    event ScoreContested(
        bytes32 indexed manifestHash, bytes32 indexed contestId, address indexed initiator
    );

    /// @notice Emitted when the Council resolves a contest, writing
    ///         the Jury-decided Score as the new record.
    event ContestResolved(
        bytes32 indexed manifestHash, bytes32 indexed contestId, uint16 resolvedR
    );

    /// @notice Emitted when the Council rotates the Scoring service
    ///         key. Does NOT invalidate previously-published scores;
    ///         only new publish calls must use the new key.
    event ScoringServiceRotated(address indexed previous, address indexed current);

    /// @notice Emitted when the Council rotates its own address.
    event CouncilUpdated(address indexed previous, address indexed current);

    // ---------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------

    error ZeroAddress();
    error NotScoringService();
    error NotCouncil();
    error ScoreOutOfRange(uint16 value);
    error AbsoluteMustBeMax(uint16 r);
    error UpdatedAtOutOfWindow(uint64 updatedAt, uint64 blockTime);
    error ContestAlreadyActive(bytes32 manifestHash, bytes32 existingContestId);
    error ContestNotActive(bytes32 manifestHash);
    error ContestIdMismatch(bytes32 expected, bytes32 provided);
    error ZeroContestId();

    // ---------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------

    modifier onlyScoringService() {
        if (msg.sender != scoringService) revert NotScoringService();
        _;
    }

    modifier onlyCouncil() {
        if (msg.sender != council) revert NotCouncil();
        _;
    }

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    /**
     * @param _scoringService Address of the off-chain Scoring service
     *                        signer. EOA in bootstrap; may rotate to
     *                        a multisig or contract signer via the
     *                        Council.
     * @param _council        Address of the Council multisig. In
     *                        production, MUST be the same multisig
     *                        used by `BoostRouter.council` so that
     *                        editorial governance is unified.
     */
    constructor(address _scoringService, address _council) {
        if (_scoringService == address(0)) revert ZeroAddress();
        if (_council == address(0)) revert ZeroAddress();
        scoringService = _scoringService;
        council = _council;
    }

    // ---------------------------------------------------------------
    // Views — IRiskOracle implementation + richer surface
    // ---------------------------------------------------------------

    /**
     * @notice Composite R(c) in basis points. Implements `IRiskOracle`.
     * @dev Returns 0 for unknown manifests (consistent with the
     *      `IRiskOracle` contract: BoostRouter treats 0 as "no
     *      signal" and allows the boost to proceed).
     */
    function scoreBps(bytes32 manifestHash) external view returns (uint16) {
        return _scores[manifestHash].r;
    }

    /// @notice Full Score record for `manifestHash`. Zero-value
    ///         struct returned for unknown manifests.
    function scoreOf(bytes32 manifestHash) external view returns (Score memory) {
        return _scores[manifestHash];
    }

    /// @notice Active contest id for `manifestHash`, or `bytes32(0)`.
    function activeContestOf(bytes32 manifestHash) external view returns (bytes32) {
        return _activeContest[manifestHash];
    }

    /// @notice True if `manifestHash` currently has an active contest.
    function isContested(bytes32 manifestHash) external view returns (bool) {
        return _activeContest[manifestHash] != bytes32(0);
    }

    // ---------------------------------------------------------------
    // Scoring service — publish
    // ---------------------------------------------------------------

    /**
     * @notice Publish or update the Score for `manifestHash`.
     *         Callable only by the Scoring service address.
     *
     * @dev Validations:
     *      - All four component values in [0, 10_000] bps.
     *      - `updatedAt` within ±MAX_PUBLISH_SKEW of `block.timestamp`.
     *      - If `isAbsolute`, `r == 10_000` (absolute exclusion
     *        from RFC-4 categories [b]/[c] short-circuits composite).
     *      - No active contest for this manifestHash.
     */
    function publishScore(bytes32 manifestHash, Score calldata newScore)
        external
        onlyScoringService
    {
        bytes32 activeContest = _activeContest[manifestHash];
        if (activeContest != bytes32(0)) {
            revert ContestAlreadyActive(manifestHash, activeContest);
        }

        _validateScore(newScore);

        _scores[manifestHash] = newScore;

        emit ScorePublished(
            manifestHash,
            newScore.r,
            newScore.rLegal,
            newScore.rAbuse,
            newScore.rValues,
            newScore.updatedAt,
            newScore.classifierVersion,
            newScore.isAbsolute
        );
    }

    // ---------------------------------------------------------------
    // Council — contest lifecycle + role rotation
    // ---------------------------------------------------------------

    /**
     * @notice Open a contest for `manifestHash`. Callable only by
     *         the Council (typically triggered by a creator appeal
     *         per RFC-7). Freezes the current score — no further
     *         `publishScore` may run until `resolveContest`.
     *
     * @dev `contestId` is the identifier assigned off-chain by the
     *      Council/Jury pipeline (e.g., keccak256 of the appeal
     *      document CID); the contract enforces uniqueness per
     *      manifest only. A manifest MAY have sequential contests
     *      over time, but only one active at a time.
     */
    function contestScore(bytes32 manifestHash, bytes32 contestId) external onlyCouncil {
        if (contestId == bytes32(0)) revert ZeroContestId();
        bytes32 active = _activeContest[manifestHash];
        if (active != bytes32(0)) revert ContestAlreadyActive(manifestHash, active);

        _activeContest[manifestHash] = contestId;
        emit ScoreContested(manifestHash, contestId, msg.sender);
    }

    /**
     * @notice Resolve an active contest with the Jury's decided
     *         Score. Overwrites the current record and clears the
     *         active contest lock. Callable only by the Council.
     *
     * @dev `contestId` MUST equal the currently-active contest for
     *      this manifest — guards against resolving a stale contest
     *      id if two appeals were serialized out of order.
     */
    function resolveContest(
        bytes32 manifestHash,
        bytes32 contestId,
        Score calldata resolvedScore
    )
        external
        onlyCouncil
    {
        bytes32 active = _activeContest[manifestHash];
        if (active == bytes32(0)) revert ContestNotActive(manifestHash);
        if (active != contestId) revert ContestIdMismatch(active, contestId);

        _validateScore(resolvedScore);

        _scores[manifestHash] = resolvedScore;
        delete _activeContest[manifestHash];

        emit ContestResolved(manifestHash, contestId, resolvedScore.r);
        emit ScorePublished(
            manifestHash,
            resolvedScore.r,
            resolvedScore.rLegal,
            resolvedScore.rAbuse,
            resolvedScore.rValues,
            resolvedScore.updatedAt,
            resolvedScore.classifierVersion,
            resolvedScore.isAbsolute
        );
    }

    /**
     * @notice Rotate the Scoring service address. Only the Council
     *         may call this (RFC-6 §8.4 — Operator cannot rotate
     *         unilaterally). Previously-published scores remain
     *         valid; only new `publishScore` calls must come from
     *         the new address.
     */
    function rotateScoringServiceKey(address newScoringService) external onlyCouncil {
        if (newScoringService == address(0)) revert ZeroAddress();
        address previous = scoringService;
        scoringService = newScoringService;
        emit ScoringServiceRotated(previous, newScoringService);
    }

    /**
     * @notice Rotate the Council address. Only the current Council
     *         may call. Used when the Council multisig signer-set
     *         changes (RFC-7 bootstrap → elected rotation).
     */
    function setCouncil(address newCouncil) external onlyCouncil {
        if (newCouncil == address(0)) revert ZeroAddress();
        address previous = council;
        council = newCouncil;
        emit CouncilUpdated(previous, newCouncil);
    }

    // ---------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------

    function _validateScore(Score calldata s) internal view {
        if (s.r > BPS_MAX) revert ScoreOutOfRange(s.r);
        if (s.rLegal > BPS_MAX) revert ScoreOutOfRange(s.rLegal);
        if (s.rAbuse > BPS_MAX) revert ScoreOutOfRange(s.rAbuse);
        if (s.rValues > BPS_MAX) revert ScoreOutOfRange(s.rValues);

        if (s.isAbsolute && s.r != BPS_MAX) revert AbsoluteMustBeMax(s.r);

        uint64 nowTs = uint64(block.timestamp);
        uint64 lo = nowTs > MAX_PUBLISH_SKEW ? nowTs - MAX_PUBLISH_SKEW : 0;
        uint64 hi = nowTs + MAX_PUBLISH_SKEW;
        if (s.updatedAt < lo || s.updatedAt > hi) {
            revert UpdatedAtOutOfWindow(s.updatedAt, nowTs);
        }
    }
}
