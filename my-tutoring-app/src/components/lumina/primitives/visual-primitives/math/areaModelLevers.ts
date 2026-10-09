/**
 * The in-item levers on an area-model item (`/add-support-tiers`; report qa/eval-reports/area-model-levers-2026-10-09.md).
 * No real-learner evidence: the misses are what `areaMiss` observes, drawn from the catalog's commonStruggles and the
 * remediation module. Pure: the component draws from these, the workspace publishes them, the tests hold each leak
 * rule. A tier aid already on screen (cell labels, the side sum, the start cell) counts as pulled.
 *
 * Forward modes (build_model, find_area, multiply). Every cell product and the total are the answers, so no lever
 * prints one.
 * - `cell_labels` (help): each cell shows its column part × its row part (the tier's own label render).
 * - `tens_split` (help): under each cell with a tens part, its parts split into a one-digit fact and its tens
 *   ("3 × 4 × 10 × 10"). Never the fact's result.
 * - `cell_dots` (help): each cell whose two parts are both 10 or less is drawn as rows of dots, row part rows of
 *   column part dots. No number.
 * - `stack_products` (help): at the sum step, the right cell products the learner typed stand in one column, lined
 *   up by place value, with no total. Refused before every cell is right.
 * - `easier_model` (simplify): an ungraded model of the same shape whose parts use the digits 1 to 3, sharing no
 *   cell product, total or perimeter with the item, then the full item back.
 * Perimeter:
 * - `all_sides` (help): all four sides of the rectangle labelled, not only the top and the left.
 * - `side_sum` (help): the four sides written out as an addition with no total (the tier's own render).
 * - `smaller_rectangle` (simplify): an ungraded rectangle with sides of 5 or less, sharing no area or perimeter.
 * Factor:
 * - `start_cell` (help): the top-left cell highlighted as the place to start (the tier's own highlight).
 * - `shared_parts` (help): each column of cells outlined in the colour of its blank column part, each row in the
 *   colour of its blank row part, so which cells share a part shows. No number.
 * - `easier_grid` (simplify): as `easier_model`, on the factor task, sharing no part either.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { AreaModelChallenge, AreaModelChallengeType } from './AreaModel';
import { CELL_MISSES, FACTOR_MISSES, PERIMETER_MISSES, SUM_MISSES, cellProducts, isForward, type AreaModelMiss } from './areaModelWorkspace';

export const CELL_LABELS_LEVER = 'cell_labels';
export const TENS_SPLIT_LEVER = 'tens_split';
export const CELL_DOTS_LEVER = 'cell_dots';
export const STACK_LEVER = 'stack_products';
export const EASIER_MODEL_LEVER = 'easier_model';
export const ALL_SIDES_LEVER = 'all_sides';
export const SIDE_SUM_LEVER = 'side_sum';
export const SMALLER_RECT_LEVER = 'smaller_rectangle';
export const START_CELL_LEVER = 'start_cell';
export const SHARED_PARTS_LEVER = 'shared_parts';
export const EASIER_GRID_LEVER = 'easier_grid';

export const PRACTICE_SUFFIX = '~easier';
export const isPractice = (c: Pick<AreaModelChallenge, 'id'>) => c.id.endsWith(PRACTICE_SUFFIX);
export const PRACTICE_NOTE = 'An easier practice item, ungraded; the full item comes back after it.';

const sum = (parts: readonly number[]) => parts.reduce((s, v) => s + v, 0);
const placeOf = (part: number) => 10 ** Math.max(0, String(part).length - 1);

// ── tens_split ────────────────────────────────────────────────────────────────

/** A part as its one-digit fact factor and its tens: 300 → [3, 100], 7 → [7]. */
const splitPart = (part: number): number[] => {
  const p = placeOf(part);
  return p > 1 && part % p === 0 ? [part / p, p] : [part];
};

/** The split written under one cell, or null when the cell has no tens part (nothing to split). */
export function tensSplit(col: number, row: number): string | null {
  if (placeOf(col) === 1 && placeOf(row) === 1) return null;
  const [a, ...ta] = splitPart(col), [b, ...tb] = splitPart(row);
  const tens = [...ta, ...tb].flatMap(t => Array.from({ length: Math.round(Math.log10(t)) }, () => 10));
  return [a, b, ...tens].join(' × ');
}

/**
 * Leak rule for `tens_split` (and any lever text): a number that is a cell product, the total, or the perimeter,
 * and is not already printed as a part, is the answer and must not appear.
 */
export function textLeaks(c: AreaModelChallenge, text: string): boolean {
  const shown = new Set([...c.factor1Parts, ...c.factor2Parts]);
  const keys = new Set([...cellProducts(c).flat(), sum(c.factor1Parts) * sum(c.factor2Parts), 2 * (sum(c.factor1Parts) + sum(c.factor2Parts))]);
  return (text.match(/\d+/g) ?? []).map(Number).some(n => keys.has(n) && !shown.has(n));
}

/** The split under each cell ("row,col" → text), only for cells with a tens part and only where it leaks nothing. */
export function tensSplits(c: AreaModelChallenge): Record<string, string> {
  const out: Record<string, string> = {};
  c.factor2Parts.forEach((row, r) => c.factor1Parts.forEach((col, k) => {
    const text = tensSplit(col, row);
    if (text && !textLeaks(c, text)) out[`${r},${k}`] = text;
  }));
  return out;
}

/** Cells drawn as dots: both parts 10 or less. */
export const dotCells = (c: AreaModelChallenge): Array<[number, number]> =>
  c.factor2Parts.flatMap((row, r) => c.factor1Parts.flatMap((col, k) => (row <= 10 && col <= 10 ? [[r, k] as [number, number]] : [])));

// ── simplify ──────────────────────────────────────────────────────────────────

/** The numbers an item asks the learner to find: the cell products and the total, the perimeter, or the parts. */
const answersOf = (c: AreaModelChallenge, mode: AreaModelChallengeType): number[] => {
  const w = sum(c.factor1Parts), h = sum(c.factor2Parts);
  return mode === 'perimeter' ? [2 * (w + h)] : mode === 'factor' ? [...c.factor1Parts, ...c.factor2Parts] : [...cellProducts(c).flat(), w * h];
};
/** The numbers an item prints: the parts and sides, or on factor the cell products and the total area. */
const printedOf = (c: AreaModelChallenge, mode: AreaModelChallengeType): number[] =>
  mode === 'factor' ? [...cellProducts(c).flat(), sum(c.factor1Parts) * sum(c.factor2Parts)] : [...c.factor1Parts, ...c.factor2Parts];

/**
 * Leak rule for an easier item: never the item itself or another shape, and nothing the easier item asks for or
 * prints is one of the item's answers.
 */
export function practiceLeaks(parent: AreaModelChallenge, p: AreaModelChallenge, mode: AreaModelChallengeType): boolean {
  if (p.id === parent.id || p.factor1Parts.length !== parent.factor1Parts.length || p.factor2Parts.length !== parent.factor2Parts.length) return true;
  const keys = new Set(answersOf(parent, mode));
  return [...answersOf(p, mode), ...printedOf(p, mode)].some(n => keys.has(n));
}

const digitSum = (c: AreaModelChallenge) => [...c.factor1Parts, ...c.factor2Parts].reduce((s, part) => s + part / placeOf(part), 0);

/** Every way to choose a digit from `digits` for each part, keeping each part's place; smallest digits first. */
function easierParts(parts: readonly number[], digits: readonly number[]): number[][] {
  if (!parts.length) return [[]];
  const [first, ...rest] = parts;
  const tails = easierParts(rest, digits);
  return digits.flatMap(d => tails.map(tail => [d * placeOf(first), ...tail]));
}

/**
 * The easier ask, in the item's own mode. Grid modes: the same grid shape, every part's digit 1 to 3 (a one-digit
 * factor 2 or 3), sharing no answer with the item and strictly easier digits. Perimeter: a rectangle with sides of 5 or
 * less, never a square. Null on a practice item or when nothing passes the leak rule.
 */
export function practiceItem(c: AreaModelChallenge, mode: AreaModelChallengeType): AreaModelChallenge | null {
  if (isPractice(c)) return null;
  const id = `${c.id}${PRACTICE_SUFFIX}`;
  if (mode === 'perimeter') {
    for (const [w, h] of [[3, 2], [4, 2], [4, 3], [5, 2], [5, 3], [5, 4]]) {
      const p = { ...c, id, labels: undefined, factor1Parts: [w], factor2Parts: [h] };
      if (!practiceLeaks(c, p, mode)) return p;
    }
    return null;
  }
  const digitsFor = (parts: readonly number[]) => (parts.length === 1 && parts[0] < 10 ? [2, 3] : [1, 2, 3]);
  for (const f1 of easierParts(c.factor1Parts, digitsFor(c.factor1Parts))) {
    for (const f2 of easierParts(c.factor2Parts, digitsFor(c.factor2Parts))) {
      const p = { ...c, id, labels: undefined, factor1Parts: f1, factor2Parts: f2 };
      if (!practiceLeaks(c, p, mode) && digitSum(p) < digitSum(c)) return p;
    }
  }
  return null;
}

export const practiceParent = (itemId: string | null | undefined, challenges: readonly AreaModelChallenge[]) =>
  itemId?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === itemId) ?? null : null;

// ── declarations ──────────────────────────────────────────────────────────────

/** What the session already draws: a tier aid on screen is a lever already pulled. */
export interface AreaLeverContext { mode: AreaModelChallengeType; cellsLabelled: boolean; sideSumShown: boolean; startCellShown: boolean }

export function areaModelLevers(c: AreaModelChallenge | null, pulled: readonly string[], ctx: AreaLeverContext): WorkspaceLever[] {
  if (!c || isPractice(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly AreaModelMiss[], when: string, does: string, on = false): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: on || pulled.includes(id), answers, when, does });
  const simpler = practiceItem(c, ctx.mode);
  const ungraded = 'It is not graded; the full item comes back after it, blank.';
  if (isForward(ctx.mode)) return [
    lever(CELL_LABELS_LEVER, 'help', ['added_not_multiplied', 'one_group_off', 'wrong_product'],
      'The learner adds the two parts, or multiplies the wrong pair.',
      'Writes in every cell its column part × its row part, the two numbers to multiply. No product is shown.', ctx.cellsLabelled),
    ...(Object.keys(tensSplits(c)).length ? [lever(TENS_SPLIT_LEVER, 'help', ['dropped_zeros', 'extra_zeros', 'wrong_product'],
      'The learner gets the one-digit fact right but drops or adds zeros.',
      'Under each cell with a tens part, writes its parts split into a one-digit fact and its tens, like 3 × 4 × 10 × 10. '
        + 'Never the product.')] : []),
    ...(dotCells(c).length ? [lever(CELL_DOTS_LEVER, 'help', ['one_group_off', 'added_not_multiplied', 'wrong_product'],
      'The learner is one group off on a small cell, or does not see the cell as rows of equal groups.',
      'Draws each small cell (both parts 10 or less) as rows of dots: one row for each of its row part, each row as long '
        + 'as its column part. No number is drawn.')] : []),
    lever(STACK_LEVER, 'help', [...SUM_MISSES],
      'At the sum, the learner leaves out a cell or slips adding across places.',
      'Stands the right cell products the learner typed in one column, lined up by ones, tens and hundreds, with no total. '
        + 'Only once every cell is right.'),
    ...(simpler ? [lever(EASIER_MODEL_LEVER, 'simplify', [...CELL_MISSES, ...SUM_MISSES],
      'The learner cannot work a model this big yet.',
      `Opens an easier model of the same shape first, its parts using only the digits 1 to 3. ${ungraded}`)] : []),
  ];
  if (ctx.mode === 'perimeter') return [
    lever(ALL_SIDES_LEVER, 'help', ['two_sides_only', 'three_sides', 'gave_area'],
      'The learner adds only the two labelled sides, or three, or multiplies them.',
      'Labels all four sides of the rectangle, the bottom and the right as well as the top and the left. No total.'),
    lever(SIDE_SUM_LEVER, 'help', [...PERIMETER_MISSES],
      'The learner multiplies the sides, or does not add all four.',
      'Writes the four sides out as one addition, length + width + length + width, with no total.', ctx.sideSumShown),
    ...(simpler ? [lever(SMALLER_RECT_LEVER, 'simplify', [...PERIMETER_MISSES],
      'The learner cannot work the perimeter of this rectangle yet.',
      'Opens a small rectangle first, its sides 5 or less. It is not graded; the full item comes back after it.')] : []),
  ];
  return [
    lever(START_CELL_LEVER, 'help', ['parts_wrong', 'one_part_wrong'],
      'The learner does not know where to start.',
      'Highlights the top-left cell, the one made by the first column part and the first row part, as the place to start. No number.',
      ctx.startCellShown),
    lever(SHARED_PARTS_LEVER, 'help', [...FACTOR_MISSES],
      'The learner mixes up column parts and row parts, or does not see which cells share a part.',
      'Outlines each column of cells in the colour of its blank column part, and each row in the colour of its blank row part. No number.'),
    ...(simpler ? [lever(EASIER_GRID_LEVER, 'simplify', [...FACTOR_MISSES],
      'The learner cannot find the parts of this grid yet.',
      'Opens an easier grid of the same shape first, its parts using only the digits 1 to 3. It is not graded; the full item comes back after it.')] : []),
  ];
}

/** What the pulled help levers put on screen, for the tutor. Never a product, total, perimeter or part. */
export function leverFacts(c: AreaModelChallenge | null, pulled: readonly string[], mode: AreaModelChallengeType): string {
  if (!c || isPractice(c)) return '';
  return [
    isForward(mode) && pulled.includes(CELL_LABELS_LEVER) && 'Every cell now shows its column part × its row part.',
    isForward(mode) && pulled.includes(TENS_SPLIT_LEVER) && 'Under each cell with a tens part, its parts are written split into a one-digit fact and its tens.',
    isForward(mode) && pulled.includes(CELL_DOTS_LEVER) && 'Each small cell is drawn as rows of dots, one row for each of its row part.',
    isForward(mode) && pulled.includes(STACK_LEVER) && 'The right cell products stand in one column, lined up by place, with no total.',
    mode === 'perimeter' && pulled.includes(ALL_SIDES_LEVER) && 'All four sides of the rectangle are labelled.',
    mode === 'perimeter' && pulled.includes(SIDE_SUM_LEVER) && 'The four sides are written out as one addition, with no total.',
    mode === 'factor' && pulled.includes(START_CELL_LEVER) && 'The top-left cell is highlighted as the place to start.',
    mode === 'factor' && pulled.includes(SHARED_PARTS_LEVER) && 'Each column of cells is outlined in its column part\'s colour and each row in its row part\'s colour.',
  ].filter((s): s is string => !!s).join(' ');
}
