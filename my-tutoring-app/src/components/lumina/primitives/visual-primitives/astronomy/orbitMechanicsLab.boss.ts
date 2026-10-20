/**
 * orbit-mechanics-lab's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one closed choice
 * the learner says (the tutor judges the words against the key) or taps and checks (the activity judges the tap), a
 * SAY_OR_SHOW card. The card is `orbitMechanicsLab.card.ts`; this file holds the content check, the items, the ask and
 * key, the levers and the harness play.
 */
import type { OrbitMechanicsLabData } from './OrbitMechanicsLab';
import { spokenBoss } from '../../../components/live-activity/boss';
import { orbitMechanicsLabCard } from './orbitMechanicsLab.card';
import { ORBIT_LEVERS } from './orbitLevers';
import {
  askGiven, askOf, optionLabel, orbitHarnessAnswers, orbitItems, orbitKey, orbitSpokenMisses, resolveOrbitModes,
  validOrbitItem, workOption, type OrbitItem, type OrbitMiss,
} from './orbitWorkspace';

/**
 * Reject a session a mode cannot be asked on: no title, a stored item code could not have built (every key is computed
 * from the item's pushes, tracks or burn by the physics, so nothing else is trusted), or a requested mode with no item.
 */
export function validateOrbitMechanicsLabData(value: unknown): OrbitMechanicsLabData {
  const d = value as OrbitMechanicsLabData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated orbit lab has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validOrbitItem(i))) throw new Error('A generated orbit item is not one code can key.');
  const items = orbitItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated orbit items repeat an id.');
  for (const mode of resolveOrbitModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The orbit-mechanics-lab ${mode} mode has no item.`);
  }
  return d;
}

/** The journey's spoken answers: the key's label, or the choice that shows the mode's first-listed miss. */
const harnessWords = (item: OrbitItem) => {
  const { correct, plainWrong } = orbitHarnessAnswers(item);
  return { correct: optionLabel(item, workOption(item, correct)), plainWrong: optionLabel(item, workOption(item, plainWrong)) };
};

export const orbitMechanicsLabBoss = spokenBoss<OrbitMechanicsLabData, OrbitItem, OrbitMiss>({
  card: orbitMechanicsLabCard,
  validate: validateOrbitMechanicsLabData,
  items: orbitItems,
  levers: ORBIT_LEVERS,
  speech: {
    ask: askOf,
    key: orbitKey,
    given: askGiven,
    misses: orbitSpokenMisses,
    say: harnessWords,
    modeOf: item => item.mode,
  },
  drive: {
    component: 'primitives/visual-primitives/astronomy/OrbitMechanicsLab.tsx',
    instanceId: 'orbit-mechanics-lab',
    defaults: { grade: 'Grade 4', mode: 'pick_speed', topic: 'How a rocket stays in orbit around Earth' },
    mounted: '[data-pip-object="workspace"]',
  },
});
