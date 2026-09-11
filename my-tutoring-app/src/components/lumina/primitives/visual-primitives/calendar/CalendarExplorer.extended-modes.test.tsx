// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: true }),
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
vi.mock('../../../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack }: { pack: { items: unknown[] } }) => ({
    running: false,
    stage: 'idle',
    statusLine: 'Tap to start.',
    currentIndex: 0,
    currentItem: pack.items[0] ?? null,
    summary: null,
    micState: 'idle',
    start: vi.fn(),
    hearStimulus: vi.fn(),
  }),
}));
vi.mock('../../../components/JudgedMicPanel', () => ({
  default: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="judged-mic-panel">{children}</div>
  ),
}));

import CalendarExplorer, { type CalendarExplorerChallenge } from './CalendarExplorer';

const base = (overrides: Partial<CalendarExplorerChallenge>): CalendarExplorerChallenge => ({
  id: 'c1',
  type: 'identify',
  question: 'Calendar question',
  month: 3,
  year: 2025,
  correctAnswer: '11',
  options: ['9', '10', '11', '12'],
  hint: 'Use the calendar.',
  narration: 'Try it.',
  ...overrides,
});

const renderChallenges = (challenges: CalendarExplorerChallenge[]) => render(
  <CalendarExplorer data={{ title: 'Calendar Practice', gradeBand: 'K', challenges }} />,
);

afterEach(cleanup);

describe('calendar-explorer extended mode surfaces', () => {
  it('renders weekday offset steps and choices without an unrelated month grid', () => {
    renderChallenges([base({
      type: 'day_offset',
      question: 'Start on Tuesday. Count forward 3 days. What day do you land on?',
      correctAnswer: 'Friday',
      options: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      startDay: 'Tuesday',
      offsetDays: 3,
    })]);

    expect(screen.getByTestId('day-offset-surface').textContent).toContain('Tuesday');
    expect(screen.getByLabelText('3 steps forward')).toBeTruthy();
    expect(screen.getByTestId('option-Friday')).toBeTruthy();
    expect(screen.queryByTestId('calendar-grid')).toBeNull();
    expect(screen.queryByTestId('month-label')).toBeNull();
  });

  it('uses a calendar tap to place and score a named event marker', () => {
    renderChallenges([
      base({
        type: 'mark_events',
        question: 'Mark Library Day on March 11.',
        correctAnswer: '11',
        options: [],
        eventLabel: 'Library Day',
        markedDates: [],
        highlightDates: [11],
      }),
      base({ id: 'c2' }),
    ]);

    expect(screen.queryByTestId('option-11')).toBeNull();
    fireEvent.click(screen.getByTestId('date-11'));
    expect(screen.getByLabelText('Library Day marker placed')).toBeTruthy();
    expect(screen.getByText(/Marker placed on:/)).toBeTruthy();
    fireEvent.click(screen.getByText('Check Answer'));
    expect(screen.getByText('Correct!')).toBeTruthy();
  });

  it('shows both interval endpoints before the attempt and keeps the explicit convention', () => {
    renderChallenges([base({
      type: 'interval_count',
      question: 'How many days are between March 4 and March 9? Do not count the two marked days.',
      correctAnswer: '4',
      options: ['3', '4', '5', '6'],
      markedDates: [4, 9],
      intervalStartDate: 4,
      intervalEndDate: 9,
      countConvention: 'between',
    })]);

    expect(screen.getByTestId('date-4').getAttribute('data-marked')).toBe('true');
    expect(screen.getByTestId('date-9').getAttribute('data-marked')).toBe('true');
    expect(screen.getAllByLabelText('marked event')).toHaveLength(2);
    expect(screen.getByText(/Do not count the two marked days/)).toBeTruthy();
    expect(screen.getByTestId('option-4')).toBeTruthy();
  });

  it('routes month successors to the judged voice surface without printing month names', () => {
    const names = ['November', 'December', 'January', 'February', 'March', 'April'];
    const challenges = Array.from({ length: 5 }, (_, index) => base({
      id: `m${index + 1}`,
      type: 'month_sequence',
      question: 'Listen to the tutor, then say the month that comes next.',
      correctAnswer: names[index + 1],
      options: [],
      currentMonth: names[index],
      expectedMonth: names[index + 1],
      chainPosition: index + 1,
    }));

    renderChallenges(challenges);
    expect(screen.getByTestId('calendar-month-sequence')).toBeTruthy();
    expect(screen.getByTestId('judged-mic-panel')).toBeTruthy();
    expect(screen.queryByTestId('calendar-grid')).toBeNull();
    for (const month of names) {
      expect(screen.queryByText(month, { exact: true })).toBeNull();
    }
  });
});
