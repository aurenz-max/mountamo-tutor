/**
 * addition-fact-strategies' boss, on the spoken preset (`components/live-activity/boss.ts`): every fact is a total the
 * learner says (the tutor judges the words against the key) or taps on the pad (the activity checks the tap), a
 * SAY_OR_SHOW card. The card is `additionFactStrategies.card.ts`; this file holds the content check, the items, the ask
 * and key, the levers and the harness play.
 */
import type { AdditionFactChallenge, AdditionFactStrategiesData } from './AdditionFactStrategies';
import { spokenBoss } from '../../../components/live-activity/boss';
import { additionFactStrategiesCard, type AdditionFactMiss } from './additionFactStrategies.card';
import { ADDITION_FACT_LEVERS, smallerFact } from './additionFactStrategiesLevers';
import {
  additionFactAsk, additionFactHarnessWords, additionFactKey, additionFactMode, additionFactSpokenMisses, factText,
} from './additionFactStrategiesWorkspace';

const digit = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 9;

/**
 * Reject a session the pad cannot answer: single-digit addends, a sum that matches them, and every fact of the
 * session's one family (contract R1), with no repeated id.
 */
export function validateAdditionFactStrategiesData(value: unknown): AdditionFactStrategiesData {
  const d = value as AdditionFactStrategiesData;
  if (!d || typeof d.title !== 'string' || !d.title.trim() || typeof d.strategy !== 'string'
      || !Array.isArray(d.challenges) || !d.challenges.length)
    throw new Error('Generated addition fact strategies has invalid lesson content.');
  if (new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || c.type !== d.strategy
        || !digit(c.a) || !digit(c.b) || c.sum !== c.a + c.b))
    throw new Error('An addition fact cannot be checked.');
  return d;
}

export const additionFactStrategiesBoss = spokenBoss<AdditionFactStrategiesData, AdditionFactChallenge, AdditionFactMiss>({
  card: additionFactStrategiesCard,
  validate: validateAdditionFactStrategiesData,
  items: data => data.challenges,
  levers: ADDITION_FACT_LEVERS,
  speech: {
    ask: additionFactAsk,
    key: additionFactKey,
    // The ask says the fact ("What is 6 + 0?"), and an addend can be the total.
    given: c => [factText(c)],
    misses: additionFactSpokenMisses,
    say: additionFactHarnessWords,
    modeOf: c => additionFactMode(c.type),
  },
  drive: {
    component: 'primitives/visual-primitives/math/AdditionFactStrategies.tsx',
    instanceId: 'fact-strategies',
    defaults: { grade: 'Grade 1', mode: 'doubles', topic: 'Doubles facts' },
    mounted: '[data-pip-object="workspace"]',
    // The session fact, or the smaller fact a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as AdditionFactStrategiesData;
      const all = data.challenges ?? [];
      const parent = ctx.itemId?.endsWith('~simpler') ? all.find(c => `${c.id}~simpler` === ctx.itemId) : null;
      return parent ? smallerFact(data.strategy, parent, all) ?? undefined : all.find(c => c.id === ctx.itemId);
    },
  },
});
