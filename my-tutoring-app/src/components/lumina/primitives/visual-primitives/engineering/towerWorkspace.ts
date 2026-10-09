/**
 * Tower stacker on the shared tutor/JEV teaching workspace (W1 binding) and its three open builds
 * (/add-eval-modes references/build-mode.md):
 * - `build_tall`: "Build a tower that reaches the green line and stays standing."
 * - `build_few`: the same, with no more than N pieces.
 * - `build_windproof`: the same, and it must stay up when a strong wind blows.
 *
 * Pure: the component, the generator, the oracle, the journey row and the tests read the same pieces, physics,
 * misses, targets and scene. Code owns every target and the check; the model writes only a title.
 *
 * The physics is plain statics on a grid. Pieces are not glued: a part of the tower stays up only if the balance
 * point of everything resting above a level sits over what holds that part up (`towerCuts`). Wind pushes from the
 * left with a pressure per unit of height; a part blows over when the wind's turning push about its downwind edge is
 * more than its weight's pull back (`windLimit`). Weight is area, so a piece's weight is where its size says it is.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';

export type TowerMode = 'build_tall' | 'build_few' | 'build_windproof';
export const TOWER_MODES: readonly TowerMode[] = ['build_tall', 'build_few', 'build_windproof'];

export type PieceKind = 'small' | 'block' | 'big' | 'beam';
export interface PieceSpec { kind: PieceKind; label: string; width: number; height: number; color: string }

/** The tray. Every piece has unit density, so its weight is its area. */
export const PIECES: Record<PieceKind, PieceSpec> = {
  small: { kind: 'small', label: 'Small block', width: 1, height: 1, color: '#3B82F6' },
  block: { kind: 'block', label: 'Block', width: 2, height: 1, color: '#EF4444' },
  big: { kind: 'big', label: 'Big block', width: 2, height: 2, color: '#22C55E' },
  beam: { kind: 'beam', label: 'Beam', width: 4, height: 1, color: '#D97706' },
};
export const PIECE_KINDS: readonly PieceKind[] = ['small', 'block', 'big', 'beam'];

/** The build area: grid units across and up. */
export const GROUND_WIDTH = 12;
export const MAX_HEIGHT = 14;

/** A piece on the scene; `w`/`h` are after turning. Weight is `w * h`. */
export interface TowerPiece { id: string; kind: PieceKind; x: number; y: number; w: number; h: number }

export interface TowerChallenge {
  id: string;
  type: TowerMode;
  /** Grid units the top of the tower must reach (the green line). */
  targetHeight: number;
  /** build_few: the most pieces the tower may use. */
  maxPieces?: number;
  /** build_windproof: wind pressure per unit of height, chosen by code (`windFor`). */
  wind?: number;
  instruction: string;
}

const weight = (p: TowerPiece) => p.w * p.h;
const top = (p: TowerPiece) => p.y + p.h;
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
const EPS = 1e-9;

export const towerHeight = (pieces: readonly TowerPiece[]) => pieces.reduce((m, p) => Math.max(m, top(p)), 0);

/** The widest stretch of the bottom row, in grid units (published to the tutor as a fact of the build). */
export function baseWidth(pieces: readonly TowerPiece[]): number {
  const ground = pieces.filter(p => p.y === 0);
  return ground.length ? Math.max(...ground.map(p => p.x + p.w)) - Math.min(...ground.map(p => p.x)) : 0;
}

// ── Placing and removing ─────────────────────────────────────────────────────

/** The size of a kind, turned or not. A turned beam stands 1 wide and 4 tall. */
export const pieceSize = (kind: PieceKind, turned: boolean) =>
  (turned ? { w: PIECES[kind].height, h: PIECES[kind].width } : { w: PIECES[kind].width, h: PIECES[kind].height });

/** The left edge of a piece of width `w` dropped at a tapped column, kept inside the build area. */
export const leftEdgeFor = (column: number, w: number) => Math.max(0, Math.min(GROUND_WIDTH - w, column - Math.floor(w / 2)));

/**
 * Where a piece lands when dropped at left edge `x`: it falls until it rests on the highest piece under it, or the
 * ground. It needs something under at least half its width, and must fit under the top of the build area.
 */
export function dropPiece(pieces: readonly TowerPiece[], kind: PieceKind, turned: boolean, x: number, id: string):
  { piece: TowerPiece } | { blocked: 'needs_support' | 'too_high' } {
  const { w, h } = pieceSize(kind, turned);
  const under = pieces.filter(p => overlap(x, x + w, p.x, p.x + p.w) > 0);
  const y = under.reduce((m, p) => Math.max(m, top(p)), 0);
  if (y + h > MAX_HEIGHT) return { blocked: 'too_high' };
  const held = y === 0 ? w : under.filter(p => top(p) === y).reduce((s, p) => s + overlap(x, x + w, p.x, p.x + p.w), 0);
  if (held < w / 2) return { blocked: 'needs_support' };
  return { piece: { id, kind, x, y, w, h } };
}

/** Pieces resting on this one. A piece with something on it cannot be taken off first. */
export const restingOn = (pieces: readonly TowerPiece[], p: TowerPiece) =>
  pieces.filter(q => q.y === top(p) && overlap(q.x, q.x + q.w, p.x, p.x + p.w) > 0);

// ── Statics ──────────────────────────────────────────────────────────────────

/** One part of the tower above one level: what it weighs, where it balances, and the span that holds it up. */
export interface TowerCut {
  level: number;
  ids: string[];
  weight: number;
  balanceX: number;
  balanceY: number;
  /** Left and right ends of what holds this part up (the ground, or the tops of pieces below the level). */
  lo: number;
  hi: number;
  /** Turning push of the wind about the part's base per unit of pressure: sum of height x lever arm. */
  windArm: number;
}

/**
 * Every part of the tower above every level a piece starts at. Above a level, pieces that rest on one another form
 * one part; each part is held up only where its pieces sit on pieces below the level (or on the ground).
 */
export function towerCuts(pieces: readonly TowerPiece[]): TowerCut[] {
  const levels = Array.from(new Set(pieces.map(p => p.y))).sort((a, b) => a - b);
  const out: TowerCut[] = [];
  for (const level of levels) {
    const body = pieces.filter(p => p.y >= level);
    const below = pieces.filter(p => p.y < level);
    // Parts: pieces in the body joined by one resting on another.
    const part = new Map(body.map(p => [p.id, p.id]));
    const find = (id: string): string => (part.get(id) === id ? id : find(part.get(id)!));
    for (const a of body) for (const b of body) {
      if (a.y === top(b) && overlap(a.x, a.x + a.w, b.x, b.x + b.w) > 0) part.set(find(a.id), find(b.id));
    }
    const groups = new Map<string, TowerPiece[]>();
    for (const p of body) groups.set(find(p.id), [...(groups.get(find(p.id)) ?? []), p]);
    for (const group of Array.from(groups.values())) {
      const spans: Array<[number, number]> = [];
      for (const p of group) {
        if (p.y === 0) spans.push([p.x, p.x + p.w]);
        for (const s of below) {
          if (top(s) !== p.y) continue;
          const lo = Math.max(p.x, s.x), hi = Math.min(p.x + p.w, s.x + s.w);
          if (hi > lo) spans.push([lo, hi]);
        }
      }
      // A part that starts above this level and rests only on parts inside the body is judged at its own level.
      if (!spans.length) continue;
      const total = group.reduce((s, p) => s + weight(p), 0);
      out.push({
        level, ids: group.map(p => p.id).sort(), weight: total,
        balanceX: group.reduce((s, p) => s + weight(p) * (p.x + p.w / 2), 0) / total,
        balanceY: group.reduce((s, p) => s + weight(p) * (p.y + p.h / 2), 0) / total,
        lo: Math.min(...spans.map(s => s[0])), hi: Math.max(...spans.map(s => s[1])),
        windArm: group.reduce((s, p) => s + p.h * (p.y + p.h / 2 - level), 0),
      });
    }
  }
  return out;
}

/** The first part that tips under its own weight: its balance point is past what holds it up. */
export function tippingCut(pieces: readonly TowerPiece[]): TowerCut | undefined {
  return towerCuts(pieces).find(c => c.balanceX < c.lo - EPS || c.balanceX > c.hi + EPS);
}

/** The strongest wind every part of the tower survives: the least weight-pull over wind-arm across its parts. */
export function windLimit(pieces: readonly TowerPiece[]): number {
  return towerCuts(pieces).reduce((m, c) => (c.windArm > 0 ? Math.min(m, (c.weight * (c.hi - c.balanceX)) / c.windArm) : m), Infinity);
}

/** The first part a wind of `pressure` blows over, turning about its downwind (right) edge. */
export function blownCut(pieces: readonly TowerPiece[], pressure: number): TowerCut | undefined {
  return towerCuts(pieces).find(c => pressure * c.windArm > c.weight * (c.hi - c.balanceX) + EPS);
}

// ── The check ────────────────────────────────────────────────────────────────

/**
 * What a wrong tower shows (`TeachingAttempt.miss`), in the order the activity tests it:
 * - `tips_over`: a part of the tower falls under its own weight (its balance point is past what holds it up);
 * - `too_short`: it stands, but its top is below the green line;
 * - `too_many_pieces` (build_few): it stands and reaches the line with more pieces than the ask allows;
 * - `blown_over` (build_windproof): it stands and reaches the line, and the wind blows a part of it over.
 */
export type TowerMiss = 'tips_over' | 'too_short' | 'too_many_pieces' | 'blown_over';
export const TOWER_MISSES: Record<TowerMode, readonly TowerMiss[]> = {
  build_tall: ['tips_over', 'too_short'],
  build_few: ['tips_over', 'too_short', 'too_many_pieces'],
  build_windproof: ['tips_over', 'too_short', 'blown_over'],
};

export function towerMiss(c: TowerChallenge, pieces: readonly TowerPiece[]): TowerMiss | undefined {
  if (pieces.length && tippingCut(pieces)) return 'tips_over';
  if (towerHeight(pieces) < c.targetHeight) return 'too_short';
  if (c.type === 'build_few' && c.maxPieces !== undefined && pieces.length > c.maxPieces) return 'too_many_pieces';
  if (c.type === 'build_windproof' && blownCut(pieces, c.wind ?? 0)) return 'blown_over';
  return undefined;
}

/** The part to draw falling after a miss, and the edge it turns about. */
export function fallingPart(c: TowerChallenge, pieces: readonly TowerPiece[], miss: TowerMiss | undefined):
  { ids: string[]; pivotX: number; pivotY: number; toRight: boolean } | null {
  const cut = miss === 'tips_over' ? tippingCut(pieces) : miss === 'blown_over' ? blownCut(pieces, c.wind ?? 0) : undefined;
  if (!cut) return null;
  const toRight = miss === 'blown_over' || cut.balanceX > cut.hi;
  return { ids: cut.ids, pivotX: toRight ? cut.hi : cut.lo, pivotY: cut.level, toRight };
}

// ── Targets, written by code ─────────────────────────────────────────────────

export type TowerBand = 'K-1' | '2-3' | '4-5';
export function towerBand(grade?: string, gradeContext = ''): TowerBand {
  const g = (grade ?? '').toUpperCase();
  if (g === 'K' || g === '1') return 'K-1';
  if (g === '2' || g === '3') return '2-3';
  if (/^\d+$/.test(g)) return '4-5';
  // No curriculum grade (a free-form lesson, the tester): the prose band decides; elementary defaults to 2-3.
  return /kinder|pre-?k|toddler/i.test(gradeContext) ? 'K-1' : '2-3';
}

/** Heights each band builds to, lowest first. */
const HEIGHTS: Record<TowerBand, readonly number[]> = { 'K-1': [4, 5, 6], '2-3': [6, 7, 8], '4-5': [8, 9, 10] };

/** The modes a mixed (unpinned) session holds per band, easiest first: every tier the band can build. */
export const MIXED_MODES: Record<TowerBand, readonly TowerMode[]> = {
  'K-1': ['build_tall', 'build_tall', 'build_tall'],
  '2-3': ['build_tall', 'build_few', 'build_windproof'],
  '4-5': ['build_few', 'build_windproof', 'build_windproof'],
};

/** The fewest pieces that reach a height: a turned beam stands 4 tall. */
export const fewestPieces = (height: number) => Math.ceil(height / 4);
const SLACK: Record<TowerBand, number> = { 'K-1': 2, '2-3': 2, '4-5': 1 };

const column = (height: number): TowerPiece[] =>
  Array.from({ length: height }, (_, i) => ({ id: `c${i}`, kind: 'block' as const, x: 5, y: i, w: 2, h: 1 }));

/** A wide-based tower to the height: beams flat for the lower half, blocks above, all centred. It proves a pass. */
export function referenceWindproof(height: number): TowerPiece[] {
  const beams = Math.ceil(height / 2);
  return Array.from({ length: height }, (_, i) => (i < beams
    ? { id: `r${i}`, kind: 'beam' as const, x: 4, y: i, w: 4, h: 1 }
    : { id: `r${i}`, kind: 'block' as const, x: 5, y: i, w: 2, h: 1 }));
}

/**
 * The wind for a windproof item: between what a plain two-wide column of blocks survives (it must blow over) and
 * what the wide-based reference survives (it must stand), at their geometric mean.
 */
export function windFor(height: number): number {
  const fails = windLimit(column(height)), holds = windLimit(referenceWindproof(height));
  if (!(holds > fails * 1.5)) throw new Error(`tower-stacker: no wind separates a column from a wide tower at height ${height}`);
  return Math.round(Math.sqrt(fails * holds) * 1000) / 1000;
}

export function towerAsk(c: Pick<TowerChallenge, 'type' | 'maxPieces'>): string {
  if (c.type === 'build_few') return `Build a tower that reaches the green line using no more than ${c.maxPieces} pieces.`;
  if (c.type === 'build_windproof') return 'Build a tower that reaches the green line and stays up when the strong wind blows.';
  return 'Build a tower that reaches the green line and stays standing.';
}

export function towerItem(type: TowerMode, targetHeight: number, band: TowerBand, id: string): TowerChallenge {
  const base = { id, type, targetHeight };
  if (type === 'build_few') {
    const maxPieces = fewestPieces(targetHeight) + SLACK[band];
    return { ...base, maxPieces, instruction: towerAsk({ type, maxPieces }) };
  }
  if (type === 'build_windproof') return { ...base, wind: windFor(targetHeight), instruction: towerAsk({ type }) };
  return { ...base, instruction: towerAsk({ type }) };
}

/** A session: one item per mode slot, heights rising, no height asked twice in one mode. */
export function towerChallenges(modes: readonly TowerMode[], band: TowerBand, count = 3, random: () => number = Math.random): TowerChallenge[] {
  const heights = HEIGHTS[band];
  // A blend or a mixed list repeats its modes in turn to fill the session.
  const slots = Array.from({ length: count }, (_, i) => modes[i % modes.length]);
  const used = new Map<TowerMode, number[]>();
  const offset = Math.floor(random() * heights.length);
  return slots.map((type, i) => {
    const taken = used.get(type) ?? [];
    const pool = heights.filter(h => !taken.includes(h));
    const h = pool.length ? pool[(offset + i) % pool.length] : heights[i % heights.length];
    used.set(type, [...taken, h]);
    return towerItem(type, h, band, `tower-${i + 1}`);
  }).sort((a, b) => TOWER_MODES.indexOf(a.type) - TOWER_MODES.indexOf(b.type) || a.targetHeight - b.targetHeight)
    .map((c, i) => ({ ...c, id: `tower-${i + 1}` }));
}

// ── Assignment, work, scene ──────────────────────────────────────────────────

export const workspaceAssignment = (c: TowerChallenge): TeachingAssignment => ({ id: c.id, task: c.instruction, response: 'gesture' });

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The learner's tower in their own terms: which pieces, how tall, how wide at the bottom. Never a verdict. */
export function describeTower(pieces: readonly TowerPiece[]): string {
  if (!pieces.length) return 'No pieces placed yet';
  const counts = PIECE_KINDS.map(k => [k, pieces.filter(p => p.kind === k)] as const).filter(([, ps]) => ps.length)
    .map(([k, ps]) => {
      const standing = ps.filter(p => p.h > PIECES[k].height).length;
      return `${plural(ps.length, PIECES[k].label.toLowerCase())}${standing ? ` (${standing} stood on end)` : ''}`;
    });
  return `${plural(pieces.length, 'piece')}: ${counts.join(', ')}. ${towerHeight(pieces)} tall, ${baseWidth(pieces)} wide at the bottom`;
}

/** What is drawn and asked. No balance point, wind limit or verdict is published; the tower's size is the learner's. */
export function workspaceScene(c: TowerChallenge, pieces: readonly TowerPiece[]): WorkspaceScene {
  return { objects: [], facts: {
    kind: c.type,
    scene: 'an empty building area on the ground with a green goal line across it'
      + (c.type === 'build_windproof' ? ' and wind arrows blowing from the left' : '')
      + '; the learner picks a piece from the tray, may turn it, and taps a spot to drop it; it falls until it rests on '
      + 'what is under it. Tapping a piece with nothing on it takes it off',
    piecesInTray: PIECE_KINDS.map(k => `${PIECES[k].label.toLowerCase()} (${PIECES[k].width} wide, ${PIECES[k].height} tall)`).join(', '),
    // The made tower as numbers, so the shared work history records a revision (`piecesPlaced 0 -> 9 -> 7`).
    piecesPlaced: pieces.length, towerHeight: towerHeight(pieces), bottomWidth: baseWidth(pieces),
    learnerWork: describeTower(pieces),
    constraints: 'The learner builds the tower and presses "I\'m done!"; the activity tests whether every part stands'
      + (c.type === 'build_windproof' ? ' and whether the wind blows any part over' : '') + '. You cannot place, turn or remove a piece.',
  } };
}

// ── The build watcher's leak rules ───────────────────────────────────────────

/**
 * What the build watcher may never say on a tower (`useBuildWatcher` `neverSay`, filtered in code by
 * `keepWatchLine`): any word that says whether it will stand or how to make it stand, which is the skill.
 */
export const WATCH_NEVER_SAY = ['stable', 'unstable', 'steady', 'wobbly', 'wobble', 'tip', 'tips', 'tipping', 'topple', 'fall', 'falls',
  'falling', 'collapse', 'balance', 'balanced', 'wide', 'wider', 'narrow', 'skinny', 'base', 'strong', 'sturdy', 'solid', 'safe',
  'reach', 'reaches', 'tall enough', 'short', 'shorter', 'taller', 'wind', 'line', 'goal', 'center', 'centre', 'heavy', 'heavier'];

// ── The journey's learner (liveJourneySpec row, the dry sweep, the browser drive) ──

export type TowerHarnessInput = { type: 'touch'; target: string } | { type: 'choose'; label: string };

/**
 * Real-control inputs for one item: clear a kept build, then drop a tower that passes (a stack of flat beams to the
 * height; on build_few a column of stood-up beams within the cap). Wrong: a column of blocks one short of the line
 * (`too_short`), and on build_windproof a plain column to the line that the wind blows over (`blown_over`).
 */
export function towerHarnessInputs(c: TowerChallenge, wrong: boolean, demand?: Record<string, unknown> | null): TowerHarnessInput[] {
  const touch = (target: string): TowerHarnessInput => ({ type: 'touch', target });
  const clear: TowerHarnessInput[] = Number(demand?.piecesPlaced ?? 0) > 0 ? [{ type: 'choose', label: 'Clear' }] : [];
  const drop = (kind: PieceKind, turn: boolean, n: number, column: number) =>
    [touch(`tray-${kind}`), ...(turn ? [{ type: 'choose' as const, label: 'Turn' }] : []), ...Array.from({ length: n }, () => touch(`column-${column}`))];
  let steps: TowerHarnessInput[];
  if (wrong) steps = c.type === 'build_windproof' ? drop('block', false, c.targetHeight, 6) : drop('block', false, c.targetHeight - 1, 6);
  else if (c.type === 'build_few') steps = drop('beam', true, fewestPieces(c.targetHeight), 6);
  else steps = drop('beam', false, c.targetHeight, 6);
  return [...clear, ...steps, { type: 'choose', label: "I'm done!" }];
}
