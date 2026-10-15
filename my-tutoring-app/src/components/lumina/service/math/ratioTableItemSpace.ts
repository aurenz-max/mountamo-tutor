/**
 * ratio-table missing_value and unit_rate from the ratio-missing-value item space (skill /add-item-space).
 *
 * The LLM chose every ratio and multiplier, and the tiers ran backwards (easy ×3.75 and ×4.5, medium ×7
 * and ×3; 10-14 probe). With a tier, the space picks each item at the tier's beta and the LLM writes only
 * the story and the two row labels; code checks them.
 *
 * What the primitive can draw (contract R2: the missing_value header shows the multiplier):
 *   - missing_value: items scaled from the base ratio (not unit-rate items) whose factor is exact to two
 *     decimals, so the header's ×m is the true factor (×5/3 would read ×1.67).
 *   - unit_rate: unit-rate items (the amount for one).
 */
import type { RatioTableChallenge } from '../../primitives/visual-primitives/math/RatioTable';
import { ratioAnswer, ratioFactor, ratioGiven, type RatioItem } from '../itemSpace/ratioMissingValue';

export type RatioTableMode = 'missing-value' | 'unit-rate';

export function ratioTableAccepts(mode: RatioTableMode, it: RatioItem): boolean {
  if (mode === 'unit-rate') return it.features.unitRate === 1;
  if (it.features.unitRate) return false;
  return Number.isInteger(Math.round(ratioFactor(it) * 1e6) / 1e4);
}

export interface WrittenRatio { instruction: string; firstLabel: string; secondLabel: string }

const numbersIn = (text: string) => (text.replace(/,(?=\d{3})/g, '').match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

/**
 * The story names the base ratio's two numbers (and the given scaled value), adds no other number but 1,
 * never states the answer, and asks; the labels carry no number.
 */
export function ratioStoryFits(mode: RatioTableMode, it: RatioItem, w: WrittenRatio): boolean {
  if (!w.instruction?.trim().endsWith('?') || !w.firstLabel || !w.secondLabel) return false;
  if (/\d/.test(w.firstLabel + w.secondLabel)) return false;
  const nums = numbersIn(w.instruction);
  const need = mode === 'unit-rate' ? [it.a, it.b] : [it.a, it.b, ratioGiven(it)];
  if (!need.every((n) => nums.includes(n))) return false;
  const allowed = new Set([...need, 1]);
  if (nums.some((n) => !allowed.has(n))) return false;
  return !nums.includes(ratioAnswer(it)) || need.includes(ratioAnswer(it));
}

export function plainRatio(mode: RatioTableMode, it: RatioItem): WrittenRatio {
  if (mode === 'unit-rate') {
    return { instruction: `${it.a} packs of stickers cost $${it.b}. What is the cost of 1 pack?`, firstLabel: 'Packs', secondLabel: 'Cost ($)' };
  }
  return {
    instruction: it.hidden === 'second'
      ? `A recipe uses ${it.a} cups of flour for every ${it.b} muffins. How many muffins can you make with ${it.k} cups of flour?`
      : `A recipe uses ${it.a} cups of flour for every ${it.b} muffins. How many cups of flour do you need for ${ratioGiven(it)} muffins?`,
    firstLabel: 'Cups of flour', secondLabel: 'Muffins',
  };
}

export function ratioChallengeFromItem(
  mode: RatioTableMode, it: RatioItem, w: WrittenRatio, index: number,
): RatioTableChallenge & { itemSpace: { space: string; structure: string; beta: number } } {
  return {
    id: `rt${index + 1}`,
    type: mode,
    instruction: w.instruction,
    baseRatio: [it.a, it.b],
    rowLabels: [w.firstLabel, w.secondLabel],
    targetMultiplier: mode === 'unit-rate' ? 1 : ratioFactor(it),
    ...(mode === 'missing-value' ? { hiddenValue: it.hidden === 'first' ? 'scaled-first' as const : 'scaled-second' as const } : {}),
    hint: mode === 'unit-rate'
      ? 'How much goes with just 1? Share the second amount equally among the first.'
      : 'How many times bigger (or smaller) is the new amount than the one in the ratio? Do the same to the other row.',
    tolerance: 1,
    itemSpace: { space: 'ratio-missing-value', structure: it.structure, beta: it.beta },
  };
}
