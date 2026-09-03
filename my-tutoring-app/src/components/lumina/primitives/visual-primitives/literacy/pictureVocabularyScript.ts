/**
 * pictureVocabularyScript — HAND-AUTHORED judged-loop script for
 * picture-vocabulary (fifth literacy DI port; FIRST literacy consumer of
 * useJudgedScriptRunner — qa/di/BACKLOG.md item 16). The exact wording IS the
 * pedagogy; these lines are authored per pack, never generated. Item CONTENT
 * (the word pools) stays generator-scoped; this module owns only the cue
 * shapes and the in-band judging contracts.
 *
 * The §3 script questions, answered for VOCABULARY:
 *
 * 1. IS THE MODEL THE ANSWER? For naming, yes — saying the word IS the answer,
 *    so nothing is modeled before the ask and the word is earned in the
 *    correction (sound-swap's shape). For opposite the RULE is modeled on a
 *    pair this session never asks about (word-flip's shape; pickModelOppositePair
 *    is code-owned for exactly that reason). For gradable_scale and
 *    sentence_frame the stimulus itself must be HEARD (a pre-reader cannot
 *    read the scale or the frame), so the ask speaks it with the missing word
 *    as "hmm" — stimulus spoken, answer never.
 *
 * 2. CAN THE STIMULUS ANSWER THE HAND-OVER? "What is this?" over one picture
 *    has one defensible answer plus fair synonyms (the accept clauses below).
 *    Opposite's hand-over restates the base ("What is the opposite of big?")
 *    so the base cannot be a lazy echo. Gradable's contract forbids a word
 *    already in the list. The ambiguous-ask ruling, fifth use.
 *
 * 3. WHAT LOOKS LIKE AN ANSWER AND ISN'T, PER MODE?
 *    - opposite: the BASE WORD said back — fluent, confident, completely
 *      unchanged (sound-swap's signature error, arriving a third time).
 *    - naming: a category word ("animal") or the name of something else.
 *    - gradable_scale: a rung already given on the scale.
 *    - sentence_frame: a word that does not finish the sentence.
 *    And the accept side (a RIGHT answer that does not look right):
 *    "puppy" for a dog picture, "little" for small, "chilly" for cool — the
 *    judge affirms and echoes the canonical word, which re-models the target.
 *
 * TWO MODES STAY IN THE HANDS, and that is a ruling, not a shortcut.
 * receptive_match (hear a word, tap its picture) is receptive identification —
 * a child without the word cannot pick the referent from four distinct
 * pictures, so the tap is not a costume. association ("what goes with sock?")
 * is an OPEN production set spoken — shoe, foot, laundry are all honest
 * answers, and open_set_word is a BLOCKED response class (standing gate 1).
 * The emoji cards CLOSE the set while the relation stays the skill. Both
 * commit through the gesture anchor; the verdict is code-computed and the
 * tutor speaks it ([PV_TAP], handVerdictCue's pattern). Their item cues carry
 * a SILENCE contract (spell_word's pattern): nothing to judge until the tap
 * is described.
 *
 * ANSWER-LEAK RULE: the four spoken modes ship NO word chips — the old
 * 4-option "support net" printed the answer for any Grade-1 reader (word-flip's
 * chips, a third time). Tap-to-hear ([PV_HEAR]) re-speaks the QUESTION, never
 * the answer. Reveal happens only at the tutor's affirmation.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn") — collision-checked by
 * validateJudgedScriptPack in this pack's test file: no spoken line below
 * opens a sentence with either. (The generator also refuses the word token
 * "yes" in every pool so a generated base word can never open an ask with a
 * sentinel.)
 */

import type {
  JudgedCueSurface,
  JudgedScriptItem,
  ResponseClassId,
} from '../../../hooks/judgedScriptContract';

export type PictureVocabItemKind =
  | 'receptive_match'
  | 'naming'
  | 'opposite'
  | 'association'
  | 'gradable_scale'
  | 'sentence_frame';

export interface PictureVocabTapOption {
  word: string;
  emoji: string;
}

export interface PictureVocabItem extends JudgedScriptItem {
  kind: PictureVocabItemKind;
  /** The target word — the answer. For tap modes, the word of the right card. */
  word: string;
  emoji: string;
  /** opposite / association: the shown prompt word (the stimulus, never the answer). */
  baseWord?: string;
  baseEmoji?: string;
  /** sentence_frame */
  frameDisplay?: string;
  frameSpoken?: string;
  /** gradable_scale */
  scaleWords?: string[];
  scaleTargetIndex?: number;
  /** Tap modes only: the emoji-only cards on screen. */
  options?: PictureVocabTapOption[];
}

/**
 * The ONE mode whose answer is a committed tap (gesture anchor).
 *
 * ⚠️ `association` LEFT THIS SET on 2026-08-19 (item 25) and must not come
 * back. It tapped for exactly one reason — "what goes with sock" is an OPEN
 * spoken production set and `open_set_word` was a BLOCKED response class, so
 * the emoji cards closed the set while the relation stayed the skill. The
 * class was BENCHED on 2026-08-19 (rhyme-studio, 72 probes, zero false
 * affirmations), the block is gone, and the cards were the costume.
 *
 * `receptive_match` STAYS A TAP, and that is a RULING, not residual debt: a
 * child without the word cannot pick the referent out of four distinct
 * pictures, so the tap IS the receptive-identification skill rather than a
 * costume over a spoken one. DI is spoken-first about answers a child would
 * naturally SAY; pointing at the picture you just heard named is page-work,
 * and `answerKind` resolves it that way by design.
 */
export const TAP_KINDS: ReadonlySet<PictureVocabItemKind> = new Set<PictureVocabItemKind>([
  'receptive_match',
]);

export const answerKindFor = (kind: PictureVocabItemKind): 'voice' | 'gesture' =>
  TAP_KINDS.has(kind) ? 'gesture' : 'voice';

/** Does this mode hand the judge a RULE instead of an enumerated target?
 *  (rhyme-studio's `isOpenSet`, same shape.) */
export const isOpenSet = (kind: PictureVocabItemKind): boolean => kind === 'association';

/** Standing gate 1: tap answers are manipulations; four spoken modes produce
 *  one short word from a closed per-item set; `association` produces a word
 *  from NO set at all — `open_set_word`, benched 2026-08-19. */
export const responseClassFor = (kind: PictureVocabItemKind): ResponseClassId =>
  TAP_KINDS.has(kind)
    ? 'manipulation'
    : isOpenSet(kind)
      ? 'open_set_word'
      : 'short_spoken_word';

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). */
export interface PictureVocabChallengeLike {
  id: string;
  type: PictureVocabItemKind;
  word: string;
  emoji: string;
  baseWord?: string;
  baseEmoji?: string;
  frameDisplay?: string;
  frameSpoken?: string;
  scaleWords?: string[];
  scaleTargetIndex?: number;
  options?: PictureVocabTapOption[];
}

/** Whole-word, case-insensitive containment — the same shape the leak oracle
 *  uses, so a gate here and a HIGH there cannot disagree about what "contains
 *  the answer" means. */
const saysWord = (haystack: string | undefined, word: string): boolean =>
  !!haystack && new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(haystack);

/**
 * The build gate this port did not have.
 *
 * Every drop is an ask with NO DEFENSIBLE ANSWER, which is a broken item rather
 * than a hard one, and each shape below has a specific way of failing the child:
 *
 *  - a tap mode whose cards do not contain the target — the tap can never match,
 *    so the child is corrected to the cap for answering correctly. ⚠️ THIS GATE
 *    IS KEYED TO `TAP_KINDS`, so it stopped applying to `association` the
 *    moment that mode went spoken (item 25). That is the intended direction:
 *    an open spoken ask has no cards to be wrong about, and requiring
 *    `options` would drop every association item the generator now builds
 *    without them. `receptive_match` still carries it;
 *  - an `opposite`/`association` with no base word — the ask renders "the
 *    opposite of undefined", and every correction re-ask inherits it;
 *  - a scale whose target rung is not at `scaleTargetIndex`, or appears twice —
 *    `scaleSpokenFor` then either blanks the wrong rung or SPEAKS the answer
 *    while asking for it;
 *  - a frame with no blank — `frameFilledFor` returns the sentence unchanged, so
 *    the correction never models the word in place;
 *  - a frame or an opposite whose ask contains the target word — the generator
 *    already forbids this ("NEITHER may contain the target word") but nothing
 *    enforced it at the boundary the runner reads.
 *
 * Returns null rather than repairing: an unaskable item is never backfilled, so
 * a high drop rate is a GENERATOR finding surfaced by `droppedChallenges`.
 */
export const itemFromChallenge = (ch: PictureVocabChallengeLike): PictureVocabItem | null => {
  const word = ch.word?.trim();
  if (!word || !ch.emoji?.trim() || !ch.id) return null;

  if (TAP_KINDS.has(ch.type)) {
    const options = ch.options ?? [];
    if (options.length < 2) return null;
    if (!options.some((o) => o.word.trim().toLowerCase() === word.toLowerCase())) return null;
  }

  if (ch.type === 'opposite' || ch.type === 'association') {
    const base = ch.baseWord?.trim();
    if (!base) return null;
    // A pair whose two sides are the same word asks for what it just said.
    if (base.toLowerCase() === word.toLowerCase()) return null;
  }

  if (ch.type === 'gradable_scale') {
    const words = ch.scaleWords ?? [];
    const idx = ch.scaleTargetIndex;
    if (words.length < 3 || idx === undefined || idx < 0 || idx >= words.length) return null;
    if (words[idx].trim().toLowerCase() !== word.toLowerCase()) return null;
    // The blanked rung must be the ONLY occurrence, or the spoken scale says
    // the missing word aloud on another rung.
    if (words.filter((w) => w.trim().toLowerCase() === word.toLowerCase()).length !== 1) return null;
  }

  if (ch.type === 'sentence_frame') {
    // `frameDisplay` is the ONLY frame field that matters now — the spoken form
    // is derived from it (`frameSpokenFor`), so a missing or truncated
    // `frameSpoken` can no longer reach the child.
    if (!ch.frameDisplay) return null;
    if (!/_{2,}/.test(ch.frameDisplay)) return null;
    if (saysWord(ch.frameDisplay, word)) return null;
  }

  return {
    id: ch.id,
    kind: ch.type,
    answerKind: answerKindFor(ch.type),
    responseClass: responseClassFor(ch.type),
    // Mixed sessions interleave tap and speak: `action` drives the runner's
    // how-to-play re-speak whenever the thing-to-do changes (cvc-speller rule).
    action: ch.type,
    word,
    emoji: ch.emoji,
    baseWord: ch.baseWord,
    baseEmoji: ch.baseEmoji,
    frameDisplay: ch.frameDisplay,
    frameSpoken: ch.frameSpoken,
    scaleWords: ch.scaleWords,
    scaleTargetIndex: ch.scaleTargetIndex,
    options: ch.options,
  };
};

/**
 * ONE builder, so the component and the DI harness drop the same items.
 *
 * SESSION-LEVEL, not just per item, because one gradable_scale ask can give
 * another one away. A live drive drew `quiet/soft/loud/noisy` twice — item 1
 * blanked "loud" and therefore ASKED "quiet, soft, hmm, noisy", speaking item
 * 5's answer, while item 5 asked "quiet, hmm, loud, noisy" and spoke item 1's.
 * Two blanks on one scale make each other free: the second is recall, not
 * gradient reasoning.
 *
 * The generator no longer pads by re-blanking a used scale, so this is the
 * boundary guard for everything else that can reach the runner — a hand-authored
 * payload, an older cached one, or a future generator change. The per-item gate
 * cannot see it: nothing is wrong with either item ALONE.
 */
export const itemsFromChallenges = (
  challenges: PictureVocabChallengeLike[],
): PictureVocabItem[] => {
  const seenScales = new Set<string>();
  const items: PictureVocabItem[] = [];

  for (const ch of challenges) {
    const item = itemFromChallenge(ch);
    if (!item) continue;
    if (item.kind === 'gradable_scale') {
      const signature = (item.scaleWords ?? []).map((w) => w.trim().toLowerCase()).join('|');
      if (seenScales.has(signature)) continue;
      seenScales.add(signature);
    }
    items.push(item);
  }
  return items;
};

// ── The opposite-rule model pair — code-owned, never a session word ─────────
// (word-flip's pickModelNoun ruling: a rule shown on a different word is
// taught, not given away; a hardcoded example could be the exact word a later
// item asks about.)

const MODEL_OPPOSITE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['up', 'down'],
  ['day', 'night'],
  ['wet', 'dry'],
  ['hot', 'cold'],
  ['big', 'little'],
];

export const pickModelOppositePair = (
  items: ReadonlyArray<Pick<PictureVocabItem, 'word' | 'baseWord'>>,
): readonly [string, string] => {
  const sessionWords = new Set(
    items.flatMap((i) => [i.word.toLowerCase(), (i.baseWord ?? '').toLowerCase()]),
  );
  return (
    MODEL_OPPOSITE_PAIRS.find(([a, b]) => !sessionWords.has(a) && !sessionWords.has(b))
    ?? MODEL_OPPOSITE_PAIRS[0]
  );
};

/**
 * ⭐ THE ASSOCIATION MODEL PAIR — the same code-owned device, for the same
 * reason, and it is what makes an OPEN correction possible at all.
 *
 * A closed mode's correction can name the answer, because there is one:
 * `opposite` says "the opposite of big is small" and re-asks. Association has
 * no such line to say. Naming the GENERATED partner ("a sock goes with a
 * shoe") would hand over one of the several honest answers and kill the
 * re-elicit — the child has just been told what to say next, so the retry is
 * free. That is rhyme-studio's finding exactly: its production correction
 * re-models the RIME rather than supplying a rhyme.
 *
 * So the correction models the RELATION on a pair this session never asks
 * about. The child learns what "goes with" means from hammer/nail, and then
 * answers about sock themselves.
 *
 * Pairs are chosen OFF the generator's own curated seed list (sock/shoe,
 * spoon/fork, bed/pillow, cup/plate, dog/bone, key/lock, pencil/paper,
 * bird/nest, toothbrush/toothpaste) so a collision is rare before the
 * session-word filter even runs — and each one takes an article cleanly,
 * which a GENERATED word cannot be trusted to do (the "this is a shoes"
 * trap: the pool carries plurals and mass nouns, so the ask stays
 * article-free and only these code-owned words are ever framed).
 */
const MODEL_ASSOCIATION_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['hammer', 'nail'],
  ['needle', 'thread'],
  ['bread', 'butter'],
  ['brush', 'paint'],
  ['bat', 'ball'],
];

export const pickModelAssociationPair = (
  items: ReadonlyArray<Pick<PictureVocabItem, 'word' | 'baseWord'>>,
): readonly [string, string] => {
  const sessionWords = new Set(
    items.flatMap((i) => [i.word.toLowerCase(), (i.baseWord ?? '').toLowerCase()]),
  );
  return (
    MODEL_ASSOCIATION_PAIRS.find(([a, b]) => !sessionWords.has(a) && !sessionWords.has(b))
    ?? MODEL_ASSOCIATION_PAIRS[0]
  );
};

// ── Small speakable helpers ─────────────────────────────────────────────────

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const ensureEnd = (value: string): string =>
  /[.!?]$/.test(value.trim()) ? value.trim() : `${value.trim()}?`;

/** The scale spoken with the missing rung as "hmm" — stimulus spoken, answer never. */
export const scaleSpokenFor = (item: PictureVocabItem): string =>
  (item.scaleWords ?? [])
    .map((w, i) => (i === item.scaleTargetIndex ? 'hmm' : w))
    .join(', ');

/** The frame with its blank filled — correction territory only. */
export const frameFilledFor = (item: PictureVocabItem): string =>
  (item.frameDisplay ?? '').replace(/_{2,}/, item.word);

/**
 * The frame SPOKEN, with the blank as "hmm" — derived from `frameDisplay` in
 * code, exactly the way `scaleSpokenFor` derives the spoken scale.
 *
 * It used to speak the generator's separate `frameSpoken` field, and the probe
 * caught what that field actually contained: the sentence TRUNCATED AT THE
 * BLANK. "Turn on the ____ when it gets dark." was spoken as "Turn on the...
 * hmm... what?", and "Look at the ____ to see what time it is." as "Look at
 * the... hmm... what?" — so the clause that makes `lamp` and `clock` the one
 * defensible answer was dropped from the only channel a pre-reader has. Four of
 * five asks in one probe had no decidable answer, and the child would be
 * CORRECTED for saying "light" or "book".
 *
 * The mode is vocabulary IN CONTEXT; the context is precisely the tail that was
 * being cut. So the LLM supplies the sentence and CODE builds the spoken form —
 * one source of truth, and the ask can no longer disagree with the correction
 * (which always did read the whole sentence).
 */
export const frameSpokenFor = (item: PictureVocabItem): string =>
  (item.frameDisplay ?? '')
    .replace(/_{2,}/, '... hmm ...')
    // A blank at the END leaves "We sit on a ... hmm ...." — the trailing
    // ellipsis and the sentence's own full stop collide. Keep the punctuation.
    .replace(/\s*\.\.\.\s*([.?!])\s*$/, '$1')
    .trim();

// ── How-to-play — inside the quoted line (SWAP-1), re-spoken on action change ─

/** The two code-owned model pairs a session resolves once. Both are functions
 *  of the session's OWN words (they avoid every word it asks about), so they
 *  are derived in `pictureVocabularyPackBase` and threaded from there — the
 *  harness cannot model a pair the component would never have chosen. */
export interface PictureVocabModelPairs {
  modelPair: readonly [string, string];
  assocPair: readonly [string, string];
}

export const howToPlayFor = (
  item: PictureVocabItem,
  { modelPair, assocPair }: PictureVocabModelPairs,
): string => {
  switch (item.kind) {
    case 'receptive_match':
      return 'I say a word — you tap its picture! ';
    case 'naming':
      return 'When a picture pops up, you say what it is! ';
    case 'opposite':
      return `Opposites are as different as can be — like ${modelPair[0]} and ${modelPair[1]}. I say a word, you say its opposite! `;
    case 'association':
      return `Some things go together, like friends — a ${assocPair[0]} goes with a ${assocPair[1]}. I say a word, you say what goes with it! `;
    case 'gradable_scale':
      return 'I say some words in order. One is missing — you say the missing word! ';
    case 'sentence_frame':
      return 'I say a sentence with a missing word. You say the word that finishes it! ';
  }
};

// ── The asks — short, the problem STATED aloud, one defensible answer ───────
// (di-spoken-practice drive-2 ruling: an ask must SAY its problem — a
// pre-reader cannot read the screen, and every correction re-ask inherits the
// ask. For receptive_match the word IS the question, so it is spoken; for
// naming the picture is the question and the word must never be.)

const askFor = (item: PictureVocabItem): string => {
  switch (item.kind) {
    case 'receptive_match':
      return `Listen: ${item.word}. Your turn. Tap the ${item.word}.`;
    case 'naming':
      return 'Look at the picture. Your turn. What is this?';
    case 'opposite':
      return `${cap(item.baseWord ?? '')}. Your turn. What is the opposite of ${item.baseWord}?`;
    case 'association':
      return `${cap(item.baseWord ?? '')}. Your turn. What goes with ${item.baseWord}?`;
    case 'gradable_scale':
      return `Listen: ${scaleSpokenFor(item)}. Your turn. What word is missing?`;
    case 'sentence_frame':
      return `Listen: ${ensureEnd(frameSpokenFor(item))} Your turn. Say the missing word.`;
  }
};

// ── Corrections — DISTAR re-model then re-elicit (standing gate 3) ──────────
// The answer is EARNED here: this is the first place the tutor may say it.

const correctionFor = (
  item: PictureVocabItem,
  assocPair: readonly [string, string],
): string => {
  switch (item.kind) {
    // NO ARTICLE, and no "this is" frame at all. The first live drive said
    // "My turn: this is a shoes." — the pool is an open LLM word list, so it
    // carries plurals ("shoes") and mass nouns ("soap", "milk", "bread") beside
    // singular count nouns, and English picks the article from a countability
    // the word itself does not carry. `article()` guessed from the first letter,
    // which cannot be right; a stemmer would not be either. The fix is to stop
    // putting the target in a frame that REQUIRES an article — the bare word is
    // the model DISTAR wants anyway, and it is correct for every noun class.
    // (§9 trap 5, third sighting in the family.)
    case 'naming':
      return `My turn: ${cap(item.word)}. Your turn. What is this?`;
    case 'opposite':
      return `My turn: the opposite of ${item.baseWord} is ${item.word}. Your turn. What is the opposite of ${item.baseWord}?`;
    case 'gradable_scale':
      return `My turn: listen. ${(item.scaleWords ?? []).join(', ')}. The missing word is ${item.word}. Your turn. What word is missing?`;
    case 'sentence_frame':
      return `My turn: ${frameFilledFor(item)} ${cap(item.word)}. Your turn. Say the missing word.`;
    /**
     * ⭐ THE ONE CORRECTION IN THIS PACK THAT CANNOT NAME THE ANSWER.
     *
     * Every branch above earns the target here — that is DISTAR, and it is
     * safe because there is exactly one right answer to earn. Association has
     * several, so naming the generated partner would (a) assert one honest
     * answer as THE answer, and (b) hand the child their next line, which
     * makes the re-elicit ceremonial. rhyme-studio hit this first and answered
     * it the same way: model the RULE, not a member of the set.
     *
     * So the relation is modeled on the code-owned pair and the ask returns
     * untouched. The child hears what "goes with" means and still has to do
     * the retrieval.
     */
    case 'association':
      return (
        `My turn: a ${assocPair[0]} goes with a ${assocPair[1]} — we use them together. `
        + `Your turn. What goes with ${item.baseWord}?`
      );
    default:
      // receptive_match corrects through tapVerdictCue, never through this contract.
      return '';
  }
};

/**
 * ⭐ THE ECHO NEEDS ITS OWN SCRIPTED BRANCH — item 24's most transferable
 * finding, ported before it could be rediscovered here.
 *
 * The child says the stimulus straight back. The generic correction re-models
 * the relation on hammer/nail, which is the right move for a wrong partner and
 * a NON-SEQUITUR to an echo, so the model does the sensible thing and goes off
 * script to say something more apt. On the rhyme pilot that line was *"A word
 * does not rhyme with itself in this game."* — right teaching, right refusal,
 * and it opens with NEITHER sentinel, so the engine read no verdict and the
 * loop went deaf. It hit 5 of 9 items, always on the first correction.
 *
 * Deleting the option cards makes it likelier here for the same reason
 * deleting the word bank did there: with nothing to pick from, "say the word
 * back" is the cheapest wrong answer available.
 *
 * Both branches open with `My turn` — the correction sentinel is what the
 * engine classifies on, so a line without it is a line the loop cannot hear.
 */
const echoCorrectionFor = (
  item: PictureVocabItem,
  assocPair: readonly [string, string],
): string =>
  `My turn: ${item.baseWord} cannot go with itself. `
  + `A ${assocPair[0]} goes with a ${assocPair[1]}. `
  + `Your turn. Tell me something different that goes with ${item.baseWord}.`;

/**
 * ⭐ THE THIRD BRANCH — the category word ("clothes" for sock), on exactly the
 * argument that earns the echo its own line: the generic correction does not
 * address what the child actually did, so the model will improvise, and an
 * improvised line opens with no sentinel.
 *
 * It is a DIFFERENT error from a wrong partner and it deserves different
 * teaching. "Clothes" is not a failed guess at a partner; it is a correct
 * observation about the wrong question — the child named the set sock is IN
 * rather than a thing that goes WITH it. This is `opposite`'s base-echo
 * failure in a new coat, and the fix is to name the distinction out loud.
 *
 * The line cannot quote what the child said (a say-exactly line is byte-fixed
 * and the category word is unknown at build time), so it points with "that".
 */
const categoryCorrectionFor = (
  item: PictureVocabItem,
  assocPair: readonly [string, string],
): string =>
  `My turn: that names a whole group. I want one thing. `
  + `A ${assocPair[0]} goes with a ${assocPair[1]}. `
  + `Your turn. What goes with ${item.baseWord}?`;

// ── Judging contracts (spoken modes) ────────────────────────────────────────

/**
 * ⭐ THE OPEN-SET ACCEPT CLAUSE — a RULE where the other four modes have a LIST.
 *
 * ⚠️ THIS IS A HARDER OPEN SET THAN RHYME, and the guards do not transfer by
 * analogy. Rhyme's rule is nearly binary — does it share the rime, is it a
 * real word — so a judge can be wrong about it but cannot RATIONALISE its way
 * to a wrong answer. "Goes with" is semantic, graded and culture-dependent,
 * and a sufficiently helpful model can construct a chain to almost anything
 * ("a cat goes with a sock — cats love to play with socks!"). That is this
 * class's false-affirmation mode and it has no analogue in rhyme.
 *
 * Two things this clause must do that a list does not have to:
 *
 *   AUTHORISE THE UNLISTED PARTNER. `sock → foot`, `sock → drawer`, `sock →
 *   laundry` are all honest answers a five-year-old could give, and NONE of
 *   them is the generated partner. This is the single biggest difference from
 *   rhyme: the correct answer set is genuinely large and genuinely fuzzy, and
 *   a clause that only accepts `shoe` fails real children. It is also the
 *   probe that catches a judge quietly re-closing the set around its own first
 *   guess.
 *
 *   DRAW THE LINE AT THE STORY, IN THE CLAUSE, NOT IN THE JUDGE'S TASTE. The
 *   distinction that separates an honest unlisted partner from a rationalised
 *   chain is whether the connection has to be EXPLAINED. `sock → drawer` needs
 *   no story; `sock → cat` needs one. Writing that test into the contract is
 *   what makes the wide accept side safe.
 *
 * The relation is stated as MUTUAL because the generator emits both directions
 * of every pair (`expandAssociations`), so "what goes with shoe?" is a real
 * ask and "sock" is its answer.
 */
const acceptClauseFor = (item: PictureVocabItem): string => {
  switch (item.kind) {
    case 'association':
      return (
        `The learner has to name a REAL, everyday thing that plainly goes with ${item.baseWord} — `
        // ⭐ NARROWED 2026-09-02 (item 26, lever 2). This read "find with it,
        // use with it, or KEEP WITH IT in ordinary life", and "keep with it"
        // licensed co-membership almost definitionally: things of the same kind
        // are exactly the things most reliably stored together (socks with
        // shirts, mugs with cups, chairs with tables). The bench affirmed 7
        // same-category swaps against a guard that was true but abstract. What
        // is kept now names a PLACE, not a neighbouring THING — which still
        // admits every unlisted partner the 2026-08-21 run got right (`drawer`
        // is a place; `foot`, `shoe`, `saucer`, `tea`, `collar`, `blanket`,
        // `sheet` are all put-on/put-in or used-with).
        + `something you would use with it, put on it or in it, or the place you keep it. `
        + `Things that go together go together BOTH WAYS, so it does not matter which one names the other. `
        + `A DIFFERENT THING that merely shares a place with ${item.baseWord} — the same shelf, the same basket, `
        + `the same group name — is NOT a thing that goes with it. The place itself still counts; another thing standing in it does not. `
        + `Any such thing is correct, INCLUDING ONE YOU DID NOT THINK OF YOURSELF: ${item.baseWord} honestly goes with `
        + `several things, and the first one that came to your mind is not the only right answer. `
        + `Judge the thing you heard, and a small mispronunciation from a five-year-old's mouth still counts. `
      );
    case 'naming':
      return `A different fair name for the same thing — like puppy for a dog — also counts; affirm it and echo "${item.word}". `;
    case 'opposite':
      return `A different word that truly means the opposite also counts; affirm it and echo "${item.word}". `;
    case 'gradable_scale':
      return `A close word that means the same amount also counts; affirm it and echo "${item.word}". `;
    case 'sentence_frame':
      return `A different word that honestly finishes the sentence also counts; affirm it with the word the learner said. `;
    default:
      return '';
  }
};

/**
 * ⭐ THE SIX GUARDS. The honest risk of an open class is FALSE AFFIRMATION, and
 * the two errors are not symmetric: a missed honest partner costs the child one
 * more turn, while an affirmed wrong answer teaches that anything goes with
 * anything. So this is where the mode spends its words.
 *
 * Each guard is a scored bucket in `associationBench.ts` — the contract CLAIMS
 * these are refused and the bench is that claim made testable. Change one,
 * change both.
 *
 * ⭐ SIX GUARDS AND ONE PRECEDENCE LINE, and the precedence line is not a
 * seventh guard — it is the tie-break the 2026-08-21 bench proved was missing
 * (`qa/di-bench/run-2026-08-21-picture-vocabulary-association.md`). Six guards
 * scored 39/48 with `same-category` at 0/8, and the mechanism was not a judge
 * that rationalised: accept and refuse were BOTH true of `shirt` for `sock`
 * and no clause said which won. Carry all three fixes to the remaining
 * `open_set_word` packs BEFORE they are written — a worked counterexample on
 * every guard, no accept phrase that licenses mere co-location, and an
 * explicit refusal-wins line.
 *
 * ⚠️ THERE IS NO NAME CLAUSE HERE, and its absence is deliberate. Rhyme's
 * nonword guard carries one ("Bill" rhymes with "hill") because a name really
 * can be a correct rhyme. A name is not a correct answer to "what goes with
 * sock", so importing that exception would open the exact door the
 * rationalised-chain guard exists to shut. The item-24 lesson that DOES
 * transfer is the principle underneath it — an honest answer you did not list
 * is still an honest answer — and that is carried by the accept clause's
 * unlisted-partner sentence, not by a name exception.
 */
const wrongClauseFor = (item: PictureVocabItem): string => {
  switch (item.kind) {
    case 'association':
      return (
        // ECHO — the stimulus said back, and the cheapest wrong answer now
        // that there is no menu to pick from.
        `The word "${item.baseWord}" said back is NOT the answer, however confident it sounds: a thing does not go with itself. `
        // RATIONALISED CHAIN — THE SIGNATURE FAILURE OF THIS CLASS. Weighted
        // heaviest in the bench, and the only guard with no rhyme analogue.
        + `⭐ If you have to invent a story to explain why the two things go together, THEY DO NOT GO TOGETHER. `
        + `"A cat goes with a sock because cats play with socks" is a story, and that answer is wrong. `
        + `Accept only a plain everyday connection a five-year-old already knows, never one you can construct. `
        // CATEGORY WORD — names the set, not a partner.
        + `The name of the GROUP that ${item.baseWord} belongs to is not the answer either — that names the set ${item.baseWord} is IN, `
        + `and the question asks for one thing that goes WITH it. `
        // SAME-CATEGORY SWAP — same kind of thing is not the same as together.
        //
        // ⭐ THE GUARD THAT LOST 0/8 ON 2026-08-21, AND WHY IT LOST: it was one
        // abstract sentence where the guard that HELD (rationalised-chain,
        // 7/8) ships a worked counterexample. In an open-set contract an
        // abstraction loses to a concrete accept clause — the judge did not
        // rationalise, it applied two simultaneously-true clauses with no
        // precedence between them. So this one now ships its own worked pair,
        // and the pair is deliberately NOT in `associationBench.ts` (apple /
        // banana, couch / sofa): a guard keyed to its own fixture would score
        // the bench rather than the rule.
        + `Another member of that same group is not the answer either: being the same KIND of thing is not the same as going together. `
        + `⭐ An apple is not the answer for a banana. Both are fruit, both sit in the same basket, both travel in the same bag — `
        + `and they still do not go together, because neither is used with, put on, or put in the other. `
        // ⭐ THE HYPONYM CLAUSE, and it is separate from the synonym one because
        // the 2026-09-02 bench showed the synonym sentence alone does not reach
        // it. `sock`, `dog` and `bed` all scored same-category 2/2 with only
        // "a couch is not the answer for a sofa" — and `cup` still affirmed
        // `mug` 1/1, the fixture's own "purest same-category failure". A mug is
        // not a SECOND NAME for a cup, it is a KIND of cup, and nothing in the
        // contract had named that relation. Both halves ship because the two
        // buckets came apart in measurement, not by symmetry.
        + `The same thing under a second name is not the answer either: a couch is not the answer for a sofa. `
        + `⭐ Nor is a KIND of ${item.baseWord}, or the thing ${item.baseWord} is a kind of. `
        + `If you could point at what the learner named and truthfully call it "a ${item.baseWord}", they have named ${item.baseWord} a second time and it is WRONG — `
        + `two of the same thing are not two things that go together. `
        // NONWORD — the failure a closed card set made structurally impossible.
        + `A made-up word is NOT the answer. If what you heard is not a real thing you know, it is wrong. `
        // OFF-TASK — without this the judge has no scripted branch and invents one.
        + `If you did not hear a thing at all, or the learner says they do not know, that is not an answer — treat it as wrong and run the correction. `
        // ⭐ PRECEDENCE — THE CLAUSE THE 2026-08-21 BENCH PROVED WAS MISSING, IN
        // ITS SECOND SHAPE. The first shape was a blunt tie-break ("when two of
        // these rules are both true, THE REFUSAL WINS") and the 2026-09-02 run
        // showed within five probes why that cannot stand: the generated
        // PARTNER was refused. `sock`/`shoe` is simultaneously the curated
        // right answer AND a same-category pair (both footwear), so a rule that
        // makes same-kind decisive at all destroys the answer the mode teaches.
        //
        // The category is not the question and never was. What separates
        // `shoe` from `shirt` is not whether they share a kind with the
        // stimulus — both do — but whether the two things are actually USED
        // together. So precedence is stated as a DISCRIMINATION PAIR: one
        // same-kind pair that is right, one that is wrong, differing only in
        // that. Both examples sit outside `associationBench.ts` for the reason
        // the 2026-09-02 `drawer` false refusal made expensive.
        + `Being the same KIND of thing does not by itself make an answer right, and it does not by itself make one wrong. `
        + `Ask only this: are the two actually used, worn, or put together in ordinary life? `
        + `⭐ A glove goes with a hand — you put one on the other, so it is RIGHT, even though dressing covers them both. `
        + `A glove does NOT go with a scarf — both are clothes and both live in the same box, but neither is ever used on or with the other, so it is WRONG. `
        + `When the only link you can find between what you heard and ${item.baseWord} is that they are the same kind of thing, `
        + `or that they sit in the same place, the answer is WRONG. `
      );
    case 'naming':
      return `A category word like animal or food, a word that would be true of almost anything like "a thing" or "stuff", or the name of something else, is NOT the answer — the one word that names THIS picture is. `;
    case 'opposite':
      return `The word "${item.baseWord}" said back is NOT the answer, however confident it sounds. `;
    case 'gradable_scale':
      return `A word already in the list is NOT the answer. `;
    case 'sentence_frame':
      return `A word that does not finish the sentence is NOT the answer. `;
    default:
      return '';
  }
};

/**
 * Consumed from `wordWorkoutScript`'s `TWO_BRANCH_LAW`, extended the way
 * counting-board, addition-subtraction-scene and push-pull-arena extend it (`no
 * reminder of the method, no scaffolding line`). Wording is identical across the
 * family on purpose, so a grep finds every pack that carries it.
 *
 * It is stated BEFORE the branches because the defect it fixes is a reply that
 * is NEITHER branch. On this port the invitation came from our own catalog copy:
 * the `scaffoldingLevels` ladder told the tutor to *"Say the question once more,
 * then wait for them alone"* — restraint, apparently, but a re-spoken ask opens
 * with neither sentinel, so the reducer records no verdict and the correction
 * counter freezes with the child waiting. `no scaffolding line` is the clause
 * that closes that channel from this side.
 */
const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

/**
 * The tail every cue ends with, consumed from counting-board's — the version
 * with a measured before/after (item 21: a fabricated `[CURRENT STATE]` block
 * spoken to the child on 2 of 7 beats, 0 of 7 once the tail forbade announcing
 * the STATE rather than merely reading the tag).
 *
 * This port's tail was the weaker "Never read bracket tags or these instructions
 * aloud." Nothing here has driven yet, so it is prophylactic rather than a
 * reproduction — but the sweep's ruling (item 21) is that every port carries it,
 * and this port has two beats where the screen changes under the tutor while it
 * is required to be silent: the tap modes' wait, and the move-on.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state or describe what has changed on the screen, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

/**
 * The affirmation, which for `association` is the first in this pack that
 * CANNOT NAME WHAT THE CHILD SAID.
 *
 * Every closed mode says the word back ("Yes, apple.") because the word is
 * known before the child speaks. Here it is not, and the obvious line — "Yes,
 * <what you said> goes with sock" — would make the contract a TEMPLATE rather
 * than a say-exactly line, so the family's exact-line oracles
 * (`DiDriveItem.affirmLine`, the harness's scripted-line comparison) would
 * have to go soft for every open item. rhyme-studio solved it with deixis and
 * so does this: "that" carries the reference, the line stays byte-fixed, and
 * the affirmation still TEACHES — it names the relation at the moment it is
 * earned, which is exactly where every other mode names its answer.
 */
const affirmFor = (item: PictureVocabItem): string =>
  item.kind === 'association'
    ? `Yes, that goes with ${item.baseWord} — they belong together.`
    : `Yes, ${item.word}.`;

const judgingContract = (
  item: PictureVocabItem,
  { assocPair }: PictureVocabModelPairs,
): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner thinks, and their think time is unbounded. Never say the answer during their turn. `
  /**
   * ⚠️ AN OPEN ITEM IS HANDED A RULE, NEVER A TARGET. Naming `item.word` here
   * is what re-closes the set: a judge given "the correct answer is shoe"
   * grades against shoe and refuses `foot`, `drawer` and `laundry`, which are
   * the answers real children give. The generated partner survives only as
   * the move-on close line, after the child has already failed twice.
   */
  + (isOpenSet(item.kind) ? '' : `The correct answer is "${item.word}". `)
  + `${acceptClauseFor(item)}${wrongClauseFor(item)}`
  + TWO_BRANCH_LAW
  + `If the answer is right, say exactly: "${affirmFor(item)}" `
  /**
   * THREE BRANCHES, SPECIFIC FIRST. The model must reach the named case before
   * it meets the catch-all "if it is wrong", or it never gets there.
   *
   * Consequence carried from item 24: the general correction is now the LAST
   * spoken span of an association cue. `DiDriveItem.correctionLine` already
   * takes `spans[spans.length - 1]` for exactly this reason and needs no
   * change — but a test asserting a fixed span INDEX will break here, and
   * should.
   */
  + (isOpenSet(item.kind)
    ? `If the learner said "${item.baseWord}" back to you, say exactly: "${echoCorrectionFor(item, assocPair)}" `
      + `If the learner named the whole group instead of one thing, say exactly: "${categoryCorrectionFor(item, assocPair)}" `
      + `If it is wrong for any other reason, say exactly: "${correctionFor(item, assocPair)}"`
    : `If it is wrong, say exactly: "${correctionFor(item, assocPair)}"`);

/** The SILENCE contract (spell_word's pattern): there is nothing to judge until
 *  the application describes the tap. `receptive_match` is the only mode that
 *  still reaches this — association's silence branch died with its cards. */
const tapContract = (_item: PictureVocabItem): string =>
  `The quoted line is the ONLY thing you say on this turn; the learner answers by TAPPING a picture, not by speaking, so you then stay completely silent. `
  + `Do not describe the pictures, do not narrate, and do not judge anything you hear through the microphone. `
  + `You will be told what the learner tapped and given the exact line to say; only then do you speak.`;

// ── Cues ────────────────────────────────────────────────────────────────────

export interface PictureVocabCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

export interface PictureVocabCueSession {
  modelPair?: readonly [string, string];
  assocPair?: readonly [string, string];
}

const pairsOf = (session: PictureVocabCueSession): PictureVocabModelPairs => ({
  modelPair: session.modelPair ?? MODEL_OPPOSITE_PAIRS[0],
  assocPair: session.assocPair ?? MODEL_ASSOCIATION_PAIRS[0],
});

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line; the catalog only forbids adding to it). */
export const itemCue = (
  item: PictureVocabItem,
  opts: PictureVocabCueOptions = {},
  session: PictureVocabCueSession = {},
): string => {
  const pairs = pairsOf(session);
  const greeting = opts.opening ? 'Hi! Time to play with words! ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item, pairs) : '';
  const spoken = `${greeting}${how}${askFor(item)}`;
  const contract = item.answerKind === 'gesture' ? tapContract(item) : judgingContract(item, pairs);
  return `[PV_ITEM] Say exactly: "${spoken}" ${contract} ${NEVER_PERFORM}`;
};

/**
 * The gesture verdict ask: the match is CODE-COMPUTED and the tutor is handed
 * its exact line (handVerdictCue's pattern).
 *
 * ⚠️ RECEPTIVE_MATCH ONLY. Association had a second pair of branches here and
 * they died with its cards (item 25) — checked before deleting, exactly as the
 * handoff asks: `receptive_match` still needs this cue, so the function stays
 * and only the unreachable half goes. A tapped verdict for a spoken mode is
 * now unrepresentable rather than merely unused.
 */
export const tapVerdictCue = (item: PictureVocabItem, tappedWord: string): string => {
  const matches = tappedWord.toLowerCase() === item.word.toLowerCase();
  const affirm = `Yes! You found the ${item.word}.`;
  const correction = `My turn: listen again. ${cap(item.word)}. Your turn. Tap the ${item.word}.`;
  return (
    `[PV_TAP] The learner tapped the picture of "${tappedWord}"; the right picture is "${item.word}" — `
    + `that ${matches ? 'MATCHES' : 'does NOT match'}. `
    + (matches ? `Say exactly: "${affirm}" ` : `Say exactly: "${correction}" `)
    + NEVER_PERFORM
  );
};

/** Correction cap reached: acknowledge warmly and carry the lesson forward.
 *  Association closes its loop by naming the pair — its corrections never
 *  named the answer, and a capped item must not end with the relation still
 *  unknown. The spoken modes' corrections already modeled the answer twice. */
export const moveOnCue = (
  item: PictureVocabItem,
  next: PictureVocabItem | null,
  opts: PictureVocabCueOptions = {},
  session: PictureVocabCueSession = {},
): string => {
  const pairs = pairsOf(session);
  /**
   * Association closes its loop by naming ONE partner — its corrections never
   * did (an open correction models the relation on a code-owned pair instead,
   * so the retry stays a real retry), and a capped item must not end with the
   * relation still unknown.
   *
   * "One thing that goes with X is Y", not "X goes with Y": the set is open,
   * the child may well have said something else honest, and a line that names
   * the generated partner as THE answer would teach a closed set at the exact
   * moment the mode stops being one.
   */
  const closeLine = item.kind === 'association'
    ? `One thing that goes with ${item.baseWord} is ${item.word} — they belong together. `
    : '';
  if (!next) {
    return `[PV_MOVE] Say exactly: "Good try! ${closeLine}Words take practice — we will see that one again another day." Then stop.`;
  }
  const how = opts.howToPlay ? howToPlayFor(next, pairs) : '';
  const contract = next.answerKind === 'gesture' ? tapContract(next) : judgingContract(next, pairs);
  return `[PV_MOVE] Say exactly: "Good try! ${closeLine}Here comes the next one. ${how}${askFor(next)}" ${contract} ${NEVER_PERFORM}`;
};

export const completeCue = (): string =>
  `[PV_COMPLETE] Say exactly: "What wonderful word work today! Your words grew bigger and stronger. See you next time!" Then stop — the activity is over.`;

/** Tap-to-hear re-speaks the QUESTION, never the answer (the old [ISOLATE_VOWEL]
 *  ladder was an answer leak on demand — cvc-speller's finding; this channel
 *  gets no ladder at all). */
export const pronounceCue = (item: PictureVocabItem): string => {
  const line = (() => {
    switch (item.kind) {
      case 'receptive_match':
        return `${cap(item.word)}. Tap the ${item.word}.`;
      case 'naming':
        return 'What is this? Say what you see!';
      case 'opposite':
        return `${cap(item.baseWord ?? '')}. What is the opposite of ${item.baseWord}?`;
      case 'association':
        return `${cap(item.baseWord ?? '')}. What goes with ${item.baseWord}?`;
      case 'gradable_scale':
        return `${cap(scaleSpokenFor(item))}. What word is missing?`;
      case 'sentence_frame':
        return ensureEnd(frameSpokenFor(item));
    }
  })();
  return (
    `[PV_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${line}" `
    + `Do not treat anything you just heard as an answer, add nothing, and never say the answer word. `
    + NEVER_PERFORM
  );
};

/** Runtime state pushed through the context channel — STIMULUS-SIDE ONLY
 *  (di-math-facts rule): naming pushes no word at all, because its picture's
 *  word IS the answer; every other mode pushes the answer-free question side. */
export const stimulusFor = (item: PictureVocabItem): string => {
  switch (item.kind) {
    case 'receptive_match':
      return item.word; // spoken by the tutor as the question — the PICTURE is the answer
    case 'naming':
      return 'the picture on screen';
    case 'opposite':
    case 'association':
      return item.baseWord ?? '';
    case 'gradable_scale':
      return scaleSpokenFor(item);
    case 'sentence_frame':
      return item.frameDisplay ?? '';
  }
};

// ── The cue surface — one source for the component and the DI harness ───────

/**
 * Everything picture-vocabulary ever sends the tutor. `PictureVocabulary.tsx`
 * spreads this and adds what only a mounted component can own (status lines, and
 * the `diagnosisObservation` that reads the tapped card); the drive-plan endpoint
 * builds the identical cues for the headless judged-loop harness.
 *
 * BOTH MODEL PAIRS are derived here rather than passed in, because each is a
 * function of the session's own words (`pickModelOppositePair` and
 * `pickModelAssociationPair` avoid every word this session asks about).
 * Deriving them inside the surface is what keeps the harness from modeling a
 * pair the component would never have chosen — the exact drift the surface
 * exists to prevent.
 */
export const pictureVocabularyPackBase = (
  items: PictureVocabItem[],
): JudgedCueSurface<PictureVocabItem> => {
  const modelPair = pickModelOppositePair(items);
  const assocPair = pickModelAssociationPair(items);
  return {
    primitiveType: 'picture-vocabulary',
    activityLine: 'live direct instruction picture vocabulary practice',
    items,
    itemCue: (item, opts) => itemCue(item, opts, { modelPair, assocPair }),
    moveOnCue: (item, next, opts) => moveOnCue(item, next, opts, { modelPair, assocPair }),
    completeCue,
    pronounceCue,
    contextFor: (item) => ({
      challengeType: item.kind,
      stimulus: stimulusFor(item),
    }),
  };
};

// ── Harness answer material — what a right and a wrong child sound like ─────

/**
 * The span of the ask inside which the answer legitimately appears.
 *
 * ONLY `receptive_match` has one, and the asymmetry is the pedagogy: there the
 * tutor SAYS the word and the child taps its picture, so the word is the
 * question and the picture is the answer. Every other mode's ask is answer-free
 * by construction — `naming` never says the word, `opposite` and `association`
 * say only the base, the scale speaks "hmm" in the blanked rung, and the build
 * gate now rejects any frame whose spoken form contains its own target.
 *
 * Subtracting the ask keeps the oracle STRONGER than emptying `leakTokens`
 * would: the greeting, the how-to-play and the hand-over are all still governed,
 * so a tutor that names the target while explaining the game is still a HIGH.
 */
export const leakExemptSpanFor = (item: PictureVocabItem): string | undefined =>
  item.kind === 'receptive_match' ? askFor(item) : undefined;

export interface PictureVocabHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  tapped?: { correct: string; wrong: string };
  leakTokens: string[];
  leakExemptSpan?: string;
}

/**
 * ⚠️⚠️ THE INSTRUMENT MISTAKE THAT COST ITEM 24 A VERDICT, AND WHY THIS MODE
 * DERIVES ONLY TWO WRONG ANSWERS.
 *
 * PROBE MATERIAL IS STIMULUS-SPECIFIC. Three separate times on 2026-08-19 the
 * rhyme harness was wrong and the tutor was right, and two of the three first
 * read as product failures: a fixture's rhyme borrowed across stimuli WAS the
 * new item's target; a signature wrong borrowed from another item's echo probe
 * was a perfectly valid answer. A borrowed or careless probe does not fail
 * loudly — it produces a confident, well-formatted finding pointing at the
 * wrong component.
 *
 * Association is MORE exposed to this than rhyme was, because whether a word
 * is "a rationalised chain" or "an honest unlisted partner" is a judgment call
 * a human makes when authoring it — and it cannot be made at all without
 * seeing the stimulus. The generator emits arbitrary pairs, so for a GENERATED
 * item there is no safe way to derive a same-category swap, a category word,
 * or a chain: "cloud" looks like a chain until the stimulus turns out to be
 * "rain".
 *
 * Exactly two wrong answers are safe for EVERY stimulus, because both are
 * wrong BY DEFINITION rather than by semantics:
 *   - the base word said back (an echo is wrong whatever the base is), and
 *   - a nonword (not a word, so it cannot accidentally be an honest partner).
 * Those are the two this function derives. Everything else lives in the
 * hand-authored bench fixture, where a human read the stimulus first.
 */
const ASSOCIATION_NONWORD = 'blen';

/** A concrete noun that is not the target and not already in the sentence —
 *  grammatical in the frame, and false. */
const FRAME_DECOYS = ['table', 'window', 'basket', 'pocket', 'garden'];

/** The wrong card a tap mode commits: a real option from the same session, never
 *  a word the stage does not render. */
const wrongOptionFor = (item: PictureVocabItem): string =>
  (item.options ?? []).find(
    (o) => o.word.trim().toLowerCase() !== item.word.toLowerCase(),
  )?.word ?? '';

/**
 * The answers a headless student says on a judged drive. This lives beside the
 * contract it mirrors on purpose: `wrongClauseFor` above CLAIMS the judge
 * refuses these, and this is the claim made testable. Change one, change both.
 *
 * Each mode's signature wrong is its NAMED miss, said the way a fluent child
 * says it — never a random wrong word:
 *  - `opposite` says the base word back, unchanged and confident. It is this
 *    port's sharpest drive, because the ask just said that word aloud and a
 *    judge grading on "did I hear a real word" affirms it. (sound-swap's
 *    signature error, arriving a third time — the contract names it explicitly.)
 *  - `gradable_scale` says a rung ALREADY ON THE SCALE, which the tutor spoke
 *    seconds earlier as part of the stimulus.
 *  - `naming` says the category ("animal") rather than the member — right about
 *    the picture, and not the word being taught.
 *  - `sentence_frame` says a noun that fits the grammar and not the meaning.
 */
export const pictureVocabularyHarnessAnswers = (
  item: PictureVocabItem,
): PictureVocabHarnessAnswers => {
  const word = item.word;
  const base = { leakTokens: [word], leakExemptSpan: leakExemptSpanFor(item) };

  if (TAP_KINDS.has(item.kind)) {
    const wrong = wrongOptionFor(item);
    return {
      ...base,
      correct: `tapped the picture of ${word}`,
      plainWrong: `tapped the picture of ${wrong || 'something else'}`,
      tapped: { correct: word, wrong },
    };
  }

  switch (item.kind) {
    case 'association':
      return {
        ...base,
        // The generator's partner is a CURATED, hand-checked pair (its prompt
        // seeds sock/shoe, spoon/fork, bed/pillow, …), so it is a safe AFFIRM
        // for a plain drive even though it is not the only right answer.
        correct: word,
        plainWrong: ASSOCIATION_NONWORD,
        signatureWrong: {
          text: item.baseWord ?? '',
          why:
            'the stimulus said straight back — the documented signature error for this mode. The ask itself '
            + 'just spoke that word aloud, and deleting the option cards made it likelier because there is no '
            + 'menu to pick from — so "say the word back" is now the cheapest wrong answer available. '
            + 'It is also the ONLY drive that reaches the scripted echo branch',
        },
      };
    case 'naming':
      return {
        ...base,
        correct: word,
        plainWrong: word.toLowerCase() === 'button' ? 'ladder' : 'button',
        signatureWrong: {
          // "a thing" and not "animal": the probe drew bed, door, soap, cup and
          // clock, none of them animals, so a fixed category word was FALSE of
          // the picture — an easy refuse that tests nothing plainWrong does not.
          // The empty superordinate is TRUE of every picturable noun, which is
          // what makes it the discrimination the accept clause claims: a fair
          // different NAME counts ("puppy" for a dog), a word that merely
          // describes the picture without naming it does not.
          text: 'a thing',
          why: 'the empty superordinate — true of the picture, fluent, and not the word being taught; the one category answer that cannot be refused just for being false',
        },
      };
    case 'opposite':
      return {
        ...base,
        correct: word,
        plainWrong: word.toLowerCase() === 'button' ? 'ladder' : 'button',
        signatureWrong: {
          text: item.baseWord ?? '',
          why: 'the shown word said straight back — fluent, confident, unchanged, and the word the ask itself just spoke aloud',
        },
      };
    case 'gradable_scale': {
      const otherRung = (item.scaleWords ?? []).find(
        (w) => w.trim().toLowerCase() !== word.toLowerCase(),
      );
      return {
        ...base,
        correct: word,
        plainWrong: word.toLowerCase() === 'button' ? 'ladder' : 'button',
        signatureWrong: {
          text: otherRung ?? '',
          why: 'a rung already ON the scale — the tutor spoke it seconds earlier as the stimulus, so a judge matching against what it said affirms it',
        },
      };
    }
    default: {
      const decoy = FRAME_DECOYS.find(
        (d) => d !== word.toLowerCase() && !saysWord(item.frameSpoken, d),
      ) ?? 'table';
      return {
        ...base,
        correct: word,
        plainWrong: word.toLowerCase() === 'button' ? 'ladder' : 'button',
        signatureWrong: {
          text: decoy,
          why: 'a noun that fits the grammar of the frame and not its meaning — the sentence still sounds finished',
        },
      };
    }
  }
};
