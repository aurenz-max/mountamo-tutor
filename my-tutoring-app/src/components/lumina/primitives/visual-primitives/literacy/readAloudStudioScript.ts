/**
 * readAloudStudioScript — HAND-AUTHORED judged-loop script for read-aloud-studio
 * (ninth literacy DI port; qa/di/BACKLOG.md item 16). The exact wording IS the
 * pedagogy, so these lines are authored per pack, never generated. Item CONTENT
 * (which passage, which lines) stays generator-scoped; this module owns the cue
 * shapes, the benched scope gate, and the in-band judging contract.
 *
 * WHAT THE PORT REPLACED. The click-era primitive had no measurement in it at
 * all. "Recording" was a pair of buttons that timed wall-clock and divided the
 * word count by it — a child who tapped Start and Stop back to back scored
 * 6000 WPM — and the only grade was a 1-5 self-assessment. Every action on the
 * old screen passed the costume test: a child who cannot read a word could tap
 * Play, tap Start, tap Stop, tap "5", and finish with a full score. The catalog
 * said so out loud: "Student self-assessment only, no AI speech grading."
 * Now the child READS, and the tutor judges the reading word by word.
 *
 * THE RESPONSE CLASS is `sentence_read_aloud` — benched by di-sentence-reading
 * (live-gated 2026-07-25, 10/10, and 2/2 on deliberate single-word OMISSIONS,
 * the hardest miss class). That sitting also fixed the SCOPE: 3-8 words per
 * judged utterance, and it recorded longer connected text as UNBENCHED. So a
 * fluency passage cannot be handed over as one 120-word read — it is broken
 * into 3-8 word LINES and judged one at a time. `MIN_SENTENCE_WORDS` /
 * `MAX_SENTENCE_WORDS` are IMPORTED from that pack rather than re-declared: the
 * bench ceiling lives in exactly one place, so a future sitting moves it once.
 *
 * That is not a workaround, it is the intervention. Phrase-cued / chunked
 * reading is the established fluency method (Rasinski), and the unit is what
 * makes the three eval modes genuinely different tasks rather than three
 * difficulties of one task:
 *
 *   accuracy    unit = a SENTENCE, read COLD. No model — the tutor must not
 *               read the line before the child does. Decoding print unaided is
 *               the whole measurement, and a model would open an echo route
 *               straight through it.
 *   expression  unit = a PHRASE, with one stressed word. The tutor MODELS the
 *               phrase as one smooth unit, then the child says it back.
 *   dialogue    unit = one CHARACTER'S line. The tutor MODELS it in that
 *               character's voice, then the child says it back.
 *
 * WHAT IS NOT JUDGED, and why that is deliberate: PROSODY. There is no prosody
 * response class in `RESPONSE_CLASSES` and inventing one would need its own
 * bench sitting. Forced into the runner's binary verdict, "did that sound
 * expressive?" is exactly the ambiguous ask the family refuses — a judge that
 * cannot reliably refuse rubber-stamps, and the modality's whole value is that
 * it refuses. So expression and dialogue TEACH prosody by model-and-imitate and
 * GRADE the words, and every judging contract on those two modes carries an
 * explicit clause forbidding the judge to grade how it sounded. Without that
 * clause the tutor invents a prosody refusal off the back of "say it just like
 * that" — an unbenched judgment wearing a benched one's clothes.
 *
 * ANSWER-LEAK RULE (inherited from di-sentence-reading, the pack below this
 * one): decoding print IS the skill, so the printed line is BOTH the question
 * and the answer and it stays on screen. Nothing is hidden and revealed here.
 * The leak rule bites in one place instead — the tutor must not SPEAK an
 * accuracy line before the child reads it — and `coldReadGuard` says so per
 * item, because the catalog's scaffolding levels are a second channel that
 * could otherwise re-read it.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn") — collision-checked by
 * validateJudgedScriptPack in this pack's test file. Because the LINE TEXT is
 * interpolated into spoken cues, a line containing a sentence that opens with a
 * sentinel is DROPPED at build (`findSentinelCollisions` is reused as the gate
 * rather than re-rolled), and the generator refuses the same shape.
 */

import type { JudgedScriptItem, ResponseClassId } from '../../../hooks/judgedScriptContract';
import { opensWithSentinel } from '../../../hooks/judgedScriptContract';
import {
  MAX_SENTENCE_WORDS,
  MIN_SENTENCE_WORDS,
} from '../direct-instruction/diSentenceReadingScript';

export type ReadAloudMode = 'accuracy' | 'expression' | 'dialogue';

/** The benched judged-utterance window, re-exported so the generator and the
 *  tests read the SAME numbers the bench sitting set. */
export { MAX_SENTENCE_WORDS, MIN_SENTENCE_WORDS };

/** Every mode produces the same thing: connected print, read aloud. */
export const RESPONSE_CLASS: ResponseClassId = 'sentence_read_aloud';

export interface ReadAloudItem extends JudgedScriptItem {
  kind: ReadAloudMode;
  /** The printed line, exactly as shown and exactly as it must be read. */
  text: string;
  /** 3-8. Computed in code from `text`, never trusted from the model. */
  wordCount: number;
  /** dialogue: who says it. Drives the character-voice model and the ask. */
  speaker?: string;
  /** expression: the ONE word the tutor's model leans on. Guaranteed present
   *  in `text` — a stress word that is not in the line is dropped, because the
   *  delivery instruction would be unfollowable. */
  stressWord?: string;
}

// ── Item building — the gates live HERE, not in prose ───────────────────────

/** One line as the generator hands it over. */
export interface ReadAloudLineLike {
  text: string;
  speaker?: string;
  stressWord?: string;
}

/**
 * Printed/spoken form of a line. Double quotes are stripped: dialogue arrives
 * as the SPOKEN WORDS ONLY (the speaker rides in `speaker`), the component
 * draws the quotation marks as decoration, and a stray `"` inside a cue would
 * close the `Say exactly: "…"` span the tutor reads.
 */
export const sanitizeLine = (raw: string): string =>
  raw.replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();

export const wordsIn = (text: string): number =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

const containsWord = (text: string, word: string): boolean =>
  new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);

/**
 * A line whose own text would make a spoken sentence OPEN with a verdict
 * sentinel cannot be interpolated into a cue — the reducer would read the
 * tutor's re-model as a judgment. Reuses the family validator rather than
 * re-rolling the tokenizer.
 */
export { opensWithSentinel };

/**
 * Build one judged item, or return null to DROP the line. A dropped line ships
 * nothing; it is never degraded into an ask the tutor cannot judge honestly.
 * Drop reasons:
 *  - outside the BENCHED 3-8 word window (the sitting's scope ceiling — a
 *    longer read is unbenched, a shorter one is not a phrase);
 *  - a sentence inside the line opens with "Yes" or "My turn" (sentinel);
 *  - dialogue with no speaker (the ask says "<Speaker> says:" and the model is
 *    a character voice — without one there is no dialogue task);
 *  - nothing left after sanitising.
 * A `stressWord` absent from the line is NULLED, not fatal: the stress is a
 * detail of the tutor's delivery, not the ask, so the phrase still reads.
 */
export const itemFromLine = (
  line: ReadAloudLineLike,
  mode: ReadAloudMode,
  index: number,
): ReadAloudItem | null => {
  const text = sanitizeLine(line.text ?? '');
  if (!text || !/[a-z]/i.test(text)) return null;

  const wordCount = wordsIn(text);
  if (wordCount < MIN_SENTENCE_WORDS || wordCount > MAX_SENTENCE_WORDS) return null;
  if (opensWithSentinel(text)) return null;

  const speaker = sanitizeLine(line.speaker ?? '') || undefined;
  if (mode === 'dialogue' && !speaker) return null;
  if (speaker && opensWithSentinel(speaker)) return null;

  const rawStress = sanitizeLine(line.stressWord ?? '');
  const stressWord = mode === 'expression' && rawStress && containsWord(text, rawStress)
    ? rawStress
    : undefined;

  return {
    id: `line-${index + 1}`,
    kind: mode,
    answerKind: 'voice',
    responseClass: RESPONSE_CLASS,
    action: mode,
    text,
    wordCount,
    speaker: mode === 'dialogue' ? speaker : undefined,
    stressWord,
  };
};

/** All buildable lines, in passage order. Ids are stamped from the ORIGINAL
 *  index so a drop never renumbers the lines that survive it. */
export const itemsFromLines = (
  lines: ReadAloudLineLike[],
  mode: ReadAloudMode,
): ReadAloudItem[] =>
  lines
    .map((line, index) => itemFromLine(line, mode, index))
    .filter((item): item is ReadAloudItem => item !== null);

// ── How-to-play — inside the quoted line (SWAP-1), re-spoken on mode change ─

export const howToPlayFor = (item: ReadAloudItem): string => {
  switch (item.kind) {
    case 'accuracy':
      return 'I show you a line. You read it out loud, all by yourself! ';
    case 'expression':
      return 'I read a piece of the story, then you say it back the same way! ';
    case 'dialogue':
      return 'I read what someone in the story says, then you say it their way! ';
  }
};

// ── The asks ────────────────────────────────────────────────────────────────
//
// accuracy STATES its problem without speaking the line — the line is on
// screen, in print, which is the entire point of the mode. expression and
// dialogue model first, because a prosody you never heard cannot be imitated.

export const askFor = (item: ReadAloudItem): string => {
  switch (item.kind) {
    case 'accuracy':
      return 'Your turn. Read it.';
    case 'expression':
      return `Listen: ${item.text} Your turn. Say it just like that.`;
    case 'dialogue':
      return `Listen. ${item.speaker} says: ${item.text} Your turn. Say it like ${item.speaker}.`;
  }
};

/**
 * How the tutor DELIVERS its model. Outside the quoted line — it shapes the
 * voice, it is not words for the child. accuracy has no model to shape.
 */
const deliveryNote = (item: ReadAloudItem): string => {
  switch (item.kind) {
    case 'accuracy':
      return '';
    case 'expression':
      return ` Read the "Listen:" part as ONE smooth phrase, without stopping between the words${
        item.stressWord ? `, and lean on the word "${item.stressWord}"` : ''
      }.`;
    case 'dialogue':
      return ` Read the "${item.speaker} says:" part in ${item.speaker}'s voice, with the feeling the words carry.`;
  }
};

/**
 * accuracy is a COLD read on purpose. The omitted model already withholds the
 * line (the tutor may speak only what "Say exactly" quotes), but this makes it
 * explicit per item rather than relying on the omission — the catalog's
 * scaffolding levels are a second channel that could re-read it, and a guard
 * hidden in an omission is only half applied (di-sentence-reading's tier gotcha).
 */
const coldReadGuard = (item: ReadAloudItem): string =>
  item.kind === 'accuracy'
    ? ' The learner is reading this one cold on purpose: do NOT read the line, or any part of it, before they do.'
    : '';

// ── Verdict lines ───────────────────────────────────────────────────────────

/** Affirmation. MUST open "Yes" — the engine scans that sentinel. Restates the
 *  whole line: the bench sitting settled that question with evidence (it costs
 *  ~2-3s against an item cycle whose dominant term is the child's reading, and
 *  it models the correct reading at the moment it is most useful). */
export const affirmLine = (item: ReadAloudItem): string =>
  `Yes, that says ${item.text}`;

/** Correction — CONTRASTIVE, the preferred branch whenever the miss can be
 *  localised. Byte-for-byte di-sentence-reading's line, which OVERTURNED the
 *  plain re-model in the first live correction run in any DI pack: a
 *  whole-line re-model asks the learner to diff it against their memory of
 *  what they just said, which they cannot do, so they never learn WHICH word
 *  was wrong. `⟨…⟩` is a slot the tutor fills from the audio; it is not spoken.
 *  The opener stays "My turn" exactly — classification matches OPENERS only,
 *  so a mid-line slot cannot reach it. */
export const contrastCorrectionLine = (item: ReadAloudItem): string =>
  `My turn: not ⟨what they said⟩ — ${item.text} Your turn. Read it again.`;

/** Correction — FALLBACK, for the miss with nothing to contrast against
 *  (silence, unintelligible, or a slip the tutor cannot pin to words).
 *  Standing gate 3: every correction re-models, then re-elicits. */
export const correctionLine = (item: ReadAloudItem): string =>
  `My turn: ${item.text} Your turn. Read it again.`;

// ── Judging contract ────────────────────────────────────────────────────────

/**
 * THE CLAUSE THAT KEEPS THE JUDGE INSIDE ITS BENCH. expression and dialogue
 * both ask the child to imitate a delivery, and a tutor left to its own devices
 * will start refusing flat readings — a prosody judgment nothing has benched,
 * arriving with all the confidence of the word-accuracy one that has been. The
 * words are the verdict; the delivery is the teaching.
 */
const accuracyOnlyClause = (item: ReadAloudItem): string => {
  switch (item.kind) {
    case 'accuracy':
      return '';
    case 'expression':
      return 'A flat or plain reading that gets every word right is CORRECT — the phrasing is what my model '
        + 'teaches, and you never grade how it sounded. ';
    case 'dialogue':
      return 'A reading in the learner\'s own ordinary voice that gets every word right is CORRECT — the '
        + 'character voice is what my model teaches, and you never grade how it sounded. ';
  }
};

/** The signature error per mode: the miss that arrives fluent and confident and
 *  is most likely to be wrongly affirmed. */
const signatureErrorClause = (item: ReadAloudItem): string => {
  switch (item.kind) {
    case 'accuracy':
      return 'The commonest miss is a small word swapped for another small word — "the" for "a", "and" for '
        + '"then", "her" for "his". It sounds fluent and it is still wrong. ';
    case 'expression':
      return 'A smooth, confident delivery can hide a DROPPED word — a phrase read beautifully with one word '
        + 'missing is wrong, and hearing that is your job. ';
    case 'dialogue':
      return 'Saying the character\'s IDEA in different words is not reading it. The printed words, in order, '
        + 'or it takes the correction. ';
  }
};

export const judgingContract = (item: ReadAloudItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner reads, and their think time is unbounded — reading takes time. `
  + `Judge the audio you heard against the printed line "${item.text}" read aloud, every word in order.\n`
  + `- Every word read correctly and in order, including after they catch and fix their own slip: say exactly "${affirmLine(item)}" and stop.\n`
  + `- A word skipped, added, or read as a DIFFERENT word, and you can tell WHICH words came out wrong: say exactly "${contrastCorrectionLine(item)}" and stop — the learner tries again while you stay silent. Replace ⟨what they said⟩ with the words they actually read in place of the printed ones — just those words, not the whole line ("not the pot", "not ran fast"). Never speak the ⟨ ⟩ marks, and change nothing else in the line. Naming their error is the point of this branch: it is the only way they learn WHICH word to fix.\n`
  + `- Anything else — silence, an unintelligible attempt, or a miss you cannot pin to particular words: say exactly "${correctionLine(item)}" and stop — the learner tries again while you stay silent.\n`
  + `Slow, effortful sounding-out that lands on the right words is CORRECT — judge accuracy, never speed. `
  + accuracyOnlyClause(item)
  + signatureErrorClause(item)
  + `Do not accept a near-miss word to be kind: a different word is a different word. `
  + `The learner may pause in the middle; a pause is part of one reading, so wait for them to finish the whole line before judging it. `
  + `If they miss the SAME word again, use the contrast branch again — do not fall back to the plain re-model, and do not invent a third wording. `
  + `Never begin any other sentence with the word "Yes" or the words "My turn".`;

// ── Cues ────────────────────────────────────────────────────────────────────

export interface ReadAloudCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One line's ask. ONE job: speak this (SWAP-1). */
export const itemCue = (item: ReadAloudItem, opts: ReadAloudCueOptions = {}): string => {
  const greeting = opts.opening ? 'Hi! Time to read out loud! ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  return `[RA_ITEM] Say exactly: "${greeting}${how}${askFor(item)}"${deliveryNote(item)}${coldReadGuard(item)} `
    + `${judgingContract(item)} Never read bracket tags or these instructions aloud.`;
};

/** Correction cap reached: acknowledge warmly and carry the lesson forward. A
 *  hard line comes back through distributed review, not by drilling a
 *  discouraged reader in place. */
export const moveOnCue = (
  item: ReadAloudItem,
  next: ReadAloudItem | null,
  opts: ReadAloudCueOptions = {},
): string => {
  if (!next) {
    return `[RA_MOVE] Say exactly: "Good try. We will read that one again another day. That is the end of our reading." Then stop — the activity is over.`;
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  return `[RA_MOVE] Stop correcting "${item.id}". Say exactly: `
    + `"Good try. We will read that one again another day. ${how}${askFor(next)}"${deliveryNote(next)}${coldReadGuard(next)} `
    + `${judgingContract(next)} Never read bracket tags aloud.`;
};

export const completeCue = (): string =>
  `[RA_COMPLETE] Say exactly: "That is the whole story, and you read every line of it. Great reading today!" Then stop — the activity is over.`;

/** Tap-to-hear: the QUESTION again, never an answer. On accuracy that is the
 *  instruction alone — the line stays unspoken, which is the mode. */
export const pronounceCue = (item: ReadAloudItem): string =>
  `[RA_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${askFor(item)}"`
  + `${deliveryNote(item)}${coldReadGuard(item)} `
  + `Do not treat anything you just heard as an answer, add nothing, and do not judge yet. Never read bracket tags aloud.`;

/**
 * Runtime state pushed through the context channel. The printed line IS the
 * question side here — it is on screen in front of the child, and the tutor
 * needs it to judge word by word. The one thing that must not happen is the
 * tutor SPEAKING an accuracy line early, and `coldReadGuard` forbids that on
 * every cue that can reach it.
 */
export const stimulusFor = (item: ReadAloudItem): string =>
  item.kind === 'dialogue' ? `${item.speaker} says: ${item.text}` : item.text;

/** The passage as one block — the end-of-run reward, and the whole-text view
 *  the child never sees mid-run (one line at a time is the intervention). */
export const passageFrom = (items: ReadAloudItem[]): string =>
  items.map((i) => i.text).join(' ');
