/**
 * wordBuilderScript — HAND-AUTHORED judged-loop script for word-builder. The
 * exact wording IS the pedagogy; these lines are authored per pack, never
 * generated. Item CONTENT (which words, which morphemes, which clues) stays
 * generator-scoped; this module owns the cue shapes, the build gates and the
 * reveal policy.
 *
 * ── THE FIRST DI PORT ABOVE THE K-2 BAND ────────────────────────────────────
 * Every judged port before this one teaches a pre-reader or an early reader.
 * word-builder is grades 3-8 morphology, and two things follow from the band:
 * the tone is a teacher's, not a nursery's, and the PRINTED board is legitimate
 * stimulus — this child reads. What does not change is the modality: the tutor
 * asks, waits, judges from the audio in-band, corrects contrastively, and its
 * own affirmation is the advance.
 *
 * ── THE FORK: ALL-VOICE, AND THE TAP WAS THE COSTUME (user ruling) ──────────
 * The port was queued as a hybrid — "tap to build, then speak", on the reading
 * that assembling morphemes in order is the `BUILD` shape the spoken-first
 * ruling exempts. The user overturned it on sight: *"kind of disagree on tap,
 * this feels like a pure spoken with cards on the board"*. That is the correct
 * reading, and the reason is specific rather than doctrinal:
 *
 *   A BUILD is exempt when the arrangement IS the answer and naming it is a
 *   DIFFERENT task. That holds for cvc-speller (saying "cat" does not show you
 *   can spell it — the grapheme choice is invisible in speech) and for
 *   ten-frame (five counters placed is not the word "five"). It does NOT hold
 *   here: /ʌn/-/hɛlp/-/fəl/ is audible in the spoken word, so the utterance
 *   CARRIES the decomposition. Morphemes, unlike graphemes, are pronounceable.
 *
 * This repo had already made the mistake once and written it down. From
 * `phonics-blender`'s catalog block: *"The first port kept a tile-arranging
 * step; driven live the child answered the 'put them in order' ask by SAYING
 * the word, which is the right response to a blending task — so the tiles
 * became a stimulus to read, not pieces to assemble."* Same shape, one layer up
 * the linguistic hierarchy.
 *
 * And the band settles it from the other end: `greek_latin`/`multi_morpheme`
 * exists so a student who meets *telescope* in a text can pronounce it and work
 * out what it means. Saying it aloud IS the assessment. Dragging tiles is a
 * proxy for it.
 *
 * So the CARDS STAY and the CHECK BUTTON GOES. The board is the morpheme word
 * wall a teacher lays on the table — it is what makes this a construction task
 * instead of vocabulary recall, and its printed meanings are the content being
 * taught. It is display, not an answer surface: nothing on it is tappable.
 *
 * ── THE OPEN-SET HALF, REFRAMED RATHER THAN BENCHED ─────────────────────────
 * The queue named the richer ask and named its problem in the same breath:
 * *"tele means far. So what does telescope mean?"* is `open_set_word`, which is
 * BLOCKED. A blocked class is not a licence to add buttons — it is a signal to
 * reframe, so the ask runs the other way. The tutor states the MEANING and the
 * child produces the WORD (`short_spoken_word`, exactly one target). The
 * morphology is not lost by the reversal, it is where it always was: in the
 * board the child reads, in the correction's meaning walk, and in the reveal.
 *
 * ── RESPONSE CLASS ──────────────────────────────────────────────────────────
 * `short_spoken_word` (benched). One caveat stated rather than buried: this
 * port's answers are the LONGEST the class has carried — three and four
 * syllables ("antibiotic", "disagreement") against the class's shipped one- and
 * two-syllable examples. The documented risk in that class runs the other way
 * (VC-length words are unbenched at the SHORT end), and `sentence_read_aloud`
 * is benched well past this length, so the arithmetic holds. It is the one
 * thing a mic sitting should listen for.
 *
 * ── SENTINELS ───────────────────────────────────────────────────────────────
 * Engine defaults ("Yes" / "My turn"), collision-checked in this pack's test
 * file. Generated strings (clues, sentences, morpheme meanings) are ALWAYS
 * introduced mid-sentence rather than opening one, and `itemsFromTargets`
 * additionally DROPS any target whose clue, sentence, word or morpheme text
 * opens a sentence with a sentinel token.
 */

import {
  opensWithSentinel,
  type JudgedCueSurface,
  type JudgedScriptItem,
  type ResponseClassId,
} from '../../../hooks/judgedScriptContract';

// Re-exported so the GENERATOR imports its build gates from one address (the
// decodable-reader / letter-spotter precedent). Two hand-synced copies of a
// sayability bound had already drifted 90-vs-100 on letter-spotter's wire; the
// fix is one owner, not two careful authors.
export { opensWithSentinel };

export type WordBuilderComplexity =
  | 'simple_affix'
  | 'compound_affix'
  | 'greek_latin'
  | 'multi_morpheme';

export type MorphemeType = 'prefix' | 'root' | 'suffix';

// ── The item ────────────────────────────────────────────────────────────────

export interface WordBuilderMorpheme {
  text: string;
  type: MorphemeType;
  meaning: string;
}

export interface WordBuilderItem extends JudgedScriptItem {
  complexity: WordBuilderComplexity;
  /** THE ANSWER. Never printed and never spoken before a verdict. */
  word: string;
  /** The morphemes in canonical order, resolved from the pool. */
  parts: WordBuilderMorpheme[];
  /** The spoken clue — what the word MEANS. Never contains the word. */
  clue: string;
  /** Printed on the reveal only. */
  definition: string;
  /** The context sentence as PRINTED, blank intact ("The lift was ___ for…"). */
  sentenceContext?: string;
  /** The same sentence as SPOKEN, the blank voiced as "hmm". */
  spokenSentence?: string;
}

/**
 * All four complexity levels answer the same way — with the word, out loud.
 * The levels are DIFFICULTY tiers in this primitive's catalog, not task
 * identities, so nothing here forks on them; they vary the CONTENT and the
 * `action`, which is what makes the how-to-play re-speak on a mode switch.
 */
export const answerKindFor = (_complexity: WordBuilderComplexity): 'voice' | 'gesture' => 'voice';

export const responseClassFor = (_complexity: WordBuilderComplexity): ResponseClassId =>
  'short_spoken_word';

// ── Build gates — DROP an unaskable item, never repair it into one ──────────

/** Structural shapes as the generator emits them (duck-typed, so this module
 *  never imports the component — the component imports us). */
export interface WordPartLike {
  id: string;
  text: string;
  type: MorphemeType;
  meaning: string;
}

export interface TargetWordLike {
  word: string;
  parts: string[];
  hint: string;
  definition: string;
  sentenceContext?: string;
}

// ── The invariant spoken frame, and the gate derived from it ────────────────
// Declared here rather than beside the cues because a BUILD GATE reads it.

const GREETING = 'Hi! Today we put words together from their parts. ';

const howToPlayFor = (): string =>
  'The board shows word parts and what each one means. '
  + 'I tell you what a word means, and you put the parts together in your head and say the whole word. ';

/**
 * The DISTAR model, spoken ONCE when the action is introduced — never on every
 * ask. A line that does not change when the item changes is established once,
 * not recited (the 2026-08-13 rulings; `findRepeatedConsecutiveAsks` refuses
 * the recited form in this pack's test file).
 */
const modelLine = (): string =>
  'Every part carries a piece of what the word means, and the parts go in order: '
  + 'the front, then the middle, then the last part. ';

/**
 * ⭐ THE ANSWER MAY NOT BE A WORD WE ALREADY SAY.
 *
 * Every other port's answer is a letter, a sound, a count or a picture name, so
 * "the ask never contains the answer" was a property of the CONTENT. Here the
 * answer is an ordinary English word built by ordinary affixation — and this
 * pack's invariant frame is ordinary English. `build` + `ing` is a legal
 * simple_affix target, and the greeting first drafted here said *"today we are
 * building words"*: the tutor would have spoken the answer inside the
 * how-to-play, before the clue, as part of explaining the game.
 *
 * That is a real leak and not merely a scanning artifact, so it is GATED rather
 * than exempted — which is also what keeps the harness's leak oracle FLAT with
 * no exempt span anywhere (letter-spotter and letter-sound-link both had to
 * issue one; a multi-syllable word collides with nothing EXCEPT us).
 *
 * The token set is DERIVED from the frame rather than listed, so rewording a
 * cue moves the gate with it. Matching is exact-word: "order" is in the model
 * line, and "disorder" is still a perfectly good multi_morpheme target.
 */
const FRAME_TOKENS: Set<string> = new Set(
  [
    GREETING,
    howToPlayFor(),
    modelLine(),
    'Here is what the word means: Your turn. Say the whole word.',
    'Good try! Here comes the next one. The word is means.',
    'Big words come apart the same way every time — we will build more another day.',
    'Great work with word parts today. Once you know the parts, you can work out words you have never seen before. See you next time!',
    'Here it is in a sentence: Find those parts on the board and say the whole word.',
    'My turn: take the meaning apart. One part means.',
  ]
    .join(' ')
    .toLowerCase()
    .match(/[a-z]+/g) ?? [],
);

export const collidesWithSpokenFrame = (word: string): boolean =>
  FRAME_TOKENS.has(word.trim().toLowerCase());

/** One breath. The clue is READ ALOUD as the whole question side, so a runaway
 *  definition is a runaway ask. */
export const MAX_CLUE_CHARS = 120;
/** Longer, because a context sentence carries a clause the clue does not. */
export const MAX_SENTENCE_CHARS = 120;
/** A word a tutor can say. Bounds model babble in an un-enumerable field —
 *  letter-spotter's live probe returned 400 characters of model deliberation in
 *  exactly this kind of slot, and every SEMANTIC gate passed it. */
export const MAX_WORD_CHARS = 24;
/** A morpheme shorter than this has no spoken form: a one-letter part like the
 *  `-y` of bio+log+y is read as a LETTER NAME when the tutor says the assembly
 *  aloud at the affirmation. Dropping the target costs one item; reading "why"
 *  to a child learning that -y makes a noun costs the lesson. */
export const MIN_MORPHEME_CHARS = 2;

const norm = (value: string) => value.trim().toLowerCase();

/** Letters only (plus an internal hyphen for the odd `x-ray` shape), bounded. */
const SAYABLE_WORD_RE = /^[a-z]+(-[a-z]+)?$/i;
export const isSayableWord = (word: string): boolean =>
  SAYABLE_WORD_RE.test(word.trim()) && word.trim().length <= MAX_WORD_CHARS;

/**
 * No blank markers and NO DOUBLE QUOTES: every generated string here is
 * interpolated into a cue's `Say exactly: "…"` span, so an embedded quote
 * CLOSES the span early and everything after it becomes judge-side prose — the
 * same structural surface the performed-`[WAIT silently]` defect lived on.
 */
export const isSayableProse = (text: string, max: number): boolean => {
  const t = text.trim();
  return t.length > 0 && t.length <= max && !/[_"“”]/.test(t) && !/[\r\n]/.test(t);
};

/** The blank, voiced. A pre-blank sentence read with "___" in it is either
 *  silence or the tutor spelling out underscores. */
export const spokenSentenceFrom = (sentence: string): string =>
  sentence.replace(/_{2,}/g, 'hmm').replace(/\s{2,}/g, ' ').trim();

/**
 * One judged item, or null when the target cannot be ASKED. Nothing here
 * backfills: a placeholder in a judged loop becomes a spoken ask the tutor must
 * stand behind, so a broken target is dropped and the session runs shorter.
 *
 * The gates, and what each one closes:
 *  - the word must be sayable and at least TWO morphemes long. A one-morpheme
 *    "build" is not a build, and an unsayable word is an unaskable item.
 *  - every part id must resolve in the pool, and every morpheme must be long
 *    enough to say (see MIN_MORPHEME_CHARS).
 *  - THE MORPHEMES MUST CONCATENATE TO THE WORD, exactly. The affirmation says
 *    the assembly out loud ("Yes, unhelpful — un, help, ful.") and the reveal
 *    prints it, so a target whose parts do not compose its word teaches a false
 *    decomposition at the moment the child is most likely to believe it. Every
 *    worked example in the generator's own prompt composes exactly; the ones
 *    that do not are orthographic-change words (happy+ly → happily) the prompt
 *    now excludes.
 *  - the clue must not contain the word. That is the whole ask: a clue holding
 *    its own answer is read aloud as the question and the answer together.
 *  - nothing generated may open a sentence with a verdict sentinel.
 *
 * The context sentence is SUPPORT, not the ask, so an unusable one is dropped
 * on its own rather than taking the item with it.
 */
export const itemFromTarget = (
  target: TargetWordLike,
  pool: WordPartLike[],
  complexity: WordBuilderComplexity,
): WordBuilderItem | null => {
  const word = (target?.word ?? '').trim();
  if (!isSayableWord(word)) return null;
  if (opensWithSentinel(word)) return null;
  // The tutor must not have said the answer while explaining the game.
  if (collidesWithSpokenFrame(word)) return null;

  const byId = new Map(pool.map((p) => [p.id, p]));
  const ids = target?.parts ?? [];
  if (ids.length < 2) return null;

  const parts: WordBuilderMorpheme[] = [];
  for (const id of ids) {
    const part = byId.get(id);
    if (!part) return null;
    const text = (part.text ?? '').trim();
    // Trailing punctuation is stripped, not tolerated: the meaning is spoken
    // inside "One part means X." and the generator does emit the odd "full of."
    const meaning = (part.meaning ?? '').trim().replace(/[.;,]+$/, '').trim();
    if (text.length < MIN_MORPHEME_CHARS || !/^[a-z]+$/i.test(text)) return null;
    if (!meaning || !isSayableProse(meaning, 40)) return null;
    if (opensWithSentinel(text) || opensWithSentinel(meaning)) return null;
    parts.push({ text, type: part.type, meaning });
  }

  // The assembly the affirmation will say aloud has to be true.
  if (parts.map((p) => norm(p.text)).join('') !== norm(word)) return null;

  const clue = (target?.hint ?? '').trim();
  if (!isSayableProse(clue, MAX_CLUE_CHARS)) return null;
  if (norm(clue).includes(norm(word))) return null;
  if (opensWithSentinel(clue)) return null;

  const definition = (target?.definition ?? '').trim();

  // Support channel: kept only if it is usable in full.
  const rawSentence = (target?.sentenceContext ?? '').trim();
  const spoken = rawSentence ? spokenSentenceFrom(rawSentence) : '';
  const sentenceUsable =
    !!rawSentence
    && /_{2,}/.test(rawSentence)
    && isSayableProse(spoken, MAX_SENTENCE_CHARS)
    && !norm(spoken).includes(norm(word))
    && !opensWithSentinel(spoken);

  return {
    id: word.toLowerCase(),
    answerKind: 'voice',
    responseClass: 'short_spoken_word',
    action: complexity,
    complexity,
    word,
    parts,
    clue,
    definition,
    sentenceContext: sentenceUsable ? rawSentence : undefined,
    spokenSentence: sentenceUsable ? spoken : undefined,
  };
};

/**
 * Build the session, dropping what cannot be asked — AND what cannot be asked
 * SECOND.
 *
 * ⭐ THE SESSION INVARIANT. Every gate above judges one target alone, and there
 * is a leak here that no single target can commit, because both halves of it
 * are correct in isolation:
 *
 *   An item ALWAYS closes by saying its word out loud — the affirmation echoes
 *   it ("Yes, unhelpful — un, help, ful.") and the capped move-on names it. The
 *   generator draws one pool for the whole session, so "helpful" and
 *   "unhelpful" in the same set means item 1 spoke most of item 4's answer, and
 *   a later item on the same word is answered from memory rather than from the
 *   parts.
 *
 * Under the click-era Check button this was invisible: nothing was ever said
 * aloud, so a shared root was just a shared root. It arrives WITH the modality,
 * which is the same place letter-spotter's one-letter-once rule came from.
 *
 * So: a word may be answered once, and no two words in a session may contain
 * one another. A word already SPOKEN in an earlier item's clue or sentence is
 * dropped too — the reverse direction is harmless (a clue may refer to a word
 * the child has already earned).
 *
 * This lives here rather than generator-side because `itemsFromTargets` is the
 * boundary the RUNNER reads, so it also covers hand-authored and cached
 * payloads a prompt fix cannot reach.
 */
export const itemsFromTargets = (
  targets: TargetWordLike[],
  pool: WordPartLike[],
  complexity: WordBuilderComplexity,
): WordBuilderItem[] => {
  const items: WordBuilderItem[] = [];
  const spokenSoFar: string[] = [];

  for (const target of targets ?? []) {
    const item = itemFromTarget(target, pool ?? [], complexity);
    if (!item) continue;
    const word = norm(item.word);

    const overlapsAnswered = items.some((kept) => {
      const other = norm(kept.word);
      return other === word || other.includes(word) || word.includes(other);
    });
    if (overlapsAnswered) continue;

    // Already said out loud as part of an earlier QUESTION.
    if (spokenSoFar.some((said) => said.includes(word))) continue;

    spokenSoFar.push(norm(`${item.clue} ${item.spokenSentence ?? ''}`));
    items.push(item);
  }
  return items;
};

// ── Small speakable helpers ─────────────────────────────────────────────────

/**
 * The morpheme a wrong-but-fluent child says instead of the word. Usually the
 * part typed `root`; the longest part where a payload carries none, so the
 * signature wrong and the contract clause that refuses it always exist.
 */
export const rootPartOf = (item: WordBuilderItem): WordBuilderMorpheme =>
  item.parts.find((p) => p.type === 'root')
  ?? [...item.parts].sort((a, b) => b.text.length - a.text.length)[0];

/** "un, help, ful" — the assembly, spoken. Reached only AFTER a verdict. */
const partWalk = (item: WordBuilderItem): string => item.parts.map((p) => p.text).join(', ');

/**
 * "One part means not. One part means to help. One part means full of."
 *
 * The correction's re-model, and the reason it names MEANINGS and never the
 * morphemes: saying the morphemes in order IS saying the word, so a correction
 * that walked the parts would hand back the answer it is retrying for
 * (letter-spotter's name-it rule). Meanings hand back the ROUTE — the child
 * still has to find each part on the board and put them in order. `moveOnCue`
 * closes the link at the cap, so a capped item never ends with it unmade.
 */
const meaningWalk = (item: WordBuilderItem): string =>
  item.parts.map((p) => `One part means ${p.meaning}.`).join(' ');

// The how-to-play (SWAP-1: inside the quoted line, re-spoken when the ACTION
// changes) and the DISTAR model live UP with the build gates, because
// `collidesWithSpokenFrame` is derived from them. Re-exported here so a reader
// following the cues can find them, and so the test file can pin the wording.
export { GREETING, howToPlayFor };

// ── The ask — short, the problem STATED aloud, one defensible answer ────────

/**
 * The clue is the whole question side and it VARIES every item, so this ask
 * needs no short repeat form: there is new information in it each round.
 *
 * It is introduced ("Here is what the word means:") rather than spoken bare,
 * because a generated clue beginning "Yes, …" would otherwise open a sentence
 * and the engine's verdict scan would read it as a judgment.
 */
const askFor = (item: WordBuilderItem): string =>
  `Here is what the word means: ${item.clue} Your turn. Say the whole word.`;

// ── Corrections — DISTAR re-model then re-elicit (standing gate 3) ──────────

const correctionFor = (item: WordBuilderItem): string => {
  const inSentence = item.spokenSentence
    ? `Here it is in a sentence: ${item.spokenSentence} `
    : '';
  return (
    `My turn: take the meaning apart. ${meaningWalk(item)} ${inSentence}`
    + `Your turn. Find those parts on the board and say the whole word.`
  );
};

/** Echoes the canonical word, then teaches the assembly — the first moment
 *  either may be said aloud. */
const affirmFor = (item: WordBuilderItem): string =>
  `Yes, ${item.word} — ${partWalk(item)}.`;

// ── The 18d law and the item-21 tail (family wording, grep-able) ────────────

/**
 * 18d. Consumed verbatim from `wordWorkoutScript`'s `TWO_BRANCH_LAW`, in the
 * extended form counting-board, addition-subtraction-scene, push-pull-arena,
 * picture-vocabulary, phoneme-explorer, letter-spotter and letter-sound-link
 * all carry. Identical across the family on purpose: a grep finds every pack
 * that has it and every pack that does not.
 *
 * Stated BEFORE the branches because the defect is a reply that is NEITHER
 * branch — and on every port so far the invitation was our own catalog copy.
 */
const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

/**
 * Item 21's tail, consumed from counting-board's — the version with a measured
 * before/after (a fabricated `[CURRENT STATE]` block spoken to the child on 2
 * of 7 beats, 0 of 7 once the tail forbade announcing the STATE rather than
 * merely reading the tag).
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state or describe what has changed on the screen, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

// ── The judging contract ────────────────────────────────────────────────────

/**
 * The answer word rides in the control channel ahead of the attempt, which is
 * the family's shipped shape under the never-say-it law — a judge cannot decide
 * an answer it was never told.
 *
 * TWO signature errors are named, because this port has two fluent misses and
 * both are on the board in front of the child:
 *
 *  1. THE ROOT SAID BACK. A child asked for "unhelpful" who answers "help" has
 *     produced the middle of the word: a real word, a card on the board, the
 *     carrier of the target's core meaning, and the exact thing the tutor's own
 *     correction names the meaning of. A judge listening for "did they say
 *     something from the parts" affirms it. This is the same shape
 *     picture-vocabulary's `opposite` proved (the base word said straight back)
 *     and is what the harness drives as `signatureWrong`.
 *  2. THE PARTS WITHOUT THE WORD. "un… help… ful" and then nothing. Every
 *     phoneme of the answer is present and the word never arrives — the blend
 *     miss, one linguistic layer up. The ACCEPT clause is its twin and has to
 *     be read against it: the same walk that LANDS on the whole word is
 *     correct, and is in fact the DI answer.
 *
 * A partial assembly ("helpful" for "unhelpful") is refused generically rather
 * than by name: it is a real word with the opposite meaning, so it is the miss
 * a judge grading on plausibility is likeliest to take, but which parts it
 * drops varies by item and code cannot tell a real word from a non-word.
 */
const judgingContract = (item: WordBuilderItem): string => {
  const root = rootPartOf(item);
  return (
    `The quoted line is the ONLY thing you say on this turn; you then stay silent `
    + `while the learner thinks, and their think time is unbounded. `
    + `Never say the answer during their turn. `
    + `The correct answer is the word "${item.word}". `
    + `Accept it said inside a phrase, and accept it built out loud part by part so long as the whole `
    + `word arrives at the end — that is how this is taught. A shy or mumbled try still counts. `
    + `Saying only "${root.text}" is NOT an answer however confident it sounds — it is one part of the word, not the word. `
    + `Saying the parts on their own without ever joining them into a whole word is NOT an answer either. `
    + `A different real word built from only some of the parts is wrong. `
    + `The parts said in the wrong order are wrong. `
    + `Any other word is wrong. `
    + TWO_BRANCH_LAW
    + `If the answer is right, say exactly: "${affirmFor(item)}" `
    + `If it is wrong, say exactly: "${correctionFor(item)}"`
  );
};

// ── Cues ────────────────────────────────────────────────────────────────────

export interface WordBuilderCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line; the catalog only forbids adding to it). */
export const itemCue = (
  item: WordBuilderItem,
  opts: WordBuilderCueOptions = {},
): string => {
  // GREETING, not a literal: `collidesWithSpokenFrame` is derived from that
  // constant, and an inline copy here is a spoken line the gate cannot see.
  // (It was inline for exactly one commit, and it said "today we are BUILDING
  // words" — which would have spoken any `build+ing` target's answer aloud in
  // the opening turn, with the gate reporting the word as clean.)
  const greeting = opts.opening ? GREETING : '';
  const introducing = !!(opts.opening || opts.howToPlay);
  const how = introducing ? howToPlayFor() : '';
  const lead = introducing ? modelLine() : '';
  const spoken = `${greeting}${how}${lead}${askFor(item)}`;
  return `[WB_ITEM] Say exactly: "${spoken}" ${judgingContract(item)} ${NEVER_PERFORM}`;
};

/**
 * Correction cap reached: acknowledge warmly and carry the lesson forward. The
 * close line NAMES the word and its parts — the corrections deliberately never
 * did, and a capped item must not end with the meaning-to-word link unmade.
 */
export const moveOnCue = (
  item: WordBuilderItem,
  next: WordBuilderItem | null,
  opts: WordBuilderCueOptions = {},
): string => {
  // Spoken, so the last part gets an "and" — a bare comma list read aloud
  // trails off instead of landing, and this line is the one place a capped
  // item ever hears the link made.
  const glosses = item.parts.map((p) => `${p.text} means ${p.meaning}`);
  const closeLine =
    `The word is ${item.word} — `
    + `${glosses.slice(0, -1).join(', ')}${glosses.length > 1 ? ', and ' : ''}`
    + `${glosses[glosses.length - 1]}. `;
  if (!next) {
    return (
      `[WB_MOVE] Say exactly: "Good try! ${closeLine}Big words come apart the same way every time — we will build more another day." `
      + `Then stop.`
    );
  }
  const introducing = !!opts.howToPlay;
  const how = introducing ? howToPlayFor() : '';
  const lead = introducing ? modelLine() : '';
  return (
    `[WB_MOVE] Say exactly: "Good try! ${closeLine}Here comes the next one. ${how}${lead}${askFor(next)}" `
    + `${judgingContract(next)} ${NEVER_PERFORM}`
  );
};

export const completeCue = (): string =>
  `[WB_COMPLETE] Say exactly: "Great work with word parts today. Once you know the parts, you can work out words you have never seen before. See you next time!" Then stop — the activity is over.`;

/**
 * Tap-to-hear re-speaks the QUESTION, never the answer, and is never withdrawn
 * by band or tier. On this port it carries the context sentence too where the
 * item has one: the sentence is a second route into the same clue, and a child
 * who cannot get there from the definition alone should be able to ask for it
 * without spending a correction.
 */
export const pronounceCue = (item: WordBuilderItem): string => {
  const inSentence = item.spokenSentence ? ` Here it is in a sentence: ${item.spokenSentence}` : '';
  return (
    `[WB_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: `
    + `"Here is what the word means: ${item.clue}${inSentence} Say the whole word." `
    + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. `
    + NEVER_PERFORM
  );
};

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY. It
 * names neither the word nor how many parts it takes: a part COUNT is a real
 * hint (two-part or three-part narrows the search a long way), and a state
 * block is exactly the channel a tutor has been caught narrating.
 *
 * It is also deliberately CONSTANT across a session, which makes the state
 * signature constant, which means `PrimitiveState.attach` fires at most once
 * per run (counting-board finding 3).
 */
export const stimulusFor = (_item: WordBuilderItem): string =>
  'a board of word parts with their meanings, and a spoken clue about what the word means';

// ── THE WIRE — what the tutor is told, shared with the DI drive harness ──────

/**
 * Everything of this pack that can reach the tutor, in one value. The component
 * spreads this and adds only what the SCREEN owns (`statusLines`,
 * `diagnosisObservation`); the drive-plan endpoint hands it to
 * `run_tutor_live.py --di`. A harness that re-typed these cues would test a
 * fiction — the exact drift 19f found on both sides of letter-spotter's wire.
 */
export const wordBuilderPackBase = (
  items: WordBuilderItem[],
): JudgedCueSurface<WordBuilderItem> => ({
  primitiveType: 'word-builder',
  activityLine: 'live direct instruction morphology practice — building words from their parts',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.complexity,
    stimulus: stimulusFor(item),
  }),
});

// ── Harness answer material — what a right and a wrong child sound like ──────

/**
 * The answers a headless student says on a judged drive. It lives beside the
 * contract it mirrors because `judgingContract` CLAIMS the judge refuses each
 * of these; this is that claim made testable. Change one, change both.
 *
 *  - `plainWrong` is the PARTS IN THE WRONG ORDER ("fulhelpun"). Every other
 *    port's plain wrong is an unrelated token; here the natural unambiguous
 *    miss is also a real morphology error, and it is the one thing the printed
 *    board cannot help with — the cards say what each part means and nothing
 *    about where it goes.
 *  - `signatureWrong` is the ROOT said straight back. See the contract above.
 *  - `leakTokens` is the word, and the oracle is FLAT: the ask never says it,
 *    the build gate drops any clue or sentence that contains it, and this
 *    pack's own prose has no exemption to buy. (letter-spotter and
 *    letter-sound-link both needed one because their answer was a single
 *    character; a multi-syllable word collides with nothing.)
 */
export const wordBuilderHarnessAnswers = (item: WordBuilderItem) => {
  const reversed = [...item.parts].reverse().map((p) => p.text).join('');
  const root = rootPartOf(item);
  return {
    correct: item.word,
    plainWrong: reversed,
    signatureWrong: {
      text: root.text,
      why:
        'the root said straight back — it is one of the cards on the board, it carries the target word\'s '
        + 'core meaning, and the tutor\'s own correction says what it means out loud, so a judge listening '
        + 'for "did they say something from the parts" affirms it. The contract names this miss by name',
    },
    leakTokens: [item.word],
  };
};
