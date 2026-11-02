import { describe, expect, it } from 'vitest';
import { seeded } from './buoyancyModel';
import {
  type BreakFix, allLit, breakCandidates, breakLit, breakMatches, breakMiss, brokenPart, describeBreak, makeBreak, pickBreaks,
} from './breakModel';
import type { Tier } from './circuitModel';
import { buildCircuitWorkbench } from '../../../service/physics/circuit-workbench-generator';
import { validateCircuitWorkbenchData } from './circuitWorkbench.boss';
import { breakScene } from './circuitWorkspace';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];

describe('the break model', () => {
  it('every candidate is dark until its own fix, and lit after it; another fix leaves it dark', () => {
    for (const t of TIERS) for (const { bulbs, fault } of breakCandidates(t)) {
      const c = makeBreak('b', bulbs, fault);
      expect(allLit(c, [])).toBe(false);
      const own: BreakFix = fault.kind === 'loose_wire' ? 'clip' : fault.kind === 'dead_battery' ? 'battery' : `bulb:${fault.bulb!}`;
      expect(allLit(c, [own])).toBe(true);
      const other = own === 'battery' ? 'clip' : 'battery';
      expect(allLit(c, [other])).toBe(false);
    }
  });

  it('two bulbs in a row both go dark when one burns out', () => {
    const c = makeBreak('b', ['red', 'blue'], { kind: 'burnt_bulb', bulb: 'blue' });
    expect(breakLit(c, [])).toEqual([]);
    expect(breakLit(c, ['bulb:blue'])).toEqual(['red', 'blue']);
  });

  it('passes on the right part named after the fix; names the misses', () => {
    const c = makeBreak('b', ['red'], { kind: 'dead_battery' });
    expect(breakMatches(c, { fixes: ['bulb:red', 'battery'], claim: 'battery' })).toBe(true);
    expect(breakMiss(c, { fixes: ['bulb:red', 'battery'], claim: 'bulb:red' })).toBe('wrong_part_named');
    expect(breakMiss(c, { fixes: ['bulb:red'], claim: 'bulb:red' })).toBe('still_dark');
    expect(describeBreak(c, { fixes: ['bulb:red'], claim: null })).toBe('put in a new bulb; it is still dark; said the broken part was nothing yet');
  });
});

describe('break items', () => {
  it('easy is a loose wire; medium a dead battery or burnt bulb; hard two bulbs; a session mixes the faults', () => {
    for (const t of TIERS) for (let s = 1; s <= 10; s++) {
      const items = pickBreaks(4, t, seeded(s), 'x');
      if (t === 'easy') expect(items.every(c => c.fault.kind === 'loose_wire')).toBe(true);
      if (t === 'medium') expect(new Set(items.map(brokenPart))).toEqual(new Set(['battery', 'bulb:red']));
      if (t === 'hard') expect(items.every(c => c.bulbs.length === 2)).toBe(true);
    }
  });

  it('the generator builds valid break and mixed sessions; the validator rejects a fault that leaves it lit', () => {
    for (const t of TIERS) {
      const d = buildCircuitWorkbench({ gradeLevel: 'Grade 4', supportTier: t }, 5, ['find_the_break']);
      expect(d.challenges.every(c => c.type === 'find_the_break')).toBe(true);
      expect(() => validateCircuitWorkbenchData(d)).not.toThrow();
    }
    const mixed = buildCircuitWorkbench({ gradeLevel: 'Grade 1', supportTier: 'medium' }, 2, ['light_it', 'find_the_break']);
    expect(new Set(mixed.challenges.map(c => c.type))).toEqual(new Set(['light_it', 'find_the_break']));
    expect(() => validateCircuitWorkbenchData(mixed)).not.toThrow();
    const bad = { ...mixed, challenges: [{ ...makeBreak('b', ['red'], { kind: 'burnt_bulb', bulb: 'blue' }) }] };
    expect(() => validateCircuitWorkbenchData(bad)).toThrow();
  });
});

describe('what the tutor sees', () => {
  it('a loose wire is visible in the scene; a dead battery or burnt bulb is never named', () => {
    for (const t of TIERS) for (const c of pickBreaks(4, t, seeded(9), 'b')) {
      const facts = JSON.stringify(breakScene(c, { guess: null, fixes: [], log: [], claim: null }).facts);
      expect(facts).toContain('everything is dark');
      expect(facts).not.toMatch(/dead|burnt|broken part is/);
      if (c.fault.kind === 'loose_wire') expect(facts).toContain('off its clip');
    }
  });
});
