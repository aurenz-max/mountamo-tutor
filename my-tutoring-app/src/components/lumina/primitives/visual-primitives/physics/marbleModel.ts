/**
 * Marble Run Park, pure: the track, the marble's run along it, the items code builds, and the check. The 3D park
 * (`marble3d.ts`) plays back the frames this file computes, so what the learner sees is what this file decides.
 *
 * The track is drawn side-on (x along the table, y up; z only moves the loop's exit beside its entry). The marble
 * starts still on a peg of the ramp and rolls: gravity along the track speeds it up downhill and slows it uphill, a
 * little rolling friction takes energy away (a lot on carpet), and the track can only push, never pull. Where the
 * track would have to pull to keep the marble on it (near the top of a loop when it is going too slowly), the marble
 * leaves the track and falls. A rolling ball needs to start well above the top of the loop, not just level with it:
 * at the top it must still be going fast enough to press on the track, and some of its energy goes into spinning.
 */

export type Tier = 'easy' | 'medium' | 'hard';
export type Rng = () => number;

export const MARBLE_TASKS = ['make_the_loop'] as const;
export type MarbleTask = typeof MARBLE_TASKS[number];

export const G = 9.8;
/** A rolling solid ball: 2/5 of its energy of motion is spin, so it speeds up as if 1.4 times heavier along the track. */
export const ROLL = 1.4;
const WOOD = 0.012;
const CARPET = 0.16;
export const MARBLE_R = 0.14;
const PEG_COUNT = 8;

export type Outcome = 'made_it' | 'fell' | 'rolled_back' | 'stopped';
export const OUTCOME_WORDS: Record<Outcome, string> = {
  made_it: 'went all the way round the loop and rang the bell',
  fell: 'fell off near the top of the loop',
  rolled_back: 'rolled back down before the top of the loop',
  stopped: 'stopped before the loop',
};

export interface LoopChallenge {
  id: string;
  type: 'make_the_loop';
  instruction: string;
  /** The loop's radius (track units; one peg step is about half of one). */
  loopR: number;
  /** Each peg's height on the ramp, lowest first. Peg 1 is the lowest. */
  pegs: number[];
  /** A strip of carpet on the flat before the loop (hard). */
  carpet: boolean;
  /** Any peg that gets round (easy), or the lowest peg that does (medium, hard). */
  goal: 'any' | 'lowest';
  supportTier?: Tier;
  startLevers?: string[];
}
export type MarbleChallenge = LoopChallenge;

// ============================================================================
// The track
// ============================================================================

export interface Track {
  /** Contact points along the track, with arc length, unit tangent, signed curvature and rolling friction. */
  x: number[]; y: number[]; z: number[]; s: number[]; tx: number[]; ty: number[]; k: number[]; mu: number[];
  /** Where each part starts along the track. */
  marks: { rampEnd: number; carpet: [number, number] | null; loopStart: number; loopEnd: number; end: number };
  /** The ramp: y = H (1 - x / D)^2 for x in [0, D]. */
  rampH: number; rampD: number;
  loopX: number; loopR: number; loopZ: number;
  bellX: number;
}

const rampHeightFor = (c: Pick<LoopChallenge, 'pegs'>) => c.pegs[c.pegs.length - 1] + 0.35;

export function buildTrack(c: Pick<LoopChallenge, 'pegs' | 'loopR' | 'carpet'>): Track {
  const H = rampHeightFor(c), D = 2.1 * H, R = c.loopR, loopZ = 0.55;
  const t: Track = { x: [], y: [], z: [], s: [], tx: [], ty: [], k: [], mu: [],
    marks: { rampEnd: 0, carpet: null, loopStart: 0, loopEnd: 0, end: 0 }, rampH: H, rampD: D, loopX: 0, loopR: R, loopZ, bellX: 0 };
  let s = 0;
  const push = (x: number, y: number, z: number, tx: number, ty: number, k: number, mu: number) => {
    const n = t.x.length;
    // Along the side-on track; the loop's sideways step to its exit is not distance travelled.
    if (n) s += Math.hypot(x - t.x[n - 1], y - t.y[n - 1]);
    t.x.push(x); t.y.push(y); t.z.push(z); t.s.push(s); t.tx.push(tx); t.ty.push(ty); t.k.push(k); t.mu.push(mu);
  };
  // The ramp, curving down to the table.
  for (let i = 0; i <= 900; i++) {
    const x = (D * i) / 900, u = 1 - x / D;
    const dy = (-2 * H * u) / D, ddy = (2 * H) / (D * D), len = Math.hypot(1, dy);
    push(x, H * u * u, 0, 1 / len, dy / len, ddy / len ** 3, WOOD);
  }
  t.marks.rampEnd = s;
  const flat = (from: number, length: number, z: number, mu: number) => {
    for (let i = 1; i <= Math.ceil(length / 0.02); i++) push(from + (length * i) / Math.ceil(length / 0.02), 0, z, 1, 0, 0, mu);
    return from + length;
  };
  let x = flat(D, 1.6, 0, WOOD);
  if (c.carpet) {
    const a = s;
    x = flat(x, 1.6, 0, CARPET);
    t.marks.carpet = [a, s];
    x = flat(x, 0.6, 0, WOOD);
  }
  x = flat(x, 0.8, 0, WOOD);
  // The loop: round once, its exit beside its entry.
  t.loopX = x; t.marks.loopStart = s;
  for (let i = 1; i <= 720; i++) {
    const th = (2 * Math.PI * i) / 720;
    push(x + R * Math.sin(th), R * (1 - Math.cos(th)), (loopZ * i) / 720, Math.cos(th), Math.sin(th), 1 / R, WOOD);
  }
  t.marks.loopEnd = s;
  x = flat(x, 2.6, loopZ, WOOD);
  t.bellX = x; t.marks.end = s;
  return t;
}

/** The ramp's x where it is this high. */
export const rampXAt = (t: Track, h: number) => t.rampD * (1 - Math.sqrt(Math.max(0, Math.min(1, h / t.rampH))));

// ============================================================================
// The run
// ============================================================================

/** The marble's centre at one moment of the run (1/60 s apart). */
export interface Frame { x: number; y: number; z: number }
export interface Run {
  outcome: Outcome;
  frames: Frame[];
  /** Index of the frame where the marble left the track, if it did. */
  leftAt: number | null;
  /** Per frame: how high the marble is above the table (h) and how fast it is going (v), for the energy bar. */
  motion: Motion[];
}
export interface Motion { h: number; v: number }

const indexAt = (t: Track, s: number) => {
  let lo = 0, hi = t.s.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (t.s[mid] <= s) lo = mid; else hi = mid; }
  return lo;
};

/** Roll the marble from rest at height h on the ramp and see what happens. */
export function runFrom(t: Track, h: number): Run {
  const dt = 1 / 1200, frameEvery = 20;
  let s = t.s[indexAt(t, 0)] + 0, v = 0;
  // Start where the ramp is h high.
  const x0 = rampXAt(t, h);
  for (let i = 0; i < t.x.length && t.x[i] < x0; i++) s = t.s[i];
  const frames: Frame[] = [];
  const motion: Motion[] = [];
  const centre = (i: number): Frame => ({ x: t.x[i] - t.ty[i] * MARBLE_R, y: t.y[i] + t.tx[i] * MARBLE_R, z: t.z[i] });
  let leftAt: number | null = null;
  let fly: { x: number; y: number; z: number; vx: number; vy: number } | null = null;
  let movedOff = false;
  for (let step = 0; step < 1200 * 25; step++) {
    if (step % frameEvery === 0) {
      if (fly) { frames.push({ x: fly.x, y: fly.y, z: fly.z }); motion.push({ h: fly.y - MARBLE_R, v: Math.hypot(fly.vx, fly.vy) }); }
      else { const i = indexAt(t, s); frames.push(centre(i)); motion.push({ h: t.y[i], v }); }
    }
    if (fly) {
      fly.vy -= G * dt; fly.x += fly.vx * dt; fly.y += fly.vy * dt;
      if (fly.y <= MARBLE_R) {
        frames.push({ x: fly.x, y: MARBLE_R, z: fly.z }); motion.push({ h: 0, v: Math.hypot(fly.vx, fly.vy) });
        return { outcome: 'fell', frames, leftAt, motion };
      }
      continue;
    }
    const i = indexAt(t, s);
    const n = t.k[i] * v * v + G * t.tx[i];
    if (n < 0 && t.k[i] > 0) {
      leftAt = frames.length;
      const c = centre(i);
      fly = { x: c.x, y: c.y, z: c.z, vx: v * t.tx[i], vy: v * t.ty[i] };
      continue;
    }
    const a = (-G * t.ty[i] - Math.sign(v || 1) * t.mu[i] * Math.max(0, n)) / ROLL;
    const before = v;
    v += a * dt;
    if (v > 0.05) movedOff = true;
    if (movedOff && before > 0 && v <= 0) {
      // It stopped going forward: on the loop it rolls back down, elsewhere it has come to rest.
      if (s > t.marks.loopStart && s < t.marks.loopEnd) {
        const back = runBack(t, s, centre);
        return { outcome: 'rolled_back', frames: [...frames, ...back.frames], leftAt, motion: [...motion, ...back.motion] };
      }
      frames.push(centre(i)); motion.push({ h: t.y[i], v: 0 });
      return { outcome: 'stopped', frames, leftAt, motion };
    }
    s += v * dt;
    if (s >= t.marks.end) {
      frames.push(centre(t.x.length - 1)); motion.push({ h: 0, v });
      return { outcome: 'made_it', frames, leftAt, motion };
    }
  }
  return { outcome: 'stopped', frames, leftAt, motion };
}

/** The marble sliding back down the loop to its bottom, for the picture only. */
function runBack(t: Track, from: number, centre: (i: number) => Frame): { frames: Frame[]; motion: Motion[] } {
  const frames: Frame[] = [], motion: Motion[] = [];
  const steps = 24, top = t.y[indexAt(t, from)];
  for (let k = 1; k <= steps; k++) {
    const i = indexAt(t, from - ((from - t.marks.loopStart) * k) / steps);
    frames.push(centre(i));
    // Speed picked up sliding back down from where it stopped.
    motion.push({ h: t.y[i], v: Math.sqrt(Math.max(0, (2 * G * (top - t.y[i])) / ROLL)) });
  }
  return { frames, motion };
}

/** What happens from each peg of an item (cached per item). */
const cache = new Map<string, Outcome[]>();
export function pegOutcomes(c: Pick<LoopChallenge, 'pegs' | 'loopR' | 'carpet'>): Outcome[] {
  const key = `${c.loopR}|${c.carpet}|${c.pegs.join(',')}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const t = buildTrack(c);
  const out = c.pegs.map(h => runFrom(t, h).outcome);
  cache.set(key, out);
  return out;
}

/** The lowest peg (index) that gets the marble round, or -1. */
export const lowestWorking = (c: Pick<LoopChallenge, 'pegs' | 'loopR' | 'carpet'>) => pegOutcomes(c).indexOf('made_it');

// ============================================================================
// Items
// ============================================================================

const INSTRUCTION: Record<Tier, string> = {
  easy: 'Pick a peg to start the marble from, so it goes all the way round the loop and rings the bell.',
  medium: 'Find the lowest peg that still sends the marble all the way round the loop to the bell.',
  hard: 'There is a strip of carpet before the loop. Find the lowest peg that still gets the marble all the way round to the bell.',
};

export function makeLoop(id: string, loopR: number, pegs: number[], carpet: boolean, goal: 'any' | 'lowest', tier: Tier = goal === 'any' ? 'easy' : carpet ? 'hard' : 'medium'): LoopChallenge {
  return { id, type: 'make_the_loop', instruction: INSTRUCTION[tier], loopR, pegs, carpet, goal };
}

/**
 * Whether an item teaches what it is for: some pegs fail and at least two get round (so a guess is a real guess), and
 * above easy at least one peg is as high as the loop's top yet still fails (the "level with the top is enough"
 * misconception gets tested), and the working pegs all reach the bell.
 */
export function loopFair(c: Pick<LoopChallenge, 'pegs' | 'loopR' | 'carpet' | 'goal'>): boolean {
  const out = pegOutcomes(c);
  const first = out.indexOf('made_it');
  if (first < 2 || out.length - first < 2) return false;
  if (out.slice(first).some(o => o !== 'made_it')) return false;
  if (c.goal === 'lowest' && !c.pegs.some((h, i) => h >= 2 * c.loopR && out[i] !== 'made_it')) return false;
  return true;
}

const LOOP_RADII = [0.8, 0.9, 1.0, 1.1, 1.2];
const PEG_STEPS = [0.42, 0.46, 0.5, 0.55];

/** Every item a tier allows. */
export function loopCandidates(tier: Tier): LoopChallenge[] {
  const out: LoopChallenge[] = [];
  for (const R of LOOP_RADII) for (const step of PEG_STEPS) for (const base of [0, 1, 2]) {
    const pegs = Array.from({ length: PEG_COUNT }, (_, i) => Math.round((step * (i + 1 + base)) * 100) / 100);
    const c = makeLoop('cand', R, pegs, tier === 'hard', tier === 'easy' ? 'any' : 'lowest', tier);
    if (loopFair(c)) out.push(c);
  }
  return out;
}

export function pickLoops(n: number, tier: Tier, rng: Rng, idPrefix = 'loop'): LoopChallenge[] {
  const pool = loopCandidates(tier);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  // Different loop sizes first, so the items in a session differ.
  const picked: LoopChallenge[] = [];
  for (const c of pool) if (picked.length < n && !picked.some(p => p.loopR === c.loopR)) picked.push(c);
  for (const c of pool) if (picked.length < n && !picked.includes(c)) picked.push(c);
  return picked.slice(0, n).map((c, i) => ({ ...c, id: `${idPrefix}-${i + 1}` }));
}

// ============================================================================
// The check
// ============================================================================

export interface LoopRun { peg: number; outcome: Outcome }
export interface LoopAnswer { peg: number | null; runs: readonly LoopRun[] }
export type LoopMiss = 'too_low' | 'top_height_only' | 'not_lowest';

export const pegName = (i: number) => `peg ${i + 1}`;

export function loopMatches(c: LoopChallenge, x: LoopAnswer): boolean {
  if (x.peg == null) return false;
  const out = pegOutcomes(c);
  if (out[x.peg] !== 'made_it') return false;
  return c.goal === 'any' || x.peg === out.indexOf('made_it');
}

/** The named miss: a peg lower than the loop's top; a peg as high as the top that still fails; a peg that works when a
 *  lower one also does. */
export function loopMiss(c: LoopChallenge, x: LoopAnswer): LoopMiss | undefined {
  if (loopMatches(c, x) || x.peg == null) return undefined;
  if (pegOutcomes(c)[x.peg] === 'made_it') return 'not_lowest';
  return c.pegs[x.peg] >= 2 * c.loopR ? 'top_height_only' : 'too_low';
}

const runWords = (r: LoopRun) => `from ${pegName(r.peg)} it ${OUTCOME_WORDS[r.outcome]}`;

/** The learner's work in words, never which peg is the answer. */
export const describeLoop = (c: LoopChallenge, x: LoopAnswer) =>
  `ran the marble ${x.runs.length} ${x.runs.length === 1 ? 'time' : 'times'}${x.runs.length ? ` (${x.runs.map(runWords).join('; ')})` : ''}; `
  + `chose ${x.peg == null ? 'no peg' : pegName(x.peg)}`;

export function loopFeedback(c: LoopChallenge, x: LoopAnswer): string {
  const miss = loopMiss(c, x);
  if (!miss) {
    return c.goal === 'any'
      ? 'Round it goes! Starting higher gave the marble enough speed to stay on the track at the top of the loop.'
      : 'Yes! That is the lowest peg that works. Any lower and the marble is too slow at the top of the loop to stay on.';
  }
  if (miss === 'too_low') return 'From there the marble cannot even get as high as the top of the loop. Try starting it higher.';
  if (miss === 'top_height_only') return 'That peg is as high as the top of the loop, but the marble still fell. It needs to start higher, so it is still going fast at the top.';
  return 'It made it round! But a lower peg works too. Test lower pegs to find the lowest one that still makes it.';
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
