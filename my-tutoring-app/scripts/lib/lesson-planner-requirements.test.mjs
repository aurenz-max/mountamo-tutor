import test from 'node:test';
import assert from 'node:assert/strict';
import { objectiveContract, compileRequirementManifest, inspectTargetScope } from './lesson-planner-requirements.mjs';
import { protectedFamilies, groupedCards } from './lesson-planner-family-evidence.mjs';

test('range extraction distinguishes target wholes from ordinal positions and unknown scopes',()=>{
  const make=text=>objectiveContract({objective:{text},evidenceDefinitions:{r:'Build it'}}).targetRange;
  assert.deepEqual(make('Represent numbers 16-19 as ten ones plus additional ones'),{min:16,max:19,domain:'whole-number-target'});
  assert.deepEqual(make('Extend positions sixth through tenth'),{min:6,max:10,domain:'ordinal-position-target'});
  assert.equal(make('Compare two objects'),null);
});
test('supported numeric config is bound without changing grade, mode or support',()=>{
  const contract=objectiveContract({objective:{text:'Represent numbers 16-19'},evidenceDefinitions:{r:'Construct the parts'}});
  const plan={objectiveBlocks:[{components:[{taskId:'base-ten-blocks::build_number',instanceId:'a',intent:'Build',requirementIds:['r'],learnerAction:'Place blocks',config:{difficulty:'easy',objectiveGrade:'K'}}]}],unmetRequirements:[]};
  const compiled=compileRequirementManifest(plan,[{taskId:'base-ten-blocks::build_number',componentId:'base-ten-blocks',mode:'build_number'}],contract);
  assert.deepEqual(compiled.objectiveBlocks[0].components[0].config,{difficulty:'easy',objectiveGrade:'K',numberRange:{min:16,max:19},targetEvalMode:'build_number'});
  assert.equal(plan.objectiveBlocks[0].components[0].config.numberRange,undefined);
});
test('target inspection catches drift without treating parts or absent fields as failed targets',()=>{
  const contract=objectiveContract({objective:{text:'Represent numbers 16-19'}});
  const result=inspectTargetScope([{instanceId:'a',componentId:'base-ten-blocks',data:{challenges:[{targetNumber:16,ones:6},{targetNumber:13}]}},{instanceId:'b',componentId:'ordinal-line',data:{challenges:[]}}],contract);
  assert.deepEqual(result.checks[0].outOfRange,[13]);
  assert.equal(result.checks[1].status,'unknown');
});
test('lexical fusion cannot evict protected semantic families',()=>{
  const semantic=Array.from({length:12},(_,i)=>({componentId:`s${i}`}));
  const lexical=Array.from({length:20},(_,i)=>({componentId:`l${i}`}));
  const selected=protectedFamilies(semantic,lexical,lexical,[]);
  assert.ok(semantic.slice(0,8).every(r=>selected.includes(r.componentId)));
});
test('shared family serialization retains every task identity',()=>{
  const cards=[{componentId:'p',description:'shared',taskId:'p::a',mode:'a'},{componentId:'p',description:'shared',taskId:'p::b',mode:'b'}];
  const grouped=groupedCards(cards);
  assert.equal(grouped.length,1);
  assert.deepEqual(grouped[0].modes.map(m=>m.taskId),['p::a','p::b']);
});
