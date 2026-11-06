import { describe, expect, it } from 'vitest';
import { seeded } from './buoyancyModel';
import type { Tier } from './circuitModel';
import { buildElectro, clipsLifted, electroFair, electroMiss, makeElectro, maxClips, pickElectro } from './electroModel';
import { buildCircuitWorkbench } from '../../../service/physics/circuit-workbench-generator';
import { validateCircuitWorkbenchData } from './circuitWorkbench.boss';
import { electroScene } from './circuitWorkspace';
import { CIRCUIT_LEVERS, EASIER_LEVER, STRENGTH_METER_LEVER, practiceItem } from './circuitLevers';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];

describe('the electromagnet model', () => {
  it('lifts clips only while on, with wraps, on steel; more wraps and a second battery lift more', () => {
    expect(clipsLifted({ core: 'steel', turns: 6, batteries: 1, on: false })).toBe(0);
    expect(clipsLifted({ core: 'steel', turns: 0, batteries: 2, on: true })).toBe(0);
    expect(clipsLifted({ core: 'wood', turns: 10, batteries: 2, on: true })).toBe(0);
    expect(clipsLifted({ core: 'steel', turns: 6, batteries: 1, on: true })).toBe(3);
    expect(clipsLifted({ core: 'steel', turns: 8, batteries: 1, on: true })).toBe(4);
    expect(clipsLifted({ core: 'steel', turns: 6, batteries: 2, on: true })).toBe(6);
    expect([maxClips(false), maxClips(true)]).toEqual([5, 10]);
  });
  it('names each miss', () => {
    const c = makeElectro('x', { kind: 'exactly', clips: 3 }, { core: 'steel', turns: 2, batteries: 1, on: false });
    expect(electroFair(c)).toBe(true);
    expect(electroMiss(c, { core: 'steel', turns: 6, batteries: 1, on: true })).toBeUndefined();
    expect(electroMiss(c, { core: 'steel', turns: 0, batteries: 1, on: true })).toBe('no_coil');
    expect(electroMiss(c, { core: 'steel', turns: 6, batteries: 1, on: false })).toBe('switch_off');
    expect(electroMiss(c, { core: 'aluminium', turns: 6, batteries: 1, on: true })).toBe('not_iron_core');
    expect(electroMiss(c, { core: 'steel', turns: 4, batteries: 1, on: true })).toBe('too_few_clips');
    expect(electroMiss(c, { core: 'steel', turns: 9, batteries: 1, on: true })).toBe('too_many_clips');
  });
});

describe('electromagnet items', () => {
  it('every tier builds fair items: easy at least from a bare nail, medium exact on one battery, hard needs two batteries and a new core', () => {
    for (const t of TIERS) for (let s = 1; s <= 30; s++) {
      const c = buildElectro(t, seeded(s), 'x');
      expect(electroFair(c)).toBe(true);
      expect(c.start.on).toBe(false);
      if (t === 'easy') expect(c.goal.kind === 'at_least' && c.start.turns === 0).toBe(true);
      if (t === 'medium') expect(c.goal.kind === 'exactly' && !c.spareBattery && !c.coreTray).toBe(true);
      if (t === 'hard') expect(c.goal.clips > maxClips(false) && c.start.core !== 'steel' && c.spareBattery && c.coreTray).toBe(true);
    }
    // Medium starts too weak on some seeds and too strong on others.
    expect(new Set(Array.from({ length: 30 }, (_, s) => {
      const c = buildElectro('medium', seeded(s + 1), 'x');
      return clipsLifted({ ...c.start, on: true }) < c.goal.clips;
    })).size).toBe(2);
    for (const t of TIERS) {
      expect(pickElectro(3, t, seeded(2), 'e')).toHaveLength(3);
      expect(() => validateCircuitWorkbenchData(buildCircuitWorkbench({ gradeLevel: 'Grade 4', supportTier: t }, 5, ['electromagnet']))).not.toThrow();
    }
  });
  it('levers: strength meter then easier (none at easy); practice items are fair and simpler', () => {
    for (const t of TIERS) {
      const c = buildElectro(t, seeded(4), 'h');
      expect(CIRCUIT_LEVERS.declare(c, { powered: false }, []).map(l => l.id)).toEqual(t === 'easy' ? [STRENGTH_METER_LEVER] : [STRENGTH_METER_LEVER, EASIER_LEVER]);
      expect(nextLever(CIRCUIT_LEVERS.declare(c, { powered: false }, []), 'too_few_clips')).toBe(STRENGTH_METER_LEVER);
      const p = practiceItem(c);
      if (p && p.type === 'electromagnet') expect(electroFair(p)).toBe(true);
      const facts = JSON.stringify(electroScene(c, { build: c.start, tests: [], hanging: 0 }).facts);
      expect(facts).toContain('no tests yet');
    }
    expect(practiceItem(buildElectro('easy', seeded(1), 'e'))).toBeNull();
  });
});
