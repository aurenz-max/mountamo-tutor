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
// The judged-loop stage needs the live tutor context and has its own suite
// (`BaseTenBlocksDi.di-stage.test.tsx`). Here it is a routing marker.
vi.mock('./BaseTenBlocksDi', () => ({
  default: () => <div data-testid="di-stage" />,
}));
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

/**
 * `regroup` and `read_blocks` LEFT THIS SURFACE on 2026-09-12 (qa/di/BACKLOG.md
 * item 18): both are judged-loop modes now and render `BaseTenBlocksDi`, so the
 * two describes that used to sit here — the trade's Check button and the
 * read keypad — were describing a UI those modes no longer have.
 *
 * NOTHING THEY PINNED WAS DROPPED. Each intent was re-based onto the surface it
 * still applies to:
 *
 *  · "asks the student to trade, not to type the number already on screen" and
 *    "accepts a value-preserving trade" → `BaseTenBlocksDi.di-stage.test.tsx`,
 *    strengthened: the Check button is gone too, so a wrong trade commits on
 *    stillness as a real wrong answer rather than waiting to be submitted.
 *  · "never states the target in the wrong-answer feedback" → the
 *    `add_with_blocks` describe below, which is where Channel B (the keypad for
 *    a number the screen does not state) still lives, AND widened to a pixel
 *    rule on the DI stage, where the column count is itself an answer.
 *
 * What belongs HERE is the routing: which modes leave, which stay, and what a
 * mixed deck does. The DI stage is stubbed for those cases — its behaviour is
 * its own suite's job, and mounting it needs the live tutor context.
 */
describe('the staged port — which modes still answer on this surface', () => {
  const REGROUP_25: BaseTenBlocksChallenge = {
    type: 'regroup',
    instruction: 'You have 2 tens and 5 ones. Trade 1 ten for 10 ones.',
    targetNumber: 25,
    hint: '1 ten = 10 ones.',
  };
  const READ_23: BaseTenBlocksChallenge = {
    type: 'read_blocks',
    instruction: 'What number is shown by these blocks?',
    targetNumber: 23,
    hint: 'Count each column.',
  };

  it.each([
    ['regroup', REGROUP_25],
    ['read_blocks', READ_23],
  ])('a judged %s deck leaves this component entirely', (_type, challenge) => {
    render(<BaseTenBlocks data={deck(challenge, { interactionMode: 'regroup' })} />);
    expect(screen.getByTestId('di-stage')).toBeTruthy();
    // Neither channel of the click era survives for these modes.
    expect(screen.queryByRole('button', { name: /check my (blocks|trade)/i })).toBeNull();
    expect(screen.queryByRole('button', { name: '7' })).toBeNull();
  });

  it('a MIXED deck keeps the whole deck on clicks — the transport cannot split mid-session', () => {
    // The homogeneity rule the catalog's `audioInputByMode` resolver applies:
    // the backend is told one transport for the payload, so one judged
    // challenge beside a click one falls back for all of them.
    render(<BaseTenBlocks data={{ ...deck(BUILD_12), challenges: [READ_23, BUILD_12] }} />);
    expect(screen.queryByTestId('di-stage')).toBeNull();
    // read_blocks is back on the click era's Channel B — the keypad.
    expect(screen.getByRole('button', { name: '7' })).toBeTruthy();
  });

  it('a judged deck whose numbers ALL fail the build gate falls back rather than asking nothing', () => {
    // 40 has no ones cube to receive the traded ten, so the prediction would
    // state its own answer. The DI pack drops it; the click surface still works.
    render(<BaseTenBlocks data={deck({ ...REGROUP_25, targetNumber: 40 }, { interactionMode: 'regroup' })} />);
    expect(screen.queryByTestId('di-stage')).toBeNull();
    expect(screen.getByRole('button', { name: /check my trade/i })).toBeTruthy();
  });
});

describe('add_with_blocks — the keypad survives where the number is NOT on screen', () => {
  const ADD_23: BaseTenBlocksChallenge = {
    type: 'add_with_blocks',
    instruction: 'Add 14 and 9 with the blocks, then type the total.',
    targetNumber: 23,
    secondNumber: 9,
    hint: 'Build 14, add 9 more, then trade.',
  };

  it('keeps the keypad and offers no Check My Blocks button', () => {
    render(<BaseTenBlocks data={deck(ADD_23, { interactionMode: 'operate' })} />);
    expect(screen.getByRole('button', { name: '7' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /check my blocks/i })).toBeNull();
  });

  it('never states the target in the wrong-answer feedback', () => {
    // Unlike build_number, the answer is NOT on screen here — naming it in the
    // miss hands over the next attempt.
    render(<BaseTenBlocks data={deck(ADD_23, { interactionMode: 'operate' })} />);
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '✓' }));
    expect(screen.getByText(/41 isn't it/i)).toBeTruthy();
    expect(screen.queryByText(/the answer is 23/i)).toBeNull();
  });
});
