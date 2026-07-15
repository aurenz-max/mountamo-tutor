// @vitest-environment jsdom
/**
 * Behavioral test for the KnowledgeCheck MultipleChoiceProblem pre-reader (PRE
 * band) presentation — the reader-fit contract for K
 * (qa/reader-fit/knowledge-check-PRE-2026-07-14.md): options render
 * picture-primary (emoji), the tutor reads the question + every choice aloud on
 * first view ([QUIZ_READ_ALOUD]) and from a 🔊 button, one tap = choose (no
 * "Verify Answer" step), and the answer key is never spoken.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/SoundManager', () => ({
  SoundManager: {
    tap: vi.fn(), select: vi.fn(), playCorrect: vi.fn(), playIncorrect: vi.fn(),
  },
}));

// The sub-primitive's evaluation + voice hooks reach network / mic — inert here.
const submitResult = vi.fn();
vi.mock('../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult, hasSubmitted: false, resetAttempt: vi.fn(),
  }),
}));
vi.mock('../../hooks/useVoiceChoice', () => ({
  useVoiceChoice: () => ({
    highlight: null, note: null, reset: vi.fn(),
    voice: { state: 'idle', level: 0, isSupported: false, dormant: true, start: vi.fn(), stop: vi.fn() },
  }),
}));

import { MultipleChoiceProblem } from './MultipleChoiceProblem';
import type { MultipleChoiceProblemData } from '../../types';

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

const makeData = (over: Partial<MultipleChoiceProblemData> = {}): MultipleChoiceProblemData => ({
  type: 'multiple_choice',
  id: 'mc_1',
  difficulty: 'easy',
  gradeLevel: 'kindergarten',
  question: 'Which word rhymes with cat?',
  options: [
    { id: 'A', text: 'dog', emoji: '🐶' },
    { id: 'B', text: 'bat', emoji: '🦇' },
    { id: 'C', text: 'cup', emoji: '🥤' },
  ],
  correctOptionId: 'B',
  rationale: 'Cat and bat both end with the -at sound.',
  teachingNote: '',
  successCriteria: [],
  ...over,
});

describe('MultipleChoiceProblem @ PRE (preReader)', () => {
  let onAskTutor: ReturnType<typeof vi.fn<(m: string) => void>>;
  let onEvaluationSubmit: ReturnType<typeof vi.fn<(result: any) => void>>;

  beforeEach(() => {
    observers.length = 0;
    submitResult.mockClear();
    onAskTutor = vi.fn<(m: string) => void>();
    onEvaluationSubmit = vi.fn<(result: any) => void>();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as unknown as typeof IntersectionObserver);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  const renderPre = () =>
    render(<MultipleChoiceProblem data={makeData({ preReader: true, onAskTutor, onEvaluationSubmit })} />);

  const readAloud = () =>
    onAskTutor.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[QUIZ_READ_ALOUD]'));

  it('renders picture-primary options and hides the Verify Answer button', () => {
    renderPre();
    expect(screen.getByText('🐶')).toBeTruthy();
    expect(screen.getByText('🦇')).toBeTruthy();
    expect(screen.getByText('🥤')).toBeTruthy();
    expect(screen.queryByText(/Verify Answer/i)).toBeNull();
  });

  it('auto-reads the question + every choice aloud ONCE on first view', () => {
    renderPre();
    expect(readAloud()).toHaveLength(0); // not on mount
    intersectAll();
    const calls = readAloud();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('Which word rhymes with cat?');
    expect(calls[0]).toContain('B) bat');
    intersectAll(); // scrolling past again must not re-read
    expect(readAloud()).toHaveLength(1);
  });

  it('replays the read-aloud from the 🔊 button', () => {
    renderPre();
    fireEvent.click(screen.getByLabelText('Hear the question again'));
    expect(readAloud()).toHaveLength(1);
  });

  it('tap = choose: a tap submits immediately with no Verify step', () => {
    renderPre();
    fireEvent.click(screen.getByText('🦇')); // tap the correct picture
    expect(submitResult).toHaveBeenCalledTimes(1);
    expect(submitResult.mock.calls[0][0]).toBe(true); // isCorrect
  });

  it('never speaks the answer key in any spoken line', () => {
    renderPre();
    intersectAll();
    for (const call of onAskTutor.mock.calls.map((c) => String(c[0]))) {
      expect(call).not.toMatch(/correct(OptionId| answer is)/i);
    }
  });
});

describe('MultipleChoiceProblem standard (no preReader)', () => {
  beforeEach(() => {
    observers.length = 0; submitResult.mockClear();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as unknown as typeof IntersectionObserver);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('keeps the deliberate select-then-Verify flow and never auto-reads', () => {
    const onAskTutor = vi.fn();
    render(<MultipleChoiceProblem data={makeData({ onAskTutor })} />);
    intersectAll();
    expect(onAskTutor).not.toHaveBeenCalled();
    expect(screen.getByText(/Verify Answer/i)).toBeTruthy();
    fireEvent.click(screen.getByText('dog')); // selecting does not submit
    expect(submitResult).not.toHaveBeenCalled();
  });
});
