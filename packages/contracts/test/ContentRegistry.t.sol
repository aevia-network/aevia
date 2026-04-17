// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { Vm } from "forge-std/Vm.sol";
import { ContentRegistry } from "../src/ContentRegistry.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title MockSmartWallet
 * @notice Minimal ERC-1271 smart wallet. Holds one EOA owner key and validates
 *         signatures by recovering via ECDSA and comparing to that owner.
 *         This mirrors the shape of real smart wallets (Safe, Kernel, Privy
 *         server wallets) for the purposes of ERC-1271 testing.
 */
contract MockSmartWallet {
    bytes4 internal constant MAGIC_VALUE = 0x1626ba7e;

    address public immutable ownerKey;

    constructor(address _ownerKey) {
        ownerKey = _ownerKey;
    }

    function isValidSignature(bytes32 hash, bytes calldata sig) external view returns (bytes4) {
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(hash, sig);
        if (err != ECDSA.RecoverError.NoError) return 0xffffffff;
        if (recovered != ownerKey) return 0xffffffff;
        return MAGIC_VALUE;
    }
}

contract ContentRegistryTest is Test {
    ContentRegistry internal registry;

    // Two EOA identities.
    Vm.Wallet internal alice;
    Vm.Wallet internal bob;

    // Smart-wallet setup: Bob's EOA key signs on behalf of the deployed wallet.
    MockSmartWallet internal wallet;

    // Convenience: sample CIDs used across tests.
    bytes32 internal constant CID_A = bytes32(uint256(0xA11CE));
    bytes32 internal constant CID_B = bytes32(uint256(0xB0B));
    bytes32 internal constant CID_C = bytes32(uint256(0xC11));

    function setUp() public {
        registry = new ContentRegistry();
        alice = vm.createWallet("alice");
        bob = vm.createWallet("bob");
        wallet = new MockSmartWallet(bob.addr);
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    function _digest(
        address owner,
        bytes32 manifestCid,
        bytes32 parentCid,
        uint8 policyFlags,
        uint256 nonce
    )
        internal
        view
        returns (bytes32)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                registry.REGISTER_TYPEHASH(), owner, manifestCid, parentCid, uint256(policyFlags), block.chainid, nonce
            )
        );
        return keccak256(abi.encodePacked(hex"1901", registry.DOMAIN_SEPARATOR(), structHash));
    }

    function _signEOA(
        Vm.Wallet memory signer,
        address owner,
        bytes32 manifestCid,
        bytes32 parentCid,
        uint8 policyFlags
    )
        internal
        view
        returns (bytes memory)
    {
        uint256 nonce = registry.nonces(owner);
        bytes32 d = _digest(owner, manifestCid, parentCid, policyFlags, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signer, d);
        return abi.encodePacked(r, s, v);
    }

    // ---------------------------------------------------------------
    // Legacy read-only tests (preserved for regression)
    // ---------------------------------------------------------------

    function test_InitialRecord_IsEmpty() public view {
        ContentRegistry.ContentRecord memory record = registry.getRecord(bytes32(0));
        assertEq(record.owner, address(0));
        assertEq(record.timestamp, 0);
        assertEq(record.policyFlags, 0);
        assertEq(record.parentCid, bytes32(0));
    }

    function test_IsRegistered_ReturnsFalse_ForUnknownCid() public view {
        assertFalse(registry.isRegistered(keccak256("unknown")));
    }

    function test_OwnerOf_ReturnsZero_ForUnknownCid() public view {
        assertEq(registry.ownerOf(keccak256("unknown")), address(0));
    }

    // ---------------------------------------------------------------
    // Happy paths
    // ---------------------------------------------------------------

    function test_Register_EOA_HappyPath() public {
        bytes memory sig = _signEOA(alice, alice.addr, CID_A, bytes32(0), 0);

        uint64 expectedTs = uint64(block.timestamp);
        vm.expectEmit(true, true, true, true, address(registry));
        emit ContentRegistry.ContentRegistered(CID_A, alice.addr, bytes32(0), expectedTs, 0);

        // Submit from an unrelated address to prove `msg.sender != owner`.
        vm.prank(makeAddr("relayer"));
        registry.registerContent(alice.addr, CID_A, bytes32(0), 0, sig);

        ContentRegistry.ContentRecord memory r = registry.getRecord(CID_A);
        assertEq(r.owner, alice.addr, "owner mismatch");
        assertEq(r.timestamp, expectedTs, "timestamp mismatch");
        assertEq(r.policyFlags, 0, "flags mismatch");
        assertEq(r.parentCid, bytes32(0), "parent mismatch");

        assertTrue(registry.isRegistered(CID_A));
        assertEq(registry.ownerOf(CID_A), alice.addr);
        assertEq(registry.nonces(alice.addr), 1, "nonce must be consumed");
    }

    function test_Register_SmartWallet_HappyPath() public {
        // Bob's EOA key signs; the smart wallet is the on-record owner.
        address walletAddr = address(wallet);
        bytes memory sig = _signEOA(bob, walletAddr, CID_A, bytes32(0), 0);

        vm.prank(makeAddr("relayer"));
        registry.registerContent(walletAddr, CID_A, bytes32(0), 0, sig);

        assertEq(registry.ownerOf(CID_A), walletAddr, "owner must be wallet contract");
        assertEq(registry.nonces(walletAddr), 1);
    }

    function test_Register_WithParent_PersistsParent() public {
        // Register parent first.
        bytes memory sigA = _signEOA(alice, alice.addr, CID_A, bytes32(0), 0);
        registry.registerContent(alice.addr, CID_A, bytes32(0), 0, sigA);

        // Then clip whose parent is CID_A.
        bytes memory sigB = _signEOA(alice, alice.addr, CID_B, CID_A, 0);
        registry.registerContent(alice.addr, CID_B, CID_A, 0, sigB);

        ContentRegistry.ContentRecord memory r = registry.getRecord(CID_B);
        assertEq(r.parentCid, CID_A, "parent CID must be stored");
        assertEq(r.owner, alice.addr);
    }

    // ---------------------------------------------------------------
    // Rejection paths
    // ---------------------------------------------------------------

    function test_Register_RevertsOn_InvalidSignature() public {
        // Sign with Bob's key but claim Alice as owner — digest mismatches.
        bytes memory sig = _signEOA(bob, alice.addr, CID_A, bytes32(0), 0);

        vm.expectRevert(ContentRegistry.InvalidSignature.selector);
        registry.registerContent(alice.addr, CID_A, bytes32(0), 0, sig);
    }

    function test_Register_RevertsOn_WrongChainIdInPayload() public {
        // Build a digest as if we were on chainId 1 while vm is on 31337.
        uint256 forgedChainId = 1;
        bytes32 structHash = keccak256(
            abi.encode(
                registry.REGISTER_TYPEHASH(), alice.addr, CID_A, bytes32(0), uint256(0), forgedChainId, uint256(0)
            )
        );
        bytes32 digest = keccak256(abi.encodePacked(hex"1901", registry.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(alice, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.expectRevert(ContentRegistry.InvalidSignature.selector);
        registry.registerContent(alice.addr, CID_A, bytes32(0), 0, sig);
    }

    function test_Register_RevertsOn_ReusedNonce() public {
        bytes memory sig = _signEOA(alice, alice.addr, CID_A, bytes32(0), 0);
        registry.registerContent(alice.addr, CID_A, bytes32(0), 0, sig);

        // Replay the exact same signature against a different CID — should
        // fail because nonce is now 1 while signature was for nonce 0.
        vm.expectRevert(ContentRegistry.InvalidSignature.selector);
        registry.registerContent(alice.addr, CID_B, bytes32(0), 0, sig);
    }

    function test_Register_RevertsOn_DuplicateCid() public {
        bytes memory sig = _signEOA(alice, alice.addr, CID_A, bytes32(0), 0);
        registry.registerContent(alice.addr, CID_A, bytes32(0), 0, sig);

        // Produce a fresh (valid) signature for the same CID with the new nonce.
        bytes memory sig2 = _signEOA(alice, alice.addr, CID_A, bytes32(0), 0);
        vm.expectRevert(ContentRegistry.AlreadyRegistered.selector);
        registry.registerContent(alice.addr, CID_A, bytes32(0), 0, sig2);
    }

    function test_Register_RevertsOn_ZeroCid() public {
        bytes memory sig = _signEOA(alice, alice.addr, bytes32(0), bytes32(0), 0);
        vm.expectRevert(ContentRegistry.ZeroCid.selector);
        registry.registerContent(alice.addr, bytes32(0), bytes32(0), 0, sig);
    }

    function test_Register_RevertsOn_SelfParent() public {
        bytes memory sig = _signEOA(alice, alice.addr, CID_A, CID_A, 0);
        vm.expectRevert(ContentRegistry.SelfParent.selector);
        registry.registerContent(alice.addr, CID_A, CID_A, 0, sig);
    }

    function test_Register_RevertsOn_UnregisteredParent() public {
        bytes memory sig = _signEOA(alice, alice.addr, CID_B, CID_A, 0);
        vm.expectRevert(ContentRegistry.ParentNotRegistered.selector);
        registry.registerContent(alice.addr, CID_B, CID_A, 0, sig);
    }

    function test_Register_RevertsOn_ReservedFlagBit() public {
        uint8 flags = 0x80; // reserved bit
        bytes memory sig = _signEOA(alice, alice.addr, CID_A, bytes32(0), flags);
        vm.expectRevert(ContentRegistry.ReservedFlag.selector);
        registry.registerContent(alice.addr, CID_A, bytes32(0), flags, sig);
    }

    function test_Register_RevertsOn_ZeroOwner() public {
        // Signature content irrelevant; zero-owner guard fires first.
        vm.expectRevert(ContentRegistry.ZeroSigner.selector);
        registry.registerContent(address(0), CID_A, bytes32(0), 0, hex"");
    }

    // ---------------------------------------------------------------
    // Non-reserved flag bits are accepted
    // ---------------------------------------------------------------

    function test_Register_AcceptsNonReservedFlags() public {
        uint8 flags = 0x7F; // all creator-visible bits set
        bytes memory sig = _signEOA(alice, alice.addr, CID_A, bytes32(0), flags);
        registry.registerContent(alice.addr, CID_A, bytes32(0), flags, sig);

        ContentRegistry.ContentRecord memory r = registry.getRecord(CID_A);
        assertEq(r.policyFlags, flags);
    }

    // ---------------------------------------------------------------
    // View-level assertions
    // ---------------------------------------------------------------

    function test_DomainSeparator_MatchesExpected() public view {
        bytes32 typeHash =
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
        bytes32 expected = keccak256(
            abi.encode(typeHash, keccak256("Aevia ContentRegistry"), keccak256("1"), block.chainid, address(registry))
        );
        assertEq(registry.DOMAIN_SEPARATOR(), expected, "domain separator mismatch");
    }

    function test_RegisterTypehash_MatchesExpected() public view {
        bytes32 expected = keccak256(
            "RegisterContent(address owner,bytes32 manifestCid,bytes32 parentCid,uint8 policyFlags,uint256 chainId,uint256 nonce)"
        );
        assertEq(registry.REGISTER_TYPEHASH(), expected, "register typehash mismatch");
    }

    function test_Nonces_StartAtZero_AndIncrementOnSuccess() public {
        assertEq(registry.nonces(alice.addr), 0);

        bytes memory sig = _signEOA(alice, alice.addr, CID_A, bytes32(0), 0);
        registry.registerContent(alice.addr, CID_A, bytes32(0), 0, sig);

        assertEq(registry.nonces(alice.addr), 1);
    }

    function test_HashRegisterContent_MatchesLocalComputation() public view {
        bytes32 expected = _digest(alice.addr, CID_A, bytes32(0), 0, 0);
        bytes32 actual = registry.hashRegisterContent(alice.addr, CID_A, bytes32(0), 0);
        assertEq(actual, expected);
    }

    // ---------------------------------------------------------------
    // ChainId-fork coverage
    // ---------------------------------------------------------------

    function test_DomainSeparator_RecomputesOnChainIdChange() public {
        bytes32 before = registry.DOMAIN_SEPARATOR();
        vm.chainId(block.chainid + 1);
        bytes32 afterFork = registry.DOMAIN_SEPARATOR();
        assertTrue(before != afterFork, "domain separator must diverge on fork");
    }

    // ---------------------------------------------------------------
    // Fuzz: randomly generated CIDs + policyFlags must roundtrip
    // ---------------------------------------------------------------

    function testFuzz_Register_EOA(bytes32 cid, uint8 flags) public {
        vm.assume(cid != bytes32(0));
        vm.assume(flags & 0x80 == 0);

        bytes memory sig = _signEOA(alice, alice.addr, cid, bytes32(0), flags);
        registry.registerContent(alice.addr, cid, bytes32(0), flags, sig);

        ContentRegistry.ContentRecord memory r = registry.getRecord(cid);
        assertEq(r.owner, alice.addr);
        assertEq(r.policyFlags, flags);
    }
}
