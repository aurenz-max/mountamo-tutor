import {readFileSync,writeFileSync,mkdirSync,appendFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {format} from 'node:util';
import {buildInput,hash} from './lib/lesson-planner-pilot.mjs';
import {taskCards} from './lib/lesson-planner-pairs.mjs';
const root=process.cwd(),out=resolve('qa/lesson-planner/literacy-exemplars/v1');
mkdirSync(join(out,'lessons'),{recursive:true});
const save=(p,v)=>writeFileSync(join(out,p),JSON.stringify(v,null,2)+'\n');
const read=p=>JSON.parse(readFileSync(join(out,p),'utf8'));
const say=v=>process.stdout.write(JSON.stringify(v)+'\n');
if(!process.env.GEMINI_API_KEY)process.env.GEMINI_API_KEY=readFileSync('.env.local','utf8').match(/^GEMINI_API_KEY=(.*)$/m)?.[1].trim().replace(/^["']|["']$/g,'');
for(const name of ['log','warn','error','debug','info'])console[name]=(...args)=>appendFileSync(join(out,'lessons/runtime.log'),format(...args).replaceAll(process.env.GEMINI_API_KEY,'[REDACTED]')+'\n');
const topic='Kindergarten phonics using only the letters s, i, t, p, n: their common sounds, and reading and spelling short-i CVC words such as sit, pin, tip and tin.';
const objectives=[
 {id:'sounds',text:'Associate the written letters s, i, t, p, n with their common sounds.',verb:'identify',grade:'K',icon:'🔤'},
 {id:'read',text:'Blend sounds to read printed short-i CVC words made only from s, i, t, p, n.',verb:'apply',grade:'K',icon:'📖'},
 {id:'spell',text:'Spell heard short-i CVC words by arranging three letters using only s, i, t, p, n.',verb:'apply',grade:'K',icon:'✏️'},
];
const str={type:'STRING'},arr=items=>({type:'ARRAY',items}),obj=properties=>({type:'OBJECT',properties,required:Object.keys(properties)});
const schema=obj({title:str,activities:arr(obj({taskId:str,title:str,intent:str,learnerAction:str,objectiveIds:arr(str),role:{type:'STRING',enum:['introduce','model','practice','apply','assess']},evidenceLimit:str})),unmetRequirements:arr(str)});
const vite=await import('vite');
const server=await vite.createServer({configFile:false,root,logLevel:'error',appType:'custom',server:{middlewareMode:true,hmr:false,ws:false,watch:null},resolve:{alias:{'@':resolve(root,'src'),'server-only':resolve(root,'vitest.stubs/server-only.ts')}}});
try{
 const runner=vite.createServerModuleRunner(server.environments.ssr,{hmr:false});
 const [{ai},catalog,service,pkgMod]=await Promise.all([runner.import('/src/components/lumina/service/geminiClient.ts'),runner.import('/src/components/lumina/service/manifest/catalog/index.ts'),runner.import('/src/components/lumina/service/geminiService.ts'),runner.import('/src/components/lumina/service/qa/lessonBench/lessonPackage.ts')]);
 const general=['foundation-explorer','fast-fact','knowledge-check'];
 const candidates=buildInput({candidateIds:catalog.UNIVERSAL_CATALOG.map(c=>c.id)},catalog.UNIVERSAL_CATALOG).candidates;
 const allCards=taskCards(candidates);
 const retrieval=read('reviewed-bench/summary.json');
 save('lessons/protocol.json',{topic,objectives,arms:['descriptions','exemplars','hybrid'],selection:'One chooser call per arm. Union of top 4 task results for sound/blend-print/spell queries, plus identical foundation/fast-fact/knowledge-check support pool. Same source-reviewed capability metadata in all arms.',
  caveats:['Exploratory one build per arm, no statistical quality claim.','Objectives are tester-authored decomposition of the user topic.','Review is model/source-assisted, not human certification.','Target-field inspection is not full lesson coverage evaluation.'],sourceHashes:{runner:hash(readFileSync('scripts/literacy-exemplar-lesson-bench.mjs','utf8')),catalog:hash(catalog.UNIVERSAL_CATALOG)}});
 const plans=await Promise.all(['descriptions','exemplars','hybrid'].map(async arm=>{
  const retrieved=[...new Set(['sound','blend-print','spell'].flatMap(id=>retrieval.find(r=>r.arm===arm&&r.query.id===id).top.slice(0,4).map(r=>r.componentId)))];
  const cards=allCards.filter(c=>retrieved.includes(c.taskId)||general.includes(c.componentId)).map(c=>{
   if(general.includes(c.componentId))return c;
   const mode=read(`reviewed/${c.componentId}.json`).modes.find(m=>m.evalMode===c.mode);
   return {...c,sourceReviewedBehavior:{learnerAction:mode.learnerAction,responseForm:mode.responseForm,audienceConditions:mode.audienceConditions,limitations:mode.limitations}};
  });
  const activeSchema=structuredClone(schema);activeSchema.properties.activities.items.properties.taskId={type:'STRING',enum:cards.map(c=>c.taskId)};
  activeSchema.properties.activities.items.properties.objectiveIds.items={type:'STRING',enum:objectives.map(o=>o.id)};
  const prompt=`Plan a complete, coherent 15-minute kindergarten lesson for a pre-reader. Topic: ${topic}\nFixed objectives: ${JSON.stringify(objectives)}\nAvailable task bindings: ${JSON.stringify(cards)}
Use 4-6 activities including meaningful introduction/modeling, supported practice, and a fresh independent check where supported. Select exact task IDs jointly with order; do not invent or re-select modes. Do not force variety for its own sake. For each activity describe the learner action and which objectives it actually serves. Distinguish letter naming from sound production, oral blending from printed decoding, and recognizing spelling from constructing it. Prefer current source-reviewed behavior over stale catalog text when they conflict. General tools can support instruction but do not automatically establish independent evidence. Do not assume an intent can expand an unsupported generator capability.
State limitations and uncovered requirements honestly. Intent must explicitly preserve the five-letter set and short-i scope for reading/spelling. Do not add a or other letters as targets. Pictures or narration may contain other words; the constraint concerns target letters and words used for phonics practice. JSON only.`;
  const start=performance.now();
  const response=await ai.models.generateContent({model:'gemini-flash-latest',contents:prompt,config:{responseMimeType:'application/json',responseSchema:activeSchema,thinkingConfig:{thinkingLevel:'LOW'},temperature:0.2,httpOptions:{timeout:120000}}});
  const plan=JSON.parse(response.text),blindId=`lesson-${randomUUID().slice(0,12)}`;
  for(const a of plan.activities)if(!cards.some(c=>c.taskId===a.taskId)||a.objectiveIds.some(id=>!objectives.some(o=>o.id===id)))throw Error('Invalid task/objective binding');
  const record={arm,blindId,topic,objectives,retrieved,plan,prompt,modelVersion:response.modelVersion,usage:response.usageMetadata,planningMs:Math.round(performance.now()-start)};
  save(`lessons/${arm}.json`,record);say({phase:'planned',arm,tasks:plan.activities.map(a=>a.taskId)});return record;
 }));
 for(const r of plans){
  const layout=r.plan.activities.map((a,i)=>{
   const card=allCards.find(c=>c.taskId===a.taskId);
   return {componentId:card.componentId,instanceId:`activity-${i+1}`,title:a.title,intent:a.intent,objectiveIds:a.objectiveIds,config:{...(card.mode?{targetEvalMode:card.mode}:{}),difficulty:'easy',objectiveGrade:'K',objectiveText:objectives.filter(o=>a.objectiveIds.includes(o.id)).map(o=>o.text).join(' '),intent:`${a.intent} Learner action: ${a.learnerAction}`}};
  });
  const start=performance.now();
  r.components=await Promise.all(layout.map(async item=>{
   try{const result=await service.generateComponentContent({componentId:item.componentId,instanceId:item.instanceId,config:item.config},topic,'kindergarten');const data=result&&typeof result==='object'&&'data'in result?result.data:result;return {...item,data,status:data?'ok':'empty'};}
   catch(e){return {...item,status:'error',error:e.message};}
  }));
  r.hydrationMs=Math.round(performance.now()-start);
  const allowed=new Set('sitpn');
  r.targetInspection=r.components.filter(c=>['letter-sound-link','phonics-blender','cvc-speller','phoneme-explorer'].includes(c.componentId)).map(c=>{
   const entries=[...(c.data?.challenges??[]),...(c.data?.words??[])];
   const targets=entries.flatMap(e=>[...(typeof e.targetLetter==='string'?[{field:'targetLetter',text:e.targetLetter}]:[]),...(typeof e.targetWord==='string'?[{field:'targetWord',text:e.targetWord}]:[])]);
   return {instanceId:c.instanceId,componentId:c.componentId,targets,outsideLetterSet:targets.filter(t=>[...t.text.toLowerCase()].some(l=>!allowed.has(l))),status:targets.length?'checked':'unknown',note:'Only explicit targetLetter/targetWord fields checked, not narration, pictures, options, instruction quality, or other fields.'};
  });
  const manifest={topic,gradeLevel:'kindergarten',subject:'LANGUAGE_ARTS',themeColor:'#6366f1',layout,objectiveBlocks:objectives.map(o=>({objectiveId:o.id,objectiveText:o.text,objectiveVerb:o.verb,components:layout.filter(a=>a.objectiveIds.includes(o.id))}))};
  const curatorBrief={title:r.plan.title,hook:'Five letters can make words you can read and spell.',objectives};
  r.package= pkgMod.buildLessonPackage({manifest,curatorBrief,components:r.components.filter(c=>c.status==='ok').map(({componentId,instanceId,data})=>({componentId,instanceId,data})),source:'literacy-exemplar-pilot',id:r.blindId});
  save(`lessons/${r.arm}.json`,r);
  if(!r.package.error)save(`lessons/${r.blindId}.package.json`,r.package);
  say({phase:'hydrated',arm:r.arm,failed:r.components.filter(c=>c.status!=='ok').length,inspection:r.targetInspection,packageError:r.package.error});
 }
}finally{await server.close();}
