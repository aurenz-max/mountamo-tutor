import { describe, expect, it } from 'vitest';
import { buildProductionProblem } from './productionGenerator';
import { planKnowledgeCheckSlots, type KcPlanObjective, type KcProductionSlot } from './knowledgeCheckPlan';
import { knowledgeCheckOracle } from '../qa/oracles/knowledge-check';
import { itemsFromProblems, knowledgeCheckPackBase } from '../../primitives/knowledgeCheckScript';
import { checkPackGates } from '../../hooks/judgedScriptContract.testkit';
import type { ProductionProblemData } from '../../types';

/** A seeded PRNG so every draw is reproducible. */
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const SUBTRACTION: KcPlanObjective[] = [
  { id: 'obj1', text: 'Demonstrate taking away objects from a small group to see what remains' },
  { id: 'obj2', text: 'Identify the minus sign and the equals sign in a simple take-away sentence' },
];

function buildAll(objectives: KcPlanObjective[], preReader = true, seed = 7): ProductionProblemData[] {
  const plan = planKnowledgeCheckSlots(objectives, { preReader, count: 4 });
  const rnd = seeded(seed);
  const used = new Set<string>();
  return plan.slots.flatMap((slot) => {
    if (slot.kind !== 'production') return [];
    const obj = objectives.find((o) => o.id === slot.objectiveId)!;
    const p = buildProductionProblem(slot, { gradeLevel: 'kindergarten', preReader, grade: preReader ? 'K' : '1', objectiveText: obj.text, rnd, used });
    return p ? [p] : [];
  });
}

describe('buildProductionProblem — the K subtraction pilot', () => {
  it('builds every slot of the subtraction package: 2 how_many + point_to for − and =', () => {
    const problems = buildAll(SUBTRACTION);
    expect(problems.map((p) => [p.kind, p.objectiveId])).toEqual([
      ['how_many', 'obj1'], ['how_many', 'obj1'], ['point_to', 'obj2'], ['point_to', 'obj2'],
    ]);
    const pointTos = problems.filter((p) => p.kind === 'point_to');
    expect(pointTos.map((p) => p.expectedAnswer)).toEqual(['minus', 'equals']);
    // The target resolves to the right token of a printed sentence within five.
    for (const p of pointTos) {
      expect(p.stimulus.insetType).toBe('number-sentence');
      if (p.stimulus.insetType !== 'number-sentence') continue;
      const target = p.stimulus.tokens.find((t) => t.id === p.targetTokenId)!;
      expect(target.text).toBe(p.expectedAnswer === 'minus' ? '−' : '=');
      expect(p.stimulus.tokens.filter((t) => t.kind === 'number').every((t) => Number(t.text) <= 5)).toBe(true);
      expect(p.correctOptionId).toBe(p.targetTokenId);
    }
  });

  it('how_many at K: a take-away picture within five, no digits on the stimulus, answer = remaining', () => {
    const problems = buildAll(SUBTRACTION).filter((p) => p.kind === 'how_many');
    for (const p of problems) {
      expect(p.stimulus.insetType).toBe('arrangement');
      if (p.stimulus.insetType !== 'arrangement') continue;
      expect(p.stimulus.count).toBeLessThanOrEqual(5);
      expect(p.stimulus.removed).toBeGreaterThan(0);
      const remaining = p.stimulus.count - (p.stimulus.removed ?? 0);
      expect(p.alternates).toContain(String(remaining));
      expect(p.options.find((o) => o.id === p.correctOptionId)?.text).toBe(String(remaining));
      expect(/\d/.test(p.ask)).toBe(false);
    }
    // Two draws, two different pictures.
    const keys = problems.map((p) => p.stimulus.insetType === 'arrangement' ? `${p.stimulus.count}-${p.stimulus.removed}` : '');
    expect(new Set(keys).size).toBe(2);
  });

  it('passes the knowledge-check oracle at kindergarten (R2 forked: production is K-capable)', () => {
    const problems = buildAll(SUBTRACTION);
    const result = knowledgeCheckOracle.verify({ problems }, { gradeLevel: 'kindergarten' } as never);
    expect(result.violations).toEqual([]);
    expect(result.checkedChallenges).toBe(4);
  });

  it('every built item survives the runtime script gate and the set is judged-viable', () => {
    const problems = buildAll(SUBTRACTION);
    const build = itemsFromProblems(problems);
    expect(build.judgedViable).toBe(true);
    expect(build.items.map((i) => i.kind)).toEqual(['how_many', 'how_many', 'point_to', 'point_to']);
    expect(build.items.map((i) => i.answerKind)).toEqual(['voice', 'voice', 'gesture', 'gesture']);
  });

  it('two consecutive how_many items pass the pack gates — the ask is a SHORT invariant signal, not a recited block', () => {
    const problems = buildAll([{ id: 'obj1', text: 'Combine two groups of physical objects to find the total amount' }]);
    const build = itemsFromProblems(problems);
    expect(build.items.map((i) => i.kind)).toEqual(['how_many', 'how_many']);
    expect(checkPackGates(knowledgeCheckPackBase(build.items))).toEqual([]);
  });

  it('the K addition package (xr70): two-group how_many for combine, point_to for + and =, explain stays legacy', () => {
    const ADDITION: KcPlanObjective[] = [
      { id: 'obj1', text: 'Combine two groups of physical objects to find the total amount' },
      { id: 'obj2', text: 'Identify the plus sign (+) and equal sign (=) as math symbols' },
      { id: 'obj3', text: 'Explain how putting things together makes a bigger number', verb: 'explain' },
    ];
    const problems = buildAll(ADDITION);
    expect(problems.map((p) => [p.kind, p.objectiveId])).toEqual([
      ['how_many', 'obj1'], ['how_many', 'obj1'], ['point_to', 'obj2'], ['point_to', 'obj2'],
    ]);
    for (const p of problems.filter((q) => q.kind === 'how_many')) {
      expect(p.stimulus.insetType).toBe('arrangement');
      if (p.stimulus.insetType !== 'arrangement') continue;
      expect(p.stimulus.layout).toBe('groups');
      expect(p.stimulus.groups).toHaveLength(2);
      expect(p.stimulus.groups!.reduce((a, b) => a + b, 0)).toBe(p.stimulus.count);
      expect(p.stimulus.count).toBeLessThanOrEqual(5);
      expect(p.ask).toBe('How many altogether?');
      expect(p.alternates).toContain(String(p.stimulus.count));
    }
    const pointTos = problems.filter((p) => p.kind === 'point_to');
    expect(pointTos.map((p) => p.expectedAnswer)).toEqual(['plus', 'equals']);
    // The plus sentence is an ADDITION fact; the equals sentence follows the objective's operator.
    for (const p of pointTos) {
      if (p.stimulus.insetType !== 'number-sentence') continue;
      expect(p.stimulus.tokens[1].text).toBe('+');
    }
    expect(knowledgeCheckOracle.verify({ problems }, { gradeLevel: 'kindergarten' } as never).violations).toEqual([]);
    expect(itemsFromProblems(problems).judgedViable).toBe(true);
  });

  it('say_it cards at Grade 1 for the same symbols: the child names the shown sign', () => {
    const problems = buildAll(SUBTRACTION, false).filter((p) => p.kind === 'say_it');
    expect(problems.map((p) => p.expectedAnswer)).toEqual(['minus', 'equals']);
    for (const p of problems) {
      expect(p.stimulus).toMatchObject({ insetType: 'glyph-card', glyphKind: 'operator' });
      expect(p.ask.toLowerCase()).not.toContain(p.expectedAnswer);
    }
  });

  it('numeral, letter and shape sets build say_it cards with the right response classes', () => {
    const problems = buildAll([
      { id: 'n', text: 'Recognize and name the written numbers 3 through 4' },
      { id: 'l', text: 'Identify the letter m in print' },
      { id: 's', text: 'Name a triangle and a circle' },
    ]);
    const items = itemsFromProblems(problems).items;
    const classes = Object.fromEntries(items.map((i) => [`${i.problemIndex}`, i.responseClass]));
    expect(problems.map((p) => p.expectedAnswer)).toEqual(['three', 'four', 'm', 'm', 'triangle', 'circle']);
    expect(classes['0']).toBe('number_word_to_20');
    expect(classes['2']).toBe('letter_name');
    expect(classes['4']).toBe('shape_name');
    // The two letter angles differ in case, so the second is a fresh stimulus.
    const letterGlyphs = problems.filter((p) => p.objectiveId === 'l').map((p) => (p.stimulus.insetType === 'glyph-card' ? p.stimulus.glyph : ''));
    expect(letterGlyphs).toEqual(['m', 'M']);
  });

  it('a rectangle card draws the code-owned di-shapes exemplar (never a squarish regular polygon)', () => {
    const slot: KcProductionSlot = {
      kind: 'production', objectiveId: 'x', productionKind: 'say_it', stimulus: 'glyph-card',
      element: 'rectangle', elementKind: 'shape', angle: 0,
    };
    const p = buildProductionProblem(slot, { gradeLevel: 'kindergarten', preReader: true, objectiveText: 'Name a rectangle', rnd: seeded(1) });
    expect(p).not.toBeNull();
    expect(p!.stimulus).toMatchObject({ insetType: 'glyph-card', glyphKind: 'shape', sides: 4, shapeName: 'rectangle' });
    expect(p!.options.map((o) => o.text)).toContain('rectangle');
    expect(p!.options.map((o) => o.text)).toContain('square'); // the discriminating neighbour
  });

  it('refuses a slot it cannot build honestly (an unknown shape) instead of guessing', () => {
    const slot: KcProductionSlot = {
      kind: 'production', objectiveId: 'x', productionKind: 'say_it', stimulus: 'glyph-card',
      element: 'octagon', elementKind: 'shape', angle: 0,
    };
    expect(buildProductionProblem(slot, { gradeLevel: 'kindergarten', preReader: true, objectiveText: 'Name an octagon', rnd: seeded(1) })).toBeNull();
  });
});
