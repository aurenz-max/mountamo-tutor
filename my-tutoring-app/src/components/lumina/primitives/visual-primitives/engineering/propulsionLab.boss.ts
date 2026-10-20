/**
 * propulsion-lab's boss, on the spoken preset (`components/live-activity/boss.ts`): a predict or observe item is a
 * choice the learner says (the tutor judges the words against the key) or taps and checks (the activity judges the
 * tap), a SAY_OR_SHOW mode; an experiment item has no key, the learner sets Test A and Test B and runs them, the
 * activity checks the fair test, and it plays through `show`. The card is `propulsionLab.card.ts`; this file holds the
 * content check, the items, the ask and key, the levers and the harness play.
 */
import type { PropulsionLabData } from './PropulsionLab';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { propulsionLabCard } from './propulsionLab.card';
import { practiceParent, PROPULSION_LEVERS, simplerItem } from './propulsionLevers';
import {
  askOf, pressesTo, propulsionHarnessAnswers, propulsionItems, propulsionKey, propulsionSaid, propulsionSpokenMisses,
  resolvePropulsionModes, validPropulsionItem, type PropulsionItem, type PropulsionMiss,
} from './propulsionWorkspace';

/**
 * Reject a lab a mode cannot be asked on: no title, a stored item code could not have built (every key is computed
 * from the item's engines, place or question, so nothing else is trusted), or a requested mode with no item.
 */
export function validatePropulsionLabData(value: unknown): PropulsionLabData {
  const d = value as PropulsionLabData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated propulsion lab has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validPropulsionItem(i))) throw new Error('A generated propulsion item is not one code can key.');
  const items = propulsionItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated propulsion items repeat an id.');
  for (const mode of resolvePropulsionModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The propulsion-lab ${mode} mode has no item.`);
  }
  return d;
}

/** The journey's spoken answers: the key's own words, or the choice that shows the mode's first-listed miss it can. */
const say = (item: PropulsionItem) => {
  if (item.mode === 'experiment') return { correct: '', plainWrong: '' };
  return { correct: propulsionKey(item)!.answer, plainWrong: propulsionSaid(propulsionHarnessAnswers(item).plainWrong) };
};

export const propulsionLabBoss = spokenBoss<PropulsionLabData, PropulsionItem, PropulsionMiss>({
  card: propulsionLabCard,
  validate: validatePropulsionLabData,
  items: propulsionItems,
  levers: PROPULSION_LEVERS,
  speech: {
    ask: askOf,
    // An experiment item has no key: the activity checks the two tests.
    key: propulsionKey,
    misses: item => (item.mode === 'experiment' ? [] : propulsionSpokenMisses(item)),
    say,
    modeOf: item => item.mode,
    // An experiment through its real controls: the test buttons ("Test B: Space") pressed from the start setups (Try
    // again resets the tests to them), then Run and check. A wrong run shows one change too many.
    show: (right, item) => {
      if (item.mode !== 'experiment') throw new Error(`propulsion-lab: ${item.mode} item ${item.id} is spoken, not shown`);
      const answers = propulsionHarnessAnswers(item);
      const work = right ? answers.correct : answers.plainWrong;
      return [...pressesTo(item.start, { a: work.a, b: work.b }).map((label): DriverInput => ({ type: 'choose', label })), { type: 'check' }];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/engineering/PropulsionLab.tsx',
    instanceId: 'propulsion-lab',
    defaults: { grade: 'Grade 4', mode: 'predict', topic: "Newton's third law: how engines push a craft forward" },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the simpler practice item (`~simpler`) rebuilt from its parent with the same builder.
    current: ctx => {
      const items = propulsionItems(ctx.data as PropulsionLabData);
      const parent = practiceParent(ctx.itemId ?? '');
      const full = items.find(i => i.id === (parent ?? ctx.itemId));
      return parent && full ? simplerItem(full) ?? undefined : full;
    },
  },
});
