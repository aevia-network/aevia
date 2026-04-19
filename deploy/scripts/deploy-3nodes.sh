#!/usr/bin/env bash
# deploy-3nodes.sh — roll out the locally-built aevia-node binaries
# to Relay 1 (Lambda Labs, Ubuntu ARM), Relay 2 (ReliableSite, Ubuntu
# AMD64) and the Mac provider. Each target gets its arch-appropriate
# build, a keep-old-as-backup swap, and a restart. Nodes are upgraded
# sequentially so a broken build can't take the whole mesh down at
# once.
#
# Prerequisites:
#   - Binaries already built via deploy/scripts/build-all.sh — this
#     script does NOT rebuild.
#   - SSH keys loaded for both relay hosts (your ~/.ssh/config or
#     default id_ed25519 works; first-time connections trust
#     `accept-new` host key policy).
#   - macOS user has permission to write to ~/Library/LaunchAgents
#     and ~/.local/bin.
#
# Rollback: each binary is kept as /usr/local/bin/aevia-node.bak on the
# relays and ~/.local/bin/aevia-node.bak on the Mac. To revert any
# single node, mv the .bak back over aevia-node and restart.

set -euo pipefail

# ───────────────────────────────────────────── configuration ──

RELAY1_USER="ubuntu"
RELAY1_HOST="192.222.50.16"

RELAY2_USER="leandro"
RELAY2_HOST="45.126.209.192"

MAC_BIN_DIR="${HOME}/.local/bin"
MAC_ENV_DIR="${HOME}/Library/Application Support/aevia-node"
MAC_PLIST="${HOME}/Library/LaunchAgents/network.aevia.node.plist"
MAC_LABEL="network.aevia.node"
MAC_LOG_DIR="${HOME}/Library/Logs/aevia-node"

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
BIN_DIR="${REPO_ROOT}/deploy/bin"

BIN_ARM64="${BIN_DIR}/aevia-node-linux-arm64"
BIN_AMD64="${BIN_DIR}/aevia-node-linux-amd64"
BIN_DARWIN="${BIN_DIR}/aevia-node-darwin-arm64"

# ──────────────────────────────────────────────── preflight ──

say() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
ok() { printf '   \033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '   \033[1;33m!\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31m✗\033[0m %s\n\n' "$*" >&2; exit 1; }

for f in "${BIN_ARM64}" "${BIN_AMD64}" "${BIN_DARWIN}"; do
  [[ -f "${f}" ]] || die "Missing binary: ${f} (run deploy/scripts/build-all.sh first)"
done
ok "binaries present"

# ────────────────────────────────────────────────── Relay 1 ──
# ARM64, Lambda Labs US-VA, root or ubuntu. systemd unit name
# assumed `aevia-node` (per deploy/systemd/install.sh convention).

say "Relay 1 — ${RELAY1_USER}@${RELAY1_HOST} (linux/arm64)"

scp -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 \
  "${BIN_ARM64}" "${RELAY1_USER}@${RELAY1_HOST}:/tmp/aevia-node.new"
ok "scp complete"

ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 \
  "${RELAY1_USER}@${RELAY1_HOST}" bash -se <<'REMOTE_R1'
set -euo pipefail
if [[ -f /usr/local/bin/aevia-node ]]; then
  sudo cp /usr/local/bin/aevia-node /usr/local/bin/aevia-node.bak
fi
sudo install -m 0755 /tmp/aevia-node.new /usr/local/bin/aevia-node
rm -f /tmp/aevia-node.new
sudo systemctl restart aevia-node
sleep 2
echo "--- journal (last 15 lines) ---"
sudo journalctl -u aevia-node -n 15 --no-pager
echo "--- status ---"
systemctl is-active aevia-node
REMOTE_R1

ok "Relay 1 restarted — waiting 3s for libp2p listen"
sleep 3

# Health check.
if curl -s --max-time 5 "https://provider.aevia.network/healthz" | grep -q '"status"'; then
  ok "Relay 1 /healthz responded"
else
  warn "Relay 1 /healthz check failed — investigate before proceeding"
  read -r -p "Continue anyway? [y/N] " ans
  [[ "${ans:-N}" == "y" ]] || die "aborted by operator"
fi

# ────────────────────────────────────────────────── Relay 2 ──
# AMD64, ReliableSite, leandro user, CF Tunnel fronts the HTTP/libp2p
# ports. Same systemd unit name. Kept sequential to Relay 1 so a
# broken binary on Relay 1 has already surfaced.

say "Relay 2 — ${RELAY2_USER}@${RELAY2_HOST} (linux/amd64)"

scp -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 \
  "${BIN_AMD64}" "${RELAY2_USER}@${RELAY2_HOST}:/tmp/aevia-node.new"
ok "scp complete"

ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 \
  "${RELAY2_USER}@${RELAY2_HOST}" bash -se <<'REMOTE_R2'
set -euo pipefail
if [[ -f /usr/local/bin/aevia-node ]]; then
  sudo cp /usr/local/bin/aevia-node /usr/local/bin/aevia-node.bak
fi
sudo install -m 0755 /tmp/aevia-node.new /usr/local/bin/aevia-node
rm -f /tmp/aevia-node.new
sudo systemctl restart aevia-node
sleep 2
echo "--- journal (last 15 lines) ---"
sudo journalctl -u aevia-node -n 15 --no-pager
echo "--- status ---"
systemctl is-active aevia-node
REMOTE_R2

ok "Relay 2 restarted — waiting 3s for libp2p listen"
sleep 3

if curl -s --max-time 5 "https://provider-fl.aevia.network/healthz" | grep -q '"status"'; then
  ok "Relay 2 /healthz responded"
else
  warn "Relay 2 /healthz check failed — investigate before proceeding"
  read -r -p "Continue anyway? [y/N] " ans
  [[ "${ans:-N}" == "y" ]] || die "aborted by operator"
fi

# ───────────────────────────────────────────── Mac (launchd) ──
# First run: install binary to ~/.local/bin, create a LaunchAgent
# plist that runs on login + auto-restarts on crash, and load it.
# Subsequent runs: replace binary, unload/reload so the new binary
# actually becomes the running process (launchd caches the path).
#
# Env lives at ~/Library/Application Support/aevia-node/env — same
# KEY=VALUE format as the Linux deploy/systemd/env.example. If the
# file doesn't exist, we bootstrap it from the example and warn the
# operator to edit it before first start.

say "Mac — launchd LaunchAgent at ${MAC_PLIST}"

mkdir -p "${MAC_BIN_DIR}" "${MAC_ENV_DIR}" "${MAC_LOG_DIR}"
if [[ -f "${MAC_BIN_DIR}/aevia-node" ]]; then
  cp "${MAC_BIN_DIR}/aevia-node" "${MAC_BIN_DIR}/aevia-node.bak"
fi
install -m 0755 "${BIN_DARWIN}" "${MAC_BIN_DIR}/aevia-node"
ok "binary installed to ${MAC_BIN_DIR}/aevia-node"

ENV_FILE="${MAC_ENV_DIR}/env"
if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${REPO_ROOT}/deploy/systemd/env.example" "${ENV_FILE}"
  warn "Seeded ${ENV_FILE} from env.example — EDIT before relying on this node"
else
  ok "env preserved at ${ENV_FILE}"
fi

# launchd reads env as KEY=VALUE pairs. Our plist sources a wrapper
# script that execs the binary with the env file loaded via `set -a`.
# Writing a wrapper instead of inlining every KEY in <EnvironmentVariables>
# makes env changes a plain file edit + `launchctl kickstart -k`.
WRAPPER="${MAC_BIN_DIR}/aevia-node-run"
cat > "${WRAPPER}" <<WRAPPER_SH
#!/usr/bin/env bash
set -euo pipefail
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi
exec "${MAC_BIN_DIR}/aevia-node"
WRAPPER_SH
chmod +x "${WRAPPER}"
ok "wrapper installed at ${WRAPPER}"

# plist: KeepAlive true → restart on any exit. RunAtLoad true →
# start immediately when `launchctl load` happens + on every login.
# Nice 5 → lightly deprioritised so UI stays responsive under load.
cat > "${MAC_PLIST}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${MAC_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${WRAPPER}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <key>Nice</key><integer>5</integer>
  <key>StandardOutPath</key><string>${MAC_LOG_DIR}/stdout.log</string>
  <key>StandardErrorPath</key><string>${MAC_LOG_DIR}/stderr.log</string>
  <key>WorkingDirectory</key><string>${HOME}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
  </dict>
</dict>
</plist>
PLIST
ok "plist written to ${MAC_PLIST}"

# If already loaded, kick it so the new binary takes effect.
if launchctl list "${MAC_LABEL}" >/dev/null 2>&1; then
  launchctl unload "${MAC_PLIST}" || true
  sleep 1
fi
launchctl load "${MAC_PLIST}"
sleep 2

# Verify the agent is running.
if launchctl list "${MAC_LABEL}" | grep -q '"PID" ='; then
  PID=$(launchctl list "${MAC_LABEL}" | awk -F' = ' '/"PID"/ {print $2}' | tr -d ';')
  ok "Mac aevia-node running as PID ${PID}"
else
  warn "LaunchAgent is loaded but not running — check ${MAC_LOG_DIR}/stderr.log"
  tail -n 30 "${MAC_LOG_DIR}/stderr.log" 2>/dev/null || true
fi

# ───────────────────────────────────────── post-deploy summary ──

say "Post-deploy validation"

echo "  Relay 1  https://provider.aevia.network/healthz"
curl -s --max-time 5 "https://provider.aevia.network/healthz" | head -c 200; echo

echo "  Relay 2  https://provider-fl.aevia.network/healthz"
curl -s --max-time 5 "https://provider-fl.aevia.network/healthz" | head -c 200; echo

echo "  Mac      (local process)"
if launchctl list "${MAC_LABEL}" | grep -q '"PID" ='; then
  echo "  PID $(launchctl list "${MAC_LABEL}" | awk -F' = ' '/"PID"/ {print $2}' | tr -d ';')"
else
  echo "  not running — tail stderr.log"
fi

cat <<DONE

Deploy complete. Daily controls:

  Mac:
    launchctl kickstart -k gui/$(id -u)/${MAC_LABEL}   # restart
    launchctl unload ${MAC_PLIST}                      # stop
    launchctl load   ${MAC_PLIST}                      # start
    tail -f ${MAC_LOG_DIR}/stdout.log                  # logs

  Relay 1:
    ssh ${RELAY1_USER}@${RELAY1_HOST} sudo systemctl restart aevia-node

  Relay 2:
    ssh ${RELAY2_USER}@${RELAY2_HOST} sudo systemctl restart aevia-node

Rollback for any node: move .bak over the active binary + restart.
DONE
