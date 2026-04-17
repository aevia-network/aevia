package logging_test

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/logging"
)

func TestNewWritesValidJSONWithRequiredFields(t *testing.T) {
	var buf bytes.Buffer
	lg := logging.New(&buf)

	lg.Info().
		Str("event", "node_boot").
		Str("peer_id", "12D3KooW...").
		Str("listen", "/ip4/0.0.0.0/tcp/4001").
		Msg("provider-node started")

	line := buf.String()
	if line == "" {
		t.Fatal("empty log output")
	}

	var payload map[string]any
	if err := json.Unmarshal([]byte(line), &payload); err != nil {
		t.Fatalf("log line is not JSON: %v (raw=%q)", err, line)
	}

	for _, key := range []string{"level", "time", "event", "peer_id", "listen", "message"} {
		if _, ok := payload[key]; !ok {
			t.Errorf("log output missing field %q (raw=%q)", key, line)
		}
	}
	if payload["level"] != "info" {
		t.Errorf("level = %v, want info", payload["level"])
	}
	if payload["message"] != "provider-node started" {
		t.Errorf("message = %v, want %q", payload["message"], "provider-node started")
	}
}

func TestNewRespectsLogLevels(t *testing.T) {
	var buf bytes.Buffer
	lg := logging.New(&buf).Level(0) // trace-and-up

	lg.Debug().Msg("debug line")
	lg.Info().Msg("info line")
	lg.Warn().Msg("warn line")

	lines := strings.Split(strings.TrimRight(buf.String(), "\n"), "\n")
	if len(lines) != 3 {
		t.Fatalf("got %d lines, want 3: %v", len(lines), lines)
	}

	levels := []string{"debug", "info", "warn"}
	for i, want := range levels {
		var payload map[string]any
		if err := json.Unmarshal([]byte(lines[i]), &payload); err != nil {
			t.Fatalf("line %d not JSON: %v", i, err)
		}
		if payload["level"] != want {
			t.Errorf("line %d level = %v, want %v", i, payload["level"], want)
		}
	}
}
