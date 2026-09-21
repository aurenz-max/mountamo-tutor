'use client';

import type { MutableRefObject } from 'react';
import { useTeachingWorkspace, type TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { teachingEvaluation } from '../../../components/live-activity/runtime/teachingEvaluation';
import type { TeachingSummary } from '../../../components/live-activity/runtime/TeachingSession';
import { evalModeForKind, workspaceAssignment, type CountingItem } from './countingBoardDomain';

/**
 * What the counting board RENDERS from, stated on its own terms.
 *
 * Sunset slice S1 (qa/live-runtime-handoffs/07-sunset-scripted-tutoring.md).
 * This was a `Pick<JudgedScriptRun<CountingItem>, …>` facade, which pointed the
 * dependency the wrong way: the destination architecture described itself in
 * the retiring runner's vocabulary, so the runner's types could not be deleted
 * until the board was rewritten. Declaring the presentation surface here
 * inverts it — `JudgedScriptRun<CountingItem>` still satisfies this interface
 * structurally, so the legacy branch in `CountingBoard.tsx` needs no adapter
 * today, and when S3 deletes it nothing here changes.
 *
 * Everything below is presentation state. Nothing on it decides whether the
 * learner was right; in the live path that is the tutor's, via the shared
 * teaching workspace.
 */
export type CountingStage = 'idle' | 'asking' | 'judging' | 'affirmed' | 'done';

/** Only what the board reads off a finished run. The legacy runner's fuller
 *  `JudgedRunSummary` satisfies it; evidence capture is unchanged by S1. */
export interface CountingRunSummary {
  outcomes: readonly { id: string; solved: boolean; corrections: number; score: number }[];
  solvedCount: number;
}

export interface CountingController {
  currentItem: CountingItem | null;
  currentIndex: number;
  running: boolean;
  /** True only while the legacy runner opens its session. The teaching
   *  workspace is ready at mount and reports false. */
  preparing: boolean;
  /** Coarse presentation beat — what the board should look like right now. */
  stage: CountingStage;
  /** The reveal and interaction gate. NOT `stage`: see the runner's note. */
  currentSolved: boolean;
  canAttempt: boolean;
  summary: CountingRunSummary | null;
  /** The teaching workspace's own finished-run summary. Null on the legacy path. */
  practiceSummary?: TeachingSummary | null;
  teachingResult?: ReturnType<typeof teachingEvaluation> | null;
  tutorSpeaking: boolean;
  cuedItemId: string | null;
  revealHeld: boolean;
  start: () => Promise<void>;
  isAwaitingGesture: () => boolean;
  /** LEGACY ONLY: a gesture reported to the tutor as a scripted cue string.
   *  The live controller throws rather than pretend to speak for the child. */
  submitGestureAttempt: (cue: string) => void;
  /** The learner's page-work, handed over as a structured response. */
  submitGestureResponse?: (value: number) => void;
  publishWorkspace?: () => void;
  presentStimulus?: () => boolean;
  micState: 'idle' | 'opening' | 'armed';
  statusLine: string;
  cancelListening?: () => void;
}

export type CountingWorkspace = TeachingWorkspace;

/** What the TEACHING controller needs. The legacy runner needs more; the board
 *  widens this with the runner's own options for as long as it hosts both. */
export interface CountingControllerOptions {
  instanceId: string;
  items: CountingItem[];
  workspace: MutableRefObject<CountingWorkspace | null>;
  objectiveId?: string;
  planItemId?: string;
  evalMode?: string;
  onItemOpened?: (item: CountingItem, index: number) => void;
  onPresentStimulus?: (item: CountingItem, index: number) => void;
}

/** This binding knows counting. Turn coordination and command execution live in the shared hook. */
export function useCountingTutorController(options: CountingControllerOptions): CountingController {
  const items = options.items;
  const lesson = useTeachingWorkspace({
    instanceId: options.instanceId, primitiveId: 'counting-board', objectiveId: options.objectiveId,
    planItemId: options.planItemId, evalMode: options.evalMode || evalModeForKind(items[0].kind),
    workspace: options.workspace,
    items: items.map(item => ({ ...workspaceAssignment(item), checkResponse: text => text === String(item.target) })),
    onItemOpened: index => options.onItemOpened?.(items[index], index),
    onPresentStimulus: index => options.onPresentStimulus?.(items[index], index),
  });
  const teachingResult = lesson.summary ? teachingEvaluation(items.map(item => ({ ...workspaceAssignment(item), checkResponse: () => null })),
    lesson.state, lesson.summary, options.evalMode || evalModeForKind(items[0].kind)) : null;
  const { state } = lesson;
  const item = items[state.index];
  return { currentIndex: state.index, currentItem: item, running: state.phase !== 'completed', preparing: false,
    stage: state.phase === 'completed' ? 'done' : state.phase === 'checked' && state.lastResponse?.correct ? 'affirmed' : 'asking',
    currentSolved: state.phase === 'checked' && !!state.lastResponse?.correct,
    canAttempt: lesson.canAttempt, teachingResult, summary: null, practiceSummary: lesson.summary, tutorSpeaking: lesson.tutorSpeaking, cuedItemId: item.id, revealHeld: false,
    start: async () => {}, isAwaitingGesture: lesson.isBlocked,
    submitGestureAttempt: () => { throw new Error('Tutor-owned work accepts structured learner responses, never script cues'); },
    submitGestureResponse: value => lesson.submitGestureResponse(String(value)), publishWorkspace: lesson.publishWorkspace,
    presentStimulus: () => !!lesson.present(),
    micState: 'armed', statusLine: state.phase === 'checked' ? 'Let us talk about your answer.' : 'We can work on this together.',
    cancelListening: lesson.stop };
}
