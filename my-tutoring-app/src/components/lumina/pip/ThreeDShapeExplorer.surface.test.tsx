// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import ThreeDShapeExplorer, { type ThreeDShapeExplorerData } from '../primitives/visual-primitives/math/ThreeDShapeExplorer';
import { canonicalRiddleCluesFor } from '../primitives/visual-primitives/math/threeDShapeExplorerScript';

const phase = vi.hoisted(() => ({
  tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true, running: true,
}));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack }: { pack: { items: Array<{ id: string }> } }) => {
    const item = pack.items[phase.index] ?? null;
    return {
      currentItem: item, currentIndex: phase.index, stage: phase.stage, tutorSpeaking: phase.tutorSpeaking,
      currentSolved: phase.currentSolved, revealHeld: phase.revealHeld, cuedItemId: phase.cued ? item?.id ?? null : 'elsewhere',
      canAttempt: phase.stage !== 'judging' && !phase.currentSolved, solvedIds: new Set(),
      running: phase.running, preparing: false, summary: null, stimulusTapped: false, hearStimulus: vi.fn(),
    };
  },
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../components/JudgedMicPanel', () => ({ default: () => null }));

beforeEach(() => {
  Object.assign(phase, { tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true, running: true });
});
afterEach(cleanup);

const data = {
  title: 'Solids', gradeBand: 'K', instanceId: 'solids',
  challenges: [
    { id: 'i1', type: 'identify-3d', shape3d: 'cube' },
    { id: 'r1', type: 'shape-riddle', shape3d: 'sphere', clues: canonicalRiddleCluesFor('sphere') },
  ],
} as unknown as ThreeDShapeExplorerData;

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><ThreeDShapeExplorer data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const update = (next: Partial<typeof phase>) => act(() => { Object.assign(phase, next); view.rerender(ui()); });
  return { ...view, store, update };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('3D Shape Explorer drives Pip from its judged phases', () => {
  it('points at the solid as a whole; idle before start and over the previous praise; celebrates the held reveal', () => {
    const { store, update, container } = mount();
    expect(container.querySelector('[data-pip-dock="solids"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['stimulus']);
    update({ running: false });
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ running: true, tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stimulus' });
    update({ index: 1, cued: false });
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ cued: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stimulus' });
    update({ tutorSpeaking: false, stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'stimulus' });
    update({ revealHeld: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('unregisters on unmount', () => {
    const { store, unmount } = mount();
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
