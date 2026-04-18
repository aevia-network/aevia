package por

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/libp2p/go-libp2p/core/peer"
)

// IssuerOptions configure the viewer-side receipt flow.
type IssuerOptions struct {
	// HTTPClient is the transport used to POST /ack. Typically an
	// http.Client with a p2phttp.RoundTripper so /ack travels over
	// libp2p, just like the segment fetch itself.
	HTTPClient *http.Client

	// NonceSource returns a fresh monotonic counter per receipt. Defaults
	// to unix-nano if nil.
	NonceSource func() uint64

	// NowUnix lets tests freeze time. Defaults to time.Now().Unix().
	NowUnix func() int64
}

// Issuer builds and dispatches viewer-side receipts.
type Issuer struct {
	viewerPriv crypto.PrivKey
	viewerPID  string
	opts       IssuerOptions
}

// NewIssuer binds a viewer key + network transport into an Issuer.
func NewIssuer(viewerPriv crypto.PrivKey, opts IssuerOptions) (*Issuer, error) {
	if viewerPriv == nil {
		return nil, fmt.Errorf("por: viewer priv key is required")
	}
	if opts.HTTPClient == nil {
		return nil, fmt.Errorf("por: opts.HTTPClient is required")
	}
	if opts.NonceSource == nil {
		opts.NonceSource = defaultNonce
	}
	if opts.NowUnix == nil {
		opts.NowUnix = func() int64 { return time.Now().Unix() }
	}
	pid, err := peer.IDFromPublicKey(viewerPriv.GetPublic())
	if err != nil {
		return nil, err
	}
	return &Issuer{viewerPriv: viewerPriv, viewerPID: pid.String(), opts: opts}, nil
}

// Issue builds a receipt for (provider, cid, segmentIndex, size), signs it
// as viewer, and POSTs it to the provider's /ack endpoint. Returns the
// fully-signed receipt the server returned.
func (i *Issuer) Issue(ctx context.Context, providerPID peer.ID, cid string, segmentIndex, segmentSize int) (*Receipt, error) {
	r := &Receipt{
		ProviderPeerID: providerPID.String(),
		ViewerPeerID:   i.viewerPID,
		CID:            cid,
		SegmentIndex:   segmentIndex,
		SegmentSize:    segmentSize,
		TimestampUnix:  i.opts.NowUnix(),
		Nonce:          i.opts.NonceSource(),
	}
	if err := r.SignAsViewer(i.viewerPriv); err != nil {
		return nil, err
	}

	body, err := json.Marshal(r)
	if err != nil {
		return nil, fmt.Errorf("por: marshal receipt: %w", err)
	}
	url := "libp2p://" + providerPID.String() + "/ack"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := i.opts.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("por: POST /ack: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("por: /ack returned %d: %s", resp.StatusCode, raw)
	}
	var signed Receipt
	if err := json.NewDecoder(resp.Body).Decode(&signed); err != nil {
		return nil, fmt.Errorf("por: decode /ack response: %w", err)
	}
	// Belt-and-suspenders: make sure the server really co-signed and the
	// field tuple we just sent is what it signed.
	if err := signed.VerifyBoth(); err != nil {
		return nil, fmt.Errorf("por: /ack response failed verification: %w", err)
	}
	return &signed, nil
}

func defaultNonce() uint64 { return uint64(time.Now().UnixNano()) }
