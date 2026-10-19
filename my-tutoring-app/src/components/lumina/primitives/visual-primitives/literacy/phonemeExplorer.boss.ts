/**
 * Phoneme explorer's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one spoken answer
 * the tutor judges against its key. The card is `phonemeExplorer.card.ts`; this file holds the content check, the
 * items, the ask and key, the levers and the harness play.
 */
import type { PhonemeExplorerData } from './PhonemeExplorer';
import { spokenBoss } from '../../../components/live-activity/boss';
import { phonemeExplorerCard, type PhonemeMiss } from './phonemeExplorer.card';
import { PHONEME_LEVERS, practiceItemFor } from './phonemeExplorerLevers';
import {
  askFor, itemFromChallenge, itemsFromChallenges, phonemeExplorerHarnessAnswers, phonemeKey, phonemeSpokenMisses,
  type PhonemeChallengeLike, type PhonemeExplorerItem,
} from './phonemeExplorerDomain';

/** The session's items, built from the generated challenges (unaskable ones dropped). */
export const phonemeExplorerItems = (d: PhonemeExplorerData): PhonemeExplorerItem[] =>
  itemsFromChallenges(d.challenges as PhonemeChallengeLike[]);

/** Reject an item the domain would drop: an unsayable blend walk, the answer inside the operation prose, an example
 *  word sitting in the menu. */
export function validatePhonemeExplorerData(value: unknown): PhonemeExplorerData {
  const d = value as PhonemeExplorerData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length)
    throw new Error('Generated phoneme explorer has invalid lesson content.');
  if (d.challenges.some(c => !c || itemFromChallenge(c as PhonemeChallengeLike) === null))
    throw new Error('A phoneme explorer item cannot be asked.');
  return d;
}

export const phonemeExplorerBoss = spokenBoss<PhonemeExplorerData, PhonemeExplorerItem, PhonemeMiss>({
  card: phonemeExplorerCard,
  validate: validatePhonemeExplorerData,
  items: phonemeExplorerItems,
  levers: PHONEME_LEVERS,
  speech: {
    ask: askFor,
    key: phonemeKey,
    misses: phonemeSpokenMisses,
    say: phonemeExplorerHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/PhonemeExplorer.tsx',
    instanceId: 'phonemes',
    defaults: { grade: 'Kindergarten', mode: 'isolate', topic: 'Hearing the first sound in short picture words' },
    mounted: '[data-pip-object="stimulus"], [data-pip-object="sounds"]',
    // The session item, or an easier item (`~simpler`, phonemeExplorerLevers.ts) rebuilt from its parent.
    current: ctx => {
      const items = phonemeExplorerItems(ctx.data as PhonemeExplorerData);
      const found = items.find(i => i.id === ctx.itemId);
      if (found) return found;
      const parent = items.find(i => `${i.id}~simpler` === ctx.itemId);
      return parent ? practiceItemFor(parent, items) ?? undefined : undefined;
    },
  },
});
