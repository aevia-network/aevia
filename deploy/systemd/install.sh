#!/usr/bin/env bash
# install.sh — prepare a VPS to run aevia-node as a systemd service.
# Assumes the binary (aevia-node-linux-{arm64,amd64}) is already present
# in the same directory as this script.
#
# Usage:
#   # Transfer this script + the binary to the VPS, then:
#   sudo bash install.sh [arm64|amd64]
#
# Post-install steps:
#   1. Edit /etc/aevia-node/env to set AEVIA_BOOTSTRAP if this isn't
#      the cold-start relay.
#   2. sudo systemctl enable --now aevia-node
#   3. Grab the PeerID from the journal:
#        journalctl -u aevia-node | grep listening_libp2p | head -1
#   4. Open TCP port 4001 + 8080 on the firewall.

set -euo pipefail

ARCH="${1:-}"
if [[ -z "${ARCH}" ]]; then
  # Auto-detect if not provided.
  UNAMEM=$(uname -m)
  case "${UNAMEM}" in
    aarch64|arm64)  ARCH=arm64 ;;
    x86_64|amd64)   ARCH=amd64 ;;
    *) echo "Unknown arch ${UNAMEM}. Pass arm64 or amd64 as argument." >&2; exit 1 ;;
  esac
fi

BINARY="aevia-node-linux-${ARCH}"
if [[ ! -f "${BINARY}" ]]; then
  echo "Binary ${BINARY} not found in $(pwd). Did you scp it here?" >&2
  exit 1
fi

echo "==> Creating aevia user"
if ! id -u aevia >/dev/null 2>&1; then
  useradd --system --home /var/lib/aevia-node --shell /usr/sbin/nologin aevia
fi

echo "==> Installing binary to /usr/local/bin/aevia-node"
install -m 0755 "${BINARY}" /usr/local/bin/aevia-node

echo "==> Creating data dir /var/lib/aevia-node"
mkdir -p /var/lib/aevia-node
chown -R aevia:aevia /var/lib/aevia-node
chmod 0750 /var/lib/aevia-node

echo "==> Creating config dir /etc/aevia-node"
mkdir -p /etc/aevia-node
if [[ ! -f /etc/aevia-node/env ]]; then
  install -m 0644 env.example /etc/aevia-node/env
  echo "   /etc/aevia-node/env created from env.example — edit it before starting."
else
  echo "   /etc/aevia-node/env already exists — leaving alone."
fi

echo "==> Installing systemd unit /etc/systemd/system/aevia-node.service"
install -m 0644 aevia-node.service /etc/systemd/system/aevia-node.service
systemctl daemon-reload

echo ""
echo "Install complete. Next steps:"
echo "  1. Edit /etc/aevia-node/env"
echo "     (Relay 1 leaves AEVIA_BOOTSTRAP empty; Relay 2 fills it with Relay 1's multiaddr.)"
echo "  2. Open firewall: TCP 4001 (libp2p) + TCP 8080 (HTTP)"
echo "     ufw allow 4001/tcp && ufw allow 8080/tcp"
echo "  3. systemctl enable --now aevia-node"
echo "  4. journalctl -u aevia-node -f    # watch for PeerID + listening addrs"
