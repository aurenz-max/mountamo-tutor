import test from 'node:test';
import assert from 'node:assert/strict';
import { contractPrompt, validateContract, retrieveTasks, validateProposals, runStaged } from './lesson-planner-staged.mjs';
const input = {
  objective: { id: 'real-id', text: 'Compare lengths' }, learner: { grade: 'K' }, lessonBudgetMinutes: 10,
  requiredContributions: ['model', 'practice'], contributionDefinitions: { model: 'Show alignment', practice: 'Compare' }, targetEvidence: ['length'], evidenceDefinitions: { length: 'Compare lengths' },
  candidates: [{ componentId: 'length-tool', description: 'Compare length', modes: [{ key: 'compare', description: 'Compare object lengths', affordances: null }], affordances: {}, capabilityNotes: [{ observation: 'No dragging' }] },
    { componentId: 'irrelevant', description: 'Plan rocket orbits', modes: [], affordances: {} }],
};
const contract = () => ({ objectiveId: 'real-id', performances: ['Compare lengths'], jobs: ['model', 'practice'].map((id, i) => ({ contributionId: id, learnerExperience: 'Compare lengths', searchTerms: ['length', 'compare'], requiredCapabilities: ['length'], dependsOn: i ? ['model'] : [] })) });
test('interpretation prompt never exposes catalog or component names', () => {
  assert.ok(!contractPrompt(input).includes('length-tool'));
  assert.ok(!contractPrompt(input).includes('rocket'));
});
test('contract rejects objective drift, missing jobs, and dependency cycles', () => {
  validateContract(contract(), input);
  const c = contract(); c.jobs[0].dependsOn = ['practice'];
  assert.throws(() => validateContract(c, input), /cycle/);
  assert.throws(() => validateContract({ ...contract(), objectiveId: 'obj1' }, input), /Invalid/);
  assert.throws(() => validateContract({ ...contract(), jobs: [] }, input), /omitted/);
});
test('retrieval caps each job and preserves modes/notes; proposal cannot escape matches', () => {
  const r = retrieveTasks(input, contract(), 1);
  assert.equal(r.retainedTasks, 1);
  assert.equal(r.candidates[0].componentId, 'length-tool');
  assert.deepEqual(r.candidates[0].capabilityNotes, input.candidates[0].capabilityNotes);
  const p = { objectiveId: 'real-id', proposals: ['model', 'practice'].map(id => ({ contributionId: id, componentId: 'length-tool', mode: 'compare', fit: 'partial', reason: 'Aligned already' })) };
  validateProposals(p, input, r);
  p.proposals[0].mode = 'invented';
  assert.throws(() => validateProposals(p, input, r), /outside/);
});
test('stage failure stops dependent calls instead of silently composing', async () => {
  const calls = [];
  await assert.rejects(runStaged(input, async name => { calls.push(name); return { ...contract(), objectiveId: 'wrong' }; }, () => {}));
  assert.deepEqual(calls, ['interpret']);
});
