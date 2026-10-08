/**
 * spelling-pattern-explorer on the shared tutor/JEV teaching workspace, W1 minimal binding (plain shape). The five
 * classic modes keep their flow: look at the pattern words, write the rule in your own words (not checked), then spell
 * each dictation word. On the workspace each dictation word is one item: the tutor says the word, the learner types
 * it and presses Check, and the spelling is checked in code against the word, so the spelling never reaches the
 * tutor as a key. The open build (`pattern_build`) runs on the shared letter build surface (`letterBuild.ts`).
 *
 * Pure: the component, the adapter and the journey read the same items, assignment and scene.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';

export interface DictationItem { id: string; word: string; hint?: string }

export type SpellingPhase = 'observe' | 'rule' | 'apply' | 'review';

export function dictationItems(words: readonly string[] | undefined, hints?: readonly string[]): DictationItem[] {
  return (words ?? []).map((w, i) => ({ id: `w${i + 1}`, word: String(w ?? '').trim(), ...(hints?.[i] ? { hint: hints[i] } : {}) }))
    .filter(d => /^[a-z][a-z' -]*$/i.test(d.word));
}

/** The task names the word to dictate: the tutor says it. The spelling is the answer and is checked in code. */
export const dictationAssignment = (item: DictationItem): TeachingAssignment =>
  ({ id: item.id, task: `Listen to the word "${item.word}" and type how it is spelled, using the spelling pattern.`, response: 'gesture' });

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

/**
 * What a checked wrong spelling shows: the word's pattern spelled wrong (`pattern_missing`), the pattern right and other
 * letters wrong (`other_letters`), or, when the pattern names no letters to look for, `misspelled`.
 */
export type SpellingMiss = 'pattern_missing' | 'other_letters' | 'misspelled';
export const SPELLING_MISSES: readonly SpellingMiss[] = ['pattern_missing', 'other_letters', 'misspelled'];

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

export function spellingScene(item: DictationItem, view: SpellingView): WorkspaceScene {
  const before = view.phase === 'observe' || view.phase === 'rule';
  return { objects: [], facts: {
    phase: view.phase,
    ...(view.phase === 'observe' ? { patternWordsOnScreen: view.patternWords.join(', ') } : {}),
    ...(view.patternShown ? { patternShown: view.patternShown } : {}),
    ...(view.phase === 'rule' ? { ruleWritten: view.ruleWritten ? 'yes' : 'not yet' } : {}),
    ...(view.phase === 'apply' ? { typed: view.typed || '(nothing yet)', lettersTyped: view.typed.trim().length } : {}),
    ...(view.hintShown ? { hintOnScreen: view.hintShown } : {}),
    constraints: before
      ? 'First the learner looks at the pattern words and finds what they share, then writes the spelling rule in their '
        + 'own words (it is not checked). Spelling starts after that.'
      : 'Say the word for the learner to spell. The learner types it and presses Check; the activity checks the spelling '
        + 'itself. You cannot type for them.',
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
