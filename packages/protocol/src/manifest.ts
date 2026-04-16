import { z } from 'zod';

/**
 * Canonical Aevia manifest JSON-LD schema.
 *
 * Sprint 0: minimal type placeholder.
 * Sprint 1: full schema per docs/protocol-spec/1-manifest-schema.md including
 * provenance, resolutions[], parent, policyFlags, EIP-712 signature envelope.
 */

export const MANIFEST_CONTEXT_V1 = 'https://aevia.network/schema/v1';

export const manifestTypeSchema = z.enum(['VideoLive', 'VideoVOD', 'VideoClip']);
export type ManifestType = z.infer<typeof manifestTypeSchema>;

export const manifestSchemaV0Stub = z.object({
  '@context': z.literal(MANIFEST_CONTEXT_V1),
  type: manifestTypeSchema,
  creator: z.string().regex(/^did:pkh:eip155:8453:0x[0-9a-fA-F]{40}$/),
  contentUrl: z.string().startsWith('ipfs://'),
  mime: z.string(),
  aupVersion: z.number().int().min(1),
});

export type ManifestV0Stub = z.infer<typeof manifestSchemaV0Stub>;
