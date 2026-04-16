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

## Reference

Full spec: `docs/protocol-spec/6-content-registry.md` (Sprint 1) and ADR-0002 (pending).
