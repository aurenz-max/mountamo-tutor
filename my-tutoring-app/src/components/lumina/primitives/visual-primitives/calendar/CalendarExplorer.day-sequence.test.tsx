// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    submittedResult: null,
    elapsedMs: 0,
  }),
  useEvaluationContext: () => null,
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

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const challenges: CalendarExplorerChallenge[] = Array.from({ length: 5 }, (_, index) => ({
  id: `day-${index + 1}`,
  type: 'day_sequence',
  question: 'Listen to the tutor, then say the day that comes next.',
  month: 1,
  year: 2026,
  correctAnswer: days[index + 1],
  options: [],
  hint: 'Say the week together from Sunday.',
  narration: 'Continue the spoken chain.',
  currentDay: days[index],
  expectedDay: days[index + 1],
  chainPosition: index + 1,
}));

afterEach(cleanup);

describe('calendar-explorer day_sequence render', () => {
  it('renders the judged voice surface with no printed week strip or day-name answer', () => {
    render(
      <CalendarExplorer
        data={{
          title: 'Days in Order',
          gradeBand: 'K',
          challenges,
        }}
      />,
    );

    expect(screen.getByTestId('calendar-day-sequence')).toBeTruthy();
    expect(screen.getByTestId('judged-mic-panel')).toBeTruthy();
    expect(screen.getByText('1 / 5')).toBeTruthy();
    expect(screen.queryAllByTestId('day-header')).toHaveLength(0);
    expect(document.querySelector('[data-testid^="date-"]')).toBeNull();
    for (const day of ['Sunday', ...days]) {
      expect(screen.queryByText(day, { exact: true })).toBeNull();
    }
  });
});
