package por

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/libp2p/go-libp2p/core/peer"
)

// HandlerRegistrar is the minimum surface to attach the /ack handler to a
// mux. Matches *http.ServeMux.HandleFunc exactly.
type HandlerRegistrar interface {
	HandleFunc(pattern string, handler func(http.ResponseWriter, *http.Request))
}

// AckServer handles POST /ack — a viewer submits a signed Receipt, the
// server validates the viewer sig, co-signs with the provider's identity
// key, persists to the ReceiptStore, and returns the fully-signed receipt
// so the viewer has a proof they contributed.
type AckServer struct {
	providerPriv crypto.PrivKey
	providerPID  string
	store        *ReceiptStore
}

// NewAckServer derives the provider PeerID from priv so callers can't
// accidentally configure a mismatched identity.
func NewAckServer(priv crypto.PrivKey, store *ReceiptStore) (*AckServer, error) {
	if priv == nil {
		return nil, fmt.Errorf("por: priv key is required")
	}
	if store == nil {
		return nil, fmt.Errorf("por: receipt store is required")
	}
	pid, err := peer.IDFromPublicKey(priv.GetPublic())
	if err != nil {
		return nil, fmt.Errorf("por: derive peer id: %w", err)
	}
	return &AckServer{providerPriv: priv, providerPID: pid.String(), store: store}, nil
}

// Register wires the /ack handler into r.
func (s *AckServer) Register(r HandlerRegistrar) {
	r.HandleFunc("POST /ack", s.handle)
}

func (s *AckServer) handle(w http.ResponseWriter, r *http.Request) {
	var receipt Receipt
	if err := json.NewDecoder(r.Body).Decode(&receipt); err != nil {
		http.Error(w, "decode: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Receipt must be addressed to THIS provider — otherwise the client is
	// trying to launder bytes through us for someone else.
	if receipt.ProviderPeerID != s.providerPID {
		http.Error(w, "receipt is not addressed to this provider", http.StatusBadRequest)
		return
	}
	if err := receipt.VerifyViewerSig(); err != nil {
		http.Error(w, "viewer sig: "+err.Error(), http.StatusBadRequest)
		return
	}
	if err := receipt.SignAsProvider(s.providerPriv); err != nil {
		http.Error(w, "provider sign: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if err := s.store.Put(&receipt); err != nil {
		http.Error(w, "store: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(&receipt); err != nil {
		// headers already sent; just log via best-effort write
		return
	}
}
