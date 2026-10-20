// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for coin-counter Task 3 (K `count-like` enacted
 * count — the band+mode fork).
 *
 * The pre-fix K interaction was a PROXY: coins rendered `disabled` (no onClick) and the
 * answer was a typed number behind a Check button, so nothing about counting was
 * enacted. The fork makes the coins the answer surface at K for `count-like` ONLY.
 *
 * What these tests pin:
 *  1. K + count-like ENACTS — coins are tappable, each tap stamps the running
 *     skip-count total, and the number input + Check button are gone.
 *  2. K + count-like AUTO-JUDGES on the enacted total (no Check to press).
 *  3. Double-counting a coin is a detectable error (feedback on the object, no
 *     advance) — the enacted path is failable, not a walk-through.
 *  4. Grade-2 control — the SAME count-like card keeps the input + Check and the
 *     coins stay inert above the fork's band ceiling. The fork is band-gated, not
 *     global. (Task 3 pinned Grade 1 as the control; reader-fit 14b deliberately
 *     superseded that — G1 count-like now has its own enacted variant, below.)
 *  5. count-mixed is UNCHANGED EVEN AT K — the contract guard. count-like and
 *     count-mixed both render as challenge type 'count', so this is the test that
 *     proves the Grade-2/3 consumer (MEAS002-05-a) was not ablated.
 *  6. A count card with NO countMode stamp (older payload) falls back to the typed
 *     path rather than silently enacting.
 *
 * Reader-fit 14b adds the G1 VARIANT (MEAS001-07-c, "skip counting and summation",
 * β1.5 with live item history):
 *  7. G1 + count-like: coins are tappable TAGS; the number input + Check appear only
 *     once every coin is tagged — the child still TYPES the total, so the summation
 *     half stays student-produced and the answer act matches the item history.
 *  8. showRunningTotal (support tier: easy true / medium+hard false) decides whether
 *     taps stamp the climbing skip-count + readout or a plain ✓ tag.
 *  9. Double-count is rejected at G1 exactly as at K; count-mixed and unstamped
 *     cards at G1 never enact.
 *
 * Mounted on the bound workspace, the only path since the boss (2026-10-19): the scripted Next
 * button went with the scripted path, so "judged" reads the check the runtime recorded.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRuntimeTimers, resetSeams, restoreRuntimeTimers } from '../../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../../components/live-activity/runtime/testing/workspaceHarness';
import type { CoinCounterChallenge, CoinCounterData } from '../CoinCounter';

/** 3 nickels = 15¢ — the canonical count-like card (single denomination, skip-count by 5). */
const likeCard = (extra: Partial<CoinCounterChallenge> = {}): CoinCounterChallenge => ({
  id: 'c1',
  type: 'count',
  instruction: 'How much money is shown here?',
  hint: 'Count them up.',
  displayedCoins: [{ type: 'nickel', count: 3 }],
  correctTotal: 15,
  countMode: 'like',
  ...extra,
});

/** A distinct second like-card, so a deck can outlive its first challenge. */
const secondLikeCard = (): CoinCounterChallenge => ({
  id: 'c2',
  type: 'count',
  instruction: 'How much money is shown here?',
  hint: 'Count them up.',
  displayedCoins: [{ type: 'dime', count: 2 }],
  correctTotal: 20,
  countMode: 'like',
});

/** 2 dimes + 3 pennies = 23¢ — the Grade-2 count-mixed card that must not change. */
const mixedCard = (extra: Partial<CoinCounterChallenge> = {}): CoinCounterChallenge => ({
  id: 'c1',
  type: 'count',
  instruction: 'How much money is shown here?',
  hint: 'Count them up.',
  displayedCoins: [{ type: 'dime', count: 2 }, { type: 'penny', count: 3 }],
  correctTotal: 23,
  countMode: 'mixed',
  ...extra,
});

let h: WorkspaceHarness;
/** The lesson mounted the way a lesson mounts it, on the bound workspace (the only path since the boss). */
const mount = (
  gradeBand: CoinCounterData['gradeBand'],
  challenges: CoinCounterChallenge[],
  extra: Partial<CoinCounterData> = {},
) => mountWorkspace({ primitiveId: 'coin-counter', instanceId: 'coins',
  evalMode: challenges[0].countMode === 'like' ? 'count-like' : 'count-mixed',
  data: { title: 'coin-counter reader-fit test', challenges, gradeBand, ...extra } });
/** The runtime's verdict on the current item: the activity's own check, recorded. */
const verdict = () => h.state().task!.evidence.correctness;

/** Every coin renders as a <button>; in the inert path they carry `disabled`. */
const coinButtons = () =>
  Array.from(document.querySelectorAll('button')).filter((b) =>
    /¢|penny|nickel|dime|quarter/i.test(b.textContent ?? ''),
  );
const numberInput = () => document.querySelector('input[type="number"]');
const checkButton = () => screen.queryByRole('button', { name: /check answer/i });
const runningTotal = () => screen.queryByTestId('enacted-running-total');
const runningTotalG1 = () => screen.queryByTestId('enacted-running-total-g1');
const countBadges = () =>
  document.querySelectorAll('[data-testid^="coin-count-badge-"]');

beforeEach(() => { resetSeams(); installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

describe('coin-counter — K count-like enacts the count (Task 3)', () => {
  it('renders tappable coins and NO number input / Check button', () => {
    h = mount('K', [likeCard()]);

    const coins = coinButtons();
    expect(coins).toHaveLength(3);
    // The proxy's tell was `disabled` with no onClick — every coin must now be live.
    coins.forEach((c) => expect(c.disabled).toBe(false));

    expect(numberInput()).toBeNull();
    expect(checkButton()).toBeNull();
    // The readout starts BUILT-FROM-ZERO — it must never pre-state the answer.
    expect(runningTotal()?.textContent).toBe('0¢');
  });

  it('stamps the running skip-count total on each coin as it is tapped', () => {
    h = mount('K', [likeCard()]);
    const coins = coinButtons();

    fireEvent.click(coins[0]);
    expect(runningTotal()?.textContent).toBe('5¢');
    expect(countBadges()).toHaveLength(1);

    fireEvent.click(coins[1]);
    expect(runningTotal()?.textContent).toBe('10¢');

    // Badges carry the running total in TAP ORDER (5, 10) — the skip-count itself.
    const stamps = Array.from(countBadges()).map((b) => b.textContent);
    expect(stamps).toEqual(['5', '10']);
  });

  it('auto-judges on the enacted total once every coin is counted', () => {
    // Two cards: finishing card 1 must NOT end the deck, or the challenge block
    // unmounts into the summary panel and there is nothing left to assert on.
    h = mount('K', [likeCard(), secondLikeCard()]);
    const coins = coinButtons();

    coins.forEach((c) => fireEvent.click(c));

    expect(runningTotal()?.textContent).toBe('15¢');
    expect(screen.getByText(/you counted 15¢/i)).toBeTruthy();
    // Judged with no Check anywhere in the flow: the activity recorded the count as right.
    expect(checkButton()).toBeNull();
    expect(verdict()).toBe('correct');
  });

  it('does NOT judge while coins remain uncounted', () => {
    h = mount('K', [likeCard()]);
    const coins = coinButtons();

    fireEvent.click(coins[0]);
    fireEvent.click(coins[1]);

    expect(screen.queryByText(/you counted/i)).toBeNull();
  });

  it('treats a double-count as an error and does not advance the total', () => {
    h = mount('K', [likeCard()]);
    const coins = coinButtons();

    fireEvent.click(coins[0]);
    fireEvent.click(coins[0]); // re-tap the SAME coin — the classic K double-count

    expect(runningTotal()?.textContent).toBe('5¢');
    expect(countBadges()).toHaveLength(1);
    // Feedback lands on the touched object (shake), not a text card.
    expect(coins[0].className).toMatch(/shake/);
    expect(screen.queryByText(/you counted/i)).toBeNull();
  });
});

describe('coin-counter — G1 count-like enacts the tag, keeps the typed total (14b)', () => {
  it('renders tappable coins with NO input/Check until every coin is tagged', () => {
    h = mount('1', [likeCard()]);

    const coins = coinButtons();
    expect(coins).toHaveLength(3);
    // The 14b census tell was inert coins at G1 — every coin must now be live.
    coins.forEach((c) => expect(c.disabled).toBe(false));

    // The summation half stays student-produced: the answer surface is still the
    // typed total, but it must not exist until the tagging is done.
    expect(numberInput()).toBeNull();
    expect(checkButton()).toBeNull();
    expect(screen.getByText(/tap each coin to count it/i)).toBeTruthy();
    // Default (no tier stamped) shows the climbing readout, built from zero.
    expect(runningTotalG1()?.textContent).toBe('0¢');
  });

  it('stamps the climbing skip-count on taps when showRunningTotal is on', () => {
    h = mount('1', [likeCard()], { showRunningTotal: true });
    const coins = coinButtons();

    fireEvent.click(coins[0]);
    fireEvent.click(coins[1]);

    expect(runningTotalG1()?.textContent).toBe('10¢');
    const stamps = Array.from(countBadges()).map((b) => b.textContent);
    expect(stamps).toEqual(['5', '10']);
  });

  it('stamps plain ✓ tags and hides the readout when showRunningTotal is off (medium/hard)', () => {
    h = mount('1', [likeCard()], { showRunningTotal: false });
    const coins = coinButtons();

    fireEvent.click(coins[0]);
    fireEvent.click(coins[1]);

    // The accumulation happens in the child's head — nothing on screen may state it.
    expect(runningTotalG1()).toBeNull();
    const stamps = Array.from(countBadges()).map((b) => b.textContent);
    expect(stamps).toEqual(['✓', '✓']);
  });

  it('reveals input + Check after the last tag and grades the TYPED total', () => {
    h = mount('1', [likeCard(), secondLikeCard()], { showRunningTotal: false });
    const coins = coinButtons();
    // The reveal is the fork: no answer surface exists until the tagging is done.
    expect(numberInput()).toBeNull();

    coins.forEach((c) => fireEvent.click(c));

    // No auto-judge at G1 — tagging alone must never record a correct answer.
    expect(screen.queryByText(/you counted/i)).toBeNull();
    expect(numberInput()).toBeTruthy();
    expect(checkButton()).toBeTruthy();

    fireEvent.change(numberInput()!, { target: { value: '15' } });
    fireEvent.click(checkButton()!);

    expect(screen.getByText(/yes! the total is 15¢/i)).toBeTruthy();
    expect(verdict()).toBe('correct');
  });

  it('marks a wrong typed total as an error — the variant stays failable', () => {
    h = mount('1', [likeCard()], { showRunningTotal: false });
    coinButtons().forEach((c) => fireEvent.click(c));

    fireEvent.change(numberInput()!, { target: { value: '25' } });
    fireEvent.click(checkButton()!);

    expect(screen.getByText(/the total is different/i)).toBeTruthy();
    expect(verdict()).toBe('incorrect');
  });

  it('rejects a double-count exactly as at K (shake, no advance, no input reveal)', () => {
    h = mount('1', [likeCard()]);
    const coins = coinButtons();

    fireEvent.click(coins[0]);
    fireEvent.click(coins[0]); // re-tap the SAME coin

    expect(runningTotalG1()?.textContent).toBe('5¢');
    expect(countBadges()).toHaveLength(1);
    expect(coins[0].className).toMatch(/shake/);
    expect(numberInput()).toBeNull();
  });
});

describe('coin-counter — the fork does not leak (contract guard)', () => {
  it('Grade-2 control: the SAME count-like card keeps input + Check, coins inert', () => {
    h = mount('2', [likeCard()]);

    expect(numberInput()).toBeTruthy();
    expect(checkButton()).toBeTruthy();
    expect(runningTotal()).toBeNull();
    expect(runningTotalG1()).toBeNull();
    coinButtons().forEach((c) => expect(c.disabled).toBe(true));
  });

  it('count-mixed is unchanged AT G1 (the enacted variant is mode-gated)', () => {
    h = mount('1', [mixedCard()]);

    expect(numberInput()).toBeTruthy();
    expect(checkButton()).toBeTruthy();
    expect(runningTotalG1()).toBeNull();
    coinButtons().forEach((c) => expect(c.disabled).toBe(true));
  });

  it('an unstamped count card at G1 falls back to the typed path, never enacts', () => {
    const unstamped = likeCard();
    delete unstamped.countMode;
    h = mount('1', [unstamped]);

    expect(numberInput()).toBeTruthy();
    expect(checkButton()).toBeTruthy();
    expect(runningTotalG1()).toBeNull();
  });

  it('count-mixed is unchanged EVEN AT K (Grade-2 consumer not ablated)', () => {
    h = mount('K', [mixedCard()]);

    expect(numberInput()).toBeTruthy();
    expect(checkButton()).toBeTruthy();
    expect(runningTotal()).toBeNull();
    coinButtons().forEach((c) => expect(c.disabled).toBe(true));
  });

  it('an unstamped count card falls back to the typed path, never enacts', () => {
    const unstamped = likeCard();
    delete unstamped.countMode;
    h = mount('K', [unstamped]);

    expect(numberInput()).toBeTruthy();
    expect(checkButton()).toBeTruthy();
    expect(runningTotal()).toBeNull();
  });

  it('grades the typed count-mixed answer exactly as before', () => {
    h = mount('2', [mixedCard(), secondLikeCard()]);

    fireEvent.change(numberInput()!, { target: { value: '23' } });
    fireEvent.click(checkButton()!);

    expect(screen.getByText(/yes! the total is 23¢/i)).toBeTruthy();
  });
});
