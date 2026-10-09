/**
 * periodic-table levers (`periodicTableLevers.ts`): each leak rule, the simpler-item builder over every askable
 * item, which lever answers which miss, and per-item coverage (every catalog miss has a lever on every item the
 * draw can make, and on every item of the saved payloads).
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../service/manifest/catalog';
import {
  FAMILIAR_ELEMENT_NUMBERS, REACTIVITY_COMPARE_GROUPS, SIZE_COMPARE_GROUPS, elementFactsOf, itemFromChallenge,
  type PeriodicTableItem,
} from './periodicTableScript';
import { periodicItems, periodicSpokenMisses } from './periodicTableWorkspace';
import {
  AXIS_LEVER, COLUMN_LEVER, KEY_LEVER, LETTER_LEVER, MIN_LIT, PAIR_LEVER, RANGES_LEVER, ROW_RANGES, SIMPLER_LEVER, TALL_LEVER,
  boxKey, columnModel, columnModelLeaks, keyLeaks, leverFacts, letterLit, litLeaks, periodicLevers, periodicPracticeItem,
  periodicPracticeParent, practiceLeaks,
} from './periodicTableLevers';
import explorePayload from '../../components/live-activity/runtime/testing/w1-payloads/periodic-table.explore.json';
import identifyPayload from '../../components/live-activity/runtime/testing/w1-payloads/periodic-table.identify.json';
import trendPayload from '../../components/live-activity/runtime/testing/w1-payloads/periodic-table.trend.json';

const item = (ch: Record<string, unknown>, tier: 'easy' | 'medium' | 'hard' = 'medium') =>
  itemFromChallenge({ id: 'x', challengeType: 'explore', ...ch } as never, tier);
const find = (findBy: string, n: number) => item({ challengeType: 'explore', findBy, targetNumber: n })!;
const name = (clueBy: string, n: number) => item({ challengeType: 'identify', clueBy, targetNumber: n })!;

/** Every item the draw can make: each familiar element under each clue, every compare pair, every valence target. */
function everyItem(): PeriodicTableItem[] {
  const out: PeriodicTableItem[] = [];
  for (const n of FAMILIAR_ELEMENT_NUMBERS) {
    for (const by of ['name', 'symbol', 'number', 'position']) { const i = item({ findBy: by, targetNumber: n }); if (i) out.push(i); }
    for (const by of ['position', 'number', 'symbol']) { const i = item({ challengeType: 'identify', clueBy: by, targetNumber: n }); if (i) out.push(i); }
    const v = item({ challengeType: 'trend', targetNumber: n }); if (v) out.push(v);
  }
  for (const [axis, groups] of [['size', SIZE_COMPARE_GROUPS], ['reactivity', REACTIVITY_COMPARE_GROUPS]] as const) {
    for (const members of Object.values(groups)) for (const a of members) for (const b of members) {
      const i = item({ challengeType: 'trend', axis, pairNumbers: [a, b] }); if (i) out.push(i);
    }
  }
  return out;
}
const ALL = everyItem();
const MISSES = (getComponentById('periodic-table') as any).teachingWorkspace.misses as Record<string, string[]>;
/** The misses a check can name on this item. */
const missesOn = (i: PeriodicTableItem) => i.kind === 'find' ? MISSES.explore.filter(m => m !== 'same_first_letter' || i.findBy === 'symbol')
  : i.kind === 'name' || i.kind === 'compare' || i.kind === 'valence' ? periodicSpokenMisses(i).map(m => m.id) : [];

describe('letter_lit', () => {
  it('lit sets hold the asked box and at least three boxes; the few that cannot are the known gaps', () => {
    const gaps: string[] = [];
    for (const i of ALL.filter(i => (i.kind === 'find' && (i.findBy === 'name' || i.findBy === 'symbol')) || (i.kind === 'name' && i.clueBy === 'symbol'))) {
      const lit = letterLit(i);
      if (!lit) { gaps.push(`${i.kind}:${i.findBy ?? i.clueBy}:${i.element!.name}`); continue; }
      expect(litLeaks(lit, i)).toBe(false);
      expect(lit.length).toBeGreaterThanOrEqual(MIN_LIT);
    }
    expect(gaps.sort()).toEqual(['find:name:Krypton', 'find:name:Xenon', 'find:name:Zinc', 'find:symbol:Krypton', 'find:symbol:Potassium',
      'find:symbol:Xenon', 'find:symbol:Zinc', 'name:symbol:Krypton', 'name:symbol:Potassium', 'name:symbol:Xenon', 'name:symbol:Zinc'].sort());
  });
  it('never on a number or position clue', () => {
    expect(letterLit(find('number', 11))).toBeNull();
    expect(letterLit(find('position', 11))).toBeNull();
  });
});

it('row_ranges: the table structure, the same for every item', () => {
  expect(ROW_RANGES.map(r => `${r.first}-${r.last}`)).toEqual(['1-2', '3-10', '11-18', '19-36', '37-54', '55-86', '87-118']);
  expect(periodicLevers(find('number', 11), [], []).map(l => l.id)).toContain(RANGES_LEVER);
});

describe('box_key and column_model: models outside the item and outside the session', () => {
  const identify = periodicItems(identifyPayload.data as never);
  const trend = periodicItems(trendPayload.data as never);
  it('the key is in no item of the session', () => {
    for (const i of identify) {
      const key = boxKey(i, identify)!;
      expect(keyLeaks(key, identify)).toBe(false);
      expect(identify.flatMap(x => x.element ? [x.element.number] : [])).not.toContain(key.number);
    }
    expect(boxKey(find('name', 11), [])).toBeNull();
  });
  it('the model column is another group, with no element of the session', () => {
    for (const i of trend.filter(t => t.kind === 'compare' && t.axis === 'size')) {
      const model = columnModel(i, trend)!;
      expect(model.group).not.toBe(i.pair![0].group);
      expect(columnModelLeaks(model, i, trend)).toBe(false);
      expect(model.members.map(m => m.shells)).toEqual([...model.members.map(m => m.shells)].sort((a, b) => a - b));
    }
    const reactivity = trend.find(t => t.axis === 'reactivity')!;
    expect(columnModel(reactivity, trend)).toBeNull();
    expect(periodicLevers(reactivity, trend, []).map(l => l.id)).toEqual([PAIR_LEVER]);
  });
});

describe('simpler_item', () => {
  it('over every askable item: same mode and clue, its own id, plainer, never an element of the session; none on the plainest', () => {
    let built = 0;
    for (const i of ALL) {
      const p = periodicPracticeItem(i, [i]);
      const plainest = i.kind === 'compare' || (i.kind === 'valence' ? (i.element!.group ?? 0) <= 2 : i.element!.period <= 2);
      if (plainest) { expect(p).toBeNull(); continue; }
      expect(p).not.toBeNull();
      built++;
      expect(practiceLeaks(p!, i, [i])).toBe(false);
      expect(p).toMatchObject({ id: 'x~simpler', kind: i.kind, tier: i.tier });
      expect([p!.findBy, p!.clueBy]).toEqual([i.findBy, i.clueBy]);
      expect(p!.element!.number).not.toBe(i.element!.number);
      expect(periodicPracticeParent(p!.id, [i])).toBe(i);
      if (p!.kind === 'valence') expect(p!.answerCount).toBe(p!.element!.group);
    }
    expect(built).toBeGreaterThan(100);
  });
  it('skips every element of the session', () => {
    const session = [3, 4, 5].map(n => find('name', n));
    const p = periodicPracticeItem({ ...find('name', 11), id: 'x' }, session)!;
    expect(p.element!.number).toBe(6);
  });
  it('offered on the saved payloads\' items wherever the item is not already the plainest', () => {
    for (const payload of [explorePayload, identifyPayload, trendPayload]) {
      const items = periodicItems(payload.data as never);
      for (const i of items) {
        const has = periodicLevers(i, items, []).some(l => l.id === SIMPLER_LEVER);
        const plainest = i.kind === 'compare' || (i.kind === 'valence' ? (i.element!.group ?? 0) <= 2 : i.element!.period <= 2);
        expect(has, `${payload.evalMode} ${i.id}`).toBe(!plainest);
      }
    }
  });
});

describe('which lever comes next', () => {
  it.each([
    [find('position', 56), 'same_row', [], AXIS_LEVER], [find('position', 56), 'same_column', [AXIS_LEVER], SIMPLER_LEVER],
    [find('number', 19), 'next_box', [], RANGES_LEVER], [find('symbol', 11), 'same_first_letter', [], LETTER_LEVER],
    [find('symbol', 19), 'same_first_letter', [], SIMPLER_LEVER], [find('name', 6), 'other_box', [], LETTER_LEVER],
    [name('symbol', 26), 'said_symbol', [], KEY_LEVER], [name('symbol', 26), 'next_box', [], LETTER_LEVER],
    [name('position', 12), 'next_box', [AXIS_LEVER], SIMPLER_LEVER], [name('number', 9), 'said_symbol', [], KEY_LEVER],
    [item({ challengeType: 'trend', axis: 'size', pairNumbers: [3, 19] })!, 'other_of_pair', [], COLUMN_LEVER],
    [item({ challengeType: 'trend', axis: 'size', pairNumbers: [3, 19] })!, 'other_of_pair', [COLUMN_LEVER], PAIR_LEVER],
    [item({ challengeType: 'trend', targetNumber: 8 })!, 'group_number', [], TALL_LEVER],
    [item({ challengeType: 'trend', targetNumber: 8 })!, 'one_over', [TALL_LEVER], SIMPLER_LEVER],
    [item({ challengeType: 'trend', targetNumber: 12 })!, 'one_over', [TALL_LEVER], null],
  ] as const)('%#: after %s with %j pulled -> %s', (i, miss, pulled, want) => {
    expect(nextLever(periodicLevers(i, [i], pulled as unknown as string[]), miss)).toBe(want);
  });
  it('easy starts each help shown and the simpler item released', () => {
    expect(periodicLevers(find('position', 56)!, [], []).map(l => l.pulled)).toEqual([false, false]);
    const easy = item({ findBy: 'position', targetNumber: 56 }, 'easy')!;
    expect(periodicLevers(easy, [], []).map(l => [l.kind, l.pulled])).toEqual([['help', true], ['simplify', false]]);
  });
});

describe('per item: every miss a check can name has a lever on that item', () => {
  it('over every askable item', () => {
    const uncovered: string[] = [];
    for (const i of ALL) {
      const levers = periodicLevers(i, [i], []);
      for (const m of missesOn(i)) if (!levers.some(l => l.answers?.includes(m))) uncovered.push(`${i.kind} ${i.element?.name ?? i.pair?.[0].name} ${m}`);
    }
    expect(uncovered).toEqual([]);
  });
  it('on the saved payloads', () => {
    for (const payload of [explorePayload, identifyPayload, trendPayload]) {
      const items = periodicItems(payload.data as never);
      for (const i of items) for (const m of missesOn(i)) expect(periodicLevers(i, items, []).some(l => l.answers?.includes(m)), `${i.id} ${m}`).toBe(true);
    }
  });
});

describe('scene facts say what is drawn, never the key', () => {
  it.each(ALL.filter((_, k) => k % 3 === 0).map(i => [i.kind, i] as const))('%s', (_kind, i) => {
    const declared = periodicLevers(i, [i], []).map(l => l.id);
    const facts = leverFacts(i, [i], id => declared.includes(id));
    const answer = i.kind === 'compare' ? null : i.kind === 'valence' ? null : i.element!.name;
    if (answer && i.kind === 'name') expect(facts).not.toMatch(new RegExp(`\\b${answer}\\b`));
    if (i.kind === 'find' && i.findBy === 'position') expect(facts).not.toMatch(new RegExp(`\\b${i.element!.name}\\b`));
    if (i.kind === 'compare') expect(facts).not.toMatch(/bigger|more reactive|lower/);
    if (i.kind === 'valence') expect(facts).not.toMatch(new RegExp(`\\b${i.answerCount}\\b(?! to)`));
  });
});

it('Name It spoken misses: the symbol read back, then a touching box; no example is the answer', () => {
  const iron = name('symbol', 26);
  const misses = periodicSpokenMisses(iron);
  expect(misses.map(m => m.id)).toEqual(['said_symbol', 'next_box']);
  expect(misses[0].examples).toEqual(['F, e', 'Fe']);
  expect(misses[1].examples).toEqual(expect.arrayContaining(['Manganese', 'Cobalt', 'Ruthenium']));
  for (const m of misses) expect(m.examples!.map(e => e.toLowerCase())).not.toContain('iron');
  expect(elementFactsOf(26)!.name).toBe('Iron');
});
