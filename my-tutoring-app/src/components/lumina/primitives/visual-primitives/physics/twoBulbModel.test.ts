import { describe, expect, it } from 'vitest';
import { seeded } from './buoyancyModel';
import { evaluate, wire, type Tier, type Wire } from './circuitModel';
import { arrangementOf, makeTwoBulb, pickTwoBulbs, twoBulbMiss, twoBulbStarts } from './twoBulbModel';
import { buildCircuitWorkbench } from '../../../service/physics/circuit-workbench-generator';
import { validateCircuitWorkbenchData } from './circuitWorkbench.boss';
import { twoBulbScene } from './circuitWorkspace';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];
const row: Wire[] = [wire('bat+', 'red.left'), wire('red.right', 'blue.left'), wire('blue.right', 'bat-')];
const side: Wire[] = [wire('bat+', 'red.left'), wire('bat+', 'blue.left'), wire('red.right', 'bat-'), wire('blue.right', 'bat-')];

describe('the two-bulb model', () => {
  it('in a row both are dim and one out puts both out; side by side both are bright and one out leaves the other', () => {
    expect(evaluate(['red', 'blue'], row)).toMatchObject({ lit: ['red', 'blue'], dim: ['red', 'blue'] });
    expect(evaluate(['red', 'blue'], row, { burnt: ['red'] }).lit).toEqual([]);
    expect(evaluate(['red', 'blue'], side).dim).toBeUndefined();
    expect(evaluate(['red', 'blue'], side, { burnt: ['red'] }).lit).toEqual(['blue']);
    expect(arrangementOf(row)).toBe('row');
    expect(arrangementOf(side)).toBe('side_by_side');
  });

  it('names the miss', () => {
    const c = makeTwoBulb('t', 'side_by_side', []);
    expect(twoBulbMiss(c, row)).toBe('made_a_row');
    expect(twoBulbMiss(makeTwoBulb('r', 'row', []), side)).toBe('made_side_by_side');
    expect(twoBulbMiss(c, [wire('bat+', 'red.left'), wire('red.right', 'bat-')])).toBe('not_both_lit');
    expect(twoBulbMiss(c, [...side, wire('bat+', 'bat-')])).toBe('short_circuit');
    expect(twoBulbMiss(c, side)).toBeUndefined();
  });
});

describe('two-bulb items', () => {
  it('no start already matches; the generator builds valid sessions', () => {
    for (const t of TIERS) {
      for (const { arrangement, start } of twoBulbStarts(t)) expect(arrangementOf(start)).not.toBe(arrangement);
      expect(pickTwoBulbs(4, t, seeded(1), 't')).toHaveLength(4);
      expect(() => validateCircuitWorkbenchData(buildCircuitWorkbench({ gradeLevel: 'Grade 4', supportTier: t }, 4, ['two_bulbs']))).not.toThrow();
    }
  });

  it('the scene says how brightly each bulb glows and which is taken out, never the arrangement asked for as done', () => {
    const facts = JSON.stringify(twoBulbScene(makeTwoBulb('t', 'row', []), { guess: null, powered: true, wires: row, out: [] }).facts);
    expect(facts).toContain('the red bulb is lit, dimly');
    const out = JSON.stringify(twoBulbScene(makeTwoBulb('t', 'row', []), { guess: null, powered: true, wires: row, out: ['blue'] }).facts);
    expect(out).toContain('the blue bulb is taken out');
    expect(out).toContain('nothing is lit');
  });
});
