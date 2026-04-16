/**
 * @aevia/libp2p-config — canonical protocol IDs, bootstrap nodes, DHT namespace.
 *
 * Sprint 0: constants only.
 * Sprint 3: transport factories, peer discovery config.
 *
 * Protocol IDs correspond to docs/protocol-spec/4-wire-format.md.
 */

export const PROTOCOL_IDS = {
  contentDiscovery: '/aevia/content-discovery/1.0.0',
  contentFetch: '/aevia/content-fetch/1.0.0',
  proofOfRelay: '/aevia/proof-of-relay/1.0.0',
  liveDiscovery: '/aevia/live-discovery/1.0.0',
  policyBroadcast: '/aevia/policy-broadcast/1.0.0',
} as const;

export const DHT_NAMESPACE = '/aevia/kad/1.0.0';

export const POLICY_GOSSIP_TOPIC = '/aevia/policy/1';

export const MAX_MESSAGE_SIZE_BYTES = 16 * 1024 * 1024;
export const CHUNK_TARGET_DURATION_MS = 2000;
export const CHUNK_MAX_SIZE_BYTES = 8 * 1024 * 1024;

export type ProtocolId = (typeof PROTOCOL_IDS)[keyof typeof PROTOCOL_IDS];
