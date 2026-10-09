/**
 * measure-lab levers: each leak rule per mode, each easier-item builder over many items shaped like the generator's,
 * "this wrong answer, then this lever" as code, and per-item coverage (J12) over the saved payloads.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { ContainerShape, MeasureLabChallenge } from './MeasureLab';
import {
  CUP_LINES_LEVER, DOWN_MODEL, DOWN_MODEL_LEVER, EASY_PAIR_LEVER, FAR_LEVELS_LEVER, FAR_PAIR_LEVER, LEVEL_LINES_LEVER,
  ORDER_STEPS, ORDER_STEPS_LEVER, POURED_SHELF_LEVER, SMALLER_POUR_LEVER, easyPairLeaks, farLevelsLeaks, farPairLeaks,
  leverFacts, measureLabLevers, practiceItem, practiceParent, shelfCups, smallerPourLeaks,
} from './measureLabLevers';
import { EMPTY_VIEW, measureCorrect, measureMiss, type MeasureView } from './measureLabWorkspace';
import balanceP from '../../../components/live-activity/runtime/testing/w1-payloads/measure-lab.balance_predict.json';
import capacityP from '../../../components/live-activity/runtime/testing/w1-payloads/measure-lab.capacity_predict.json';
import pourP from '../../../components/live-activity/runtime/testing/w1-payloads/measure-lab.pour_count.json';
import orderP from '../../../components/live-activity/runtime/testing/w1-payloads/measure-lab.order_capacity.json';

const SHAPES: ContainerShape[] = ['tall', 'wide', 'round'];
const OBJECTS = ['feather', 'brick', 'leaf', 'big rock', 'book', 'sock', 'apple', 'pumpkin', 'balloon', 'spoon'];
const CONTAINERS = ['vase', 'tub', 'jug', 'pail', 'pot', 'bowl', 'mug', 'jar', 'glass', 'basket'];
const pick = <T,>(xs: readonly T[], i: number) => xs[i % xs.length];

const balances: MeasureLabChallenge[] = [];
for (let i = 0; i < OBJECTS.length; i++) for (let j = 0; j < OBJECTS.length; j++) if (i !== j) {
  const heavyLeft = (i + j) % 2 === 0;
  balances.push({ id: `b${i}-${j}`, type: 'balance_predict', prompt: 'p',
    left: { id: 'l', name: OBJECTS[i], emoji: '?', weight: heavyLeft ? 8 : 2 },
    right: { id: 'r', name: OBJECTS[j], emoji: '?', weight: heavyLeft ? 2 : 8 }, expectedChoice: heavyLeft ? 'l' : 'r' });
}
const capacities: MeasureLabChallenge[] = [];
for (let i = 0; i < CONTAINERS.length; i++) for (let j = 0; j < CONTAINERS.length; j++) if (i !== j) {
  const a = { id: 'a', name: CONTAINERS[i], shape: pick(SHAPES, i), capacity: 3 + (i % 5) };
  const b = { id: 'b', name: CONTAINERS[j], shape: pick(SHAPES, i + 1), capacity: 4 + ((i + 3) % 5) + (i % 5 === (i + 3) % 5 + 1 ? 1 : 0) };
  if (a.capacity === b.capacity) b.capacity++;
  capacities.push({ id: `c${i}-${j}`, type: 'capacity_predict', prompt: 'p', unitName: 'cups', containerA: a, containerB: b,
    expectedChoice: a.capacity > b.capacity ? 'a' : 'b' });
}
const pours: MeasureLabChallenge[] = [];
for (let cap = 3; cap <= 10; cap++) for (const name of CONTAINERS) pours.push({ id: `p${cap}-${name}`, type: 'pour_count', prompt: 'p',
  unitName: 'scoops', container: { id: 'k', name, shape: pick(SHAPES, cap), capacity: cap }, expectedCount: cap, options: [cap - 1, cap, cap + 1, cap + 2] });
const orders: MeasureLabChallenge[] = [];
for (const low of [1, 2]) for (const mid of [4, 5]) for (const high of [7, 8]) for (const noun of ['pot', 'jar', 'glass', 'pail', 'cup'])
  for (const perm of [[0, 1, 2], [2, 0, 1], [1, 2, 0], [2, 1, 0]]) {
    const levels = [low, mid, high], ids = ['j0', 'j1', 'j2'];
    const containers = perm.map((p, k) => ({ id: ids[k], name: `${noun} ${k + 1}`, shape: 'round' as const, capacity: 8, filled: levels[p] }));
    orders.push({ id: `o${low}${mid}${high}-${noun}-${perm.join('')}`, type: 'order_capacity', prompt: 'p', containers,
      expectedOrder: [...containers].sort((x, y) => x.filled - y.filled).map(c => c.id) });
  }
const ALL = [...balances, ...capacities, ...pours, ...orders];
const PAYLOADS = [balanceP, capacityP, pourP, orderP].flatMap(p => p.data.challenges as MeasureLabChallenge[]);

/** The easier item is solvable by its own check: the right taps for its key. */
const solve = (c: MeasureLabChallenge): MeasureView => c.type === 'pour_count'
  ? { ...EMPTY_VIEW, chosenCount: c.container!.capacity }
  : c.type === 'order_capacity' ? { ...EMPTY_VIEW, order: [...c.containers!].sort((x, y) => (x.filled ?? 0) - (y.filled ?? 0)).map(j => j.id) }
    : { ...EMPTY_VIEW, prediction: c.type === 'balance_predict'
      ? (c.left!.weight > c.right!.weight ? c.left!.id : c.right!.id)
      : (c.containerA!.capacity > c.containerB!.capacity ? c.containerA!.id : c.containerB!.id) };

describe('easier items: same mode, solvable, never the learner\'s item', () => {
  const LEAKS = { balance_predict: farPairLeaks, capacity_predict: easyPairLeaks, pour_count: smallerPourLeaks, order_capacity: farLevelsLeaks };
  it.each([['balance_predict', balances], ['capacity_predict', capacities], ['pour_count', pours], ['order_capacity', orders]] as const)(
    '%s', (mode, items) => {
      let built = 0;
      for (const c of items) {
        const p = practiceItem(c);
        if (!p) continue;
        built++;
        expect(p.type).toBe(mode);
        expect(p.id).toBe(`${c.id}~smaller`);
        expect(LEAKS[mode](c, p), c.id).toBe(false);
        expect(measureCorrect(p, solve(p)), c.id).toBe(true);
        expect(practiceItem(p)).toBeNull();
        expect(practiceParent(p.id, items)).toBe(c);
      }
      expect(built).toBeGreaterThan(0);
    });
  it('pour: none on a three-cup container; order: only when two levels are close', () => {
    for (const c of pours) expect(!!practiceItem(c), c.id).toBe(c.container!.capacity > 3);
    for (const c of orders) {
      const s = c.containers!.map(j => j.filled!).sort((a, b) => a - b);
      expect(!!practiceItem(c), c.id).toBe(s[1] - s[0] < 3 || s[2] - s[1] < 3);
    }
  });
  it('the leak rules refuse the learner\'s own item and an easier item that shares its names', () => {
    for (const c of [balances[0], capacities[0], pours[3], orders[1]]) {
      const LEAK = { balance_predict: farPairLeaks, capacity_predict: easyPairLeaks, pour_count: smallerPourLeaks, order_capacity: farLevelsLeaks }[c.type];
      expect(LEAK(c, c)).toBe(true);
      expect(LEAK(c, { ...practiceItem(c)!, id: c.id })).toBe(true);
    }
    const b = balances[0], pb = practiceItem(b)!;
    expect(farPairLeaks(b, { ...pb, left: { ...pb.left!, name: b.left!.name } })).toBe(true);
    const c = capacities[0], pc = practiceItem(c)!;
    expect(easyPairLeaks(c, { ...pc, containerB: { ...pc.containerB!, shape: pc.containerA!.shape } })).toBe(true);
    expect(easyPairLeaks(c, { ...pc, containerB: { ...pc.containerB!, scale: 0.5 } })).toBe(true);
  });
});

describe('help levers: what they draw', () => {
  it('the model balance and the order bars are fixed: they read nothing from the item', () => {
    expect(DOWN_MODEL).toEqual({ heavyBlocks: 3, lightBlocks: 1, downSide: 'left' });
    expect([...ORDER_STEPS]).toEqual([10, 20, 30]);
  });
  it('capacity shelves stay empty until the test has filled both; pour shelves hold only the cups poured', () => {
    const c = capacities[0];
    expect(shelfCups(c, EMPTY_VIEW)).toEqual({ a: 0, b: 0 });
    expect(shelfCups(c, { ...EMPTY_VIEW, prediction: 'a', poured: { a: c.containerA!.capacity } })).toEqual({ a: 0, b: 0 });
    expect(shelfCups(c, { ...EMPTY_VIEW, poured: { a: 3, b: 7 } })).toEqual({ a: 3, b: 7 });
    const p = pours[5];
    for (let n = 0; n <= p.container!.capacity; n++) expect(shelfCups(p, { ...EMPTY_VIEW, poured: { k: n } })).toEqual({ k: n });
  });
  it('no lever text or scene fact carries a number, an object\'s name or a container\'s name', () => {
    for (const c of ALL) {
      const levers = measureLabLevers(c, []);
      const names = [c.left?.name, c.right?.name, c.containerA?.name, c.containerB?.name, c.container?.name,
        ...(c.containers ?? []).map(j => j.name)].filter((n): n is string => !!n);
      const text = [...levers.map(l => `${l.when} ${l.does}`), leverFacts(c, levers.map(l => l.id))].join(' ');
      expect(text).not.toMatch(/\d/);
      for (const n of names) expect(text.toLowerCase(), `${c.id} ${n}`).not.toMatch(new RegExp(`\\b${n}\\b`));
    }
  });
  it('a practice item declares no lever and no fact', () => {
    const p = practiceItem(pours[5])!;
    expect(measureLabLevers(p, [])).toEqual([]);
    expect(leverFacts(p, [POURED_SHELF_LEVER])).toBe('');
  });
});

describe('this wrong answer, then this lever', () => {
  const B = balances[0], C = capacities.find(c => (c.containerA!.shape === 'tall' && c.expectedChoice === 'b'))!;
  const P = pours.find(p => p.container!.capacity === 6)!, O = orders.find(o => o.id.startsWith('o247-pot-012'))!;
  const wrongPick = (c: MeasureLabChallenge) => c.expectedChoice === (c.left ?? c.containerA)!.id ? (c.right ?? c.containerB)!.id : (c.left ?? c.containerA)!.id;
  const want = O.expectedOrder!;
  it.each([
    [B, { prediction: wrongPick(B) }, 'picked_lighter', DOWN_MODEL_LEVER, FAR_PAIR_LEVER],
    [C, { prediction: 'a' }, 'tall_means_more', CUP_LINES_LEVER, EASY_PAIR_LEVER],
    [P, { chosenCount: 5 }, 'one_short', POURED_SHELF_LEVER, SMALLER_POUR_LEVER],
    [P, { chosenCount: 7 }, 'one_over', POURED_SHELF_LEVER, SMALLER_POUR_LEVER],
    [P, { chosenCount: 3 }, 'too_few', POURED_SHELF_LEVER, SMALLER_POUR_LEVER],
    [O, { order: [...want].reverse() }, 'most_to_least', ORDER_STEPS_LEVER, LEVEL_LINES_LEVER],
    [O, { order: [want[1], want[0], want[2]] }, 'two_swapped', LEVEL_LINES_LEVER, FAR_LEVELS_LEVER],
  ] as const)('%#: %o → %s → %s, then %s', (c, over, miss, first, second) => {
    expect(measureMiss(c, { ...EMPTY_VIEW, ...over })).toBe(miss);
    expect(nextLever(measureLabLevers(c, []), miss)).toBe(first);
    expect(nextLever(measureLabLevers(c, [first]), miss)).toBe(second);
  });
  it('capacity picked_less goes to the cup shelves', () => {
    const c = capacities.find(x => x.containerA!.shape !== 'tall' && x.expectedChoice === 'b')!;
    expect(measureMiss(c, { ...EMPTY_VIEW, prediction: 'a' })).toBe('picked_less');
    expect(nextLever(measureLabLevers(c, []), 'picked_less')).toBe(CUP_LINES_LEVER);
  });
  it('every catalog miss is answered by a lever on every item, generated and saved (J9, J12)', () => {
    const tw = getComponentById('measure-lab')!.teachingWorkspace!;
    expect(tw.levers).toBe(true);
    for (const c of [...ALL, ...PAYLOADS]) {
      const levers = measureLabLevers(c, []);
      for (const m of tw.misses![c.type]) expect(levers.some(l => l.answers?.includes(m)), `${c.id} ${m}`).toBe(true);
    }
  });
});
