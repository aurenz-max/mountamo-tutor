/**
 * spelling-pattern-explorer's in-item levers (`/add-support-tiers`, report
 * qa/eval-reports/spelling-pattern-explorer-levers-2026-10-08.md), declared once as a lever set (`bossLevers.ts`). No
 * real-learner evidence: the misses are what `spellingMiss` and `patternMiss` observe.
 *
 * Classic modes (offered only while the learner spells a session word, the apply phase):
 * - `pattern_words` (clue): the lesson's pattern words come back above the input, the pattern's letters marked in each.
 *   Leak rule: no dictation word of the lesson is among them (`patternWordsLeak`); the set checks the fact never names
 *   the item's word. Easy starts with it shown (`patternWordsStartShown`), which is not a pull.
 * - `letter_boxes` (layout): one empty box per letter of the word; the learner's own typed letters fill them from the
 *   left. Leak rule: a box holds only a letter the learner typed (`letterBoxes`).
 * - `simpler_word` (easier): an ungraded dictation of a shorter pattern word with the same pattern, id
 *   `<item>~simpler`; then the full word comes back blank. Never a dictation word (`practiceLeaks`). Not offered when no
 *   pattern word is shorter than the item's word.
 * pattern_build (the shared letter build's helpers in `letterBuild.ts`):
 * - `pattern_card` (clue): the asked spelling in its place with blanks for the other letters, and the sound it makes.
 * - `model_word` (model): one solved word of the same kind on other letters, none of them an answer to this item.
 * - `small_bank` (easier): the same ask, one word, only the letters two answers need.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { modelFor, patternFor, smallBankFor, type LetterBuildItem } from './letterBuild';
import { spellingPatternExplorerCard } from './spellingPatternExplorer.card';
import {
  asPatternBuild, isPatternBuild, patternRegex, type DictationItem, type PatternBuild, type SpellingItem, type SpellingWord,
} from './spellingPatternExplorerWorkspace';

export const PATTERN_WORDS_LEVER = 'pattern_words';
export const BOXES_LEVER = 'letter_boxes';
export const SIMPLER_LEVER = 'simpler_word';
export const PATTERN_CARD_LEVER = 'pattern_card';
export const MODEL_WORD_LEVER = 'model_word';
export const SMALL_BANK_LEVER = 'small_bank';
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

export const patternWordsFact = (shown: readonly string[]) =>
  `The pattern words are shown again above the input, the pattern's letters marked in each: ${shown.join(', ')} `
  + '(the word being spelled is not among them).';

/** Easy starts with the pattern words shown (the tier that shows the pattern panel); a starting position is not a pull. */
export const patternWordsStartShown = (s: SpellingSession) => s.supportTier === 'easy';

// ── letter_boxes ─────────────────────────────────────────────────────────────

/** One box per letter of the word, filled from the left with the learner's own typing only; `extra` is what overflows. */
export function letterBoxes(item: DictationItem, typed: string): { boxes: string[]; extra: string } {
  const t = typed.trim();
  const n = item.word.length;
  return { boxes: Array.from({ length: n }, (_, i) => t[i] ?? ''), extra: t.slice(n) };
}

export const boxesFact = (item: DictationItem) =>
  `${item.word.length} letter boxes under the input, one for each letter of the word; the learner's typed letters fill them `
  + 'from the left (no letter is given).';

// ── simpler_word ─────────────────────────────────────────────────────────────

/** Leak rule: the practice word is never the learner's word or any word the lesson dictates. */
export const practiceLeaks = (practice: DictationItem, s: SpellingSession) => isDictated(practice.word, s);

/**
 * A pattern word shorter than the item's word with the same pattern (the same letters of it when the pattern lists
 * several, e.g. "ar" for "sharp" under "ar and or"), shortest first. Null when none is shorter: the item is already
 * the plainest shape the lesson has.
 */
export function practiceItem<T extends DictationItem>(item: T, s: SpellingSession): T | null {
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
  const { hint: _hint, ...rest } = item;
  const practice = { ...rest, id: `${item.id}${PRACTICE_SUFFIX}`, word: word.toLowerCase() } as T;
  return practiceLeaks(practice, s) ? null : practice;
}

/** The session item a practice id stands in for. */
export const practiceParent = <T extends DictationItem>(id: string | null | undefined, items: readonly T[]) =>
  id?.endsWith(PRACTICE_SUFFIX) ? items.find(i => `${i.id}${PRACTICE_SUFFIX}` === id) ?? null : null;

// ── the lever set ────────────────────────────────────────────────────────────

const CLASSIC = ['short_vowel', 'long_vowel', 'r_controlled', 'silent_letter', 'morphological'] as const;
const BUILD = ['pattern_build'] as const;
const word = (item: SpellingItem): SpellingWord | null => (isPatternBuild(item) ? null : item);
const build = (item: SpellingItem): PatternBuild | null => (isPatternBuild(item) ? item : null);

export const SPELLING_LEVERS = leverSet<SpellingItem, SpellingSession>({
  modeOf: item => item.mode,
  missesOf: mode => spellingPatternExplorerCard.modes[mode]?.misses ?? [],
  // A clue never names the word being spelled, or a word that answers a build's ask.
  answersOf: item => (isPatternBuild(item) ? item.examples : [item.word]),
  // Only pattern_build has a model lever; the lesson's tier says when it comes (build items carry it, default medium).
  support: { tier: item => (isPatternBuild(item) ? item.supportTier : 'medium'),
    different: 'one solved word on other letters', own: 'a word that answers this ask' },
  specs: [
    { id: PATTERN_WORDS_LEVER, type: 'clue', modes: CLASSIC, carrier: 'shown', answers: ['pattern_missing', 'misspelled'],
      when: 'The learner spelled the pattern part of the word wrong, or cannot start: the pattern words to look at again.',
      does: 'Shows the lesson\'s pattern words again above the input with the pattern\'s letters marked. The word being '
        + 'spelled is not among them. Never spell the learner\'s word, say which pattern word it sounds like, or name the '
        + 'letters it needs.',
      content: (item, s) => { const shown = word(item) ? shownPatternWords(s) : []; return shown.length ? shown : null; },
      fact: (shown: string[]) => patternWordsFact(shown) },
    { id: BOXES_LEVER, type: 'layout', modes: CLASSIC, answers: ['other_letters', 'misspelled', 'pattern_missing'],
      when: 'The pattern is right but other letters are wrong, missing or extra (a silent letter, a doubled letter, an ending).',
      does: 'Draws one empty box per letter of the word under the input; the learner\'s typed letters fill them from the '
        + 'left, so a missing or extra letter shows as an empty box or a letter past the end. No letter is given. Never say '
        + 'which letter goes in a box.',
      content: item => word(item),
      fact: (w: SpellingWord) => boxesFact(w) },
    { id: SIMPLER_LEVER, type: 'easier', modes: CLASSIC, answers: ['pattern_missing', 'other_letters', 'misspelled'],
      when: 'The learner cannot spell this word even with the help on screen: a shorter word with the same pattern first.',
      does: 'Opens an ungraded practice word: a shorter word with the same spelling pattern, which you say for the learner '
        + 'to spell. Then this word comes back blank.',
      content: (item, s) => { const w = word(item); return w ? practiceItem(w, s) : null; } },
    { id: PATTERN_CARD_LEVER, type: 'clue', modes: BUILD, carrier: 'shown',
      answers: ['other_spelling', 'wrong_place', 'no_pattern', 'not_the_sound'],
      when: 'The learner spells the sound another way, puts the letters of the pattern in the wrong place, leaves the '
        + 'pattern out, or uses the letters in a word where they make a different sound.',
      does: 'Shows a pattern card above the boxes: the asked spelling in its place with blanks for the other letters, and '
        + 'the sound it makes, such as _ a i _ (ai says long a). No other letter is filled in.',
      content: item => { const b = build(item); return b ? patternFor(b) : null; },
      // Worded without "card": the fact is leak-checked against the ask's answers, and card is an ar word.
      fact: (pattern: string) => `Above the boxes, the pattern is shown with blanks: ${pattern}.` },
    { id: MODEL_WORD_LEVER, type: 'model', modes: BUILD, answers: ['not_a_word'],
      when: 'The learner makes letters that are not a real word.',
      does: 'Shows one solved word with the same spelling pattern made with other letters, so the learner sees how a real '
        + 'word comes out. It shares no answer with this item.',
      content: item => { const b = build(item); return b ? modelFor(b) : null; },
      fact: (model: string) => `A solved example on other letters is shown: ${model}.` },
    { id: SMALL_BANK_LEVER, type: 'easier', modes: BUILD, carrier: 'shown', answers: ['not_a_word'],
      when: 'The learner keeps making letters that are not a word, or cannot start with so many letters.',
      does: 'Opens the same ask first with a smaller letter bank, one word only. It is not graded; the full item comes '
        + 'back after it.',
      content: item => { const b = build(item); const small = b && smallBankFor(b); return b && small ? asPatternBuild(small, b.supportTier) : null; } },
  ],
});

/** The build levers bound for the shared letter build surface: its items carry no mode or tier, so they are stamped. */
export function patternBuildLevers(supportTier: PatternBuild['supportTier'] | undefined) {
  const bound = SPELLING_LEVERS.bind({ patternWords: [], highlightPattern: '', items: [] });
  const stamp = (item: LetterBuildItem) => asPatternBuild(item, supportTier);
  return {
    declare: (item: LetterBuildItem, pulled: readonly string[]) => bound.declare(stamp(item), pulled),
    onScreen: (item: LetterBuildItem, pulled: readonly string[]) => bound.onScreen(stamp(item), pulled),
    simpler: (item: LetterBuildItem, lever: string) => bound.simpler(stamp(item), lever) as PatternBuild | null,
    support: (item: LetterBuildItem) => bound.support(stamp(item)),
  };
}
