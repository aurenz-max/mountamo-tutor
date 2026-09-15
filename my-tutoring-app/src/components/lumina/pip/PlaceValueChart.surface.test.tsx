// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import PlaceValueChart from '../primitives/visual-primitives/math/PlaceValueChart';

const phase = vi.hoisted(() => ({
  tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true,
}));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack }: { pack: { items: Array<{ id: string }> } }) => {
    const item = pack.items[phase.index] ?? null;
    return {
      currentItem: item, currentIndex: phase.index, stage: phase.stage, tutorSpeaking: phase.tutorSpeaking,
      currentSolved: phase.currentSolved, revealHeld: phase.revealHeld, cuedItemId: phase.cued ? item?.id ?? null : 'elsewhere',
      canAttempt: phase.stage !== 'judging' && !phase.currentSolved, solvedIds: new Set(),
      running: true, preparing: false, summary: null, stimulusTapped: false, hearStimulus: vi.fn(),
      isAwaitingGesture: () => false, submitGestureAttempt: vi.fn(),
    };
  },
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../components/JudgedMicPanel', () => ({ default: () => null }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('@/lib/authApiClient', () => ({ authApi: { post: vi.fn().mockResolvedValue({}) } }));
beforeEach(() => {
  Object.assign(phase, { tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true });
});
afterEach(cleanup);

const challenge = { id: 'p', targetNumber: 2345, highlightedDigitPlace: 1, minPlace: 0, maxPlace: 3, placeNameChoices: [], digitValueChoices: [] };
function mount(challengeType: string) {
  const store = new PipSurfaceStore();
  const data = { title: 'Place value', description: '', challengeType, supportTier: 'medium', instanceId: 'pv', challenges: [challenge] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ui = () => <PipSurfaceContext.Provider value={store}><PlaceValueChart data={data as any} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const update = (next: Partial<typeof phase>) => act(() => { Object.assign(phase, next); view.rerender(ui()); });
  return { ...view, store, update };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Place Value Chart drives Pip from its judged phases', () => {
  it('points at the stage as a whole, never a digit or column; watches the column being written; receives the build', () => {
    const { store, update, container } = mount('build');
    expect(container.querySelector('[data-pip-dock="pv"]')).not.toBeNull();
    update({ tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stage' });
    update({ tutorSpeaking: false });
    const column = container.querySelector('[data-pip-object^="digit-"]') as HTMLElement | null;
    expect(column).not.toBeNull();
    if (column) {
      act(() => { fireEvent.focus(column); });
      expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: column.getAttribute('data-pip-object') });
      update({ stage: 'judging' });
      expect(pose(store)?.gesture).toBe('receive');
    }
    update({ stage: 'asking', revealHeld: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('a spoken item points at the stage and unregisters on unmount', () => {
    const { store, update, unmount } = mount('identify');
    update({ tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stage' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
