/**
 * readAloudStudioScript — the lines read-aloud-studio asks (ninth literacy DI
 * port; qa/di/BACKLOG.md item 16). Item CONTENT (which passage, which lines)
 * stays generator-scoped; this module owns the benched scope gate and the asks.
 * The scripted cues and judging contract were retired when the family moved onto
 * its boss (`readAloudStudio.card.ts` + `readAloudStudio.boss.ts`, 2026-10-26):
 * the tutor judges against the line's `SpokenKey` (`readAloudStudioWorkspace.ts`).
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
} from '../direct-instruction/diSentenceReadingDomain';

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
  /** Suggested meaning groups for expression practice; never an answer key. */
  phraseGroups?: string[];
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

/** The passage as one block — the end-of-run reward, and the whole-text view
 *  the child never sees mid-run (one line at a time is the intervention). */
export const passageFrom = (items: ReadAloudItem[]): string =>
  items.map((i) => i.text).join(' ');
