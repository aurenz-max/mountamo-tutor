/**
 * race-track-lab's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one closed choice the
 * learner says (the tutor judges the words against the key) or taps and checks (the activity judges the tap), a
 * SAY_OR_SHOW card. Observe and measure first need Run the race. The card is `raceTrackLab.card.ts`; this file holds
 * the content check, the items, the ask and key, the levers and the harness play.
 */
import type { RaceTrackLabData } from './RaceTrackLab';
import { spokenBoss } from '../../../components/live-activity/boss';
import { raceTrackLabCard } from './raceTrackLab.card';
import { practiceParent, RACE_LEVERS, simplerItem } from './raceTrackLevers';
import {
  askOf, needsRun, raceAskGiven, raceHarnessAnswers, raceItems, raceKey, raceSpokenMisses, resolveRaceModes, validRaceItem,
  type RaceItem, type RaceTrackMiss,
} from './raceTrackWorkspace';

/**
 * Reject a lab a mode cannot be asked on: no title, a stored item code could not have built (its key is computed from
 * the cars' speeds, starts and times, so nothing else is trusted), or a requested mode with no item.
 */
export function validateRaceTrackData(value: unknown): RaceTrackLabData {
  const d = value as RaceTrackLabData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated race track lab has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validRaceItem(i))) throw new Error('A generated race-track item is not one code can key.');
  const items = raceItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated race-track items repeat an id.');
  for (const mode of resolveRaceModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The race-track ${mode} mode has no item.`);
  }
  return d;
}

export const raceTrackLabBoss = spokenBoss<RaceTrackLabData, RaceItem, RaceTrackMiss>({
  card: raceTrackLabCard,
  validate: validateRaceTrackData,
  items: raceItems,
  levers: RACE_LEVERS,
  speech: {
    ask: askOf,
    key: raceKey,
    given: raceAskGiven,
    misses: raceSpokenMisses,
    say: raceHarnessAnswers,
    // Observe and measure: nothing to answer from until the learner runs the race.
    before: (item, ctx) => (needsRun(item) && ctx.demand?.presentation !== 'ready' ? [{ type: 'choose', label: 'Run the race' }] : []),
    modeOf: item => item.mode,
  },
  drive: {
    component: 'primitives/visual-primitives/physics/RaceTrackLab.tsx',
    instanceId: 'race-track-lab',
    defaults: { grade: 'Grade 3', mode: 'measure', topic: 'Speed, distance and time on a race track' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the simpler practice race (`~simpler`) rebuilt from its parent with the same builder.
    current: ctx => {
      const items = raceItems(ctx.data as RaceTrackLabData);
      const parent = practiceParent(ctx.itemId ?? '');
      const full = items.find(i => i.id === (parent ?? ctx.itemId));
      return parent && full ? simplerItem(full) ?? undefined : full;
    },
  },
});
