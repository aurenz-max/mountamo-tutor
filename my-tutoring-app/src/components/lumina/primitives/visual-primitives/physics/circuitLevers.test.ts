import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { seeded } from './buoyancyModel';
import { reachedFromPlus, wire, type Tier } from './circuitModel';
import { CIRCUIT_LEVERS, EASIER_LEVER, XRAY_LEVER, practiceItem } from './circuitLevers';
import { CIRCUIT_MISSES_BY_MODE } from './circuitWorkbench.card';
import { buildCircuitWorkbench } from '../../../service/physics/circuit-workbench-generator';
import { validateCircuitWorkbenchData } from './circuitWorkbench.boss';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];
const MODES = Object.keys(CIRCUIT_MISSES_BY_MODE) as Array<keyof typeof CIRCUIT_MISSES_BY_MODE>;
const items = () => TIERS.flatMap(t => MODES.flatMap(m => buildCircuitWorkbench({ gradeLevel: 'Grade 4', supportTier: t }, 3, [m]).challenges));

describe('the x-ray reach', () => {
  it('stops where the path stops; goes through a bulb; reaches the − end only round a loop', () => {
    expect(reachedFromPlus(['red'], [wire('bat+', 'red.left')])).toEqual(['bat+', 'red.left', 'red.right']);
    expect(reachedFromPlus(['red'], [wire('bat+', 'red.left'), wire('red.right', 'bat-')])).toContain('bat-');
    expect(reachedFromPlus(['red'], [wire('bat+', 'red.left')], { burnt: ['red'] })).toEqual(['bat+', 'red.left']);
  });
});

describe('circuit levers', () => {
  it('x-ray once the battery is in, then the easier item; every miss of every mode is answered', () => {
    for (const c of items()) {
      // No circuit in a magnet test, so no x-ray: magnetModel.test.ts covers its levers.
      if (c.type === 'magnet_test') continue;
      const ids = CIRCUIT_LEVERS.declare(c, { powered: true }, []).map(l => l.id);
      expect(ids[0]).toBe(XRAY_LEVER);
      expect(CIRCUIT_LEVERS.declare(c, { powered: false }, []).map(l => l.id)).not.toContain(XRAY_LEVER);
      for (const miss of CIRCUIT_MISSES_BY_MODE[c.type]) {
        // Naming the wrong part after it lights, or the wrong parts on a device's table, is not about where the
        // electricity goes: the easier item answers those.
        const want = ['wrong_part_named', 'missing_part', 'extra_part'].includes(miss) ? EASIER_LEVER : XRAY_LEVER;
        if (want === EASIER_LEVER && !practiceItem(c)) continue;
        expect(nextLever(CIRCUIT_LEVERS.declare(c, { powered: true }, []), miss)).toBe(want);
      }
    }
  });

  it('the easier item is the same task, valid, simpler, and has no easier item of its own', () => {
    for (const c of items()) {
      const p = practiceItem(c);
      if (!p) continue;
      expect(p.type).toBe(c.type);
      expect(p.id).toBe(`${c.id}~easier`);
      expect(() => validateCircuitWorkbenchData({ title: 'x', challenges: [{ ...p, id: 'p' }] })).not.toThrow();
      expect(practiceItem(p)).toBeNull();
    }
    const medium = buildCircuitWorkbench({ gradeLevel: 'Grade 1', supportTier: 'medium' }, 1, ['find_the_break']).challenges[0];
    expect(CIRCUIT_LEVERS.declare(medium, { powered: true }, [XRAY_LEVER]).map(l => l.id)).toContain(EASIER_LEVER);
  });

  it('easy items start with the x-ray drawn; medium and hard do not', () => {
    expect(buildCircuitWorkbench({ gradeLevel: 'Kindergarten', supportTier: 'easy' }, seeded(1)() * 1e6).challenges.every(c => c.startLevers?.includes(XRAY_LEVER))).toBe(true);
    expect(buildCircuitWorkbench({ gradeLevel: 'Kindergarten', supportTier: 'medium' }, 2).challenges.some(c => c.startLevers)).toBe(false);
  });
});
