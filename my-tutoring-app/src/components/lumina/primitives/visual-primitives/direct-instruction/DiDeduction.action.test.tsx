// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { DeductionItem } from './diDeductionScript';

const runnerState = vi.hoisted(() => ({ index: 1, running: true }));

vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0,
  }),
}));

vi.mock('../../../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack }: { pack: { items: DeductionItem[] } }) => ({
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

import DiDeduction, { type DiDeductionData } from './DiDeduction';

const DATA: DiDeductionData = {
  title: 'Use the Rule',
  description: 'Decide only from the rule.',
  challengeType: 'deny',
  rules: [{
    id: 'birds',
    category: 'bird',
    categoryPlural: 'birds',
    propertyPlural: 'lay eggs',
    propertySingular: 'lays eggs',
    propertyNegated: 'does not lay eggs',
    kindNoun: 'animal',
    members: ['robin'],
    nonMembers: ['dog'],
    lookalikes: ['turtle'],
  }],
  instanceId: 'deduction-action-test',
};

beforeEach(() => {
  runnerState.index = 1;
  runnerState.running = true;
});
afterEach(cleanup);

describe('Deduction in the DI action house style', () => {
  it('shows a spoken verdict guide, not pseudo-buttons', () => {
    render(<DiDeduction data={DATA} />);
    expect(screen.getByText(
      "Is a dog a bird? Say yes, no, or can't tell—then explain using the rule.",
    )).toBeTruthy();

    const guide = screen.getByLabelText('Spoken verdict choices');
    expect(within(guide).getByText('Say one, then explain using the rule')).toBeTruthy();
    expect(within(guide).getByText('yes')).toBeTruthy();
    expect(within(guide).getByText('no')).toBeTruthy();
    expect(within(guide).getByText("can't tell")).toBeTruthy();
    expect(within(guide).queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByTestId('mic-panel')).toBeTruthy();
  });

  it('shows the whole rule sequence and highlights the current case', () => {
    render(<DiDeduction data={DATA} />);
    expect(screen.getByText('State what follows')).toBeTruthy();
    const choices = screen.getAllByText('Choose and explain');
    expect(choices).toHaveLength(2);
    expect(choices[0].closest('li')?.getAttribute('aria-current')).toBe('step');
  });

  it('keeps the lesson-start control before the first spoken turn', () => {
    runnerState.running = false;
    runnerState.index = 0;
    render(<DiDeduction data={DATA} />);
    expect(screen.getByText(/Start the lesson, listen to the rule and case/)).toBeTruthy();
    expect(screen.getByTestId('mic-panel')).toBeTruthy();
  });
});
