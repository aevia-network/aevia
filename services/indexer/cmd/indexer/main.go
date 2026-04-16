// Aevia indexer.
//
// Reads events from Base L2 (ContentRegistry, ModerationRegistry, PersistencePool,
// CreditEscrow) and serves queries to the frontend via GraphQL.
//
// Sprint 0: placeholder. Sprint 2: Ponder (TS) was recommended by the
// contracts plan; Go indexer here is reserved for high-throughput aggregation
// once we outgrow Ponder. Final choice deferred to post-Sprint 2 retro.
package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	log.Println("aevia indexer: Sprint 0 stub")

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Println("shutting down")
}
