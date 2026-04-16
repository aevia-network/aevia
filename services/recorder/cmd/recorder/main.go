// Aevia recorder.
//
// Listens for Cloudflare Stream webhook events (live.end, video.ready), pulls
// the generated VOD from Cloudflare Stream, re-fragments into CMAF ~2s chunks,
// computes SHA-256 Merkle tree, uploads chunks to R2, and signals the
// manifest-svc to produce a signed JSON-LD manifest.
//
// Sprint 0: placeholder. Sprint 2: full implementation per
// docs/protocol-spec/2-content-addressing.md.
package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	log.Println("aevia recorder: Sprint 0 stub")

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Println("shutting down")
}
