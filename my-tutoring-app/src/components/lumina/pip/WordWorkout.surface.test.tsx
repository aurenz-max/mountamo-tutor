// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import WordWorkout, { type WordWorkoutData } from '../primitives/visual-primitives/literacy/WordWorkout';
import { itemsFromChallenges, type WordWorkoutItemKind } from '../primitives/visual-primitives/literacy/wordWorkoutScript';

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

const data: WordWorkoutData = {
  title: 'Workout', mode: 'real-vs-nonsense', masteredVowels: ['a', 'o'], gradeLevel: '1', instanceId: 'workout',
  challenges: [
    { id: 'real', mode: 'real-vs-nonsense', realWord: 'cat', nonsenseWord: 'zat' },
    { id: 'pic', mode: 'picture-match', targetWord: 'pig', targetImage: '🐷',
      distractorImages: [{ word: 'pin', image: '📌' }, { word: 'bin', image: '🗑️' }] },
    { id: 'chain', mode: 'word-chains', chain: ['cat', 'hat', 'hot', 'hop'], changedPositions: [0, 1, 2] },
    { id: 'sent', mode: 'sentence-reading', sentence: 'The cat sat on the mat.', cvcWords: ['cat', 'sat', 'mat'],
      sightWords: ['the', 'on'], comprehensionQuestion: 'Where did the cat sit?', comprehensionAnswer: 'mat' },
    { id: 'ctx', mode: 'context-discrimination', contextTrialId: 'cat-cap' },
  ],
};
const items = itemsFromChallenges(data.challenges);
const indexOf = (kind: WordWorkoutItemKind, nth = 0) => items.map((item, i) => [item.kind, i] as const).filter(([k]) => k === kind)[nth][1];

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><WordWorkout data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const update = (next: Partial<typeof phase>) => act(() => { Object.assign(phase, next); view.rerender(ui()); });
  return { store, update, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id);

describe('Word Workout drives Pip from its judged phases', () => {
  it('real or silly outlines both words as one region; celebrates only the affirmed answer', () => {
    const { store, update, container } = mount();
    expect(container.querySelector('[data-pip-dock="workout"]')).not.toBeNull();
    expect(ids(store)).toEqual(['pair']);
    update({ tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'pair' });
    update({ cued: false });
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ tutorSpeaking: false, cued: true, revealHeld: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('picture match points at the printed word, never a picture; watches the tapped picture while judged, without receiving it', () => {
    const { store, update, container } = mount();
    update({ index: indexOf('picture_tap'), tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'word' });
    update({ tutorSpeaking: false });
    const picture = container.querySelector('[data-pip-object="picture-pin"]') as HTMLElement;
    act(() => { fireEvent.click(picture); });
    expect(phase.submit).toHaveBeenCalledTimes(1);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'picture-pin' });
    update({ stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'picture-pin' });
    update({ stage: 'asking' });
    act(() => { phase.retry(); });
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'word' });
  });

  it('a chain word points at the row the screen marks; the sentence and its question point at the whole sentence', () => {
    const { store, update, container } = mount();
    update({ index: indexOf('chain_word', 1), tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'chain-row' });
    expect(container.querySelector('[data-pip-object="chain-row"]')?.textContent).toContain('hat');
    update({ index: indexOf('read_sentence') });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'sentence' });
    update({ index: indexOf('answer_question') });
    expect(ids(store)).toEqual(['sentence']);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'sentence' });
  });

  it('near words: the marked card on the read, the sentence (never a word card) on the choice; unregisters on unmount', () => {
    const { store, update, unmount } = mount();
    update({ index: indexOf('read_context_word'), tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'context-target' });
    update({ index: indexOf('choose_context_word') });
    expect(ids(store)).toEqual(['sentence']);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'sentence' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
