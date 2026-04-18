// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { BoostRouter } from "../src/BoostRouter.sol";
import { IContentRegistry } from "../src/IContentRegistry.sol";
import { IRiskOracle } from "../src/IRiskOracle.sol";

// ---------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") { }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockRegistry is IContentRegistry {
    mapping(bytes32 => address) public owners;
    mapping(bytes32 => bool) public registered;

    function set(bytes32 cid, address owner) external {
        owners[cid] = owner;
        registered[cid] = true;
    }

    function ownerOf(bytes32 cid) external view returns (address) {
        return owners[cid];
    }

    function isRegistered(bytes32 cid) external view returns (bool) {
        return registered[cid];
    }
}

contract MockOracle is IRiskOracle {
    mapping(bytes32 => uint16) public scores;

    function set(bytes32 cid, uint16 bps) external {
        scores[cid] = bps;
    }

    function scoreBps(bytes32 cid) external view returns (uint16) {
        return scores[cid];
    }
}

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

contract BoostRouterTest is Test {
    MockUSDC internal usdc;
    MockRegistry internal registry;
    MockOracle internal oracle;
    BoostRouter internal router;

    address internal creator = makeAddr("creator");
    address internal persistencePool = makeAddr("persistencePool");
    address internal llcTreasury = makeAddr("llcTreasury");
    address internal councilFund = makeAddr("councilFund");
    address internal council = makeAddr("council");
    address internal viewer = makeAddr("viewer");

    bytes32 internal constant MANIFEST = bytes32(uint256(0xbaafcafe));

    function setUp() public {
        usdc = new MockUSDC();
        registry = new MockRegistry();
        oracle = new MockOracle();
        router = new BoostRouter(
            IERC20(address(usdc)),
            IContentRegistry(address(registry)),
            IRiskOracle(address(oracle)),
            persistencePool,
            llcTreasury,
            councilFund,
            council
        );

        registry.set(MANIFEST, creator);
        oracle.set(MANIFEST, 1_000); // R(c) = 0.10, safely below θ_feed = 0.30
    }

    // ----- constructor -----

    function test_Constructor_RejectsZeroUSDC() public {
        vm.expectRevert(BoostRouter.ZeroAddress.selector);
        new BoostRouter(
            IERC20(address(0)),
            IContentRegistry(address(registry)),
            IRiskOracle(address(oracle)),
            persistencePool,
            llcTreasury,
            councilFund,
            council
        );
    }

    function test_Constructor_RejectsZeroRegistry() public {
        vm.expectRevert(BoostRouter.ZeroAddress.selector);
        new BoostRouter(
            IERC20(address(usdc)),
            IContentRegistry(address(0)),
            IRiskOracle(address(oracle)),
            persistencePool,
            llcTreasury,
            councilFund,
            council
        );
    }

    function test_Constructor_RejectsZeroOracle() public {
        vm.expectRevert(BoostRouter.ZeroAddress.selector);
        new BoostRouter(
            IERC20(address(usdc)),
            IContentRegistry(address(registry)),
            IRiskOracle(address(0)),
            persistencePool,
            llcTreasury,
            councilFund,
            council
        );
    }

    function test_Constructor_RejectsZeroPool() public {
        vm.expectRevert(BoostRouter.ZeroAddress.selector);
        new BoostRouter(
            IERC20(address(usdc)),
            IContentRegistry(address(registry)),
            IRiskOracle(address(oracle)),
            address(0),
            llcTreasury,
            councilFund,
            council
        );
    }

    function test_Constructor_RejectsZeroLLC() public {
        vm.expectRevert(BoostRouter.ZeroAddress.selector);
        new BoostRouter(
            IERC20(address(usdc)),
            IContentRegistry(address(registry)),
            IRiskOracle(address(oracle)),
            persistencePool,
            address(0),
            councilFund,
            council
        );
    }

    function test_Constructor_RejectsZeroCouncilFund() public {
        vm.expectRevert(BoostRouter.ZeroAddress.selector);
        new BoostRouter(
            IERC20(address(usdc)),
            IContentRegistry(address(registry)),
            IRiskOracle(address(oracle)),
            persistencePool,
            llcTreasury,
            address(0),
            council
        );
    }

    function test_Constructor_RejectsZeroCouncil() public {
        vm.expectRevert(BoostRouter.ZeroAddress.selector);
        new BoostRouter(
            IERC20(address(usdc)),
            IContentRegistry(address(registry)),
            IRiskOracle(address(oracle)),
            persistencePool,
            llcTreasury,
            councilFund,
            address(0)
        );
    }

    function test_Constructor_DefaultSplitMatchesRFC8() public view {
        // RFC-8 §4.3 default: 50 / 30 / 19 / 1.
        assertEq(router.creatorBps(), 5_000);
        assertEq(router.poolBps(), 3_000);
        assertEq(router.llcBps(), 1_900);
        assertEq(router.councilBps(), 100);
    }

    // ----- boost: happy path -----

    function test_Boost_SplitsSumToAmount() public {
        uint256 amount = 100e6; // 100 USDC

        _approveAndBoost(viewer, amount);

        uint256 creatorBal = usdc.balanceOf(creator);
        uint256 poolBal = usdc.balanceOf(persistencePool);
        uint256 llcBal = usdc.balanceOf(llcTreasury);
        uint256 councilBal = usdc.balanceOf(councilFund);

        assertEq(creatorBal + poolBal + llcBal + councilBal, amount, "split conservation");

        // Default 50/30/19/1.
        assertEq(creatorBal, 50e6, "creator 50%");
        assertEq(poolBal, 30e6, "pool 30%");
        assertEq(llcBal, 19e6, "llc 19%");
        assertEq(councilBal, 1e6, "council 1%");
    }

    function test_Boost_IsNonCustodial_INV6() public {
        uint256 amount = 100e6;
        _approveAndBoost(viewer, amount);

        // INV-6: contract holds no USDC balance between transactions.
        assertEq(usdc.balanceOf(address(router)), 0, "router must not hold USDC");
    }

    function test_Boost_EmitsBoostEvent_INV9() public {
        uint256 amount = 100e6;
        usdc.mint(viewer, amount);
        vm.prank(viewer);
        usdc.approve(address(router), amount);

        vm.expectEmit(true, true, true, true, address(router));
        emit BoostRouter.Boost(MANIFEST, viewer, creator, amount, 50e6, 30e6, 19e6, 1e6);

        vm.prank(viewer);
        router.boost(MANIFEST, amount);
    }

    function test_Boost_CreatorReceivesRoundingDust() public {
        // Amount that doesn't divide evenly: 1_000_001 wei across 3000/1900/100 bps.
        // poolAmount   = floor(1_000_001 * 3000 / 10000) = 300_000
        // llcAmount    = floor(1_000_001 * 1900 / 10000) = 190_000
        // councilAmt   = floor(1_000_001 *  100 / 10000) =  10_000
        // creatorAmt   = 1_000_001 - 300_000 - 190_000 - 10_000 = 500_001 (+1 dust)
        uint256 amount = 1_000_001;
        _approveAndBoost(viewer, amount);

        assertEq(usdc.balanceOf(creator), 500_001, "creator absorbs dust");
        assertEq(usdc.balanceOf(persistencePool), 300_000);
        assertEq(usdc.balanceOf(llcTreasury), 190_000);
        assertEq(usdc.balanceOf(councilFund), 10_000);
        // Total = 500_001 + 300_000 + 190_000 + 10_000 = 1_000_001 ✓
    }

    // ----- boost: gates -----

    function test_Boost_RevertsBelowMinimum() public {
        uint256 tooSmall = 499_999; // just under $0.50
        usdc.mint(viewer, tooSmall);
        vm.prank(viewer);
        usdc.approve(address(router), tooSmall);

        vm.prank(viewer);
        vm.expectRevert(
            abi.encodeWithSelector(BoostRouter.BelowMinimumBoost.selector, tooSmall, router.MIN_BOOST())
        );
        router.boost(MANIFEST, tooSmall);
    }

    function test_Boost_AcceptsExactMinimum() public {
        uint256 exactly = 500_000; // exactly $0.50
        _approveAndBoost(viewer, exactly);
        assertEq(usdc.balanceOf(address(router)), 0);
    }

    function test_Boost_RevertsOnUnregisteredManifest() public {
        bytes32 unknown = bytes32(uint256(0xdead));
        uint256 amount = 1e6;
        usdc.mint(viewer, amount);
        vm.prank(viewer);
        usdc.approve(address(router), amount);

        vm.prank(viewer);
        vm.expectRevert(abi.encodeWithSelector(BoostRouter.UnregisteredManifest.selector, unknown));
        router.boost(unknown, amount);
    }

    function test_Boost_RevertsWhenRiskScoreAboveThreshold() public {
        // θ_feed = 0.30 = 3000 bps. Boost MUST revert at exactly 3000 bps (gate is >=).
        oracle.set(MANIFEST, 3_000);

        uint256 amount = 1e6;
        usdc.mint(viewer, amount);
        vm.prank(viewer);
        usdc.approve(address(router), amount);

        vm.prank(viewer);
        vm.expectRevert(
            abi.encodeWithSelector(BoostRouter.RiskScoreAboveThreshold.selector, MANIFEST, uint16(3_000))
        );
        router.boost(MANIFEST, amount);
    }

    function test_Boost_RevertsOnAbsoluteExclusion() public {
        // R(c) = 1.0 = 10_000 bps (max value; absolute exclusion per RFC-6 §7).
        oracle.set(MANIFEST, 10_000);

        uint256 amount = 1e6;
        usdc.mint(viewer, amount);
        vm.prank(viewer);
        usdc.approve(address(router), amount);

        vm.prank(viewer);
        vm.expectRevert(
            abi.encodeWithSelector(BoostRouter.RiskScoreAboveThreshold.selector, MANIFEST, uint16(10_000))
        );
        router.boost(MANIFEST, amount);
    }

    function test_Boost_AllowsJustBelowThreshold() public {
        // 2_999 bps < 3_000 bps — must pass.
        oracle.set(MANIFEST, 2_999);
        _approveAndBoost(viewer, 100e6);
        assertEq(usdc.balanceOf(creator), 50e6);
    }

    function test_Boost_FailsWhenUserDidNotApprove() public {
        uint256 amount = 100e6;
        usdc.mint(viewer, amount);
        // No approve.

        vm.prank(viewer);
        vm.expectRevert(); // OZ ERC20 InsufficientAllowance — opaque selector across versions
        router.boost(MANIFEST, amount);
    }

    // ----- boost: fuzz -----

    function testFuzz_Boost_ConservesTotal(uint256 amount) public {
        amount = bound(amount, router.MIN_BOOST(), 1_000_000e6); // up to 1M USDC

        usdc.mint(viewer, amount);
        vm.prank(viewer);
        usdc.approve(address(router), amount);

        vm.prank(viewer);
        router.boost(MANIFEST, amount);

        uint256 total = usdc.balanceOf(creator) + usdc.balanceOf(persistencePool)
            + usdc.balanceOf(llcTreasury) + usdc.balanceOf(councilFund);

        assertEq(total, amount, "invariant: split sums to amount");
        assertEq(usdc.balanceOf(address(router)), 0, "INV-6: router holds nothing");
    }

    function testFuzz_Boost_CreatorAmountAlwaysGetsDust(uint256 amount) public {
        amount = bound(amount, router.MIN_BOOST(), 1_000_000e6);

        (uint256 creatorAmount, uint256 poolAmount, uint256 llcAmount, uint256 councilAmount) =
            router.previewSplit(amount);

        assertEq(creatorAmount + poolAmount + llcAmount + councilAmount, amount, "preview conservation");
        // Creator always gets at least floor(50% of amount); dust flows to creator, never negative.
        assertGe(creatorAmount, (amount * router.creatorBps()) / router.BPS_TOTAL());
    }

    // ----- previewSplit -----

    function test_PreviewSplit_MatchesBoostBehavior() public {
        uint256 amount = 777_777_777; // odd number to test rounding

        (uint256 pCreator, uint256 pPool, uint256 pLlc, uint256 pCouncil) = router.previewSplit(amount);

        _approveAndBoost(viewer, amount);

        assertEq(usdc.balanceOf(creator), pCreator, "preview matches actual creator");
        assertEq(usdc.balanceOf(persistencePool), pPool, "preview matches actual pool");
        assertEq(usdc.balanceOf(llcTreasury), pLlc, "preview matches actual llc");
        assertEq(usdc.balanceOf(councilFund), pCouncil, "preview matches actual council");
    }

    // ----- setSplit -----

    function test_SetSplit_OnlyCouncil_INV4() public {
        // LLC treasury MUST NOT be able to change split (RFC-8 §4.3).
        vm.prank(llcTreasury);
        vm.expectRevert(BoostRouter.NotCouncil.selector);
        router.setSplit(7_000, 2_000, 900, 100);

        // Arbitrary caller can't either.
        vm.prank(viewer);
        vm.expectRevert(BoostRouter.NotCouncil.selector);
        router.setSplit(7_000, 2_000, 900, 100);
    }

    function test_SetSplit_RevertsIfSumNotTenThousand() public {
        // Sum = 9_999 → revert.
        vm.prank(council);
        vm.expectRevert(abi.encodeWithSelector(BoostRouter.SplitInvalidSum.selector, uint16(9_999)));
        router.setSplit(5_000, 3_000, 1_899, 100);

        // Sum = 10_001 → revert.
        vm.prank(council);
        vm.expectRevert(abi.encodeWithSelector(BoostRouter.SplitInvalidSum.selector, uint16(10_001)));
        router.setSplit(5_000, 3_000, 1_900, 101);
    }

    function test_SetSplit_UpdatesAndEmits() public {
        vm.expectEmit(true, false, false, true, address(router));
        emit BoostRouter.SplitUpdated(6_000, 2_500, 1_400, 100, council);

        vm.prank(council);
        router.setSplit(6_000, 2_500, 1_400, 100);

        assertEq(router.creatorBps(), 6_000);
        assertEq(router.poolBps(), 2_500);
        assertEq(router.llcBps(), 1_400);
        assertEq(router.councilBps(), 100);
    }

    function test_SetSplit_NewSplitAppliedToNextBoost() public {
        // Council rotates to 70/20/9/1.
        vm.prank(council);
        router.setSplit(7_000, 2_000, 900, 100);

        uint256 amount = 100e6;
        _approveAndBoost(viewer, amount);

        assertEq(usdc.balanceOf(creator), 70e6);
        assertEq(usdc.balanceOf(persistencePool), 20e6);
        assertEq(usdc.balanceOf(llcTreasury), 9e6);
        assertEq(usdc.balanceOf(councilFund), 1e6);
    }

    // ----- setCouncil -----

    function test_SetCouncil_OnlyCurrentCouncil() public {
        address newCouncil = makeAddr("newCouncil");

        vm.prank(viewer);
        vm.expectRevert(BoostRouter.NotCouncil.selector);
        router.setCouncil(newCouncil);

        vm.expectEmit(true, true, false, false, address(router));
        emit BoostRouter.CouncilUpdated(council, newCouncil);

        vm.prank(council);
        router.setCouncil(newCouncil);
        assertEq(router.council(), newCouncil);
    }

    function test_SetCouncil_RejectsZero() public {
        vm.prank(council);
        vm.expectRevert(BoostRouter.ZeroAddress.selector);
        router.setCouncil(address(0));
    }

    function test_SetCouncil_OldCouncilLosesRights() public {
        address newCouncil = makeAddr("newCouncil");
        vm.prank(council);
        router.setCouncil(newCouncil);

        // Old council can't call setSplit anymore.
        vm.prank(council);
        vm.expectRevert(BoostRouter.NotCouncil.selector);
        router.setSplit(5_000, 3_000, 1_900, 100);

        // New council can.
        vm.prank(newCouncil);
        router.setSplit(5_000, 3_000, 1_900, 100);
    }

    // ----- helpers -----

    function _approveAndBoost(address from, uint256 amount) internal {
        usdc.mint(from, amount);
        vm.prank(from);
        usdc.approve(address(router), amount);
        vm.prank(from);
        router.boost(MANIFEST, amount);
    }
}
