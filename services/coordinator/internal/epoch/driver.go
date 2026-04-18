// Package epoch is the coordinator's tick-driven control loop. One Driver
// owns a settle.Settler, a time source, and a cadence. On every tick it
// runs the settlement pipeline for the receipt window [last_ts, now);
// if ErrNoReceipts, it skips silently and waits for the next tick.
//
// The Driver has two entry points:
//   - TickOnce(ctx) — runs exactly one cycle, exposed for tests + the
//     `aevia-coordinator settle-now` admin subcommand.
//   - Run(ctx) — long-running loop, driven by a time.Ticker.
package epoch

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/Leeaandrob/aevia/services/coordinator/internal/settle"
)

// SettleRunner is the interface Driver actually depends on. Matches
// settle.Settler.SettleOnce. Tests plug a fake.
type SettleRunner interface {
	SettleOnce(ctx context.Context, since, until int64) (*settle.Result, error)
}

// Config controls the Driver's cadence and batching heuristics.
type Config struct {
	// Cadence is how often TickOnce fires. 5 minutes is the MVP default;
	// production will tune per network conditions.
	Cadence time.Duration
	// InitialSince is the starting value of the "last settled" cursor.
	// Passing 0 means "from the beginning of time" — the first tick
	// captures every receipt in the store.
	InitialSince int64
}

// Driver orchestrates one settler across a series of epoch ticks.
type Driver struct {
	settler SettleRunner
	cfg     Config
	nowFn   func() int64

	// lastSince is the cursor used as `since` for the next SettleOnce.
	// Advanced to the `until` value only when a settlement succeeded
	// (not on ErrNoReceipts) so a quiet tick doesn't lose the already-
	// captured window.
	lastSince int64
}

// NewDriver wires a settler + config. nowFn is injectable for tests.
func NewDriver(s SettleRunner, cfg Config) (*Driver, error) {
	if s == nil {
		return nil, errors.New("epoch: settler is nil")
	}
	if cfg.Cadence <= 0 {
		cfg.Cadence = 5 * time.Minute
	}
	return &Driver{
		settler:   s,
		cfg:       cfg,
		nowFn:     func() int64 { return time.Now().Unix() },
		lastSince: cfg.InitialSince,
	}, nil
}

// WithNowFunc overrides the time source. Tests call this to freeze time.
func (d *Driver) WithNowFunc(f func() int64) *Driver {
	d.nowFn = f
	return d
}

// LastSince returns the cursor value — exposed for log + debug.
func (d *Driver) LastSince() int64 { return d.lastSince }

// TickResult is what a single TickOnce returns. Either Result is non-nil
// (settlement happened) or Skipped is true (quiet tick, no receipts).
type TickResult struct {
	Result  *settle.Result
	Skipped bool
	Window  struct{ Since, Until int64 }
}

// TickOnce runs exactly one epoch cycle: reads the window
// [lastSince, now), calls SettleOnce, advances the cursor on success.
// Returns with Skipped=true on ErrNoReceipts. Returns the error as-is
// on any other failure (caller decides: retry, alert, or crash).
func (d *Driver) TickOnce(ctx context.Context) (*TickResult, error) {
	until := d.nowFn()
	since := d.lastSince

	tr := &TickResult{}
	tr.Window.Since = since
	tr.Window.Until = until

	res, err := d.settler.SettleOnce(ctx, since, until)
	if errors.Is(err, settle.ErrNoReceipts) {
		tr.Skipped = true
		return tr, nil
	}
	if err != nil {
		return nil, fmt.Errorf("epoch tick [%d,%d): %w", since, until, err)
	}
	d.lastSince = until
	tr.Result = res
	return tr, nil
}

// Run is the long-running daemon loop. Returns on ctx cancel or first
// non-skipped, non-ErrNoReceipts error returned by TickOnce. Per-tick
// errors are logged (via the caller-provided hook) but do NOT terminate
// the loop unless explicitly fatal.
func (d *Driver) Run(ctx context.Context, onTick func(*TickResult, error)) error {
	if onTick == nil {
		onTick = func(*TickResult, error) {}
	}
	// Fire immediately so operators see feedback without waiting the
	// first cadence.
	if tr, err := d.TickOnce(ctx); err != nil {
		onTick(tr, err)
	} else {
		onTick(tr, nil)
	}

	ticker := time.NewTicker(d.cfg.Cadence)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			tr, err := d.TickOnce(ctx)
			onTick(tr, err)
		}
	}
}
