import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {prepareSemanticDiscovery, cosine} from './lib/lesson-planner-discovery.mjs';
import {buildInput, hash} from './lib/lesson-planner-pilot.mjs';
import {taskCards} from './lib/lesson-planner-pairs.mjs';
import {fuseRanks} from './lib/lesson-planner-family-search.mjs';
const root=process.cwd(),out=resolve('qa/lesson-planner/literacy-exemplars/v1');
mkdirSync(join(out,'teacher-text-bench'),{recursive:true});
const save=(p,v)=>writeFileSync(join(out,p),JSON.stringify(v,null,2)+'\n');
const read=p=>JSON.parse(readFileSync(join(out,p),'utf8'));
const literacy=read('catalog.json');
const all=buildInput({candidateIds:literacy.map(c=>c.id)},literacy).candidates;
const cards=taskCards(all),queries=read('protocol.json').queries;
if(!process.env.GEMINI_API_KEY)process.env.GEMINI_API_KEY=readFileSync('.env.local','utf8').match(/^GEMINI_API_KEY=(.*)$/m)?.[1].trim().replace(/^["']|["']$/g,'');
const {GoogleGenAI}=await import('@google/genai');const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
  const docs=[];
  for(const c of literacy) {
    if(!existsSync(join(out,`reviewed/${c.id}.json`)))continue;
    const r=read(`reviewed/${c.id}.json`);
    for(const m of r.modes) if(m.sourceGrounding==='source-quote-supported') for(const [i,e] of m.exemplars.entries()) if(e.contribution!=='partial_support') docs.push({id:`${c.id}::${m.evalMode}::${i}`,taskId:`${c.id}::${m.evalMode}`,text:e.text,audience:e.audience,contribution:e.contribution});
  }
  save('reviewed-index-documents.json',docs);
  const descriptionCandidates=cards.map(c=>({componentId:c.taskId,description:`${c.description}\nTask: ${c.modeDescription}`,affordances:c.affordances,modes:[]}));
  const exemplarCandidates=docs.map(d=>({componentId:d.id,description:d.text,affordances:null,modes:[]}));
  const indexHash=hash({version:1,model:'gemini-embedding-001',dimensions:768,texts:docs.map(d=>d.text)});
  const indexPath=resolve('qa/lesson-planner/discovery-cache',`${indexHash}.json`);
  let vectors;
  if(existsSync(indexPath))vectors=JSON.parse(readFileSync(indexPath,'utf8')).vectors;
  else {
    vectors=[];
    for(let i=0;i<docs.length;i+=50){
      const response=await ai.models.embedContent({model:'gemini-embedding-001',contents:docs.slice(i,i+50).map(d=>d.text),config:{taskType:'RETRIEVAL_DOCUMENT',outputDimensionality:768,httpOptions:{timeout:60000}}});
      if(response.embeddings?.length!==docs.slice(i,i+50).length)throw Error('Embedding count mismatch');
      vectors.push(...response.embeddings.map(e=>e.values));
    }
    writeFileSync(indexPath,JSON.stringify({indexHash,vectors,documents:docs})+'\n');
  }
  const rows=[];
  for(const q of queries) {
    const descriptions=await prepareSemanticDiscovery({topic:q.text,candidates:descriptionCandidates},ai,resolve('qa/lesson-planner/discovery-cache'));
    const examples={ranked:docs.map((d,i)=>({componentId:d.id,score:cosine(vectors[i],descriptions.queryVector)})).sort((a,b)=>b.score-a.score)};
    const grouped=new Map();
    for(const r of examples.ranked){const d=docs.find(d=>d.id===r.componentId);if(!grouped.has(d.taskId))grouped.set(d.taskId,[]);grouped.get(d.taskId).push({score:r.score,text:d.text});}
    // Mean of best two examples per mode: no raw vote advantage for more examples.
    const rankedExamples=[...grouped].map(([componentId,hits])=>({componentId,score:hits.slice(0,2).reduce((n,h)=>n+h.score,0)/Math.min(2,hits.length),matchedExamples:hits.slice(0,2)})).sort((a,b)=>b.score-a.score);
    for(const [arm,ranking] of [['descriptions',descriptions.ranked],['exemplars',rankedExamples],['hybrid',fuseRanks([descriptions.ranked,rankedExamples])]]){
      const top=ranking.slice(0,12),families=new Set(top.map(r=>r.componentId.split('::')[0]));
      const row={query:q,arm,top,expectedFamilyHits:q.expectedFamilies.filter(id=>families.has(id)),expectedTaskHits:q.expectedTasks.filter(id=>top.some(r=>r.componentId===id)),ranking};rows.push(row);
      save(`teacher-text-bench/${q.id}-${arm}.json`,row);
      console.log(JSON.stringify({phase:'retrieved',query:q.id,arm,top:top.slice(0,5).map(r=>r.componentId),familyHits:row.expectedFamilyHits,taskHits:row.expectedTaskHits}));
    }
  }

save('teacher-text-bench/summary.json',rows);
const metrics=Object.fromEntries(['descriptions','exemplars','hybrid'].map(arm=>{
 const rs=rows.filter(r=>r.arm===arm),probes=rs.filter(r=>r.query.expectedTasks.length);
 return [arm,{familyHitsAt12:rs.reduce((n,r)=>n+r.expectedFamilyHits.length,0),expectedFamilyConsiderations:rs.reduce((n,r)=>n+r.query.expectedFamilies.length,0),taskHitsAt1:probes.reduce((n,r)=>n+r.query.expectedTasks.filter(id=>r.ranking.slice(0,1).some(x=>x.componentId===id)).length,0),taskHitsAt5:probes.reduce((n,r)=>n+r.query.expectedTasks.filter(id=>r.ranking.slice(0,5).some(x=>x.componentId===id)).length,0),taskHitsAt12:probes.reduce((n,r)=>n+r.expectedTaskHits.length,0),taskProbes:probes.length}];
}));
save('teacher-text-bench/metrics.json',metrics);console.log(JSON.stringify({indexedExamples:docs.length,metrics},null,2));

save('teacher-text-bench/index-provenance.json',{indexHash,documentText:'Objective text only; primitive/mode IDs and audience metadata are NOT embedded.',model:'gemini-embedding-001',dimensions:768});
