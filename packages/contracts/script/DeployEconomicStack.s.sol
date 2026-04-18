// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { RiskOracle } from "../src/RiskOracle.sol";
import { BoostRouter } from "../src/BoostRouter.sol";
import { IContentRegistry } from "../src/IContentRegistry.sol";
import { IRiskOracle } from "../src/IRiskOracle.sol";

/**
 * @title Aevia Economic Stack Deploy
 * @notice Deploys the two remaining contracts of the Aevia on-chain economic
 *         architecture: RiskOracle (RFC-6 §8) and BoostRouter (RFC-8 §4).
 *         ContentRegistry and PersistencePool are pre-deployed on Base
 *         Sepolia and referenced from env vars — see
 *         `packages/contracts/deployments/base-sepolia.json`.
 *
 * Deploy order (dependency-aware):
 *   1. RiskOracle(scoringService, council)
 *      — scoringService bootstrap = deployer EOA (rotate via Council later)
 *      — council = COUNCIL_SAFE (2-of-2 on Sepolia)
 *   2. BoostRouter(usdc, registry, oracle, persistencePool, llcTreasury,
 *                  councilFund, council)
 *      — oracle consumed = RiskOracle deployed in step 1
 *      — all other references resolved from existing deployments / Safes.
 *
 * Usage (Base Sepolia):
 *
 *   cd packages/contracts
 *   source .env
 *   forge script script/DeployEconomicStack.s.sol:DeployEconomicStack \
 *     --rpc-url "$BASE_SEPOLIA_RPC" \
 *     --broadcast \
 *     -vvv
 *
 * With Basescan verification (append):
 *   --verify --verifier-url "https://api-sepolia.basescan.org/api" \
 *   --etherscan-api-key "$BASESCAN_API_KEY"
 *
 * Required env vars:
 *   DEPLOYER_PRIVATE_KEY
 *   USDC_ADDRESS_SEPOLIA
 *   CONTENT_REGISTRY_ADDRESS_SEPOLIA
 *   PERSISTENCE_POOL_ADDRESS_SEPOLIA
 *   LLC_TREASURY_SAFE_SEPOLIA
 *   COUNCIL_FUND_SAFE_SEPOLIA
 *   COUNCIL_SAFE_SEPOLIA
 *   SCORING_SERVICE_ADDRESS_SEPOLIA   (defaults to deployer if unset)
 *
 * Idempotency: each run deploys fresh contracts. DO NOT run unattended —
 * update `deployments/<chain>.json` + env files after every run.
 */
contract DeployEconomicStack is Script {
    function run() external returns (RiskOracle oracle, BoostRouter router) {
        // -----------------------------------------------------------
        // Load + validate config
        // -----------------------------------------------------------
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address usdc = vm.envAddress("USDC_ADDRESS_SEPOLIA");
        address registry = vm.envAddress("CONTENT_REGISTRY_ADDRESS_SEPOLIA");
        address persistencePool = vm.envAddress("PERSISTENCE_POOL_ADDRESS_SEPOLIA");
        address llcTreasury = vm.envAddress("LLC_TREASURY_SAFE_SEPOLIA");
        address councilFund = vm.envAddress("COUNCIL_FUND_SAFE_SEPOLIA");
        address council = vm.envAddress("COUNCIL_SAFE_SEPOLIA");

        address scoringService;
        try vm.envAddress("SCORING_SERVICE_ADDRESS_SEPOLIA") returns (address s) {
            scoringService = s;
        } catch {
            scoringService = deployer;
        }

        require(deployer != address(0), "DeployEconomicStack: deployer is zero");
        require(deployer.balance > 0, "DeployEconomicStack: deployer has zero balance");
        require(usdc != address(0), "DeployEconomicStack: usdc is zero");
        require(registry != address(0), "DeployEconomicStack: registry is zero");
        require(persistencePool != address(0), "DeployEconomicStack: pool is zero");
        require(llcTreasury != address(0), "DeployEconomicStack: llcTreasury is zero");
        require(councilFund != address(0), "DeployEconomicStack: councilFund is zero");
        require(council != address(0), "DeployEconomicStack: council is zero");
        require(scoringService != address(0), "DeployEconomicStack: scoringService is zero");

        // Sanity: referenced dependencies must have bytecode on-chain.
        require(registry.code.length > 0, "DeployEconomicStack: registry has no code");
        require(persistencePool.code.length > 0, "DeployEconomicStack: pool has no code");
        require(usdc.code.length > 0, "DeployEconomicStack: usdc has no code");
        require(llcTreasury.code.length > 0, "DeployEconomicStack: llcTreasury not deployed");
        require(councilFund.code.length > 0, "DeployEconomicStack: councilFund not deployed");
        require(council.code.length > 0, "DeployEconomicStack: council not deployed");

        console2.log("--- Aevia Economic Stack deployment ---");
        console2.log("Chain:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Deployer balance (wei):", deployer.balance);
        console2.log("USDC:", usdc);
        console2.log("ContentRegistry:", registry);
        console2.log("PersistencePool:", persistencePool);
        console2.log("LLCTreasury Safe:", llcTreasury);
        console2.log("CouncilFund Safe:", councilFund);
        console2.log("Council Safe:", council);
        console2.log("Scoring service:", scoringService);

        // -----------------------------------------------------------
        // Deploy: RiskOracle → BoostRouter
        // -----------------------------------------------------------
        vm.startBroadcast(deployerKey);

        oracle = new RiskOracle(scoringService, council);

        router = new BoostRouter(
            IERC20(usdc),
            IContentRegistry(registry),
            IRiskOracle(address(oracle)),
            persistencePool,
            llcTreasury,
            councilFund,
            council
        );

        vm.stopBroadcast();

        // -----------------------------------------------------------
        // Post-deploy assertions
        // -----------------------------------------------------------
        require(address(oracle).code.length > 0, "RiskOracle: no code");
        require(address(router).code.length > 0, "BoostRouter: no code");

        require(oracle.scoringService() == scoringService, "oracle.scoringService mismatch");
        require(oracle.council() == council, "oracle.council mismatch");

        require(address(router.usdc()) == usdc, "router.usdc mismatch");
        require(address(router.registry()) == registry, "router.registry mismatch");
        require(address(router.oracle()) == address(oracle), "router.oracle mismatch");
        require(router.persistencePool() == persistencePool, "router.pool mismatch");
        require(router.llcTreasury() == llcTreasury, "router.llc mismatch");
        require(router.councilFund() == councilFund, "router.council-fund mismatch");
        require(router.council() == council, "router.council mismatch");

        require(router.creatorBps() == 5_000, "router.creatorBps default wrong");
        require(router.poolBps() == 3_000, "router.poolBps default wrong");
        require(router.llcBps() == 1_900, "router.llcBps default wrong");
        require(router.councilBps() == 100, "router.councilBps default wrong");

        // -----------------------------------------------------------
        // Greppable output for the deployment journal
        // -----------------------------------------------------------
        console2.log("--- Deployment result ---");
        console2.log("RiskOracle:", address(oracle));
        console2.log("BoostRouter:", address(router));
        console2.log("Chain:", block.chainid);
        console2.log("Deployer:", deployer);
    }
}
