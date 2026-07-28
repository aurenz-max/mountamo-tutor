/**
 * Misconception Loop S1 — the DI family's evidence accumulator.
 *
 * WHY THIS EXISTS. A DI session where a child answers wrong used to produce
 * `{correct: false, score: 0}` and nothing else: the component dropped
 * `attempt-transcript.text` (what the CHILD said) and the engine dropped the
 * tutor's judging sentence (what the JUDGE said about it). Both are now kept,
 * and this module turns them into the shipped `DiagnosisEvidence` packet.
 *
 * WHY DI IS THE FAMILY THIS TIER WAS WRITTEN FOR. Evidence quality is decided
 * by PRESENCE (`evaluation/diagnosis/types.ts`): `judgeFeedback` present ⇒
 * Tier A, the highest fidelity, "a judge already explained why the work fell
 * short". In DI the Live tutor judges the audio IN-BAND and speaks its
 * judgment, and since the 2026-07-25 contrastive-correction ruling that
 * sentence NAMES the error ("My turn: not one — two plus one is three.").
 * No other family has a judge articulating the failure in natural language at
 * the moment it happens.
 *
 * `priorAttempts` is the other reason DI is well placed: the per-item retry
 * loop (up to the 2-correction cap) natively produces the same-item repeat
 * that separates a consistent mental model from a one-off slip — the user's
 * "they said 'four' both times".
 *
 * TWO RULES THIS MODULE DOES NOT BEND:
 *  - **Primitives never diagnose.** This ships `observed` + `judgeFeedback`;
 *    the shared distiller decides, and an honest abstain is success.
 *  - **The packet never reaches the student.** Every string here is DATA for
 *    the distiller. Nothing in it may be routed to a status line — in a judged
 *    loop a stray write would be SPOKEN ALOUD.
 */

import type { DiagnosisEvidence } from '../../../evaluation/diagnosis/types';

/**
 * One judged miss, logged at the moment the tutor corrected it.
 *
 * `challenge` and `expected` are composed by the OWNING PACK (only it knows
 * how to describe its own task), which is also where the cross-identity
 * mitigation lives: the task identity goes INTO `challenge`, so a diagnosis
 * distilled from a subtraction miss reads "when subtracting, the student…"
 * and stays self-limiting even though primitive scope keys on the pack alone.
 */
export interface DiFailedVerdict {
  /** What THIS item asked, in the pack's words, naming the task identity. */
  challenge: string;
  /** The pedagogically correct outcome, described. Never student-visible. */
  expected: string;
  /** Live input transcription for the attempt. Null is normal and expected —
   *  the attempt is voice-anchored (DI-1), so it is judged whether or not a
   *  transcript ever arrives. */
  heard: string | null;
  /** The tutor's own judging sentence, verbatim. This is what buys Tier A. */
  judgeFeedback: string;
  /**
   * True once the tutor's line finished streaming and the `verdict-text`
   * emission replaced the opener fragment with the whole sentence.
   *
   * It matters because a verdict fires on the chunk that completes the
   * sentinel, so a miss logged at verdict time holds only "My turn:" until the
   * upgrade lands — and for one session shape (a capped correction on the
   * FINAL item, which submits synchronously) the run ends before it can.
   * {@link buildDiDiagnosisEvidence} uses this flag to fall back rather than
   * ship a Tier-A packet whose judge text names nothing.
   */
  judgeFeedbackComplete?: boolean;
}

/** Bound on the log — a long session must not grow an unbounded ref, and the
 *  distiller reasons from the most recent misses. Mirrors PhonicsBlender. */
export const MAX_FAILED_VERDICTS = 8;

/** Append one miss, keeping only the most recent {@link MAX_FAILED_VERDICTS}. */
export const pushFailedVerdict = (
  log: DiFailedVerdict[],
  entry: DiFailedVerdict,
): DiFailedVerdict[] => [...log, entry].slice(-MAX_FAILED_VERDICTS);

/**
 * Replace the most recent miss's judge text with the tutor's COMPLETE line and
 * mark it upgraded. Called from the `verdict-text` emission; a no-op when
 * nothing has been logged yet.
 */
export const completeLatestJudgeFeedback = (
  log: DiFailedVerdict[],
  judgeFeedback: string,
): DiFailedVerdict[] => {
  if (log.length === 0) return log;
  const next = log.slice();
  next[next.length - 1] = {
    ...next[next.length - 1],
    judgeFeedback,
    judgeFeedbackComplete: true,
  };
  return next;
};

/**
 * How the child's production is described to the distiller. A missing
 * transcript is stated as a missing transcript rather than as silence — under
 * voice-anchoring the child did speak, Live's input transcription just did not
 * land, and reporting that as "said nothing" would be a fabricated observation.
 */
export const observedFrom = (heard: string | null): string => {
  const said = heard?.trim();
  return said
    ? `Student said: "${said}".`
    : 'Student answered aloud but no transcript was captured; the tutor judged the audio directly.';
};

/**
 * Build the S1 packet from a session's judged misses, or `undefined` when
 * there is nothing to diagnose.
 *
 * The caller decides WHETHER the session is diagnosable; this decides what the
 * packet says. `judgeFeedback` is omitted rather than emptied when the engine
 * supplied no sentence, so `classifyEvidenceTier` degrades honestly to
 * `'structured'` instead of claiming a judge that never spoke.
 */
export const buildDiDiagnosisEvidence = (
  fails: DiFailedVerdict[],
): DiagnosisEvidence | undefined => {
  const latest = fails[fails.length - 1];
  if (!latest) return undefined;
  // Prefer the latest miss's own judge line. If the run submitted before that
  // line finished streaming (see `judgeFeedbackComplete`), fall back to the
  // fullest line captured for the SAME item — repeated corrections on one item
  // are the same failure, so it describes THIS miss and not a different one.
  // Exact-match on `challenge`, never a heuristic on the text.
  const sameItemComplete = latest.judgeFeedbackComplete
    ? latest
    : [...fails].reverse().find(
      (fail) => fail.judgeFeedbackComplete && fail.challenge === latest.challenge,
    );
  const judgeFeedback = (sameItemComplete ?? latest).judgeFeedback?.trim();
  return {
    challengeSummary: latest.challenge,
    expected: latest.expected,
    observed: observedFrom(latest.heard),
    ...(judgeFeedback ? { judgeFeedback } : {}),
    // The consistency signal: earlier misses in the SAME session, including
    // repeats of the same item, which is exactly the same-wrong-answer-twice
    // shape the distiller needs to call a mental model rather than a slip.
    priorAttempts: fails.slice(0, -1).map((fail) => ({
      challenge: fail.challenge,
      observed: fail.judgeFeedback?.trim()
        ? `${observedFrom(fail.heard)} Tutor judged: "${fail.judgeFeedback.trim()}"`
        : observedFrom(fail.heard),
    })),
  };
};
