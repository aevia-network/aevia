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
	BootstrapPeers string // comma-separated /p2p-terminated multiaddrs
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
}

type discardWriter struct{}

func (discardWriter) Write(p []byte) (int, error) { return len(p), nil }
