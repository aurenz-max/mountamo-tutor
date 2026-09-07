import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {hash} from './lib/lesson-planner-pilot.mjs';
const out=resolve('qa/lesson-planner/literacy-exemplars/v1');
for(const d of ['reviewed','review'])mkdirSync(join(out,d),{recursive:true});
const save=(p,v)=>writeFileSync(join(out,p),JSON.stringify(v,null,2)+'\n');
const read=p=>JSON.parse(readFileSync(join(out,p),'utf8'));
if(!process.env.GEMINI_API_KEY)process.env.GEMINI_API_KEY=readFileSync('.env.local','utf8').match(/^GEMINI_API_KEY=(.*)$/m)?.[1].trim().replace(/^["']|["']$/g,'');
const {GoogleGenAI}=await import('@google/genai');const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
const str={type:'STRING'};
const obj=properties=>({type:'OBJECT',properties,required:Object.keys(properties)});
const arr=items=>({type:'ARRAY',items});
const choice=(...values)=>({type:'STRING',enum:values});
const schema=obj({primitiveId:str,modes:arr(obj({evalMode:str,learnerAction:str,responseForm:str,audienceConditions:str,
  limitations:arr(str),sourceEvidence:arr(obj({sourceId:str,quote:str})),
  exemplars:arr(obj({text:str,audience:str,contribution:choice('direct_assessment','instruction','partial_support'),register:choice('formal','casual','student')}))})),
  boundaryExamples:arr(obj({text:str,relativeToMode:str,relationship:choice('different_mode','partial','unsupported','ambiguous'),reason:str}))});

const catalog=read('catalog.json');
const normalized=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
let cursor=0;
async function review(c){
 if(existsSync(join(out,`reviewed/${c.id}.json`)))return;
 const sources=read(`sources/${c.id}.json`);
 const generator=sources.find(s=>s.id==='generator');
 const whole=readFileSync(generator.path,'utf8');
 const imports=[...whole.matchAll(/from\s+["']([^"']*(?:Script|letterGroups))["']/g)];
 for(const [i,m] of imports.entries()){
  const path=resolve(generator.path,'..',m[1])+'.ts';
  if(existsSync(path)) {const text=readFileSync(path,'utf8');sources.push({id:`helper${i}`,path,hash:hash(text),text:text.length>60000?text.slice(0,30000)+'\n[MIDDLE OMITTED]\n'+text.slice(-30000):text});}
 }
 const draft=existsSync(join(out,`capabilities/${c.id}.json`))?read(`capabilities/${c.id}.json`):null;
 const schemaFor=structuredClone(schema);schemaFor.properties.modes.items.properties.evalMode={type:'STRING',enum:c.evalModes.map(m=>m.evalMode)};
 const prompt=`Independently audit and correct this capability/exemplar draft using the implementation evidence. Return a corrected record in the same schema. Do not merely approve the first model. This is source review, not human or runtime certification.
Catalog: ${JSON.stringify(c)}
Draft (null means the first generator failed identity validation): ${JSON.stringify(draft)}
Sources including imported capability helpers: ${JSON.stringify(sources)}
Prefer operative code and current helper constants over stale comments/catalog prose. Resolve conflicts explicitly in limitations. Use ONLY exact catalog evalMode keys (underscores and hyphens matter). Include every declared mode once.
For each mode retain or author up to 8 diverse teacher-language objectives, only where the learner action/response actually supports them. Check direct assessment vs instruction vs partial support. Avoid claiming full mastery or unsupported transfer from one narrow task. Audience describes LEARNERS, never teachers; retain real multi-grade conditions. Do not invent letter/range configuration guarantees. Preserve boundaries between phoneme manipulation, decoding print, identifying letters, spelling, morphology, and comprehension.
Check every claimed restriction against actual code, especially sound production and grade-dependent branches. Give 1-3 short EXACT source substrings per mode; choose a contiguous code/comment fragment with no paraphrasing or added prefix. Cite sourceId. If capability is unknown, say so; do not certify missing behavior. Boundary examples remain non-indexed negative/partial examples. JSON only.`;
 const started=performance.now();
 const result=await ai.models.generateContent({model:'gemini-flash-latest',contents:prompt,config:{responseMimeType:'application/json',responseSchema:schemaFor,thinkingConfig:{thinkingLevel:'LOW'},maxOutputTokens:20000,httpOptions:{timeout:120000}}});
 save(`review/${c.id}.json`,{prompt,response:result.text,modelVersion:result.modelVersion,usage:result.usageMetadata,latencyMs:Math.round(performance.now()-started)});
 const record=JSON.parse(result.text);
 const keys=c.evalModes.map(m=>m.evalMode);
 if(record.primitiveId!==c.id||record.modes.length!==keys.length||new Set(record.modes.map(m=>m.evalMode)).size!==keys.length||record.modes.some(m=>!keys.includes(m.evalMode)))throw Error(`Mode mismatch ${c.id}`);
 for(const mode of record.modes){
  mode.sourceEvidence=mode.sourceEvidence.map(e=>({...e,verbatimFound:!!sources.find(s=>s.id===e.sourceId&&readFileSync(s.path,'utf8').includes(e.quote)),normalizedQuoteFound:!!sources.find(s=>s.id===e.sourceId&&e.quote.length>=20&&normalized(readFileSync(s.path,'utf8')).includes(normalized(e.quote)))}));
  mode.sourceGrounding=mode.sourceEvidence.some(e=>e.normalizedQuoteFound)?'source-quote-supported':'unverified';
 }
 record.verificationStatus='Independently model-reviewed against supplied source windows/helpers; quote matching checked. Not human-certified or exhaustively runtime-verified.';
 record.sourceHashes=Object.fromEntries(sources.map(s=>[s.path,hash(readFileSync(s.path,'utf8'))]));
 save(`reviewed/${c.id}.json`,record);
 console.log(JSON.stringify({primitive:c.id,modes:record.modes.length,unverified:record.modes.filter(m=>m.sourceGrounding==='unverified').map(m=>m.evalMode)}));
}
await Promise.all([0,1,2].map(async()=>{while(cursor<catalog.length){const c=catalog[cursor++];try{await review(c);}catch(e){save(`review/${c.id}-error.json`,{error:e.message});console.log(JSON.stringify({error:e.message,primitive:c.id}));}}}));
