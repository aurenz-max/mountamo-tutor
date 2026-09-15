// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import RhymeStudio, { type RhymeStudioData } from '../primitives/visual-primitives/literacy/RhymeStudio';

const phase = vi.hoisted(() => ({
  tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true, running: true,
}));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack }: { pack: { items: Array<{ id: string; mode: string }> } }) => {
    const item = pack.items[phase.index] ?? null;
    return {
      currentItem: item, currentIndex: phase.index, stage: phase.stage, tutorSpeaking: phase.tutorSpeaking,
      currentSolved: phase.currentSolved, revealHeld: phase.revealHeld, cuedItemId: phase.cued ? item?.id ?? null : 'elsewhere',
      canAttempt: phase.stage !== 'judging' && !phase.currentSolved, solvedIds: new Set(),
      running: phase.running, preparing: false, summary: null, stimulusTapped: false, hearStimulus: vi.fn(),
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

beforeEach(() => {
  Object.assign(phase, { tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true, running: true });
});
afterEach(cleanup);

const data: RhymeStudioData = {
  title: 'Rhyme Time', gradeLevel: 'K', instanceId: 'rhyme',
  challenges: [
    { id: 'rec', mode: 'recognition', targetWord: 'cat', targetWordImage: 'a cat', targetWordEmoji: '🐱', rhymeFamily: '-at',
      comparisonWord: 'bat', comparisonWordImage: 'a bat', comparisonWordEmoji: '🦇', doesRhyme: true },
    { id: 'idf', mode: 'identification', targetWord: 'sun', targetWordImage: 'the sun', targetWordEmoji: '☀️', rhymeFamily: '-un',
      options: [{ word: 'bun', image: '🍞', isCorrect: true }, { word: 'dog', image: '🐶', isCorrect: false }] },
    { id: 'col', mode: 'collection', targetWord: 'hat', targetWordImage: 'a hat', rhymeFamily: '-at', acceptableAnswers: ['cat', 'mat', 'bat'] },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><RhymeStudio data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const update = (next: Partial<typeof phase>) => act(() => { Object.assign(phase, next); view.rerender(ui()); });
  return { store, update, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id);

describe('Rhyme Studio drives Pip from its judged phases', () => {
  it('recognition outlines the pair as the question; idle before start; celebrates only the affirmed answer', () => {
    const { store, update, container } = mount();
    expect(container.querySelector('[data-pip-dock="rhyme"]')).not.toBeNull();
    update({ running: false });
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ running: true });
    expect(ids(store)).toEqual(['pair']);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'pair' });
    update({ tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'pair' });
    update({ cued: false }); // praise for the previous item, before this cue is sent
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ tutorSpeaking: false, cued: true, revealHeld: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('identification points at the target card and never publishes a choice card', () => {
    const { store, update, container } = mount();
    update({ index: 1, tutorSpeaking: true });
    expect(container.querySelectorAll('[data-pip-object]')).toHaveLength(1);
    expect(ids(store)).toEqual(['target']);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'target' });
    update({ tutorSpeaking: false, stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'target' });
  });

  it('collection points at the target word, never a rhyme slot; unregisters on unmount', () => {
    const { store, update, unmount } = mount();
    update({ index: 2, tutorSpeaking: true });
    expect(store.getActive()?.scopeId).toContain('col');
    expect(ids(store)).toEqual(['target']);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'target' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
