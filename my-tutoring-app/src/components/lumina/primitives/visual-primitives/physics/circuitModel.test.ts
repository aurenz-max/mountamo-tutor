import { describe, expect, it } from 'vitest';
import { seeded } from './buoyancyModel';
import {
  describeCircuit, evaluate, goalMet, lightItFeedback, lightItMiss, makeLightIt, pickLightIt, wire, type Tier, type Wire,
} from './circuitModel';
import { buildCircuitWorkbench } from '../../../service/physics/circuit-workbench-generator';
import { validateCircuitWorkbenchData } from './circuitWorkbench.boss';
import { circuitScene } from './circuitWorkspace';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];
const loop: Wire[] = [wire('bat+', 'red.left'), wire('red.right', 'bat-')];

describe('the circuit model', () => {
  it('a closed loop through the bulb lights it; one wire, both clips on one end, and a short do not', () => {
    expect(evaluate(['red'], loop)).toEqual({ lit: ['red'], short: false });
    expect(evaluate(['red'], [wire('bat+', 'red.left')]).lit).toEqual([]);
    expect(evaluate(['red'], [wire('bat+', 'red.left'), wire('bat+', 'red.right')]).lit).toEqual([]);
    expect(evaluate(['red'], [...loop, wire('bat+', 'bat-')])).toEqual({ lit: [], short: true });
  });

  it('two bulbs: each in its own loop lights; in a row both light; a bulb left off the loop stays off', () => {
    const series: Wire[] = [wire('bat+', 'red.left'), wire('red.right', 'blue.left'), wire('blue.right', 'bat-')];
    expect(evaluate(['red', 'blue'], series).lit).toEqual(['red', 'blue']);
    expect(evaluate(['red', 'blue'], [...loop, wire('bat+', 'blue.left')]).lit).toEqual(['red']);
  });

  it('names the miss and never says which wire closes the loop', () => {
    const c = makeLightIt('l', ['red'], 'red', [wire('bat+', 'red.left')]);
    expect(lightItMiss(c, c.start)).toBe('open_loop');
    expect(lightItMiss(c, [wire('bat+', 'red.left'), wire('bat+', 'red.right')])).toBe('both_on_one_end');
    expect(lightItMiss(c, [...loop, wire('bat+', 'bat-')])).toBe('short_circuit');
    expect(lightItMiss(c, loop)).toBeUndefined();
    const two = makeLightIt('t', ['red', 'blue'], 'red', []);
    expect(lightItMiss(two, [wire('bat+', 'blue.left'), wire('blue.right', 'bat-')])).toBe('wrong_bulb');
    expect(lightItMiss(two, [wire('bat+', 'red.left'), wire('red.right', 'blue.left'), wire('blue.right', 'bat-')])).toBe('lit_both');
    expect(lightItFeedback(c, c.start)).not.toMatch(/right clip|− end/);
    expect(describeCircuit(c, c.start)).toBe("a wire from the battery's + end to the bulb's left clip: nothing lit");
  });
});

describe('light_it items by tier', () => {
  it('no item lights its target from the start; easy has one wire on, hard two bulbs; every item can be solved', () => {
    for (const t of TIERS) for (let s = 1; s <= 20; s++) for (const c of pickLightIt(5, t, seeded(s), 'x')) {
      expect(goalMet(c, c.start)).toBe(false);
      if (t === 'easy') { expect(c.start).toHaveLength(1); expect(c.bulbs).toEqual(['red']); }
      if (t === 'hard') expect(c.bulbs).toHaveLength(2);
      const [l, r] = [`${c.target}.left`, `${c.target}.right`] as const;
      expect(goalMet(c, [wire('bat+', l), wire(r, 'bat-')])).toBe(true);
    }
  });

  it('the generator builds valid sessions that vary; the validator rejects a solved start and an unknown clip', () => {
    for (const t of TIERS) {
      const d = buildCircuitWorkbench({ gradeLevel: 'Kindergarten', supportTier: t }, 11);
      expect(() => validateCircuitWorkbenchData(d)).not.toThrow();
    }
    const starts = new Set(Array.from({ length: 10 }, (_, s) => JSON.stringify(buildCircuitWorkbench({ gradeLevel: 'Grade 1', supportTier: 'medium' }, s + 1).challenges.map(c => (c.type === 'light_it' ? c.start : [])))));
    expect(starts.size).toBeGreaterThan(1);
    const base = buildCircuitWorkbench({ gradeLevel: 'Kindergarten', supportTier: 'easy' }, 1);
    expect(() => validateCircuitWorkbenchData({ ...base, challenges: [{ ...base.challenges[0], start: loop }] })).toThrow();
    expect(() => validateCircuitWorkbenchData({ ...base, challenges: [{ ...base.challenges[0], start: [['bat+', 'green.left']] }] })).toThrow();
  });
});

describe('what the tutor sees', () => {
  it('the scene names the parts, the wires and what is lit, never the wire that closes the loop', () => {
    for (const c of pickLightIt(5, 'medium', seeded(3), 'm')) {
      const facts = JSON.stringify(circuitScene(c, { guess: null, powered: false, wires: c.start }).facts);
      expect(facts).toContain('the battery is not in yet');
      expect(facts).not.toMatch(/closed loop|needs a wire|missing/);
    }
  });
});
