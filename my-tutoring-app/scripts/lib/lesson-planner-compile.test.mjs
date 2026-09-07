import test from 'node:test';
import assert from 'node:assert/strict';
import { compilePlan } from './lesson-planner-compile.mjs';
const catalog = [{ id: 'curator-brief' }, { id: 'ordinal-line', evalModes: [{ evalMode: 'identify' }] }, { id: 'knowledge-check', evalModes: [{ evalMode: 'recall' }] }];
const fixture = { objective: { id: 'source-id', text: 'Name sixth through tenth' } };
const make = (id, componentId, mode, contributions = []) => ({ id, componentId, mode, contributions, intent: 'exact intent', learnerAction: 'say it', support: 'read aloud' });
const plan = { objectiveId: 'source-id', title: 'Lesson', experiences: [make('brief', 'curator-brief', ''), make('one', 'ordinal-line', 'identify'), make('two', 'ordinal-line', 'identify'), make('close', 'knowledge-check', 'recall', ['closing_independent_assessment'])] };
test('adapter preserves repeat instances, authoritative objective, mode and final assessment', () => {
  const manifest = compilePlan(plan, fixture, catalog);
  assert.equal(manifest.objectiveBlocks[0].objectiveText, fixture.objective.text);
  assert.deepEqual(manifest.objectiveBlocks[0].components.map(c => c.instanceId), ['one', 'two']);
  assert.equal(manifest.objectiveBlocks[0].components[0].config.targetEvalMode, 'identify');
  assert.equal(manifest.finalAssessment.instanceId, 'close');
  assert.match(manifest.objectiveBlocks[0].components[0].intent, /read aloud/);
});
test('adapter fails unsupported bindings rather than silently substituting', () => {
  assert.throws(() => compilePlan({ ...plan, objectiveId: 'changed' }, fixture, catalog), /objective/);
  assert.throws(() => compilePlan({ ...plan, experiences: [make('x', 'ordinal-line', 'invented')] }, fixture, catalog), /mode/);
  assert.throws(() => compilePlan({ ...plan, experiences: [plan.experiences[1], plan.experiences[1]] }, fixture, catalog), /duplicate/);
});
