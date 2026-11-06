/**
 * Skid steer yard, the domain: the machine, its two lever-driven sides, the yard and the check. Pure (no three.js),
 * so the generator, the workspace module, the boss, the 3D scene and the tests share one source.
 *
 * A skid steer has no steering wheel. The wheels on each side are chained together and driven on their own, and the
 * operator sets each side forward, stopped or back. Both sides the same way: it drives straight. One side stopped: it
 * pivots around the stopped side. One side forward and one back: it spins in place, and needs the least room. Every
 * turn scrapes the tyres sideways across the ground, which is where the name comes from.
 *
 * Frame: the yard seen from above, x to the machine's right at the start, y straight ahead; the machine starts at the
 * origin facing +y. A heading `th` is radians counter-clockwise from +y.
 *
 * set_levers: the ask names a thing in the yard (a hay bale, a pile of dirt) that sits off to one side. The learner sets
 * the two levers and presses Go; one Go is one move (a quarter turn, or one machine length straight). The move is
 * right when the machine ends facing the thing without bumping anything. How much room the yard leaves is the
 * difficulty: open (any turn toward it works), a wall in front or behind (one pivot bumps), boxed in (only a spin fits).
 */
import type { SkidSteerMiss } from './skidSteerYard.card';

export const SKID_STEER_TASKS = ['match_attachment', 'set_levers'] as const;
export type SkidSteerTask = typeof SKID_STEER_TASKS[number];
export type SkidSteerBand = 'K-2' | '3-5';

export const LEVERS = ['fwd', 'stop', 'back'] as const;
export type Lever = typeof LEVERS[number];
const LEVER_SPEED: Record<Lever, number> = { fwd: 1, stop: 0, back: -1 };

export const GOAL_THINGS = ['dirt pile', 'hay bale', 'pallet of bricks', 'log pile', 'dump truck', 'little tree'] as const;
export type GoalThing = typeof GOAL_THINGS[number];
export type Side = 'left' | 'right';
/** How much room the yard leaves around the machine. */
export type Room = 'open' | 'wall_front' | 'wall_back' | 'boxed';

// ── The machine (metres) ─────────────────────────────────────────────────────────────────────────────────
/** Distance between the left and right wheel lines. */
export const TRACK = 1.5;
/** The footprint around the turning centre: the body is 1.8 wide; the bucket reaches 2.0 ahead, the back 1.3 behind. */
export const HALF_W = 0.9, FRONT = 2.0, REAR = 1.3;
/** One straight move: a little more than a machine length. */
export const STRAIGHT = 3.0;

export interface Pose { x: number; y: number; th: number }
export const START: Pose = { x: 0, y: 0, th: 0 };

/** An axis-aligned concrete barrier, centre and half sizes. */
export interface Barrier { cx: number; cy: number; hx: number; hy: number }

export interface SetLeversChallenge {
  id: string;
  type: 'set_levers';
  /** The thing to face, and which side of the machine it sits on (drawn there; never in the ask). */
  goal: GoalThing;
  side: Side;
  room: Room;
  barriers: Barrier[];
  instruction: string;
}
/**
 * match_attachment: a job waits in front of the machine (a pallet of bricks to lift, a path to sweep). The learner
 * picks one of the attachments offered, which clicks onto the quick-attach plate, and presses Do the job. The right
 * tool does the job; a wrong one visibly cannot.
 */
export interface MatchAttachmentChallenge {
  id: string;
  type: 'match_attachment';
  job: Job;
  /** The tools on offer, in screen order: the right one, any near miss, and others. */
  options: Attachment[];
  instruction: string;
}

export type SkidSteerChallenge = SetLeversChallenge | MatchAttachmentChallenge;

export interface Levers { left: Lever; right: Lever }

// ── Kinematics ──────────────────────────────────────────────────────────────────────────────────────────

/** What a lever setting does: drives straight, turns, or nothing. */
export type MoveKind = 'none' | 'straight' | 'pivot' | 'spin';
export interface Move {
  kind: MoveKind;
  /** +1 forward / -1 back (straight); +1 left / -1 right (turns). */
  dir: number;
  /** A pivot's stopped side. */
  around?: Side;
}

export function moveOf(l: Levers): Move {
  const vl = LEVER_SPEED[l.left], vr = LEVER_SPEED[l.right];
  if (vl === 0 && vr === 0) return { kind: 'none', dir: 0 };
  if (vl === vr) return { kind: 'straight', dir: vl };
  const dir = Math.sign(vr - vl); // the right side faster turns the nose left
  if (vl === 0 || vr === 0) return { kind: 'pivot', dir, around: vl === 0 ? 'left' : 'right' };
  return { kind: 'spin', dir };
}

const fwd = (th: number) => ({ x: -Math.sin(th), y: Math.cos(th) });
const rgt = (th: number) => ({ x: Math.cos(th), y: Math.sin(th) });

/** The machine's pose `t` (0..1) of the way through one move from `p`. Exact arcs, no integration drift. */
export function poseAt(p: Pose, l: Levers, t: number): Pose {
  const m = moveOf(l);
  if (m.kind === 'none') return p;
  if (m.kind === 'straight') {
    const f = fwd(p.th), d = m.dir * STRAIGHT * t;
    return { x: p.x + f.x * d, y: p.y + f.y * d, th: p.th };
  }
  const dth = m.dir * (Math.PI / 2) * t;
  if (m.kind === 'spin') return { ...p, th: p.th + dth };
  // A pivot turns about the stopped side's wheel line, half the track from the centre.
  const r = rgt(p.th), s = m.around === 'right' ? 1 : -1;
  const px = p.x + r.x * s * TRACK / 2, py = p.y + r.y * s * TRACK / 2;
  const dx = p.x - px, dy = p.y - py, c = Math.cos(dth), sn = Math.sin(dth);
  return { x: px + dx * c - dy * sn, y: py + dx * sn + dy * c, th: p.th + dth };
}

/** The four footprint corners at a pose (front-left, front-right, rear-right, rear-left). */
export function corners(p: Pose): Array<{ x: number; y: number }> {
  const f = fwd(p.th), r = rgt(p.th);
  return ([[-HALF_W, FRONT], [HALF_W, FRONT], [HALF_W, -REAR], [-HALF_W, -REAR]] as const)
    .map(([a, b]) => ({ x: p.x + r.x * a + f.x * b, y: p.y + r.y * a + f.y * b }));
}

/** Separating-axis test: the footprint at `p` overlaps the barrier. */
function overlaps(p: Pose, b: Barrier): boolean {
  const poly = corners(p);
  const box = [{ x: b.cx - b.hx, y: b.cy - b.hy }, { x: b.cx + b.hx, y: b.cy - b.hy },
    { x: b.cx + b.hx, y: b.cy + b.hy }, { x: b.cx - b.hx, y: b.cy + b.hy }];
  const axes = [{ x: 1, y: 0 }, { x: 0, y: 1 }, fwd(p.th), rgt(p.th)];
  return axes.every(a => {
    const pa = poly.map(q => q.x * a.x + q.y * a.y), pb = box.map(q => q.x * a.x + q.y * a.y);
    return Math.max(...pa) > Math.min(...pb) && Math.max(...pb) > Math.min(...pa);
  });
}

export interface MoveResult {
  move: Move;
  /** Where the machine stopped: the end of the move, or the last clear pose before a bump. */
  end: Pose;
  /** How far through the move it got (1 = all the way). */
  reached: number;
  bumped: boolean;
  /** Which end of the machine hit, when it bumped. */
  bumpedWith?: 'front' | 'back';
}

const STEPS = 60;

/** Run one move through the yard, stopping at the first bump. */
export function runMove(barriers: readonly Barrier[], l: Levers, from: Pose = START): MoveResult {
  const move = moveOf(l);
  let last = from;
  for (let i = 1; i <= STEPS; i++) {
    const p = poseAt(from, l, i / STEPS);
    if (barriers.some(b => overlaps(p, b))) {
      // The end that hit: the corner pair nearest the barrier it overlaps.
      const b = barriers.find(bb => overlaps(p, bb))!;
      const c = corners(p);
      const d = (q: { x: number; y: number }) => Math.hypot(q.x - b.cx, q.y - b.cy);
      const front = Math.min(d(c[0]), d(c[1])) <= Math.min(d(c[2]), d(c[3]));
      return { move, end: last, reached: (i - 1) / STEPS, bumped: true, bumpedWith: front ? 'front' : 'back' };
    }
    last = p;
  }
  return { move, end: last, reached: 1, bumped: false };
}

// ── The check (the misses it names are the card's, `skidSteerYard.card.ts`) ─────────────────────────────

const turnSide = (m: Move): Side | null => (m.kind === 'pivot' || m.kind === 'spin' ? (m.dir > 0 ? 'left' : 'right') : null);

/** Right when the move turns toward the goal and finishes without a bump. Both levers stopped is not a move. */
export function leversMatch(c: SetLeversChallenge, l: Levers): boolean {
  const r = runMove(c.barriers, l);
  return turnSide(r.move) === c.side && !r.bumped;
}

export function leverMiss(c: SetLeversChallenge, l: Levers): SkidSteerMiss | undefined {
  const r = runMove(c.barriers, l);
  const side = turnSide(r.move);
  if (r.move.kind === 'straight') return 'drove_straight';
  if (side && side !== c.side) return 'wrong_way';
  if (side === c.side && r.bumped) return 'bumped';
  return undefined;
}

const LEVER_WORD: Record<Lever, string> = { fwd: 'forward', stop: 'stopped', back: 'back' };
export const leverWords = (l: Levers) => `left side ${LEVER_WORD[l.left]}, right side ${LEVER_WORD[l.right]}`;

/** "Set left side forward, right side stopped and pressed Go": the learner's work, in words. */
export const describeLevers = (l: Levers) => `Set ${leverWords(l)} and pressed Go`;

function moveWords(r: MoveResult): string {
  const m = r.move;
  if (m.kind === 'straight') return m.dir > 0 ? 'drove straight ahead' : 'backed straight up';
  const way = m.dir > 0 ? 'left' : 'right';
  if (m.kind === 'spin') return `spun ${way} right where it stood`;
  return `pivoted ${way} around its stopped ${m.around} wheels`;
}

/** What Go showed: what the machine did, never which levers would have worked. */
export function goFeedback(c: SetLeversChallenge, l: Levers): string {
  const r = runMove(c.barriers, l);
  const did = `The skid steer ${moveWords(r)}`;
  if (leversMatch(c, l)) {
    return r.move.kind === 'spin'
      ? `${did}, and now it faces the ${c.goal}! One side went forward and the other went back, so it turned without moving off its spot.`
      : `${did}, and now it faces the ${c.goal}! Look at the skid marks: the moving wheels scraped around the stopped ones.`;
  }
  if (r.move.kind === 'straight') return `${did}. Both sides went the same way, so it did not turn.`;
  if (r.bumped) return `Crunch! ${did.replace('pivoted', 'started to pivot').replace('spun', 'started to spin').replace('drove', 'started to drive')}, and its ${r.bumpedWith === 'front' ? 'bucket' : 'back end'} bumped the barrier. That turn needs more room.`;
  return `${did}, away from the ${c.goal}.`;
}

// ── Building items ───────────────────────────────────────────────────────────────────────────────────────

/** Concrete barriers: a long wall across the yard ahead or behind; a short one on the side away from the goal. */
const WALL_FRONT: Barrier = { cx: 0, cy: 2.6, hx: 5, hy: 0.3 };
const WALL_BACK: Barrier = { cx: 0, cy: -2.1, hx: 5, hy: 0.3 };
const sideWall = (away: Side): Barrier => ({ cx: away === 'left' ? -2.7 : 2.7, cy: 0.2, hx: 0.3, hy: 2.0 });

export function barriersFor(room: Room, side: Side): Barrier[] {
  switch (room) {
    case 'open': return [];
    case 'wall_front': return [WALL_FRONT];
    case 'wall_back': return [WALL_BACK];
    case 'boxed': return [WALL_FRONT, WALL_BACK, sideWall(side === 'left' ? 'right' : 'left')];
  }
}

/** Every lever setting, for checks and tests. */
export const ALL_LEVERS: Levers[] = LEVERS.flatMap(left => LEVERS.map(right => ({ left, right })));

/** The settings that solve an item. */
export const solutions = (c: SetLeversChallenge) => ALL_LEVERS.filter(l => leversMatch(c, l));

/**
 * The room the yard was built for holds: open lets all three turns toward the goal through, a wall lets two, and
 * boxed lets only the spin. Checked on every item, so a geometry change cannot quietly make a hard item easy.
 */
export function roomHolds(c: SetLeversChallenge): boolean {
  const ok = solutions(c).map(l => moveOf(l).kind);
  if (c.room === 'open') return ok.length === 3;
  if (c.room === 'boxed') return ok.length === 1 && ok[0] === 'spin';
  return ok.length === 2 && ok.includes('spin');
}

export function setLeversInstruction(goal: GoalThing): string {
  return `Turn the skid steer to face the ${goal}. Set the two levers, then press Go.`;
}

export function buildSetLevers(goal: GoalThing, side: Side, room: Room, id: string): SetLeversChallenge {
  return { id, type: 'set_levers', goal, side, room, barriers: barriersFor(room, side), instruction: setLeversInstruction(goal) };
}

export type Difficulty = 'easy' | 'medium' | 'hard';

/** The rooms a session walks through: easy stays mostly open, hard is mostly tight. */
const ROOM_RAMP: Record<Difficulty, Array<Room | 'wall'>> = {
  easy: ['open', 'open', 'open', 'wall', 'wall'],
  medium: ['open', 'wall', 'wall', 'wall', 'boxed'],
  hard: ['wall', 'wall', 'boxed', 'boxed', 'boxed'],
};

function shuffle<T>(xs: readonly T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Five items at a difficulty: different things to face, both sides used, both wall positions used when two walls
 * appear, and no two items in a row the same side and room.
 */
export function pickSetLevers(difficulty: Difficulty, count = 5, rng: () => number = Math.random): SetLeversChallenge[] {
  const ramp = ROOM_RAMP[difficulty].slice(0, count);
  const things = shuffle(GOAL_THINGS, rng);
  const walls = shuffle(['wall_front', 'wall_back'] as const, rng);
  let w = 0;
  const rooms: Room[] = ramp.map(r => (r === 'wall' ? walls[w++ % 2] : r));
  // Sides: random, but the other side whenever the room repeats, and both sides somewhere in the session.
  const flip = (s: Side): Side => (s === 'left' ? 'right' : 'left');
  let sides: Side[] = [];
  for (let tries = 0; tries < 50 && new Set(sides).size < Math.min(2, rooms.length); tries++) {
    sides = [];
    rooms.forEach((room, i) => sides.push(i > 0 && room === rooms[i - 1] ? flip(sides[i - 1]) : rng() < 0.5 ? 'left' : 'right'));
  }
  return rooms.map((room, i) => buildSetLevers(things[i % things.length], sides[i], room, `ss-${i + 1}`));
}

// ── Attachments ──────────────────────────────────────────────────────────────────────────────────────────

export const ATTACHMENTS = ['bucket', 'forks', 'auger', 'broom', 'snow_blade', 'grapple'] as const;
export type Attachment = typeof ATTACHMENTS[number];
export const JOBS = ['scoop_dirt', 'move_pallet', 'plant_tree', 'sweep_path', 'push_snow', 'grab_branches'] as const;
export type Job = typeof JOBS[number];

export const ATTACHMENT_NAME: Record<Attachment, string> = {
  bucket: 'bucket', forks: 'pallet forks', auger: 'auger', broom: 'broom', snow_blade: 'snow blade', grapple: 'grapple',
};

/** What each tool is built to do, for the feedback on a wrong pick (it describes the wrong tool, never the right one). */
const TOOL_FOR: Record<Attachment, string> = {
  bucket: 'scoops up loose stuff like dirt and gravel and carries it',
  forks: 'slides under a pallet and lifts what is stacked on it',
  auger: 'spins like a giant drill to make a deep, round hole',
  broom: 'spins its bristles to sweep dust and leaves off hard ground',
  snow_blade: 'pushes snow out of the way in one long pass',
  grapple: 'clamps its claws around logs and branches to hold them tight',
};

/** The tool each job needs, and the tool that almost works (the hard items offer it). */
export const JOB_TOOL: Record<Job, Attachment> = {
  scoop_dirt: 'bucket', move_pallet: 'forks', plant_tree: 'auger', sweep_path: 'broom', push_snow: 'snow_blade', grab_branches: 'grapple',
};
export const NEAR_MISS: Record<Job, Attachment> = {
  scoop_dirt: 'snow_blade', move_pallet: 'bucket', plant_tree: 'bucket', sweep_path: 'snow_blade', push_snow: 'broom', grab_branches: 'bucket',
};

/** The job, in the words the learner hears. Names the job and the thing, never the tool. */
const JOB_ASK: Record<Job, string> = {
  scoop_dirt: 'Scoop up the pile of dirt and carry it away.',
  move_pallet: 'Lift the pallet of bricks off the ground.',
  plant_tree: 'Dig a deep hole where the orange stake is, so the little tree can be planted.',
  sweep_path: 'Clean the dust and leaves off the concrete path.',
  push_snow: 'Clear the snow off the driveway.',
  grab_branches: 'Pick up the pile of long branches.',
};
const JOB_DONE: Record<Job, string> = {
  scoop_dirt: 'The bucket scooped up the dirt and carried it away!',
  move_pallet: 'The forks slid under the pallet and lifted the bricks!',
  plant_tree: 'The auger drilled a deep, round hole, ready for the little tree!',
  sweep_path: 'The broom swept the path clean!',
  push_snow: 'The snow blade pushed the snow off the driveway!',
  grab_branches: 'The grapple clamped the branches and picked them up!',
};
/** What the near-miss tool did on this job: it almost worked. */
const NEAR_DID: Record<Job, string> = {
  scoop_dirt: 'The snow blade pushed the dirt along the ground, but it cannot carry it away.',
  move_pallet: 'The bucket could not slide under the pallet, and the bricks wobbled.',
  plant_tree: 'The bucket dug a wide, shallow scrape, not a deep, round hole.',
  sweep_path: 'The snow blade scraped the path, but the dust and leaves are still there.',
  push_snow: 'The broom brushed the top, but the deep snow is still on the driveway.',
  grab_branches: 'The bucket scooped a few branches, but the long ones slid off the sides.',
};

export const attachmentMatches = (c: MatchAttachmentChallenge, a: Attachment) => JOB_TOOL[c.job] === a;

export function attachmentMiss(c: MatchAttachmentChallenge, a: Attachment): SkidSteerMiss | undefined {
  if (attachmentMatches(c, a)) return undefined;
  return a === NEAR_MISS[c.job] ? 'near_tool' : 'wrong_tool';
}

export const describeAttachment = (a: Attachment) => `Put on the ${ATTACHMENT_NAME[a]} and pressed Do the job`;

export const jobAsk = (j: Job) => JOB_ASK[j];

/** What Do the job showed: what the picked tool did, never which tool fits. */
export function jobFeedback(c: MatchAttachmentChallenge, a: Attachment): string {
  if (attachmentMatches(c, a)) return JOB_DONE[c.job];
  if (a === NEAR_MISS[c.job]) return `${NEAR_DID[c.job]} Almost! Look at the other tools.`;
  return `The ${ATTACHMENT_NAME[a]} could not do this job. A ${ATTACHMENT_NAME[a]} ${TOOL_FOR[a]}.`;
}

export function matchAttachmentInstruction(job: Job): string {
  return `${JOB_ASK[job]} Pick the attachment for the job, then press Do the job.`;
}

/**
 * Five jobs at a difficulty, each a different job. Easy offers 3 tools, none of them the near miss; medium offers 3
 * with the near miss; hard offers 4 with the near miss. The right tool lands in a random slot.
 */
export function pickMatchAttachment(difficulty: Difficulty, count = 5, rng: () => number = Math.random): MatchAttachmentChallenge[] {
  const jobs = shuffle(JOBS, rng).slice(0, count);
  return jobs.map((job, i) => {
    const right = JOB_TOOL[job], near = NEAR_MISS[job];
    const withNear = difficulty !== 'easy';
    const n = difficulty === 'hard' ? 4 : 3;
    const others = shuffle(ATTACHMENTS.filter(a => a !== right && a !== near), rng);
    const picks = [right, ...(withNear ? [near] : []), ...others].slice(0, n);
    return { id: `ss-${i + 1}`, type: 'match_attachment' as const, job, options: shuffle(picks, rng),
      instruction: matchAttachmentInstruction(job) };
  });
}

/** An attachment item is fair: the right tool is offered once, every tool is known, and the near miss follows the tier. */
export function attachmentItemHolds(c: MatchAttachmentChallenge): boolean {
  return (JOBS as readonly string[]).includes(c.job) && c.options.length >= 2 && c.options.length <= 4
    && new Set(c.options).size === c.options.length && c.options.every(a => (ATTACHMENTS as readonly string[]).includes(a))
    && c.options.filter(a => a === JOB_TOOL[c.job]).length === 1;
}
