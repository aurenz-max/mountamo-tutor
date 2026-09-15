// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import SyllableClapper, { type SyllableClapperData } from '../primitives/visual-primitives/literacy/SyllableClapper';

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
vi.mock('@/contexts/LuminaAIContext', () => ({
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({ isConnected: true, sendText: vi.fn() }),
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../components/JudgedMicPanel', () => ({ default: () => null }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

beforeEach(() => {
  Object.assign(phase, { tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true, running: true });
});
afterEach(cleanup);

const data: SyllableClapperData = {
  title: 'Clap It Out', instanceId: 'clap',
  challenges: [
    { id: 'c1', word: 'butterfly', syllableCount: 3, syllables: ['but', 'ter', 'fly'], imageDescription: 'a butterfly', difficulty: 4, challengeType: 'medium' },
    { id: 'c2', word: 'tiger', syllableCount: 2, syllables: ['ti', 'ger'], imageDescription: 'a tiger', difficulty: 2, challengeType: 'easy' },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><SyllableClapper data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const update = (next: Partial<typeof phase>) => act(() => { Object.assign(phase, next); view.rerender(ui()); });
  return { ...view, store, update };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Syllable Clapper drives Pip from its judged phases', () => {
  it('points at the hear-it-again button; idle before start and over the previous praise; watches it while judged', () => {
    const { store, update, container } = mount();
    expect(container.querySelector('[data-pip-dock="clap"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['stimulus']);
    update({ running: false });
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ running: true, tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stimulus' });
    update({ index: 1, cued: false });
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ tutorSpeaking: false, cued: true, stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'stimulus' });
  });

  it('celebrates the held reveal and unregisters on unmount', () => {
    const { store, update, unmount } = mount();
    update({ revealHeld: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
