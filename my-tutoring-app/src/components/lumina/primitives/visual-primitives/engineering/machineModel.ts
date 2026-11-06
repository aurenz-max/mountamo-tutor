/**
 * Machine Workshop's pure model: what a machine's parts do to motion, and what happens when the learner's build runs.
 * No React. The 2D bench (`MachineBench.tsx`) draws the poses this file computes and decides nothing.
 *
 * A machine is a chain of stages from a power source to the end that does the work, the way motion flows through it:
 *   source (spin) → belt / gearbox (spin → spin) → converter (spin → up-and-down) → walking beam (up-and-down,
 *   flipped and scaled) → load (needs up-and-down: a pump, a needle, a saw blade, a stamp, a toy figure).
 * `assemblyErrors` checks any chain against that table, so a chain the author agent writes is tested by the same rules
 * the bench runs. On a spin_to_push item the converter is an empty slot. The learner builds it from two tray parts: one
 * on the shaft (crank disc, cam, pinion gear) and one to the slider (connecting rod, follower, rack). `runBuild` decides
 * what the machine then does:
 *   crank + long-enough rod, or cam + follower   → up-and-down; then the stroke must fit the load and the push be
 *                                                   strong enough;
 *   a rod on a part with no pin                 → no_pin (the rod has nothing to hang on);
 *   a follower on a round crank disc or a gear  → no_push (it just rides a round edge);
 *   a rack on a part with no teeth              → no_grip;
 *   pinion + rack                               → ran_out (it pushes one way until the rack runs out, then stops);
 *   a rod shorter than twice the crank's reach  → jams (it twists sideways and locks).
 * Stroke and force: a crank's stroke is twice its reach, a cam's is its lift; the push is the shaft's turning force
 * divided by half the stroke, so a bigger crank pushes farther but weaker (the hard tier's trade-off).
 */

export type Tier = 'easy' | 'medium' | 'hard';
export type Rng = () => number;

export const MACHINE_TASKS = ['spin_to_push'] as const;
export type MachineTask = typeof MACHINE_TASKS[number];

// ── The chain ───────────────────────────────────────────────────────────────

export const SOURCE_KINDS = ['motor', 'hand_crank', 'windmill', 'water_wheel'] as const;
export const SPIN_KINDS = ['belt', 'gearbox'] as const;
export const CONVERTER_KINDS = ['crank_rod', 'cam_follower'] as const;
export const LOAD_KINDS = ['pump', 'needle', 'saw', 'stamp', 'figure'] as const;
export const CHAIN_KINDS = [...SOURCE_KINDS, ...SPIN_KINDS, ...CONVERTER_KINDS, 'walking_beam', ...LOAD_KINDS] as const;
export type SourceKind = typeof SOURCE_KINDS[number];
export type ConverterKind = typeof CONVERTER_KINDS[number];
export type LoadKind = typeof LOAD_KINDS[number];
export type ChainKind = typeof CHAIN_KINDS[number];

export type Motion = 'spin' | 'push';
/** What each kind takes in and gives out. A source takes nothing; a load gives nothing. */
export const MOTION: Record<ChainKind, { in: Motion | null; out: Motion | null }> = {
  motor: { in: null, out: 'spin' }, hand_crank: { in: null, out: 'spin' }, windmill: { in: null, out: 'spin' },
  water_wheel: { in: null, out: 'spin' },
  belt: { in: 'spin', out: 'spin' }, gearbox: { in: 'spin', out: 'spin' },
  crank_rod: { in: 'spin', out: 'push' }, cam_follower: { in: 'spin', out: 'push' },
  walking_beam: { in: 'push', out: 'push' },
  pump: { in: 'push', out: null }, needle: { in: 'push', out: null }, saw: { in: 'push', out: null },
  stamp: { in: 'push', out: null }, figure: { in: 'push', out: null },
};
export const MOTION_WORDS: Record<Motion, string> = { spin: 'spinning', push: 'up-and-down' };

/** Plain names, for labels and for error messages the author agent reads. */
export const KIND_NAMES: Record<ChainKind, string> = {
  motor: 'Motor', hand_crank: 'Hand crank', windmill: 'Windmill', water_wheel: 'Water wheel', belt: 'Belt', gearbox: 'Gearbox',
  crank_rod: 'Crank and rod', cam_follower: 'Cam and follower', walking_beam: 'Walking beam', pump: 'Pump', needle: 'Needle',
  saw: 'Saw blade', stamp: 'Stamp', figure: 'Figure',
};

const isSource = (k: ChainKind) => (SOURCE_KINDS as readonly string[]).includes(k);
const isLoad = (k: ChainKind) => (LOAD_KINDS as readonly string[]).includes(k);
export const isConverter = (k: ChainKind): k is ConverterKind => (CONVERTER_KINDS as readonly string[]).includes(k);

/**
 * Does this chain assemble: a source first, a load last, each stage fed the motion it takes, one converter, at most
 * one walking beam? Empty means it assembles. Messages name the stage, so the author agent can fix it.
 */
export function assemblyErrors(chain: readonly ChainKind[]): string[] {
  const errs: string[] = [];
  if (chain.length < 3) errs.push('a machine needs at least a power source, a part that turns spinning into up-and-down, and a working end');
  if (!chain.length) return errs;
  if (!isSource(chain[0])) errs.push(`stage 1 must be a power source (${SOURCE_KINDS.join(', ')}), not ${chain[0]}`);
  if (!isLoad(chain[chain.length - 1])) errs.push(`the last stage must be the working end (${LOAD_KINDS.join(', ')}), not ${chain[chain.length - 1]}`);
  for (let i = 1; i < chain.length; i++) {
    const need = MOTION[chain[i]].in, have = MOTION[chain[i - 1]].out;
    if (need == null) errs.push(`stage ${i + 1} (${chain[i]}) is a power source; only stage 1 can be one`);
    else if (have == null) errs.push(`stage ${i + 1} (${chain[i]}) comes after ${chain[i - 1]}, which is a working end and gives no motion on`);
    else if (need !== have) errs.push(`stage ${i + 1} (${chain[i]}) needs ${MOTION_WORDS[need]} motion in, but after ${chain[i - 1]} the motion is ${MOTION_WORDS[have]}`);
  }
  const converters = chain.filter(isConverter).length;
  if (converters !== 1) errs.push(`the chain needs exactly one part that turns spinning into up-and-down (crank_rod or cam_follower); it has ${converters}`);
  if (chain.filter(k => k === 'walking_beam').length > 1) errs.push('at most one walking_beam');
  return errs;
}

// ── An item ─────────────────────────────────────────────────────────────────

export type DriverPart = 'crank' | 'cam' | 'pinion';
export type LinkPart = 'rod' | 'follower' | 'rack';
export type TrayKind = DriverPart | LinkPart;
export const DRIVER_PARTS: readonly DriverPart[] = ['crank', 'cam', 'pinion'];
export const isDriver = (p: TrayKind): p is DriverPart => (DRIVER_PARTS as readonly string[]).includes(p);

export type PartSize = 'small' | 'medium' | 'large' | 'short' | 'long' | 'one';
/** One part on the tray. `value` is the crank's reach, the cam's lift, the pinion's radius or the rod's length. */
export interface TrayPart { id: string; part: TrayKind; size: PartSize; value: number }

export const TRAY_NAMES: Record<TrayKind, string> = {
  crank: 'crank disc', cam: 'cam', pinion: 'gear', rod: 'connecting rod', follower: 'follower', rack: 'rack',
};
export const trayName = (p: TrayPart) => (p.size === 'one' ? TRAY_NAMES[p.part] : `${p.size} ${TRAY_NAMES[p.part]}`);

/** One stage on the bench. The slot (the converter) carries no words for the learner until the machine works. */
export interface Stage {
  kind: ChainKind;
  /** What this stage does in this machine, in the author's words for a child. */
  job: string;
}

export interface MachineChallenge {
  id: string;
  type: MachineTask;
  /** The real machine (`machineAtlas.ts`). */
  machine: string;
  name: string;
  /** Where it works, for the bench's sign ("an oil field"). */
  where: string;
  /** The author's one-line intro to this machine for this lesson. */
  intro: string;
  instruction: string;
  /** The chain, source first; exactly one converter, which is the slot the learner builds. */
  stages: Stage[];
  /** What the real machine uses in the slot: shown only after the learner's build works. */
  real: ConverterKind;
  /** How the principle works in this machine, said after the build works. */
  principle: string;
  /** What the working end does when it works ("pumps oil"). */
  doesWord: string;
  /** Pump fluid, when the load is a pump. */
  fluid?: 'oil' | 'water' | 'air';
  tray: TrayPart[];
  /** The up-and-down travel the load can use, at the converter (a walking beam's ratio is already folded in). */
  strokeMin: number;
  strokeMax: number;
  /** The push the load needs, at the converter, in the same units as `slotTorque / (stroke / 2)`. */
  forceNeed: number;
  /** The turning force on the slot shaft. */
  slotTorque: number;
  /** How far a rack can travel before it runs out. */
  rackTravel: number;
  supportTier?: Tier;
  /** Lever ids drawn from the start at this tier (none at birth). */
  startLevers?: string[];
}

export interface Build { driver: string | null; link: string | null }
export const EMPTY_BUILD: Build = { driver: null, link: null };

export const slotIndex = (c: Pick<MachineChallenge, 'stages'>) => c.stages.findIndex(s => isConverter(s.kind));
export const loadStage = (c: Pick<MachineChallenge, 'stages'>) => c.stages[c.stages.length - 1];
export const hasBeam = (c: Pick<MachineChallenge, 'stages'>) => c.stages.some(s => s.kind === 'walking_beam');

// ── Running a build ─────────────────────────────────────────────────────────

export type Outcome = 'works' | 'not_built' | 'no_pin' | 'no_push' | 'no_grip' | 'ran_out' | 'jams' | 'too_short' | 'hits_end' | 'stalls';
export const OUTCOMES: readonly Outcome[] = ['works', 'not_built', 'no_pin', 'no_push', 'no_grip', 'ran_out', 'jams', 'too_short', 'hits_end', 'stalls'];

export function outcomeWords(c: Pick<MachineChallenge, 'doesWord' | 'stages'>, o: Outcome): string {
  const end = KIND_NAMES[loadStage(c).kind].toLowerCase();
  switch (o) {
    case 'works': return `it works: it ${c.doesWord}`;
    case 'not_built': return 'nothing is built yet';
    case 'no_pin': return 'the wheel spun, but the rod had no peg to hook onto, so nothing moved';
    case 'no_push': return 'the wheel spun, but its edge is round all the way, so the follower never went up';
    case 'no_grip': return 'the wheel spun, but it has no teeth for the rack to grip, so nothing moved';
    case 'ran_out': return 'it pushed one way until the rack ran out, then it stopped';
    case 'jams': return 'the rod twisted sideways and locked';
    case 'too_short': return `it went up and down, but too little for the ${end} to do its job`;
    case 'hits_end': return `it went up and down too far and banged the end of the ${end}`;
    case 'stalls': return 'the motor strained and stopped: the push was too weak';
  }
}

/** One frame of a run: what the scene draws. Angles in radians, travel in bench units. */
export interface Pose {
  /** The slot shaft's angle (the driver's). Upstream shafts turn `slotAngle / ratio` (the scene's `stageAngle`). */
  slotAngle: number;
  /** How far up the slider is from its lowest point, at the converter. */
  d: number;
  /** A shake to draw on a stop (0 none, 1 hard). */
  shake: number;
  /** The working end is doing its job this frame (water spurts, a stitch, a chip of wood). */
  effect: boolean;
}

export interface MachineRun { outcome: Outcome; stroke: number; force: number; frames: Pose[] }

export const RUN_SECONDS = 4;
const FPS = 60;
/** The slot shaft's speed on the bench, in turns a second. */
const SLOT_TURNS = 0.6;

/** The slider's travel at a crank angle (0 = pin at the top): crank-slider kinematics, from its lowest point. */
export function crankLift(r: number, L: number, phi: number): number {
  const h = r * Math.cos(phi) + Math.sqrt(Math.max(0, L * L - (r * Math.sin(phi)) ** 2));
  return h - (L - r);
}
/** A cam's lift at an angle (an even rise and fall, highest at 0). */
export const camLift = (lift: number, phi: number) => (lift * (1 + Math.cos(phi))) / 2;

/** The rod angle past which a crank-slider binds: sin(rod angle) = r sin(phi) / L must stay under 1/2. */
const BIND = 0.5;

/** What a build does, before any frames: the outcome, the stroke and the push. */
export function judgeBuild(c: MachineChallenge, b: Build): { outcome: Outcome; stroke: number; force: number } {
  const driver = c.tray.find(p => p.id === b.driver);
  const link = c.tray.find(p => p.id === b.link);
  if (!driver || !link) return { outcome: 'not_built', stroke: 0, force: 0 };
  if (link.part === 'rod' && driver.part !== 'crank') return { outcome: 'no_pin', stroke: 0, force: 0 };
  if (link.part === 'follower' && driver.part !== 'cam') return { outcome: 'no_push', stroke: 0, force: 0 };
  if (link.part === 'rack' && driver.part !== 'pinion') return { outcome: 'no_grip', stroke: 0, force: 0 };
  if (link.part === 'rack') return { outcome: 'ran_out', stroke: c.rackTravel, force: c.slotTorque / driver.value };
  if (link.part === 'rod' && driver.value > BIND * link.value) return { outcome: 'jams', stroke: 0, force: 0 };
  const stroke = driver.part === 'crank' ? 2 * driver.value : driver.value;
  const force = c.slotTorque / (stroke / 2);
  if (force < c.forceNeed) return { outcome: 'stalls', stroke, force };
  if (stroke < c.strokeMin) return { outcome: 'too_short', stroke, force };
  if (stroke > c.strokeMax) return { outcome: 'hits_end', stroke, force };
  return { outcome: 'works', stroke, force };
}

/** The run, frame by frame (60 a second, `RUN_SECONDS` long). */
export function runBuild(c: MachineChallenge, b: Build): MachineRun {
  const { outcome, stroke, force } = judgeBuild(c, b);
  const driver = c.tray.find(p => p.id === b.driver);
  const link = c.tray.find(p => p.id === b.link);
  const n = RUN_SECONDS * FPS;
  const w = 2 * Math.PI * SLOT_TURNS;
  const frames: Pose[] = [];
  // Where the travel is at an angle, for the parts that move the slider.
  const lift = (phi: number) => {
    if (!driver || !link) return 0;
    if (driver.part === 'crank' && link.part === 'rod') return crankLift(driver.value, link.value, phi);
    if (driver.part === 'cam' && link.part === 'follower') return camLift(driver.value, phi);
    if (driver.part === 'pinion' && link.part === 'rack') return Math.min(c.rackTravel, driver.value * phi);
    if (driver.part === 'pinion' && link.part === 'follower') return 0.015 * Math.abs(Math.sin(10 * phi));
    return 0;
  };
  // The angle a stop happens at, or Infinity when the machine keeps going.
  let stopAt = Infinity;
  if (outcome === 'ran_out' && driver) stopAt = c.rackTravel / driver.value;
  if (outcome === 'jams' && driver && link) stopAt = Math.asin(Math.min(1, (BIND * link.value) / driver.value));
  if (outcome === 'hits_end' && driver && link) {
    // Turn from the bottom (phi = pi) up until the travel passes what the load allows.
    for (let phi = Math.PI; phi < 3 * Math.PI; phi += 0.01) if (lift(phi) > c.strokeMax) { stopAt = phi; break; }
  }
  if (outcome === 'stalls') stopAt = Math.PI + 0.45;
  const start = outcome === 'hits_end' || outcome === 'stalls' ? Math.PI : outcome === 'jams' ? 0 : 0;
  const strikesLow = loadStage(c).kind === 'stamp' && !hasBeam(c);
  let stoppedAt = -1;
  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    // A stall creeps; everything else turns at the bench speed.
    let phi = start + (outcome === 'stalls' ? Math.min(0.45, 0.4 * t) : w * t);
    if (outcome !== 'jams' && outcome !== 'ran_out' && phi - start >= stopAt - start) phi = stopAt;
    if ((outcome === 'jams' || outcome === 'ran_out') && phi >= stopAt) phi = stopAt;
    const stopped = Number.isFinite(stopAt) && phi >= stopAt - 1e-9;
    if (stopped && stoppedAt < 0) stoppedAt = i;
    const shake = stopped ? Math.max(0, 1 - (i - stoppedAt) / (0.8 * FPS)) : 0;
    const d = lift(phi);
    // The working end does its job at the top of the travel; a stamp with no beam strikes at the bottom (it drops).
    const effect = outcome === 'works' && stroke > 0 && (strikesLow ? d < 0.12 * stroke : d > 0.85 * stroke);
    frames.push({ slotAngle: phi, d, shake, effect });
  }
  return { outcome, stroke, force, frames };
}

/** Every tray pairing and what it does: the generator's fairness check and the tests' oracle. */
export function allBuilds(c: MachineChallenge): Array<{ build: Build; outcome: Outcome }> {
  const drivers = c.tray.filter(p => isDriver(p.part));
  const links = c.tray.filter(p => !isDriver(p.part));
  return drivers.flatMap(d => links.map(l => {
    const build = { driver: d.id, link: l.id };
    return { build, outcome: judgeBuild(c, build).outcome };
  }));
}
export const workingBuilds = (c: MachineChallenge) => allBuilds(c).filter(x => x.outcome === 'works').map(x => x.build);

// ── The check ───────────────────────────────────────────────────────────────

export interface MachineAnswer { build: Build; runs: readonly MachineRunRow[] }
export interface MachineRunRow { driver: string; link: string; outcome: Outcome }

export const machineMatches = (c: MachineChallenge, a: MachineAnswer) => judgeBuild(c, a.build).outcome === 'works';

/** The named wrong build, from what it did. */
export function machineMiss(c: MachineChallenge, a: MachineAnswer): string | undefined {
  switch (judgeBuild(c, a.build).outcome) {
    case 'no_pin': case 'no_push': case 'no_grip': return 'wrong_pair';
    case 'ran_out': return 'one_way_only';
    case 'jams': return 'rod_too_short';
    case 'too_short': return 'stroke_too_small';
    case 'hits_end': return 'stroke_too_big';
    case 'stalls': return 'too_weak';
    default: return undefined;
  }
}

const partName = (c: MachineChallenge, id: string | null) => {
  const p = c.tray.find(x => x.id === id);
  return p ? trayName(p) : 'nothing';
};

/** The learner's work in words (never the key). */
export function describeMachine(c: MachineChallenge, a: MachineAnswer): string {
  return `built the ${c.name}'s missing part from a ${partName(c, a.build.driver)} on the shaft and a `
    + `${partName(c, a.build.link)} to the slider; ${outcomeWords(c, judgeBuild(c, a.build).outcome)}`
    + (a.runs.length ? `; ran ${a.runs.length} build${a.runs.length === 1 ? '' : 's'} first` : '');
}

const REAL_WORDS: Record<ConverterKind, string> = { crank_rod: 'a crank and a connecting rod', cam_follower: 'a cam and a follower' };

/** What the learner reads after the check. */
export function machineFeedback(c: MachineChallenge, a: MachineAnswer): string {
  const o = judgeBuild(c, a.build).outcome;
  if (o === 'works') {
    const d = c.tray.find(p => p.id === a.build.driver);
    const same = (d?.part === 'crank' && c.real === 'crank_rod') || (d?.part === 'cam' && c.real === 'cam_follower');
    return `Your ${c.name} ${c.doesWord}! ${c.principle} ${same ? `A real ${c.name.toLowerCase()} uses ${REAL_WORDS[c.real]} too.`
      : `Your build works; a real ${c.name.toLowerCase()} uses ${REAL_WORDS[c.real]}.`}`;
  }
  switch (o) {
    case 'not_built': return 'Put one part on the spinning wheel and one part to join it to the machine first.';
    case 'no_pin': return 'A connecting rod hooks onto a peg, and that wheel has no peg. Which wheel has a peg that goes round in a circle?';
    case 'no_push': return "The follower rests on the wheel's edge. A round edge never lifts it. Which wheel has a bump?";
    case 'no_grip': return 'A rack needs teeth to grip, and that wheel has none.';
    case 'ran_out': return 'The gear pushed the rack one way until it ran out. The machine needs up AND down, over and over.';
    case 'jams': return 'The rod is too short for that crank: it twisted sideways and locked. Try a longer rod or a smaller crank.';
    case 'too_short': return `It goes up and down, but not far enough for the ${KIND_NAMES[loadStage(c).kind].toLowerCase()}. Try a bigger part.`;
    case 'hits_end': return `It goes up and down too far and bangs the end. Try a smaller part.`;
    case 'stalls': return 'The motor strained and stopped. A bigger crank pushes farther but weaker. Try one that still fits.';
    default: return '';
  }
}

/** What the working end is called in a child's words ("the needle", "the bird"). */
export const endWord = (k: ChainKind) => (k === 'figure' ? 'bird' : KIND_NAMES[k].toLowerCase());

/**
 * What each tray part IS, in what can be seen of it, never what it is for: a learner who has never seen a crank can
 * still reason "a peg that goes round + a stick that hooks onto it". Shown beside the tray at every tier.
 */
export const PART_GUIDE: Record<TrayKind, string> = {
  crank: 'a wheel with a peg near its edge: as it turns, the peg goes round in a circle',
  cam: 'a wheel with one bump: as it turns, the bump comes round once every turn',
  pinion: 'a small wheel with teeth all the way round',
  rod: 'a stiff stick with a hole at one end that hooks onto a peg',
  follower: "a rod with a little roller that rests on top of a wheel's edge",
  rack: 'a straight bar with teeth along one side',
};

// ── Building items (the generator's numbers) ────────────────────────────────

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

export function shuffle<T>(xs: readonly T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** The words an item carries, from the author agent (or the atlas when it failed). */
export interface ItemWords {
  machine: string; name: string; where: string; intro: string; principle: string; doesWord: string;
  fluid?: 'oil' | 'water' | 'air'; stages: Stage[]; real: ConverterKind;
}

/**
 * The numbers and tray for one item, from the tier. Every tier has exactly two working builds (crank + long rod at the
 * medium size, cam + follower at the medium lift), and the failures the tier is about:
 *   easy   one crank, one cam, a gear; a long rod, a follower, a rack: only the pairing matters;
 *   medium three crank sizes and a short rod: too small, too far, and a rod that jams;
 *   hard   as medium, the large crank's stroke fits but its push is too weak, and a large cam stalls the same way.
 */
export function buildItem(id: string, words: ItemWords, tier: Tier, band: 'K-2' | '3-5' | '6-8', rng: Rng): MachineChallenge {
  const sc = [0.9, 1, 1.12][Math.floor(rng() * 3)];
  const r = { small: round2(0.18 * sc), medium: round2(0.3 * sc), large: round2(0.45 * sc) };
  const rod = { short: round2(0.55 * sc), long: round2(1.35 * sc) };
  const lift = { medium: round2(2 * r.medium), large: round2(2 * r.large) };
  const slotTorque = 1;
  const strokeMin = tier === 'easy' ? round2(0.3 * sc) : round2(0.48 * sc);
  const strokeMax = tier === 'medium' ? round2(0.75 * sc) : round2(1.05 * sc);
  // Hard: medium's push is torque / r.medium; the large one's is torque / r.large. Need sits between them.
  const forceNeed = tier === 'hard' ? round2(slotTorque / ((r.medium + r.large) / 2)) : 0.1;
  const parts: TrayPart[] = [];
  const add = (part: TrayKind, size: PartSize, value: number) => parts.push({ id: `${part}-${size}`, part, size, value });
  if (tier === 'easy') {
    add('crank', 'one', r.medium); add('cam', 'one', lift.medium); add('pinion', 'one', round2(0.3 * sc));
    add('rod', 'one', rod.long); add('follower', 'one', 0); add('rack', 'one', 0);
  } else {
    add('crank', 'small', r.small); add('crank', 'medium', r.medium); add('crank', 'large', r.large);
    add('cam', tier === 'hard' ? 'medium' : 'one', lift.medium);
    if (tier === 'hard') add('cam', 'large', lift.large);
    add('pinion', 'one', round2(0.3 * sc));
    add('rod', 'short', rod.short); add('rod', 'long', rod.long); add('follower', 'one', 0); add('rack', 'one', 0);
  }
  const drivers = shuffle(parts.filter(p => isDriver(p.part)), rng);
  const links = shuffle(parts.filter(p => !isDriver(p.part)), rng);
  const end = endWord(words.stages[words.stages.length - 1].kind);
  const instruction = band === 'K-2'
    ? `The wheel spins round and round, but the ${end} must go up and down. Pick a part for the wheel and a part to join it to the ${end}, then press Run!`
    : `The wheel only spins round and round, but the ${end} has to go up and down. Pick one part for the spinning wheel and one part to join it to the ${end}, then press Run to test your idea.`;
  return {
    id, type: 'spin_to_push', machine: words.machine, name: words.name, where: words.where, intro: words.intro,
    instruction, stages: words.stages, real: words.real, principle: words.principle, doesWord: words.doesWord,
    ...(words.fluid ? { fluid: words.fluid } : {}),
    tray: [...drivers, ...links], strokeMin, strokeMax, forceNeed, slotTorque, rackTravel: round2(0.35 * sc), supportTier: tier,
  };
}

/** The tier's promise holds: exactly two working builds, one crank + rod and one cam + follower. */
export function machineFair(c: MachineChallenge): boolean {
  const works = workingBuilds(c);
  if (works.length !== 2) return false;
  const kinds = works.map(b => c.tray.find(p => p.id === b.driver)?.part).sort().join(',');
  if (kinds !== 'cam,crank') return false;
  const outcomes = new Set(allBuilds(c).map(x => x.outcome));
  const want: Outcome[] = c.supportTier === 'easy' ? ['no_pin', 'ran_out']
    : c.supportTier === 'hard' ? ['too_short', 'jams', 'stalls'] : ['too_short', 'hits_end', 'jams'];
  return want.every(o => outcomes.has(o));
}
