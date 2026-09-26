import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { parseLessonPackage, type LessonPackage } from '../../service/qa/lessonBench/lessonPackage';
import { nextPlanItem, planForTutor, projectLessonPlan } from './livePlan';

const fixture = () => ({ title: 'Subtraction within 10', range: { min: 0, max: 10 }, challenges: [{ id: 'c1',
  type: 'show_jump', instruction: 'Start at 7 and subtract 3.', hint: 'Move left.', startValue: 7, targetValues: [4],
  operations: [{ type: 'subtract', startValue: 7, changeValue: 3, showJumpArc: true }] }] });

// A real topic-trace package (curator brief → manifest → resolved modes → generators), tracked in git.
const realPackage = () => parseLessonPackage(JSON.parse(readFileSync(
  join(process.cwd(), 'qa/lesson-bench/packages/kindergarten-addition-20260905190456-xr70.json'), 'utf8')));

const synthetic = (components: Array<{ componentId: string; instanceId: string; targetEvalMode?: string; data: unknown }>): LessonPackage => ({
  benchVersion: 1, id: 'pkg-1', provenance: { generatedAt: '2026-09-16T00:00:00Z', source: 'topic-trace' },
  curatorBrief: {} as LessonPackage['curatorBrief'],
  manifest: { topic: 'Subtraction', gradeLevel: '1st Grade', themeColor: '#fff', layout: [],
    objectiveBlocks: [{ objectiveId: 'obj1', objectiveText: 'Subtract by hopping left', objectiveVerb: 'apply',
      components: components.map(c => ({ componentId: c.componentId as never, instanceId: c.instanceId, title: c.instanceId,
        intent: `Intent for ${c.instanceId}`, config: c.targetEvalMode ? { targetEvalMode: c.targetEvalMode } : {} })) }] },
  components: components.map(c => ({ instanceId: c.instanceId, componentId: c.componentId, data: c.data })),
});

describe('live lesson plan projection', () => {
  it('keeps a real package in manifest order with objective, resolved mode, content and provenance', () => {
    const pkg = realPackage();
    const plan = projectLessonPlan(pkg);
    expect(plan.gradeLevel).toBe('Kindergarten');
    expect(plan.items.map(i => [i.itemId, i.primitiveId, i.evalMode, i.objective.id]))
      // The DI pack spells its challenge type `challengeType`; the adapter's accessor is what
      // lets the mode gate read it. Under a hardcoded `c.type` it was skipped as "undefined".
      .toEqual([['item-1', 'addition-subtraction-scene', 'act_out', 'obj1'], ['item-2', 'ten-frame', 'build', 'obj1'],
        ['item-3', 'di-dice-roll', 'sum_two_dice', 'obj1'], ['item-4', 'di-spoken-practice', 'read_aloud', 'obj2'],
        ['item-5', 'number-line', 'jump', 'obj3'], ['item-6', 'di-math-facts', 'answer_fact', 'obj3']]);
    const source = pkg.manifest.objectiveBlocks[2];
    const line = plan.items.find(i => i.primitiveId === 'number-line')!;
    const manifestComponent = source.components.find(c => c.instanceId === line.provenance.manifestInstanceId)!;
    expect(line.objective.text).toBe(source.objectiveText);
    expect(line.intent).toBe(manifestComponent.intent);
    expect(line.data).toEqual(pkg.components.find(c => c.instanceId === manifestComponent.instanceId)!.data);
    expect(line.provenance).toMatchObject({ packageId: pkg.id, source: 'topic-trace', modeSource: 'manifest-resolved' });
    expect(plan.unavailable.map(u => u.reason)).toContain('no live adapter');
    expect(projectLessonPlan(pkg, { objectiveIds: ['obj3'] }).items.map(i => i.primitiveId))
      .toEqual(['number-line', 'di-math-facts']);
  });

  it('marks components unavailable when the mode pin or the content cannot run', () => {
    const plan = projectLessonPlan(synthetic([
      { componentId: 'number-line', instanceId: 'ok', targetEvalMode: 'jump', data: fixture() },
      { componentId: 'number-line', instanceId: 'no-pin', data: fixture() },
      { componentId: 'number-line', instanceId: 'bad-pin', targetEvalMode: 'jump|leap', data: fixture() },
      { componentId: 'number-line', instanceId: 'bad-data', targetEvalMode: 'jump', data: { title: 'x' } },
      { componentId: 'number-line', instanceId: 'missing', targetEvalMode: 'jump', data: null },
      { componentId: 'number-line', instanceId: 'mixed', targetEvalMode: 'mixed', data: fixture() },
    ]));
    expect(plan.gradeLevel).toBe('Grade 1');
    expect(plan.items.map(i => i.provenance.manifestInstanceId)).toEqual(['ok', 'mixed']);
    expect(Object.fromEntries(plan.unavailable.map(u => [u.manifestInstanceId, u.reason]))).toEqual({
      'no-pin': 'no resolved eval mode',
      'bad-pin': 'eval mode "jump|leap" is not in the number-line catalog',
      'bad-data': 'Generated number line has no valid challenges or range',
      missing: 'no prepared content in the package',
    });
    expect(() => projectLessonPlan(synthetic([{ componentId: 'fraction-bar', instanceId: 'f', data: {} }]))).toThrow('can run live');
  });

  it('offers items strictly in plan order and tells the tutor identities, never answers', () => {
    const plan = projectLessonPlan(realPackage());
    expect(nextPlanItem(plan, {})?.itemId).toBe('item-1');
    const done = { 'item-1': { itemId: 'item-1', disposition: 'completed' as const, allCorrect: true, score: 100 } };
    expect(nextPlanItem(plan, done)?.itemId).toBe('item-2');
    const two = { ...done, 'item-2': { ...done['item-1'], itemId: 'item-2' } };
    expect(nextPlanItem(plan, two)?.itemId).toBe('item-3');
    const three = { ...two, 'item-3': { ...done['item-1'], itemId: 'item-3' } };
    expect(nextPlanItem(plan, three)?.itemId).toBe('item-4');
    const all = Object.fromEntries(plan.items.map(i => [i.itemId, { ...done['item-1'], itemId: i.itemId }]));
    expect(nextPlanItem(plan, all)).toBeNull();
    const told = JSON.stringify(planForTutor(plan));
    expect(told).not.toContain('targetValues');
    expect(told).not.toContain('challenges');
    const line = plan.items.find(i => i.primitiveId === 'number-line')!;
    expect(planForTutor(plan).find(i => i.primitiveId === 'number-line')).toEqual({ itemId: line.itemId,
      primitiveId: 'number-line', title: line.title, evalMode: 'jump', objective: line.objective.text });
  });
});
