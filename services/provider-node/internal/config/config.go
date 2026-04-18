// Package config centralises the runtime configuration of the Aevia Provider
// Node binary. The same binary serves three distinct roles (relay, provider
// public, provider NAT) and the --mode flag selects the behavior. The mode
// value is authoritative — every subsystem (libp2p setup, DHT bootstrap,
// tracker enablement) keys off of it.
package config

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
)

// Mode is the node role.
type Mode string

const (
	ModeProvider Mode = "provider" // serves HLS, pins content, earns cUSDC
	ModeRelay    Mode = "relay"    // Circuit Relay v2 + DHT bootstrap + WebTorrent tracker; no pinning
)

// Valid returns true iff m is one of the known modes.
func (m Mode) Valid() bool { return m == ModeProvider || m == ModeRelay }

// Config groups all runtime knobs.
type Config struct {
	Mode           Mode
	DataDir        string
	Listen         string // libp2p multiaddr, for example /ip4/0.0.0.0/tcp/4001
	HTTPAddr       string // plain HTTP listen address, used by Provider Público mode
	BootstrapPeers string // comma-separated /p2p-terminated multiaddrs for DHT bootstrap
	RelayPeers     string // comma-separated /p2p-terminated multiaddrs for AutoRelay static relays
	// ForceReachability overrides AutoNAT detection. Empty, "public", or
	// "private". Public is for Relay Nodes on VPS that auto-detection
	// sometimes misclassifies; "private" is for NAT Provider Nodes that
	// want to skip the probing phase.
	ForceReachability string
	// AllowedDIDs is the comma-separated creator allowlist passed to
	// whip.Options.AuthorisedDIDs. Empty disables auth (dev/CI only).
	AllowedDIDs string
	// PublicIPs is the comma-separated list of reachable public IPv4/v6
	// addresses the node lives at from the internet's perspective. On
	// cloud VMs with 1:1 NAT (public IP → private RFC1918 interface),
	// setting this is required so pion's ICE candidates point at the
	// reachable address instead of the private one.
	PublicIPs string
	// TLSDomain is the public hostname the node serves HTTPS under.
	// Empty disables TLS (HTTP-only). Example: "provider-sp.aevia.network".
	TLSDomain string
	// TLSEmail is passed to Let's Encrypt as the ACME account contact.
	TLSEmail string
	// TLSCloudflareAPIToken is a Cloudflare API token with
	// Zone > DNS > Edit scope, used for DNS-01 challenges against
	// TLSDomain's parent zone.
	TLSCloudflareAPIToken string
	// TLSAddr is the listen address for HTTPS traffic. Default ":443".
	TLSAddr string
	// TLSCacheDir is where certmagic persists accounts + issued certs.
	// Default "~/.aevia/provider-node/tls".
	TLSCacheDir string
	// TLSStaging targets LE's staging endpoint — certs browsers reject —
	// to dodge the production rate-limit during first-boot smoke tests.
	TLSStaging bool
}

// Default returns the config the binary boots with when no flags, env vars,
// or YAML are provided.
func Default() Config {
	home, err := os.UserHomeDir()
	dataDir := filepath.Join(".", ".aevia-provider-node")
	if err == nil && home != "" {
		dataDir = filepath.Join(home, ".aevia", "provider-node")
	}
	return Config{
		Mode:     ModeProvider,
		DataDir:  dataDir,
		Listen:   "/ip4/0.0.0.0/tcp/0",
		HTTPAddr: "127.0.0.1:8080",
	}
}

// Parse resolves the effective Config from CLI args. Precedence (highest to
// lowest): flags > environment variables > defaults.
//
// Supported env vars: AEVIA_MODE, AEVIA_DATA_DIR, AEVIA_LISTEN, AEVIA_HTTP_ADDR.
func Parse(args []string) (Config, error) {
	cfg := Default()
	applyEnv(&cfg)

	fs := flag.NewFlagSet("aevia-provider-node", flag.ContinueOnError)
	fs.SetOutput(discardWriter{}) // keep the test output clean on -h
	fs.Var((*modeValue)(&cfg.Mode), "mode", `node mode (provider|relay)`)
	fs.StringVar(&cfg.DataDir, "data-dir", cfg.DataDir, "directory for persistent state (identity key, pinning)")
	fs.StringVar(&cfg.Listen, "listen", cfg.Listen, "libp2p multiaddr to listen on")
	fs.StringVar(&cfg.HTTPAddr, "http-addr", cfg.HTTPAddr, "plain HTTP listen address for Provider Público path")
	fs.StringVar(&cfg.BootstrapPeers, "bootstrap", cfg.BootstrapPeers, "comma-separated /p2p-terminated multiaddrs to bootstrap the DHT from")
	fs.StringVar(&cfg.RelayPeers, "relay-peers", cfg.RelayPeers, "comma-separated /p2p-terminated multiaddrs of Circuit Relay v2 nodes to reserve slots on (for NAT Provider Nodes)")
	fs.StringVar(&cfg.ForceReachability, "force-reachability", cfg.ForceReachability, "override AutoNAT reachability: \"public\", \"private\", or empty")
	fs.StringVar(&cfg.AllowedDIDs, "allowed-dids", cfg.AllowedDIDs, "comma-separated WHIP creator DID allowlist (empty disables auth)")
	fs.StringVar(&cfg.PublicIPs, "public-ips", cfg.PublicIPs, "comma-separated public IPs this node is reachable at (needed for NAT 1:1 ICE)")
	fs.StringVar(&cfg.TLSDomain, "tls-domain", cfg.TLSDomain, "public hostname for auto-HTTPS via Let's Encrypt DNS-01 (empty disables TLS)")
	fs.StringVar(&cfg.TLSEmail, "tls-email", cfg.TLSEmail, "contact email registered with Let's Encrypt")
	fs.StringVar(&cfg.TLSCloudflareAPIToken, "tls-cloudflare-api-token", cfg.TLSCloudflareAPIToken, "Cloudflare API token (Zone:DNS:Edit) for DNS-01 challenges")
	fs.StringVar(&cfg.TLSAddr, "tls-addr", cfg.TLSAddr, "HTTPS listen address (default :443 when --tls-domain is set)")
	fs.StringVar(&cfg.TLSCacheDir, "tls-cache-dir", cfg.TLSCacheDir, "directory where issued TLS certs are cached (default ~/.aevia/provider-node/tls)")
	fs.BoolVar(&cfg.TLSStaging, "tls-staging", cfg.TLSStaging, "use LE staging CA instead of production (for first-boot tests)")
	if err := fs.Parse(args); err != nil {
		return cfg, err
	}
	if !cfg.Mode.Valid() {
		return cfg, fmt.Errorf("config: --mode must be %q or %q, got %q", ModeProvider, ModeRelay, cfg.Mode)
	}
	return cfg, nil
}

type modeValue Mode

func (m *modeValue) String() string { return string(*m) }

func (m *modeValue) Set(s string) error {
	switch Mode(s) {
	case ModeProvider, ModeRelay:
		*m = modeValue(s)
		return nil
	default:
		return fmt.Errorf("invalid mode %q (want provider or relay)", s)
	}
}

func applyEnv(cfg *Config) {
	if v := os.Getenv("AEVIA_MODE"); v != "" {
		cfg.Mode = Mode(v)
	}
	if v := os.Getenv("AEVIA_DATA_DIR"); v != "" {
		cfg.DataDir = v
	}
	if v := os.Getenv("AEVIA_LISTEN"); v != "" {
		cfg.Listen = v
	}
	if v := os.Getenv("AEVIA_HTTP_ADDR"); v != "" {
		cfg.HTTPAddr = v
	}
	if v := os.Getenv("AEVIA_BOOTSTRAP"); v != "" {
		cfg.BootstrapPeers = v
	}
	if v := os.Getenv("AEVIA_RELAY_PEERS"); v != "" {
		cfg.RelayPeers = v
	}
	if v := os.Getenv("AEVIA_FORCE_REACHABILITY"); v != "" {
		cfg.ForceReachability = v
	}
	if v := os.Getenv("AEVIA_ALLOWED_DIDS"); v != "" {
		cfg.AllowedDIDs = v
	}
	if v := os.Getenv("AEVIA_PUBLIC_IPS"); v != "" {
		cfg.PublicIPs = v
	}
	if v := os.Getenv("AEVIA_TLS_DOMAIN"); v != "" {
		cfg.TLSDomain = v
	}
	if v := os.Getenv("AEVIA_TLS_EMAIL"); v != "" {
		cfg.TLSEmail = v
	}
	if v := os.Getenv("AEVIA_CF_API_TOKEN"); v != "" {
		cfg.TLSCloudflareAPIToken = v
	}
	if v := os.Getenv("AEVIA_TLS_ADDR"); v != "" {
		cfg.TLSAddr = v
	}
	if v := os.Getenv("AEVIA_TLS_CACHE_DIR"); v != "" {
		cfg.TLSCacheDir = v
	}
	if v := os.Getenv("AEVIA_TLS_STAGING"); v == "1" || v == "true" {
		cfg.TLSStaging = true
	}
}

type discardWriter struct{}

func (discardWriter) Write(p []byte) (int, error) { return len(p), nil }
