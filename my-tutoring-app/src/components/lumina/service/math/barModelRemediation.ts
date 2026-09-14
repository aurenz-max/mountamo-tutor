import type { AdaptationTask, TeachingCapability } from '../generation/planLearningAdaptation';
import type { BarModelChallenge } from './gemini-bar-model';

export type BarModelRemediationMove = 'contrast_icon_count_and_row_value';

// Describes what the picture-graph activity can execute, not diagnosis wording.
export const barModelTeaching: TeachingCapability<BarModelRemediationMove> = {
  activity: 'bar-model',
  task: 'Read a picture graph whose key says one icon stands for a fixed number of items (5 at this support level). '
    + 'The named row is highlighted; the learner picks that row\'s total from four numbers. The row total is the number of icons '
    + 'multiplied by the key value, and every choice set includes the number of icons shown in the row as well as the total.',
  moves: [{
    id: 'contrast_icon_count_and_row_value',
    description: 'Pair two picture graphs that use the same key. In one, the highlighted row has as many icons as one icon is worth '
      + '(5 icons, total 25); in the other, the highlighted row has a single icon (total 5). The number of icons in the first row is '
      + 'the correct total of the second, so the pair separates how many icons are shown from how many items they stand for. '
      + 'Holds the key value, the four rows and how choices are built. Practises applying a picture-graph key to icon counts; '
      + 'does not practise reading bar-graph axes, comparing rows, or how-many-more questions.',
  }],
};

/** Code-owned task gate. Topic/intent that name numbers are lesson anchors and outrank adaptation. */
export function eligibleBarModelTeaching(task: AdaptationTask): boolean {
  const anchors = [task.topic, task.intent].filter(Boolean).join(' ');
  return task.mode === 'picture_graph' && task.tier === 'medium' && ['2', '3'].includes(task.grade ?? '')
    && !/\d|\b(?:two|three|four|five|six|seven|eight|nine|ten|twenty)\b/i.test(anchors);
}

/** Cheap pre-check before the signed observation read; the generator still runs the full gate. */
export function barModelDeliveryEligible(config: Record<string, unknown>): boolean {
  return config.targetEvalMode === 'picture_graph' && config.difficulty === 'medium';
}

/** Four choices containing the total and the bare icon count (the answer key never changes). */
export function pictureGraphOptions(expected: number, iconValue: number): number[] {
  const opts = new Set<number>([expected]);
  const count = expected / iconValue;
  if (iconValue > 1 && Number.isInteger(count) && count > 0) opts.add(count);
  for (const d of [iconValue, -iconValue, 2 * iconValue, -2 * iconValue, 1, -1, 3 * iconValue, -3 * iconValue, 2, -2]) {
    if (opts.size >= 4) break;
    opts.add(Math.max(0, expected + d));
  }
  for (let fill = expected + 1; opts.size < 4; fill++) opts.add(fill);
  return Array.from(opts).sort((a, b) => a - b);
}

interface PictureItem { index: number; id: string; iconValue: number; iconCount: number; expected: number }

/** Recompiles picture_graph challenges from their rendered fields; malformed items are not counted. */
export function pictureGraphItems(challenges: readonly BarModelChallenge[]): PictureItem[] {
  return challenges.flatMap((c, index) => {
    const iconValue = c.scale?.iconValue ?? 1;
    const row = c.values[c.targetBarIndex ?? -1];
    if (c.evalMode !== 'picture_graph' || c.graphStyle !== 'picture' || !Number.isInteger(iconValue) || iconValue < 2
      || !row || row.value !== c.expectedValue || row.value <= 0 || row.value % iconValue !== 0
      || !c.options?.includes(row.value)) return [];
    return [{ index, id: c.id, iconValue, iconCount: row.value / iconValue, expected: row.value }];
  });
}

export function compiledIconCountContrast(challenges: readonly BarModelChallenge[]) {
  const items = pictureGraphItems(challenges);
  const pair = items.flatMap(a => items.filter(b => a.index !== b.index && a.iconValue === b.iconValue
    && a.iconCount === b.expected && a.expected !== b.expected
    && [a, b].every(i => challenges[i.index].options!.includes(i.iconCount))).map(b => [a, b]))[0];
  return { items, targets: pair ?? [], count: pair ? 2 : 0 };
}

const ceilToMultiple = (n: number, step: number) => Math.max(step, Math.ceil(n / step) * step);

/** Set the targeted row's total; prompt/hint fall back to the code templates if they cite a stale number. */
function retarget(c: BarModelChallenge, value: number): BarModelChallenge {
  const iconValue = c.scale!.iconValue!;
  const target = c.targetBarIndex!;
  if (c.values[target].value === value) return c;
  const values = c.values.map((v, i) => (i === target ? { ...v, value } : v));
  const emoji = c.scale!.iconEmoji ?? '⭐';
  const onlyKeyNumber = (text?: string) => !!text && (text.match(/\d+/g) ?? []).every(n => Number(n) === iconValue);
  return {
    ...c,
    values,
    scale: { ...c.scale!, max: ceilToMultiple(Math.max(...values.map(v => v.value)), iconValue) },
    prompt: onlyKeyNumber(c.prompt) ? c.prompt : `Each ${emoji} stands for ${iconValue}. How many for ${values[target].label}?`,
    hint: onlyKeyNumber(c.hint) ? c.hint : `Count the icons, then multiply by ${iconValue}.`,
    expectedValue: value,
    options: pictureGraphOptions(value, iconValue),
  };
}

export type IconContrastStatus = 'targeted' | 'already-targeted' | 'insufficient-capacity' | 'no-focus';

/**
 * Change at most two targeted rows so one row's icon count equals another row's total at the same key.
 * Keeps count, order, rows, labels, key and support flags; answers and choices are recomputed.
 */
export function selectIconCountContrast(baseline: readonly BarModelChallenge[], move: BarModelRemediationMove | null) {
  const result = (challenges: readonly BarModelChallenge[], status: IconContrastStatus) =>
    ({ challenges, status, ...compiledIconCountContrast(challenges) });
  if (!move) return result(baseline, 'no-focus');
  if (compiledIconCountContrast(baseline).count === 2) return result(baseline, 'already-targeted');
  const items = pictureGraphItems(baseline);
  const candidates = items.flatMap(a => items.filter(b => b.index !== a.index && b.iconValue === a.iconValue
    && a.iconValue * a.iconValue <= 8 * a.iconValue).map(b => {
    const changed = Number(a.expected !== a.iconValue * a.iconValue) + Number(b.expected !== a.iconValue);
    // Fewest changed rows, then adjacent items, then earliest; the many-icon item comes first on ties.
    return { a, b, rank: [changed, Math.abs(a.index - b.index), Math.min(a.index, b.index), a.index] };
  })).sort((x, y) => x.rank.map((v, i) => v - y.rank[i]).find(d => d !== 0) ?? 0);
  for (const { a, b } of candidates) {
    const next = baseline.map((c, i) => (i === a.index ? retarget(c, a.iconValue * a.iconValue)
      : i === b.index ? retarget(c, a.iconValue) : c));
    const keys = next.map(c => JSON.stringify([c.evalMode, c.values.map(v => [v.label, v.value]), c.targetBarIndex]));
    if (new Set(keys).size !== keys.length) continue;
    if (compiledIconCountContrast(next).count === 2) return result(next, 'targeted');
  }
  return result(baseline, 'insufficient-capacity');
}
