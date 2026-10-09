/**
 * coin-counter levers (`coinCounterLevers.ts`): each leak rule, each easier-item builder over many random items, the
 * miss → lever table, and that every miss the catalog lists for a mode is answered on every saved payload item.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { CoinCounterChallenge, CoinDef, CoinType } from './CoinCounter';
import { COIN_CENTS, fewestCoins } from './coinCounterWorkspace';
import {
  CHANGE_BAR_LEVER, COIN_VALUES_LEVER, FEWER_COINS_LEVER, PLAINER_GROUPS_LEVER, ROUND_CHANGE_LEVER, RUNNING_TOTAL_LEVER,
  SIZE_ROW_LEVER, SKIP_STRIP_LEVER, SMALLER_LEVER, SORT_LEVER, TWO_COINS_LEVER, VALUE_TAGS_LEVER,
  changeBar, changeBarLabels, coinCounterLevers, fewerCoins, fewerLeaks, leverFacts, plainerGroups, plainerLeaks, practiceItem,
  practiceParent, roundChange, roundLeaks, sizeOrder, skipStrip, smallerAmount, sortedRows, stripLeaks, twoCoins, twoCoinsLeaks,
} from './coinCounterLevers';

const COINS: CoinType[] = ['penny', 'nickel', 'dime', 'quarter', 'half-dollar', 'dollar'];
const sum = (g: readonly CoinDef[] = []) => g.reduce((s, c) => s + COIN_CENTS[c.type] * c.count, 0);
const ids = (levers: { id: string }[]) => levers.map(l => l.id);
const view = (valuesShown = true, runningTotalShown = false, enactedTap = false) => ({ valuesShown, runningTotalShown, enactedTap });

let seed = 7;
const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
const pickKinds = (k: number, pool = COINS.slice(0, 4)) => [...pool].sort(() => rnd(3) - 1).slice(0, k);
const randomCoins = (kinds: number, pool?: CoinType[]): CoinDef[] => pickKinds(kinds, pool).map(type => ({ type, count: 1 + rnd(4) }));

const identify = (targetCoin: CoinType, options: CoinType[]): CoinCounterChallenge =>
  ({ id: 'i', type: 'identify', instruction: `Which coin is the ${targetCoin}?`, targetCoin, options });
const count = (displayedCoins: CoinDef[], countMode: 'like' | 'mixed' = displayedCoins.length > 1 ? 'mixed' : 'like'): CoinCounterChallenge =>
  ({ id: 'c', type: 'count', instruction: 'How much money is shown here?', displayedCoins, correctTotal: sum(displayedCoins), countMode });
const compare = (groupA: CoinDef[], groupB: CoinDef[]): CoinCounterChallenge => ({ id: 'p', type: 'compare',
  instruction: 'Which group has more money?', groupA, groupB, correctGroup: sum(groupA) === sum(groupB) ? 'equal' : sum(groupA) > sum(groupB) ? 'A' : 'B' });
const make = (targetAmount: number, availableCoins: CoinType[] = ['penny', 'nickel', 'dime', 'quarter'], instruction = `Make ${targetAmount}¢.`):
  CoinCounterChallenge => ({ id: 'm', type: 'make-amount', instruction, targetAmount, availableCoins });
const change = (paidAmount: number, itemCost: number): CoinCounterChallenge => ({ id: 'x', type: 'make-change',
  instruction: `You pay ${paidAmount}¢ for a ${itemCost}¢ toy.`, paidAmount, itemCost, correctChange: paidAmount - itemCost });

describe('identify', () => {
  it('the size row reads only the options: smallest first, every option once, the same whatever coin is asked', () => {
    expect(sizeOrder(['penny', 'nickel', 'dime', 'quarter']).map(i => ['penny', 'nickel', 'dime', 'quarter'][i]))
      .toEqual(['dime', 'penny', 'nickel', 'quarter']);
    const options: CoinType[] = ['quarter', 'dime', 'nickel'];
    for (const target of options) {
      const levers = coinCounterLevers(identify(target, options), []);
      expect(ids(levers)).toEqual([SIZE_ROW_LEVER, TWO_COINS_LEVER]);
      expect(levers.map(l => `${l.when} ${l.does}`).join(' ')).not.toMatch(new RegExp(target, 'i'));
    }
  });
  it('two_coins: over every target and option set, another coin between two coins, neither the asked one', () => {
    for (let n = 0; n < 300; n++) {
      const options = pickKinds(3 + rnd(2), COINS), target = options[rnd(options.length)];
      const c = identify(target, options), p = twoCoins(c)!;
      expect(p).toMatchObject({ id: 'i~smaller', type: 'identify' });
      expect(p.options).toHaveLength(2);
      expect(twoCoinsLeaks(p, c)).toBe(false);
      expect(p.instruction).toBe(`Which coin is the ${p.targetCoin}?`);
    }
    // Two options: already the plainest; the size row stays.
    expect(twoCoins(identify('dime', ['dime', 'nickel']))).toBeNull();
    expect(ids(coinCounterLevers(identify('dime', ['dime', 'nickel']), []))).toEqual([SIZE_ROW_LEVER]);
    // Leak rule: asking for the item's coin, or showing it, leaks.
    const c = identify('nickel', ['penny', 'nickel', 'dime']);
    expect(twoCoinsLeaks({ ...twoCoins(c)!, targetCoin: 'nickel', options: ['nickel', 'penny'] }, c)).toBe(true);
    expect(twoCoinsLeaks({ ...twoCoins(c)!, options: ['dime', 'nickel'] }, c)).toBe(true);
  });
});

describe('count', () => {
  it('skip_strip: over random like sets, steps of one coin, past the total, never on mixed coins or one coin', () => {
    for (let n = 0; n < 200; n++) {
      const c = count([{ type: COINS[rnd(4)], count: 2 + rnd(8) }]);
      const strip = skipStrip(c)!;
      expect(stripLeaks(strip, c)).toBe(false);
      expect(strip.at(-1)!).toBeGreaterThanOrEqual(c.correctTotal! + 3 * strip[0]);
    }
    expect(skipStrip(count([{ type: 'dime', count: 1 }, { type: 'penny', count: 2 }]))).toBeNull();
    expect(skipStrip(count([{ type: 'dime', count: 1 }]))).toBeNull();
    // A strip ending at the total leaks.
    expect(stripLeaks([5, 10, 15, 20], count([{ type: 'nickel', count: 4 }]))).toBe(true);
  });
  it('sort_coins: one row per kind, by worth only when values are on screen', () => {
    const coins: CoinDef[] = [{ type: 'penny', count: 2 }, { type: 'quarter', count: 1 }, { type: 'penny', count: 1 }];
    expect(sortedRows(coins, true)).toEqual([{ type: 'quarter', count: 1 }, { type: 'penny', count: 3 }]);
    expect(sortedRows(coins, false)).toEqual([{ type: 'penny', count: 3 }, { type: 'quarter', count: 1 }]);
  });
  it('fewer_coins: over random items, fewer coins of the same kinds, same mode, never the item total or half of it', () => {
    for (let n = 0; n < 400; n++) {
      const like = rnd(2) === 0;
      const c = count(like ? [{ type: COINS[rnd(4)], count: 1 + rnd(9) }] : randomCoins(2 + rnd(3)), like ? 'like' : 'mixed');
      const p = fewerCoins(c);
      const total = c.displayedCoins!.reduce((s, x) => s + x.count, 0);
      if (total <= 2) { expect(p).toBeNull(); continue; }
      expect(p).not.toBeNull();
      expect(fewerLeaks(p!, c)).toBe(false);
      expect(p!.correctTotal).toBe(sum(p!.displayedCoins));
      expect(p!.countMode).toBe(c.countMode);
      // A mixed item stays mixed (the mode floor); a like item stays one kind.
      expect(new Set(p!.displayedCoins!.map(x => x.type)).size).toBe(like ? 1 : 2);
    }
    expect(fewerCoins(count([{ type: 'nickel', count: 4 }]))!.displayedCoins).toEqual([{ type: 'nickel', count: 3 }]);
  });
  it('levers by band and tier: the strip is off where the taps already count, values only when hidden', () => {
    const like = count([{ type: 'nickel', count: 4 }]);
    expect(ids(coinCounterLevers(like, [], view()))).toEqual([SKIP_STRIP_LEVER, FEWER_COINS_LEVER]);
    expect(ids(coinCounterLevers(like, [], view(false)))).toEqual([COIN_VALUES_LEVER, SKIP_STRIP_LEVER, FEWER_COINS_LEVER]);
    expect(ids(coinCounterLevers(like, [], view(true, false, true)))).toEqual([FEWER_COINS_LEVER]);
    expect(ids(coinCounterLevers(count([{ type: 'dime', count: 1 }, { type: 'penny', count: 3 }]), []))).toEqual([SORT_LEVER, FEWER_COINS_LEVER]);
    // One coin: no value label (it would be the total), no strip.
    expect(ids(coinCounterLevers(count([{ type: 'dime', count: 1 }]), [], view(false)))).toEqual([]);
  });
});

describe('compare', () => {
  it('plainer_groups: over random items, one coin against a few, fewer coins, always a winner, never the item', () => {
    for (let n = 0; n < 400; n++) {
      const c = compare(randomCoins(1 + rnd(2)), randomCoins(1 + rnd(2)));
      const p = plainerGroups(c);
      const coins = [...c.groupA!, ...c.groupB!].reduce((s, x) => s + x.count, 0);
      if (coins <= 2) { expect(p).toBeNull(); continue; }
      if (!p) continue;
      expect(plainerLeaks(p, c)).toBe(false);
      expect(p.correctGroup).not.toBe('equal');
      expect(p.groupA!.length + p.groupB!.length).toBe(2);
    }
    // Three pennies and a nickel against a penny and two nickels: three pennies against one nickel.
    expect(plainerGroups(compare([{ type: 'penny', count: 3 }, { type: 'nickel', count: 1 }], [{ type: 'penny', count: 1 }, { type: 'nickel', count: 2 }])))
      .toMatchObject({ groupA: [{ type: 'penny', count: 3 }], groupB: [{ type: 'nickel', count: 1 }], correctGroup: 'B' });
    // Three coins: one against one, the smaller coin worth more first.
    expect(plainerGroups(compare([{ type: 'nickel', count: 2 }], [{ type: 'dime', count: 1 }])))
      .toMatchObject({ groupA: [{ type: 'nickel', count: 1 }], groupB: [{ type: 'dime', count: 1 }] });
  });
  it('sort_coins only where a group holds more than one kind', () => {
    expect(ids(coinCounterLevers(compare([{ type: 'penny', count: 3 }], [{ type: 'dime', count: 1 }]), []))).toEqual([PLAINER_GROUPS_LEVER]);
    expect(ids(coinCounterLevers(compare([{ type: 'penny', count: 3 }, { type: 'nickel', count: 1 }], [{ type: 'dime', count: 1 }]), [])))
      .toEqual([SORT_LEVER, PLAINER_GROUPS_LEVER]);
  });
});

describe('make-amount and fewest-coins', () => {
  it('smaller_amount: about half, made from the coins offered, the fewest ask kept', () => {
    for (let t = 3; t <= 99; t++) {
      const available = rnd(2) ? ['penny', 'nickel', 'dime', 'quarter'] as CoinType[] : ['nickel', 'dime', 'quarter'] as CoinType[];
      if (!fewestCoins(t, available)) continue;
      const p = smallerAmount(make(t, available));
      if (!p) continue;
      expect(p.targetAmount!).toBeLessThan(t);
      expect(fewestCoins(p.targetAmount!, available)).not.toBeNull();
    }
    expect(smallerAmount(make(42, undefined, 'Make 42¢ with the fewest coins.'))!.instruction).toBe('Make 21¢ with the fewest coins you can.');
    expect(smallerAmount(make(35, ['nickel', 'dime', 'quarter']))!.targetAmount).toBe(15);
  });
  it('the tier running total starts pulled and is not offered again; value tags still answer every miss', () => {
    const levers = coinCounterLevers(make(22), [], view(true, true));
    expect(levers.map(l => [l.id, l.pulled])).toEqual([[RUNNING_TOTAL_LEVER, true], [VALUE_TAGS_LEVER, false], [SMALLER_LEVER, false]]);
    expect(nextLever(levers, 'one_coin_short')).toBe(VALUE_TAGS_LEVER);
  });
});

describe('make-change', () => {
  it('change_bar: its only numbers are the paid amount and the cost', () => {
    const bar = changeBar(change(75, 40))!;
    expect(bar.ticks).toEqual([45, 50, 55, 60, 65, 70]);
    expect(changeBarLabels(bar)).toEqual(['40¢', '75¢', '?']);
    expect(changeBar(change(37, 12))!.ticks).toEqual([15, 20, 25, 30, 35]);
  });
  it('round_change: the same payment, change in whole tens, never the item change; plainest at 10¢', () => {
    for (let n = 0; n < 300; n++) {
      const paid = [25, 50, 75, 100][rnd(4)], cost = 1 + rnd(paid - 1), c = change(paid, cost);
      const p = roundChange(c);
      if (!p) { expect(paid - cost === 10 || paid <= 20 || (paid - cost) % 10 === 0).toBe(true); continue; }
      expect(roundLeaks(p, c)).toBe(false);
      expect(p.correctChange! % 10).toBe(0);
    }
    expect(roundChange(change(25, 10))).toMatchObject({ paidAmount: 25, itemCost: 15, correctChange: 10 });
    expect(roundChange(change(50, 20))).toMatchObject({ itemCost: 30, correctChange: 20 });
    expect(roundChange(change(25, 15))).toBeNull();
  });
});

describe('the miss → lever table', () => {
  it.each([
    ['identify', identify('nickel', ['penny', 'nickel', 'dime']), 'dime_nickel', [], SIZE_ROW_LEVER],
    ['identify', identify('nickel', ['penny', 'nickel', 'dime']), 'dime_nickel', [SIZE_ROW_LEVER], TWO_COINS_LEVER],
    ['count-like', count([{ type: 'nickel', count: 4 }]), 'counted_coins', [], SKIP_STRIP_LEVER],
    ['count-like', count([{ type: 'nickel', count: 4 }]), 'counted_coins', [SKIP_STRIP_LEVER], FEWER_COINS_LEVER],
    ['count-mixed', count([{ type: 'dime', count: 2 }, { type: 'penny', count: 3 }]), 'all_one_kind', [], SORT_LEVER],
    ['count-mixed', count([{ type: 'dime', count: 2 }, { type: 'penny', count: 3 }]), 'one_coin_short', [SORT_LEVER], FEWER_COINS_LEVER],
    ['compare', compare([{ type: 'penny', count: 4 }, { type: 'nickel', count: 1 }], [{ type: 'dime', count: 1 }]), 'more_coins', [], SORT_LEVER],
    ['compare', compare([{ type: 'penny', count: 4 }, { type: 'nickel', count: 1 }], [{ type: 'dime', count: 1 }]), 'more_coins', [SORT_LEVER], PLAINER_GROUPS_LEVER],
    ['make-amount', make(22), 'one_coin_over', [], RUNNING_TOTAL_LEVER],
    ['make-amount', make(22), 'counted_coins', [], VALUE_TAGS_LEVER],
    ['make-amount', make(22), 'over', [VALUE_TAGS_LEVER], SMALLER_LEVER],
    ['make-change', change(50, 35), 'gave_cost', [], CHANGE_BAR_LEVER],
    ['make-change', change(50, 35), 'added', [CHANGE_BAR_LEVER], ROUND_CHANGE_LEVER],
  ] as const)('%s: after %s with %j pulled → %s', (_mode, c, miss, pulled, want) => {
    expect(nextLever(coinCounterLevers(c as CoinCounterChallenge, pulled as readonly string[]), miss)).toBe(want);
  });
});

it('practice items: the parent is found from the id; facts never state the key', () => {
  const items = [identify('nickel', ['penny', 'nickel', 'dime']), count([{ type: 'nickel', count: 4 }]),
    compare([{ type: 'penny', count: 4 }], [{ type: 'dime', count: 1 }]), make(22), change(75, 40)];
  for (const c of items) {
    const p = practiceItem(c)!;
    expect(practiceParent(p.id, items.map(x => x === c ? x : { ...x, id: `${x.id}-other` }))).toBe(c);
    expect(practiceItem(p)).toBeNull();
    const facts = leverFacts(c, coinCounterLevers(c, [], view(false)).map(l => l.id), view(false));
    if (c.type === 'make-change') expect(facts).not.toMatch(/35/);
    if (c.type === 'count') expect(facts).not.toMatch(/\b20¢/);
    if (c.type === 'compare') expect(facts).not.toMatch(/group [AB]|more money/i);
    if (c.type === 'identify') expect(facts).not.toMatch(/nickel/);
  }
});

it('every miss the catalog lists for a mode is answered by a lever on every saved payload item (J9, per item)', async () => {
  const entry = getComponentById('coin-counter')!;
  const misses = entry.teachingWorkspace!.misses!;
  for (const mode of ['identify', 'count-like', 'count-mixed', 'compare', 'make-amount', 'fewest-coins', 'make-change', 'show-amount']) {
    const payload = await import(`../../../components/live-activity/runtime/testing/w1-payloads/coin-counter.${mode}.json`);
    const data = (payload.default ?? payload).data;
    for (const c of data.challenges as CoinCounterChallenge[]) {
      const levers = coinCounterLevers(c, [], view(data.showCoinValues ?? true, data.showRunningTotal ?? true,
        data.gradeBand === 'K' && c.type === 'count' && c.countMode === 'like'));
      for (const m of misses[mode]) expect(levers.some(l => !l.pulled && l.answers?.includes(m)), `${mode} ${c.id} ${m}`).toBe(true);
    }
  }
});
