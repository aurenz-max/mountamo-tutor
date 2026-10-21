/**
 * spelling-pattern-explorer's items and scene (the boss: `spellingPatternExplorer.card.ts` +
 * `spellingPatternExplorer.boss.ts`). The five classic modes: look at the pattern words, write the rule in your own
 * words (not checked), then spell each dictation word. Each dictation word is one item: the tutor says the word, the
 * learner types it and presses Check spelling, and the spelling is checked in code, so it never reaches the tutor as a
 * key. The open build (`pattern_build`) runs on the shared letter build surface (`letterBuild.ts`).
 *
 * Pure: the component, the boss and the journey read the same items and scene.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import { letterAssignment, letterItemsFrom, type LetterBuildItem } from './letterBuild';
import type { SpellingMiss } from './spellingPatternExplorer.card';

export { SPELLING_MISSES, type SpellingMiss } from './spellingPatternExplorer.card';

export type ClassicMode = 'short_vowel' | 'long_vowel' | 'r_controlled' | 'silent_letter' | 'morphological';
type SupportTier = 'easy' | 'medium' | 'hard';

export interface DictationItem { id: string; word: string; hint?: string }
/** A dictation word in its eval mode. */
export type SpellingWord = DictationItem & { mode: ClassicMode };
/** A pattern_build ask, stamped with its mode and the lesson's tier (the model lever's timing reads it). */
export type PatternBuild = LetterBuildItem & { mode: 'pattern_build'; supportTier: SupportTier };
export type SpellingItem = SpellingWord | PatternBuild;

export const isPatternBuild = (item: SpellingItem): item is PatternBuild => item.mode === 'pattern_build';

export type SpellingPhase = 'observe' | 'rule' | 'apply' | 'review';

/** What the boss reads from a lesson. */
export interface SpellingLesson {
  title: string;
  patternType?: string;
  patternWords?: string[];
  highlightPattern?: string;
  dictationWords?: string[];
  dictationHints?: string[];
  supportTier?: SupportTier;
  task?: 'letter_build';
  buildItems?: LetterBuildItem[];
}

const MODE_OF_PATTERN: Record<string, ClassicMode> = {
  'short-vowel': 'short_vowel', 'long-vowel': 'long_vowel', 'r-controlled': 'r_controlled', 'silent-letter': 'silent_letter',
  'suffix-change': 'morphological', 'latin-root': 'morphological',
};
export const classicModeOf = (patternType: string | undefined): ClassicMode => MODE_OF_PATTERN[patternType ?? ''] ?? 'short_vowel';

export function dictationItems(words: readonly string[] | undefined, hints?: readonly string[]): DictationItem[] {
  return (words ?? []).map((w, i) => ({ id: `w${i + 1}`, word: String(w ?? '').trim(), ...(hints?.[i] ? { hint: hints[i] } : {}) }))
    .filter(d => /^[a-z][a-z' -]*$/i.test(d.word));
}

export const spellingWords = (d: SpellingLesson): SpellingWord[] =>
  dictationItems(d.dictationWords, d.dictationHints).map(i => ({ ...i, mode: classicModeOf(d.patternType) }));

export const asPatternBuild = (item: LetterBuildItem, supportTier: SupportTier | undefined): PatternBuild =>
  ({ ...item, mode: 'pattern_build', supportTier: supportTier ?? 'medium' });

export const patternBuilds = (d: SpellingLesson): PatternBuild[] =>
  letterItemsFrom(d.buildItems ?? [], d.supportTier).map(i => asPatternBuild(i, d.supportTier));

/** The graded items of one lesson: the build's asks, or the dictation words. */
export const spellingItems = (d: SpellingLesson): SpellingItem[] => (d.task === 'letter_build' ? patternBuilds(d) : spellingWords(d));

/** The task names the word to dictate: the tutor says it. The spelling is the answer and is checked in code. */
export const spellingAsk = (item: SpellingItem): string => (isPatternBuild(item) ? letterAssignment(item).task
  : `Listen to the word "${item.word}" and type how it is spelled, using the spelling pattern.`);

export const spellingMatches = (item: DictationItem, typed: string) => typed.trim().toLowerCase() === item.word.toLowerCase();

/**
 * The pattern as letters to look for in a word: "-ight" -> /ight/, "a_e" -> /a[a-z]e/, "ar/or" -> /ar|or/. Null when it
 * names no letters ("silent-e").
 */
export function patternRegex(highlightPattern: string): RegExp | null {
  const keys = highlightPattern.toLowerCase().split(/[/,]| or | and /).map(k => k.replace(/[^a-z_]/g, ''))
    .filter(k => k && k.length <= 6 && !/^silent|^vowel|^long|^short/.test(k));
  return keys.length ? new RegExp(keys.map(k => k.split('_').join('[a-z]')).join('|')) : null;
}

export function spellingMiss(item: DictationItem, typed: string, highlightPattern: string): SpellingMiss | undefined {
  if (spellingMatches(item, typed)) return undefined;
  const re = patternRegex(highlightPattern);
  if (!re || !re.test(item.word.toLowerCase())) return 'misspelled';
  return re.test(typed.trim().toLowerCase()) ? 'other_letters' : 'pattern_missing';
}

export function spellingMissWords(miss: SpellingMiss | undefined): string {
  switch (miss) {
    case 'pattern_missing': return 'Look at how the pattern is spelled in this word. Try again.';
    case 'other_letters': return 'The pattern is right. Check the other letters.';
    default: return 'Not quite. Listen to the word again and try.';
  }
}

export const describeTyped = (typed: string) => (typed.trim() ? `Typed "${typed.trim()}"` : 'Typed nothing');

export interface SpellingView {
  phase: SpellingPhase;
  typed: string;
  patternWords: readonly string[];
  /** The pattern as the panel shows it, only while that panel is on screen. */
  patternShown?: string;
  ruleWritten: boolean;
  hintShown?: string;
}

/** What the tutor reads: the phase, what is on screen and the learner's typing. Never the spelling. */
export function spellingScene(view: SpellingView): SceneOf {
  return { objects: [], facts: {
    phase: view.phase,
    ...(view.phase === 'observe' ? { patternWordsOnScreen: view.patternWords.join(', ') } : {}),
    ...(view.patternShown ? { patternShown: view.patternShown } : {}),
    ...(view.phase === 'rule' ? { ruleWritten: view.ruleWritten ? 'yes' : 'not yet' } : {}),
    ...(view.phase === 'apply' ? { typed: view.typed || '(nothing yet)', lettersTyped: view.typed.trim().length,
      constraints: 'The screen does not show the word to spell: say it aloud for the learner.' } : {}),
    ...(view.hintShown ? { hintOnScreen: view.hintShown } : {}),
  } };
}

/** The journey's answers: the word, or the word with its pattern's letters (else its last letter) changed. */
export function spellingHarnessAnswers(item: DictationItem, highlightPattern: string): { correct: string; plainWrong: string } {
  const w = item.word.toLowerCase();
  const re = patternRegex(highlightPattern);
  const m = re ? w.match(re) : null;
  const wrong = m && m.index !== undefined
    ? w.slice(0, m.index) + m[0].split('').reverse().join('') + w.slice(m.index + m[0].length)
    : w.slice(0, -1) + (w.endsWith('z') ? 'q' : 'z');
  return { correct: w, plainWrong: wrong === w ? `${w}z` : wrong };
}
