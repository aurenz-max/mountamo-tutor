// @vitest-environment jsdom
/**
 * SyllableClapper STAGE behaviour under the judged loop. This file REPLACES
 * `SyllableClapper.support-tiers.test.tsx`; every intent that suite pinned is
 * still pinned, re-based rather than dropped:
 *
 *  1. Lever #1 pinned that the hard tier withdraws the 6-circle clap tally and
 *     the `Check (3 claps)` echo, "so the running count lives in working
 *     memory". ⭐ RE-BASED AND STRENGTHENED TO A UNIVERSAL: the tally and the
 *     echo are GONE at every tier, because they printed the answer the child is
 *     about to say. What this file pins is that NOTHING on screen equals the
 *     count before the tutor has affirmed — the pixel half of the leak rule,
 *     which no string gate can see.
 *  2. Lever #2 pinned a directional miss hint ("too many claps") at the
 *     supported tiers and a neutral one at hard. Both are gone with the Check
 *     button that produced them: a direction turns a 1-to-4 answer space into a
 *     binary search. The miss is now the tutor's scripted correction, pinned in
 *     `SyllableClapper.di-script.test.ts`.
 *  3. The tutor ladder assertions ([SUPPORT_TIER] policy lines, the segmented
 *     re-say, the post-correct replay) move wholesale to the pure suite, where
 *     the tier now reaches the ASK. Its "the spoken word stimulus is never
 *     withdrawn at any tier" clause is pinned there AND here (the tap-to-hear
 *     button renders at every tier).
 *  4. The NAME-COLLISION regression survives, because it is the reason half
 *     that file existed: `challengeType` names the WORD-LENGTH band and must
 *     never withdraw a scaffold; the tier must never re-band the content.
 *
 *  Plus the one this port introduces: 18b's reveal hold. A payload set in
 *  `onAffirmed` and cleared in `onItemOpened` paints on the LAST item and
 *  nowhere else — the runner fires both in ONE dispatch — which is exactly how
 *  the bug stayed invisible in four math ports for a month.
 *
 * The runner is mocked at the seam: it has its own suite
 * (`hooks/useJudgedScriptRunner.test.tsx`) and the pack has its own
 * (`SyllableClapper.di-script.test.ts`). What is under test here is the STAGE.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyllableClapperItem } from '../syllableClapperScript';

const runnerState = vi.hoisted(() => ({
  index: 0,
  running: true,
  solved: new Set<string>(),
  /** 18b: is the affirmed item's reveal still on screen? */
  revealHeld: false,
  hearStimulus: vi.fn(),
  options: null as null | {
    pack: { items: SyllableClapperItem[] };
    onItemOpened?: (item: SyllableClapperItem, index: number) => void;
    onAffirmed?: (item: SyllableClapperItem) => void;
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
      solvedIds: runnerState.solved,
      currentSolved: item != null && runnerState.solved.has(item.id),
      canAttempt: runnerState.running && item != null,
      summary: null,
      micState: 'armed',
      tutorSpeaking: false,
      cuedItemId: item?.id ?? null,
      revealHeld: runnerState.revealHeld,
      armStillness: vi.fn(),
      clearStillness: vi.fn(),
      cancelListening: undefined,
      start: vi.fn(),
      hearStimulus: runnerState.hearStimulus,
      stimulusTapped: false,
      submitGestureAttempt: vi.fn(),
      isAwaitingGesture: () => false,
      loop: {},
    };
  },
}));

const sendText = vi.hoisted(() => vi.fn());

// JudgedMicPanel subscribes to the live mic level (19b); the component itself
// sends the per-part tap-to-hear cue through the context.
vi.mock('@/contexts/LuminaAIContext', () => ({
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({ isConnected: true, sendText }),
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

import SyllableClapper, { type SyllableClapperData } from '../SyllableClapper';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type Challenge = SyllableClapperData['challenges'][number];

const challenge = (over: Partial<Challenge> = {}): Challenge => ({
  id: 'c1',
  word: 'butterfly',
  syllableCount: 3,
  syllables: ['but', 'ter', 'fly'],
  imageDescription: 'a colorful butterfly',
  difficulty: 4,
  challengeType: 'medium',
  ...over,
});

const data = (
  challenges: Challenge[],
  supportTier?: 'easy' | 'medium' | 'hard',
): SyllableClapperData => ({
  title: 'Clap It Out: Animals!',
  ...(supportTier ? { supportTier } : {}),
  challenges,
});

const TWO_ITEMS = [
  challenge(),
  challenge({ id: 'c2', word: 'tiger', syllableCount: 2, syllables: ['ti', 'ger'], challengeType: 'easy' }),
];

/** The runner calls this the moment an item is on screen. */
const openItem = (index: number) => {
  runnerState.index = index;
  const item = runnerState.options!.pack.items[index];
  act(() => runnerState.options!.onItemOpened?.(item, index));
  return item;
};

/**
 * The affirm path EXACTLY as the runner runs it: `onAffirmed` fires, the reveal
 * hold opens, and the next item is opened IN THE SAME DISPATCH. A stage that
 * clears its payload in `onItemOpened` shows nothing after this.
 */
const affirmAndAdvance = (index: number) => {
  const item = runnerState.options!.pack.items[index];
  act(() => {
    runnerState.options!.onAffirmed?.(item);
    runnerState.revealHeld = true;
    const next = runnerState.options!.pack.items[index + 1];
    if (next) {
      runnerState.index = index + 1;
      runnerState.options!.onItemOpened?.(next, index + 1);
    }
  });
  return item;
};

const reveal = () => screen.queryByTestId('reveal');
const bodyText = () => document.body.textContent ?? '';

beforeEach(() => {
  runnerState.index = 0;
  runnerState.running = true;
  runnerState.revealHeld = false;
  runnerState.solved = new Set();
  runnerState.options = null;
  runnerState.hearStimulus.mockClear();
  sendText.mockClear();
});

afterEach(cleanup);

// ---------------------------------------------------------------------------
// 1. ⭐ The pixel leak — nothing on screen may equal what the child will say
// ---------------------------------------------------------------------------

describe('SyllableClapper stage · answer-leak in PIXELS', () => {
  it('the WORD is never printed before the affirmation — a reader would chunk it by sight', () => {
    render(<SyllableClapper data={data(TWO_ITEMS)} />);
    expect(bodyText()).not.toContain('butterfly');
    expect(bodyText()).not.toContain('a colorful butterfly');
  });

  it('the syllable BAR is never on screen before the affirmation — three boxes IS three', () => {
    render(<SyllableClapper data={data(TWO_ITEMS)} />);
    expect(reveal()).toBeNull();
    for (const part of ['but', 'ter', 'fly']) {
      expect(screen.queryByText(part)).toBeNull();
    }
  });

  it('no number and no running tally appears anywhere on the pre-answer stage', () => {
    // The click era's 6-circle tally and its `Check (3 claps)` echo are gone at
    // EVERY tier, not withdrawn at one — they printed the count the child is
    // about to say out loud.
    render(<SyllableClapper data={data(TWO_ITEMS)} />);
    expect(bodyText()).not.toMatch(/\b(one|two|three|four|five)\b/i);
    expect(bodyText()).not.toMatch(/\d\s*claps?/i);
    expect(screen.queryByTestId('clap-tally')).toBeNull();
  });

  it('no clap, check, undo or next control survives — the DI census, in the DOM', () => {
    render(<SyllableClapper data={data(TWO_ITEMS)} />);
    for (const label of [/clap!/i, /^check/i, /undo/i, /next word/i, /finish/i, /start clapping/i]) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. ⭐ 18b — the reveal HOLDS across the same-dispatch advance
// ---------------------------------------------------------------------------

describe('SyllableClapper stage · the reveal hold (18b)', () => {
  it('paints the affirmed item even though the NEXT item opened in the same dispatch', () => {
    // THE BUG THIS BITES: a payload cleared in `onItemOpened` paints on the last
    // item and nowhere else, because the runner fires `onAffirmed` and
    // `onItemOpened` in ONE dispatch. It survived four math ports for a month
    // with no test and no drive catching it — everything looked right on the
    // item people actually watched.
    render(<SyllableClapper data={data(TWO_ITEMS)} />);
    openItem(0);
    affirmAndAdvance(0);

    const panel = reveal();
    expect(panel).not.toBeNull();
    expect(panel!.textContent).toContain('butterfly');
    expect(panel!.textContent).toContain('three parts');
    for (const part of ['but', 'ter', 'fly']) {
      expect(panel!.textContent).toContain(part);
    }
    // ...and it is the AFFIRMED item's word, not the one now on screen.
    expect(panel!.textContent).not.toContain('tiger');
  });

  it('closes when her cue for the next item is SENT — revealHeld is the only gate', () => {
    render(<SyllableClapper data={data(TWO_ITEMS)} />);
    openItem(0);
    affirmAndAdvance(0);
    expect(reveal()).not.toBeNull();

    act(() => { runnerState.revealHeld = false; });
    render(<SyllableClapper data={data(TWO_ITEMS)} />, { container: document.body.firstChild as HTMLElement });
    expect(bodyText()).not.toContain('butterfly');
  });

  it('a part of the revealed bar can be tapped to hear it — post-affirm only', () => {
    render(<SyllableClapper data={data(TWO_ITEMS)} />);
    openItem(0);
    affirmAndAdvance(0);
    fireEvent.click(screen.getByText('ter'));
    expect(sendText).toHaveBeenCalledTimes(1);
    const cue = String(sendText.mock.calls[0][0]);
    expect(cue).toContain('[SC_HEAR]');
    expect(cue).toContain('"ter"');
    // Never the whole word, and never the count.
    expect(cue).toContain('do not say the whole word');
    expect(sendText.mock.calls[0][1]).toEqual({ silent: true, scripted: true });
  });

  it('a one-part word reveals with the singular unit', () => {
    render(<SyllableClapper data={data([challenge({ id: 'c1', word: 'cat', syllableCount: 1, syllables: ['cat'], challengeType: 'easy' })])} />);
    openItem(0);
    affirmAndAdvance(0);
    expect(reveal()!.textContent).toContain('one part');
    expect(reveal()!.textContent).not.toContain('one parts');
  });
});

// ---------------------------------------------------------------------------
// 3. The stimulus channel is never withdrawn (re-based from the legacy suite)
// ---------------------------------------------------------------------------

describe('SyllableClapper stage · the stimulus channel', () => {
  it.each(['easy', 'medium', 'hard'] as const)(
    'tap-to-hear renders and fires at the %s support tier — this is a listening task',
    (tier) => {
      render(<SyllableClapper data={data(TWO_ITEMS, tier)} />);
      const button = screen.getByTestId('hear-word');
      expect(button).toBeTruthy();
      fireEvent.click(button);
      expect(runnerState.hearStimulus).toHaveBeenCalled();
    },
  );

  it('the prompt invites the hands, and drops the invitation when the tier withdraws it', () => {
    render(<SyllableClapper data={data([challenge({ inviteClap: true })])} />);
    expect(bodyText()).toContain('Clap the parts');
    cleanup();
    render(<SyllableClapper data={data([challenge({ inviteClap: false })])} />);
    expect(bodyText()).not.toContain('Clap the parts');
    // Withdrawing the motor scaffold never withdraws the ask.
    expect(bodyText()).toContain('How many parts do you hear?');
  });
});

// ---------------------------------------------------------------------------
// 4. NAME-COLLISION regression — challengeType (word length) ⟂ supportTier
// ---------------------------------------------------------------------------

describe('SyllableClapper stage · challengeType/supportTier orthogonality', () => {
  it('challengeType "hard" alone withdraws NOTHING — word length is not a support level', () => {
    render(<SyllableClapper data={data([challenge({ challengeType: 'hard' })])} />);
    expect(screen.getByTestId('hear-word')).toBeTruthy();
    expect(bodyText()).toContain('Clap the parts');
    expect(bodyText()).toContain('Long Words');
  });

  it('challengeType "easy" + a hard-tier stamp still withdraws — the tier alone drives the ask', () => {
    render(<SyllableClapper data={data(
      [challenge({ challengeType: 'easy', inviteClap: false, echoWordSlowly: false })],
      'hard',
    )} />);
    expect(bodyText()).not.toContain('Clap the parts');
    // ...and the BAND badge still reads off challengeType, untouched by the tier.
    expect(bodyText()).toContain('Short Words');
  });

  it('the tier never changes the CONTENT the component was handed', () => {
    const payload = data([challenge({ inviteClap: false, echoWordSlowly: false })], 'hard');
    render(<SyllableClapper data={payload} />);
    openItem(0);
    affirmAndAdvance(0);
    expect(reveal()!.textContent).toContain('three parts');
    expect(payload.challenges[0].syllableCount).toBe(3);
    expect(payload.challenges[0].syllables).toEqual(['but', 'ter', 'fly']);
    expect(payload.challenges[0].challengeType).toBe('medium');
  });
});

// ---------------------------------------------------------------------------
// 5. Build gates reach the stage
// ---------------------------------------------------------------------------

describe('SyllableClapper stage · unaskable challenges never render', () => {
  it('an unaskable challenge is dropped, and the askable ones still run', () => {
    render(<SyllableClapper data={data([
      challenge({ id: 'variable', word: 'squirrel', syllableCount: 2, syllables: ['squir', 'rel'] }),
      challenge({ id: 'ok', word: 'tiger', syllableCount: 2, syllables: ['ti', 'ger'] }),
    ])} />);
    expect(runnerState.options!.pack.items.map((i) => i.id)).toEqual(['ok']);
  });

  it('a payload where EVERYTHING drops renders the empty state, never a placeholder item', () => {
    render(<SyllableClapper data={data([
      challenge({ id: 'x', word: 'squirrel', syllableCount: 2, syllables: ['squir', 'rel'] }),
      challenge({ id: 'y', word: 'apple', syllableCount: 2, syllables: ['ap', 'pel'] }),
    ])} />);
    expect(screen.getByText('No challenges available.')).toBeTruthy();
  });
});
