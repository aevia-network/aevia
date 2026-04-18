// Aevia Coordinator daemon — reads Proof-of-Relay receipts persisted by a
// provider-node's ReceiptStore, periodically aggregates them into a
// Settlement via por.BuildSettlement, and broadcasts the resulting
// submitSettlement tx to a deployed PersistencePool contract on Base.
//
// The same binary also exposes admin subcommands:
//   aevia-coordinator run                 # long-running daemon (default)
//   aevia-coordinator settle-now          # one-shot epoch tick
//   aevia-coordinator rotate-coordinator  # transfer setCoordinator authority
//
// Milestone 7 scope: the daemon wires together every piece M1-M6 produced
// with the on-chain PersistencePool deployed in M7-ops-1. Rotation to a
// multisig is a single setCoordinator tx from the current coordinator
// key — validated locally via simulated backend in M7c-i8.
package main

import (
	"fmt"
	"os"
)

// Version is populated at build time via -ldflags -X main.Version=...
var Version = "dev"

func main() {
	args := os.Args[1:]
	if len(args) == 0 {
		args = []string{"run"}
	}
	if err := dispatch(args); err != nil {
		fmt.Fprintf(os.Stderr, "aevia-coordinator: %v\n", err)
		os.Exit(1)
	}
}

func dispatch(args []string) error {
	switch args[0] {
	case "run":
		return fmt.Errorf("run: not yet implemented (comes in M7c-i6)")
	case "settle-now":
		return fmt.Errorf("settle-now: not yet implemented (comes in M7c-i4)")
	case "rotate-coordinator":
		return fmt.Errorf("rotate-coordinator: not yet implemented (comes in M7c-i8)")
	case "version":
		fmt.Println(Version)
		return nil
	default:
		return fmt.Errorf("unknown subcommand %q (available: run, settle-now, rotate-coordinator, version)", args[0])
	}
}
