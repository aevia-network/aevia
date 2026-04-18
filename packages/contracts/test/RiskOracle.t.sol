// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { RiskOracle } from "../src/RiskOracle.sol";
import { IRiskOracle } from "../src/IRiskOracle.sol";

contract RiskOracleTest is Test {
    RiskOracle internal oracle;

    address internal scoringService = makeAddr("scoringService");
    address internal council = makeAddr("council");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant MANIFEST = bytes32(uint256(0xbaafcafe));
    bytes32 internal constant CLASSIFIER_V1 = keccak256("classifier-v1");
    bytes32 internal constant CONTEST_A = keccak256("contest-A");

    function setUp() public {
        oracle = new RiskOracle(scoringService, council);
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    function _validScore(uint16 r) internal view returns (RiskOracle.Score memory) {
        return RiskOracle.Score({
            r: r,
            rLegal: r / 3,
            rAbuse: r / 3,
            rValues: r - (r / 3) - (r / 3),
            updatedAt: uint64(block.timestamp),
            classifierVersion: CLASSIFIER_V1,
            isAbsolute: false
        });
    }

    function _publish(bytes32 manifest, uint16 r) internal {
        RiskOracle.Score memory s = _validScore(r);
        vm.prank(scoringService);
        oracle.publishScore(manifest, s);
    }

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    function test_Constructor_RejectsZeroScoringService() public {
        vm.expectRevert(RiskOracle.ZeroAddress.selector);
        new RiskOracle(address(0), council);
    }

    function test_Constructor_RejectsZeroCouncil() public {
        vm.expectRevert(RiskOracle.ZeroAddress.selector);
        new RiskOracle(scoringService, address(0));
    }

    function test_Constructor_SetsState() public view {
        assertEq(oracle.scoringService(), scoringService);
        assertEq(oracle.council(), council);
        assertEq(oracle.BPS_MAX(), 10_000);
        assertEq(oracle.MAX_PUBLISH_SKEW(), 3_600);
    }

    // ---------------------------------------------------------------
    // Views for unknown manifest
    // ---------------------------------------------------------------

    function test_View_UnknownManifest_ReturnsZero() public view {
        assertEq(oracle.scoreBps(bytes32(uint256(0xdead))), 0);
        RiskOracle.Score memory s = oracle.scoreOf(bytes32(uint256(0xdead)));
        assertEq(s.r, 0);
        assertEq(s.updatedAt, 0);
        assertEq(s.classifierVersion, bytes32(0));
        assertFalse(s.isAbsolute);
        assertFalse(oracle.isContested(bytes32(uint256(0xdead))));
        assertEq(oracle.activeContestOf(bytes32(uint256(0xdead))), bytes32(0));
    }

    // ---------------------------------------------------------------
    // IRiskOracle interface — used by BoostRouter
    // ---------------------------------------------------------------

    function test_IRiskOracle_InterfaceExposesScoreBps() public {
        // Cast to the narrow interface BoostRouter consumes to make
        // sure the signature is compatible.
        IRiskOracle narrow = IRiskOracle(address(oracle));
        assertEq(narrow.scoreBps(MANIFEST), 0);
        _publish(MANIFEST, 1_500);
        assertEq(narrow.scoreBps(MANIFEST), 1_500);
    }

    // ---------------------------------------------------------------
    // publishScore — authorization
    // ---------------------------------------------------------------

    function test_PublishScore_OnlyScoringService() public {
        RiskOracle.Score memory s = _validScore(500);

        vm.prank(council);
        vm.expectRevert(RiskOracle.NotScoringService.selector);
        oracle.publishScore(MANIFEST, s);

        vm.prank(stranger);
        vm.expectRevert(RiskOracle.NotScoringService.selector);
        oracle.publishScore(MANIFEST, s);
    }

    function test_PublishScore_HappyPath_EmitsAndStores() public {
        RiskOracle.Score memory s = _validScore(1_800);

        vm.expectEmit(true, false, true, true, address(oracle));
        emit RiskOracle.ScorePublished(
            MANIFEST, 1_800, 600, 600, 600, uint64(block.timestamp), CLASSIFIER_V1, false
        );

        vm.prank(scoringService);
        oracle.publishScore(MANIFEST, s);

        assertEq(oracle.scoreBps(MANIFEST), 1_800);
        RiskOracle.Score memory stored = oracle.scoreOf(MANIFEST);
        assertEq(stored.r, 1_800);
        assertEq(stored.rLegal, 600);
        assertEq(stored.rAbuse, 600);
        assertEq(stored.rValues, 600);
        assertEq(stored.classifierVersion, CLASSIFIER_V1);
        assertFalse(stored.isAbsolute);
    }

    function test_PublishScore_Overwrites_PreviousRecord() public {
        _publish(MANIFEST, 500);
        assertEq(oracle.scoreBps(MANIFEST), 500);

        _publish(MANIFEST, 2_500);
        assertEq(oracle.scoreBps(MANIFEST), 2_500);
    }

    // ---------------------------------------------------------------
    // publishScore — validation
    // ---------------------------------------------------------------

    function test_PublishScore_RejectsCompositeAboveMax() public {
        RiskOracle.Score memory s = _validScore(500);
        s.r = 10_001;

        vm.prank(scoringService);
        vm.expectRevert(abi.encodeWithSelector(RiskOracle.ScoreOutOfRange.selector, uint16(10_001)));
        oracle.publishScore(MANIFEST, s);
    }

    function test_PublishScore_RejectsLegalAboveMax() public {
        RiskOracle.Score memory s = _validScore(500);
        s.rLegal = 10_001;

        vm.prank(scoringService);
        vm.expectRevert(abi.encodeWithSelector(RiskOracle.ScoreOutOfRange.selector, uint16(10_001)));
        oracle.publishScore(MANIFEST, s);
    }

    function test_PublishScore_RejectsAbuseAboveMax() public {
        RiskOracle.Score memory s = _validScore(500);
        s.rAbuse = 10_001;

        vm.prank(scoringService);
        vm.expectRevert(abi.encodeWithSelector(RiskOracle.ScoreOutOfRange.selector, uint16(10_001)));
        oracle.publishScore(MANIFEST, s);
    }

    function test_PublishScore_RejectsValuesAboveMax() public {
        RiskOracle.Score memory s = _validScore(500);
        s.rValues = 10_001;

        vm.prank(scoringService);
        vm.expectRevert(abi.encodeWithSelector(RiskOracle.ScoreOutOfRange.selector, uint16(10_001)));
        oracle.publishScore(MANIFEST, s);
    }

    function test_PublishScore_AbsoluteMustBeMax() public {
        RiskOracle.Score memory s = _validScore(5_000);
        s.isAbsolute = true;
        // r = 5_000 but isAbsolute = true → revert.

        vm.prank(scoringService);
        vm.expectRevert(abi.encodeWithSelector(RiskOracle.AbsoluteMustBeMax.selector, uint16(5_000)));
        oracle.publishScore(MANIFEST, s);
    }

    function test_PublishScore_AbsoluteAtMax_Allowed() public {
        RiskOracle.Score memory s = _validScore(10_000);
        s.isAbsolute = true;

        vm.prank(scoringService);
        oracle.publishScore(MANIFEST, s);

        RiskOracle.Score memory stored = oracle.scoreOf(MANIFEST);
        assertEq(stored.r, 10_000);
        assertTrue(stored.isAbsolute);
    }

    function test_PublishScore_RejectsFarFutureTimestamp() public {
        // Warp to a safe, non-zero block.timestamp before computing the offending value,
        // so the test is not sensitive to the zero-skew branch at t=0.
        vm.warp(1_700_000_000);

        RiskOracle.Score memory s = _validScore(500);
        uint64 tooFar = uint64(block.timestamp) + 7_200; // 2h ahead > 1h skew
        s.updatedAt = tooFar;

        vm.prank(scoringService);
        vm.expectRevert(
            abi.encodeWithSelector(
                RiskOracle.UpdatedAtOutOfWindow.selector, tooFar, uint64(block.timestamp)
            )
        );
        oracle.publishScore(MANIFEST, s);
    }

    function test_PublishScore_RejectsAncientTimestamp() public {
        vm.warp(1_700_000_000);

        RiskOracle.Score memory s = _validScore(500);
        uint64 tooOld = uint64(block.timestamp) - 7_200;
        s.updatedAt = tooOld;

        vm.prank(scoringService);
        vm.expectRevert(
            abi.encodeWithSelector(
                RiskOracle.UpdatedAtOutOfWindow.selector, tooOld, uint64(block.timestamp)
            )
        );
        oracle.publishScore(MANIFEST, s);
    }

    function test_PublishScore_AcceptsEdgeOfSkewWindow() public {
        vm.warp(1_700_000_000);

        // updatedAt = now - skew exactly: MUST be accepted (inclusive window).
        RiskOracle.Score memory s = _validScore(500);
        s.updatedAt = uint64(block.timestamp) - 3_600;

        vm.prank(scoringService);
        oracle.publishScore(MANIFEST, s);
        assertEq(oracle.scoreOf(MANIFEST).updatedAt, uint64(block.timestamp) - 3_600);
    }

    // ---------------------------------------------------------------
    // Contest lifecycle
    // ---------------------------------------------------------------

    function test_ContestScore_OnlyCouncil() public {
        vm.prank(stranger);
        vm.expectRevert(RiskOracle.NotCouncil.selector);
        oracle.contestScore(MANIFEST, CONTEST_A);

        vm.prank(scoringService);
        vm.expectRevert(RiskOracle.NotCouncil.selector);
        oracle.contestScore(MANIFEST, CONTEST_A);
    }

    function test_ContestScore_RejectsZeroId() public {
        vm.prank(council);
        vm.expectRevert(RiskOracle.ZeroContestId.selector);
        oracle.contestScore(MANIFEST, bytes32(0));
    }

    function test_ContestScore_HappyPath() public {
        vm.expectEmit(true, true, true, false, address(oracle));
        emit RiskOracle.ScoreContested(MANIFEST, CONTEST_A, council);

        vm.prank(council);
        oracle.contestScore(MANIFEST, CONTEST_A);

        assertTrue(oracle.isContested(MANIFEST));
        assertEq(oracle.activeContestOf(MANIFEST), CONTEST_A);
    }

    function test_ContestScore_RejectsDoubleContest() public {
        vm.prank(council);
        oracle.contestScore(MANIFEST, CONTEST_A);

        bytes32 contestB = keccak256("contest-B");
        vm.prank(council);
        vm.expectRevert(
            abi.encodeWithSelector(RiskOracle.ContestAlreadyActive.selector, MANIFEST, CONTEST_A)
        );
        oracle.contestScore(MANIFEST, contestB);
    }

    function test_PublishScore_RejectedWhileContested() public {
        _publish(MANIFEST, 500);

        vm.prank(council);
        oracle.contestScore(MANIFEST, CONTEST_A);

        RiskOracle.Score memory s = _validScore(800);
        vm.prank(scoringService);
        vm.expectRevert(
            abi.encodeWithSelector(RiskOracle.ContestAlreadyActive.selector, MANIFEST, CONTEST_A)
        );
        oracle.publishScore(MANIFEST, s);

        // Score frozen at previous value.
        assertEq(oracle.scoreBps(MANIFEST), 500);
    }

    function test_ResolveContest_OnlyCouncil() public {
        vm.prank(council);
        oracle.contestScore(MANIFEST, CONTEST_A);

        RiskOracle.Score memory resolved = _validScore(200);

        vm.prank(stranger);
        vm.expectRevert(RiskOracle.NotCouncil.selector);
        oracle.resolveContest(MANIFEST, CONTEST_A, resolved);

        vm.prank(scoringService);
        vm.expectRevert(RiskOracle.NotCouncil.selector);
        oracle.resolveContest(MANIFEST, CONTEST_A, resolved);
    }

    function test_ResolveContest_RejectsIfNoActive() public {
        RiskOracle.Score memory resolved = _validScore(200);

        vm.prank(council);
        vm.expectRevert(abi.encodeWithSelector(RiskOracle.ContestNotActive.selector, MANIFEST));
        oracle.resolveContest(MANIFEST, CONTEST_A, resolved);
    }

    function test_ResolveContest_RejectsContestIdMismatch() public {
        vm.prank(council);
        oracle.contestScore(MANIFEST, CONTEST_A);

        bytes32 wrong = keccak256("contest-wrong");
        RiskOracle.Score memory resolved = _validScore(200);

        vm.prank(council);
        vm.expectRevert(
            abi.encodeWithSelector(RiskOracle.ContestIdMismatch.selector, CONTEST_A, wrong)
        );
        oracle.resolveContest(MANIFEST, wrong, resolved);
    }

    function test_ResolveContest_OverwritesAndClearsLock() public {
        _publish(MANIFEST, 5_000);

        vm.prank(council);
        oracle.contestScore(MANIFEST, CONTEST_A);

        RiskOracle.Score memory resolved = _validScore(800);

        vm.expectEmit(true, true, false, true, address(oracle));
        emit RiskOracle.ContestResolved(MANIFEST, CONTEST_A, 800);

        vm.prank(council);
        oracle.resolveContest(MANIFEST, CONTEST_A, resolved);

        assertEq(oracle.scoreBps(MANIFEST), 800);
        assertFalse(oracle.isContested(MANIFEST));
        assertEq(oracle.activeContestOf(MANIFEST), bytes32(0));

        // New publish after resolution must succeed.
        _publish(MANIFEST, 1_200);
        assertEq(oracle.scoreBps(MANIFEST), 1_200);
    }

    function test_ResolveContest_ValidatesResolvedScore() public {
        vm.prank(council);
        oracle.contestScore(MANIFEST, CONTEST_A);

        RiskOracle.Score memory bad = _validScore(5_000);
        bad.r = 10_001;

        vm.prank(council);
        vm.expectRevert(abi.encodeWithSelector(RiskOracle.ScoreOutOfRange.selector, uint16(10_001)));
        oracle.resolveContest(MANIFEST, CONTEST_A, bad);

        // Lock remains active.
        assertTrue(oracle.isContested(MANIFEST));
    }

    // ---------------------------------------------------------------
    // Role rotation
    // ---------------------------------------------------------------

    function test_RotateScoringServiceKey_OnlyCouncil() public {
        address newSigner = makeAddr("newSigner");

        vm.prank(scoringService); // self-rotation must fail — §8.4 invariant
        vm.expectRevert(RiskOracle.NotCouncil.selector);
        oracle.rotateScoringServiceKey(newSigner);

        vm.prank(stranger);
        vm.expectRevert(RiskOracle.NotCouncil.selector);
        oracle.rotateScoringServiceKey(newSigner);
    }

    function test_RotateScoringServiceKey_RejectsZero() public {
        vm.prank(council);
        vm.expectRevert(RiskOracle.ZeroAddress.selector);
        oracle.rotateScoringServiceKey(address(0));
    }

    function test_RotateScoringServiceKey_HappyPath() public {
        address newSigner = makeAddr("newSigner");

        vm.expectEmit(true, true, false, false, address(oracle));
        emit RiskOracle.ScoringServiceRotated(scoringService, newSigner);

        vm.prank(council);
        oracle.rotateScoringServiceKey(newSigner);
        assertEq(oracle.scoringService(), newSigner);
    }

    function test_RotateScoringServiceKey_OldLosesRights() public {
        address newSigner = makeAddr("newSigner");
        vm.prank(council);
        oracle.rotateScoringServiceKey(newSigner);

        RiskOracle.Score memory s = _validScore(500);

        // Old scoring service can no longer publish.
        vm.prank(scoringService);
        vm.expectRevert(RiskOracle.NotScoringService.selector);
        oracle.publishScore(MANIFEST, s);

        // New one can.
        vm.prank(newSigner);
        oracle.publishScore(MANIFEST, s);
        assertEq(oracle.scoreBps(MANIFEST), 500);
    }

    function test_SetCouncil_OnlyCouncil() public {
        address newCouncil = makeAddr("newCouncil");

        vm.prank(stranger);
        vm.expectRevert(RiskOracle.NotCouncil.selector);
        oracle.setCouncil(newCouncil);

        vm.prank(scoringService);
        vm.expectRevert(RiskOracle.NotCouncil.selector);
        oracle.setCouncil(newCouncil);
    }

    function test_SetCouncil_RejectsZero() public {
        vm.prank(council);
        vm.expectRevert(RiskOracle.ZeroAddress.selector);
        oracle.setCouncil(address(0));
    }

    function test_SetCouncil_HappyPath_OldLosesRights() public {
        address newCouncil = makeAddr("newCouncil");

        vm.expectEmit(true, true, false, false, address(oracle));
        emit RiskOracle.CouncilUpdated(council, newCouncil);

        vm.prank(council);
        oracle.setCouncil(newCouncil);
        assertEq(oracle.council(), newCouncil);

        // Old council cannot contest anymore.
        vm.prank(council);
        vm.expectRevert(RiskOracle.NotCouncil.selector);
        oracle.contestScore(MANIFEST, CONTEST_A);

        // New council can.
        vm.prank(newCouncil);
        oracle.contestScore(MANIFEST, CONTEST_A);
        assertTrue(oracle.isContested(MANIFEST));
    }

    // ---------------------------------------------------------------
    // Fuzz
    // ---------------------------------------------------------------

    function testFuzz_PublishScore_AnyValidInputRoundTrips(
        uint16 r,
        uint16 rLegal,
        uint16 rAbuse,
        uint16 rValues
    )
        public
    {
        vm.assume(r <= 10_000);
        vm.assume(rLegal <= 10_000);
        vm.assume(rAbuse <= 10_000);
        vm.assume(rValues <= 10_000);

        RiskOracle.Score memory s = RiskOracle.Score({
            r: r,
            rLegal: rLegal,
            rAbuse: rAbuse,
            rValues: rValues,
            updatedAt: uint64(block.timestamp),
            classifierVersion: CLASSIFIER_V1,
            isAbsolute: false
        });

        vm.prank(scoringService);
        oracle.publishScore(MANIFEST, s);

        assertEq(oracle.scoreBps(MANIFEST), r);
        RiskOracle.Score memory stored = oracle.scoreOf(MANIFEST);
        assertEq(stored.r, r);
        assertEq(stored.rLegal, rLegal);
        assertEq(stored.rAbuse, rAbuse);
        assertEq(stored.rValues, rValues);
    }

    function testFuzz_PublishScore_RejectsOutOfRange(uint16 rLegal) public {
        vm.assume(rLegal > 10_000);

        RiskOracle.Score memory s = _validScore(500);
        s.rLegal = rLegal;

        vm.prank(scoringService);
        vm.expectRevert(abi.encodeWithSelector(RiskOracle.ScoreOutOfRange.selector, rLegal));
        oracle.publishScore(MANIFEST, s);
    }
}
