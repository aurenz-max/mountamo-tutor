/**
 * The world for map-explorer: seven continents (Natural Earth 1:110m countries from world-atlas, merged per
 * continent with world-countries regions; Russia split at the Urals, 60°E), five oceans drawn as tappable
 * regions, and the facts and direction relations code owns. Pure: no React, no DOM.
 *
 * Every ring is wound for d3-geo (each polygon smaller than a hemisphere). The ocean regions are lon/lat boxes
 * drawn UNDER the land, so a tap on water lands on the ocean the box names, and land always wins a tap.
 */
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { geoArea } from 'd3-geo';
import continentsJson from './worldContinents.json';

export const CONTINENTS = ['north_america', 'south_america', 'europe', 'africa', 'asia', 'australia', 'antarctica'] as const;
export type ContinentId = typeof CONTINENTS[number];
export const OCEANS = ['pacific', 'atlantic', 'indian', 'arctic', 'southern'] as const;
export type OceanId = typeof OCEANS[number];
export type RegionId = ContinentId | OceanId;
/** Water that is not one of the five oceans (the Mediterranean, the Baltic, Hudson Bay, the Caspian). */
export type WaterId = OceanId | 'sea';

export const isContinent = (id: string): id is ContinentId => (CONTINENTS as readonly string[]).includes(id);
export const isOcean = (id: string): id is OceanId => (OCEANS as readonly string[]).includes(id);

export const REGION_NAME: Record<RegionId, string> = {
  north_america: 'North America', south_america: 'South America', europe: 'Europe', africa: 'Africa', asia: 'Asia',
  australia: 'Australia', antarctica: 'Antarctica',
  pacific: 'the Pacific Ocean', atlantic: 'the Atlantic Ocean', indian: 'the Indian Ocean', arctic: 'the Arctic Ocean',
  southern: 'the Southern Ocean',
};
/** The name at the start of a sentence. */
export const regionTitle = (id: RegionId) => REGION_NAME[id].replace(/^the /, 'The ');

/** One true sentence a first grader can hold on to, shown once the region is found. */
export const REGION_FACT: Record<RegionId, string> = {
  north_america: 'Canada, the United States and Mexico are in North America.',
  south_america: 'The Amazon, the biggest rainforest in the world, is in South America.',
  europe: 'Europe has many countries close together, like France, Italy and Spain.',
  africa: 'Africa has the Nile, one of the longest rivers in the world. Lions and elephants live there.',
  asia: 'Asia is the biggest continent. The tallest mountain, Mount Everest, is in Asia.',
  australia: 'Kangaroos and koalas live in Australia.',
  antarctica: 'Antarctica is the coldest place on Earth. It is covered in ice, and penguins live there.',
  pacific: 'The Pacific is the biggest and deepest ocean.',
  atlantic: 'The Atlantic is between the Americas and Europe and Africa.',
  indian: 'The Indian Ocean is warm. It is south of Asia.',
  arctic: 'The Arctic Ocean is at the top of the world. Much of it is frozen.',
  southern: 'The Southern Ocean goes all the way around Antarctica.',
};

/** Kid-bright fills, one per continent. A colour is not a name, so the fills leak nothing. */
export const CONTINENT_FILL: Record<ContinentId, string> = {
  north_america: '#f59e0b', south_america: '#22c55e', europe: '#a855f7', africa: '#f97316', asia: '#ef4444',
  australia: '#eab308', antarctica: '#e2e8f0',
};

/** Where each region's label sits, and where the globe turns to face it ([lon, lat]). */
export const REGION_ANCHOR: Record<RegionId, [number, number]> = {
  north_america: [-100, 45], south_america: [-60, -15], europe: [15, 52], africa: [20, 5], asia: [95, 45],
  australia: [134, -25], antarctica: [40, -80],
  pacific: [-150, 5], atlantic: [-35, 25], indian: [78, -22], arctic: [0, 82], southern: [30, -64],
};

const continentData = continentsJson as unknown as FeatureCollection<MultiPolygon>;
export const CONTINENT_FEATURES: Feature<MultiPolygon, { id: ContinentId }>[] = continentData.features.map(f => ({
  ...f, properties: { id: f.id as ContinentId },
}));

// ── Oceans: lon/lat boxes, densified along parallels so d3 draws them as real bands ──────────────────
type Box = [lonMin: number, lonMax: number, latMin: number, latMax: number];

/** Drawn in this order, bottom to top: a later box wins where boxes overlap. */
const WATER_BOXES: [WaterId, Box[]][] = [
  ['pacific', [[-180, -70, -60, 8], [-180, -84, 8, 18], [-180, -98, 18, 30], [-180, -80, 30, 66], [100, 180, -10, 66],
    [147, 180, -60, -10]]],
  ['atlantic', [[-98, -5, 18, 30], [-84, -5, 8, 18], [-70, 20, -60, 8], [-80, -5, 30, 66], [-5, 20, 46, 66]]],
  ['indian', [[20, 100, -60, 30], [100, 147, -60, -10]]],
  ['sea', [[-5, 36, 30, 46], [28, 42, 40, 47], [46, 55, 36, 47], [10, 30, 53, 66], [-95, -76, 51, 66]]],
];

function boxRing([w, e, s, n]: Box): [number, number][] {
  const ring: [number, number][] = [];
  const step = 2;
  for (let x = w; x < e; x += step) ring.push([x, s]);
  for (let y = s; y < n; y += step) ring.push([e, y]);
  for (let x = e; x > w; x -= step) ring.push([x, n]);
  for (let y = n; y > s; y -= step) ring.push([w, y]);
  ring.push([w, s]);
  return ring;
}

function capRing(lat: number): [number, number][] {
  const ring: [number, number][] = [];
  for (let x = -180; x < 180; x += 3) ring.push([x, lat]);
  ring.push([-180, lat]);
  return ring;
}

/** d3-geo fills the smaller side of a ring: reverse any ring that would fill the rest of the world. */
function wound(ring: [number, number][]): [number, number][] {
  return geoArea({ type: 'Polygon', coordinates: [ring] }) > 2 * Math.PI ? ring.slice().reverse() : ring;
}

export interface WaterFeature { id: WaterId; key: string; geometry: Polygon | MultiPolygon }

export const WATER_FEATURES: WaterFeature[] = [
  ...WATER_BOXES.map(([id, boxes]): WaterFeature => ({
    id, key: `water-${id}`, geometry: { type: 'MultiPolygon', coordinates: boxes.map(b => [wound(boxRing(b))]) },
  })),
  { id: 'arctic', key: 'water-arctic', geometry: { type: 'Polygon', coordinates: [wound(capRing(66))] } },
  { id: 'southern', key: 'water-southern', geometry: { type: 'Polygon', coordinates: [wound(capRing(-60))] } },
];

// ── Directions on the world (code-owned; never read off the picture by a model) ────────────────────
export type Direction = 'north' | 'south' | 'east' | 'west';
export const DIRECTIONS: readonly Direction[] = ['north', 'east', 'south', 'west'];
export const OPPOSITE: Record<Direction, Direction> = { north: 'south', south: 'north', east: 'west', west: 'east' };

/**
 * "Find the <kind> just <dir> of <from>": exactly one right region, true on every map and globe a first grader
 * sees. Pairs with two plausible answers (what is east of North America?) are left out.
 */
export interface WorldRelation { from: ContinentId; dir: Direction; to: RegionId }
export const WORLD_RELATIONS: readonly WorldRelation[] = [
  { from: 'north_america', dir: 'south', to: 'south_america' },
  { from: 'south_america', dir: 'north', to: 'north_america' },
  { from: 'europe', dir: 'south', to: 'africa' },
  { from: 'africa', dir: 'north', to: 'europe' },
  { from: 'europe', dir: 'east', to: 'asia' },
  { from: 'asia', dir: 'west', to: 'europe' },
  { from: 'australia', dir: 'south', to: 'antarctica' },
  { from: 'south_america', dir: 'east', to: 'africa' },
  { from: 'africa', dir: 'west', to: 'south_america' },
  { from: 'africa', dir: 'east', to: 'indian' },
  { from: 'north_america', dir: 'east', to: 'atlantic' },
  { from: 'north_america', dir: 'west', to: 'pacific' },
  { from: 'north_america', dir: 'north', to: 'arctic' },
  { from: 'asia', dir: 'east', to: 'pacific' },
  { from: 'asia', dir: 'south', to: 'indian' },
  { from: 'south_america', dir: 'west', to: 'pacific' },
  { from: 'australia', dir: 'west', to: 'indian' },
  { from: 'europe', dir: 'west', to: 'atlantic' },
  { from: 'antarctica', dir: 'north', to: 'southern' },
];

/** The direction a region lies from a continent, when the relation table states one. */
export function worldDirection(from: ContinentId, to: RegionId): Direction | null {
  return WORLD_RELATIONS.find(r => r.from === from && r.to === to)?.dir ?? null;
}
