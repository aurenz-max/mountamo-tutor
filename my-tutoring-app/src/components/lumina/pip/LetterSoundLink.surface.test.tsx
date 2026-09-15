// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import LetterSoundLink, { type LetterSoundLinkData } from '../primitives/visual-primitives/literacy/LetterSoundLink';

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

const data: LetterSoundLinkData = {
  title: 'Letter Sounds', letterGroup: 1, cumulativeLetters: ['s', 'a', 't', 'i', 'p', 'n'], gradeLevel: 'K', instanceId: 'link',
  challenges: [
    { id: 'ch1', mode: 'see-hear', targetLetter: 's', targetSound: '/s/', keywordWord: 'sun', keywordImage: 'sun' },
    { id: 'ch2', mode: 'hear-see', targetLetter: 't', targetSound: '/t/', keywordWord: 'top', keywordImage: 'top',
      options: [{ letter: 't', isCorrect: true }, { letter: 'd', isCorrect: false }] },
    { id: 'ch3', mode: 'keyword-match', targetLetter: 'm', targetSound: '/m/', keywordWord: 'map', keywordImage: 'map',
      options: [{ sound: 'map', isCorrect: true }, { sound: 'net', isCorrect: false }] },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><LetterSoundLink data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const update = (next: Partial<typeof phase>) => act(() => { Object.assign(phase, next); view.rerender(ui()); });
  return { ...view, store, update };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id);

describe('Letter-Sound Link drives Pip from its judged phases', () => {
  it('see-hear points at the letter card; celebrates only the affirmed sound', () => {
    const { store, update, container } = mount();
    expect(container.querySelector('[data-pip-dock="link"]')).not.toBeNull();
    expect(ids(store)).toEqual(['letter']);
    update({ tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'letter' });
    update({ cued: false });
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ tutorSpeaking: false, cued: true, revealHeld: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('hear-see outlines the letter buttons as a group; watches the tapped letter while judged, without receiving it', () => {
    const { store, update, container } = mount();
    const index = Array.from({ length: 3 }, (_, i) => i).find((i) => {
      update({ index: i });
      return container.querySelector('[data-pip-object="options"]') !== null;
    })!;
    update({ index, tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'options' });
    update({ tutorSpeaking: false });
    act(() => { fireEvent.click(container.querySelector('[data-pip-object="option-d"]') as HTMLElement); });
    expect(phase.submit).toHaveBeenCalledTimes(1);
    update({ stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'option-d' });
    update({ stage: 'asking' });
    act(() => { phase.retry(); });
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'options' });
  });

  it('keyword match points at the letter, never a picture; unregisters on unmount', () => {
    const { store, update, container, unmount } = mount();
    const index = Array.from({ length: 3 }, (_, i) => i).find((i) => {
      update({ index: i });
      return store.getActive()?.scopeId?.includes('ch3');
    })!;
    update({ index, tutorSpeaking: true });
    expect(container.querySelectorAll('[data-pip-object]')).toHaveLength(1);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'letter' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
