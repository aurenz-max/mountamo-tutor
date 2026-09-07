import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInput, buildPresentation, buildPrompt, validatePlan } from './lesson-planner-pilot.mjs';

const input = {
  objective: { id: 'curriculum-real-id' }, requiredContributions: ['teach'], targetEvidence: ['compare'], lessonBudgetMinutes: 10,
  candidates: [
    { componentId: 'tool', modes: [{ key: 'compare' }], affordances: {} },
    { componentId: 'home', modes: [], affordances: { audience: 'caregiver' } },
  ],
};
const plan = () => ({
  objectiveId: input.objective.id, title: 'Comparison', rejectedCandidates: [], unmetRequirements: [],
  experiences: [{ id: 'a', componentId: 'tool', mode: 'compare', audience: 'student', contributions: ['teach'],
    distinctContribution: 'Model comparison', learnerAction: 'Compare', intent: 'Compare two objects', support: 'Guided',
    minutes: 5, evidenceTargets: ['compare'], evidenceLimits: ['Does not establish setup'] }],
});

test('mode cards preserve every selectable mode, shared constraint and note without adding capabilities', () => {
  const original = { ...input, candidates: [
    { componentId: 'tool', description: 'Broad headline', constraints: 'Keep scope', affordances: { answers: ['tap'] }, capabilityNotes: [{ observation: 'No drag' }],
      modes: [{ key: 'recognize', description: 'Match a cue', affordances: { answers: ['spoken'] } }, { key: 'apply', description: 'Apply in context', affordances: null }] },
    { componentId: 'intro', description: 'Introduce concept', modes: [], constraints: null, affordances: null, capabilityNotes: [] },
  ] };
  const cards = buildPresentation(original, 'mode-cards');
  assert.deepEqual(cards.selectableTaskCards.map(c => [c.componentId, c.mode]), [['tool', 'recognize'], ['tool', 'apply'], ['intro', '']]);
  for (const c of original.candidates) {
    const shared = cards.sharedPrimitiveContext.find(s => s.componentId === c.componentId);
    const { modes, ...expected } = c;
    assert.deepEqual(shared, expected);
    for (const m of modes) {
      const card = cards.selectableTaskCards.find(t => t.componentId === c.componentId && t.mode === m.key);
      assert.equal(card.learnerTask, m.description);
      assert.deepEqual(card.modeAffordanceOverrides, m.affordances);
    }
  }
  assert.equal(buildPrompt(original).split('INPUT:')[0], buildPrompt(original, 'mode-cards').split('INPUT:')[0]);
  assert.throws(() => buildPresentation(original, 'unknown'), /Unknown representation/);
});

test('accepts valid reference bindings, including explicitly declared partial evidence gaps', () => {
  const p = plan(); p.unmetRequirements = [{ requirementId: 'compare', reason: 'Only partial setup evidence' }];
  assert.equal(validatePlan(p, input).valid, true);
});
test('rejects invented modes and changed authoritative objective ID', () => {
  const p = plan(); p.objectiveId = 'obj1'; p.experiences[0].mode = 'imaginary';
  assert.equal(validatePlan(p, input).errors.length, 2);
});
test('caregiver work cannot satisfy missing student contributions or claim evidence', () => {
  const p = plan(); Object.assign(p.experiences[0], { componentId: 'home', mode: '', audience: 'caregiver' });
  const result = validatePlan(p, input);
  assert.equal(result.valid, false);
  assert.equal(result.studentMinutes, 0);
  assert.ok(result.errors.some(e => e.includes('neither addressed')));
  assert.ok(result.errors.some(e => e.includes('Caregiver claims')));
});
test('rejects missing requirements, duplicate instances and invalid durations', () => {
  const p = plan(); p.experiences[0].evidenceTargets = []; p.experiences[0].minutes = -1;
  p.experiences.push({ ...p.experiences[0] });
  const errors = validatePlan(p, input).errors;
  assert.ok(errors.some(e => e.includes('duplicate')));
  assert.ok(errors.some(e => e.includes('Invalid minutes')));
  assert.ok(errors.some(e => e.includes('neither addressed')));
});
test('live catalog projection fails when curated references become stale', () => {
  assert.throws(() => buildInput({ candidateIds: ['gone'] }, []), /Unknown catalog/);
  assert.throws(() => buildInput({ candidateIds: ['tool'], capabilityNotes: [{ componentId: 'tool', mode: 'gone' }] }, [{ id: 'tool', evalModes: [{ evalMode: 'compare' }] }]), /Stale capability/);
});

test('catalog groups include general tools automatically and deduplicate explicit candidates', () => {
  const catalog = [{ id: 'fast-fact' }, { id: 'knowledge-check' }, { id: 'specialist' }];
  const result = buildInput({ candidateGroups: ['core', 'assessment'], candidateIds: ['fast-fact', 'specialist'] }, catalog,
    { core: [catalog[0]], assessment: [catalog[1]] });
  assert.deepEqual(result.candidateDiscovery.includedIds, ['fast-fact', 'knowledge-check', 'specialist']);
  assert.throws(() => buildInput({ candidateGroups: ['missing'], candidateIds: [] }, catalog), /Unknown catalog group/);
});

test('partial instructional contributions report gaps once and require valid bindings', () => {
  const expanded = { ...input, contributionDefinitions: { teach: 'Model the method' } };
  const p = plan();
  p.contributionDecisions = [{ contributionId: 'teach', status: 'partial', experienceIds: ['a'], reason: 'Only observes a prepared example' }];
  assert.equal(validatePlan(p, expanded).valid, true);
  p.contributionDecisions[0].experienceIds = ['invented'];
  assert.ok(validatePlan(p, expanded).errors.some(e => e.includes('Invalid contribution binding')));
});
