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
import { classifyEvidenceTier, type MisconceptionResult } from './types';

export interface CaptureMisconceptionOptions {
  /** EvaluationContext session — scopes the once-per-(subskill, session) gate. */
  sessionId: string;
  /** Resolved curriculum subskill for the write. No subskill → no write. */
  subskillId?: string;
  gradeLevel?: string;
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
  try {
    // Gate 1: only failures are diagnosable (mirrors shouldDistill server-side).
    const failed = result.success === false || result.score < 60;
    if (!failed) return null;

    // Gate 2: Tier C never calls the model — primitives that haven't opted in
    // are invisible to the loop.
    const evidence = result.diagnosisEvidence;
    if (classifyEvidenceTier(evidence) === 'none') return null;

    const primitiveType = result.primitiveType as string;
    const scope = getComponentById(primitiveType)?.misconceptionScope;
    if (!scope) return null;

    // Skill-scoped diagnoses need a curriculum anchor. Primitive-scoped
    // diagnoses retain subskill only as nullable provenance.
    const subskillId = opts.subskillId;
    const hasAnchor = !!subskillId && subskillId !== 'free-form' && subskillId !== 'unknown';
    if (scope === 'skill' && !hasAnchor) return null;

    // Gate 4: at most one diagnosis per (subskill, session). Latch BEFORE the
    // async work so a double-fired submit can't race two distiller calls.
    const identity = scope === 'primitive'
      ? primitiveType
      : `${primitiveType}:${result.skillId || subskillId}`;
    const key = `${opts.sessionId}:${identity}`;
    if (diagnosedKeys.has(key)) return null;
    diagnosedKeys.add(key);

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
          evalMode: result.metrics?.evalMode,
          gradeLevel: opts.gradeLevel ?? result.lessonContext?.gradeLevel,
        },
      }),
    });
    if (!res.ok) throw new Error(`distiller HTTP ${res.status}`);
    const diagnosis = (await res.json()) as MisconceptionResult;

    // Honest abstain writes NOTHING.
    if (diagnosis.abstain) {
      console.log('[captureMisconception] abstained:', diagnosis.reason);
      return diagnosis;
    }

    await authApi.post('/api/student-profile/misconceptions', {
      subskill_id: subskillId,
      skill_id: result.skillId,
      primitive_type: primitiveType,
      scope,
      misconception_text: diagnosis.misconceptionText,
      confidence: diagnosis.confidence,
      evidence_tier: diagnosis.evidenceTier,
      source_attempt_id: result.attemptId,
    });
    console.log(
      `[captureMisconception] stored for ${identity}:`,
      diagnosis.misconceptionText,
    );
    return diagnosis;
  } catch (error) {
    console.warn('[captureMisconception] capture failed (non-blocking):', error);
    return null;
  }
}
