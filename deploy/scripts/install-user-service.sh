#!/usr/bin/env bash
# install-user-service.sh — bootstrap an aevia-node as a systemd USER
# service, meant to run on consumer Linux desktops where passwordless
# sudo isn't available (rtx2080 Nobara, rtx4090 Ubuntu). Everything
# lives under $HOME so no sudo is needed at install time. Post-install
# the operator should `sudo loginctl enable-linger $USER` once so the
# service keeps running after logout.
#
# Usage (on the remote host, after scp'ing this script + the binary):
#   bash install-user-service.sh /tmp/aevia-node-linux-amd64

set -euo pipefail

BINARY_SRC="${1:-}"
if [[ -z "${BINARY_SRC}" || ! -f "${BINARY_SRC}" ]]; then
  echo "usage: install-user-service.sh <path-to-binary>" >&2
  exit 1
fi

INSTALL_DIR="${HOME}/.local/bin"
CONFIG_DIR="${HOME}/.config/aevia-node"
DATA_DIR="${HOME}/.local/share/aevia-node/data"
LOG_DIR="${HOME}/.local/share/aevia-node/logs"
UNIT_DIR="${HOME}/.config/systemd/user"
UNIT_FILE="${UNIT_DIR}/aevia-node.service"

mkdir -p "${INSTALL_DIR}" "${CONFIG_DIR}" "${DATA_DIR}" "${LOG_DIR}" "${UNIT_DIR}"

# Backup + install binary.
if [[ -f "${INSTALL_DIR}/aevia-node" ]]; then
  cp "${INSTALL_DIR}/aevia-node" "${INSTALL_DIR}/aevia-node.bak"
fi
install -m 0755 "${BINARY_SRC}" "${INSTALL_DIR}/aevia-node"

# Seed env only when missing. Env lives outside $PATH in a spaceless
# directory so shell expansion stays predictable.
ENV_FILE="${CONFIG_DIR}/env"
if [[ ! -f "${ENV_FILE}" ]]; then
  cat > "${ENV_FILE}" <<ENV
# aevia-node provider-mode config for $(hostname) — home-LAN node.
# Public exposure via Cloudflare Tunnel; local binary binds all IPv4
# interfaces on :4001 (libp2p TCP) and :4002 (libp2p WebSocket).
AEVIA_MODE=provider
AEVIA_LISTEN=/ip4/0.0.0.0/tcp/4001
AEVIA_WS_LISTEN=/ip4/0.0.0.0/tcp/4002/ws
AEVIA_HTTP_ADDR=0.0.0.0:8080
AEVIA_DATA_DIR=${DATA_DIR}
# FORCE_REACHABILITY left empty so libp2p AutoNAT can classify the
# node correctly (home LAN behind CGNAT → private; CF Tunnel handles
# inbound exposure separately via HTTP/WSS reverse proxy).
AEVIA_FORCE_REACHABILITY=
ENV
fi

# Systemd user unit.
cat > "${UNIT_FILE}" <<UNIT
[Unit]
Description=aevia-node (provider, user service)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=${ENV_FILE}
ExecStart=${INSTALL_DIR}/aevia-node
Restart=always
RestartSec=5
StandardOutput=append:${LOG_DIR}/stdout.log
StandardError=append:${LOG_DIR}/stderr.log
# Cap memory so a runaway encode pipeline in Fase 4b can't take the
# host down; 4GB is well above any current workload.
MemoryMax=4G

[Install]
WantedBy=default.target
UNIT

# Reload + enable + start.
systemctl --user daemon-reload
systemctl --user enable aevia-node.service
systemctl --user restart aevia-node.service

sleep 2

echo "--- status ---"
systemctl --user is-active aevia-node || true
echo "--- recent log ---"
tail -n 20 "${LOG_DIR}/stderr.log" 2>/dev/null | grep -E "listening_libp2p|mirror server|pin_store" | head -8 || echo "(no log lines yet — check ${LOG_DIR})"
echo ""
echo "Controls:"
echo "  systemctl --user status  aevia-node"
echo "  systemctl --user restart aevia-node"
echo "  journalctl --user -u aevia-node -f"
echo ""
echo "IMPORTANT: run once as root to survive logout (reboot persistence):"
echo "  sudo loginctl enable-linger \$USER"
