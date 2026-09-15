// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoopEmission } from '../hooks/judgedLoopModel';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import { DiLetterSounds, type DiLetterSoundsData } from '../primitives/visual-primitives/direct-instruction/DiLetterSounds';

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
  logDiTutorText: vi.fn(), logDiVoiceClose: vi.fn(), startDiRunLog: vi.fn(), setClientRunId: vi.fn(), mintRunId: () => 'run',
}));

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn() }, configurable: true });
  Object.assign(live, { isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'standalone', activePrimitiveId: null });
});
afterEach(cleanup);

const data: DiLetterSoundsData = {
  title: 'Letter Sounds', description: '', challengeType: 'letter_sound', gradeLevel: 'kindergarten', instanceId: 'sounds',
  challenges: [
    { id: 'm', challengeType: 'letter_sound', letter: 'm', spoken: 'mmm', keyword: 'moon', emoji: '🌙', elicitation: 'isolated' },
    { id: 's', challengeType: 'letter_sound', letter: 's', spoken: 'sss', keyword: 'sun', emoji: '☀️', elicitation: 'isolated' },
  ],
} as DiLetterSoundsData;

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><DiLetterSounds data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const audio = (on: boolean) => act(() => { live.isAudioPlaying = on; view.rerender(ui()); });
  const emit = (e: object) => act(() => { loop.emit(e as LoopEmission); });
  return { ...view, store, audio, emit };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const start = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: /Start lesson/ })); });
const verdict = (judgment: string) => ({ kind: 'verdict', judgment, misses: 0, attempt: { openedAt: 0, closedAt: 0 } });

describe('DI Letter Sounds maps its own loop phases into Pip', () => {
  it('idle before start; points at the stage on the model; watches it while judged', async () => {
    const { store, audio, emit, container } = mount();
    expect(container.querySelector('[data-pip-dock="sounds"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['stage']);
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    await start();
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stage' });
    audio(false);
    emit({ kind: 'attempt-open' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'stage' });
  });

  it('holds the praise as the result until the next item’s cue is sent; a correction is a cue', async () => {
    const { store, audio, emit } = mount();
    await start();
    emit({ kind: 'attempt-open' });
    audio(true);
    emit(verdict('affirmed'));
    expect(store.getActive()?.scopeId).toBe('s');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    act(() => { loop.sendQueued(); });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stage' });
    audio(false);
    emit({ kind: 'attempt-open' });
    emit(verdict('corrected'));
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'stage' });
  });

  it('ignores another lesson block’s audio and unregisters on unmount', async () => {
    live.sessionMode = 'lesson';
    live.activePrimitiveId = 'someone-else';
    const { store, audio, unmount } = mount();
    audio(true);
    expect(pose(store)?.gesture).not.toBe('point');
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
