import { describe, expect, it } from 'vitest';
import { seeded } from './buoyancyModel';
import type { Tier } from './circuitModel';
import { buildMagnet, magnetByKey, magnetFair, magnetMiss, makeMagnet, metalNotIron, pickMagnets, pulled } from './magnetModel';
import { buildCircuitWorkbench } from '../../../service/physics/circuit-workbench-generator';
import { validateCircuitWorkbenchData } from './circuitWorkbench.boss';
import { magnetScene } from './circuitWorkspace';
import { CIRCUIT_LEVERS, EASIER_LEVER, MAGNET_TAGS_LEVER, practiceItem } from './circuitLevers';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];
const m = (k: string) => magnetByKey(k)!;

describe('the magnet model', () => {
  it('a magnet pulls iron and steel, not aluminium, copper or brass', () => {
    expect(pulled(m('nail'))).toBe(true);
    expect(pulled(m('foil'))).toBe(false);
    expect(pulled(m('brass-key'))).toBe(false);
    expect(metalNotIron(m('penny'))).toBe(true);
  });
  it('calling a non-iron metal pulled is "all metal sticks"', () => {
    const c = makeMagnet('x', [m('paper-clip'), m('foil'), m('eraser')], [m('nail'), m('penny')]);
    expect(magnetFair(c)).toBe(true);
    expect(magnetMiss(c, ['pulls', 'pulls'])).toBe('all_metal_sticks');
    expect(magnetMiss(c, ['stays', 'stays'])).toBe('sort_slip');
    expect(magnetMiss(c, ['pulls', 'stays'])).toBeUndefined();
  });
});

describe('magnet items', () => {
  it('every tier builds fair items; hard asks about two metals, one not iron', () => {
    for (const t of TIERS) for (let s = 1; s <= 15; s++) {
      const c = buildMagnet(t, seeded(s), 'x')!;
      expect(magnetFair(c)).toBe(true);
      if (t === 'hard') expect(c.toSort.some(metalNotIron) && c.toSort.some(pulled)).toBe(true);
    }
    for (const t of TIERS) {
      expect(pickMagnets(4, t, seeded(2), 'm')).toHaveLength(4);
      expect(() => validateCircuitWorkbenchData(buildCircuitWorkbench({ gradeLevel: 'Grade 3', supportTier: t }, 5, ['magnet_test']))).not.toThrow();
    }
  });
  it('the scene has no result for a thing to decide before a right check; levers: tags, then easier; no x-ray', () => {
    const c = buildMagnet('hard', seeded(4), 'h')!;
    const facts = JSON.stringify(magnetScene(c, { guesses: [], tested: c.tested.map(() => true), held: null, calls: [null, null], revealed: false }).facts);
    expect(facts).not.toContain('after the check');
    const ids = CIRCUIT_LEVERS.declare(c, { powered: true }, []).map(l => l.id);
    expect(ids).toEqual([MAGNET_TAGS_LEVER, EASIER_LEVER]);
    expect(nextLever(CIRCUIT_LEVERS.declare(c, { powered: true }, []), 'all_metal_sticks')).toBe(MAGNET_TAGS_LEVER);
    expect(practiceItem(practiceItem(c)!)).toBeNull();
  });
});
