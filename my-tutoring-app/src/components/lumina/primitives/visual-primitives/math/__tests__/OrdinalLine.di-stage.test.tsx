// @vitest-environment jsdom
/**
 * OrdinalLine STAGE behaviour under the judged loop.
 *
 * There was no legacy render suite for this primitive, so nothing is being
 * re-based here — this file exists for ONE reason the pure suite structurally
 * cannot cover:
 *
 * ⭐ THE ANSWER LEAK ON THIS PORT IS IN PIXELS, NOT IN STRINGS. `showPositionLabels`
 * printed `getOrdinalLabel(pos, labelFormat)` under EVERY character — literally
 * `3rd (third)` at `labelFormat: 'both'` — and on the Grade 1 direction that
 * label IS the spoken answer, verbatim. Every gate in the DI family scans TEXT
 * the tutor says; not one of them can see a readout on the screen. This is the
 * third port in a row with that defect (ten-frame's running counter,
 * compare-objects' numbered unit boxes, now this), so it gets a render pin
 * rather than a paragraph.
 *
 * And the pin has to be `revealHeld`, not `currentSolved` and not `stage` (18b):
 * the runner opens the NEXT item in the same dispatch as the affirmation, so by
 * render time the current item is unsolved and both obvious gates read false —
 * which is how the same reveal bug painted on the last item and nowhere else, in
 * four math ports, for a month.
 *
 * The runner is mocked at the seam: it has its own suite
 * (`hooks/useJudgedScriptRunner.test.tsx`) and the pack has its own
 * (`OrdinalLine.di-script.test.ts`). What is under test here is the STAGE.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrdinalLineItem } from '../ordinalLineScript';

const runnerState = vi.hoisted(() => ({
  index: 0,
  running: true,
  canAttempt: true,
  /** 18b: is the affirmed item's reveal still on screen? */
  revealHeld: false,
  armStillness: vi.fn(),
  clearStillness: vi.fn(),
  submitGestureAttempt: vi.fn(),
  hearStimulus: vi.fn(),
  options: null as null | {
    pack: { items: OrdinalLineItem[] };
    onAffirmed?: (item: OrdinalLineItem) => void;
  },
}));

vi.mock('../../../../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: (options: typeof runnerState.options) => {
    runnerState.options = options;
    const item = options?.pack.items[runnerState.index] ?? null;
    return {
      running: runnerState.running,
      preparing: false,
      stage: 'asking',
      statusLine: 'status',
      currentIndex: runnerState.index,
      currentItem: item,
      solvedIds: new Set<string>(),
      currentSolved: false,
      canAttempt: runnerState.canAttempt && runnerState.running && item != null,
      summary: null,
      micState: 'armed',
      tutorSpeaking: false,
      cuedItemId: item?.id ?? null,
      revealHeld: runnerState.revealHeld,
      armStillness: runnerState.armStillness,
      clearStillness: runnerState.clearStillness,
      cancelListening: undefined,
      start: vi.fn(),
      hearStimulus: runnerState.hearStimulus,
      stimulusTapped: false,
      submitGestureAttempt: runnerState.submitGestureAttempt,
      isAwaitingGesture: () => false,
      loop: {},
    };
  },
}));

vi.mock('@/contexts/LuminaAIContext', () => ({
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({ isConnected: true, sendText: vi.fn() }),
}));

// The evaluation hook reaches Firebase at import time; the stage is what is
// under test, and its submission path is covered by the runner's own suite.
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

import OrdinalLine, { type OrdinalLineData } from '../OrdinalLine';

const LINE = [
  { name: 'Rabbit', emoji: '🐰' },
  { name: 'Turtle', emoji: '🐢' },
  { name: 'Fox', emoji: '🦊' },
  { name: 'Bear', emoji: '🐻' },
  { name: 'Frog', emoji: '🐸' },
];

/** `labelFormat: 'both'` is the worst case — the label reads "3rd (third)", so
 *  it prints BOTH the symbol a match item asks for and the word a Grade 1
 *  identify item asks for. */
const dataFor = (
  overrides: Partial<OrdinalLineData> = {},
): OrdinalLineData => ({
  title: 'Animal Parade',
  challenges: [
    {
      id: 'c1',
      type: 'identify',
      instruction: '',
      characters: LINE,
      targetPosition: 3,
      correctAnswer: '3',
      // The click-era scaffold flag, ON. The stage must ignore it.
      showPositionLabels: true,
      supportTier: 'easy',
    },
    {
      id: 'c2',
      type: 'build-sequence',
      instruction: '',
      characters: LINE,
      correctAnswer: 'sequence_complete',
      clues: [
        { character: 'Turtle', position: 1 },
        { character: 'Fox', position: 2 },
        { character: 'Rabbit', position: 3 },
      ],
    },
  ],
  maxPosition: 5,
  context: 'race',
  showOrdinalLabels: true,
  labelFormat: 'both',
  gradeBand: '1',
  ...overrides,
});

beforeEach(() => {
  runnerState.index = 0;
  runnerState.running = true;
  runnerState.canAttempt = true;
  runnerState.revealHeld = false;
  runnerState.armStillness.mockClear();
  runnerState.clearStillness.mockClear();
  runnerState.submitGestureAttempt.mockClear();
  runnerState.hearStimulus.mockClear();
});
afterEach(cleanup);

describe('OrdinalLine stage · ⭐ the ordinal label is an ANSWER KEY IN PIXELS', () => {
  it('prints NO ordinal label on the line before the tutor affirms — at any tier', () => {
    render(<OrdinalLine data={dataFor()} />);
    // `showPositionLabels: true` and `supportTier: 'easy'` are both set; the
    // flag no longer scaffolds, because the label IS the answer.
    expect(screen.queryByText('3rd (third)')).toBeNull();
    expect(screen.queryByText('1st (first)')).toBeNull();
    expect(screen.queryByText(/\bthird\b/)).toBeNull();
  });

  it('paints the labels ONLY while the reveal is held', () => {
    const { rerender } = render(<OrdinalLine data={dataFor()} />);
    expect(screen.queryByText('3rd (third)')).toBeNull();

    runnerState.revealHeld = true;
    rerender(<OrdinalLine data={dataFor()} />);
    expect(screen.getByText('3rd (third)')).toBeTruthy();
    expect(screen.getByText('1st (first)')).toBeTruthy();
  });

  it('⭐ the reveal is gated on revealHeld, NOT on currentSolved (18b)', () => {
    // The mocked runner reports `currentSolved: false` THROUGHOUT — which is
    // what the REAL runner reports at render time on the advance path, because
    // it opens the next item in the same dispatch as the affirmation. A stage
    // gated on `currentSolved` (or on `stage`) shows the reveal on the last item
    // and nowhere else, which is how the bug survived four ports for a month.
    //
    // Asserted on the REWARD text specifically, not on /third/: the line labels
    // also carry "third" once the reveal is held, so a loose matcher passes
    // whichever gate the stage uses and pins nothing.
    const { rerender } = render(<OrdinalLine data={dataFor()} />);
    act(() => {
      runnerState.options!.onAffirmed?.(runnerState.options!.pack.items[0]);
    });
    expect(screen.queryByText('Fox — third')).toBeNull();

    runnerState.revealHeld = true;
    rerender(<OrdinalLine data={dataFor()} />);
    expect(screen.getByText('Fox — third')).toBeTruthy();
  });

  it('the reveal is the PAIRING, in both identify directions', () => {
    // At Grade 1 the child SAID "third", so echoing `answerText` would print
    // "third — third". The reveal names who was where, either way round.
    runnerState.revealHeld = true;
    render(<OrdinalLine data={dataFor({ gradeBand: '1' })} />);
    act(() => {
      runnerState.options!.onAffirmed?.(runnerState.options!.pack.items[0]);
    });
    expect(screen.getByText('Fox — third')).toBeTruthy();

    cleanup();
    render(<OrdinalLine data={dataFor({ gradeBand: 'K' })} />);
    act(() => {
      runnerState.options!.onAffirmed?.(runnerState.options!.pack.items[0]);
    });
    expect(screen.getByText('Fox — third')).toBeTruthy();
  });

  it('never renders a printed instruction, a Check control or a Next control', () => {
    render(<OrdinalLine data={dataFor()} />);
    expect(screen.queryByRole('button', { name: /check/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /next/i })).toBeNull();
    // The tutor speaks the ask; a pre-reader cannot read one and a reader would
    // not need to listen.
    expect(screen.queryByText(/Tap the/i)).toBeNull();
  });
});

describe('OrdinalLine stage · the hands turn', () => {
  const buildData = () => dataFor({ challenges: dataFor().challenges.slice(1) });

  it('a placement arms the stillness window — there is no Check button', () => {
    render(<OrdinalLine data={buildData()} />);
    expect(runnerState.armStillness).not.toHaveBeenCalled();

    // Tap a picture to hold it, then tap a place.
    fireEvent.click(screen.getByTitle('Turtle'));
    fireEvent.click(screen.getAllByText('1st (first)')[0]);
    expect(runnerState.armStillness).toHaveBeenCalledTimes(1);
    expect(runnerState.submitGestureAttempt).not.toHaveBeenCalled();
  });

  it('interaction is gated on canAttempt, never on the stage word', () => {
    runnerState.canAttempt = false;
    render(<OrdinalLine data={buildData()} />);
    fireEvent.click(screen.getByTitle('Turtle'));
    fireEvent.click(screen.getAllByText('1st (first)')[0]);
    expect(runnerState.armStillness).not.toHaveBeenCalled();
  });

  it('emptying the line CANCELS the window rather than committing nothing', () => {
    render(<OrdinalLine data={buildData()} />);
    fireEvent.click(screen.getByTitle('Turtle'));
    const firstSlot = screen.getAllByText('1st (first)')[0];
    fireEvent.click(firstSlot);
    expect(runnerState.armStillness).toHaveBeenCalledTimes(1);

    // Tapping a filled place with nothing held takes the picture back out.
    fireEvent.click(firstSlot);
    expect(runnerState.clearStillness).toHaveBeenCalled();
  });
});

describe('OrdinalLine stage · what the child is told', () => {
  it('tap-to-hear re-asks the question and is never withdrawn', () => {
    render(<OrdinalLine data={dataFor()} />);
    fireEvent.click(screen.getByLabelText('Hear the question again'));
    expect(runnerState.hearStimulus).toHaveBeenCalledTimes(1);
  });

  it('the story never prints — it is the tutor\'s voice, not the page', () => {
    render(<OrdinalLine data={dataFor({
      gradeBand: 'K',
      challenges: [{
        id: 's1',
        type: 'sequence-story',
        instruction: '',
        characters: LINE,
        correctAnswer: 'sequence_complete',
        storyText: 'The Fox is first and the Bear is second and the Rabbit is third.',
        clues: LINE.map((c, i) => ({ character: c.name, position: i + 1 })),
      }],
    })} />);
    expect(screen.queryByText(/The Fox is first/)).toBeNull();
  });

  it('adult chrome is hidden for pre-readers', () => {
    // The context badge splits its emoji and its label across text nodes, so
    // this matches on the rendered element rather than on one node.
    const hasContextBadge = () =>
      screen.queryAllByText((_, el) => el?.textContent?.trim() === '🏁 race').length > 0;

    render(<OrdinalLine data={dataFor({ gradeBand: 'K' })} />);
    expect(hasContextBadge()).toBe(false);
    // The character NAMES are adult chrome too — a pre-reader reads the picture.
    expect(screen.queryByText('Rabbit')).toBeNull();

    cleanup();
    render(<OrdinalLine data={dataFor({ gradeBand: '1' })} />);
    expect(hasContextBadge()).toBe(true);
    expect(screen.getAllByText('Rabbit').length).toBeGreaterThan(0);
  });
});
