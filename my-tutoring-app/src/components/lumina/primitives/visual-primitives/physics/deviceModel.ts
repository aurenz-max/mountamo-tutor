/**
 * The workbench's build-a-device test, pure: the devices a learner can make (a fan, a night light, a doorbell, a
 * lighthouse), the parts each needs, the items code builds, and the check. `circuitModel.ts` decides what works with
 * the switch on and off.
 *
 * A device is a circuit with a job: a fan is a motor on a closed loop; a doorbell is a buzzer with a switch to press;
 * a lighthouse is a light and a horn that one switch turns on together. The learner chooses the parts from a tray,
 * wires them, tests with the switch, and the device works only if every part it needs runs when it should and stops
 * when the switch is off.
 */
import { BULB_WORD, evaluate, type BulbColor, type Rng, type Tier, type Wire } from './circuitModel';

export type Device = 'fan' | 'light' | 'night_light' | 'doorbell' | 'switched_fan' | 'lighthouse' | 'alarm';
export interface DeviceSpec { name: string; loads: BulbColor[]; needsSwitch: boolean; job: string }

export const DEVICES: Record<Device, DeviceSpec> = {
  fan: { name: 'a fan', loads: ['motor'], needsSwitch: false, job: 'the fan spins' },
  light: { name: 'a reading light', loads: ['red'], needsSwitch: false, job: 'the light shines' },
  night_light: { name: 'a night light', loads: ['red'], needsSwitch: true, job: 'the switch turns the light on and off' },
  doorbell: { name: 'a doorbell', loads: ['buzzer'], needsSwitch: true, job: 'pressing the switch rings the buzzer' },
  switched_fan: { name: 'a fan with a switch', loads: ['motor'], needsSwitch: true, job: 'the switch turns the fan on and off' },
  lighthouse: { name: 'a lighthouse', loads: ['red', 'buzzer'], needsSwitch: true, job: 'one switch turns on the light and the foghorn together' },
  alarm: { name: 'a burglar alarm', loads: ['red', 'buzzer'], needsSwitch: true, job: 'one switch turns on the flashing light and the siren together' },
};
const TIER_DEVICES: Record<Tier, Device[]> = {
  easy: ['fan', 'light'], medium: ['night_light', 'doorbell', 'switched_fan'], hard: ['lighthouse', 'alarm'],
};

/** What the learner can take from the tray. */
export type TrayPart = BulbColor | 'switch';
export const TRAY: TrayPart[] = ['red', 'motor', 'buzzer', 'switch'];
export const PART_WORDS: Record<TrayPart, string> = { red: 'a bulb', blue: 'a blue bulb', motor: 'a motor with a fan', buzzer: 'a buzzer', switch: 'a switch' };

export interface DeviceChallenge {
  id: string;
  type: 'build_device';
  instruction: string;
  device: Device;
  maxWires: number;
  supportTier?: Tier;
  startLevers?: string[];
}

export const deviceInstruction = (d: Device) => `Build ${DEVICES[d].name}: ${DEVICES[d].job}. Choose your parts from the tray, then wire them.`;
export function makeDevice(id: string, device: Device): DeviceChallenge {
  return { id, type: 'build_device', instruction: deviceInstruction(device), device, maxWires: DEVICES[device].loads.length + (DEVICES[device].needsSwitch ? 3 : 2) };
}

export function pickDevices(n: number, tier: Tier, rng: Rng, idPrefix = 'device'): DeviceChallenge[] {
  const pool = [...TIER_DEVICES[tier]];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return Array.from({ length: n }, (_, i) => makeDevice(`${idPrefix}-${i + 1}`, pool[i % pool.length]));
}

// ============================================================================
// The check
// ============================================================================

export interface DeviceBuild { parts: readonly TrayPart[]; wires: readonly Wire[] }
export type DeviceMiss = 'missing_part' | 'extra_part' | 'short_circuit' | 'not_working' | 'switch_does_nothing';

const loadsOf = (b: DeviceBuild) => b.parts.filter((p): p is BulbColor => p !== 'switch');
export function deviceStates(b: DeviceBuild) {
  const loads = loadsOf(b), hasSwitch = b.parts.includes('switch');
  return {
    on: evaluate(loads, b.wires, { switchClosed: true }),
    off: hasSwitch ? evaluate(loads, b.wires, { switchClosed: false }) : null,
  };
}

/** The named miss: a part the device needs is not on the table; a part it does not need is; a short; a needed part
 *  does not run; or the switch does not turn it off. */
export function deviceMiss(c: DeviceChallenge, b: DeviceBuild): DeviceMiss | undefined {
  const spec = DEVICES[c.device], loads = loadsOf(b);
  if (spec.loads.some(l => !loads.includes(l)) || (spec.needsSwitch && !b.parts.includes('switch'))) return 'missing_part';
  if (loads.some(l => !spec.loads.includes(l)) || (!spec.needsSwitch && b.parts.includes('switch'))) return 'extra_part';
  const s = deviceStates(b);
  if (s.on.short) return 'short_circuit';
  if (spec.loads.some(l => !s.on.lit.includes(l))) return 'not_working';
  if (spec.needsSwitch && (s.off!.lit.length || s.off!.short)) return 'switch_does_nothing';
  return undefined;
}
export const deviceMatches = (c: DeviceChallenge, b: DeviceBuild) => !deviceMiss(c, b);

const partList = (parts: readonly TrayPart[]) => parts.map(p => PART_WORDS[p]).join(', ') || 'no parts';
/** The learner's build in words, never what it still needs. */
export function describeDevice(c: DeviceChallenge, b: DeviceBuild): string {
  const s = deviceStates(b);
  const runs = (lit: readonly BulbColor[]) => (lit.length ? lit.map(l => (l === 'red' ? 'the bulb' : `the ${BULB_WORD[l]}`)).join(' and ') + ' on' : 'nothing on');
  return `built with ${partList(b.parts)} and ${b.wires.length} ${b.wires.length === 1 ? 'wire' : 'wires'}: `
    + (s.off ? `switch on, ${s.on.short ? 'a short' : runs(s.on.lit)}; switch off, ${runs(s.off.lit)}` : s.on.short ? 'a short' : runs(s.on.lit));
}

export function deviceFeedback(c: DeviceChallenge, b: DeviceBuild): string {
  const miss = deviceMiss(c, b), spec = DEVICES[c.device];
  if (!miss) return `It works! You built ${spec.name}: ${spec.job}. Every part is on one closed loop with the battery.`;
  if (miss === 'missing_part') return `What does ${spec.name} need? Look at the tray again.`;
  if (miss === 'extra_part') return `${spec.name[0].toUpperCase()}${spec.name.slice(1)} does not need every part on the table. Which one could go back in the tray?`;
  if (miss === 'short_circuit') return 'The battery is getting warm: a wire lets the electricity skip the parts. Which wire should go?';
  if (miss === 'not_working') return 'Not every part is working yet. Follow the path from the battery through each part and back.';
  return 'It keeps running when the switch is off. Is the switch part of the loop?';
}
