/**
 * poetry-lab's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `poetryLab.boss.ts`.
 * Every item is checked by the activity's own code, and the item's kind names its step: `rhyme_hunt` (K-1, tap the
 * two word cards that rhyme), analysis's `mood`, `figurative` and `rhyme` steps (one per phase the poem supports), and
 * composition's `compose` (type every line; the check reads the form only).
 */
import { defineCard, TAP_ONE } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`poetryMiss`, `TeachingAttempt.miss`, handoff 20), from the work the check reads. Drawn
 * from the catalog's old commonStruggles (taps words that share a beginning sound) and the analysis phases:
 * - rhyme_hunt, first that applies: `same_start` (the two cards start with the same sound), `one_of_pair` (one card
 *   is in the rhyming pair), `neither_of_pair`;
 * - mood: `other_mood`; figurative: `literal_picked` (a word that is in no figurative phrase), `missed_some` (a
 *   phrase with no word tapped); rhyme: `aabb_abab` (couplets for alternate lines, or the reverse), `other_scheme`;
 * - composition: `line_missing`, `line_too_short` (under two words), `line_repeated`, `wrong_first_letter` (an
 *   acrostic line), `syllables_off` (a line more than one syllable from its target).
 */
export type RhymeHuntMiss = 'same_start' | 'one_of_pair' | 'neither_of_pair';
export type AnalysisMiss = 'other_mood' | 'literal_picked' | 'missed_some' | 'aabb_abab' | 'other_scheme';
export type CompositionMiss = 'line_missing' | 'line_too_short' | 'line_repeated' | 'wrong_first_letter' | 'syllables_off';
export type PoetryMiss = RhymeHuntMiss | AnalysisMiss | CompositionMiss;
export const RHYME_HUNT_MISSES: readonly RhymeHuntMiss[] = ['same_start', 'one_of_pair', 'neither_of_pair'];
export const ANALYSIS_MISSES: readonly AnalysisMiss[] = ['other_mood', 'literal_picked', 'missed_some', 'aabb_abab', 'other_scheme'];
export const COMPOSITION_MISSES: readonly CompositionMiss[] = ['line_missing', 'line_too_short', 'line_repeated', 'wrong_first_letter', 'syllables_off'];

export const poetryLabCard = defineCard<PoetryMiss>({
  id: 'poetry-lab',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  // Every step publishes levers (`poetryLabLevers.ts`); every miss is answered by a lever on its step.
  modes: {
    rhyme_hunt: { steps: { rhyme_hunt: { answer: 'tap', judge: 'activity', flow: 'one-at-a-time',
      moves: 'taps two word cards; the second tap commits the pair' } }, misses: RHYME_HUNT_MISSES },
    analysis: { steps: {
      mood: { ...TAP_ONE, moves: 'taps one printed mood, then presses Check' },
      figurative: { answer: 'tap', judge: 'activity', flow: 'board',
        moves: 'taps a word of each figurative phrase (every poem word is a button), then presses Check' },
      rhyme: { ...TAP_ONE, moves: 'taps one printed rhyme scheme, then presses Check' },
    }, misses: ANALYSIS_MISSES },
    composition: { steps: { compose: { answer: 'type', judge: 'activity', flow: 'one-at-a-time',
      moves: 'types each line of the poem in its box, then presses Check Poem' } }, misses: COMPOSITION_MISSES },
  },
  words: {
    job: 'find the two words that rhyme in a poem read aloud, a poem\'s mood, its figurative phrases and its rhyme '
      + 'scheme, or write a poem in a set form',
    answer: 'the learner\'s taps or typed lines',
    question: 'the poem, the word cards, the printed moods and rhyme schemes, and the writing prompt and its form',
  },
  levers: true,
});
