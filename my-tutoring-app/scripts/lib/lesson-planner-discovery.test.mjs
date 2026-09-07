import test from 'node:test';
import assert from 'node:assert/strict';
import { cosine, semanticRanking, discoveryCards, candidateRecall } from './lesson-planner-discovery.mjs';
import { topicNeighborhood } from './lesson-planner-topic.mjs';

test('semantic discovery admits profiles without lexical matches or evaluation modes', () => {
  const input = { entryPoint: 'topic', topic: 'Sea otters', generalPurposeCandidateIds: ['generic'], candidates: [
    { componentId: 'animal', description: 'Biological species', modes: [], affordances: { role: 'introduce' } },
    { componentId: 'boat', description: 'Sea vehicles', modes: [], affordances: { role: 'introduce' } },
    { componentId: 'generic', description: 'Explain anything', modes: [], affordances: {} },
  ] };
  const cards = discoveryCards(input.candidates);
  assert.deepEqual(cards[0].evaluationModes, []);
  const semantic = { method: 'test', ranked: semanticRanking(cards, [[1, 0], [0, 1], [0.2, 0.8]], [1, 0]) };
  assert.equal(semantic.ranked[0].componentId, 'animal');
  assert.equal(candidateRecall(topicNeighborhood(input), ['animal']).recall, 0);
  const n = topicNeighborhood(input, 1, semantic);
  assert.equal(candidateRecall(n, ['animal']).recall, 1);
  assert.ok(n.candidates.some(c => c.componentId === 'generic'));
});

test('cosine ignores magnitude and rejects corrupt vectors', () => {
  assert.equal(cosine([2, 0], [8, 0]), 1);
  assert.throws(() => cosine([1], [1, 2]), /Invalid/);
  assert.throws(() => cosine([NaN], [1]), /Invalid/);
  assert.throws(() => cosine([0], [1]), /Zero/);
  assert.throws(() => semanticRanking([{}], [], [1]), /count/);
});
