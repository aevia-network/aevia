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
	"strconv"
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
	// MirrorPeers is the comma-separated list of libp2p peer IDs (bare
	// peer.ID strings, NOT multiaddrs) to which this origin replicates
	// every WHIP session's RTP stream (Fase 2.1). Empty disables the
	// mirror client — the node stays single-origin. Peers MUST be
	// reachable via the same libp2p host (bootstrap peers or existing
	// connections). Self-references are silently skipped.
	MirrorPeers string
	// WebSocketListen (Fase 3.1) enables a libp2p WebSocket listener
	// so browsers running js-libp2p can dial this node. Empty disables.
	// Typical dev: /ip4/127.0.0.1/tcp/4002/ws ; production lives behind
	// a reverse proxy (Caddy / Cloudflare Tunnel) that terminates TLS
	// and forwards the HTTP Upgrade frame.
	WebSocketListen string
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
	// RequireSignatures forces every POST /whip to carry a valid
	// X-Aevia-Signature header (EIP-191 sign of the raw SDP offer bytes).
	// The server recovers the signer address and matches it against the
	// address encoded in X-Aevia-DID. Default false for dev/testnet —
	// production provider-nodes MUST enable this.
	RequireSignatures bool
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
	// Region is an opaque hierarchical string (e.g. "BR-SP", "EU-DE",
	// "NA-US-CA") that /healthz publishes. Viewers in apps/video use
	// it to rank providers by geographic proximity via prefix match
	// (BR-* matches any BR-*). Empty leaves the field unset.
	Region string
	// GeoLat / GeoLng are the node's approximate coordinates in
	// decimal degrees (±90 / ±180). Present together or omitted
	// together. When set, viewers with their own geo rank providers
	// by great-circle distance, falling back to region prefix match.
	GeoLat float64
	GeoLng float64
	// GeoSet is true when GeoLat/GeoLng were explicitly configured.
	// This avoids ambiguity between "coordinate 0,0 (Null Island)"
	// and "unset" which both deserialise to zero-valued floats.
	GeoSet bool

	// MirrorRankAlpha / Beta / Gamma (Fase 2.2e) override the default
	// scoring weights for mirror selection. Zero = use mirror.DefaultWeights.
	// Spec §5.2.2 defaults: α=1.0 (1ms RTT = 1 score), β=10.0 (per-session
	// load), γ=50.0 (region_penalty scale). Tuning knobs for experiments
	// without rebuilding.
	MirrorRankAlpha float64
	MirrorRankBeta  float64
	MirrorRankGamma float64
	// MirrorFanoutK is the per-session top-K mirror pick count. Zero
	// defaults to 3. Capped at 10 server-side by /mirrors/candidates to
	// bound response size, but selection itself honours higher values.
	MirrorFanoutK int
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
	fs.StringVar(&cfg.MirrorPeers, "mirror-peers", cfg.MirrorPeers, "comma-separated libp2p peer IDs to mirror every WHIP session's RTP stream to (empty OR \"AUTO\" enables dynamic selection)")
	fs.StringVar(&cfg.WebSocketListen, "ws-listen", cfg.WebSocketListen, "libp2p WebSocket listen multiaddr for browser peers (Fase 3.1, empty disables; example /ip4/127.0.0.1/tcp/4002/ws)")
	fs.Float64Var(&cfg.MirrorRankAlpha, "mirror-rank-alpha", cfg.MirrorRankAlpha, "mirror rank weight — RTT multiplier (default 1.0)")
	fs.Float64Var(&cfg.MirrorRankBeta, "mirror-rank-beta", cfg.MirrorRankBeta, "mirror rank weight — load multiplier (default 10.0)")
	fs.Float64Var(&cfg.MirrorRankGamma, "mirror-rank-gamma", cfg.MirrorRankGamma, "mirror rank weight — region_penalty multiplier (default 50.0)")
	fs.IntVar(&cfg.MirrorFanoutK, "mirror-fanout-k", cfg.MirrorFanoutK, "mirror fanout top-K pick count per session (default 3)")
	fs.StringVar(&cfg.ForceReachability, "force-reachability", cfg.ForceReachability, "override AutoNAT reachability: \"public\", \"private\", or empty")
	fs.StringVar(&cfg.AllowedDIDs, "allowed-dids", cfg.AllowedDIDs, "comma-separated WHIP creator DID allowlist (empty disables auth)")
	fs.StringVar(&cfg.PublicIPs, "public-ips", cfg.PublicIPs, "comma-separated public IPs this node is reachable at (needed for NAT 1:1 ICE)")
	fs.BoolVar(&cfg.RequireSignatures, "require-signatures", cfg.RequireSignatures, "require EIP-191 X-Aevia-Signature on every POST /whip")
	fs.StringVar(&cfg.TLSDomain, "tls-domain", cfg.TLSDomain, "public hostname for auto-HTTPS via Let's Encrypt DNS-01 (empty disables TLS)")
	fs.StringVar(&cfg.TLSEmail, "tls-email", cfg.TLSEmail, "contact email registered with Let's Encrypt")
	fs.StringVar(&cfg.TLSCloudflareAPIToken, "tls-cloudflare-api-token", cfg.TLSCloudflareAPIToken, "Cloudflare API token (Zone:DNS:Edit) for DNS-01 challenges")
	fs.StringVar(&cfg.TLSAddr, "tls-addr", cfg.TLSAddr, "HTTPS listen address (default :443 when --tls-domain is set)")
	fs.StringVar(&cfg.TLSCacheDir, "tls-cache-dir", cfg.TLSCacheDir, "directory where issued TLS certs are cached (default ~/.aevia/provider-node/tls)")
	fs.BoolVar(&cfg.TLSStaging, "tls-staging", cfg.TLSStaging, "use LE staging CA instead of production (for first-boot tests)")
	fs.StringVar(&cfg.Region, "region", cfg.Region, "geo region hint published on /healthz (e.g. BR-SP, EU-DE)")
	latFlag := fs.Float64("geo-lat", 0, "latitude in decimal degrees (set together with --geo-lng)")
	lngFlag := fs.Float64("geo-lng", 0, "longitude in decimal degrees (set together with --geo-lat)")
	if err := fs.Parse(args); err != nil {
		return cfg, err
	}
	// Detect whether --geo-lat / --geo-lng were actually provided
	// (vs the default zero). Either both or neither must be set.
	latProvided, lngProvided := false, false
	fs.Visit(func(f *flag.Flag) {
		switch f.Name {
		case "geo-lat":
			latProvided = true
		case "geo-lng":
			lngProvided = true
		}
	})
	if latProvided != lngProvided {
		return cfg, fmt.Errorf("config: --geo-lat and --geo-lng must be set together")
	}
	if latProvided {
		cfg.GeoLat = *latFlag
		cfg.GeoLng = *lngFlag
		cfg.GeoSet = true
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
	if v := os.Getenv("AEVIA_MIRROR_PEERS"); v != "" {
		cfg.MirrorPeers = v
	}
	if v := os.Getenv("AEVIA_WS_LISTEN"); v != "" {
		cfg.WebSocketListen = v
	}
	if v := os.Getenv("AEVIA_MIRROR_RANK_ALPHA"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			cfg.MirrorRankAlpha = f
		}
	}
	if v := os.Getenv("AEVIA_MIRROR_RANK_BETA"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			cfg.MirrorRankBeta = f
		}
	}
	if v := os.Getenv("AEVIA_MIRROR_RANK_GAMMA"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			cfg.MirrorRankGamma = f
		}
	}
	if v := os.Getenv("AEVIA_MIRROR_FANOUT_K"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			cfg.MirrorFanoutK = n
		}
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
	if v := os.Getenv("AEVIA_REQUIRE_SIGNATURES"); v == "1" || v == "true" {
		cfg.RequireSignatures = true
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
	if v := os.Getenv("AEVIA_REGION"); v != "" {
		cfg.Region = v
	}
	lat := os.Getenv("AEVIA_GEO_LAT")
	lng := os.Getenv("AEVIA_GEO_LNG")
	if lat != "" && lng != "" {
		if lv, err := strconvParseFloat(lat); err == nil {
			if gv, err2 := strconvParseFloat(lng); err2 == nil {
				cfg.GeoLat = lv
				cfg.GeoLng = gv
				cfg.GeoSet = true
			}
		}
	}
}

// strconvParseFloat predates the top-level strconv import (Fase 2.2e);
// kept as a thin wrapper because fmt.Sscanf matches the "%g" style
// the geo env parser uses. New parsers should call strconv.ParseFloat
// directly.
func strconvParseFloat(s string) (float64, error) {
	return strconv.ParseFloat(s, 64)
}

type discardWriter struct{}

func (discardWriter) Write(p []byte) (int, error) { return len(p), nil }
