// @vitest-environment jsdom
/**
 * The split-brain regression — multiplication-explorer, 2026-08-10.
 *
 * Behaviour tsc cannot see: WHICH fact each representation panel draws.
 *
 * A 2026-07-07 fix moved grading and the headline equation onto the per-challenge
 * fact but left every representation panel rendering the shared `data.fact`. With
 * per-challenge facts that meant a student saw one equation, a picture of a
 * DIFFERENT fact, and was graded on the first. It stayed invisible only because
 * the generator forced every challenge onto one fact — which is what made a
 * session "3 × 4 asked five ways".
 *
 * These assert the panels follow the ACTIVE challenge. The session `data.fact` is
 * deliberately set to a fact NO challenge uses, so anything still reading it shows
 * up immediately.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isAudioPlaying: false, isConnected: true }),
}));
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    resetAttempt: vi.fn(),
    elapsedMs: 0,
  }),
  useEvaluationContext: () => null,
}));

import MultiplicationExplorer, {
  type MultiplicationExplorerData,
} from '../MultiplicationExplorer';

/** A fact no challenge uses — a canary for anything still reading data.fact. */
const CANARY = { factor1: 9, factor2: 9, product: 81 };

const makeData = (
  overrides: Partial<MultiplicationExplorerData> = {},
): MultiplicationExplorerData => ({
  title: 'Sticker Packs',
  description: 'Explore multiplication.',
  fact: CANARY,
  representations: {
    equalGroups: true, array: true, repeatedAddition: true,
    numberLine: false, areaModel: false,
  },
  activeRepresentation: 'array',
  gradeBand: '2-3',
  showOptions: {
    showProduct: false, showFactFamily: false,
    showCommutativeFlip: false, showDistributiveBreakdown: false,
  },
  imagePrompt: null,
  challenges: [
    {
      id: 'c1', type: 'build',
      instruction: 'Build 3 packs with 4 in each. How many in total?',
      targetFact: '3 × 4 = 12', fact: { factor1: 3, factor2: 4 },
      representation: 'array', hiddenValue: 'product', timeLimit: null,
      hint: 'Skip-count by 4.', narration: 'Build it!',
    },
    {
      id: 'c2', type: 'build',
      instruction: 'Build 6 packs with 7 in each. How many in total?',
      targetFact: '6 × 7 = 42', fact: { factor1: 6, factor2: 7 },
      representation: 'groups', hiddenValue: 'product', timeLimit: null,
      hint: 'Skip-count by 7.', narration: 'Next!',
    },
  ],
  ...overrides,
});

beforeEach(() => cleanup());

describe('representations follow the ACTIVE challenge, not the session fact', () => {
  it('draws the first challenge\'s fact — not data.fact', () => {
    render(<MultiplicationExplorer data={makeData()} />);
    // The array panel labels itself "R rows × C columns".
    expect(screen.getByText(/3 rows/i)).toBeTruthy();
    expect(screen.getByText(/4 columns/i)).toBeTruthy();
    // The canary must appear nowhere.
    expect(screen.queryByText(/9 rows/i)).toBeNull();
  });

  it('renders the headline equation for the active challenge', () => {
    const { container } = render(<MultiplicationExplorer data={makeData()} />);
    expect(container.textContent).toContain('3 × 4');
    expect(container.textContent).not.toContain('9 × 9');
  });

  it('honors the per-challenge modality — an array challenge opens on the array tab', () => {
    render(<MultiplicationExplorer data={makeData()} />);
    // The array panel's own label is present because that tab is selected.
    expect(screen.getByText(/3 rows/i)).toBeTruthy();
  });

  it('falls back to parsing targetFact when the structured fact is absent (pre-redesign data)', () => {
    const data = makeData();
    // Old-shape challenge: targetFact prose only, no structured fact.
    delete (data.challenges[0] as { fact?: unknown }).fact;
    render(<MultiplicationExplorer data={data} />);
    expect(screen.getByText(/3 rows/i)).toBeTruthy();
    expect(screen.queryByText(/9 rows/i)).toBeNull();
  });

  it('falls back to the session fact only when the challenge carries neither', () => {
    const data = makeData();
    delete (data.challenges[0] as { fact?: unknown }).fact;
    data.challenges[0].targetFact = '';
    render(<MultiplicationExplorer data={data} />);
    // Now — and only now — the session fact is the honest source.
    expect(screen.getByText(/9 rows/i)).toBeTruthy();
  });
});
