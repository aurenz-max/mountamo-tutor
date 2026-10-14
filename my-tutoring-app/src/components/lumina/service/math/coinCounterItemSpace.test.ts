import { describe, expect, it } from 'vitest';
import { TIER_BANDS, getItemSpace, tierPick } from '../itemSpace';
import { COIN_CENTS, type CoinKind } from '../itemSpace/money';
import { amountChallenges, changeChallenges, coinSetScope, compareChallenges, countChallenges } from './coinCounterItemSpace';
import type { CoinDef } from '../../primitives/visual-primitives/math/CoinCounter';

const tiers = Object.entries(TIER_BANDS) as ['easy' | 'medium' | 'hard', [number, number]][];
const value = (d?: CoinDef[]) => (d ?? []).reduce((s, c) => s + COIN_CENTS[c.type as CoinKind] * c.count, 0);
const coins = (d?: CoinDef[]) => (d ?? []).reduce((s, c) => s + c.count, 0);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const G2 = ['penny', 'nickel', 'dime', 'quarter', 'half-dollar', 'dollar'];
const G1 = ['penny', 'nickel', 'dime', 'quarter'];
const K = ['penny', 'nickel', 'dime'];

describe('coin-counter item-space adapter', () => {
  for (const like of [false, true]) {
    it(`count-${like ? 'like' : 'mixed'}: every tier fills distinct sets keyed to the coins; harder tiers mix more kinds`, () => {
      const scope = coinSetScope(like ? 'count-like' : 'count-mixed', G2, 99);
      const kinds: number[] = [];
      for (const [, band] of tiers) {
        const cs = countChallenges({ pick: tierPick(getItemSpace('coin-sets'), undefined, scope), band, count: 5, scope, like });
        expect(cs).toHaveLength(5);
        for (const c of cs) {
          expect(c.correctTotal).toBe(value(c.displayedCoins));
          expect(c.displayedCoins!.length === 1).toBe(like);
          expect(c.instruction).not.toMatch(/\d|penn|nickel|dime|quarter/i);
        }
        expect(new Set(cs.map((c) => c.correctTotal)).size).toBe(5);
        kinds.push(mean(cs.map((c) => c.displayedCoins!.length + (c.displayedCoins!.some((d) => d.type === 'quarter') ? 1 : 0))));
      }
      expect(kinds[0]).toBeLessThanOrEqual(kinds[2]);
    });
  }

  it('a K pool and a 20¢ ceiling keep every set to pennies, nickels and dimes', () => {
    const scope = coinSetScope('count-mixed', K, 20);
    for (const [, band] of tiers) {
      const cs = countChallenges({ pick: tierPick(getItemSpace('coin-sets'), undefined, scope), band, count: 5, scope, like: false });
      for (const c of cs) {
        expect(c.correctTotal!).toBeLessThanOrEqual(20);
        expect(c.displayedCoins!.every((d) => K.includes(d.type))).toBe(true);
      }
    }
  });

  it('compare: easy has the richer group holding more coins; hard has it holding fewer; sides alternate', () => {
    const scope = coinSetScope('compare', G1, 99);
    for (const [tier, band] of tiers) {
      const cs = compareChallenges({ pick: tierPick(getItemSpace('coin-sets'), undefined, scope), band, count: 5, scope, tier });
      expect(cs).toHaveLength(5);
      for (const c of cs) {
        const [a, b] = [value(c.groupA), value(c.groupB)];
        expect(c.correctGroup).toBe(a > b ? 'A' : 'B');
        const [rich, poor] = a > b ? [c.groupA, c.groupB] : [c.groupB, c.groupA];
        if (tier === 'easy') expect(coins(rich)).toBeGreaterThan(coins(poor));
        if (tier === 'hard') expect(coins(rich)).toBeLessThan(coins(poor));
      }
      expect(cs.map((c) => c.correctGroup).join('')).toMatch(/^(AB)+A?$|^(BA)+B?$/);
    }
  });

  for (const mode of ['make-amount', 'show-amount'] as const) {
    it(`${mode}: amounts are the fewest-coin sets' totals, never a single coin, stated in the ask`, () => {
      const scope = coinSetScope(mode, G1, 50);
      for (const [, band] of tiers) {
        const cs = amountChallenges({
          pick: tierPick(getItemSpace('coin-sets'), undefined, scope), band, count: 5, scope, mode, pool: G1 as any, things: ['a sticker'],
        });
        expect(cs).toHaveLength(5);
        for (const c of cs) {
          expect([1, 5, 10, 25]).not.toContain(c.targetAmount);
          expect(c.targetAmount!).toBeLessThanOrEqual(50);
          expect(c.instruction).toContain(`${c.targetAmount}¢`);
        }
      }
    });
  }

  it('make-change: pays with a quarter, two quarters or a dollar the pool holds; the key is the difference', () => {
    for (const [pool, paids] of [[G1, [25, 50]], [G2, [25, 50, 100]]] as const) {
      for (const [, band] of tiers) {
        const cs = changeChallenges({ pick: tierPick(getItemSpace('make-change')), band, count: 5, pool, things: ['a pencil'] });
        if (pool === G2) expect(cs).toHaveLength(5);
        for (const c of cs) {
          expect(paids as readonly number[]).toContain(c.paidAmount);
          expect(c.correctChange).toBe(c.paidAmount! - c.itemCost!);
          expect(c.instruction).toContain(`${c.itemCost}¢`);
          expect(c.instruction).not.toMatch(/75-cent coin/);
          if (pool === G1 && c.paidAmount === 50) expect(c.instruction).toContain('two quarters');
        }
      }
    }
    expect(coinSetScope('count-like', K, 20)({ coins: { quarter: 1, dime: 0, nickel: 0, penny: 0 } } as any)).toBe(false);
  });
});
