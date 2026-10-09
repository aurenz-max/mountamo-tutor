import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import lensP from '../../../components/live-activity/runtime/testing/w1-payloads/era-explorer.lens_id.json';
import sortP from '../../../components/live-activity/runtime/testing/w1-payloads/era-explorer.era_sort.json';
import compareP from '../../../components/live-activity/runtime/testing/w1-payloads/era-explorer.era_compare.json';
import causeP from '../../../components/live-activity/runtime/testing/w1-payloads/era-explorer.cause_of_change.json';
import fixtures from '../../../pip/testing/workspaceFixtures.json';
import { eraItems, eraSpokenMisses } from './eraExplorerWorkspace';
import {
  CHANGE_MODELS, changeModelFor, eraLeverSession, eraLevers, leversOnScreen, modelLeaks, practiceItem, practiceLeaks,
  practiceParent, startingLevers, twoChecksFor,
} from './eraExplorerLevers';
import { correctChoiceOf, toWords, type EraExplorerItem } from './eraExplorerScript';

const PAYLOADS: Record<string, any> = {
  lens_id: (lensP as any).data, era_sort: (sortP as any).data, era_compare: (compareP as any).data,
  cause_of_change: (causeP as any).data, fixture: (fixtures as any)['era-explorer'],
};
const sessionOf = (data: any) => { const items = eraItems(data); return { items, s: eraLeverSession(items, data) }; };
const statementWords = (item: EraExplorerItem) => toWords(item.statement).filter(w => w.length >= 5);

describe.each(Object.keys(PAYLOADS))('%s payload', key => {
  const { items, s } = sessionOf(PAYLOADS[key]);
  it('has items', () => expect(items.length).toBeGreaterThan(0));

  it.each(items.map(i => [i.id, i] as const))('%s: every checked miss has a lever on this item', (_id, item) => {
    const levers = eraLevers(item, s, []);
    for (const m of eraSpokenMisses(item)) expect(levers.some(l => l.answers?.includes(m.id)), `${item.id} ${m.id}`).toBe(true);
  });

  it.each(items.map(i => [i.id, i] as const))('%s: the levers on screen never state the detail or its answer', (_id, item) => {
    const all = eraLevers(item, s, []).map(l => l.id);
    const fact = leversOnScreen(item, all, s) ?? '';
    // A lens fact names all three lenses, a time fact both times; a model is checked by `modelLeaks` (below).
    if (item.kind !== 'cause_of_change') {
      for (const w of statementWords(item)) expect(fact.toLowerCase().includes(` ${w} `), `${item.id}: ${w}`).toBe(false);
    } else expect(fact).not.toContain(correctChoiceOf(item).label);
  });
});

it('two_checks are built from the era names only: the same whatever the answer', () => {
  const { items, s } = sessionOf(PAYLOADS.era_sort);
  const answers = new Set(items.map(i => i.correctIndex));
  expect(answers.size).toBeGreaterThan(1);
  expect(new Set(items.map(i => JSON.stringify(twoChecksFor(i, s)))).size).toBe(1);
  expect(twoChecksFor(items[0], s)).toEqual(['Back then, in Pioneer Times?', 'Today, in your own life?']);
  const cmp = sessionOf(PAYLOADS.era_compare);
  expect(new Set(cmp.items.map(i => JSON.stringify(twoChecksFor(i, cmp.s)))).size).toBe(1);
  expect(twoChecksFor(cmp.items[0], cmp.s)).toEqual(['In Early Colonial Days?', 'In Pioneer Times?']);
});

it('model_change: no model offered reads as a statement or choice of the lesson; a lesson about streaming movies drops that model', () => {
  for (const data of Object.values(PAYLOADS)) {
    const { items, s } = sessionOf(data);
    for (const item of items.filter(i => i.kind === 'cause_of_change')) {
      const model = changeModelFor(item, s)!;
      expect(model).toBeTruthy();
      expect(modelLeaks(model, s)).toBe(false);
    }
  }
  const { items, s } = sessionOf(PAYLOADS.cause_of_change);
  const movie = { ...items[0], statement: 'Families stopped renting movies from the store.' } as EraExplorerItem;
  expect(modelLeaks(CHANGE_MODELS[0], { ...s, items: [movie] })).toBe(true);
});

describe('on_the_card practice item', () => {
  const { items, s } = sessionOf(PAYLOADS.lens_id);
  it.each(items.map(i => [i.id, i] as const))('%s: a card sentence, word for word, with the same menu; never the item', (_id, item) => {
    const p = practiceItem(item, s);
    expect(p).not.toBeNull();
    expect(p!.id).toBe(`${item.id}~simpler`);
    expect(p!.kind).toBe('lens_id');
    expect(p!.statement).not.toBe(item.statement);
    expect(p!.choices).toEqual(item.choices);
    expect(s.lenses.find(l => l.title === correctChoiceOf(p!).label)!.body).toContain(p!.statement);
    expect(practiceLeaks(p!, item, s)).toBe(false);
    expect(practiceParent(p!.id, items)).toBe(item);
  });
  it('the leak rule refuses the item itself, a paraphrase, a wrong key and another mode', () => {
    const item = items[0];
    const p = practiceItem(item, s)!;
    expect(practiceLeaks({ ...p, id: item.id }, item, s)).toBe(true);
    expect(practiceLeaks({ ...p, statement: item.statement }, item, s)).toBe(true);
    expect(practiceLeaks({ ...p, correctIndex: (p.correctIndex + 1) % 3 }, item, s)).toBe(true);
    expect(practiceLeaks({ ...p, kind: 'era_sort' }, item, s)).toBe(true);
    // A card sentence carrying a word of its own lens name ("school") would answer it outright.
    const school = 'When they went to school, all the students of different ages learned together in one small room.';
    expect(s.lenses[2].body).toContain(school);
    expect(practiceLeaks({ ...p, statement: school, correctIndex: 2 }, item, s)).toBe(true);
  });
  it('no sentence free of the lesson: no practice item, so no simplify lever', () => {
    const item = items[0];
    const crowded = { ...s, items: [...items, ...s.lenses.map((l, i) => ({ ...item, id: `x${i}`, statement: l.body }))] };
    expect(practiceItem(item, crowded)).toBeNull();
    expect(eraLevers(item, crowded, []).map(l => l.id)).toEqual(['side_by_side']);
  });
  it('other modes have no practice item', () => {
    for (const key of ['era_sort', 'era_compare', 'cause_of_change']) {
      const o = sessionOf(PAYLOADS[key]);
      expect(practiceItem(o.items[0], o.s)).toBeNull();
    }
  });
});

it.each([
  ['lens_id', 'other_lens', 'side_by_side'],
  ['lens_id', 'named_a_thing', 'side_by_side'],
  ['era_sort', 'said_both', 'two_checks'],
  ['era_sort', 'said_back_then', 'two_checks'],
  ['era_compare', 'said_today', 'two_checks'],
  ['era_compare', 'said_later', 'two_checks'],
  ['cause_of_change', 'said_what_changed', 'model_change'],
  ['cause_of_change', 'other_cause', 'model_change'],
] as const)('%s: after %s, nextLever pulls %s', (mode, miss, lever) => {
  const { items, s } = sessionOf(PAYLOADS[mode]);
  expect(nextLever(eraLevers(items[0], s, []), miss)).toBe(lever);
});

it('lens_id: after side_by_side is pulled, the next lever is the simplify', () => {
  const { items, s } = sessionOf(PAYLOADS.lens_id);
  expect(nextLever(eraLevers(items[0], s, ['side_by_side']), 'other_lens')).toBe('on_the_card');
});

it('easy starts the self-check levers; medium and hard start none; cause_of_change never', () => {
  const lens = sessionOf(PAYLOADS.lens_id).items[0];
  const sort = sessionOf(PAYLOADS.era_sort).items[0];
  const cause = sessionOf(PAYLOADS.cause_of_change).items[0];
  expect(startingLevers('easy', lens)).toEqual(['side_by_side']);
  expect(startingLevers('easy', sort)).toEqual(['two_checks']);
  expect(startingLevers('easy', cause)).toEqual([]);
  expect(startingLevers('medium', sort)).toEqual([]);
  expect(startingLevers('hard', lens)).toEqual([]);
  const { s } = sessionOf(PAYLOADS.era_sort);
  expect(eraLevers(sort, s, [], ['two_checks'])).toEqual([]);
});
