# Testing Patterns

**Analysis Date:** 2026-04-20

## Test Framework

**TypeScript/JavaScript:**

**Runner:**
- vitest (catalog version)
- Config: per-package in package.json (no shared vitest.config.*)
- Framework: `describe`, `it`, `expect` from vitest

**Assertion Library:**
- vitest's built-in expect (Chai-style assertions)

**Packages with tests:**
- `packages/auth` — vitest
- `packages/contracts` — Foundry Forge (Solidity)
- `services/coordinator` — Go testing package

**Go:**

**Runner:**
- Go `testing` package (standard library)
- No test config file; tests are `*_test.go` files
- Run with `go test ./...`

**Framework:**
- Subtest pattern: `t.Run("subtest name", func(t *testing.T) { ... })`
- Table-driven tests for parameterized cases

**Solidity/Ethereum:**

**Runner:**
- Foundry Forge (`forge test`)
- Config: `foundry.toml` (project-level)
- Test files: `packages/contracts/test/**/*.t.sol`

**Framework:**
- Standard Forge test contract pattern
- Inherits from `Test` (forge-std)

**Run Commands:**

```bash
# TypeScript tests (aevia monorepo root)
pnpm test                        # Run all tests (all packages)
pnpm test:contracts             # Run Solidity tests only
pnpm --filter @aevia/auth test   # Run tests for @aevia/auth package
pnpm --filter @aevia/auth test:watch  # Watch mode for @aevia/auth

# Go tests (within services directory)
cd services/coordinator
go test ./...                    # Run all coordinator tests
go test ./internal/receipts ...  # Run specific package tests
go test -v ./...                 # Verbose output

# Solidity tests (within packages/contracts)
cd packages/contracts
forge test                       # Run all tests
forge test -vvv                  # Very verbose (show traces)
forge test --fork-url base_sepolia  # Fork mode (see Profiles)
```

## Test File Organization

**Location:**
- **TypeScript**: Co-located in `__tests__/` subdirectory or inline with source
  - `packages/auth/src/__tests__/did.test.ts`
  - `packages/auth/src/__tests__/verify-edge.test.ts`
  - `packages/auth/src/__tests__/register-content.test.ts`
- **Go**: `*_test.go` in the same package directory
  - `services/coordinator/internal/receipts/reader_test.go`
  - `services/coordinator/internal/epoch/driver_test.go`
  - `services/coordinator/internal/chain/client_test.go`
- **Solidity**: Separate `packages/contracts/test/` directory
  - `packages/contracts/test/BoostRouter.t.sol`
  - `packages/contracts/test/RiskOracle.t.sol`
  - `packages/contracts/test/ContentRegistry.t.sol`

**Naming:**
- **TypeScript**: `*.test.ts` or `*.spec.ts` (both supported; `.test.ts` is convention)
- **Go**: `*_test.go` (required by Go toolchain)
- **Solidity**: `*.t.sol` (Foundry convention; `T` prefix indicates test contract)

**Structure:**
```
packages/auth/
├── src/
│   ├── did.ts
│   ├── types.ts
│   ├── __tests__/          # Test directory
│   │   ├── did.test.ts
│   │   ├── verify-edge.test.ts
│   │   └── register-content.test.ts
│   └── index.ts
└── package.json

services/coordinator/
├── cmd/
│   └── coordinator/
│       └── main.go
├── internal/
│   ├── receipts/
│   │   ├── reader.go
│   │   ├── reader_test.go  # Same directory as source
│   │   ├── window.go
│   │   └── window_test.go
│   └── epoch/
│       ├── driver.go
│       └── driver_test.go
└── go.mod
```

## Test Structure

**TypeScript/Vitest Suite Organization:**

```typescript
// packages/auth/src/__tests__/did.test.ts
import { describe, expect, it } from 'vitest';
import { addressToDid, didChainId, didToAddress, shortAddress } from '../did';

describe('addressToDid', () => {
  it('produces a did:pkh with the default Base mainnet chain id and a lowercased address', () => {
    const did = addressToDid(MIXED_CASE_ADDRESS);
    expect(did).toBe(`did:pkh:eip155:${AEVIA_CHAIN_ID_MAINNET}:${LOWERCASE_ADDRESS}`);
  });

  it('honours a custom chain id', () => {
    const did = addressToDid(MIXED_CASE_ADDRESS, AEVIA_CHAIN_ID_SEPOLIA);
    expect(did).toBe(`did:pkh:eip155:${AEVIA_CHAIN_ID_SEPOLIA}:${LOWERCASE_ADDRESS}`);
  });

  it('throws on a malformed address', () => {
    expect(() => addressToDid('not-an-address')).toThrow(/invalid ethereum address/);
  });
});

describe('didToAddress', () => {
  it('round-trips the output of addressToDid', () => {
    const did = addressToDid(MIXED_CASE_ADDRESS, AEVIA_CHAIN_ID_SEPOLIA);
    expect(didToAddress(did)).toBe(LOWERCASE_ADDRESS);
  });

  it('returns null on a malformed DID', () => {
    expect(didToAddress('did:web:example.com')).toBeNull();
  });
});
```

**Patterns:**
- **Setup**: Declare fixtures at file or suite level; no `beforeEach` unless needed
  ```typescript
  // packages/auth/src/__tests__/did.test.ts (top of file)
  const MIXED_CASE_ADDRESS = '0xABcDef0123456789abcdef0123456789ABCdef01';
  const LOWERCASE_ADDRESS = MIXED_CASE_ADDRESS.toLowerCase();
  ```
- **Teardown**: Use `t.Cleanup()` in Go; vitest has no global teardown pattern
  ```go
  // services/coordinator/internal/receipts/reader_test.go
  func TestInMemoryReaderWindowFiltersByTime(t *testing.T) {
    r, err := receipts.OpenInMemory()
    t.Cleanup(func() { _ = r.Close() })
  }
  ```
- **Assertion**: Vitest `expect` with chainable assertions
  ```typescript
  expect(did).toBe(expected);
  expect(didToAddress('invalid')).toBeNull();
  expect(() => fn()).toThrow(/pattern/);
  ```

**Go Test Structure:**

```go
// services/coordinator/internal/receipts/reader_test.go
package receipts_test

import (
  "testing"
  "github.com/libp2p/go-libp2p/core/crypto"
  "github.com/Leeaandrob/aevia/services/coordinator/internal/receipts"
)

// Helper functions (prefixed with lowercase)
func keyPair(t *testing.T) (crypto.PrivKey, string) {
  t.Helper()
  priv, _, err := crypto.GenerateEd25519Key(rand.Reader)
  if err != nil {
    t.Fatalf("GenerateEd25519Key: %v", err)
  }
  return priv, pid.String()
}

// Test functions (TestXxx naming)
func TestOpenRejectsEmptyPath(t *testing.T) {
  if _, err := receipts.Open(""); err == nil {
    t.Fatal("Open(\"\") returned nil error")
  }
}

func TestInMemoryReaderWindowFiltersByTime(t *testing.T) {
  r, err := receipts.OpenInMemory()
  if err != nil {
    t.Fatalf("OpenInMemory: %v", err)
  }
  t.Cleanup(func() { _ = r.Close() })

  // Arrange
  providerPriv, providerPID := keyPair(t)
  viewerPriv, viewerPID := keyPair(t)

  // Act & Assert
  for i, ts := range []int64{100, 200, 300} {
    rec := dualSigned(t, providerPriv, providerPID, viewerPriv, viewerPID, uint64(i+1), ts)
    if err := rs.Put(rec); err != nil {
      t.Fatalf("Put %d: %v", i, err)
    }
  }

  all, err := r.WindowForAllProviders(0, 0)
  if err != nil {
    t.Fatalf("WindowForAllProviders: %v", err)
  }
  if len(all) != 3 {
    t.Fatalf("unbounded got %d, want 3", len(all))
  }
}
```

**Solidity Test Structure:**

```solidity
// packages/contracts/test/BoostRouter.t.sol
// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { BoostRouter } from "../src/BoostRouter.sol";

contract BoostRouterTest is Test {
    MockUSDC internal usdc;
    MockRegistry internal registry;
    MockOracle internal oracle;
    BoostRouter internal router;

    // Test actors (use makeAddr() helper)
    address internal creator = makeAddr("creator");
    address internal persistencePool = makeAddr("persistencePool");

    // Constants
    bytes32 internal constant MANIFEST = bytes32(uint256(0xbaafcafe));

    // setUp() runs before each test
    function setUp() public {
        usdc = new MockUSDC();
        registry = new MockRegistry();
        oracle = new MockOracle();
        router = new BoostRouter(
            IERC20(address(usdc)),
            IContentRegistry(address(registry)),
            IRiskOracle(address(oracle)),
            persistencePool,
            llcTreasury,
            councilFund,
            council
        );

        registry.set(MANIFEST, creator);
        oracle.set(MANIFEST, 1_000);
    }

    // Helpers (prefixed with _)
    function _validScore(uint16 r) internal view returns (RiskOracle.Score memory) {
        return RiskOracle.Score({
            r: r,
            rLegal: r / 3,
            rAbuse: r / 3,
            rValues: r - (r / 3) - (r / 3),
            updatedAt: uint64(block.timestamp),
            classifierVersion: CLASSIFIER_V1,
            isAbsolute: false
        });
    }

    // Test function (test_XYZ naming; groups related tests by component)
    function test_Constructor_RejectsZeroUSDC() public {
        vm.expectRevert(BoostRouter.ZeroAddress.selector);
        new BoostRouter(
            IERC20(address(0)),
            IContentRegistry(address(registry)),
            IRiskOracle(address(oracle)),
            persistencePool,
            llcTreasury,
            councilFund,
            council
        );
    }

    function test_Constructor_SetsState() public view {
        assertEq(address(router.usdc()), address(usdc));
        assertEq(router.creatorBps(), 5_000);
    }
}
```

## Mocking

**TypeScript/Vitest:**

**Framework:** vitest built-in (vi) for mocks and spies

**Patterns:**
```typescript
// packages/auth/src/__tests__/verify-edge.test.ts
async function mintForeignJwt(
  options: {
    issuer?: string;
    audience?: string | string[];
    iat?: number;
    exp?: number;
    payload?: Record<string, unknown>;
    kid?: string;
  } = {},
) {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const jwk = await exportJWK(publicKey);
  const kid = options.kid ?? 'foreign-key-id';

  const now = Math.floor(Date.now() / 1000);
  const iat = options.iat ?? now;
  const exp = options.exp ?? now + 3600;

  const token = await new SignJWT({ ...(options.payload ?? {}) })
    .setProtectedHeader({ alg: 'ES256', kid })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .setIssuer(options.issuer ?? 'privy.io')
    .setAudience(options.audience ?? APP_ID)
    .setSubject('did:privy:test-subject')
    .sign(privateKey);

  return { token, publicJwk: jwk };
}

describe('verifyPrivyJwt', () => {
  it('throws on a malformed token', async () => {
    await expect(verifyPrivyJwt('not-a-jwt', APP_ID)).rejects.toThrow();
    await expect(verifyPrivyJwt('', APP_ID)).rejects.toThrow();
  });

  it('throws on a valid ES256 JWT signed by a key NOT in the embedded JWKS', async () => {
    const { token } = await mintForeignJwt({ kid: 'unknown-key' });
    await expect(verifyPrivyJwt(token, APP_ID)).rejects.toThrow();
  });
});
```

**What to Mock:**
- External services (APIs, databases) — create in-memory stubs
- Crypto operations (if expensive) — use fixtures
- Time (system clock) — inject a time function

**What NOT to Mock:**
- Core business logic — test the real implementation
- Type checks — no point mocking TypeScript types
- Simple pure functions — test them directly
- Dependency injection containers — wire real dependencies

**Go Testing:**

**Framework:** Custom mock contracts for interfaces

**Patterns:**
```go
// services/coordinator/internal/receipts/reader_test.go
// Mock implementation of WindowReader interface
type mockReader struct {
  receipts []*por.Receipt
  err      error
}

func (m *mockReader) WindowForAllProviders(since, until int64) ([]*por.Receipt, error) {
  if m.err != nil {
    return nil, m.err
  }
  return m.receipts, nil
}

func (m *mockReader) Close() error { return nil }

// Use in test
func TestWithMockReader(t *testing.T) {
  mock := &mockReader{receipts: []*por.Receipt{...}}
  // Pass mock to code under test
}
```

**Test doubles:**
- Use `testing.T.Helper()` for helper functions
- Inject dependencies via constructor or interface
- Create in-memory versions (e.g., `OpenInMemory()`) for storage

**Solidity Testing:**

**Framework:** Foundry's vm cheatcodes

**Patterns:**
```solidity
// packages/contracts/test/RiskOracle.t.sol
contract RiskOracleTest is Test {
  function test_Constructor_RejectsZeroScoringService() public {
    vm.expectRevert(RiskOracle.ZeroAddress.selector);
    new RiskOracle(address(0), council);
  }

  function _publish(bytes32 manifest, uint16 r) internal {
    RiskOracle.Score memory s = _validScore(r);
    vm.prank(scoringService);  // Change caller
    oracle.publishScore(manifest, s);
  }

  function test_PublishScore_OnlyAllowsScoringService() public {
    vm.expectRevert(RiskOracle.Unauthorized.selector);
    vm.prank(stranger);  // Non-authorized actor
    oracle.publishScore(MANIFEST, _validScore(5_000));
  }

  function test_PublishScore_EmitsEvent() public {
    RiskOracle.Score memory s = _validScore(5_000);
    vm.prank(scoringService);
    vm.expectEmit(true, false, false, true, address(oracle));
    emit ScorePublished(MANIFEST, s);
    oracle.publishScore(MANIFEST, s);
  }
}
```

**Cheatcodes used:**
- `vm.prank(address)` — set msg.sender for next call
- `vm.expectRevert(selector)` — assert next call reverts
- `vm.expectEmit(...)` — assert event emission
- `makeAddr(string)` — create deterministic test address

## Fixtures and Factories

**TypeScript/Vitest:**

**Test Data:**
```typescript
// Declare at file level
const MIXED_CASE_ADDRESS = '0xABcDef0123456789abcdef0123456789ABCdef01';
const LOWERCASE_ADDRESS = MIXED_CASE_ADDRESS.toLowerCase();

const APP_ID = 'test-app-id';

// Reuse in multiple tests
describe('addressToDid', () => {
  it('produces a did with the default chain id', () => {
    const did = addressToDid(MIXED_CASE_ADDRESS);
    expect(did).toBe(`did:pkh:eip155:${AEVIA_CHAIN_ID_MAINNET}:${LOWERCASE_ADDRESS}`);
  });
});
```

**Location:**
- File-level constants for shared test data
- Factory functions for complex objects
- No separate fixtures directory (keep fixtures co-located with tests)

**Go Fixtures:**

```go
// Helper function (t.Helper() marks it as a test helper)
func keyPair(t *testing.T) (crypto.PrivKey, string) {
  t.Helper()
  priv, _, err := crypto.GenerateEd25519Key(rand.Reader)
  if err != nil {
    t.Fatalf("GenerateEd25519Key: %v", err)
  }
  pub := priv.GetPublic()
  pid, err := peer.IDFromPublicKey(pub)
  if err != nil {
    t.Fatalf("IDFromPublicKey: %v", err)
  }
  return priv, pid.String()
}

// Used in test
func TestExample(t *testing.T) {
  providerPriv, providerPID := keyPair(t)
  // Use fixtures...
}
```

**Solidity Fixtures:**

```solidity
contract BoostRouterTest is Test {
  // State fixtures setup in setUp()
  function setUp() public {
    usdc = new MockUSDC();
    registry = new MockRegistry();
    oracle = new MockOracle();
    router = new BoostRouter(
      IERC20(address(usdc)),
      IContentRegistry(address(registry)),
      IRiskOracle(address(oracle)),
      persistencePool,
      llcTreasury,
      councilFund,
      council
    );
  }

  // Helper for building valid test data
  function _validScore(uint16 r) internal view returns (RiskOracle.Score memory) {
    return RiskOracle.Score({
      r: r,
      rLegal: r / 3,
      rAbuse: r / 3,
      rValues: r - (r / 3) - (r / 3),
      updatedAt: uint64(block.timestamp),
      classifierVersion: CLASSIFIER_V1,
      isAbsolute: false
    });
  }
}
```

## Coverage

**Requirements:** Not enforced by default (no CI gate on coverage %)

**View Coverage:**

```bash
# TypeScript (vitest)
pnpm --filter @aevia/auth test  # vitest run (no coverage by default)
# To add coverage: configure in vitest.config.ts (if created)

# Go
cd services/coordinator
go test -cover ./...            # Show coverage %
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out  # Open in browser

# Solidity
cd packages/contracts
forge coverage                   # Default coverage report
forge coverage --report lcov     # LCOV format (for CI tools)
```

## Test Types

**Unit Tests:**

**Scope:** Single function or type in isolation

**Approach:**
- Test pure functions directly (no side effects)
- Use mocks for external dependencies
- Test happy path + error cases (throw/return null/revert)

Example:
```typescript
// packages/auth/src/__tests__/did.test.ts
describe('addressToDid', () => {
  it('produces a did with default chain', () => { /* ... */ });
  it('honours custom chain id', () => { /* ... */ });
  it('throws on invalid address', () => { /* ... */ });
});
```

**Integration Tests:**

**Scope:** Multiple components + shared dependencies (database, network, contracts)

**Approach:**
- Use in-memory test doubles (receipts.OpenInMemory())
- Test contract interactions (allowance → transfer → event)
- Verify side effects (state changes, events emitted)

Example:
```go
// services/coordinator/internal/receipts/reader_test.go
func TestInMemoryReaderWindowFiltersByTime(t *testing.T) {
  r, err := receipts.OpenInMemory()  // Real, in-memory reader
  // Populate with receipts
  all, err := r.WindowForAllProviders(0, 0)
  // Assert side effects
}
```

**E2E Tests:**

**Status:** Not implemented in Aevia monorepo

**Scope** (if added later): Full user workflows (create account → publish content → view)

## Common Patterns

**Async Testing (TypeScript):**

```typescript
describe('verifyPrivyJwt', () => {
  it('throws on malformed token', async () => {
    await expect(verifyPrivyJwt('not-a-jwt', APP_ID)).rejects.toThrow();
  });

  it('throws on unsigned token', async () => {
    const { token } = await mintForeignJwt({ kid: 'unknown' });
    await expect(verifyPrivyJwt(token, APP_ID)).rejects.toThrow();
  });
});
```

**Error Testing (TypeScript):**

```typescript
describe('addressToDid', () => {
  it('throws on malformed address', () => {
    expect(() => addressToDid('not-an-address')).toThrow(/invalid ethereum address/);
    expect(() => addressToDid('0x1234')).toThrow(/invalid ethereum address/);
  });
});
```

**Error Testing (Go):**

```go
func TestOpenRejectsEmptyPath(t *testing.T) {
  _, err := receipts.Open("")
  if err == nil {
    t.Fatal("Open(\"\") returned nil error")
  }
  // Check specific error type or message
  if !strings.Contains(err.Error(), "path is empty") {
    t.Fatalf("wrong error: %v", err)
  }
}
```

**Error Testing (Solidity):**

```solidity
function test_Constructor_RejectsZeroUSDC() public {
  vm.expectRevert(BoostRouter.ZeroAddress.selector);
  new BoostRouter(
    IERC20(address(0)),  // Will revert
    IContentRegistry(address(registry)),
    IRiskOracle(address(oracle)),
    persistencePool,
    llcTreasury,
    councilFund,
    council
  );
}
```

## Test Authoring Checklist

Before committing test code:

1. **Happy path tested** — basic functionality works
2. **Error cases covered** — throw/return null/revert is tested
3. **Edge cases handled** — boundary values, empty inputs, malformed data
4. **No flaky sleeps** — use signals/channels (Go), timeouts (Solidity vm.warp), or deterministic time injection (TypeScript)
5. **Fixtures are clear** — setup is minimal, immutable where possible
6. **Mocks isolate** — real I/O is either stubbed or uses in-memory doubles
7. **Tests are independent** — no test ordering dependencies
8. **Names are descriptive** — `test_Constructor_RejectsZeroUSDC` is clear; `test_Works` is not
9. **Comments rare** — test names and assertions should be self-explanatory
10. **Cleanup is explicit** — `t.Cleanup()` in Go; `vm.resetModifiedAccounts()` in Solidity if needed

---

*Testing analysis: 2026-04-20*
