// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import WordSorter, { type WordSorterData } from '../primitives/visual-primitives/literacy/WordSorter';

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

beforeEach(() => {
  Object.assign(phase, { tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true });
});
afterEach(cleanup);

const data: WordSorterData = {
  title: 'Sorting', gradeLevel: 'K', sortingTopic: 'Animals and food', instanceId: 'sorter',
  challenges: [
    { id: 'ch1', type: 'binary_sort', instruction: '', bucketLabels: ['Animals', 'Food'], bucketEmojis: ['🐾', '🍎'],
      words: [
        { id: 'w0', word: 'dog', emoji: '🐕', correctBucket: 'Animals' },
        { id: 'w1', word: 'bread', emoji: '🍞', correctBucket: 'Food' },
      ] },
    { id: 'ch2', type: 'match_pairs', instruction: '', relationLabel: 'opposite',
      pairs: [{ id: 'p0', term: 'big', match: 'small' }, { id: 'p1', term: 'hot', match: 'cold' }] },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  store.setActive('sorter');
  const ui = () => <PipSurfaceContext.Provider value={store}><WordSorter data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const update = (next: Partial<typeof phase>) => act(() => { Object.assign(phase, next); view.rerender(ui()); });
  return { store, update, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Word Sorter drives Pip from its judged phases', () => {
  it('points at the word card on the ask, never a mat; celebrates only the affirmed answer', () => {
    const { store, update, container } = mount();
    expect(container.querySelector('[data-pip-dock="sorter"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['word']);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'word' });
    update({ tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'word' });
    update({ cued: false }); // praise for the previous word, before this word's cue is sent
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ tutorSpeaking: false, cued: true, revealHeld: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('match_pairs also points only at the word card, never at a bank word', () => {
    const { store, update } = mount();
    const matchIndex = 2; // two sort items, then the pairs
    update({ index: matchIndex, tutorSpeaking: true });
    expect(store.getActive()?.scopeId).toContain('ch2');
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['word']);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'word' });
  });

  it('unregisters on unmount', () => {
    const { store, unmount } = mount();
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
