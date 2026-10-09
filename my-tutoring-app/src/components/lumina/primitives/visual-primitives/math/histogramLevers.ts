/**
 * histogram's in-item levers (/add-support-tiers; report qa/eval-reports/histogram-levers-2026-10-09.md).
 * The misses are what `histogramMiss` observes in the chip, the bar or the number; there is no real-learner evidence.
 *
 * - `outline_tops` (help, identify shape): a line joining the tops of the item's bars, so the peaks and the tail read
 *   as one outline. It names no shape.
 * - `tail_model` (help, identify shape): a small model histogram OUTSIDE the item, a skewed shape that is never the
 *   item's, its tail marked and captioned with its own name and the side its tail runs to.
 * - `peak_model` (help, identify shape): a model outside the item of one peak, two peaks or flat (never the item's
 *   shape), captioned with its name and what to look for.
 * - `level_line` (help, find modal bin): a level line across the chart at the top of the bar the learner tapped, so a
 *   taller bar visibly pokes above it. It follows the learner's tap, never the tallest bar.
 * - `isolate_bar` (help, read frequency): every bar but the outlined one faded.
 * - `axis_names` (help, read frequency / estimate center): the two axes captioned with what they count: values along
 *   the bottom (the bar edges), how many values up the side.
 * - `count_marks` (help, read frequency): a faint line across the outlined bar at every whole count, unnumbered, so the
 *   height can be counted.
 * - `count_labels` (help, estimate center, only where the session withdrew them): each bar's count above it.
 * - `balance_model` (help, estimate center): a model histogram outside the item, no number on it, a long tail and a
 *   balance point drawn under it, captioned that the tail pulls the balance point toward it.
 * - `simpler_graph` (simplify, every mode): the same mode on a clean, smaller graph built here; ungraded practice.
 *
 * Leak rules (code): no lever's `when`/`does` text or scene fact carries a digit or a shape name; a model's shape is
 * never the item's; the level line sits only at a tapped bar's height; the count marks and models carry no numbers; a
 * practice graph has its own id and ask, and its answer is not the item's (another shape, another modal position,
 * another count, a center outside the item's tolerance).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { HistogramChallenge, HistogramChallengeType, HistogramShapeKind } from './Histogram';
import { SHAPE_LABEL, binRange, computeBins, histogramCorrect, type HistogramMiss } from './histogramWorkspace';

export const OUTLINE_LEVER = 'outline_tops';
export const TAIL_MODEL_LEVER = 'tail_model';
export const PEAK_MODEL_LEVER = 'peak_model';
export const LEVEL_LINE_LEVER = 'level_line';
export const ISOLATE_LEVER = 'isolate_bar';
export const AXIS_NAMES_LEVER = 'axis_names';
export const COUNT_MARKS_LEVER = 'count_marks';
export const COUNT_LABELS_LEVER = 'count_labels';
export const BALANCE_MODEL_LEVER = 'balance_model';
export const SIMPLER_LEVER = 'simpler_graph';

const SIMPLER = '~simpler';
export const isPracticeGraph = (c: Pick<HistogramChallenge, 'id'>) => c.id.endsWith(SIMPLER);
export const practiceParent = (id: string) => id.replace(/~simpler$/, '');

// ── models outside the item ──────────────────────────────────────────────

/** Bar heights of a clean graph of each shape, six bars. */
export const SHAPE_COUNTS: Record<HistogramShapeKind, number[]> = {
  symmetric: [1, 3, 6, 6, 3, 1],
  'right-skewed': [7, 5, 3, 2, 1, 1],
  'left-skewed': [1, 1, 2, 3, 5, 7],
  bimodal: [2, 6, 2, 2, 6, 2],
  uniform: [4, 4, 4, 4, 4, 4],
};

export interface ShapeModel {
  shape: HistogramShapeKind;
  counts: number[];
  caption: string;
}

const CAPTION: Record<HistogramShapeKind, string> = {
  'right-skewed': 'Right-Skewed: the long, low tail runs to the right.',
  'left-skewed': 'Left-Skewed: the long, low tail runs to the left.',
  symmetric: 'Symmetric: one peak in the middle, the two sides mirror each other.',
  bimodal: 'Bimodal: two separate peaks with a dip between them.',
  uniform: 'Uniform: every bar about the same height, no peak.',
};

const model = (shape: HistogramShapeKind): ShapeModel => ({ shape, counts: SHAPE_COUNTS[shape], caption: CAPTION[shape] });

/** The skewed model: the other skew for a skewed item, else right-skewed. Never the item's shape. */
export function tailModel(c: HistogramChallenge): ShapeModel | null {
  if (c.challengeType !== 'identify_shape') return null;
  return model(c.expectedShape === 'right-skewed' ? 'left-skewed' : 'right-skewed');
}

/** The peak model: one peak for a two-peak or flat item, two peaks otherwise. Never the item's shape. */
export function peakModel(c: HistogramChallenge): ShapeModel | null {
  if (c.challengeType !== 'identify_shape') return null;
  return model(c.expectedShape === 'bimodal' || c.expectedShape === 'uniform' ? 'symmetric' : 'bimodal');
}

/** The balance model: a right-skewed graph with no numbers, its balance point drawn right of the peak. */
export const BALANCE_MODEL = { counts: [6, 7, 4, 2, 1, 1], balanceAt: 2.2,
  caption: 'The long tail pulls the balance point (the mean) toward it, away from the tallest bar.' };

// ── simplify ─────────────────────────────────────────────────────────────

/** One value per count, at the middle of each bar, on the item's own axis. */
const valuesFor = (counts: number[], start: number, width: number) =>
  counts.flatMap((n, i) => Array<number>(n).fill(start + i * width + Math.floor(width / 2)));

const PRACTICE_SHAPE: Record<HistogramShapeKind, HistogramShapeKind> = {
  'right-skewed': 'left-skewed', 'left-skewed': 'right-skewed', symmetric: 'bimodal', bimodal: 'symmetric', uniform: 'symmetric',
};

/**
 * The easier practice graph for `c`: the same mode, a clean graph on the item's axis built here, and its own ask:
 * identify → a clean shape that is not the item's, three choices; modal → four bars with a peak far taller than the
 * rest, not where the item's is; read → four short bars (at most six), an asked bar whose count is not the item's;
 * center → five symmetric bars whose center lies outside the item's tolerance. Null on a practice graph.
 */
export function simplerHistogram(c: HistogramChallenge): HistogramChallenge | null {
  if (isPracticeGraph(c)) return null;
  const w = c.binWidth, s = c.binStart;
  const base = { ...c, id: `${c.id}${SIMPLER}`, hint: '' };
  let practice: HistogramChallenge | null = null;
  if (c.challengeType === 'identify_shape') {
    const shape = PRACTICE_SHAPE[c.expectedShape ?? 'symmetric'];
    const foils = (['symmetric', 'right-skewed', 'left-skewed', 'bimodal', 'uniform'] as HistogramShapeKind[])
      .filter(o => o !== shape && o !== PRACTICE_SHAPE[shape]).slice(0, 2);
    const options = (['symmetric', 'right-skewed', 'left-skewed', 'bimodal', 'uniform'] as HistogramShapeKind[])
      .filter(o => o === shape || foils.includes(o));
    practice = { ...base, data: valuesFor(SHAPE_COUNTS[shape], s, w), expectedShape: shape, shapeOptions: options,
      prompt: 'Practice first: which best describes the shape of this distribution?' };
  } else if (c.challengeType === 'find_modal_bin') {
    const itemTop = Math.round(((c.expectedBinStart ?? s) - s) / w);
    const peak = [1, 2, 0, 3].find(p => p !== itemTop) ?? 1;
    const counts = [2, 3, 2, 1].map((n, i) => (i === peak ? 8 : n));
    practice = { ...base, data: valuesFor(counts, s, w), expectedBinStart: s + peak * w, expectedBinEnd: s + (peak + 1) * w,
      prompt: 'Practice first: which bin contains the most values?' };
  } else if (c.challengeType === 'read_frequency') {
    const counts = [3, 5, 2, 4];
    const at = [1, 3, 0, 2].find(i => counts[i] !== c.targetFrequency) ?? 1;
    const a = s + at * w;
    practice = { ...base, data: valuesFor(counts, s, w), targetBinStart: a, targetBinEnd: a + w, targetFrequency: counts[at],
      prompt: `Practice first: how many values fall in the bin ${binRange(a, a + w, at === counts.length - 1)}?` };
  } else {
    const counts = [1, 3, 5, 3, 1], tol = c.tolerance ?? w, key = c.targetAnswer ?? 0;
    for (let shift = 0; shift <= 6 && !practice; shift++) {
      const start = s + shift * w, center = start + 2 * w + Math.floor(w / 2);
      if (Math.abs(center - key) <= tol) continue;
      practice = { ...base, data: valuesFor(counts, start, w), binStart: start, targetAnswer: center, tolerance: tol,
        prompt: `Practice first: estimate the ${c.targetStatistic ?? 'mean'} of this data.` };
    }
  }
  return practice && !practiceLeaks(c, practice) ? practice : null;
}

/** Leak rule for a practice graph: never the learner's item (id, ask, data) and never its answer; same mode. */
export function practiceLeaks(parent: HistogramChallenge, practice: HistogramChallenge): boolean {
  if (practice.id === parent.id || practice.prompt === parent.prompt || practice.challengeType !== parent.challengeType
    || JSON.stringify(practice.data) === JSON.stringify(parent.data)) return true;
  // Its own key must be credited by its own check, and must not be the parent's key.
  const bins = computeBins(practice.data, practice.binWidth, practice.binStart);
  switch (parent.challengeType) {
    case 'identify_shape': return practice.expectedShape === parent.expectedShape
      || !(practice.shapeOptions ?? []).includes(practice.expectedShape!);
    case 'find_modal_bin': return practice.expectedBinStart === parent.expectedBinStart
      || !histogramCorrect(practice, { shape: null, binIndex: bins.findIndex(b => b.start === practice.expectedBinStart), typed: '' }, bins);
    case 'read_frequency': return practice.targetFrequency === parent.targetFrequency
      || bins.find(b => b.start === practice.targetBinStart)?.count !== practice.targetFrequency;
    case 'estimate_center': return Math.abs((practice.targetAnswer ?? 0) - (parent.targetAnswer ?? 0)) <= (parent.tolerance ?? 0);
  }
}

// ── declarations ─────────────────────────────────────────────────────────

export interface HistogramLeverContext {
  /** The session already prints each bar's count (a starting position). */
  countLabelsShown: boolean;
}

const ALL: Record<HistogramChallengeType, readonly HistogramMiss[]> = {
  identify_shape: ['skew_reversed', 'missed_skew', 'called_skewed', 'peak_count', 'flat_vs_peaked'],
  find_modal_bin: ['neighbor_bar', 'runner_up', 'shorter_bar'],
  read_frequency: ['bin_edge', 'neighbor_bar', 'total_count', 'off_by_one', 'too_high', 'too_low'],
  estimate_center: ['off_axis', 'tallest_bar', 'axis_middle', 'too_high', 'too_low'],
};

export function histogramLevers(c: HistogramChallenge | null, pulled: readonly string[], ctx: HistogramLeverContext): WorkspaceLever[] {
  if (!c || isPracticeGraph(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly HistogramMiss[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const t = c.challengeType, out: WorkspaceLever[] = [];
  if (t === 'identify_shape') {
    out.push(lever(OUTLINE_LEVER, 'help', 'shown', ALL.identify_shape,
      'The learner does not see the overall form of the bars.',
      'Draws a line joining the tops of the bars, so the peaks, dips and any long tail read as one outline. It names nothing.'));
    out.push(lever(TAIL_MODEL_LEVER, 'help', 'both', ['skew_reversed', 'missed_skew', 'called_skewed'],
      'The learner names a skew by the peak\'s side, or misses or invents a long tail.',
      'Shows a small model graph beside the item, a skewed shape that is not this item\'s, its tail marked and captioned '
        + 'with its own name and the side its tail runs to. Compare it with the item aloud.'));
    out.push(lever(PEAK_MODEL_LEVER, 'help', 'both', ['peak_count', 'flat_vs_peaked'],
      'The learner confuses one peak, two peaks and flat.',
      'Shows a small model graph beside the item with a shape that is not this item\'s (one peak, or two), captioned with its '
        + 'name and what to look for. Compare it with the item aloud.'));
  }
  if (t === 'find_modal_bin') {
    out.push(lever(LEVEL_LINE_LEVER, 'help', 'shown', ALL.find_modal_bin,
      'The learner picks a bar that is not the tallest, often a neighbor or a near twin.',
      'Draws a level line across the whole chart at the top of the bar the learner tapped, so any taller bar pokes above '
        + 'it. It follows the learner\'s tap and never marks the tallest bar itself.'));
  }
  if (t === 'read_frequency') {
    out.push(lever(ISOLATE_LEVER, 'help', 'shown', ['neighbor_bar', 'total_count'],
      'The learner reads a neighboring bar or counts the whole graph.',
      'Fades every bar except the outlined one.'));
  }
  if (t === 'read_frequency' || t === 'estimate_center') {
    out.push(lever(AXIS_NAMES_LEVER, 'help', 'shown', t === 'read_frequency' ? ['bin_edge', 'total_count'] : ['off_axis'],
      t === 'read_frequency' ? 'The learner types a number from along the bottom instead of the bar\'s height.'
        : 'The learner types a count, not a value along the bottom.',
      'Captions the two axes with what they count: values along the bottom (the bar edges), how many values up the side.'));
  }
  if (t === 'read_frequency') {
    out.push(lever(COUNT_MARKS_LEVER, 'help', 'shown', ['off_by_one', 'too_high', 'too_low'],
      'The learner misreads the height by a little or a lot.',
      'Draws a faint line across the outlined bar at every whole count, with no numbers, so its height can be counted.'));
  }
  if (t === 'estimate_center') {
    if (!ctx.countLabelsShown) {
      out.push(lever(COUNT_LABELS_LEVER, 'help', 'shown', ['axis_middle', 'too_high', 'too_low'],
        'The learner ignores how many values each bar holds.',
        'Prints each bar\'s count above it. The center is still not written anywhere.'));
    }
    out.push(lever(BALANCE_MODEL_LEVER, 'help', 'both', ['tallest_bar', 'axis_middle', 'too_high', 'too_low', 'off_axis'],
      'The learner picks the tallest bar or the middle of the axis as the center.',
      'Shows a small model graph beside the item with no numbers: a long tail, and a balance point drawn under it, '
        + 'pulled toward the tail and away from the tallest bar. Read its caption aloud.'));
  }
  if (simplerHistogram(c)) {
    out.push(lever(SIMPLER_LEVER, 'simplify', 'shown', ALL[t],
      'This graph is too hard to read yet.',
      'Opens a cleaner, smaller practice graph of the same kind first. It is not graded; the full item comes back after it.'));
  }
  return out;
}

/** What the pulled help levers put on screen, for the tutor and JEV. No digit, no shape name of the item. */
export function leverFacts(c: HistogramChallenge | null, pulled: readonly string[]): string {
  if (!c || isPracticeGraph(c)) return '';
  const on = (id: string) => pulled.includes(id);
  const tail = tailModel(c), peak = peakModel(c);
  return [
    on(OUTLINE_LEVER) && 'A line joins the tops of the bars.',
    on(TAIL_MODEL_LEVER) && tail && `Beside the graph is a model graph outside the item: ${tail.caption}`,
    on(PEAK_MODEL_LEVER) && peak && `Beside the graph is a model graph outside the item: ${peak.caption}`,
    on(LEVEL_LINE_LEVER) && 'A level line runs across the chart at the top of the bar the learner tapped.',
    on(ISOLATE_LEVER) && 'Every bar except the outlined one is faded.',
    on(AXIS_NAMES_LEVER) && 'The axes are captioned: values along the bottom, how many values up the side.',
    on(COUNT_MARKS_LEVER) && 'The outlined bar has a faint unnumbered line at every whole count.',
    on(COUNT_LABELS_LEVER) && 'Each bar\'s count is printed above it.',
    on(BALANCE_MODEL_LEVER) && `Beside the graph is a model graph outside the item with no numbers: ${BALANCE_MODEL.caption}`,
  ].filter((s): s is string => !!s).join(' ');
}

/** Leak rule for the levers' words: no digit; and for an identify item, never its own shape's name. */
export function leverTextLeaks(c: HistogramChallenge, text: string): boolean {
  if (/\d/.test(text)) return true;
  return c.challengeType === 'identify_shape' && !!c.expectedShape
    && text.toLowerCase().includes(SHAPE_LABEL[c.expectedShape].toLowerCase());
}
