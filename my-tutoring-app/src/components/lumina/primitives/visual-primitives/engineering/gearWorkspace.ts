/**
 * Gear train builder on the shared tutor/JEV teaching workspace (W1 binding) and its three open builds
 * (/add-eval-modes references/build-mode.md):
 * - `build_direction`: "Build a gear train of at least 3 gears where the last gear turns the same way as the first."
 * - `build_speed`: "...where the last gear turns faster than the first" (optionally: and the same way).
 * - `build_ratio`: "...where the last gear turns 3 times for every 1 turn of the first" (optionally with a direction).
 *
 * Pure: the component, the generator, the oracle, the journey row and the tests read the same train, check, misses,
 * targets and scene. The learner adds gears to the end of one train, each meshing with the one before, so every gear
 * turns. Meshed gears turn opposite ways, and a gear turns (driver teeth / its teeth) times per turn of the driver:
 * the last gear's way depends only on how many gears there are, its speed only on the first and last gear's teeth.
 * Code owns every target and the check; the model writes only a title.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';

export type GearMode = 'build_direction' | 'build_speed' | 'build_ratio';
export const GEAR_MODES: readonly GearMode[] = ['build_direction', 'build_speed', 'build_ratio'];

/** The tray: tooth counts. A gear's size is in proportion to its teeth (every tooth is the same size). */
export const TEETH: readonly number[] = [8, 12, 16, 24, 32];
export const MAX_GEARS = 6;

export interface TrainGear { id: string; teeth: number }
export type Way = 'same' | 'opposite';

export interface GearChallenge {
  id: string;
  type: GearMode;
  /** The way the last gear must turn, compared with the first. Required on build_direction. */
  way?: Way;
  /** build_speed: faster or slower than the first gear. */
  speed?: 'faster' | 'slower';
  /** build_ratio: turns of the last gear per turn of the first (2, 3, 4, 1/2, 1/3). */
  ratio?: number;
  /** The fewest gears the ask allows (stated in the ask on build_direction). */
  minGears: number;
  instruction: string;
}

const EPS = 1e-9;

/** How the last gear turns for one turn of the first: its way and how many turns. */
export function lastGearTurns(train: readonly TrainGear[]): { way: Way; turns: number } | null {
  if (train.length < 2) return null;
  return { way: train.length % 2 === 1 ? 'same' : 'opposite', turns: train[0].teeth / train[train.length - 1].teeth };
}

// ── The check ────────────────────────────────────────────────────────────────

/**
 * What a wrong train shows (`TeachingAttempt.miss`), in the order the activity tests it:
 * - `too_few_gears`: fewer gears than the ask allows (always fewer than two: nothing is driven);
 * - `not_faster` / `not_slower` (build_speed): the last gear turns as fast as or slower than the first, or as slow
 *   as or faster than it;
 * - `too_fast` / `too_slow` (build_ratio): the last gear turns more, or fewer, times than asked;
 * - `wrong_direction`: the speed is right (or not asked), but the last gear turns the other way.
 */
export type GearMiss = 'too_few_gears' | 'not_faster' | 'not_slower' | 'too_fast' | 'too_slow' | 'wrong_direction';
export const GEAR_MISSES: Record<GearMode, readonly GearMiss[]> = {
  build_direction: ['too_few_gears', 'wrong_direction'],
  build_speed: ['too_few_gears', 'not_faster', 'not_slower', 'wrong_direction'],
  build_ratio: ['too_few_gears', 'too_fast', 'too_slow', 'wrong_direction'],
};

export function gearMiss(c: GearChallenge, train: readonly TrainGear[]): GearMiss | undefined {
  const last = lastGearTurns(train);
  if (!last || train.length < c.minGears) return 'too_few_gears';
  if (c.type === 'build_speed') {
    if (c.speed === 'faster' && !(last.turns > 1 + EPS)) return 'not_faster';
    if (c.speed === 'slower' && !(last.turns < 1 - EPS)) return 'not_slower';
  }
  if (c.type === 'build_ratio' && c.ratio !== undefined) {
    if (last.turns > c.ratio + EPS) return 'too_fast';
    if (last.turns < c.ratio - EPS) return 'too_slow';
  }
  if (c.way && last.way !== c.way) return 'wrong_direction';
  return undefined;
}

// ── Targets, written by code ─────────────────────────────────────────────────

const RATIO_WORDS = (r: number) => (r >= 1 ? `${r} times for every 1 turn of the first gear` : `once for every ${Math.round(1 / r)} turns of the first gear`);
const WAY_WORDS: Record<Way, string> = { same: 'the same way as', opposite: 'the opposite way to' };

export function gearAsk(c: Pick<GearChallenge, 'type' | 'way' | 'speed' | 'ratio' | 'minGears'>): string {
  if (c.type === 'build_direction') {
    return `Build a gear train of at least ${c.minGears} gears where the last gear turns ${WAY_WORDS[c.way ?? 'same']} the first gear.`;
  }
  const way = c.way ? `, and turns ${c.way === 'same' ? 'the same way' : 'the opposite way'}` : '';
  if (c.type === 'build_speed') return `Build a gear train where the last gear turns ${c.speed} than the first gear${way}.`;
  return `Build a gear train where the last gear turns ${RATIO_WORDS(c.ratio ?? 2)}${way}.`;
}

type Target = Omit<GearChallenge, 'id' | 'instruction'>;
const item = (t: Target, id: string): GearChallenge => ({ ...t, id, instruction: gearAsk(t) });

/** The fewest gears that make a target: one more when the last gear must turn the same way. */
const fewest = (way?: Way) => (way === 'same' ? 3 : 2);

export type GearBand = 'K-1' | '2-3' | '4-5';
export function gearBand(grade?: string, gradeContext = ''): GearBand {
  const g = (grade ?? '').toUpperCase();
  if (g === 'K' || g === '1') return 'K-1';
  if (g === '2' || g === '3') return '2-3';
  if (/^\d+$/.test(g)) return '4-5';
  return /kinder|pre-?k|toddler/i.test(gradeContext) ? 'K-1' : '2-3';
}

/** Each band's targets per mode, easiest first. A session takes distinct ones. */
const POOLS: Record<GearMode, Record<GearBand, readonly Target[]>> = {
  build_direction: {
    'K-1': [{ type: 'build_direction', way: 'opposite', minGears: 2 }, { type: 'build_direction', way: 'same', minGears: 3 },
      { type: 'build_direction', way: 'opposite', minGears: 4 }],
    '2-3': [{ type: 'build_direction', way: 'same', minGears: 3 }, { type: 'build_direction', way: 'opposite', minGears: 4 },
      { type: 'build_direction', way: 'same', minGears: 5 }],
    // At most 5: a train one gear longer than the ask (the journey's wrong train) still fits the 6-gear track.
    '4-5': [{ type: 'build_direction', way: 'same', minGears: 3 }, { type: 'build_direction', way: 'opposite', minGears: 4 },
      { type: 'build_direction', way: 'same', minGears: 5 }],
  },
  build_speed: {
    'K-1': [{ type: 'build_speed', speed: 'faster', minGears: 2 }, { type: 'build_speed', speed: 'slower', minGears: 2 },
      { type: 'build_speed', speed: 'faster', way: 'opposite', minGears: 2 }],
    '2-3': [{ type: 'build_speed', speed: 'faster', minGears: 2 }, { type: 'build_speed', speed: 'slower', minGears: 2 },
      { type: 'build_speed', speed: 'faster', way: 'same', minGears: 3 }, { type: 'build_speed', speed: 'slower', way: 'same', minGears: 3 }],
    '4-5': [{ type: 'build_speed', speed: 'faster', way: 'same', minGears: 3 }, { type: 'build_speed', speed: 'slower', way: 'opposite', minGears: 2 },
      { type: 'build_speed', speed: 'slower', way: 'same', minGears: 3 }],
  },
  build_ratio: {
    'K-1': [{ type: 'build_ratio', ratio: 2, minGears: 2 }, { type: 'build_ratio', ratio: 1 / 2, minGears: 2 }, { type: 'build_ratio', ratio: 3, minGears: 2 }],
    '2-3': [{ type: 'build_ratio', ratio: 2, minGears: 2 }, { type: 'build_ratio', ratio: 1 / 2, minGears: 2 }, { type: 'build_ratio', ratio: 3, minGears: 2 },
      { type: 'build_ratio', ratio: 2, way: 'same', minGears: 3 }],
    '4-5': [{ type: 'build_ratio', ratio: 2, way: 'same', minGears: 3 }, { type: 'build_ratio', ratio: 3, minGears: 2 },
      { type: 'build_ratio', ratio: 1 / 3, way: 'same', minGears: 3 }, { type: 'build_ratio', ratio: 4, way: 'opposite', minGears: 2 },
      { type: 'build_ratio', ratio: 1 / 2, way: 'opposite', minGears: 2 }],
  },
};

/** The modes a mixed (unpinned) session holds per band, easiest first: every tier the band can build. */
export const MIXED_MODES: Record<GearBand, readonly GearMode[]> = {
  'K-1': ['build_direction', 'build_direction', 'build_speed'],
  '2-3': ['build_direction', 'build_speed', 'build_speed'],
  '4-5': ['build_speed', 'build_ratio', 'build_ratio'],
};

/** A session: one target per slot, no target asked twice, in mode order then pool order (easiest first). */
export function gearChallenges(modes: readonly GearMode[], band: GearBand, count = 3, random: () => number = Math.random): GearChallenge[] {
  const slots = Array.from({ length: count }, (_, i) => modes[i % modes.length]);
  const picked: Array<{ t: Target; rank: number }> = [];
  for (const mode of Array.from(new Set(slots))) {
    // A random subset of the mode's pool, as many as its slots; the sort below keeps easiest first.
    const want = slots.filter(m => m === mode).length;
    const pool = POOLS[mode][band].map((t, rank) => ({ t, rank, r: random() })).sort((a, b) => a.r - b.r);
    picked.push(...pool.slice(0, want));
  }
  return picked
    .sort((a, b) => GEAR_MODES.indexOf(a.t.type) - GEAR_MODES.indexOf(b.t.type) || a.rank - b.rank)
    .map((p, i) => item(p.t, `gears-${i + 1}`));
}

/** A train that passes a target, used by the journey and the oracle's sibling checks: driver then the last gear, idlers between. */
export function referenceTrain(c: Pick<GearChallenge, 'type' | 'way' | 'speed' | 'ratio' | 'minGears'>): number[] {
  let pair: [number, number];
  if (c.type === 'build_ratio') {
    const r = c.ratio ?? 2;
    pair = r >= 1 ? [8 * r, 8] : [8, 8 / r];
  } else if (c.type === 'build_speed') pair = c.speed === 'slower' ? [12, 24] : [24, 12];
  else pair = [16, 16];
  let n = Math.max(2, c.minGears);
  if (c.way && (n % 2 === 1 ? 'same' : 'opposite') !== c.way) n++;
  return [pair[0], ...Array(n - 2).fill(16), pair[1]];
}

// ── Assignment, work, scene ──────────────────────────────────────────────────

export const workspaceAssignment = (c: GearChallenge): TeachingAssignment => ({ id: c.id, task: c.instruction, response: 'gesture' });

/** The learner's train in their own terms: how many gears and their teeth, first to last. Never a way or a speed. */
export function describeTrain(train: readonly TrainGear[]): string {
  if (!train.length) return 'No gears yet';
  return `${train.length} gear${train.length === 1 ? '' : 's'}, first to last: ${train.map(g => `${g.teeth} teeth`).join(', ')}`;
}

/** What is drawn and asked. No way, speed or verdict is published; the gears are the learner's. */
export function workspaceScene(c: GearChallenge, train: readonly TrainGear[]): WorkspaceScene {
  return { objects: [], facts: {
    kind: c.type,
    scene: 'an empty track; the learner taps a gear size in the tray to add a gear to the end of the train, where it meshes '
      + 'with the gear before it. The first gear has a crank. Tapping a gear in the train takes it out and the rest close up',
    gearsInTray: TEETH.map(t => `${t} teeth`).join(', '),
    // The made train as numbers, so the shared work history records a revision (`gearsPlaced 0 -> 4 -> 3`).
    gearsPlaced: train.length, firstGearTeeth: train[0]?.teeth ?? 0, lastGearTeeth: train.length > 1 ? train[train.length - 1].teeth : 0,
    learnerWork: describeTrain(train),
    constraints: 'The learner builds the train and presses "I\'m done!"; the activity turns the crank and checks the last gear. '
      + 'You cannot add, remove or turn a gear.',
  } };
}

// ── The build watcher's leak rules ───────────────────────────────────────────

/** Words that would say how the last gear turns, which is the skill. Size words are allowed: they describe the build. */
export const WATCH_NEVER_SAY = ['fast', 'faster', 'fastest', 'slow', 'slower', 'slowest', 'quick', 'quickly', 'speed', 'same', 'opposite',
  'way', 'direction', 'clockwise', 'counterclockwise', 'anticlockwise', 'backward', 'backwards', 'forward', 'turn', 'turns', 'turning',
  'spin', 'spins', 'spinning', 'rotate', 'rotates', 'times', 'twice', 'half', 'ratio', 'right', 'wrong', 'correct'];

// ── The journey's learner (liveJourneySpec row, the dry sweep, the browser drive) ──

export type GearHarnessInput = { type: 'touch'; target: string } | { type: 'choose'; label: string };

/**
 * Real-control inputs for one item: clear a kept train, add the reference train, press I'm done!. Wrong: the
 * reference train one gear short of its way (`wrong_direction`) where a way is asked, else with the first and last
 * gear swapped (`not_faster`/`not_slower`/`too_fast`/`too_slow`), else one gear (`too_few_gears`).
 */
export function gearHarnessInputs(c: GearChallenge, wrong: boolean, demand?: Record<string, unknown> | null): GearHarnessInput[] {
  const clear: GearHarnessInput[] = Number(demand?.gearsPlaced ?? 0) > 0 ? [{ type: 'choose', label: 'Clear' }] : [];
  let teeth = referenceTrain(c);
  if (wrong) {
    if (c.type === 'build_direction') teeth = [...teeth.slice(0, -1), 16, teeth[teeth.length - 1]];
    else if (c.type === 'build_speed' || c.type === 'build_ratio') teeth = [teeth[teeth.length - 1], ...teeth.slice(1, -1), teeth[0]];
    else teeth = teeth.slice(0, 1);
  }
  return [...clear, ...teeth.map(t => ({ type: 'touch' as const, target: `tray-${t}` })), { type: 'choose', label: "I'm done!" }];
}
