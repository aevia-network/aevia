// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { ContentRegistry } from "../src/ContentRegistry.sol";

contract ContentRegistryTest is Test {
    ContentRegistry internal registry;

    function setUp() public {
        registry = new ContentRegistry();
    }

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
}
