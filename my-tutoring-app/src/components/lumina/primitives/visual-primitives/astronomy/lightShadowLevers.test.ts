/**
 * light-shadow-lab levers: each leak rule per mode, the easier-item builder over every sun the generator can place,
 * "this wrong answer, then this lever" as code, and per-item coverage (J12) over the saved payloads.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { ChallengeType, ShadowChallenge, SunPosition } from './LightShadowLab';
import {
  EASY_SHADOW_LEVER, EASY_SUN_LEVER, HEIGHT_MODEL, HEIGHT_MODEL_LEVER, SHADOW_ZONES_LEVER, SIDE_MODEL, SIDE_MODEL_LEVER,
  leverFacts, lightShadowLevers, practiceItem, practiceLeaks, practiceParent,
} from './lightShadowLevers';
import { keyOption, shadowCorrect, shadowMiss, shadowOptions } from './lightShadowWorkspace';
import observeP from '../../../components/live-activity/runtime/testing/w1-payloads/light-shadow-lab.observe.json';
import predictP from '../../../components/live-activity/runtime/testing/w1-payloads/light-shadow-lab.predict.json';
import measureP from '../../../components/live-activity/runtime/testing/w1-payloads/light-shadow-lab.measure.json';
import applyP from '../../../components/live-activity/runtime/testing/w1-payloads/light-shadow-lab.apply.json';

const MODES: ChallengeType[] = ['observe', 'predict', 'measure', 'apply'];
const TIMES = ['7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];
// Every sun the generator can place: altitude 5-85, azimuth 5-175, each with the time its azimuth stands for.
const ITEMS: ShadowChallenge[] = [];
for (const type of MODES) for (let alt = 5; alt <= 85; alt += 8) for (let az = 5; az <= 175; az += 10) {
  const sun: SunPosition = { time: TIMES[Math.min(10, Math.round(az / 17))], altitude: alt, azimuth: az };
  ITEMS.push({ id: `${type}-${alt}-${az}`, type, instruction: 'q', sunPosition: sun, correctShadow: { direction: 'W', relativeLength: 'long' } });
}
const PAYLOADS = [observeP, predictP, measureP, applyP].map(p => p.data as { challenges: ShadowChallenge[]; sunPositions: SunPosition[] });

describe('easier items: same mode, an obvious sun, two choices, never the learner\'s item or its answer', () => {
  it.each(MODES)('%s', mode => {
    for (const c of ITEMS.filter(i => i.type === mode)) {
      const p = practiceItem(c)!;
      expect(p, c.id).not.toBeNull();
      expect(p.type).toBe(mode);
      expect(p.id).toBe(`${c.id}~easier`);
      expect(practiceLeaks(c, p), c.id).toBe(false);
      const options = shadowOptions(p, []);
      expect(options).toHaveLength(2);
      expect(options).toContain(keyOption(p));
      expect(options, c.id).not.toContain(keyOption(c));
      expect(shadowCorrect(p, keyOption(p))).toBe(true);
      expect(practiceItem(p)).toBeNull();
      expect(practiceParent(p.id, [c])).toBe(c);
    }
  });
  it('the leak rule refuses the learner\'s own item, its answer and a sun that is not obvious', () => {
    const c = ITEMS.find(i => i.id === 'predict-21-25')!, p = practiceItem(c)!;
    expect(practiceLeaks(c, c)).toBe(true);
    expect(practiceLeaks(c, { ...p, id: c.id })).toBe(true);
    expect(practiceLeaks(c, { ...p, sunPosition: { ...c.sunPosition } })).toBe(true);
    expect(practiceLeaks(c, { ...p, sunPosition: { time: '10:00 AM', altitude: 40, azimuth: 60 } })).toBe(true);
    expect(practiceLeaks(c, { ...p, choices: [keyOption(p)] })).toBe(true);
    expect(practiceLeaks(c, { ...p, choices: [keyOption(p), keyOption(c)] })).toBe(true);
  });
});

describe('help levers: what they draw and say', () => {
  it('the models are fixed: every side once, both suns on one side, read from nothing in the item', () => {
    expect([...SIDE_MODEL]).toEqual([20, 90, 160]);
    expect([...HEIGHT_MODEL]).toEqual([15, 72]);
  });
  it('no lever text or scene fact names this item\'s answer, its time or its sun', () => {
    for (const c of ITEMS) {
      const levers = lightShadowLevers(c, []);
      const text = [...levers.map(l => `${l.when} ${l.does}`), leverFacts(c, levers.map(l => l.id))].join(' ');
      expect(text).not.toMatch(/\d|east|west|\bAM\b|\bPM\b|morning|afternoon|noon/i);
      expect(text).not.toContain(keyOption(c));
    }
  });
  it('ground marks only where the shadow is drawn and read (observe, measure)', () => {
    for (const mode of MODES) {
      const has = lightShadowLevers(ITEMS.find(i => i.type === mode)!, []).some(l => l.id === SHADOW_ZONES_LEVER);
      expect(has, mode).toBe(mode === 'observe' || mode === 'measure');
    }
  });
  it('a practice item declares no lever and no fact', () => {
    const p = practiceItem(ITEMS[0])!;
    expect(lightShadowLevers(p, [])).toEqual([]);
    expect(leverFacts(p, [SIDE_MODEL_LEVER])).toBe('');
  });
});

describe('this wrong answer, then this lever', () => {
  const at = (type: ChallengeType, altitude: number, azimuth: number): ShadowChallenge =>
    ({ id: 'x', type, instruction: 'q', sunPosition: { time: '8:00 AM', altitude, azimuth }, correctShadow: { direction: 'W', relativeLength: 'long' } });
  const SUNS: SunPosition[] = [{ time: '8:00 AM', altitude: 20, azimuth: 25 }, { time: '10:00 AM', altitude: 40, azimuth: 65 },
    { time: '12:00 PM', altitude: 65, azimuth: 90 }, { time: '2:00 PM', altitude: 40, azimuth: 120 }, { time: '4:00 PM', altitude: 20, azimuth: 155 }];
  it.each([
    [at('predict', 20, 25), 'East (left), Long', 'toward_sun', SIDE_MODEL_LEVER, EASY_SUN_LEVER],
    [at('predict', 20, 25), 'West (right), Short', 'length_flipped', HEIGHT_MODEL_LEVER, EASY_SUN_LEVER],
    [at('measure', 40, 65), 'West (right), Long', 'length_off', HEIGHT_MODEL_LEVER, SHADOW_ZONES_LEVER],
    [at('observe', 70, 90), 'West (right), Short', 'side_when_overhead', SIDE_MODEL_LEVER, EASY_SUN_LEVER],
    [at('measure', 20, 25), 'Directly below, Long', 'below_when_side', SIDE_MODEL_LEVER, EASY_SUN_LEVER],
    [{ ...at('apply', 40, 65), sunPosition: SUNS[1] }, '2:00 PM', 'mirror_time', SIDE_MODEL_LEVER, EASY_SHADOW_LEVER],
    [{ ...at('apply', 40, 65), sunPosition: SUNS[1] }, '8:00 AM', 'wrong_height', HEIGHT_MODEL_LEVER, EASY_SHADOW_LEVER],
  ] as const)('%#: %s → %s → %s, then %s', (c, choice, miss, first, second) => {
    expect(shadowMiss(c, choice, SUNS)).toBe(miss);
    expect(nextLever(lightShadowLevers(c, []), miss)).toBe(first);
    expect(nextLever(lightShadowLevers(c, [first]), miss)).toBe(second);
  });
  it('every catalog miss is answered by a lever on every item, generated and saved (J9, J12)', () => {
    const tw = getComponentById('light-shadow-lab')!.teachingWorkspace!;
    expect(tw.levers).toBe(true);
    for (const c of [...ITEMS, ...PAYLOADS.flatMap(p => p.challenges)]) {
      const levers = lightShadowLevers(c, []);
      for (const m of tw.misses![c.type]) expect(levers.some(l => l.answers?.includes(m)), `${c.id} ${m}`).toBe(true);
    }
  });
});
