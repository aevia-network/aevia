package config_test

import (
	"strings"
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/config"
)

func TestDefaultHasProviderMode(t *testing.T) {
	cfg := config.Default()
	if cfg.Mode != config.ModeProvider {
		t.Fatalf("default mode = %q, want %q", cfg.Mode, config.ModeProvider)
	}
	if cfg.Listen == "" {
		t.Fatal("default Listen is empty")
	}
	if cfg.HTTPAddr == "" {
		t.Fatal("default HTTPAddr is empty")
	}
	if cfg.DataDir == "" {
		t.Fatal("default DataDir is empty")
	}
}

func TestParseNoArgsReturnsDefaults(t *testing.T) {
	t.Setenv("AEVIA_MODE", "")
	t.Setenv("AEVIA_DATA_DIR", "")
	t.Setenv("AEVIA_LISTEN", "")
	t.Setenv("AEVIA_HTTP_ADDR", "")

	cfg, err := config.Parse(nil)
	if err != nil {
		t.Fatalf("Parse(nil): %v", err)
	}
	def := config.Default()
	if cfg.Mode != def.Mode || cfg.Listen != def.Listen || cfg.HTTPAddr != def.HTTPAddr {
		t.Fatalf("Parse(nil) = %+v, want %+v", cfg, def)
	}
}

func TestParseFlagsOverrideDefaults(t *testing.T) {
	t.Setenv("AEVIA_MODE", "")
	t.Setenv("AEVIA_DATA_DIR", "")

	cfg, err := config.Parse([]string{
		"-mode", "relay",
		"-data-dir", "/tmp/aevia-x",
		"-listen", "/ip4/127.0.0.1/tcp/9000",
		"-http-addr", "0.0.0.0:8081",
	})
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if cfg.Mode != config.ModeRelay {
		t.Errorf("Mode = %q, want relay", cfg.Mode)
	}
	if cfg.DataDir != "/tmp/aevia-x" {
		t.Errorf("DataDir = %q, want /tmp/aevia-x", cfg.DataDir)
	}
	if cfg.Listen != "/ip4/127.0.0.1/tcp/9000" {
		t.Errorf("Listen = %q", cfg.Listen)
	}
	if cfg.HTTPAddr != "0.0.0.0:8081" {
		t.Errorf("HTTPAddr = %q", cfg.HTTPAddr)
	}
}

func TestParseEnvAppliesWhenFlagAbsent(t *testing.T) {
	t.Setenv("AEVIA_MODE", "relay")
	t.Setenv("AEVIA_HTTP_ADDR", "10.0.0.5:9999")

	cfg, err := config.Parse(nil)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if cfg.Mode != config.ModeRelay {
		t.Errorf("Mode = %q, want relay (from env)", cfg.Mode)
	}
	if cfg.HTTPAddr != "10.0.0.5:9999" {
		t.Errorf("HTTPAddr = %q, want 10.0.0.5:9999 (from env)", cfg.HTTPAddr)
	}
}

func TestParseFlagOverridesEnv(t *testing.T) {
	t.Setenv("AEVIA_MODE", "relay")

	cfg, err := config.Parse([]string{"-mode", "provider"})
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if cfg.Mode != config.ModeProvider {
		t.Fatalf("flag did not override env: Mode = %q", cfg.Mode)
	}
}

func TestParseRejectsInvalidMode(t *testing.T) {
	t.Setenv("AEVIA_MODE", "")
	_, err := config.Parse([]string{"-mode", "bogus"})
	if err == nil {
		t.Fatal("Parse(-mode=bogus) returned nil error")
	}
	if !strings.Contains(err.Error(), "invalid mode") && !strings.Contains(err.Error(), "bogus") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestParseRejectsInvalidModeFromEnv(t *testing.T) {
	t.Setenv("AEVIA_MODE", "nonsense")
	_, err := config.Parse(nil)
	if err == nil {
		t.Fatal("Parse with bogus env mode returned nil error")
	}
}
