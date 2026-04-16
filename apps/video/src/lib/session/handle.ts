/**
 * Generates a human-readable anonymous handle like "SparrowFalcon-7a2b".
 * Collision space: 48 × 48 × 16^4 ≈ 150M unique combinations — enough for alpha.
 */

const ADJECTIVES = [
  'Swift',
  'Silent',
  'Bold',
  'Bright',
  'Quiet',
  'Wild',
  'Brave',
  'Calm',
  'Sharp',
  'Clever',
  'Noble',
  'Proud',
  'Keen',
  'Free',
  'True',
  'Quick',
  'Sunny',
  'Stormy',
  'Misty',
  'Frosty',
  'Golden',
  'Silver',
  'Crimson',
  'Azure',
  'Mighty',
  'Gentle',
  'Bright',
  'Steady',
  'Fierce',
  'Lively',
  'Still',
  'Wise',
  'Eager',
  'Solid',
  'Nimble',
  'Loyal',
  'Quaint',
  'Rustic',
  'Valiant',
  'Witty',
  'Daring',
  'Humble',
  'Radiant',
  'Serene',
  'Vibrant',
  'Zesty',
  'Lucid',
  'Tranquil',
];

const NOUNS = [
  'Sparrow',
  'Falcon',
  'Eagle',
  'Wolf',
  'Bear',
  'Fox',
  'Lynx',
  'Owl',
  'Hawk',
  'Otter',
  'Deer',
  'Heron',
  'Raven',
  'Stag',
  'Hare',
  'Panther',
  'Tiger',
  'Lion',
  'Dolphin',
  'Orca',
  'Crane',
  'Swan',
  'Phoenix',
  'Dragon',
  'River',
  'Mountain',
  'Forest',
  'Meadow',
  'Valley',
  'Harbor',
  'Island',
  'Canyon',
  'Comet',
  'Nova',
  'Quasar',
  'Nebula',
  'Aurora',
  'Horizon',
  'Echo',
  'Zephyr',
  'Ember',
  'Frost',
  'Dawn',
  'Dusk',
  'Gale',
  'Rain',
  'Thorn',
  'Vale',
];

function pick<T>(arr: readonly T[]): T {
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx] as T;
}

function randomHex(len: number): string {
  const bytes = new Uint8Array(Math.ceil(len / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, len);
}

export function generateHandle(): string {
  return `${pick(ADJECTIVES)}${pick(NOUNS)}-${randomHex(4)}`;
}

export function generateSessionId(): string {
  // Short, URL-safe ULID-like id; 16 hex chars = 64 bits.
  return randomHex(16);
}
