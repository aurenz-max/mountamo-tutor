import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { solarItems, solarJourneyItem } from '../../../components/live-activity/adapters/solarSystemExplorerLive';
import { solarSpokenMisses } from './solarSystemWorkspace';
import {
  firstRingBodyId, simplerSolar, sizeRowBodies, solarLeverFacts, solarLeverLeaks, solarLevers, type SolarLeverContext,
} from './solarSystemLevers';
import type { SolarSystemExplorerData } from './SolarSystemExplorer';
import identify from '../../../components/live-activity/runtime/testing/w1-payloads/solar-system-explorer.identify.json';
import order from '../../../components/live-activity/runtime/testing/w1-payloads/solar-system-explorer.order_from_sun.json';
import classify from '../../../components/live-activity/runtime/testing/w1-payloads/solar-system-explorer.classify.json';
import compare from '../../../components/live-activity/runtime/testing/w1-payloads/solar-system-explorer.compare_attribute.json';
import orbital from '../../../components/live-activity/runtime/testing/w1-payloads/solar-system-explorer.orbital_reasoning.json';

const PAYLOADS = { identify, order_from_sun: order, classify, compare_attribute: compare, orbital_reasoning: orbital } as const;
const sessionOf = (mode: keyof typeof PAYLOADS) => {
  const data = PAYLOADS[mode].data as unknown as SolarSystemExplorerData;
  const items = solarItems(data);
  const ctx: SolarLeverContext = { bodies: data.bodies, rung: (data.gradeLevel ?? '3') as SolarLeverContext['rung'], session: items };
  return { data, items, ctx };
};
const ALL = Object.keys(PAYLOADS).flatMap(mode => {
  const s = sessionOf(mode as keyof typeof PAYLOADS);
  return s.items.map(item => ({ mode, item, ...s }));
});

describe('solar levers on the saved payloads', () => {
  it('every item of every mode builds', () => {
    for (const mode of Object.keys(PAYLOADS)) expect(sessionOf(mode as keyof typeof PAYLOADS).items.length, mode).toBeGreaterThan(0);
  });

  it.each(ALL.map(a => [a.mode, a.item.id, a] as const))('%s %s: every checked miss has a lever on this item', (_m, _id, { item, ctx }) => {
    const levers = solarLevers(item, [], ctx);
    for (const miss of solarSpokenMisses(item)) expect(levers.some(l => l.answers?.includes(miss.id)), miss.id).toBe(true);
  });

  it.each(ALL.map(a => [a.mode, a.item.id, a] as const))('%s %s: no lever text or scene fact names an answer', (_m, _id, { item, ctx }) => {
    const levers = solarLevers(item, [], ctx);
    for (const l of levers) expect(solarLeverLeaks(item, `${l.when} ${l.does}`), l.id).toBe(false);
    expect(solarLeverLeaks(item, solarLeverFacts(item, levers.map(l => l.id)))).toBe(false);
  });

  it('simplify is offered where a free easier item exists, and on the plainest items not at all', () => {
    const offered = ALL.map(a => [a.item.id, a.mode, a.item.facet, solarLevers(a.item, [], a.ctx).find(l => l.kind === 'simplify')?.id ?? null]);
    expect(offered.filter(o => o[3]).map(o => `${o[1]}:${o[2]}:${o[3]}`)).toEqual([
      'order_from_sun:position:fewer_rings', 'order_from_sun:position:fewer_rings', 'order_from_sun:position:fewer_rings',
      'order_from_sun:position:fewer_rings', 'compare_attribute:biggest:two_planets', 'compare_attribute:smallest:two_planets',
      'orbital_reasoning:longest_year:two_planets', 'orbital_reasoning:shortest_year:two_planets']);
  });

  it.each(ALL.filter(a => simplerSolar(a.item, a.ctx)).map(a => [a.item.id, a.item.facet, a] as const))(
    '%s %s: the easier item is the same mode, never this or another item\'s answer, and the journey rebuilds it', (_id, _f, { item, ctx, items, data }) => {
      const easier = simplerSolar(item, ctx)!;
      expect(easier.item.id).toBe(`${item.id}~simpler`);
      expect(easier.item.kind).toBe(item.kind);
      const taken = new Set(items.filter(i => i.kind !== 'classify').flatMap(i => i.answerBodyIds));
      for (const b of easier.item.answerBodyIds) expect(taken.has(b)).toBe(false);
      if (item.facet === 'position') expect(easier.item.position).toBeLessThan(item.position);
      else {
        expect(easier.item.pairBodyIds).toHaveLength(2);
        for (const b of easier.item.pairBodyIds) expect(taken.has(b)).toBe(false);
      }
      expect(solarJourneyItem(data, easier.item.id)).toEqual(easier.item);
    });

  it('first_ring brightens the first planet\'s ring, never the answer\'s; the size row draws the pair alone on a pair item', () => {
    for (const { item, data } of ALL) {
      const ring = firstRingBodyId(item, data.bodies);
      if (item.facet === 'position') expect(ring).toBe('mercury');
      else expect(ring).toBeNull();
      expect(item.answerBodyIds).not.toContain(ring);
    }
    const pair = ALL.find(a => a.item.facet === 'pair_bigger')!;
    expect(sizeRowBodies(pair.item, pair.data.bodies).map(b => b.id).sort()).toEqual([...pair.item.pairBodyIds].sort());
    const big = ALL.find(a => a.item.facet === 'biggest')!;
    expect(sizeRowBodies(big.item, big.data.bodies).map(b => b.distanceAu)).toEqual(
      big.data.bodies.filter(b => b.type === 'planet').map(b => b.distanceAu).sort((x, y) => x - y));
  });
});

describe('this wrong answer, then this lever', () => {
  const at = (facet: string) => ALL.find(a => a.item.facet === facet)!;
  it.each([
    ['name', 'said_sun', 'star_mark'], ['name', 'neighbour_planet', 'close_up'], ['name', 'other_planet', 'close_up'],
    ['closest', 'signature_planet', 'near_far_model'], ['position', 'signature_planet', 'first_ring'],
    ['rocky', 'signature_planet', 'kind_model'], ['dwarf', 'other_planet', 'kind_model'],
    ['biggest', 'said_sun', 'star_mark'], ['biggest', 'other_planet', 'size_row'], ['hottest', 'signature_planet', 'fact_strip'],
    ['pair_bigger', 'signature_planet', 'size_row'], ['longest_year', 'signature_planet', 'trip_model'],
    ['pair_faster', 'other_planet', 'trip_model'],
  ])('%s, %s -> %s', (facet, miss, lever) => {
    const { item, ctx } = at(facet);
    expect(nextLever(solarLevers(item, [], ctx), miss)).toBe(lever);
  });

  it('after the help is pulled, the next lever for the miss is the simplify where one exists', () => {
    const { item, ctx } = at('position');
    expect(nextLever(solarLevers(item, ['first_ring'], ctx), 'signature_planet')).toBe('fewer_rings');
    const year = at('shortest_year');
    expect(nextLever(solarLevers(year.item, ['trip_model'], year.ctx), 'other_planet')).toBe('two_planets');
  });
});
