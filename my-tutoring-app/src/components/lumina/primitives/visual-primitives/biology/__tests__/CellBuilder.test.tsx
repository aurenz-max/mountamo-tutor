// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CellBuilder, {
  resolveCellBuilderPhases,
  type CellBuilderData,
} from '../CellBuilder';

const evaluation = vi.hoisted(() => ({
  submitResult: vi.fn(),
  resetAttempt: vi.fn(),
}));

vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: evaluation.submitResult,
    hasSubmitted: false,
    resetAttempt: evaluation.resetAttempt,
  }),
}));

vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: {
    snap: vi.fn(),
    playCorrect: vi.fn(),
    playIncorrect: vi.fn(),
  },
}));

const BASE_DATA: CellBuilderData = {
  title: 'Powerhouse Cell Lab',
  description: 'Engineer a muscle cell for repeated contractions.',
  cellType: 'animal',
  cellContext: 'muscle cell',
  gradeBand: '6-8',
  cellMembrane: {
    description: 'Flexible boundary',
    function: 'Controls what enters and leaves',
  },
  cellWall: { present: false, description: null },
  organelles: [
    {
      id: 'nucleus',
      name: 'Nucleus',
      function: 'Stores DNA and coordinates cell activity.',
      analogy: 'Mission control',
      uniqueTo: null,
      belongsInCell: true,
      correctZone: 'center',
      sizeRelative: 'large',
      expectedQuantity: 'few',
      quantityReasoning: 'One nucleus coordinates most activity in this model.',
    },
    {
      id: 'mitochondria',
      name: 'Mitochondria',
      function: 'Release usable energy from food molecules.',
      analogy: 'Power stations',
      uniqueTo: null,
      belongsInCell: true,
      correctZone: 'scattered',
      sizeRelative: 'medium',
      expectedQuantity: 'lots',
      quantityReasoning: 'Muscle contraction demands abundant ATP production.',
    },
    {
      id: 'chloroplast',
      name: 'Chloroplast',
      function: 'Captures light energy.',
      analogy: 'Solar panel',
      uniqueTo: 'plant cells',
      belongsInCell: false,
      distractorExplanation: 'Animal muscle cells do not photosynthesize.',
      correctZone: null,
      sizeRelative: 'medium',
    },
  ],
  functionMatches: [
    { organelleId: 'nucleus', functionDescription: 'Holds genetic instructions and coordinates activity.' },
    { organelleId: 'mitochondria', functionDescription: 'Converts fuel into ATP for repeated work.' },
  ],
};

describe('CellBuilder mode contract', () => {
  beforeEach(() => {
    evaluation.submitResult.mockClear();
    evaluation.resetAttempt.mockClear();
  });

  it('preserves the legacy mixed path but honors pinned and blended missions', () => {
    expect(resolveCellBuilderPhases({})).toEqual([
      'cell_inventory',
      'organelle_placement',
      'structure_function',
      'cell_specialization',
    ]);
    expect(resolveCellBuilderPhases({ challengeType: 'structure_function' })).toEqual([
      'structure_function',
    ]);
    expect(resolveCellBuilderPhases({ challengeTypes: ['cell_specialization', 'cell_inventory'] })).toEqual([
      'cell_inventory',
      'cell_specialization',
    ]);
  });

  it('renders only the pinned inventory mission and submits first-commit evidence', () => {
    render(<CellBuilder data={{ ...BASE_DATA, challengeType: 'cell_inventory' }} />);

    expect(screen.getByText('Mission 1 of 1')).toBeTruthy();
    expect(screen.queryByText('Build the model')).toBeNull();

    const keepButtons = screen.getAllByRole('button', { name: 'Keep' });
    const rejectButtons = screen.getAllByRole('button', { name: 'Reject' });
    fireEvent.click(keepButtons[0]);
    fireEvent.click(keepButtons[1]);
    fireEvent.click(rejectButtons[2]);
    fireEvent.click(screen.getByRole('button', { name: 'Check mission' }));

    expect(screen.getByText('3 of 3 structures correctly identified.')).toBeTruthy();
    expect((screen.getAllByRole('button', { name: 'Keep' })[0] as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Run cell report' }));
    expect(evaluation.submitResult).toHaveBeenCalledTimes(1);
    expect(evaluation.submitResult.mock.calls[0][1]).toBe(100);
    expect(evaluation.submitResult.mock.calls[0][3].studentWork.activeMissions).toEqual(['cell_inventory']);
  });

  it('does not reveal specialization reasoning until the learner commits', () => {
    render(<CellBuilder data={{ ...BASE_DATA, challengeType: 'cell_specialization' }} />);

    expect(screen.queryByText('Muscle contraction demands abundant ATP production.')).toBeNull();
    expect(screen.getByText('Tune organelle abundance so this cell can carry out its specialized mission.')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Few' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Abundant' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Check mission' }));

    expect(screen.getByText('Muscle contraction demands abundant ATP production.')).toBeTruthy();
    expect((screen.getAllByRole('button', { name: 'Abundant' })[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders mutually exclusive placement regions without printing an organelle answer', () => {
    render(<CellBuilder data={{ ...BASE_DATA, challengeType: 'organelle_placement' }} />);

    for (const region of [
      'Control center',
      'Inner membrane network',
      'Central storage',
      'Cytoplasm',
      'Distributed throughout',
      'Cell boundary',
    ]) {
      expect(screen.getByText(region)).toBeTruthy();
    }
    expect(screen.queryByText('Nucleus → Control center')).toBeNull();
    expect(screen.queryByText('Mitochondria → Distributed throughout')).toBeNull();
  });
});
