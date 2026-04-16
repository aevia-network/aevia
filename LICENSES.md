# Aevia Licensing

Aevia uses a per-scope license split. Each package or app carries its own `LICENSE` file with the applicable license text.

## License map

| Scope | License | SPDX identifier | Rationale |
|---|---|---|---|
| `packages/contracts` | Apache-2.0 | `Apache-2.0` | Open protocol; contracts must be freely auditable and forkable |
| `packages/protocol` | Apache-2.0 | `Apache-2.0` | Wire format and schema must be reimplementable by anyone |
| `packages/auth` | Apache-2.0 | `Apache-2.0` | Shared auth primitives consumable by third-party clients |
| `packages/libp2p-config` | Apache-2.0 | `Apache-2.0` | Shared network config for alternate clients |
| `packages/ui` | MIT | `MIT` | UI components — maximum permissibility for adoption |
| `apps/video` | AGPL-3.0-or-later | `AGPL-3.0-or-later` | Client app — network copyleft prevents SaaS enclosure |
| `apps/network` | AGPL-3.0-or-later | `AGPL-3.0-or-later` | Client app — network copyleft prevents SaaS enclosure |
| `services/provider-node` | AGPL-3.0-or-later | `AGPL-3.0-or-later` | Server that operates the network |
| `services/recorder` | AGPL-3.0-or-later | `AGPL-3.0-or-later` | Server that operates the network |
| `services/manifest-svc` | AGPL-3.0-or-later | `AGPL-3.0-or-later` | Server that operates the network |
| `services/indexer` | AGPL-3.0-or-later | `AGPL-3.0-or-later` | Server that operates the network |

## Philosophy

- **Protocol layer (Apache-2.0)** maximizes reimplementation and alternate clients — core to the sovereignty thesis.
- **UI layer (MIT)** is designed for reuse — anyone should be able to adopt `@aevia/ui` in unrelated projects without legal friction.
- **Application layer (AGPL-3.0-or-later)** prevents hostile forks from running a proprietary mirror of the Aevia service without contributing improvements back.

## Per-package LICENSE files

Each directory listed above contains its own `LICENSE` file with the full standard text of the applicable license. The `package.json` of each workspace declares the license via the SPDX `license` field.

## Contributions

By contributing to any directory, you agree that your contribution is licensed under the license of that directory.

## Third-party code

Third-party dependencies retain their own licenses. A consolidated `NOTICE` file will be generated at release time via `license-checker`.
