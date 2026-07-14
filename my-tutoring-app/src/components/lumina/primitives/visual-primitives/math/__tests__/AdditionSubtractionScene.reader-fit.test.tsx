// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for the K (PRE-band) interaction rebuilds:
 *  1. act-out / solve-story answer via TAPPING a number tile (no typing, tap=choose)
 *     — tapping the correct tile completes the challenge (Next button appears).
 *  2. create-story is a BUILD-the-story production task at K — adding objects up to
 *     resultCount (addition) or removing down to it (subtraction) auto-judges the
 *     challenge complete, with no Check button.
 *
 * These are the behaviors tsc can't verify. External hooks (live tutor, evaluation,
 * audio) are mocked so we drive pure component logic.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: true }),
}));
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    submittedResult: null,
    elapsedMs: 0,
  }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import AdditionSubtractionScene, { type AddSubChallenge } from '../AdditionSubtractionScene';

const baseData = (challenges: AddSubChallenge[]) => ({
  title: 'Reader-fit test',
  gradeBand: 'K' as const,
  maxNumber: 5,
  showTenFrame: false,
  showEquationBar: true,
  challenges,
});

const ch = (over: Partial<AddSubChallenge>): AddSubChallenge => ({
  id: 'c1', type: 'act-out', instruction: '', storyText: 's', scene: 'pond',
  objectType: 'ducks', operation: 'addition', storyType: 'join',
  startCount: 2, changeCount: 1, resultCount: 3, equation: '2 + 1 = 3', ...over,
});

beforeEach(() => cleanup());

describe('AdditionSubtractionScene reader-fit (K band)', () => {
  it('act-out at K: no text input, number tiles present; tapping the right tile completes', async () => {
    const user = userEvent.setup();
    render(<AdditionSubtractionScene data={baseData([
      ch({ id: 'a1', type: 'act-out', resultCount: 3, equation: '2 + 1 = 3' }),
      ch({ id: 'a2', type: 'act-out', resultCount: 4, startCount: 3, changeCount: 1, equation: '3 + 1 = 4' }),
    ])} />);

    // No keyboard: there must be no number <input> in the act-out answer surface.
    expect(document.querySelector('input[type="number"]')).toBeNull();
    // Tapping the correct tile (3) atomically answers — Next Challenge appears.
    await user.click(screen.getByRole('button', { name: '3' }));
    expect((await screen.findByText(/next challenge/i)) as HTMLElement).toBeTruthy();
  });

  it('create-story addition at K: adding objects up to the total auto-completes (no Check)', async () => {
    const user = userEvent.setup();
    render(<AdditionSubtractionScene data={baseData([
      ch({ id: 'b1', type: 'create-story', operation: 'addition', startCount: 2, changeCount: 1, resultCount: 3, equation: '2 + 1 = 3' }),
      ch({ id: 'b2', type: 'act-out', resultCount: 2, startCount: 1, changeCount: 1, equation: '1 + 1 = 2' }),
    ])} />);

    // No Check button in the build task; an Add control is the primary action.
    expect(screen.queryByRole('button', { name: /^check/i })).toBeNull();
    const addBtn = screen.getByRole('button', { name: /add one ducks/i });
    // Build up to resultCount (3) — the third add completes the challenge.
    await user.click(addBtn);
    await user.click(addBtn);
    expect(screen.queryByText(/next challenge/i)).toBeNull(); // not yet at 3
    await user.click(addBtn);
    expect((await screen.findByText(/next challenge/i)) as HTMLElement).toBeTruthy();
  });

  it('create-story subtraction at K: removing objects down to the result auto-completes', async () => {
    render(<AdditionSubtractionScene data={baseData([
      ch({ id: 'd1', type: 'create-story', operation: 'subtraction', startCount: 4, changeCount: 2, resultCount: 2, equation: '4 - 2 = 2' }),
      ch({ id: 'd2', type: 'act-out', resultCount: 2, startCount: 1, changeCount: 1, equation: '1 + 1 = 2' }),
    ])} />);

    // Subtraction pre-fills the scene with startCount(4) tappable objects.
    const objs = () => Array.from(document.querySelectorAll('svg g'));
    expect(objs().length).toBe(4);
    // Remove two (tap two objects) → reach result(2) → complete.
    fireEvent.click(objs()[0]);
    expect(screen.queryByText(/next challenge/i)).toBeNull(); // at 3, not done
    fireEvent.click(objs()[0]);
    expect((await screen.findByText(/next challenge/i)) as HTMLElement).toBeTruthy();
  });
});
