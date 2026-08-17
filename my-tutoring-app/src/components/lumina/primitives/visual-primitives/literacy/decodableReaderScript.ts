/**
 * decodableReaderScript — HAND-AUTHORED judged-loop script for decodable-reader
 * (tenth literacy DI port; qa/di/BACKLOG.md item 16). The exact wording IS the
 * pedagogy, so these lines are authored per pack, never generated. Item CONTENT
 * (which passage, which questions) stays generator-scoped; this module owns the
 * cue shapes, the benched scope gates, and the in-band judging contracts.
 *
 * WHAT THE PORT REPLACED. The reading phase was UNMEASURED. A child tapped
 * "I read it!" and the primitive recorded `wordsTapped` — how often they asked
 * for help — as its only reading signal. A child who cannot read a word could
 * tap the button, guess one of three pictures, and finish with 30-100%. The
 * costume test kills the button outright: pressing "Done Reading" requires no
 * reading. So the reading is now READ, out loud, one sentence at a time, and
 * judged word by word.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1) ────────────────────────────────
 * This pack has TWO answers in one run, because the activity asks two different
 * things, and the response-class arithmetic lands differently on each:
 *
 *   read_line     the child reads a printed sentence aloud → `sentence_read_aloud`,
 *                 benched by di-sentence-reading (live-gated 2026-07-25; 2/2 on
 *                 deliberate single-word OMISSIONS, the hardest miss class) at
 *                 3-8 words per judged utterance. A passage is not handed over
 *                 whole — it is judged ONE SENTENCE at a time, inside that
 *                 window. MIN/MAX_SENTENCE_WORDS are IMPORTED from the pack that
 *                 benched them, never re-declared here: a future sitting moves
 *                 the ceiling in exactly one place. (read-aloud-studio, the port
 *                 before this one, made the same move for the same reason.)
 *
 *   answer_spoken the comprehension answer is ONE WORD the child says →
 *                 `short_spoken_word`, benched. This is the honest material for
 *                 a LITERAL question ("What did the cat sit on?" → "mat"): the
 *                 answer is a word stated in the story, so the set is closed by
 *                 the text itself, and oral comprehension questioning is DI's
 *                 own form. It is what gives read_along — a Kindergarten mode
 *                 with no decoding in it — a spoken beat at all.
 *
 *   answer_choice the comprehension answer is a PROPOSITION ("The dog can run")
 *                 → the child SAYS which of the on-screen choices it is →
 *                 `closed_set_choice`. Spoken FREE production of a proposition
 *                 would be `open_set_word` (BLOCKED), and that block is what
 *                 shipped this as a TAP for one day. THE TAP IS GONE (user
 *                 ruling 2026-08-13, from the drive on this primitive: "mode
 *                 sequence/cause effect doesnt let me answer for the 2nd part
 *                 verbally, i need to click on the button even though im
 *                 speaking"). The cards stay on screen — they are what CLOSES
 *                 the set, and their pictures are how a pre-reader holds four
 *                 propositions in mind at once — but they are a menu to read
 *                 from, not a button to press. Third time this ruling has landed
 *                 (rhyme-studio recognition, letter-spotter name-it, this), and
 *                 a blocked class was the excuse all three times.
 *
 * The fork is decided per MODE, with a per-QUESTION fallback: `read_along` and
 * `literal` want the spoken word and fall back to the choice menu when the
 * generator gives no usable one-word answer; `sequence`, `inference` and
 * `main_idea` are proposition-answered and always take the menu. A question that
 * can be asked NEITHER way is DROPPED — never degraded into an ask the tutor
 * cannot judge honestly. EAR-SEPARABILITY is part of "askable" now: a choice set
 * where one option's words are all contained in another's ("A cat." against "A
 * cat and a dog.") cannot be scored from audio at all, so it ships nothing.
 *
 * ── ANSWER-LEAK RULES, WHICH DIFFER PER ITEM KIND ──────────────────────────
 *  - read_line: decoding print IS the skill, so the printed sentence is both the
 *    question and the target and it stays on screen. The leak bites on the AUDIO
 *    channel instead — the tutor must not SPEAK the line before the child reads
 *    it — and `coldReadGuard` says so per item, because the catalog's
 *    scaffolding levels are a second channel that could otherwise re-read it.
 *    The click-era per-word "tap to hear it" is GONE for the same reason: a
 *    channel that speaks any word on demand lets a child hear the whole line and
 *    echo it. Being stuck is answered by the CORRECTION, which re-models — that
 *    is what DISTAR does with a stuck reader.
 *  - answer_spoken: the story is the STIMULUS and reading it aloud (read_along)
 *    is the task's premise, not a leak. But tap-to-hear must NOT re-read it:
 *    for a literal question the story contains the answer verbatim, so
 *    re-speaking it on demand would answer the ask. Tap-to-hear re-speaks the
 *    QUESTION only (cvc-speller's `[ISOLATE_VOWEL]` finding: this channel gets
 *    no ladder at all).
 *  - answer_choice: the ask necessarily speaks every choice, and the cards print
 *    them. That is the QUESTION side — unmarked print is not a leak. What the
 *    correction must never do is name the right card, or the retry stops being a
 *    retry; the answer is named only when the correction cap is reached.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn") — collision-checked by
 * validateJudgedScriptPack in this pack's test file. Because GENERATED text
 * (passage sentences, questions, option text, the answer word) is interpolated
 * into spoken cues, anything whose own sentence opens with a sentinel is DROPPED
 * at build (`findSentinelCollisions` reused as the gate rather than re-rolled),
 * and the generator refuses the same shapes on its side of the wire.
 */

import type {
  JudgedCueSurface,
  JudgedScriptItem,
  ResponseClassId,
} from '../../../hooks/judgedScriptContract';
import { opensWithSentinel, spokenSpansOf } from '../../../hooks/judgedScriptContract';
import {
  MAX_SENTENCE_WORDS,
  MIN_SENTENCE_WORDS,
} from '../direct-instruction/diSentenceReadingScript';

/** The benched judged-utterance window, re-exported so the component, the
 *  generator and the tests all read the SAME numbers the bench sitting set. */
export { MAX_SENTENCE_WORDS, MIN_SENTENCE_WORDS };

/** The eval-mode identities. `read_along` is the Kindergarten shared-reading
 *  mode (the tutor reads, the child answers); the other four are comprehension
 *  SKILLS asked after the child has read the passage themselves. */
export type DecodableReaderMode =
  | 'read_along'
  | 'literal'
  | 'sequence'
  | 'inference'
  | 'main_idea';

export type DecodableItemKind = 'read_line' | 'answer_spoken' | 'answer_choice';

/** Modes whose comprehension answer is a single word STATED IN THE STORY, and
 *  therefore a closed spoken set. The other three are proposition-answered. */
const SPOKEN_ANSWER_MODES: ReadonlySet<DecodableReaderMode> = new Set<DecodableReaderMode>([
  'read_along',
  'literal',
]);

/** Standing gate 1: what each item's answer is MADE of. Every kind is SPOKEN —
 *  there is nothing to tap in this pack. */
export const responseClassFor = (kind: DecodableItemKind): ResponseClassId =>
  kind === 'read_line'
    ? 'sentence_read_aloud'
    : kind === 'answer_spoken'
      ? 'short_spoken_word'
      : 'closed_set_choice';

export interface DecodableWord {
  id: string;
  text: string;
  phonicsPattern: string;
}

export interface DecodableOption {
  id: string;
  text: string;
  emoji?: string;
}

export interface DecodableReaderItem extends JudgedScriptItem {
  kind: DecodableItemKind;
  /** read_line: the printed sentence, exactly as shown and exactly as read.
   *  answer_*: unused (the question carries the ask). */
  text: string;
  /** read_line: 3-8, computed in code from the words, never from the model. */
  wordCount: number;
  /** read_line: per-word phonics tags — the phonics tint, render only. */
  words?: DecodableWord[];
  /** answer_*: the comprehension question, spoken by the tutor. */
  question?: string;
  /** answer_spoken: the one-word answer. */
  answerWord?: string;
  /** answer_spoken: the story sentence the answer came from — the correction's
   *  re-model, found in CODE so no new generator field has to be trusted. */
  evidenceLine?: string;
  /** answer_choice: the cards on screen (the closed set the child picks from
   *  ALOUD), and which one is right. */
  options?: DecodableOption[];
  correctOptionId?: string;
  /** read_along only: the whole story, read aloud in the OPENING cue. */
  storyText?: string;
  /**
   * The passage's CONTENT words, on every comprehension item and in both modes.
   * It never reaches the tutor — `contextFor` pushes the question alone — and
   * it exists so the harness can say "a word from the story that does not
   * answer this question", the miss `spokenAnswerContract` singles out.
   *
   * Content, not all, and the split is FREE: every word is already tagged with
   * its phonics pattern, and `sight` is this generator's tag for exactly the
   * words that carry no meaning ("the, a, is, was, are, they, have, said,
   * with"). Drawn from the evidence sentence the miss came out "with"; drawn
   * from the untagged passage it came out "have"; drawn from the tagged one it
   * is "frog" for *"What animal is in the tank?"* — a same-category story word,
   * which is the version a lenient judge actually affirms.
   */
  storyContentWords?: string[];
}

// ── Small helpers ───────────────────────────────────────────────────────────

/** Printed/spoken form. Double quotes are stripped — a stray `"` would close
 *  the `Say exactly: "…"` span the tutor reads. */
export const sanitize = (raw: string): string =>
  (raw ?? '').replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();

export const wordsIn = (text: string): number =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

const cap = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const stripEnd = (value: string): string => value.replace(/[.!?]+$/, '').trim();

const asQuestion = (value: string): string =>
  /[.!?]$/.test(value.trim()) ? value.trim() : `${value.trim()}?`;

/** A string whose own sentence would OPEN a spoken line with a verdict sentinel
 *  cannot be interpolated into a cue — the reducer would read the tutor's
 *  re-model as a judgment. Now the family export (this wrapper was written here
 *  first, then hand-copied into two more files; it lives in the contract). */
export { opensWithSentinel };

/** Words that are their own verdict class. "yes"/"no" as a spoken ANSWER is the
 *  `yes_no` class (build-ahead, and "no" is VC-length, which `short_spoken_word`
 *  records as unbenched) — a literal question answered that way falls through to
 *  the cards instead of laundering an unbenched class through this pack. */
const VERDICT_WORDS: ReadonlySet<string> = new Set(['yes', 'yeah', 'no', 'nope']);

const normalizeWord = (value: string): string =>
  sanitize(value).toLowerCase().replace(/[^a-z0-9' -]/g, '').trim();

// ── Item building — the gates live HERE, not in prose ───────────────────────

export interface DecodableSentenceLike {
  id?: string;
  words?: Array<{ id?: string; text: string; phonicsPattern?: string }>;
}

export interface DecodableQuestionLike {
  question: string;
  /** The one-word answer for a literal / read-along question. */
  answerWord?: string;
  options?: DecodableOption[];
  correctOptionId?: string;
}

/** The printed text of one passage sentence, joined exactly as it is rendered
 *  so print and speech can never disagree. */
export const sentenceText = (sentence: DecodableSentenceLike): string =>
  sanitize((sentence.words ?? []).map((w) => w.text).join(' '));

/** The whole passage as one block — the read-along stimulus and the end-of-run
 *  reward view. */
export const passageTextFrom = (sentences: DecodableSentenceLike[]): string =>
  sanitize(sentences.map(sentenceText).join(' '));

/**
 * The passage's meaning-bearing words, read off the phonics tags the generator
 * already produced: `sight` is its tag for the words that carry none ("the, a,
 * is, was, are, they, have, said, with"), which is the same list a hand-written
 * stop set would be — except this one comes with the data instead of drifting
 * beside it. Used for the harness's story-word miss; see `storyContentWords`.
 */
export const contentWordsOf = (sentences: DecodableSentenceLike[]): string[] =>
  Array.from(new Set(
    sentences
      .flatMap((s) => s.words ?? [])
      .filter((w) => (w.phonicsPattern ?? 'other') !== 'sight')
      .map((w) => normalizeWord(w.text))
      .filter((w) => w.length >= 3),
  ));

/**
 * Build one READ item, or return null to DROP the sentence. Drop reasons:
 *  - outside the BENCHED 3-8 word window (a longer read is unbenched; a shorter
 *    one is a phrase, not a sentence);
 *  - a sentence inside it opens with "Yes" or "My turn" (sentinel);
 *  - nothing left after sanitising.
 * A dropped sentence ships nothing. It is never trimmed to fit — a trimmed
 * sentence is a DIFFERENT sentence, and the child is looking at the printed
 * original.
 */
export const readItemFromSentence = (
  sentence: DecodableSentenceLike,
  index: number,
): DecodableReaderItem | null => {
  const text = sentenceText(sentence);
  if (!text || !/[a-z]/i.test(text)) return null;

  const wordCount = wordsIn(text);
  if (wordCount < MIN_SENTENCE_WORDS || wordCount > MAX_SENTENCE_WORDS) return null;
  if (opensWithSentinel(text)) return null;

  return {
    id: sentence.id ? `line-${sentence.id}` : `line-${index + 1}`,
    kind: 'read_line',
    answerKind: 'voice',
    responseClass: responseClassFor('read_line'),
    action: 'read_line',
    text,
    wordCount,
    words: (sentence.words ?? []).map((w, i) => ({
      id: w.id ?? `w-${index + 1}-${i + 1}`,
      text: w.text,
      phonicsPattern: w.phonicsPattern ?? 'other',
    })),
  };
};

/** The story sentence a one-word answer came from — the DISTAR re-model for a
 *  missed comprehension question, computed in code rather than trusted from a
 *  new generator field. Undefined when the word is not in the story (an
 *  inference-shaped answer) or when the sentence could not be spoken safely. */
export const evidenceLineFor = (
  answerWord: string,
  sentences: DecodableSentenceLike[],
): string | undefined => {
  const target = normalizeWord(answerWord);
  if (!target) return undefined;
  for (const sentence of sentences) {
    const hit = (sentence.words ?? []).some((w) => normalizeWord(w.text) === target);
    if (!hit) continue;
    const text = sentenceText(sentence);
    if (!text || opensWithSentinel(text)) return undefined;
    return text;
  }
  return undefined;
};

/**
 * Can these choices be told apart BY EAR? The child names one out loud, so every
 * option needs at least one word no other option has. The shape this refuses is
 * the SUBSET: "A cat." beside "A cat and a dog." — a child who says "a cat" has
 * named both, and there is no honest verdict for that utterance. Leniency is not
 * the fix (it would score a wrong answer right half the time); the ask is.
 *
 * Exported because the generator runs the same gate on its side of the wire —
 * one call re-drawn beats a question silently dropped on screen.
 */
export const optionsEarSeparable = (options: DecodableOption[]): boolean => {
  const wordsOf = (option: DecodableOption) =>
    normalizeWord(option.text).split(/\s+/).filter(Boolean);
  return options.every((option, i) => {
    const others = new Set(options.flatMap((o, j) => (j === i ? [] : wordsOf(o))));
    return wordsOf(option).some((word) => !others.has(word));
  });
};

/**
 * Is this option short enough for a five-year-old to hold and SAY BACK? The
 * ceiling is the benched one, not a new number: the child names this card out
 * loud, and `sentence_read_aloud` was benched at 3-8 words per judged
 * utterance. A card past it asks for an utterance no sitting has covered — and
 * the tutor has to read three or four of them in one breath before the child
 * may answer. Over-long cards are DROPPED, never trimmed: a trimmed option is a
 * different proposition, and the correct one may be the one that got shorter.
 */
export const optionSayable = (option: DecodableOption): boolean =>
  wordsIn(sanitize(option.text)) <= MAX_SENTENCE_WORDS;

/** Are these cards a fair, askable, SAYABLE closed set? */
const choiceOptionsUsable = (q: DecodableQuestionLike): boolean => {
  const options = q.options ?? [];
  if (options.length < 2) return false;
  if (!q.correctOptionId || !options.some((o) => o.id === q.correctOptionId)) return false;
  if (!options.every((o) => !!sanitize(o.text) && !opensWithSentinel(o.text))) return false;
  if (!options.every(optionSayable)) return false;
  return optionsEarSeparable(options);
};

/**
 * Build one COMPREHENSION item, or return null to DROP the question.
 *
 * The fork: the spoken modes take a usable one-word answer; everything else
 * takes the cards; a question that can be asked neither way ships nothing.
 * "An ambiguous ask is not a harder task, it is a broken one" — there is no
 * third branch that loosens the judging instead.
 */
export const answerItemFromQuestion = (
  q: DecodableQuestionLike,
  index: number,
  mode: DecodableReaderMode,
  sentences: DecodableSentenceLike[] = [],
): DecodableReaderItem | null => {
  const question = asQuestion(sanitize(q.question ?? ''));
  if (!question || !/[a-z]/i.test(question)) return null;
  if (opensWithSentinel(question)) return null;

  const id = `q-${index + 1}`;
  const answerWord = normalizeWord(q.answerWord ?? '');
  const spokenUsable =
    SPOKEN_ANSWER_MODES.has(mode)
    && !!answerWord
    && wordsIn(answerWord) <= 2
    && !VERDICT_WORDS.has(answerWord)
    && !opensWithSentinel(answerWord);

  if (spokenUsable) {
    return {
      id,
      kind: 'answer_spoken',
      answerKind: 'voice',
      responseClass: responseClassFor('answer_spoken'),
      action: 'answer_spoken',
      text: question,
      wordCount: wordsIn(question),
      question,
      answerWord,
      evidenceLine: evidenceLineFor(answerWord, sentences),
    };
  }

  if (!choiceOptionsUsable(q)) return null;

  return {
    id,
    kind: 'answer_choice',
    answerKind: 'voice',
    responseClass: responseClassFor('answer_choice'),
    action: 'answer_choice',
    text: question,
    wordCount: wordsIn(question),
    question,
    options: (q.options ?? []).map((o) => ({ id: o.id, text: sanitize(o.text), emoji: o.emoji })),
    correctOptionId: q.correctOptionId,
  };
};

/**
 * The ANSWER this item closes on, normalised — a one-word answer or a whole
 * proposition, whichever this item's material is. Undefined for a read line,
 * whose "answer" is the printed sentence itself.
 */
export const answerKeyOf = (item: DecodableReaderItem): string | undefined =>
  item.kind === 'answer_spoken'
    ? normalizeWord(item.answerWord ?? '') || undefined
    : item.kind === 'answer_choice'
      ? normalizeWord(stripEnd(correctOptionText(item))) || undefined
      : undefined;

/**
 * ⭐ THE SESSION INVARIANT: THE TUTOR MAY NOT NAME THE SAME ANSWER TWICE
 * (19h-i-b port 8, sweep §4(d)).
 *
 * No single item can violate this and no per-item gate can see it. Every
 * comprehension item closes by SAYING its answer out loud — `affirmLine` is
 * "Yes, mat." or "Yes! The dog can run.", the correction re-models it, and a
 * capped choice question names it in `moveOnCue`. So once one question has
 * closed, its answer is no longer something the child retrieves from the story:
 * it is something they were just told. A second question with the same answer
 * measures recall of the tutor's own last sentence.
 *
 * It is a live risk on this port rather than a theoretical one: a K passage is
 * two or three sentences and the generator is asked for two questions about it,
 * so "What did the cat sit on?" and "Where did the cat nap?" both land on "mat".
 * The prompt already forbids it; this is the boundary the RUNNER reads, so it
 * also covers hand-authored and cached payloads a prompt fix cannot reach.
 *
 * ⭐ AND THE TWO SETS STAY SEPARATE (port 7's amendment, applied in the other
 * direction). Port 7 also had to bar an answered thing from coming back as the
 * WRONG choice. That rule does NOT transfer here, and gating it would starve a
 * two-question draw for nothing:
 *  - a distractor that is a true story detail already named is the trap the
 *    generator is deliberately told to build for `inference` / `main_idea`
 *    ("distractors should be true passage details that are too narrow"), and a
 *    child who picks it has made the intended error, not a free one;
 *  - a later answer WORD spoken earlier is not spent either, because the whole
 *    story is in the room by design — the child read every sentence aloud
 *    (decode) or the tutor read it aloud (read_along). What an earlier item
 *    spends is a whole ANSWER the tutor named AS the answer, nothing less.
 *
 * A duplicate LINE is dropped by the same pass and for the same reason: the read
 * affirmation restates the sentence ("Yes, that says The dog can run"), so the
 * second printing of it is an echo, not a decode.
 */
const dropRepeatAnswers = (items: DecodableReaderItem[]): DecodableReaderItem[] => {
  const named = new Set<string>();
  const printed = new Set<string>();
  const kept: DecodableReaderItem[] = [];
  for (const item of items) {
    if (item.kind === 'read_line') {
      const line = normalizeWord(item.text);
      if (printed.has(line)) continue;
      printed.add(line);
      kept.push(item);
      continue;
    }
    const key = answerKeyOf(item);
    if (key && named.has(key)) continue;
    if (key) named.add(key);
    kept.push(item);
  }
  return kept;
};

/**
 * The whole run, in order: every readable passage sentence, then every askable
 * question. In `read_along` there are NO read items — the child is a pre-reader
 * and the tutor reads the story — so the story rides the first question's
 * opening cue as its stimulus instead.
 *
 * TWO WHOLE-RUN gates, because a comprehension question is only askable when
 * the child has actually met the story:
 *  - read_along whose STORY would make a spoken sentence open with a verdict
 *    sentinel ships nothing. The tutor reads that story aloud, and the reducer
 *    would score its own narration as an affirmation and advance the lesson
 *    before the child said a word. There is no safe degrade: cutting the
 *    offending sentence is a different story, and the answer may live in it.
 *  - a DECODE run where every sentence dropped ships nothing either. The stage
 *    shows one line at a time, so with no lines the child never sees the
 *    passage, and a comprehension question about a story they were never shown
 *    is not a harder question — it is a broken one.
 */
export const buildItems = (
  sentences: DecodableSentenceLike[],
  questions: DecodableQuestionLike[],
  mode: DecodableReaderMode,
): DecodableReaderItem[] => {
  const isReadAlong = mode === 'read_along';

  const lines = isReadAlong
    ? []
    : sentences
        .map((s, i) => readItemFromSentence(s, i))
        .filter((item): item is DecodableReaderItem => item !== null);
  if (!isReadAlong && lines.length === 0) return [];

  const storyText = isReadAlong ? passageTextFrom(sentences) : undefined;
  if (isReadAlong && (!storyText || opensWithSentinel(storyText))) return [];

  const storyContentWords = contentWordsOf(sentences);
  const answers = questions
    .map((q, i) => answerItemFromQuestion(q, i, mode, sentences))
    .filter((item): item is DecodableReaderItem => item !== null)
    .map((item) => ({ ...item, storyContentWords, ...(storyText ? { storyText } : {}) }));

  return dropRepeatAnswers([...lines, ...answers]);
};

/**
 * The payload boundary, shared by the component and the DI drive harness. Both
 * used to re-derive the mode and coalesce the legacy single-question field for
 * themselves; a harness that re-typed either would drive a different session
 * from the one the child gets.
 *
 * `dropped` counts what the build gates refused — the word window, the sentinel
 * scan, the answer-material fork, ear-separability and the session invariant
 * above — against what was askable in this mode (a read-along has no read
 * items, so its passage sentences were never candidates).
 */
export interface DecodableReaderPayload {
  readingMode?: 'decode' | 'read_along';
  comprehensionType?: 'literal' | 'sequence' | 'inference' | 'main_idea';
  passage?: { sentences?: DecodableSentenceLike[] };
  comprehensionQuestions?: DecodableQuestionLike[];
  comprehensionQuestion?: DecodableQuestionLike;
}

export const itemsFromChallenges = (
  data: DecodableReaderPayload,
): { items: DecodableReaderItem[]; mode: DecodableReaderMode; dropped: number } => {
  const mode: DecodableReaderMode =
    data.readingMode === 'read_along' ? 'read_along' : (data.comprehensionType ?? 'literal');
  const sentences = data.passage?.sentences ?? [];
  const questions =
    data.comprehensionQuestions ?? (data.comprehensionQuestion ? [data.comprehensionQuestion] : []);
  const items = buildItems(sentences, questions, mode);
  const askable = (mode === 'read_along' ? 0 : sentences.length) + questions.length;
  return { items, mode, dropped: Math.max(0, askable - items.length) };
};

// ── How-to-play — inside the quoted line (SWAP-1), re-spoken on action change ─

export const howToPlayFor = (item: DecodableReaderItem): string => {
  switch (item.kind) {
    case 'read_line':
      return 'I show you one line of our story. You read it out loud, all by yourself! ';
    case 'answer_spoken':
      return 'Now I ask you about the story, and you tell me out loud! ';
    case 'answer_choice':
      return 'Now I ask you about the story and say what the answers could be. You tell me the one you pick! ';
  }
};

// ── The asks ────────────────────────────────────────────────────────────────
//
// Every ask STATES its problem aloud: a K-2 reader may not be able to read the
// question, and every correction re-ask inherits the ask. The read line is the
// exception in the other direction — it is on screen in print, which IS the
// mode, so the ask must NOT contain it.

/** The choices spoken as one fair list. Trailing periods are stripped so the
 *  list reads as a list, and the ORDER is the on-screen order — a child who
 *  SAYS "the second one" must be naming the card in the second position. */
export const choicesSpokenFor = (item: DecodableReaderItem): string => {
  const texts = (item.options ?? []).map((o) => stripEnd(o.text)).filter(Boolean);
  if (texts.length === 0) return '';
  if (texts.length === 1) return texts[0];
  return `${texts.slice(0, -1).join(', ')}, or ${texts[texts.length - 1]}`;
};

export const askFor = (item: DecodableReaderItem): string => {
  switch (item.kind) {
    case 'read_line':
      return 'Your turn. Read it.';
    case 'answer_spoken':
      return `Your turn. ${item.question}`;
    case 'answer_choice':
      return `Your turn. ${item.question} Is it ${choicesSpokenFor(item)}? Tell me which one.`;
  }
};

const LISTEN_LEAD = 'Listen to our story.';

/** read_along opens by READING THE STORY — that is the mode's stimulus and the
 *  child cannot decode it. Only the opening cue carries it; later questions in
 *  the same run ask against the story the child already heard.
 *
 *  Exported as a SPAN (rather than inlined) because the leak oracle has to
 *  subtract it: a read-along answer word is inside the story by construction —
 *  story-talk's rule, and the same one the ask/answer split comes apart on. */
export const storyLeadInSpan = (item: DecodableReaderItem): string =>
  item.storyText ? `${LISTEN_LEAD} ${item.storyText} ` : '';

const storyLeadIn = (item: DecodableReaderItem, opening: boolean): string =>
  opening ? storyLeadInSpan(item) : '';

/**
 * The read line is decoded COLD. The omitted model already withholds it (the
 * tutor may speak only what "Say exactly" quotes), but this makes it explicit
 * per item — the catalog's scaffolding levels are a second channel that could
 * re-read it, and a guard hidden in an omission is only half applied
 * (di-sentence-reading's tier gotcha).
 */
const coldReadGuard = (item: DecodableReaderItem): string =>
  item.kind === 'read_line'
    ? ' The learner is reading this one cold on purpose: do NOT read the line, or any part of it, before they do.'
    : '';

// ── Verdict lines ───────────────────────────────────────────────────────────

export const correctOptionText = (item: DecodableReaderItem): string =>
  (item.options ?? []).find((o) => o.id === item.correctOptionId)?.text ?? '';

/** Affirmation. MUST open "Yes" — the engine scans that sentinel. The reading
 *  affirm RESTATES the line (di-sentence-reading bench question (c), settled
 *  with evidence: it models the correct reading when it is most useful). */
export const affirmLine = (item: DecodableReaderItem): string => {
  switch (item.kind) {
    case 'read_line':
      return `Yes, that says ${item.text}`;
    case 'answer_spoken':
      return `Yes, ${item.answerWord}.`;
    case 'answer_choice':
      return `Yes! ${stripEnd(correctOptionText(item))}.`;
  }
};

/** Reading correction — CONTRASTIVE, the preferred branch whenever the miss can
 *  be localised. Byte-for-byte di-sentence-reading's line, which OVERTURNED the
 *  plain re-model in the first live correction run in any DI pack: a whole-line
 *  re-model asks the learner to diff it against their memory of what they just
 *  said, which they cannot do, so they never learn WHICH word was wrong.
 *  `⟨…⟩` is a slot the tutor fills from the audio; it is not spoken, and the
 *  opener stays "My turn" exactly — classification matches OPENERS only. */
export const contrastCorrectionLine = (item: DecodableReaderItem): string =>
  `My turn: not ⟨what they said⟩ — ${item.text} Your turn. Read it again.`;

/** Reading correction — FALLBACK, for the miss with nothing to contrast against
 *  (silence, unintelligible, a slip that cannot be pinned to words). Standing
 *  gate 3: every correction re-models, then re-elicits. */
export const correctionLine = (item: DecodableReaderItem): string =>
  `My turn: ${item.text} Your turn. Read it again.`;

/**
 * Comprehension correction (spoken answers). The answer is EARNED here — this
 * is the first place the tutor may say it. Where the answer is a word from the
 * story, the re-model is THE STORY SENTENCE IT CAME FROM, which teaches the
 * looking-back move instead of just handing over a word.
 */
export const answerCorrectionLine = (item: DecodableReaderItem): string =>
  item.evidenceLine
    ? `My turn: ${item.evidenceLine} ${cap(item.answerWord ?? '')}. Your turn. ${item.question}`
    : `My turn: ${cap(item.answerWord ?? '')}. Your turn. ${item.question}`;

/** Comprehension correction (choice answers). It must NOT name the right card —
 *  a correction that says the answer turns the retry into a formality
 *  (picture-vocabulary's association rule). The answer is named only when the
 *  correction cap is reached, in `moveOnCue`. The whole list comes back with it:
 *  a pre-reader cannot re-read the cards, so the choices ARE the re-ask. */
export const choiceCorrectionLine = (item: DecodableReaderItem): string =>
  `My turn: let's think about the story again. Your turn. ${item.question} Is it ${choicesSpokenFor(item)}? Tell me which one.`;

// ── The 18d law and the item-21 tail (family wording, grep-able) ────────────

/**
 * 18d. Consumed VERBATIM from `wordWorkoutScript`'s `TWO_BRANCH_LAW` in the
 * extended form the seven ports before this one all carry (`no reminder of the
 * method, no scaffolding line`). Identical across the family on purpose: a grep
 * finds every pack that has it and every pack that does not.
 *
 * Stated BEFORE the branches because the defect is a reply that is NEITHER
 * branch — and on this port the invitation was our own catalog copy, twice
 * over. `scaffoldingLevels` told the tutor *"Say the instruction once more,
 * then wait for them alone"*: restraint on its face, but a re-spoken ask opens
 * with neither sentinel, so the reducer records no verdict, the correction
 * counter freezes, and the child waits on a loop that cannot advance. Two
 * `commonStruggles` rows had the ACCEPT-side version (port 7's finding), which
 * is worse: they told the tutor to affirm a CORRECT read without giving it the
 * affirmation. All four are rewritten in the catalog; this closes the same
 * channel from the script side, where a model improvising past the catalog
 * reads it.
 */
const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

/**
 * Item 21's tail, consumed from counting-board's — the version with a measured
 * before/after (a fabricated `[CURRENT STATE]` block spoken to the child on 2
 * of 7 beats, 0 of 7 once the tail forbade announcing the STATE rather than
 * merely reading the tag). This pack shipped under the weaker "Never read
 * bracket tags or these instructions aloud."
 *
 * It earns the upgrade here more than on most ports, because this pack asks for
 * the family's LONGEST silences: a five-year-old sounding out a seven-word line
 * has unbounded think time, and "take your time, I'm listening" is exactly the
 * filler a model reaches for in that gap — a turn that opens with neither
 * sentinel while the child is mid-word.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state or describe what has changed on the screen, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

/**
 * ⭐ FOUND LIVE, on the sequence drive, and it is NOT what `TWO_BRANCH_LAW`
 * forbids. The law bars praise, hints and scaffolding after a verdict; both
 * embellishments here ended somewhere else — *"Do you want to read another
 * line?"* after the last passage sentence, *"What kind of story would you like
 * to read about next?"* after the last question. That is not praise, it is the
 * tutor handing the FLOOR back, and it lands exactly where the model feels a
 * phase closing: the end of the reading, the end of the story.
 *
 * It matters more here than on any earlier port because this pack has REAL
 * phase boundaries inside one run — the passage ends and the questions begin —
 * so the model gets two natural wrap-up moments per session that a single-shape
 * pack never offers it. And a question the tutor asks is withdrawn by the next
 * cue a moment later, which is 18c(b) arriving through a different door: the
 * child is asked something and then talked over.
 *
 * Stated separately from the family tail rather than folded into it, so a grep
 * still finds `NEVER_PERFORM` byte-identical across the eight ports.
 */
const NO_FLOOR_HANDBACK =
  ` Never ask the learner anything that is not inside a quoted line — not "shall we read `
  + `another?", not "what would you like to do next?", not at the end of the reading and not `
  + `at the end of the story. The activity chooses what comes next and says it for you, so a `
  + `question of your own is taken away from the child before they can answer it.`;

// ── Judging contracts ───────────────────────────────────────────────────────

const readingContract = (item: DecodableReaderItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner reads, and their think time is unbounded — decoding takes time. `
  + TWO_BRANCH_LAW
  + `Judge the audio you heard against the printed line "${item.text}" read aloud, every word in order.\n`
  + `- Every word read correctly and in order, including after they catch and fix their own slip: say exactly "${affirmLine(item)}" and stop.\n`
  + `- A word skipped, added, or read as a DIFFERENT word, and you can tell WHICH words came out wrong: say exactly "${contrastCorrectionLine(item)}" and stop — the learner tries again while you stay silent. Replace ⟨what they said⟩ with the words they actually read in place of the printed ones — just those words, not the whole line ("not the pot", "not ran fast"). Never speak the ⟨ ⟩ marks, and change nothing else in the line. Naming their error is the point of this branch: it is the only way they learn WHICH word to fix.\n`
  + `- Anything else — silence, an unintelligible attempt, or a miss you cannot pin to particular words: say exactly "${correctionLine(item)}" and stop — the learner tries again while you stay silent.\n`
  + `Slow, effortful sounding-out that lands on the right words is CORRECT — judge accuracy, never speed. `
  + `The commonest miss is a small word swapped for another small word — "the" for "a", "and" for "then", "her" for "his". It sounds fluent and it is still wrong. `
  + `Do not accept a near-miss word to be kind: a different word is a different word. `
  + `The learner may pause in the middle; a pause is part of one reading, so wait for them to finish the whole line before judging it. `
  + `If they miss the SAME word again, use the contrast branch again — do not fall back to the plain re-model, and do not invent a third wording. `
  + `Never begin any other sentence with the word "Yes" or the words "My turn".`;

/**
 * Spoken comprehension. THE SIGNATURE ERROR is the one this task manufactures:
 * a word lifted straight out of the story that does not answer the question. It
 * arrives fluent and confident precisely BECAUSE it came from the text, and it
 * is the miss a judge left to its own kindness will wave through. The accept
 * side is the answer inside a phrase — a child who says "on the mat" has
 * answered "mat", and refusing that would be grading grammar, not comprehension.
 */
const spokenAnswerContract = (item: DecodableReaderItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner thinks about the story, and their think time is unbounded. `
  + `Never say the answer during their turn. `
  + `The correct answer is "${item.answerWord}". `
  + `The answer said inside a phrase or a short sentence — "on the mat" for "mat" — is CORRECT; affirm it and echo "${item.answerWord}". `
  + `A different word that truly names the same thing is CORRECT too; affirm it and echo "${item.answerWord}". `
  + `A word from the story that does NOT answer this question is wrong, however confident it sounds — it sounds right because it came from the story, and that is exactly the miss to catch. `
  + `The question said back to you, or a retell of the whole story, is not an answer either. `
  + TWO_BRANCH_LAW
  + `If the answer is right, say exactly: "${affirmLine(item)}" and stop. `
  + `If it is wrong, say exactly: "${answerCorrectionLine(item)}" and stop — the learner tries again while you stay silent. `
  + `Never begin any other sentence with the word "Yes" or the words "My turn".`;

/**
 * Spoken choice from the printed menu. THE ACCEPT SIDE IS THE WHOLE DESIGN: a
 * five-year-old asked "is it the cat sat on the mat, or the cat ran to the box?"
 * answers "the mat" — not the sentence back. A contract that demands the full
 * string would fail children for recall while calling it comprehension, which is
 * exactly the ablation the tap was supposed to avoid. What it must NOT do is
 * stretch that latitude into "close enough": the choices are ear-separable by
 * build gate, so one of them is named or none is.
 */
const spokenChoiceContract = (item: DecodableReaderItem): string => {
  const options = item.options ?? [];
  const numbered = options.map((o, i) => `${i + 1}) "${stripEnd(o.text)}"`).join(' ');
  const correctIndex = options.findIndex((o) => o.id === item.correctOptionId) + 1;
  return `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner thinks about the story, and their think time is unbounded. `
    + `Never say which one is right and never hint at it: working it out from the story is the whole task. `
    + `The learner answers OUT LOUD, by telling you which choice they pick. `
    + `The choices, in the order you just said them, are: ${numbered}. `
    + `The correct one is number ${correctIndex}. `
    + `They have named a choice if they say the whole thing, OR just the part that tells it apart from the others `
    + `("the mat" for "The cat sat on the mat"), OR what its picture shows, OR where it is in the list ("the second one", "the last one"). `
    + `A young child answers with the short form far more often than the whole sentence, and the short form is a full answer, not a lesser one. `
    + TWO_BRANCH_LAW
    + `If they named the correct choice, say exactly: "${affirmLine(item)}" and stop. `
    + `If they named a different one, say exactly: "${choiceCorrectionLine(item)}" and stop — the learner tries again while you stay silent. `
    + `If you truly cannot tell WHICH choice they meant — they trailed off, or what they said fits two of them — do not guess and do not judge: `
    + `say exactly "Tell me that one again." and wait for them. `
    + `Never begin any other sentence with the word "Yes" or the words "My turn".`;
};

const contractFor = (item: DecodableReaderItem): string => {
  switch (item.kind) {
    case 'read_line':
      return readingContract(item);
    case 'answer_spoken':
      return spokenAnswerContract(item);
    case 'answer_choice':
      return spokenChoiceContract(item);
  }
};

// ── Cues ────────────────────────────────────────────────────────────────────

export interface DecodableCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

const GREETING = 'Hi! Time for a story! ';

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line; the catalog only forbids adding to it). */
export const itemCue = (
  item: DecodableReaderItem,
  opts: DecodableCueOptions = {},
): string => {
  const greeting = opts.opening ? GREETING : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  const story = storyLeadIn(item, !!opts.opening);
  return `[DR_ITEM] Say exactly: "${greeting}${how}${story}${askFor(item)}"${coldReadGuard(item)} `
    + `${contractFor(item)} ${NEVER_PERFORM}${NO_FLOOR_HANDBACK}`;
};

/** Cap-reached prose, hoisted so the leak oracle can subtract the words this
 *  pack's own invariant lines contain (see `PACK_PROSE_TOKENS`). A move-on
 *  carries the NEXT item's ask, so its prose is scanned against the NEXT item's
 *  leak tokens — "we will read that one again another **day**" against a
 *  passage word "day" is a false HIGH nobody would trace. */
const SORRY_READ = 'Good try. We will read that one again another day. ';
const SORRY_ANSWER = 'Good try. ';
const END_OF_STORY = 'That is the end of our story time.';

/**
 * Correction cap reached: acknowledge warmly and carry the lesson forward. A
 * hard line comes back through distributed review, not by drilling a
 * discouraged reader in place. A capped CHOICE question closes by naming the
 * answer — its corrections never did, and the child must not leave the story
 * still not knowing (picture-vocabulary's closeLine rule); the spoken modes'
 * corrections already modelled theirs twice.
 */
export const moveOnCue = (
  item: DecodableReaderItem,
  next: DecodableReaderItem | null,
  opts: DecodableCueOptions = {},
): string => {
  const closeLine = item.kind === 'answer_choice'
    ? `The answer was ${stripEnd(correctOptionText(item))}. `
    : '';
  const sorry = item.kind === 'read_line' ? SORRY_READ : SORRY_ANSWER;
  if (!next) {
    return `[DR_MOVE] Say exactly: "${sorry}${closeLine}${END_OF_STORY}" `
      + `Then stop — the activity is over. ${NEVER_PERFORM}${NO_FLOOR_HANDBACK}`;
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  return `[DR_MOVE] Stop correcting "${item.id}". Say exactly: `
    + `"${sorry}${closeLine}${how}${askFor(next)}"${coldReadGuard(next)} `
    + `${contractFor(next)} ${NEVER_PERFORM}${NO_FLOOR_HANDBACK}`;
};

/** The closing line. read_along never asked the child to read, so it must not
 *  congratulate them for reading — the praise has to be true. */
export const completeCue = (mode: DecodableReaderMode): string =>
  mode === 'read_along'
    ? `[DR_COMPLETE] Say exactly: "You listened to the whole story and you knew all about it. Great story time today!" Then stop — the activity is over. ${NEVER_PERFORM}${NO_FLOOR_HANDBACK}`
    : `[DR_COMPLETE] Say exactly: "You read the whole story and you knew all about it. Great reading today!" Then stop — the activity is over. ${NEVER_PERFORM}${NO_FLOOR_HANDBACK}`;

/** Tap-to-hear: the QUESTION side again, never an answer. On a read line that
 *  is the instruction alone — the line stays unspoken, which is the mode; on a
 *  comprehension question it is the question (and, for the cards, the choices),
 *  never the story, which for a literal question contains the answer verbatim. */
export const pronounceCue = (item: DecodableReaderItem): string =>
  `[DR_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${askFor(item)}"`
  + `${coldReadGuard(item)} `
  + `Do not treat anything you just heard as an answer, add nothing, never say the answer, and do not re-read the story. `
  + NEVER_PERFORM + NO_FLOOR_HANDBACK;

/**
 * Runtime state pushed through the context channel, ANSWER-FREE by
 * construction: a comprehension item pushes its question only — never the
 * answer word, never the right card, and never the story (which on a literal
 * question would carry the answer into the tutor's runtime state for no reason:
 * the judging contract already tells it what the answer is).
 *
 * ⭐ AND A READ LINE PUSHES NO LINE AT ALL. It used to push the sentence, on the
 * reasoning that print is already in front of the child — which is true of the
 * PRINT channel and false of the one that matters. The signature drive on
 * `sequence` caught the consequence on three consecutive asks: the tutor
 * fabricated a `[CURRENT STATE]` block and read
 * *"the stimulus reading text on screen now is: His frog can hop on a rug"*
 * ALOUD, before the child read a word of it. That is the whole measurement
 * gone — the child echoes instead of decoding.
 *
 * The mechanism is this port's alone, and it is worth stating because it is
 * invisible on every other pack: a non-opening read ask is *"Your turn. Read
 * it."* — four words that name nothing, BY DESIGN, because the cold read is the
 * mode. A model handed a near-empty line and a state block containing the
 * sentence fills the silence from the state block. The catalog's own
 * taskDescription was the invitation, in as many words: *"that thing … reads:
 * {{stimulus}}"*.
 *
 * So the line stops travelling. The judging contract still quotes it — that is
 * where the tutor genuinely needs it, at the moment it judges — and the state
 * block now says only what KIND of thing is on screen and that it must not be
 * spoken. The `NEVER_PERFORM` tail was already present and did not prevent it:
 * a rule against narrating the state loses to a state block that is the only
 * content in the room.
 */
export const stimulusFor = (item: DecodableReaderItem): string =>
  item.kind === 'read_line'
    ? `a ${item.wordCount}-word line of the story, printed on the screen in front of the learner `
      + `and deliberately withheld from you — they are reading it cold, so you have not been told `
      + `what it says and must not guess, describe or announce it`
    : (item.question ?? '');

// ── THE WIRE — what the tutor is told, shared with the DI drive harness ──────

/**
 * Everything of this pack that can reach the tutor, in one value.
 *
 * The component spreads this and adds only what the SCREEN owns (`statusLines`,
 * `diagnosisObservation`); the drive-plan endpoint hands it to
 * `run_tutor_live.py --di`. A harness that re-typed these cues would test a
 * fiction — and this pack's di-script suite was already carrying a hand-rolled
 * copy of the pack literal, the eighth port in the sweep to do so.
 *
 * `mode` rides in because it is the one thing a cue needs that no ITEM carries:
 * the closing line must not congratulate a read-along child for reading.
 */
export const decodableReaderPackBase = (
  items: DecodableReaderItem[],
  mode: DecodableReaderMode,
): JudgedCueSurface<DecodableReaderItem> => ({
  primitiveType: 'decodable-reader',
  activityLine: 'live direct instruction decodable story reading with comprehension',
  items,
  itemCue,
  moveOnCue,
  completeCue: () => completeCue(mode),
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.kind,
    stimulus: stimulusFor(item),
  }),
});

// ── Harness answer material — what a right and a wrong child sound like ──────

const tokensOf = (text: string): string[] =>
  normalizeWord(text).split(/[\s-]+/).filter(Boolean);

/**
 * Small words a K-2 reader swaps for one another without noticing. Both halves
 * of the pair are here so the swap is reversible: this is the substitution the
 * READING contract calls "the commonest miss", and the harness has to be able
 * to produce the exact utterance the contract claims to refuse.
 */
const FUNCTION_SWAPS: Record<string, string> = {
  the: 'a', a: 'the', an: 'the', and: 'then', then: 'and',
  on: 'in', in: 'on', at: 'to', to: 'at', is: 'was', was: 'is',
  his: 'her', her: 'his', my: 'the', we: 'they', they: 'we',
  can: 'will', it: 'that', of: 'for', for: 'of', up: 'down', down: 'up',
};

/** Bare alphabetic core of a printed token, so punctuation survives a swap. */
const bareOf = (word: string): string => word.replace(/[^A-Za-z']/g, '');

const substitute = (word: string, replacement: string): string => {
  const bare = bareOf(word);
  const cased = /^[A-Z]/.test(bare) ? cap(replacement) : replacement;
  return word.replace(bare, cased);
};

/**
 * The line with ONE small word swapped for its partner — fluent, and wrong.
 *
 * The swap must be an utterance a real child could produce, or the drive stops
 * testing the miss it claims to: the first signature run said *"A pets are at
 * home"*, which no five-year-old says, so a judge could refuse it as gibberish
 * rather than as the wrong word. One skip covers it — an article in front of a
 * plural — and the scan moves to the next candidate ("they" → "we", which is
 * what the same line produces and what the same child actually says).
 */
const looksPlural = (word: string): boolean => {
  const bare = bareOf(word).toLowerCase();
  return bare.length > 3 && bare.endsWith('s') && !bare.endsWith('ss');
};

const swapOneSmallWord = (text: string): string | null => {
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i += 1) {
    const swap = FUNCTION_SWAPS[bareOf(words[i]).toLowerCase()];
    if (!swap) continue;
    if ((swap === 'a' || swap === 'the' || swap === 'an')
        && words[i + 1] && looksPlural(words[i + 1])
        && swap !== 'the') continue;
    const out = [...words];
    out[i] = substitute(words[i], swap);
    return out.join(' ');
  }
  return null;
};

const DECOY_WORDS = ['box', 'pig', 'cup', 'hat', 'bed'];
/** Nouns that belong to no K-2 decodable passage we generate — the answer a
 *  child who did not read at all would give. */
const OFF_STORY_WORDS = ['rocket', 'pizza', 'dinosaur', 'umbrella'];

const firstAbsent = (pool: string[], haystack: string): string => {
  const norm = ` ${normalizeWord(haystack)} `;
  return pool.find((word) => !norm.includes(` ${word} `)) ?? pool[0];
};

/** The line with one CONTENT word replaced — an unambiguous miss the tutor can
 *  pin to particular words, which is the contrastive branch. */
const swapOneBigWord = (text: string): string => {
  const words = text.split(/\s+/);
  const decoy = firstAbsent(DECOY_WORDS, text);
  for (let i = words.length - 1; i >= 0; i -= 1) {
    const bare = bareOf(words[i]);
    if (bare.length < 3 || FUNCTION_SWAPS[bare.toLowerCase()]) continue;
    const out = [...words];
    out[i] = substitute(words[i], decoy);
    return out.join(' ');
  }
  // Nothing swappable (a line of small words): an ADDED word is a miss too.
  return `${decoy} ${text}`;
};

/** The words of this option that appear in NO other option — the same set
 *  `optionsEarSeparable` gates on, which is why the short form below is always
 *  unambiguous by construction rather than by hope. */
const distinctiveWordsOf = (item: DecodableReaderItem, option: DecodableOption): string[] => {
  const others = new Set(
    (item.options ?? [])
      .filter((o) => o.id !== option.id)
      .flatMap((o) => tokensOf(o.text)),
  );
  return tokensOf(option.text).filter((word) => !others.has(word));
};

/**
 * How a five-year-old names a card: the tail from the first word that tells it
 * apart. "The dog can run." → "run"; "A trip to the moon." → "trip to the moon".
 * The choice contract calls this a full answer, not a lesser one, so the harness
 * says it on the CORRECT beat too — driving the accept clause on every plain
 * run rather than only on the signature one.
 */
const shortFormOf = (item: DecodableReaderItem, option: DecodableOption): string => {
  const printed = stripEnd(sanitize(option.text));
  const words = printed.split(/\s+/).filter(Boolean);
  const distinctive = new Set(distinctiveWordsOf(item, option));
  const start = words.findIndex((word) => distinctive.has(normalizeWord(word)));
  if (start <= 0) return printed;
  const tail = words.slice(start).join(' ');
  return tail.charAt(0).toLowerCase() + tail.slice(1);
};

const probeItem = (kind: DecodableItemKind): DecodableReaderItem => ({
  id: 'prose-probe',
  kind,
  answerKind: 'voice',
  responseClass: responseClassFor(kind),
  action: kind,
  text: '',
  wordCount: 0,
  question: '',
  options: [],
});

/**
 * ⭐ WHY THIS PORT'S LEAK ORACLE SUBTRACTS ITS OWN PROSE.
 *
 * Every earlier port's answer is a thing the pack never says by accident — a
 * number word, an anchor word, a phoneme. Here the answer is a SENTENCE OF
 * ENGLISH, drawn from the K-2 sight-word core, so its words collide with the
 * pack's own scripted lines: "we will read that one again another **day**" in
 * the move-on prose against a passage that says "The dog naps all day."
 *
 * That matters because the move-on beat is scanned with the NEXT item's tokens,
 * so a collision fires as a HIGH on a cue that leaked nothing. The set is built
 * from the SPOKEN SPANS of the pack's own cues rather than hand-listed (§4(f):
 * two half-maps in two files is how port 7 shipped an unnameable picture) — a
 * reworded line moves the exemption with it, in one place.
 *
 * The cost is narrow and worth naming: a passage word that is also one of our
 * prose words stops being a leak token. A 3-8 word line has several content
 * words and any ONE of them fires the oracle, so the read-line scan — the
 * strongest one this port has, because it catches the tutor reading the line
 * before the child — survives losing one.
 */
const PACK_PROSE_TOKENS: ReadonlySet<string> = (() => {
  const kinds: DecodableItemKind[] = ['read_line', 'answer_spoken', 'answer_choice'];
  const cues = kinds
    .flatMap((kind) => {
      const probe = probeItem(kind);
      return [
        itemCue(probe, { opening: true, howToPlay: true }),
        moveOnCue(probe, null),
        pronounceCue(probe),
      ];
    })
    .concat([completeCue('read_along'), completeCue('literal')]);
  return new Set(cues.flatMap(spokenSpansOf).flatMap(tokensOf));
})();

/** Answer tokens worth scanning for: long enough to mean something, and not a
 *  word this pack's own invariant prose already says. */
const leakTokensFrom = (words: string[]): string[] =>
  Array.from(new Set(words.map(normalizeWord)))
    .filter((word) => word.length >= 3 && !PACK_PROSE_TOKENS.has(word));

/** Structurally `DiHarnessAnswers`, declared here so the script module never
 *  imports the service layer that consumes it (`diDrivePlan` imports US). */
export interface DecodableHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  leakTokens: string[];
  leakExemptSpan?: string | string[];
}

/**
 * The answers a headless student says on a judged drive. It lives beside the
 * contract it mirrors because each contract CLAIMS the judge refuses exactly
 * these; this is that claim made testable. Change one, change both.
 *
 * THREE KINDS OF ANSWER, THREE SIGNATURE MISSES, AND EACH ONE IS THE MISS ITS
 * OWN CONTRACT SINGLES OUT:
 *
 *  - **read_line: one small word swapped for another** — "the" for "a", "and"
 *    for "then". `readingContract` names it as "the commonest miss… it sounds
 *    fluent and it is still wrong", and it is the whole reason this pack judges
 *    word by word instead of on the gist. A judge grading a read for meaning
 *    affirms it every time. The plain wrong swaps a CONTENT word instead, which
 *    is unambiguous and localisable — the contrastive branch.
 *  - **answer_spoken: a word lifted straight out of the story that does not
 *    answer the question.** `spokenAnswerContract` calls this "the miss to
 *    catch" and says why: it arrives fluent and confident precisely BECAUSE it
 *    came from the text. It is drawn from `evidenceLine` — the very sentence
 *    the real answer lives in — so it is the hardest version of itself.
 *  - **answer_choice: the SHORT FORM of a wrong card.** The choice contract's
 *    accept side is its whole design ("just the part that tells it apart" is a
 *    full answer, not a lesser one), and this is that same latitude aimed at
 *    the wrong card. A judge that matches a fragment loosely affirms it. The
 *    plain wrong is a wrong card said in full.
 *
 * THE LEAK ORACLE FORKS THREE WAYS TOO, AND ONE FORK IS THIS PORT'S SHARPEST:
 *
 *  1. `read_line` scans the LINE'S OWN CONTENT WORDS with no exemption at all.
 *     Decoding print is the skill and the printed line is in front of the
 *     child, so print is not the channel — the AUDIO is, and the catalog's
 *     scaffolding levels are a second channel that could re-read it. This is
 *     the `NEVER READ A LINE THE CHILD HAS NOT READ YET` directive made
 *     machine-checkable, and no earlier port has an equivalent.
 *  2. `answer_spoken` scans the answer word flat in DECODE mode — the tutor
 *     never reads the story there, the child does — and subtracts the story in
 *     `read_along`, where the tutor reads it aloud by design and the answer is
 *     a word inside it (story-talk's rule, second sighting).
 *  3. `answer_choice` subtracts the spoken menu, because naming every card IS
 *     the ask (push-pull-arena's two-word menu, one size up). The greeting, the
 *     how-to-play, the question and the hand-over stay governed — which is
 *     where a tutor that singles a card out would actually do it.
 */
export const decodableReaderHarnessAnswers = (
  item: DecodableReaderItem,
): DecodableHarnessAnswers => {
  if (item.kind === 'read_line') {
    const smallSwap = swapOneSmallWord(item.text);
    return {
      correct: item.text,
      plainWrong: swapOneBigWord(item.text),
      ...(smallSwap && smallSwap !== item.text
        ? {
            signatureWrong: {
              text: smallSwap,
              why: 'one small word swapped for another — the miss the reading contract '
                + 'calls the commonest one there is. It keeps the meaning, it keeps the '
                + 'rhythm, and a judge grading the read for gist rather than word by word '
                + 'affirms it, which is the whole thing this pack exists not to do',
            },
          }
        : {}),
      // The words the tutor would say if it read the line first. Sight words are
      // excluded because the pack's own prose is made of them; see
      // PACK_PROSE_TOKENS for the second half of that subtraction.
      leakTokens: leakTokensFrom(
        (item.words ?? [])
          .filter((word) => word.phonicsPattern !== 'sight')
          .map((word) => word.text),
      ),
    };
  }

  if (item.kind === 'answer_spoken') {
    const answer = item.answerWord ?? '';
    // The story word that makes the HARDEST version of this miss. Three passes,
    // each one learned from a probe that came out weak: draw from the CONTENT
    // words of the whole passage rather than the evidence sentence (which gave
    // "with" — a word from the story, and a preposition no judge would affirm)
    // or the untagged passage ("have"); skip words the QUESTION already said,
    // because those are the contract's separate "said the question back to you"
    // refusal; and take the longest, which on a K-2 word list is the noun.
    // The fallback covers hand-authored payloads with no phonics tags.
    const pool = item.storyContentWords?.length
      ? item.storyContentWords
      : tokensOf(item.evidenceLine || item.storyText || '');
    const inQuestion = new Set(tokensOf(item.question ?? ''));
    const candidates = Array.from(new Set(pool))
      .filter((word) => word.length >= 3 && word !== normalizeWord(answer) && !FUNCTION_SWAPS[word])
      .sort((a, b) => b.length - a.length);
    const storyDecoy = candidates.find((word) => !inQuestion.has(word)) ?? candidates[0];
    const leadIn = storyLeadInSpan(item);
    return {
      correct: answer,
      plainWrong: firstAbsent(
        OFF_STORY_WORDS,
        `${pool.join(' ')} ${item.storyText ?? ''} ${item.question ?? ''} ${answer}`,
      ),
      ...(storyDecoy
        ? {
            signatureWrong: {
              text: storyDecoy,
              why: 'a word lifted straight out of the story — out of the very sentence the '
                + 'real answer lives in — that does not answer the question. The contract '
                + 'names this one and says why it is hard: it sounds right BECAUSE it came '
                + 'from the text, so a judge checking only "did I hear a story word" affirms it',
            },
          }
        : {}),
      leakTokens: leakTokensFrom([answer]),
      ...(leadIn ? { leakExemptSpan: leadIn } : {}),
    };
  }

  // answer_choice
  const options = item.options ?? [];
  const correctOption = options.find((o) => o.id === item.correctOptionId);
  const wrongOption = options.find((o) => o.id !== item.correctOptionId);
  const plainWrong = wrongOption ? stripEnd(sanitize(wrongOption.text)) : 'nothing';
  // The SHORTEST utterance that still names a wrong card: its longest
  // distinctive word on its own ("climb", "ship"). `shortFormOf`'s tail
  // collapses to the whole card whenever the distinguishing word comes FIRST,
  // which the sequence probe hit on both of its questions and which left the
  // signature drive byte-identical to the plain one — a wasted session. A bare
  // word is always available (ear-separability guarantees one) and it is the
  // harder test: maximally fragmentary, still unambiguous by build gate.
  //
  // Words the QUESTION already said are skipped for the same reason the spoken
  // miss skips them — "would" out of *"What WOULD happen if…"* names no card,
  // it echoes the ask, and the inference probe picked it on length alone.
  const askedWords = new Set(tokensOf(item.question ?? ''));
  const wrongWords = wrongOption
    ? distinctiveWordsOf(item, wrongOption)
        .filter((word) => word.length >= 3)
        .sort((a, b) => b.length - a.length)
    : [];
  const shortWrong = wrongOption
    ? (wrongWords.find((word) => !askedWords.has(word))
       ?? wrongWords[0]
       ?? shortFormOf(item, wrongOption))
    : '';
  const spans = [choicesSpokenFor(item), storyLeadInSpan(item)].filter(Boolean);
  return {
    correct: correctOption ? shortFormOf(item, correctOption) : '',
    plainWrong,
    ...(shortWrong && shortWrong !== plainWrong
      ? {
          signatureWrong: {
            text: shortWrong,
            why: 'the one word that tells a WRONG card apart — the exact utterance shape the '
              + 'contract tells the judge to accept as a full answer ("just the part that '
              + 'tells it apart"), pointed at the wrong card. A judge that matches a fragment '
              + 'loosely instead of against the numbered list affirms it, and on inference '
              + 'and main-idea the card it names is a TRUE detail of the story, so it is '
              + 'on-topic as well as short',
          },
        }
      : {}),
    // ⭐ MINUS THE WORDS THE QUESTION SAYS — the third time this port has needed
    // that rule and the only time it was found live. The sequence drive filed a
    // HIGH on *"What did the frog hop on first?"* against the card "The frog did
    // hop on a stem": "hop" is distinctive of that card AND is how the question
    // is asked, so the scan fired on a leak that had not happened. Subtracting
    // the question makes the oracle SHARPER, not softer — it narrows the tokens
    // to "stem", which is the actual answer and the only word a tutor could
    // give away.
    leakTokens: correctOption
      ? leakTokensFrom(distinctiveWordsOf(item, correctOption))
          .filter((word) => !askedWords.has(word))
      : [],
    ...(spans.length ? { leakExemptSpan: spans.length === 1 ? spans[0] : spans } : {}),
  };
};
