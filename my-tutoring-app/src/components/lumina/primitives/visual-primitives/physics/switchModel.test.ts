import { describe, expect, it } from 'vitest';
import { seeded } from './buoyancyModel';
import { wire, type Tier, type Wire } from './circuitModel';
import { describeSwitch, makeSwitch, pickSwitches, switchMiss, switchStarts, switchStates, switchWorks } from './switchModel';
import { buildCircuitWorkbench } from '../../../service/physics/circuit-workbench-generator';
import { validateCircuitWorkbenchData } from './circuitWorkbench.boss';
import { switchScene } from './circuitWorkspace';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];
const inLoop: Wire[] = [wire('bat+', 'red.left'), wire('red.right', 'sw.left'), wire('sw.right', 'bat-')];

describe('the switch model', () => {
  it('a switch in the loop turns the bulb on and off', () => {
    expect(switchWorks(inLoop)).toBe(true);
    expect(switchStates(inLoop).off.lit).toEqual([]);
    expect(switchStates(inLoop).on.lit).toEqual(['red']);
  });

  it('names the miss: beside the bulb is backwards and shorts; outside the loop does nothing; a gap never lights', () => {
    const beside = [wire('bat+', 'red.left'), wire('red.right', 'bat-'), wire('sw.left', 'red.left'), wire('sw.right', 'red.right')];
    expect(switchMiss(beside)).toBe('switch_shorts');
    expect(switchMiss([wire('bat+', 'red.left'), wire('red.right', 'bat-'), wire('sw.left', 'bat+')])).toBe('switch_does_nothing');
    expect(switchMiss([wire('bat+', 'red.left'), wire('red.right', 'sw.left')])).toBe('no_loop');
    expect(switchMiss(inLoop)).toBeUndefined();
    expect(describeSwitch(inLoop)).toContain('switch on, the bulb lit; switch off, the bulb off');
  });
});

describe('switch items', () => {
  it('no start works; every start can be finished; the generator builds valid sessions', () => {
    for (const t of TIERS) {
      for (const st of switchStarts(t)) expect(switchWorks(st)).toBe(false);
      expect(pickSwitches(4, t, seeded(2), 's')).toHaveLength(4);
      const d = buildCircuitWorkbench({ gradeLevel: 'Grade 4', supportTier: t }, 3, ['add_a_switch']);
      expect(() => validateCircuitWorkbenchData(d)).not.toThrow();
    }
    expect(() => validateCircuitWorkbenchData({ ...buildCircuitWorkbench({ gradeLevel: 'Grade 4' }, 1, ['add_a_switch']),
      challenges: [makeSwitch('s', inLoop)] })).toThrow();
  });

  it('the scene says where the switch is and what is lit, never the wire it needs', () => {
    const c = makeSwitch('s', switchStarts('easy')[0]);
    const facts = JSON.stringify(switchScene(c, { guess: 'lights', powered: true, wires: c.start, switchOn: true }).facts);
    expect(facts).toContain('on (closed)');
    expect(facts).toContain('the bulb is off');
  });
});
