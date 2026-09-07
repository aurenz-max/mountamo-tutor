import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const out=resolve(process.argv[2]??'qa/lesson-planner/literacy-topic-ab/di-metadata-ab');
const records=readdirSync(join(out,'.raw/records')).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(join(out,'.raw/records',f),'utf8')));
const rows=records.map(r=>{
 const planningCalls=r.calls.filter(c=>c.phase==='planning'&&c.method!=='embedContent');
 return {arm:r.arm,rep:r.rep,id:r.blindId,status:r.status,planningMs:r.planningMs,generationMs:r.generationMs,
  planningPromptTokens:planningCalls.reduce((n,c)=>n+(c.usage?.promptTokenCount??0),0),planningCalls:planningCalls.length,
  selectedTasks:r.discovery?.selected.map(c=>c.taskId),candidateCount:r.discovery?.selected.length,
  diCandidates:r.diCandidates,coverage:r.coverage?.status,categories:r.coverage?.objectives.map(o=>o.category),
  stream:r.scores?.evidence.streamOrder,estimatedMinutes:r.scores?.evidence.minutes,
  failures:r.components?.filter(c=>c.status!=='ok').length,
  judgeHealth:{schemaFallback:r.coverage?.meta.usedSchemaFallback,truncated:r.coverage?.meta.truncated},
 };
}).sort((a,b)=>a.rep-b.rep||a.arm.localeCompare(b.arm));
const mean=(rs,key)=>Math.round(rs.reduce((n,r)=>n+(r[key]??0),0)/rs.length);
const aggregate=['production','rich','lean'].map(arm=>{
 const rs=rows.filter(r=>r.arm===arm&&r.status==='complete');
 return {arm,n:rs.length,sufficientObjectives:rs.flatMap(r=>r.categories??[]).filter(c=>c==='ASSESSED_SUFFICIENTLY').length,
  objectives:rs.flatMap(r=>r.categories??[]).length,meanPlanningMs:mean(rs,'planningMs'),meanGenerationMs:mean(rs,'generationMs'),meanPlanningPromptTokens:mean(rs,'planningPromptTokens')};
});
const pools=rows.filter(r=>r.selectedTasks).map(r=>JSON.stringify([...r.selectedTasks].sort()));
const identicalExperimentalPools=new Set(pools).size===1;
writeFileSync(join(out,'summary.json'),JSON.stringify({rows,aggregate,identicalExperimentalPools},null,2)+'\n');
const lines=['# DI-inclusive metadata comparison: exact streams',''];
for(const r of rows){
 lines.push(`## ${r.arm}, build ${r.rep}`,'');
 const raw=records.find(x=>x.blindId===r.id);
 for(const b of raw.manifest?.objectiveBlocks??[]){
  lines.push(`- **${b.objectiveId}:** `+b.components.map(c=>`${c.componentId}[${c.config?.targetEvalMode??'no pinned mode'}]`).join(' → '));
 }
 lines.push('',`Closing: ${r.stream?.at(-1)??'unknown'}`,'',`[Package](packages/${r.id}.json) · [Record](records/${r.id}.json)`,'');
}
writeFileSync(join(out,'STREAMS.md'),lines.join('\n'));
console.log(JSON.stringify({aggregate,identicalExperimentalPools},null,2));
