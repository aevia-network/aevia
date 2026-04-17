# @aevia/contracts

Aevia on-chain protocol on Base L2.

## Contracts

| Contract | Status | Upgradeable | Purpose |
|---|---|---|---|
| `ContentRegistry` | Sprint 0 stub → Sprint 2 | Immutable | Maps `manifestCid → ContentRecord` |
| `ModerationRegistry` | Sprint 2 | UUPS + 48h timelock | Issues verdicts, updates policyFlags |
| `CreditEscrow` | Sprint 2 | UUPS + 48h timelock | Fiat on-ramp → USDC credits per user |
| `PersistencePool` | Sprint 2 | UUPS + 48h timelock | Escrow per CID; Provider Node claims via Proof of Relay |

## Prerequisites

- Foundry (install via `foundryup`)
- Git submodules for OpenZeppelin, Solady, forge-std (see `lib/`)

## Initial setup

```bash
cd packages/contracts

# Install dependencies (forge-std, OpenZeppelin, Solady)
forge install foundry-rs/forge-std --no-commit
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install OpenZeppelin/openzeppelin-contracts-upgradeable --no-commit
forge install Vectorized/solady --no-commit

# Build and test
forge build --sizes
forge test -vvv

# Copy env
cp .env.example .env
# Edit .env with your values
```

## Testing strategy

- **Unit**: one `.t.sol` per contract, one `test_*` per branch, target 100% branch coverage.
- **Fuzz**: 256 runs local, 10k in CI (`FOUNDRY_PROFILE=ci`).
- **Invariant**: 32×64 local, 256×128 in CI. Critical invariants: conservation in `PersistencePool`.
- **Fork**: `FOUNDRY_PROFILE=fork` runs tests against Base Sepolia fork with real USDC.
- **Static analysis**: Slither in CI (gate). Halmos symbolic checks for critical properties before mainnet.

## Security model

- `ContentRegistry` is **immutable**. Bugs here are fixed via redeploy + migration, never upgrade.
- `PersistencePool`, `CreditEscrow`, `ModerationRegistry` are **UUPS upgradeable** behind a 48h `TimelockController`.
- Admin = Safe multisig (2-of-3 Sepolia → 3-of-5 Mainnet).
- No mainnet deployment until external audit passes.

## Audit plan

- **Sepolia (Sprint 2)**: internal review + Slither + Halmos.
- **Pre-mainnet**: Cantina contest (~$30k) or Spearbit engagement.
- **Post-mainnet**: Immunefi bug bounty.

## Deployment

`ContentRegistry` is immutable. Each deployment is canonical per chain and MUST
be recorded in the protocol-params ADR before it is referenced from any
frontend or backend code.

### Base Sepolia

```bash
cd packages/contracts

# Required env (already present in packages/contracts/.env — DO NOT commit it):
#   DEPLOYER_PRIVATE_KEY  — 0x-prefixed private key
#   BASE_SEPOLIA_RPC_URL  — RPC endpoint
source .env

forge script script/Deploy.s.sol:DeployScript \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast \
  -vv
```

The script logs greppable lines so the deployed address and EIP-712 constants
can be extracted into downstream configs without manual copy-paste:

```
ContentRegistry: 0x...
Chain: 84532
Deployer: 0x...
DOMAIN_NAME: Aevia ContentRegistry
DOMAIN_VERSION: 1
<32-byte hex>   # DOMAIN_SEPARATOR
<32-byte hex>   # REGISTER_TYPEHASH
```

### Verification (Basescan)

Add the following flags once `BASESCAN_API_KEY` is provisioned:

```bash
  --verify \
  --verifier-url "https://api-sepolia.basescan.org/api" \
  --etherscan-api-key "$BASESCAN_API_KEY"
```

### Base mainnet

Mainnet deployment is blocked until external audit sign-off. When unblocked,
the same script is re-used with `--rpc-url "$BASE_MAINNET_RPC_URL"` and a
cold deployer key signed by the Safe multisig.

## Reference

Full spec: `docs/protocol-spec/1-manifest-schema.md` (Sprint 1) and
`docs/protocol-spec/6-content-registry.md` + ADR-0002 (pending).
