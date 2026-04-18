// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { PersistencePool } from "../src/PersistencePool.sol";

/**
 * @title Aevia PersistencePool Deploy Script
 * @notice Milestone 6 — deploys the immutable PersistencePool to a target
 *         EVM chain. For Base Sepolia the reward token is the Circle USDC
 *         testnet contract at 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
 *         for Base mainnet (post-audit) it will be Circle USDC native
 *         0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913.
 *
 * Usage (Base Sepolia):
 *
 *   forge script script/DeployPersistencePool.s.sol:DeployPersistencePool \
 *     --rpc-url "$BASE_SEPOLIA_RPC_URL" \
 *     --broadcast \
 *     -vv
 *
 * Required env:
 *   DEPLOYER_PRIVATE_KEY   — 0x-prefixed hex private key of the deployer.
 *   BASE_SEPOLIA_RPC_URL   — RPC endpoint (also used by foundry.toml).
 *   USDC_ADDRESS_SEPOLIA   — Circle USDC contract on the target chain.
 *                             Defaults to the canonical Base Sepolia address
 *                             when unset.
 *   COORDINATOR_ADDRESS    — Initial coordinator. Defaults to the deployer
 *                             when unset (MVP; production rotates via
 *                             setCoordinator after a Safe multisig is
 *                             deployed).
 *
 * Verification (optional, requires BASESCAN_API_KEY):
 *   Append `--verify --verifier-url "https://api-sepolia.basescan.org/api" \
 *   --etherscan-api-key "$BASESCAN_API_KEY"`.
 *
 * Idempotency note: each invocation produces a new deployed address. Deploy
 * ONCE per chain and record the address in deployments/<chain>.json + the
 * protocol-params ADR. DO NOT run unattended.
 */
contract DeployPersistencePool is Script {
    // Canonical Circle USDC on Base Sepolia. Public constant so tests can
    // assert exact parity with the script logic.
    address public constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external returns (PersistencePool pool) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        // Resolve reward token — env override for future chains, default
        // to the canonical Base Sepolia USDC.
        address rewardToken;
        try vm.envAddress("USDC_ADDRESS_SEPOLIA") returns (address token) {
            rewardToken = token;
        } catch {
            rewardToken = BASE_SEPOLIA_USDC;
        }

        // Resolve coordinator — env override, default to deployer.
        address coordinator;
        try vm.envAddress("COORDINATOR_ADDRESS") returns (address c) {
            coordinator = c;
        } catch {
            coordinator = deployer;
        }

        require(deployer != address(0), "DeployPersistencePool: deployer is zero");
        require(deployer.balance > 0, "DeployPersistencePool: deployer has zero balance");
        require(rewardToken != address(0), "DeployPersistencePool: rewardToken is zero");
        require(coordinator != address(0), "DeployPersistencePool: coordinator is zero");

        console2.log("--- PersistencePool deployment ---");
        console2.log("Chain:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Deployer balance (wei):", deployer.balance);
        console2.log("Reward token:", rewardToken);
        console2.log("Coordinator:", coordinator);

        vm.startBroadcast(deployerKey);
        pool = new PersistencePool(IERC20(rewardToken), coordinator);
        vm.stopBroadcast();

        // Greppable output for the deployment journal.
        console2.log("--- Deployment result ---");
        console2.log("PersistencePool:", address(pool));
        console2.log("Chain:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Reward token:", address(pool.rewardToken()));
        console2.log("Coordinator:", pool.coordinator());
        console2.log("settlementCount:", pool.settlementCount());
    }
}
