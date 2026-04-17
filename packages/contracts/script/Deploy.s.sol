// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { ContentRegistry } from "../src/ContentRegistry.sol";

/**
 * @title Aevia ContentRegistry Deploy Script
 * @notice Sprint 2 — deploys the immutable `ContentRegistry` to a target
 *         EVM chain (Base Sepolia for Sprint 2; Base mainnet after external
 *         audit). Emits greppable log lines so the main thread can pipe the
 *         output into the protocol-params ADR without manual copy-paste.
 *
 * Usage (Base Sepolia):
 *
 *   forge script script/Deploy.s.sol:DeployScript \
 *     --rpc-url "$BASE_SEPOLIA_RPC_URL" \
 *     --broadcast \
 *     -vv
 *
 * Required env:
 *   DEPLOYER_PRIVATE_KEY  — 0x-prefixed hex private key of the deployer.
 *   BASE_SEPOLIA_RPC_URL  — RPC endpoint (set in foundry.toml via env var).
 *
 * Verification (optional, requires BASESCAN_API_KEY):
 *   Append `--verify --verifier-url "https://api-sepolia.basescan.org/api" \
 *   --etherscan-api-key "$BASESCAN_API_KEY"` to the command above.
 *
 * This script is idempotent per-invocation but each run produces a new
 * deployed address. DO NOT run unattended; the deployed address is
 * canonical per chain and must be recorded in the protocol-params ADR.
 */
contract DeployScript is Script {
    function run() external returns (ContentRegistry registry) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        // Pre-flight. Fails loud with a clear message rather than silently
        // broadcasting from a wallet with no gas.
        require(deployer != address(0), "DeployScript: deployer is zero");
        require(deployer.balance > 0, "DeployScript: deployer has zero balance");

        console2.log("--- ContentRegistry deployment ---");
        console2.log("Chain:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Deployer balance (wei):", deployer.balance);

        vm.startBroadcast(deployerKey);
        registry = new ContentRegistry();
        vm.stopBroadcast();

        // Greppable output. Format matches the pattern the main thread scripts
        // will extract with `grep -E '^(ContentRegistry|Chain|DOMAIN|TYPEHASH):'`.
        console2.log("--- Deployment result ---");
        console2.log("ContentRegistry:", address(registry));
        console2.log("Chain:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("DOMAIN_NAME:", registry.DOMAIN_NAME());
        console2.log("DOMAIN_VERSION:", registry.DOMAIN_VERSION());
        console2.logBytes32(registry.DOMAIN_SEPARATOR());
        console2.logBytes32(registry.REGISTER_TYPEHASH());
    }
}
