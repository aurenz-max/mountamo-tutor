// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import { sortingStationPipPose, type SortingPipState } from './sortingStationPipPose';
import SortingStation, { type SortingStationData } from '../primitives/visual-primitives/math/SortingStation';

const phase = vi.hoisted(() => ({ tutorSpeaking: false, stage: 'asking', currentSolved: false, index: 0 }));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack }: { pack: { items: Array<{ id: string }> } }) => {
    const item = pack.items[phase.index] ?? null;
    return {
      currentItem: item, currentIndex: phase.index, ...phase, cuedItemId: item?.id ?? null,
      canAttempt: phase.stage !== 'judging' && !phase.currentSolved, solvedIds: new Set(),
      running: true, preparing: false, summary: null, revealHeld: false, micState: 'armed', statusLine: '',
      start: vi.fn(), hearStimulus: vi.fn(), stimulusTapped: false, armStillness: vi.fn(), clearStillness: vi.fn(),
      isAwaitingGesture: () => false, submitGestureAttempt: vi.fn(), loop: {},
    };
  },
}));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0 }));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(cleanup);
beforeEach(() => { phase.tutorSpeaking = false; phase.stage = 'asking'; phase.currentSolved = false; phase.index = 0; });

const data: SortingStationData = {
  title: 'Needs and Wants', gradeBand: '1', maxCategories: 2, showCounts: true, showTallyChart: false, instanceId: 'sorting',
  challenges: [{
    id: 'c1', type: 'sort-by-one', instruction: 'Sort these', sortingAttribute: 'category',
    objects: [
      { id: 'o1', label: 'water', emoji: '💧', attributes: { category: 'need' } },
      { id: 'o2', label: 'toy', emoji: '🧸', attributes: { category: 'want' } },
    ],
    categories: [
      { label: 'Need', rule: { category: 'need' }, bucketEmoji: '🏠' },
      { label: 'Want', rule: { category: 'want' }, bucketEmoji: '🎁' },
    ],
  }],
};

describe('Sorting Station drives Pip from its judged phases', () => {
  it('points at the card the tutor named, never at a tray, and celebrates only the affirmed sort', () => {
    phase.tutorSpeaking = true;
    const store = new PipSurfaceStore();
    store.setActive('sorting');
    const ui = () => <PipSurfaceContext.Provider value={store}><SortingStation data={data} /></PipSurfaceContext.Provider>;
    const { rerender, unmount } = render(ui());
    expect(store.getActive()?.pose).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'focus' });
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(expect.arrayContaining(['focus', 'trays', 'tray-need', 'tray-want']));
    phase.tutorSpeaking = false; phase.stage = 'judging';
    rerender(ui());
    expect(store.getActive()?.pose).toEqual({ phase: 'checking', gesture: 'look', targetId: 'focus' });
    phase.stage = 'asking'; phase.currentSolved = true;
    rerender(ui());
    expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});

describe('sorting station pose policy', () => {
  const cue: SortingPipState = {
    running: true, preparing: false, currentSolved: false, revealHeld: false, judging: false,
    tutorSpeaking: true, cueMatchesItem: true, kind: 'count_group',
    namedTrayId: 'tray-need', visibleIds: ['trays', 'tray-need', 'tray-want'],
  };
  it('points at the counted group the ask names, and at whole regions for every choice ask', () => {
    expect(sortingStationPipPose(cue).targetId).toBe('tray-need');
    expect(sortingStationPipPose({ ...cue, kind: 'compare' }).targetId).toBe('trays');
    expect(sortingStationPipPose({ ...cue, kind: 'odd_one', visibleIds: ['cards'] }).targetId).toBe('cards');
    expect(sortingStationPipPose({ ...cue, kind: 'pick_rule', visibleIds: ['cards'] }).targetId).toBe('cards');
  });
});
