// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoopEmission } from '../hooks/judgedLoopModel';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import { DiMathFacts, type DiMathFactsData } from '../primitives/visual-primitives/direct-instruction/DiMathFacts';

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
  // The start control only renders where a microphone can open.
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn() }, configurable: true });
  Object.assign(live, { isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'standalone', activePrimitiveId: null });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const data: DiMathFactsData = {
  title: 'Facts', description: '', challengeType: 'answer_fact', gradeLevel: 'kindergarten', instanceId: 'facts',
  challenges: [
    { id: 'f1', challengeType: 'answer_fact', a: 2, b: 1, display: '2 + 1', problem: 'two plus one', answerWord: 'three', answerNumeral: 3, solvedDisplay: '2 + 1 = 3' },
    { id: 'f2', challengeType: 'answer_fact', a: 3, b: 1, display: '3 + 1', problem: 'three plus one', answerWord: 'four', answerNumeral: 4, solvedDisplay: '3 + 1 = 4' },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  store.setActive('facts');
  const ui = () => <PipSurfaceContext.Provider value={store}><DiMathFacts data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const audio = (on: boolean) => act(() => { live.isAudioPlaying = on; view.rerender(ui()); });
  const emit = (e: object) => act(() => { loop.emit(e as LoopEmission); });
  return { store, audio, emit, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const start = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: /Start lesson/ })); });

describe('DI Math Facts maps its own loop phases into Pip', () => {
  it('idle before start; points at the printed problem on the model; watches it while judged; celebrates the reward beat', async () => {
    const { store, audio, emit, container } = mount();
    expect(container.querySelector('[data-pip-dock="facts"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['problem']);
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    await start();
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'problem' });
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'problem' });
    audio(false);
    emit({ kind: 'attempt-open' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'problem' });
    emit({ kind: 'verdict', judgment: 'affirmed', misses: 0, attempt: { openedAt: 0, closedAt: 0 } });
    expect(screen.getByText('2 + 1 = 3')).toBeTruthy();
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('a correction on the same fact is a cue; praise still playing when the stage moves is not', async () => {
    const { store, audio, emit } = mount();
    await start();
    emit({ kind: 'attempt-open' });
    emit({ kind: 'verdict', judgment: 'corrected', misses: 1, attempt: { openedAt: 0, closedAt: 0 } });
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'problem' });
    audio(false);

    emit({ kind: 'attempt-open' });
    emit({ kind: 'verdict', judgment: 'affirmed', misses: 0, attempt: { openedAt: 0, closedAt: 0 } });
    audio(true); // the praise for 2 + 1
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    act(() => { vi.advanceTimersByTime(3000); }); // the beat's ceiling moves the stage mid-praise
    expect(store.getActive()?.scopeId).toBe('f2');
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    audio(false);
    audio(true); // the model line for 3 + 1
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'problem' });
  });

  it('ignores another lesson block’s audio and unregisters on unmount', async () => {
    live.sessionMode = 'lesson';
    live.activePrimitiveId = 'someone-else';
    const { store, audio, unmount } = mount();
    await start();
    audio(true);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'problem' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
