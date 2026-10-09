/**
 * cause-effect-chain's levers (`causeEffectChainLevers.ts`): the model pool's own gates, each leak rule, the two
 * simplify builders, per-item lever coverage on the saved payloads, the root_vs_proximate misses, and
 * "this miss, then this lever" through the shared `nextLever`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import fixtures from '../../../pip/testing/workspaceFixtures.json';
import { cardSpeakable, chainEarSeparable, type CauseEffectChainItem } from './causeEffectChainScript';
import { causeEffectItems, causeEffectSpokenMisses, chainMiss } from './causeEffectChainWorkspace';
import {
  causeEffectLevers, chainModelFor, freeModels, leversOnScreen, modelLeaks, practiceItem, practiceLeaks, practiceParent,
  roleModelFor, startingLevers, type ChainSession,
} from './causeEffectChainLevers';
import { MODEL_CHAINS } from './causeEffectModels';

const DIR = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
const saved = (mode: string) => JSON.parse(readFileSync(join(DIR, `cause-effect-chain.${mode}.json`), 'utf8')).data;
const FIXTURE = (fixtures as Record<string, any>)['cause-effect-chain'];
const LESSONS: Array<[string, any]> = [['build_chain payload', saved('build_chain')], ['identify_cause payload', saved('identify_cause')],
  ['generated fixture', FIXTURE]];
const sessionOf = (data: any): ChainSession => ({ items: causeEffectItems(data), gradeLevel: data.gradeLevel });
const ids = (item: CauseEffectChainItem, s: ChainSession, pulled: string[] = []) => causeEffectLevers(item, s, pulled).map(l => l.id);
type Of<K> = Extract<CauseEffectChainItem, { kind: K }>;

describe('the model pool', () => {
  it.each(MODEL_CHAINS.map(m => [m.id, m] as const))('%s: every card speakable, the causes separable by ear at 3 and 4', (_id, m) => {
    for (const t of [m.outcome, ...m.causes, m.after, m.background]) expect(cardSpeakable(t)).toBe(true);
    expect(chainEarSeparable([...m.causes])).toBe(true);
    expect(chainEarSeparable(m.causes.slice(-3))).toBe(true);
  });
});

describe('per-item lever coverage on the saved lessons', () => {
  it.each(LESSONS)('%s: every item has its help levers, and its simplify where the shape allows', (_name, data) => {
    const s = sessionOf(data);
    expect(s.items.length).toBeGreaterThan(0);
    for (const item of s.items) {
      if (item.kind === 'identify_cause') expect(ids(item, s)).toEqual(['two_tests', 'role_model']);
      if (item.kind === 'build_chain') expect(ids(item, s)).toEqual(['model_chain', 'shorter_chain']);
      if (item.kind === 'root_vs_proximate') expect(ids(item, s)).toEqual(['ends_model', 'ordered_chain']);
    }
  });
});

describe('leak rules', () => {
  const s = sessionOf(saved('build_chain'));
  it('a model chain is refused when one of its cards reads as a lesson card', () => {
    const cake = MODEL_CHAINS.find(m => m.id === 'cake')!;
    expect(modelLeaks(cake, s)).toBe(false);
    const withCake = { ...s, items: [...s.items, { ...s.items[0],
      cards: [{ id: 'x', text: 'Ravi spreads thick frosting on the cooled cake.', category: 'social', icon: '🎂' }] }] };
    expect(modelLeaks(cake, withCake)).toBe(true);
    expect(freeModels(s.items[0], withCake).map(m => m.id)).not.toContain('cake');
  });

  it.each(LESSONS)('%s: what a pulled help lever puts in the facts never quotes a learner card', (_name, data) => {
    const ls = sessionOf(data);
    for (const item of ls.items) {
      const fact = leversOnScreen(item, causeEffectLevers(item, ls, []).filter(l => l.kind === 'help').map(l => l.id), ls)!;
      expect(fact).toBeTruthy();
      for (const c of item.cards) expect(fact).not.toContain(c.text.replace(/[.!?]+$/, ''));
      expect(fact).not.toMatch(/is a cause|belongs/);
    }
  });

  it('the help model and the practice item come from different chains', () => {
    for (const item of s.items) expect(practiceItem(item, s)!.outcome.text).not.toBe(chainModelFor(item, s)!.chain.outcome);
  });

  it('identify_cause: the role model tags one card per role, in an order that varies by challenge', () => {
    const ls = sessionOf(saved('identify_cause'));
    const firsts = new Set(ls.items.map(i => roleModelFor(i, ls)!.cards[0].role));
    for (const item of ls.items) expect(roleModelFor(item, ls)!.cards.map(c => c.role).sort()).toEqual(['after', 'background', 'cause']);
    expect(firsts.size).toBeGreaterThan(1);
  });
});

describe('simplify builders', () => {
  it.each(LESSONS)('%s: build_chain practice is one card shorter, shuffled, its own id, and leaks nothing', (_name, data) => {
    const s = sessionOf(data);
    for (const item of s.items.filter((i): i is Of<'build_chain'> => i.kind === 'build_chain')) {
      const p = practiceItem(item, s) as Of<'build_chain'>;
      expect(p.kind).toBe('build_chain');
      expect(p.id).toBe(`${item.id}~simpler`);
      expect(p.cards).toHaveLength(item.cards.length - 1);
      expect(p.cards.map(c => c.id)).not.toEqual(p.correctOrder);
      expect(practiceLeaks(p, item, s)).toBe(false);
      expect(practiceParent(p.id, s.items)).toBe(item);
    }
  });

  it('build_chain: a four-card chain practises on three; a two-card chain has no simpler shape', () => {
    const s = sessionOf(saved('build_chain'));
    const first = s.items[0] as Of<'build_chain'>;
    const four = { ...first, cards: [...first.cards, { id: 'z', text: 'Clerks count the coins.', category: 'social', icon: '💰' }],
      correctOrder: [...first.correctOrder, 'z'] };
    expect(practiceItem(four, s)!.cards).toHaveLength(3);
    const two = { ...four, cards: four.cards.slice(0, 2), correctOrder: four.correctOrder.slice(0, 2) };
    expect(practiceItem(two, s)).toBeNull();
    expect(ids(two, s)).toEqual(['model_chain']);
  });

  it('root_vs_proximate: the same ask on as many cards, drawn in causal order', () => {
    const s = sessionOf(FIXTURE);
    const root = s.items.find((i): i is Of<'root_vs_proximate'> => i.kind === 'root_vs_proximate')!;
    for (const ask of ['root', 'proximate'] as const) {
      const item = { ...root, ask };
      const p = practiceItem(item, s) as Of<'root_vs_proximate'>;
      expect(p.ask).toBe(ask);
      expect(p.cards.map(c => c.id)).toEqual(p.correctOrder);
      expect(p.cards).toHaveLength(item.cards.length);
      expect(p.correctIndex).toBe(ask === 'root' ? 0 : p.cards.length - 1);
      expect(practiceLeaks(p, item, s)).toBe(false);
      expect(practiceLeaks({ ...p, ask: ask === 'root' ? 'proximate' : 'root' }, item, s)).toBe(true);
      expect(practiceLeaks({ ...p, cards: [...p.cards].reverse() }, item, s)).toBe(true);
    }
  });

  it('identify_cause has no simplify: one card and a yes or no is the plainest shape', () => {
    const s = sessionOf(saved('identify_cause'));
    for (const item of s.items) expect(practiceItem(item, s)).toBeNull();
  });

  it('a practice item that is the source item, or a build already in causal order, is refused', () => {
    const s = sessionOf(saved('build_chain'));
    const item = s.items[0] as Of<'build_chain'>, p = practiceItem(item, s) as Of<'build_chain'>;
    expect(practiceLeaks({ ...p, id: item.id }, item, s)).toBe(true);
    const inOrder = p.correctOrder.map(id => p.cards.find(c => c.id === id)!);
    expect(practiceLeaks({ ...p, cards: inOrder }, item, s)).toBe(true);
    expect(practiceLeaks({ ...item, id: p.id }, item, s)).toBe(true);
  });
});

describe('misses, then levers', () => {
  const build = sessionOf(saved('build_chain')), identify = sessionOf(saved('identify_cause')), fixture = sessionOf(FIXTURE);
  const chain = build.items[0] as Of<'build_chain'>;
  const [a, b, c] = chain.correctOrder;

  it.each([
    [[c, b, a], 'reversed'], [[b, a, c], 'two_swapped'], [[b, c, a], 'other_order'], [[a, b, c], undefined],
  ] as const)('chainMiss %j = %s', (placed, miss) => expect(chainMiss(chain, placed)).toBe(miss));

  it.each(['reversed', 'two_swapped', 'other_order'])('build_chain %s: model_chain, then shorter_chain', miss => {
    expect(nextLever(causeEffectLevers(chain, build, []), miss)).toBe('model_chain');
    expect(nextLever(causeEffectLevers(chain, build, ['model_chain']), miss)).toBe('shorter_chain');
  });

  it.each(['cause_denied', 'consequence_as_cause', 'background_as_cause'])('identify_cause %s: two_tests, then role_model', miss => {
    const item = identify.items[0];
    expect(nextLever(causeEffectLevers(item, identify, []), miss)).toBe('two_tests');
    expect(nextLever(causeEffectLevers(item, identify, ['two_tests']), miss)).toBe('role_model');
    // easy starts with the checks on screen: they are not offered, and the model comes first.
    expect(nextLever(causeEffectLevers(item, identify, [], startingLevers('easy', item)), miss)).toBe('role_model');
  });

  it('root_vs_proximate names the other end first, then the middle events, by the card', () => {
    const root = fixture.items.find((i): i is Of<'root_vs_proximate'> => i.kind === 'root_vs_proximate')!;
    const misses = causeEffectSpokenMisses(root);
    expect(misses.map(m => m.id)).toEqual(['other_end', 'middle_event']);
    expect(misses[0].pattern).toMatch(/names "Local postal workers/);
    expect(misses[1].pattern).toMatch(/Locomotives pull/);
    const proximate = { ...root, ask: 'proximate' as const, correctIndex: root.cards.findIndex(x => x.id === root.correctOrder.at(-1)) };
    expect(causeEffectSpokenMisses(proximate)[0].pattern).toMatch(/names "Railway crews/);
  });

  it.each(['other_end', 'middle_event'])('root_vs_proximate %s: ends_model, then ordered_chain', miss => {
    const root = fixture.items.find(i => i.kind === 'root_vs_proximate')!;
    expect(nextLever(causeEffectLevers(root, fixture, []), miss)).toBe('ends_model');
    expect(nextLever(causeEffectLevers(root, fixture, ['ends_model']), miss)).toBe('ordered_chain');
  });

  it('startingLevers: only easy, only identify_cause', () => {
    expect(startingLevers('easy', identify.items[0])).toEqual(['two_tests']);
    expect(startingLevers('medium', identify.items[0])).toEqual([]);
    expect(startingLevers('easy', chain)).toEqual([]);
  });
});
