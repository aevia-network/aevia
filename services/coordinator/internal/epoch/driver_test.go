package epoch_test

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Leeaandrob/aevia/services/coordinator/internal/epoch"
	"github.com/Leeaandrob/aevia/services/coordinator/internal/settle"
)

// fakeSettler records every call and returns canned values keyed by
// invocation number. Index 0 = first call, index 1 = second, etc.
type fakeSettler struct {
	calls     atomic.Int32
	responses []fakeResponse
}

type fakeResponse struct {
	result *settle.Result
	err    error
}

func (f *fakeSettler) SettleOnce(_ context.Context, _, _ int64) (*settle.Result, error) {
	n := f.calls.Add(1) - 1
	if int(n) >= len(f.responses) {
		return nil, errors.New("fakeSettler: out of responses")
	}
	r := f.responses[n]
	return r.result, r.err
}

func TestNewDriverRejectsNilSettler(t *testing.T) {
	if _, err := epoch.NewDriver(nil, epoch.Config{}); err == nil {
		t.Fatal("NewDriver(nil) returned nil error")
	}
}

func TestTickOnceAdvancesCursorOnSuccess(t *testing.T) {
	result := &settle.Result{ReceiptCount: 3, TotalBytes: 3000}
	f := &fakeSettler{responses: []fakeResponse{{result: result}}}

	d, err := epoch.NewDriver(f, epoch.Config{Cadence: time.Second, InitialSince: 100})
	if err != nil {
		t.Fatalf("NewDriver: %v", err)
	}
	now := int64(200)
	d.WithNowFunc(func() int64 { return now })

	tr, err := d.TickOnce(context.Background())
	if err != nil {
		t.Fatalf("TickOnce: %v", err)
	}
	if tr.Skipped {
		t.Fatal("TickResult.Skipped should be false on success")
	}
	if tr.Window.Since != 100 || tr.Window.Until != 200 {
		t.Fatalf("window = [%d,%d), want [100,200)", tr.Window.Since, tr.Window.Until)
	}
	if d.LastSince() != 200 {
		t.Fatalf("cursor = %d, want 200", d.LastSince())
	}
}

func TestTickOnceSkipsOnErrNoReceipts(t *testing.T) {
	f := &fakeSettler{responses: []fakeResponse{{err: settle.ErrNoReceipts}}}
	d, _ := epoch.NewDriver(f, epoch.Config{Cadence: time.Second, InitialSince: 100})
	d.WithNowFunc(func() int64 { return 200 })

	tr, err := d.TickOnce(context.Background())
	if err != nil {
		t.Fatalf("TickOnce: %v", err)
	}
	if !tr.Skipped {
		t.Fatal("Skipped = false on ErrNoReceipts")
	}
	// Cursor must NOT advance on a skipped tick — next tick widens the
	// window to catch receipts that arrive during the skipped epoch.
	if d.LastSince() != 100 {
		t.Fatalf("cursor = %d, want 100 (unchanged)", d.LastSince())
	}
}

func TestTickOnceReturnsErrorOnUnexpectedFailure(t *testing.T) {
	f := &fakeSettler{responses: []fakeResponse{{err: errors.New("rpc down")}}}
	d, _ := epoch.NewDriver(f, epoch.Config{Cadence: time.Second})
	if _, err := d.TickOnce(context.Background()); err == nil {
		t.Fatal("TickOnce suppressed hard failure")
	}
}

func TestRunFiresImmediatelyThenOnTick(t *testing.T) {
	f := &fakeSettler{responses: []fakeResponse{
		{err: settle.ErrNoReceipts},
		{result: &settle.Result{ReceiptCount: 1, TotalBytes: 100}},
		{err: settle.ErrNoReceipts},
	}}
	d, _ := epoch.NewDriver(f, epoch.Config{Cadence: 10 * time.Millisecond})

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	var ticks atomic.Int32
	err := d.Run(ctx, func(*epoch.TickResult, error) { ticks.Add(1) })
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("Run err = %v, want context.DeadlineExceeded", err)
	}
	got := ticks.Load()
	if got < 2 {
		t.Fatalf("onTick fired %d times, want >= 2 (immediate + at least one ticker)", got)
	}
}

func TestRunHonorsContextCancel(t *testing.T) {
	f := &fakeSettler{responses: []fakeResponse{
		{err: settle.ErrNoReceipts},
		{err: settle.ErrNoReceipts},
		{err: settle.ErrNoReceipts},
	}}
	d, _ := epoch.NewDriver(f, epoch.Config{Cadence: time.Hour})

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- d.Run(ctx, nil) }()

	cancel()
	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("err = %v, want context.Canceled", err)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("Run did not return after cancel within 500ms")
	}
}
