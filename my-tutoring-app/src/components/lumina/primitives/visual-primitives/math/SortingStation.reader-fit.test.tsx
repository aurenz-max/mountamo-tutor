// @vitest-environment jsdom
/**
 * Behavioral test for the SortingStation pre-reader (PRE band / Kindergarten) presentation —
 * the reader-fit contract (qa/reader-fit/sorting-station-PRE-2026-07-15.md):
 *   - bins are PICTURE-primary (bucketEmoji, or a color-coded fallback) with the word as a caption
 *   - adult chrome hidden (progress counter, description, instruction panel, "Unsorted Objects")
 *   - odd-one-out is tap = choose (no Check button; a tap auto-submits)
 *   - sort-family stays a multi-part construction and KEEPS its explicit Check button
 *   - reader grades (Grade 1) keep the full chrome (control)
 */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendText = vi.fn();
vi.mock('../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText, isConnected: true }),
}));

vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: {
    select: vi.fn(),
    snap: vi.fn(),
    tick: vi.fn(),
    invalid: vi.fn(),
    playCorrect: vi.fn(),
    playIncorrect: vi.fn(),
    // PhaseSummaryPanel reads these on completion
    isEnabled: () => false,
    getVolume: () => 0,
    playComplete: vi.fn(),
  },
}));

const submitResult = vi.fn();
vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult,
    hasSubmitted: false,
    submittedResult: null,
    elapsedMs: 0,
  }),
  // PhaseSummaryPanel → DemonstratedSkillDetails reads this on completion.
  useEvaluationContext: () => null,
}));

import SortingStation, { type SortingStationData } from './SortingStation';

const sortByOne = (gradeBand: 'K' | '1'): SortingStationData => ({
  title: 'Needs and Wants',
  description: 'Sort each thing into a need or a want',
  gradeBand,
  maxCategories: 2,
  showCounts: true,
  showTallyChart: false,
  challenges: [
    {
      id: 'c1',
      type: 'sort-by-one',
      instruction: 'Sort these into needs and wants',
      sortingAttribute: 'category',
      objects: [
        { id: 'o1', label: 'Water', emoji: '💧', attributes: { category: 'need' } },
        { id: 'o2', label: 'Toy', emoji: '🧸', attributes: { category: 'want' } },
      ],
      categories: [
        { label: 'Need', rule: { category: 'need' }, bucketEmoji: '🏠' },
        { label: 'Want', rule: { category: 'want' }, bucketEmoji: '🎁' },
      ],
    },
  ],
});

const oddOneOut = (gradeBand: 'K' | '1'): SortingStationData => ({
  title: 'Which One Is Different',
  description: 'Find the one that does not belong',
  gradeBand,
  maxCategories: 2,
  showCounts: false,
  showTallyChart: false,
  challenges: [
    {
      id: 'c1',
      type: 'odd-one-out',
      instruction: 'Which one does not belong?',
      objects: [
        { id: 'o1', label: 'Dog', emoji: '🐶', attributes: {} },
        { id: 'o2', label: 'Cat', emoji: '🐱', attributes: {} },
        { id: 'o3', label: 'Car', emoji: '🚗', attributes: {} },
      ],
      oddOneOut: 'o3',
      oddOneOutReason: 'It is not an animal',
    },
  ],
});

const tagsStarting = (prefix: string) =>
  sendText.mock.calls.map(c => String(c[0])).filter(m => m.startsWith(prefix));

describe('SortingStation @ PRE (gradeBand K)', () => {
  beforeEach(() => { sendText.mockClear(); submitResult.mockClear(); });
  afterEach(cleanup);

  it('renders picture-primary bins (emoji + word caption)', () => {
    render(<SortingStation data={sortByOne('K')} />);
    // the bin icon is a picture; the word is only a caption
    expect(screen.getByText('🏠')).toBeTruthy();
    expect(screen.getByText('🎁')).toBeTruthy();
    expect(screen.getByText('Need')).toBeTruthy();
    expect(screen.getByText('Want')).toBeTruthy();
  });

  it('hides adult chrome and the unreadable instruction/description text', () => {
    render(<SortingStation data={sortByOne('K')} />);
    expect(screen.queryByText(/Challenge 1 of 1/)).toBeNull();       // progress counter
    expect(screen.queryByText('Sort each thing into a need or a want')).toBeNull(); // description
    expect(screen.queryByText('Sort these into needs and wants')).toBeNull();       // instruction panel
    expect(screen.queryByText('Unsorted Objects')).toBeNull();       // uppercase header
    expect(screen.queryByText('Kindergarten')).toBeNull();           // band badge
  });

  it('sort-family keeps its explicit Check button (multi-part construction)', () => {
    render(<SortingStation data={sortByOne('K')} />);
    expect(screen.getByText('Check Answer')).toBeTruthy();
  });

  it('odd-one-out is tap = choose: no Check button, a correct tap auto-submits', () => {
    render(<SortingStation data={oddOneOut('K')} />);
    // no explicit Check button for an atomic selection at K
    expect(screen.queryByText('Check Answer')).toBeNull();
    // the instruction protocol text is hidden (tutor voices it)
    expect(screen.queryByText(/does(n't| not) belong/i)).toBeNull();
    // tapping the odd object auto-checks → [ANSWER_CORRECT] fires without any Check press
    fireEvent.click(screen.getByRole('button', { name: /Car/ }));
    expect(tagsStarting('[ANSWER_CORRECT]')).toHaveLength(1);
    expect(submitResult).toHaveBeenCalled();
  });

  it('odd-one-out wrong tap does NOT complete and requests a spoken hint', () => {
    render(<SortingStation data={oddOneOut('K')} />);
    fireEvent.click(screen.getByRole('button', { name: /Dog/ })); // 🐶 is an animal — wrong
    expect(tagsStarting('[ANSWER_INCORRECT]')).toHaveLength(1);
    expect(tagsStarting('[ANSWER_CORRECT]')).toHaveLength(0);
    expect(submitResult).not.toHaveBeenCalled();
  });
});

describe('SortingStation @ reader grade (control, Grade 1)', () => {
  beforeEach(() => { sendText.mockClear(); submitResult.mockClear(); });
  afterEach(cleanup);

  it('keeps the reader presentation: counter, instruction, text-primary bins (no big emoji header)', () => {
    render(<SortingStation data={sortByOne('1')} />);
    expect(screen.getByText(/Challenge 1 of 1/)).toBeTruthy();
    expect(screen.getByText('Sort these into needs and wants')).toBeTruthy();
    // the bucketEmoji picture header is a K-only affordance
    expect(screen.queryByText('🏠')).toBeNull();
    expect(screen.queryByText('🎁')).toBeNull();
  });
});
