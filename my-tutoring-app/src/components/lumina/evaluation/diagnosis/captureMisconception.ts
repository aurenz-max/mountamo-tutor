'use client';

/**
 * Misconception Loop — S2/S3 capture hook (client side).
 *
 * Called fire-and-forget by EvaluationContext AFTER a submission's
 * /api/problems/submit round-trip has resolved, so diagnosis never adds
 * latency to the XP/engagement path or blocks challenge advance.
 *
 * Pipeline per failure:
 *   gate (failed + evidence tier A/B + once per subskill+session)
 *     → /api/lumina `distillMisconception` (real Gemini flash, server-side)
 *     → generative diagnosis → POST /api/student-profile/misconceptions
 *     → abstain → nothing (abstain is success)
 *
 * Everything here is best-effort: any error is swallowed with a console.warn.
 * A dropped write costs one diagnosis, never a submission. Double-fires are
 * safe end to end — the session dedup latch is set synchronously before any
 * async work, and the backend store is a per-subskill overwrite.
 */

import { authApi } from '@/lib/authApiClient';
import { getComponentById } from '../../service/manifest/catalog';
import type { PrimitiveEvaluationResult } from '../types';
import { classifyEvidenceTier, isDiagnosableFailure, type MisconceptionResult } from './types';

export interface CaptureMisconceptionOptions {
  onStatus?: (status: CaptureStatus) => void;
  /** EvaluationContext session — scopes the once-per-(subskill, session) gate. */
  sessionId: string;
  /** Resolved curriculum subskill for the write. No subskill → no write. */
  subskillId?: string;
  gradeLevel?: string;
}
export interface CaptureStatus {
  stage: 'skipped' | 'distilling' | 'abstained' | 'saving' | 'stored' | 'failed';
  message: string;
}

// Once-per-(subskill, session) dedup. The store's overwrite semantics are the
// backstop, not the gate (PRD §6) — this latch is what saves the LLM calls.
const diagnosedKeys = new Set<string>();

/** Test/bench hook: reset the session dedup latch. */
export function resetMisconceptionCaptureLatch(): void {
  diagnosedKeys.clear();
}

/**
 * Diagnose a failed attempt and store the misconception. Never throws.
 * Returns the distiller result for observability (null when gated out).
 */
export async function captureMisconception(
  result: PrimitiveEvaluationResult,
  opts: CaptureMisconceptionOptions,
): Promise<MisconceptionResult | null> {
  const report = (stage: CaptureStatus['stage'], message: string) => opts.onStatus?.({ stage, message });
  try {
    // Gate 1: only failures are diagnosable (mirrors shouldDistill server-side).
    const failed = isDiagnosableFailure(result, result.diagnosisEvidence);
    if (!failed) { report('skipped', 'Activity succeeded, including first responses where the activity reports them. The current capture path records suspected misconceptions from failures; it does not yet distill strengths.'); return null; }

    // Gate 2: Tier C never calls the model — primitives that haven't opted in
    // are invisible to the loop.
    const evidence = result.diagnosisEvidence;
    if (classifyEvidenceTier(evidence) === 'none') { report('skipped', 'No problem-and-response evidence was supplied. A score alone cannot establish a misconception.'); return null; }

    const primitiveType = result.primitiveType as string;
    const component = getComponentById(primitiveType);
    const scope = component?.misconceptionScope;
    if (!scope) { report('skipped', 'This activity has not declared a misconception scope.'); return null; }

    // Skill-scoped diagnoses need a curriculum anchor. Primitive-scoped
    // diagnoses retain subskill only as nullable provenance.
    const subskillId = opts.subskillId;
    const hasAnchor = !!subskillId && subskillId !== 'free-form' && subskillId !== 'unknown';
    if (scope === 'skill' && !hasAnchor) { report('skipped', 'No curriculum objective was resolved for this activity.'); return null; }

    // Gate 4: at most one diagnosis per (subskill, session). Latch BEFORE the
    // async work so a double-fired submit can't race two distiller calls.
    const identity = scope === 'primitive'
      ? primitiveType
      : `${primitiveType}:${result.skillId || subskillId}`;
    const key = `${opts.sessionId}:${identity}`;
    if (diagnosedKeys.has(key)) { report('skipped', 'This skill already had a capture attempt in this session. No second diagnosis request was made.'); return null; }
    diagnosedKeys.add(key);
    report('distilling', 'Examining the submitted problem, phase and response evidence…');

    const res = await fetch('/api/lumina', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'distillMisconception',
        params: {
          evidence,
          score: result.score,
          success: result.success,
          subskillId,
          evalMode: result.metrics?.evalMode ?? (result.metrics as unknown as { challengeType?: string })?.challengeType,
          gradeLevel: opts.gradeLevel ?? result.lessonContext?.gradeLevel,
        },
      }),
    });
    if (!res.ok) throw new Error(`distiller HTTP ${res.status}`);
    const diagnosis = (await res.json()) as MisconceptionResult;

    // Honest abstain writes NOTHING.
    if (diagnosis.abstain) {
      report('abstained', `No hypothesis saved: ${diagnosis.reason}`);
      console.log('[captureMisconception] abstained:', diagnosis.reason);
      return diagnosis;
    }

    const grade = opts.gradeLevel ?? result.lessonContext?.gradeLevel;
    report('saving', 'Hypothesis distilled; waiting for backend storage confirmation…');
    const stored = await authApi.post<{ stored?: boolean }>('/api/student-profile/misconceptions', {
      grade,
      subject: result.lessonContext?.curriculumSubject,
      // Relayed catalog declaration: the backend keeps no primitive table.
      delivery: component?.observationDelivery,
      subskill_id: subskillId,
      skill_id: result.skillId,
      primitive_type: primitiveType,
      scope,
      misconception_text: diagnosis.misconceptionText,
      confidence: diagnosis.confidence,
      evidence_tier: diagnosis.evidenceTier,
      source_attempt_id: result.attemptId,
      learning_observation: {
        subject: result.lessonContext?.curriculumSubject ?? '',
        grade: grade ?? '',
        evalMode: result.metrics?.evalMode ?? (result.metrics as unknown as { challengeType?: string })?.challengeType ?? '',
        problem: evidence!.challengeSummary.slice(0, 2000),
        phases: (evidence!.phases ?? [{ itemId: result.instanceId || result.attemptId, phase: 'unspecified',
          challenge: evidence!.challengeSummary, expected: evidence!.expected, observed: evidence!.observed,
          support: 'Assistance history unknown' }]).slice(-12).map(p => ({
            itemId: p.itemId.slice(0, 200), phase: p.phase.slice(0, 200),
            challenge: p.challenge.slice(0, 2000), expected: p.expected.slice(0, 2000),
            observed: p.observed.slice(0, 2000), support: p.support.slice(0, 600),
          })),
        teachingImplication: diagnosis.teachingImplication || 'No teaching adjustment was distilled.',
        checkNext: diagnosis.checkNext || 'Collect fresh independent evidence before updating this hypothesis.',
      },
    });
    if (stored?.stored !== true) throw new Error('Backend did not confirm storage of the observation');
    report('stored', 'Structured observation saved. The profile is refreshing.');
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('lumina-learning-observations-updated'));
    console.log(
      `[captureMisconception] stored for ${identity}:`,
      primitiveType === 'place-value-chart' ? 'diagnosis recorded' : diagnosis.misconceptionText,
    );
    return diagnosis;
  } catch (error) {
    report('failed', error instanceof Error ? error.message : 'Observation capture failed. Your activity submission is separate.');
    console.warn('[captureMisconception] capture failed (non-blocking):', error);
    return null;
  }
}
