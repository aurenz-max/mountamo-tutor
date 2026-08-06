// @vitest-environment jsdom
/**
 * BaseTenBlocks — the answer channel per challenge type (BT-4), driven.
 *
 * WHY A COMPONENT TEST: before this slice every mode answered through a number
 * keypad, including `build_number` — whose target is NAMED in its own instruction
 * ("Build the number 12") and echoed by the "Blocks Total" panel. A student could
 * type 12 without ever touching a block, and a student who piled up 12 unit cubes
 * was marked correct without ever showing the ten. Both are runtime behaviors that
 * `tsc` and the generator suite are blind to (CLAUDE.md verification doctrine), so
 * the judgement is exercised here against the real component.
 *
 * The rule under test: the blocks are the answer when the value is already on
 * screen (build_number, regroup); the keypad survives only where the student must
 * read (read_blocks) or compute (add/subtract) a number the screen does not state.
 */
import React from 'react';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BaseTenBlocks, { type BaseTenBlocksChallenge, type BaseTenBlocksData } from './BaseTenBlocks';

// The tutor socket, auth and the sound engine are not what is under test here.
vi.mock('@/lib/firebase', () => ({
  auth: { currentUser: null, onAuthStateChanged: () => () => {} },
  db: {},
  app: {},
}));
vi.mock('../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false }),
}));
// jsdom has no canvas, and the completion panel's confetti runs on rAF past teardown.
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: {
    playCorrect: vi.fn(), playIncorrect: vi.fn(), tick: vi.fn(), snap: vi.fn(),
    tap: vi.fn(), select: vi.fn(),
    // The completion panel reads these (a one-challenge deck finishes as soon as
    // the answer is right, and its celebration fires on a post-teardown timer).
    isEnabled: () => false, getVolume: () => 0, celebrate: vi.fn(), play: vi.fn(),
    playPerfect: vi.fn(), playStreak: vi.fn(),
  },
}));

afterEach(cleanup);

const deck = (challenge: BaseTenBlocksChallenge, over: Partial<BaseTenBlocksData> = {}): BaseTenBlocksData => ({
  title: 'Exploring Teen Numbers with Blocks',
  description: 'Teen numbers are one ten and some extra ones.',
  numberValue: challenge.targetNumber,
  interactionMode: 'build',
  maxPlace: 'tens',
  gradeBand: 'K-1',
  challenges: [challenge],
  ...over,
});

const BUILD_12: BaseTenBlocksChallenge = {
  type: 'build_number',
  instruction: 'Build the number 12 with blocks.',
  targetNumber: 12,
  hint: '12 is one ten and two ones.',
};

/** Column order is hundreds, tens, ones — ones is the last +/- pair. */
const plus = (place: 'hundreds' | 'tens' | 'ones') =>
  screen.getAllByRole('button', { name: '+' })[{ hundreds: 0, tens: 1, ones: 2 }[place]];

describe('build_number — judged from the blocks, not a keypad', () => {
  it('shows a Check My Blocks button and NO number keypad', () => {
    render(<BaseTenBlocks data={deck(BUILD_12)} />);
    expect(screen.getByRole('button', { name: /check my blocks/i })).toBeTruthy();
    // The keypad's digits and its clear key are gone.
    expect(screen.queryByRole('button', { name: '7' })).toBeNull();
    expect(screen.queryByText(/your answer/i)).toBeNull();
  });

  it('marks an empty / short build wrong instead of accepting a typed 12', () => {
    render(<BaseTenBlocks data={deck(BUILD_12)} />);
    fireEvent.click(screen.getByRole('button', { name: /check my blocks/i }));
    expect(screen.getByText(/you need 12/i)).toBeTruthy();
    expect(screen.queryByText(/^Yes! 12 is/)).toBeNull();
  });

  it('rejects 12 unit cubes as NOT standard form and names the trade', () => {
    render(<BaseTenBlocks data={deck(BUILD_12)} />);
    for (let i = 0; i < 12; i++) fireEvent.click(plus('ones'));
    // The value is right — the old keypad flow would have accepted this.
    // ('12' shows twice: the ones-column count and the Blocks Total panel.)
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /check my blocks/i }));
    expect(screen.getByText(/not with the fewest blocks/i)).toBeTruthy();
    expect(screen.getByText(/trade 10 ones for 1 ten/i)).toBeTruthy();
  });

  it('accepts 1 ten + 2 ones, including via the trade button', async () => {
    render(<BaseTenBlocks data={deck(BUILD_12)} />);
    for (let i = 0; i < 12; i++) fireEvent.click(plus('ones'));
    fireEvent.click(screen.getByRole('button', { name: /10 → 1 Tens/i }));
    // The regroup animation resolves on a 400ms timer.
    await waitFor(() => expect(screen.getByText(/10 ones = 1 ten/i)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /check my blocks/i }));
    expect(screen.getByText(/Yes! 12 is 1 ten and 2 ones\./i)).toBeTruthy();
  });

  it('accepts a direct 1 ten + 2 ones build', () => {
    render(<BaseTenBlocks data={deck(BUILD_12)} />);
    fireEvent.click(plus('tens'));
    fireEvent.click(plus('ones'));
    fireEvent.click(plus('ones'));
    fireEvent.click(screen.getByRole('button', { name: /check my blocks/i }));
    expect(screen.getByText(/Yes! 12 is 1 ten and 2 ones\./i)).toBeTruthy();
  });

  it('withholds the running total in the wrong-answer feedback at the hard tier', () => {
    render(<BaseTenBlocks data={deck({ ...BUILD_12, showColumnCounts: false, showBlocksTotal: false })} />);
    fireEvent.click(plus('ones'));
    fireEvent.click(screen.getByRole('button', { name: /check my blocks/i }));
    expect(screen.getByText(/count each column again/i)).toBeTruthy();
    expect(screen.queryByText(/your blocks make/i)).toBeNull();
  });
});

describe('regroup — judged from the trade', () => {
  const REGROUP_25: BaseTenBlocksChallenge = {
    type: 'regroup',
    instruction: 'You have 2 tens and 5 ones. Trade 1 ten for 10 ones.',
    targetNumber: 25,
    hint: '1 ten = 10 ones.',
  };

  it('asks the student to trade, not to type the number already on screen', () => {
    render(<BaseTenBlocks data={deck(REGROUP_25, { interactionMode: 'regroup' })} />);
    expect(screen.getByRole('button', { name: /check my trade/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '7' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /check my trade/i }));
    expect(screen.getByText(/no trade yet/i)).toBeTruthy();
  });

  it('accepts a value-preserving trade', async () => {
    render(<BaseTenBlocks data={deck(REGROUP_25, { interactionMode: 'regroup' })} />);
    fireEvent.click(screen.getByRole('button', { name: /1 → 10 Ones/i }));
    await waitFor(() => expect(screen.getByText(/1 ten = 10 ones/i)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /check my trade/i }));
    expect(screen.getByText(/they still make 25/i)).toBeTruthy();
  });
});

describe('read_blocks — the keypad is the only channel and stays', () => {
  const READ_23: BaseTenBlocksChallenge = {
    type: 'read_blocks',
    instruction: 'What number is shown by these blocks?',
    targetNumber: 23,
    hint: 'Count each column.',
  };

  it('keeps the keypad and offers no Check My Blocks button', () => {
    render(<BaseTenBlocks data={deck(READ_23, { interactionMode: 'decompose' })} />);
    expect(screen.getByRole('button', { name: '7' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /check my blocks/i })).toBeNull();
  });

  it('never states the target in the wrong-answer feedback', () => {
    render(<BaseTenBlocks data={deck(READ_23, { interactionMode: 'decompose' })} />);
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '✓' }));
    expect(screen.getByText(/41 isn't it/i)).toBeTruthy();
    expect(screen.queryByText(/the answer is 23/i)).toBeNull();
  });
});
