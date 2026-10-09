import { describe, expect, it } from 'vitest';
import {
  BALANCE_LEFT, LIFT_PAIRS, PALETTE, balanceSeatings, balanceTarget, judgeBalance, judgeLift, leverBand, leverChallenges,
  liftFulcrums, seatingKey, torquesAbout, isBalanced, type SeatedKid,
} from './leverLabBuild';

const kid = (seat: number, weight: number): SeatedKid => ({ seat, weight, icon: '' });
const left = [kid(-3, 2)]; // turns 6 on the left

describe('lever torque rule (lifted from the sandbox)', () => {
  it('sums weight x distance per side; a load on the fulcrum turns nothing', () => {
    expect(torquesAbout([{ position: 2, weight: 3 }, { position: 7, weight: 2 }, { position: 5, weight: 9 }], 5)).toEqual({ left: 9, right: 4 });
    expect(isBalanced({ left: 6, right: 6.05 })).toBe(true);
    expect(isBalanced({ left: 6, right: 6.2 })).toBe(false);
  });
});

describe('build_balance judge', () => {
  it('one over tips right, one under tips left', () => {
    expect(judgeBalance(left, [kid(2, 4)])).toEqual({ pass: false, miss: 'right_down', tilt: 1 });
    expect(judgeBalance(left, [kid(1, 2)])).toEqual({ pass: false, miss: 'left_down', tilt: -1 });
  });
  it('a heavy kid near the middle and two light kids far out both pass', () => {
    expect(judgeBalance(left, [kid(2, 3)]).pass).toBe(true);
    expect(judgeBalance(left, [kid(5, 1), kid(1, 1)]).pass).toBe(true);
  });
  it('the "different way" item refuses the seating that passed, in any order, and takes a new one', () => {
    const first = [kid(1, 1), kid(5, 1)];
    const prev = seatingKey(first);
    expect(judgeBalance(left, [kid(5, 1), kid(1, 1)], prev)).toEqual({ pass: false, miss: 'same_way', tilt: 0 });
    expect(judgeBalance(left, [kid(3, 2)], prev).pass).toBe(true);
    // A seating that tips is named for the tip, not as the same way.
    expect(judgeBalance(left, [kid(5, 2)], prev).miss).toBe('right_down');
  });
});

describe('build_lift judge', () => {
  it('passes when the lighter helper across the fulcrum turns at least as much as the rock', () => {
    expect(judgeLift(6, 2, { fulcrum: 2, pusherAt: 10 })).toEqual({ pass: true, miss: null, tilt: 1 });
    expect(judgeLift(6, 2, { fulcrum: 1, pusherAt: 4 })?.pass).toBe(true); // 2 x 3 = 6 x 1
  });
  it('names a helper too close (too weak) and a helper on the rock side', () => {
    expect(judgeLift(6, 2, { fulcrum: 4, pusherAt: 10 })?.miss).toBe('too_weak');
    expect(judgeLift(6, 2, { fulcrum: 1, pusherAt: 3 })?.miss).toBe('too_weak'); // 2 x 2 < 6
    expect(judgeLift(6, 2, { fulcrum: 3, pusherAt: 2 })?.miss).toBe('same_side');
  });
  it('the "different way" item asks for a new fulcrum spot; an unfinished build is not checked', () => {
    expect(judgeLift(6, 2, { fulcrum: 2, pusherAt: 9 }, 2)?.miss).toBe('same_way');
    expect(judgeLift(6, 2, { fulcrum: 1, pusherAt: 9 }, 2)?.pass).toBe(true);
    expect(judgeLift(6, 2, { fulcrum: null, pusherAt: 9 })).toBeNull();
    expect(judgeLift(6, 2, { fulcrum: 3, pusherAt: 3 })).toBeNull();
  });
});

describe('targets: many makes pass', () => {
  it('every balance left side levels at least four right-side seatings with the band palette', () => {
    for (const band of ['K-2', '3-5'] as const) {
      for (const l of BALANCE_LEFT[band]) {
        const target = l.reduce((s, [seat, w]) => s + w * -seat, 0);
        expect(balanceSeatings(target, PALETTE[band]).length, `${band} ${JSON.stringify(l)}`).toBeGreaterThanOrEqual(4);
      }
    }
  });
  it('every lift pair has a lighter helper and at least two fulcrum spots that lift it', () => {
    for (const band of ['K-2', '3-5'] as const) {
      for (const [rock, helper] of LIFT_PAIRS[band]) {
        expect(helper).toBeLessThan(rock);
        expect(liftFulcrums(rock, helper).length).toBeGreaterThanOrEqual(2);
      }
    }
  });
  it('a single-mode session is a build, the same target a different way, then a new target', () => {
    for (let seed = 0; seed < 20; seed++) {
      let x = seed + 1;
      const rand = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
      const s = leverChallenges(['build_balance'], seed % 2 ? 'K-2' : '3-5', rand);
      expect(s.map(c => c.type)).toEqual(['build_balance', 'build_balance', 'build_balance']);
      expect(s[1].differentFrom).toBe(s[0].id);
      expect(s[1].given).toEqual(s[0].given);
      expect(balanceTarget(s[2])).not.toBe(-1);
      expect(s[2].differentFrom).toBeUndefined();
      // The ask names no seat and no weight: those are the build.
      expect(s.every(c => !/\d/.test(c.instruction))).toBe(true);
      const l = leverChallenges(['build_lift'], '3-5', rand);
      expect(l).toHaveLength(3);
      expect(l[1].differentFrom).toBe(l[0].id);
      expect(new Set(l.map(c => c.id)).size).toBe(3);
    }
    const blend = leverChallenges(['build_balance', 'build_lift'], '3-5');
    expect(blend.map(c => c.type)).toEqual(['build_balance', 'build_balance', 'build_lift', 'build_lift']);
  });
  it('bands from the grade', () => {
    expect(leverBand('K')).toBe('K-2');
    expect(leverBand('2')).toBe('K-2');
    expect(leverBand('4')).toBe('3-5');
    expect(leverBand(undefined, 'Kindergarten')).toBe('K-2');
    expect(leverBand(undefined, 'elementary')).toBe('3-5');
  });
});
