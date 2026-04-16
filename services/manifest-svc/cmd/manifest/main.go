// Aevia manifest service.
//
// Generates canonical JSON-LD manifests per docs/protocol-spec/1-manifest-schema.md,
// applies RFC 8785 JCS canonicalization, and coordinates EIP-712 signing with
// the creator's Privy smart wallet before submission to ContentRegistry.
//
// Sprint 0: placeholder. Sprint 2: full implementation.
package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	log.Println("aevia manifest-svc: Sprint 0 stub")

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Println("shutting down")
}
