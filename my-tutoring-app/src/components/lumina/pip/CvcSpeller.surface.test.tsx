// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoopEmission } from '../hooks/judgedLoopModel';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import CvcSpeller, { type CvcSpellerChallenge, type CvcSpellerData } from '../primitives/visual-primitives/literacy/CvcSpeller';

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
const loop = vi.hoisted(() => ({ emit: (_e: unknown) => {}, sendQueued: () => {}, submitGestureAttempt: (_cue: string) => {} }));
vi.mock('../hooks/useJudgedSpeechLoop', () => ({
  useJudgedSpeechLoop: (options: { onEmission?: (e: unknown) => void; onCue?: (e: { phase: string; text: string }) => void }) => {
    loop.emit = (e) => options.onEmission?.(e);
    loop.sendQueued = () => options.onCue?.({ phase: 'sent', text: '' });
    return {
      voiceTurns: { isVoiceActive: () => false, reset: vi.fn() },
      queueCue: vi.fn(), sendCueNow: () => options.onCue?.({ phase: 'sent', text: '' }),
      submitGestureAttempt: vi.fn(), clearQueuedCue: vi.fn(), arm: vi.fn(), disarm: vi.fn(), reset: vi.fn(),
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

const challenge = (id: string, taskType: CvcSpellerChallenge['taskType'], word: string, over: Partial<CvcSpellerChallenge> = {}): CvcSpellerChallenge => ({
  id, taskType, targetWord: word, targetLetters: word.split(''), targetPhonemes: [], emoji: '🔤',
  imageDescription: word, distractorLetters: ['e'], ...over,
});
const data: CvcSpellerData = {
  title: 'Sounds', letterGroup: 2, availableLetters: [], gradeLevel: 'K', instanceId: 'cvc',
  challenges: [
    challenge('c1', 'fill-vowel', 'sat'),
    challenge('c2', 'word-sort', 'pig', { emoji: '🐷' }),
    challenge('c3', 'spell-word', 'hot', { distractorLetters: ['a'] }),
    challenge('c4', 'word-sort', 'bug', { showPictureCue: false }),
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  store.setActive('cvc');
  const ui = () => <PipSurfaceContext.Provider value={store}><CvcSpeller data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const audio = (on: boolean) => act(() => { live.isAudioPlaying = on; view.rerender(ui()); });
  const emit = (e: object) => act(() => { loop.emit(e as LoopEmission); });
  return { store, audio, emit, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const start = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start' })); });
const verdict = (judgment: string) => ({ kind: 'verdict', judgment, misses: 0, attempt: { openedAt: 0, closedAt: 0 } });
/** Affirm the item on screen, then let the next item's cue go out. */
function affirmAndCue(emit: (e: object) => void) {
  emit(verdict('affirmed'));
  act(() => { loop.sendQueued(); });
}

describe('CVC Speller maps its own loop phases into Pip, per mode', () => {
  it('fill-vowel points at the marked gap; word-sort at the picture', async () => {
    const { store, audio, emit, container } = mount();
    expect(container.querySelector('[data-pip-dock="cvc"]')).not.toBeNull();
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    await start();
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'gap' });
    audio(false);

    emit(verdict('affirmed'));
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    act(() => { loop.sendQueued(); });
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'picture' });
  });

  it('spell-word points at the box row, watches the box each letter lands in, and receives the build while judged', async () => {
    const { store, audio, emit } = mount();
    await start();
    affirmAndCue(emit);
    affirmAndCue(emit);
    expect(store.getActive()?.scopeId).toBe('c3');
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'boxes' });
    audio(false);
    fireEvent.click(screen.getByRole('button', { name: 'h' }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'box-0' });
    fireEvent.click(screen.getByRole('button', { name: 'a' }));
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'box-1' });
    fireEvent.click(screen.getByRole('button', { name: 't' }));
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'receive', targetId: 'box-2' });

    emit(verdict('corrected'));
    audio(true); // "My turn: …" re-models over the kept letters
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'boxes' });
    const bank = store.getActive()!.targets.map((t) => t.id);
    expect(bank.every((id) => ['boxes', 'box-0', 'box-1', 'box-2', 'picture'].includes(id))).toBe(true);
  });

  it('never publishes a vowel column; a withdrawn picture leaves hard word-sort with no cue target', async () => {
    const { store, audio, emit, container } = mount();
    await start();
    affirmAndCue(emit);
    affirmAndCue(emit); // pig: its "i" column is built from that answer
    affirmAndCue(emit);
    expect(store.getActive()?.scopeId).toBe('c4');
    expect(container.textContent).toContain('like');
    expect(store.getActive()?.targets).toEqual([]);
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'none' });
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
