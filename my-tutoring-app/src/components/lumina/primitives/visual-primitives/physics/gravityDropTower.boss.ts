/**
 * gravity-drop-tower's boss, on the spoken preset (`components/live-activity/boss.ts`): an observe, predict, measure or
 * calculate item is one closed choice the learner says (the tutor judges the words against the key) or taps and checks
 * (the activity judges the tap), SAY_OR_SHOW items; observe first needs a drop. A compare item has no key: the learner
 * taps the three objects in landing order and the activity checks the board, and it plays through `show`. The card is
 * `gravityDropTower.card.ts`; this file holds the content check, the items, the ask and key, the levers and the
 * harness play.
 */
import type { GravityDropTowerData } from './GravityDropTower';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { gravityDropTowerCard } from './gravityDropTower.card';
import { DROP_LEVERS, practiceParent, simplerItem } from './gravityDropLevers';
import {
  askOf, dropAskGiven, dropHarnessAnswers, dropItems, dropKey, dropSpokenMisses, resolveDropModes, validDropItem,
  type DropItem, type GravityDropMiss,
} from './gravityDropWorkspace';

/**
 * Reject a tower a mode cannot be asked on: no title, a stored item code could not have built (its key is computed
 * from the objects, the heights and the air, so nothing else is trusted), or a requested mode with no item.
 */
export function validateGravityDropData(value: unknown): GravityDropTowerData {
  const d = value as GravityDropTowerData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated gravity drop tower has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validDropItem(i))) throw new Error('A generated gravity-drop item is not one code can key.');
  const items = dropItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated gravity-drop items repeat an id.');
  for (const mode of resolveDropModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The gravity-drop ${mode} mode has no item.`);
  }
  return d;
}

/** The journey's spoken answers: the key choice's own words, or the mode's most telling wrong choice. */
const say = (item: DropItem) => {
  const answers = dropHarnessAnswers(item);
  return { correct: answers.correct[0] ?? '', plainWrong: answers.plainWrong[0] ?? '' };
};

export const gravityDropTowerBoss = spokenBoss<GravityDropTowerData, DropItem, GravityDropMiss>({
  card: gravityDropTowerCard,
  validate: validateGravityDropData,
  items: dropItems,
  levers: DROP_LEVERS,
  speech: {
    ask: askOf,
    // A compare order has no key: the activity checks the board.
    key: dropKey,
    given: dropAskGiven,
    misses: dropSpokenMisses,
    say,
    modeOf: item => item.mode,
    // Observe: nothing to answer from until the learner drops (the choices open after it).
    before: (item, ctx) => (item.mode === 'observe' && ctx.demand?.presentation !== 'ready' ? [{ type: 'choose', label: 'Drop' }] : []),
    // An order through its real controls: the objects (their aria-labels) in order, then Check Answer. A wrong order is
    // the mode's most telling miss the item can show.
    show: (right, item) => {
      const answers = dropHarnessAnswers(item);
      return [...(right ? answers.correct : answers.plainWrong).map((label): DriverInput => ({ type: 'choose', label })), { type: 'check' }];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/physics/GravityDropTower.tsx',
    instanceId: 'gravity-drop-tower',
    defaults: { grade: 'Grade 2', mode: 'predict', topic: 'Gravity: do heavy things fall faster?' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the simpler practice item (`~simpler`) rebuilt from its parent with the same builder.
    current: ctx => {
      const items = dropItems(ctx.data as GravityDropTowerData);
      const parent = practiceParent(ctx.itemId ?? '');
      const full = items.find(i => i.id === (parent ?? ctx.itemId));
      return parent && full ? simplerItem(full) ?? undefined : full;
    },
  },
});
