# ADR 0003 — PersistencePool deployment on Base Sepolia

- Status: Draft (populated after broadcast)
- Date: 2026-04-17
- Supersedes: —
- Superseded by: —

## Context

Milestone 6 introduces the economic half of the Aevia thesis. The protocol's
resilience claim — "content survives because operators are compensated to
keep it alive" — only holds if operators have a real, cryptographically
auditable path from bytes-served to cUSDC in their wallet. Milestone 6
shipped every off-chain piece required to make that path real:

- `internal/por/receipt.go` — dual-signed (viewer + provider) Ed25519
  receipts, one per segment delivery.
- `internal/por/store.go` — BadgerDB-backed `ReceiptStore` with time-window
  queries.
- `internal/por/server.go` — `POST /ack` over libp2p so viewers dispatch
  receipts at the same transport layer as segment fetches.
- `internal/por/aggregator.go` — `BuildSettlement(receipts)` produces a
  Merkle root over sorted receipt hashes, plus per-provider byte totals.
- `internal/por/abi.go` — hand-rolled ABI encoder for
  `submitSettlement(bytes32,address[],uint256[],uint256)` (function
  selector `0x48db471d`), keeping go-ethereum's dep tree out of the
  runtime binary.
- `packages/contracts/src/PersistencePool.sol` — on-chain Storj-style
  payouts with deposit/submitSettlement/claim lifecycle; 16 Foundry tests
  cover every revert path and the proportional-allocation math.

The flagship `TestEconomicLoopEndToEnd` (two viewers → one provider →
/ack over libp2p → BadgerDB → `BuildSettlement`) proves the accounting
chain end-to-end in 120 ms. The only link that cannot be validated in
pure Go is the final RPC submission. This ADR records that final link.

## Decision

Deploy `PersistencePool` to Base Sepolia (`chainId = 84532`) with:

- **Reward token**: Circle USDC Sepolia —
  `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. This is the canonical
  Circle testnet USDC. The Aevia mainnet deployment post-audit will use
  the Base mainnet USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
  (same contract lineage — just a different chain). Using USDC (not a
  native Aevia token) follows the GENIUS-Act-era regulatory posture
  documented in codemem `0Pj3qsBN` — operators are paid in a permitted
  payment stablecoin, not an unregistered security.

- **Coordinator**: initially the deployer EOA
  `0xe58ee3d7b6FF359dc5c8A67f3862362F9F4080ca`. The `setCoordinator`
  function allows rotation once a Safe multisig is deployed; the
  intermediate pitch-time plan is to transfer coordinator authority to
  a 2-of-3 multisig holding keys for Leandro + one co-founder + one
  board-member seat (TBD in M8 governance work).

- **Verification**: on Basescan via `--verify --verifier-url
  https://api-sepolia.basescan.org/api` so the source is public and
  auditors can diff against `packages/contracts/src/PersistencePool.sol`
  without trusting our off-chain tooling.

The deploy script is `packages/contracts/script/DeployPersistencePool.s.sol`
— identical pattern to the existing `Deploy.s.sol` that placed
`ContentRegistry`. It reads `DEPLOYER_PRIVATE_KEY`, `USDC_ADDRESS_SEPOLIA`,
`COORDINATOR_ADDRESS` from env (all three with safe defaults for the Base
Sepolia canonical case), and emits greppable log lines that feed the
`deployments/base-sepolia.json` update.

## Deployment result

_Populated after broadcast; values below are placeholders until the tx
lands on Base Sepolia._

| Field                | Value |
|----------------------|-------|
| Chain                | Base Sepolia (84532) |
| PersistencePool      | `TBD` |
| Reward token         | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Circle USDC Sepolia) |
| Coordinator (initial)| `0xe58ee3d7b6FF359dc5c8A67f3862362F9F4080ca` |
| Deployer             | `0xe58ee3d7b6FF359dc5c8A67f3862362F9F4080ca` |
| Deploy block         | `TBD` |
| Deploy tx            | `TBD` |
| Gas used             | `TBD` |
| Verified on Basescan | `TBD` |

Once broadcast completes, the above values are mirrored into
`packages/contracts/deployments/base-sepolia.json` under a
`PersistencePool` key so downstream tooling reads a single source of
truth.

## Consequences

- The full Proof-of-Relay flow now has an on-chain settlement endpoint.
  A coordinator holding the deployer private key can call
  `submitSettlement(root, providers, bytesServed, totalRewards)` with
  calldata produced by `por.EncodeSubmitSettlement`, and providers can
  immediately pull their cUSDC via `claim(settlementId)`.
- The deployed address is permanent per chain — it must be referenced
  from the Go settlement pipeline (M8+: a new
  `services/coordinator/` binary will hold the settlement cadence and
  RPC submission) and from `aevia.network`'s transparency surface.
- Rotating the coordinator to a multisig requires one tx from the
  current EOA. Until then the operational risk is concentrated in the
  deployer key; that is acceptable for a Sepolia MVP because no
  mainnet funds are at stake.
- The choice of Circle USDC (not a bespoke token) means Aevia piggybacks
  on Circle's regulatory surface and liquidity. Operators cashing out
  via Coinbase receive a standard ERC-20 with deep market support.
- Initial pool balance will be zero. Funding the pool is a separate
  operator action: creators sign `deposit(cid, amount)` with their own
  wallet after approving the pool as spender — the contract never
  custodies funds without an explicit `transferFrom`.
