import { describe, expect, it } from 'vitest';
import {
  K_ITEM_BUDGET,
  MIN_ITEMS_PER_OBJECTIVE,
  kindForObjective,
  planKnowledgeCheckSlots,
  type KcPlanObjective,
} from './knowledgeCheckPlan';
import { namedSetFromObjective } from '../objectives/namedSet';

// The two objectives of the K subtraction package `…e1b7` — the pilot family.
const SUBTRACTION: KcPlanObjective[] = [
  { id: 'obj1', text: 'Demonstrate taking away objects from a small group to see what remains', verb: 'apply' },
  { id: 'obj2', text: 'Identify the minus sign and the equals sign in a simple take-away sentence', verb: 'identify' },
];

const byObjective = (slots: ReturnType<typeof planKnowledgeCheckSlots>['slots']) =>
  slots.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.objectiveId]: (acc[s.objectiveId] ?? 0) + 1 }), {});

describe('planKnowledgeCheckSlots — set-sized, not count-sized', () => {
  it('gives every objective at least MIN_ITEMS_PER_OBJECTIVE slots even when count is smaller', () => {
    const plan = planKnowledgeCheckSlots(SUBTRACTION, { preReader: true, count: 1 });
    const counts = byObjective(plan.slots);
    expect(counts.obj1).toBeGreaterThanOrEqual(MIN_ITEMS_PER_OBJECTIVE);
    expect(counts.obj2).toBeGreaterThanOrEqual(MIN_ITEMS_PER_OBJECTIVE);
    expect(plan.requestedCount).toBe(1);
  });

  it('touches EVERY named element once: minus AND equals, as point_to over a number sentence at K', () => {
    const plan = planKnowledgeCheckSlots(SUBTRACTION, { preReader: true, count: 4 });
    const obj2 = plan.slots.filter((s) => s.objectiveId === 'obj2');
    expect(obj2.map((s) => (s.kind === 'production' ? s.element : null))).toEqual(['−', '=']);
    expect(obj2.every((s) => s.kind === 'production' && s.productionKind === 'point_to' && s.stimulus === 'number-sentence')).toBe(true);
    expect(plan.namedSets.obj2.elements).toEqual(['−', '=']);
  });

  it('the same symbol objective at Grade 1 becomes say_it over a glyph card (form → name)', () => {
    const plan = planKnowledgeCheckSlots(SUBTRACTION, { preReader: false, count: 4 });
    const obj2 = plan.slots.filter((s) => s.objectiveId === 'obj2');
    expect(obj2.every((s) => s.kind === 'production' && s.productionKind === 'say_it' && s.stimulus === 'glyph-card')).toBe(true);
  });

  it('"demonstrate taking away objects" assesses the RESULT: how_many over a take-away arrangement', () => {
    const plan = planKnowledgeCheckSlots(SUBTRACTION, { preReader: true, count: 4 });
    const obj1 = plan.slots.filter((s) => s.objectiveId === 'obj1');
    expect(obj1).toHaveLength(2);
    expect(obj1.every((s) => s.kind === 'production' && s.productionKind === 'how_many' && s.takeAway === true)).toBe(true);
  });

  it('a one-element set still gets two opportunities (two angles on the same element)', () => {
    const plan = planKnowledgeCheckSlots(
      [{ id: 'o', text: 'Identify the letter m in print' }],
      { preReader: true, count: 1 },
    );
    expect(plan.slots).toHaveLength(2);
    expect(plan.slots.map((s) => (s.kind === 'production' ? [s.element, s.angle] : null))).toEqual([['m', 0], ['m', 1]]);
  });

  it('an objective with no K stimulus in the pilot becomes two LEGACY slots and is reported', () => {
    const plan = planKnowledgeCheckSlots(
      [{ id: 'x', text: 'Explain why sharing is kind', verb: 'explain' }],
      { preReader: true, count: 3 },
    );
    expect(plan.slots.every((s) => s.kind === 'legacy')).toBe(true);
    expect(plan.slots).toHaveLength(2);
    expect(plan.legacyObjectiveIds).toEqual(['x']);
  });

  it('an EXPLAIN objective is never a count item — legacy, even when it mentions things and making (xr70 obj3)', () => {
    const plan = planKnowledgeCheckSlots(
      [{ id: 'obj3', text: 'Explain how putting things together makes a bigger number', verb: 'explain' }],
      { preReader: true, count: 4 },
    );
    expect(plan.slots.every((s) => s.kind === 'legacy')).toBe(true);
    expect(plan.legacyObjectiveIds).toEqual(['obj3']);
  });

  it('"combine two groups to find the total" is how_many over a two-group (put-together) picture', () => {
    const plan = planKnowledgeCheckSlots(
      [{ id: 'obj1', text: 'Combine two groups of physical objects to find the total amount' }],
      { preReader: true, count: 4 },
    );
    expect(plan.slots).toHaveLength(2);
    expect(plan.slots.every((s) => s.kind === 'production' && s.productionKind === 'how_many' && s.combine === true && !s.takeAway)).toBe(true);
  });

  it('an attribute-comparison objective stays legacy even though it says "show" + "objects" (kindergarten-compare…3rvk obj1)', () => {
    const plan = planKnowledgeCheckSlots(
      [{ id: 'obj1', text: 'Compare two real objects side-by-side to show which one is longer or shorter.' }],
      { preReader: true, count: 4 },
    );
    expect(plan.slots.every((s) => s.kind === 'legacy')).toBe(true);
    expect(plan.legacyObjectiveIds).toEqual(['obj1']);
  });

  it('letter SOUND objectives stay legacy (no sound judge contract in this pack yet)', () => {
    const set = namedSetFromObjective('Say the sound of letters s, a, t');
    expect(kindForObjective({ id: 'l', text: 'Say the sound of letters s, a, t' }, set, { preReader: true })).toBeNull();
  });

  it('trims GENERIC angles to the K budget and never a named element', () => {
    const objectives: KcPlanObjective[] = [
      { id: 'a', text: 'Recognize and name the written numbers 1 through 6' },  // 6 named
      { id: 'b', text: 'Count how many objects are in a group' },              // 2 generic
      { id: 'c', text: 'Count how many are left after taking some away' },     // 2 generic
    ];
    const plan = planKnowledgeCheckSlots(objectives, { preReader: true, count: 4 });
    expect(plan.budget).toBe(K_ITEM_BUDGET);
    expect(plan.slots.length).toBe(K_ITEM_BUDGET);
    expect(plan.slots.filter((s) => s.objectiveId === 'a')).toHaveLength(6);
    // Both generic objectives keep ≥ 1 slot.
    expect(byObjective(plan.slots).b).toBeGreaterThanOrEqual(1);
    expect(byObjective(plan.slots).c).toBeGreaterThanOrEqual(1);
    expect(plan.droppedGeneric).toBe(2);
  });

  it('when named elements alone exceed the budget, the cap yields to the set', () => {
    const plan = planKnowledgeCheckSlots(
      [{ id: 'n', text: 'Recognize and name the written numbers 1 through 10' }],
      { preReader: true, count: 4 },
    );
    expect(plan.slots).toHaveLength(10);
    expect(plan.droppedGeneric).toBe(0);
  });
});
