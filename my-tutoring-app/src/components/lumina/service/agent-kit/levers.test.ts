import { describe, expect, it } from 'vitest';
import { authoredLeverSet, buildLevers, shownItem, slotLevers, withLevers, type LeverCapability } from './levers';

/** A toy primitive: count `n` dots drawn `layout`; the answer is n, difficulty is n (+1 scattered). */
interface Toy { n: number; layout: string; ask: string }
const write = (_s: null, a: Record<string, unknown>) => ({ item: { n: Number(a.n), layout: String(a.layout ?? 'rows'), ask: String(a.ask ?? '') } });
const cap: LeverCapability<null, Toy> = {
  facts: t => ({ mode: 'count', key: t.n, score: t.n + (t.layout === 'scattered' ? 1 : 0), blocking: t.n > 0 ? [] : ['nothing to count'] }),
  leaks: (text, t) => new RegExp(`\\b${t.n}\\b`).test(text),
  wordFields: ['ask'],
};
const base = { n: 6, layout: 'scattered', ask: 'How many?' };
const run = (levers: unknown[]) => buildLevers(null, { ...base, levers }, write(null, base).item, write, cap);

describe('buildLevers', () => {
  it('keeps a help that shows more with the same answer, and a simplify that is easier', () => {
    const out = run([
      { kind: 'help', when: 'miscount', says: 'Let us line them up.', change: { layout: 'rows' } },
      { kind: 'simplify', when: 'two misses', says: 'Fewer dots.', change: { n: 3 } },
    ]);
    expect(out.blocking).toEqual([]);
    expect(out.levers.map(l => [l.kind, l.item.n, l.item.layout])).toEqual([['help', 6, 'rows'], ['simplify', 3, 'scattered']]);
  });

  it('refuses words-only help, a help that changes the answer, a simplify that is not easier, and a leak', () => {
    const out = run([
      { kind: 'help', when: 'w', says: 'Count again.', change: { ask: 'Count them slowly.' } },
      { kind: 'help', when: 'w', says: 'Look.', change: { n: 5 } },
      { kind: 'simplify', when: 'w', says: 'Hm.', change: { n: 7 } },
      { kind: 'help', when: 'w', says: 'There are 6.', change: { layout: 'rows' } },
      { kind: 'simplify', when: 'w', says: 'None.', change: { n: 0 } },
    ]);
    expect(out.levers).toEqual([]);
    expect(out.report.join('\n')).toMatch(/only words[\s\S]*changes the answer[\s\S]*not easier[\s\S]*names the answer[\s\S]*blocked: nothing to count/);
    expect(out.blocking.join()).not.toMatch(/no help lever|no simplify lever/);
  });

  it('an item with no levers is told to add one of each', () => {
    expect(run([]).blocking).toEqual(['no help lever: add one (see "Levers")', 'no simplify lever: add one (see "Levers")']);
  });

  it('withLevers offers the writer\'s own fields in change, minus the kit\'s', () => {
    const decl = withLevers({ name: 'w', parametersJsonSchema: { type: 'object', properties: { n: { type: 'integer' }, replaceIndex: { type: 'integer' }, idea: { type: 'integer' } } } }, { fixedFields: ['idea'] });
    const change = (decl.parametersJsonSchema as any).properties.levers.items.properties.change.properties;
    expect(Object.keys(change)).toEqual(['n']);
  });
});

describe('authoredLeverSet', () => {
  interface Item { id: string; n: number; levers?: ReturnType<typeof slotLevers<Toy, Item>> }
  const set = authoredLeverSet<Item>({ modeOf: () => 'count', missesOf: () => ['miscount'] });
  const built = run([
    { kind: 'help', when: 'after a miscount', says: 'Rows.', change: { layout: 'rows' } },
    { kind: 'simplify', when: 'after two misses', says: 'Fewer.', change: { n: 3 } },
  ]);
  const item: Item = { id: 'i1', n: 6 };
  item.levers = slotLevers(built.levers, (t, id) => ({ id: `i1-${id}`, n: t.n }));

  it('offers the item\'s own levers by slot, with its words', () => {
    expect(set.declare(item, null, []).map(l => [l.id, l.kind, l.when, l.does])).toEqual([
      ['help_1', 'help', 'after a miscount', 'Rows.'], ['simpler_1', 'simplify', 'after two misses', 'Fewer.']]);
    expect(set.declare({ id: 'bare', n: 2 }, null, [])).toEqual([]);
  });

  it('a simplify opens the practice item; a pulled help is the item on screen', () => {
    expect(set.simpler(item, null, 'simpler_1')).toMatchObject({ id: 'i1~simpler_1', n: 3 });
    expect(shownItem(item, ['help_1'])).toMatchObject({ id: 'i1', n: 6 });
    expect(set.onScreen(item, null, ['help_1'])).toBe('On screen now: Rows.');
  });
});

describe('drawn', () => {
  it('a help that only renames something is words, not more shown', () => {
    interface L { n: number; label: string }
    const w = (_s: null, a: Record<string, unknown>) => ({ item: { n: Number(a.n), label: String(a.label) } });
    const c: LeverCapability<null, L> = { facts: t => ({ mode: 'm', key: t.n, score: 1, blocking: [] }), leaks: () => false, wordFields: [], drawn: t => ({ n: t.n }) };
    const base = { n: 4, label: 'pond' };
    const out = buildLevers(null, { ...base, levers: [{ kind: 'help', when: 'w', says: 'Look.', change: { label: 'deep pond' } }] }, base, w, c);
    expect(out.report[0]).toMatch(/only words \(a label or a name\)/);
  });
});
