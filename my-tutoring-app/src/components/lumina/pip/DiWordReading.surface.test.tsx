// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoopEmission } from '../hooks/judgedLoopModel';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import { DiWordReading, type DiWordReadingData } from '../primitives/visual-primitives/direct-instruction/DiWordReading';

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
// The loop reports a cue as 'sent' when it actually goes out: at once for the
// opener, and only when the test says so for a queued cue.
const loop = vi.hoisted(() => ({ emit: (_e: unknown) => {}, sendQueued: () => {} }));
vi.mock('../hooks/useJudgedSpeechLoop', () => ({
  useJudgedSpeechLoop: (options: { onEmission?: (e: unknown) => void; onCue?: (e: { phase: string; text: string }) => void }) => {
    loop.emit = (e) => options.onEmission?.(e);
    loop.sendQueued = () => options.onCue?.({ phase: 'sent', text: '' });
    return {
      voiceTurns: { isVoiceActive: () => false, reset: vi.fn(), config: { silenceCloseMs: 500 } },
      queueCue: vi.fn(), sendCueNow: () => options.onCue?.({ phase: 'sent', text: '' }),
      clearQueuedCue: vi.fn(), arm: vi.fn(), disarm: vi.fn(), reset: vi.fn(),
      isAwaitingJudgment: () => false, config: {},
    };
  },
}));
vi.mock('../primitives/visual-primitives/direct-instruction/diRunLog', () => ({
  flushDiRunLog: vi.fn(), logDiCue: vi.fn(), logDiEmission: vi.fn(), logDiStage: vi.fn(),
  logDiTutorText: vi.fn(), logDiVoiceClose: vi.fn(), startDiRunLog: vi.fn(),
}));

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn() }, configurable: true });
  Object.assign(live, { isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'standalone', activePrimitiveId: null });
});
afterEach(cleanup);

const data: DiWordReadingData = {
  title: 'Words', description: '', challengeType: 'cvc_reading', gradeLevel: 'kindergarten', instanceId: 'reading',
  challenges: [
    { id: 'w1', challengeType: 'cvc_reading', word: 'sam', wordType: 'cvc', graphemes: ['s', 'a', 'm'], emoji: '🧒' },
    { id: 'w2', challengeType: 'cvc_reading', word: 'mat', wordType: 'cvc', graphemes: ['m', 'a', 't'] },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  store.setActive('reading');
  const ui = () => <PipSurfaceContext.Provider value={store}><DiWordReading data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const audio = (on: boolean) => act(() => { live.isAudioPlaying = on; view.rerender(ui()); });
  const emit = (e: object) => act(() => { loop.emit(e as LoopEmission); });
  return { store, audio, emit, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const start = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: /Start lesson/ })); });
const verdict = (judgment: string) => ({ kind: 'verdict', judgment, misses: 0, attempt: { openedAt: 0, closedAt: 0 } });

describe('DI Word Reading maps its own loop phases into Pip', () => {
  it('idle before start; points at the whole printed word on the model; watches it while judged', async () => {
    const { store, audio, emit, container } = mount();
    expect(container.querySelector('[data-pip-dock="reading"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['word']);
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    await start();
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'word' });
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'word' });
    audio(false);
    emit({ kind: 'attempt-open' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'word' });
  });

  it('holds the praise as the confirmed read until the next word’s cue goes out, then points at the new word', async () => {
    const { store, audio, emit } = mount();
    await start();
    emit({ kind: 'attempt-open' });
    audio(true); // "Yes, sam." starts before the sentinel is classified
    emit(verdict('affirmed'));
    expect(screen.getByText('mat')).toBeTruthy();
    expect(store.getActive()?.scopeId).toBe('w2');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    audio(false);
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    act(() => { loop.sendQueued(); }); // the cue for "mat" goes out
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'word' });
    audio(false);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'word' });
  });

  it('a correction on the same word is a cue', async () => {
    const { store, audio, emit } = mount();
    await start();
    emit({ kind: 'attempt-open' });
    emit(verdict('corrected'));
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'word' });
  });

  it('ignores another lesson block’s audio and unregisters on unmount', async () => {
    live.sessionMode = 'lesson';
    live.activePrimitiveId = 'someone-else';
    const { store, audio, unmount } = mount();
    await start();
    audio(true);
    expect(pose(store)?.gesture).not.toBe('point');
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
