/**
 * timeline-builder levers: leak rules per mode, the practice builder over every saved payload item and the pool, and
 * "this wrong order, then this lever" as code.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { TimelineBuilderChallenge } from './TimelineBuilder';
import {
  ARROW_LEVER, FEWER_LEVER, RULER_LEVER, practiceLeaks, practiceTimeline, rulerLeaks, timeRuler, timelineLeverFacts, timelineLevers,
} from './timelineBuilderLevers';
import { timelineMiss } from './timelineBuilderWorkspace';

const DIR = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
const PAYLOADS = readdirSync(DIR).filter(f => f.startsWith('timeline-builder.')).map(f => ({
  file: f, ...(JSON.parse(readFileSync(join(DIR, f), 'utf-8')) as { evalMode: string; data: { challenges: TimelineBuilderChallenge[] } }),
}));
const ITEMS = PAYLOADS.flatMap(p => p.data.challenges.map(c => ({ c, all: p.data.challenges, mode: p.evalMode })));

const make = (id: string, type: TimelineBuilderChallenge['type'], scale: [string, string], events: Array<[string, string?]>): TimelineBuilderChallenge =>
  ({ id, type, title: 't', instruction: 'Put these in order.', scaleStart: scale[0], scaleEnd: scale[1], hint: '', narration: '',
    events: events.map(([label, description], i) => ({ id: `e${i}`, label, description, correctPosition: i })) });

const text = (c: TimelineBuilderChallenge, all: TimelineBuilderChallenge[], pulled: string[]) =>
  [...timelineLevers(c, all, []).map(l => `${l.when} ${l.does}`), timelineLeverFacts(c, pulled), ...(timeRuler(c) ?? []).map(m => m.label)].join(' ');

describe('leak rules, per mode', () => {
  it.each(ITEMS.map(i => [i.mode, i.c.id, i] as const))('%s %s: no lever text, fact or ruler mark names an event', (_m, _id, { c, all }) => {
    const said = text(c, all, [ARROW_LEVER, RULER_LEVER]).toLowerCase();
    for (const e of c.events) expect(said, e.label).not.toContain(e.label.toLowerCase());
  });
  it.each(ITEMS.map(i => [i.mode, i.c.id, i] as const))('%s %s: the ruler is the whole scale, more marks than the cards stamp', (_m, _id, { c }) => {
    const r = timeRuler(c);
    expect(r, 'every payload scale is readable').not.toBeNull();
    expect(rulerLeaks(c, r!)).toBe(false);
  });
  it('yearly: every month from the start to the end, wrapping; refused when it is only the cards\' months', () => {
    const school = make('y', 'yearly', ['August', 'June'], [['A', 'in August'], ['B', 'in October'], ['C', 'in May']]);
    expect(timeRuler(school)!.map(m => m.label)).toEqual(['August', 'September', 'October', 'November', 'December',
      'January', 'February', 'March', 'April', 'May', 'June']);
    const tight = make('t', 'yearly', ['October', 'December'], [['A', 'in October'], ['B', 'in November'], ['C', 'in December']]);
    expect(timeRuler(tight)).toBeNull();
    expect(timeRuler(make('u', 'yearly', ['Start', 'End'], [['A'], ['B']]))).toBeNull();
  });
  it('historical: even steps from the start year to the end year; refused on unreadable or exactly-stamped scales', () => {
    expect(timeRuler(make('h', 'historical', ['1500', '2000'], [['A'], ['B'], ['C']]))!.map(m => m.label))
      .toEqual(['1500', '1600', '1700', '1800', '1900', '2000']);
    expect(timeRuler(make('h', 'historical', ['1850', '2000'], [['A'], ['B'], ['C']]))!.map(m => m.label))
      .toEqual(['1850', '1900', '1950', '2000']);
    expect(timeRuler(make('h', 'historical', ['Long ago', 'Today'], [['A'], ['B']]))).toBeNull();
    expect(timeRuler(make('h', 'historical', ['1900', '1903'], [['A', '1900'], ['B', '1901'], ['C', '1902'], ['D', '1903']]))).toBeNull();
  });
  it('daily: the parts of a day only on a morning-to-night scale; never a mark named as an event', () => {
    expect(timeRuler(make('d', 'daily', ['Morning', 'Bedtime'], [['Wake Up'], ['Lunch']]))!.map(m => m.icon)).toEqual(['🌅', '☀️', '🌇', '🌙']);
    expect(timeRuler(make('d', 'daily', ['9 AM', 'Noon'], [['A'], ['B']]))).toBeNull();
    expect(timeRuler(make('d', 'daily', ['Morning', 'Night'], [['Night'], ['B']]))).toBeNull();
  });
});

describe('practiceTimeline', () => {
  it.each(ITEMS.map(i => [i.mode, i.c.id, i] as const))('%s %s: same kind, fewer events, none from the session, solvable', (_m, _id, { c, all }) => {
    const p = practiceTimeline(c, all);
    expect(p).not.toBeNull();
    expect(p!.id).toBe(`${c.id}~simpler`);
    expect(p!.type).toBe(c.type);
    expect(p!.events.length).toBe(3);
    expect([...p!.events.map(e => e.correctPosition)].sort()).toEqual([0, 1, 2]);
    expect(practiceLeaks(p!, c, all)).toBe(false);
    expect(timeRuler(p!), 'the practice scale reads as its kind').not.toBeNull();
    expect(practiceTimeline(p!, all)).toBeNull();
  });
  it('two events on a three-event item, none on a two-event item; skips pool entries sharing an event', () => {
    const three = make('x', 'daily', ['Morning', 'Night'], [['A'], ['B'], ['C']]);
    expect(practiceTimeline(three, [three])!.events).toHaveLength(2);
    expect(practiceTimeline(make('x', 'daily', ['Morning', 'Night'], [['A'], ['B']]), [])).toBeNull();
    const clash = make('x', 'daily', ['Morning', 'Night'], [['Wake Up'], ['Eat Breakfast'], ['Sun Comes Up'], ['Get Dressed']]);
    expect(practiceTimeline(clash, [clash])).toBeNull();
    const two = make('x', 'daily', ['Morning', 'Night'], [['Wake Up'], ['Eat Breakfast'], ['Sun Comes Up'], ['Z']]);
    expect(practiceTimeline(two, [two])!.events.map(e => e.label)).toEqual(['Get Dressed', 'Eat Dinner', 'Put On Pajamas']);
  });
  it('the leak rule refuses the same id, another kind, as many events, and a session event', () => {
    const c = make('c', 'yearly', ['January', 'December'], [['A'], ['B'], ['C'], ['D']]);
    const p = practiceTimeline(c, [c])!;
    expect(practiceLeaks({ ...p, id: 'c' }, c, [c])).toBe(true);
    expect(practiceLeaks({ ...p, type: 'daily' }, c, [c])).toBe(true);
    expect(practiceLeaks({ ...p, events: [...p.events, { id: 'x', label: 'Q', correctPosition: 3 }] }, c, [c])).toBe(true);
    expect(practiceLeaks({ ...p, events: [{ ...p.events[0], label: 'a' }, ...p.events.slice(1)] }, c, [c])).toBe(true);
  });
});

describe('this wrong order, then this lever', () => {
  const C = make('c', 'yearly', ['January', 'December'], [['A', 'January'], ['B', 'March'], ['C', 'June'], ['D', 'August'], ['E', 'November']]);
  const order = (...ids: number[]) => Object.fromEntries(ids.map((p, slot) => [slot, `e${p}`]));
  it.each([
    [[4, 3, 2, 1, 0], 'reversed', ARROW_LEVER, RULER_LEVER],
    [[0, 2, 1, 3, 4], 'adjacent_swap', RULER_LEVER, FEWER_LEVER],
    [[3, 1, 2, 0, 4], 'two_swapped', RULER_LEVER, FEWER_LEVER],
    [[1, 2, 3, 0, 4], 'one_moved', RULER_LEVER, FEWER_LEVER],
    [[2, 0, 4, 1, 3], 'mixed_order', ARROW_LEVER, RULER_LEVER],
  ] as const)('%o → %s → %s, then %s', (ids, miss, first, second) => {
    expect(timelineMiss(C, order(...ids))).toBe(miss);
    expect(nextLever(timelineLevers(C, [C], []), miss)).toBe(first);
    expect(nextLever(timelineLevers(C, [C], [first]), miss)).toBe(second);
  });
  it('every catalog miss of every mode is answered by a lever on every payload item (J12)', () => {
    const tw = getComponentById('timeline-builder')!.teachingWorkspace!;
    expect(tw.levers).toBe(true);
    for (const { c, all, mode } of ITEMS) {
      const levers = timelineLevers(c, all, []);
      for (const m of tw.misses![mode]) expect(levers.some(l => l.answers?.includes(m)), `${mode} ${c.id} ${m}`).toBe(true);
    }
  });
  it('a practice timeline declares no levers', () => {
    const p = practiceTimeline(C, [C])!;
    expect(timelineLevers(p, [C], [])).toEqual([]);
  });
});
