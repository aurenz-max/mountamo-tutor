/**
 * judgedRunEvidence — the diagnosis evidence a judged run hands to the shared
 * capture layer, assembled once here instead of once per component.
 *
 * Why the runner owns this (handoff `qa/HANDOFF-judged-evidence-and-adaptation-wiring-2026-09-14.md`, slice 1):
 * a judged item is re-asked after a correction and scores 67 or 33 when later
 * right, so a session where the child was wrong first on every item and right
 * after one correction submits 67 and passes. The shared failure gate
 * (`isDiagnosableFailure`) can only see that pattern through
 * `firstResponseScore`, and before this module only three components set it,
 * each with its own copy of the same phase selection. Now every pack that
 * supplies `diagnosisObservation` gets the same evidence shape.
 *
 * Facts only. Nothing here names an error or infers a rule; the distiller does
 * that from the phases.
 */

import type { DiagnosisEvidence } from '../evaluation/diagnosis/types';
import type { JudgedDiagnosisObservation, JudgedScriptItem, JudgedScriptPack } from './judgedScriptContract';

/** The store keeps at most this many phases (learningObservationPacket bounds). */
export const JUDGED_EVIDENCE_PHASE_CAP = 12;
/** `observed` is the joined phases; bounded so the distiller prompt stays sane. */
export const JUDGED_EVIDENCE_OBSERVED_CHARS = 2000;
const PRIOR_ATTEMPTS_KEPT = 4;

export interface JudgedRunEvidenceInput<Item extends JudgedScriptItem> {
  /** One per item asked: solved and how many corrections it took. */
  outcomes: ReadonlyArray<{ id: string; solved: boolean; corrections: number }>;
  /** Every corrected attempt, in the order it happened. */
  observations: ReadonlyArray<JudgedDiagnosisObservation>;
  /** The run's items, so the pack can describe the session by kind. */
  items: ReadonlyArray<Item>;
  pack: Pick<JudgedScriptPack<Item>, 'activityLine' | 'maxCorrections' | 'evidenceSummary'>;
}

const DEFAULT_MAX_CORRECTIONS = 2;

/**
 * Which corrected observations survive the phase cap: every item's FIRST wrong
 * attempt outranks any item's later ones, and the kept set is emitted in the
 * order it happened. Dropping the earliest observations (the old `slice(-12)`)
 * threw away exactly the first errors a misconception shows in.
 */
export function selectEvidencePhases<T extends { itemId?: string }>(
  observations: ReadonlyArray<T>, cap = JUDGED_EVIDENCE_PHASE_CAP,
): T[] {
  const seen = new Set<string>();
  const firsts = new Set<T>();
  for (const o of observations) {
    const key = o.itemId ?? '';
    if (!seen.has(key)) { seen.add(key); firsts.add(o); }
  }
  const kept = new Set(Array.from(firsts).concat(observations.filter((o) => !firsts.has(o))).slice(0, cap));
  return observations.filter((o) => kept.has(o));
}

/** Percent of items answered right with no correction; the number the shared gate reads. */
export function firstResponseScoreOf(outcomes: ReadonlyArray<{ solved: boolean; corrections: number }>): number {
  if (!outcomes.length) return 0;
  const clean = outcomes.filter((o) => o.solved && o.corrections === 0).length;
  return Math.round((clean / outcomes.length) * 100);
}

/** Evidence for the shared distiller, or undefined when no attempt was corrected. */
export function judgedRunEvidence<Item extends JudgedScriptItem>(
  { outcomes, observations, items, pack }: JudgedRunEvidenceInput<Item>,
): DiagnosisEvidence | undefined {
  if (!observations.length || !outcomes.length) return undefined;
  const total = outcomes.length;
  const clean = outcomes.filter((o) => o.solved && o.corrections === 0).length;
  const cap = pack.maxCorrections ?? DEFAULT_MAX_CORRECTIONS;
  const phases = selectEvidencePhases(observations);
  // The correction line NAMES the error, so the latest judge-backed observation
  // outranks the merely latest one (cvc-speller shape).
  const judgeBacked = [...observations].reverse().find((o) => o.judgeFeedback);
  const source = judgeBacked ?? observations[observations.length - 1];
  const summary = pack.evidenceSummary?.(items);
  const task = summary?.task ?? pack.activityLine;
  return {
    firstResponseScore: firstResponseScoreOf(outcomes),
    challengeSummary: `${task.trim().replace(/[.:;,]?$/, '.')} ${total} ${total === 1 ? 'item' : 'items'}; a wrong answer gets the tutor's scripted `
      + `correction and the same question again, up to ${cap} ${cap === 1 ? 'correction' : 'corrections'} per item. `
      + `${clean} of ${total} ${total === 1 ? 'item was' : 'items were'} answered right the first time.`,
    expected: summary?.expected ?? source.expected,
    observed: phases.map((o) => `${o.challenge} ${o.observed}`).join(' | ').slice(0, JUDGED_EVIDENCE_OBSERVED_CHARS),
    ...(judgeBacked?.judgeFeedback ? { judgeFeedback: judgeBacked.judgeFeedback } : {}),
    phases: phases.map((o) => ({
      itemId: o.itemId ?? 'unknown', phase: o.phase ?? 'unspecified',
      challenge: o.challenge, expected: o.expected, observed: o.observed,
      support: o.support ?? 'Assistance history unknown',
    })),
    priorAttempts: observations
      .filter((o) => o !== source)
      .slice(-PRIOR_ATTEMPTS_KEPT)
      .map((o) => ({ challenge: o.challenge, observed: o.observed })),
  };
}
