package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeTempFile(t *testing.T, dir, name string, content []byte) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, content, 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	return path
}

func TestPinCommandEmitsCIDAndListReadsIt(t *testing.T) {
	dir := t.TempDir()

	// Create a ~5.5 MiB test file so the pin chunker produces 6 segments
	// at the 1 MiB default chunk size.
	content := bytes.Repeat([]byte("AEVIA"), (5<<20)/5+1024)
	file := writeTempFile(t, dir, "payload.bin", content)

	var pinOut bytes.Buffer
	err := pinCommand([]string{"--data-dir", dir, file}, &pinOut)
	if err != nil {
		t.Fatalf("pinCommand: %v", err)
	}
	cid := strings.TrimSpace(pinOut.String())
	if cid == "" {
		t.Fatal("pinCommand emitted no CID")
	}
	if !strings.HasPrefix(cid, "bafkrei") {
		t.Fatalf("emitted CID %q is not a canonical Aevia CID", cid)
	}

	var listOut bytes.Buffer
	if err := listCommand([]string{"--data-dir", dir}, &listOut); err != nil {
		t.Fatalf("listCommand: %v", err)
	}
	got := listOut.String()
	if !strings.Contains(got, cid) {
		t.Fatalf("list output missing cid %q:\n%s", cid, got)
	}
	if !strings.Contains(got, "# pins=1") {
		t.Fatalf("list output missing pin summary:\n%s", got)
	}
}

func TestPinCommandRejectsMissingFile(t *testing.T) {
	dir := t.TempDir()
	var buf bytes.Buffer
	err := pinCommand([]string{"--data-dir", dir, filepath.Join(dir, "nonexistent")}, &buf)
	if err == nil {
		t.Fatal("pinCommand on missing file returned nil error")
	}
}

func TestPinCommandRejectsMissingPath(t *testing.T) {
	dir := t.TempDir()
	var buf bytes.Buffer
	err := pinCommand([]string{"--data-dir", dir}, &buf)
	if err == nil {
		t.Fatal("pinCommand with no file argument returned nil error")
	}
}

func TestPinCommandRejectsEmptyFile(t *testing.T) {
	dir := t.TempDir()
	empty := writeTempFile(t, dir, "zero.bin", nil)
	var buf bytes.Buffer
	err := pinCommand([]string{"--data-dir", dir, empty}, &buf)
	if err == nil {
		t.Fatal("pinCommand on empty file returned nil error")
	}
}

func TestListCommandOnEmptyStoreShowsZeroPins(t *testing.T) {
	dir := t.TempDir()
	var buf bytes.Buffer
	if err := listCommand([]string{"--data-dir", dir}, &buf); err != nil {
		t.Fatalf("listCommand: %v", err)
	}
	out := buf.String()
	if !strings.Contains(out, "pins=0") {
		t.Fatalf("list on empty store should report pins=0, got:\n%s", out)
	}
}

func TestDispatchReturnsErrDefaultRunOnEmptyArgs(t *testing.T) {
	err := dispatch(nil, os.Stdout)
	if err != errDefaultRun {
		t.Fatalf("dispatch(nil) = %v, want errDefaultRun", err)
	}
}

func TestDispatchReturnsErrDefaultRunOnFlagArg(t *testing.T) {
	err := dispatch([]string{"-mode", "provider"}, os.Stdout)
	if err != errDefaultRun {
		t.Fatalf("dispatch(flag) = %v, want errDefaultRun", err)
	}
}

func TestDispatchUnknownSubcommand(t *testing.T) {
	err := dispatch([]string{"nonsense"}, os.Stdout)
	if err == nil {
		t.Fatal("dispatch accepted unknown subcommand")
	}
}
