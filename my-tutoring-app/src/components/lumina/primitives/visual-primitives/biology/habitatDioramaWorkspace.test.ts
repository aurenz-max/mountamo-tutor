import { expect, it } from 'vitest';
import { habitatMiss } from './habitatDioramaWorkspace';
import type { HabitatItem } from './habitatDioramaScript';
import type { Relationship } from './HabitatDiorama';

const item = (extra: Partial<HabitatItem>) => ({ id: 'h', organismNames: {}, ...extra }) as HabitatItem;
const rel = (fromId: string, toId: string, type: Relationship['type'] = 'predation'): Relationship => ({ fromId, toId, type, description: '' });
// The heron eats the frog and the fish; it competes with the otter; the fox eats the heron; the lily is unconnected.
const web = [rel('heron', 'frog'), rel('heron', 'fish'), rel('heron', 'otter', 'competition'), rel('fox', 'heron')];
const connect = item({ kind: 'connect', fromId: 'heron', toId: 'frog', relationshipType: 'predation' });
const toLand = item({ kind: 'restore', restorationZone: 'ground' });
const toWater = item({ kind: 'restore', restorationZone: 'water' });
const toShore = item({ kind: 'restore', restorationZone: 'shoreline' });

it.each([
  [connect, { toId: 'frog' }, undefined], [connect, { toId: 'fish' }, 'same_kind_other_link'], [connect, { toId: 'otter' }, 'other_kind_link'],
  [connect, { toId: 'fox' }, 'leads_to_start'], [connect, { toId: 'lily' }, 'unconnected'],
  [toLand, { zone: 'ground' }, undefined], [toLand, { zone: 'water' }, 'water_for_land'], [toLand, { zone: 'canopy' }, 'other_land_zone'],
  [toLand, { zone: 'shoreline' }, 'other_land_zone'], [toShore, { zone: 'water' }, 'water_for_land'],
  [toWater, { zone: 'shoreline' }, 'land_for_water'], [toWater, { zone: 'underground' }, 'land_for_water'],
] as const)('row %#', (it_, move, miss) => {
  expect(habitatMiss(it_, move, web)).toBe(miss);
});
