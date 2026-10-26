/**
 * number-sequencer's boss, on the spoken preset (`components/live-activity/boss.ts`): a spoken item is one number the
 * tutor judges against the key; an order_cards item has no key (the train checks the arrangement), so it plays through
 * `show`. The card is `numberSequencer.card.ts`; this file holds the content check, the items, the ask and key, the
 * levers and the harness play.
 */
import type { NumberSequencerData } from './NumberSequencer';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { numberSequencerCard, type NumberSequencerMiss } from './numberSequencer.card';
import { NUMBER_SEQUENCER_LEVERS, threeCards } from './numberSequencerLevers';
import { smallerNumbers } from './numberSequencerSpokenLevers';
import {
  askFor, buildSequencerItems, numberSequencerSpokenMisses, sequencerChallengeValid, sequencerGiven, sequencerHarnessAnswers,
  sequencerItems, sequencerKey, sequencerModeOf, type SequencerItem,
} from './numberSequencerDomain';

/** Reject a train whose challenges cannot be ASKED before it reaches a five-year-old. */
export function validateNumberSequencerData(value: unknown): NumberSequencerData {
  const d = value as NumberSequencerData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? '')
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated number sequencer has invalid lesson content.');
  // The same independent key check the component runs: a challenge the domain would silently drop must not reach a
  // mounted lesson.
  if (!d.challenges.every(sequencerChallengeValid) || !buildSequencerItems(d.challenges).items.length)
    throw new Error('A number-sequencer challenge cannot run in the lesson.');
  return d;
}

/** The cards in an order, as the harness taps them (each card is labelled with its number). */
const placeCards = (order: string): DriverInput[] => order.split(',').map(label => ({ type: 'choose', label }));

export const numberSequencerBoss = spokenBoss<NumberSequencerData, SequencerItem, NumberSequencerMiss>({
  card: numberSequencerCard,
  validate: validateNumberSequencerData,
  items: sequencerItems,
  levers: NUMBER_SEQUENCER_LEVERS,
  speech: {
    ask: askFor,
    // An arrangement has no key: the train checks it once the last card is placed.
    key: sequencerKey,
    given: sequencerGiven,
    misses: numberSequencerSpokenMisses,
    say: item => { const a = sequencerHarnessAnswers(item); return { correct: a.correct, plainWrong: a.plainWrong }; },
    show: (right, item) => { const a = sequencerHarnessAnswers(item); return placeCards(right ? a.correct : a.plainWrong); },
  },
  drive: {
    component: 'primitives/visual-primitives/math/NumberSequencer.tsx',
    instanceId: 'train',
    // `before_after` asks exactly ONE question per generated challenge, so the harness's two challenges are two items.
    defaults: { grade: 'Kindergarten', mode: 'before_after', topic: 'The number that comes just before or just after a given number' },
    mounted: '[data-testid^="train-car-"]',
    probes: { demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' } },
    leakTokens: ['NS_'],
    // The session item, or an easier train (`~simpler`) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as NumberSequencerData, items = sequencerItems(data);
      const found = items.find(i => i.id === ctx.itemId);
      if (found) return found;
      const parent = items.find(i => `${i.id}~simpler` === ctx.itemId);
      if (!parent) return undefined;
      return (sequencerModeOf(parent) === 'order_cards' ? threeCards(parent, data.gradeBand ?? 'K') : smallerNumbers(parent, items)) ?? undefined;
    },
  },
});
