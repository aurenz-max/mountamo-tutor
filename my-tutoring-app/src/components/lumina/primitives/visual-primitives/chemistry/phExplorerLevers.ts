/**
 * The in-item levers on ph-explorer, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/ph-explorer-levers-2026-10-15.md). No real-learner evidence: the misses are what `phMiss` observes;
 * the failures behind them come from the documented struggles (acid and base confused, indicator colours not read,
 * neutralization not understood). Every lever starts released; no lever comes from the tier, so there is no model lever
 * and no `support`.
 *
 * - `litmus_key` (custom, shown; test): a card with what each result of the two papers means. The same card on every
 *   item; it marks no row.
 * - `color_chart` (custom, shown; indicator): the cabbage juice colour chart, six swatches with their ranges. It marks
 *   no band.
 * - `step_count` (clue, shown; neutralize): how many pH steps each liquid is from 7, and that each step is ten times as
 *   strong. It names no amount and does not compare the two counts.
 * - `ph_meter` (custom, shown; neutralize): the pH number of the learner's last mix on a meter. Offered only after a mix.
 * - `fewer_choices` (easier; indicator, neutralize): a different item of the same mode with three choices, ungraded,
 *   then the full item back. indicator: another of the lesson's substances, in another band. neutralize: an
 *   equal-strength pair other than the current one.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { keyAnswers } from '../../../components/live-activity/spokenKey';
import type { Substance } from './PhExplorer';
import { PH_MISSES } from './phExplorer.card';
import {
  AMOUNTS, bandOf, CABBAGE_BANDS, indicatorSubstances, keyChoice, mixingPair, neutralizeItem, phKey, phMode, SAMPLE_LETTERS,
  type IndicatorItem, type PhItem, type PhMode,
} from './phExplorerWorkspace';

export const LITMUS_LEVER = 'litmus_key';
export const CHART_LEVER = 'color_chart';
export const STEPS_LEVER = 'step_count';
export const METER_LEVER = 'ph_meter';
export const FEWER_LEVER = 'fewer_choices';

export const LITMUS_KEY = [
  'Blue paper turns red, red paper stays red: an acid.',
  'Red paper turns blue, blue paper stays blue: a base.',
  'Neither paper changes: neutral.',
] as const;

/** The chart rows the colour_chart lever draws. */
export const chartRows = () => CABBAGE_BANDS.map(b => `${b.color}: ${b.label}`);

/** The step lines the step_count lever draws. Never an amount, never a comparison of the two. */
export function stepLines(item: PhItem): string[] {
  if (item.mode !== 'neutralize') return [];
  const n = (k: number) => `${k} step${k === 1 ? '' : 's'}`;
  return [`${item.acid.name}, pH ${item.acid.pH}: ${n(7 - item.acid.pH)} below 7.`,
    `${item.base.name}, pH ${item.base.pH}: ${n(item.base.pH - 7)} above 7.`,
    'Each step is ten times as strong as the one before.'];
}
/** Leak rule, step_count: no amount, no ratio word, no comparison of the two counts. */
export const stepsLeak = (line: string) => /\bcups?\b|\bsame\b|\bequal|\bmore\b|\bless\b|\bfewer\b|\btimes as much\b/i.test(line);

const FEWER = '~fewer';
export const isPractice = (item: Pick<PhItem, 'id'>) => item.id.endsWith(FEWER);
export const practiceParent = (id: string) => (id.endsWith(FEWER) ? id.slice(0, -FEWER.length) : null);

/** Three choices: the key, the one next to it, and the farthest one, in their order on screen. */
const threeChoices = (choices: readonly string[], key: string) => {
  const at = choices.indexOf(key), next = at + 1 < choices.length ? at + 1 : at - 1;
  const far = at < choices.length / 2 ? choices.length - 1 : 0;
  return choices.filter((_, i) => i === at || i === next || i === far);
};

/**
 * The simpler item: the same mode with three choices, on something other than the learner's item. Null when the
 * lesson has nothing else to ask it on.
 */
export function fewerChoices(item: PhItem, substances: readonly Substance[], items: readonly PhItem[] = []): PhItem | null {
  if (isPractice(item)) return null;
  if (item.mode === 'indicator') {
    const asked = new Set(items.filter(i => i.mode === 'indicator').map(i => (i as IndicatorItem).substance.id));
    const pool = indicatorSubstances(substances).filter(s => s.id !== item.substance.id && bandOf(s.pH) !== bandOf(item.substance.pH));
    const other = pool.find(s => !asked.has(s.id)) ?? pool[0];
    if (!other) return null;
    const letter = SAMPLE_LETTERS[Math.min(SAMPLE_LETTERS.length - 1, items.filter(i => i.mode === 'indicator').length)];
    const practice: IndicatorItem = { id: `${item.id}${FEWER}`, mode: 'indicator', substance: other, sample: `Sample ${letter}`, choices: [] };
    return { ...practice, choices: threeChoices(CABBAGE_BANDS.map(b => b.label), keyChoice({ ...practice, choices: CABBAGE_BANDS.map(b => b.label) })) };
  }
  if (item.mode === 'neutralize') {
    const pair = ([[2, 12], [1, 13], [3, 11]] as const).find(([a, b]) => a !== item.acid.pH || b !== item.base.pH)!;
    const names = mixingPair(substances.length ? substances : []);
    const full = neutralizeItem({ acid: item.acid.name || names.acid, base: item.base.name || names.base }, pair[0], pair[1]);
    return { ...full, id: `${item.id}${FEWER}`, choices: threeChoices(AMOUNTS.map(a => a.label), keyChoice(full)) };
  }
  return null;
}

/** What the levers read beside the item: the lesson, and the pH of the learner's last mix on this item. */
export interface PhLeverContext {
  substances: readonly Substance[];
  items: readonly PhItem[];
  meterPH: number | null;
}

export const PH_LEVERS = leverSet<PhItem, PhLeverContext>({
  modeOf: phMode,
  missesOf: mode => PH_MISSES[mode as PhMode] ?? [],
  // The step counts never name the amount or a way of saying it.
  answersOf: item => keyAnswers(phKey(item)),
  specs: [
    { id: LITMUS_LEVER, type: 'legend', modes: ['test'], answers: 'all',
      when: 'The learner does not know what the paper colours mean, or mixes up acid and base.',
      does: 'Shows a card under the papers with what each result means (blue paper turns red: an acid; red paper turns blue: '
        + 'a base; neither changes: neutral). It marks no row. Never say which row matches the papers; ask the learner to find it.',
      fact: `Under the papers, a key card: ${LITMUS_KEY.join(' ')}` },
    { id: CHART_LEVER, type: 'legend', modes: ['indicator'], answers: 'all',
      when: 'The learner does not know which colour goes with which part of the scale.',
      does: 'Shows the red cabbage juice colour chart under the tube: six colour swatches, each with its pH range. It marks no '
        + 'band. Never say which swatch matches the tube; ask the learner to find it.',
      fact: `Under the tube, the red cabbage juice chart: ${chartRows().join('; ')}.` },
    { id: STEPS_LEVER, type: 'clue', carrier: 'shown', modes: ['neutralize'], answers: 'all',
      when: 'The learner thinks equal amounts always neutralize, or cannot use the pH values.',
      does: 'Shows how many pH steps each liquid is from 7, and that each step is ten times as strong. It names no amount. '
        + 'Never say the two are the same number of steps from 7, equally far, or which is farther; ask the learner to compare the two counts.',
      content: item => { const lines = stepLines(item); return lines.length && !lines.some(stepsLeak) ? lines : null; },
      fact: (lines: string[]) => `Under the station: ${lines.join(' ')}` },
    { id: METER_LEVER, type: 'custom', carrier: 'shown', modes: ['neutralize'], answers: 'all',
      why: 'It reads the learner\'s own last mix on a meter; no stock type reads back what the learner just did.',
      when: 'After a wrong mix, the learner cannot tell whether there was too much base or too little.',
      does: 'Shows the pH number of the last mix on a meter beside the beaker.',
      // Offered only once there is a mix to read.
      content: (_item, ctx) => ctx.meterPH,
      fact: (pH: number) => `A pH meter beside the beaker reads ${pH.toFixed(1)} for the last mix.` },
    { id: FEWER_LEVER, type: 'easier', modes: ['indicator', 'neutralize'], answers: 'all',
      when: 'The learner cannot choose among so many options.',
      does: item => (item.mode === 'indicator'
        ? 'Opens a different sample first, with only three ranges to choose from. It is not graded; this sample comes back after it.'
        : 'Opens a different pair first, with only three amounts to choose from. It is not graded; this pair comes back after it.'),
      content: (item, ctx) => fewerChoices(item, ctx.substances, ctx.items) },
  ],
});
