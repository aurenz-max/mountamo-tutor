// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import CountingBoard, { type CountingBoardData } from '../primitives/visual-primitives/math/CountingBoard';

const phase = vi.hoisted(() => ({ tutorSpeaking: false, stage: 'asking', currentSolved: false }));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack }: { pack: { items: Array<{ id: string }> } }) => ({
    currentItem: pack.items[0], currentIndex: 0, ...phase, cuedItemId: pack.items[0]?.id,
    canAttempt: phase.stage !== 'judging' && !phase.currentSolved,
    running: true, preparing: false, summary: null, revealHeld: false,
    start: vi.fn(), isAwaitingGesture: () => false, submitGestureAttempt: vi.fn(),
  }),
}));
vi.mock('../evaluation', () => ({ usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: vi.fn() }),
  useEvaluationContext: () => null }));
vi.mock('../components/JudgedMicPanel', () => ({ default: () => null }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(cleanup);
beforeEach(() => { phase.tutorSpeaking = false; phase.stage = 'asking'; phase.currentSolved = false; });
const data: CountingBoardData = {
  title: 'Count', objects: { type: 'apples' }, instanceId: 'counting-instance', gradeBand: 'K',
  challenges: [{ id: 'first', type: 'count_all', count: 3, targetAnswer: 3, arrangement: 'line', instruction: '', hint: '', narration: '' }],
};

function mount(input = data) {
  const store = new PipSurfaceStore();
  store.setActive('counting-instance');
  const ui = (next: CountingBoardData) => <PipSurfaceContext.Provider value={store}><CountingBoard data={next} /></PipSurfaceContext.Provider>;
  return { store, ui, ...render(ui(input)) };
}

describe('Counting Board drives Pip from its activity state', () => {
  it('phase changes do not count objects; the child’s click does', () => {
    phase.tutorSpeaking = true;
    const { store, container, rerender, ui } = mount();
    expect(store.getActive()?.pose).toMatchObject({ phase: 'introducing', gesture: 'point', targetId: 'object-0' });
    expect(container.textContent).not.toContain('Counted:');
    phase.tutorSpeaking = false;
    rerender(ui(data));
    expect(store.getActive()?.pose).toMatchObject({ phase: 'working', gesture: 'none' });
    fireEvent.click(container.querySelector('[data-pip-object="object-1"]')!);
    expect(store.getActive()?.pose).toMatchObject({ gesture: 'look', targetId: 'object-1' });
    expect(container.textContent).toContain('Counted: 1');
    phase.stage = 'judging';
    rerender(ui(data));
    expect(store.getActive()?.pose.phase).toBe('checking');
    phase.currentSolved = true;
    rerender(ui(data));
    expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
    expect(container.textContent).toContain('Counted: 1');
  });

  it('does not publish hidden subitizing objects or the covered count-on group', () => {
    const flash = { ...data, challenges: [{ ...data.challenges[0], type: 'subitize' as const }] };
    const { store, rerender, ui } = mount(flash);
    expect(store.getActive()?.targets).toEqual([]);
    expect(store.getActive()?.pose.gesture).toBe('none');
    rerender(ui({ ...data, challenges: [{ ...data.challenges[0], type: 'count_on', count: 5, targetAnswer: 5, startFrom: 3 }] }));
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['object-3', 'object-4']);
  });

  it('does not carry the last touch into another challenge, and unregisters on unmount', () => {
    const { store, ui, container, rerender, unmount } = mount();
    fireEvent.click(container.querySelector('[data-pip-object="object-0"]')!);
    expect(store.getActive()?.pose.targetId).toBe('object-0');
    rerender(ui({ ...data, challenges: [{ ...data.challenges[0], id: 'second' }] }));
    expect(store.getActive()?.scopeId).toBe('second');
    expect(store.getActive()?.pose.targetId).toBeUndefined();
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
