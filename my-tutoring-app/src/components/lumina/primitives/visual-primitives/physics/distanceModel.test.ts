import { describe, expect, it } from 'vitest';
import { seeded } from './buoyancyModel';
import type { Tier } from './circuitModel';
import { MARKS, buildDistance, callAnswer, distanceFair, distanceMiss, makeDistance, pickDistance, readyToDecide, strongest } from './distanceModel';
import { buildCircuitWorkbench } from '../../../service/physics/circuit-workbench-generator';
import { validateCircuitWorkbenchData } from './circuitWorkbench.boss';
import { distanceScene } from './circuitWorkspace';
import { CIRCUIT_LEVERS, EASIER_LEVER, PULL_MARKS_LEVER, practiceItem } from './circuitLevers';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];
const none = { reach: null, calls: [], stronger: null };

describe('the distance model', () => {
  it('names each miss: past or short of the reach, a call against closer-is-stronger, the big magnet picked by size', () => {
    const r = makeDistance('r', 'reach', [{ size: 'big', reach: 3 }]);
    expect(distanceMiss(r, { ...none, reach: 3 })).toBeUndefined();
    expect(distanceMiss(r, { ...none, reach: 5 })).toBe('reach_too_far');
    expect(distanceMiss(r, { ...none, reach: 2 })).toBe('reach_too_near');
    const k = makeDistance('k', 'calls', [{ size: 'small', reach: 3 }], [{ known: 4, knownPull: true, ask: 2 }, { known: 3, knownPull: false, ask: 5 }]);
    expect(distanceFair(k)).toBe(true);
    expect(distanceMiss(k, { ...none, calls: [true, false] })).toBeUndefined();
    expect(distanceMiss(k, { ...none, calls: [true, true] })).toBe('farther_pulled');
    expect(distanceMiss(k, { ...none, calls: [false, false] })).toBe('nearer_not_pulled');
    const s = makeDistance('s', 'stronger', [{ size: 'big', reach: 2 }, { size: 'small', reach: 4 }]);
    expect(strongest(s)).toBe(1);
    expect(distanceMiss(s, { ...none, stronger: 0 })).toBe('judged_by_size');
    const b = makeDistance('b', 'stronger', [{ size: 'small', reach: 2 }, { size: 'big', reach: 4 }]);
    expect(distanceMiss(b, { ...none, stronger: 0 })).toBe('picked_weaker');
  });
  it('the question opens after every magnet is tried and a pull and a miss are seen', () => {
    const s = makeDistance('s', 'stronger', [{ size: 'big', reach: 2 }, { size: 'small', reach: 4 }]);
    expect(readyToDecide(s, [{ magnet: 0, mark: 1, pulled: true }, { magnet: 0, mark: 6, pulled: false }])).toBe(false);
    expect(readyToDecide(s, [{ magnet: 0, mark: 1, pulled: true }, { magnet: 1, mark: 6, pulled: false }])).toBe(true);
  });
});

describe('distance items', () => {
  it('every tier builds fair items that vary: easy a reach, medium a pull call and a miss call, hard a small and a big magnet', () => {
    for (const t of TIERS) for (let s = 1; s <= 30; s++) {
      const c = buildDistance(t, seeded(s), 'x');
      expect(distanceFair(c)).toBe(true);
      expect(c.ballStart!.every(m => m >= 2 && m < MARKS)).toBe(true);
      if (t === 'medium') expect(new Set(c.toCall.map(callAnswer)).size).toBe(2);
    }
    const seeds = Array.from({ length: 30 }, (_, s) => seeded(s + 1));
    expect(new Set(seeds.map(r => buildDistance('easy', r, 'x').magnets[0].reach)).size).toBeGreaterThanOrEqual(3);
    // The small magnet is sometimes the stronger one, and sometimes not.
    expect(new Set(Array.from({ length: 30 }, (_, s) => { const c = buildDistance('hard', seeded(s + 1), 'x'); return c.magnets[strongest(c)].size; })).size).toBe(2);
    for (const t of TIERS) {
      expect(pickDistance(3, t, seeded(2), 'd')).toHaveLength(3);
      expect(() => validateCircuitWorkbenchData(buildCircuitWorkbench({ gradeLevel: 'Grade 3', supportTier: t }, 5, ['magnet_distance']))).not.toThrow();
    }
  });
  it('the scene keeps answers out before a right check; levers: pull marks then easier', () => {
    for (const t of TIERS) {
      const c = buildDistance(t, seeded(4), 'h');
      const facts = JSON.stringify(distanceScene(c, { balls: [3, 3], tests: [{ magnet: 0, mark: 3, pulled: true }], reach: null, calls: [null, null], stronger: null, revealed: false }).facts);
      expect(facts).not.toContain('after the check');
      expect(facts).not.toMatch(/stronger \(|farthest mark is/);
      expect(CIRCUIT_LEVERS.declare(c, { powered: false }, []).map(l => l.id)).toEqual(t === 'easy' ? [PULL_MARKS_LEVER] : [PULL_MARKS_LEVER, EASIER_LEVER]);
      expect(nextLever(CIRCUIT_LEVERS.declare(c, { powered: false }, []), t === 'hard' ? 'judged_by_size' : t === 'medium' ? 'farther_pulled' : 'reach_too_far')).toBe(PULL_MARKS_LEVER);
    }
    const hard = buildDistance('hard', seeded(4), 'h');
    expect(practiceItem(practiceItem(hard)!)).toBeNull();
    expect(practiceItem(practiceItem(buildDistance('medium', seeded(4), 'm'))!)).toBeNull();
  });
});
