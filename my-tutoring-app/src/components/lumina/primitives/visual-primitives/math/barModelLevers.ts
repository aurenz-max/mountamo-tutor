/**
 * The in-item levers on bar-model's twelve answer-on-the-graph and spoken modes (`/add-support-tiers`, report
 * qa/eval-reports/bar-model-levers-2026-10-08.md). make_graph keeps its own levers (`barModelBuild.ts`). No real-learner
 * evidence: the misses are what `barModelMiss` and `barModelSpokenMisses` observe. Pure: the component draws from
 * these, the workspace publishes them, the tests hold each leak rule. Every simpler item has the id `<item>~simpler`,
 * the same mode, and is built by `simplerGraph`.
 *
 * Help (the graph shows more; the item is unchanged):
 * - `mark_row`: the row the question names gets the amber mark. Only where the answer is the row's NUMBER.
 * - `group_fives`: a gap after every fifth picture in each picture row. No number is written.
 * - `pile_row` (match_to_bar): the group to count drawn again as a row in the graph's columns. Not tappable, no number.
 * - `sort_pile` (build_one_to_one): the pile redrawn sorted, one line per kind in the rows' order.
 * - `word_model`: a model beside the graph in pictures the item does not use, its rows labelled with the comparison
 *   words. Never a row of the item.
 * - `pair_rows` (compare_two_graphs): each kind's two rows, one from each survey, drawn next to each other.
 * - `guide_line` (scaled bars): a dashed line at the end of the asked bar, down to the axis. No number.
 * - `minor_ticks` (scaled bars, step > 1): an unlabelled mark at every 1 between the numbered ticks.
 * - `icon_values` (picture_graph): the key's number under every picture. Never a running total.
 * - `bar_values` / `mark_bars` (graph_word_problem): the bars' numbers; the bars the question names marked.
 * - `data_beside` / `step_marks` (build_graph): the question's own numbers beside each control; how many marks each
 *   step needs to reach the learner's own tallest bar.
 * Simplify `simpler_graph`: fewer rows, a wider gap, a finer axis or key, or a one-step question, of the same mode,
 * never the item's answer.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { BarModelChallenge, BarModelEvalMode, BarValue } from './BarModel';

export const MARK_ROW = 'mark_row';
export const GROUP_FIVES = 'group_fives';
export const PILE_ROW = 'pile_row';
export const SORT_PILE = 'sort_pile';
export const WORD_MODEL = 'word_model';
export const PAIR_ROWS = 'pair_rows';
export const GUIDE_LINE = 'guide_line';
export const MINOR_TICKS = 'minor_ticks';
export const ICON_VALUES = 'icon_values';
export const BAR_VALUES = 'bar_values';
export const MARK_BARS = 'mark_bars';
export const DATA_BESIDE = 'data_beside';
export const STEP_MARKS = 'step_marks';
export const SIMPLER = 'simpler_graph';
export const PRACTICE_SUFFIX = '~simpler';
export const PRACTICE_NOTE = 'An easier graph, ungraded. The full graph comes back after it.';

const OFF = ['one_short', 'one_over', 'short_by_more', 'over_by_more'];

/** Modes whose answer is a row's own number: marking the row names no answer. */
const READ_ROW: ReadonlySet<BarModelEvalMode> = new Set<BarModelEvalMode>(['read_one_to_one', 'read_scale', 'picture_graph', 'scaled_bar_graph']);

export const isSimplerGraph = (c: Pick<BarModelChallenge, 'id'> | null) => !!c?.id.endsWith(PRACTICE_SUFFIX);
/** The session item a practice id stands in for. */
export const simplerParent = (id: string | null | undefined, challenges: readonly BarModelChallenge[]) =>
  id?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === id) ?? null : null;

// ── help: what each lever can draw on an item ────────────────────────────────

/** Leak rule: a mark on a row is the answer wherever the answer IS a row (most_least, compare_bars, match_to_bar). */
export const markRowLeaks = (c: BarModelChallenge) => !READ_ROW.has(c.evalMode) || typeof c.targetBarIndex !== 'number';

/** The picture rows `group_fives` changes: rows of one picture per thing holding more than five. On read_one_to_one
 *  the asked row must be one of them, so the gap is where the counting is. */
export function fivesRows(c: BarModelChallenge): number[] {
  if (c.graphStyle !== 'picture' || (c.scale?.iconValue ?? 1) > 1) return [];
  const rows = c.values.map((v, i) => [v.value, i] as const).filter(([v]) => v > 5).map(([, i]) => i);
  if (c.evalMode === 'read_one_to_one') return rows.includes(c.targetBarIndex ?? -1) ? rows : [];
  if (c.evalMode === 'build_one_to_one') return (c.expectedCounts ?? []).some(n => n > 5) ? c.values.map((_, i) => i) : [];
  return rows;
}

/** The model for `word_model`: pictures the item does not use, row lengths no row of the item has. */
export interface WordModel { glyph: string; rows: { count: number; word: string }[] }
const MODEL_GLYPHS = ['⭐', '🔵', '🍀', '🔺'];

export function wordModel(c: BarModelChallenge): WordModel | null {
  const used = new Set([...c.values, ...(c.secondValues ?? [])].map(v => v.emoji).concat(c.scale?.iconEmoji, ...(c.sourceItems ?? []).map(s => s.emoji)));
  const glyph = MODEL_GLYPHS.find(g => !used.has(g));
  if (!glyph) return null;
  const rows = c.evalMode === 'most_least'
    ? [{ count: 5, word: 'most' }, { count: 3, word: '' }, { count: 1, word: 'fewest' }]
    : [{ count: 5, word: 'more' }, { count: 2, word: 'fewer' }];
  const model = { glyph, rows };
  return wordModelLeaks(model, c) ? null : model;
}

/** Leak rule: a model picture on the item, or a model built from the item's own rows, would be the item's comparison. */
export function wordModelLeaks(m: WordModel, c: BarModelChallenge): boolean {
  const glyphs = [...c.values, ...(c.secondValues ?? [])].map(v => v.emoji).concat(c.scale?.iconEmoji);
  if (glyphs.includes(m.glyph)) return true;
  const own = c.values.map(v => v.value).join();
  return m.rows.map(r => r.count).join() === own;
}

/** The rows a word problem's question names, by their labels in its words. */
export function namedRows(c: BarModelChallenge): number[] {
  const words = c.prompt.toLowerCase();
  const stem = (s: string) => s.toLowerCase().replace(/(es|s)$/, '');
  return c.values.map((v, i) => [v.label, i] as const)
    .filter(([label]) => words.includes(label.toLowerCase()) || words.includes(stem(label))).map(([, i]) => i);
}

/** Leak rule: on a word problem, a bar's number on screen is a candidate answer when the answer is one of them. */
export const barValuesLeak = (c: BarModelChallenge) => c.values.some(v => v.value === c.expectedValue);

/** Leak rule for `data_beside`: only numbers the question's own words state, each beside the row its words name. */
export function dataBesideLeaks(c: BarModelChallenge): boolean {
  const data = c.expectedDataset ?? [];
  if (!data.length) return true;
  return data.some(e => !new RegExp(`${e.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\W{0,4}${e.value}\\b`, 'i').test(c.prompt));
}

/** How many numbered marks each step needs to reach the learner's own tallest bar; null before a bar is set. */
export function stepMarks(steps: readonly number[], built: readonly { value: number }[]): Record<number, number> | null {
  const top = Math.max(0, ...built.map(b => b.value));
  return top > 0 ? Object.fromEntries(steps.map(s => [s, Math.ceil(top / s)])) : null;
}

/** The unlabelled minor mark spacing for a scaled axis, or null where the axis already counts by one. */
export function minorStep(c: BarModelChallenge): number | null {
  const step = c.scale?.step ?? 1, max = c.scale?.max ?? 0;
  if (c.graphStyle !== 'scaled_bar' || step <= 1 || !max) return null;
  return max <= 60 ? 1 : step / 5 >= 1 && Number.isInteger(step / 5) ? step / 5 : null;
}

// ── simpler items ────────────────────────────────────────────────────────────

const practiceOf = (c: BarModelChallenge, fields: Partial<BarModelChallenge>): BarModelChallenge =>
  ({ ...c, id: `${c.id}${PRACTICE_SUFFIX}`, hint: '', narration: '', ...fields });

/** The answer the learner is stuck on, in comparable form. */
function answerOf(c: BarModelChallenge): string {
  switch (c.evalMode) {
    case 'most_least': case 'compare_bars': case 'match_to_bar': return `row:${c.values[c.targetBarIndex ?? -1]?.label}`;
    case 'build_one_to_one': return `counts:${(c.expectedCounts ?? []).join()}`;
    default: return `n:${c.expectedValue}`;
  }
}

/** Leak rule for a simpler item: never the item's id, mode change, answer, or rows. */
export function simplerLeaks(p: BarModelChallenge, c: BarModelChallenge): boolean {
  if (p.id === c.id || p.evalMode !== c.evalMode) return true;
  if (answerOf(p) === answerOf(c)) return true;
  const rows = (x: BarModelChallenge) => x.values.map(v => `${v.label}=${v.value}`).join();
  return c.evalMode !== 'build_one_to_one' && rows(p) === rows(c);
}

const options = (want: number, step: number, floor = 0) => {
  const out = new Set<number>([want]);
  for (const d of [step, -step, 2 * step, -2 * step, 3 * step]) if (out.size < 4 && want + d >= floor) out.add(want + d);
  return Array.from(out).sort((a, b) => a - b);
};

/** read_one_to_one: the asked row and one other, the asked row shorter (2-4 pictures) and far from the other. */
function simplerRead(c: BarModelChallenge): BarModelChallenge | null {
  const t = c.targetBarIndex ?? -1, row = c.values[t];
  if (!row) return null;
  const n = [4, 3, 2].find(k => k < row.value);
  if (n == null) return null;
  const oi = c.values.findIndex((_, i) => i !== t);
  const otherN = n + 4;
  const values = [[t, n], [oi, otherN]].sort((x, y) => x[0] - y[0]).map(([i, value]) => ({ ...c.values[i], value }));
  return practiceOf(c, { values, targetBarIndex: values.findIndex(v => v.label === row.label), expectedValue: n,
    options: options(n, 1, 1), scale: c.scale ? { ...c.scale, max: Math.max(c.scale.max, otherN) } : c.scale });
}

/** The gap between the extreme row and its nearest rival. */
const extremeGap = (values: readonly number[], target: number) => {
  const others = values.filter((_, i) => i !== target);
  return others.length ? Math.min(...others.map(v => Math.abs(v - values[target]))) : 0;
};

/** most_least: three rows, the extreme three ahead, and a different row is the extreme. */
function simplerMostLeast(c: BarModelChallenge): BarModelChallenge | null {
  const t = c.targetBarIndex ?? -1, vs = c.values.map(v => v.value);
  if (!c.values[t]) return null;
  if (c.values.length <= 3 && extremeGap(vs, t) >= 3) return null;
  const most = vs[t] === Math.max(...vs);
  const keep = c.values.slice(0, 3).some((_, i) => i === t) ? c.values.slice(0, 3) : [c.values[0], c.values[1], c.values[t]];
  const newT = keep.findIndex((_, i) => keep[i].label !== c.values[t].label);
  const rivals = most ? [4, 2] : [4, 6];
  let k = 0;
  const counts = keep.map((_, i) => i === newT ? (most ? 7 : 1) : rivals[k++]);
  const values = keep.map((v, i) => ({ ...v, value: counts[i] }));
  return practiceOf(c, { values, targetBarIndex: newT, scale: c.scale ? { ...c.scale, max: Math.max(c.scale.max, 7) } : c.scale });
}

/** compare_bars: the same two bars five apart, the other bar now the one the question wants. */
function simplerCompare(c: BarModelChallenge): BarModelChallenge | null {
  const t = c.targetBarIndex ?? -1, vs = c.values.map(v => v.value);
  if (c.values.length !== 2 || !c.values[t] || Math.abs(vs[0] - vs[1]) >= 4) return null;
  const wantsBigger = vs[t] >= vs[1 - t];
  const newT = 1 - t;
  const values = c.values.map((v, i) => ({ ...v, value: (i === newT) === wantsBigger ? 8 : 3 }));
  return practiceOf(c, { values, targetBarIndex: newT });
}

/** match_to_bar: three rows at least three apart, a new group size, matched by a different row. */
function simplerMatch(c: BarModelChallenge): BarModelChallenge | null {
  const t = c.targetBarIndex ?? -1, vs = c.values.map(v => v.value);
  if (!c.values[t]) return null;
  if (c.values.length <= 3 && extremeGap(vs, t) >= 3 && !c.sourceScattered) return null;
  const s = [4, 5, 3, 6].find(k => k !== c.stimulusCount)!;
  const keep = c.values.slice(0, 3);
  const newT = keep.findIndex(v => v.label !== c.values[t].label);
  const rivals = [s + 3, s - 3 >= 1 ? s - 3 : s + 6];
  let k = 0;
  const values = keep.map((v, i) => ({ ...v, value: i === newT ? s : rivals[k++] }));
  const emoji = c.sourceItems?.[0]?.emoji ?? values[newT].emoji ?? '⭐';
  return practiceOf(c, { values, targetBarIndex: newT, stimulusCount: s, sourceScattered: false,
    sourceItems: Array.from({ length: s }, () => ({ emoji, categoryIndex: 0 })),
    scale: c.scale ? { ...c.scale, max: Math.max(...values.map(v => v.value)) } : c.scale });
}

/** build_one_to_one: two kinds, a sorted pile, small counts other than the item's. */
function simplerBuild(c: BarModelChallenge): BarModelChallenge | null {
  if (c.values.length <= 2 && !c.sourceScattered) return null;
  const want = (c.expectedCounts ?? []).slice(0, 2);
  const counts = [[3, 2], [2, 4], [4, 1]].find(p => p.join() !== want.join())!;
  const values = c.values.slice(0, 2).map(v => ({ ...v, value: 0 }));
  const sourceItems = values.flatMap((v, k) => Array.from({ length: counts[k] }, () => ({ emoji: v.emoji ?? '⭐', categoryIndex: k })));
  return practiceOf(c, { values, expectedCounts: counts, sourceItems, sourceScattered: false,
    scale: c.scale ? { ...c.scale, max: Math.max(...counts) + 2 } : c.scale });
}

/** read_scale / scaled_bar_graph: the same rows on an axis that counts by a smaller step, a new number to read. */
function simplerScale(c: BarModelChallenge): BarModelChallenge | null {
  const step = c.scale?.step ?? 1, t = c.targetBarIndex ?? -1;
  const fine = c.evalMode === 'read_scale' ? 1 : 2;
  if (step <= fine || !c.values[t] || !c.scale) return null;
  const pool = fine === 1 ? [7, 5, 8, 4, 6, 3, 9, 2] : [14, 12, 16, 8, 10, 6, 18, 4];
  const n = pool.find(k => k !== c.expectedValue)!;
  const rest = pool.filter(k => k !== n && k !== c.expectedValue);
  const values = c.values.map((v, i) => ({ ...v, value: i === t ? n : rest[(i < t ? i : i - 1) % rest.length] }));
  return practiceOf(c, { values, expectedValue: n, options: options(n, fine), scale: { ...c.scale, step: fine, max: fine * 10 } });
}

/** picture_graph: one picture stands for 2, a new row size, never the item's number. */
function simplerPicture(c: BarModelChallenge): BarModelChallenge | null {
  const iv = c.scale?.iconValue ?? 1, t = c.targetBarIndex ?? -1;
  if (iv <= 2 || !c.values[t] || !c.scale) return null;
  const icons = [4, 3, 5, 2].find(k => k * 2 !== c.expectedValue)!;
  const rest = [2, 5, 1, 3, 4].filter(k => k !== icons);
  const values = c.values.map((v, i) => ({ ...v, value: 2 * (i === t ? icons : rest[(i < t ? i : i - 1) % rest.length]) }));
  const n = icons * 2;
  const prompt = c.prompt.replace(new RegExp(`(stands for|represents|is worth|means|=)\\s*${iv}\\b`, 'gi'), '$1 2');
  return practiceOf(c, { values, expectedValue: n, prompt,
    options: Array.from(new Set([icons, n - 2, n, n + 2])).filter(x => x > 0).sort((a, b) => a - b),
    scale: { ...c.scale, iconValue: 2, step: 2, max: 2 * Math.max(...values.map(v => v.value / 2)) } });
}

/** graph_word_problem: a one-step "how many more" between two of its rows, on an axis counting by one. */
function simplerWordProblem(c: BarModelChallenge): BarModelChallenge | null {
  if (c.values.length <= 2) return null;
  const named = namedRows(c);
  const pick = (named.length >= 2 ? named.slice(0, 2) : [0, 1]).map(i => c.values[i]);
  const [a, b] = [[7, 3], [8, 3], [6, 4]].find(([x, y]) => x - y !== c.expectedValue)!;
  const values: BarValue[] = [{ ...pick[0], value: a }, { ...pick[1], value: b }];
  const d = a - b;
  return practiceOf(c, { values, expectedValue: d, graphStyle: 'scaled_bar', targetBarIndex: undefined,
    prompt: `How many more ${pick[0].label.toLowerCase()} than ${pick[1].label.toLowerCase()} are there?`,
    options: Array.from(new Set([d, b, d + 1, d - 1])).filter(x => x >= 0).sort((x, y) => x - y),
    scale: { step: 1, max: 10 } });
}

/** The simpler item for a session item, same mode, or null where it is already the plainest shape. */
export function simplerGraph(c: BarModelChallenge): BarModelChallenge | null {
  if (isSimplerGraph(c)) return null;
  const p = (() => {
    switch (c.evalMode) {
      case 'read_one_to_one': return simplerRead(c);
      case 'most_least': return simplerMostLeast(c);
      case 'compare_bars': return simplerCompare(c);
      case 'match_to_bar': return simplerMatch(c);
      case 'build_one_to_one': return simplerBuild(c);
      case 'read_scale': case 'scaled_bar_graph': return simplerScale(c);
      case 'picture_graph': return simplerPicture(c);
      case 'graph_word_problem': return simplerWordProblem(c);
      default: return null;
    }
  })();
  return p && !simplerLeaks(p, c) ? p : null;
}

// ── the levers on an item ────────────────────────────────────────────────────

/** A starting position from the generator's tier fields (absent = on, as the component draws them). Not a pull. */
export function startsOn(c: BarModelChallenge, id: string): boolean {
  if (id === MARK_ROW) return c.showTargetHighlight !== false;
  if (id === BAR_VALUES) return c.showBarValues !== false;
  return false;
}

/** The levers on a session item (every mode but make_graph). `pulled` holds this item's runtime pulls. */
export function barModelLevers(c: BarModelChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!c || c.evalMode === 'make_graph' || isSimplerGraph(c)) return [];
  const levers: WorkspaceLever[] = [];
  const on = (id: string) => startsOn(c, id) || pulled.includes(id);
  const help = (id: string, carrier: WorkspaceLever['carrier'], answers: string[], when: string, does: string) =>
    levers.push({ id, kind: 'help', carrier, pulled: on(id), answers, when, does });
  const back = 'It is not graded; this graph comes back after it, unanswered.';
  const simplify = (answers: string[], does: string) => {
    if (simplerGraph(c)) levers.push({ id: SIMPLER, kind: 'simplify', carrier: 'shown', pulled: pulled.includes(SIMPLER), answers,
      when: 'The learner cannot do this graph even with the help on screen: an easier one first.', does: `${does} ${back}` });
  };
  const mode = c.evalMode;
  const markRow = () => { if (!markRowLeaks(c)) help(MARK_ROW, 'shown', ['another_row'],
    'The learner answers with the number of a row the question does not ask about.',
    'Puts the amber mark around the row the question asks about. No number is written; you may point to the row, never say its number.'); };
  const fives = (answers: string[], when: string) => { if (fivesRows(c).length) help(GROUP_FIVES, 'shown', answers, when,
    'Draws a small gap after every fifth picture in each long row, so a row reads as five and some more. No number is written.'); };
  const words = (answers: string[], when: string) => {
    const m = wordModel(c);
    if (m) help(WORD_MODEL, 'both', answers, when,
      `Draws a model beside the graph in other pictures: rows labelled ${m.rows.filter(r => r.word).map(r => `"${r.word}"`).join(' and ')}. `
        + 'You may point to the model and say its words; never point to a row of the graph as the answer.');
  };
  switch (mode) {
    case 'read_one_to_one':
      markRow();
      fives([...OFF], 'The learner miscounts the pictures in the row.');
      simplify(['another_row', ...OFF], 'Opens an easier graph with two rows, the asked row shorter.');
      break;
    case 'most_least':
      words(['reversed'], 'The learner picks the row with the fewest where the question asks for the most, or the other way round.');
      fives(['other_row'], 'The learner picks a row that is not the longest (or shortest) one.');
      simplify(['reversed', 'other_row'], 'Opens an easier graph with three rows, one far ahead of the others.');
      break;
    case 'compare_bars':
      words(['reversed'], 'The learner picks the shorter bar where the question asks for more, or the other way round.');
      simplify(['reversed', 'other_row'], 'Opens an easier graph with the two bars far apart.');
      break;
    case 'match_to_bar':
      help(PILE_ROW, 'shown', [...OFF], 'The learner picks a row with one too many or too few, or a row far off the group.',
        'Draws the group to count again as a row of its own above the graph, one picture per column like the rows. '
          + 'It is not a row to tap; no number is written and no row is marked.');
      simplify([...OFF], 'Opens an easier graph with three rows far apart and a smaller group, lined up.');
      break;
    case 'build_one_to_one':
      help(SORT_PILE, 'shown', ['rows_swapped', 'several_rows_off', ...OFF],
        'The learner puts stickers in the wrong rows or loses count of a kind in the mixed pile.',
        'Redraws the pile sorted: one line for each kind, in the same order as the rows. No number is written.');
      fives([...OFF], 'The learner puts one too many or too few stickers in a long row.');
      simplify(['rows_swapped', 'several_rows_off', ...OFF], 'Opens an easier chart with two kinds and a sorted pile.');
      break;
    case 'say_what_it_shows':
      words(['reversed_comparison', 'no_comparison'], 'The learner turns a comparison around, or says a number or a row name with no comparison word.');
      fives(['same_for_different'], 'The learner says two rows are the same where their lengths differ.');
      break;
    case 'compare_two_graphs':
      help(PAIR_ROWS, 'shown', ['rows_not_graphs', 'same_for_different'],
        'The learner compares two rows inside one survey, or calls two different rows the same.',
        `Draws each kind's two rows next to each other, the ${c.graphLabel ?? 'first'} row above the ${c.secondGraphLabel ?? 'second'} row. No number is written.`);
      words(['reversed_comparison', 'no_comparison'], 'The learner turns a comparison around, or says a number or a row name with no comparison word.');
      break;
    case 'read_scale': case 'scaled_bar_graph':
      markRow();
      if (typeof c.targetBarIndex === 'number') help(GUIDE_LINE, 'shown', ['another_row', 'one_step_off', ...OFF],
        'The learner reads the asked bar against the wrong mark on the axis, or follows a neighbouring bar to the axis.',
        'Draws a dashed line from the end of the asked bar straight down to the axis. No number is written on it.');
      if (minorStep(c)) help(MINOR_TICKS, 'shown', ['one_step_off', 'one_short', 'one_over'],
        'The learner cannot tell what a bar between two numbered marks stands for.',
        'Adds a small unlabelled mark on the axis for every one between the numbered marks.');
      simplify(['one_step_off', ...OFF], 'Opens an easier graph of the same rows on an axis that counts by a smaller step.');
      break;
    case 'picture_graph':
      markRow();
      if ((c.scale?.iconValue ?? 1) > 1) help(ICON_VALUES, 'shown', ['picked_icon_count', 'one_step_off', ...OFF],
        'The learner counts the pictures but answers with the count, or skip-counts by the wrong amount.',
        `Writes the key's number (${c.scale?.iconValue}) small under every picture. Never a running total; you may skip-count with the learner, never say the row's total.`);
      simplify(['picked_icon_count', 'one_step_off', ...OFF], 'Opens an easier graph where one picture stands for 2.');
      break;
    case 'graph_word_problem': {
      if (namedRows(c).length) help(MARK_BARS, 'shown', ['another_row'],
        'The learner answers with one bar\'s number instead of working the question.',
        'Puts the amber mark around the bars the question names. No number is written; never say which operation to use.');
      if (!barValuesLeak(c)) help(BAR_VALUES, 'shown', ['one_step_off', ...OFF],
        'The learner misreads a bar against the axis.', 'Writes each bar\'s number at its end. The answer is none of them.');
      if (minorStep(c)) help(MINOR_TICKS, 'shown', ['one_step_off', 'one_short', 'one_over'],
        'The learner cannot tell what a bar between two numbered marks stands for.',
        'Adds a small unlabelled mark on the axis for every one between the numbered marks.');
      simplify(['another_row', 'one_step_off', ...OFF], 'Opens an easier question: how many more, between two bars, on an axis counting by one.');
      break;
    }
    case 'build_graph':
      if (!dataBesideLeaks(c)) help(DATA_BESIDE, 'shown', ['rows_swapped', 'several_rows_off', ...OFF],
        'The learner sets a bar to another row\'s number or loses track of the numbers in the question.',
        'Writes the number the question gives for each row beside that row\'s buttons. Only numbers the question already says.');
      help(STEP_MARKS, 'shown', ['wrong_step'], 'The learner picks a scale step that does not suit their bars.',
        'Writes on each step button how many numbered marks that step needs to reach the learner\'s own tallest bar. No step is marked as best: '
        + 'never say which step or how many marks to pick; let the learner compare the counts and choose.');
      break;
    default: break;
  }
  return levers;
}

/** Why a pull would change nothing yet, or undefined. */
export function leverRefusal(c: BarModelChallenge, id: string, built: readonly { value: number }[]): string | undefined {
  if (id === STEP_MARKS && !stepMarks(c.availableScaleSteps ?? [1, 2, 5, 10], built))
    return 'No bar is set yet, so there is nothing to count marks to. Set a bar first.';
  return undefined;
}

/** What the pulled help levers put on screen, for the tutor and JEV: what is drawn, never the answer. */
export function leverFacts(c: BarModelChallenge, on: (id: string) => boolean, built: readonly { value: number }[]): string | undefined {
  const parts: string[] = [];
  if (on(GROUP_FIVES) && fivesRows(c).length) parts.push('A small gap after every fifth picture in each long row; no number written');
  if (on(PILE_ROW)) parts.push('The group to count is drawn again as a row above the graph, one picture per column; not tappable, no number, no row marked');
  if (on(SORT_PILE)) parts.push('The pile is sorted, one line per kind in the order of the rows; no number written');
  const m = on(WORD_MODEL) ? wordModel(c) : null;
  if (m) parts.push(`A model beside the graph in ${m.glyph} pictures, not rows of the graph: ${m.rows.map(r => `a row of ${r.count}${r.word ? ` labelled "${r.word}"` : ''}`).join(', ')}`);
  if (on(PAIR_ROWS)) parts.push(`Each kind's two rows are drawn next to each other (${c.graphLabel} above ${c.secondGraphLabel}); no number written`);
  if (on(GUIDE_LINE)) parts.push('A dashed line from the end of the asked bar down to the axis; no number written on it');
  if (on(MINOR_TICKS)) parts.push('Small unlabelled marks on the axis for every one between the numbered marks');
  if (on(ICON_VALUES)) parts.push(`The number ${c.scale?.iconValue} written under every picture; no totals`);
  if (on(MARK_BARS) && !startsOn(c, MARK_BARS)) parts.push(`The bars the question names are marked: ${namedRows(c).map(i => c.values[i].label).join(', ')}`);
  if (on(DATA_BESIDE)) parts.push('Beside each row\'s buttons, the number the question gives for that row');
  const marks = on(STEP_MARKS) ? stepMarks(c.availableScaleSteps ?? [1, 2, 5, 10], built) : null;
  if (marks) parts.push(`Each step button shows the marks it needs to reach the learner's tallest bar: ${Object.entries(marks).map(([s, n]) => `step ${s}, ${n} marks`).join('; ')}`);
  return parts.length ? parts.join('. ') : undefined;
}
