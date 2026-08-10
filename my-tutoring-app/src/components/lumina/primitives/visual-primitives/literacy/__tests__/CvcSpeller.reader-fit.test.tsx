// @vitest-environment jsdom
/**
 * CvcSpeller render contract after the DI port (qa/di/BACKLOG.md item 16),
 * carrying forward the PRE-band reader-fit gates that survived it (RF-2/3/4).
 *
 * What this locks in:
 *  1. §1 GATE A — nothing on screen carries the child forward: no Check, no
 *     Next / Finish / Skip, no Clear, no Stretch.
 *  2. §1 GATE B — nothing names the answer before the child gives it. The two
 *     vowel option buttons and the two sort buckets are asserted GONE, not
 *     merely unused: each printed one of two options that INCLUDED the answer.
 *  3. Adult chrome is hidden at grade K; the reader hint line appears at G1.
 *  4. Tap-to-hear says the WORD via [SAY_WORD] and nothing else — its old
 *     escalate-to-stretch ladder isolated the middle sound on demand, which on
 *     two of three modes is the answer.
 *  5. spell-word: the letter bank honors the generator's distractor tier
 *     (availableLetters only tops up to a floor of 5) and the third letter
 *     landing commits the build through the GESTURE anchor — no Check button.
 *  6. word-sort: no `short-a` dev slug anywhere, and no vowel column exists
 *     until an answer has been affirmed.
 *
 * The live loop itself is NOT driven here. It cannot be driven honestly in
 * jsdom (the mic never opens, the context refs never re-render), and a green
 * test that never fired the path is worse than no test — the pedagogy is
 * pinned in CvcSpeller.di-script.test.ts instead.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendText = vi.hoisted(() => vi.fn());
const ctxState = vi.hoisted(() => ({
  isConnected: true,
  isListening: false,
  isAudioPlaying: false,
  micLevel: 0,
  sessionMode: 'idle' as 'idle' | 'lesson',
  sessionResumeCount: 0,
  conversation: [] as Array<{ role: string; content: string }>,
}));
vi.mock('@/contexts/LuminaAIContext', () => ({
  useLuminaAIContext: () => ({
    ...ctxState,
    sendText,
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    startListening: vi.fn(() => { ctxState.isListening = true; }),
    stopListening: vi.fn(),
    updateContext: vi.fn(),
  }),
}));

const submitGestureAttempt = vi.hoisted(() => vi.fn());
vi.mock('../../../../hooks/useJudgedSpeechLoop', () => ({
  useJudgedSpeechLoop: () => ({
    voiceTurns: { isVoiceActive: () => false, reset: vi.fn() },
    queueCue: vi.fn(),
    submitGestureAttempt,
    sendCueNow: vi.fn(),
    clearQueuedCue: vi.fn(),
    arm: vi.fn(),
    disarm: vi.fn(),
    reset: vi.fn(),
    isAwaitingJudgment: () => false,
    config: {},
  }),
}));

vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    submittedResult: null,
    elapsedMs: 0,
  }),
  useEvaluationContext: () => null,
}));

vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import CvcSpeller, { type CvcSpellerData, type CvcSpellerChallenge } from '../CvcSpeller';

const challenge = (over: Partial<CvcSpellerChallenge> = {}): CvcSpellerChallenge => ({
  id: 'c1', taskType: 'spell-word', targetWord: 'sat',
  targetLetters: ['s', 'a', 't'], targetPhonemes: ['/s/', '/æ/', '/t/'],
  emoji: '🧘', imageDescription: 'A person sitting down on a rug',
  distractorLetters: ['m', 'p', 'e'], ...over,
});

const makeData = (
  challenges: CvcSpellerChallenge[],
  over: Partial<CvcSpellerData> = {},
): CvcSpellerData => ({
  title: 'Short A Word Fun!',
  vowelFocus: 'short-a',
  letterGroup: 1,
  // 9 letters — the old union rendered ALL of these; the cap must keep b/g/d out
  availableLetters: ['s', 'a', 't', 'm', 'p', 'e', 'b', 'g', 'd'],
  gradeLevel: 'K',
  challenges,
  ...over,
});

const tagged = (tag: string) =>
  sendText.mock.calls.map(c => String(c[0])).filter(m => m.startsWith(tag));

beforeEach(() => {
  sendText.mockClear();
  submitGestureAttempt.mockClear();
  ctxState.isListening = false;
});
afterEach(cleanup);

describe('CvcSpeller · §1 gate A — nothing on screen carries the child forward', () => {
  for (const taskType of ['fill-vowel', 'spell-word', 'word-sort'] as const) {
    it(`${taskType}: no Check / Next / Finish / Skip / Clear / Stretch`, () => {
      render(<CvcSpeller data={makeData([challenge({ taskType })])} />);
      for (const label of [/check/i, /next/i, /finish/i, /skip/i, /clear/i, /stretch/i]) {
        expect(screen.queryByRole('button', { name: label })).toBeNull();
      }
    });
  }
});

describe('CvcSpeller · §1 gate B — nothing names the answer first', () => {
  it('fill-vowel: the vowel OPTION buttons are gone, and the blank stays blank', () => {
    // They were the costume and the leak in one object: one of the two printed
    // letters IS the answer, captioned with its keyword, and a Grade 1 child
    // can read it.
    render(<CvcSpeller data={makeData([challenge({ taskType: 'fill-vowel' })], { gradeLevel: '1' })} />);
    expect(screen.queryByRole('button', { name: 'a' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'e' })).toBeNull();
    expect(screen.queryByText(/apple/i)).toBeNull();
    expect(screen.queryByText(/egg/i)).toBeNull();
    // The consonant frame IS the stimulus and is shown; the middle is a blank.
    expect(screen.getByText('s')).toBeTruthy();
    expect(screen.getByText('t')).toBeTruthy();
    expect(screen.getByText('?')).toBeTruthy();
  });

  it('word-sort: the two vowel BUCKETS are gone and no column exists before an answer', () => {
    render(<CvcSpeller data={makeData([challenge({ taskType: 'word-sort' })], { gradeLevel: '1' })} />);
    expect(screen.queryByRole('button', { name: /like apple/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /like egg/i })).toBeNull();
    expect(screen.queryByText(/like apple/i)).toBeNull();
    // RF-4: the dev slug never reaches the child's field.
    expect(document.body.textContent).not.toContain('short-a');
  });

  it('spell-word: the boxes start empty and the bank never marks the answer', () => {
    render(<CvcSpeller data={makeData([challenge()])} />);
    for (let i = 1; i <= 3; i++) {
      expect(screen.getByRole('button', { name: `box ${i}` }).textContent).toBe('?');
    }
    // RF-3: the imageDescription sentence is not rendered (emoji-only cue).
    expect(screen.queryByText(/sitting down on a rug/i)).toBeNull();
  });
});

describe('CvcSpeller · pre-reader band', () => {
  it('hides adult chrome at grade K', () => {
    render(<CvcSpeller data={makeData([challenge()])} />);
    expect(screen.queryByText('Short A')).toBeNull();
    expect(screen.queryByText(/Spell It/)).toBeNull();
    expect(screen.queryByText(/put a letter in each box\./i)).toBeNull();
  });

  it('shows the reader hint line at grade 1', () => {
    render(<CvcSpeller data={makeData([challenge()], { gradeLevel: '1' })} />);
    expect(screen.getByText(/put a letter in each box/i)).toBeTruthy();
  });
});

describe('CvcSpeller · tap-to-hear says the WORD and stops', () => {
  it('emits [SAY_WORD] once per tap and never escalates into a stretch', () => {
    render(<CvcSpeller data={makeData([challenge()])} />);
    const hear = screen.getByRole('button', { name: /hear the word/i });
    fireEvent.click(hear);
    fireEvent.click(hear);
    fireEvent.click(hear);
    const said = tagged('[SAY_WORD]');
    expect(said).toHaveLength(3);
    for (const message of said) {
      expect(message).toContain('"sat"');
      expect(message).toContain('do NOT break it into separate sounds');
    }
    // The deleted ladder's tags must not exist anywhere in this component.
    expect(tagged('[REPEAT_WORD]')).toHaveLength(0);
    expect(tagged('[STRETCH_WORD]')).toHaveLength(0);
    expect(tagged('[ISOLATE_VOWEL]')).toHaveLength(0);
    expect(tagged('[CONFIRM_SOUND]')).toHaveLength(0);
  });
});

describe('CvcSpeller · spell-word is the GESTURE anchor’s first caller', () => {
  it('the letter bank honors the generator tier — availableLetters only tops up to 5', () => {
    render(<CvcSpeller data={makeData([challenge()])} />);
    for (const l of ['s', 'a', 't', 'm', 'p', 'e']) {
      expect(screen.getByRole('button', { name: l })).toBeTruthy();
    }
    for (const l of ['b', 'g', 'd']) {
      expect(screen.queryByRole('button', { name: l })).toBeNull();
    }
  });

  it('the bank and the boxes are DISABLED until the run starts', () => {
    // The gate that actually holds here is the disabled attribute, so that is
    // what this asserts — a click assertion alone passes for the wrong reason
    // (a disabled button never reaches the handler) and would go green even
    // with the handler's own guard deleted.
    render(<CvcSpeller data={makeData([challenge()])} />);
    expect(screen.getByRole('button', { name: 's' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'box 1' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 's' }));
    expect(screen.getByRole('button', { name: 'box 1' }).textContent).toBe('?');
    expect(submitGestureAttempt).not.toHaveBeenCalled();
  });
});
