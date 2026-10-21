/**
 * spelling-pattern-explorer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `spellingPatternExplorer.boss.ts`.
 * The five classic modes: look at the pattern words, write the rule (not checked), then spell one dictation word at a
 * time: the tutor says the word, the learner types it and presses Check spelling, and the activity checks the spelling.
 * `pattern_build` is the shared letter build (`LetterBuildSurface.tsx`, the `pattern` ask in `spellingPatternBuild.ts`):
 * code checks the pattern, its place and its sound, then the shared word judge checks the word is real.
 */
import type { LetterBuildMiss } from './letterBuild';
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a checked wrong spelling shows (`spellingMiss`): the word's pattern spelled wrong (`pattern_missing`), the
 * pattern right and other letters wrong (`other_letters`), or, when the pattern names no letters to look for,
 * `misspelled`.
 */
export const SPELLING_MISSES = ['pattern_missing', 'other_letters', 'misspelled'] as const;
export type SpellingMiss = typeof SPELLING_MISSES[number];

/** The open build's own checks (`patternMiss`), then the word judge's not_a_word. */
export const PATTERN_BUILD_MISSES = ['other_spelling', 'wrong_place', 'no_pattern', 'not_the_sound', 'same_word', 'pick_another',
  'not_a_word'] as const satisfies readonly LetterBuildMiss[];
export type PatternBuildMiss = typeof PATTERN_BUILD_MISSES[number];

export type SpellingPatternMiss = SpellingMiss | PatternBuildMiss;

const DICTATION = { answer: 'type', judge: 'activity', flow: 'one-at-a-time',
  moves: 'first taps "I see the pattern!", writes the spelling rule in their own words (not checked) and taps "Next: '
    + 'Apply the Rule"; then, for each word, types it in the spelling box and presses Check spelling',
  misses: SPELLING_MISSES } as const;

export const spellingPatternExplorerCard = defineCard<SpellingPatternMiss>({
  id: 'spelling-pattern-explorer',
  grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  modes: {
    short_vowel: DICTATION,
    long_vowel: DICTATION,
    r_controlled: DICTATION,
    silent_letter: DICTATION,
    morphological: DICTATION,
    // `same_word` and `pick_another` have no lever: the word already made stays on screen, and another word is the
    // whole fix.
    pattern_build: { answer: 'build', judge: 'activity', flow: 'one-at-a-time',
      moves: 'taps letters from the bank into the boxes from the left, taps a box to empty it or Start over, and presses '
        + '"I\'m done!"; some items ask for a second, different word',
      misses: PATTERN_BUILD_MISSES, unanswered: ['same_word', 'pick_another'] },
  },
  words: {
    job: 'find the spelling pattern a group of words shares, then spell words that use it: type a word the tutor says, '
      + 'or make any real word with the spelling the ask names',
    answer: 'the spelling they type, or the word they make',
    question: 'the word to spell (say it, never its letters), the pattern words, the ask and the letters in the bank',
  },
  levers: true,
});
