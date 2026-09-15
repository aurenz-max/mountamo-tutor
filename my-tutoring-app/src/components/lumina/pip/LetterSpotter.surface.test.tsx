// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import LetterSpotter, { type LetterSpotterData } from '../primitives/visual-primitives/literacy/LetterSpotter';
import { SPOTTER_EMOJI } from '../primitives/visual-primitives/literacy/letterSpotterScript';

const phase = vi.hoisted(() => ({
  tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true,
  retry: () => {},
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
  Object.assign(phase, { tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true });
});
afterEach(cleanup);

const data: LetterSpotterData = {
  title: 'Letters', letterGroup: 1, cumulativeLetters: ['s', 'a', 't', 'p', 'i', 'n'], newLetters: [], gradeLevel: 'K', instanceId: 'spotter',
  challenges: [
    { id: 'name', mode: 'name-it', targetLetter: 'a', targetCase: 'lowercase', targetWord: 'ant',
      spokenSentence: 'I see an ant walk away.', sentence: `I see an ${SPOTTER_EMOJI}nt walk away.` },
    { id: 'find', mode: 'find-it', targetLetter: 'p', targetCase: 'uppercase',
      letterGrid: ['S', 'A', 'T', 'I', 'N', 'P', 'S', 'A', 'T', 'I', 'N', 'S', 'A', 'T', 'I', 'N'] },
    { id: 'match', mode: 'match-it', targetLetter: 's', targetCase: 'both', options: ['s', 'a', 'n', 't'] },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  store.setActive('spotter');
  const ui = () => <PipSurfaceContext.Provider value={store}><LetterSpotter data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const update = (next: Partial<typeof phase>) => act(() => { Object.assign(phase, next); view.rerender(ui()); });
  return { store, update, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Letter Spotter drives Pip from its judged phases', () => {
  it('name-it points at the star over the hidden letter and celebrates only the affirmed answer', () => {
    const { store, update, container } = mount();
    expect(container.querySelector('[data-pip-dock="spotter"]')).not.toBeNull();
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'marker' });
    update({ tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'marker' });
    update({ cued: false }); // the previous item's praise, before this item's cue is sent
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ tutorSpeaking: false, cued: true, revealHeld: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('find-it outlines the whole grid, never a cell; follows the tapped cell while judged; a retry drops it', () => {
    const { store, update } = mount();
    update({ index: 1, tutorSpeaking: true });
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(expect.arrayContaining(['grid', 'cell-0', 'cell-15']));
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'grid' });
    update({ tutorSpeaking: false });
    fireEvent.click(document.querySelector('[data-pip-object="cell-3"]')!);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'cell-3' });
    update({ stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'cell-3' });
    update({ stage: 'asking', tutorSpeaking: true }); // the correction re-says the letter
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'grid' });
    act(() => { phase.retry(); });
    update({ tutorSpeaking: false });
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'grid' });
  });

  it('match-it points at the big letter, never a little one; watches the tapped option; a new item drops it', () => {
    const { store, update } = mount();
    update({ index: 2, tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'letter' });
    update({ tutorSpeaking: false });
    fireEvent.click(screen.getByRole('button', { name: 'n' }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'option-n' });
    update({ stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'option-n' });
    update({ stage: 'asking', index: 1 });
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'grid' });
  });

  it('unregisters on unmount', () => {
    const { store, unmount } = mount();
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
