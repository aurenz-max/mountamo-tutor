import test from 'node:test';
import assert from 'node:assert/strict';
import { fuseRanks, lexicalRank, selectFamilyTasks } from './lesson-planner-family-search.mjs';

test('task expansion covers families before repeated modes', () => {
  const cards = ['a','b','knowledge-check'].flatMap(id => [1,2,3].map(n => ({ componentId:id,taskId:`${id}::${n}` })));
  const selected = selectFamilyTasks(cards,[{componentId:'a'},{componentId:'b'}],cards.map(c=>({componentId:c.taskId})),[],3);
  assert.deepEqual(selected.map(c=>c.componentId),['a','b','knowledge-check']);
});
test('fusion counts a family only once per ranking and stays deterministic', () => {
  const result=fuseRanks([[{componentId:'a'},{componentId:'a'}],[{componentId:'b'},{componentId:'a'}]]);
  assert.equal(result[0].componentId,'a');
  assert.equal(result[0].score,1/61+1/62);
});
test('lexical search supplies an exact subject signal without zero-score candidates', () => {
  const result=lexicalRank([{componentId:'equation-builder',description:'Build equations.'},{componentId:'habitat',description:'Explore ecosystems.'}], 'Compose numbers using equations');
  assert.deepEqual(result.map(r=>r.componentId),['equation-builder']);
});
