// Package tlsauto integrates certmagic + libdns/cloudflare into the
// provider-node so operators get a trusted Let's Encrypt certificate
// for their public HTTPS endpoint without manual cert management.
//
// The creator only needs:
//
//   - A domain they control (e.g. provider-dev.aevia.network).
//   - A Cloudflare API token with Zone > DNS > Edit scope on that zone.
//
// On boot with these configured, the node:
//
//  1. Registers an ACME account with Let's Encrypt (staging or production)
//  2. Requests a certificate, solving the DNS-01 challenge via the
//     Cloudflare API (temporary TXT record, removed after validation)
//  3. Serves HTTPS on the configured address (default :443)
//  4. Renews the certificate in a background goroutine roughly 30 days
//     before expiry, indefinitely
//
// If config is missing (no domain or no token), TLS is not enabled and
// the node falls back to HTTP-only — which is the sane path for local
// dev and for relays that only need libp2p.
package tlsauto

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/caddyserver/certmagic"
	"github.com/libdns/cloudflare"
)

// Config groups the operator-provided knobs. Values typically come from
// systemd EnvironmentFile or CLI flags parsed in main.
type Config struct {
	// Domain is the single public hostname this node will serve under
	// (e.g. "provider-sp.aevia.network"). One domain per node keeps the
	// ACME accounting tidy; multi-domain support lands later.
	Domain string
	// Email is what Let's Encrypt associates with the ACME account.
	// Operators get renewal-failure notices here.
	Email string
	// CloudflareAPIToken is a Cloudflare-issued API token with
	// Zone > DNS > Edit scope on the zone containing Domain. Used to
	// create and remove the `_acme-challenge.{Domain}` TXT record.
	CloudflareAPIToken string
	// CacheDir is where certmagic persists ACME accounts and issued
	// certificates. Must survive process restarts so renewals work.
	// Defaults to ~/.aevia/provider-node/tls when empty.
	CacheDir string
	// Staging tells certmagic to target LE's staging endpoint
	// (valid only against LE staging roots — certs browsers reject).
	// Flip on during first-boot testing to avoid rate limits.
	Staging bool
}

// Enabled returns true iff Config has the minimum needed to request a
// certificate. Callers use this to decide between HTTPS and HTTP-only.
func (c Config) Enabled() bool {
	return c.Domain != "" && c.CloudflareAPIToken != ""
}

// Manager wraps the certmagic config so main can ask for a TLS config
// and kick off the cert provisioning without touching certmagic types.
type Manager struct {
	cfg    Config
	cm     *certmagic.Config
	domain string
}

// New configures certmagic with the Cloudflare DNS solver and returns a
// Manager ready to obtain the cert. It does NOT block on cert issuance
// — that happens lazily on first TLS handshake, or eagerly via
// EnsureCertificate.
//
// Returns an error only if the config is malformed; missing fields that
// simply disable TLS are reported via Enabled().
func New(cfg Config) (*Manager, error) {
	if !cfg.Enabled() {
		return nil, errors.New("tlsauto: domain and cloudflare api token required")
	}

	cacheDir := cfg.CacheDir
	if cacheDir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			home = "."
		}
		cacheDir = filepath.Join(home, ".aevia", "provider-node", "tls")
	}
	if err := os.MkdirAll(cacheDir, 0o700); err != nil {
		return nil, fmt.Errorf("tlsauto: create cache dir: %w", err)
	}

	cache := certmagic.NewCache(certmagic.CacheOptions{
		GetConfigForCert: func(certmagic.Certificate) (*certmagic.Config, error) {
			return certmagic.NewDefault(), nil
		},
	})
	cm := certmagic.New(cache, certmagic.Config{
		Storage: &certmagic.FileStorage{Path: cacheDir},
	})

	caURL := certmagic.LetsEncryptProductionCA
	if cfg.Staging {
		caURL = certmagic.LetsEncryptStagingCA
	}

	issuer := certmagic.NewACMEIssuer(cm, certmagic.ACMEIssuer{
		CA:     caURL,
		Email:  cfg.Email,
		Agreed: true,
		DNS01Solver: &certmagic.DNS01Solver{
			DNSManager: certmagic.DNSManager{
				DNSProvider: &cloudflare.Provider{APIToken: cfg.CloudflareAPIToken},
			},
		},
	})
	cm.Issuers = []certmagic.Issuer{issuer}

	return &Manager{cfg: cfg, cm: cm, domain: cfg.Domain}, nil
}

// EnsureCertificate provisions the cert synchronously. Safe to call
// repeatedly — certmagic short-circuits when a valid cert is cached.
// Callers typically invoke this at boot to fail fast on misconfigured
// DNS or Cloudflare credentials, rather than discovering the failure
// on the first inbound TLS handshake.
func (m *Manager) EnsureCertificate(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	return m.cm.ManageSync(ctx, []string{m.domain})
}

// TLSConfig returns an *tls.Config tied to the managed cert. Drop it
// straight into http.Server.TLSConfig.
func (m *Manager) TLSConfig() *tls.Config {
	return m.cm.TLSConfig()
}

// Domain is the hostname this manager serves.
func (m *Manager) Domain() string { return m.domain }

// ServeHTTPS blocks serving h on :443 (or the configured address) with
// the managed cert. Cancel ctx or call http.Server.Shutdown to stop.
func (m *Manager) ServeHTTPS(ctx context.Context, addr string, h http.Handler) error {
	if addr == "" {
		addr = ":443"
	}
	tlsCfg := m.TLSConfig()
	// certmagic sets NextProtos to include "acme-tls/1" for TLS-ALPN-01;
	// DNS-01 doesn't use it, but the inclusion is harmless. We keep the
	// config as-is so future dual-solver setups work.
	srv := &http.Server{
		Addr:              addr,
		Handler:           h,
		TLSConfig:         tlsCfg,
		ReadHeaderTimeout: 10 * time.Second,
	}
	errCh := make(chan error, 1)
	go func() { errCh <- srv.ListenAndServeTLS("", "") }()
	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
		return nil
	case err := <-errCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}
