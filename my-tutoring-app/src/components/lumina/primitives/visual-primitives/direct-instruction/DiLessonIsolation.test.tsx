// @vitest-environment jsdom
// Replays the client-side failure in f1b2ab9da15f: a sentence verdict must
// never advance the still-mounted CVC activity from hat to wet. Since LA-14 S5
// the sentence pack has no scripted drill: mounted without a runtime (a section
// that did not bind) it shows a visible "needs the tutor" state, sends no cue and
// holds no voice-turn subscription, so the CVC drill stays the only consumer.
import React from 'react';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
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

it('an unbound sentence pack consumes no verdict and leaves the CVC drill on its item', async () => {
  const view = render(<Lesson />);
  expect(state.updateContext.mock.calls).toHaveLength(1);
  expect(state.updateContext).toHaveBeenLastCalledWith(expect.objectContaining({ word: 'hat' }));
  await act(async () => {
    const buttons = within(view.getByTestId('cvc')).getAllByRole('button');
    fireEvent.click(buttons.find(b => b.getAttribute('aria-label') !== 'hear the word')!);
  });
  expect(state.sendText.mock.calls.some(([text]) => text.includes('[DI_CVC_ITEM]'))).toBe(true);
  state.activePrimitiveId = 'sentences';
  view.rerender(<Lesson />);
  // Visible, not blank: the pack says it needs the tutor and offers no start control.
  const sentencesView = within(view.getByTestId('sentences'));
  expect(sentencesView.getByText(/needs the tutor/)).toBeTruthy();
  expect(sentencesView.queryByRole('button')).toBeNull();
  expect(view.container.querySelector('[data-workspace-unbound="di-sentence-reading"]')).toBeTruthy();
  // The unfocused CVC drill has released its subscription, and the sentence pack never takes one.
  expect(listeners.size).toBe(0);
  state.sendText.mockClear(); state.updateContext.mockClear();
  act(() => {
    listeners.forEach(close => close({ kind: 'close', startedAt: performance.now(),
      durationMs: 1500, voicedMs: 1400, peak: 0.1, duringTutorAudio: false, belowMinVoice: false }));
    state.conversation = [{ role: 'user', content: 'The cat sat.' },
      { role: 'assistant', content: 'Yes, that says The cat sat.' }];
    state.isAudioPlaying = true;
    view.rerender(<Lesson />);
  });
  state.isAudioPlaying = false;
  view.rerender(<Lesson />);
  act(() => vi.advanceTimersByTime(2500));
  const cues = state.sendText.mock.calls.map(([text]) => text);
  expect(cues.some(text => text.includes('I see a pig.'))).toBe(false);
  expect(cues.some(text => text.includes('[DI_CVC_ITEM]'))).toBe(false);
  expect(state.updateContext.mock.calls.some(([data]) => 'middleSound' in data)).toBe(false);
  // Return to CVC: its original item remains, with fresh context for that item.
  state.activePrimitiveId = 'cvc';
  view.rerender(<Lesson />);
  expect(state.updateContext).toHaveBeenLastCalledWith(expect.objectContaining({ word: 'hat' }));
  expect(listeners.size).toBe(1);
});
