// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoopEmission } from '../hooks/judgedLoopModel';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import { DiSentenceReading, type DiSentenceReadingData } from '../primitives/visual-primitives/direct-instruction/DiSentenceReading';

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
  logDiTutorText: vi.fn(), logDiVoiceClose: vi.fn(), startDiRunLog: vi.fn(), setClientRunId: vi.fn(), mintRunId: () => 'run',
}));

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn() }, configurable: true });
  Object.assign(live, { isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'standalone', activePrimitiveId: null });
});
afterEach(cleanup);

const data: DiSentenceReadingData = {
  instanceId: 'sentences', title: 'Read sentences', description: '', gradeLevel: '1', challengeType: 'decodable_sentence',
  challenges: ['The cat sat.', 'I see a pig.'].map((text, i) => ({
    id: `s${i}`, challengeType: 'decodable_sentence', text, wordCount: text.split(' ').length,
  })),
} as DiSentenceReadingData;

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><DiSentenceReading data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const audio = (on: boolean) => act(() => { live.isAudioPlaying = on; view.rerender(ui()); });
  const emit = (e: object) => act(() => { loop.emit(e as LoopEmission); });
  return { ...view, store, audio, emit };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const start = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: /Start lesson/ })); });
const verdict = (judgment: string) => ({ kind: 'verdict', judgment, misses: 0, attempt: { openedAt: 0, closedAt: 0 } });

describe('DI Sentence Reading maps its own loop phases into Pip', () => {
  it('points at the whole printed sentence on the model; watches it while the read is judged', async () => {
    const { store, audio, emit, container } = mount();
    expect(container.querySelector('[data-pip-dock="sentences"]')).not.toBeNull();
    expect(store.getActive()?.targets.map((t) => t.id)).toEqual(['sentence']);
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    await start();
    audio(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'sentence' });
    audio(false);
    emit({ kind: 'attempt-open' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'sentence' });
  });

  it('celebrates the reward beat on the read sentence, not before', async () => {
    const { store, audio, emit } = mount();
    await start();
    emit({ kind: 'attempt-open' });
    audio(true);
    emit(verdict('affirmed'));
    expect(store.getActive()?.scopeId).toBe('s0');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
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
