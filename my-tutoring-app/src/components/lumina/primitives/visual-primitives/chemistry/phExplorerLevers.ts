/**
 * The in-item levers on ph-explorer (`/add-support-tiers`; report qa/eval-reports/ph-explorer-levers-2026-10-15.md).
 * No real-learner evidence: the misses are what `phMiss` observes; the failures behind them come from the catalog's
 * commonStruggles (acid and base confused, indicator colours not read, neutralization not understood). Every lever
 * starts released; no lever comes from the tier.
 *
 * - `litmus_key` (help; test): a card with what each result of the two papers means. It is the same card on every
 *   item and marks no row.
 * - `color_chart` (help; indicator): the cabbage juice colour chart, six swatches with their ranges. It marks no band.
 * - `step_count` (help; neutralize): how many pH steps each liquid is from 7, and that each step is ten times as
 *   strong. It names no amount and does not compare the two counts.
 * - `ph_meter` (help; neutralize): the pH number of the learner's last mix on the meter. Refused before a mix.
 * - `fewer_choices` (simplify; indicator, neutralize): a different item of the same mode with three choices, ungraded,
 *   then the full item back. indicator: another of the lesson's substances, in another band. neutralize: an
 *   equal-strength pair other than the current one.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { Substance } from './PhExplorer';
import {
  AMOUNTS, bandOf, CABBAGE_BANDS, indicatorSubstances, keyChoice, mixingPair, neutralizeItem, PH_MISSES, SAMPLE_LETTERS,
  type IndicatorItem, type PhItem,
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

/** The levers on the current session item. A practice item has none. */
export function phLevers(item: PhItem | undefined, pulled: readonly string[], substances: readonly Substance[], items: readonly PhItem[]): WorkspaceLever[] {
  if (!item || isPractice(item)) return [];
  const answers = PH_MISSES[item.mode];
  const lever = (id: string, kind: WorkspaceLever['kind'], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  const out: WorkspaceLever[] = [];
  if (item.mode === 'test') {
    out.push(lever(LITMUS_LEVER, 'help', 'The learner does not know what the paper colours mean, or mixes up acid and base.',
      'Shows a card under the papers with what each result means (blue paper turns red: an acid; red paper turns blue: a base; neither changes: neutral). It marks no row; the learner still reads the papers.'));
  }
  if (item.mode === 'indicator') {
    out.push(lever(CHART_LEVER, 'help', 'The learner does not know which colour goes with which part of the scale.',
      'Shows the red cabbage juice colour chart under the tube: six colour swatches, each with its pH range. It marks no band; the learner matches the colour.'));
  }
  if (item.mode === 'neutralize') {
    out.push(lever(STEPS_LEVER, 'help', 'The learner thinks equal amounts always neutralize, or cannot use the pH values.',
      'Shows how many pH steps each liquid is from 7, and that each step is ten times as strong. It names no amount.'));
    out.push(lever(METER_LEVER, 'help', 'After a wrong mix, the learner cannot tell whether there was too much base or too little.',
      'Shows the pH number of the last mix on a meter beside the beaker. Only after a mix.'));
  }
  if (fewerChoices(item, substances, items)) {
    out.push(lever(FEWER_LEVER, 'simplify', 'The learner cannot choose among so many options.',
      item.mode === 'indicator'
        ? 'Opens a different sample first, with only three ranges to choose from. It is not graded; this sample comes back after it.'
        : 'Opens a different pair first, with only three amounts to choose from. It is not graded; this pair comes back after it.'));
  }
  return out;
}

/** What the pulled levers put on screen, as a scene fact. Never a key. */
export function leverFact(item: PhItem | undefined, pulled: readonly string[], meterPH: number | null): string {
  if (!item || isPractice(item)) return '';
  const parts: string[] = [];
  if (pulled.includes(LITMUS_LEVER)) parts.push(`Under the papers, a key card: ${LITMUS_KEY.join(' ')}`);
  if (pulled.includes(CHART_LEVER)) parts.push(`Under the tube, the red cabbage juice chart: ${chartRows().join('; ')}.`);
  if (pulled.includes(STEPS_LEVER)) parts.push(`Under the station: ${stepLines(item).join(' ')}`);
  if (pulled.includes(METER_LEVER) && meterPH !== null) parts.push(`A pH meter beside the beaker reads ${meterPH.toFixed(1)} for the last mix.`);
  return parts.join(' ');
}
