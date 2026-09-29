'use client';

import { createContext, useContext } from 'react';
import type { DiagnosisEvidence } from './diagnosis/types';

/**
 * What a workspace-bound submission carries beside the primitive's own record (handoff 19 slice 6).
 *
 * A primitive with its own Check (plain shape) submits when its challenges are complete, from its own
 * tally. The teaching workspace scores the same session a moment later (`teachingEvaluation`), with each
 * wrong check's named miss on its evidence phase. `usePrimitiveEvaluation` waits for that scored session
 * and adds its evidence, so the misconception capture records the misses. The session's score replaces the
 * primitive's: a primitive's own tally counts an item solved after a miss as right, so a retried run would
 * record 100. The primitive's success and metrics are sent unchanged.
 */
export interface ScoredWorkspaceSession {
  /** Mean item score over the session (100 first try, 67 after one miss, 33 later, 0 unsolved). */
  accuracy: number;
  diagnosisEvidence: DiagnosisEvidence;
  learningResponses: unknown[];
  teachingAttempts: unknown[];
  assistanceProvenance: string;
}

export interface WorkspaceSubmission {
  /** A workspace runner in this scope will score the session; until one does, nothing waits. */
  expect(): void;
  /** The workspace scored the session. Runs a waiting send. */
  scored(session: ScoredWorkspaceSession): void;
  /**
   * Run `send` with the scored session: now if it exists or no runner expects one (a family that submits the
   * scored session itself), else when it arrives, or with none on `flush`.
   */
  whenScored(send: (session: ScoredWorkspaceSession | null) => void): void;
  /** The mount is going away: a waiting send goes out without the workspace's evidence rather than never. */
  flush(): void;
}

export function createWorkspaceSubmission(): WorkspaceSubmission {
  let session: ScoredWorkspaceSession | null = null;
  let expecting = false;
  let waiting: ((session: ScoredWorkspaceSession | null) => void) | null = null;
  const run = (s: ScoredWorkspaceSession | null) => { const send = waiting; waiting = null; send?.(s); };
  return {
    expect: () => { expecting = true; },
    scored: s => { session = s; run(s); },
    whenScored: send => { waiting = send; if (session || !expecting) run(session); },
    flush: () => run(null),
  };
}

export const WorkspaceSubmissionContext = createContext<WorkspaceSubmission | null>(null);
export const useWorkspaceSubmission = () => useContext(WorkspaceSubmissionContext);

/**
 * The primitive's evidence with the workspace's per-item phases (misses included) and first-response score
 * added. Where the primitive wrote its own summary, expected and observed, those stand; a primitive with no
 * evidence gets the workspace's whole packet. The workspace's attempt record joins the student work.
 */
export function withWorkspaceEvidence(evidence: DiagnosisEvidence | undefined, studentWork: unknown,
  session: ScoredWorkspaceSession): { diagnosisEvidence: DiagnosisEvidence; studentWork: unknown } {
  const scored = session.diagnosisEvidence;
  const diagnosisEvidence: DiagnosisEvidence = { ...scored, ...evidence,
    ...(scored.phases ? { phases: scored.phases } : {}),
    ...(scored.firstResponseScore !== undefined ? { firstResponseScore: scored.firstResponseScore } : {}) };
  // A primitive whose work is not a record (an array, a string) keeps it exactly as it sent it.
  if (studentWork !== undefined && (typeof studentWork !== 'object' || studentWork === null || Array.isArray(studentWork)))
    return { diagnosisEvidence, studentWork };
  return { diagnosisEvidence, studentWork: { learningResponses: session.learningResponses,
    teachingAttempts: session.teachingAttempts, assistanceProvenance: session.assistanceProvenance,
    ...(studentWork as Record<string, unknown> | undefined) } };
}
