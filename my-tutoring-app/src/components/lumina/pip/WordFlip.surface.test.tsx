// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoopEmission } from '../hooks/judgedLoopModel';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import WordFlip, { type WordFlipData } from '../primitives/visual-primitives/literacy/WordFlip';

const live = vi.hoisted(() => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'standalone', activePrimitiveId: null as string | null,
}));
vi.mock('@/contexts/LuminaAIContext', () => ({
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({
    ...live, sendText: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), startListening: vi.fn(), stopListening: vi.fn(), updateContext: vi.fn(),
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
      voiceTurns: { isVoiceActive: () => false, reset: vi.fn() },
      queueCue: vi.fn(), sendCueNow: () => options.onCue?.({ phase: 'sent', text: '' }),
      clearQueuedCue: vi.fn(), arm: vi.fn(), disarm: vi.fn(), reset: vi.fn(),
      isAwaitingJudgment: () => false, config: {},
    };
  },
}));
vi.mock('../components/JudgedMicPanel', () => ({
  default: ({ onStart }: { onStart?: () => void }) => <button type="button" onClick={onStart}>Start</button>,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

beforeEach(() => {
  Object.assign(live, { isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'standalone', activePrimitiveId: null });
});
afterEach(cleanup);

const data: WordFlipData = {
  title: 'Farm', challengeType: 'plural_s', gradeLevel: 'K', instanceId: 'flip',
  challenges: [
    { id: 'wf1', type: 'plural_s', sourceWord: 'dog', answer: 'dogs', emoji: '🐕', count: 3 },
    { id: 'wf2', type: 'plural_s', sourceWord: 'cat', answer: 'cats', emoji: '🐈', count: 2 },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><WordFlip data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const audio = (on: boolean) => act(() => { live.isAudioPlaying = on; view.rerender(ui()); });
  const emit = (e: object) => act(() => { loop.emit(e as LoopEmission); });
  return { store, audio, emit, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const start = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start' })); });
const verdict = (judgment: string) => ({ kind: 'verdict', judgment, misses: 0, attempt: { openedAt: 0, closedAt: 0 } });

describe('Word Flip maps its own loop phases into Pip', () => {
  it('outlines the whole frame on the ask and watches the source card the child taps', async () => {
    const { store, audio, container } = mount();
    expect(container.querySelector('[data-pip-dock="flip"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(expect.arrayContaining(['frame', 'source']));
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    await start();
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'frame' });
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'frame' });
    audio(false);
    fireEvent.click(screen.getByRole('button', { name: 'word dog' }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'source' });
  });

  it('holds the affirmed answer until the next cue is sent; a correction is a cue', async () => {
    const { store, audio, emit } = mount();
    await start();
    emit({ kind: 'attempt-open' });
    audio(true);
    emit(verdict('affirmed'));
    expect(store.getActive()?.scopeId).toBe('wf2');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    act(() => { loop.sendQueued(); });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'frame' });
    audio(false);
    emit({ kind: 'attempt-open' });
    emit(verdict('corrected'));
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'frame' });
  });

  it('ignores another lesson block’s audio and unregisters on unmount', async () => {
    live.sessionMode = 'lesson';
    live.activePrimitiveId = 'someone-else';
    const { store, audio, unmount } = mount();
    await start();
    audio(true);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'frame' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
