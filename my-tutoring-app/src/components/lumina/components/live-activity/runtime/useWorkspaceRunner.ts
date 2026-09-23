'use client';

import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { useEvaluationContext } from '../../../evaluation';
import { useTeachingWorkspace, type TeachingAssignment, type TeachingWorkspace } from './useTeachingWorkspace';
import { teachingEvaluation } from './teachingEvaluation';
import type { TeachingSummary } from './TeachingSession';
import type { JudgedRunSummary } from '../../../hooks/useJudgedScriptRunner';

export type TeachingEvaluationResult = ReturnType<typeof teachingEvaluation>;

/**
 * The shared teaching workspace in the judged runner's vocabulary (workspace rollout W1,
 * qa/live-runtime-handoffs/15-workspace-rollout.md).
 *
 * A runner-era primitive renders from `currentItem`, `canAttempt`, `currentSolved` and friends,
 * and reacts through `onItemOpened`, `onCorrectionRetry`, `onAffirmed`, `onPresentStimulus` and
 * `onFinished`. This hook fires those same callbacks from the workspace's committed outcomes, so
 * the primitive keeps one surface and swaps only the controller. Progression, observation and
 * evidence stay in `useTeachingWorkspace`; nothing here judges speech or advances an item.
 */
export interface WorkspaceRunItem { id: string }

export interface WorkspaceRunOptions<Item extends WorkspaceRunItem> {
  instanceId: string;
  primitiveId: string;
  objectiveId?: string;
  planItemId?: string;
  /** The RESOLVED pin from the mount, a blend or `mixed` included. */
  evalMode: string;
  items: Item[];
  /** What the tutor and the observer are told about an item. Pure; the domain module owns it. */
  assignment: (item: Item) => TeachingAssignment;
  workspace: MutableRefObject<TeachingWorkspace | null>;
  /** A fresh item opened (the first one, or after an advance). */
  onItemOpened?: (item: Item, index: number) => void;
  /** The SAME item reopened after a checked miss. Defaults to `onItemOpened`. */
  onCorrectionRetry?: (item: Item) => void;
  onPresentStimulus?: (item: Item, index: number) => void;
  /** Once per item, when its success is committed: the first moment an answer may appear. */
  onAffirmed?: (item: Item) => void;
  /** Once, with the finished record, and only under an evaluation provider. */
  onFinished?: (result: TeachingEvaluationResult) => void;
}

/** A placement the activity checked at its source. `cue` is the legacy runner's report of it. */
export interface GestureCommit { response: string; correct: boolean; cue: () => string }

export interface WorkspaceRun<Item extends WorkspaceRunItem> {
  currentItem: Item;
  currentIndex: number;
  running: boolean;
  preparing: false;
  stage: 'asking' | 'affirmed' | 'done';
  currentSolved: boolean;
  canAttempt: boolean;
  /** Held while the solved item is on screen; the next item clears it. */
  revealHeld: boolean;
  tutorSpeaking: boolean;
  cuedItemId: string;
  summary: null;
  practiceSummary: TeachingSummary | null;
  teachingResult: TeachingEvaluationResult | null;
  start: () => Promise<void>;
  isAwaitingGesture: () => boolean;
  /** A hands turn closing on stillness, as the runner's `armStillness`. */
  armStillness: (commit: () => void, ms?: number) => void;
  clearStillness: () => void;
  commitGesture: (gesture: GestureCommit) => void;
  presentStimulus: () => boolean;
  publishWorkspace: () => void;
  submitGestureAttempt: (cue: string) => never;
  micState: 'armed';
  statusLine: string;
  cancelListening: () => void;
}

/**
 * What a primitive that hosts both controllers renders from. The judged runner satisfies it
 * structurally and so does `WorkspaceRun`; the optional members exist on one side only.
 */
export interface LiveRun<Item> {
  currentItem: Item | null;
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
  armStillness: (commit: () => void, ms?: number) => void;
  clearStillness: () => void;
  submitGestureAttempt: (cue: string) => void;
  micState: 'idle' | 'opening' | 'armed';
  statusLine: string;
  cancelListening?: () => void;
  /** Workspace only. */
  commitGesture?: (gesture: GestureCommit) => void;
  presentStimulus?: () => boolean;
  publishWorkspace?: () => void;
  practiceSummary?: TeachingSummary | null;
  teachingResult?: TeachingEvaluationResult | null;
  /** Runner only. */
  runtimeControls?: { getState(): { suspended: boolean } };
  hearStimulus?: () => void;
}

/** Commit a checked placement through whichever controller is mounted. */
export function commitGesture(run: { commitGesture?: (g: GestureCommit) => void; submitGestureAttempt: (cue: string) => void },
  gesture: GestureCommit) {
  if (run.commitGesture) run.commitGesture(gesture);
  else run.submitGestureAttempt(gesture.cue());
}

const DEFAULT_STILLNESS_MS = 3000;

export function useWorkspaceRunner<Item extends WorkspaceRunItem>(options: WorkspaceRunOptions<Item>): WorkspaceRun<Item> {
  const latest = useRef(options); latest.current = options;
  const { items, evalMode } = options;
  const stillness = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearStillness = useCallback(() => {
    if (stillness.current) clearTimeout(stillness.current);
    stillness.current = null;
  }, []);
  useEffect(() => clearStillness, [clearStillness]);
  /** The activity's own verdict on the placement being submitted, read by `checkResponse`. */
  const checked = useRef<{ itemId: string; correct: boolean } | null>(null);
  const opened = useRef<string | null>(null);
  /** Once per item, when its success is committed. */
  const affirmed = useRef(new Set<string>());
  const affirm = useCallback((item: Item | undefined) => {
    if (!item || affirmed.current.has(item.id)) return;
    affirmed.current.add(item.id);
    latest.current.onAffirmed?.(item);
  }, []);
  const lesson = useTeachingWorkspace({
    instanceId: options.instanceId, primitiveId: options.primitiveId, objectiveId: options.objectiveId,
    planItemId: options.planItemId, evalMode, workspace: options.workspace,
    items: items.map(item => ({ ...options.assignment(item),
      checkResponse: () => checked.current?.itemId === item.id ? checked.current.correct : null })),
    onItemOpened: index => {
      const item = latest.current.items[index], o = latest.current;
      clearStillness(); checked.current = null;
      const retry = opened.current === item.id;
      opened.current = item.id;
      if (retry) (o.onCorrectionRetry ?? (i => o.onItemOpened?.(i, index)))(item);
      else o.onItemOpened?.(item, index);
    },
    onPresentStimulus: index => latest.current.onPresentStimulus?.(latest.current.items[index], index),
    // At the commit, while the primitive still shows this item: a verdict that also advances
    // never renders the solved state, and the next item's reset would run first.
    onSolved: index => affirm(latest.current.items[index]),
  });
  const { state } = lesson;
  const item = items[state.index];
  const solved = state.phase === 'checked' && !!state.lastResponse?.correct;

  useEffect(() => { if (solved) affirm(item); }, [solved, item, affirm]);

  const teachingResult = lesson.summary
    ? teachingEvaluation(items.map(i => ({ ...options.assignment(i), checkResponse: () => null })), state, lesson.summary, evalMode)
    : null;
  const evaluationContext = useEvaluationContext();
  const finished = useRef(false);
  useEffect(() => {
    if (!evaluationContext || !teachingResult || finished.current) return;
    finished.current = true;
    latest.current.onFinished?.(teachingResult);
  });

  return { currentIndex: state.index, currentItem: item, running: state.phase !== 'completed', preparing: false,
    stage: state.phase === 'completed' ? 'done' : solved ? 'affirmed' : 'asking',
    currentSolved: solved, canAttempt: lesson.canAttempt, revealHeld: solved, tutorSpeaking: lesson.tutorSpeaking,
    cuedItemId: item.id, summary: null, practiceSummary: lesson.summary, teachingResult,
    start: async () => {}, isAwaitingGesture: lesson.isBlocked,
    armStillness: (commit, ms = DEFAULT_STILLNESS_MS) => {
      clearStillness();
      stillness.current = setTimeout(() => { stillness.current = null; commit(); }, ms);
    },
    clearStillness,
    commitGesture: ({ response, correct }) => {
      clearStillness();
      checked.current = { itemId: item.id, correct };
      lesson.submitGestureResponse(response);
    },
    presentStimulus: () => !!lesson.present(), publishWorkspace: lesson.publishWorkspace,
    submitGestureAttempt: () => { throw new Error('Tutor-owned work accepts structured learner responses, never script cues'); },
    micState: 'armed', statusLine: state.phase === 'checked' ? 'Let us talk about your answer.' : 'We can work on this together.',
    cancelListening: lesson.stop };
}
