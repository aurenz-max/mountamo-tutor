/**
 * flight-forces-explorer's boss, on the spoken preset (`components/live-activity/boss.ts`): a predict or observe item
 * is a choice per asked row the learner says (the tutor judges the words against the key) or taps and checks (the
 * activity judges the tap), a SAY_OR_SHOW mode; an adjust item has no key, the learner sets the thrust and the nose
 * angle and flies them, the activity checks the flight, and it plays through `show`. The card is
 * `flightForcesExplorer.card.ts`; this file holds the content check, the items, the ask and key, the levers and the
 * harness play.
 */
import type { FlightForcesExplorerData } from './FlightForcesExplorer';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { flightForcesExplorerCard } from './flightForcesExplorer.card';
import { FLIGHT_LEVERS, practiceParent, simplerItem } from './flightForcesLevers';
import {
  askOf, flightGiven, flightHarnessAnswers, flightItems, flightKey, flightSaid, flightSpokenMisses, pressesTo,
  resolveFlightModes, validFlightItem, type FlightItem, type FlightMiss,
} from './flightForcesWorkspace';

/**
 * Reject a lab a mode cannot be asked on: no title, a stored item code could not have built (every key is computed
 * from the item's force sizes, change or goal, so nothing else is trusted), or a requested mode with no item.
 */
export function validateFlightForcesData(value: unknown): FlightForcesExplorerData {
  const d = value as FlightForcesExplorerData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated flight lab has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validFlightItem(i))) throw new Error('A generated flight item is not one code can key.');
  const items = flightItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated flight items repeat an id.');
  for (const mode of resolveFlightModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The flight-forces ${mode} mode has no item.`);
  }
  return d;
}

/** The journey's spoken answers: the key's own words, or the work that shows the mode's first-listed miss. */
const say = (item: FlightItem) => {
  if (item.mode === 'adjust') return { correct: '', plainWrong: '' };
  const { correct, plainWrong } = flightHarnessAnswers(item);
  return { correct: flightKey(item)!.answer, plainWrong: flightSaid(item, plainWrong) };
};

export const flightForcesExplorerBoss = spokenBoss<FlightForcesExplorerData, FlightItem, FlightMiss>({
  card: flightForcesExplorerCard,
  validate: validateFlightForcesData,
  items: flightItems,
  levers: FLIGHT_LEVERS,
  speech: {
    ask: askOf,
    // An adjust item has no key: the activity checks the flight.
    key: flightKey,
    given: flightGiven,
    misses: item => (item.mode === 'adjust' ? [] : flightSpokenMisses(item)),
    say,
    modeOf: item => item.mode,
    // An adjust flight through its real controls: the thrust and nose presses from the start setting (Try again
    // resets the controls to it), then Fly and check. A wrong flight shows the mode's first-listed miss it can.
    show: (right, item) => {
      if (item.mode !== 'adjust') throw new Error(`flight-forces-explorer: ${item.mode} item ${item.id} is spoken, not shown`);
      const answers = flightHarnessAnswers(item);
      const to = (right ? answers.correct : answers.plainWrong).setting;
      return [...pressesTo(item.start, to).map((label): DriverInput => ({ type: 'choose', label })), { type: 'check' }];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/engineering/FlightForcesExplorer.tsx',
    instanceId: 'flight-forces-explorer',
    defaults: { grade: 'Grade 4', mode: 'predict', topic: 'The four forces of flight: lift, weight, thrust and drag' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the simpler practice item (`~simpler`) rebuilt from its parent with the same builder.
    current: ctx => {
      const items = flightItems(ctx.data as FlightForcesExplorerData);
      const parent = practiceParent(ctx.itemId ?? '');
      const full = items.find(i => i.id === (parent ?? ctx.itemId));
      return parent && full ? simplerItem(full) ?? undefined : full;
    },
  },
});
