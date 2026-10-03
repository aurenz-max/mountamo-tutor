/**
 * The ten-frame levers on decompose, decompose_teen, make_ten, subitize and operate (handoff 32; table
 * qa/support-levers/m4-lever-tables-2026-09-29.md): which lever answers which miss, each lever's leak rule, and the
 * practice builders, on the saved generated payloads and on every number the modes can ask.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import { itemsFromChallenges, splitKey, waysToSplit, type TenFrameBand, type TenFrameChallengeLike, type TenFrameItem } from './tenFrameScript';
import { evalModeForKind } from './tenFrameWorkspace';
import { FIVE_LEVER, SIMPLIFY_LEVERS, TEN_MODEL, fillModel, leverFacts, leverView, operationModel, practiceItem, splitModel,
  tenFrameLevers, waysShown } from './tenFrameLevers';

const MODES = ['decompose', 'decompose_teen', 'make_ten', 'subitize', 'operate'] as const;
const payload = (mode: string) => JSON.parse(readFileSync(join(__dirname,
  `../../../components/live-activity/runtime/testing/w1-payloads/ten-frame.${mode}.json`), 'utf8')).data;
const sessionOf = (mode: string) => {
  const d = payload(mode);
  const band: TenFrameBand = d.gradeBand ?? 'K';
  return { band, items: itemsFromChallenges(d.challenges, { capacity: d.mode === 'double' ? 20 : 10, band }) };
};
const one = (ch: Omit<TenFrameChallengeLike, 'id'>, band: TenFrameBand = 'K', capacity = 10) =>
  itemsFromChallenges([{ id: 'x', ...ch }], { capacity, band })[0];
const helpIds = (item: TenFrameItem, band: TenFrameBand, session: readonly TenFrameItem[]) =>
  tenFrameLevers(item, [], band, { session }).filter(l => l.kind === 'help').map(l => l.id);
const answersAhead = (item: TenFrameItem, session: readonly TenFrameItem[]) => {
  const at = session.findIndex(i => i.id === item.id);
  return new Set(session.slice(at).filter(i => evalModeForKind(i.kind) === evalModeForKind(item.kind)).map(i => i.answer));
};
const says = (text: string, n: number) => new RegExp(`\\b${n}\\b`).test(text);

describe('every catalog miss on these modes is answered by a lever on the saved payloads (J9, in code)', () => {
  const entry = getComponentById('ten-frame')!.teachingWorkspace!;
  it.each(MODES)('%s', mode => {
    const { items, band } = sessionOf(mode);
    // decompose's `same_way_again` is answered once the learner has shown a way; give every item one shown way.
    const answered = new Set(items.flatMap(i => tenFrameLevers(i, [], band,
      { session: items, shownWays: new Set(i.kind === 'split' ? [splitKey({ a: 1, b: i.answer - 1 })] : []) })
      .flatMap(l => l.answers ?? [])));
    expect(entry.misses![mode].filter(m => !answered.has(m))).toEqual([]);
  });
});

describe('simplify: the same mode, a new item, answer recomputed, never the item or a number still ahead (R2, R3)', () => {
  it.each(MODES)('%s, saved payload', mode => {
    const { items, band } = sessionOf(mode);
    for (const item of items) {
      const easier = practiceItem(item, band, items);
      const declared = tenFrameLevers(item, [], band, { session: items }).some(l => SIMPLIFY_LEVERS.has(l.id));
      expect(!!easier).toBe(declared);
      if (!easier) continue;
      expect(easier).toMatchObject({ id: `${item.id}~smaller`, kind: item.kind, answerKind: item.answerKind, capacity: item.capacity });
      expect(easier.answer).toBeLessThan(item.answer);
      if (item.kind === 'decompose_teen') expect(easier.teenTotal).not.toBe(item.teenTotal);
      else expect(Array.from(answersAhead(item, items))).not.toContain(easier.answer);
    }
  });

  it('every number each mode can ask: the builder passes the mode\'s own build gate, or offers nothing', () => {
    const cases: TenFrameItem[] = [];
    for (let n = 2; n <= 10; n++) cases.push(one({ type: 'split', targetCount: n }), one({ type: 'subitize', targetCount: n }));
    for (let n = 11; n <= 19; n++) cases.push(one({ type: 'decompose_teen', targetCount: n }, 'K', 20));
    for (let s = 1; s <= 9; s++) cases.push(one({ type: 'make_ten', targetCount: s }, 'K'), one({ type: 'make_ten', targetCount: s }, '1-2'));
    for (let a = 1; a <= 9; a++) for (let b = 1; a + b <= 10; b++) cases.push(one({ type: 'add', targetCount: a + b, addend1: a, addend2: b }, '1-2'));
    for (let s = 2; s <= 10; s++) for (let t = 1; t < s; t++) cases.push(one({ type: 'subtract', targetCount: s - t, startCount: s }, '1-2'));
    for (const item of cases) {
      const band = item.answerKind === 'gesture' && item.kind === 'make_ten' ? 'K' : item.kind === 'make_ten' || item.kind === 'add' || item.kind === 'subtract' ? '1-2' : 'K';
      const easier = practiceItem(item, band, [item]);
      if (!easier) continue;
      expect(easier.kind).toBe(item.kind);
      expect(easier.answer).toBeLessThan(item.answer);
      if (item.kind === 'add') expect(easier.addend2).toBeLessThanOrEqual(2);
      if (item.kind === 'subtract') expect(easier.removed).toBeLessThanOrEqual(2);
      if (item.kind === 'make_ten') expect(easier.answer).toBeLessThanOrEqual(3);
    }
    // The floors: nothing simpler than a split of two, a look at two, one missing, ten and one.
    expect(practiceItem(one({ type: 'split', targetCount: 2 }), 'K')).toBeNull();
    expect(practiceItem(one({ type: 'subitize', targetCount: 2 }), 'K')).toBeNull();
    expect(practiceItem(one({ type: 'make_ten', targetCount: 9 }, '1-2'), '1-2')).toBeNull();
    expect(practiceItem(one({ type: 'decompose_teen', targetCount: 11 }, 'K', 20), 'K')).toBeNull();
  });
});

describe('help: each lever\'s leak rule', () => {
  it('decompose: the model split is of a total no split item still ahead asks for', () => {
    const { items } = sessionOf('decompose');
    for (const item of items) {
      const model = splitModel(item, items)!;
      expect(model.red + model.yellow).not.toBe(item.answer);
      expect(Array.from(answersAhead(item, items))).not.toContain(model.red + model.yellow);
      expect(model.red).toBeGreaterThan(0); expect(model.yellow).toBeGreaterThan(0);
    }
  });

  it('decompose: the ways shown are only the learner\'s own, and none once every way is shown', () => {
    const five = one({ type: 'split', targetCount: 5 });
    expect(waysShown(five, new Set())).toEqual([]);
    expect(waysShown(five, new Set(['2+3', '4+1']))).toEqual([{ a: 2, b: 3 }, { a: 4, b: 1 }]);
    expect(waysShown(five, new Set(['1+4', '2+3', '3+2', '4+1']))).toEqual([]);
    expect(waysToSplit(5)).toBe(4);
    expect(tenFrameLevers(five, [], 'K').map(l => l.id)).not.toContain('ways_shown');
    expect(tenFrameLevers(five, [], 'K', { shownWays: new Set(['2+3']) }).map(l => l.id)).toContain('ways_shown');
  });

  it('decompose_teen: the model is a full frame of ten beside the item; the count reads yellow counters only', () => {
    expect(TEN_MODEL).toMatchObject({ whole: 10, yellow: 10, red: 0 });
    const teen = one({ type: 'decompose_teen', targetCount: 14 }, 'K', 20);
    const facts = leverFacts(teen, ['running_count', 'ten_model'], 'K');
    expect(facts).not.toMatch(/\b4\b|four|left over:/i);
    expect(leverView(teen, ['running_count'], 'K').yellowCount).toBe(true);
  });

  it('make_ten: the fill model is a five-frame, none of its numbers the item\'s, none on five', () => {
    for (let s = 1; s <= 9; s++) {
      const item = one({ type: 'make_ten', targetCount: s }, '1-2');
      const model = fillModel(item);
      if (s === 5) { expect(model).toBeNull(); continue; }
      expect(model!.whole).toBe(5);
      expect([model!.red, model!.yellow]).not.toContain(item.answer);
      expect([model!.red, model!.yellow]).not.toContain(item.shown);
    }
    // K fills the frame: a glow on the empty boxes, never a spoken-answer model.
    expect(helpIds(one({ type: 'make_ten', targetCount: 6 }), 'K', [])).toEqual(['empty_glow']);
    expect(helpIds(one({ type: 'make_ten', targetCount: 6 }, '1-2'), '1-2', [])).toEqual(['fill_model', FIVE_LEVER]);
    expect(helpIds(one({ type: 'make_ten', targetCount: 5 }, '1-2'), '1-2', [])).toEqual([]);
  });

  it('subitize: the five-frame only above five, hide-empty only when a box is empty', () => {
    const look = (n: number) => one({ type: 'subitize', targetCount: n });
    expect(helpIds(look(4), 'K', [])).toEqual(['hide_empty', 'longer_look']);
    expect(helpIds(look(5), 'K', [])).toEqual(['hide_empty', 'longer_look']);
    expect(helpIds(look(7), 'K', [])).toEqual(['hide_empty', FIVE_LEVER, 'longer_look']);
    expect(helpIds(look(10), 'K', [])).toEqual([FIVE_LEVER, 'longer_look']);
  });

  it('operate: the model result is no answer still ahead and no model number is the item\'s answer', () => {
    const { items } = sessionOf('operate');
    for (const item of items) {
      const model = operationModel(item, items)!;
      const nums = (model.says.match(/\d+/g) ?? []).map(Number);
      expect(nums).not.toContain(item.answer);
      expect(Array.from(answersAhead(item, items))).not.toContain(nums.at(-1));
    }
  });

  it.each(MODES)('%s: every help lever pulled, the scene fact never states a spoken item\'s answer', mode => {
    const { items, band } = sessionOf(mode);
    for (const item of items) {
      const help = helpIds(item, band, items);
      const facts = leverFacts(item, help, band, { session: items });
      // make_ten on five has no help lever (every one would mark or say 5); its simplify lever still stands.
      expect(facts.length > 0).toBe(help.length > 0);
      if (item.answerKind !== 'gesture') expect(says(facts, item.answer), `${item.id}: ${facts}`).toBe(false);
    }
  });
});

describe('what a miss shows, then the lever that answers it (code, not a Live run)', () => {
  const split = one({ type: 'split', targetCount: 5 });
  const teen = one({ type: 'decompose_teen', targetCount: 14 }, 'K', 20);
  const makeTenK = one({ type: 'make_ten', targetCount: 4 });
  const makeTen = one({ type: 'make_ten', targetCount: 3 }, '1-2');
  const look = one({ type: 'subitize', targetCount: 7 });
  const add = one({ type: 'add', targetCount: 8, addend1: 5, addend2: 3 }, '1-2');
  const take = one({ type: 'subtract', targetCount: 4, startCount: 7 }, '1-2');
  const ways = new Set(['2+3']);
  it.each([
    [split, 'K', [], 'none_flipped', 'split_model'], [split, 'K', [], 'all_flipped', 'split_model'],
    [split, 'K', ['split_model'], 'all_flipped', 'smaller_total'], [split, 'K', [], 'same_way_again', 'ways_shown'],
    [teen, 'K', [], 'one_short', 'running_count'], [teen, 'K', [], 'all_flipped', 'ten_model'],
    [teen, 'K', ['ten_model'], 'over_by_more', 'smaller_teen'], [teen, 'K', ['running_count'], 'one_over', 'ten_model'],
    [makeTenK, 'K', [], 'one_short', 'empty_glow'], [makeTenK, 'K', ['empty_glow'], 'short_by_more', 'near_ten'],
    [makeTen, '1-2', [], 'said_shown', 'fill_model'], [makeTen, '1-2', [], 'said_capacity', 'fill_model'],
    [makeTen, '1-2', [], 'one_over', FIVE_LEVER], [makeTen, '1-2', [], 'over_by_more', 'near_ten'],
    [look, 'K', [], 'empty_count', 'hide_empty'], [look, 'K', [], 'one_short', FIVE_LEVER],
    [look, 'K', [FIVE_LEVER], 'one_over', 'longer_look'], [look, 'K', [], 'over_by_more', FIVE_LEVER],
    [look, 'K', [FIVE_LEVER, 'longer_look'], 'short_by_more', 'fewer_dots'],
    [add, '1-2', [], 'said_addend', 'operation_model'], [add, '1-2', [], 'one_short', FIVE_LEVER],
    [add, '1-2', [], 'short_by_more', 'smaller_numbers'],
    [take, '1-2', [], 'said_start', 'operation_model'], [take, '1-2', [], 'said_change', 'operation_model'],
    [take, '1-2', [], 'over_by_more', 'smaller_numbers'],
  ] as const)('%#: %s, pulled %j, miss %s -> %s', (item, band, pulled, miss, lever) => {
    expect(nextLever(tenFrameLevers(item, pulled, band as TenFrameBand, { shownWays: ways }), miss)).toBe(lever);
  });
});
