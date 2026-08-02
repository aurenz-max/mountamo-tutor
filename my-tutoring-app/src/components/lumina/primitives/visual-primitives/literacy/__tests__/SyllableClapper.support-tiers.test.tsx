// @vitest-environment jsdom
/**
 * Support-tier (axis 3 — scaffolding withdrawal) behavior for syllable-clapper.
 *
 * Levers under test:
 *   #1 showClapCounter      — the 6-circle clap tally AND the count echo in the
 *                             Check label. hard withdraws BOTH.
 *   #2 directionalErrorHint — "too many"/"not enough" vs. a neutral miss.
 *   tutor ladder            — easy keeps the pre-segmented re-say on a miss AND
 *                             the [PRONOUNCE_SYLLABLES] replay after a correct
 *                             answer; medium keeps the segmented re-say only;
 *                             hard drops both and says the word whole.
 *
 * ⚠ NAME-COLLISION REGRESSION (the reason half this file exists): this
 * primitive's eval modes / `challengeType` values are LITERALLY
 * 'easy' | 'medium' | 'hard' and mean WORD LENGTH. The support tier is a
 * separate field. `challengeType: 'hard'` must never withdraw a scaffold, and
 * `supportTier: 'hard'` must never re-band the words.
 *
 * External hooks (live tutor, evaluation, audio) are mocked.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendText, submitResult, playCorrect, playIncorrect, luminaAiCalls } = vi.hoisted(() => ({
  sendText: vi.fn(),
  submitResult: vi.fn(),
  playCorrect: vi.fn(),
  playIncorrect: vi.fn(),
  luminaAiCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: (args: Record<string, unknown>) => {
    luminaAiCalls.push(args);
    return { sendText, isConnected: true };
  },
}));

vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult, hasSubmitted: false }),
  useEvaluationContext: () => null,
}));

vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({ playCorrect, playIncorrect }, {
    get: (target, key) => (key in target ? target[key as keyof typeof target] : vi.fn()),
  }),
}));

import SyllableClapper, { type SyllableClapperData } from '../SyllableClapper';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type TierFields = {
  showClapCounter?: boolean;
  directionalErrorHint?: boolean;
};

/**
 * `challengeType` is deliberately pinned to 'medium' (the WORD-LENGTH band) in
 * every fixture so any tier effect observed cannot be coming from it.
 */
const makeData = (
  opts: {
    supportTier?: 'easy' | 'medium' | 'hard';
    tierFields?: TierFields;
    challengeType?: 'easy' | 'medium' | 'hard';
  } = {},
): SyllableClapperData => ({
  title: 'Clap It Out: Animals!',
  ...(opts.supportTier ? { supportTier: opts.supportTier } : {}),
  challenges: [
    {
      id: 'c1',
      word: 'butterfly',
      syllableCount: 3,
      syllables: ['but', 'ter', 'fly'],
      imageDescription: 'a colorful butterfly',
      difficulty: 4,
      challengeType: opts.challengeType ?? 'medium',
      ...(opts.tierFields ?? {}),
    },
    {
      id: 'c2',
      word: 'tiger',
      syllableCount: 2,
      syllables: ['ti', 'ger'],
      imageDescription: 'a striped orange tiger',
      difficulty: 4,
      challengeType: opts.challengeType ?? 'medium',
      ...(opts.tierFields ?? {}),
    },
  ],
});

/** What the generator actually stamps for a given tier. */
const STAMPS = {
  easy: { showClapCounter: true, directionalErrorHint: true },
  medium: { showClapCounter: true, directionalErrorHint: true },
  hard: { showClapCounter: false, directionalErrorHint: false },
} as const;

const start = () => fireEvent.click(screen.getByRole('button', { name: /start clapping/i }));
const clap = (n: number) => {
  const btn = screen.getByRole('button', { name: /clap!/i });
  for (let i = 0; i < n; i++) fireEvent.click(btn);
};
const checkButton = () => screen.getByRole('button', { name: /^check/i });
const sentMatching = (tag: string) =>
  sendText.mock.calls.map((c) => String(c[0])).filter((t) => t.includes(tag));

beforeEach(() => {
  vi.useFakeTimers();
  sendText.mockClear();
  submitResult.mockClear();
  playCorrect.mockClear();
  playIncorrect.mockClear();
  luminaAiCalls.length = 0;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Lever #1 — showClapCounter
// ---------------------------------------------------------------------------

describe('SyllableClapper — lever #1 showClapCounter', () => {
  it('LEGACY DEFAULT: a payload with NO tier fields renders the full clap tally and the count echo', () => {
    render(<SyllableClapper data={makeData()} />);
    start();
    expect(screen.getByTestId('clap-tally')).toBeTruthy();
    clap(3);
    expect(checkButton().textContent).toBe('Check (3 claps)');
    // Singular still reads correctly on the legacy path.
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(checkButton().textContent).toBe('Check (1 clap)');
  });

  it('easy tier keeps the tally and the count echo', () => {
    render(<SyllableClapper data={makeData({ supportTier: 'easy', tierFields: STAMPS.easy })} />);
    start();
    expect(screen.getByTestId('clap-tally')).toBeTruthy();
    clap(2);
    expect(checkButton().textContent).toBe('Check (2 claps)');
  });

  it('HARD tier withdraws BOTH the tally and the count echo — the count lives in working memory', () => {
    render(<SyllableClapper data={makeData({ supportTier: 'hard', tierFields: STAMPS.hard })} />);
    start();
    expect(screen.queryByTestId('clap-tally')).toBeNull();
    clap(3);
    expect(checkButton().textContent).toBe('Check');
    // No digit anywhere in the interaction surface may echo the running count.
    expect(screen.queryByText(/\(3 claps\)/)).toBeNull();
  });

  it('HARD tier never withdraws the manipulable — the Clap button and Undo survive', () => {
    render(<SyllableClapper data={makeData({ supportTier: 'hard', tierFields: STAMPS.hard })} />);
    start();
    expect(screen.getByRole('button', { name: /clap!/i })).toBeTruthy();
    clap(1);
    expect(screen.getByRole('button', { name: /undo/i })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Lever #2 — directionalErrorHint
// ---------------------------------------------------------------------------

describe('SyllableClapper — lever #2 directionalErrorHint', () => {
  it('LEGACY DEFAULT: an over-count gets the directional "too many" hint', () => {
    render(<SyllableClapper data={makeData()} />);
    start();
    clap(5); // butterfly = 3
    fireEvent.click(checkButton());
    expect(screen.getByText(/too many claps/i)).toBeTruthy();
  });

  it('LEGACY DEFAULT: an under-count gets the directional "not enough" hint', () => {
    render(<SyllableClapper data={makeData()} />);
    start();
    clap(1);
    fireEvent.click(checkButton());
    expect(screen.getByText(/not enough claps/i)).toBeTruthy();
  });

  it('HARD tier gives a neutral miss — no direction to bisect toward', () => {
    render(<SyllableClapper data={makeData({ supportTier: 'hard', tierFields: STAMPS.hard })} />);
    start();
    clap(5);
    fireEvent.click(checkButton());
    expect(screen.getByText(/not quite\. listen again\./i)).toBeTruthy();
    expect(screen.queryByText(/too many/i)).toBeNull();
    expect(screen.queryByText(/not enough/i)).toBeNull();
  });

  it('easy tier keeps the directional hint', () => {
    render(<SyllableClapper data={makeData({ supportTier: 'easy', tierFields: STAMPS.easy })} />);
    start();
    clap(1);
    fireEvent.click(checkButton());
    expect(screen.getByText(/not enough claps/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tutor ladder — the second scaffold channel must match the on-screen tier
// ---------------------------------------------------------------------------

describe('SyllableClapper — tutor scaffold ladder', () => {
  it('LEGACY DEFAULT: no tier ⇒ no [SUPPORT_TIER] policy line and the segmented re-say on a miss', () => {
    render(<SyllableClapper data={makeData()} />);
    start();
    act(() => { vi.advanceTimersByTime(10); });
    expect(sentMatching('[SUPPORT_TIER')).toHaveLength(0);

    clap(1);
    fireEvent.click(checkButton());
    const miss = sentMatching('[CLAP_INCORRECT]');
    expect(miss).toHaveLength(1);
    expect(miss[0]).toContain('but...ter...fly');
  });

  it('easy tier: segmented re-say on a miss AND the [PRONOUNCE_SYLLABLES] replay after a correct answer', () => {
    render(<SyllableClapper data={makeData({ supportTier: 'easy', tierFields: STAMPS.easy })} />);
    start();
    expect(sentMatching('[SUPPORT_TIER easy]')).toHaveLength(1);

    clap(3); // correct
    fireEvent.click(checkButton());
    expect(sentMatching('[CLAP_CORRECT]')[0]).toContain("Let's hear them");
    act(() => { vi.advanceTimersByTime(2500); });
    expect(sentMatching('[PRONOUNCE_SYLLABLES]')).toHaveLength(1);
  });

  it('medium tier: keeps the segmented re-say on a miss but drops the post-correct replay', () => {
    render(<SyllableClapper data={makeData({ supportTier: 'medium', tierFields: STAMPS.medium })} />);
    start();
    expect(sentMatching('[SUPPORT_TIER medium]')).toHaveLength(1);

    clap(1);
    fireEvent.click(checkButton());
    expect(sentMatching('[CLAP_INCORRECT]')[0]).toContain('but...ter...fly');

    act(() => { vi.advanceTimersByTime(2000); }); // retry reset
    clap(3);
    fireEvent.click(checkButton());
    act(() => { vi.advanceTimersByTime(2500); });
    expect(sentMatching('[PRONOUNCE_SYLLABLES]')).toHaveLength(0);
  });

  it('HARD tier: whole-word model only on a miss, no segmented model, no post-correct replay', () => {
    render(<SyllableClapper data={makeData({ supportTier: 'hard', tierFields: STAMPS.hard })} />);
    start();
    const policy = sentMatching('[SUPPORT_TIER hard]');
    expect(policy).toHaveLength(1);
    expect(policy[0]).toContain('Never break it into parts');

    clap(1);
    fireEvent.click(checkButton());
    const miss = sentMatching('[CLAP_INCORRECT]')[0];
    expect(miss).not.toContain('but...ter...fly');
    expect(miss).toContain('WHOLE word');
    expect(miss).toContain('Do NOT break it into parts');

    act(() => { vi.advanceTimersByTime(2000); });
    clap(3);
    fireEvent.click(checkButton());
    expect(sentMatching('[CLAP_CORRECT]')[0]).toContain('do NOT say the parts again');
    act(() => { vi.advanceTimersByTime(2500); });
    expect(sentMatching('[PRONOUNCE_SYLLABLES]')).toHaveLength(0);
  });

  it('the spoken word stimulus is never withdrawn — every tier still gets the word said aloud', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      sendText.mockClear();
      render(<SyllableClapper data={makeData({ supportTier: tier, tierFields: STAMPS[tier] })} />);
      start();
      const intro = sentMatching('[ACTIVITY_START]')[0];
      expect(intro).toContain('butterfly');
      expect(intro).toContain('clearly and naturally');
      cleanup();
    }
  });

  it('threads supportTier into aiPrimitiveData (null when absent)', () => {
    render(<SyllableClapper data={makeData({ supportTier: 'hard', tierFields: STAMPS.hard })} />);
    const withTier = luminaAiCalls[luminaAiCalls.length - 1].primitiveData as Record<string, unknown>;
    expect(withTier.supportTier).toBe('hard');
    cleanup();

    luminaAiCalls.length = 0;
    render(<SyllableClapper data={makeData()} />);
    const noTier = luminaAiCalls[luminaAiCalls.length - 1].primitiveData as Record<string, unknown>;
    expect(noTier.supportTier).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// NAME-COLLISION regression — challengeType (word length) ⟂ supportTier (help)
// ---------------------------------------------------------------------------

describe('SyllableClapper — challengeType/supportTier orthogonality', () => {
  it('challengeType "hard" alone withdraws NOTHING — word length is not a support level', () => {
    render(<SyllableClapper data={makeData({ challengeType: 'hard' })} />);
    start();
    expect(screen.getByTestId('clap-tally')).toBeTruthy();
    clap(3);
    expect(checkButton().textContent).toBe('Check (3 claps)');
    clap(2);
    fireEvent.click(checkButton());
    expect(screen.getByText(/too many claps/i)).toBeTruthy();
    expect(sentMatching('[SUPPORT_TIER')).toHaveLength(0);
  });

  it('challengeType "easy" + supportTier "hard" still withdraws — the tier alone drives the gate', () => {
    render(
      <SyllableClapper
        data={makeData({ challengeType: 'easy', supportTier: 'hard', tierFields: STAMPS.hard })}
      />,
    );
    start();
    expect(screen.queryByTestId('clap-tally')).toBeNull();
    clap(1);
    expect(checkButton().textContent).toBe('Check');
  });

  it('the tier never changes the CONTENT the component was handed', () => {
    const data = makeData({ supportTier: 'hard', tierFields: STAMPS.hard });
    render(<SyllableClapper data={data} />);
    start();
    expect(screen.getByText('butterfly')).toBeTruthy();
    expect(data.challenges[0].syllableCount).toBe(3);
    expect(data.challenges[0].syllables).toEqual(['but', 'ter', 'fly']);
    expect(data.challenges[0].challengeType).toBe('medium');
  });
});
