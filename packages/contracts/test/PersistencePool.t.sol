// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { PersistencePool } from "../src/PersistencePool.sol";

contract MockCUSDC is ERC20 {
    constructor() ERC20("Mock cUSDC", "cUSDC") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PersistencePoolTest is Test {
    MockCUSDC internal cusdc;
    PersistencePool internal pool;

    address internal coordinator = makeAddr("coordinator");
    address internal creator = makeAddr("creator");
    address internal providerA = makeAddr("providerA");
    address internal providerB = makeAddr("providerB");
    address internal providerC = makeAddr("providerC");

    function setUp() public {
        cusdc = new MockCUSDC();
        pool = new PersistencePool(IERC20(address(cusdc)), coordinator);
    }

    // ----- constructor checks -----

    function test_Constructor_RejectsZeroToken() public {
        vm.expectRevert(PersistencePool.ZeroAddress.selector);
        new PersistencePool(IERC20(address(0)), coordinator);
    }

    function test_Constructor_RejectsZeroCoordinator() public {
        vm.expectRevert(PersistencePool.ZeroAddress.selector);
        new PersistencePool(IERC20(address(cusdc)), address(0));
    }

    // ----- deposit -----

    function test_Deposit_TransfersFundsAndRecordsTag() public {
        uint256 amount = 1_000e6; // 1000 cUSDC (6 decimals)
        cusdc.mint(creator, amount);

        vm.prank(creator);
        cusdc.approve(address(pool), amount);

        bytes32 cid = keccak256("baf-test-cid");
        vm.expectEmit(true, true, false, true, address(pool));
        emit PersistencePool.Deposited(creator, cid, amount);

        vm.prank(creator);
        pool.deposit(cid, amount);

        assertEq(pool.poolBalance(), amount, "pool balance should match deposit");
        assertEq(pool.depositsByCid(cid), amount, "deposit tag should record amount");
    }

    function test_Deposit_RejectsZeroAmount() public {
        vm.prank(creator);
        vm.expectRevert(PersistencePool.ZeroAmount.selector);
        pool.deposit(bytes32(0), 0);
    }

    // ----- submitSettlement -----

    function test_SubmitSettlement_AllocatesProportionally() public {
        // Pool deposit: 1000 cUSDC.
        uint256 deposited = 1_000e6;
        _fundPool(deposited);

        // Providers served 50% + 30% + 20% of bytes.
        address[] memory providers = new address[](3);
        providers[0] = providerA;
        providers[1] = providerB;
        providers[2] = providerC;

        uint256[] memory bytesServed = new uint256[](3);
        bytesServed[0] = 500;
        bytesServed[1] = 300;
        bytesServed[2] = 200;

        uint256 rewards = 1_000e6;
        vm.prank(coordinator);
        uint256 sid = pool.submitSettlement(bytes32(uint256(0xabcd)), providers, bytesServed, rewards);

        assertEq(sid, 1, "first settlement id should be 1");
        assertEq(pool.allocationOf(sid, providerA), 500e6, "A allocation");
        assertEq(pool.allocationOf(sid, providerB), 300e6, "B allocation");
        assertEq(pool.allocationOf(sid, providerC), 200e6, "C allocation");
        assertEq(pool.cumulativeBytesServed(providerA), 500, "cum bytes A");

        PersistencePool.Settlement memory s = pool.getSettlement(sid);
        assertEq(s.merkleRoot, bytes32(uint256(0xabcd)));
        assertEq(s.totalRewards, rewards);
        assertEq(s.totalBytes, 1_000);
        assertEq(s.providerCount, 3);
    }

    function test_SubmitSettlement_RejectsNonCoordinator() public {
        _fundPool(100e6);
        address[] memory providers = _single(providerA);
        uint256[] memory bytesServed = _single256(100);

        vm.prank(creator);
        vm.expectRevert(PersistencePool.NotCoordinator.selector);
        pool.submitSettlement(bytes32(0), providers, bytesServed, 100e6);
    }

    function test_SubmitSettlement_RejectsLengthMismatch() public {
        _fundPool(100e6);
        address[] memory providers = _single(providerA);
        uint256[] memory bytesServed = new uint256[](2);
        bytesServed[0] = 50;
        bytesServed[1] = 50;

        vm.prank(coordinator);
        vm.expectRevert(PersistencePool.LengthMismatch.selector);
        pool.submitSettlement(bytes32(0), providers, bytesServed, 100e6);
    }

    function test_SubmitSettlement_RejectsZeroProviders() public {
        _fundPool(100e6);
        address[] memory providers = new address[](0);
        uint256[] memory bytesServed = new uint256[](0);

        vm.prank(coordinator);
        vm.expectRevert(PersistencePool.ZeroProviders.selector);
        pool.submitSettlement(bytes32(0), providers, bytesServed, 100e6);
    }

    function test_SubmitSettlement_RejectsInsufficientBalance() public {
        // No deposit.
        address[] memory providers = _single(providerA);
        uint256[] memory bytesServed = _single256(100);

        vm.prank(coordinator);
        vm.expectRevert(PersistencePool.InsufficientPoolBalance.selector);
        pool.submitSettlement(bytes32(0), providers, bytesServed, 1);
    }

    function test_SubmitSettlement_RejectsZeroTotalBytes() public {
        _fundPool(100e6);
        address[] memory providers = _single(providerA);
        uint256[] memory bytesServed = _single256(0);

        vm.prank(coordinator);
        vm.expectRevert(PersistencePool.ZeroTotalBytes.selector);
        pool.submitSettlement(bytes32(0), providers, bytesServed, 100e6);
    }

    function test_SubmitSettlement_RejectsZeroProviderAddress() public {
        _fundPool(100e6);
        address[] memory providers = _single(address(0));
        uint256[] memory bytesServed = _single256(100);

        vm.prank(coordinator);
        vm.expectRevert(PersistencePool.ZeroAddress.selector);
        pool.submitSettlement(bytes32(0), providers, bytesServed, 100e6);
    }

    // ----- claim -----

    function test_Claim_PullsAllocation() public {
        uint256 deposited = 1_000e6;
        _fundPool(deposited);

        address[] memory providers = new address[](2);
        providers[0] = providerA;
        providers[1] = providerB;
        uint256[] memory bytesServed = new uint256[](2);
        bytesServed[0] = 700;
        bytesServed[1] = 300;

        vm.prank(coordinator);
        uint256 sid = pool.submitSettlement(bytes32(0), providers, bytesServed, deposited);

        uint256 beforeA = cusdc.balanceOf(providerA);
        vm.prank(providerA);
        uint256 claimed = pool.claim(sid);
        assertEq(claimed, 700e6, "A should receive 70% of rewards");
        assertEq(cusdc.balanceOf(providerA) - beforeA, 700e6, "balance delta");
        assertTrue(pool.hasClaimed(sid, providerA), "hasClaimed true after claim");
    }

    function test_Claim_RejectsDoubleClaim() public {
        _fundPool(1_000e6);
        address[] memory providers = _single(providerA);
        uint256[] memory bytesServed = _single256(1);

        vm.prank(coordinator);
        uint256 sid = pool.submitSettlement(bytes32(0), providers, bytesServed, 1_000e6);

        vm.prank(providerA);
        pool.claim(sid);

        vm.prank(providerA);
        vm.expectRevert(PersistencePool.AlreadyClaimed.selector);
        pool.claim(sid);
    }

    function test_Claim_RejectsNothingAllocated() public {
        _fundPool(100e6);
        address[] memory providers = _single(providerA);
        uint256[] memory bytesServed = _single256(1);

        vm.prank(coordinator);
        uint256 sid = pool.submitSettlement(bytes32(0), providers, bytesServed, 100e6);

        vm.prank(providerB);
        vm.expectRevert(PersistencePool.NothingToClaim.selector);
        pool.claim(sid);
    }

    // ----- setCoordinator -----

    function test_SetCoordinator_OnlyCurrentCoordinator() public {
        address newCoord = makeAddr("newCoord");

        vm.prank(creator);
        vm.expectRevert(PersistencePool.NotCoordinator.selector);
        pool.setCoordinator(newCoord);

        vm.expectEmit(true, true, false, false, address(pool));
        emit PersistencePool.CoordinatorUpdated(coordinator, newCoord);

        vm.prank(coordinator);
        pool.setCoordinator(newCoord);
        assertEq(pool.coordinator(), newCoord);
    }

    function test_SetCoordinator_RejectsZero() public {
        vm.prank(coordinator);
        vm.expectRevert(PersistencePool.ZeroAddress.selector);
        pool.setCoordinator(address(0));
    }

    // ----- helpers -----

    function _fundPool(uint256 amount) internal {
        cusdc.mint(creator, amount);
        vm.prank(creator);
        cusdc.approve(address(pool), amount);
        vm.prank(creator);
        pool.deposit(keccak256("test"), amount);
    }

    function _single(address a) internal pure returns (address[] memory arr) {
        arr = new address[](1);
        arr[0] = a;
    }

    function _single256(uint256 v) internal pure returns (uint256[] memory arr) {
        arr = new uint256[](1);
        arr[0] = v;
    }
}
