// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoopEmission } from '../hooks/judgedLoopModel';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import PhonicsBlender, { type PhonicsBlenderData } from '../primitives/visual-primitives/literacy/PhonicsBlender';

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

const makeData = (over: Partial<PhonicsBlenderData> = {}): PhonicsBlenderData => ({
  title: 'Blend', gradeLevel: 'K', patternType: 'cvc', instanceId: 'blend',
  words: [
    { id: 'w1', targetWord: 'cat', emoji: '🐱', phonemes: [
      { id: 'p1', sound: '/k/', letters: 'c' }, { id: 'p2', sound: '/a/', letters: 'a' }, { id: 'p3', sound: '/t/', letters: 't' }] },
    { id: 'w2', targetWord: 'dog', phonemes: [
      { id: 'p4', sound: '/d/', letters: 'd' }, { id: 'p5', sound: '/o/', letters: 'o' }, { id: 'p6', sound: '/g/', letters: 'g' }] },
  ],
  ...over,
});

function mount(data = makeData()) {
  const store = new PipSurfaceStore();
  store.setActive('blend');
  const ui = () => <PipSurfaceContext.Provider value={store}><PhonicsBlender data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const audio = (on: boolean) => act(() => { live.isAudioPlaying = on; view.rerender(ui()); });
  const emit = (e: object) => act(() => { loop.emit(e as LoopEmission); });
  return { store, audio, emit, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const start = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start' })); });
const verdict = (judgment: string) => ({ kind: 'verdict', judgment, misses: 0, attempt: { openedAt: 0, closedAt: 0 } });

describe('Phonics Blender maps its own loop phases into Pip', () => {
  it('points at the letter row as a whole, never one card, and watches the card the child taps', async () => {
    const { store, audio, container } = mount();
    expect(container.querySelector('[data-pip-dock="blend"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(expect.arrayContaining(['letters', 'letter-p1', 'letter-p2', 'letter-p3']));
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    await start();
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'letters' });
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'letters' });
    audio(false);
    fireEvent.click(screen.getByRole('button', { name: 'sound /a/' }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'letter-p2' });
  });

  it('on the unsegmented tier Pip still outlines only the whole row', async () => {
    const { store, audio } = mount(makeData({ showBlendPreview: 'none', nameTargetPhonemes: false }));
    await start();
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'letters' });
  });

  it('celebrates the affirmed blend until the next word’s cue is sent; the new word drops the old tap', async () => {
    const { store, audio, emit } = mount();
    await start();
    fireEvent.click(screen.getByRole('button', { name: 'sound /k/' }));
    emit({ kind: 'attempt-open' });
    audio(true); // "Yes, cat."
    emit(verdict('affirmed'));
    expect(store.getActive()?.scopeId).toBe('w2');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    audio(false);
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    act(() => { loop.sendQueued(); });
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'letters' });
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'letters' });
  });

  it('a correction on the same word is a cue', async () => {
    const { store, audio, emit } = mount();
    await start();
    emit({ kind: 'attempt-open' });
    emit(verdict('corrected'));
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'letters' });
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
