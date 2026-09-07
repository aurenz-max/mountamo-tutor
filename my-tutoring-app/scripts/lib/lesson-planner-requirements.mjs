import { pairRequest, compileTaskManifest } from './lesson-planner-pairs.mjs';
import { groupedCards } from './lesson-planner-family-evidence.mjs';

export function objectiveContract(input) {
  const text=input.objective.text;
  const numeric=text.match(/\bnumbers?\s+(\d+)\s*[-–]\s*(\d+)/i);
  const ordinals=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'];
  const ordinal=text.toLowerCase().match(new RegExp(`\\b(${ordinals.join('|')}) through (${ordinals.join('|')})\\b`));
  const min=numeric ? Number(numeric[1]) : ordinal ? ordinals.indexOf(ordinal[1])+1 : null;
  const max=numeric ? Number(numeric[2]) : ordinal ? ordinals.indexOf(ordinal[2])+1 : null;
  const targetRange=min !== null && max >= min && max-min <= 100 ? {min,max,domain:numeric?'whole-number-target':'ordinal-position-target'} : null;
  return { objective:input.objective,learner:input.learner,requirements:Object.entries(input.evidenceDefinitions ?? {}).map(([id,text])=>({id,text})),targetRange,
    rangeMeaning:'Range constrains assessment targets, not every operand, intermediate quantity, or visible position. Unknown/unparsed range stays unknown.' };
}

const capabilityNotes = [
  { componentId:'ordinal-line', source:'service/math/gemini-ordinal-line.ts', fact:'Kindergarten setup is capped at position 5. Requests for sixth through tenth do not expand that K setup. identify at K asks for a character name, not an ordinal word. sequence_story asks for an ordinal word and has up to five story characters.' },
  { componentId:'ten-frame', source:'service/math/gemini-ten-frame.ts', fact:'K double-frame output is reduced to single frame. decompose/split is limited to a single frame even after config overrides. Do not request teen quantities on this K path or count its smaller-number practice as teen evidence.' },
  { componentId:'base-ten-blocks', source:'service/math/gemini-base-ten-blocks.ts', fact:'build_number judges the standard tens/ones construction. read_blocks judges the total, not constructing or partitioning. numberRange is an existing supported config; the compiler supplies the explicit whole-target range when present. regroup starts in standard form and assesses a trade, not a prescribed arbitrary partition.' },
  { componentId:'knowledge-check', source:'service/knowledge-check/gemini-knowledge-check.ts; prior hydrated packages', fact:'In these kindergarten numeric curriculum runs, the final-check slot planner produced numeral-naming tasks despite compose/decompose intents and eval-mode pins. Do not rely on this closing check as the sole evidence for those actions. Its generated task must be inspected.' },
];

export function requirementsRequest(request, cards, contract) {
  const result=pairRequest(request,cards);
  result.contents=result.contents.replace(JSON.stringify(cards),JSON.stringify(groupedCards(cards)));
  result.contents += `\n\nOBJECTIVE CONTRACT (preserve the supplied objective):\n${JSON.stringify(contract)}\nSOURCE-VERIFIED CAPABILITY NOTES:\n${JSON.stringify(capabilityNotes.filter(n=>cards.some(c=>c.componentId===n.componentId)))}
Plan how the learner will demonstrate EACH requirement. For every component, assign requirementIds and state the actual learnerAction, including what response is judged. Distinguish recognizing a total, constructing its parts, and saying its ordinal position. A related skill is not equivalent evidence.
Include explanation before dependent practice and a fresh independent opportunity where a supported task can assess the objective. Across direct practice/assessment, cover the explicit target set when one is supplied. Preserve the production 2-4 components-per-objective instruction; combine contributions when appropriate. Do not add blocks only to repeat a mode.
For numeric targets, name the intended values in the component intent. For a capability conflict, select an honestly supported alternative or report the unmet requirement; never change kindergarten to a higher grade or substitute smaller targets and claim coverage. Semantic evidenceMatches are search hints, not verified pedagogical compatibility.
Return unmetRequirements for any requirement that the available tasks cannot honestly satisfy. The field records a gap; it does not waive the objective or count as a pass.`;
  const schema=result.config.responseSchema;
  const nodes=[schema.properties.objectiveBlocks.items.properties.components.items,schema.properties.finalAssessment];
  for (const node of nodes) {
    node.required.push('requirementIds','learnerAction');
    node.properties.requirementIds={type:'ARRAY',items:{type:'STRING',enum:contract.requirements.map(r=>r.id)}};
    node.properties.learnerAction={type:'STRING'};
  }
  schema.required.push('unmetRequirements');
  schema.properties.unmetRequirements={type:'ARRAY',items:{type:'OBJECT',required:['requirementId','reason'],properties:{requirementId:{type:'STRING',enum:contract.requirements.map(r=>r.id)},reason:{type:'STRING'}}}};
  return result;
}

export function compileRequirementManifest(plan,cards,contract) {
  const copy=structuredClone(plan);
  const components=[...copy.objectiveBlocks.flatMap(b=>b.components),...(copy.finalAssessment?[copy.finalAssessment]:[])];
  const validIds=new Set(contract.requirements.map(r=>r.id));
  for (const c of components) {
    if (!Array.isArray(c.requirementIds) || c.requirementIds.some(id=>!validIds.has(id)) || !c.learnerAction?.trim()) throw new Error(`Invalid requirement assignment: ${c.instanceId}`);
    c.intent+=` Learner action: ${c.learnerAction}. Requirements: ${contract.requirements.filter(r=>c.requirementIds.includes(r.id)).map(r=>r.text).join(' ')}`;
    const task=cards.find(t=>t.taskId===c.taskId);
    if (task?.componentId==='base-ten-blocks' && contract.targetRange?.domain==='whole-number-target') {
      const {min,max}=contract.targetRange;
      c.config={...c.config,numberRange:{min,max}};
      c.intent+=` Target whole numbers: ${Array.from({length:max-min+1},(_,i)=>min+i).join(', ')}. Include each target in direct practice; this range does not constrain the individual tens/ones parts.`;
    }
    delete c.requirementIds; delete c.learnerAction;
  }
  delete copy.unmetRequirements;
  return compileTaskManifest(copy,cards);
}

export function inspectTargetScope(components,contract) {
  const range=contract.targetRange;
  if (!range) return {status:'unknown',reason:'No explicit supported target range parsed',checks:[]};
  const fields={'base-ten-blocks':'targetNumber','ten-frame':'targetCount','ordinal-line':'targetPosition'};
  const checks=components.filter(c=>fields[c.componentId]).map(c=>{
    const targets=(c.data?.challenges ?? []).map(ch=>ch[fields[c.componentId]]).filter(Number.isFinite);
    const outOfRange=targets.filter(n=>n<range.min || n>range.max);
    return {instanceId:c.instanceId,componentId:c.componentId,field:fields[c.componentId],targets,outOfRange,
      status:targets.length ? outOfRange.length?'scope-mismatch':'in-range':'unknown',
      note:'Target-field check only. Does not assess learner action, mastery, missing coverage, or other numeric fields.'};
  });
  return {status:checks.some(c=>c.status==='scope-mismatch')?'scope-mismatch':checks.length?'checked':'unknown',range,checks};
}
