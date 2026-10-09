/**
 * The in-item levers on a hundreds-chart item (`/add-support-tiers`, report
 * qa/eval-reports/hundreds-chart-levers-2026-10-08.md). No real-learner evidence: the misses are what
 * `hundredsChartMiss` observes. Pure: the component draws from these, the workspace publishes them, the tests hold
 * each leak rule. Every simpler item has the id `<item>~simpler`, the same mode, and is built by `practiceItem`.
 *
 * - highlight / complete / find_skip_value: `hop_dots` (help) a dot on each cell passed over between one highlighted
 *   (or tapped) number and the next, never past the last one and no number written (`dotsLeak`). On highlight with no
 *   taps yet, the dots run from 1 and stop before the count's first number. Not on a count by 1: there every passed
 *   cell is a number the learner left out.
 * - highlight / complete on a board of two rows or more: `row_tally` (help) a dot at the end of each row for each
 *   highlighted or tapped number in it, the learner's own work only (`tallyLeaks`).
 * - identify_pattern: the shape is the answer, so the help acts on a model outside the item: `model_chart` (help) a
 *   1-30 chart beside the item with ANOTHER count highlighted and its description under it (`modelLeaks`).
 * - every mode: `simpler_chart` (simplify) the same mode on a plainer count (`practiceLeaks`): five cells of a count
 *   by 10s or 5s, a two-choice identify on a column count, a find on four cells of a count by 2s or 5s. Never on an
 *   item already the plainest (a count by 1, by 10s on a cell mode, by 2s on find).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { HundredsChartChallenge } from './HundredsChart';
import { CELL_TYPES, neededCells } from './hundredsChartWorkspace';

export const DOTS_LEVER = 'hop_dots';
export const TALLY_LEVER = 'row_tally';
export const MODEL_LEVER = 'model_chart';
export const SIMPLER_LEVER = 'simpler_chart';
export const PRACTICE_SUFFIX = '~simpler';
/** The model chart's board: three rows, enough to show a column, a diagonal or every other cell. */
export const MODEL_MAX = 30;

/** Correct visual pattern descriptions for each skip value on a 10-wide grid (the generator's options come from here). */
export const PATTERN_DESCRIPTIONS: Record<number, { correct: string; distractors: string[] }> = {
  // skip=1 only becomes reachable inside a resolved sub-100 window (see
  // resolveLegalSkips) — counting in order fills the board solid.
  1:  { correct: 'They fill every row completely',         distractors: ['Every other cell in each row', 'A single diagonal line', 'They are scattered randomly'] },
  2:  { correct: 'Every other cell in each row',           distractors: ['A checkerboard pattern', 'They fill every row completely', 'They are scattered randomly'] },
  3:  { correct: 'A repeating diagonal pattern',           distractors: ['Every other cell in each row', 'They fill two columns', 'A zigzag going left and right'] },
  4:  { correct: 'Columns that shift across rows',         distractors: ['Every other cell in each row', 'A single diagonal line', 'They fill every other row'] },
  5:  { correct: 'Two vertical columns (5th and 10th)',    distractors: ['They fill every other row', 'A diagonal stripe across the grid', 'Every other cell in each row'] },
  6:  { correct: 'A shifting pattern across rows',         distractors: ['Every other cell in each row', 'Two vertical columns', 'They fill every other row'] },
  7:  { correct: 'A shifting diagonal pattern',            distractors: ['Every other cell in each row', 'They fill every other row', 'A zigzag going left and right'] },
  8:  { correct: 'A sparse shifting pattern',              distractors: ['Every other cell in each row', 'A single diagonal line', 'They fill every other row'] },
  9:  { correct: 'A slow diagonal stepping pattern',       distractors: ['They fill every other row', 'Every other cell in each row', 'They are scattered randomly'] },
  10: { correct: 'One vertical column (the last column)',  distractors: ['They fill every other row', 'Every other cell in each row', 'A diagonal stripe across the grid'] },
};

/** What a lever reads beyond the item: the board's end and every item (for "still ahead"). */
export interface ChartSession { challenges?: readonly HundredsChartChallenge[]; gridMax?: number }

const boardEnd = (s: ChartSession) => s.gridMax ?? 100;
const run = (step: number, start: number, end: number, count = Infinity) => {
  const out: number[] = [];
  for (let n = start; n <= end && out.length < count; n += step) out.push(n);
  return out;
};
const sorted = (ns: Iterable<number>) => Array.from(new Set(ns)).sort((a, b) => a - b);

/** The items from `c` on: answers still to be given. */
const ahead = (c: HundredsChartChallenge, s: ChartSession) => {
  const all = s.challenges ?? [];
  const at = all.findIndex(x => x.id === c.id);
  return at < 0 ? all : all.slice(at + 1);
};

// ── hop_dots: the cells passed over, from what is on the board ─────────────

export const dotsAvailable = (c: HundredsChartChallenge) => c.type !== 'identify_pattern' && c.skipValue >= 2
  && (c.type === 'highlight_sequence' ? c.startNumber > 1 : (c.givenCells ?? []).length >= 2);

/** The numbers the dots run between: the highlighted ones and the learner's own taps (highlight: from the chart's
 *  start; with no taps yet, up to the count's first number, which is not marked). */
function anchors(c: HundredsChartChallenge, tapped: readonly number[]): number[] {
  if (c.type === 'highlight_sequence') return tapped.length ? sorted([0, ...tapped]) : [0, c.startNumber];
  return sorted([...(c.givenCells ?? []), ...(c.type === 'complete_sequence' ? tapped : [])]);
}

/** The cells that carry a dot; null when the lever is not on this item. */
export function hopDots(c: HundredsChartChallenge, tapped: readonly number[]): number[] | null {
  if (!dotsAvailable(c)) return null;
  const at = anchors(c, tapped), dots: number[] = [];
  for (let i = 1; i < at.length; i++) for (let n = at[i - 1] + 1; n < at[i]; n++) dots.push(n);
  return dots;
}

/** Leak rule: a dot only on a cell passed over (never highlighted, tapped, or past the last of them); with nothing
 *  tapped, never on a number the learner has to find. */
export function dotsLeak(c: HundredsChartChallenge, tapped: readonly number[], dots: readonly number[]): boolean {
  const marked = new Set([...(c.givenCells ?? []), ...tapped]);
  const last = Math.max(...anchors(c, tapped));
  const needed = new Set(neededCells(c));
  return dots.some(d => marked.has(d) || d >= last || d < 1 || (!tapped.length && needed.has(d)));
}

export function dotsFact(c: HundredsChartChallenge, tapped: readonly number[]): string {
  if (c.type === 'highlight_sequence' && !tapped.length) {
    return 'A small dot on each of the first cells of the chart, stopping before the count\'s first number; no numbers '
      + 'are written on the dots and nothing else is marked';
  }
  const what = c.type === 'complete_sequence' && tapped.length ? 'highlighted or tapped number'
    : c.type === 'highlight_sequence' ? 'tapped number (and from the start of the chart to the first tap)' : 'highlighted number';
  return `A small dot on each cell passed over between one ${what} and the next; no numbers are written on the dots `
    + `and nothing is marked past ${Math.max(...anchors(c, tapped))}`;
}

// ── row_tally: the learner's own work, counted per row ─────────────────────

export const tallyAvailable = (c: HundredsChartChallenge, gridMax: number) => CELL_TYPES.has(c.type) && gridMax > 10;

/** One count per row of the highlighted and tapped numbers in it. */
export function rowTally(c: HundredsChartChallenge, tapped: readonly number[], gridMax: number): number[] {
  const rows = Array.from({ length: Math.ceil(gridMax / 10) }, () => 0);
  for (const n of sorted([...(c.givenCells ?? []), ...tapped])) if (n >= 1 && n <= gridMax) rows[Math.floor((n - 1) / 10)]++;
  return rows;
}

/** Leak rule: the tally holds only what is marked on the board, never the pattern's own count for a row. */
export function tallyLeaks(c: HundredsChartChallenge, tapped: readonly number[], tally: readonly number[]): boolean {
  return tally.reduce((a, b) => a + b, 0) !== sorted([...(c.givenCells ?? []), ...tapped]).length;
}

export const TALLY_FACT = 'At the end of each row, one dot for each highlighted or tapped number in that row (no numbers written)';

// ── model_chart: identify_pattern, a model outside the item ────────────────

export interface ChartModel { step: number; caption: string; cells: number[] }
const MODEL_STEPS = [1, 2, 5, 10, 3, 4];

/** Leak rule: never the item's own count or its description, never a description a later item answers. */
export function modelLeaks(model: ChartModel, c: HundredsChartChallenge, s: ChartSession): boolean {
  return model.step === c.skipValue || model.caption === c.correctAnswer
    || ahead(c, s).some(x => x.type === 'identify_pattern' && x.correctAnswer === model.caption);
}

/** Another count on a 1-30 chart with its description, preferring one that is a wrong choice on this item (so the
 *  learner can hold it beside their chart and rule it out). */
export function modelChart(c: HundredsChartChallenge, s: ChartSession): ChartModel | null {
  if (c.type !== 'identify_pattern') return null;
  const options = new Set(c.options ?? []);
  const order = [...MODEL_STEPS.filter(k => options.has(PATTERN_DESCRIPTIONS[k].correct)),
    ...MODEL_STEPS.filter(k => !options.has(PATTERN_DESCRIPTIONS[k].correct))];
  for (const step of order) {
    const model = { step, caption: PATTERN_DESCRIPTIONS[step].correct, cells: run(step, step, MODEL_MAX) };
    if (!modelLeaks(model, c, s)) return model;
  }
  return null;
}

export function modelFact(model: ChartModel, c: HundredsChartChallenge): string {
  const choice = (c.options ?? []).includes(model.caption) ? ' (one of the choices)' : '';
  return `A small model chart of 1 to ${MODEL_MAX} beside the item, the count by ${model.step}s highlighted on it, `
    + `captioned "${model.caption}"${choice}; nothing is drawn on the item's chart`;
}

// ── simpler items ──────────────────────────────────────────────────────────

/** Plainest first. Cell modes and identify: a column (10s), then two columns (5s), then every other cell (2s).
 *  find_skip_value: the smallest gap to count first. A count by 1 is plainer than any. */
const EASE: Record<HundredsChartChallenge['type'], number[]> = {
  highlight_sequence: [10, 5, 2], complete_sequence: [10, 5, 2], identify_pattern: [10, 5, 2], find_skip_value: [2, 5, 10],
};
const rank = (type: HundredsChartChallenge['type'], step: number) => step === 1 ? -1
  : EASE[type].includes(step) ? EASE[type].indexOf(step) : EASE[type].length;

const FAR = ['They are scattered randomly', 'They fill the whole grid'];
const FAR_STEPS = [10, 3, 7, 9];
const PRACTICE_RUN = 5;

const practiceOf = (c: HundredsChartChallenge, fields: Partial<HundredsChartChallenge>): HundredsChartChallenge =>
  ({ ...c, id: `${c.id}${PRACTICE_SUFFIX}`, supportTier: undefined, hint: '', options: [], correctAnswer: '', ...fields });

/** The answer an item asks for, as text: the cells still to tap, the description, or the skip value. */
const answerOf = (c: HundredsChartChallenge) => c.type === 'identify_pattern' ? c.correctAnswer
  : c.type === 'find_skip_value' ? String(c.skipValue) : sorted(neededCells(c)).join(',');
const startsWith = (whole: string, head: string) => head.length > 0 && (whole === head || whole.startsWith(`${head},`));

/**
 * Leak rule for a simpler item: the same mode, its own id, another count than the item's, never the item's answer or
 * the start of it, never another item of the lesson as it stands, and (identify, find) never a later item's answer.
 */
export function practiceLeaks(p: HundredsChartChallenge, c: HundredsChartChallenge, s: ChartSession): boolean {
  if (p.id === c.id || p.type !== c.type || p.skipValue === c.skipValue) return true;
  const pa = answerOf(p), ca = answerOf(c);
  if (startsWith(ca, pa) || startsWith(pa, ca)) return true;
  if (c.type === 'identify_pattern' && p.options.includes(c.correctAnswer)) return true;
  if (c.type === 'find_skip_value' && p.options.includes(String(c.skipValue))) return true;
  const others = (s.challenges ?? []).filter(x => x.id !== c.id && x.type === p.type);
  if (others.some(x => answerOf(x) === pa && sorted(x.givenCells ?? []).join() === sorted(p.givenCells ?? []).join())) return true;
  return !CELL_TYPES.has(c.type) && ahead(c, s).some(x => x.type === p.type && answerOf(x) === pa);
}

function build(c: HundredsChartChallenge, step: number, end: number): HundredsChartChallenge | null {
  switch (c.type) {
    case 'highlight_sequence': {
      const cells = run(step, step, end, PRACTICE_RUN);
      if (cells.length < 2) return null;
      return practiceOf(c, { skipValue: step, startNumber: step, givenCells: [], correctCells: cells,
        instruction: `Tap every number in the skip-counting-by-${step}s pattern, up to ${cells.at(-1)}.` });
    }
    case 'complete_sequence': {
      const cells = run(step, step, end, PRACTICE_RUN);
      if (cells.length < 3) return null;
      return practiceOf(c, { skipValue: step, startNumber: step, givenCells: cells.slice(0, 2), correctCells: cells.slice(2),
        instruction: `The first 2 numbers are highlighted. Tap the rest of the pattern, up to ${cells.at(-1)}.` });
    }
    case 'identify_pattern': {
      if (end < MODEL_MAX) return null;
      const correct = PATTERN_DESCRIPTIONS[step].correct;
      const far = FAR.find(f => f !== correct && f !== c.correctAnswer);
      if (!far) return null;
      return practiceOf(c, { skipValue: step, startNumber: step, givenCells: run(step, step, end), correctCells: run(step, step, end),
        correctAnswer: correct, options: [correct, far].sort(),
        instruction: 'Look at the highlighted cells. Which description best matches the visual pattern on the grid?' });
    }
    case 'find_skip_value': {
      const cells = run(step, step, end, 4);
      const far = FAR_STEPS.find(f => f !== step && f !== step * 2 && f * 2 !== step && f !== c.skipValue);
      if (cells.length < 3 || far === undefined) return null;
      return practiceOf(c, { skipValue: step, startNumber: step, givenCells: cells, correctCells: cells,
        correctAnswer: String(step), options: [String(step), String(far)].sort((a, b) => Number(a) - Number(b)),
        instruction: 'Look at the highlighted numbers. What is the skip value (how much is added each step)?' });
    }
  }
}

/** The simpler item for a session item, same mode, or null on an item already the plainest. Prefers a count no
 *  item still ahead uses. */
export function practiceItem(c: HundredsChartChallenge, s: ChartSession): HundredsChartChallenge | null {
  const own = rank(c.type, c.skipValue);
  const easier = EASE[c.type].filter(k => rank(c.type, k) < own);
  const used = new Set(ahead(c, s).filter(x => x.type === c.type).map(x => x.skipValue));
  for (const step of [...easier.filter(k => !used.has(k)), ...easier.filter(k => used.has(k))]) {
    const p = build(c, step, boardEnd(s));
    if (p && !practiceLeaks(p, c, s)) return p;
  }
  return null;
}

/** The session item a practice id stands in for. */
export const practiceParent = (id: string | null | undefined, challenges: readonly HundredsChartChallenge[]) =>
  id?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === id) ?? null : null;

/** Easy starts with the item's picture help shown (the learner can check against it); a starting position is not a
 *  pull. The row tally follows the learner's own taps, so it is only ever pulled. */
export const helpStartsShown = (c: HundredsChartChallenge, id: string) => c.supportTier === 'easy' && id !== TALLY_LEVER;

const CELL_MISSES = ['stopped_early', 'gaps_left', 'extra_cells', 'other_step', 'stray_cells'];
const SKIP_MISSES = ['twice_the_step', 'half_the_step', 'one_short', 'one_over', 'short_by_more', 'over_by_more'];
export const IDENTIFY_MISSES = ['chose_rows', 'chose_columns', 'chose_diagonal', 'chose_scattered'];

/** The levers on a session item. `pulled` holds this item's runtime pulls. */
export function hundredsChartLevers(c: HundredsChartChallenge | null, s: ChartSession, pulled: readonly string[]): WorkspaceLever[] {
  if (!c) return [];
  const levers: WorkspaceLever[] = [];
  const help = (id: string, carrier: WorkspaceLever['carrier'], when: string, does: string, answers: string[]) =>
    levers.push({ id, kind: 'help', carrier, when, does, pulled: helpStartsShown(c, id) || pulled.includes(id), answers });
  const back = 'then this item comes back blank.';
  if (dotsAvailable(c)) help(DOTS_LEVER, 'shown',
    c.type === 'find_skip_value' ? 'The learner picks a skip value that does not match how far apart the highlighted numbers are.'
      : 'The learner\'s taps do not land the same distance apart, skip numbers, or leave the count.',
    c.type === 'find_skip_value'
      ? 'Puts a small dot on each cell passed over between one highlighted number and the next, with no numbers written. '
        + 'You may point to the dots and the highlighted numbers; never count the dots or say the skip value.'
      : 'Puts a small dot on each cell passed over between the highlighted numbers and the learner\'s own taps, never past '
        + 'the last of them. You may point to the dots; never say which number to tap next or count the dots.',
    c.type === 'find_skip_value' ? SKIP_MISSES : ['other_step', 'stray_cells', 'gaps_left', 'extra_cells']);
  if (tallyAvailable(c, boardEnd(s))) help(TALLY_LEVER, 'shown',
    'The learner stops before the end of the chart, leaves numbers out, or adds numbers that are not in the count.',
    'Puts a dot at the end of each row for each highlighted or tapped number in that row, following the learner\'s own '
      + 'taps. You may point to rows whose dots differ; never say how many a row should have or which number is missing.',
    CELL_MISSES);
  const model = modelChart(c, s);
  if (model) help(MODEL_LEVER, 'both',
    'The learner picks a description that does not match the shape the highlighted cells make.',
    'Draws a small 1-30 model chart beside the item with another count highlighted and its description under it. You may '
      + 'read the caption and compare the two charts; never name the shape of the item\'s chart or point to its choice.',
    IDENTIFY_MISSES);
  if (practiceItem(c, s)) levers.push({ id: SIMPLER_LEVER, kind: 'simplify', carrier: 'shown',
    when: 'The learner cannot do this item even with the help on screen: a plainer count first.',
    does: c.type === 'identify_pattern' ? `Opens an ungraded practice chart of a plainer count with two choices; ${back}`
      : c.type === 'find_skip_value' ? `Opens an ungraded practice chart with four numbers of a plainer count and two choices; ${back}`
        : `Opens an ungraded practice chart: five numbers of a plainer count; ${back}`,
    pulled: pulled.includes(SIMPLER_LEVER),
    answers: c.type === 'identify_pattern' ? IDENTIFY_MISSES : c.type === 'find_skip_value' ? SKIP_MISSES : CELL_MISSES });
  return levers;
}

export const PRACTICE_NOTE = 'An easier practice chart, ungraded; the full item comes back after it.';
