/**
 * decodable-reader's domain: the items and their build gates, the ask, the spoken key, the known misses, the scene
 * and the harness answers. Pure. The boss (`decodableReader.boss.ts`) and the component read it; the tutor teaches in
 * its own words, so nothing here writes a cue, a correction or a judging contract (those went with the scripted
 * runner, 2026-10-19).
 *
 * THE ANSWER-MATERIAL FORK. One run asks up to three kinds of item, and every answer is spoken:
 *  - read_line: a printed story sentence the learner reads aloud (`sentence_read_aloud`, benched at 3-8 words by
 *    di-sentence-reading; MIN/MAX_SENTENCE_WORDS are imported from that pack). A sentence outside the tier's window is
 *    DROPPED, never trimmed: the learner is looking at the printed original.
 *  - answer_spoken: a one-word answer stated in the story (`short_spoken_word`). literal and read_along ask this way,
 *    and fall back to the choice menu when the generator gives no usable one-word answer.
 *  - answer_choice: a whole proposition, so the printed picture choices close the set and the learner SAYS which one
 *    (`closed_set_choice`; the tap is gone, user ruling 2026-08-13). sequence, inference and main_idea always ask this
 *    way. A choice set where one option's words sit inside another's cannot be told apart by ear and is dropped.
 * A question that can be asked neither way is dropped.
 *
 * LEAKS DIFFER PER KIND. A read line is the printed answer by design, so the tutor must not SAY it before the learner
 * reads it (the card says so); there is no per-word tap-to-hear for the same reason. A one-word answer is inside the
 * read-along story by construction, so "Say that again" repeats the question only. A choice question's ask says every
 * choice (`given`): naming the right one is what the tutor must not do.
 */

import type { JudgedScriptItem, ResponseClassId } from '../../../hooks/judgedScriptContract';
import { opensWithSentinel } from '../../../hooks/judgedScriptContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { textFacts } from '../../../components/live-activity/runtime/sceneFacts';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { lineReadingMisses } from './spokenReadingMisses';
import {
  MAX_SENTENCE_WORDS,
  MIN_SENTENCE_WORDS,
} from '../direct-instruction/diSentenceReadingDomain';

/** The benched judged-utterance window, re-exported so the component, the
 *  generator and the tests all read the SAME numbers the bench sitting set. */
export { MAX_SENTENCE_WORDS, MIN_SENTENCE_WORDS };
import { BENCHED_WINDOW, sentenceWindowOf, type SentenceWindow } from './decodableReaderLadder';

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
  /** The session's eval mode (`buildItems` stamps it): the lever set reads it. */
  mode?: DecodableReaderMode;
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
  /** read_along only: the whole story, read aloud before its first question. */
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
 *  - outside the session's window: the benched 3-8 words, or the tier's window
 *    from decodableReaderLadder.ts when the generator stamped one (a shorter
 *    read is a phrase, not a sentence);
 *  - a sentence inside it opens with "Yes" or "My turn" (sentinel);
 *  - nothing left after sanitising.
 * A dropped sentence ships nothing. It is never trimmed to fit — a trimmed
 * sentence is a DIFFERENT sentence, and the child is looking at the printed
 * original.
 */
export const readItemFromSentence = (
  sentence: DecodableSentenceLike,
  index: number,
  // The tier's window (decodableReaderLadder.ts) when the payload stamps one; else the benched 3-8.
  window: SentenceWindow = BENCHED_WINDOW,
): DecodableReaderItem | null => {
  const text = sentenceText(sentence);
  if (!text || !/[a-z]/i.test(text)) return null;

  const wordCount = wordsIn(text);
  if (wordCount < window.min || wordCount > window.max) return null;
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
  window: SentenceWindow = BENCHED_WINDOW,
): DecodableReaderItem[] => {
  const isReadAlong = mode === 'read_along';

  const lines = isReadAlong
    ? []
    : sentences
        .map((s, i) => readItemFromSentence(s, i, window))
        .filter((item): item is DecodableReaderItem => item !== null);
  if (!isReadAlong && lines.length === 0) return [];

  const storyText = isReadAlong ? passageTextFrom(sentences) : undefined;
  if (isReadAlong && (!storyText || opensWithSentinel(storyText))) return [];

  const storyContentWords = contentWordsOf(sentences);
  const answers = questions
    .map((q, i) => answerItemFromQuestion(q, i, mode, sentences))
    .filter((item): item is DecodableReaderItem => item !== null)
    .map((item) => ({ ...item, storyContentWords, ...(storyText ? { storyText } : {}) }));

  return dropRepeatAnswers([...lines, ...answers]).map((item) => ({ ...item, mode }));
};

/**
 * The payload boundary, shared by the component and the journey harness. Both
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
  /** The tier's sentence window, stamped by the generator (decodableReaderLadder.ts); absent = benched 3-8. */
  sentenceWindow?: SentenceWindow;
}

export const itemsFromChallenges = (
  data: DecodableReaderPayload,
): { items: DecodableReaderItem[]; mode: DecodableReaderMode; dropped: number } => {
  const mode: DecodableReaderMode =
    data.readingMode === 'read_along' ? 'read_along' : (data.comprehensionType ?? 'literal');
  const sentences = data.passage?.sentences ?? [];
  const questions =
    data.comprehensionQuestions ?? (data.comprehensionQuestion ? [data.comprehensionQuestion] : []);
  const items = buildItems(sentences, questions, mode, sentenceWindowOf(data.sentenceWindow));
  const askable = (mode === 'read_along' ? 0 : sentences.length) + questions.length;
  return { items, mode, dropped: Math.max(0, askable - items.length) };
};

// ── The asks ────────────────────────────────────────────────────────────────
//
// Every ask STATES its problem aloud: a K-2 reader may not be able to read the
// question. The read line is the exception in the other direction: it is on
// screen in print, which IS the mode, so the ask must NOT contain it.

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
      return 'Read it.';
    case 'answer_spoken':
      return item.question ?? '';
    case 'answer_choice':
      return `${item.question} Is it ${choicesSpokenFor(item)}? Tell me which one.`;
  }
};

/** What a choice question's ask says by design: every choice, the right one among them. */
export const decodableGiven = (item: DecodableReaderItem): string[] =>
  item.kind === 'answer_choice' ? [choicesSpokenFor(item)] : [];

/** What "Say that again" asks the tutor to say: the question side, never an answer and never the line. */
export const hearAgainRequest = (item: DecodableReaderItem) =>
  item.kind === 'read_line'
    ? 'The learner asked to hear that again. Say only: "Read the line out loud." Do not read the line or any word of it.'
    : `The learner asked to hear the question again. Say only this, once: "${askFor(item)}" Never say the answer.`;

// ── The key, the misses, the scene ──────────────────────────────────────────

export const correctOptionText = (item: DecodableReaderItem): string =>
  (item.options ?? []).find((o) => o.id === item.correctOptionId)?.text ?? '';

/** The key the tutor judges a read or an answer against. */
export function decodableKey(item: DecodableReaderItem): SpokenKey {
  switch (item.kind) {
    case 'read_line':
      return { answer: item.text, alsoAccept: [],
        acceptRule: 'Read aloud, every word in order. Catching and fixing their own slip still counts; slow '
          + 'sounding-out that lands on the right words is correct.',
        signatureError: 'A word skipped, added or read as a different word is not it, however small ("the" for "a" '
          + 'is a miss).' };
    case 'answer_spoken':
      return { answer: item.answerWord ?? '', alsoAccept: [],
        acceptRule: `Said inside a phrase ("on the ${item.answerWord}") or as a word that names the same thing counts.`,
        signatureError: 'A different word from the story, the question said back, or a retelling is not it.' };
    case 'answer_choice': {
      const options = item.options ?? [];
      const index = options.findIndex(o => o.id === item.correctOptionId) + 1;
      return { answer: stripEnd(correctOptionText(item)), alsoAccept: [],
        acceptRule: `It is choice ${index} of ${options.length}. The whole choice, the part that tells it apart from `
          + 'the others, what its picture shows, or its position in the list all count.',
        signatureError: 'Another choice is not it.' };
    }
  }
}

/**
 * A spoken item's known wrong answers (handoff 20 Part B). A read line: a word left out, a word read as another. A
 * one-word answer: a story sentence retold without the answer, another story word. A choice question names none yet.
 */
export function decodableSpokenMisses(item: DecodableReaderItem): KnownMiss[] {
  if (item.kind === 'read_line') return lineReadingMisses(item.text, { skip: 'word_skip' });
  if (item.kind !== 'answer_spoken' || !item.answerWord) return [];
  const answer = item.answerWord.toLowerCase(), question = item.question ?? '';
  const asked = new Set(question.toLowerCase().match(/[a-z]+/g) ?? []);
  const lifted = (item.storyContentWords ?? []).filter(w => w !== answer && !asked.has(w) && !answer.includes(w)).slice(0, 2);
  const retold = (item.storyText ?? '').split(/(?<=[.!?])\s+/).map(s => s.trim())
    .find(s => s && !s.toLowerCase().includes(answer));
  const fact = `The answer to "${question}" is "${answer}". `;
  return [
    { id: 'retell', pattern: `${fact}The learner retells the story instead, saying a whole story sentence or more that does not contain "${answer}".`,
      ...(retold ? { examples: [retold] } : {}) },
    ...(lifted.length ? [{ id: 'lifted_word', pattern: `${fact}The learner says a different word from the story that does not answer the question, like ${lifted.map(w => `"${w}"`).join(' or ')}.`, examples: lifted }] : []),
  ];
}

/** What is drawn and asked. A practice item says what it is, so the tutor knows the lesson item comes back. */
export function decodableReaderScene(item: DecodableReaderItem, practice = false): WorkspaceScene {
  const facts: Record<string, string | number> = {};
  if (item.kind === 'read_line') {
    facts.printedLine = item.text;
    facts.wordCount = item.wordCount;
    facts.constraints = 'The learner reads the printed line out loud; it is the only thing on screen. Nothing is tapped.';
  } else {
    facts.question = item.question ?? '';
    if (item.storyText) Object.assign(facts, textFacts('story', item.storyText));
    if (item.kind === 'answer_choice') facts.choicesInScreenOrder = choicesSpokenFor(item);
    facts.constraints = item.kind === 'answer_choice'
      ? 'The question and the picture choices are printed; the learner says which choice out loud. Nothing is tapped.'
      : 'The question is printed; the learner says the answer out loud. The answer appears only after credit.';
  }
  if (practice) facts.practice = item.kind === 'read_line'
    ? 'An easier practice line of three new words, not from the story, ungraded. The story line comes back after it.'
    : 'An easier practice story of two sentences, not from the lesson story, with its own question, ungraded. The '
      + 'lesson story and its question come back after it.';
  return { objects: [], facts };
}

// ── Harness answers: what a right and a plainly wrong learner say ───────────

const tokensOf = (text: string): string[] =>
  normalizeWord(text).split(/[\s-]+/).filter(Boolean);

/** Small words a K-2 reader swaps without noticing; a content-word swap skips them, so its miss is unambiguous. */
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

const DECOY_WORDS = ['box', 'pig', 'cup', 'hat', 'bed'];
/** Nouns that belong to no K-2 decodable passage we generate — the answer a
 *  child who did not read at all would give. */
const OFF_STORY_WORDS = ['rocket', 'pizza', 'dinosaur', 'umbrella'];

const firstAbsent = (pool: string[], haystack: string): string => {
  const norm = ` ${normalizeWord(haystack)} `;
  return pool.find((word) => !norm.includes(` ${word} `)) ?? pool[0];
};

/** The line with one CONTENT word replaced: an unambiguous miss the tutor can pin to particular words. */
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
 * How a five-year-old names a card: the tail from the first word that tells it apart. "The dog can run." -> "run";
 * "A trip to the moon." -> "trip to the moon". The key counts it as a full answer, so the harness says it when right.
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

/** The journey's answers: the item's own read or answer, and a plainly wrong one of the same kind. */
export function decodableReaderHarnessAnswers(item: DecodableReaderItem): { correct: string; plainWrong: string } {
  if (item.kind === 'read_line') return { correct: item.text, plainWrong: swapOneBigWord(item.text) };
  if (item.kind === 'answer_spoken') {
    const answer = item.answerWord ?? '';
    const pool = item.storyContentWords?.length ? item.storyContentWords : tokensOf(item.evidenceLine || item.storyText || '');
    return { correct: answer,
      plainWrong: firstAbsent(OFF_STORY_WORDS, `${pool.join(' ')} ${item.storyText ?? ''} ${item.question ?? ''} ${answer}`) };
  }
  const options = item.options ?? [];
  const correctOption = options.find((o) => o.id === item.correctOptionId);
  const wrongOption = options.find((o) => o.id !== item.correctOptionId);
  return { correct: correctOption ? shortFormOf(item, correctOption) : '',
    plainWrong: wrongOption ? stripEnd(sanitize(wrongOption.text)) : 'nothing' };
}
