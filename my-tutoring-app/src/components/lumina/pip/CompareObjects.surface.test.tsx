// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import CompareObjects, { type CompareObjectsData } from '../primitives/visual-primitives/math/CompareObjects';

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

const base = { title: 'Compare', gradeBand: '1' as const, instanceId: 'compare' };
const challenge = { instruction: '', hint: '', attribute: 'length' as const, comparisonWord: 'longer' as const };
const two: CompareObjectsData = { ...base, challenges: [{ ...challenge, id: 'c2', type: 'compare_two', correctAnswer: 'jump rope',
  objects: [{ name: 'jump rope', visualSize: 75, actualValue: 200 }, { name: 'shoelace', visualSize: 35, actualValue: 80 }] }] };
const three: CompareObjectsData = { ...base, challenges: [{ ...challenge, id: 'c4', type: 'order_three', attribute: 'height', comparisonWord: 'taller',
  correctAnswer: 'sunflower, tulip, daisy',
  objects: [{ name: 'tulip', visualSize: 50, actualValue: 60 }, { name: 'sunflower', visualSize: 80, actualValue: 150 }, { name: 'daisy', visualSize: 30, actualValue: 30 }] }] };

function mount(input: CompareObjectsData) {
  const store = new PipSurfaceStore();
  store.setActive('compare');
  const ui = () => <PipSurfaceContext.Provider value={store}><CompareObjects data={input} /></PipSurfaceContext.Provider>;
  return { store, ui, ...render(ui()) };
}

describe('Compare Objects drives Pip from its judged phases', () => {
  it('points at the whole drawing on a comparison, never at one object', () => {
    phase.tutorSpeaking = true;
    const { store, rerender, ui } = mount(two);
    expect(store.getActive()?.pose).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'drawing' });
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['drawing']);
    phase.tutorSpeaking = false; phase.stage = 'judging';
    rerender(ui());
    expect(store.getActive()?.pose).toEqual({ phase: 'checking', gesture: 'look', targetId: 'drawing' });
  });

  it('follows the child’s own order taps and receives the order', () => {
    const { store, container, rerender, ui, unmount } = mount(three);
    expect(store.getActive()?.pose).toEqual({ phase: 'working', gesture: 'none' });
    fireEvent.click(container.querySelector('[data-pip-object="pick-daisy"]')!);
    expect(store.getActive()?.pose).toEqual({ phase: 'working', gesture: 'look', targetId: 'pick-daisy' });
    phase.stage = 'judging';
    rerender(ui());
    expect(store.getActive()?.pose).toMatchObject({ phase: 'checking', gesture: 'receive', targetId: 'pick-daisy' });
    phase.stage = 'asking'; phase.currentSolved = true;
    rerender(ui());
    expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
