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
 * `useScriptedProgress`, so a primitive's hooks never change owner.
 *
 * `commitCheck` also keeps the primitive's books on both paths (handoff 19, slice 4): it counts the
 * attempt, and on a correct check records `{ challengeId, correct: true, attempts }` for the current
 * challenge, merged into any record the primitive already wrote for it. A primitive records only what
 * is its own (a score, the strategy used) with `recordResult`, before or after the commit.
 */
export interface ProgressOptions<C> extends UseChallengeProgressOptions<C> {
  instanceId: string;
  objectiveId?: string;
  planItemId?: string;
  workspace: MutableRefObject<TeachingWorkspace | null>;
  /** What the tutor and the observer are told about a challenge. Pure; the domain module owns it. */
  assignment: (challenge: C) => TeachingAssignment;
  /** A fresh challenge, or the same one back blank after a practice item (`retry` false), or the same one reopened
   *  after a checked miss (`retry` true). */
  onItemOpened?: (index: number, retry: boolean) => void;
  /**
   * Once per challenge, when its success is committed. A spoken item has no check of the
   * primitive's own, so this is where the primitive records its result.
   */
  onSolved?: (index: number) => void;
  /** Once, with the finished record, and only under an evaluation provider. */
  onFinished?: (result: TeachingEvaluationResult) => void;
}

export interface Progress extends UseChallengeProgressReturn {
  /**
   * The primitive's own check of the learner's work: `response` in words (never the key), the verdict,
   * and on a miss what it shows (`TeachingAttempt.miss`). Counts the attempt and records a correct result.
   */
  commitCheck: (response: string, correct: boolean, miss?: string) => void;
  /** Workspace only: false while a checked answer waits for Try again or Next challenge. */
  canAttempt?: boolean;
  /**
   * Workspace only: whether a lesson's evaluation provider is present. The live host has none, and a
   * workspace family submits only under one, as the judged-runner families do.
   */
  recordsEvaluation?: boolean;
  /** Workspace only: republish `workspace.current` outside a render (the workspace publishes after every render). */
  publishWorkspace?: () => void;
  practiceSummary?: TeachingSummary | null;
  teachingResult?: TeachingEvaluationResult | null;
}

/** The base result a correct check records: the challenge, the verdict and the attempts it took. */
const baseResult = (challengeId: string, attempts: number): ChallengeResult => ({ challengeId, correct: true, attempts });

/** The legacy controller, with the same `commitCheck` bookkeeping and no workspace. */
export function useScriptedProgress<C>(options: ProgressOptions<C>): Progress {
  const progress = useChallengeProgress(options);
  // Read at the call: a primitive may call `commitCheck` from a callback memoized on an earlier render.
  const latest = useRef({ progress, options }); latest.current = { progress, options };
  const commitCheck = useCallback((_response: string, correct: boolean) => {
    const { progress: p, options: o } = latest.current, challenge = o.challenges[p.currentIndex];
    p.incrementAttempts();
    if (correct && challenge) p.mergeResult(baseResult(o.getChallengeId(challenge), p.currentAttempts + 1));
  }, []);
  return { ...progress, commitCheck };
}

export function useWorkspaceProgressFor(primitiveId: string) {
  return function useWorkspaceProgress<C>(options: ProgressOptions<C>): Progress {
    const { challenges, getChallengeId } = options;
    const latest = useRef(options); latest.current = options;
    const items = useMemo(() => challenges.map(challenge => ({ id: getChallengeId(challenge), challenge })),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [challenges]);
    const [attempts, setAttempts] = useState(0);
    /** Counted synchronously, so two checks before a render both count. */
    const attemptCount = useRef(0);
    const [results, setResults] = useState<ChallengeResult[]>([]);
    const run = useWorkspaceRunner({
      instanceId: options.instanceId, primitiveId, objectiveId: options.objectiveId, planItemId: options.planItemId,
      workspace: options.workspace, items,
      assignment: item => latest.current.assignment(item.challenge),
      onItemOpened: (_item, index) => { attemptCount.current = 0; setAttempts(0); latest.current.onItemOpened?.(index, false); },
      onCorrectionRetry: () => latest.current.onItemOpened?.(run.currentIndex, true),
      // Back from a practice item: the surface opens blank, as on a fresh item; the attempt count stays the item's.
      onPracticeClosed: (_item, index) => latest.current.onItemOpened?.(index, false),
      onAffirmed: item => latest.current.onSolved?.(latest.current.challenges
        .findIndex(c => latest.current.getChallengeId(c) === item.id)),
      onFinished: result => latest.current.onFinished?.(result),
    });
    const write = useCallback((result: ChallengeResult, merge: boolean) => setResults(prev => {
      const at = prev.findIndex(r => r.challengeId === result.challengeId);
      if (at < 0) return [...prev, result];
      const next = [...prev]; next[at] = merge ? { ...prev[at], ...result } : result; return next;
    }), []);
    const recordResult = useCallback((result: ChallengeResult) => write(result, false), [write]);
    const mergeResult = useCallback((result: ChallengeResult) => write(result, true), [write]);
    // Read at the call, as in `useScriptedProgress`.
    const current = useRef(run); current.current = run;
    const recordsEvaluation = !!useEvaluationContext();
    const isComplete = challenges.length > 0
      && challenges.every(ch => results.some(r => r.challengeId === getChallengeId(ch) && r.correct));
    return {
      currentIndex: run.currentIndex, currentAttempts: attempts, results, isComplete, recordResult, mergeResult,
      incrementAttempts: useCallback(() => setAttempts(++attemptCount.current), []),
      // The runtime owns progression. A primitive's `advance()` only reports the last item, so its
      // existing completion path (submit on `false`) still runs; the Next button is hidden.
      advance: () => false,
      reset: () => {},
      commitCheck: (response, correct, miss) => {
        const now = current.current;
        setAttempts(++attemptCount.current);
        // An easier practice item (a simplify lever) is not the session's challenge: it records nothing.
        if (correct && !now.practice) mergeResult(baseResult(now.currentItem.id, attemptCount.current));
        now.commitGesture({ response, correct, miss, cue: () => '' });
      },
      canAttempt: run.canAttempt, recordsEvaluation, publishWorkspace: run.publishWorkspace,
      practiceSummary: run.practiceSummary, teachingResult: run.teachingResult,
    };
  };
}
