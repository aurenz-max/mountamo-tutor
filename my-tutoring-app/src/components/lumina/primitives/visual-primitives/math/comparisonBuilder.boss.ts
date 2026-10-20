/**
 * comparison-builder's boss, on the spoken preset (`components/live-activity/boss.ts`): comparing groups, comparing
 * numbers and a single one more or one less are said (the tutor judges the words against the key) or tapped (the
 * activity checks the tap), SAY_OR_SHOW modes; an order and a one-more-and-one-less pair have no key, the activity
 * checks them, and they play through `show`. The card is `comparisonBuilder.card.ts`; this file holds the content
 * check, the items, the ask and key, the levers and the harness play.
 */
import type { ComparisonBuilderData } from './ComparisonBuilder';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { comparisonBuilderCard, type ComparisonMiss } from './comparisonBuilder.card';
import { COMPARISON_LEVERS, practiceItem } from './comparisonBuilderLevers';
import {
  COMPARISON_MODE, comparisonAsk, comparisonGiven, comparisonHarnessWords, comparisonItems, comparisonKey,
  comparisonSpokenMisses, type ComparisonItem,
} from './comparisonBuilderWorkspace';

const CHALLENGE_TYPES = ['compare-groups', 'compare-numbers', 'order', 'one-more-one-less'];

/** Reject a comparison whose challenges cannot be attempted. */
export function validateComparisonBuilderData(value: unknown): ComparisonBuilderData {
  const d = value as ComparisonBuilderData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? '')
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id
        || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated comparison builder has invalid lesson content.');
  // Each type needs the material its own ask is built from, or it mounts unanswerable.
  for (const c of d.challenges) {
    const ok = c.type === 'compare-groups'
        ? Number.isInteger(c.leftGroup?.count) && Number.isInteger(c.rightGroup?.count)
          && ['more', 'less', 'equal'].includes(c.correctAnswer ?? '')
      : c.type === 'compare-numbers'
        ? Number.isInteger(c.leftNumber) && Number.isInteger(c.rightNumber)
          && ['<', '>', '='].includes(c.correctSymbol ?? '')
      : c.type === 'order'
        ? Array.isArray(c.numbers) && c.numbers.length >= 3 && c.numbers.every(Number.isInteger)
          && new Set(c.numbers).size === c.numbers.length
      : Number.isInteger(c.targetNumber) && ['one-more', 'one-less', 'both'].includes(c.askFor ?? '');
    if (!ok) throw new Error('A comparison-builder challenge cannot be answered as generated.');
  }
  return d;
}

const choose = (label: string): DriverInput => ({ type: 'choose', label });

export const comparisonBuilderBoss = spokenBoss<ComparisonBuilderData, ComparisonItem, ComparisonMiss>({
  card: comparisonBuilderCard,
  validate: validateComparisonBuilderData,
  items: comparisonItems,
  levers: COMPARISON_LEVERS,
  speech: {
    ask: comparisonAsk,
    // An order and a one-more-and-one-less pair have no key: the activity checks them.
    key: comparisonKey,
    given: comparisonGiven,
    misses: comparisonSpokenMisses,
    say: comparisonHarnessWords,
    modeOf: c => COMPARISON_MODE[c.type],
    // The keyless items through their real controls: the cards in order (reversed when wrong) then Check, or a number
    // in each row (the two exchanged when wrong), then Check in Grade 1 (a Kindergarten pair checks on its second tap).
    show: (right, c) => {
      if (c.type === 'order') {
        const sorted = [...(c.numbers ?? [])].sort((a, b) => c.direction === 'descending' ? b - a : a - b);
        return [...(right ? sorted : sorted.reverse()).map(n => choose(String(n))), { type: 'check' }];
      }
      const t = c.targetNumber ?? 0;
      return [choose(`one more ${right ? t + 1 : t - 1}`), choose(`one less ${right ? t - 1 : t + 1}`),
        ...(c.band === '1' ? [{ type: 'check' } as const] : [])];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/math/ComparisonBuilder.tsx',
    instanceId: 'compare',
    defaults: { grade: 'Grade 1', mode: 'compare_groups', topic: 'Deciding which of two groups has more' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier practice item a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const items = comparisonItems(ctx.data as ComparisonBuilderData);
      const parent = ctx.itemId?.endsWith('~simpler') ? items.find(c => `${c.id}~simpler` === ctx.itemId) : null;
      return parent ? practiceItem(parent) ?? undefined : items.find(c => c.id === ctx.itemId);
    },
  },
});
