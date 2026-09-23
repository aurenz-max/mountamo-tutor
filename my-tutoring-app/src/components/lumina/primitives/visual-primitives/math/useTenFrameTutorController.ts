'use client';

import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { useTeachingWorkspace, type TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { teachingEvaluation } from '../../../components/live-activity/runtime/teachingEvaluation';
import type { TeachingSummary } from '../../../components/live-activity/runtime/TeachingSession';
import type { JudgedRunSummary } from '../../../hooks/useJudgedScriptRunner';
import { useEvaluationContext } from '../../../evaluation';
import { evalModeForKind, workspaceAssignment } from './tenFrameWorkspace';
import type { TenFrameItem } from './tenFrameScript';

/**
 * What the ten frame RENDERS from, on its own terms. The judged runner satisfies
 * it structurally, so the scripted branch needs no adapter; the workspace
 * controller below satisfies it without a runner. Counting Board's
 * `CountingController` is the precedent (sunset slice S1).
 */
export interface TenFrameController {
  currentItem: TenFrameItem | null;
  currentIndex: number;
  running: boolean;
  preparing: boolean;
  stage: 'idle' | 'asking' | 'judging' | 'affirmed' | 'done';
  currentSolved: boolean;
  canAttempt: boolean;
  revealHeld: boolean;
  tutorSpeaking: boolean;
  cuedItemId: string | null;
  summary: JudgedRunSummary | null;
  start: () => Promise<void>;
  isAwaitingGesture: () => boolean;
  /** A hands turn closes on stillness (contract R6), on either path. */
  armStillness: (commit: () => void, ms?: number) => void;
  clearStillness: () => void;
  /** LEGACY ONLY: the runner's suspension state and its tap-to-hear ledger. */
  runtimeControls?: { getState(): { suspended: boolean } };
  hearStimulus?: () => void;
  /** LEGACY ONLY: the placement reported to the runner as a scripted cue. */
  submitGestureAttempt: (cue: string) => void;
  /** Workspace only: the placement, checked by the frame, as a structured response. */
  submitGestureResponse?: (response: string) => void;
  /** Workspace only: "Show again" re-presents the stimulus through the shared lifecycle. */
  presentStimulus?: () => boolean;
  publishWorkspace?: () => void;
  practiceSummary?: TeachingSummary | null;
  teachingResult?: ReturnType<typeof teachingEvaluation> | null;
  micState: 'idle' | 'opening' | 'armed';
  statusLine: string;
  cancelListening?: () => void;
}

export interface TenFrameControllerOptions {
  instanceId: string;
  items: TenFrameItem[];
  workspace: MutableRefObject<TeachingWorkspace | null>;
  /** The frame's own verdict on the placement just committed; null when none is pending. */
  checkPlacement: (item: TenFrameItem) => boolean | null;
  objectiveId?: string;
  planItemId?: string;
  evalMode?: string;
  onItemOpened?: (item: TenFrameItem, index: number) => void;
  onPresentStimulus?: (item: TenFrameItem, index: number) => void;
  /** Called once with the finished teaching record, only under an evaluation provider. */
  onFinished?: (result: ReturnType<typeof teachingEvaluation>) => void;
}

/** The ten frame on the shared teaching workspace. Turn coordination and progression live in the shared hook. */
export function useTenFrameTutorController(options: TenFrameControllerOptions): TenFrameController {
  const { items } = options;
  const evalMode = options.evalMode || evalModeForKind(items[0].kind);
  const stillness = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearStillness = useCallback(() => {
    if (stillness.current) clearTimeout(stillness.current);
    stillness.current = null;
  }, []);
  useEffect(() => clearStillness, [clearStillness]);
  const lesson = useTeachingWorkspace({
    instanceId: options.instanceId, primitiveId: 'ten-frame', objectiveId: options.objectiveId,
    planItemId: options.planItemId, evalMode, workspace: options.workspace,
    items: items.map(item => ({ ...workspaceAssignment(item), checkResponse: () => options.checkPlacement(item) })),
    onItemOpened: index => { clearStillness(); options.onItemOpened?.(items[index], index); },
    onPresentStimulus: index => options.onPresentStimulus?.(items[index], index),
  });
  const { state } = lesson;
  const item = items[state.index];
  const solved = state.phase === 'checked' && !!state.lastResponse?.correct;
  const teachingResult = lesson.summary
    ? teachingEvaluation(items.map(i => ({ ...workspaceAssignment(i), checkResponse: () => null })), state, lesson.summary, evalMode)
    : null;
  const evaluationContext = useEvaluationContext();
  const submitted = useRef(false);
  useEffect(() => {
    if (!evaluationContext || !teachingResult || submitted.current) return;
    submitted.current = true;
    options.onFinished?.(teachingResult);
  });
  return { currentIndex: state.index, currentItem: item, running: state.phase !== 'completed', preparing: false,
    stage: state.phase === 'completed' ? 'done' : solved ? 'affirmed' : 'asking',
    currentSolved: solved, canAttempt: lesson.canAttempt, revealHeld: false, tutorSpeaking: lesson.tutorSpeaking,
    cuedItemId: item.id, summary: null, practiceSummary: lesson.summary, teachingResult,
    start: async () => {}, isAwaitingGesture: lesson.isBlocked,
    armStillness: (commit, ms = 3000) => { clearStillness(); stillness.current = setTimeout(() => { stillness.current = null; commit(); }, ms); },
    clearStillness,
    submitGestureAttempt: () => { throw new Error('Tutor-owned work accepts structured learner responses, never script cues'); },
    submitGestureResponse: response => { clearStillness(); lesson.submitGestureResponse(response); },
    presentStimulus: () => !!lesson.present(), publishWorkspace: lesson.publishWorkspace,
    micState: 'armed', statusLine: state.phase === 'checked' ? 'Let us talk about your answer.' : 'We can work on this together.',
    cancelListening: lesson.stop };
}
