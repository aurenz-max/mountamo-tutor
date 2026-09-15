// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import PhonemeExplorer, { type PhonemeExplorerData } from '../primitives/visual-primitives/literacy/PhonemeExplorer';

const phase = vi.hoisted(() => ({
  tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true, running: true,
}));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack }: { pack: { items: Array<{ id: string }> } }) => {
    const item = pack.items[phase.index] ?? null;
    return {
      currentItem: item, currentIndex: phase.index, stage: phase.stage, tutorSpeaking: phase.tutorSpeaking,
      currentSolved: phase.currentSolved, revealHeld: phase.revealHeld, cuedItemId: phase.cued ? item?.id ?? null : 'elsewhere',
      canAttempt: phase.stage !== 'judging' && !phase.currentSolved, solvedIds: new Set(),
      running: phase.running, preparing: false, summary: null, stimulusTapped: false, hearStimulus: vi.fn(),
      isAwaitingGesture: () => false, submitGestureAttempt: vi.fn(),
    };
  },
}));
vi.mock('@/contexts/LuminaAIContext', () => ({
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({ isConnected: true, sendText: vi.fn() }),
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../components/JudgedMicPanel', () => ({ default: () => null }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

beforeEach(() => {
  Object.assign(phase, { tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true, running: true });
});
afterEach(cleanup);

type Challenge = PhonemeExplorerData['challenges'][number];
const ISOLATE: Challenge = {
  id: 'iso', mode: 'isolate', phoneme: 'M', phonemeSound: 'mmm', exampleWord: 'mouse', exampleEmoji: '🐭',
  choices: [
    { word: 'moon', emoji: '🌙', correct: true }, { word: 'dog', emoji: '🐶', correct: false },
    { word: 'fish', emoji: '🐟', correct: false }, { word: 'cake', emoji: '🍰', correct: false },
  ],
};
const BLEND: Challenge = { id: 'bl', mode: 'blend', phonemeSequence: ['k', 'a', 't'], word: 'cat', emoji: '🐱' };
const SEGMENT: Challenge = { id: 'seg', mode: 'segment', targetWord: 'sheep', targetEmoji: '🐑', segments: ['sh', 'ee', 'p'] };

function mount(challenges: Challenge[] = [ISOLATE, BLEND, SEGMENT]) {
  const store = new PipSurfaceStore();
  const data: PhonemeExplorerData = { title: 'Sounds', gradeLevel: 'K', instanceId: 'phoneme', challenges };
  const ui = () => <PipSurfaceContext.Provider value={store}><PhonemeExplorer data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const update = (next: Partial<typeof phase>) => act(() => { Object.assign(phase, next); view.rerender(ui()); });
  return { store, update, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const tap = (container: HTMLElement, id: string) => act(() => {
  fireEvent.click(container.querySelector(`[data-pip-object="${id}"]`) as HTMLElement);
});

describe('Phoneme Explorer drives Pip from its judged phases', () => {
  it('isolate points at the sound tile, never a menu card; watches the card or example the child taps to hear', () => {
    const { store, update, container } = mount();
    expect(container.querySelector('[data-pip-dock="phoneme"]')).not.toBeNull();
    expect(store.getActive()?.scopeId).toBe('iso');
    update({ running: false });
    tap(container, 'card-0');
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ running: true });
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'stimulus' });
    tap(container, 'card-2');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'card-2' });
    update({ tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stimulus' });
    update({ tutorSpeaking: false });
    tap(container, 'example');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'example' });
    update({ revealHeld: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('the hard tier removes the worked example, so it is never published', () => {
    const { store } = mount([{ ...ISOLATE, showExampleWord: false }]);
    expect(store.getActive()?.targets.map((t) => t.id)).not.toContain('example');
  });

  it('blend points at the tile row as a whole, never one tile; a new item drops the old tap', () => {
    const { store, update, container } = mount();
    tap(container, 'card-1');
    update({ index: 1, tutorSpeaking: true });
    expect(store.getActive()?.scopeId).toBe('bl');
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'sounds' });
    update({ tutorSpeaking: false });
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'sounds' });
    tap(container, 'sound-1');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'sound-1' });
  });

  it('segment points at the heard word; stays neutral over the previous item’s praise; unregisters on unmount', () => {
    const { store, update, unmount } = mount();
    update({ index: 2, tutorSpeaking: true, cued: false });
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    update({ cued: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stimulus' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
