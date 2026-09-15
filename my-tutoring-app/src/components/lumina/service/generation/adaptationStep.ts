/**
 * adaptationStep — the one generator adaptation step (handoff
 * qa/HANDOFF-judged-evidence-and-adaptation-wiring-2026-09-14.md, slice 4).
 *
 * Ten consumers each re-typed the same four moves: build the planner task, pick
 * the observations, call the planner behind a gate, stamp the result. They also
 * took the planned mode from three different places; ten-frame's pinned
 * challenge type for `operate` is `add`, and a capability described for
 * `operate` abstained on it. Now:
 *
 *   - `plannedMode(resolution)` is the resolved catalog eval mode when exactly
 *     one mode was resolved, else undefined (a blend or `mixed` names no skill).
 *   - `adaptationTaskFor(ctx, topic, { mode, tier })` builds the planner task.
 *   - `planAdaptation(ctx, { task, capability, eligible })` returns the move or
 *     null: no capability, no observations or an ineligible task means NO call.
 *   - `stampAdaptation(move, selected)` is the one status mapping: a selector's
 *     `no-focus` becomes `insufficient-capacity`, because an absent stamp cannot
 *     be told apart from a consumer that never planned.
 *
 * Observations are the launch packet's saved observations; the eval-test
 * `remediationFocus` tap stands in as one active observation where a consumer
 * still receives it (declared consumers have it stripped upstream).
 */

import { planLearningAdaptation, type AdaptationObservation, type AdaptationTask, type TeachingCapability } from './planLearningAdaptation';
import type { LearningAdaptation, LearningAdaptationStatus } from './learningAdaptation';

export type { LearningAdaptation, LearningAdaptationStatus } from './learningAdaptation';

export interface AdaptationContext {
  grade?: string;
  intent?: string;
  objective?: { text?: string };
  remediationFocus?: string;
  learningObservations?: readonly AdaptationObservation[];
}

/**
 * The catalog eval mode the session runs, when exactly one was resolved. Takes
 * either resolution shape: `resolveEvalModes` (a list of modes; a blend or
 * `mixed` names no skill) or `resolveEvalModeConstraint` (one definition).
 */
export function plannedMode(
  resolution: { modes: readonly { evalMode: string }[] } | { definition: { evalMode: string } } | null | undefined,
): string | undefined {
  if (!resolution) return undefined;
  if ('definition' in resolution) return resolution.definition.evalMode;
  return resolution.modes.length === 1 ? resolution.modes[0].evalMode : undefined;
}

export function adaptationTaskFor(
  ctx: AdaptationContext, topic: string, step: { mode?: string; tier?: string },
): AdaptationTask {
  return { grade: ctx.grade, topic, intent: ctx.intent, objectiveText: ctx.objective?.text, mode: step.mode, tier: step.tier };
}

/** Saved observations, else the eval-test focus as one active observation. */
export function adaptationObservations(ctx: AdaptationContext): AdaptationObservation[] {
  if (ctx.learningObservations?.length) return [...ctx.learningObservations];
  return ctx.remediationFocus ? [{ id: 'active-observation', summary: ctx.remediationFocus }] : [];
}

export async function planAdaptation<M extends string>(
  ctx: AdaptationContext,
  step: { task: AdaptationTask; capability: TeachingCapability<M> | null | undefined; eligible: (task: AdaptationTask) => boolean },
): Promise<M | null> {
  const observations = adaptationObservations(ctx);
  if (!step.capability || !observations.length || !step.eligible(step.task)) return null;
  return planLearningAdaptation(step.capability, step.task, observations);
}

export interface SelectedContrast { status: LearningAdaptationStatus | 'no-focus'; count: number }

export function stampAdaptation<M extends string>(
  move: M | null | undefined, selected: SelectedContrast | null | undefined,
): LearningAdaptation<M> | undefined {
  if (!move || !selected) return undefined;
  return { move, status: selected.status === 'no-focus' ? 'insufficient-capacity' : selected.status, comparisonCount: selected.count };
}
