import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { hash, buildInput } from './lib/lesson-planner-pilot.mjs';
import { taskCards } from './lib/lesson-planner-pairs.mjs';
import { prepareSemanticDiscovery, cosine } from './lib/lesson-planner-discovery.mjs';

const root=process.cwd(), out=resolve('qa/lesson-planner/literacy-exemplars/v1');
for (const dir of ['capabilities','generation','bench','sources']) mkdirSync(join(out,dir),{recursive:true});
const save=(name,data)=>writeFileSync(join(out,name),JSON.stringify(data,null,2)+'\n');
const read=name=>JSON.parse(readFileSync(join(out,name),'utf8'));
if (!process.env.GEMINI_API_KEY) process.env.GEMINI_API_KEY=readFileSync('.env.local','utf8').match(/^GEMINI_API_KEY=(.*)$/m)?.[1].trim().replace(/^["']|["']$/g,'');
const {GoogleGenAI}=await import('@google/genai');
const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
const vite=await import('vite');
const server=await vite.createServer({configFile:false,root,logLevel:'error',appType:'custom',server:{middlewareMode:true,hmr:false,ws:false,watch:null},resolve:{alias:{'@':resolve(root,'src'),'server-only':resolve(root,'vitest.stubs/server-only.ts')}}});
const str={type:'STRING'};
const obj=properties=>({type:'OBJECT',properties,required:Object.keys(properties)});
const arr=items=>({type:'ARRAY',items});
const choice=(...values)=>({type:'STRING',enum:values});
const schema=obj({primitiveId:str,modes:arr(obj({evalMode:str,learnerAction:str,responseForm:str,audienceConditions:str,
  limitations:arr(str),sourceEvidence:arr(obj({sourceId:str,quote:str})),
  exemplars:arr(obj({text:str,audience:str,contribution:choice('direct_assessment','instruction','partial_support'),register:choice('formal','casual','student')}))})),
  boundaryExamples:arr(obj({text:str,relativeToMode:str,relationship:choice('different_mode','partial','unsupported','ambiguous'),reason:str}))});
const normalize=s=>s.replace(/\s+/g,' ').trim();
try {
  const runner=vite.createServerModuleRunner(server.environments.ssr,{hmr:false});
  const catalog=await runner.import('/src/components/lumina/service/manifest/catalog/index.ts');
  const literacy=catalog.LITERACY_CATALOG;
  const all=buildInput({candidateIds:literacy.map(c=>c.id)},literacy).candidates;
  const cards=taskCards(all);
  save('catalog.json',literacy);
  const queries=[
    {id:'shorthand',text:'phonics sitpn',expectedFamilies:['letter-sound-link','phonics-blender','phoneme-explorer','cvc-speller'],expectedTasks:[]},
    {id:'explicit',text:'Kindergarten phonics: learn the sounds of s, i, t, p, n and blend short-i words made only from those letters.',expectedFamilies:['letter-sound-link','phonics-blender'],expectedTasks:[]},
    {id:'sound',text:'Say the common sounds for the written letters s, i, t, p, n.',expectedFamilies:['letter-sound-link'],expectedTasks:['letter-sound-link::see_hear']},
    {id:'blend-print',text:'Blend the sounds to read printed short-i CVC words such as sit, pin, tip and tin.',expectedFamilies:['phonics-blender'],expectedTasks:['phonics-blender::cvc']},
    {id:'spell',text:'Hear sit, pin, tip and tin and spell each word by placing its three letters in order.',expectedFamilies:['cvc-speller'],expectedTasks:['cvc-speller::spell_word']},
    {id:'blend-oral',text:'Listen to three separately spoken sounds and say the whole word they make, without seeing letters.',expectedFamilies:['phoneme-explorer'],expectedTasks:['phoneme-explorer::blend']},
    {id:'morphology-boundary',text:'Build words by combining roots with prefixes and suffixes, and explain how the parts change meaning.',expectedFamilies:['word-builder'],expectedTasks:[]},
  ];
  if (!existsSync(join(out,'protocol.json'))) save('protocol.json',{subject:'literacy',primitives:literacy.length,modes:cards.length,generationModel:'gemini-flash-lite-latest',embeddingModel:'gemini-embedding-001',dimensions:768,queries,
    scope:'All literacy catalog primitives, all actual modes, supported audiences. No benchmark queries provided to exemplar generation. Labels are tester-authored consideration probes, not human gold or mastery judgments.',
    policy:'8 examples per declared mode, one call per primitive. Exact dedupe only, within same mode/audience/contribution. Source quotation validation is not semantic verification. Compare fixed top-12 task pools; no per-result tuning.',sourceHashes:{runner:hash(readFileSync('scripts/literacy-exemplar-pilot.mjs','utf8')),catalog:hash(literacy)}});
  const familyDiscovery=await prepareSemanticDiscovery({topic:'Literacy',candidates:all},ai,resolve('qa/lesson-planner/discovery-cache'));
  const familyIndex=JSON.parse(readFileSync(join(root,'qa/lesson-planner/discovery-cache',`${familyDiscovery.indexHash}.json`),'utf8'));
  let cursor=0;
  async function generate(c) {
    if(existsSync(join(out,`capabilities/${c.id}.json`))) return;
    const base='src/components/lumina/service';
    const generator=[`${base}/literacy/gemini-${c.id}.ts`,`${base}/${c.id}/gemini-${c.id}.ts`].find(existsSync);
    if(!generator) throw new Error(`Missing generator for ${c.id}`);
    const text=readFileSync(generator,'utf8');
    const componentRelative=text.match(/from\s+["']([^"']*primitives[^"']+)["']/)?.[1];
    const componentPath=componentRelative ? resolve(generator,'..',componentRelative)+'.tsx' : null;
    const contract=`src/components/lumina/docs/contracts/${c.id}.md`;
    const fullSources=[{id:'generator',path:generator,text},...(componentPath&&existsSync(componentPath)?[{id:'component',path:componentPath,text:readFileSync(componentPath,'utf8')}]:[]),...(existsSync(contract)?[{id:'contract',path:contract,text:readFileSync(contract,'utf8')}]:[])];
    // Fixed source windows keep the pilot bounded; omission is recorded, not called verified.
    const sources=fullSources.map(s=>({...s,hash:hash(s.text),complete:s.text.length<=50000,text:s.text.length<=50000?s.text:s.text.slice(0,25000)+'\n[Middle omitted; do not infer omitted behavior]\n'+s.text.slice(-25000)}));
    save(`sources/${c.id}.json`,sources);
    const i=all.findIndex(x=>x.componentId===c.id);
    const neighbors=all.map((x,j)=>({c:x,score:cosine(familyIndex.vectors[i],familyIndex.vectors[j])})).filter(x=>x.c.componentId!==c.id).sort((a,b)=>b.score-a.score).slice(0,3).map(x=>x.c);
    const prompt=`Author source-grounded literacy capability records and teacher-language learning-objective exemplars. These are DRAFTS for an experiment, not certified capabilities.
Primitive catalog: ${JSON.stringify(c)}
Confusable neighbors (catalog declarations only): ${JSON.stringify(neighbors)}
Implementation evidence: ${JSON.stringify(sources)}
Return every actual catalog evalMode exactly once. Do not invent recall/apply/transfer modes. Preserve condition-dependent grade/response changes. Do not assume one grade per primitive. Missing behavior remains unknown. Explain actual learner action and response, limits, and supported audience conditions. Give 1-3 SHORT EXACT quotes from the provided generator/component/contract text for each mode's behavior; quote under 160 characters. Cite sourceId, not a made-up file. Comments and catalog declarations can be stale: prefer operative code and state conflicts.
For each mode write 8 nonduplicate representative objectives across supported audiences only. Vary formal standards, teacher shorthand and I-can language, verbs and concrete contexts. The objective's learner action must be achievable by the actual task. Mark contribution direct_assessment, instruction, or partial_support honestly. A displayed explanation is not an assessment. Do not invent configurations, arbitrary word/letter restrictions, judging capabilities, grades or transfer ability. Examples cannot certify generator fidelity to a requested scope. Avoid repeating the primitive identifier; domain vocabulary is allowed. No need for 8 if the supported task cannot honestly sustain that diversity: return fewer and explain the limit.
Write 3-5 boundary examples relative to an actual mode, labeling different_mode, partial, unsupported, or ambiguous. A neighbor is not necessarily the only correct home. Neighbors' capabilities are not independently verified here. Output JSON only.`;
    const began=performance.now();
    const result=await ai.models.generateContent({model:'gemini-flash-lite-latest',contents:prompt,config:{responseMimeType:'application/json',responseSchema:schema,thinkingConfig:{thinkingLevel:'LOW'},maxOutputTokens:16000,httpOptions:{timeout:120000}}});
    const record=JSON.parse(result.text);
    const modeKeys=c.evalModes?.map(m=>m.evalMode)??[];
    if(record.primitiveId!==c.id || record.modes.length!==modeKeys.length || new Set(record.modes.map(m=>m.evalMode)).size!==modeKeys.length || record.modes.some(m=>!modeKeys.includes(m.evalMode))) throw new Error(`Mode identity mismatch ${c.id}`);
    for(const m of record.modes) {
      m.sourceEvidence=m.sourceEvidence.map(e=>({...e,quoteFound:!!fullSources.find(s=>s.id===e.sourceId&&normalize(s.text).includes(normalize(e.quote))&&e.quote.length>=20)}));
      m.sourceGrounding=m.sourceEvidence.some(e=>e.quoteFound)?'quotation-found':'unverified';
      const seen=new Set();
      m.exemplars=m.exemplars.filter(e=>{const key=normalize(`${e.audience}|${e.contribution}|${e.text}`).toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
    }
    record.verificationStatus='Source-grounded model draft. Quote existence checked; semantic accuracy and complete runtime behavior not certified.';
    record.sourceHashes=Object.fromEntries(fullSources.map(s=>[s.path,hash(s.text)]));
    save(`generation/${c.id}.json`,{prompt,response:result.text,modelVersion:result.modelVersion,usage:result.usageMetadata,latencyMs:Math.round(performance.now()-began)});
    save(`capabilities/${c.id}.json`,record);
    console.log(JSON.stringify({phase:'generated',primitive:c.id,modes:record.modes.length,examples:record.modes.reduce((n,m)=>n+m.exemplars.length,0),unverified:record.modes.filter(m=>m.sourceGrounding==='unverified').map(m=>m.evalMode)}));
  }
  await Promise.all([0,1,2].map(async()=>{while(cursor<literacy.length){const c=literacy[cursor++];try{await generate(c);}catch(e){save(`generation/${c.id}-error.json`,{error:e.message});console.log(JSON.stringify({phase:'error',primitive:c.id,error:e.message}));}}}));
  const docs=[];
  for(const c of literacy) {
    if(!existsSync(join(out,`capabilities/${c.id}.json`)))continue;
    const r=read(`capabilities/${c.id}.json`);
    for(const m of r.modes) if(m.sourceGrounding==='quotation-found') for(const [i,e] of m.exemplars.entries()) if(e.contribution!=='partial_support') docs.push({id:`${c.id}::${m.evalMode}::${i}`,taskId:`${c.id}::${m.evalMode}`,text:e.text,audience:e.audience,contribution:e.contribution});
  }
  save('index-documents.json',docs);
  const descriptionCandidates=cards.map(c=>({componentId:c.taskId,description:`${c.description}\nTask: ${c.modeDescription}`,affordances:c.affordances,modes:[]}));
  const exemplarCandidates=docs.map(d=>({componentId:d.id,description:d.text,affordances:null,modes:[]}));
  const rows=[];
  for(const q of queries) {
    const [descriptions,examples]=await Promise.all([prepareSemanticDiscovery({topic:q.text,candidates:descriptionCandidates},ai,resolve('qa/lesson-planner/discovery-cache')),prepareSemanticDiscovery({topic:q.text,candidates:exemplarCandidates},ai,resolve('qa/lesson-planner/discovery-cache'))]);
    const grouped=new Map();
    for(const r of examples.ranked){const d=docs.find(d=>d.id===r.componentId);if(!grouped.has(d.taskId))grouped.set(d.taskId,[]);grouped.get(d.taskId).push({score:r.score,text:d.text});}
    // Mean of best two examples per mode: no raw vote advantage for more examples.
    const rankedExamples=[...grouped].map(([componentId,hits])=>({componentId,score:hits.slice(0,2).reduce((n,h)=>n+h.score,0)/Math.min(2,hits.length),matchedExamples:hits.slice(0,2)})).sort((a,b)=>b.score-a.score);
    for(const [arm,ranking] of [['descriptions',descriptions.ranked],['exemplars',rankedExamples]]){
      const top=ranking.slice(0,12),families=new Set(top.map(r=>r.componentId.split('::')[0]));
      const row={query:q,arm,top,expectedFamilyHits:q.expectedFamilies.filter(id=>families.has(id)),expectedTaskHits:q.expectedTasks.filter(id=>top.some(r=>r.componentId===id)),ranking};rows.push(row);
      save(`bench/${q.id}-${arm}.json`,row);
      console.log(JSON.stringify({phase:'retrieved',query:q.id,arm,top:top.slice(0,5).map(r=>r.componentId),familyHits:row.expectedFamilyHits,taskHits:row.expectedTaskHits}));
    }
  }
  save('bench/summary.json',rows);
  console.log(JSON.stringify({phase:'done',primitives:literacy.length,indexedExamples:docs.length,out}));
} finally {await server.close();}
