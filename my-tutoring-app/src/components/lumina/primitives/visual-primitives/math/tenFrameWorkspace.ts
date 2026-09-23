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
import type { WorkspaceDomain } from '../../../components/live-activity/adapters/adapterContract';
import type { TenFrameData } from './TenFrame';
import { askFor, isTeenKind, itemsFromChallenges, type TenFrameItem } from './tenFrameScript';

const itemsOf = (d: TenFrameData) => itemsFromChallenges(d.challenges, { capacity: d.mode === 'double' ? 20 : 10, band: d.gradeBand! });

/** Reject a generated frame whose challenges the component would drop, at the service boundary. */
export function validateTenFrameData(value: unknown): TenFrameData {
  const d = value as TenFrameData;
  if (!d || typeof d.title !== 'string' || !['single', 'double'].includes(d.mode)
      || !['K', '1-2'].includes(d.gradeBand ?? '') || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 12 || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || typeof c.instruction !== 'string'))
    throw new Error('Generated ten frame has invalid lesson content.');
  if (itemsOf(d).length !== d.challenges.length) throw new Error('A ten-frame challenge cannot run in the lesson.');
  return d;
}

/** Everything the live adapter needs from ten-frame; the catalog declares the rest. */
export const tenFrameLiveDomain: WorkspaceDomain<TenFrameData> = {
  validate: validateTenFrameData,
  opening: d => { const items = itemsOf(d); return { title: d.title, task: askFor(items[0]), total: items.length }; },
};

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
      kind: item.kind, frameSize: item.capacity, countersAtStart: item.kind === 'subitize' ? 0 : item.shown,
      countersOnFrame: view.hidden ? 'hidden' : view.onFrame,
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
