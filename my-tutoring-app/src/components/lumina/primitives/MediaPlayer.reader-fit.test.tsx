// @vitest-environment jsdom
/**
 * Behavioral test for the MediaPlayer band-gated presentation
 * (media-player-reimagining B1; contract docs/contracts/media-player.md).
 *
 * PRE (gradeLevel 'K'):
 *  - the check is PreReaderSelfCheck (emoji-primary, tap=choose) — no RadioGroup,
 *    no Submit, no "I'm Ready" gate, no "Step N of M" text chrome;
 *  - ONE merged [MEDIA_CHECK_READ_ALOUD] beat carries script + question + options
 *    (no separate [READ_ALOUD] — double-speak guard);
 *  - wrong tap → [MEDIA_CHECK_RETRY], answer never revealed.
 * Reader control (gradeLevel '2'): the original shape is untouched (contract R1/R4/R5).
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
    submitResult: submitEvaluation, hasSubmitted: false, submittedResult: null,
    elapsedMs: 0, resetAttempt: vi.fn(),
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

import MediaPlayer from './MediaPlayer';
import type { MediaPlayerData } from '../types';

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

const makeData = (gradeLevel: string): MediaPlayerData => ({
  title: 'Helpers Around Town',
  description: 'A narrated walkthrough.',
  gradeLevel,
  evalMode: gradeLevel === 'K' ? 'listen_and_look' : 'story_analysis',
  imageResolution: '1K',
  instanceId: 'test-media-player',
  segments: [
    {
      title: 'The Firefighter',
      script: 'Firefighters put out fires. They ride a big red truck.',
      imagePrompt: 'A friendly firefighter next to a red truck',
      audioBase64: null,
      imageUrl: null,
      knowledgeCheck: {
        question: 'What does a firefighter ride?',
        options: ['A red truck', 'A boat', 'A plane'],
        correctOptionIndex: 0,
        explanation: 'Firefighters ride the big red truck.',
        optionEmojis: ['🚒', '⛵', '✈️'],
      },
    },
    {
      title: 'The Doctor',
      script: 'Doctors help us feel better when we are sick.',
      imagePrompt: 'A kind doctor with a stethoscope',
      audioBase64: null,
      imageUrl: null,
      knowledgeCheck: {
        question: 'Who helps us when we are sick?',
        options: ['A doctor', 'A pilot', 'A chef'],
        correctOptionIndex: 0,
        explanation: 'Doctors help sick people.',
        optionEmojis: ['🩺', '🧑‍✈️', '🧑‍🍳'],
      },
    },
  ],
});

const tagged = (tag: string) =>
  sendText.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith(tag));

describe('MediaPlayer @ PRE (kindergarten)', () => {
  beforeEach(() => {
    observers.length = 0;
    sendText.mockClear();
    submitEvaluation.mockClear();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as unknown as typeof IntersectionObserver);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  const begin = () => fireEvent.click(screen.getByLabelText('Start the story'));

  it('renders the picture check (emoji tiles, tap=choose) and hides the reader MCQ shape + text chrome', () => {
    render(<MediaPlayer data={makeData('K')} />);
    begin();
    expect(screen.getByText('🚒')).toBeTruthy();
    expect(screen.getByText('⛵')).toBeTruthy();
    expect(screen.getByText('✈️')).toBeTruthy();
    expect(screen.queryByText(/I.m Ready/i)).toBeNull();
    expect(screen.queryByText(/Submit Answer/i)).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByText(/Step 1 of/i)).toBeNull();
    expect(screen.queryByText(/Knowledge Check/i)).toBeNull();
    // the script prose is voiced, not shown, at PRE
    expect(screen.queryByText(/They ride a big red truck/i)).toBeNull();
  });

  it('sends ONE merged [MEDIA_CHECK_READ_ALOUD] beat (script + question + options) and NO [READ_ALOUD]', () => {
    render(<MediaPlayer data={makeData('K')} />);
    begin();
    intersectAll();
    const merged = tagged('[MEDIA_CHECK_READ_ALOUD]');
    expect(merged).toHaveLength(1);
    expect(merged[0]).toContain('They ride a big red truck');
    expect(merged[0]).toContain('What does a firefighter ride?');
    expect(merged[0]).toContain('A red truck');
    expect(merged[0]).toContain('A boat');
    expect(merged[0]).toContain('A plane');
    expect(tagged('[READ_ALOUD]')).toHaveLength(0);
    intersectAll();
    expect(tagged('[MEDIA_CHECK_READ_ALOUD]')).toHaveLength(1); // no re-read
  });

  it('wrong tap fires [MEDIA_CHECK_RETRY] without revealing the answer; correct tap celebrates', () => {
    render(<MediaPlayer data={makeData('K')} />);
    begin();
    fireEvent.click(screen.getByText('⛵'));
    const retries = tagged('[MEDIA_CHECK_RETRY]');
    expect(retries).toHaveLength(1);
    expect(retries[0]).not.toContain('A red truck'); // never names the correct option
    fireEvent.click(screen.getByText('🚒'));
    expect(tagged('[ANSWER_CORRECT]')).toHaveLength(1);
    expect(screen.getByText(/Firefighters ride the big red truck/i)).toBeTruthy();
  });
});

describe('MediaPlayer @ Grade 2 (reader control — contract R1/R4/R5 unchanged)', () => {
  beforeEach(() => {
    observers.length = 0;
    sendText.mockClear();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as unknown as typeof IntersectionObserver);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('keeps the script text, the "I\'m Ready" gate, the RadioGroup + Submit shape, and the Step counter', () => {
    render(<MediaPlayer data={makeData('2')} />);
    fireEvent.click(screen.getByText(/Begin Lesson/i));
    expect(screen.getByText(/They ride a big red truck/i)).toBeTruthy();
    expect(screen.getByText(/Step 1 of 2/i)).toBeTruthy();
    const ready = screen.getByText(/Show Knowledge Check/i);
    fireEvent.click(ready);
    expect(screen.getAllByRole('radio').length).toBe(3);
    expect(screen.getByText(/Submit Answer/i)).toBeTruthy();
    expect(screen.queryByText('🚒')).toBeNull(); // no emoji tiles for readers
    // the segment-entry narration beat fires for readers
    expect(tagged('[READ_ALOUD]')).toHaveLength(1);
    expect(tagged('[READ_KNOWLEDGE_CHECK]')).toHaveLength(1);
  });
});
