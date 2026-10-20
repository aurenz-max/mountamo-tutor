/**
 * equation-balancer's boss, on the spoken preset (`components/live-activity/boss.ts`): a count item is one number the
 * learner says (the tutor judges the words against the key) or taps and checks (the activity judges the tap), a
 * SAY_OR_SHOW mode; a balance item has no key, the learner sets every number and the activity checks the board, and it
 * plays through `show`. The card is `equationBalancer.card.ts`; this file holds the content check, the items, the ask
 * and key, the levers and the harness play.
 */
import type { EquationBalancerData } from './EquationBalancer';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { equationBalancerCard } from './equationBalancer.card';
import { BALANCER_LEVERS, practiceParent, simplerItem } from './equationBalancerLevers';
import {
  askOf, balancerGiven, balancerHarnessAnswers, balancerItems, balancerKey, balancerMode, countSpokenMisses,
  resolveBalancerModes, type BalancerItem, type EquationBalancerMiss,
} from './equationBalancerWorkspace';

/**
 * Reject content a mode cannot be asked on: no title, no readable equation, or a requested mode with no item (simple
 * needs an equation whose count depends on both numbers; guided an equation with no shared element; complex one with a
 * shared element). Every key is solved from the formulas, so nothing else is trusted from the generator.
 */
export function validateEquationBalancerData(value: unknown): EquationBalancerData {
  const d = value as EquationBalancerData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated equation balancer has invalid lesson content.');
  const items = balancerItems(d);
  if (!items.length) throw new Error('The generated equation balancer has no equation code can read and solve.');
  for (const mode of resolveBalancerModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The equation-balancer ${mode} mode has no item to ask on these equations.`);
  }
  return d;
}

const say = (item: BalancerItem) => {
  const answers = balancerHarnessAnswers(item);
  return { correct: answers.correct[0] ?? '', plainWrong: answers.plainWrong[0] ?? '' };
};

export const equationBalancerBoss = spokenBoss<EquationBalancerData, BalancerItem, EquationBalancerMiss>({
  card: equationBalancerCard,
  validate: validateEquationBalancerData,
  items: balancerItems,
  levers: BALANCER_LEVERS,
  speech: {
    ask: askOf,
    // A balance item has no key: the activity checks the numbers.
    key: balancerKey,
    given: balancerGiven,
    misses: item => (item.mode === 'simple' ? countSpokenMisses(item) : []),
    say,
    modeOf: balancerMode,
    // A balance board through its real controls: Start over when a number has moved (Try again keeps the numbers),
    // the "Add one <formula>" presses that take every number from 1 to the key, then Check Balance. A wrong set raises
    // only the formula with the largest key.
    show: (right, item, ctx) => {
      const answers = balancerHarnessAnswers(item);
      const moved = !/^Every number is still 1/.test(String(ctx.demand?.learnerWork ?? 'Every number is still 1'));
      return [...(moved ? [{ type: 'choose', label: 'Start over' } as DriverInput] : []),
        ...(right ? answers.correct : answers.plainWrong).map((label): DriverInput => ({ type: 'choose', label })), { type: 'check' }];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/chemistry/EquationBalancer.tsx',
    instanceId: 'equation-balancer',
    defaults: { grade: 'Grade 7', mode: 'simple', topic: 'Balancing chemical equations' },
    mounted: '[data-pip-object="workspace"]',
    // The smaller practice item (`~simpler`) is rebuilt from its parent with the same builder.
    current: ctx => {
      const items = balancerItems(ctx.data as EquationBalancerData);
      const parent = practiceParent(ctx.itemId ?? '');
      const full = items.find(i => i.id === (parent ?? ctx.itemId));
      return parent && full ? simplerItem(full, items) ?? undefined : full;
    },
  },
});
