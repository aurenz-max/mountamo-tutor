import {existsSync,readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {hash,buildInput} from './lesson-planner-pilot.mjs';
import {taskCards} from './lesson-planner-pairs.mjs';
import {prepareSemanticDiscovery} from './lesson-planner-discovery.mjs';

export async function mathPool(brief,catalog,ai,out){
 const all=taskCards(buildInput({candidateIds:catalog.UNIVERSAL_CATALOG.map(c=>c.id)},catalog.UNIVERSAL_CATALOG).candidates);
 const ids=new Set(),ranks=[];
 const started=performance.now();
 for(const objective of brief.objectives){
  const discovery=await prepareSemanticDiscovery({topic:objective.text,candidates:all.map(c=>({componentId:c.taskId,description:`${c.description}\nTask: ${c.modeDescription}`,modes:[],affordances:c.affordances}))},ai,resolve('qa/lesson-planner/discovery-cache'));
  discovery.ranked.slice(0,12).forEach(r=>ids.add(r.componentId));
  ranks.push({objective,ranking:discovery.ranked,indexHash:discovery.indexHash});
 }
 const support=new Set([...catalog.CORE_CATALOG,...catalog.ASSESSMENT_CATALOG].map(c=>c.id));
 const selected=all.filter(c=>ids.has(c.taskId)||support.has(c.componentId));
 return {selected,ranks,retrievalMs:Math.round(performance.now()-started),policy:'Top12 full-catalog description tasks per live objective, union common core/assessment pool; identical rich/lean candidates; no literacy exemplars.'};
}

export async function annotateMathPool(pool,ai,out){
 const dir=join(out,'.raw/capabilities');mkdirSync(dir,{recursive:true});
 const service=resolve('src/components/lumina/service');
 const files=readdirSync(service,{recursive:true}).filter(p=>p.endsWith('.ts'));
 const byFamily=new Map();
 // Annotate retrieved specialists, not the entire general-purpose support pool.
 const retrieved=new Set(pool.ranks.flatMap(r=>r.ranking.slice(0,12).map(x=>x.componentId)));
 for(const c of pool.selected.filter(c=>retrieved.has(c.taskId))){if(!byFamily.has(c.componentId))byFamily.set(c.componentId,[]);byFamily.get(c.componentId).push(c);}
 const notes={};let cursor=0;const families=[...byFamily];
 await Promise.all([0,1,2].map(async()=>{while(cursor<families.length){
  const [id,cards]=families[cursor++];
  const path=files.find(p=>p.replaceAll('\\','/').endsWith(`/gemini-${id}.ts`));
  if(!path)continue;
  const generator=join(service,path),full=readFileSync(generator,'utf8');
  const sources=[{id:'generator',path:generator,text:full}];
  const component=full.match(/from\s+["']([^"']*primitives[^"']+)["']/)?.[1];
  const componentPath=component?resolve(dirname(generator),component)+'.tsx':null;
  if(componentPath&&existsSync(componentPath))sources.push({id:'component',path:componentPath,text:readFileSync(componentPath,'utf8')});
  const contract=resolve(`src/components/lumina/docs/contracts/${id}.md`);
  if(existsSync(contract))sources.push({id:'contract',path:contract,text:readFileSync(contract,'utf8')});
  const windows=sources.map(s=>({...s,hash:hash(s.text),complete:s.text.length<=40000,text:s.text.length<=40000?s.text:s.text.slice(0,20000)+'\n[MIDDLE OMITTED]\n'+s.text.slice(-20000)}));
  const key=hash({cards,windows}),cache=join(dir,`${id}-${key}.json`);
  let record;
  if(existsSync(cache))record=JSON.parse(readFileSync(cache,'utf8'));
  else{
   const str={type:'STRING'},arr=items=>({type:'ARRAY',items}),obj=properties=>({type:'OBJECT',properties,required:Object.keys(properties)});
   const schema=obj({modes:arr(obj({taskId:{type:'STRING',enum:cards.map(c=>c.taskId)},learnerAction:str,responseForm:str,audienceConditions:str,limitations:arr(str),sourceEvidence:arr(obj({sourceId:str,quote:str}))}))});
   const prompt=`Summarize the actual implementation capabilities of these primitive/mode cards. Include each supplied task exactly once. This is source-assisted metadata, NOT human or runtime certification. Do not generate lesson objectives or choose a lesson. Distinguish what a child produces from what the screen demonstrates; respect actual grade/range constraints and configurable degrees of freedom. Prefer executable code over stale comments. Unknown capabilities must remain unknown. Do not invent configuration guarantees. Give a concise learner action, response form, audience conditions and limitations; 1-2 short exact contiguous source quotes per task. Sources may have omitted middle sections.\nCards: ${JSON.stringify(cards)}\nSources: ${JSON.stringify(windows)}`;
   const start=performance.now();
   const response=await ai.models.generateContent({model:'gemini-flash-latest',contents:prompt,config:{responseMimeType:'application/json',responseSchema:schema,thinkingConfig:{thinkingLevel:'LOW'},httpOptions:{timeout:120000}}});
   record={id,key,prompt,sources:windows,response:response.text,usage:response.usageMetadata,modelVersion:response.modelVersion,latencyMs:Math.round(performance.now()-start),...JSON.parse(response.text)};
   writeFileSync(cache,JSON.stringify(record,null,2)+'\n');
  }
  const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
  const seen=new Set();
  for(const m of record.modes){
   if(seen.has(m.taskId)||!cards.some(c=>c.taskId===m.taskId))throw Error('Invalid metadata task identity');seen.add(m.taskId);
   const grounded=m.sourceEvidence.some(e=>{const s=sources.find(s=>s.id===e.sourceId);return s&&normalize(e.quote).length>=12&&normalize(s.text).includes(normalize(e.quote));});
   if(grounded)notes[m.taskId]={learnerAction:m.learnerAction,responseForm:m.responseForm,audienceConditions:m.audienceConditions,limitations:m.limitations};
  }
 }}));
 return {...pool,notes,metadataStatus:'One model source-assisted pass with quote matching; not independently reviewed, human-certified, or exhaustive. Unmatched notes omitted.'};
}
