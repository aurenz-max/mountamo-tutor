/**
 * word-workout's boss, on the spoken preset (`components/live-activity/boss.ts`): every read or answer is spoken and
 * the tutor judges it against the key; a picture_match item has no key (the activity checks the tap, and the tutor is
 * never told the word), so it plays through `show`. The card is `wordWorkout.card.ts`; this file holds the content
 * check, the items, the ask and key, the levers and the harness play.
 */
import type { WordWorkoutData } from './WordWorkout';
import { spokenBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import { wordWorkoutCard, type SpokenWordWorkoutMiss, type WordWorkoutMiss } from './wordWorkout.card';
import { lessonVowels, practiceFor, WORD_WORKOUT_LEVERS } from './wordWorkoutLevers';
import {
  askFor, challengeAskable, itemsFromChallenges, wordWorkoutGiven, wordWorkoutHarnessAnswers, wordWorkoutKey,
  wordWorkoutSpokenMisses, type WordWorkoutItem,
} from './wordWorkoutDomain';

/** The session's items, built through the family's own gates (an unaskable challenge is dropped). */
export const wordWorkoutItems = (data: Pick<WordWorkoutData, 'challenges'>): WordWorkoutItem[] =>
  itemsFromChallenges(data.challenges ?? []);

/** Reject a challenge the build would drop: a pair that is not ear-separable, a chain step that is not one letter,
 *  a sentence outside the read-aloud window, a word outside the code-owned pools. */
export const validateWordWorkoutData = (value: unknown) => validateChallengePool<WordWorkoutData>(value,
  c => !!c && challengeAskable(c),
  { pool: 'Generated word workout has invalid lesson content.', item: 'A word workout challenge cannot be asked.' });

export const wordWorkoutBoss = spokenBoss<WordWorkoutData, WordWorkoutItem, WordWorkoutMiss | SpokenWordWorkoutMiss>({
  card: wordWorkoutCard,
  validate: validateWordWorkoutData,
  items: wordWorkoutItems,
  levers: WORD_WORKOUT_LEVERS,
  speech: {
    ask: askFor,
    // A picture tap has no key: the activity checks it.
    key: wordWorkoutKey,
    given: wordWorkoutGiven,
    misses: wordWorkoutSpokenMisses,
    say: wordWorkoutHarnessAnswers,
    // Picture match taps a picture by its word: the right one, or another one.
    show: (right, item) => {
      const tapped = wordWorkoutHarnessAnswers(item).tapped;
      if (!tapped) throw new Error(`word-workout ${item.kind}: a spoken item is said, not shown`);
      return [{ type: 'touch', target: `picture-${right ? tapped.correct : tapped.wrong}` }];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/WordWorkout.tsx',
    instanceId: 'workout',
    defaults: { grade: 'Grade 1', mode: 'real_vs_nonsense',
      topic: 'Reading short-vowel CVC words and telling real words from silly ones' },
    mounted: '[aria-label="Hear the question again"]',
    // The session item, or a practice item (`~simpler`) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as WordWorkoutData;
      const items = wordWorkoutItems(data);
      const found = items.find(i => i.id === ctx.itemId);
      if (found) return found;
      const parent = items.find(i => `${i.id}~simpler` === ctx.itemId);
      if (!parent) return undefined;
      const vowels = lessonVowels(data.masteredVowels, items);
      return practiceFor(parent, { items, vowels }) ?? undefined;
    },
  },
});
