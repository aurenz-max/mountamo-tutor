// @vitest-environment jsdom
/**
 * Behavioral test for the ComparisonPanel pre-reader (PRE band) presentation —
 * reader-fit BACKLOG item 9c. At K the boolean comprehension gate renders as a
 * PICTURE true/false (👍 / 👎, emoji-primary) through the shared PreReaderSelfCheck:
 * the tutor reads the statement aloud on first view ([GATE_READ_ALOUD]) and from a
 * 🔊 button, one tap = choose (no Submit), a wrong tap gives an eyes-free spoken
 * hint (never the answer). Adult chrome (Option A/B badges, VS, "Comprehension
 * Check N of M") is hidden. The reader-grade render is unchanged.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendText = vi.fn<(m: string, opts?: unknown) => void>();
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText, isConnected: true }),
}));

const submitEvaluation = vi.fn();
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: submitEvaluation, hasSubmitted: false, submittedResult: null, elapsedMs: 0,
  }),
  useEvaluationContext: () => null,
}));

vi.mock('../utils/SoundManager', () => ({
  SoundManager: {
    tap: vi.fn(), select: vi.fn(), pop: vi.fn(),
    playCorrect: vi.fn(), playIncorrect: vi.fn(), playStreak: vi.fn(),
    isEnabled: () => false, getVolume: () => 1, play: vi.fn(),
  },
}));

// The comparison cards fetch AI images on mount — stub the network call.
vi.mock('../service/geminiClient-api', () => ({
  generateConceptImage: vi.fn(async () => null),
}));

import { ComparisonPanel } from './ComparisonPanel';
import type { ComparisonData } from '../types';

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

const makeData = (over: Partial<ComparisonData> = {}): ComparisonData => ({
  title: 'Cats and Dogs',
  intro: 'Two pets to compare.',
  gradeLevel: 'K',
  item1: {
    name: 'Cats',
    description: 'Cats are pets.',
    visualPrompt: 'a cat',
    points: ['soft fur', 'says meow'],
  },
  item2: {
    name: 'Dogs',
    description: 'Dogs are pets.',
    visualPrompt: 'a dog',
    points: ['waggy tail', 'says woof'],
  },
  synthesis: {
    mainInsight: 'Both are pets.',
    keyDifferences: ['sound'],
    keySimilarities: ['furry'],
  },
  gates: [
    { question: 'A cat says meow.', correctAnswer: true, rationale: 'Cats say meow.', unlocks: 'synthesis' },
    { question: 'A dog says meow.', correctAnswer: false, rationale: 'Dogs say woof.', unlocks: 'complete' },
  ],
  ...over,
});

const exploreBothCards = () => {
  fireEvent.click(screen.getByText('Cats'));
  fireEvent.click(screen.getByText('Dogs'));
};

const gateReadAloud = () =>
  sendText.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[GATE_READ_ALOUD]'));

describe('ComparisonPanel @ PRE (kindergarten)', () => {
  beforeEach(() => {
    observers.length = 0;
    sendText.mockClear();
    submitEvaluation.mockClear();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as unknown as typeof IntersectionObserver);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('hides adult chrome (Option A/B, VS, header, Comprehension Check)', () => {
    render(<ComparisonPanel data={makeData()} />);
    expect(screen.queryByText('Option A')).toBeNull();
    expect(screen.queryByText('Option B')).toBeNull();
    expect(screen.queryByText('VS')).toBeNull();
    expect(screen.queryByText(/Comparative Analysis/i)).toBeNull();
    exploreBothCards();
    expect(screen.queryByText(/Comprehension Check/i)).toBeNull();
    expect(screen.queryByText(/Submit Answer/i)).toBeNull();
  });

  it('renders a picture true/false gate (👍 / 👎) once both cards are explored', () => {
    render(<ComparisonPanel data={makeData()} />);
    expect(screen.queryByText('👍')).toBeNull(); // gate gated on exploration
    exploreBothCards();
    expect(screen.getByText('👍')).toBeTruthy();
    expect(screen.getByText('👎')).toBeTruthy();
  });

  it('auto-reads the gate statement aloud ONCE on first view + replays from 🔊', () => {
    render(<ComparisonPanel data={makeData()} />);
    exploreBothCards();
    expect(gateReadAloud()).toHaveLength(0); // not until in view
    intersectAll();
    const calls = gateReadAloud();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('A cat says meow.');
    intersectAll();
    expect(gateReadAloud()).toHaveLength(1); // no re-read
    fireEvent.click(screen.getByLabelText('Hear the question again'));
    expect(gateReadAloud()).toHaveLength(2); // 🔊 replay
  });

  it('tap = choose: passing both gates reaches the celebration + submits once', () => {
    render(<ComparisonPanel data={makeData()} />);
    exploreBothCards();
    fireEvent.click(screen.getByText('👍')); // gate 1 (correctAnswer true) → correct
    fireEvent.click(screen.getByText('👎')); // gate 2 (correctAnswer false) → correct
    expect(screen.getByText('🎉')).toBeTruthy();
    expect(submitEvaluation).toHaveBeenCalledTimes(1);
  });

  it('a wrong tap gives an eyes-free spoken hint and never reveals the answer', () => {
    render(<ComparisonPanel data={makeData()} />);
    exploreBothCards();
    fireEvent.click(screen.getByText('👎')); // gate 1 correct is 👍 → wrong
    const retry = sendText.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[GATE_RETRY]'));
    expect(retry).toHaveLength(1);
    expect(retry[0]).not.toMatch(/the answer is|correct answer|it is true|it is false/i);
    expect(submitEvaluation).not.toHaveBeenCalled();
  });
});

describe('ComparisonPanel standard (reader grade)', () => {
  beforeEach(() => {
    observers.length = 0; sendText.mockClear();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as unknown as typeof IntersectionObserver);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('keeps the text True/False gate + chrome and never auto-reads at grade 3', () => {
    render(<ComparisonPanel data={makeData({ gradeLevel: '3' })} />);
    expect(screen.getByText('Option A')).toBeTruthy();
    expect(screen.getByText('VS')).toBeTruthy();
    exploreBothCards();
    expect(screen.getByText(/Comprehension Check 1 of 2/i)).toBeTruthy();
    expect(screen.getByText(/Submit Answer/i)).toBeTruthy();
    expect(screen.queryByText('👍')).toBeNull();
    intersectAll();
    expect(gateReadAloud()).toHaveLength(0);
  });
});
