import { describe, expect, it } from 'vitest';
import { COVERAGE } from './lifeLab.fixtures';
import {
  LIFE_MODES, classify, goalMet, initState, missOf, predictionKey, sessionChecks, settleBench, seededRng, simulate, solve,
  worldChecks, type LifeWorld,
} from './lifeLabWorld';

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

describe('coverage: one hand-built world per mode passes every check and carries its mode', () => {
  for (const mode of LIFE_MODES) {
    it(mode, () => {
      const c = COVERAGE[mode];
      const checks = worldChecks(c.world, c.ask, c.why, { grade: c.grade });
      expect(checks.blocking).toEqual([]);
      expect(checks.mode).toBe(mode);
      const sol = solve(c.world);
      expect(sol.solutions).toBeGreaterThan(0);
      expect(goalMet(c.world, sol.first!)).toBe(true);
      expect(sol.wrong && goalMet(c.world, sol.wrong)).toBe(false);
    });
  }
});

describe('the engine', () => {
  it('needs: moving each animal home makes everyone thrive; a wrong home says why', () => {
    const w = COVERAGE.where_it_lives.world;
    const s = initState(w);
    const r0 = simulate(w, s);
    expect(r0.status.bear).toBe('struggles');
    expect(r0.reasons.bear).toMatch(/hot is wrong for it/);
    s.beings.bear.zone = 'ice'; s.beings.camel.zone = 'desert'; s.beings.frog.zone = 'pond';
    expect(goalMet(w, s)).toBe(true);
  });
  it('fair test: two pots that differ only in light, one dark, is the only shape that passes', () => {
    const w = COVERAGE.fair_test.world;
    const s = initState(w);
    s.zones.pot2.light = 0;
    expect(goalMet(w, s)).toBe(true);
    const t = initState(w);
    t.zones.pot2.light = 0; t.zones.pot2.water = 2; t.zones.pot3 = { light: 1, water: 0 };
    expect(goalMet(w, t)).toBe(false);
  });
  it('part: only the thick beak cracks hard seeds; a seed with hooks rides the fox away', () => {
    const w = COVERAGE.part_for_the_job.world;
    const s = initState(w);
    s.beings.finch.traits.beak = 'thick';
    expect(simulate(w, s).action).toMatchObject({ ok: true });
    const seeds = COVERAGE.spread_the_seeds.world;
    const t = initState(seeds);
    t.beings.seed.traits.seed = 'hooks';
    expect(simulate(seeds, t).moved.seed).toBe('far');
    t.beings.seed.traits.seed = 'wings';
    expect(simulate(seeds, t).action!.text).toMatch(/stayed where it was/);
  });
  it('inheritance: exactly the puppy whose every trait comes from a parent', () => {
    const w = COVERAGE.whose_baby.world;
    expect(simulate(w, initState(w)).possible).toEqual(['pupB']);
  });
  it('life cycle: a foreign stage and a wrong pair are told apart', () => {
    const w = COVERAGE.life_cycle.world;
    const s = initState(w);
    s.order = ['egg', 'tadpole', 'chrysalis', 'butterfly'];
    expect(missOf(w, s, simulate(w, s))).toBe('not_in_cycle');
    s.order = ['egg', 'chrysalis', 'caterpillar', 'butterfly'];
    expect(simulate(w, s).order!.why).toMatch(/does not come straight from/);
    expect(missOf(w, s, simulate(w, s))).toBe('out_of_order');
  });
  it('a hunted population: on dark bark there are more dark moths after 4 families', () => {
    expect(predictionKey(COVERAGE.survive_and_change.world)).toBe('dark');
    const w = clone(COVERAGE.survive_and_change.world);
    w.zones[0].cond.color = 'light';
    expect(predictionKey(w)).toBe('light');
  });
  it('a breath: the stop names the part; lungs given water is the wrong medium', () => {
    const w = COVERAGE.follow_the_path.world;
    const s = initState(w);
    s.order = ['mouth', 'lungs'];
    const r = simulate(w, s);
    expect(r.trace!.why).toMatch(/lungs cannot take water/);
    expect(missOf(w, s, r)).toBe('wrong_medium');
    s.order = ['gills'];
    expect(missOf(w, s, simulate(w, s))).toBe('no_way_in');
    s.order = ['mouth', 'gills'];
    expect(goalMet(w, s)).toBe(true);
  });
});

describe('shortcuts and leaks are blocked', () => {
  const blocked = (w: LifeWorld, ask: string, why = 'Try again.') => worldChecks(w, ask, why).blocking.join(' | ');
  it('a goal true before the child acts', () => {
    const w = clone(COVERAGE.where_it_lives.world);
    w.beings = [{ id: 'bear', subject: 'polar_bear', zone: 'ice' }, { id: 'camel', subject: 'camel', zone: 'desert' }, { id: 'frog', subject: 'frog', zone: 'pond' }];
    expect(blocked(w, 'Move the animals?')).toMatch(/already true/);
  });
  it('the ask naming the part that works', () => {
    expect(blocked(COVERAGE.part_for_the_job.world, 'Can a thick short beak crack these?')).toMatch(/names "thick short beak"/);
  });
  it('every option working', () => {
    const w = clone(COVERAGE.part_for_the_job.world);
    (w.controls[0] as { options: string[] }).options = ['thick'];
    expect(blocked(w, 'Which beak?')).toMatch(/2-4 options/);
  });
  it('a baby that is a copy of one parent, or two babies that fit', () => {
    const w = clone(COVERAGE.whose_baby.world);
    w.beings[3].traits = { ears: 'floppy', coat: 'spots', color: 'brown' };
    expect(blocked(w, 'Which puppy?')).toMatch(/2 young could belong|copy of one parent/);
  });
  it('an ask that lists the stages in order, and a breath ask that names the gills', () => {
    expect(blocked(COVERAGE.life_cycle.world, 'An egg becomes a caterpillar, then a chrysalis, then a butterfly. Put them in order.')).toMatch(/lists the stages in order/);
    expect(blocked(COVERAGE.follow_the_path.world, 'Build the path through the gills.')).toMatch(/names the gills/);
  });
});

describe('every kind of world can reach every tier (USER 2026-11-08: the objective picks the world, the tier shapes it)', () => {
  type Opt = { value: string; label: string; works: string[] };
  const opt = (v: string, works: string[] = []): Opt => ({ value: v, label: v, works });
  const part = (also: string[], options: Opt[]): LifeWorld => ({
    zones: [{ id: 'z', label: 'Marsh', cond: { food: 'fish', ground: 'mud', depth: 'deep' } }],
    beings: [{ id: 'a', zone: 'z', name: 'heron', emoji: '🪶', traits: { bill: 'x' } }],
    rules: [{ kind: 'part_enables', being: 'a', part: 'bill', on: 'food', job: 'eat', also }],
    controls: [{ type: 'trait', being: 'a', part: 'bill', options }], goal: { kind: 'action' } });
  const seed = (also: string[], options: Opt[]): LifeWorld => ({
    zones: [{ id: 'z', label: 'Patch', cond: { carrier: 'wind', ground: 'rock', depth: 'far' } }, { id: 'f', label: 'Far', cond: {} }],
    beings: [{ id: 's', zone: 'z', name: 'seed', emoji: '🌰', traits: { seed: 'x' } }],
    rules: [{ kind: 'part_enables', being: 's', part: 'seed', on: 'carrier', job: 'travel', moveTo: 'f', also }],
    controls: [{ type: 'trait', being: 's', part: 'seed', options }], goal: { kind: 'action' } });
  const hide = (also: string[], options: Opt[]): LifeWorld => ({
    zones: [{ id: 'z', label: 'Bark', cond: { color: 'green', texture: 'ragged' } }],
    beings: [{ id: 'm', zone: 'z', name: 'moth', emoji: '🦋', traits: { color: 'x' } }, { id: 'h', zone: 'z', name: 'bird', emoji: '🐦' }],
    rules: [{ kind: 'spots', predator: 'h', prey: 'm', also }],
    controls: [{ type: 'trait', being: 'm', part: 'color', options }], goal: { kind: 'survives' } });
  const baby = (young: string[][], traits: string[]): LifeWorld => {
    const dog = (id: string, zone: string, vals: string[]) => ({ id, zone, name: 'dog', emoji: '🐕', traits: Object.fromEntries(traits.map((t, i) => [t, vals[i]])) });
    return { zones: [{ id: 'p', label: 'Parents', cond: {} }, { id: 'y', label: 'Young', cond: {} }],
      beings: [dog('m', 'p', traits.map(() => 'a')), dog('f', 'p', traits.map(() => 'b')), ...young.map((v, i) => dog(`y${i}`, 'y', v))],
      rules: [{ kind: 'inherits', parents: ['m', 'f'], traits }], controls: [{ type: 'choose', among: young.map((_, i) => `y${i}`) }], goal: { kind: 'choose' } };
  };
  const moths = (light: number, dark: number, steps: number): LifeWorld => ({
    zones: [{ id: 'z', label: 'Bark', cond: { color: 'light' } }],
    beings: [{ id: 'm', zone: 'z', name: 'moth', emoji: '🦋', variants: [{ value: 'light', count: light }, { value: 'dark', count: dark }] }, { id: 'h', zone: 'z', name: 'bird', emoji: '🐦' }],
    rules: [{ kind: 'spots', predator: 'h', prey: 'm' }], controls: [{ type: 'predict', of: 'm' }], goal: { kind: 'prediction' }, steps });
  const need = { light: [1, 2], water: [1, 2] } as never;
  const pots = (n: number, set: number, keys: Array<'light' | 'water'>, goal: LifeWorld['goal']): LifeWorld => ({
    zones: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, label: `Pot ${i + 1}`, cond: i >= set ? { light: 2, water: 1 } : { light: 0, water: 0 } })),
    beings: Array.from({ length: n }, (_, i) => ({ id: `b${i}`, zone: `p${i}`, name: 'bean', emoji: '🌱', kind: 'plant' as const, needs: need })),
    rules: [{ kind: 'needs', beings: Array.from({ length: n }, (_, i) => `b${i}`) }],
    controls: [{ type: 'condition', zones: Array.from({ length: set }, (_, i) => `p${i}`), keys }], goal, steps: 3 });
  const homes = (n: number): LifeWorld => {
    const conds = [{ temp: 0 }, { temp: 2 }, { temp: 1, water: 2 }, { temp: 1, water: 0 }] as never[];
    const needs = [{ temp: [0, 0] }, { temp: [2, 2] }, { temp: [1, 1], water: [2, 2] }, { temp: [1, 1], water: [0, 0] }] as never[];
    return { zones: Array.from({ length: n }, (_, i) => ({ id: `z${i}`, label: `Place ${i}`, cond: conds[i] })),
      beings: Array.from({ length: n }, (_, i) => ({ id: `b${i}`, zone: `z${(i + 1) % n}`, name: `animal ${i}`, emoji: '🐾', needs: needs[i] })),
      rules: [{ kind: 'needs', beings: Array.from({ length: n }, (_, i) => `b${i}`) }],
      controls: [{ type: 'move', beings: Array.from({ length: n }, (_, i) => `b${i}`), zones: Array.from({ length: n }, (_, i) => `z${i}`) }], goal: { kind: 'all_thrive' }, steps: 3 };
  };
  const cycle = (n: number, extra: boolean): LifeWorld => {
    const stages = Array.from({ length: n }, (_, i) => ({ id: `s${i}`, name: `stage ${i}`, emoji: '🌱' }));
    return { zones: [], beings: [], rules: [{ kind: 'stages', of: 'bean', stages }],
      controls: [{ type: 'order', slots: n, items: [...stages.map(s => s.id), ...(extra ? ['x'] : [])], extras: extra ? [{ id: 'x', name: 'egg', emoji: '🥚' }] : undefined }], goal: { kind: 'order' } };
  };
  const path = (n: number, slots: number): LifeWorld => {
    const parts = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `part ${i}`, takes: i < slots ? { [`t${i}`]: `t${i + 1}` } : { zzz: 'yyy' } }));
    return { zones: [{ id: 'z', label: 'Pond', cond: {} }], beings: [{ id: 'f', zone: 'z', name: 'fish', emoji: '🐟' }],
      rules: [{ kind: 'flows', being: 'f', start: 't0', goal: `t${slots}`, parts }], controls: [{ type: 'order', slots, items: parts.map(p => p.id) }], goal: { kind: 'flow' } };
  };
  const trait = (make: (also: string[], o: Opt[]) => LifeWorld, a: string, b: string, right: string[], nearA: string[], nearB: string[]) => ({
    easy: make([], [opt('r', right.slice(0, 1)), opt('o')]),
    medium: make([b], [opt('r', right), opt('n', nearA), opt('o'), opt('p')]),
    hard: make([b, a], [opt('r', [...right, ...nearB]), opt('n', nearA), opt('m', nearB), opt('q', nearA)]),
  });
  const parts = trait(part, 'depth', 'ground', ['fish', 'mud'], ['fish'], ['deep']);
  const seeds = trait(seed, 'depth', 'ground', ['wind', 'rock'], ['wind'], ['far']);
  const camo = {
    easy: hide([], [opt('green'), opt('red')]),
    medium: hide(['texture'], [opt('green', ['ragged']), opt('red', ['ragged']), opt('blue'), opt('tan')]),
    hard: hide(['texture'], [opt('green', ['ragged']), opt('red', ['ragged']), opt('blue', ['ragged']), opt('tan', ['ragged'])]),
  };
  const table: Record<string, Record<'easy' | 'medium' | 'hard', LifeWorld>> = {
    part_for_the_job: parts, spread_the_seeds: seeds, hide_from_the_hunter: camo,
    whose_baby: {
      easy: baby([['a', 'b'], ['a', 'c']], ['ears', 'coat']),
      medium: baby([['a', 'b', 'a'], ['c', 'b', 'a'], ['a', 'c', 'a']], ['ears', 'coat', 'tail']),
      hard: baby([['a', 'b', 'a', 'b'], ['c', 'b', 'a', 'b'], ['a', 'c', 'a', 'b'], ['a', 'b', 'c', 'b']], ['ears', 'coat', 'tail', 'nose']),
    },
    survive_and_change: { easy: moths(6, 6, 2), medium: moths(6, 6, 4), hard: moths(2, 8, 5) },
    where_it_lives: { easy: homes(2), medium: homes(3), hard: homes(4) },
    what_it_needs: { easy: pots(1, 1, ['light', 'water'], { kind: 'all_thrive' }), medium: pots(2, 2, ['light', 'water'], { kind: 'all_thrive' }), hard: pots(3, 3, ['light', 'water'], { kind: 'all_thrive' }) },
    fair_test: { easy: pots(2, 1, ['light', 'water'], { kind: 'fair_test', variable: 'light' }), medium: pots(3, 2, ['light', 'water'], { kind: 'fair_test', variable: 'light' }), hard: pots(3, 3, ['light', 'water'], { kind: 'fair_test', variable: 'light' }) },
    life_cycle: { easy: cycle(3, false), medium: cycle(4, false), hard: cycle(6, true) },
    follow_the_path: { easy: path(3, 1), medium: path(4, 3), hard: path(6, 4) },
  };
  it('the table covers every label', () => expect(Object.keys(table).sort()).toEqual([...LIFE_MODES].sort()));
  for (const [label, tiers] of Object.entries(table)) for (const tier of ['easy', 'medium', 'hard'] as const) {
    it(`${label}: ${tier}`, () => {
      const k = worldChecks(tiers[tier], 'Help this living thing.', 'Look again.');
      expect(k.blocking).toEqual([]);
      expect(k.mode).toBe(label);
      expect(k.difficulty, JSON.stringify(k.difficulty)).toMatchObject({ band: tier });
    });
  }
  it('a choice must fit every feature: a part that fits one of two does not work', () => {
    const w = parts.medium;
    const s = initState(w);
    s.beings.a.traits.bill = 'n';
    expect(goalMet(w, s)).toBe(false);
    s.beings.a.traits.bill = 'r';
    expect(goalMet(w, s)).toBe(true);
  });
  it('two colorings with one value are refused: a tap on one would select the other', () => {
    const w = hide(['texture'], [opt('green', ['ragged']), opt('green', ['smooth']), opt('red', ['ragged'])]);
    expect(worldChecks(w, 'Help this moth.', 'Look again.').blocking.join()).toMatch(/its own value/);
  });
  it('a world of any kind is no longer refused for its kind', () => {
    const c = COVERAGE.life_cycle;
    expect(worldChecks(c.world, c.ask, c.why, {}).blocking).toEqual([]);
  });
});

describe('difficulty and the session', () => {
  it('a fair test scores harder than moving three animals home', () => {
    const d = (m: keyof typeof COVERAGE) => worldChecks(COVERAGE[m].world, COVERAGE[m].ask, COVERAGE[m].why).difficulty!;
    expect(d('fair_test').score).toBeGreaterThan(d('where_it_lives').score);
    expect(d('fair_test').reasons.join()).toMatch(/fair test/);
  });
  it('blocks a repeated answer; a session of one kind of world on different living things passes', () => {
    const a = { ...COVERAGE.part_for_the_job, mode: 'part_for_the_job' as const, key: 'thick short beak' };
    expect(sessionChecks([a, a, a], {}).join()).toMatch(/same answer/);
    const other = (key: string, name: string) => ({ ...a, key, world: { ...a.world, beings: [{ ...a.world.beings[0], name }] } });
    expect(sessionChecks([a, other('b', 'owl'), other('c', 'heron')], {})).toEqual([]);
  });
  it('the bench is shuffled, never in the real order', () => {
    const w = settleBench(COVERAGE.life_cycle.world, seededRng(3));
    const items = (w.controls[0] as { items: string[] }).items;
    expect(items.slice(0, 4).join()).not.toBe('egg,caterpillar,chrysalis,butterfly');
    expect(classify(w)?.mode).toBe('life_cycle');
  });
});

describe('rules from reading real generations (2026-11-07)', () => {
  const blocked = (w: LifeWorld, ask: string, why = 'Look again.') => worldChecks(w, ask, why).blocking.join(' | ');
  const duck = (ground: string, options = ['claws', 'webbed', 'pads']): LifeWorld => ({
    zones: [{ id: 'z', label: 'Pond', kind: 'pond', cond: { ground: ground as never } }],
    beings: [{ id: 'd', subject: 'duck', zone: 'z', traits: { feet: 'claws' } }],
    rules: [{ kind: 'part_enables', being: 'd', part: 'feet' }], controls: [{ type: 'trait', being: 'd', part: 'feet', options }], goal: { kind: 'action' } });
  it('an ask that says what the working part does ("push water like paddles") is a giveaway', () => {
    expect(blocked(duck('water'), 'Give it feet that push water like paddles.')).toMatch(/says "paddle"/);
    expect(blocked(duck('water'), 'This duck needs to swim across the pond. Pick its feet.')).toBe('');
  });
  it('an ask that contradicts its one place ("in the dark" in bright light)', () => {
    const w = clone(COVERAGE.what_it_needs.world);
    w.zones[0].cond = { light: 2, water: 0 };
    expect(blocked(w, 'This sunflower is in the dark. Change its light and water.')).toMatch(/says "dark", but Sunflower pot has bright light/);
  });
  it('a place that is not what its kind says (a wet desert), unless the child sets it', () => {
    const w = clone(COVERAGE.where_it_lives.world);
    w.zones[1].cond = { temp: 2, water: 2 };
    expect(blocked(w, COVERAGE.where_it_lives.ask)).toMatch(/is a desert but wet or cold/);
  });
  it('a seed carried by fur rides the animal the scene shows', () => {
    const w = clone(COVERAGE.spread_the_seeds.world);
    w.beings[1].subject = 'dog';
    const s = initState(w);
    s.beings.seed.traits.seed = 'hooks';
    expect(simulate(w, s).action!.text).toMatch(/^The dog carried the seed/);
  });
  it('camouflage reaches past two answers: a beetle on green leaves, four colorings', () => {
    const w: LifeWorld = {
      zones: [{ id: 'leaf', label: 'Leaves', kind: 'forest', cond: { color: 'green' } }],
      beings: [{ id: 'b', subject: 'beetle', zone: 'leaf', traits: { color: 'brown' } }, { id: 'h', subject: 'bird', zone: 'leaf' }],
      rules: [{ kind: 'spots', predator: 'h', prey: 'b' }], controls: [{ type: 'trait', being: 'b', part: 'color', options: ['brown', 'green', 'white', 'sandy'] }],
      goal: { kind: 'survives' } };
    const k = worldChecks(w, 'A bird hunts beetles on these leaves. Pick a coloring that keeps the beetle safe.', 'The bird hunts with its eyes.');
    expect(k.blocking).toEqual([]);
    expect(k.mode).toBe('hide_from_the_hunter');
    expect(k.key).toBe('green coloring');
    expect(blocked(w, 'Pick the green coloring to hide it.')).toMatch(/names the green coloring/);
  });
  it('inheritance errors name the young and the trait to fix', () => {
    const w = clone(COVERAGE.whose_baby.world);
    delete w.beings[2].traits!.coat;
    expect(blocked(w, 'Which puppy?')).toMatch(/pupA needs a value for "coat"/);
  });
});

describe('rules from the second read (2026-11-07)', () => {
  const blocked = (w: LifeWorld, ask: string, why = 'Look again.') => worldChecks(w, ask, why).blocking.join(' | ');
  it('a synonym names the path ("moist skin" for wet skin)', () => {
    const w = clone(COVERAGE.follow_the_path.world);
    w.beings[0].subject = 'frog';
    (w.controls[0] as { slots: number; items: string[] }).items = ['wet_skin', 'gills', 'lungs', 'stomach'];
    expect(blocked(w, 'This frog takes in oxygen through its moist skin. Build the path.')).toMatch(/names the wet skin/);
  });
  it('one dial only, and an ask that names what is missing', () => {
    const w = clone(COVERAGE.what_it_needs.world);
    (w.controls[0] as { keys: string[] }).keys = ['light'];
    expect(blocked(w, 'Change the sunflower so it grows.')).toMatch(/only one thing/);
    expect(blocked(COVERAGE.what_it_needs.world, 'This sunflower needs more light. Change it.')).toMatch(/names what is missing/);
    const f = clone(COVERAGE.fair_test.world);
    (f.controls[0] as { keys: string[] }).keys = ['light'];
    expect(blocked(f, COVERAGE.fair_test.ask)).toMatch(/only the thing being tested/);
  });
});

it('a life-cycle ask that says where the life starts ("grows from an egg") is blocked', () => {
  const c = COVERAGE.life_cycle;
  expect(worldChecks(c.world, 'Show how a butterfly grows from an egg.', c.why).blocking.join()).toMatch(/starts with the egg/);
  expect(worldChecks(c.world, c.ask, c.why).blocking).toEqual([]);
});

describe('I12: the agent writes the content; no list in code is a gate', () => {
  const ok = (w: LifeWorld, ask: string, why = 'Look again.') => worldChecks(w, ask, why);
  it('whose baby for monarch butterflies, with traits the world declares', () => {
    const butterfly = (id: string, zone: string, wings: string, spots: string) => ({ id, zone, name: 'monarch', emoji: '🦋', traits: { wings, spots } });
    const w: LifeWorld = {
      zones: [{ id: 'p', label: 'Parents', cond: {} }, { id: 'y', label: 'Young', cond: {} }],
      beings: [butterfly('mom', 'p', 'orange', 'many'), butterfly('dad', 'p', 'yellow', 'few'),
        butterfly('a', 'y', 'red', 'many'), butterfly('b', 'y', 'yellow', 'many'), butterfly('c', 'y', 'orange', 'none')],
      rules: [{ kind: 'inherits', parents: ['mom', 'dad'], traits: ['wings', 'spots'] }], controls: [{ type: 'choose', among: ['a', 'b', 'c'] }], goal: { kind: 'choose' } };
    const k = ok(w, 'Here are two monarch parents. Which young monarch could be theirs?');
    expect(k.blocking).toEqual([]);
    expect(k.mode).toBe('whose_baby');
    expect(k.key).toBe('b');
  });
  it('a life cycle the world declares (a sunflower), with a stage from another life', () => {
    const w: LifeWorld = { zones: [], beings: [], goal: { kind: 'order' },
      rules: [{ kind: 'stages', of: 'sunflower', stages: [{ id: 's1', name: 'seed', emoji: '🌰' }, { id: 's2', name: 'sprout', emoji: '🌱' }, { id: 's3', name: 'bud', emoji: '🌿' }, { id: 's4', name: 'flower', emoji: '🌻' }] }],
      controls: [{ type: 'order', slots: 4, items: ['s3', 's1', 's4', 's2', 'x'], extras: [{ id: 'x', name: 'egg', emoji: '🥚' }] }] };
    const k = ok(w, 'Put the sunflower pictures in the order of its life.');
    expect(k.blocking).toEqual([]);
    expect(k.key).toBe('seed → sprout → bud → flower');
  });
  it('a part the world declares (a cactus\'s spines against a thirsty deer), with what each option works on', () => {
    const w: LifeWorld = {
      zones: [{ id: 'd', label: 'Dry desert', kind: 'desert', cond: { temp: 2, water: 0, threat: 'deer that eat plants' } }],
      beings: [{ id: 'c', zone: 'd', name: 'cactus', emoji: '🌵', kind: 'plant', traits: { cover: 'smooth' } }],
      rules: [{ kind: 'part_enables', being: 'c', part: 'cover', on: 'threat', job: 'stay safe' }],
      controls: [{ type: 'trait', being: 'c', part: 'cover', options: [
        { value: 'smooth', label: 'smooth skin', works: [] }, { value: 'spines', label: 'sharp spines', emoji: '🌵', works: ['deer that eat plants'] },
        { value: 'leaves', label: 'big soft leaves', works: [] }] }],
      goal: { kind: 'action' } };
    const k = ok(w, 'Hungry deer walk through this desert. Give the cactus a cover so it stays safe.');
    expect(k.blocking).toEqual([]);
    expect(k.mode).toBe('part_for_the_job');
    expect(k.key).toBe('sharp spines');
    expect(ok(w, 'Give the cactus sharp things on its skin.').blocking.join()).toMatch(/only the working option has/);
  });
  it('a flow the world declares (food through a person) reaches its goal only through the parts that take it', () => {
    const w: LifeWorld = {
      zones: [{ id: 'k', label: 'Kitchen', cond: {} }], beings: [{ id: 'p', zone: 'k', name: 'person', emoji: '🧒' }], goal: { kind: 'flow' },
      rules: [{ kind: 'flows', being: 'p', start: 'sandwich', goal: 'food in the blood', parts: [
        { id: 'm', name: 'mouth', takes: { sandwich: 'chewed food' } }, { id: 's', name: 'stomach', takes: { 'chewed food': 'mush' } },
        { id: 'i', name: 'intestines', takes: { mush: 'food in the blood' } }, { id: 'l', name: 'lungs', takes: { air: 'oxygen' } }] }],
      controls: [{ type: 'order', slots: 3, items: ['l', 'i', 'm', 's'] }] };
    const k = ok(w, 'This person ate a sandwich. Build the path the food takes into the blood.');
    expect(k.blocking).toEqual([]);
    expect(k.key).toBe('mouth → stomach → intestines');
    const s = initState(w); s.order = ['m', 'l'];
    expect(missOf(w, s, simulate(w, s))).toBe('not_a_breathing_part');
  });
  it('an organism no atlas has is accepted with its declared needs', () => {
    const w: LifeWorld = {
      zones: [{ id: 'a', label: 'Cave', kind: 'cave', cond: { light: 0, water: 2 } }, { id: 'b', label: 'Sunny rock', cond: { light: 2, water: 0 } }],
      beings: [{ id: 'x', zone: 'b', name: 'cave salamander', emoji: '🦎', needs: { light: [0, 0], water: [2, 2] } }],
      rules: [{ kind: 'needs', beings: ['x'] }], controls: [{ type: 'move', beings: ['x'], zones: ['a', 'b'] }], goal: { kind: 'all_thrive' } };
    expect(ok(w, 'This salamander is in the wrong place. Move it where it can live.').blocking).toEqual([]);
  });
});
