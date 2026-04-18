package httpx

import (
	"encoding/json"
	"net/http"
	"strconv"
)

// DefaultMirrorLimit is the /mirrors/candidates default `limit` when
// the query parameter is absent. Spec §6.1 picks 3 — three-way mirror
// fan-out provides redundancy without quadratic bandwidth.
const DefaultMirrorLimit = 3

// MaxMirrorLimit caps the response size so a curious viewer can't
// force the node to score a massive pool. Spec §6.1 uses 10.
const MaxMirrorLimit = 10

// mirrorsCandidatesResponse is the wire shape of GET /mirrors/candidates.
// Marshalled directly — fields align with spec §6.3.
type mirrorsCandidatesResponse struct {
	ViewerRegion string                    `json:"viewer_region,omitempty"`
	OriginRegion string                    `json:"origin_region,omitempty"`
	Limit        int                       `json:"limit"`
	Candidates   []mirrorsCandidateEntry   `json:"candidates"`
}

type mirrorsCandidateEntry struct {
	PeerID         string  `json:"peer_id"`
	HTTPSBase      string  `json:"https_base,omitempty"`
	Region         string  `json:"region,omitempty"`
	Lat            float64 `json:"lat,omitempty"`
	Lng            float64 `json:"lng,omitempty"`
	RTTEMAMs       float64 `json:"rtt_ema_ms"`
	ActiveSessions int     `json:"active_sessions"`
	Score          float64 `json:"score"`
	RTTTerm        float64 `json:"rtt_term"`
	LoadTerm       float64 `json:"load_term"`
	RegionTerm     float64 `json:"region_term"`
	RTTSource      string  `json:"rtt_source"`
	ProbeLossPct   float64 `json:"probe_loss_pct"`
}

func (s *Server) handleMirrorCandidates(w http.ResponseWriter, r *http.Request) {
	if s.mirrorRanker == nil {
		// 501 signals "feature present on this binary but not wired by
		// this operator" — distinct from 404 which would mean "no such
		// route". Client code can branch on the difference.
		http.Error(w, "mirrors: ranker not wired", http.StatusNotImplemented)
		return
	}

	viewerRegion := r.URL.Query().Get("viewer_region")
	if viewerRegion == "" {
		viewerRegion = s.region // fallback: use origin's own region
	}

	limit := DefaultMirrorLimit
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			limit = n
		}
	}
	if limit > MaxMirrorLimit {
		limit = MaxMirrorLimit
	}

	candidates := s.mirrorRanker.CandidateSnapshot()
	scored := s.mirrorRanker.Score(candidates, viewerRegion)

	if len(scored) > limit {
		scored = scored[:limit]
	}

	entries := make([]mirrorsCandidateEntry, 0, len(scored))
	for _, sc := range scored {
		entries = append(entries, mirrorsCandidateEntry{
			PeerID:         sc.PeerID,
			HTTPSBase:      sc.HTTPSBase,
			Region:         sc.Region,
			Lat:            sc.Lat,
			Lng:            sc.Lng,
			RTTEMAMs:       sc.RTTEMAMs,
			ActiveSessions: sc.ActiveSessions,
			Score:          sc.Score,
			RTTTerm:        sc.RTTTerm,
			LoadTerm:       sc.LoadTerm,
			RegionTerm:     sc.RegionTerm,
			RTTSource:      sc.RTTSource,
			ProbeLossPct:   sc.ProbeLossPct,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(mirrorsCandidatesResponse{
		ViewerRegion: viewerRegion,
		OriginRegion: s.region,
		Limit:        limit,
		Candidates:   entries,
	})
}
