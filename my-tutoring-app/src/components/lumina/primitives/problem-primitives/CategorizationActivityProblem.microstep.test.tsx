// @vitest-environment jsdom
/**
 * Behavioral pins for the categorization MICROSTEP surface
 * (qa/di/BACKLOG.md item 23 slice 1): one item at a time, tap the group,
 * per-item verdict, one tap per item (no elimination retry), missed items
 * land in their CORRECT group marked ✗, and the aggregate submission keeps
 * the batch surface's metrics shape with the STUDENT's choices in
 * studentWork. Also pins the touch-safety fix: no HTML5 draggable anywhere
 * (drag events never fire on tablets).
 */
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/SoundManager', () => ({
  SoundManager: {
    tap: vi.fn(), select: vi.fn(), snap: vi.fn(),
    playCorrect: vi.fn(), playIncorrect: vi.fn(),
  },
}));

const submitResult = vi.fn();
const resetAttempt = vi.fn();
vi.mock('../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult, hasSubmitted: false, resetAttempt,
  }),
}));

import { CategorizationActivityProblem } from './CategorizationActivityProblem';
import { SoundManager } from '../../utils/SoundManager';
import type { CategorizationActivityProblemData } from '../../types';

const makeData = (): CategorizationActivityProblemData => ({
  type: 'categorization_activity',
  id: 'cat_1',
  difficulty: 'easy',
  gradeLevel: '1',
  instruction: 'Sort each object by how it feels.',
  categories: ['Hard', 'Soft'],
  categorizationItems: [
    { itemText: 'spoon', correctCategory: 'Hard' },
    { itemText: 'pillow', correctCategory: 'Soft' },
    { itemText: 'rock', correctCategory: 'Hard' },
  ],
  rationale: 'Hard things keep their shape; soft things squish.',
  teachingNote: '',
  successCriteria: [],
});

// Neutralize the anti-answer-leak shuffle so item order is the authored order:
// j = floor(0.999999 * (i + 1)) = i swaps every element with itself.
beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.999999);
  vi.useFakeTimers();
  submitResult.mockClear();
  resetAttempt.mockClear();
  vi.mocked(SoundManager.playCorrect).mockClear();
  vi.mocked(SoundManager.playIncorrect).mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const tapGroup = (item: string, group: string) =>
  fireEvent.click(screen.getByRole('button', { name: `Put ${item} in ${group}` }));

const advanceBeat = () => act(() => { vi.runOnlyPendingTimers(); });

describe('CategorizationActivityProblem — microstep surface', () => {
  it('shows ONE item at a time and never uses HTML5 drag', () => {
    const { container } = render(<CategorizationActivityProblem data={makeData()} />);
    // Active item card is up; later items are not on screen yet.
    expect(screen.getByText('spoon')).toBeTruthy();
    expect(screen.queryByText('pillow')).toBeNull();
    expect(screen.queryByText('rock')).toBeNull();
    // Both groups are tappable buttons; nothing is draggable (touch safety).
    expect(screen.getByRole('button', { name: 'Put spoon in Hard' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Put spoon in Soft' })).toBeTruthy();
    expect(container.querySelectorAll('[draggable]').length).toBe(0);
    // No batch Verify step — the tap IS the commit.
    expect(screen.queryByText(/Check Answer/i)).toBeNull();
  });

  it('correct tap: verdict sound, chip lands ✓, next item appears after the beat', () => {
    render(<CategorizationActivityProblem data={makeData()} />);
    tapGroup('spoon', 'Hard');
    expect(SoundManager.playCorrect).toHaveBeenCalledTimes(1);
    advanceBeat();
    // spoon landed in Hard with a ✓; pillow is now the active item.
    const hard = screen.getByRole('button', { name: 'Put pillow in Hard' });
    expect(hard.textContent).toContain('spoon');
    expect(hard.textContent).toContain('✓');
    expect(screen.getByText('pillow')).toBeTruthy();
  });

  it('one tap per item: input is dead during the verdict beat (no elimination retry)', () => {
    render(<CategorizationActivityProblem data={makeData()} />);
    tapGroup('spoon', 'Soft'); // wrong
    expect(SoundManager.playIncorrect).toHaveBeenCalledTimes(1);
    // Second tap during the beat must be a no-op.
    fireEvent.click(screen.getByRole('button', { name: 'Put spoon in Hard' }));
    expect(SoundManager.playCorrect).not.toHaveBeenCalled();
    advanceBeat();
    // The miss lands in the CORRECT group (board ends true), marked ✗.
    const hard = screen.getByRole('button', { name: 'Put pillow in Hard' });
    expect(hard.textContent).toContain('spoon');
    expect(hard.textContent).toContain('✗');
  });

  it('submits ONE aggregate with batch-shape metrics and the STUDENT\'s choices', () => {
    render(<CategorizationActivityProblem data={makeData()} />);
    tapGroup('spoon', 'Hard');            // right
    advanceBeat();
    tapGroup('pillow', 'Hard');           // wrong (goes with Soft)
    advanceBeat();
    tapGroup('rock', 'Hard');             // right
    advanceBeat();

    expect(submitResult).toHaveBeenCalledTimes(1);
    const [success, score, metrics, extra] = submitResult.mock.calls[0];
    expect(success).toBe(false);
    expect(score).toBe(67); // 2 of 3
    expect(metrics.type).toBe('categorization-activity');
    expect(metrics.totalItems).toBe(3);
    expect(metrics.correctlyCategorized).toBe(2);
    expect(metrics.accuracy).toBe(67);
    expect(metrics.categoryResults).toHaveLength(2);
    // studentWork records what the student CHOSE, not the corrected landing.
    expect(extra.studentWork.itemCategories).toEqual({
      spoon: 'Hard', pillow: 'Hard', rock: 'Hard',
    });
    // Rationale + retry reveal only now.
    expect(screen.getByText(/keep their shape/i)).toBeTruthy();
    expect(screen.getByText('Try Again')).toBeTruthy();
  });

  it('retry resets to item 1 and clears the board', () => {
    render(<CategorizationActivityProblem data={makeData()} />);
    (['Hard', 'Soft', 'Hard'] as const).forEach((g, i) => {
      tapGroup(['spoon', 'pillow', 'rock'][i], g);
      advanceBeat();
    });
    fireEvent.click(screen.getByText('Try Again'));
    expect(resetAttempt).toHaveBeenCalledTimes(1);
    // Back to the first item with an empty board.
    expect(screen.getByRole('button', { name: 'Put spoon in Hard' }).textContent)
      .not.toContain('✓');
    expect(screen.queryByText(/keep their shape/i)).toBeNull();
  });
});
