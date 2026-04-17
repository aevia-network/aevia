// Package logging standardises structured log output for the Provider Node.
// Defaults to JSON for production log shippers; switches to pretty console
// format when stdout is a TTY.
package logging

import (
	"io"
	"os"
	"time"

	"github.com/mattn/go-isatty"
	"github.com/rs/zerolog"
)

// New returns a zerolog.Logger configured for the given writer. If w is a
// TTY, output is pretty-printed; otherwise JSON.
func New(w io.Writer) zerolog.Logger {
	zerolog.TimeFieldFormat = time.RFC3339Nano

	if tty := isTTY(w); tty {
		return zerolog.New(zerolog.ConsoleWriter{Out: w, TimeFormat: time.RFC3339}).
			With().Timestamp().Logger()
	}
	return zerolog.New(w).With().Timestamp().Logger()
}

// Default returns a logger writing to stderr with TTY detection.
func Default() zerolog.Logger { return New(os.Stderr) }

func isTTY(w io.Writer) bool {
	f, ok := w.(*os.File)
	if !ok {
		return false
	}
	return isatty.IsTerminal(f.Fd()) || isatty.IsCygwinTerminal(f.Fd())
}
