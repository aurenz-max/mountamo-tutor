import { describe, expect, it } from 'vitest';
import { seeded } from './buoyancyModel';
import { wire, type Tier, type Wire } from './circuitModel';
import { DEVICES, describeDevice, deviceMiss, makeDevice, pickDevices } from './deviceModel';
import { buildCircuitWorkbench } from '../../../service/physics/circuit-workbench-generator';
import { validateCircuitWorkbenchData } from './circuitWorkbench.boss';
import { deviceScene } from './circuitWorkspace';
import { CIRCUIT_LEVERS, XRAY_LEVER, practiceItem } from './circuitLevers';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];
const fanLoop: Wire[] = [wire('bat+', 'motor.left'), wire('motor.right', 'bat-')];

describe('the device model', () => {
  it('a fan is a motor on a loop; a doorbell needs a switch that controls the buzzer', () => {
    expect(deviceMiss(makeDevice('f', 'fan'), { parts: ['motor'], wires: fanLoop })).toBeUndefined();
    const bell = makeDevice('d', 'doorbell');
    expect(deviceMiss(bell, { parts: ['buzzer'], wires: [wire('bat+', 'buzzer.left'), wire('buzzer.right', 'bat-')] })).toBe('missing_part');
    expect(deviceMiss(bell, { parts: ['buzzer', 'switch'], wires: [wire('bat+', 'buzzer.left'), wire('buzzer.right', 'bat-')] })).toBe('switch_does_nothing');
    expect(deviceMiss(bell, { parts: ['buzzer', 'switch'], wires: [wire('bat+', 'buzzer.left'), wire('buzzer.right', 'sw.left'), wire('sw.right', 'bat-')] })).toBeUndefined();
    expect(deviceMiss(makeDevice('f', 'fan'), { parts: ['motor', 'red'], wires: fanLoop })).toBe('extra_part');
    expect(deviceMiss(makeDevice('f', 'fan'), { parts: ['motor'], wires: [wire('bat+', 'motor.left')] })).toBe('not_working');
  });
  it('a lighthouse: one switch runs the light and the horn together', () => {
    const c = makeDevice('l', 'lighthouse');
    const w = [wire('bat+', 'sw.left'), wire('sw.right', 'red.left'), wire('red.right', 'buzzer.left'), wire('buzzer.right', 'bat-')];
    expect(deviceMiss(c, { parts: ['red', 'buzzer', 'switch'], wires: w })).toBeUndefined();
    expect(describeDevice(c, { parts: ['red', 'buzzer', 'switch'], wires: w })).toContain('switch on, the bulb and the buzzer on; switch off, nothing on');
  });
});

describe('device items', () => {
  it('easy builds need one part and no switch; medium a switch; hard two parts and a switch; sessions are valid', () => {
    for (const t of TIERS) {
      for (const c of pickDevices(3, t, seeded(2), 'd')) {
        const spec = DEVICES[c.device];
        expect(spec.needsSwitch).toBe(t !== 'easy');
        expect(spec.loads).toHaveLength(t === 'hard' ? 2 : 1);
      }
      expect(() => validateCircuitWorkbenchData(buildCircuitWorkbench({ gradeLevel: 'Grade 2', supportTier: t }, 3, ['build_device']))).not.toThrow();
    }
  });
  it('the scene says the parts and what runs, and levers lead with the x-ray, then a fan', () => {
    const c = makeDevice('n', 'night_light');
    const facts = JSON.stringify(deviceScene(c, { parts: [], wires: [], switchOn: false }).facts);
    expect(facts).toContain('choosing parts from the tray');
    expect(nextLever(CIRCUIT_LEVERS.declare(c, { powered: true }, []), 'not_working')).toBe(XRAY_LEVER);
    expect(practiceItem(c)).toMatchObject({ device: 'fan' });
    expect(practiceItem(practiceItem(c)!)).toBeNull();
  });
});
