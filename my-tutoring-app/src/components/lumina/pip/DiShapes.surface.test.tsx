// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoopEmission } from '../hooks/judgedLoopModel';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import { DiShapes, type DiShapesData } from '../primitives/visual-primitives/direct-instruction/DiShapes';

const live = vi.hoisted(() => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'standalone', activePrimitiveId: null as string | null,
}));
vi.mock('@/contexts/LuminaAIContext', () => ({
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({
    ...live, connect: vi.fn(), disconnect: vi.fn(), startListening: vi.fn(), stopListening: vi.fn(), updateContext: vi.fn(),
  }),
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
const loop = vi.hoisted(() => ({ emit: (_e: unknown) => {} }));
vi.mock('../hooks/useJudgedSpeechLoop', () => ({
  useJudgedSpeechLoop: (options: { onEmission?: (e: unknown) => void }) => {
    loop.emit = (e) => options.onEmission?.(e);
    return {
      voiceTurns: { isVoiceActive: () => false, reset: vi.fn(), config: { silenceCloseMs: 500 } },
      queueCue: vi.fn(), sendCueNow: vi.fn(), clearQueuedCue: vi.fn(), arm: vi.fn(), disarm: vi.fn(), reset: vi.fn(),
      isAwaitingJudgment: () => false, config: {},
    };
  },
}));
vi.mock('../primitives/visual-primitives/direct-instruction/diRunLog', () => ({
  flushDiRunLog: vi.fn(), logDiCue: vi.fn(), logDiEmission: vi.fn(), logDiStage: vi.fn(),
  logDiTutorText: vi.fn(), logDiVoiceClose: vi.fn(), startDiRunLog: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn() }, configurable: true });
  Object.assign(live, { isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'standalone', activePrimitiveId: null });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const data: DiShapesData = {
  title: 'Shapes', description: '', challengeType: 'count_sides', gradeLevel: 'first grade', instanceId: 'shapes',
  challenges: [
    { id: 's1', challengeType: 'count_sides', shape: 'triangle', shapeWord: 'triangle', article: 'a', sides: 3, corners: 3, countNumeral: 3, countWord: 'three', rotationDeg: 0, asrAliases: ['three'] },
    { id: 's2', challengeType: 'count_sides', shape: 'square', shapeWord: 'square', article: 'a', sides: 4, corners: 4, countNumeral: 4, countWord: 'four', rotationDeg: 20, asrAliases: ['four'] },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  store.setActive('shapes');
  const ui = () => <PipSurfaceContext.Provider value={store}><DiShapes data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const audio = (on: boolean) => act(() => { live.isAudioPlaying = on; view.rerender(ui()); });
  const emit = (e: object) => act(() => { loop.emit(e as LoopEmission); });
  return { store, audio, emit, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const start = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: /Start lesson/ })); });
const verdict = (judgment: string) => ({ kind: 'verdict', judgment, misses: 0, attempt: { openedAt: 0, closedAt: 0 } });

describe('DI Shapes maps its own loop phases into Pip', () => {
  it('idle before start; outlines the whole drawing on the ask; watches it while judged; celebrates the reward beat', async () => {
    const { store, audio, emit, container } = mount();
    expect(container.querySelector('[data-pip-dock="shapes"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['shape']);
    // The published object is the unnamed drawing, not a side of it.
    expect(store.getActive()?.targets[0].element.querySelector('svg[aria-label="shape to name"]')).not.toBeNull();
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    await start();
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'shape' });
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'shape' });
    audio(false);
    emit({ kind: 'attempt-open' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'shape' });
    emit(verdict('affirmed'));
    expect(screen.getByText('three sides')).toBeTruthy();
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    expect(store.getActive()?.targets).toEqual([]); // the labeled reward is never a target
  });

  it('a correction on the same shape is a cue; praise still playing when the stage moves is not', async () => {
    const { store, audio, emit } = mount();
    await start();
    emit({ kind: 'attempt-open' });
    emit(verdict('corrected'));
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'shape' });
    audio(false);

    emit({ kind: 'attempt-open' });
    emit(verdict('affirmed'));
    audio(true); // the praise for the triangle
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    act(() => { vi.advanceTimersByTime(3000); }); // the beat's ceiling moves the stage mid-praise
    expect(store.getActive()?.scopeId).toBe('s2');
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    audio(false);
    audio(true); // the ask for the square
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'shape' });
  });

  it('ignores another lesson block’s audio and unregisters on unmount', async () => {
    live.sessionMode = 'lesson';
    live.activePrimitiveId = 'someone-else';
    const { store, audio, unmount } = mount();
    await start();
    audio(true);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'shape' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
