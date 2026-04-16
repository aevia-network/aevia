// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { ContentRegistry } from "../src/ContentRegistry.sol";

/**
 * @title Aevia v0.1 Deploy Script
 * @notice Sprint 0 placeholder. Full orchestration (Safe multisig + role grants +
 *         UUPS proxies for Pool/Credit/Moderation) ships in Sprint 2.
 *
 * Usage:
 *   forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
 */
contract DeployScript is Script {
    function run() external returns (ContentRegistry registry) {
        vm.startBroadcast();

        registry = new ContentRegistry();
        console2.log("ContentRegistry deployed at:", address(registry));

        vm.stopBroadcast();
    }
}
