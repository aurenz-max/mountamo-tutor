/**
 * states-of-matter's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one spoken answer
 * the tutor judges against its key. The card is `statesOfMatter.card.ts`; this file holds the content check, the
 * items, the ask and key, the levers and the harness play.
 */
import type { StatesOfMatterData } from './StatesOfMatter';
import { spokenBoss } from '../../../components/live-activity/boss';
import { statesOfMatterCard } from './statesOfMatter.card';
import { practiceItem, practiceParent, STATES_LEVERS, statesLeverSession } from './statesOfMatterLevers';
import {
  askFor, itemsFromChallenges, statesKey, statesOfMatterHarnessAnswers, statesSpokenMisses,
  type SpokenStatesMiss, type StatesOfMatterItem,
} from './statesOfMatterDomain';

/** The session's items, built exactly as the component builds them. */
export function statesItems(data: StatesOfMatterData): StatesOfMatterItem[] {
  return itemsFromChallenges(data.challenges ?? [], { band: data.gradeBand ?? '3-5', tier: data.supportTier ?? 'medium' });
}

/** Reject a lesson with nothing askable: the build gates drop an unknown substance, a temperature on a threshold, a
 *  confusable pair. A payload with no challenges is the ungraded particle sim, which the workspace does not run. */
export function validateStatesOfMatterData(value: unknown): StatesOfMatterData {
  const d = value as StatesOfMatterData;
  if (!d || !Array.isArray(d.challenges)) throw new Error('Generated states of matter has invalid lesson content.');
  if (!statesItems(d).length) throw new Error('No states of matter challenge can be asked.');
  return d;
}

export const statesOfMatterBoss = spokenBoss<StatesOfMatterData, StatesOfMatterItem, SpokenStatesMiss>({
  card: statesOfMatterCard,
  validate: validateStatesOfMatterData,
  items: statesItems,
  levers: STATES_LEVERS,
  speech: {
    ask: askFor,
    key: statesKey,
    misses: statesSpokenMisses,
    say: statesOfMatterHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/chemistry/StatesOfMatter.tsx',
    instanceId: 'states',
    defaults: { grade: 'Grade 2', mode: 'observe', topic: 'Heating and cooling change solids, liquids and gases' },
    mounted: '[data-pip-object="stimulus"]',
    // The session item, or a practice item (`~simpler`, statesOfMatterLevers.ts) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as StatesOfMatterData;
      const all = statesItems(data);
      const parent = ctx.itemId ? practiceParent(ctx.itemId, all) : null;
      return parent ? practiceItem(parent, statesLeverSession(all, data.gradeBand ?? '3-5')) ?? undefined
        : all.find(i => i.id === ctx.itemId);
    },
  },
});
