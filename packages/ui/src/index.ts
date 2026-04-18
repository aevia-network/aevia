/**
 * @aevia/ui — shared UI primitives for Aevia clients.
 *
 * Source of truth: Stitch project 12044695711077109600, DS "Sovereign Editorial".
 */

export { cn } from './lib/cn';
export { MeshDot } from './components/mesh-dot';
export {
  PermanenceStrip,
  type PermanenceLayer,
  type PermanenceStripProps,
} from './components/permanence-strip';
export { VigilChip } from './components/vigil-chip';
export { FloatingBoostButton } from './components/floating-boost-button';
export type { FloatingBoostButtonProps } from './components/floating-boost-button';
export { LiveTile } from './components/live-tile';
export type { LiveTileProps } from './components/live-tile';
export { PresenceRow } from './components/presence-row';
export type { PresenceRowProps, PresenceRowViewer } from './components/presence-row';
export { RankingSwitcher } from './components/ranking-switcher';
export type { RankingSwitcherProps, RankingTemplate } from './components/ranking-switcher';
export { ReactionStrip } from './components/reaction-strip';
export type { ReactionKind, ReactionStripProps } from './components/reaction-strip';
