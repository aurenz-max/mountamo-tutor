'use client';

import { useCallback, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useChallengeProgress, type ChallengeResult, type UseChallengeProgressOptions, type UseChallengeProgressReturn }
  from '../../../hooks/useChallengeProgress';
import { useWorkspaceRunner, type TeachingEvaluationResult } from './useWorkspaceRunner';
import { useEvaluationContext } from '../../../evaluation';
import type { TeachingAssignment, TeachingWorkspace } from './useTeachingWorkspace';
import type { TeachingSummary } from './TeachingSession';

/**
 * `useChallengeProgress` on the shared teaching workspace, for a primitive with its own Check and
 * no judged runner (workspace rollout W1, "plain" shape; qa/workspace-rollout/ROLLOUT.md).
 *
 * Same return shape, so the primitive's rendering, scoring and evaluation code runs unchanged. What
 * differs: the item index moves only when the runtime advances (the observer, or the learner's
 * Next challenge on the shell), never on the primitive's own `advance()`; and the primitive reports
 * every check, right or wrong, through `commitCheck`, which the workspace records as a checked
 * gesture. `onItemOpened` runs for a fresh item and for Try again, so the primitive clears its
 * working surface there. Chosen at the component boundary by `withWorkspaceController`, beside
 * `useChallengeProgress`, so a primitive's hooks never change owner.
 */
export interface ProgressOptions<C> extends UseChallengeProgressOptions<C> {
  instanceId: string;
  objectiveId?: string;
  planItemId?: string;
  /** The RESOLVED pin from the mount. */
  evalMode: string;
  workspace: MutableRefObject<TeachingWorkspace | null>;
  /** What the tutor and the observer are told about a challenge. Pure; the domain module owns it. */
  assignment: (challenge: C) => TeachingAssignment;
  /** A fresh challenge opened (`retry` false) or the same one reopened after a checked miss (`retry` true). */
  onItemOpened?: (index: number, retry: boolean) => void;
  /** Once, with the finished record, and only under an evaluation provider. */
  onFinished?: (result: TeachingEvaluationResult) => void;
}

export interface Progress extends UseChallengeProgressReturn {
  /** Workspace only: record the primitive's own check of the learner's work. */
  commitCheck?: (response: string, correct: boolean) => void;
  /** Workspace only: false while a checked answer waits for Try again or Next challenge. */
  canAttempt?: boolean;
  /**
   * Workspace only: whether a lesson's evaluation provider is present. The live host has none, and a
   * workspace family submits only under one, as the judged-runner families do.
   */
  recordsEvaluation?: boolean;
  /** Workspace only: republish `workspace.current` after the scene changes. */
  publishWorkspace?: () => void;
  practiceSummary?: TeachingSummary | null;
  teachingResult?: TeachingEvaluationResult | null;
}

/** The legacy controller, typed to accept the workspace options it ignores. */
export const useScriptedProgress = <C,>(options: ProgressOptions<C>): Progress => useChallengeProgress(options);

export function useWorkspaceProgressFor(primitiveId: string) {
  return function useWorkspaceProgress<C>(options: ProgressOptions<C>): Progress {
    const { challenges, getChallengeId } = options;
    const latest = useRef(options); latest.current = options;
    const items = useMemo(() => challenges.map(challenge => ({ id: getChallengeId(challenge), challenge })),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [challenges]);
    const [attempts, setAttempts] = useState(0);
    const [results, setResults] = useState<ChallengeResult[]>([]);
    const run = useWorkspaceRunner({
      instanceId: options.instanceId, primitiveId, objectiveId: options.objectiveId, planItemId: options.planItemId,
      evalMode: options.evalMode, workspace: options.workspace, items,
      assignment: item => latest.current.assignment(item.challenge),
      onItemOpened: (_item, index) => { setAttempts(0); latest.current.onItemOpened?.(index, false); },
      onCorrectionRetry: () => latest.current.onItemOpened?.(run.currentIndex, true),
      onFinished: result => latest.current.onFinished?.(result),
    });
    const recordResult = useCallback((result: ChallengeResult) => setResults(prev => {
      const at = prev.findIndex(r => r.challengeId === result.challengeId);
      if (at < 0) return [...prev, result];
      const next = [...prev]; next[at] = result; return next;
    }), []);
    const recordsEvaluation = !!useEvaluationContext();
    const isComplete = challenges.length > 0
      && challenges.every(ch => results.some(r => r.challengeId === getChallengeId(ch) && r.correct));
    return {
      currentIndex: run.currentIndex, currentAttempts: attempts, results, isComplete, recordResult,
      incrementAttempts: useCallback(() => setAttempts(a => a + 1), []),
      // The runtime owns progression. A primitive's `advance()` only reports the last item, so its
      // existing completion path (submit on `false`) still runs; the Next button is hidden.
      advance: () => false,
      reset: () => {},
      commitCheck: (response, correct) => run.commitGesture({ response, correct, cue: () => '' }),
      canAttempt: run.canAttempt, recordsEvaluation, publishWorkspace: run.publishWorkspace,
      practiceSummary: run.practiceSummary, teachingResult: run.teachingResult,
    };
  };
}
