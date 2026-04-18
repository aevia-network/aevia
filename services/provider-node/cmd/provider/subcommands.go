package main

import (
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/pinning"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/storage"
)

// DefaultSegmentChunkSize is the fixed-size split used by the pin CLI.
// 1 MiB is a pragmatic default: big enough to keep the Merkle tree
// shallow for hour-long streams, small enough to cap per-segment memory
// on small VPS during transfer.
const DefaultSegmentChunkSize = 1 << 20

// dispatch routes os.Args[1:] to either the long-running node (default)
// or one of the operator subcommands (pin, list).
func dispatch(args []string, stdout io.Writer) error {
	if len(args) == 0 || strings.HasPrefix(args[0], "-") {
		return errDefaultRun
	}
	switch args[0] {
	case "pin":
		return pinCommand(args[1:], stdout)
	case "list":
		return listCommand(args[1:], stdout)
	case "run", "start":
		return errDefaultRun
	default:
		return fmt.Errorf("unknown subcommand %q (available: pin, list, run)", args[0])
	}
}

// errDefaultRun is a sentinel the caller uses to decide whether to fall
// back to the long-running node path.
var errDefaultRun = fmt.Errorf("dispatch: use default run path")

// pinCommand reads a file, splits it into fixed-size chunks, and pins them
// into the ContentStore at --data-dir. Prints the resulting CID on
// success — that's what an operator registers in ContentRegistry.
func pinCommand(args []string, stdout io.Writer) error {
	fs := flag.NewFlagSet("pin", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	dataDir := fs.String("data-dir", defaultDataDirPath(), "Provider Node data directory")
	duration := fs.Int("duration", 6, "segment duration in seconds for the generated HLS playlist")
	chunk := fs.Int("chunk-size", DefaultSegmentChunkSize, "segment chunk size in bytes")
	if err := fs.Parse(args); err != nil {
		return err
	}

	positional := fs.Args()
	if len(positional) != 1 {
		return fmt.Errorf("pin: expected exactly one file path, got %d arguments", len(positional))
	}
	path := positional[0]

	payloads, err := readChunkedFile(path, *chunk)
	if err != nil {
		return err
	}
	if len(payloads) == 0 {
		return fmt.Errorf("pin: %s is empty", path)
	}

	pinPath := filepath.Join(*dataDir, "pinning")
	store, err := storage.Open(storage.Options{Path: pinPath, Silent: true})
	if err != nil {
		return err
	}
	defer store.Close()

	cs := pinning.NewContentStore(store)
	m, err := cs.PinPayloads(payloads, *duration)
	if err != nil {
		return err
	}
	_, _ = fmt.Fprintf(stdout, "%s\n", m.CID)
	return nil
}

// listCommand prints every pinned CID along with segment count + byte
// footprint. Single-line records, tab-separated — designed to be piped
// into sort/awk.
func listCommand(args []string, stdout io.Writer) error {
	fs := flag.NewFlagSet("list", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	dataDir := fs.String("data-dir", defaultDataDirPath(), "Provider Node data directory")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if len(fs.Args()) != 0 {
		return fmt.Errorf("list: unexpected positional arguments %v", fs.Args())
	}

	pinPath := filepath.Join(*dataDir, "pinning")
	store, err := storage.Open(storage.Options{Path: pinPath, Silent: true})
	if err != nil {
		return err
	}
	defer store.Close()

	cs := pinning.NewContentStore(store)
	cids, err := cs.List()
	if err != nil {
		return err
	}
	count, bytesUsed, err := cs.Usage()
	if err != nil {
		return err
	}

	_, _ = fmt.Fprintf(stdout, "# pins=%d bytes_used=%d\n", count, bytesUsed)
	for _, cid := range cids {
		m, err := cs.GetManifest(cid)
		if err != nil {
			_, _ = fmt.Fprintf(stdout, "%s\t(manifest_error: %v)\n", cid, err)
			continue
		}
		_, _ = fmt.Fprintf(stdout, "%s\tsegments=%d\tduration=%ds\n", cid, m.SegmentCount, m.SegmentDuration)
	}
	return nil
}

// readChunkedFile reads path and splits its bytes into segments of exactly
// chunkSize (the last segment may be smaller). Uses a streaming read so
// very large files don't blow up memory.
func readChunkedFile(path string, chunkSize int) ([][]byte, error) {
	if chunkSize <= 0 {
		return nil, fmt.Errorf("chunk size must be > 0 (got %d)", chunkSize)
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var out [][]byte
	for {
		buf := make([]byte, chunkSize)
		n, err := io.ReadFull(f, buf)
		if n > 0 {
			out = append(out, buf[:n])
		}
		if err == io.EOF {
			break
		}
		if err == io.ErrUnexpectedEOF {
			// last short chunk — already appended above.
			break
		}
		if err != nil {
			return nil, err
		}
	}
	return out, nil
}

// defaultDataDirPath mirrors cmd/provider's node boot default so the CLI
// sees the same store the long-running node would.
func defaultDataDirPath() string {
	home, err := os.UserHomeDir()
	if err == nil && home != "" {
		return filepath.Join(home, ".aevia", "provider-node")
	}
	return filepath.Join(".", ".aevia-provider-node")
}
