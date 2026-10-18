import { describe, expect, it } from 'vitest';
import { geoContains } from 'd3-geo';
import {
  NATIONAL_MALL, bearing, buildSession, buildTownChallenges, buildWorldChallenges, flyRoute, mapMatches, mapMiss,
  offAxis, placeById, quadrant, townCapacity, uniqueRelations, type Direction, type TownMap,
} from './mapModel';
import { CONTINENT_FEATURES, WATER_FEATURES, WORLD_RELATIONS } from './mapGeo';

/** Real places around Boston Common, as Gemini with Google Maps returned them (2026-10-17 probe). */
const BOSTON: TownMap = {
  name: 'Downtown Boston', city: 'Boston', source: 'google_maps', center: { lat: 42.3554, lng: -71.0618 },
  places: [
    { name: 'The Advent School', kind: 'school', lat: 42.35759, lng: -71.07062 },
    { name: 'Boston Common', kind: 'park', lat: 42.3554, lng: -71.0655 },
    { name: 'Chinatown Library', kind: 'library', lat: 42.35293, lng: -71.06232 },
    { name: 'New England Aquarium', kind: 'aquarium', lat: 42.359, lng: -71.0494 },
    { name: 'Tadpole Playground', kind: 'playground', lat: 42.35474, lng: -71.06649 },
    { name: 'Engine 7 Fire Station', kind: 'fire_station', lat: 42.34977, lng: -71.06653 },
    { name: 'Quincy Market', kind: 'market', lat: 42.35987, lng: -71.05459 },
  ].map((p, i) => ({ id: `place-${i + 1}`, ...p }) as TownMap['places'][number]),
};

const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const p = (map: TownMap, name: string) => map.places.find(x => x.name === name)!;

describe('true directions', () => {
  it('bearings on the National Mall read the way a map of it does', () => {
    const m = NATIONAL_MALL;
    expect(quadrant(bearing(p(m, 'Washington Monument'), p(m, 'U.S. Capitol')))).toBe('east');
    expect(quadrant(bearing(p(m, 'Washington Monument'), p(m, 'Lincoln Memorial')))).toBe('west');
    expect(quadrant(bearing(p(m, 'Washington Monument'), p(m, 'White House')))).toBe('north');
    expect(quadrant(bearing(p(m, 'Washington Monument'), p(m, 'Jefferson Memorial')))).toBe('south');
  });

  it('every askable relation is clean: the answer near the axis, nothing else that way', () => {
    for (const map of [NATIONAL_MALL, BOSTON]) for (const r of uniqueRelations(map)) {
      expect(offAxis(bearing(r.from, r.to), r.dir)).toBeLessThanOrEqual(25);
      for (const other of map.places) if (other.id !== r.from.id && other.id !== r.to.id)
        expect(offAxis(bearing(r.from, other), r.dir)).toBeGreaterThan(45);
    }
  });

  it('both maps can fill a session of every city task', () => {
    for (const map of [NATIONAL_MALL, BOSTON]) for (const task of ['find_by_direction', 'name_direction', 'build_route'] as const)
      expect(townCapacity(map, task), `${map.name} ${task}`).toBeGreaterThanOrEqual(map === BOSTON && task === 'find_by_direction' ? 3 : 4); // 7-place sample; generation fetches 9
  });
});

describe('city asks', () => {
  it('find_by_direction: directions vary, pairs never repeat, the target is the key', () => {
    const cs = buildTownChallenges(NATIONAL_MALL, 'find_by_direction', 5, 'medium', seeded(3));
    expect(cs.length).toBeGreaterThanOrEqual(4);
    expect(new Set(cs.map(c => [c.fromId, c.targetId].sort().join('|'))).size).toBe(cs.length);
    expect(new Set(cs.map(c => c.direction)).size).toBeGreaterThanOrEqual(3);
    for (const c of cs) {
      const from = placeById(NATIONAL_MALL, c.fromId)!, to = placeById(NATIONAL_MALL, c.targetId)!;
      expect(c.instruction).toContain(from.name);
      expect(c.instruction).not.toContain(to.name);
      expect(mapMatches(c, NATIONAL_MALL, { kind: 'tap', id: to.id })).toBe(true);
      expect(mapMiss(c, NATIONAL_MALL, { kind: 'tap', id: from.id })).toBe('reference_place');
    }
  });

  it('on a turned map, picking what sits that way on the screen is the screen_direction miss', () => {
    const m = NATIONAL_MALL;
    const c = { id: 'x', type: 'find_by_direction' as const, rotation: 90 as const, instruction: '',
      fromId: p(m, 'Washington Monument').id, targetId: p(m, 'U.S. Capitol').id, direction: 'east' as Direction };
    // Bearing 90: east is up, so screen-right is south. A child reading right as east taps the Jefferson Memorial.
    expect(mapMiss(c, m, { kind: 'tap', id: p(m, 'Jefferson Memorial').id, viewBearing: 90 })).toBe('screen_direction');
    expect(mapMiss(c, m, { kind: 'tap', id: p(m, 'Lincoln Memorial').id, viewBearing: 0 })).toBe('opposite_way');
    expect(mapMiss(c, m, { kind: 'tap', id: p(m, 'White House').id, viewBearing: 0 })).toBe('turned_way');
  });

  it('name_direction: the arm is the key and the ask never says a direction', () => {
    for (const c of buildTownChallenges(NATIONAL_MALL, 'name_direction', 5, 'medium', seeded(5))) {
      expect(mapMatches(c, NATIONAL_MALL, { kind: 'arm', dir: c.direction! })).toBe(true);
      expect(c.instruction).not.toMatch(/\b(north|south|east|west)\b/i);
    }
  });

  it('build_route: the whole-hop plan lands, in any order; a mirrored leg is named', () => {
    const c = buildTownChallenges(BOSTON, 'build_route', 4, 'medium', seeded(9))[0];
    const { wanted } = flyRoute(BOSTON, c, []);
    const e = Math.round(wanted.east), n = Math.round(wanted.north);
    const ew: Direction = e > 0 ? 'east' : 'west', ns: Direction = n > 0 ? 'north' : 'south';
    const plan = [...Array(Math.abs(e)).fill(ew), ...Array(Math.abs(n)).fill(ns)] as Direction[];
    expect(mapMatches(c, BOSTON, { kind: 'route', steps: plan })).toBe(true);
    expect(mapMatches(c, BOSTON, { kind: 'route', steps: [...plan].reverse() })).toBe(true);
    const flipped = plan.map(s => (s === ew ? (ew === 'east' ? 'west' : 'east') : s)) as Direction[];
    expect(mapMiss(c, BOSTON, { kind: 'route', steps: flipped })).toBe('route_mirrored');
  });
});

describe('the world', () => {
  it('continent shapes contain their own interior and not each other', () => {
    const inside: Record<string, [number, number]> = { africa: [20, 5], europe: [10, 50], asia: [100, 40],
      north_america: [-100, 45], south_america: [-60, -15], australia: [134, -25], antarctica: [0, -85] };
    for (const f of CONTINENT_FEATURES) for (const [id, pt] of Object.entries(inside))
      expect(geoContains(f, pt)).toBe(f.properties.id === id);
  });

  it('ocean regions sit where the oceans are', () => {
    const at = (pt: [number, number]) => [...WATER_FEATURES].reverse().find(w => geoContains(w.geometry, pt))?.id;
    expect(at([-150, 10])).toBe('pacific');
    expect(at([170, -20])).toBe('pacific');
    expect(at([-30, 20])).toBe('atlantic');
    expect(at([-20, -30])).toBe('atlantic');
    expect(at([75, -20])).toBe('indian');
    expect(at([0, 85])).toBe('arctic');
    expect(at([0, -65])).toBe('southern');
    expect(at([18, 35])).toBe('sea');
  });

  it('world asks have targets; tapping the starting continent is named', () => {
    expect(WORLD_RELATIONS.length).toBeGreaterThan(10);
    const f = buildWorldChallenges('find_on_globe', 5, 'easy', seeded(2));
    expect(new Set(f.map(c => c.targetId)).size).toBe(5);
    for (const c of buildWorldChallenges('world_direction', 5, 'medium', seeded(2))) {
      expect(mapMatches(c, undefined, { kind: 'tap', id: c.targetId! })).toBe(true);
      expect(mapMiss(c, undefined, { kind: 'tap', id: c.fromId! })).toBe('reference_place');
    }
  });

  it('a mixed session runs the globe first and every task once, ids by position', () => {
    const s = buildSession(['build_route', 'find_on_globe', 'find_by_direction', 'name_direction', 'world_direction'],
      NATIONAL_MALL, 5, 'medium', seeded(4));
    expect(s.map(c => c.type)).toEqual(['find_on_globe', 'find_by_direction', 'name_direction', 'world_direction', 'build_route']);
    expect(s.map(c => c.id)).toEqual(['map-1', 'map-2', 'map-3', 'map-4', 'map-5']);
  });
});
