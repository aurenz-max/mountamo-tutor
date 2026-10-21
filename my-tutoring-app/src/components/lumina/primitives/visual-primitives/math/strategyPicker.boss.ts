/**
 * strategy-picker's boss (`components/live-activity/boss.ts`), bespoke because the stepper modes are not one tap: the
 * card is `strategyPicker.card.ts`; this file validates a lesson, lists its challenges, asks one, carries the lever set
 * and plays the harness.
 */
import type { StrategyPickerChallenge, StrategyPickerData } from './StrategyPicker';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import { strategyPickerAsk, strategyPickerHarnessInputs } from './strategyPickerWorkspace';
import { STRATEGY_PICKER_LEVERS, practiceItem, practiceParent } from './strategyPickerLevers';
import { strategyPickerCard, type StrategyPickerMiss } from './strategyPicker.card';

const strings = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.every(s => typeof s === 'string');

/** Reject a challenge the picker cannot check: its answer must be reachable with the controls it draws. */
export const validateStrategyPickerData = (value: unknown): StrategyPickerData => validateChallengePool<StrategyPickerData>(value,
  c => {
    if (!c || typeof c.instruction !== 'string' || !c.instruction || !c.problem) return false;
    const { operand1, operand2, operation, result } = c.problem;
    if (typeof c.problem.equation !== 'string' || typeof result !== 'number'
      || result !== (operation === 'subtraction' ? operand1 - operand2 : operand1 + operand2)) return false;
    // The stepper runs 0..20.
    const reachable = result >= 0 && result <= 20;
    switch (c.type) {
      case 'guided-strategy':
      case 'try-another': return reachable && typeof c.assignedStrategy === 'string';
      case 'choose-your-strategy': return reachable && strings(c.availableStrategies);
      // One option is the answer handed over, not a choice.
      case 'match-strategy': return typeof c.workedSolution === 'string' && !!c.workedSolution && strings(c.strategyOptions)
        && c.strategyOptions.length >= 2 && typeof c.correctStrategy === 'string' && c.strategyOptions.includes(c.correctStrategy);
      case 'compare': return strings(c.strategies) && typeof c.comparisonQuestion === 'string' && !!c.comparisonQuestion;
      default: return false;
    }
  },
  { pool: 'Generated strategy picker has invalid lesson content.', item: 'A strategy-picker challenge cannot be checked.' });

export const strategyPickerBoss = defineBoss<StrategyPickerData, StrategyPickerChallenge, StrategyPickerMiss>({
  card: strategyPickerCard,
  validate: validateStrategyPickerData,
  items: d => d.challenges,
  ask: c => strategyPickerAsk(c),
  // A gesture the picker checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, strategyPickerAsk(c), null),
  levers: STRATEGY_PICKER_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/StrategyPicker.tsx',
    instanceId: 'strategies',
    defaults: { grade: 'Grade 1', mode: 'guided', topic: 'Addition strategies within 10: counting on, doubles and making ten' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier practice item a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as StrategyPickerData;
      const all = data.challenges ?? [];
      const parent = practiceParent(String(ctx.itemId ?? ''), all);
      return parent ? practiceItem(parent, data) ?? undefined : all.find(c => c.id === ctx.itemId);
    },
    // Every mode through its real controls: a menu strategy, the stepper's "One more", or an option tapped, then Check.
    // A wrong answer sets one more than the answer or taps another option; compare has no wrong answer and throws.
    // Try again keeps a choose item's menu pick, which the scene publishes as `chosen`.
    play: (right, c, ctx) => {
      const picked = typeof ctx.demand?.chosen === 'string' && ctx.demand.chosen !== 'none yet';
      return strategyPickerHarnessInputs(c, !right, picked);
    },
  },
});
