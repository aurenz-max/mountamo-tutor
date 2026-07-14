// @vitest-environment jsdom
/**
 * Behavioral test for the DeepDive Quick Quiz pre-reader (PRE band) presentation
 * — the reader-fit contract for K (qa/reader-fit/deep-dive-PRE-2026-07-14.md):
 * the quiz auto-reads itself aloud on first view ([QUIZ_READ_ALOUD]), a 🔊
 * button replays it, options are picture-primary, one tap = choose (no Check),
 * a first miss triggers a spoken hint ([QUIZ_RETRY]), and adult chrome
 * (attempts counter, text-labeled tutor button) is hidden.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../../utils/SoundManager', () => ({
  SoundManager: {
    tap: vi.fn(),
    select: vi.fn(),
    playCorrect: vi.fn(),
    playIncorrect: vi.fn(),
  },
}));

import MultipleChoiceBlock from './MultipleChoiceBlock';
import type { MultipleChoiceBlockData } from '../types';

// jsdom has no IntersectionObserver — capture instances so tests can drive
// visibility transitions by hand.
type IOCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
const observers: Array<{ cb: IOCallback; observed: boolean; disconnected: boolean }> = [];

class MockIntersectionObserver {
  private entry: { cb: IOCallback; observed: boolean; disconnected: boolean };
  constructor(cb: IOCallback) {
    this.entry = { cb, observed: false, disconnected: false };
    observers.push(this.entry);
  }
  observe() { this.entry.observed = true; }
  unobserve() {}
  disconnect() { this.entry.disconnected = true; }
}

const intersectAll = () => {
  act(() => {
    observers.forEach((o) => {
      if (o.observed && !o.disconnected) o.cb([{ isIntersecting: true }]);
    });
  });
};

const makeData = (): MultipleChoiceBlockData => ({
  id: 'block-5',
  blockType: 'multiple-choice',
  label: 'Quick Quiz',
  question: 'Which animal gives us eggs?',
  options: ['Cow', 'Hen', 'Sheep', 'Dog'],
  optionEmojis: ['🐄', '🐔', '🐑', '🐶'],
  correctIndex: 1,
  explanation: 'Hens lay the eggs we eat for breakfast.',
});

describe('MultipleChoiceBlock @ PRE (preReader)', () => {
  let onAnswer: ReturnType<typeof vi.fn<(blockId: string, correct: boolean, attempts: number) => void>>;
  let onAskTutor: ReturnType<typeof vi.fn<(message: string) => void>>;

  beforeEach(() => {
    observers.length = 0;
    onAnswer = vi.fn<(blockId: string, correct: boolean, attempts: number) => void>();
    onAskTutor = vi.fn<(message: string) => void>();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as unknown as typeof IntersectionObserver);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const renderPre = () =>
    render(
      <MultipleChoiceBlock
        data={makeData()}
        index={5}
        onAnswer={onAnswer}
        onAskTutor={onAskTutor}
        preReader
      />,
    );

  const readAloudCalls = () =>
    onAskTutor.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[QUIZ_READ_ALOUD]'));

  it('renders picture-primary options and hides the Check button + text chrome', () => {
    renderPre();
    expect(screen.getByText('🐔')).toBeTruthy();
    expect(screen.getByText('🐄')).toBeTruthy();
    expect(screen.queryByText(/Check/i)).toBeNull();
    expect(screen.queryByText('Ask the tutor')).toBeNull();
    expect(screen.queryByText(/attempt/)).toBeNull();
  });

  it('auto-reads the question + every choice aloud ONCE when first scrolled into view', () => {
    renderPre();
    expect(readAloudCalls()).toHaveLength(0); // not on mount — on first view
    intersectAll();
    const calls = readAloudCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('Which animal gives us eggs?');
    expect(calls[0]).toContain('B) Hen');
    intersectAll(); // scrolling past again must not re-read
    expect(readAloudCalls()).toHaveLength(1);
  });

  it('replays the read-aloud from the 🔊 button', () => {
    renderPre();
    fireEvent.click(screen.getByLabelText('Hear the question again'));
    expect(readAloudCalls()).toHaveLength(1);
  });

  it('never speaks the answer key in any spoken line', () => {
    renderPre();
    intersectAll();
    fireEvent.click(screen.getByText('Cow')); // wrong tap → retry hint
    for (const call of onAskTutor.mock.calls.map((c) => String(c[0]))) {
      expect(call).not.toMatch(/correct answer is/i);
      expect(call.includes('correctIndex')).toBe(false);
    }
  });

  it('tap = choose: a correct tap answers immediately with no Check step', () => {
    renderPre();
    fireEvent.click(screen.getByText('Hen'));
    expect(onAnswer).toHaveBeenCalledWith('block-5', true, 1);
  });

  it('first miss fires a spoken [QUIZ_RETRY] hint and does NOT finalize; second miss reveals', () => {
    renderPre();
    fireEvent.click(screen.getByText('Dog'));
    expect(onAnswer).not.toHaveBeenCalled();
    const retry = onAskTutor.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[QUIZ_RETRY]'));
    expect(retry).toHaveLength(1);
    expect(retry[0]).toContain('Dog');
    fireEvent.click(screen.getByText('Sheep'));
    expect(onAnswer).toHaveBeenCalledWith('block-5', false, 2);
  });
});

describe('MultipleChoiceBlock standard (no preReader)', () => {
  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as unknown as typeof IntersectionObserver);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('keeps the deliberate select-then-Check flow and never auto-reads', () => {
    const onAnswer = vi.fn();
    const onAskTutor = vi.fn();
    render(
      <MultipleChoiceBlock data={makeData()} index={5} onAnswer={onAnswer} onAskTutor={onAskTutor} />,
    );
    intersectAll();
    expect(onAskTutor).not.toHaveBeenCalled();
    // selecting does not submit
    fireEvent.click(screen.getByText('Hen'));
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
