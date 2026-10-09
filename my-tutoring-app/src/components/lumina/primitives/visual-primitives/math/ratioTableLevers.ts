/**
 * ratio-table's in-item levers (/add-support-tiers; report qa/eval-reports/ratio-table-levers-2026-10-09.md).
 * The misses are what `ratioMiss` observes in the number typed or the slider; there is no real-learner evidence.
 *
 * - `bar_chart` (help, missing value / find multiplier / build, where the session does not draw it): the bar chart of
 *   both columns, the hidden cell's bar labelled "?".
 * - `unit_rate_banner` (help, missing value, where the session does not draw it): the banner with how many of the second
 *   quantity go with 1 of the first. Never on a unit-rate item, never when that number is the answer.
 * - `times_arrows` (help, missing value / find multiplier / build): an arrow on EACH row from the base cell to the
 *   scaled cell, labelled with the header's multiplier (missing value), "× ?" (find multiplier), or the slider's
 *   current multiplier (build): the same multiplier acts on both rows.
 * - `division_frame` (help, find multiplier): "scaled ÷ base = ?" written under the table for one row, using numbers
 *   already on screen and never the answer.
 * - `equal_groups` (help, unit rate, a whole first quantity up to 12): one empty box per unit of the first quantity,
 *   captioned that the second quantity is shared equally into them. No number is written.
 * - `model_ratio` (help, every mode): a worked ratio outside the item, with its own pair (never the item's answer): both
 *   rows multiplied by the same number, or (unit rate) both divided down to 1.
 * - `simpler_problem` (simplify, every mode): the same mode on small whole numbers, built here; ungraded practice.
 *
 * Leak rules (code): no lever's `when`/`does` text or scene fact carries a digit; the arrows on a find item and the
 * boxes on a unit-rate item carry no number; the division frame and the model never write the item's answer; a
 * practice problem has its own id and ask, a different base and answer, and keeps the mode.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { RatioTableChallenge } from './RatioTable';
import { bannerShown, buildRatioAsk, formatNum, matchesKey, ratioKey, shownMultiplier, type RatioMiss } from './ratioTableWorkspace';

export const BAR_CHART_LEVER = 'bar_chart';
export const BANNER_LEVER = 'unit_rate_banner';
export const ARROWS_LEVER = 'times_arrows';
export const DIVISION_LEVER = 'division_frame';
export const GROUPS_LEVER = 'equal_groups';
export const MODEL_LEVER = 'model_ratio';
export const SIMPLER_LEVER = 'simpler_problem';

const SIMPLER = '~simpler';
export const isPracticeRatio = (c: Pick<RatioTableChallenge, 'id'>) => c.id.endsWith(SIMPLER);
export const practiceParent = (id: string) => id.replace(/~simpler$/, '');

/** Every number the item puts on screen or answers with, as the screen prints it. */
export function itemNumbers(c: RatioTableChallenge): string[] {
  const [a, b] = c.baseRatio, k = c.targetMultiplier;
  // A unit-rate item draws only its base pair (its multiplier is a placeholder 1).
  return (c.type === 'unit-rate' ? [a, b, ratioKey(c)] : [a, b, a * k, b * k, k, ratioKey(c)]).map(formatNum);
}

/** The worked ratio outside the item: its numbers, none of the item's, and its operation. */
export interface RatioModel {
  from: [number, number];
  to: [number, number];
  /** '×' scales both rows up; '÷' divides both rows down to 1 of the first (unit rate). */
  op: '×' | '÷';
  by: number;
}

const SCALE_MODELS: Array<[number, number, number]> = [[2, 5, 3], [3, 4, 2], [2, 7, 4], [4, 5, 3], [3, 10, 2], [5, 6, 2], [2, 9, 3],
  [3, 7, 5], [4, 9, 5], [5, 7, 3], [6, 7, 4], [7, 9, 2]];
const RATE_MODELS: Array<[number, number]> = [[3, 12], [2, 10], [4, 28], [5, 15], [6, 18], [4, 36]];

export function ratioModel(c: RatioTableChallenge): RatioModel | null {
  // The model may share a number with the item (a base of 2 is common), never the item's answer or its base pair.
  const key = formatNum(ratioKey(c)), [a0, b0] = c.baseRatio;
  const free = (m: RatioModel) => [...m.from, ...m.to, m.by].every(n => formatNum(n) !== key)
    && !(m.from[0] === a0 && m.from[1] === b0);
  const models: RatioModel[] = c.type === 'unit-rate'
    ? RATE_MODELS.map(([a, b]) => ({ from: [a, b], to: [1, b / a], op: '÷', by: a }))
    : SCALE_MODELS.map(([a, b, m]) => ({ from: [a, b], to: [a * m, b * m], op: '×', by: m }));
  return models.find(free) ?? null;
}

/** The row the division frame writes ("scaled ÷ base"), one whose numbers are not the answer; null if neither. */
export function divisionRow(c: RatioTableChallenge): [number, number] | null {
  if (c.type !== 'find-multiplier') return null;
  const key = formatNum(ratioKey(c)), k = c.targetMultiplier;
  const rows = c.baseRatio.map(v => [v * k, v] as [number, number]);
  return rows.find(([s, v]) => formatNum(s) !== key && formatNum(v) !== key) ?? null;
}

/** The boxes for `equal_groups`: one per unit of the first quantity, when it is a whole number from 2 to 12. */
export const groupCount = (c: RatioTableChallenge) => {
  const a = c.baseRatio[0];
  return c.type === 'unit-rate' && Number.isInteger(a) && a >= 2 && a <= 12 ? a : null;
};

// ── simplify ─────────────────────────────────────────────────────────────

const isWhole = (n: number) => Number.isInteger(n);
/** Already small and whole: nothing simpler to offer. */
function alreadySimple(c: RatioTableChallenge): boolean {
  const [a, b] = c.baseRatio, k = c.targetMultiplier;
  if (c.type === 'unit-rate') return isWhole(a) && a <= 3 && isWhole(b / a) && b <= 30;
  return isWhole(a) && isWhole(b) && a <= 5 && b <= 30 && isWhole(k) && k <= 3;
}

/**
 * The easier practice problem for `c`: same mode, small whole numbers (a base of 2 or 3, a whole unit rate, a
 * multiplier of 2 or 3), the item's own labels, and an ask built here. Null when the item is already that simple.
 */
export function simplerRatio(c: RatioTableChallenge): RatioTableChallenge | null {
  if (isPracticeRatio(c) || alreadySimple(c)) return null;
  const [A, B] = c.rowLabels;
  for (const u of [3, 4, 5]) for (const k of [2, 3]) {
    const a = c.type === 'unit-rate' ? 3 : 2, b = a * u;
    const base = { ...c, id: `${c.id}${SIMPLER}`, baseRatio: [a, b] as [number, number], tolerance: 1, hint: '' };
    let practice: RatioTableChallenge;
    if (c.type === 'unit-rate') {
      practice = { ...base, targetMultiplier: 1,
        instruction: `Practice first: ${a} ${A} go with ${b} ${B}. How many ${B} go with 1 ${A}?` };
    } else if (c.type === 'find-multiplier') {
      practice = { ...base, targetMultiplier: k,
        instruction: `Practice first: ${a} ${A} and ${b} ${B} became ${a * k} ${A} and ${b * k} ${B}. What were both multiplied by?` };
    } else if (c.type === 'build-ratio') {
      practice = { ...base, targetMultiplier: k, instruction: `Practice first. ${buildRatioAsk({ baseRatio: [a, b], rowLabels: [A, B], targetMultiplier: k })}` };
    } else {
      const first = c.hiddenValue === 'scaled-first';
      practice = { ...base, targetMultiplier: k, hiddenValue: c.hiddenValue ?? 'scaled-second',
        instruction: first
          ? `Practice first: ${a} ${A} go with ${b} ${B}. How many ${A} go with ${b * k} ${B}?`
          : `Practice first: ${a} ${A} go with ${b} ${B}. How many ${B} go with ${a * k} ${A}?` };
    }
    if (!practiceLeaks(c, practice)) return practice;
  }
  return null;
}

/** Leak rule for a practice problem: never the learner's item (id, ask, base), never its answer, and the same mode. */
export function practiceLeaks(parent: RatioTableChallenge, practice: RatioTableChallenge): boolean {
  return practice.id === parent.id || practice.instruction === parent.instruction || practice.type !== parent.type
    || (practice.baseRatio[0] === parent.baseRatio[0] && practice.baseRatio[1] === parent.baseRatio[1])
    || matchesKey(parent, ratioKey(practice)) || itemNumbers(practice).includes(formatNum(ratioKey(parent)));
}

// ── declarations ─────────────────────────────────────────────────────────

export interface RatioLeverContext {
  /** The session already draws the bar chart / the unit-rate banner (a starting position). */
  barChartShown: boolean;
  bannerOn: boolean;
}

const ALL: Record<RatioTableChallenge['type'], readonly RatioMiss[]> = {
  'missing-value': ['added_difference', 'unscaled', 'copied_known', 'unit_rate', 'multiplier', 'near_miss', 'too_high', 'too_low'],
  'find-multiplier': ['difference', 'scaled_value', 'unit_rate', 'inverse', 'near_miss', 'too_high', 'too_low'],
  'unit-rate': ['inverse_rate', 'difference', 'typed_quantity', 'near_miss', 'too_high', 'too_low'],
  'build-ratio': ['one_step_off', 'near_miss', 'too_high', 'too_low'],
};

export function ratioLevers(c: RatioTableChallenge | null, pulled: readonly string[], ctx: RatioLeverContext): WorkspaceLever[] {
  if (!c || isPracticeRatio(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly RatioMiss[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const t = c.type;
  const out: WorkspaceLever[] = [];
  if (t !== 'unit-rate' && !ctx.barChartShown) {
    out.push(lever(BAR_CHART_LEVER, 'help', 'shown',
      t === 'missing-value' ? ['added_difference', 'unscaled', 'copied_known', 'too_high', 'too_low']
        : t === 'find-multiplier' ? ['difference', 'scaled_value', 'inverse', 'too_high', 'too_low'] : ['one_step_off', 'too_high', 'too_low'],
      'The learner does not see how much bigger the scaled column is than the base column.',
      'Draws the bar chart under the table: a bar for each cell of both columns, side by side. A hidden cell\'s bar is '
        + 'labelled with a question mark.'));
  }
  if (t === 'missing-value' && !ctx.bannerOn && bannerShown(c, true)) {
    out.push(lever(BANNER_LEVER, 'help', 'shown', ['added_difference', 'unscaled', 'near_miss', 'too_high', 'too_low'],
      'The learner cannot get from the base column to the hidden cell.',
      'Shows the unit-rate banner: how many of the second quantity go with one of the first. It is a step toward the '
        + 'hidden cell, not the hidden cell.'));
  }
  if (t !== 'unit-rate') {
    out.push(lever(ARROWS_LEVER, 'help', 'shown',
      t === 'missing-value' ? ['added_difference', 'unscaled', 'copied_known', 'multiplier', 'unit_rate']
        : t === 'find-multiplier' ? ['difference', 'scaled_value', 'unit_rate'] : ['one_step_off', 'near_miss', 'too_high', 'too_low'],
      'The learner adds, scales one row only, or copies a number across.',
      t === 'find-multiplier'
        ? 'Draws an arrow on each row from the base cell to the scaled cell, both labelled times a question mark: the same '
          + 'unknown multiplier acts on both rows. No number is written.'
        : t === 'build-ratio'
          ? 'Draws an arrow on each row from the base cell to the scaled cell, labelled with where the slider is now, so the '
            + 'same multiplier visibly acts on both rows. It follows the slider and never shows the target multiplier.'
          : 'Draws an arrow on each row from the base cell to the scaled cell, labelled with the multiplier the header '
            + 'already shows (a question mark where the header hides it), so the hidden cell is its base cell times it.'));
  }
  if (t === 'find-multiplier' && divisionRow(c)) {
    out.push(lever(DIVISION_LEVER, 'help', 'shown', ['inverse', 'unit_rate', 'difference', 'near_miss', 'too_high', 'too_low'],
      'The learner divides the wrong way, subtracts, or cannot find the multiplier.',
      'Writes "scaled divided by base equals ?" under the table for one row, with that row\'s two numbers from the table. '
        + 'The result is not written.'));
  }
  if (t === 'unit-rate' && groupCount(c)) {
    out.push(lever(GROUPS_LEVER, 'help', 'shown', ['inverse_rate', 'difference', 'typed_quantity', 'near_miss', 'too_high', 'too_low'],
      'The learner divides the wrong way, subtracts, or does not see what "per one" means.',
      'Draws one empty box for each unit of the first quantity, captioned that the second quantity is shared equally into '
        + 'the boxes and one box is the amount for one. No number is written in the boxes.'));
  }
  if (ratioModel(c)) {
    out.push(lever(MODEL_LEVER, 'help', 'both', ALL[t],
      'The learner does not know how equivalent ratios are built.',
      t === 'unit-rate'
        ? 'Shows a worked ratio outside the item, with its own pair of numbers: both rows divided by the first '
          + 'number, so the first becomes one. Read it aloud; it never shows the item\'s answer.'
        : 'Shows a worked ratio outside the item, with its own pair of numbers: both rows multiplied by the same '
          + 'number, arrows on both rows. Read it aloud; it never shows the item\'s answer.'));
  }
  if (simplerRatio(c)) {
    out.push(lever(SIMPLER_LEVER, 'simplify', 'shown', ALL[t].filter(m => m !== 'typed_quantity'),
      'These numbers are too hard to work with yet.',
      'Opens an easier problem of the same kind first, with small whole numbers and the same labels. It is not graded; '
        + 'the full item comes back after it.'));
  }
  return out;
}

/** What the pulled help levers put on screen, for the tutor and JEV. No digit, no answer. */
export function leverFacts(c: RatioTableChallenge | null, pulled: readonly string[]): string {
  if (!c || isPracticeRatio(c)) return '';
  const on = (id: string) => pulled.includes(id);
  const arrows = c.type === 'find-multiplier' ? 'times a question mark'
    : c.type === 'build-ratio' ? 'with where the slider is now'
      : shownMultiplier(c) === null ? 'times a question mark' : 'with the header\'s multiplier';
  return [
    on(BAR_CHART_LEVER) && 'Under the table is a bar chart of both columns; a hidden cell\'s bar is labelled with a question mark.',
    on(BANNER_LEVER) && 'The unit-rate banner is on screen.',
    on(ARROWS_LEVER) && `An arrow on each row goes from the base cell to the scaled cell, labelled ${arrows}.`,
    on(DIVISION_LEVER) && 'Under the table, one row is written as its scaled number divided by its base number equals a question mark.',
    on(GROUPS_LEVER) && 'Beside the table is one empty box per unit of the first quantity, captioned that the second quantity is shared equally into them.',
    on(MODEL_LEVER) && 'Beside the table is a worked ratio outside the item, with its own numbers.',
  ].filter((s): s is string => !!s).join(' ');
}

/** Leak rule for the levers' words and facts: no digit at all. */
export const leverTextLeaks = (text: string) => /\d/.test(text);
