// Package identity manages the persistent cryptographic identity of a node.
//
// A node's Identity is an Ed25519 keypair serialized to disk and reloaded on
// every boot so the libp2p PeerID stays stable across restarts. This stability
// is what allows Provider Nodes to be addressed in the DHT over time.
package identity

import (
	"crypto/rand"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/libp2p/go-libp2p/core/crypto"
)

const filePerm = 0o600

func LoadOrCreate(dir string) (crypto.PrivKey, error) {
	if dir == "" {
		return nil, errors.New("identity: data dir must not be empty")
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("identity: ensure data dir: %w", err)
	}

	path := filepath.Join(dir, "identity.key")
	raw, err := os.ReadFile(path)
	switch {
	case err == nil:
		priv, uerr := crypto.UnmarshalPrivateKey(raw)
		if uerr != nil {
			return nil, fmt.Errorf("identity: parse key at %s: %w", path, uerr)
		}
		return priv, nil
	case errors.Is(err, os.ErrNotExist):
		priv, _, gerr := crypto.GenerateEd25519Key(rand.Reader)
		if gerr != nil {
			return nil, fmt.Errorf("identity: generate key: %w", gerr)
		}
		bytes, merr := crypto.MarshalPrivateKey(priv)
		if merr != nil {
			return nil, fmt.Errorf("identity: marshal key: %w", merr)
		}
		if werr := os.WriteFile(path, bytes, filePerm); werr != nil {
			return nil, fmt.Errorf("identity: write key to %s: %w", path, werr)
		}
		return priv, nil
	default:
		return nil, fmt.Errorf("identity: read key at %s: %w", path, err)
	}
}
