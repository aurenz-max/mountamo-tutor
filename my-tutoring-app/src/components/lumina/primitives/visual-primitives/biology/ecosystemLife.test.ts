import { describe, expect, it } from 'vitest';
import { LOG_DAYS, SEASONS, SEASON_SIGN, WINTER_PLACE, countWeather, drawMonth, mostCommon, plantNeedsMiss } from './ecosystemLife';
import {
  COOL_LINE, COVERS, ECOSYSTEM_TASKS, buildCompareLogs, buildKeepCool, buildPlantNeeds, buildSeasonLog, coolFill, coolMatches,
  coolMiss, compareMatches, logEvidence, pickChallenges, pickMixed, plantFeedback, plantMatches, seasonLogMiss, winterMatches,
  type CompareLogsChallenge,
} from './ecosystemModel';

const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

describe('weather records', () => {
  it('a month is 20 school days, and its season\'s weather is the most common by at least 3', () => {
    for (let s = 1; s <= 60; s++) for (const season of SEASONS) {
      const days = drawMonth(season, seeded(s));
      const n = countWeather(days);
      expect(days).toHaveLength(LOG_DAYS);
      expect(mostCommon(days)).toBe(SEASON_SIGN[season]);
      for (const [w, k] of Object.entries(n)) if (w !== SEASON_SIGN[season]) expect(k).toBeLessThanOrEqual(n[SEASON_SIGN[season]] - 3);
      expect(Math.max(...Object.values(n))).toBeLessThanOrEqual(15);
      if (season !== 'winter') expect(n.snowy).toBe(0);
    }
  });

  it('season from a log: the season and the most common weather; a weather that is there but not the most is a named miss', () => {
    const c = buildSeasonLog('winter', 'x', seeded(3));
    expect(logEvidence(c)).toBe('snowy');
    expect(seasonLogMiss(c, 'winter', 'snowy')).toBeUndefined();
    expect(seasonLogMiss(c, 'winter', 'sunny')).toBe('present_not_most');
    expect(seasonLogMiss(c, 'summer', 'sunny')).toBe('wrong_season');
    expect(c.instruction).not.toMatch(/winter|snow/i);
  });

  it('comparing two logs: the key matches the counts, and the labels never name a season', () => {
    for (let s = 1; s <= 40; s++) for (let pair = 0; pair < 5; pair++) for (const kind of ['more', 'warmer'] as const) {
      const c: CompareLogsChallenge = buildCompareLogs(pair, kind, 'x', seeded(s * 7 + pair));
      const na = countWeather(c.a.days), nb = countWeather(c.b.days);
      if (c.ask.kind === 'more') {
        expect(Math.abs(na[c.ask.weather] - nb[c.ask.weather])).toBeGreaterThanOrEqual(4);
        expect(compareMatches(c, na[c.ask.weather] > nb[c.ask.weather] ? 'a' : 'b')).toBe(true);
      }
      expect(`${c.a.label} ${c.b.label}`).not.toMatch(/winter|spring|summer|fall/i);
    }
  });
});

describe('plants and animals', () => {
  it('a plant grows with sun, water and soil; each missing need is named; animal things are a miss even when it grows', () => {
    const ok = { spot: 'sun', fill: 'soil', watered: true, extras: [] } as const;
    expect(plantMatches({ ...ok, extras: [] })).toBe(true);
    expect(plantNeedsMiss({ ...ok, extras: [], spot: 'hut' })).toBe('no_sun');
    expect(plantNeedsMiss({ ...ok, extras: [], watered: false })).toBe('no_water');
    expect(plantNeedsMiss({ ...ok, extras: [], fill: 'pebbles' })).toBe('no_soil');
    expect(plantNeedsMiss({ ...ok, extras: ['den'] })).toBe('gave_animal_things');
    expect(plantMatches({ ...ok, extras: ['den'] })).toBe(false);
  });

  it('a drooping plant to fix always starts missing a need, and the feedback never names which', () => {
    for (let s = 1; s <= 30; s++) {
      const c = buildPlantNeeds('sunflower', 'fix', 'x', seeded(s));
      expect(plantMatches(c.start)).toBe(false);
      expect(plantFeedback(c, c.start)).not.toMatch(/sunlight|water|soil/i);
    }
  });

  it('every animal has one winter place, and moving all of them there is correct', () => {
    expect(winterMatches({ id: 'x', type: 'season_behavior', animals: ['bear', 'bird'], instruction: '' }, { bear: 'den', bird: 'south' })).toBe(true);
    expect(winterMatches({ id: 'x', type: 'season_behavior', animals: ['bear', 'bird'], instruction: '' }, { bear: 'den', bird: 'den' })).toBe(false);
    expect(new Set(Object.values(WINTER_PLACE)).size).toBe(4);
  });
});

describe('keep it cool', () => {
  it('real shade keeps the red below the cool line; nothing or a clear sheet does not', () => {
    for (const c of COVERS) expect(coolMatches(c), c).toBe(c !== 'clear sheet');
    expect(coolMatches(null)).toBe(false);
    expect(coolFill(null, 1)).toBeGreaterThan(COOL_LINE + 0.15);
    expect(coolFill('umbrella', 1)).toBeLessThan(COOL_LINE - 0.1);
    expect(coolMiss('clear sheet')).toBe('clear_cover');
    expect(coolMiss(null)).toBe('no_shade');
  });

  it('every item offers two covers that work and the clear sheet', () => {
    for (let s = 1; s <= 20; s++) {
      const c = buildKeepCool('ice pop', 'x', seeded(s));
      expect(c.covers).toHaveLength(3);
      expect(c.covers.filter(coolMatches)).toHaveLength(2);
      expect(c.covers).toContain('clear sheet');
    }
  });
});

describe('sessions', () => {
  it('every task builds 5 items with unique ids', () => {
    for (const t of ECOSYSTEM_TASKS) {
      const items = pickChallenges(t, 5, 1, seeded(11));
      expect(items).toHaveLength(5);
      expect(items.every(i => i.type === t)).toBe(true);
      expect(new Set(items.map(i => i.id)).size).toBe(5);
    }
  });

  it('a mixed session covers every task once, easiest first', () => {
    const items = pickMixed(6, seeded(5));
    expect(items.map(i => i.type)).toEqual([...ECOSYSTEM_TASKS]);
    expect(new Set(items.map(i => i.id)).size).toBe(6);
  });
});
