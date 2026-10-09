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
import { numberMisses, offByMisses, spokenNumber, type KnownMiss, type OffByMiss } from '../../../components/live-activity/runtime/spokenMissContract';

/** Challenge types whose catalog eval mode has a different name; every other type is its own mode. */
export const evalModeForKind = (kind: TenFrameItem['kind']): string =>
  kind === 'split' ? 'decompose' : kind === 'add' || kind === 'subtract' ? 'operate' : kind;

/** What a flip mode counts: the counters turned yellow, not the counters on the frame. */
export const countsFlips = (item: TenFrameItem) => item.kind === 'split' || item.kind === 'decompose_teen';

/** The committed placement in the learner's terms, as the tutor and the observer read it. `yellow` is build_pair's. */
export function describeFrameResponse(item: TenFrameItem, value: number, yellow = 0): string {
  const n = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  if (item.kind === 'build_pair') return `${value - yellow} red and ${yellow} yellow on the frame (${n(value, 'counter')})`;
  if (item.kind === 'split') return `${item.answer - value} red and ${value} yellow`;
  if (item.kind === 'decompose_teen') return `${n(value, 'counter')} turned yellow`;
  if (item.kind === 'build_teen') return `${n(value, 'counter')} placed below the full ten`;
  if (item.kind === 'make_ten') return `${n(value, 'counter')} added to the ${item.shown} already on the frame`;
  return `${n(value, 'counter')} on the frame`;
}

/** What a wrong spoken number on the frame shows (handoff 20 Part B). */
export type SpokenFrameMiss = OffByMiss | 'empty_count' | 'said_shown' | 'said_capacity' | 'said_addend' | 'said_start' | 'said_change';

/**
 * A spoken item's known wrong answers, in precedence order, for the `spoken_miss` observer: the numbers on this
 * frame first, then the off-by misses. Quick look is the pilot's (qa/tutor-reports/spoken-miss/, empty boxes first).
 */
export function tenFrameSpokenMisses(item: TenFrameItem): KnownMiss[] {
  if (item.answerKind === 'gesture') return [];
  const n = item.answer, cap = item.capacity;
  switch (item.kind) {
    case 'subitize': return [...numberMisses(n, [{ id: 'empty_count', value: cap - n,
      pattern: v => `The learner's answer is ${v}, the number of EMPTY boxes on the frame rather than the counters.` }]),
      ...offByMisses(n, `the ${n} counters shown`)];
    case 'make_ten': return [...numberMisses(n, [
      { id: 'said_shown', value: item.shown, pattern: v => `The learner's answer is ${v}, the counters already on the frame, not how many more make ${cap}.` },
      { id: 'said_capacity', value: cap, pattern: v => `The learner's answer is ${v}, the number to make, not how many more are needed.` }]),
      ...offByMisses(n, `the ${n} more counters that make ${cap}`)];
    case 'add': {
      const addends = [item.addend1, item.addend2].filter((a): a is number => !!a && a !== n);
      return [...(addends.length ? [{ id: 'said_addend', pattern: `The learner's answer is ${Array.from(new Set(addends)).join(' or ')}, `
        + 'one of the two numbers being added, not how many altogether.', examples: addends.map(spokenNumber) }] : []),
        ...offByMisses(n, `the ${n} altogether`)];
    }
    case 'subtract': return [...numberMisses(n, [
      { id: 'said_start', value: item.shown, pattern: v => `The learner's answer is ${v}, how many counters there were before any were taken away.` },
      { id: 'said_change', value: item.removed, pattern: v => `The learner's answer is ${v}, how many counters were taken away, not how many are left.` }]),
      ...offByMisses(n, `the ${n} counters left`)];
    default: return offByMisses(n, `the answer ${n}`);
  }
}

export function workspaceAssignment(item: TenFrameItem): TeachingAssignment {
  const speech = item.answerKind !== 'gesture';
  // A placement is checked by the frame, so the tutor is not handed its key;
  // a spoken number is judged from the tutor's feedback against the answer.
  const misses = speech ? tenFrameSpokenMisses(item) : [];
  return { id: item.id, task: askFor(item), response: speech ? 'speech' : 'gesture',
    ...(speech ? { expectedAnswer: String(item.answer) } : {}), ...(misses.length ? { misses } : {}) };
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
      // build_pair: the made pair as numbers, so `workHistory` records where each turned back.
      ...(item.kind === 'build_pair' ? { redOnFrame: view.onFrame - view.yellow, yellowOnFrame: view.yellow, makeTotal: item.answer } : {}),
      ...(isTeenKind(item.kind) ? { teenNumber: item.teenTotal ?? item.answer } : {}),
      ...(item.kind === 'add' ? { addends: `${item.addend1} and ${item.addend2}` } : {}),
      ...(item.kind === 'subtract' ? { takeAway: item.removed ?? 0 } : {}),
      constraints: item.kind === 'subitize'
        ? 'Quick look: call present when the learner is ready. The counters show briefly, then hide; do not count them out.'
        : item.kind === 'build_pair'
          ? 'Open build: the learner makes the number with red and yellow counters, any pair, and presses I am done; '
            + 'the frame checks the total, both colours, and a pair not already made for this number. Never name a pair or how many to use.'
        : item.answerKind === 'gesture'
          ? 'The learner answers on the frame. The frame checks the placement once the learner stops.'
          : 'The learner says the number. The frame is a working surface only.',
    },
  };
}
