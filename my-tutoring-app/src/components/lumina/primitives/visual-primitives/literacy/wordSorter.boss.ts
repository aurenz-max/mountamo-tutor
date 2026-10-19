/**
 * Word sorter's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one spoken answer the
 * tutor judges against its key. The card is `wordSorter.card.ts`; this file holds the content check, the items, the
 * ask and key, the levers and the harness play.
 */
import type { WordSorterData } from './WordSorter';
import { spokenBoss } from '../../../components/live-activity/boss';
import { wordSorterCard, type SpokenWordSorterMiss } from './wordSorter.card';
import { WORD_SORTER_LEVERS } from './wordSorterLevers';
import {
  askFor, itemsFromChallenge, itemsFromChallenges, wordSorterHarnessAnswers, wordSorterKey, wordSorterSpokenMisses,
  type WordSorterItem,
} from './wordSorterDomain';

const buildOptions = (d: WordSorterData) => ({ tier: d.supportTier, isPreReader: (d.gradeLevel ?? 'K') === 'K' });

/** The session's items, built from the generated challenges (unaskable ones dropped). */
export const wordSorterItems = (d: WordSorterData): WordSorterItem[] => itemsFromChallenges(d.challenges ?? [], buildOptions(d));

/** Reject a challenge the build would drop entirely: labels a child cannot say back, a word with no defensible group. */
export function validateWordSorterData(value: unknown): WordSorterData {
  const d = value as WordSorterData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length)
    throw new Error('Generated word sorter has invalid lesson content.');
  if (d.challenges.some(c => !c || itemsFromChallenge(c, buildOptions(d)).length === 0))
    throw new Error('A word sorter challenge cannot be asked.');
  return d;
}

export const wordSorterBoss = spokenBoss<WordSorterData, WordSorterItem, SpokenWordSorterMiss>({
  card: wordSorterCard,
  validate: validateWordSorterData,
  items: wordSorterItems,
  levers: WORD_SORTER_LEVERS,
  speech: {
    ask: askFor,
    key: wordSorterKey,
    misses: wordSorterSpokenMisses,
    say: wordSorterHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/WordSorter.tsx',
    instanceId: 'sorter',
    defaults: { grade: 'Kindergarten', mode: 'binary_sort', topic: 'Sorting animals and foods' },
    mounted: '[data-pip-object="word"]',
  },
});
