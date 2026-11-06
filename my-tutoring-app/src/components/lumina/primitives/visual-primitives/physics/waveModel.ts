/**
 * Wave Tank, pure: the paddle's waves, what they do at the beach, the items code builds, and the check. The 3D tank
 * (`wave3d.ts`) draws the water from `waveAt` and the tower from `waveRun`, so what the learner sees is what this file
 * decides.
 *
 * The paddle has two settings, each 1-5: push SIZE (how far it pushes: the amplitude) and push SPEED (how many pushes a
 * second: the frequency). Waves move down the tank at one speed, so wavelength = wave speed / frequency: pushing faster
 * makes the crests closer together. Each push sends one crest; a run is three pushes. A wave's energy grows with the
 * square of its height and the square of how often it shakes (E ∝ A²f², the G4 rule "taller and closer-together waves
 * carry more energy"), so a wave knocks the block tower down when size × speed reaches the tower's need.
 *
 * Grid squares on the tank's back glass measure the waves: a crest is `size` squares tall and 12 / `speed` squares
 * from the next.
 */

export type Tier = 'easy' | 'medium' | 'hard';
export type Rng = () => number;

export const WAVE_TASKS = ['knock_it_down'] as const;
export type WaveTask = typeof WAVE_TASKS[number];

/** Settings run 1..LEVELS. */
export const LEVELS = 5;
/** One grid square on the glass, in world units. */
export const SQUARE = 0.25;
/** Waves move this fast down the tank (world units a second), whatever the paddle does. */
export const WAVE_SPEED = 3.2;
/** Pushes in one run, so crests in one wave train. */
export const PUSHES = 3;
/** Where the tower stands, measured from the paddle. The water's resting level. */
export const TOWER_X = 13.2;
export const REST = 2.0;

export const heightSquares = (size: number) => size;
export const spacingSquares = (speed: number) => 12 / speed;
/** Pushes a second. */
export const frequency = (speed: number) => WAVE_SPEED / (spacingSquares(speed) * SQUARE);
export const amplitude = (size: number) => size * SQUARE;
export const wavelength = (speed: number) => spacingSquares(speed) * SQUARE;
/** The energy one wave brings to the beach, in the tower's units: (size × speed)². */
export const waveEnergy = (size: number, speed: number) => (size * speed) ** 2;

export interface KnockChallenge {
  id: string;
  type: 'knock_it_down';
  instruction: string;
  /** The paddle's settings for the first wave, which leaves the tower standing. */
  start: { size: number; speed: number };
  /** The highest push size the paddle allows (hard: stuck at the start). */
  sizeCap: number;
  /** A wave knocks the tower down when size × speed is at least this. Never shown or said. */
  need: number;
  /** Blocks in the tower: a stronger tower is taller. */
  blocks: number;
  supportTier?: Tier;
  startLevers?: string[];
}
export type WaveChallenge = KnockChallenge;

export const knocksDown = (c: Pick<KnockChallenge, 'need'>, size: number, speed: number) => size * speed >= c.need;

// ============================================================================
// The water, for drawing
// ============================================================================

/** The water's height above rest at distance x from the paddle, t seconds after the first push. */
export function waveAt(x: number, t: number, size: number, speed: number): number {
  const lam = wavelength(speed);
  const front = WAVE_SPEED * t;
  if (t <= 0 || x > front || x < front - PUSHES * lam) return 0;
  return amplitude(size) * Math.sin((2 * Math.PI * (front - x)) / lam);
}

/** The paddle's tilt (radians) t seconds after the first push: it rocks PUSHES times, then rests. */
export function paddleAngle(t: number, size: number, speed: number): number {
  const f = frequency(speed);
  if (t <= 0 || t * f >= PUSHES) return 0;
  return (amplitude(size) / 1.6) * Math.sin(2 * Math.PI * f * t);
}

export interface WaveRun {
  size: number;
  speed: number;
  fell: boolean;
}

/** When the first crest reaches the tower, and when the run is over (the last crest gone and the blocks settled). */
export function runTiming(speed: number): { arriveS: number; endS: number } {
  const arriveS = (TOWER_X - wavelength(speed) / 4) / WAVE_SPEED;
  return { arriveS, endS: (TOWER_X + PUSHES * wavelength(speed)) / WAVE_SPEED + 1.2 };
}

/** How far the tower rocks when it stays up (0-1): closer to its need rocks it more. */
export const wobble = (c: Pick<KnockChallenge, 'need'>, size: number, speed: number) =>
  Math.min(0.95, (size * speed) / c.need);

export const OUTCOME_WORDS = { fell: 'knocked the tower down', stood: 'made the tower wobble, but it stayed up' } as const;
export const runOutcome = (r: Pick<WaveRun, 'fell'>) => (r.fell ? OUTCOME_WORDS.fell : OUTCOME_WORDS.stood);

/** "crests 3 squares tall, about 4 squares apart". */
export function waveWords(size: number, speed: number): string {
  const gap = spacingSquares(speed);
  return `crests ${heightSquares(size)} ${size === 1 ? 'square' : 'squares'} tall, ${Number.isInteger(gap) ? '' : 'about '}${Math.round(gap)} squares apart`;
}

// ============================================================================
// The items
// ============================================================================

const INSTRUCTION = 'The first wave did not knock the tower down. Change ONE thing about the paddle so the next wave does.';

/** A fair item: the first wave fails; raising ONE setting (within the caps) can knock it down. */
export function knockFair(c: KnockChallenge): boolean {
  const { size, speed } = c.start;
  if (knocksDown(c, size, speed)) return false;
  return knocksDown(c, c.sizeCap, speed) || knocksDown(c, size, LEVELS);
}

export function makeKnock(id: string, start: { size: number; speed: number }, need: number, sizeCap = LEVELS, tier?: Tier): KnockChallenge {
  const instruction = sizeCap < LEVELS
    ? `${INSTRUCTION} The push-size stop is stuck: the paddle cannot push bigger than size ${sizeCap}.`
    : INSTRUCTION;
  return { id, type: 'knock_it_down', instruction, start, sizeCap, need, blocks: 2 + Math.ceil(need / 5), ...(tier ? { supportTier: tier } : {}) };
}

/**
 * Every item a tier allows. Easy: one step up on either setting is enough. Medium: one step is not enough on either;
 * both settings can still do it alone. Hard: the size is stuck at the start, so only pushing faster works, and one step
 * faster is not enough.
 */
export function knockCandidates(tier: Tier): KnockChallenge[] {
  const out: KnockChallenge[] = [];
  for (let size = 1; size <= 3; size++) for (let speed = 1; speed <= 3; speed++) {
    const base = size * speed;
    const oneUp = [(size + 1) * speed, size * (speed + 1)];
    for (let need = base + 1; need <= LEVELS * LEVELS; need++) {
      let ok: boolean;
      if (tier === 'easy') ok = oneUp.every(p => p >= need);
      else if (tier === 'medium') ok = oneUp.every(p => p < need) && need <= LEVELS * Math.min(size, speed);
      else ok = size >= 2 && size * (speed + 1) < need && need <= size * LEVELS;
      if (!ok) continue;
      const c = makeKnock('cand', { size, speed }, need, tier === 'hard' ? size : LEVELS, tier);
      if (knockFair(c)) out.push(c);
    }
  }
  return out;
}

export function pickKnocks(n: number, tier: Tier, rng: Rng, idPrefix = 'wave'): KnockChallenge[] {
  const pool = knockCandidates(tier);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  // Different starting settings first, so the items in a session differ.
  const key = (c: KnockChallenge) => `${c.start.size}x${c.start.speed}`;
  const picked: KnockChallenge[] = [];
  for (const c of pool) if (picked.length < n && !picked.some(p => key(p) === key(c))) picked.push(c);
  for (const c of pool) if (picked.length < n && !picked.includes(c)) picked.push(c);
  return picked.slice(0, n).map((c, i) => ({ ...c, id: `${idPrefix}-${i + 1}` }));
}

// ============================================================================
// The check
// ============================================================================

export interface KnockAnswer { size: number; speed: number; runs: readonly WaveRun[] }
export type KnockMiss = 'no_change' | 'changed_both' | 'weaker' | 'too_small';

/** Which setting the learner changed from the first wave: none, one, or both. */
export function changed(c: KnockChallenge, x: Pick<KnockAnswer, 'size' | 'speed'>): 'none' | 'size' | 'speed' | 'both' {
  const s = x.size !== c.start.size, p = x.speed !== c.start.speed;
  return s && p ? 'both' : s ? 'size' : p ? 'speed' : 'none';
}

export function knockMatches(c: KnockChallenge, x: KnockAnswer): boolean {
  const which = changed(c, x);
  return (which === 'size' || which === 'speed') && knocksDown(c, x.size, x.speed);
}

/** The named miss: nothing changed; both changed (not a fair test); one setting turned down; one turned up too little. */
export function knockMiss(c: KnockChallenge, x: KnockAnswer): KnockMiss | undefined {
  if (knockMatches(c, x)) return undefined;
  const which = changed(c, x);
  if (which === 'none') return 'no_change';
  if (which === 'both') return 'changed_both';
  return x.size < c.start.size || x.speed < c.start.speed ? 'weaker' : 'too_small';
}

const runWords = (r: WaveRun) => `size ${r.size}, speed ${r.speed}: ${runOutcome(r)}`;

/** The learner's work in words, never the setting that works. */
export const describeKnock = (c: KnockChallenge, x: KnockAnswer) =>
  `first wave was size ${c.start.size}, speed ${c.start.speed}; sent ${x.runs.length} ${x.runs.length === 1 ? 'wave' : 'waves'}`
  + `${x.runs.length ? ` (${x.runs.map(runWords).join('; ')})` : ''}; chose size ${x.size}, speed ${x.speed}`;

export function knockFeedback(c: KnockChallenge, x: KnockAnswer): string {
  const miss = knockMiss(c, x);
  if (!miss) {
    return changed(c, x) === 'size'
      ? 'Down it goes! A bigger push made taller waves, and taller waves carry more energy.'
      : 'Down it goes! Pushing faster made the crests closer together, and those waves carry more energy.';
  }
  if (miss === 'no_change') return 'That is the same as the first wave, and the first wave did not knock it down. Change one thing.';
  if (miss === 'changed_both') return 'You changed both the push size and the push speed, so we cannot tell which one did it. Change just one.';
  if (miss === 'weaker') return 'That change made the waves carry less energy, not more. Try changing it the other way.';
  return 'The tower wobbled more, but it stayed up. Change that same thing even more.';
}

// ============================================================================
// Shared helpers
// ============================================================================

/** A small seeded random number generator (mulberry32). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
