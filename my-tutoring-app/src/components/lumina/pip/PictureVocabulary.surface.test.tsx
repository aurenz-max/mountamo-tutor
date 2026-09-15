// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import PictureVocabulary, { type PictureVocabularyData } from '../primitives/visual-primitives/literacy/PictureVocabulary';

const phase = vi.hoisted(() => ({
  tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true,
  retry: () => {}, submit: vi.fn(),
}));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack, onCorrectionRetry }: { pack: { items: Array<{ id: string }> }; onCorrectionRetry?: () => void }) => {
    const item = pack.items[phase.index] ?? null;
    phase.retry = () => onCorrectionRetry?.();
    return {
      currentItem: item, currentIndex: phase.index, stage: phase.stage, tutorSpeaking: phase.tutorSpeaking,
      currentSolved: phase.currentSolved, revealHeld: phase.revealHeld, cuedItemId: phase.cued ? item?.id ?? null : 'elsewhere',
      canAttempt: phase.stage !== 'judging' && !phase.currentSolved, solvedIds: new Set(),
      running: true, preparing: false, summary: null, stimulusTapped: false, hearStimulus: vi.fn(),
      isAwaitingGesture: () => false, submitGestureAttempt: phase.submit,
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
  Object.assign(phase, { tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true });
  phase.submit.mockClear();
});
afterEach(cleanup);

const data: PictureVocabularyData = {
  title: 'Words', description: '', challengeType: 'receptive_match', gradeLevel: 'K', instanceId: 'vocab',
  challenges: [
    { id: 'pv-1', type: 'receptive_match', word: 'dog', emoji: '🐶',
      options: [{ word: 'dog', emoji: '🐶' }, { word: 'sun', emoji: '☀️' }, { word: 'cup', emoji: '☕' }, { word: 'bus', emoji: '🚌' }] },
    { id: 'pv-3', type: 'opposite', word: 'small', emoji: '🐭', baseWord: 'big', baseEmoji: '🐘' },
    { id: 'pv-5', type: 'gradable_scale', word: 'cool', emoji: '🌡️', scaleWords: ['freezing', 'cold', 'cool', 'warm', 'hot'], scaleTargetIndex: 2 },
    { id: 'pv-6', type: 'sentence_frame', word: 'bed', emoji: '🛏️', frameDisplay: 'We sleep in a ____ at night.' },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><PictureVocabulary data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const update = (next: Partial<typeof phase>) => act(() => { Object.assign(phase, next); view.rerender(ui()); });
  return { store, update, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id);

describe('Picture Vocabulary drives Pip from its judged phases', () => {
  it('receptive match outlines the cards as a group and watches the tapped card while judged, without receiving it', () => {
    const { store, update, container } = mount();
    expect(container.querySelector('[data-pip-dock="vocab"]')).not.toBeNull();
    update({ tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'cards' });
    update({ tutorSpeaking: false });
    act(() => { fireEvent.click(container.querySelector('[data-pip-object="card-sun"]') as HTMLElement); });
    expect(phase.submit).toHaveBeenCalledTimes(1);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'card-sun' });
    update({ stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'card-sun' });
    update({ stage: 'asking' });
    act(() => { phase.retry(); });
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'cards' });
  });

  it('spoken modes point at the stimulus card and publish no answer surface', () => {
    const { store, update } = mount();
    for (const index of [1, 2, 3]) {
      update({ index, tutorSpeaking: true });
      expect(ids(store)).toEqual(['stimulus']);
      expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stimulus' });
    }
    update({ tutorSpeaking: false, revealHeld: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('unregisters on unmount', () => {
    const { store, unmount } = mount();
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
