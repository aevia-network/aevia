# NeuroGrid Engine — License Grant to Aevia LLC

**Grant document executed 2026-04-19.**

## 1. Parties

- **Grantor**: Leandro Barbosa (individual), sole copyright holder of the
  NeuroGrid Engine as published at <https://github.com/Leeaandrob/neurogrid>
  under the "NeuroGrid Engine License, Version 1.0, January 2026" (source-
  available, non-commercial with academic grant).
- **Grantee**: Aevia LLC (Delaware, US), operating the Aevia protocol at
  <https://aevia.network>.

## 2. Grant

Grantor hereby grants to Grantee a **royalty-free, perpetual, worldwide,
non-exclusive, irrevocable, and sublicensable license** to:

1. Incorporate, modify, and deploy the NeuroGrid Engine, in whole or in
   part, as a component of the Aevia protocol;
2. Distribute NeuroGrid Engine binaries, source code, and derivative works
   under the terms of any license applicable to the Aevia component in
   which NeuroGrid is embedded — including but not limited to Apache-2.0
   and AGPL-3.0 per the Aevia repository's `LICENSES.md`;
3. Grant sublicenses to Aevia's provider-node operators, contributors,
   commercial deployers, and downstream consumers, on terms no more
   restrictive than the license under which the corresponding Aevia
   component is distributed;
4. Reference, document, and promote NeuroGrid as a reference implementation
   of the inference layer specified in Aevia's protocol specification
   (currently RFC-13, forthcoming).

## 3. Scope

This grant covers **all versions** of NeuroGrid Engine, past and future,
for the duration of Grantor's copyright ownership. Grantor retains the
right to continue distributing NeuroGrid under any other license terms to
other parties, and to publish future versions under any license Grantor
selects — without affecting the rights granted to Grantee under this
document.

## 4. No warranty

NeuroGrid Engine is provided AS-IS, with no warranty of fitness, merchan-
tability, or non-infringement. Grantor's obligations are limited to those
stated in this grant; no additional support, maintenance, or guarantee
is implied.

## 5. Rationale (non-binding)

This grant exists because:

- Aevia's inference layer (RFC-13) references NeuroGrid as its reference
  implementation, sharing the same Go + libp2p substrate as the Aevia
  provider-node mesh.
- Grantor is the sole author of both NeuroGrid and Aevia and wishes to
  avoid any ambiguity about Aevia LLC's rights to incorporate NeuroGrid
  commercially as the protocol matures.
- Recording this grant explicitly — rather than relying on Grantor's
  dual role as author-and-operator — preserves Aevia LLC's ability to
  operate, transfer, or be acquired without renegotiating the relation-
  ship to NeuroGrid.

## 6. Signatures

**Grantor** (Leandro Barbosa, individual)

Signed on-chain: upon first commit of this file to the Aevia repository
at `https://github.com/aevia-network/aevia`, Grantor's `git config
user.email` acts as the execution record. The commit hash plus the
signed commit signature (if GPG-signed) provide temporal integrity.

**Grantee** (Aevia LLC)

Represented by its sole member and founder, Leandro Barbosa. Acceptance
is recorded by the merge of this file into the `main` branch of the
Aevia repository.

---

_This document is not legal advice. Aevia LLC should obtain counsel
review as part of the Delaware LLC + foundation structuring work tracked
in TODO §14.3._
