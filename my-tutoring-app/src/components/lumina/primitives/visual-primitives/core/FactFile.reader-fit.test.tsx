// @vitest-environment jsdom
/**
 * Behavioral test for the FactFile pre-reader (PRE band) presentation — the
 * reader-fit contract for K (qa/reader-fit/explainer-tail-PRE-2026-07-15.md).
 * At K the text-heavy tab exploration is bypassed and the self-check goes through
 * the shared PreReaderSelfCheck: emoji-primary options, the tutor reads the
 * question + every option aloud on first view ([FACTCHECK_READ_ALOUD]) and from a
 * 🔊 button, one tap = choose (no Submit), a wrong tap gives an eyes-free spoken
 * hint (never the answer). The reader render is unchanged.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendText = vi.fn<(m: string, opts?: unknown) => void>();
vi.mock('../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText, isConnected: true }),
}));

const submitEvaluation = vi.fn();
vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: submitEvaluation, hasSubmitted: false, submittedResult: null, elapsedMs: 0,
  }),
  useEvaluationContext: () => null,
}));

vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: {
    tap: vi.fn(), select: vi.fn(), pop: vi.fn(),
    playCorrect: vi.fn(), playIncorrect: vi.fn(), playStreak: vi.fn(),
    isEnabled: () => false, getVolume: () => 1, play: vi.fn(),
  },
}));

import FactFile, { type FactFileData } from './FactFile';

// jsdom has no IntersectionObserver — capture instances to drive visibility.
type IOCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
const observers: Array<{ cb: IOCallback; observed: boolean; disconnected: boolean }> = [];
class MockIntersectionObserver {
  private entry: { cb: IOCallback; observed: boolean; disconnected: boolean };
  constructor(cb: IOCallback) { this.entry = { cb, observed: false, disconnected: false }; observers.push(this.entry); }
  observe() { this.entry.observed = true; }
  unobserve() {}
  disconnect() { this.entry.disconnected = true; }
}
const intersectAll = () => act(() => {
  observers.forEach((o) => { if (o.observed && !o.disconnected) o.cb([{ isIntersecting: true }]); });
});

const makeData = (over: Partial<FactFileData> = {}): FactFileData => ({
  title: 'Sharks',
  category: 'Animals',
  description: 'All about sharks.',
  keyStats: [{ value: '400', unit: 'species', label: 'Kinds' }],
  quickFacts: [{ fact: 'Sharks have many teeth.', icon: '🦈' }],
  deepDive: [],
  records: [],
  didYouKnow: [],
  gradeLevel: 'K',
  selfChecks: [
    {
      question: 'Which animal is a shark?',
      options: ['A shark', 'A dog', 'A bird'],
      correctIndex: 0,
      explanation: 'A shark lives in the sea.',
      difficulty: 'easy',
      relatedSection: 'quickFacts',
      optionEmojis: ['🦈', '🐶', '🐦'],
    },
    {
      question: 'Where does a shark live?',
      options: ['In the sea', 'In a tree', 'In the sky'],
      correctIndex: 0,
      explanation: 'Sharks swim in the sea.',
      difficulty: 'easy',
      relatedSection: 'quickFacts',
      optionEmojis: ['🌊', '🌳', '☁️'],
    },
  ],
  ...over,
});

const readAloud = () =>
  sendText.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[FACTCHECK_READ_ALOUD]'));

describe('FactFile @ PRE (kindergarten)', () => {
  beforeEach(() => {
    observers.length = 0;
    sendText.mockClear();
    submitEvaluation.mockClear();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as unknown as typeof IntersectionObserver);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('renders picture-primary emoji options and hides tab/counter chrome', () => {
    render(<FactFile data={makeData()} />);
    expect(screen.getByText('🦈')).toBeTruthy();
    expect(screen.getByText('🐶')).toBeTruthy();
    expect(screen.getByText('🐦')).toBeTruthy();
    expect(screen.queryByText(/Fact File:/i)).toBeNull();
    expect(screen.queryByText(/of \d+ sections explored/i)).toBeNull();
    expect(screen.queryByText(/Question 1 of/i)).toBeNull();
    expect(screen.queryByText(/^easy$/i)).toBeNull(); // difficulty badge gone
  });

  it('auto-reads the question + every option aloud ONCE on first view', () => {
    render(<FactFile data={makeData()} />);
    expect(readAloud()).toHaveLength(0); // not on mount
    intersectAll();
    const calls = readAloud();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('Which animal is a shark?');
    expect(calls[0]).toContain('A shark');
    expect(calls[0]).toContain('A dog');
    expect(calls[0]).toContain('A bird');
    intersectAll();
    expect(readAloud()).toHaveLength(1); // no re-read
  });

  it('replays the read-aloud from the 🔊 button', () => {
    render(<FactFile data={makeData()} />);
    fireEvent.click(screen.getByLabelText('Hear the question again'));
    expect(readAloud()).toHaveLength(1);
  });

  it('tap = choose: passing every check reaches the results screen', () => {
    render(<FactFile data={makeData()} />);
    fireEvent.click(screen.getByText('🦈'));           // check 1 correct
    expect(screen.getByText('Where does a shark live?')).toBeTruthy(); // advanced
    fireEvent.click(screen.getByText('🌊'));           // check 2 correct
    expect(screen.getByText(/Fact File Complete!/i)).toBeTruthy();
    expect(submitEvaluation).toHaveBeenCalledTimes(1);
  });

  it('a wrong tap gives an eyes-free spoken hint and never reveals the answer', () => {
    render(<FactFile data={makeData()} />);
    fireEvent.click(screen.getByText('🐶')); // wrong
    const retry = sendText.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[FACTCHECK_RETRY]'));
    expect(retry).toHaveLength(1);
    expect(retry[0]).not.toMatch(/the answer is|correct answer/i);
    // still on check 1 (a miss is not a pass)
    expect(screen.getByText('Which animal is a shark?')).toBeTruthy();
  });
});

describe('FactFile standard (reader grade)', () => {
  beforeEach(() => {
    observers.length = 0; sendText.mockClear();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as unknown as typeof IntersectionObserver);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('keeps the tab exploration + never auto-reads at grade 3', () => {
    render(<FactFile data={makeData({ gradeLevel: '3' })} />);
    intersectAll();
    expect(readAloud()).toHaveLength(0);
    expect(screen.getByText(/Fact File: Sharks/i)).toBeTruthy();
  });
});
