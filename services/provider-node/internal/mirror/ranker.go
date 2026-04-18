package mirror

import (
	"math"
	"sort"
	"strings"
	"time"
)

// Candidate is the per-peer snapshot the Ranker scores. All fields are
// optional except PeerID + HTTPSBase — a candidate we only know by
// PeerID but haven't probed yet gets RTT == 0 and receives the
// Haversine bootstrap proxy treatment (spec §5.1).
type Candidate struct {
	PeerID         string
	HTTPSBase      string
	Region         string  // ISO 3166-2 like "BR-SP"; empty when unknown
	Lat            float64 // 0 when unknown
	Lng            float64 // 0 when unknown
	LatLngKnown    bool
	RTTEMA         time.Duration // HopMetrics.EchoEMA(); 0 = cold start
	ActiveSessions int           // /healthz extension
	ProbeLossPct   float64       // 0..100 — future telemetry hook
}

// ViewerHint carries the optional creator-declared audience geography.
// When empty, the Ranker falls back to origin's own region/coordinates.
type ViewerHint struct {
	Region string
	Lat    float64
	Lng    float64
}

// RankerWeights governs the score formula (spec §5.2). Exposed so
// operators can tune via env vars without recompiling. Zero values
// trigger defaults on Rank() invocation.
type RankerWeights struct {
	// Alpha scales RTT ms. Default 1.0 — score units become "ms-equivalent".
	Alpha float64
	// Beta scales per-active-session. Default 10.0 — penalises busy mirrors.
	Beta float64
	// Gamma scales the region_penalty term. Default 50.0 — a cross-continent
	// peer needs to be ~50 ms faster on RTT than a same-region peer to win.
	Gamma float64
}

// DefaultWeights returns the production-tuned α/β/γ (spec §5.2.2).
func DefaultWeights() RankerWeights {
	return RankerWeights{Alpha: 1.0, Beta: 10.0, Gamma: 50.0}
}

// Ranker is a stateless scorer. A single instance per provider-node
// is enough. Callers typically use `NewRanker` (defaults) and pass it
// to the HTTP handler factory.
type Ranker struct {
	w RankerWeights
	// originRegion + originLat/Lng are the fallback viewer reference
	// when the creator doesn't supply a hint. Set at construction from
	// the node's own /healthz data.
	originRegion string
	originLat    float64
	originLng    float64
	originKnown  bool
}

// NewRanker builds a Ranker with the given weights. Pass zero-value
// weights to get DefaultWeights.
func NewRanker(w RankerWeights, originRegion string, originLat, originLng float64, originGeoKnown bool) *Ranker {
	if w.Alpha == 0 && w.Beta == 0 && w.Gamma == 0 {
		w = DefaultWeights()
	}
	return &Ranker{
		w:            w,
		originRegion: originRegion,
		originLat:    originLat,
		originLng:    originLng,
		originKnown:  originGeoKnown,
	}
}

// ScoredCandidate is a Candidate annotated with its computed score.
// Emitted in order by Rank, lower is better.
type ScoredCandidate struct {
	Candidate
	Score         float64
	RTTTerm       float64
	LoadTerm      float64
	RegionTerm    float64
	RTTSource     string // "echo" or "haversine-bootstrap"
}

// Rank returns candidates sorted ascending by score. The hint MAY be
// empty — the Ranker substitutes the origin's own region as fallback
// so self-hosted creators still get sensible selection.
//
// The returned slice is a new allocation; callers MAY modify it freely.
// Stable tie-break: lower PeerID byte-lex wins (spec §5.3 invariant,
// prevents two origins thrashing between equal-scored pairs).
func (r *Ranker) Rank(cs []Candidate, hint ViewerHint) []ScoredCandidate {
	effRegion := hint.Region
	effLat, effLng := hint.Lat, hint.Lng
	hintGeoKnown := hint.Lat != 0 || hint.Lng != 0
	if effRegion == "" {
		effRegion = r.originRegion
	}
	if !hintGeoKnown && r.originKnown {
		effLat, effLng = r.originLat, r.originLng
		hintGeoKnown = true
	}

	scored := make([]ScoredCandidate, 0, len(cs))
	for _, c := range cs {
		rttMs, rttSrc := effectiveRTTMs(c, effLat, effLng, hintGeoKnown)
		rttTerm := r.w.Alpha * rttMs
		loadTerm := r.w.Beta * float64(c.ActiveSessions)
		regionTerm := r.w.Gamma * regionPenalty(c.Region, effRegion)
		scored = append(scored, ScoredCandidate{
			Candidate:  c,
			Score:      rttTerm + loadTerm + regionTerm,
			RTTTerm:    rttTerm,
			LoadTerm:   loadTerm,
			RegionTerm: regionTerm,
			RTTSource:  rttSrc,
		})
	}
	sort.SliceStable(scored, func(i, j int) bool {
		if scored[i].Score != scored[j].Score {
			return scored[i].Score < scored[j].Score
		}
		return scored[i].PeerID < scored[j].PeerID
	})
	return scored
}

// effectiveRTTMs returns the RTT in ms plus a tag describing which
// source produced it. Order of preference:
//   - probed echo EMA (> 0) — authoritative
//   - Haversine distance from viewer to candidate, converted at
//     200 km/ms (coarse terrestrial fibre, spec §5.1)
//   - 999 ms sentinel when we have nothing (cold start + no geo)
func effectiveRTTMs(c Candidate, viewerLat, viewerLng float64, viewerGeoKnown bool) (float64, string) {
	if c.RTTEMA > 0 {
		return float64(c.RTTEMA.Milliseconds()), "echo"
	}
	if c.LatLngKnown && viewerGeoKnown {
		km := haversineKm(viewerLat, viewerLng, c.Lat, c.Lng)
		return km / 200.0, "haversine-bootstrap"
	}
	return 999, "unknown"
}

// regionPenalty: 0 same region, 25 same continent, 100 cross-continent.
// Falls through to 100 when either region string is unknown — better
// to deprioritise unknown geography than to treat it as adjacent.
func regionPenalty(candidate, viewer string) float64 {
	if candidate == "" || viewer == "" {
		return 100
	}
	if candidate == viewer {
		return 0
	}
	if continentOf(candidate) == continentOf(viewer) && continentOf(candidate) != "" {
		return 25
	}
	return 100
}

// continentOf returns the coarse continent bucket for an ISO 3166-2
// region code. Accepts either a country-only prefix ("BR") or a full
// region like "BR-SP"; returns "" when the country is unknown.
//
// This is a small static table — ~60 entries cover every country we
// reasonably expect to see in the Aevia mesh. Enlarge when a provider
// operator files an issue pointing at a missing country.
func continentOf(region string) string {
	country := strings.ToUpper(strings.SplitN(region, "-", 2)[0])
	if c, ok := countryContinent[country]; ok {
		return c
	}
	return ""
}

// haversineKm — great-circle distance between two (lat,lng) in km.
// Same formula the frontend rank.ts uses, minus the edge cases (we
// know both sides have coords because the caller already checked).
func haversineKm(lat1, lng1, lat2, lng2 float64) float64 {
	toRad := func(d float64) float64 { return d * math.Pi / 180 }
	const earthRadiusKm = 6371
	dLat := toRad(lat2 - lat1)
	dLng := toRad(lng2 - lng1)
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(toRad(lat1))*math.Cos(toRad(lat2))*math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadiusKm * c
}

// countryContinent is a minimal map of ISO 3166-1 alpha-2 country
// codes to continent buckets. Covers the countries we expect on
// launch; the rest return "" (treated as cross-continent).
var countryContinent = map[string]string{
	// North America
	"US": "NA", "CA": "NA", "MX": "NA",
	// South America
	"BR": "SA", "AR": "SA", "CL": "SA", "CO": "SA", "PE": "SA", "UY": "SA", "PY": "SA", "BO": "SA", "VE": "SA", "EC": "SA",
	// Europe
	"DE": "EU", "FR": "EU", "GB": "EU", "IT": "EU", "ES": "EU", "PT": "EU", "NL": "EU", "BE": "EU", "AT": "EU", "CH": "EU",
	"SE": "EU", "NO": "EU", "DK": "EU", "FI": "EU", "IE": "EU", "IS": "EU", "PL": "EU", "CZ": "EU", "HU": "EU", "RO": "EU",
	"GR": "EU", "BG": "EU", "UA": "EU",
	// Asia
	"JP": "AS", "CN": "AS", "KR": "AS", "IN": "AS", "ID": "AS", "SG": "AS", "MY": "AS", "TH": "AS", "VN": "AS", "PH": "AS",
	"TR": "AS", "IL": "AS", "AE": "AS", "SA": "AS",
	// Africa
	"ZA": "AF", "NG": "AF", "EG": "AF", "KE": "AF", "MA": "AF", "ET": "AF", "GH": "AF",
	// Oceania
	"AU": "OC", "NZ": "OC",
}
