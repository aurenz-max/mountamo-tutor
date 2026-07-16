// @vitest-environment jsdom
/**
 * Behavioral test for the FoundationExplorer pre-reader (PRE band) presentation —
 * the reader-fit contract for K (qa/reader-fit/foundation-explorer-PRE-*.md):
 * the self-check options render picture-primary (emoji), the tutor reads the
 * definition + question + every choice aloud on first view ([SELFCHECK_READ_ALOUD])
 * and from a 🔊 button, one tap = choose (no select-then-Check), a wrong tap gives an
 * eyes-free spoken hint (never the answer), and adult chrome (verb badge, "N/N
 * mastered" ledger, "Self-Check" header, concept tabs) is hidden. The standard
 * reader render is unchanged.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendText = vi.fn<(m: string, opts?: unknown) => void>();
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText, isAIResponding: false }),
}));

const submitEvaluation = vi.fn();
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: submitEvaluation, hasSubmitted: false, elapsedMs: 0,
  }),
  // PhaseSummaryPanel (rendered on completion) reads the evaluation context.
  useEvaluationContext: () => null,
}));

vi.mock('../utils/SoundManager', () => ({
  SoundManager: {
    tap: vi.fn(), select: vi.fn(), pop: vi.fn(),
    playCorrect: vi.fn(), playIncorrect: vi.fn(), playStreak: vi.fn(),
    isEnabled: () => false, getVolume: () => 1, play: vi.fn(),
  },
}));

// The diagram image fetch reaches the network — inert here.
vi.mock('../service/geminiClient-api', () => ({
  generateConceptImage: vi.fn(async () => null),
}));

import FoundationExplorer from './FoundationExplorer';
import type { FoundationExplorerData } from '../types';

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

const makeData = (over: Partial<FoundationExplorerData> = {}): FoundationExplorerData => ({
  objectiveId: 'obj1',
  objectiveText: 'Identify the parts of a lever.',
  objectiveVerb: 'identify',
  diagram: { description: 'A lever', imagePrompt: 'a lever', style: 'schematic' },
  themeColor: '#6366f1',
  gradeLevel: 'K',
  concepts: [
    {
      id: 'fulcrum',
      name: 'Fulcrum',
      briefDefinition: 'The balance point that holds up the lever.',
      diagramHighlight: 'the triangle in the middle',
      inContext: { scenario: 'A seesaw sits on a post.', whereToFind: 'the center post' },
      selfCheck: {
        prompt: 'Which one is the fulcrum?',
        options: ['The triangle', 'The heavy box', 'The pushing hand'],
        correctIndex: 0,
        hint: 'Look in the middle.',
        optionEmojis: ['🔺', '📦', '✋'],
      },
      color: '#F59E0B',
    },
  ],
  ...over,
});

const readAloud = () =>
  sendText.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[SELFCHECK_READ_ALOUD]'));
const completed = () =>
  sendText.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[CONCEPT_COMPLETED]'));

describe('FoundationExplorer @ PRE (kindergarten)', () => {
  beforeEach(() => {
    observers.length = 0;
    sendText.mockClear();
    submitEvaluation.mockClear();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as unknown as typeof IntersectionObserver);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('renders picture-primary emoji options and hides adult chrome', () => {
    render(<FoundationExplorer data={makeData()} />);
    expect(screen.getByText('🔺')).toBeTruthy();
    expect(screen.getByText('📦')).toBeTruthy();
    expect(screen.getByText('✋')).toBeTruthy();
    // Chrome that a non-reader can't use is gone.
    expect(screen.queryByText('Self-Check')).toBeNull();
    expect(screen.queryByText('IDENTIFY')).toBeNull();
    expect(screen.queryByText(/mastered/i)).toBeNull();
    expect(screen.queryByText('In Context')).toBeNull();
    expect(screen.queryByText(/Explain it simply/i)).toBeNull();
  });

  it('auto-reads the definition + question + every option aloud ONCE on first view', () => {
    render(<FoundationExplorer data={makeData()} />);
    expect(readAloud()).toHaveLength(0); // not on mount
    intersectAll();
    const calls = readAloud();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('The balance point that holds up the lever.'); // definition read first
    expect(calls[0]).toContain('Which one is the fulcrum?');                  // question
    expect(calls[0]).toContain('The triangle');                              // every option
    expect(calls[0]).toContain('The heavy box');
    expect(calls[0]).toContain('The pushing hand');
    intersectAll(); // scrolling past again must not re-read
    expect(readAloud()).toHaveLength(1);
  });

  it('replays the read-aloud from the self-check 🔊 button', () => {
    render(<FoundationExplorer data={makeData()} />);
    fireEvent.click(screen.getByLabelText('Hear the question again'));
    expect(readAloud()).toHaveLength(1);
  });

  it('tap = choose: tapping the correct picture passes the concept (no Check step)', () => {
    render(<FoundationExplorer data={makeData()} />);
    expect(completed()).toHaveLength(0);
    fireEvent.click(screen.getByText('🔺')); // the correct picture (correctIndex 0)
    expect(completed()).toHaveLength(1);
  });

  it('a wrong tap gives an eyes-free spoken hint and never reveals the answer', () => {
    render(<FoundationExplorer data={makeData()} />);
    fireEvent.click(screen.getByText('📦')); // a wrong picture
    const retry = sendText.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[SELFCHECK_RETRY]'));
    expect(retry).toHaveLength(1);
    expect(retry[0]).not.toMatch(/the answer is|correct answer/i);
    expect(completed()).toHaveLength(0); // a miss is not a pass
  });
});

describe('FoundationExplorer standard (reader grade)', () => {
  beforeEach(() => {
    observers.length = 0; sendText.mockClear();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as unknown as typeof IntersectionObserver);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('keeps the Self-Check header + text options and never auto-reads at grade 3', () => {
    render(<FoundationExplorer data={makeData({ gradeLevel: '3' })} />);
    intersectAll();
    expect(readAloud()).toHaveLength(0);
    expect(screen.getByText('Self-Check')).toBeTruthy();
    expect(screen.getByText('The triangle')).toBeTruthy(); // text option present
  });
});
