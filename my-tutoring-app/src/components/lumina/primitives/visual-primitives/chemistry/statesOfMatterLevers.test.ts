import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import observeP from '../../../components/live-activity/runtime/testing/w1-payloads/states-of-matter.observe.json';
import predictP from '../../../components/live-activity/runtime/testing/w1-payloads/states-of-matter.predict.json';
import compareP from '../../../components/live-activity/runtime/testing/w1-payloads/states-of-matter.compare.json';
import { statesItems } from '../../../components/live-activity/adapters/statesOfMatterLive';
import { statesAssignment, statesSpokenMisses } from './statesOfMatterWorkspace';
import {
  FAR_GAP, leversOnScreen, MODEL_COLOR, modelPairFor, modelPairLeaks, PARTICLE_MODELS, particleModelsLeak, practiceItem,
  practiceLeaks, practiceParent, statesLevers, statesLeverSession, stripFor, stripLeaks,
} from './statesOfMatterLevers';
import { itemFromChallenge, SUBSTANCES, tempSpoken, type StatesOfMatterItem } from './statesOfMatterScript';

const PAYLOADS: Record<string, any> = {
  observe: (observeP as any).data, predict: (predictP as any).data, compare: (compareP as any).data,
};
const tiers = ['easy', 'medium', 'hard'] as const;
const sessionOf = (data: any, items: StatesOfMatterItem[]) => statesLeverSession(items, data.gradeBand ?? '3-5');

describe.each(Object.keys(PAYLOADS))('%s payload', key => {
  const data = PAYLOADS[key];
  const byTier = tiers.map(t => statesItems({ ...data, supportTier: t }));
  const cases = byTier.flatMap(items => items.map(i => [`${i.id}/${i.tier}`, i, sessionOf(data, items), items] as const));
  it('has items', () => expect(byTier[1].length).toBeGreaterThan(0));

  it.each(cases)('%s: every checked miss has a lever on this item', (_id, item, s) => {
    const levers = statesLevers(item, s, []);
    for (const m of statesSpokenMisses(item)) expect(levers.some(l => l.answers?.includes(m.id)), `${item.id} ${m.id}`).toBe(true);
    expect(levers.filter(l => l.kind === 'help')).toHaveLength(1);
  });

  it.each(cases)('%s: the help drawing passes its leak rule and its fact never says the answer', (_id, item, s) => {
    const all = statesLevers(item, s, []).map(l => l.id);
    const fact = leversOnScreen(item, all, s) ?? '';
    expect(fact).not.toBe('');
    if (item.kind === 'name_state') expect(particleModelsLeak(PARTICLE_MODELS, MODEL_COLOR, item)).toBe(false);
    const strip = stripFor(item);
    if (strip) {
      expect(stripLeaks(strip, item)).toBe(false);
      expect(fact).not.toMatch(new RegExp(`(^|[^\d])${tempSpoken(item.targetTemp!)}`));
    }
    const model = modelPairFor(item, s);
    if (item.pair) {
      expect(model).not.toBeNull();
      expect(modelPairLeaks(model!, item)).toBe(false);
      for (const x of item.pair) expect(fact).not.toContain(x.name);
    }
    if (item.answerChange) expect(fact.match(new RegExp(item.answerChange, 'g'))?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it.each(cases)('%s: a practice item is the same mode, another substance, one step simpler, and clean', (_id, item, s, items) => {
    const p = practiceItem(item, s);
    if (!p) {
      const plainest = (item.kind === 'name_state' && item.tier === 'easy')
        || ((item.kind === 'predict_state' || item.kind === 'predict_change') && !item.substance!.boilingIsReal) || !!item.pair;
      expect(plainest, item.id).toBe(true);
      return;
    }
    expect(practiceLeaks(p, item)).toBe(false);
    expect(p.id).toBe(`${item.id}~simpler`);
    expect(practiceParent(p.id, items)).toBe(item);
    // Rebuilding it from the payload gives the same item (the journey row does this).
    expect(practiceItem(practiceParent(p.id, items)!, s)).toEqual(p);
    const task = statesAssignment(p).task;
    for (const x of item.pair ?? [item.substance!]) expect(task).not.toContain(x.name);
    if (p.kind === 'name_state') expect(task).toMatch(/solid, liquid, or gas\?$/);
  });
});

describe('the simplify builders reach the saved lessons', () => {
  const ids = (key: string) => {
    const data = PAYLOADS[key];
    const items = statesItems({ ...data, supportTier: 'medium' });
    return items.filter(i => practiceItem(i, sessionOf(data, items))).map(i => i.id);
  };
  it('observe: every medium item has one', () => expect(ids('observe')).toEqual(statesItems(PAYLOADS.observe).map(i => i.id)));
  it('predict: the items on a substance that boils', () =>
    expect(ids('predict')).toEqual(['som-1-predict', 'som-4-predict', 'som-5-predict', 'som-6-predict']));
  it('compare: the close pair gets a far pair, the far pair has none left in the K-2 band', () =>
    expect(ids('compare')).toEqual(['som-2-compare']));
});

describe('builders over many items', () => {
  const pool = Object.values(SUBSTANCES);
  const built: StatesOfMatterItem[] = [];
  for (const band of ['K-2', '3-5'] as const) {
    for (const a of pool) for (const t of [-230, -60, -20, 10, 20, 45, 80, 150, 500, 2000]) {
      const o = itemFromChallenge({ id: `o-${a.key}-${t}`, challengeType: 'observe', substanceKey: a.key, startTemp: t }, { band });
      if (o) built.push(o);
      for (const u of [-240, -200, 5, 40, 75, 130, 420, 1600, 3000]) for (const kind of ['predict_state', 'predict_change']) {
        const p = itemFromChallenge({ id: `p-${a.key}-${t}-${u}-${kind}`, challengeType: 'predict', kind, substanceKey: a.key, startTemp: t, targetTemp: u }, { band });
        if (p) built.push(p);
      }
      for (const b of pool) for (const kind of ['melt_first', 'stay_solid']) {
        const c = itemFromChallenge({ id: `c-${a.key}-${b.key}-${t}-${kind}`, challengeType: 'compare', kind, pairKeys: [a.key, b.key], startTemp: t - 260, targetTemp: t }, { band });
        if (c) built.push(c);
      }
    }
  }
  it('builds a wide spread', () => expect(built.length).toBeGreaterThan(200));
  it('every practice item is valid and passes its leak rule; every help drawing passes its own', () => {
    for (const item of built) {
      const band = item.substance?.bands.includes('K-2') && (item.pair ?? []).every(x => x.bands.includes('K-2')) ? 'K-2' : '3-5';
      const s = statesLeverSession([item], band);
      const p = practiceItem(item, s);
      if (p) {
        expect(practiceLeaks(p, item), item.id).toBe(false);
        if (p.pair) expect(Math.abs(p.pair[0].meltingPoint - p.pair[1].meltingPoint)).toBeGreaterThanOrEqual(FAR_GAP);
      }
      const strip = stripFor(item);
      if (strip) expect(stripLeaks(strip, item), item.id).toBe(false);
      const m = modelPairFor(item, s);
      if (m) expect(modelPairLeaks(m, item), item.id).toBe(false);
    }
  });
});

describe('leak rules refuse what they must', () => {
  const water = itemFromChallenge({ id: 'w', challengeType: 'predict', kind: 'predict_state', substanceKey: 'water', startTemp: 50, targetTemp: 130 })!;
  it('a strip with the target marked leaks', () => {
    const strip = stripFor(water)!;
    expect(stripLeaks({ ...strip, now: 130 }, water)).toBe(true);
    expect(stripLeaks({ ...strip, marks: [...strip.marks, { temp: 130, label: 'here' }] }, water)).toBe(true);
    expect(stripLeaks({ ...strip, labels: strip.labels.slice(1) }, water)).toBe(true);
  });
  it('particle models in the substance\'s own colour, or two of one state, leak', () => {
    const obs = itemFromChallenge({ id: 'o', challengeType: 'observe', substanceKey: 'water', startTemp: 50 })!;
    expect(particleModelsLeak(PARTICLE_MODELS, SUBSTANCES.water.color.liquid, obs)).toBe(true);
    expect(particleModelsLeak([PARTICLE_MODELS[0], PARTICLE_MODELS[0], PARTICLE_MODELS[2]], MODEL_COLOR, obs)).toBe(true);
  });
  it('a model pair that reuses the item\'s substance, or where both or neither melted, leaks', () => {
    const cmp = itemFromChallenge({ id: 'c', challengeType: 'compare', kind: 'melt_first', pairKeys: ['chocolate', 'wax'], startTemp: 14 }, { band: 'K-2' })!;
    expect(modelPairLeaks({ pair: [SUBSTANCES.water, SUBSTANCES.wax], temp: 30 }, cmp)).toBe(true);
    expect(modelPairLeaks({ pair: [SUBSTANCES.water, SUBSTANCES.butter], temp: 50 }, cmp)).toBe(true);
    expect(modelPairLeaks({ pair: [SUBSTANCES.water, SUBSTANCES.butter], temp: 16 }, cmp)).toBe(false);
  });
});

describe('this wrong answer, then this lever', () => {
  const data = PAYLOADS;
  const first = (key: string, kind?: string) => {
    const items = statesItems({ ...data[key], supportTier: 'medium' });
    const item = items.find(i => !kind || i.kind === kind)!;
    return statesLevers(item, sessionOf(data[key], items), []);
  };
  it.each([
    ['observe', undefined, 'other_state', 'particle_models'],
    ['observe', undefined, 'said_substance_back', 'particle_models'],
    ['predict', 'predict_state', 'said_start_state', 'temperature_strip'],
    ['predict', 'predict_state', 'other_state', 'temperature_strip'],
    ['predict', 'predict_change', 'said_end_state', 'temperature_strip'],
    ['predict', 'predict_change', 'opposite_change', 'temperature_strip'],
    ['compare', undefined, 'other_of_pair', 'model_pair'],
  ])('%s %s: %s -> %s', (key, kind, miss, lever) => expect(nextLever(first(key, kind), miss)).toBe(lever));
  it('after help, the simplify lever comes next', () => {
    const levers = first('observe').map(l => ({ ...l, pulled: l.kind === 'help' }));
    expect(nextLever(levers, 'other_state')).toBe('three_named');
  });
});
