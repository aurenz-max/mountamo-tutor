// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import AdditionSubtractionScene, {
  type AddSubChallenge, type AdditionSubtractionSceneData,
} from '../primitives/visual-primitives/math/AdditionSubtractionScene';

type Hook = (item: { id: string }, index: number) => void;
const phase = vi.hoisted(() => ({
  tutorSpeaking: false, stage: 'asking', currentSolved: false,
  opened: null as null | Hook, present: null as null | Hook, items: [] as Array<{ id: string }>,
}));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack, onItemOpened, onPresentStimulus }: { pack: { items: Array<{ id: string }> }; onItemOpened: Hook; onPresentStimulus: Hook }) => {
    phase.opened = onItemOpened; phase.present = onPresentStimulus; phase.items = pack.items;
    return {
      currentItem: pack.items[0], currentIndex: 0, ...phase, cuedItemId: pack.items[0]?.id,
      canAttempt: phase.stage !== 'judging' && !phase.currentSolved, solvedIds: new Set(),
      running: true, preparing: false, summary: null, revealHeld: false,
      armStillness: vi.fn(), clearStillness: vi.fn(), start: vi.fn(), hearStimulus: vi.fn(),
      isAwaitingGesture: () => false, submitGestureAttempt: vi.fn(),
    };
  },
}));
vi.mock('../evaluation', () => ({ usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: vi.fn() }) }));
vi.mock('../components/JudgedMicPanel', () => ({ default: () => null }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(cleanup);
beforeEach(() => { phase.tutorSpeaking = false; phase.stage = 'asking'; phase.currentSolved = false; });

const ch = (over: Partial<AddSubChallenge>): AddSubChallenge => ({
  id: 'c1', type: 'act-out', instruction: '', scene: 'pond', objectType: 'ducks',
  storyText: '2 ducks are swimming in the pond. 1 more duck joins them.',
  operation: 'addition', storyType: 'join', startCount: 2, changeCount: 1, resultCount: 3, equation: '2 + 1 = 3',
  ...over,
});
const scene = (gradeBand: 'K' | '1', challenges: AddSubChallenge[]): AdditionSubtractionSceneData => ({
  title: 'Stories', gradeBand, maxNumber: 10, showTenFrame: false, showEquationBar: true,
  challenges, instanceId: 'scene-instance',
});

function mount(input: AdditionSubtractionSceneData) {
  const store = new PipSurfaceStore();
  store.setActive('scene-instance');
  const ui = (next: AdditionSubtractionSceneData) => <PipSurfaceContext.Provider value={store}><AdditionSubtractionScene data={next} /></PipSurfaceContext.Provider>;
  const view = render(ui(input));
  act(() => phase.opened?.(phase.items[0], 0));
  return { store, ui, ...view };
}
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id);

describe('Addition & Subtraction Scene drives Pip from its judged phases', () => {
  it('K act-out: points at the picture, never an object; watches the picture an object left; receives the scene', () => {
    phase.tutorSpeaking = true;
    const act0 = scene('K', [ch({})]);
    const { store, container, rerender, ui } = mount(act0);
    expect(container.querySelector('[data-pip-dock="scene-instance"]')).not.toBeNull();
    expect(store.getActive()?.pose).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'scene' });
    phase.tutorSpeaking = false;
    rerender(ui(act0));
    fireEvent.click(container.querySelector('[data-pip-object="object-1"]')!);
    expect(ids(store)).toEqual(['scene', 'object-0']);
    expect(store.getActive()?.pose).toEqual({ phase: 'working', gesture: 'look', targetId: 'scene' });
    phase.stage = 'judging';
    rerender(ui(act0));
    expect(store.getActive()?.pose).toEqual({ phase: 'checking', gesture: 'receive', targetId: 'scene' });
    phase.stage = 'asking'; phase.currentSolved = true;
    rerender(ui(act0));
    expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('solve-story: follows the object the child counts and waits on the spoken answer', () => {
    const story = scene('1', [ch({ type: 'solve-story', unknownPosition: 'result' })]);
    const { store, container, rerender, ui } = mount(story);
    fireEvent.click(container.querySelector('[data-pip-object="object-0"]')!);
    expect(store.getActive()?.pose).toEqual({ phase: 'working', gesture: 'look', targetId: 'object-0' });
    phase.stage = 'judging';
    rerender(ui(story));
    expect(store.getActive()?.pose).toEqual({ phase: 'checking', gesture: 'look', targetId: 'object-0' });
  });

  it('build-equation: points at the empty tray, never a tile', () => {
    phase.tutorSpeaking = true;
    const equation = scene('1', [ch({ type: 'build-equation', storyText: '4 apples are on the table. 2 more apples are placed on the table.',
      objectType: 'apples', startCount: 4, changeCount: 2, resultCount: 6, equation: '4 + 2 = 6' })]);
    const { store, rerender, ui } = mount(equation);
    expect(store.getActive()?.pose).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'tray' });
    phase.tutorSpeaking = false;
    rerender(ui(equation));
    fireEvent.click(screen.getAllByRole('button').filter((b) => b.textContent?.trim() === '4').pop()!);
    expect(store.getActive()?.pose).toEqual({ phase: 'working', gesture: 'look', targetId: 'tray' });
    phase.stage = 'judging';
    rerender(ui(equation));
    expect(store.getActive()?.pose.gesture).toBe('receive');
  });

  it('never publishes a change group still waiting on the tutor, and unregisters on unmount', () => {
    const join = scene('1', [ch({})]);
    const { store, unmount } = mount(join);
    expect(ids(store)).toEqual(['scene', 'object-0', 'object-1']);
    act(() => phase.present?.(phase.items[0], 0));
    expect(ids(store)).toEqual(['scene', 'object-0', 'object-1', 'object-2']);
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
