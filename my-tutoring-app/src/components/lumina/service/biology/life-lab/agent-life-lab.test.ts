import { beforeEach, describe, expect, it, vi } from 'vitest';

const model = vi.hoisted(() => ({ turns: [] as Array<Array<{ name: string; args: Record<string, unknown> }>>, seen: [] as unknown[] }));
vi.mock('../../geminiClient', () => ({ ai: { models: { generateContent: vi.fn(async (req: { contents: unknown[] }) => {
  model.seen.push(req.contents.at(-1));
  const calls = (model.turns.shift() ?? [{ name: 'finish', args: {} }]).map((c, i) => ({ id: `c${i}`, ...c }));
  return { candidates: [{ content: { role: 'model', parts: calls.map(c => ({ functionCall: c })) } }], functionCalls: calls };
}) } } }));
const reader = vi.hoisted(() => ({ next: [] as Array<{ shortcut?: string; issues?: string; offObjective?: string; disagrees?: string }>, views: [] as Array<{ ask: string; html: string; drawn?: boolean; solve?: unknown }>, objectives: [] as unknown[] }));
vi.mock('../../agent-kit/look', async importOriginal => ({
  ...(await importOriginal<typeof import('../../agent-kit/look')>()),
  Looker: class { async close() {} },
  readView: vi.fn(async (view: { ask: string; html: string }, opts: { objective?: string }) => {
    reader.views.push(view);
    reader.objectives.push(opts.objective);
    const r = reader.next.shift() ?? {};
    return { png: Buffer.from('shot'), answer: 'tap', shortcut: r.shortcut ?? null, issues: r.issues ?? null, offObjective: r.offObjective ?? null, disagrees: r.disagrees ?? null, costUsd: 0.01 };
  }),
}));

import { generateLifeLab, __test } from './agent-life-lab';
import { buildLevers } from '../../agent-kit/levers';
import { lifeScene } from '../../../primitives/visual-primitives/biology/life-lab/lifeLabWorkspace';
import { initState } from '../../../primitives/visual-primitives/biology/life-lab/lifeLabWorld';
import type { GenerationContext } from '../../generation/generationContext';

const ctx = { componentId: 'life-lab', instanceId: 'x', topic: 'Animals and their homes', gradeLevel: 'kindergarten', gradeContext: '', grade: '1',
  objective: {}, scope: {} as GenerationContext['scope'], raw: { seed: 7 } } as unknown as GenerationContext;

const homes = (ask: string) => ({
  zones: [{ id: 'cold', label: 'Snowy shore', kind: 'ice', cond: { temp: 0, water: 2 } }, { id: 'hot', label: 'Sand dunes', kind: 'desert', cond: { temp: 2, water: 0 } }],
  beings: [{ id: 'p', subject: 'penguin', zone: 'hot' }, { id: 'l', subject: 'lizard', zone: 'cold' }],
  rule: { kind: 'needs', beings: ['p', 'l'] }, control: { type: 'move', beings: ['p', 'l'], zones: ['cold', 'hot'] },
  goal: { kind: 'all_thrive' }, ask, why: 'Is each place cold or hot?',
  teach: [{ says: 'A body is built for one kind of place.', show: [{ kind: 'zoom', levels: [{ label: 'Pond', icon: '🌊' }, { label: 'Frog', icon: '🐸' }] }] }] });
const cellOf = (beans: number) => ({ kind: 'cell', cell: 'animal', parts: [{ shape: 'round' }, { shape: 'bean', count: beans }] });
const cells = {
  surface: 'choose', prompt: 'Which cell comes from a muscle that works all day?',
  options: [{ id: 'many', label: 'Cell A', display: cellOf(9) }, { id: 'few', label: 'Cell B', display: cellOf(3) }, { id: 'one', label: 'Cell C', display: cellOf(1) }],
  answer: 'many', misconceptions: [{ id: 'few', idea: 'Think about how much work this muscle does.' }, { id: 'one', idea: 'Could one of these parts keep up?' }],
  teach: [{ says: 'Inside a working muscle cell are tiny parts that make energy.', show: [{ kind: 'cell', parts: [{ shape: 'bean', count: 4, label: 'energy parts' }], highlight: 'energy parts' }] }],
  levers: [
    { kind: 'help', when: 'stuck', says: 'Look at what is inside each cell.', change: { stimulus: [{ kind: 'zoom', levels: [{ label: 'Muscle', icon: '💪' }, { label: 'Cell' }] }] } },
    { kind: 'simplify', when: 'two misses', says: 'Just two cells.', change: { options: [{ id: 'many', label: 'Cell A', display: cellOf(9) }, { id: 'one', label: 'Cell C', display: cellOf(1) }] } },
  ],
};
const feet = {
  zones: [{ id: 'hill', label: 'Snowy hill', kind: 'snow', cond: { ground: 'snow' } }],
  beings: [{ id: 'a', subject: 'animal_feet', zone: 'hill', traits: { feet: 'claws' } }],
  rule: { kind: 'part_enables', being: 'a', part: 'feet' }, control: { type: 'trait', being: 'a', part: 'feet', options: ['claws', 'snowshoe', 'webbed'] },
  goal: { kind: 'action' }, ask: 'This animal lives on deep snow. Pick feet that help it walk here.', why: 'Think about what keeps you from sinking.' };
const cycle = {
  zones: [], beings: [], rule: { kind: 'stages', subject: 'frog' }, control: { type: 'order', slots: 4, items: ['frog', 'egg', 'froglet', 'tadpole', 'caterpillar'] },
  goal: { kind: 'order' }, ask: 'Put the pictures of a frog\'s life in order.', why: 'What hatches from the egg?' };

/** The section every lesson opens with. */
const opener = { name: 'write_section', args: { frames: [{ says: 'A body is built for one kind of place.', show: [{ kind: 'zoom', levels: [{ label: 'Pond', icon: '🌊' }, { label: 'Frog', icon: '🐸' }] }] }] } };

beforeEach(() => { model.turns = []; model.seen = []; reader.next = []; reader.views = []; reader.objectives = []; });

describe('the look stage', () => {
  const plan = { name: 'plan_session', args: { title: 'Homes', idea: 'Animals live where their bodies fit', objectiveText: 'Match animals to homes that meet their needs.', objectiveVerb: 'apply' } };
  const lever = (kind: string, says: string, change: Record<string, unknown>) => ({ kind, when: 'stuck', says, change });
  const homesWorld = (ask: string) => ({ ...homes(ask), levers: [
    lever('help', 'Look at each place.', { zones: [{ id: 'cold', label: 'Snowy shore', kind: 'ice', emoji: '❄️', cond: { temp: 0, water: 2 } }, { id: 'hot', label: 'Sand dunes', kind: 'desert', emoji: '☀️', cond: { temp: 2, water: 0 } }] }),
    lever('simplify', 'Just one animal.', { beings: [{ id: 'p', subject: 'penguin', zone: 'hot' }], rule: { kind: 'needs', beings: ['p'] }, control: { type: 'move', beings: ['p'], zones: ['cold', 'hot'] } }),
  ] });
  const feetWorld = { ...feet, levers: [
    lever('help', 'Look how deep the snow is.', { zones: [{ id: 'hill', label: 'Snowy hill', kind: 'snow', emoji: '❄️', cond: { ground: 'snow' } }] }),
    lever('simplify', 'Just two kinds of feet.', { control: { type: 'trait', being: 'a', part: 'feet', options: ['claws', 'snowshoe'] } }),
  ] };
  const cycleWorld = { ...cycle, levers: [
    lever('help', 'See how a plant goes round.', { show: [{ kind: 'flow', loop: true, steps: [{ label: 'seed' }, { label: 'sprout' }, { label: 'flower' }] }] }),
    lever('simplify', 'Only the frog pictures.', { control: { type: 'order', slots: 4, items: ['frog', 'egg', 'froglet', 'tadpole'] } }),
  ] };
  const three = [{ name: 'write_world', args: homesWorld('These animals are in the wrong places. Move each one to where it can live.') }, { name: 'write_world', args: feetWorld }, { name: 'write_world', args: cycleWorld }];
  type Debug = { run: { loop: string; costUsd: number; look: { ran: boolean; looked: number; screenshots: number; problems: number }; displays: { offered: string[]; used: Record<string, number> } }; advisories: string[]; events: Array<{ stage: string }> };

  it('sends a flagged world back with its screenshot, reads only what changed, and records the run', async () => {
    reader.next = [{ shortcut: 'the paws are the only furry option' }, {}, {}, {}];
    model.turns = [[plan, opener, ...three, { name: 'finish', args: {} }],
      [{ name: 'write_world', args: { ...homesWorld('Some animals are not at home. Help each one find a place it can live.'), replaceIndex: 1 } }, { name: 'finish', args: {} }]];
    const data = await generateLifeLab(ctx);
    expect(reader.views).toHaveLength(4);
    const reply = JSON.stringify(model.seen[1]);
    expect(reply).toMatch(/could succeed without the idea: the paws/);
    expect(reply).toMatch(/inlineData/);
    const d = data.agentDebug as unknown as Debug;
    expect(d.run.loop).toBe('author');
    expect(d.run.look).toMatchObject({ ran: true, looked: 4, unread: 0, screenshots: 4, problems: 0 });
    expect(d.run.costUsd).toBeCloseTo(0.04);
    expect(d.run.displays.offered).toContain('flow');
    expect(d.advisories).toEqual([]);
    expect(d.events.map(e => e.stage)).toEqual(expect.arrayContaining(['write', 'look', 'revise', 'run']));
  });

  it('a problem the author leaves in place ships as an advisory after the look rounds run out', async () => {
    reader.next = [{ issues: 'the penguin picture is unclear' }, {}, {}];
    model.turns = [[plan, opener, ...three, { name: 'finish', args: {} }], [{ name: 'finish', args: {} }]];
    const data = await generateLifeLab(ctx);
    const d = data.agentDebug as unknown as Debug;
    expect(reader.views).toHaveLength(3);
    expect(d.advisories.join()).toMatch(/look: world 1: .*penguin picture/);
    expect(d.run.look.problems).toBe(1);
  });

  it('a decline is refused while the author holds worlds that pass, and the lesson ships', async () => {
    model.turns = [[plan, opener, ...three], [{ name: 'decline', args: { reason: 'above Kindergarten' } }], [{ name: 'finish', args: {} }]];
    const data = await generateLifeLab(ctx);
    expect(data.challenges).toHaveLength(3);
    expect(JSON.stringify(model.seen[2])).toMatch(/refused: you hold worlds that pass/);
  });

  it('takes the objective, not a mode: any kind of world is kept, and an off-objective world goes back', async () => {
    reader.next = [{ offObjective: 'moving animals does not practise life cycles' }, {}, {}, {}];
    const objective = { ...ctx, objective: { text: 'Order the stages of a life cycle' }, targetEvalMode: 'whose_baby' } as GenerationContext;
    model.turns = [[plan, opener, ...three, { name: 'finish', args: {} }],
      [{ name: 'write_world', args: { ...homesWorld('Some animals are not at home. Help each one find a place it can live.'), replaceIndex: 1 } }, { name: 'finish', args: {} }]];
    const data = await generateLifeLab(objective);
    expect(data.challenges.map(c => c.type)).toEqual(['where_it_lives', 'part_for_the_job', 'life_cycle']);
    expect(reader.objectives[0]).toBe('Order the stages of a life cycle');
    expect(JSON.stringify(model.seen[1])).toMatch(/does not practise the lesson's objective: moving animals/);
  });

  it('a rewrite after the last look round is still read, and what it finds ships as an advisory', async () => {
    reader.next = [{ issues: 'first' }, {}, {}, { issues: 'second' }, { issues: 'still unclear' }];
    const rewrite = (ask: string) => [{ name: 'write_world', args: { ...homesWorld(ask), replaceIndex: 1 } }, { name: 'finish', args: {} }];
    model.turns = [[plan, opener, ...three, { name: 'finish', args: {} }],
      rewrite('Some animals are not at home. Help each one find a place it can live.'),
      rewrite('These animals need new homes. Help each one find a place it can live.')];
    const d = (await generateLifeLab(ctx)).agentDebug as unknown as Debug;
    expect(reader.views).toHaveLength(5);
    expect(d.run.look).toMatchObject({ looked: 5, unread: 0 });
    expect(d.advisories.join()).toMatch(/still unclear/);
  });

  it('out of turns, a rewrite no one read is still read before it ships', async () => {
    reader.next = [{ issues: 'found on the last read' }];
    const rewrite = [{ name: 'write_world', args: { ...homesWorld('Some animals are not at home. Help each one find a place it can live.'), replaceIndex: 1 } }];
    model.turns = [[plan, opener, ...three], ...Array.from({ length: 13 }, () => rewrite)];
    const d = (await generateLifeLab(ctx)).agentDebug as unknown as Debug;
    expect(d.run.look).toMatchObject({ unread: 0 });
    expect(d.advisories.join()).toMatch(/found on the last read/);
  });

  it('a tier the budget could not reach still ships a lesson, and says so', async () => {
    model.turns = [[plan, opener, ...three, { name: 'finish', args: {} }]];
    const data = await generateLifeLab({ ...ctx, supportTier: 'hard' } as GenerationContext);
    expect(data.challenges.length).toBeGreaterThanOrEqual(2);
    expect((data.agentDebug as unknown as Debug).advisories.join()).toMatch(/requested tier hard not enforced/);
  });

  it('the reader sees the ask, the places and the options, and never the answer', () => {
    const state = { plan: { title: 't', idea: 'i' }, entries: [], ctx: {} };
    const out = __test.readWorld(state as never, feet);
    if ('error' in out) throw new Error(out.error);
    const view = __test.viewOf(out.item, 7);
    expect(view.html).toContain('Snowy hill');
    expect(view.html).toContain('Pick one:');
    expect(view.html).toContain('Pick feet that help it walk here.');
    expect(`${view.html} ${view.words}`).not.toMatch(/\bskill\b|part_for_the_job|correct/i);
  });
});

describe('the author loop', () => {
  it('a world whose ask names the answer is blocked, the fix lands, and finish ships three code-named worlds', async () => {
    model.turns = [
      [{ name: 'plan_session', args: { title: 'Homes and bodies', idea: 'Animals live where their bodies fit', objectiveText: 'Match animals to homes that meet their needs.', objectiveVerb: 'apply' } }, opener,
        { name: 'write_world', args: homes('Move the penguin to the snowy shore and the lizard to the sand dunes.') },
        { name: 'write_world', args: feet }, { name: 'write_world', args: cycle }, { name: 'finish', args: {} }],
      [{ name: 'write_world', args: { ...homes('These animals are in the wrong places. Move each one to where it can live.'), replaceIndex: 1 } }, { name: 'finish', args: {} }],
    ];
    const data = await generateLifeLab(ctx);
    expect(data.challenges.map(c => c.type)).toEqual(['where_it_lives', 'part_for_the_job', 'life_cycle']);
    expect(data.gradeBand).toBe('K-2');
    const firstReply = JSON.stringify(model.seen[1]);
    expect(firstReply).toMatch(/names the penguin and the snowy shore together/);
    const bench = (data.challenges[2].world!.controls[0] as { items: string[] }).items;
    expect(bench.slice(0, 4).join()).not.toBe('egg,tadpole,froglet,frog');
  });

  it('the write result carries the skill, standards, difficulty and key code derived', () => {
    const state = { plan: { title: 't', idea: 'i' }, entries: [], ctx: {} };
    const out = __test.writeWorld(state as never, feet) as { skill: string; key: string; difficulty: { band: string } };
    expect(out.skill).toMatch(/part_for_the_job \(1-LS1-1/);
    expect(out.key).toBe('big furry paws');
    expect(out.difficulty.band).toBe('easy');
  });

  it('a verbatim copy of an example is refused; the same subject with its own ask is not', () => {
    const state = { plan: { title: 't', idea: 'i' }, entries: [], ctx: {} };
    const copy = __test.writeWorld(state as never, {
      zones: [{ id: 'meadow', label: 'Seed meadow', kind: 'meadow', cond: { food: 'hard_seeds' } }],
      beings: [{ id: 'finch', subject: 'bird', zone: 'meadow', traits: { beak: 'long' } }],
      rule: { kind: 'part_enables', being: 'finch', part: 'beak' }, control: { type: 'trait', being: 'finch', part: 'beak', options: ['long', 'hook', 'thick', 'spear'] },
      goal: { kind: 'action' }, ask: 'Pick a beak for this bird.', why: 'Look at the food.' }) as { checks: { blocking: string[] } };
    expect(copy.checks.blocking.join()).toMatch(/example world/);
    const butterfly = __test.writeWorld(state as never, {
      zones: [], beings: [], rule: { kind: 'stages', subject: 'butterfly' }, control: { type: 'order', slots: 4, items: ['egg', 'caterpillar', 'chrysalis', 'butterfly'] },
      goal: { kind: 'order' }, ask: 'A monarch starts very small. Put its life in order.', why: 'What hatches first?' }) as { checks: { blocking: string[] } };
    expect(butterfly.checks.blocking).toEqual([]);
  });

  describe('displays beside a world', () => {
    const state = () => ({ plan: { title: 't', idea: 'i' }, entries: [], ctx: {} });
    const graph = { kind: 'bar_graph', labels: ['Snowy hill', 'Sand'], values: [4, 1], title: 'Tracks' };
    const blocking = (a: Record<string, unknown>) => (__test.writeWorld(state() as never, a) as { checks: { blocking: string[] } }).checks.blocking;

    it('a world can show a display from its menu, and it ships', () => {
      expect(blocking({ ...feet, show: [graph] })).toEqual([]);
      const s = state();
      const out = __test.readWorld(s as never, { ...feet, show: [graph] });
      if ('error' in out) throw new Error(out.error);
      const data = __test.assembleLifeLab({ ...s, entries: [out.item, out.item] } as never, 7, 1, {});
      expect(data.challenges[0].world!.show).toEqual([{ kind: 'bar_graph', title: 'Tracks', labels: ['Snowy hill', 'Sand'], values: [4, 1] }]);
    });

    it('refuses a display off the menu, a broken one and too many, in sentences', () => {
      expect(blocking({ ...feet, show: [{ kind: 'clock', hour: 3, minute: 0 }] }).join()).toMatch(/clock display is not offered here/);
      expect(blocking({ ...feet, show: [{ kind: 'bar_graph', labels: ['a'], values: [1] }] }).join()).toMatch(/2-6 labels/);
      expect(blocking({ ...feet, show: [graph, graph, graph] }).join()).toMatch(/at most 2/);
    });

    it('a display is read like the ask: it may not give the answer away', () => {
      const inOrder = { kind: 'flow', loop: true, steps: [{ label: 'egg' }, { label: 'tadpole' }, { label: 'froglet' }, { label: 'frog' }] };
      expect(blocking({ ...cycle, show: [inOrder] }).join()).toMatch(/a display lists the stages in order/);
      const rotated = { kind: 'flow', loop: true, steps: [{ label: 'froglet' }, { label: 'frog' }, { label: 'egg' }, { label: 'tadpole' }] };
      expect(blocking({ ...cycle, show: [rotated] }).join()).toMatch(/a display lists the stages in order/);
      const other = { kind: 'flow', loop: true, steps: [{ label: 'seed' }, { label: 'sprout' }, { label: 'flower' }] };
      expect(blocking({ ...cycle, show: [other] })).toEqual([]);
      expect(blocking({ ...feet, show: [{ kind: 'table', headers: ['Feet'], rows: [['big furry paws']] }] }).join()).toMatch(/names "big furry paws"/);
    });

    it('a help that adds a display passes as changing the screen', () => {
      const s = state();
      const args = { ...cycle, levers: [{ kind: 'help', when: 'stuck', says: 'See how a plant goes round.', change: { show: [{ kind: 'flow', loop: true, steps: [{ label: 'seed' }, { label: 'sprout' }, { label: 'flower' }] }] } }] };
      const base = __test.readWorld(s as never, args);
      if ('error' in base) throw new Error(base.error);
      const out = buildLevers(s as never, args, base.item, __test.readWorld as never, __test.LIFE_LEVERS as never);
      expect(out.report[0]).toMatch(/lever 0 \(help\) ok/);
    });

    it('the tutor reads a display in words', () => {
      const world = __test.worldOf({ ...cycle, show: [{ kind: 'flow', loop: true, steps: [{ label: 'seed' }, { label: 'sprout' }, { label: 'flower' }] }] } as never);
      const scene = lifeScene({ id: 'x', type: 'life_cycle', world, ask: '', why: '', standards: '', difficulty: { band: 'easy', score: 0, reasons: [] } } as never,
        { state: initState(world), tries: [], running: false, solved: false });
      expect(scene.facts.shown).toBe('a cycle: seed, then sprout, then flower, then back to the start');
      const plain = __test.worldOf(cycle as never);
      expect(lifeScene({ id: 'x', type: 'life_cycle', world: plain, ask: '', why: '', standards: '', difficulty: { band: 'easy', score: 0, reasons: [] } } as never,
        { state: initState(plain), tries: [], running: false, solved: false }).facts).not.toHaveProperty('shown');
    });

    it('the author is told only about its menu', () => {
      const prompt = __test.systemPrompt(ctx, undefined, 1);
      expect(prompt).toContain('{kind:"flow"');
      expect(prompt).not.toContain('{kind:"clock"');
      for (const kind of ['svg', 'cell', 'zoom', 'food_web']) expect(prompt).toContain(`{kind:"${kind}"`);
    });
  });

  describe('kit items and teaching', () => {
    const state = () => ({ plan: { title: 't', idea: 'i' }, entries: [], ctx: {} });
    const blocking = (a: Record<string, unknown>) => { const out = __test.readItem(state() as never, a); if ('error' in out) throw new Error(out.error); return out.item.blocking; };
    const plan = { name: 'plan_session', args: { title: 'Energy in cells', idea: 'Cells make energy', objectiveText: 'Explain why busy cells need more energy parts.', objectiveVerb: 'explain' } };
    const finish = { name: 'finish', args: {} };

    it('an item with drawn cards passes; the prompt carries no key and the cards are not stored in a fixed order', () => {
      expect(blocking(cells)).toEqual([]);
      const out = __test.readItem(state() as never, cells);
      if ('error' in out) throw new Error(out.error);
      expect(out.item.key).toBe('Cell A');
      expect(out.item.mode).toBe('choose');
      expect(out.item.item!.difficulty.band).toBeDefined();
    });

    it('blocks an item with only words, a named answer, a display off the menu and a teach frame with no drawing', () => {
      const words = { ...cells, options: cells.options.map(({ id, label }) => ({ id, label })) };
      expect(blocking(words).join()).toMatch(/only words/);
      expect(blocking({ ...cells, prompt: 'Is it Cell A?' }).join()).toMatch(/names "Cell A"/);
      expect(blocking({ ...cells, stimulus: [{ kind: 'clock', hour: 3, minute: 0 }] }).join()).toMatch(/clock display is not offered/);
      const section = __test.readLifeSection(state() as never, { frames: [{ says: 'Words only.' }] });
      if ('error' in section) throw new Error(section.error);
      expect(section.item.blocking.join()).toMatch(/show a drawing/);
      expect(blocking({ ...cells, misconceptions: [{ id: 'few', idea: 'Cell A has more of them.' }] }).join()).toMatch(/misconception hint names/);
      expect(blocking({ ...cells, misconceptions: [{ id: 'few', idea: 'Confuses the bean with the nucleus.' }] }).join()).toMatch(/written about the child/);
    });

    it('refuses token card drawings, and a right card that alone uses a word the lesson taught', () => {
      const token = { ...cells, options: [{ id: 'many', label: 'A', display: { kind: 'svg', svg: '<svg viewBox="0 0 9 9"><circle r="4"/></svg>' } }, ...cells.options.slice(1).map(o => ({ ...o, display: { kind: 'svg', svg: '<svg viewBox="0 0 9 9"><rect width="4"/></svg>' } }))] };
      expect(blocking(token).join()).toMatch(/only a shape or two/);
      const s = state();
      const read = (a: Record<string, unknown>) => { const o = __test.readItem(s as never, a); if ('error' in o) throw new Error(o.error); return o.item; };
      const named = read({ ...cells, options: [{ ...cells.options[0], label: 'Packed with energy' }, { ...cells.options[1], label: 'Cell B' }, { ...cells.options[2], label: 'Cell C' }] });
      const lesson = __test.readLifeSection(s as never, { frames: [{ says: 'Tiny parts make energy.', show: [{ kind: 'zoom', levels: [{ label: 'Muscle' }, { label: 'Cell' }] }] }] });
      if ('error' in lesson) throw new Error(lesson.error);
      expect(__test.sessionOf(s as never, 1, [lesson.item, named]).join()).toMatch(/only the right card's label uses a word the lesson taught \("energy"\)/);
      expect(__test.sessionOf(s as never, 1, [read(cells)]).join()).not.toMatch(/lesson taught/);
    });

    it('a world whose choices share one picture is blocked', () => {
      const same = { ...feet, control: { type: 'trait', being: 'a', part: 'feet', options: ['claws', 'snowshoe', 'webbed'].map(v => ({ value: v, label: v, emoji: '🔬', works: v === 'snowshoe' ? ['snow'] : [] })) } };
      const out = __test.readWorld(state() as never, same);
      if ('error' in out) throw new Error(out.error);
      expect(out.item.blocking.join()).toMatch(/picture on more than one choice/);
    });

    it('a kit item and a world ship in one lesson, and the first must teach', async () => {
      const noTeach = { ...cells, teach: undefined };
      model.turns = [[plan, { name: 'write_item', args: noTeach }, { name: 'write_world', args: { ...feet, levers: [
        { kind: 'help', when: 'stuck', says: 'Look how deep the snow is.', change: { zones: [{ id: 'hill', label: 'Snowy hill', kind: 'snow', emoji: '❄️', cond: { ground: 'snow' } }] } },
        { kind: 'simplify', when: 'two', says: 'Just two.', change: { control: { type: 'trait', being: 'a', part: 'feet', options: ['claws', 'snowshoe'] } } },
      ] } }, { name: 'write_item', args: { ...cells, teach: undefined, surface: 'order', prompt: 'Put these cells from the fewest parts to the most.', answer: undefined, order_key: ['one', 'few', 'many'], misconceptions: undefined, levers: [
        { kind: 'help', when: 'stuck', says: 'Count the beans.', change: { stimulus: [{ kind: 'zoom', levels: [{ label: 'Muscle', icon: '💪' }, { label: 'Cell' }] }] } },
      ] } }, finish],
      [{ name: 'write_section', args: { title: 'Energy', frames: cells.teach, insertAt: 0 } }, finish]];
      const data = await generateLifeLab(ctx);
      expect(JSON.stringify(model.seen[1])).toMatch(/the first item must teach/);
      expect(data.challenges.map(c => c.type)).toEqual(['choose', 'part_for_the_job', 'order']);
      expect(data.challenges[0].teach).toHaveLength(1);
      expect(data.challenges[0].item!.options.map(o => o.id).sort()).toEqual(['few', 'many', 'one']);
      expect(data.challenges[0].levers!.map(l => l.kind)).toEqual(['help', 'simplify']);
    });

    it('sends a key the blind reader disagrees with back to the author, with what it answered', async () => {
      const order = { ...cells, teach: undefined, surface: 'order', prompt: 'Put these cells from the fewest parts to the most.', answer: undefined, order_key: ['one', 'few', 'many'], misconceptions: undefined, levers: [
        { kind: 'help', when: 'stuck', says: 'Count the beans.', change: { stimulus: [{ kind: 'zoom', levels: [{ label: 'Muscle', icon: '💪' }, { label: 'Cell' }] }] } },
      ] };
      const homeLevers = { ...homes('These animals are in the wrong places. Move each one to where it can live.'), levers: [
        { kind: 'help', when: 'stuck', says: 'Look at each place.', change: { zones: [{ id: 'cold', label: 'Snowy shore', kind: 'ice', emoji: '❄️', cond: { temp: 0, water: 2 } }, { id: 'hot', label: 'Sand dunes', kind: 'desert', emoji: '☀️', cond: { temp: 2, water: 0 } }] } },
        { kind: 'simplify', when: 'two', says: 'One animal.', change: { beings: [{ id: 'p', subject: 'penguin', zone: 'hot' }], rule: { kind: 'needs', beings: ['p'] }, control: { type: 'move', beings: ['p'], zones: ['cold', 'hot'] } } },
      ] };
      reader.next = [{}, { disagrees: 'a careful reader answered 2, but your key is "many".' }, {}, {}];
      model.turns = [[plan, opener, { name: 'write_world', args: homeLevers }, { name: 'write_item', args: { ...cells, teach: undefined } }, { name: 'write_item', args: order }, finish],
        [{ name: 'write_item', args: { ...cells, teach: undefined, prompt: 'Which cell has the most energy parts for a muscle that never rests?', replaceIndex: 2 } }, finish]];
      const data = await generateLifeLab(ctx);
      expect(JSON.stringify(model.seen[1])).toMatch(/careful reader answered 2/);
      expect(reader.views[1].solve).toBeTruthy();
      expect(data.challenges).toHaveLength(3);
    });

    it('a drawing the author made comes back to it even when the reader finds nothing', async () => {
      const drawn = { ...cells, teach: undefined, stimulus: [{ kind: 'svg', name: 'a stem cut open', svg: '<svg viewBox="0 0 10 10"><rect width="5" height="5"/></svg>' }] };
      const order = { ...cells, teach: undefined, surface: 'order', prompt: 'Put these cells from the fewest parts to the most.', answer: undefined, order_key: ['one', 'few', 'many'], misconceptions: undefined, levers: [
        { kind: 'help', when: 'stuck', says: 'Count the beans.', change: { stimulus: [{ kind: 'zoom', levels: [{ label: 'Muscle', icon: '💪' }, { label: 'Cell' }] }] } },
      ] };
      const homeLevers = { ...homes('These animals are in the wrong places. Move each one to where it can live.'), levers: [
        { kind: 'help', when: 'stuck', says: 'Look at each place.', change: { zones: [{ id: 'cold', label: 'Snowy shore', kind: 'ice', emoji: '❄️', cond: { temp: 0, water: 2 } }, { id: 'hot', label: 'Sand dunes', kind: 'desert', emoji: '☀️', cond: { temp: 2, water: 0 } }] } },
        { kind: 'simplify', when: 'two', says: 'One animal.', change: { beings: [{ id: 'p', subject: 'penguin', zone: 'hot' }], rule: { kind: 'needs', beings: ['p'] }, control: { type: 'move', beings: ['p'], zones: ['cold', 'hot'] } } },
      ] };
      model.turns = [[plan, opener, { name: 'write_world', args: homeLevers }, { name: 'write_item', args: drawn }, { name: 'write_item', args: order }, finish], [finish]];
      const data = await generateLifeLab(ctx);
      const reply = JSON.stringify(model.seen[1]);
      expect(reply).toMatch(/here is your own drawing/);
      expect(reply).toMatch(/inlineData/);
      expect(data.challenges[1].item!.stimulus[0].kind).toBe('svg');
      expect(reader.views).toHaveLength(3);
    });

    it('the reader sees the teach frames above the task and the tutor reads the current frame', () => {
      const out = __test.readItem(state() as never, cells);
      if ('error' in out) throw new Error(out.error);
      const view = __test.viewOf(out.item, 7, cells.teach as never);
      expect(view.html).toContain('Shown first');
      expect(view.html).toContain('tiny parts that make energy');
      expect(view.design).toMatch(/only repeats a sentence/);
      expect(view.solve).toBeTruthy();
    });
  });

  describe('sections and the authored objective', () => {
    const finish = { name: 'finish', args: {} };
    const plan = { name: 'plan_session', args: { title: 'Energy in cells', idea: 'Cells make energy', objectiveText: 'Explain why busy cells need more energy parts.', objectiveVerb: 'explain' } };
    const zoom = { kind: 'zoom', levels: [{ label: 'Muscle', icon: '💪' }, { label: 'Cell' }] };
    const order = { ...cells, surface: 'order', prompt: 'Put these cells from the fewest parts to the most.', answer: undefined, order_key: ['one', 'few', 'many'], misconceptions: undefined, levers: [cells.levers[0]] };
    const world = { ...feet, levers: [
      { kind: 'help', when: 'stuck', says: 'Look how deep the snow is.', change: { zones: [{ id: 'hill', label: 'Snowy hill', kind: 'snow', emoji: '❄️', cond: { ground: 'snow' } }] } },
      { kind: 'simplify', when: 'two', says: 'Just two.', change: { control: { type: 'trait', being: 'a', part: 'feet', options: ['claws', 'snowshoe'] } } },
    ] };
    const first = { name: 'write_section', args: { title: 'Busy cells', frames: [{ says: 'Busy cells have many energy parts.', cards: [{ title: 'Energy part', text: 'Makes energy for the cell.' }] }] } };
    const second = { name: 'write_section', args: { frames: [{ says: 'A real muscle fiber is packed tight.', picture: { prompt: 'a muscle fiber under a microscope', caption: 'A muscle fiber' } }, { says: 'Look inside one.', show: [zoom] }] } };
    const items = [{ name: 'write_item', args: cells }, { name: 'write_item', args: order }, { name: 'write_world', args: world }];

    it('sections ship on the question after them, are not questions, and the reader is told what came earlier', async () => {
      model.turns = [[plan, first, items[0], second, items[1], items[2], finish], [finish]];
      const data = await generateLifeLab(ctx);
      expect(data.challenges.map(c => c.id)).toEqual(['life-1', 'life-2', 'life-3']);
      expect(data.challenges[0].teach!.map(s => s.says)).toEqual(['Busy cells have many energy parts.']);
      expect(data.challenges[0].teach![0].heading).toBe('Busy cells');
      expect(data.challenges[1].teach!.map(s => s.picture?.caption ?? null)).toEqual(['A muscle fiber', null]);
      expect(data.challenges[2].teach).toBeUndefined();
      expect(reader.views).toHaveLength(3);
      expect((reader.views[1] as { taught?: string }).taught).toContain('Busy cells');
      expect(reader.views[1].html).toContain('A painted picture the child can open');
      expect(reader.views[1].html).not.toContain('under a microscope');
    });

    it('a section rewritten before a question sends that question back to the reader', async () => {
      model.turns = [[plan, first, ...items, finish], [{ name: 'write_section', args: { ...first.args, replaceIndex: 0, frames: [{ says: 'Muscles work hard all day.', show: [zoom] }] } }, finish], [finish]];
      reader.next = [{ issues: 'the cell picture is unclear' }];
      await generateLifeLab(ctx);
      expect(reader.views.length).toBeGreaterThan(3);
      expect(reader.views.at(-3)!.html + reader.views.at(-1)!.html).toBeTruthy();
      expect(reader.views.some(v => v.html.includes('Muscles work hard all day.'))).toBe(true);
    });

    it('writes the objective in the manifest shape when the lesson has none, and the reader checks against it', async () => {
      model.turns = [[plan, first, ...items, finish], [finish]];
      const data = await generateLifeLab(ctx);
      expect(data.agentDebug).toMatchObject({ objective: { id: 'obj1', text: 'Explain why busy cells need more energy parts.', verb: 'explain' } });
      expect(reader.objectives[0]).toBe('Explain why busy cells need more energy parts.');
    });

    it('refuses a plan with no objective when none was given, and keeps a given objective', async () => {
      const bare = { name: 'plan_session', args: { title: 'T', idea: 'I' } };
      model.turns = [[bare], [plan, first, ...items, finish], [finish]];
      await generateLifeLab(ctx);
      expect(JSON.stringify(model.seen[1])).toMatch(/has no objective/);
      model.turns = [[bare, first, ...items, finish], [finish]];
      reader.objectives = [];
      const data = await generateLifeLab({ ...ctx, objective: { id: 'o7', text: 'From the curriculum.', verb: 'identify' } });
      expect(data.agentDebug).toMatchObject({ objective: { id: 'o7', text: 'From the curriculum.' } });
      expect(reader.objectives[0]).toBe('From the curriculum.');
    });

    it('blocks a lesson that ends on a section and a frame with a half-written picture', () => {
      const s = { plan: { title: 't', idea: 'i' }, entries: [], ctx: {} };
      const read = (a: Record<string, unknown>) => { const o = __test.readLifeSection(s as never, a); if ('error' in o) throw new Error(o.error); return o.item; };
      expect(read({ frames: [{ says: 'Look.', picture: { prompt: 'a moth', caption: '' } }] }).blocking.join()).toMatch(/prompt and a caption/);
      const item = __test.readItem(s as never, cells);
      if ('error' in item) throw new Error(item.error);
      expect(__test.sessionOf(s as never, 1, [read(first.args), item.item, read(first.args)]).join()).toMatch(/ends on a section/);
    });
  });

  it('a decline ends the authoring with the reason', async () => {
    model.turns = [[{ name: 'decline', args: { reason: 'cells are another primitive' } }]];
    await expect(generateLifeLab(ctx)).rejects.toThrow(/cells are another primitive/);
  });

  it('levers: a help keeps the answer, a simplify is easier, a help that changes the answer is refused', () => {
    const state = { plan: { title: 't', idea: 'i' }, entries: [], ctx: {} };
    const args = { ...feet, levers: [
      { kind: 'help', when: 'after a wrong pick', says: 'Look how deep the snow is.', change: { zones: [{ id: 'hill', label: 'Snowy hill', kind: 'snow', emoji: '❄️', cond: { ground: 'snow' } }] } },
      { kind: 'simplify', when: 'after two misses', says: 'Just two kinds of feet.', change: { control: { type: 'trait', being: 'a', part: 'feet', options: ['claws', 'snowshoe'] } } },
      { kind: 'help', when: 'w', says: 'Look.', change: { zones: [{ id: 'hill', label: 'Sandy hill', kind: 'sand', cond: { ground: 'sand' } }] } },
    ] };
    const base = __test.readWorld(state as never, args);
    if ('error' in base) throw new Error(base.error);
    const out = buildLevers(state as never, args, base.item, __test.readWorld as never, __test.LIFE_LEVERS as never);
    expect(out.report.slice(0, 2).map(r => r.replace(/ \(difficulty.*/, ''))).toEqual(['lever 0 (help) ok', 'lever 1 (simplify) ok']);
    expect(out.report[2]).toMatch(/lever 2 \(help\) refused: (it changes the answer|its item is blocked)/);
    expect(out.levers.map(l => l.kind)).toEqual(['help', 'simplify']);
  });
});
