/**
 * The ten frame on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/live-runtime-handoffs/15-workspace-rollout.md).
 *
 * Pure and React-free: the live adapter (imported by the server route), the
 * component and any probe read the same assignment and scene from here. The
 * items themselves still come from `itemsFromChallenges` in `tenFrameScript.ts`;
 * nothing is extracted from the scripted pack. W1 publishes no demonstration
 * targets, so the scene carries facts only.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { askFor, isTeenKind, type TenFrameItem } from './tenFrameScript';

/** Challenge types whose catalog eval mode has a different name; every other type is its own mode. */
export const evalModeForKind = (kind: TenFrameItem['kind']): string =>
  kind === 'split' ? 'decompose' : kind === 'add' || kind === 'subtract' ? 'operate' : kind;

/** What a flip mode counts: the counters turned yellow, not the counters on the frame. */
export const countsFlips = (item: TenFrameItem) => item.kind === 'split' || item.kind === 'decompose_teen';

/** The committed placement in the learner's terms, as the tutor and the observer read it. */
export function describeFrameResponse(item: TenFrameItem, value: number): string {
  const n = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  if (item.kind === 'split') return `${item.answer - value} red and ${value} yellow`;
  if (item.kind === 'decompose_teen') return `${n(value, 'counter')} turned yellow`;
  if (item.kind === 'build_teen') return `${n(value, 'counter')} placed below the full ten`;
  if (item.kind === 'make_ten') return `${n(value, 'counter')} added to the ${item.shown} already on the frame`;
  return `${n(value, 'counter')} on the frame`;
}

export function workspaceAssignment(item: TenFrameItem): TeachingAssignment {
  const speech = item.answerKind !== 'gesture';
  // A placement is checked by the frame, so the tutor is not handed its key;
  // a spoken number is judged from the tutor's feedback against the answer.
  return { id: item.id, task: askFor(item), response: speech ? 'speech' : 'gesture',
    ...(speech ? { expectedAnswer: String(item.answer) } : {}) };
}

export interface TenFrameView {
  onFrame: number;
  yellow: number;
  /** Subitize counters are off screen until presented and after the flash. */
  hidden: boolean;
}

export function workspaceScene(item: TenFrameItem, view: TenFrameView): WorkspaceScene {
  return {
    objects: [],
    facts: {
      kind: item.kind, frameSize: item.capacity,
      // Counts only where the frame is what is asked about. Beside a spoken sum, "0 on the frame"
      // reads to the observer as contradicting a credited answer (the LA-13 `counted: 0` finding).
      ...(item.shown > 0 && item.kind !== 'subitize' ? { countersAtStart: item.shown } : {}),
      ...(item.answerKind === 'gesture' || item.kind === 'subitize'
        ? { countersOnFrame: view.hidden ? 'hidden' : view.onFrame } : {}),
      ...(countsFlips(item) ? { turnedYellow: view.yellow } : {}),
      ...(isTeenKind(item.kind) ? { teenNumber: item.teenTotal ?? item.answer } : {}),
      ...(item.kind === 'add' ? { addends: `${item.addend1} and ${item.addend2}` } : {}),
      ...(item.kind === 'subtract' ? { takeAway: item.removed ?? 0 } : {}),
      constraints: item.kind === 'subitize'
        ? 'Quick look: call present when the learner is ready. The counters show briefly, then hide; do not count them out.'
        : item.answerKind === 'gesture'
          ? 'The learner answers on the frame. The frame checks the placement once the learner stops.'
          : 'The learner says the number. The frame is a working surface only.',
    },
  };
}
