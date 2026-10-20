/**
 * rocket-builder's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one closed choice the
 * learner says (the tutor judges the words against the key) or taps and checks (the activity judges the tap), a
 * SAY_OR_SHOW card. The card is `rocketBuilder.card.ts`; this file holds the content check, the items, the ask and
 * key, the levers and the harness play.
 */
import type { RocketBuilderData } from './RocketBuilder';
import { spokenBoss } from '../../../components/live-activity/boss';
import { rocketBuilderCard } from './rocketBuilder.card';
import { ROCKET_LEVERS } from './rocketLevers';
import {
  askOf, optionLabel, resolveRocketModes, rocketHarnessAnswers, rocketItems, rocketKey, rocketSpokenMisses, validRocketItem,
  type RocketItem, type RocketMiss,
} from './rocketWorkspace';

/**
 * Reject a session a mode cannot be asked on: no title, a stored item code could not have built (every key is computed
 * from the item's parts by the flight model, so nothing else is trusted), or a requested mode with no item.
 */
export function validateRocketBuilderData(value: unknown): RocketBuilderData {
  const d = value as RocketBuilderData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated rocket builder has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validRocketItem(i))) throw new Error('A generated rocket item is not one code can key.');
  const items = rocketItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated rocket items repeat an id.');
  for (const mode of resolveRocketModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The rocket-builder ${mode} mode has no item.`);
  }
  return d;
}

/** The journey's spoken answers: the key's label, or the choice that shows the mode's first-listed miss. */
const harnessWords = (item: RocketItem) => {
  const { correct, plainWrong } = rocketHarnessAnswers(item);
  return { correct: optionLabel(item, correct.pick!), plainWrong: optionLabel(item, plainWrong.pick!) };
};

export const rocketBuilderBoss = spokenBoss<RocketBuilderData, RocketItem, RocketMiss>({
  card: rocketBuilderCard,
  validate: validateRocketBuilderData,
  items: rocketItems,
  levers: ROCKET_LEVERS,
  speech: {
    ask: askOf,
    key: rocketKey,
    misses: rocketSpokenMisses,
    say: harnessWords,
    modeOf: item => item.mode,
  },
  drive: {
    component: 'primitives/visual-primitives/astronomy/RocketBuilder.tsx',
    instanceId: 'rocket-builder',
    defaults: { grade: 'Grade 4', mode: 'can_it_lift', topic: 'What a rocket needs to lift off' },
    mounted: '[data-pip-object="workspace"]',
  },
});
