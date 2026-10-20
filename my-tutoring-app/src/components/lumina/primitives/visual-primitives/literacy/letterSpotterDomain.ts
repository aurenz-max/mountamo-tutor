/**
 * letterSpotterDomain — what letter-spotter TEACHES, with no teaching engine attached: which challenges can be
 * asked, the ask, the spoken key and known misses of name_it, the checked misses of the two taps, and the drawn scene.
 * The boss (`letterSpotter.card.ts` + `letterSpotter.boss.ts`) wires these to the live tutor; the generator and the
 * lesson-bench extractor read the same build gates. The runner-era DISTAR script (cue lines, sentinel verdicts, the
 * tier lead-in ladder) is deleted.
 *
 *   name-it   the answer is a LETTER    → spoken, the tutor judges it against the key (its name or its sound)
 *   find-it   the answer is a POSITION  → one tap on a grid cell, checked by the activity
 *   match-it  the answer is a FORM      → one tap on a little letter, checked by the activity
 *
 * What may be said before a try follows what the answer is made of: name-it's ask says the WORD (the stimulus) and
 * never the letter; find-it's ask NAMES the letter (a search for an unnamed target is broken, not harder) and never
 * where it is; match-it's ask names nothing, because the printed capital is the question side. No line here
 * describes a letter's SHAPE: a shape description is the answer said another way (live drive 42edfc52e539).
 */
import type { TeachingItem } from '../../../hooks/teachingItemContract';
import { opensWithSentinel } from '../../../hooks/judgedScriptContract';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { LetterSpotterMiss } from './letterSpotter.card';
import { LETTER_NAME } from './spokenReadingMisses';

export type { LetterSpotterMiss, SpokenLetterSpotterMiss } from './letterSpotter.card';

// Re-exported so the generator imports its build gates from ONE address: both sides of the wire must agree on what
// is sayable.
export { opensWithSentinel };

export type LetterSpotterMode = 'name-it' | 'find-it' | 'match-it';
export type LetterSpotterTier = 'easy' | 'medium' | 'hard';

/** ONE mystery marker for the whole family, code-owned (the click-era pool changed the spoken prompt every item). */
export const SPOTTER_EMOJI = '⭐';

// ── The item ────────────────────────────────────────────────────────────────

export interface LetterSpotterItem extends TeachingItem {
  mode: LetterSpotterMode;
  /** The answer in every mode, lowercase. Said before a try only in find-it, where it is the stimulus. */
  targetLetter: string;
  /** The lesson's support tier: when the model lever comes (`supportFact`). */
  tier: LetterSpotterTier;
  /** name-it: the sentence as PRINTED, the marker over the word's first letter ("I see an ⭐nt walk away."). */
  sentence?: string;
  /** name-it: the sentence as SPOKEN, word intact ("I see an ant walk away."). */
  spokenSentence?: string;
  /** name-it: the word whose first letter is hidden ("ant"). */
  targetWord?: string;
  /** find-it: sixteen uppercase cells, exactly one of them the target. */
  letterGrid?: string[];
  /** match-it ONLY: the tappable little letters. Empty for the other two. */
  options: string[];
}

/** The catalog eval mode of an item (`name_it`); the item's own mode is hyphenated. */
export const evalModeOf = (item: Pick<LetterSpotterItem, 'mode'>): string => item.mode.replace('-', '_');

// ── Build gates: DROP an unaskable item, never repair it into one ───────────

/** Structural challenge shape as the generator emits it (duck-typed so this module never imports the component). */
export interface LetterSpotterChallengeLike {
  id: string;
  mode: LetterSpotterMode;
  targetLetter: string;
  targetWord?: string;
  sentence?: string;
  spokenSentence?: string;
  letterGrid?: string[];
  options?: string[];
}

/** A WORD a tutor can say aloud. flash-lite once returned `targetWord` as 400 characters of its own deliberation
 *  that passed every semantic gate, so an unbounded field gets a SHAPE gate. */
export const MAX_WORD_CHARS = 12;
/** One breath. The generator imports this instead of keeping a copy (the two had drifted, 90 vs 100). */
export const MAX_SENTENCE_CHARS = 90;
export const isSayableWord = (word: string): boolean =>
  new RegExp(`^[a-z]{1,${MAX_WORD_CHARS}}$`, 'i').test(word.trim());

/**
 * Does this word's FIRST LETTER spell its first SOUND? `sheep` leads with `s` but opens on /sh/, and affirming S there
 * teaches a false mapping. Initial digraphs and silent first letters are dropped; blends, `wh`, `gh` and `qu` are not
 * (their first letter does spell the first sound, or is only ever taught that way).
 */
const INITIAL_DIGRAPHS = ['sh', 'ch', 'th', 'ph', 'kn', 'wr', 'gn'];
export const startsWithADigraph = (word: string): boolean => {
  const w = word.trim().toLowerCase();
  return INITIAL_DIGRAPHS.some((d) => w.startsWith(d));
};

/** No blank markers, and no double quotes (a quote inside a quoted ask closes it early). */
export const isSayableSentence = (sentence: string): boolean =>
  sentence.trim().length > 0
  && sentence.trim().length <= MAX_SENTENCE_CHARS
  && !/_/.test(sentence)
  && !/["“”]/.test(sentence);

/**
 * One item, or null when the challenge cannot be ASKED. Nothing here backfills: a broken item is dropped and the
 * session runs shorter.
 *  - name-it needs a sayable word and sentence; the word leads with the target letter, that letter spells its first
 *    sound, and the word appears in the sentence exactly once (a second copy prints the hidden letter elsewhere).
 *  - find-it needs sixteen cells holding exactly one target: one tap is one commit.
 *  - match-it needs the answer among the options and at least one distractor.
 *  - nothing generated may open a sentence with a verdict sentinel.
 */
export const itemFromChallenge = (
  ch: LetterSpotterChallengeLike,
  tier: LetterSpotterTier = 'medium',
): LetterSpotterItem | null => {
  const targetLetter = (ch.targetLetter ?? '').trim().toLowerCase();
  if (targetLetter.length !== 1) return null;

  const options = (ch.options ?? []).map((o) => o.trim().toLowerCase()).filter((o) => o.length === 1);

  if (ch.mode === 'name-it') {
    const targetWord = (ch.targetWord ?? '').trim();
    const spokenSentence = (ch.spokenSentence ?? '').trim();
    const sentence = (ch.sentence ?? '').trim();
    if (!targetWord || !spokenSentence || !sentence) return null;
    if (!isSayableWord(targetWord) || !isSayableSentence(spokenSentence)) return null;
    if (targetWord[0]?.toLowerCase() !== targetLetter) return null;
    if (startsWithADigraph(targetWord)) return null;
    if (opensWithSentinel(targetWord) || opensWithSentinel(spokenSentence)) return null;
    const occurrences = spokenSentence.match(
      new RegExp(`\\b${targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
    );
    if (!occurrences || occurrences.length !== 1) return null;
    // The tiles are gone: the child SAYS the letter, so any `options` a cached challenge still carries are ignored.
    return { id: ch.id, mode: 'name-it', answerKind: 'voice', responseClass: 'letter_name', action: 'name-it',
      targetLetter, tier, sentence, spokenSentence, targetWord, options: [] };
  }

  if (ch.mode === 'find-it') {
    const letterGrid = (ch.letterGrid ?? []).map((l) => l.trim().toUpperCase());
    if (letterGrid.length !== 16) return null;
    if (letterGrid.filter((l) => l.toLowerCase() === targetLetter).length !== 1) return null;
    return { id: ch.id, mode: 'find-it', answerKind: 'gesture', responseClass: 'manipulation', action: 'find-it',
      targetLetter, tier, letterGrid, options: [] };
  }

  if (!options.includes(targetLetter) || options.length < 2) return null;
  return { id: ch.id, mode: 'match-it', answerKind: 'gesture', responseClass: 'manipulation', action: 'match-it',
    targetLetter, tier, options };
};

/**
 * The session, dropping what cannot be asked AND what cannot be asked SECOND. find-it's ask names its letter, and an
 * item closes by naming the letter credited, so a later name-it or match-it item on a letter already named would be
 * answered from memory. A letter may be ANSWERED once per session; find-it is never dropped for reuse (its answer is
 * a position, and hearing the letter it hunts for is the task).
 */
export const itemsFromChallenges = (
  challenges: LetterSpotterChallengeLike[],
  tier: LetterSpotterTier = 'medium',
): LetterSpotterItem[] => {
  const spokenLetters = new Set<string>();
  const items: LetterSpotterItem[] = [];
  for (const ch of challenges) {
    const item = itemFromChallenge(ch, tier);
    if (!item) continue;
    if (item.mode !== 'find-it' && spokenLetters.has(item.targetLetter)) continue;
    spokenLetters.add(item.targetLetter);
    items.push(item);
  }
  return items;
};

// ── The ask, the key, the known misses ───────────────────────────────────────

/** What the learner is asked. name-it says the sentence (and the word alone at `easy`); find-it names the letter;
 *  match-it names nothing: the printed capital is the question side. */
export const askFor = (item: LetterSpotterItem): string => {
  switch (item.mode) {
    case 'name-it': {
      const wordAlone = item.tier === 'easy' ? ` The word is ${item.targetWord}.` : '';
      return `Listen: ${item.spokenSentence}${wordAlone} Your turn. Say the letter that ${item.targetWord} starts with.`;
    }
    case 'find-it':
      return `Find the letter ${item.targetLetter.toUpperCase()}. Your turn. Tap it in the boxes.`;
    case 'match-it':
      return 'Look at the big letter. Your turn. Tap the little letter that is the same letter.';
  }
};

/** The letter's basic sound in slashes, as the key accepts it: `c` is /k/, `q` /kw/, `x` /ks/. */
const SOUND_GLYPH: Record<string, string> = { c: 'k', q: 'kw', x: 'ks' };
export const letterSoundOf = (letter: string): string => `/${SOUND_GLYPH[letter] ?? letter}/`;

/**
 * name-it's key: the letter, or its sound. The fluent wrong answer is the WORD said back: it carries the target sound
 * at its front, it is confident, and the tutor said it seconds earlier. find-it and match-it have no key: the
 * activity checks the tap.
 */
export function letterSpotterKey(item: LetterSpotterItem): SpokenKey | null {
  if (item.mode !== 'name-it') return null;
  const letter = item.targetLetter.toLowerCase();
  const name = LETTER_NAME[letter];
  return { answer: letter.toUpperCase(), alsoAccept: [letterSoundOf(letter)],
    acceptRule: `The letter's name${name ? ` ("${name}")` : ''} or its sound, held or short, counts the same; a shy `
      + 'or mumbled single letter still counts.',
    signatureError: `The word "${item.targetWord}" said back is not a letter, however confident: the word is the `
      + 'question. Any other letter is wrong.' };
}

/**
 * What the ask says by design: the generated sentence, when the letter stands alone in it only as ordinary English:
 * the article or pronoun for `a` and `i` ("Look at a big ant"), or a contraction's tail ("it's", "don't"). A sentence
 * that says the letter on its own any other way ("S is for sun") stays a leak, and the lesson is rejected.
 */
export const askGiven = (item: LetterSpotterItem): string[] => {
  if (item.mode !== 'name-it' || !item.spokenSentence) return [];
  const letter = item.targetLetter.toLowerCase();
  if (letter === 'a' || letter === 'i') return [item.spokenSentence];
  const alone = new RegExp(`(^|[^a-z'’])${letter}([^a-z'’]|$)`, 'i');
  return alone.test(item.spokenSentence) ? [] : [item.spokenSentence];
};

/**
 * name_it's known wrong answers, most specific first: the hidden word said back, a letter from later in that word,
 * a letter not in the word. The target's name and its sound are both correct, so neither is ever an example.
 */
export function letterSpotterSpokenMisses(item: LetterSpotterItem): KnownMiss[] {
  if (item.mode !== 'name-it' || !item.targetWord) return [];
  const word = item.targetWord.toLowerCase(), want = item.targetLetter.toLowerCase(), cap = want.toUpperCase();
  const later = Array.from(new Set(word.slice(1).split(''))).filter(l => l !== want && /[a-z]/.test(l));
  const other = ['m', 'b', 'r', 'd'].find(l => l !== want && !word.includes(l)) ?? 'z';
  return [
    { id: 'said_the_word', pattern: `The hidden letter is the first letter of "${word}". The learner says the whole word "${word}" instead of naming a letter.`, examples: [word] },
    ...(later.length ? [{ id: 'later_letter', pattern: `The hidden letter is ${cap}, the first letter of "${word}". The learner names a letter from later in "${word}" (${later.map(l => l.toUpperCase()).join(', ')}), by its name or its sound, instead of the first one.`,
      examples: [later.at(-1)!.toUpperCase(), LETTER_NAME[later.at(-1)!] ?? later.at(-1)!] }] : []),
    { id: 'letter_not_in_word', pattern: `The hidden letter is ${cap}, the first letter of "${word}". The learner names a different letter that is not in "${word}" at all, by its name or its sound.`,
      examples: [other.toUpperCase(), LETTER_NAME[other]] },
  ];
}

// ── The taps' own check ──────────────────────────────────────────────────────

// Mirrors `CONFUSABLE_CLUSTERS` in service/literacy/gemini-letter-spotter.ts (not imported: a generator module).
export const SHAPE_FAMILIES = ['bdpqg', 'mnhru', 'iltjf', 'ceoas', 'vwyxzk'];
export const MIRRORS = new Set(['bd', 'pq', 'bp', 'dq', 'nu', 'mw']);

/** What a checked wrong tap shows, by the tapped letter's shape against the target's. */
export function letterSpotterMiss(item: LetterSpotterItem, tapped: string): LetterSpotterMiss | undefined {
  const want = item.targetLetter.toLowerCase(), got = tapped.toLowerCase();
  if (item.mode === 'name-it' || !got || got === want) return undefined;
  if (item.mode === 'match-it' && (MIRRORS.has(want + got) || MIRRORS.has(got + want))) return 'mirror_form';
  return SHAPE_FAMILIES.some(f => f.includes(want) && f.includes(got)) ? 'same_shape_family' : 'other_letter';
}

/** How a tap reads to the tutor and the observer: which letter, never the key. */
export const describeLetterTap = (letter: string) => `Tapped the letter ${letter}.`;

/** What hear-again asks the tutor to say: the question only, never the answer. */
export const hearQuestionRequest = (item: LetterSpotterItem) =>
  `The learner tapped to hear the question again. Say only this, once: "${askFor(item)}"`;

// ── The scene ───────────────────────────────────────────────────────────────

/**
 * What is drawn, and this item's "never say" rule as `constraints`: on name-it the letter behind the star, its spelling
 * and its shape; on find-it where the letter is; on match-it the big letter's name and any letter's shape.
 */
export function letterSpotterScene(item: LetterSpotterItem): SceneOf {
  const shown = item.mode === 'name-it'
    ? `A sentence with the first letter of ${item.targetWord} hidden behind a star.`
    : item.mode === 'find-it'
      ? `${item.letterGrid?.length === 4 ? 'Four' : 'Sixteen'} big letters in a grid; exactly one is the named letter.`
      : 'One big letter and some little letters.';
  return { objects: [], facts: {
    kind: item.mode,
    shown,
    constraints: item.mode === 'name-it'
      ? 'Never say, spell or describe the shape of the letter behind the star before the learner tries.'
      : item.mode === 'find-it'
        ? 'Never say where the named letter is (its row, column or neighbours), read out the other letters, or '
          + 'describe what any letter looks like.'
        : 'Never name the big letter or the little letters, and never describe what any letter looks like: matching '
          + 'the shapes is the task.',
  } };
}

// ── Harness answer material ──────────────────────────────────────────────────

/** Letters a child reaches for when wrong but not guessing; off `a` and `i` so a wrong answer is never an article. */
const LETTER_DECOYS = ['m', 'k', 'z', 'v', 'w'];

/** The journey's answers: the letter said (name-it), or the right and a wrong tap (a real cell or tile). */
export function letterSpotterHarnessAnswers(item: LetterSpotterItem): { correct: string; plainWrong: string; tapped?: { correct: string; wrong: string } } {
  const name = item.targetLetter.toUpperCase();
  const decoy = LETTER_DECOYS.find((l) => l !== item.targetLetter) ?? 'm';
  if (item.mode === 'name-it') return { correct: name, plainWrong: decoy.toUpperCase() };
  const wrongTap = item.mode === 'find-it'
    ? (item.letterGrid ?? []).find((l) => l.toLowerCase() !== item.targetLetter)?.toLowerCase() ?? decoy
    : item.options.find((o) => o !== item.targetLetter) ?? decoy;
  return { correct: name, plainWrong: wrongTap.toUpperCase(), tapped: { correct: item.targetLetter, wrong: wrongTap } };
}
