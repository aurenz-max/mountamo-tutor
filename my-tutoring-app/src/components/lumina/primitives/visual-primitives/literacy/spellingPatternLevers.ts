/**
 * The in-item levers on a classic spelling-pattern-explorer dictation word (`/add-support-tiers`, report
 * qa/eval-reports/spelling-pattern-explorer-levers-2026-10-08.md). No real-learner evidence: the misses are what
 * `spellingMiss` observes. Pure: the component draws from these, the workspace publishes them, the tests hold each
 * leak rule. Offered only while the learner is spelling (the apply phase).
 *
 * - `pattern_words` (help): the lesson's pattern words come back above the input, the pattern's letters marked in each.
 *   Leak rule: no dictation word of the lesson is among them (`patternWordsLeak`).
 * - `letter_boxes` (help): one empty box per letter of the word; the learner's own typed letters fill them from the
 *   left. Leak rule: a box holds only a letter the learner typed (`letterBoxes`).
 * - `simpler_word` (simplify): an ungraded dictation of a shorter pattern word with the same pattern, id
 *   `<item>~simpler`; then the full word comes back blank. Never a dictation word (`practiceLeaks`). Not offered when no
 *   pattern word is shorter than the item's word.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { patternRegex, type DictationItem } from './spellingPatternExplorerWorkspace';

export const PATTERN_WORDS_LEVER = 'pattern_words';
export const BOXES_LEVER = 'letter_boxes';
export const SIMPLER_LEVER = 'simpler_word';
export const PRACTICE_SUFFIX = '~simpler';

/** What a lever reads beyond the item: the lesson's pattern and words, and every dictation item. */
export interface SpellingSession {
  patternWords: readonly string[];
  highlightPattern: string;
  items: readonly DictationItem[];
  supportTier?: 'easy' | 'medium' | 'hard';
}

const lower = (w: string) => w.trim().toLowerCase();
const isDictated = (w: string, s: SpellingSession) => s.items.some(i => lower(i.word) === lower(w));

// ── pattern_words ────────────────────────────────────────────────────────────

/** Leak rule: a shown word the lesson dictates would be a spelling to copy. */
export const patternWordsLeak = (shown: readonly string[], s: SpellingSession) => shown.some(w => isDictated(w, s));

/** The pattern words safe to show again: none of them a dictation word. Empty when none are left. */
export const shownPatternWords = (s: SpellingSession) =>
  s.patternWords.map(w => String(w ?? '').trim()).filter(w => w && !isDictated(w, s));

/** The word split around the pattern's letters, for marking; null when the pattern names no letters or is not in it. */
export function markPattern(word: string, highlightPattern: string): [string, string, string] | null {
  const re = patternRegex(highlightPattern);
  const m = re ? word.toLowerCase().match(re) : null;
  if (!m || m.index === undefined) return null;
  return [word.slice(0, m.index), word.slice(m.index, m.index + m[0].length), word.slice(m.index + m[0].length)];
}

export function patternWordsFact(s: SpellingSession): string {
  return `The pattern words are shown again above the input, the pattern's letters marked in each: ${shownPatternWords(s).join(', ')} `
    + '(the word being spelled is not among them)';
}

// ── letter_boxes ─────────────────────────────────────────────────────────────

/** One box per letter of the word, filled from the left with the learner's own typing only; `extra` is what overflows. */
export function letterBoxes(item: DictationItem, typed: string): { boxes: string[]; extra: string } {
  const t = typed.trim();
  const n = item.word.length;
  return { boxes: Array.from({ length: n }, (_, i) => t[i] ?? ''), extra: t.slice(n) };
}

export const boxesFact = (item: DictationItem) =>
  `${item.word.length} letter boxes under the input, one for each letter of the word; the learner's typed letters fill them `
  + 'from the left (no letter is given)';

// ── simpler_word ─────────────────────────────────────────────────────────────

/** Leak rule: the practice word is never the learner's word or any word the lesson dictates. */
export const practiceLeaks = (practice: DictationItem, s: SpellingSession) => isDictated(practice.word, s);

/**
 * A pattern word shorter than the item's word with the same pattern (the same letters of it when the pattern lists
 * several, e.g. "ar" for "sharp" under "ar and or"), shortest first. Null when none is shorter: the item is already
 * the plainest shape the lesson has.
 */
export function practiceItem(item: DictationItem, s: SpellingSession): DictationItem | null {
  const re = patternRegex(s.highlightPattern);
  const own = re ? item.word.toLowerCase().match(re)?.[0] : undefined;
  const fits = (w: string) => !re || !own || re.test(w.toLowerCase());
  const target = item.word.toLowerCase();
  // With no letters to match ("silent letter", "CVC"), the same pattern is read off the word's edges: kn-, wr-, -mb.
  const sameKey = (w: string) => own ? w.toLowerCase().match(re!)?.[0] === own
    : w.toLowerCase().slice(0, 2) === target.slice(0, 2) || w.toLowerCase().slice(-2) === target.slice(-2);
  const pool = shownPatternWords(s)
    .filter(w => /^[a-z]+$/i.test(w) && w.length < item.word.length && fits(w))
    .map((w, i) => ({ w, i, rank: sameKey(w) ? 0 : 1 }))
    .sort((a, b) => a.rank - b.rank || a.w.length - b.w.length || a.i - b.i);
  const word = pool[0]?.w;
  if (!word) return null;
  const practice = { id: `${item.id}${PRACTICE_SUFFIX}`, word: word.toLowerCase() };
  return practiceLeaks(practice, s) ? null : practice;
}

/** The session item a practice id stands in for. */
export const practiceParent = (id: string | null | undefined, items: readonly DictationItem[]) =>
  id?.endsWith(PRACTICE_SUFFIX) ? items.find(i => `${i.id}${PRACTICE_SUFFIX}` === id) ?? null : null;

// ── declarations ─────────────────────────────────────────────────────────────

/** Easy starts with the pattern words shown (the tier that shows the pattern panel); a starting position is not a pull. */
export const patternWordsStartShown = (s: SpellingSession) => s.supportTier === 'easy';

/** The levers on a dictation word while the learner spells. `pulled` holds this item's runtime pulls. */
export function spellingLevers(item: DictationItem | null, s: SpellingSession, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  const levers: WorkspaceLever[] = [];
  if (shownPatternWords(s).length) levers.push({ id: PATTERN_WORDS_LEVER, kind: 'help', carrier: 'shown',
    when: 'The learner spelled the pattern part of the word wrong, or cannot start: the pattern words to look at again.',
    does: 'Shows the lesson\'s pattern words again above the input with the pattern\'s letters marked. The word being '
      + 'spelled is not among them. Never spell the learner\'s word, say which pattern word it sounds like, or name the '
      + 'letters it needs.',
    pulled: patternWordsStartShown(s) || pulled.includes(PATTERN_WORDS_LEVER), answers: ['pattern_missing', 'misspelled'] });
  levers.push({ id: BOXES_LEVER, kind: 'help', carrier: 'shown',
    when: 'The pattern is right but other letters are wrong, missing or extra (a silent letter, a doubled letter, an ending).',
    does: 'Draws one empty box per letter of the word under the input; the learner\'s typed letters fill them from the '
      + 'left, so a missing or extra letter shows as an empty box or a letter past the end. No letter is given. Never say '
      + 'which letter goes in a box.',
    pulled: pulled.includes(BOXES_LEVER), answers: ['other_letters', 'misspelled', 'pattern_missing'] });
  if (practiceItem(item, s)) levers.push({ id: SIMPLER_LEVER, kind: 'simplify', carrier: 'both',
    when: 'The learner cannot spell this word even with the help on screen: a shorter word with the same pattern first.',
    does: 'Opens an ungraded practice word: a shorter word with the same spelling pattern, which you say for the learner '
      + 'to spell. Then this word comes back blank.',
    pulled: pulled.includes(SIMPLER_LEVER), answers: ['pattern_missing', 'other_letters', 'misspelled'] });
  return levers;
}

/** What the pulled levers put on screen, for the tutor and JEV. */
export function leverFacts(item: DictationItem, s: SpellingSession, pulled: readonly string[]): string | undefined {
  const on = spellingLevers(item, s, pulled).filter(l => l.pulled && l.kind === 'help').map(l => l.id);
  const facts = [
    ...(on.includes(PATTERN_WORDS_LEVER) ? [patternWordsFact(s)] : []),
    ...(on.includes(BOXES_LEVER) ? [boxesFact(item)] : []),
  ];
  return facts.length ? facts.join('. ') : undefined;
}
