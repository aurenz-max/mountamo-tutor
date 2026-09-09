import { writeFileSync,mkdirSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer,createServerModuleRunner } from 'vite';
import { scopeFromArgv, curriculumUrl } from './lib/curriculum-coverage-scopes.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
// Each scope is a separately reviewed pilot (see lib/curriculum-coverage-scopes.mjs).
// Default scope is the original K Language Arts review; pass --scope math-k for K Mathematics.
const scope=scopeFromArgv();
const out=resolve(root,scope.dir);
const url=curriculumUrl(scope);
const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
if(!response.ok)throw new Error(`Published curriculum read failed: ${response.status}`);
const live=await response.json();
if(!Array.isArray(live.curriculum)||!live.curriculum.length)throw new Error('No published curriculum; refusing to create an empty gap report');
const requirements=live.curriculum.flatMap(u=>u.skills.flatMap(s=>s.subskills.map(r=>({id:r.id,unit:u.title,unitId:u.id,skill:s.description,skillId:s.id,text:r.description,legacyPrimitive:r.target_primitive??null,legacyModes:r.target_eval_modes??[]}))));
if(requirements.some(r=>!r.id||!r.text)||new Set(requirements.map(r=>r.id)).size!==requirements.length)throw new Error('Invalid or duplicate curriculum requirement');
const server=await createServer({configFile:false,root,logLevel:'error',appType:'custom',server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const runner=createServerModuleRunner(server.environments.ssr,{hmr:false});
 const {UNIVERSAL_CATALOG,CATALOGS_BY_DOMAIN}=await runner.import('/src/components/lumina/service/manifest/catalog/index.ts');
 const catalog=UNIVERSAL_CATALOG.map(c=>({id:c.id,description:c.description,constraints:c.constraints,domain:Object.entries(CATALOGS_BY_DOMAIN).find(([,es])=>es.some(e=>e.id===c.id))?.[0],supportsEvaluation:c.supportsEvaluation===true,modes:(c.evalModes??[]).map(m=>({id:m.evalMode,description:m.description,label:m.label}))}));
 if(new Set(catalog.map(c=>c.id)).size!==catalog.length)throw new Error('Duplicate catalog primitive');
 mkdirSync(out,{recursive:true});
 for(const [name,value]of Object.entries({'live-curriculum.json':live,'requirements.json':requirements,'catalog-export.json':catalog}))writeFileSync(resolve(out,name),JSON.stringify(value,null,2)+'\n');
 console.log(JSON.stringify({scope:scope.id,subject:scope.subject,grade:scope.grade,requirements:requirements.length,primitives:catalog.length}));
}finally{await server.close();}
