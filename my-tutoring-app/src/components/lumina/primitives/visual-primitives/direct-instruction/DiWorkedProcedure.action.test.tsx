// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { WorkedProcedureItem } from './diWorkedProcedureScript';

const runnerState = vi.hoisted(() => ({
  index: 0,
  running: true,
}));

vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0,
  }),
}));

vi.mock('../../../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack }: { pack: { items: WorkedProcedureItem[] } }) => ({
    currentItem: pack.items[runnerState.index] ?? null,
    currentIndex: runnerState.index,
    running: runnerState.running,
    stage: 'asking',
    statusLine: 'Your turn.',
    micState: 'armed',
    start: vi.fn(),
    cancelListening: undefined,
    revealHeld: false,
    summary: null,
    stimulusTapped: false,
    hearStimulus: vi.fn(),
  }),
}));

vi.mock('../../../components/JudgedMicPanel', () => ({
  default: () => <div data-testid="mic-panel" />,
}));

import DiWorkedProcedure, { type DiWorkedProcedureData } from './DiWorkedProcedure';

const DATA: DiWorkedProcedureData = {
  title: 'Talk Through Subtraction',
  description: 'Work one column at a time.',
  challengeType: 'subtract_regroup',
  problems: [{ id: 'p1', minuend: 52, subtrahend: 28, challengeType: 'subtract_regroup' }],
  instanceId: 'worked-action-test',
};

beforeEach(() => {
  runnerState.index = 0;
  runnerState.running = true;
});
afterEach(cleanup);

describe('Worked Procedure in the DI action house style', () => {
  it('shows the complete sequence, the exact ask, and the active column', () => {
    render(<DiWorkedProcedure data={DATA} />);
    expect(screen.getByText(
      'Look at the ones column. Say why you need to regroup and what the digits become.',
    )).toBeTruthy();
    expect(screen.getByText('Decide in the ones').closest('li')?.getAttribute('aria-current')).toBe('step');
    expect(screen.getByText('Subtract the ones')).toBeTruthy();
    expect(screen.getByText('Decide in the tens')).toBeTruthy();
    expect(screen.getAllByLabelText(/^Current ones column/)).toHaveLength(3);
    expect(screen.getByTestId('mic-panel')).toBeTruthy();
  });

  it('moves both the sequence highlight and column highlight together', () => {
    runnerState.index = 2;
    render(<DiWorkedProcedure data={DATA} />);
    expect(screen.getByText('Decide in the tens').closest('li')?.getAttribute('aria-current')).toBe('step');
    expect(screen.getAllByLabelText(/^Current tens column/)).toHaveLength(3);
    expect(screen.queryByLabelText(/^Current ones column/)).toBeNull();
  });

  it('keeps the lesson-start control before the run begins', () => {
    runnerState.running = false;
    render(<DiWorkedProcedure data={DATA} />);
    expect(screen.getByText(/Start the lesson, listen to the problem/)).toBeTruthy();
    expect(screen.getByTestId('mic-panel')).toBeTruthy();
  });
});
