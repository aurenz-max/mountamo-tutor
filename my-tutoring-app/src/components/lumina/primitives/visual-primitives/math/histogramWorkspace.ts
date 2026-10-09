/**
 * Histogram on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C19).
 *
 * Pure: the component and any probe read the same assignment and scene. Every mode is a gesture item checked by the
 * activity's own Check: a shape chip (identify shape), a tapped bar (find modal bin), or a typed number (read
 * frequency exactly; estimate center within the item's tolerance). The tutor is never handed the answer: not the
 * shape, not which bar is tallest, not the asked bin's count, not the mean or median.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { HistogramChallenge, HistogramChallengeType, HistogramShapeKind } from './Histogram';

export interface Bin {
  start: number;
  end: number;
  count: number;
}

/**
 * The bars the learner sees: bins of `binWidth` from `binStart` (or the first edge at or below the smallest value).
 * Each bar holds its left edge up to, not including, its right edge, except the LAST bar, which also holds its right
 * edge: a value equal to the axis maximum (a quiz score of 100) is in the top bar. Before 2026-10-09 it was in no bar.
 * The one bin function for the component, the generator (`gemini-histogram.ts`) and the oracle.
 */
export function computeBins(data: number[], binWidth: number, binStart: number): Bin[] {
  if (data.length === 0 || binWidth <= 0) return [];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const effectiveStart = binStart <= min ? binStart : Math.floor(min / binWidth) * binWidth;
  const effectiveEnd = Math.ceil((max - effectiveStart) / binWidth) * binWidth + effectiveStart;
  const numBins = Math.max(1, Math.ceil((effectiveEnd - effectiveStart) / binWidth));
  const out: Bin[] = [];
  for (let i = 0; i < numBins; i++) {
    const start = effectiveStart + i * binWidth;
    const end = start + binWidth;
    const last = i === numBins - 1;
    out.push({ start, end, count: data.filter((v) => v >= start && (v < end || (last && v === end))).length });
  }
  return out;
}

/** A bin as the screen writes it: `[start, end)`, or `[start, end]` for the last bar, which holds its right edge. */
export const binRange = (start: number, end: number, last: boolean) => `[${start}, ${end}${last ? ']' : ')'}`;

/**
 * The shape the drawn data actually has, or null when it is not clearly one shape (the item is then not fit to ask).
 * Read from the bars and the values, in this order:
 * - bimodal: exactly two peaks of the smoothed bars, at least two bars apart, each at least half the tallest, with a drawn bar
 *   between them at most 60% of the lower peak's tallest bar;
 * - uniform: every bar within max(2, half the mean bar) of every other, and no bar empty;
 * - right / left skewed: the values' moment skewness above 0.5 / below -0.5, with one peak;
 * - symmetric: skewness within ±0.25, one smoothed peak, the tallest bar at least 1.5 × the mean bar;
 * - otherwise null (a mild skew, a lumpy flat, a flat-topped bell).
 */
export function classifyShape(data: number[], bins: Bin[]): HistogramShapeKind | null {
  if (data.length < 5 || bins.length < 4) return null;
  const counts = bins.map(b => b.count);
  const n = data.length, k = counts.length, meanBar = n / k, top = Math.max(...counts);
  const smooth = counts.map((c, i) => ((counts[i - 1] ?? c) + 2 * c + (counts[i + 1] ?? c)) / 4);
  const peaks = smooth.map((v, i) => i).filter(i => (i === 0 || smooth[i] > smooth[i - 1]) && (i === k - 1 || smooth[i] >= smooth[i + 1])
    && smooth[i] >= 0.5 * Math.max(...smooth));
  // Exactly two major peaks (three or more is lumpy, not bimodal), at least two bars apart. Heights are read off the
  // drawn bars: each peak's tallest bar within one of it, and the lowest bar between them.
  if (peaks.length === 2 && peaks[1] - peaks[0] >= 2) {
    const [p, q] = peaks;
    const height = (i: number) => Math.max(...counts.slice(Math.max(0, i - 1), i + 2));
    const dip = Math.min(...counts.slice(p + 1, q));
    if (dip <= 0.6 * Math.min(height(p), height(q))) return 'bimodal';
  }
  const low = Math.min(...counts);
  if (low > 0 && top - low <= Math.max(2, meanBar / 2)) return 'uniform';
  const mean = data.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(data.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  if (sd === 0) return null;
  const skew = data.reduce((s, v) => s + ((v - mean) / sd) ** 3, 0) / n;
  if (skew > 0.5) return 'right-skewed';
  if (skew < -0.5) return 'left-skewed';
  if (Math.abs(skew) <= 0.25 && peaks.length === 1 && top >= 1.5 * meanBar) return 'symmetric';
  return null;
}

/**
 * The frequency axis: labelled lines at every `step`, a top one step above the tallest bar, and (up to 30) a faint
 * line at every whole count, so a bar's height can be read exactly. Before 2026-10-09 the ticks were rounded fifths
 * of 1.1 × the tallest bar, so a bar of 9 stopped just under a line labelled 10.
 */
export function frequencyAxis(maxCount: number): { top: number; step: number; minor: boolean } {
  const m = Math.max(1, maxCount);
  const step = m <= 10 ? 1 : m <= 20 ? 2 : 5;
  const top = (Math.floor(m / step) + 1) * step;
  return { top, step, minor: step > 1 && top <= 30 };
}

export const SHAPE_LABEL: Record<HistogramShapeKind, string> = {
  symmetric: 'Symmetric',
  'right-skewed': 'Right-Skewed',
  'left-skewed': 'Left-Skewed',
  bimodal: 'Bimodal',
  uniform: 'Uniform',
};

/** The learner's work: the shape chip chosen, the bar tapped, the number typed. */
export interface HistogramWork {
  shape: HistogramShapeKind | null;
  binIndex: number | null;
  typed: string;
}

/** Whether the work is something the activity checks at all (a chip, a bar, a number); otherwise Check only prompts. */
export function workIsCheckable(ch: HistogramChallenge, work: HistogramWork, bins: Bin[]): boolean {
  switch (ch.challengeType) {
    case 'identify_shape': return work.shape !== null;
    case 'find_modal_bin': return work.binIndex !== null && !!bins[work.binIndex];
    default: return work.typed.trim() !== '' && Number.isFinite(parseFloat(work.typed));
  }
}

/** The activity's own check. */
export function histogramCorrect(ch: HistogramChallenge, work: HistogramWork, bins: Bin[]): boolean {
  if (!workIsCheckable(ch, work, bins)) return false;
  switch (ch.challengeType) {
    case 'identify_shape': return work.shape === ch.expectedShape;
    case 'find_modal_bin': return bins[work.binIndex!].start === ch.expectedBinStart;
    case 'read_frequency': return parseFloat(work.typed) === ch.targetFrequency;
    case 'estimate_center': return Math.abs(parseFloat(work.typed) - (ch.targetAnswer ?? 0)) <= (ch.tolerance ?? 0);
  }
}

/** The learner's work in words, never the key. */
export function describeHistogramWork(ch: HistogramChallenge, work: HistogramWork, bins: Bin[]): string {
  if (ch.challengeType === 'identify_shape') return work.shape ? `chose "${SHAPE_LABEL[work.shape]}"` : 'no shape chosen yet';
  if (ch.challengeType === 'find_modal_bin') {
    const b = work.binIndex === null ? undefined : bins[work.binIndex];
    return b ? `tapped the bar from ${b.start} to ${b.end}` : 'no bar tapped yet';
  }
  const t = work.typed.trim();
  return t ? `typed ${t}` : 'nothing typed yet';
}

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), drawn from the catalog's commonStruggles (bin edges
 * misread, skew direction misread) and the mode's task:
 * - identify shape: `skew_reversed` the other skew chosen; `missed_skew` a skewed graph called symmetric, bimodal or
 *   uniform; `called_skewed` a skew chosen for a graph that is not skewed; `peak_count` one peak and two confused;
 *   `flat_vs_peaked` symmetric and uniform confused;
 * - find modal bin: `neighbor_bar` a bar next to the tallest; `runner_up` the second-tallest height elsewhere;
 *   `shorter_bar` any other bar;
 * - read frequency: `bin_edge` an edge of the asked bin typed; `neighbor_bar` the count of a bar next to it;
 *   `total_count` the number of values in the whole graph; `off_by_one` one away; else `too_high` / `too_low`;
 * - estimate center: `off_axis` a number off the x-axis (a count, not a value); `tallest_bar` a value inside the
 *   tallest bar, when that is not within the tolerance; `axis_middle` the middle of the axis, ignoring the heights;
 *   else `too_high` / `too_low`.
 */
export type HistogramMiss =
  | 'skew_reversed' | 'missed_skew' | 'called_skewed' | 'peak_count' | 'flat_vs_peaked'
  | 'neighbor_bar' | 'runner_up' | 'shorter_bar'
  | 'bin_edge' | 'total_count' | 'off_by_one'
  | 'off_axis' | 'tallest_bar' | 'axis_middle'
  | 'too_high' | 'too_low';

export const HISTOGRAM_MISSES_BY_MODE: Record<HistogramChallengeType, readonly HistogramMiss[]> = {
  identify_shape: ['skew_reversed', 'missed_skew', 'called_skewed', 'peak_count', 'flat_vs_peaked'],
  find_modal_bin: ['neighbor_bar', 'runner_up', 'shorter_bar'],
  read_frequency: ['bin_edge', 'neighbor_bar', 'total_count', 'off_by_one', 'too_high', 'too_low'],
  estimate_center: ['off_axis', 'tallest_bar', 'axis_middle', 'too_high', 'too_low'],
};

const SKEWED = (s: HistogramShapeKind) => s === 'right-skewed' || s === 'left-skewed';

function shapeMiss(expected: HistogramShapeKind, chosen: HistogramShapeKind): HistogramMiss {
  if (SKEWED(expected) && SKEWED(chosen)) return 'skew_reversed';
  if (SKEWED(expected)) return 'missed_skew';
  if (SKEWED(chosen)) return 'called_skewed';
  if (expected === 'bimodal' || chosen === 'bimodal') return 'peak_count';
  return 'flat_vs_peaked';
}

/** The tallest bar's index (the first, if two tie). */
export const tallestIndex = (bins: Bin[]) => bins.reduce((best, b, i) => (b.count > bins[best].count ? i : best), 0);

/** The asked bin's index on a read-frequency item. */
export const targetIndex = (ch: HistogramChallenge, bins: Bin[]) => bins.findIndex(b => b.start === ch.targetBinStart);

/** The middle of the drawn x-axis. */
export const axisMiddle = (bins: Bin[]) => (bins[0].start + bins[bins.length - 1].end) / 2;

/** Values each read-frequency signature miss stands for on this item, most specific first. Shared with the harness. */
export function frequencySignatures(ch: HistogramChallenge, bins: Bin[]): Array<[HistogramMiss, number]> {
  const at = targetIndex(ch, bins);
  const neighbors = [bins[at - 1], bins[at + 1]].filter((b): b is Bin => !!b).map(b => b.count);
  return [
    ['bin_edge', ch.targetBinStart ?? NaN], ['bin_edge', ch.targetBinEnd ?? NaN],
    ...neighbors.map((n): [HistogramMiss, number] => ['neighbor_bar', n]),
    ['total_count', bins.reduce((s, b) => s + b.count, 0)],
    ['off_by_one', (ch.targetFrequency ?? 0) + 1], ['off_by_one', (ch.targetFrequency ?? 0) - 1],
  ];
}

export function histogramMiss(ch: HistogramChallenge, work: HistogramWork, bins: Bin[]): HistogramMiss | undefined {
  if (!workIsCheckable(ch, work, bins) || histogramCorrect(ch, work, bins)) return undefined;
  if (ch.challengeType === 'identify_shape') return shapeMiss(ch.expectedShape ?? 'symmetric', work.shape!);
  if (ch.challengeType === 'find_modal_bin') {
    const i = work.binIndex!, top = bins.findIndex(b => b.start === ch.expectedBinStart);
    if (top >= 0 && Math.abs(i - top) === 1) return 'neighbor_bar';
    const second = Math.max(...bins.filter((_, j) => j !== top).map(b => b.count));
    return bins[i].count === second ? 'runner_up' : 'shorter_bar';
  }
  const value = parseFloat(work.typed);
  if (ch.challengeType === 'read_frequency') {
    const key = ch.targetFrequency ?? 0;
    for (const [miss, v] of frequencySignatures(ch, bins)) if (v !== key && v === value) return miss;
    return value > key ? 'too_high' : 'too_low';
  }
  const key = ch.targetAnswer ?? 0;
  if (bins.length && (value < bins[0].start || value > bins[bins.length - 1].end)) return 'off_axis';
  const top = bins[tallestIndex(bins)];
  if (top && value >= top.start && value <= top.end) return 'tallest_bar';
  if (bins.length && Math.abs(value - axisMiddle(bins)) <= (ch.binWidth / 2)) return 'axis_middle';
  return value > key ? 'too_high' : 'too_low';
}

export function workspaceAssignment(ch: HistogramChallenge): TeachingAssignment {
  return { id: ch.id, task: ch.prompt, response: 'gesture' };
}

/** What the session draws beside the bars (its support tier's starting position) and the learner's work. */
export interface HistogramView extends HistogramWork {
  showFrequencyLabels: boolean;
  showStatistics: boolean;
}

const KIND: Record<HistogramChallengeType, string> = {
  identify_shape: 'identify the shape: choose the word that describes the whole distribution',
  find_modal_bin: 'find the modal bin: tap the bar with the most values',
  read_frequency: 'read a frequency: how many values fall in the outlined bin, read from the bar\'s height',
  estimate_center: 'estimate the center: type an estimate of the mean or median from the bars',
};

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** What is drawn and asked. The shape, the tallest bar, the asked count and the center are never named. */
export function workspaceScene(ch: HistogramChallenge, view: HistogramView): WorkspaceScene {
  const bins = computeBins(ch.data, ch.binWidth, ch.binStart);
  const axis = frequencyAxis(Math.max(0, ...bins.map(b => b.count)));
  const facts: Record<string, string> = {
    kind: KIND[ch.challengeType],
    context: ch.contextTitle,
    bars: bins.length
      ? `${bins.length} bars of width ${fmt(ch.binWidth)} along "${ch.xAxisLabel}", from ${fmt(bins[0].start)} to ${fmt(bins[bins.length - 1].end)}; each bar covers its left edge up to, not including, its right edge (the last bar includes its right edge)`
      : 'no bars',
    frequencyAxis: `"${ch.yAxisLabel}" up the side, labelled every ${axis.step}${axis.minor ? ', with a faint line at every whole count' : ''}`,
  };
  // Count labels on the bars: drawn only where they are not the answer (the session withholds them on the modal-bin and
  // read-frequency modes, and at the hard tier). The tutor is told they are there, never what they say.
  facts.countLabels = view.showFrequencyLabels && (ch.challengeType === 'identify_shape' || ch.challengeType === 'estimate_center')
    ? 'each bar has its count printed above it' : 'the bars carry no count labels';
  if (view.showStatistics && ch.challengeType !== 'estimate_center' && ch.data.length) {
    const min = Math.min(...ch.data), max = Math.max(...ch.data);
    facts.statsPanel = `a panel shows Count ${ch.data.length}, Min ${fmt(min)}, Max ${fmt(max)}, Range ${fmt(max - min)}`;
  }
  if (ch.challengeType === 'identify_shape') {
    facts.choices = (ch.shapeOptions ?? []).map(s => SHAPE_LABEL[s]).join(', ');
  } else if (ch.challengeType === 'read_frequency') {
    facts.askedBin = `the bar from ${fmt(ch.targetBinStart ?? 0)} to ${fmt(ch.targetBinEnd ?? 0)} is outlined`;
  } else if (ch.challengeType === 'estimate_center') {
    facts.accepted = `the activity accepts an estimate within ${fmt(ch.tolerance ?? 0)} (one bar width) of the true ${ch.targetStatistic ?? 'center'}`;
  }
  facts.learnerWork = describeHistogramWork(ch, view, bins);
  facts.constraints = ch.challengeType === 'identify_shape'
    ? 'The learner taps one shape word and presses Check. The activity checks it itself. You cannot choose or press Check.'
    : ch.challengeType === 'find_modal_bin'
      ? 'The learner taps a bar and presses Check. The activity checks it itself. You cannot tap a bar or press Check.'
      : 'The learner types a number in the answer box and presses Check. The activity checks it itself. You cannot type, or press Check.';
  return { objects: [], facts };
}

/** The input a journey row performs: a chip, a bar, or a number. */
export type HistogramHarnessInput =
  | { kind: 'choose'; label: string }
  | { kind: 'bar'; index: number }
  | { kind: 'type'; text: string };

/** The journey row's input (`liveJourneySpec.ts`). `wrong` is the item's first signature miss. */
export function histogramHarnessInput(ch: HistogramChallenge, intent: 'correct' | 'wrong'): HistogramHarnessInput {
  const bins = computeBins(ch.data, ch.binWidth, ch.binStart);
  if (ch.challengeType === 'identify_shape') {
    const right = ch.expectedShape ?? 'symmetric';
    if (intent === 'correct') return { kind: 'choose', label: SHAPE_LABEL[right] };
    const swap: Partial<Record<HistogramShapeKind, HistogramShapeKind>> = {
      'right-skewed': 'left-skewed', 'left-skewed': 'right-skewed', symmetric: 'bimodal', bimodal: 'symmetric', uniform: 'symmetric' };
    const options = ch.shapeOptions ?? [];
    const wrong = options.includes(swap[right]!) ? swap[right]! : options.find(o => o !== right) ?? right;
    return { kind: 'choose', label: SHAPE_LABEL[wrong] };
  }
  if (ch.challengeType === 'find_modal_bin') {
    const top = bins.findIndex(b => b.start === ch.expectedBinStart);
    if (intent === 'correct') return { kind: 'bar', index: top };
    // A neighbor with values in it (a bar of height 0 has nothing to tap).
    const next = [top + 1, top - 1].find(i => bins[i] && bins[i].count > 0);
    return { kind: 'bar', index: next ?? bins.findIndex((b, i) => i !== top && b.count > 0) };
  }
  if (ch.challengeType === 'read_frequency') {
    const key = ch.targetFrequency ?? 0;
    if (intent === 'correct') return { kind: 'type', text: String(key) };
    const sig = frequencySignatures(ch, bins).find(([, v]) => Number.isFinite(v) && v !== key && v >= 0);
    return { kind: 'type', text: String(sig ? sig[1] : key + 3) };
  }
  const key = ch.targetAnswer ?? 0;
  if (intent === 'correct') return { kind: 'type', text: fmt(key) };
  // Two bar widths past the key, inside the axis when it fits.
  const far = key + 2 * ch.binWidth <= (bins.at(-1)?.end ?? Infinity) ? key + 2 * ch.binWidth : key - 2 * ch.binWidth;
  return { kind: 'type', text: fmt(far) };
}
