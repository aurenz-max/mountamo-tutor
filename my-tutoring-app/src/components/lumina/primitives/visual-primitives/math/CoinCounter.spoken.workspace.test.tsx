// @vitest-environment jsdom
/**
 * Coin counter answered aloud (ROLLOUT.md VB-1; on the boss since 2026-10-19): a typed total (every mixed count, and a
 * like count from Grade 2), the group worth more, and the change each ask for one amount or one group, so they are
 * SAY_OR_SHOW items with a key (`coinKey`) that still take the typed or tapped answer and Check. The observer credits a
 * spoken answer from the tutor's feedback; a Check stays checked by the activity. Identify, the Kindergarten and
 * Grade 1 like counts and the builds have no key and stay tap-only.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, resetSeams, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { getComponentById } from '../../../service/manifest/catalog';
import type { CoinCounterChallenge, CoinCounterData } from './CoinCounter';
import { askLeaks, spokenKeyText } from '../../../components/live-activity/spokenKey';
import { coinAsk, coinGiven, coinKey, coinSpokenMisses, spokenCentsForms, type CoinItem } from './coinCounterWorkspace';

beforeEach(() => { resetSeams(); vi.clearAllMocks(); installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const MIXED: CoinCounterChallenge = { id: 'm', type: 'count', instruction: 'How much money is shown?', countMode: 'mixed',
  displayedCoins: [{ type: 'dime', count: 3 }, { type: 'penny', count: 2 }], correctTotal: 32 };
const LIKE: CoinCounterChallenge = { id: 'l', type: 'count', instruction: 'How much money is shown?', countMode: 'like',
  displayedCoins: [{ type: 'nickel', count: 4 }], correctTotal: 20 };
const COMPARE: CoinCounterChallenge = { id: 'c', type: 'compare', instruction: 'Which group has more money?',
  groupA: [{ type: 'penny', count: 6 }], groupB: [{ type: 'dime', count: 1 }], correctGroup: 'B' };
const CHANGE: CoinCounterChallenge = { id: 'g', type: 'make-change', instruction: 'You pay 50¢ for a 35¢ toy. What is your change?',
  paidAmount: 50, itemCost: 35, correctChange: 15 };

const write = (h: WorkspaceHarness, name: string, text: string) =>
  act(() => { fireEvent.change(screen.getByRole('spinbutton', { name }), { target: { value: text } }); });
const check = (h: WorkspaceHarness) => h.press(/check/i);
/** One spoken challenge per converted mode: a wrong and a right spoken answer, the right tap, and the scene's key. */
const SPOKEN: Array<[string, CoinCounterChallenge, string, string, (h: WorkspaceHarness) => void, RegExp]> = [
  ['count-mixed', MIXED, 'five cents', 'thirty-two cents', h => { write(h, 'Total in cents', '32'); check(h); }, /32|thirty-two/i],
  ['count-like', LIKE, 'four cents', 'twenty', h => { write(h, 'Total in cents', '20'); check(h); }, /20¢|twenty/i],
  ['compare', COMPARE, 'group A', 'group B', h => { h.press('Group B'); check(h); }, /B (has|is worth) more|more money.*B/i],
  ['make-change', CHANGE, 'thirty-five cents', '15 cents', h => { write(h, 'Change in cents', '15'); check(h); }, /15|fifteen/i],
];
const mount = (mode: string, challenges: CoinCounterChallenge[], gradeBand: CoinCounterData['gradeBand'] = '2') =>
  mountWorkspace({ primitiveId: 'coin-counter', evalMode: mode, instanceId: 'coins',
    data: { title: 'Coins', gradeBand, challenges } });
/** The scene the tutor reads, without the coins listed on screen. */
const sceneText = (h: WorkspaceHarness) => {
  const { coins: _c, groups: _g, paid: _p, itemCost: _i, ...rest } = h.state().task!.demand as Record<string, unknown>;
  return JSON.stringify(rest);
};

it.each(SPOKEN)('%s: a wrong spoken answer retries, a right one credited by the tutor completes once', async (mode, c, wrong, right, _tap, key) => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(mode, [c]);
  const task = h.state().task!;
  expect(task.demand.response).toBe('speech');
  expect(task.workspace!.expectedAnswer).toBeTruthy();
  // The scene never says the answer; the task is the ask, and the key rides beside it.
  expect(task.task.startsWith(c.instruction)).toBe(true);
  expect(sceneText(h)).not.toMatch(key);
  h.say(wrong); h.feedback('incorrect', 'retry');
  expect(h.state().status).not.toBe('completed');
  h.say(right); h.feedback('correct', 'advance');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
});

it('a credited spoken total shows the credited total, and the next challenge still takes the typed answer', () => {
  const h = mount('count-mixed', [MIXED, { ...MIXED, id: 'm2', displayedCoins: [{ type: 'nickel', count: 2 }], correctTotal: 10 }]);
  h.say('thirty-two cents'); h.feedback('correct');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'Typed 32¢ as the total' });
  expect(screen.getByText('Yes! The total is 32¢!')).toBeTruthy();
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('m2');
  write(h, 'Total in cents', '10'); check(h);
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('a credited spoken group and change mark the group chosen and the change typed', () => {
  const h = mount('compare', [COMPARE]);
  h.say('the second one'); h.feedback('correct');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'Chose group B' });
  cleanup();
  const g = mount('make-change', [CHANGE]);
  g.say('fifteen'); g.feedback('correct');
  expect(g.state().task!.demand).toMatchObject({ learnerWork: 'Typed 15¢ as the change' });
});

it.each(SPOKEN)('%s: a Check after a spoken answer is checked by the activity and ends the pending speech', (mode, c, _wrong, right, tap) => {
  const h = mount(mode, [c]);
  h.say(right);
  expect(h.state().task!.workspace!.pendingResponse).toBeDefined();
  tap(h);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.state().task!.workspace!.pendingResponse).toBeUndefined();
});

it('a correct tap is recorded once, though onSolved fires for it too', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('make-change', [CHANGE]);
  write(h, 'Change in cents', '15'); check(h);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ challengesTotal: 1, challengesCompleted: 1, totalAttempts: 1 });
});

it('identify, the Kindergarten and Grade 1 like counts and the builds stay tap-only with no key', () => {
  const kept: Array<[string, CoinCounterChallenge, CoinCounterData['gradeBand']]> = [
    ['identify', { id: 'i', type: 'identify', instruction: 'Which coin is a nickel?', targetCoin: 'nickel', options: ['penny', 'nickel', 'dime'] }, 'K'],
    ['count-like', LIKE, 'K'],
    ['count-like', LIKE, '1'],
    ['make-amount', { id: 'a', type: 'make-amount', instruction: 'Make 16¢.', targetAmount: 16, availableCoins: ['penny', 'nickel', 'dime'] }, '2'],
    ['fewest-coins', { id: 'f', type: 'make-amount', instruction: 'Make 30¢ with the fewest coins.', targetAmount: 30, availableCoins: ['nickel', 'dime', 'quarter'] }, '2'],
    ['show-amount', { id: 's', type: 'show-amount', instruction: 'Show 37¢ any way you like.', targetAmount: 37, availableCoins: ['penny', 'nickel', 'dime', 'quarter'] }, '2'],
  ];
  for (const [mode, c, band] of kept) {
    const h = mount(mode, [c], band);
    expect(h.state().task!.demand.response, `${mode} ${band}`).toBe('gesture');
    expect(h.state().task!.workspace!.expectedAnswer, `${mode} ${band}`).toBeUndefined();
    expect(String(h.state().task!.demand.constraints), `${mode} ${band}`).not.toMatch(/says/);
    cleanup();
  }
});

it('the key names the ways to say the amount or the group, and no ask says its answer', () => {
  const item = (c: CoinCounterChallenge, band = '2'): CoinItem => ({ ...c, band });
  const text = (c: CoinCounterChallenge) => spokenKeyText(coinKey(item(c))!);
  expect(spokenCentsForms(13)).toEqual(['13 cents', 'thirteen cents', 'thirteen', '13¢']);
  expect(spokenCentsForms(1)).toContain('one cent');
  expect(spokenCentsForms(125)).toEqual(expect.arrayContaining(['$1.25', 'one dollar and twenty-five cents', 'a dollar twenty-five']));
  expect(text(MIXED)).toMatch(/^"32 cents" \(also accept "thirty-two cents"\)\. The number alone \(32\) counts\./);
  expect(text(MIXED)).toContain('The number of coins (5) is not the total');
  expect(text(COMPARE)).toContain('"the second one"');
  expect(text(COMPARE)).toContain('chooses one word from "group A", "group B", "the same"');
  expect(text({ ...COMPARE, groupB: [{ type: 'nickel', count: 1 }, { type: 'penny', count: 1 }], correctGroup: 'equal' }))
    .toMatch(/^"the same"/);
  expect(text(CHANGE)).toContain('The price, the amount paid');
  // A compare asks its three answers; a change whose price equals it says it by design.
  expect(coinAsk(COMPARE)).toBe('Which group has more money? Group A, group B, or the same?');
  const even = { ...CHANGE, instruction: 'A ball costs 25 cents. You pay 50 cents. What is your change?', itemCost: 25, correctChange: 25 };
  expect(askLeaks(coinAsk(even), coinKey(item(even))!, coinGiven(even))).toEqual([]);
  expect(askLeaks('How much money is shown? It is 32 cents.', coinKey(item(MIXED))!, coinGiven(MIXED))).toEqual(['says the answer "32 cents"']);
  // An enacted like count has no key; from Grade 2 it is spoken.
  expect(coinKey(item(LIKE, 'K'))).toBeNull();
  expect(coinKey(item(LIKE, '1'))).toBeNull();
  expect(coinKey(item(LIKE, '2'))?.answer).toBe('20 cents');
});

it('every spoken miss is one the catalog lists for its mode, and no example is a way to say the key', () => {
  const lists = getComponentById('coin-counter')!.teachingWorkspace!.misses as Record<string, readonly string[]>;
  const keyForms = (c: CoinCounterChallenge) => c.type === 'count' ? spokenCentsForms(c.correctTotal!)
    : c.type === 'make-change' ? spokenCentsForms(c.correctChange!)
      : c.correctGroup === 'equal' ? ['they are equal', 'the same'] : [`group ${c.correctGroup}`];
  const cases: Array<[string, CoinCounterChallenge]> = [
    ['count-mixed', MIXED],
    ['count-mixed', { ...MIXED, displayedCoins: [{ type: 'quarter', count: 1 }, { type: 'nickel', count: 2 }, { type: 'penny', count: 3 }], correctTotal: 38 }],
    ['count-like', LIKE],
    ['count-like', { ...LIKE, displayedCoins: [{ type: 'penny', count: 7 }], correctTotal: 7 }],
    ['compare', COMPARE],
    ['compare', { ...COMPARE, groupA: [{ type: 'dime', count: 2 }], groupB: [{ type: 'nickel', count: 1 }], correctGroup: 'A' }],
    ['compare', { ...COMPARE, groupB: [{ type: 'nickel', count: 1 }, { type: 'penny', count: 1 }], correctGroup: 'equal' }],
    ['make-change', CHANGE],
    // The price is the change here: that miss is dropped, never offered as the key.
    ['make-change', { ...CHANGE, paidAmount: 50, itemCost: 25, correctChange: 25 }],
  ];
  for (const [mode, c] of cases) {
    const misses = coinSpokenMisses(c);
    expect(misses.length).toBeGreaterThan(0);
    expect(new Set(misses.map(m => m.id)).size).toBe(misses.length);
    for (const m of misses) {
      expect(lists[mode], `${mode} ${m.id}`).toContain(m.id);
      for (const e of m.examples ?? []) expect(keyForms(c).map(k => k.toLowerCase()), `${mode} ${m.id}`).not.toContain(e.toLowerCase());
    }
  }
  // 3 dimes and 2 pennies: 5 coins counted, every coin a dime (50¢), and a dime short (22¢) are each named.
  const mixed = coinSpokenMisses(MIXED);
  expect(mixed.find(m => m.id === 'counted_coins')!.examples).toContain('five cents');
  expect(mixed.find(m => m.id === 'all_one_kind')!.examples).toContain('fifty cents');
  expect(mixed.find(m => m.id === 'one_coin_short')!.examples).toContain('twenty-two cents');
  expect(coinSpokenMisses(COMPARE)[0]).toMatchObject({ id: 'more_coins', examples: ['group A', 'the first one'] });
  expect(coinSpokenMisses({ ...CHANGE, paidAmount: 50, itemCost: 25, correctChange: 25 }).map(m => m.id)).not.toContain('gave_cost');
});
