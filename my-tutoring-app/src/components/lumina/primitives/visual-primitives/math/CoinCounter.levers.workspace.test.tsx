// @vitest-environment jsdom
/**
 * coin-counter levers (`coinCounterLevers.ts`) on every mode but the build, mounted the way a lesson mounts it: a help
 * pull changes the screen and the scene fact in one commit and is recorded on the next attempt; a refused pull changes
 * nothing; an easier item is ungraded, the full item comes back blank, and only its answer is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { observerLever } from '../../../components/live-activity/runtime/observerLever';
import type { CoinCounterChallenge, CoinCounterData } from './CoinCounter';
import {
  CHANGE_BAR_LEVER, COIN_VALUES_LEVER, FEWER_COINS_LEVER, ROUND_CHANGE_LEVER, SIZE_ROW_LEVER, SKIP_STRIP_LEVER, SORT_LEVER,
  TWO_COINS_LEVER, VALUE_TAGS_LEVER,
} from './coinCounterLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const lesson = (challenges: CoinCounterChallenge[], extra: Partial<CoinCounterData> = {}) =>
  ({ title: 'Coins', gradeBand: '2', challenges, ...extra }) as never;
const mount = (evalMode: string, challenges: CoinCounterChallenge[], extra: Partial<CoinCounterData> = {}) =>
  mountWorkspace({ primitiveId: 'coin-counter', evalMode, data: lesson(challenges, extra), instanceId: 'coins' });
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const write = (h: WorkspaceHarness, name: string, text: string) => act(() => {
  fireEvent.change(h.view.getByRole('spinbutton', { name }), { target: { value: text } });
});
const check = (h: WorkspaceHarness) => h.press('Check Answer');
/** What a refused pull must leave alone (the runtime revision may still move). */
const unchanged = (h: WorkspaceHarness) => JSON.stringify({ d: demand(h), l: levers(h), a: attempts(h), html: h.view.container.innerHTML });

const MIXED: CoinCounterChallenge = { id: 'm1', type: 'count', instruction: 'How much money is shown here?', countMode: 'mixed',
  displayedCoins: [{ type: 'penny', count: 3 }, { type: 'dime', count: 2 }], correctTotal: 23 };

it('count-mixed: a wrong total, then sort_coins: rows by kind and the fact in one commit, recorded on the next try', () => {
  const h = mount('count-mixed', [MIXED]);
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([[SORT_LEVER, 'help', false], [FEWER_COINS_LEVER, 'simplify', false]]);
  write(h, 'Total in cents', '5'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'counted_coins' });
  expect(observerLever(h.state(), true)).toBe(SORT_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: SORT_LEVER });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-lever="sorted-row"]').map(r => r.getAttribute('data-kind'))).toEqual(['dime', 'penny']);
  expect(String(receipt.state.task!.demand.onScreen)).toBe('The coins are sorted into one row per kind, the kind worth most first.');
  // A second pull is refused and changes nothing.
  const before = unchanged(h);
  expect(h.dispatch('pull_lever', { lever: SORT_LEVER }).status).toBe('blocked');
  expect(h.dispatch('pull_lever', { lever: 'skip_strip' }).status).toBe('blocked');
  expect(unchanged(h)).toBe(before);
  h.dispatch('retry');
  write(h, 'Total in cents', '23'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'm1', correct: true, assisted: true, levers: [SORT_LEVER] });
  h.close();
});

it('count-mixed: fewer_coins opens an ungraded easier count, then the full item comes back blank and is credited', () => {
  const h = mount('count-mixed', [MIXED]);
  write(h, 'Total in cents', '5'); check(h);
  const receipt = h.dispatch('pull_lever', { lever: FEWER_COINS_LEVER });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('m1~smaller');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'm1' });
  expect(demand(h)).toMatchObject({ coins: '1 dime, 2 pennies', practice: expect.stringMatching(/ungraded/) });
  expect(q(h, '[data-practice]')).toHaveLength(1);
  expect((h.view.getByRole('spinbutton', { name: 'Total in cents' }) as HTMLInputElement).value).toBe('');
  expect(levers(h)).toEqual([]);
  write(h, 'Total in cents', '12'); check(h);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('m1');
  expect(demand(h)).toMatchObject({ coins: '3 pennies, 2 dimes' });
  expect((h.view.getByRole('spinbutton', { name: 'Total in cents' }) as HTMLInputElement).value).toBe('');
  write(h, 'Total in cents', '23'); check(h);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['m1', false, false], ['m1~smaller', true, true], ['m1', true, false]]);
  expect(attempts(h).at(-1)).toMatchObject({ assisted: true, levers: [FEWER_COINS_LEVER] });
  h.close();
});

it('count-like at Grade 1, values hidden: coin_values prints values, skip_strip runs past the total; a practice clears the tags', () => {
  const LIKE: CoinCounterChallenge = { id: 'l1', type: 'count', instruction: 'How much money is shown here?', countMode: 'like',
    displayedCoins: [{ type: 'nickel', count: 4 }], correctTotal: 20 };
  const h = mount('count-like', [LIKE], { gradeBand: '1', showCoinValues: false, showRunningTotal: false });
  expect(levers(h).map(l => l.id)).toEqual([COIN_VALUES_LEVER, SKIP_STRIP_LEVER, FEWER_COINS_LEVER]);
  for (let i = 1; i <= 4; i++) h.press(`Coin ${i}`);
  write(h, 'Total in cents', '4'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'counted_coins' });
  expect(h.view.container.textContent).not.toMatch(/5¢/);
  const values = h.dispatch('pull_lever', { lever: COIN_VALUES_LEVER });
  expect(values.state.task!.demand).toMatchObject({ coinValues: 'shown on each coin', onScreen: 'Each coin now shows its value.' });
  expect(h.view.container.textContent!.match(/5¢nickel/g)).toHaveLength(4);
  h.dispatch('pull_lever', { lever: SKIP_STRIP_LEVER });
  expect(q(h, '[data-lever="skip-strip"] [data-step]').map(s => s.textContent)).toEqual(['5', '10', '15', '20', '25', '30', '35', '40']);
  expect(String(demand(h).onScreen)).toMatch(/counting strip in steps of 5¢, from 5¢ to 40¢, with nothing marked/);
  // The tags made on the full item stay through Try again; an easier item starts untagged.
  h.dispatch('pull_lever', { lever: FEWER_COINS_LEVER });
  expect(demand(h)).toMatchObject({ coins: '3 nickels', learnerWork: expect.stringMatching(/^Not every coin tagged yet/) });
  expect(q(h, '[data-testid^="coin-count-badge"]')).toHaveLength(0);
  h.close();
});

it('identify: size_row lines the same coins up by size with no name, and two_coins asks for another coin', () => {
  const ID: CoinCounterChallenge = { id: 'i1', type: 'identify', instruction: 'Which coin is the penny?', targetCoin: 'penny',
    options: ['nickel', 'dime', 'penny'] };
  const h = mount('identify', [ID], { gradeBand: 'K' });
  h.press('Coin 2'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'dime_penny' });
  const receipt = h.dispatch('pull_lever', { lever: SIZE_ROW_LEVER });
  expect(receipt.status).toBe('committed');
  const row = q(h, '[data-lever="size-row"] button');
  expect(row.map(b => b.getAttribute('aria-label'))).toEqual(['Coin 2', 'Coin 3', 'Coin 1']);
  expect(q(h, '[data-lever="size-row"]')[0].textContent).toBe('');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/one shelf from smallest to biggest/);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/penny/);
  const practice = h.dispatch('pull_lever', { lever: TWO_COINS_LEVER });
  // Neither practice coin is the penny; the coin asked is the one nearest it in look.
  expect(practice.state.task).toMatchObject({ itemId: 'i1~smaller', task: 'Which coin is the nickel?' });
  expect(q(h, 'button[aria-label^="Coin "]')).toHaveLength(2);
  h.press('Coin 2'); check(h);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('i1');
  h.press('Coin 3'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'i1', correct: true, levers: [SIZE_ROW_LEVER, TWO_COINS_LEVER] });
  h.close();
});

it('make-change: change_bar draws only paid, cost and "?"; round_change keeps the payment and gives whole tens', () => {
  const CH: CoinCounterChallenge = { id: 'x1', type: 'make-change', instruction: 'You pay 50¢ for a 35¢ toy.', paidAmount: 50,
    itemCost: 35, correctChange: 15 };
  const h = mount('make-change', [CH]);
  write(h, 'Change in cents', '35'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'gave_cost' });
  expect(observerLever(h.state(), true)).toBe(CHANGE_BAR_LEVER);
  h.dispatch('pull_lever', { lever: CHANGE_BAR_LEVER });
  const bar = q(h, 'svg[data-lever="change-bar"]')[0];
  expect(Array.from(bar.querySelectorAll('text')).map(t => t.textContent).sort()).toEqual(['35¢', '50¢', '?']);
  expect(bar.querySelectorAll('line')).toHaveLength(2);
  expect(String(demand(h).onScreen)).not.toMatch(/15/);
  h.dispatch('pull_lever', { lever: ROUND_CHANGE_LEVER });
  expect(h.state().task).toMatchObject({ itemId: 'x1~smaller', task: 'You pay 50¢ for something that costs 40¢. How much change do you get?' });
  expect(demand(h)).toMatchObject({ paid: '50¢', itemCost: '40¢' });
  expect(q(h, 'svg[data-lever="change-bar"]')).toHaveLength(0);
  write(h, 'Change in cents', '10'); check(h);
  h.dispatch('advance');
  expect(demand(h)).toMatchObject({ itemCost: '35¢', learnerWork: 'No change typed yet' });
  expect(q(h, 'svg[data-lever="change-bar"]')).toHaveLength(1);
  write(h, 'Change in cents', '15'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'x1', correct: true, levers: [CHANGE_BAR_LEVER, ROUND_CHANGE_LEVER] });
  h.close();
});

it('make-amount: value_tags on the coins put in; the tier running total is already on and refuses a pull', () => {
  const MK: CoinCounterChallenge = { id: 'a1', type: 'make-amount', instruction: 'Make 16¢.', targetAmount: 16,
    availableCoins: ['penny', 'nickel', 'dime'] };
  const h = mount('make-amount', [MK]);
  expect(levers(h).find(l => l.id === 'running_total')!.pulled).toBe(true);
  h.press('Add a dime'); h.press('Add a nickel'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'one_coin_short' });
  const before = unchanged(h);
  expect(h.dispatch('pull_lever', { lever: 'running_total' }).status).toBe('blocked');
  expect(unchanged(h)).toBe(before);
  expect(observerLever(h.state(), true)).toBe(VALUE_TAGS_LEVER);
  h.dispatch('pull_lever', { lever: VALUE_TAGS_LEVER });
  expect(q(h, '[data-lever="value-tag"]').map(t => t.textContent)).toEqual(['10', '15']);
  expect(String(demand(h).onScreen)).toMatch(/small number/);
  h.dispatch('retry');
  h.press('Add a dime'); h.press('Add a nickel'); h.press('Add a penny'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: [VALUE_TAGS_LEVER] });
  h.close();
});
