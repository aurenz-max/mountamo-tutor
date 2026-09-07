import test from 'node:test';
import assert from 'node:assert/strict';
import { topicNeighborhood, objectiveNeighborhood, validateArc, arcPrompt } from './lesson-planner-topic.mjs';
const input = { entryPoint: 'topic', topic: 'Machines', learner: { grade: 'K' }, lessonBudgetMinutes: 15, generalPurposeCandidateIds: ['intro'], candidates: [
  { componentId: 'sim', description: 'Machines move', constraints: '', modes: [], affordances: { role: 'apply' } },
  { componentId: 'profile', description: 'Machine parts', constraints: '', modes: [], affordances: { role: 'introduce' } },
  { componentId: 'intro', description: 'Introduce any topic', constraints: '', modes: [], affordances: { role: 'introduce' } },
] };
test('curriculum retrieval uses exact objective without replacing it with the parent topic', () => {
  const curriculum = { ...input, topic: 'Unrelated parent', objective: { id: 'o1', text: 'Machines move' } };
  const before = structuredClone(curriculum);
  const n = objectiveNeighborhood(curriculum);
  assert.ok(n.topical.some(c => c.componentId === 'sim'));
  assert.deepEqual(curriculum, before);
  assert.throws(() => objectiveNeighborhood(input), /authoritative objective/);
});
test('open topic preserves explanatory matches and general tools without preselected objectives', () => {
  const n = topicNeighborhood(input, 1);
  assert.deepEqual(new Set(n.candidates.map(c => c.componentId)), new Set(['sim', 'profile', 'intro']));
  assert.ok(arcPrompt(input, n).includes('OPEN TOPIC'));
  assert.throws(() => topicNeighborhood({ ...input, objective: { id: 'fixed' } }), /no supplied objective/);
});
test('arc validates identity, candidate references and prerequisite order', () => {
  const arc = { topic: 'Machines', centralQuestion: 'How do they move?', scopeReason: 'First look', estimatedMinutes: 15,
    objectives: [{ id: 'parts', question: 'What parts?', text: 'Identify parts', evidenceCriteria: ['Name a part'], candidateIds: ['profile'], dependsOn: [] }] };
  const n = topicNeighborhood(input);
  validateArc(arc, input, n);
  assert.throws(() => validateArc({ ...arc, topic: 'Different' }, input, n), /Invalid/);
  const invalid = structuredClone(arc); invalid.objectives[0].dependsOn = ['future'];
  assert.throws(() => validateArc(invalid, input, n), /earlier/);
  invalid.objectives[0].dependsOn = []; invalid.objectives[0].candidateIds = ['invented'];
  assert.throws(() => validateArc(invalid, input, n), /outside/);
});
