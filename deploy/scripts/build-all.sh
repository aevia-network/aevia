#!/usr/bin/env bash
# build-all.sh — cross-compile the aevia-node binary for the three
# targets in the testnet: ARM64 Linux (relay 1), AMD64 Linux (relay 2),
# and the local Mac (provider on darwin/arm64).
#
# Output goes to deploy/bin/. The binaries are self-contained statics
# (CGO disabled); no dependencies on the host beyond a working kernel
# and network stack.

set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
OUT="${REPO_ROOT}/deploy/bin"
SRC="./cmd/provider"

mkdir -p "${OUT}"
cd "${REPO_ROOT}/services/provider-node"

VERSION=${VERSION:-$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo dev)}
LDFLAGS="-s -w -X main.Version=${VERSION}"

echo "Building aevia-node ${VERSION}"
echo ""

echo "→ linux/arm64 (Relay 1 — Ubuntu ARM)"
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="${LDFLAGS}" -o "${OUT}/aevia-node-linux-arm64" "${SRC}"

echo "→ linux/amd64 (Relay 2 — Ubuntu AMD)"
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="${LDFLAGS}" -o "${OUT}/aevia-node-linux-amd64" "${SRC}"

echo "→ darwin/arm64 (Mac — Provider)"
GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="${LDFLAGS}" -o "${OUT}/aevia-node-darwin-arm64" "${SRC}"

echo ""
echo "Built:"
ls -lh "${OUT}"/aevia-node-*
