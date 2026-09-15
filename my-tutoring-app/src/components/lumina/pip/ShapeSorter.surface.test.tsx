// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import ShapeSorter, { type ShapeSorterData } from '../primitives/visual-primitives/math/ShapeSorter';
import { itemsFromChallenges } from '../primitives/visual-primitives/math/shapeSorterScript';

const phase = vi.hoisted(() => ({
  tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, running: true,
  index: 0, staleCue: false,
}));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack }: { pack: { items: Array<{ id: string }> } }) => {
    const item = pack.items[phase.index] ?? null;
    return {
      currentItem: item, currentIndex: phase.index, ...phase,
      cuedItemId: phase.staleCue ? 'previous-item' : item?.id ?? null,
      canAttempt: phase.stage !== 'judging' && !phase.currentSolved, solvedIds: new Set(),
      preparing: false, summary: null, micState: 'armed', statusLine: '',
      start: vi.fn(), hearStimulus: vi.fn(), stimulusTapped: false,
      armStillness: vi.fn(), clearStillness: vi.fn(), isAwaitingGesture: () => false, submitGestureAttempt: vi.fn(), loop: {},
    };
  },
}));
vi.mock('../components/JudgedMicPanel', () => ({ default: () => null }));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));

afterEach(cleanup);
beforeEach(() => {
  Object.assign(phase, { tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, running: true, index: 0, staleCue: false });
});

const shape = (s: string, color = 'blue') => ({ shape: s, color, size: 'medium' as const, rotation: 0 });
const data: ShapeSorterData = {
  title: 'Shapes', gradeBand: 'K', instanceId: 'shapes',
  challenges: [
    { id: 'i1', type: 'identify', instruction: '', ruleAttribute: 'shape', targetValue: 'triangle', shapes: [shape('triangle'), shape('circle', 'red'), shape('hexagon', 'green')] },
    { id: 'c1', type: 'count', instruction: '', ruleAttribute: 'shape', targetValue: 'pentagon', shapes: [shape('pentagon', 'green')] },
    { id: 's1', type: 'sort', instruction: '', ruleAttribute: 'curved', shapes: [shape('circle', 'red'), shape('square'), shape('oval', 'pink'), shape('triangle', 'green')] },
  ],
};
const items = itemsFromChallenges(data.challenges, { isPreReader: true });
const indexOf = (mode: string, nth = 0) => items.map((item, i) => [item.mode, i] as const).filter(([m]) => m === mode)[nth][1];

function mount() {
  const store = new PipSurfaceStore();
  store.setActive('shapes');
  const ui = () => <PipSurfaceContext.Provider value={store}><ShapeSorter data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const update = (next: Partial<typeof phase>) => { Object.assign(phase, next); view.rerender(ui()); };
  return { store, update, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id);

describe('Shape Sorter drives Pip from its judged phases', () => {
  it('identify: points at the ringed shape, watches it while judged, celebrates the held reveal', () => {
    phase.index = indexOf('identify');
    const { store, update, container } = mount();
    expect(container.querySelector('[data-pip-dock="shapes"]')).not.toBeNull();
    // Spoken answer: while the child thinks, Pip keeps the shape in view.
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'shape' });
    update({ tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'shape' });
    expect(ids(store)).toEqual(['shape']);
    // The published shape is the one the ask means: the only ringed drawing.
    const ringed = store.getActive()?.targets[0].element;
    expect(ringed?.tagName.toLowerCase()).toBe('g');
    expect(ringed?.querySelector('circle[fill="none"]')).not.toBeNull();
    update({ tutorSpeaking: false, stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'shape' });
    update({ stage: 'asking', revealHeld: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('identify: the next item in the same pool moves the published shape with the ring', () => {
    phase.index = indexOf('identify');
    const { store, update } = mount();
    const first = store.getActive()?.targets[0].element;
    update({ index: indexOf('identify', 1) });
    const second = store.getActive()?.targets[0].element;
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    expect(first?.isConnected).toBe(true);
    expect(second?.querySelector('circle[fill="none"]')).not.toBeNull();
    expect(first?.querySelector('circle[fill="none"]')).toBeNull();
  });

  it('count: points at the large shape to count', () => {
    phase.index = indexOf('count');
    phase.tutorSpeaking = true;
    const { store } = mount();
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'shape' });
    expect(store.getActive()?.targets[0].element.getAttribute('aria-label')).toBe('Shape to count');
  });

  it('sort: publishes the mats but never points at them', () => {
    phase.index = indexOf('sort');
    phase.tutorSpeaking = true;
    const { store, update } = mount();
    expect(ids(store)).toEqual(['shape', 'mats']);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'shape' });
    update({ tutorSpeaking: false, stage: 'judging' });
    expect(pose(store)?.targetId).toBe('shape');
  });

  it('stays neutral before start and over a cue for another item; unregisters on unmount', () => {
    phase.running = false;
    const { store, update, unmount } = mount();
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ running: true, tutorSpeaking: true, staleCue: true });
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
