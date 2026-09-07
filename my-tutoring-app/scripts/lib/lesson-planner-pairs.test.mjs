import test from 'node:test';
import assert from 'node:assert/strict';
import { taskCards, compileTaskManifest, pairRequest } from './lesson-planner-pairs.mjs';

const cards = taskCards([{ componentId: 'ordinal-line', modes: [{ key: 'identify', description: 'Identify position' }], constraints: 'K: max fifth' }, { componentId: 'knowledge-check', modes: [] }]);
test('compilation preserves order and support while enforcing exact retrieved bindings', () => {
  const plan = { objectiveBlocks: [{ components: [{ taskId: cards[0].taskId, instanceId: 'a', config: { difficulty: 'easy', targetEvalMode: 'invented' } }] }], finalAssessment: { taskId: cards[1].taskId, instanceId: 'b' } };
  const native = compileTaskManifest(plan, cards);
  assert.equal(native.objectiveBlocks[0].components[0].config.targetEvalMode, 'identify');
  assert.equal(native.objectiveBlocks[0].components[0].config.difficulty, 'easy');
  assert.equal(native.finalAssessment.componentId, 'knowledge-check');
  assert.equal(native.finalAssessment.config.targetEvalMode, undefined);
  assert.ok(plan.finalAssessment.taskId);
  plan.finalAssessment.taskId = 'invented';
  assert.throws(() => compileTaskManifest(plan, cards), /Unknown task/);
});
test('rejects duplicate instances and a specialist as final assessment', () => {
  assert.throws(() => compileTaskManifest({ objectiveBlocks: [{ components: [{ taskId: cards[0].taskId, instanceId: 'a' }, { taskId: cards[1].taskId, instanceId: 'a' }] }] }, cards), /Duplicate/);
  assert.throws(() => compileTaskManifest({ objectiveBlocks: [], finalAssessment: { taskId: cards[0].taskId, instanceId: 'a' } }, cards), /Invalid closing/);
});
test('prompt transformation fails closed when the production template changes', () => {
  assert.throws(() => pairRequest({ contents: 'changed template' }, cards), /contract changed/);
});

test('joint selection preserves model settings and lesson rules, constrains closing task IDs', () => {
  const component = () => ({ properties: { componentId: { type: 'STRING' }, intent: { type: 'STRING' } }, required: ['componentId', 'intent'] });
  const request = { model: 'same-model', contents: 'Audience K\nAVAILABLE COMPONENT TOOLS:\nold catalog\n## CRITICAL: OBJECTIVE-CENTRIC DESIGN\nInclude 2-4 components\n(Which SKILL each component teaches is resolved later)\nReturn JSON', config: { thinkingConfig: { thinkingLevel: 'LOW' }, responseSchema: { properties: { objectiveBlocks: { items: { properties: { components: { items: component() } } } }, finalAssessment: component() } } } };
  const bound = pairRequest(request, cards);
  assert.equal(bound.model, request.model);
  assert.deepEqual(bound.config.thinkingConfig, request.config.thinkingConfig);
  assert.match(bound.contents, /Include 2-4 components/);
  assert.doesNotMatch(bound.contents, /old catalog/);
  assert.deepEqual(bound.config.responseSchema.properties.finalAssessment.properties.taskId.enum, [cards[1].taskId]);
  assert.ok(request.config.responseSchema.properties.finalAssessment.properties.componentId);
});
