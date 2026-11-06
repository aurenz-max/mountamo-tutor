import { describe, expect, it } from 'vitest';
import {
  allBuilds, assemblyErrors, buildItem, crankLift, judgeBuild, machineFair, machineMiss, runBuild, seededRng, workingBuilds,
  type MachineChallenge, type Tier,
} from './machineModel';
import { MACHINE_ATLAS, atlasWords, fidelityErrors, realChains } from './machineAtlas';
import { validateMachineWorkshopData } from './machineWorkshop.boss';

const item = (tier: Tier, seed = 1, machine = 0): MachineChallenge =>
  buildItem('m-1', atlasWords(MACHINE_ATLAS[machine]), tier, '3-5', seededRng(seed));
const part = (c: MachineChallenge, id: string) => c.tray.find(p => p.id === id)!.id;

describe('the atlas', () => {
  it('every real machine assembles by the bench\'s own motion rules and matches itself', () => {
    for (const m of MACHINE_ATLAS) for (const ch of realChains(m)) {
      expect(assemblyErrors(ch), m.id).toEqual([]);
      expect(fidelityErrors(m, ch), m.id).toEqual([]);
    }
  });
  it('names what a wrong chain is missing, has extra, or uses in place of the real converter', () => {
    const jack = MACHINE_ATLAS.find(m => m.id === 'pump_jack')!;
    expect(fidelityErrors(jack, ['motor', 'belt', 'crank_rod', 'walking_beam', 'pump']).join()).toMatch(/has a gearbox/);
    expect(fidelityErrors(jack, ['motor', 'belt', 'gearbox', 'cam_follower', 'walking_beam', 'pump']).join()).toMatch(/with a crank and rod, not a cam and follower/);
    const mill = MACHINE_ATLAS.find(m => m.id === 'stamp_mill')!;
    expect(fidelityErrors(mill, ['water_wheel', 'gearbox', 'cam_follower', 'stamp']).join()).toMatch(/has no gearbox/);
    const wind = MACHINE_ATLAS.find(m => m.id === 'windmill_pump')!;
    expect(fidelityErrors(wind, ['windmill', 'gearbox', 'crank_rod', 'pump'])).toEqual([]);
  });
  it('assembly errors catch a part fed the wrong motion', () => {
    expect(assemblyErrors(['motor', 'crank_rod', 'belt', 'pump']).join()).toMatch(/belt\) needs spinning motion in/);
    expect(assemblyErrors(['motor', 'belt', 'pump']).join()).toMatch(/needs up-and-down motion in/);
  });
});

describe('a build', () => {
  const c = item('medium');
  it('pairs: rod needs a pin, follower a bump, rack teeth; gear and rack run out', () => {
    expect(judgeBuild(c, { driver: part(c, 'cam-one'), link: part(c, 'rod-long') }).outcome).toBe('no_pin');
    expect(judgeBuild(c, { driver: part(c, 'crank-medium'), link: part(c, 'follower-one') }).outcome).toBe('no_push');
    expect(judgeBuild(c, { driver: part(c, 'crank-medium'), link: part(c, 'rack-one') }).outcome).toBe('no_grip');
    expect(judgeBuild(c, { driver: part(c, 'pinion-one'), link: part(c, 'rack-one') }).outcome).toBe('ran_out');
  });
  it('sizes: small too short, large too far, short rod jams, medium crank and the cam work', () => {
    expect(judgeBuild(c, { driver: 'crank-small', link: 'rod-long' }).outcome).toBe('too_short');
    expect(judgeBuild(c, { driver: 'crank-large', link: 'rod-long' }).outcome).toBe('hits_end');
    expect(judgeBuild(c, { driver: 'crank-medium', link: 'rod-short' }).outcome).toBe('jams');
    expect(workingBuilds(c).map(b => `${b.driver}+${b.link}`).sort()).toEqual(['cam-one+follower-one', 'crank-medium+rod-long']);
  });
  it('hard: the large crank fits but is too weak (stalls), the medium one works', () => {
    const h = item('hard');
    expect(judgeBuild(h, { driver: 'crank-large', link: 'rod-long' }).outcome).toBe('stalls');
    expect(judgeBuild(h, { driver: 'cam-large', link: 'follower-one' }).outcome).toBe('stalls');
    expect(machineMiss(h, { build: { driver: 'crank-large', link: 'rod-long' }, runs: [] })).toBe('too_weak');
  });
  it('every tier, machine and seed is fair: exactly crank+rod and cam+follower work, and the tier\'s failures exist', () => {
    for (const tier of ['easy', 'medium', 'hard'] as Tier[]) for (let m = 0; m < MACHINE_ATLAS.length; m++) for (let s = 1; s < 8; s++) {
      expect(machineFair(item(tier, s, m)), `${tier} ${MACHINE_ATLAS[m].id} ${s}`).toBe(true);
    }
  });
  it('a crank-slider travels exactly twice its reach; a working run strokes and the effect fires', () => {
    expect(crankLift(0.3, 1.35, 0) - crankLift(0.3, 1.35, Math.PI)).toBeCloseTo(0.6, 6);
    const run = runBuild(c, { driver: 'crank-medium', link: 'rod-long' });
    expect(run.outcome).toBe('works');
    expect(Math.max(...run.frames.map(f => f.d))).toBeCloseTo(0.6 * (c.strokeMin / 0.48), 1);
    expect(run.frames.some(f => f.effect)).toBe(true);
  });
  it('a jam, a run-out and a too-far build stop and shake; nothing past the stop moves', () => {
    for (const b of [{ driver: 'crank-medium', link: 'rod-short' }, { driver: 'pinion-one', link: 'rack-one' }, { driver: 'crank-large', link: 'rod-long' }]) {
      const run = runBuild(c, b);
      const last = run.frames[run.frames.length - 1];
      expect(run.frames.some(f => f.shake > 0)).toBe(true);
      expect(run.frames[run.frames.length - 2].slotAngle).toBe(last.slotAngle);
      expect(run.frames.some(f => f.effect)).toBe(false);
    }
    const out = runBuild(c, { driver: 'crank-large', link: 'rod-long' });
    expect(Math.max(...out.frames.map(f => f.d))).toBeLessThanOrEqual(c.strokeMax + 0.02);
  });
  it('the boss accepts generated items and rejects an unfair tray', () => {
    const d = { title: 't', description: 'd', challengeType: 'spin_to_push' as const, gradeBand: '3-5' as const, challenges: [item('easy')] };
    expect(() => validateMachineWorkshopData(d)).not.toThrow();
    const bad = { ...d, challenges: [{ ...item('easy'), tray: item('easy').tray.filter(p => p.part !== 'cam') }] };
    expect(() => validateMachineWorkshopData(bad)).toThrow();
    expect(allBuilds(item('easy')).length).toBe(9);
  });
});
