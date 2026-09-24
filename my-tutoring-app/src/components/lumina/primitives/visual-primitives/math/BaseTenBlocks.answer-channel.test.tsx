// @vitest-environment jsdom
/**
 * BaseTenBlocks — the answer channel per challenge type (BT-4), driven on the teaching workspace,
 * the primitive's only teaching path.
 *
 * WHY A COMPONENT TEST: every mode once answered through a number keypad, including
 * `build_number` — whose target is NAMED in its own instruction ("Build the number 12") and
 * echoed by the "Blocks Total" panel. A student could type 12 without ever touching a block, and
 * a student who piled up 12 unit cubes was marked correct without ever showing the ten. Both are
 * runtime behaviors that `tsc` and the generator suite are blind to, so the judgement is exercised
 * here against the real component.
 *
 * The rule under test: the blocks are the answer when the value is already on screen
 * (build_number, and regroup on a mixed deck); the keypad survives only where the student must
 * read or compute a number the screen does not state. Homogeneous read_blocks and regroup decks
 * route to the spoken mat, whose behaviour is pinned in `BaseTenBlocks.workspace.test.tsx`.
 */
import React from 'react';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';

vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: null,
  conversation: [], sendText: vi.fn(), sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: vi.fn(), submittedResult: null, elapsedMs: 0 }) }));
// jsdom has no canvas, and the completion panel's confetti runs on rAF past teardown.
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
import BaseTenBlocks, { type BaseTenBlocksChallenge, type BaseTenBlocksData } from './BaseTenBlocks';

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

/** Mounted as a lesson binds it: inside a live runtime, pinned to the section's mode. */
function renderBound(data: BaseTenBlocksData, pin: string) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  return render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <BaseTenBlocks data={data} runtimePlanItemId="plan-blocks" runtimeEvalMode={pin} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
}

const BUILD_12: BaseTenBlocksChallenge = {
  type: 'build_number',
  instruction: 'Build the number 12 with blocks.',
  targetNumber: 12,
  hint: '12 is one ten and two ones.',
};

/** Each column's + button is named for its column ("Add one to Tens"). */
const plus = (place: 'hundreds' | 'tens' | 'ones') =>
  screen.getByRole('button', { name: `Add one to ${place[0].toUpperCase()}${place.slice(1)}` });

describe('build_number — judged from the blocks, not a keypad', () => {
  it('shows a Check My Blocks button and NO number keypad', () => {
    renderBound(deck(BUILD_12), 'build_number');
    expect(screen.getByRole('button', { name: /check my blocks/i })).toBeTruthy();
    // The keypad's digits and its clear key are gone.
    expect(screen.queryByRole('button', { name: '7' })).toBeNull();
    expect(screen.queryByText(/your answer/i)).toBeNull();
  });

  it('marks an empty / short build wrong instead of accepting a typed 12', () => {
    renderBound(deck(BUILD_12), 'build_number');
    fireEvent.click(screen.getByRole('button', { name: /check my blocks/i }));
    expect(screen.getByText(/you need 12/i)).toBeTruthy();
    expect(screen.queryByText(/^Yes! 12 is/)).toBeNull();
  });

  it('rejects 12 unit cubes as NOT standard form and names the trade', () => {
    renderBound(deck(BUILD_12), 'build_number');
    for (let i = 0; i < 12; i++) fireEvent.click(plus('ones'));
    // The value is right — the old keypad flow would have accepted this.
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /check my blocks/i }));
    expect(screen.getByText(/not with the fewest blocks/i)).toBeTruthy();
    expect(screen.getByText(/trade 10 ones for 1 ten/i)).toBeTruthy();
  });

  it('accepts 1 ten + 2 ones, including via the trade button', async () => {
    renderBound(deck(BUILD_12), 'build_number');
    for (let i = 0; i < 12; i++) fireEvent.click(plus('ones'));
    fireEvent.click(screen.getByRole('button', { name: /10 → 1 Tens/i }));
    // The regroup animation resolves on a 400ms timer.
    await waitFor(() => expect(screen.getByText(/10 ones = 1 ten/i)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /check my blocks/i }));
    expect(screen.getByText(/Yes! 12 is 1 ten and 2 ones\./i)).toBeTruthy();
  });

  it('accepts a direct 1 ten + 2 ones build', () => {
    renderBound(deck(BUILD_12), 'build_number');
    fireEvent.click(plus('tens'));
    fireEvent.click(plus('ones'));
    fireEvent.click(plus('ones'));
    fireEvent.click(screen.getByRole('button', { name: /check my blocks/i }));
    expect(screen.getByText(/Yes! 12 is 1 ten and 2 ones\./i)).toBeTruthy();
  });

  it('withholds the running total in the wrong-answer feedback at the hard tier', () => {
    renderBound(deck({ ...BUILD_12, showColumnCounts: false, showBlocksTotal: false }), 'build_number');
    fireEvent.click(plus('ones'));
    fireEvent.click(screen.getByRole('button', { name: /check my blocks/i }));
    expect(screen.getByText(/count each column again/i)).toBeTruthy();
    expect(screen.queryByText(/your blocks make/i)).toBeNull();
  });
});

/** Which surface a payload routes to: the spoken mat for a homogeneous askable read/regroup deck. */
describe('the payload routes to one surface', () => {
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
  const mat = () => document.querySelector('[data-base-ten-mat]')?.getAttribute('data-base-ten-mat');

  it.each([
    ['regroup', REGROUP_25],
    ['read_blocks', READ_23],
  ] as const)('a homogeneous %s deck renders the spoken mat', (type, challenge) => {
    renderBound(deck(challenge, { interactionMode: 'regroup' }), type);
    expect(mat()).toBe('judged');
    // Neither channel of the click mat survives for these modes.
    expect(screen.queryByRole('button', { name: /check my (blocks|trade)/i })).toBeNull();
    expect(screen.queryByRole('button', { name: '7' })).toBeNull();
  });

  it('a MIXED deck keeps the whole deck on the click mat — the transport cannot split mid-session', () => {
    // The homogeneity rule the catalog's `audioInputByMode` resolver applies.
    renderBound({ ...deck(BUILD_12), challenges: [READ_23, BUILD_12] }, 'mixed');
    expect(mat()).toBe('click');
    // read_blocks answers on the click mat's keypad.
    expect(screen.getByRole('button', { name: '7' })).toBeTruthy();
  });

  it('a regroup deck whose numbers ALL fail the build gate falls back to the click mat rather than asking nothing', () => {
    // 40 has no ones cube to receive the traded ten, so the prediction would state its own answer.
    renderBound(deck({ ...REGROUP_25, targetNumber: 40 }, { interactionMode: 'regroup' }), 'regroup');
    expect(mat()).toBe('click');
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
    renderBound(deck(ADD_23, { interactionMode: 'operate' }), 'operate');
    expect(screen.getByRole('button', { name: '7' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /check my blocks/i })).toBeNull();
  });

  it('never states the target in the wrong-answer feedback', () => {
    // Unlike build_number, the answer is NOT on screen here — naming it in the
    // miss hands over the next attempt.
    renderBound(deck(ADD_23, { interactionMode: 'operate' }), 'operate');
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '✓' }));
    expect(screen.getByText(/41 isn't it/i)).toBeTruthy();
    expect(screen.queryByText(/the answer is 23/i)).toBeNull();
  });
});
