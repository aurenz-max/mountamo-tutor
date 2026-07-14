// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for the PRE-band declutter (RF-2/RF-3/RF-4):
 *  1. Letter bank honors the generator's distractor tier — availableLetters only
 *     tops up to 5, it no longer unions the whole set into the bank.
 *  2. Clear + Stretch It buttons are gone; ONE audio affordance whose tap ladder
 *     is hear-then-stretch; slot-tap still clears (recovery without Clear).
 *  3. imageDescription sentence is not rendered (emoji-only picture cue).
 *  4. word-sort: no `short-a` dev slug in the child's field, and the spoken
 *     [SORT_CORRECT] line names the vowel, not the slug.
 *  5. Spoken production invite is appended to the success sendText when a mic
 *     is available.
 *
 * External hooks (live tutor, evaluation, audio, spoken judge) are mocked.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const sendTextMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextMock, isConnected: false }),
}));
const submitSpy = vi.hoisted(() => vi.fn());

// Stateful mock: hasSubmitted must flip after submitResult — the component's
// session-end rendering (sessionDone) is gated on it.
vi.mock('../../../../evaluation', async () => {
  const ReactMod = await import('react');
  return {
    usePrimitiveEvaluation: () => {
      const [hasSubmitted, setHasSubmitted] = ReactMod.useState(false);
      return {
        submitResult: (...args: unknown[]) => { submitSpy(...args); setHasSubmitted(true); },
        hasSubmitted,
        submittedResult: null,
        elapsedMs: 0,
      };
    },
    useEvaluationContext: () => null,
  };
});
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));
vi.mock('../../../../hooks/useSpokenWordCapture', () => ({
  useSpokenWordCapture: () => ({
    state: 'idle', level: 0, isSupported: true,
    start: vi.fn(), cancel: vi.fn(),
  }),
}));

import CvcSpeller, { type CvcSpellerData, type CvcSpellerChallenge } from '../CvcSpeller';

const spellChallenge = (over: Partial<CvcSpellerChallenge> = {}): CvcSpellerChallenge => ({
  id: 'c1', taskType: 'spell-word', targetWord: 'sat',
  targetLetters: ['s', 'a', 't'], targetPhonemes: ['/s/', '/æ/', '/t/'],
  emoji: '🧘', imageDescription: 'A person sitting down on a rug',
  distractorLetters: ['m', 'p', 'e'], ...over,
});

const baseData = (challenges: CvcSpellerChallenge[], over: Partial<CvcSpellerData> = {}): CvcSpellerData => ({
  title: 'Reader-fit test',
  vowelFocus: 'short-a',
  letterGroup: 1,
  // 9 letters — the old union rendered ALL of these; the cap must keep b/g/d out
  availableLetters: ['s', 'a', 't', 'm', 'p', 'e', 'b', 'g', 'd'],
  challenges,
  ...over,
});

beforeEach(() => {
  cleanup();
  sendTextMock.mockClear();
  submitSpy.mockClear();
});

describe('CvcSpeller reader-fit (PRE band)', () => {
  it('spell-word: bank = targets + tiered distractors only; no Clear; one audio button', () => {
    render(<CvcSpeller data={baseData([spellChallenge()])} />);

    // Bank letters present (exact single-letter accessible names)
    for (const l of ['s', 'a', 't', 'm', 'p', 'e']) {
      expect(screen.getByRole('button', { name: l })).toBeTruthy();
    }
    // availableLetters overflow letters must NOT appear — the tier cap is live
    for (const l of ['b', 'g', 'd']) {
      expect(screen.queryByRole('button', { name: l })).toBeNull();
    }
    // Declutter: no Clear, no separate Stretch It; exactly one Hear It
    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /stretch/i })).toBeNull();
    expect(screen.getAllByRole('button', { name: /hear it/i })).toHaveLength(1);
    // imageDescription sentence is not rendered as text (emoji-only cue)
    expect(screen.queryByText(/sitting down on a rug/i)).toBeNull();
  });

  it('audio tap ladder: first tap repeats the word, further taps stretch', async () => {
    const user = userEvent.setup();
    render(<CvcSpeller data={baseData([spellChallenge()])} />);

    const hearIt = screen.getByRole('button', { name: /hear it/i });
    await user.click(hearIt);
    expect(sendTextMock.mock.lastCall?.[0]).toContain('[REPEAT_WORD]');
    await user.click(hearIt);
    expect(sendTextMock.mock.lastCall?.[0]).toContain('[STRETCH_WORD]');
  });

  it('spell-word: tap letters → Check → success, with the spoken production invite', async () => {
    const user = userEvent.setup();
    render(<CvcSpeller data={baseData([spellChallenge()])} />);

    // Slot cursor auto-advances in order: tap s, a, t from the bank
    await user.click(screen.getByRole('button', { name: 's' }));
    await user.click(screen.getByRole('button', { name: 'a' }));
    await user.click(screen.getByRole('button', { name: 't' }));
    await user.click(screen.getByRole('button', { name: /check spelling/i }));

    expect(await screen.findByText(/you spelled/i)).toBeTruthy();
    const correctMsg = sendTextMock.mock.calls.map(c => c[0]).find((m: string) => m.includes('[SPELLING_CORRECT]'));
    expect(correctMsg).toContain('invite the student to say the whole word out loud');

    // FINAL-WORD flow (was broken: allChallengesComplete hid this instantly and
    // submitEvaluation was unreachable): the production beat must still render,
    // and finishing from it reaches the summary.
    expect(screen.getByText(/your turn — say the word/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /skip to finish/i }));
    expect(await screen.findByText(/spelling complete/i)).toBeTruthy();
    const allComplete = sendTextMock.mock.calls.map(c => c[0]).find((m: string) => m.includes('[ALL_COMPLETE]'));
    expect(allComplete).toBeTruthy();
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it('word-sort: no short-a dev slug in the child\'s field or the spoken line', async () => {
    const user = userEvent.setup();
    render(<CvcSpeller data={baseData([
      spellChallenge({ id: 'w1', taskType: 'word-sort', sortBucketLabel: 'short-a' }),
    ])} />);

    // The raw slug must not render anywhere (badge says "Short A", no hyphen)
    expect(document.body.textContent).not.toContain('short-a');

    // Tap the correct bucket (label carries the keyword caption "like apple")
    await user.click(screen.getByRole('button', { name: /like apple/i }));
    const sortMsg = sendTextMock.mock.calls.map(c => c[0]).find((m: string) => m.includes('[SORT_CORRECT]'));
    expect(sortMsg).toBeTruthy();
    expect(sortMsg).not.toContain('short-');
    expect(sortMsg).toContain('/a/');
  });
});
