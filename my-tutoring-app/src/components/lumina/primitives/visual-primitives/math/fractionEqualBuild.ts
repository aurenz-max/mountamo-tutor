/**
 * fraction-circles `build_equal`, an open build (`/add-eval-modes` references/build-mode.md): "Make a fraction
 * equal to a/b your own way". The circle starts whole. The learner chooses how many equal pieces to cut it into,
 * can cut any one piece in half, shades pieces, and presses "I'm done!". Many builds pass (1/2 = 2/4 = 3/6 = ...),
 * unlike `equivalent`, whose number of slices is given.
 *
 * Code judges at the commit: every piece is the same size, their number is one the circle supports, it is not
 * b (cutting into b pieces and shading a is the `build` task, not an equal fraction), and shaded/pieces = a/b.
 * Cutting one piece in half is how unequal pieces arise, and how 1/2 becomes 2/4 when every piece is halved.
 *
 * Pure: the component, the workspace, the levers, the generator and the tests read the same functions.
 */
import type { FractionCirclesChallenge } from './FractionCircles';

/** One piece of the circle: the arc it covers, in turns [start, end), and whether the learner shaded it. */
export interface Piece { start: number; end: number; shaded: boolean }

/** The equal cuts offered on screen, by band (the generator's denominators). */
const CUTS_BY_BAND: Record<string, readonly number[]> = { 'K-2': [2, 3, 4], '3-5': [2, 3, 4, 5, 6, 8, 10, 12] };
export const cutsFor = (band?: string): readonly number[] => CUTS_BY_BAND[band ?? ''] ?? CUTS_BY_BAND['3-5'];
/** Equal piece counts the circle can draw and judge. Halving stops at twelfths, so every equal count reached is one. */
export const SUPPORTED_PIECES: readonly number[] = [2, 3, 4, 5, 6, 8, 10, 12];
const SMALLEST = 1 / 12;
const EPS = 1e-6;

export const wholeCircle = (): Piece[] => [{ start: 0, end: 1, shaded: false }];
export const cutInto = (n: number): Piece[] => Array.from({ length: n }, (_, i) => ({ start: i / n, end: (i + 1) / n, shaded: false }));

/** The piece cut in two equal halves (a shaded piece gives two shaded halves), or null below a twelfth. */
export function halvePiece(pieces: readonly Piece[], index: number): Piece[] | null {
  const p = pieces[index];
  if (!p || (p.end - p.start) / 2 < SMALLEST - EPS) return null;
  const mid = (p.start + p.end) / 2;
  return [...pieces.slice(0, index), { ...p, end: mid }, { ...p, start: mid }, ...pieces.slice(index + 1)];
}

export const toggleShade = (pieces: readonly Piece[], index: number): Piece[] =>
  pieces.map((p, i) => (i === index ? { ...p, shaded: !p.shaded } : p));

/** What the learner made, as numbers: the scene facts and the judge read this. */
export interface EqualBuild { pieces: number; shaded: number; equal: boolean }
export function readBuild(pieces: readonly Piece[]): EqualBuild {
  const n = pieces.length;
  return { pieces: n, shaded: pieces.filter(p => p.shaded).length,
    equal: pieces.every(p => Math.abs(p.end - p.start - 1 / n) < EPS) };
}

/**
 * What a wrong build shows (`TeachingAttempt.miss`), from the learner's own circle:
 * `unequal_pieces` (not all the same size, or a number of pieces the circle does not support);
 * `same_pieces` (cut into b pieces with a shaded: the target itself, not another way);
 * `shaded_the_rest` (the unshaded part is the target amount); `cut_cannot_make` (no shading of this many
 * equal pieces equals a/b, e.g. 3/4 in sixths); `one_off` / `off_by_more` (a cut that works, a shaded
 * count one or more away from it). Undefined for a right build.
 */
export type EqualBuildMiss = 'unequal_pieces' | 'same_pieces' | 'shaded_the_rest' | 'cut_cannot_make' | 'one_off' | 'off_by_more';
export const EQUAL_BUILD_MISSES: readonly EqualBuildMiss[] =
  ['unequal_pieces', 'same_pieces', 'shaded_the_rest', 'cut_cannot_make', 'one_off', 'off_by_more'];

export function equalBuildMiss(ch: Pick<FractionCirclesChallenge, 'numerator' | 'denominator'>, b: EqualBuild): EqualBuildMiss | undefined {
  const { numerator: a, denominator: d } = ch;
  if (!b.equal || !SUPPORTED_PIECES.includes(b.pieces)) return 'unequal_pieces';
  if (b.shaded * d === a * b.pieces) return b.pieces === d ? 'same_pieces' : undefined;
  if ((b.pieces - b.shaded) * d === a * b.pieces) return 'shaded_the_rest';
  if ((a * b.pieces) % d !== 0) return 'cut_cannot_make';
  return Math.abs(b.shaded - (a * b.pieces) / d) === 1 ? 'one_off' : 'off_by_more';
}

export const makesEqual = (ch: Pick<FractionCirclesChallenge, 'numerator' | 'denominator'>, b: EqualBuild) =>
  b.shaded > 0 && equalBuildMiss(ch, b) === undefined;

/** Equal piece counts reachable from the band's cuts by halving every piece. */
export function reachablePieces(band?: string): number[] {
  const cuts = cutsFor(band);
  return SUPPORTED_PIECES.filter(n => cuts.some(c => n % c === 0 && Number.isInteger(Math.log2(n / c))));
}

/** The other equal fractions the learner can make for a/b on this band's circle (never b pieces). */
export function equalWays(a: number, d: number, band?: string): Array<{ shaded: number; pieces: number }> {
  return reachablePieces(band).filter(n => n !== d && (a * n) % d === 0).map(n => ({ shaded: (a * n) / d, pieces: n }));
}

/** Targets a/b for the band: proper fractions on an offered cut that have at least one other way to make them. */
export function equalTargets(band?: string): Array<{ numerator: number; denominator: number }> {
  return cutsFor(band).flatMap(d => Array.from({ length: d - 1 }, (_, i) => ({ numerator: i + 1, denominator: d })))
    .filter(f => equalWays(f.numerator, f.denominator, band).length > 0);
}

export const equalBuildInstruction = (a: number, d: number) =>
  `Make a fraction equal to ${a}/${d} your own way: cut the circle into equal pieces, but not ${d}, then shade some.`;

/**
 * `smaller_target` (simplify): another target with fewer pieces, halves first, never the item's value. Null when
 * the item is already halves. Deterministic, so the live journey can rebuild it from its parent.
 */
export function smallerTarget(ch: FractionCirclesChallenge, band?: string): FractionCirclesChallenge | null {
  if (ch.type !== 'build_equal') return null;
  const pick = ([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4]] as const).find(([n, d]) => d < ch.denominator
    && n * ch.denominator !== ch.numerator * d && equalWays(n, d, band).length > 0);
  if (!pick) return null;
  const [numerator, denominator] = pick;
  const instruction = equalBuildInstruction(numerator, denominator);
  return { ...ch, id: `${ch.id}~smaller`, numerator, denominator, instruction, narration: instruction };
}
