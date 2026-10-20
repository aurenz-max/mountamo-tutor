/**
 * transport-challenge's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one vehicle the
 * learner says (the tutor judges the words against the key) or taps and checks (the activity judges the tap), a
 * SAY_OR_SHOW card. The card is `transportChallenge.card.ts`; this file holds the content check, the items, the ask and
 * key, the levers and the harness play.
 */
import type { TransportChallengeData } from './TransportChallenge';
import { spokenBoss } from '../../../components/live-activity/boss';
import { transportChallengeCard } from './transportChallenge.card';
import { practiceParent, simplerItem, TRANSPORT_LEVERS } from './transportLevers';
import {
  askOf, resolveTransportModes, transportGiven, transportHarnessAnswers, transportItems, transportKey, transportSpokenMisses,
  validTransportItem, type TransportItem, type TransportMiss,
} from './transportWorkspace';

/**
 * Reject a challenge a mode cannot be asked on: no title, a stored item code could not have built (every key is
 * computed from the item's load, vehicles and limits, so nothing else is trusted), or a requested mode with no item.
 */
export function validateTransportData(value: unknown): TransportChallengeData {
  const d = value as TransportChallengeData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated transport challenge has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validTransportItem(i))) throw new Error('A generated transport job is not one code can key.');
  const items = transportItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated transport jobs repeat an id.');
  for (const mode of resolveTransportModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The transport-challenge ${mode} mode has no job.`);
  }
  return d;
}

export const transportChallengeBoss = spokenBoss<TransportChallengeData, TransportItem, TransportMiss>({
  card: transportChallengeCard,
  validate: validateTransportData,
  items: transportItems,
  levers: TRANSPORT_LEVERS,
  speech: {
    ask: askOf,
    key: transportKey,
    given: transportGiven,
    misses: transportSpokenMisses,
    say: transportHarnessAnswers,
    modeOf: item => item.mode,
  },
  drive: {
    component: 'primitives/visual-primitives/engineering/TransportChallenge.tsx',
    instanceId: 'transport-challenge',
    defaults: { grade: 'Grade 4', mode: 'single_constraint', topic: 'Choosing vehicles for a transport job under a budget, time and CO2 limits' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the smaller practice job (`~simpler`) rebuilt from its parent with the same builder.
    current: ctx => {
      const items = transportItems(ctx.data as TransportChallengeData);
      const parent = practiceParent(ctx.itemId ?? '');
      const full = items.find(i => i.id === (parent ?? ctx.itemId));
      return parent && full ? simplerItem(full) ?? undefined : full;
    },
  },
});
