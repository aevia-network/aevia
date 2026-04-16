// Aevia Provider Node.
//
// Sprint 0: placeholder. Sprint 3: go-libp2p + BadgerDB + GStreamer + webrtc-direct
// per docs/protocol-spec/4-wire-format.md and 5-peer-discovery.md.
//
// Responsibilities:
//   - Pin content (CIDs) advertised in the DHT.
//   - Serve chunks over libp2p/WebRTC to browser PWAs.
//   - Collect Proof of Relay tickets signed by viewers.
//   - Submit batched tickets for settlement in PersistencePool.
package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	log.Println("aevia provider-node: Sprint 0 stub — libp2p host coming in Sprint 3")

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Println("shutting down")
}
