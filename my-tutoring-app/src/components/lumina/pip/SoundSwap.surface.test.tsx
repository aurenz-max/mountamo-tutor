// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoopEmission } from '../hooks/judgedLoopModel';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import SoundSwap, { type SoundSwapData } from '../primitives/visual-primitives/literacy/SoundSwap';

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

const data: SoundSwapData = {
  title: 'Swap', gradeLevel: 'K', instanceId: 'swap',
  challenges: [
    { id: 'c1', operation: 'substitution', originalWord: 'cat', originalPhonemes: ['/k/', '/a/', '/t/'], originalImage: 'a cat',
      oldPhoneme: '/k/', newPhoneme: '/b/', substitutePosition: 'beginning', resultWord: 'bat', resultPhonemes: ['/b/', '/a/', '/t/'], resultImage: 'a bat' },
    { id: 'c2', operation: 'addition', originalWord: 'an', originalPhonemes: ['/a/', '/n/'], originalImage: 'an',
      addPhoneme: '/p/', addPosition: 'beginning', resultWord: 'pan', resultPhonemes: ['/p/', '/a/', '/n/'], resultImage: 'a pan' },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><SoundSwap data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const audio = (on: boolean) => act(() => { live.isAudioPlaying = on; view.rerender(ui()); });
  const emit = (e: object) => act(() => { loop.emit(e as LoopEmission); });
  return { store, audio, emit, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const start = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start' })); });
const verdict = (judgment: string) => ({ kind: 'verdict', judgment, misses: 0, attempt: { openedAt: 0, closedAt: 0 } });

describe('Sound Swap maps its own loop phases into Pip', () => {
  it('points at the starting word, never the highlighted sound to change; watches the tile the child taps', async () => {
    const { store, audio, container } = mount();
    expect(container.querySelector('[data-pip-dock="swap"]')).not.toBeNull();
    expect(container.querySelector('[data-target="true"]')?.getAttribute('data-pip-object')).toBe('sound-0');
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    await start();
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'word' });
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'word' });
    audio(false);
    fireEvent.click(screen.getByRole('button', { name: 'sound /a/' }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'sound-1' });
    audio(true); // the tap-to-hear echo, or the tutor's model: still the word
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'word' });
  });

  it('holds the affirmed answer as the result until the next cue is sent; the new item drops the old tap', async () => {
    const { store, audio, emit } = mount();
    await start();
    fireEvent.click(screen.getByRole('button', { name: 'sound /k/' }));
    emit({ kind: 'attempt-open' });
    audio(true); // "Yes, bat."
    emit(verdict('affirmed'));
    expect(store.getActive()?.scopeId).toBe('c2');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    audio(false);
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    act(() => { loop.sendQueued(); });
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'word' });
  });

  it('a correction on the same item is a cue', async () => {
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
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'word' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
