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

import type { JudgedScriptItem, ResponseClassId } from '../../../hooks/judgedScriptContract';
import { opensWithSentinel } from '../../../hooks/judgedScriptContract';
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

/** Are these cards a fair, askable, SAYABLE closed set? */
const choiceOptionsUsable = (q: DecodableQuestionLike): boolean => {
  const options = q.options ?? [];
  if (options.length < 2) return false;
  if (!q.correctOptionId || !options.some((o) => o.id === q.correctOptionId)) return false;
  if (!options.every((o) => !!sanitize(o.text) && !opensWithSentinel(o.text))) return false;
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

  const answers = questions
    .map((q, i) => answerItemFromQuestion(q, i, mode, sentences))
    .filter((item): item is DecodableReaderItem => item !== null)
    .map((item) => (storyText ? { ...item, storyText } : item));

  return [...lines, ...answers];
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

/** read_along opens by READING THE STORY — that is the mode's stimulus and the
 *  child cannot decode it. Only the opening cue carries it; later questions in
 *  the same run ask against the story the child already heard. */
const storyLeadIn = (item: DecodableReaderItem, opening: boolean): string =>
  opening && item.storyText ? `Listen to our story. ${item.storyText} ` : '';

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

// ── Judging contracts ───────────────────────────────────────────────────────

const readingContract = (item: DecodableReaderItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner reads, and their think time is unbounded — decoding takes time. `
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
    + `${contractFor(item)} Never read bracket tags or these instructions aloud.`;
};

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
  const sorry = item.kind === 'read_line'
    ? 'Good try. We will read that one again another day. '
    : 'Good try. ';
  if (!next) {
    return `[DR_MOVE] Say exactly: "${sorry}${closeLine}That is the end of our story time." Then stop — the activity is over.`;
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  return `[DR_MOVE] Stop correcting "${item.id}". Say exactly: `
    + `"${sorry}${closeLine}${how}${askFor(next)}"${coldReadGuard(next)} `
    + `${contractFor(next)} Never read bracket tags aloud.`;
};

/** The closing line. read_along never asked the child to read, so it must not
 *  congratulate them for reading — the praise has to be true. */
export const completeCue = (mode: DecodableReaderMode): string =>
  mode === 'read_along'
    ? `[DR_COMPLETE] Say exactly: "You listened to the whole story and you knew all about it. Great story time today!" Then stop — the activity is over.`
    : `[DR_COMPLETE] Say exactly: "You read the whole story and you knew all about it. Great reading today!" Then stop — the activity is over.`;

/** Tap-to-hear: the QUESTION side again, never an answer. On a read line that
 *  is the instruction alone — the line stays unspoken, which is the mode; on a
 *  comprehension question it is the question (and, for the cards, the choices),
 *  never the story, which for a literal question contains the answer verbatim. */
export const pronounceCue = (item: DecodableReaderItem): string =>
  `[DR_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${askFor(item)}"`
  + `${coldReadGuard(item)} `
  + `Do not treat anything you just heard as an answer, add nothing, never say the answer, and do not re-read the story. `
  + `Never read bracket tags aloud.`;

/**
 * Runtime state pushed through the context channel, ANSWER-FREE by
 * construction: a read line is already printed in front of the child, and a
 * comprehension item pushes its question only — never the answer word, never
 * the right card, and never the story (which on a literal question would carry
 * the answer into the tutor's runtime state for no reason: the judging contract
 * already tells it what the answer is).
 */
export const stimulusFor = (item: DecodableReaderItem): string =>
  item.kind === 'read_line' ? item.text : (item.question ?? '');
