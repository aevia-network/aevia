# Coding Conventions

**Analysis Date:** 2026-04-20

## Naming Patterns

**Files:**
- **TypeScript/React**: camelCase (`did.ts`, `actions.ts`, `obs-broadcast-panel.tsx`, `register-content.ts`)
- **Directories**: kebab-case (`libp2p-config`, `provider-node`, `chunk-relay`)
- **Test files**: `*_test.go` (Go), `*.test.ts` (TypeScript), `*.t.sol` (Solidity)
- **API Routes**: bracket syntax for dynamics (`[id]/`, `[address]/`, `[locale]/`)

**Functions:**
- **TypeScript**: camelCase exports with `export function` or `export const`
  ```typescript
  // packages/auth/src/did.ts
  export function addressToDid(address: string, chainId = 8453): AeviaDid { }
  export function didToAddress(did: string): `0x${string}` | null { }
  ```
- **Go**: PascalCase for exported, camelCase for internal
  ```go
  // services/coordinator/internal/epoch/driver.go
  func NewDriver(s SettleRunner, cfg Config) (*Driver, error) { }
  type Config struct { Cadence time.Duration }
  ```
- **Solidity**: camelCase for functions, PascalCase for contracts
  ```solidity
  // packages/contracts/src/BoostRouter.sol
  contract BoostRouter { }
  function previewSplit(uint256 amount) { }
  ```

**Variables:**
- **TypeScript**: camelCase for local vars and parameters
  ```typescript
  // apps/video/src/app/actions.ts
  const uid = formData.get('uid')?.toString();
  const ownership = await resolveLiveOwnership(uid, session.address);
  ```
- **Go**: camelCase for unexported, PascalCase for exported
  ```go
  var Version = "dev"
  type Reader struct { store *storage.Store }
  ```

**Types:**
- **TypeScript**: PascalCase for interfaces, types, and branded types
  ```typescript
  // packages/auth/src/types.ts
  export type AeviaDid = `did:pkh:eip155:${number}:0x${string}`;
  export interface AeviaSession { userId: string; address: `0x${string}`; }
  ```
- **Go**: PascalCase structs and interfaces
  ```go
  // services/coordinator/internal/epoch/driver.go
  type SettleRunner interface { SettleOnce(ctx context.Context, since, until int64) (*settle.Result, error) }
  type Driver struct { settler SettleRunner; cfg Config; }
  ```
- **Solidity**: PascalCase for contracts and types; constants SCREAMING_SNAKE_CASE
  ```solidity
  contract BoostRouter { }
  bytes32 internal constant MANIFEST = bytes32(uint256(0xbaafcafe));
  ```

## Code Style

**Formatting:**
- **Tool**: Biome 1.9 (replaces ESLint + Prettier)
- **Config**: `biome.jsonc` at repo root
- **Enforcement**: lefthook pre-commit hook runs `biome check --write`
- **Key settings**:
  - Indent: 2 spaces
  - Line width: 100 characters
  - Line ending: LF
  - Quotes: single (`'`) in JS/TS, double (`"`) in JSX
  - Semicolons: always
  - Trailing commas: all
  - Arrow parentheses: always

Example from `packages/auth/src/did.ts`:
```typescript
export function addressToDid(address: string, chainId = 8453): AeviaDid {
  if (!ADDRESS_RE.test(address)) {
    throw new Error(`invalid ethereum address: ${address}`);
  }
  return `did:pkh:eip155:${chainId}:${address.toLowerCase()}` as AeviaDid;
}
```

**Linting:**
- **Tool**: Biome 1.9 in `biome.jsonc`
- **Key rules** (enforced):
  - `noUnusedImports: error` — remove dead imports
  - `noUnusedVariables: error` — remove dead assignments
  - `useImportType: error` — prefer `import type` for types
  - `useNodejsImportProtocol: error` — import Node builtins as `node:*`
  - `noExplicitAny: error` — no `any` type
  - `noNonNullAssertion: warn` — avoid `!` operator
  - `noConsoleLog: warn` — log sparingly; see Logging section
  - `useExhaustiveDependencies: warn` — React hook dependencies

**Go Formatting & Linting:**
- **Formatter**: `gofmt` (standard Go formatter) via lefthook
- **Linter**: `go vet` via lefthook pre-commit
- Both run automatically on staged `.go` files

**Solidity Formatting:**
- **Formatter**: `forge fmt` (Foundry) via lefthook
- **Config**: project-level Foundry config (if any)
- Runs automatically on staged `.sol` files

## Import Organization

**Order:**
1. Standard library / Node.js builtins (node:*)
2. Third-party packages from npm
3. Internal packages (alias imports like @aevia/*)
4. Relative imports (.)

Example from `apps/video/src/app/actions.ts`:
```typescript
// Built-ins (1)
'use server';

// Third-party (2)
import { deleteLiveInput, deleteVideo, updateLiveInput } from '@/lib/cloudflare/stream-client';
import { readAeviaSession } from '@aevia/auth/server';
import { revalidatePath } from 'next/cache';

// Relative (4)
import { resolveLiveOwnership } from './api/lives/[id]/_lib/register-meta';
```

Example from Go:
```go
// services/coordinator/internal/receipts/reader.go
package receipts

import (
  "fmt"                                    // stdlib
  
  "github.com/Leeaandrob/aevia/..."       // internal project imports
  "github.com/libp2p/go-libp2p/..."       // third-party
)
```

**Path Aliases:**
- **TypeScript** (root `tsconfig.base.json`):
  - `@aevia/protocol` → `packages/protocol/src`
  - `@aevia/ui` → `packages/ui/src`
  - `@aevia/auth` → `packages/auth/src`
  - `@aevia/libp2p-config` → `packages/libp2p-config/src`
  - `@/` → relative to current app root
- **Enforce via**: Biome's `useImportType` rule

**Subpath exports** (minimize transitive dependencies):
- `@aevia/auth` — core helpers, zero transitive deps (safe on edge/server/client)
- `@aevia/auth/client` — Privy React provider (client-only)
- `@aevia/auth/server` — session verification (server-only)

Example from `packages/auth/src/index.ts`:
```typescript
// Top-level exports: safe everywhere
export { addressToDid, didToAddress, didChainId, shortAddress } from './did';
export type { AeviaDid, AeviaSession, LoginMethod } from './types';
```

## Error Handling

**Patterns:**
- **Throw early**: Use `throw new Error('message')` for unrecoverable errors in synchronous code
  ```typescript
  // packages/auth/src/did.ts
  if (!ADDRESS_RE.test(address)) {
    throw new Error(`invalid ethereum address: ${address}`);
  }
  ```
- **Return null/undefined** for optional failures (graceful degradation)
  ```typescript
  // packages/auth/src/did.ts
  export function didToAddress(did: string): `0x${string}` | null {
    const match = did.match(DID_RE);
    if (!match) return null;
    return match[2]?.toLowerCase() as `0x${string}`;
  }
  ```
- **Promise rejection** for async errors; catch with `.catch(() => { })`
  ```typescript
  // apps/video/src/app/actions.ts
  if (recordingVideoUid) {
    await deleteVideo(recordingVideoUid).catch(() => {
      // Non-fatal — orphaned video will be cleaned up later.
    });
  }
  ```
- **Go pattern**: Return `error` as final return value
  ```go
  // services/coordinator/internal/receipts/reader.go
  func Open(path string) (*Reader, error) {
    if path == "" {
      return nil, fmt.Errorf("receipts: path is empty")
    }
    // ...
  }
  ```
- **Solidity pattern**: Use custom errors and `revert`
  ```solidity
  // packages/contracts/src/BoostRouter.sol
  error ZeroAddress();
  
  if (address(usdc) == address(0)) {
    revert ZeroAddress();
  }
  ```

## Logging

**Framework:** `console.*` (Node.js / browser `console`)

**Patterns:**
- **Warn**: Use for recoverable issues, deprecations, non-fatal failures
  ```typescript
  console.warn('[label] message', data);
  ```
- **Error**: Use for failures that need operator attention
  ```typescript
  console.error('[label] message:', err);
  ```
- **Info/Log**: Biome warns on `console.log()` — avoid in production code; only use in development/debugging
- **Prefix convention**: Use `[module-or-context]` as prefix for all console output to aid in grep/search

Examples from codebase:
```typescript
// apps/video/src/app/dashboard/live-row.tsx
console.error('[register] switchChain failed, continuing:', err);

// apps/video/src/app/api/lives/[id]/register-relayed/route.ts
console.error('[relayer] persist meta failed (on-chain tx succeeded):', err);
```

**In Solidity**: Use events for auditable state changes; never use console in contracts.

## Comments

**When to Comment:**
- **Why**, not what: Code reads the "what"; comment explains design intent
  ```typescript
  // packages/auth/src/server.ts
  // Dev-only short-circuit. Both the server-side flag and the public one
  // are checked so that server components running on the edge still see
  // the correct bypass state.
  ```
- **Before complex logic**: Invariants, surprising behavior, workarounds
  ```go
  // services/coordinator/internal/epoch/driver.go
  // lastSince is the cursor used as `since` for the next SettleOnce.
  // Advanced to the `until` value only when a settlement succeeded
  // (not on ErrNoReceipts) so a quiet tick doesn't lose the already-
  // captured window.
  lastSince int64
  ```
- **Before high-risk sections**: Security, critical paths, known footguns
  ```typescript
  // apps/video/src/app/actions.ts
  // Ownership verified before deletion via the canonical
  // `resolveLiveOwnership` helper — checks both
  // `meta.creatorAddress` (round-trip safe) and `defaultCreator`
  // (often null because Cloudflare drops it on many tiers; see `stream-client.ts`).
  ```

**JSDoc/TSDoc:**
- **Use for public APIs**: Functions, types, and exported modules in packages
  ```typescript
  // packages/auth/src/did.ts
  /**
   * Derive a `did:pkh` identifier from an Ethereum address per CAIP-10.
   * Always returns the address in lowercase; callers should not compare case-sensitively.
   */
  export function addressToDid(address: string, chainId = 8453): AeviaDid { }
  ```
- **Go doc comments**: One-line or multi-line before exported symbol
  ```go
  // services/coordinator/internal/receipts/reader.go
  // Open mounts a BadgerDB at path. The caller MUST Close() when done.
  func Open(path string) (*Reader, error) { }
  ```
- **Solidity NatSpec**: `@title`, `@notice`, `@dev`, `@param`, `@return`
  ```solidity
  /**
   * @title BoostRouter
   * @notice Non-custodial splitter that routes paid amplification (boosts)
   *         across four recipients.
   * @dev Specified normatively in `docs/protocol-spec/8-economic-architecture.md` §4.
   */
  contract BoostRouter { }
  ```

## Function Design

**Size:** Prefer small, testable functions. No hard limit, but break logic into separate functions when:
- Function has more than one responsibility
- Logic is complex enough to warrant a comment
- Function is tested independently

Example (good):
```typescript
// packages/auth/src/did.ts — ~3 lines each
export function addressToDid(address: string, chainId = 8453): AeviaDid { }
export function didToAddress(did: string): `0x${string}` | null { }
export function didChainId(did: string): number | null { }
```

**Parameters:**
- Use **required** parameters for critical inputs
- Use **optional parameters with defaults** for configurable behavior
  ```typescript
  export function shortAddress(address: string, head = 6, tail = 4): string { }
  ```
- For objects with >3 related params, create a type alias
  ```go
  // services/coordinator/internal/epoch/driver.go
  type Config struct {
    Cadence      time.Duration
    InitialSince int64
  }
  ```

**Return Values:**
- Prefer **single return** for simple cases
- Use **tuple returns** (Go) or **unions** (TypeScript) for optional results
  ```typescript
  export function didToAddress(did: string): `0x${string}` | null { }
  ```
- Go: always return error as final value
  ```go
  func Open(path string) (*Reader, error) { }
  ```

## Module Design

**Exports:**
- **Explicit**: Use `export` at the declaration site; barrel files re-export
  ```typescript
  // packages/auth/src/index.ts
  export { addressToDid, didToAddress, didChainId, shortAddress } from './did';
  export type { AeviaDid, AeviaSession, LoginMethod } from './types';
  ```
- **Types first**: Export type definitions before implementations
  ```typescript
  export type { RegisterContentTypedData } from './register-content';
  export { buildRegisterContentTypedData } from './register-content';
  ```

**Barrel Files:**
- Used to manage entry points (e.g., `@aevia/auth` vs `@aevia/auth/server`)
- Group related exports for clarity
- Do not re-export everything indiscriminately — be explicit

Example:
```typescript
// packages/auth/src/index.ts — top-level, zero transitive deps
export { addressToDid, didToAddress, didChainId, shortAddress } from './did';

// packages/auth/src/server.ts — server-only (jose dependency)
export { readAeviaSession, verifyBearerToken } from './server';
```

## Language Rules (pt-BR vs English)

**User-facing copy** (UI strings, `README.md`, product docs, error messages users see):
- **Language**: Brazilian Portuguese (pt-BR)
- **Case**: lowercase (except "LIVE" badge per design system)
- Example from `apps/video/src/app/layout.tsx`:
  ```typescript
  export const metadata: Metadata = {
    title: 'aevia — vídeo sem intermediários',
    description: 'live de baixa latência, vod automático, clips virais. seu conteúdo, sua audiência, seu protocolo.',
  };
  ```

**Code** (identifiers, types, inline comments, docstrings):
- **Language**: English always
- No pt-BR identifiers, function names, or variable names
- Inline comments explaining business logic: English

**Commit messages**:
- **Language**: English
- **Format**: Conventional Commits with scoped prefix from `commitlint.config.mjs`
- **Scopes**: `video`, `network`, `provider-node`, `recorder`, `manifest-svc`, `indexer`, `protocol`, `ui`, `auth`, `libp2p-config`, `contracts`, `infra`, `ci`, `docs`, `deps`, `repo`, `release`
- Example: `feat(contracts): wire BoostRouter with RFC-8 compliance`

**Authorship:**
- Commits authored by local `git config user.name` / `user.email`
- **No** `Co-Authored-By` trailers
- **No** AI attribution phrases (generated with, assisted by, written by, etc.)
- **No** emoji tool signatures
- The tooling used is invisible

---

*Convention analysis: 2026-04-20*
