// @vitest-environment jsdom
/**
 * WordFlip render contract — band fit AND the DI port, in one file.
 *
 * This started as the reader-fit PRE artifact
 * (qa/reader-fit/word-workout-word-flip-PRE-2026-07-15.md) and it keeps that
 * charter: word-flip is the reader-fit PRE *reference model*, so PRE only
 * strips adult chrome from the child's field (rule 7) while the interaction
 * core survives. The DI port (qa/di/BACKLOG.md item 16) replaced that core, so
 * the same file now also carries the port's render gates rather than asserting
 * a surface that no longer exists:
 *  1. Adult chrome is hidden at gradeLevel 'K' (counter, Grade / mode badges,
 *     the reader hint line) — a pre-reader gets the task by voice.
 *  2. The one-thing word, its emoji and the counted pictures are the stimulus
 *     and are shown at every grade; tapping the card speaks THAT word via
 *     [SAY_WORD], never the plural.
 *  3. ANSWER-LEAK: nothing that names the more-than-one word may appear before
 *     the child says it — not a printed word, and above all not a tap chip.
 *     The chips were deleted because they printed the answer; Grade 1 can read
 *     them even though a pre-reader cannot.
 *  4. No button carries the child forward at any grade: no start-screen fork,
 *     no chips, no Next / Finish. The tutor owns every transition.
 *
 * The live loop itself is NOT driven here. It cannot be driven honestly in
 * jsdom (the mic never opens, the context refs never re-render) — the pedagogy
 * is asserted in __tests__/WordFlip.di-script.test.ts, where it is real.
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

vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    submittedResult: null,
    elapsedMs: 0,
  }),
  useEvaluationContext: () => null,
}));

vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import WordFlip, { type WordFlipData } from './WordFlip';

const makeData = (gradeLevel: string): WordFlipData => ({
  title: 'Farm Friends',
  challengeType: 'plural_s',
  gradeLevel,
  challenges: [
    { id: 'wf1', type: 'plural_s', singular: 'dog', answer: 'dogs', emoji: '🐕', count: 3 },
    { id: 'wf2', type: 'plural_s', singular: 'cat', answer: 'cats', emoji: '🐈', count: 2 },
  ],
});

const tagged = (tag: string) =>
  sendText.mock.calls.map(c => String(c[0])).filter(m => m.startsWith(tag));

describe('WordFlip @ PRE (gradeLevel K)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('hides adult chrome (counter, Grade / mode badges, the reader hint line)', () => {
    render(<WordFlip data={makeData('K')} />);
    expect(screen.queryByText('Grade K')).toBeNull();
    expect(screen.queryByText(/One & Many/)).toBeNull();
    expect(screen.queryByText(/Tap the word to hear it/)).toBeNull();
  });

  it('SHOWS the counted-picture frame — it is the stimulus, not the answer', () => {
    render(<WordFlip data={makeData('K')} />);
    expect(screen.getByText('dog')).toBeTruthy();                  // the one-thing word
    expect(screen.getAllByText('🐕').length).toBeGreaterThan(0);   // the one side
    expect(screen.getByText('🐕🐕🐕')).toBeTruthy();               // three on the many side
    expect(screen.getByText('Three')).toBeTruthy();                // the count caption
  });

  it('tapping the picture speaks the ONE-THING word via [SAY_WORD]', () => {
    render(<WordFlip data={makeData('K')} />);
    fireEvent.click(screen.getByRole('button', { name: 'word dog' }));
    const spoken = tagged('[SAY_WORD]');
    expect(spoken).toHaveLength(1);
    expect(spoken[0]).toContain('"dog"');
  });

  it('tapping never speaks the PLURAL — that is the answer', () => {
    render(<WordFlip data={makeData('K')} />);
    fireEvent.click(screen.getByRole('button', { name: 'word dog' }));
    expect(sendText.mock.calls.some(c => /\bdogs\b/i.test(String(c[0])))).toBe(false);
  });

  it('ANSWER-LEAK — the plural is not printed before the child has said it', () => {
    render(<WordFlip data={makeData('K')} />);
    expect(screen.queryByText('dogs')).toBeNull();
    // The many-side carries a blank until the tutor affirms.
    expect(screen.getByText(/___/)).toBeTruthy();
  });

  it('ANSWER-LEAK — the tap chips are gone, including the one that printed the answer', () => {
    // This is the deletion the port is FOR. The chips were "dogs" / "dog" /
    // "dogses"; the first printed the answer on screen, and the catalog
    // defended it by noting a pre-reader cannot read it. Grade 1 can.
    render(<WordFlip data={makeData('K')} />);
    expect(screen.queryByRole('button', { name: 'dogs' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'dogses' })).toBeNull();
    expect(screen.queryByText('dogses')).toBeNull();
  });

  it('no button carries the child forward — the tutor owns every transition', () => {
    render(<WordFlip data={makeData('K')} />);
    expect(screen.queryByRole('button', { name: /Start with Voice/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Start tap-only/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Next$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Finish$/ })).toBeNull();
    // What is left: the picture card (tap-to-hear) and the mic.
    expect(screen.getByRole('button', { name: 'word dog' })).toBeTruthy();
  });
});

describe('WordFlip @ reader grade (control, Grade 1)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('keeps the adult chrome the K band hides', () => {
    render(<WordFlip data={makeData('1')} />);
    expect(screen.getByText('Grade 1')).toBeTruthy();
    expect(screen.getByText(/One & Many/)).toBeTruthy();
    expect(screen.getByText(/Tap the word to hear it/)).toBeTruthy();
  });

  it('the modality is not band-gated: no advance button and no leaked answer at Grade 1 either', () => {
    render(<WordFlip data={makeData('1')} />);
    expect(screen.queryByRole('button', { name: /Start tap-only/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Next$/ })).toBeNull();
    expect(screen.queryByText('dogs')).toBeNull();
    expect(screen.queryByRole('button', { name: 'dogs' })).toBeNull();
  });

  it('tap-to-hear is not band-gated either — a stuck reader can still recover the word', () => {
    render(<WordFlip data={makeData('1')} />);
    fireEvent.click(screen.getByRole('button', { name: 'word dog' }));
    expect(tagged('[SAY_WORD]')).toHaveLength(1);
  });
});
