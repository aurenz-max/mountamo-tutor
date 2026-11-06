import { describe, expect, it } from 'vitest';
import { seeded } from './buoyancyModel';
import type { Tier } from './circuitModel';
import { buildPoles, makePoles, pairResult, pickPoles, poleResult, polesFair, polesMiss } from './poleModel';
import { buildCircuitWorkbench } from '../../../service/physics/circuit-workbench-generator';
import { validateCircuitWorkbenchData } from './circuitWorkbench.boss';
import { poleScene } from './circuitWorkspace';
import { CIRCUIT_LEVERS, EASIER_LEVER, POLE_TAGS_LEVER, practiceItem } from './circuitLevers';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];

describe('the pole model', () => {
  it('different ends pull together, the same ends push apart', () => {
    expect(poleResult('N', 'S')).toBe('pull');
    expect(poleResult('S', 'S')).toBe('push');
  });
  it('a same-ends pair called a pull is "like ends pull"; a wrong pole on a striped magnet is "mystery backwards"', () => {
    const c = makePoles('x', 'N', [{ a: { kind: 'ring', end: 'N' }, b: { kind: 'bar', end: 'N' } }, { a: { kind: 'horseshoe', end: 'S' }, b: { kind: 'bar', end: 'N' } }]);
    expect(polesFair(c)).toBe(true);
    expect(polesMiss(c, { calls: ['pull', 'pull'], striped: null })).toBe('like_ends_pull');
    expect(polesMiss(c, { calls: ['push', 'push'], striped: null })).toBe('unlike_ends_push');
    expect(polesMiss(c, { calls: ['push', 'pull'], striped: null })).toBeUndefined();
    const m = makePoles('m', 'S', [], 'N');
    expect(polesMiss(m, { calls: [], striped: 'S' })).toBe('mystery_backwards');
    expect(polesMiss(m, { calls: [], striped: 'N' })).toBeUndefined();
  });
});

describe('pole items', () => {
  it('every tier builds fair items: easy one bar pair, medium a pull and a push on other magnets, hard a striped magnet', () => {
    for (const t of TIERS) for (let s = 1; s <= 20; s++) {
      const c = buildPoles(t, seeded(s), 'x');
      expect(polesFair(c)).toBe(true);
      if (t === 'easy') expect(c.toCall).toHaveLength(1);
      if (t === 'medium') expect(new Set(c.toCall.map(pairResult)).size).toBe(2);
      if (t === 'hard') expect(c.mystery && c.toCall.length === 0).toBe(true);
    }
    // The first slide is not always a push.
    expect(new Set(Array.from({ length: 20 }, (_, s) => { const c = buildPoles('medium', seeded(s + 1), 'x'); return c.bStart === c.aEnd; })).size).toBe(2);
    // Easy varies its answer across seeds.
    expect(new Set(Array.from({ length: 20 }, (_, s) => pairResult(buildPoles('easy', seeded(s + 1), 'x').toCall[0]))).size).toBe(2);
    for (const t of TIERS) {
      expect(pickPoles(4, t, seeded(2), 'p')).toHaveLength(4);
      expect(() => validateCircuitWorkbenchData(buildCircuitWorkbench({ gradeLevel: 'Grade 3', supportTier: t }, 5, ['magnet_poles']))).not.toThrow();
    }
  });
  it('the scene keeps answers out before a right check; levers: tags then easier, no tags on a striped magnet', () => {
    const c = buildPoles('medium', seeded(4), 'h');
    const facts = JSON.stringify(poleScene(c, { facing: c.aEnd, tests: [], calls: [null, null], striped: null, revealed: false }).facts);
    expect(facts).not.toContain('after the check');
    expect(CIRCUIT_LEVERS.declare(c, { powered: false }, []).map(l => l.id)).toEqual([POLE_TAGS_LEVER, EASIER_LEVER]);
    expect(nextLever(CIRCUIT_LEVERS.declare(c, { powered: false }, []), 'like_ends_pull')).toBe(POLE_TAGS_LEVER);
    const m = makePoles('m', 'S', [], 'N');
    const mFacts = JSON.stringify(poleScene(m, { facing: 'N', tests: [{ facing: 'N', result: 'pull' }], calls: [], striped: null, revealed: false }).facts);
    expect(mFacts).not.toMatch(/striped end is/);
    expect(CIRCUIT_LEVERS.declare(m, { powered: false }, []).map(l => l.id)).toEqual([EASIER_LEVER]);
    expect(practiceItem(practiceItem(c)!)).toBeNull();
    expect(practiceItem(buildPoles('easy', seeded(1), 'e'))).toBeNull();
  });
});
