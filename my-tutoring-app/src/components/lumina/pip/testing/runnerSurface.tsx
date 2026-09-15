import { expect } from 'vitest';
import { mountWithStore, poseOf } from './classicSurface';

/** The hoisted runner phase a `useJudgedScriptRunner` mock reads. */
export interface RunnerPhase {
  stage: 'idle' | 'asking' | 'judging' | 'affirmed' | 'done';
  running: boolean;
  tutorSpeaking: boolean;
  currentSolved: boolean;
  revealHeld: boolean;
  itemIndex: number;
}

export const initialRunnerPhase = (): RunnerPhase => ({
  stage: 'asking', running: true, tutorSpeaking: false, currentSolved: false, revealHeld: false, itemIndex: 0,
});

/** A module double for `hooks/useJudgedScriptRunner`: the current item is
 * `pack.items[phase.itemIndex]`, cued as soon as it opens.
 *
 *   const phase = vi.hoisted(() => ({ stage: 'asking', ... }));
 *   vi.mock('../hooks/useJudgedScriptRunner', async (original) => ({
 *     ...(await original()), ...(await import('./testing/runnerSurface')).fakeRunnerModule(phase),
 *   }));
 */
export function fakeRunnerModule(phase: RunnerPhase) {
  return {
    useJudgedScriptRunner: ({ pack }: { pack: { items: ReadonlyArray<{ id: string }> } }) => {
      const item = pack.items[phase.itemIndex] ?? null;
      return {
        currentItem: item, currentIndex: phase.itemIndex, stage: phase.stage, running: phase.running, preparing: false,
        tutorSpeaking: phase.tutorSpeaking, currentSolved: phase.currentSolved, revealHeld: phase.revealHeld,
        cuedItemId: item?.id ?? null, canAttempt: phase.running && !phase.currentSolved && phase.stage !== 'judging',
        solvedIds: new Set<string>(), summary: null, stimulusTapped: false, hearStimulus: () => {},
        isAwaitingGesture: () => false, submitGestureAttempt: () => {},
      };
    },
  };
}

/** The contract every `useStimulusPipSurface` integration keeps: a dock for this
 * instance, a point at the cue target only while the tutor speaks on this item,
 * a look at the stimulus while the child answers, checking (receiving a hands
 * answer) while judged, a celebration only on a held reveal, and nothing left
 * after unmount.
 */
export function expectStimulusSurface(options: {
  mounted: ReturnType<typeof mountWithStore>;
  phase: RunnerPhase;
  instanceId: string;
  cueId?: string;
  receive?: boolean;
}) {
  const { mounted, phase, instanceId, cueId = 'stimulus' } = options;
  const { store, refresh, container, unmount } = mounted;
  expect(container.querySelector(`[data-pip-dock="${instanceId}"]`)).not.toBeNull();
  expect(store.getActive()?.targets.map((t) => t.id)).toEqual(expect.arrayContaining(['stimulus', cueId]));

  phase.tutorSpeaking = true;
  refresh();
  expect(poseOf(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: cueId });
  phase.tutorSpeaking = false;
  refresh();
  expect(poseOf(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'stimulus' });

  phase.stage = 'judging';
  refresh();
  expect(poseOf(store)).toEqual({ phase: 'checking', gesture: options.receive ? 'receive' : 'look', targetId: 'stimulus' });

  phase.stage = 'affirmed';
  phase.revealHeld = true;
  refresh();
  expect(poseOf(store)).toEqual({ phase: 'celebrating', gesture: 'none' });

  unmount();
  expect(store.getActive()).toBeNull();
}
