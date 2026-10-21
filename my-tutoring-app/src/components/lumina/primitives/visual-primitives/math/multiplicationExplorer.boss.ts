/**
 * multiplication-explorer's boss (`components/live-activity/boss.ts`), bespoke because every mode is a typed number the
 * activity checks: the card is `multiplicationExplorer.card.ts`; this file validates a lesson, lists its facts, asks
 * one, carries the lever set and plays the harness.
 */
import type { MultiplicationExplorerChallenge, MultiplicationExplorerData } from './MultiplicationExplorer';
import { bossAssignment, defineBoss, hasText } from '../../../components/live-activity/boss';
import { NO_FACT, askFor, askedSlot, expectedAnswer, explorerItems, resolveChallengeFact } from './multiplicationExplorerWorkspace';
import { MULTIPLICATION_LEVERS, practiceParent, smallerFact } from './multiplicationExplorerLevers';
import { multiplicationExplorerCard, type MultiplicationMiss } from './multiplicationExplorer.card';

type Lesson = MultiplicationExplorerData & { title: string };

const TYPES = ['build', 'connect', 'commutative', 'distributive', 'missing_factor', 'fluency'];
const factor = (n: unknown) => Number.isInteger(n) && (n as number) >= 1;

/** Reject a multiplication lesson whose challenges cannot be attempted. */
export function validateMultiplicationExplorerData(value: unknown): Lesson {
  const d = value as Lesson;
  if (!d || !hasText(d.title) || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)))
    throw new Error('Generated multiplication explorer has invalid lesson content.');
  // Each challenge needs a fact its check can read, and a missing factor must hide a factor.
  for (const c of d.challenges) {
    const f = resolveChallengeFact(c, d.fact ?? NO_FACT);
    if (!factor(f.factor1) || !factor(f.factor2)
        || (c.type === 'missing_factor' && c.hiddenValue !== 'factor1' && c.hiddenValue !== 'factor2'))
      throw new Error(`A multiplication-explorer ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** The ask, from the item's own fact (`explorerItems` stamps it; a lesson's session fact is the fallback). */
const ask = (c: MultiplicationExplorerChallenge, d?: Pick<MultiplicationExplorerData, 'fact'>) =>
  askFor(c, resolveChallengeFact(c, d?.fact ?? NO_FACT));

export const multiplicationExplorerBoss = defineBoss<Lesson, MultiplicationExplorerChallenge, MultiplicationMiss>({
  card: multiplicationExplorerCard,
  validate: validateMultiplicationExplorerData,
  items: d => explorerItems(d),
  ask,
  // A typed number the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, ask(c), null),
  levers: MULTIPLICATION_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/MultiplicationExplorer.tsx',
    instanceId: 'multiply',
    defaults: { grade: 'Grade 3', mode: 'build', topic: 'Multiplication facts' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier fact a simplify lever opened (`~smaller`), rebuilt from its parent.
    current: ctx => {
      const all = explorerItems(ctx.data as Lesson);
      const parent = practiceParent(ctx.itemId ?? undefined, all);
      return parent ? smallerFact(parent) ?? undefined : all.find(c => c.id === ctx.itemId);
    },
    // One number typed into "Your answer" and Check. Wrong is the mode's signature error from `multiplicationMiss`: the
    // two factors added when the product is asked (one more when that is the product), the product typed back when a
    // factor is asked.
    play: (right, c) => {
      const f = resolveChallengeFact(c, NO_FACT);
      const wrong = askedSlot(c) !== 'product' ? f.product
        : f.factor1 + f.factor2 !== f.product ? f.factor1 + f.factor2 : f.product + 1;
      return [{ type: 'write', label: 'Your answer', text: String(right ? expectedAnswer(c, f) : wrong) }, { type: 'check' }];
    },
  },
});
