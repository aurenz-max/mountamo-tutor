/**
 * Decodable reader's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one spoken read or
 * answer the tutor judges against its key. The card is `decodableReader.card.ts`; this file holds the content check,
 * the items, the ask and key, the levers and the harness play.
 */
import type { DecodableReaderData } from './DecodableReader';
import { spokenBoss } from '../../../components/live-activity/boss';
import { decodableReaderCard, type DecodableMiss } from './decodableReader.card';
import { DECODABLE_LEVERS, simplerFor } from './decodableReaderLevers';
import {
  askFor, decodableGiven, decodableKey, decodableReaderHarnessAnswers, decodableSpokenMisses, itemsFromChallenges,
  type DecodableReaderItem,
} from './decodableReaderDomain';

/** The session's items, built from the story (unaskable lines and questions dropped). */
export const decodableReaderItems = (d: DecodableReaderData): DecodableReaderItem[] => itemsFromChallenges(d).items;

/** Reject a story the reader would not ask: no passage, or nothing left once the build gates drop lines outside the
 *  tier's word window and questions whose answer the story does not hold. */
export function validateDecodableReaderData(value: unknown): DecodableReaderData {
  const d = value as DecodableReaderData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.passage?.sentences) || !d.passage.sentences.length)
    throw new Error('Generated decodable reader has invalid lesson content.');
  if (!decodableReaderItems(d).length) throw new Error('A decodable reader story has nothing that can be asked.');
  return d;
}

export const decodableReaderBoss = spokenBoss<DecodableReaderData, DecodableReaderItem, DecodableMiss>({
  card: decodableReaderCard,
  validate: validateDecodableReaderData,
  items: decodableReaderItems,
  levers: DECODABLE_LEVERS,
  speech: {
    ask: askFor,
    key: decodableKey,
    given: decodableGiven,
    misses: decodableSpokenMisses,
    say: decodableReaderHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/DecodableReader.tsx',
    instanceId: 'decodable',
    defaults: { grade: 'Grade 1', mode: 'literal', topic: 'A short story with short-a words' },
    mounted: '[data-pip-object="line"], [data-pip-object="question"], [data-pip-object="story"]',
    // The session item, or a practice item (`~simpler`: short_line, short_story) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as DecodableReaderData, items = decodableReaderItems(data);
      const found = items.find(i => i.id === ctx.itemId);
      if (found) return found;
      const parent = items.find(i => `${i.id}~simpler` === ctx.itemId);
      return parent ? simplerFor(parent, data.passage?.sentences ?? [], items) ?? undefined : undefined;
    },
  },
});
