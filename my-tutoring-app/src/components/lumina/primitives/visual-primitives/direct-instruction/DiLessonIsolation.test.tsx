// @vitest-environment jsdom
// Replays the client-side failure in f1b2ab9da15f: a sentence verdict must
// never advance the still-mounted CVC activity from hat to wet. Both packs now run
// only on the teaching workspace (LA-14 S5, rollout B2); bound, the runtime scopes
// every command to its instance, and unbound, both stay inert (below).
import React from 'react';
import { act, cleanup, render, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_VOICE_TURN_CONFIG } from '../../../hooks/voiceTurnMachine';
import CvcSpeller, { type CvcSpellerData } from '../literacy/CvcSpeller';
import { DiSentenceReading, type DiSentenceReadingData } from './DiSentenceReading';

const state = vi.hoisted(() => ({
  isConnected: true, isListening: true, isAudioPlaying: false,
  sessionMode: 'lesson', activePrimitiveId: 'cvc', sessionResumeCount: 0,
  conversation: [] as { role: string; content: string }[],
  sendText: vi.fn(), updateContext: vi.fn(),
}));
const listeners = new Set<(event: any) => void>();
const shared = {
  subscribe: ({ onTurnClose }: any) => {
    listeners.add(onTurnClose);
    return () => listeners.delete(onTurnClose);
  },
  isVoiceActive: () => false, reset: vi.fn(),
  lastTurnOpenAtRef: { current: null },
  floorsRef: { current: { ambientRms: 0, echoRms: 0 } },
  config: DEFAULT_VOICE_TURN_CONFIG,
};
vi.mock('@/contexts/LuminaAIContext', () => ({
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({
    ...state, sharedVoiceTurns: shared, holdVoiceTurns: () => () => {},
    connect: vi.fn(), disconnect: vi.fn(), reconnect: vi.fn(),
    startListening: vi.fn(), stopListening: vi.fn(),
  }),
}));
vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false,
    submittedResult: null, elapsedMs: 0, resetAttempt: vi.fn() }),
  useEvaluationContext: () => null,
}));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('./diRunLog', async (original) => ({
  ...await original<typeof import('./diRunLog')>(), flushDiRunLog: vi.fn(async () => {}),
}));
const cvc: CvcSpellerData = {
  instanceId: 'cvc', title: 'Middle sounds', gradeLevel: '1',
  letterGroup: 3, availableLetters: ['h', 'a', 't', 'w', 'e'],
  challenges: ['hat', 'wet'].map((word, i) => ({
    id: `c${i}`, taskType: 'fill-vowel', targetWord: word,
    targetLetters: word.split(''), targetPhonemes: i === 0 ? ['/h/', '/a/', '/t/'] : ['/w/', '/e/', '/t/'],
    emoji: 'x', imageDescription: word, distractorLetters: [],
  })),
};
const sentences: DiSentenceReadingData = {
  instanceId: 'sentences', title: 'Read sentences', description: 'Read aloud',
  gradeLevel: '1', challengeType: 'decodable_sentence',
  challenges: ['The cat sat.', 'I see a pig.'].map((text, i) => ({
    id: `s${i}`, challengeType: 'decodable_sentence', text, wordCount: text.split(' ').length,
  })),
};
function Lesson() {
  return <><div data-testid="cvc"><CvcSpeller data={cvc} /></div>
    <div data-testid="sentences"><DiSentenceReading data={sentences} /></div></>;
}
beforeEach(() => {
  vi.useFakeTimers();
  state.activePrimitiveId = 'cvc'; state.conversation = []; state.isAudioPlaying = false;
  state.sendText.mockClear(); state.updateContext.mockClear(); listeners.clear();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

// Re-based 09-24 (rollout B2): the CVC speller runs only on the teaching workspace too, so neither pack
// has a drill left to advance. Unbound, both must stay inert: a visible "needs the tutor" state, no cue,
// no voice-turn subscription, no context push — nothing that could consume the other's verdict.
it('two unbound workspace packs in one lesson consume no verdict and send nothing', () => {
  const view = render(<Lesson />);
  for (const id of ['cvc-speller', 'di-sentence-reading']) {
    expect(view.container.querySelector(`[data-workspace-unbound="${id}"]`), id).toBeTruthy();
  }
  expect(within(view.getByTestId('sentences')).queryByRole('button')).toBeNull();
  expect(listeners.size).toBe(0);
  act(() => {
    state.activePrimitiveId = 'sentences';
    state.conversation = [{ role: 'user', content: 'The cat sat.' },
      { role: 'assistant', content: 'Yes, that says The cat sat.' }];
    state.isAudioPlaying = true;
    view.rerender(<Lesson />);
  });
  state.isAudioPlaying = false;
  view.rerender(<Lesson />);
  act(() => vi.advanceTimersByTime(2500));
  expect(state.sendText).not.toHaveBeenCalled();
  expect(state.updateContext).not.toHaveBeenCalled();
  expect(listeners.size).toBe(0);
});
