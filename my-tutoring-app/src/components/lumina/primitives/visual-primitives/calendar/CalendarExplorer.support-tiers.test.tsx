// @vitest-environment jsdom
/**
 * calendar-explorer — render-side support tiers + the two shipped defects.
 *
 * Support tiers (L3): the generator stamps display-only scaffold fields; this file
 * pins that the component actually withdraws them, that an UNSTAMPED payload renders
 * the full legacy help, and that the K band floor beats the tier.
 *
 * Defect (a): an `identify` challenge whose correctAnswer is a day NAME was
 * unanswerable — MC options were hidden for identify, and a grid click yields a
 * numeric string, so "Saturday" could never match. (The shipped identify FALLBACK
 * was in that broken class.)
 *
 * Defect (b): `aiPrimitiveData` pinned `currentChallenge` to `challenges[0]`, so the
 * live tutor coached question 1 for the whole session.
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  sendText: vi.fn(),
  primitiveDataFrames: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../../hooks/useLuminaAI', () => ({
  useLuminaAI: (args: { primitiveData: Record<string, unknown> }) => {
    h.primitiveDataFrames.push(args.primitiveData);
    return { sendText: h.sendText, isConnected: true };
  },
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

import CalendarExplorer, {
  isGridAnswerChallenge,
  tutorRevealPolicy,
  type CalendarExplorerChallenge,
  type CalendarExplorerData,
} from './CalendarExplorer';

// October 2025: Fridays on 3, 10, 17, 24, 31 → 5.
const countChallenge = (
  overrides: Partial<CalendarExplorerChallenge> = {},
): CalendarExplorerChallenge => ({
  id: 'c1',
  type: 'count',
  question: 'How many Fridays are in October 2025?',
  month: 10,
  year: 2025,
  correctAnswer: '5',
  options: ['4', '5', '6', '7'],
  hint: 'Look at the Friday column and count each one in October.',
  narration: "Let's count!",
  targetDayOfWeek: 'Friday',
  ...overrides,
});

/** The broken class: an identify challenge answered with a day NAME. */
const dayNameIdentify = (
  overrides: Partial<CalendarExplorerChallenge> = {},
): CalendarExplorerChallenge => ({
  id: 'i1',
  type: 'identify',
  question: 'What day of the week is March 15, 2025?',
  month: 3,
  year: 2025,
  correctAnswer: 'Saturday',
  options: ['Thursday', 'Friday', 'Saturday', 'Sunday'],
  hint: 'Find March 15 on the calendar.',
  narration: "Let's look!",
  highlightDates: [15],
  ...overrides,
});

/** The working class: an identify challenge answered by clicking a date. */
const dateIdentify = (
  overrides: Partial<CalendarExplorerChallenge> = {},
): CalendarExplorerChallenge => ({
  id: 'i2',
  type: 'identify',
  question: 'What date is the second Tuesday of March 2025?',
  month: 3,
  year: 2025,
  correctAnswer: '11',
  options: ['4', '11', '18', '25'],
  hint: 'Find the Tuesdays in March.',
  narration: "Let's look!",
  highlightDates: [11],
  ...overrides,
});

const renderExplorer = (data: Partial<CalendarExplorerData> & { challenges: CalendarExplorerChallenge[] }) =>
  render(
    <CalendarExplorer
      data={{
        title: 'Calendar Explorer',
        gradeBand: '1',
        instanceId: 'test-instance',
        ...data,
      }}
    />,
  );

beforeEach(() => {
  h.sendText.mockClear();
  h.primitiveDataFrames.length = 0;
});
afterEach(cleanup);

// ---------------------------------------------------------------------------
// Support tiers
// ---------------------------------------------------------------------------

describe('calendar-explorer render — support tiers', () => {
  it('LEGACY DEFAULT: an unstamped payload renders the full help', () => {
    renderExplorer({ challenges: [countChallenge()] });

    expect(screen.getAllByTestId('day-header')).toHaveLength(7);
    expect(screen.getByTestId('month-label').textContent).toContain('October 2025');
    // Every Friday in October 2025 is pre-marked in purple.
    const marked = document.querySelectorAll('[data-target-day="true"]');
    expect(Array.from(marked).map((n) => n.textContent)).toEqual(['3', '10', '17', '24', '31']);
  });

  it('HARD withdraws headers, the month caption and the target-day pre-marking', () => {
    renderExplorer({
      supportTier: 'hard',
      challenges: [countChallenge({
        showDayHeaders: false,
        showMonthLabel: false,
        showTargetDayColumn: false,
      })],
    });

    expect(screen.queryAllByTestId('day-header')).toHaveLength(0);
    expect(screen.queryByTestId('month-label')).toBeNull();
    expect(document.querySelectorAll('[data-target-day="true"]')).toHaveLength(0);
    // The manipulable object itself is NEVER withdrawn — the grid is still there.
    expect(screen.getByTestId('date-3')).toBeTruthy();
    expect(screen.getByTestId('date-31')).toBeTruthy();
    // Answer form intact: still MC, correct answer present.
    expect(screen.getByTestId('option-5')).toBeTruthy();
  });

  it('MEDIUM withdraws the month caption only', () => {
    renderExplorer({
      supportTier: 'medium',
      challenges: [countChallenge({
        showDayHeaders: true,
        showMonthLabel: false,
        showTargetDayColumn: true,
      })],
    });

    expect(screen.getAllByTestId('day-header')).toHaveLength(7);
    expect(screen.queryByTestId('month-label')).toBeNull();
    expect(document.querySelectorAll('[data-target-day="true"]')).toHaveLength(5);
  });

  it('K BAND FLOOR: a pre-reader keeps every orientation scaffold even if stamped off', () => {
    renderExplorer({
      gradeBand: 'K',
      supportTier: 'hard',
      challenges: [countChallenge({
        showDayHeaders: false,
        showMonthLabel: false,
        showTargetDayColumn: false,
      })],
    });

    expect(screen.getAllByTestId('day-header')).toHaveLength(7);
    expect(screen.getByTestId('month-label')).toBeTruthy();
    expect(document.querySelectorAll('[data-target-day="true"]')).toHaveLength(5);
  });

  it('withdrawal is per challenge — advancing re-reads the active stamps', () => {
    renderExplorer({
      supportTier: 'hard',
      challenges: [
        dateIdentify({ showDayHeaders: true, showMonthLabel: true }),
        countChallenge({ showDayHeaders: false, showMonthLabel: false, showTargetDayColumn: false }),
      ],
    });

    expect(screen.getAllByTestId('day-header')).toHaveLength(7);

    fireEvent.click(screen.getByTestId('date-11'));
    fireEvent.click(screen.getByText('Check Answer'));
    fireEvent.click(screen.getByText('Next Question'));

    expect(screen.queryAllByTestId('day-header')).toHaveLength(0);
    expect(screen.queryByTestId('month-label')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Defect (a) — day-name identify was unanswerable
// ---------------------------------------------------------------------------

describe('calendar-explorer — defect (a): day-name identify is answerable', () => {
  it('classifies the answer surface by the SHAPE of correctAnswer', () => {
    expect(isGridAnswerChallenge(dateIdentify())).toBe(true);
    expect(isGridAnswerChallenge(dayNameIdentify())).toBe(false);
    expect(isGridAnswerChallenge(countChallenge())).toBe(false);
  });

  it('renders the generated options for a day-name identify, and they resolve correctly', () => {
    // Two challenges so the question card survives the answer (a single-challenge
    // session completes immediately and swaps in the summary panel).
    renderExplorer({ challenges: [dayNameIdentify(), countChallenge()] });

    // Pre-fix these buttons did not exist for ANY identify challenge.
    expect(screen.getByTestId('option-Saturday')).toBeTruthy();
    expect(screen.getByTestId('option-Thursday')).toBeTruthy();

    fireEvent.click(screen.getByTestId('option-Saturday'));
    fireEvent.click(screen.getByText('Check Answer'));
    expect(screen.getByText('Correct!')).toBeTruthy();
  });

  it('a grid click no longer poisons the answer for a day-name identify', () => {
    renderExplorer({ challenges: [dayNameIdentify(), countChallenge()] });

    // Pre-fix this set selectedAnswer to "15", which could never equal "Saturday",
    // so Check Answer was armed with a permanently wrong value.
    fireEvent.click(screen.getByTestId('date-15'));
    expect((screen.getByText('Check Answer') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByTestId('option-Saturday'));
    fireEvent.click(screen.getByText('Check Answer'));
    expect(screen.getByText('Correct!')).toBeTruthy();
  });

  it('CONTROL: a date-answer identify keeps the grid as the answer surface (no options)', () => {
    renderExplorer({ challenges: [dateIdentify(), countChallenge()] });

    expect(screen.queryByTestId('option-11')).toBeNull();
    expect(screen.queryByTestId('option-4')).toBeNull();

    fireEvent.click(screen.getByTestId('date-11'));
    expect(screen.getByText(/Selected:/)).toBeTruthy();
    fireEvent.click(screen.getByText('Check Answer'));
    expect(screen.getByText('Correct!')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Defect (b) — the tutor was pinned to challenge 1
// ---------------------------------------------------------------------------

describe('calendar-explorer — defect (b): tutor context tracks the active challenge', () => {
  it('re-stamps currentChallenge when the student advances', () => {
    renderExplorer({
      challenges: [dateIdentify(), countChallenge()],
    });

    expect(h.primitiveDataFrames.at(-1)?.currentChallenge)
      .toBe('What date is the second Tuesday of March 2025?');

    fireEvent.click(screen.getByTestId('date-11'));
    fireEvent.click(screen.getByText('Check Answer'));
    fireEvent.click(screen.getByText('Next Question'));

    // Pre-fix this stayed on challenges[0] forever.
    const latest = h.primitiveDataFrames.at(-1)!;
    expect(latest.currentChallenge).toBe('How many Fridays are in October 2025?');
    expect(latest.challengeNumber).toBe(2);
    expect(latest.challengeType).toBe('count');
    expect(latest.month).toBe('October');
  });

  it('threads the support tier to the tutor context', () => {
    renderExplorer({ supportTier: 'hard', challenges: [countChallenge()] });
    expect(h.primitiveDataFrames.at(-1)?.supportTier).toBe('hard');

    cleanup();
    h.primitiveDataFrames.length = 0;
    renderExplorer({ challenges: [countChallenge()] });
    expect(h.primitiveDataFrames.at(-1)?.supportTier).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tutor reveal policy — the second scaffold channel must match the screen
// ---------------------------------------------------------------------------

describe('calendar-explorer — tutor reveal policy', () => {
  it('says nothing when there is no tier (legacy sends unchanged)', () => {
    expect(tutorRevealPolicy(undefined)).toBe('');
  });

  it('forbids reciting the withdrawn header order at hard', () => {
    const hard = tutorRevealPolicy('hard');
    expect(hard).toContain('[SUPPORT_TIER hard]');
    expect(hard).toMatch(/Do NOT recite the Sun, Mon, Tue/);
    expect(tutorRevealPolicy('easy')).toContain('[SUPPORT_TIER easy]');
    expect(tutorRevealPolicy('medium')).toContain('[SUPPORT_TIER medium]');
  });

  it('withholds the correct answer from the tutor on a wrong attempt at hard', () => {
    renderExplorer({ supportTier: 'hard', challenges: [countChallenge()] });

    fireEvent.click(screen.getByTestId('option-7'));
    fireEvent.click(screen.getByText('Check Answer'));

    const wrongSend = h.sendText.mock.calls.map((c) => String(c[0])).find((t) => t.includes('[ANSWER_INCORRECT]'));
    expect(wrongSend).toBeTruthy();
    expect(wrongSend).not.toContain('correct is "5"');
    expect(wrongSend).toContain('[SUPPORT_TIER hard]');
  });

  it('LEGACY: an untiered session still hands the tutor the answer to hint from', () => {
    renderExplorer({ challenges: [countChallenge()] });

    fireEvent.click(screen.getByTestId('option-7'));
    fireEvent.click(screen.getByText('Check Answer'));

    const wrongSend = h.sendText.mock.calls.map((c) => String(c[0])).find((t) => t.includes('[ANSWER_INCORRECT]'));
    expect(wrongSend).toContain('correct is "5"');
    expect(wrongSend).not.toContain('[SUPPORT_TIER');
  });
});
