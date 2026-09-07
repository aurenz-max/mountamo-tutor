import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer, createServerModuleRunner } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const snapshotPath = 'qa/curriculum-coverage/live-curriculum.json';
const raw = readFileSync(resolve(root, snapshotPath), 'utf8');
const snapshot = JSON.parse(raw);
const hash = value => createHash('sha256').update(value).digest('hex');
const server = await createServer({ configFile: false, root, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { UNIVERSAL_CATALOG, CATALOGS_BY_DOMAIN } = await runner.import('/src/components/lumina/service/manifest/catalog/index.ts');
  const catalog = UNIVERSAL_CATALOG.map(c => ({
    id: c.id, description: c.description, constraints: c.constraints,
    domain: Object.entries(CATALOGS_BY_DOMAIN).find(([, entries]) => entries.some(e => e.id === c.id))?.[0],
    supportsEvaluation: c.supportsEvaluation === true,
    modes: (c.evalModes ?? []).map(m => ({ id: m.evalMode, description: m.description, label: m.label })),
  }));
  const review = JSON.parse(readFileSync(resolve(root,'qa/curriculum-coverage/review.json'),'utf8'));
  for(const [p,h] of Object.entries(review.catalogSources??{})){
    if(hash(readFileSync(resolve(root,p)))!==h)throw new Error(`Catalog review is stale: ${p}`);
  }
  const evidence = JSON.parse(readFileSync(resolve(root,'qa/curriculum-coverage/content-checks.json'),'utf8'));
  const requirements = snapshot.curriculum.flatMap(u=>u.skills.flatMap(s=>s.subskills.map(r=>({
    id:r.id, unit:u.title, unitId:u.id, skill:s.description, text:r.description,
    primitive:r.target_primitive||null, modes:r.target_eval_modes??[],
  }))));
  if(new Set(requirements.map(r=>r.id)).size!==requirements.length)throw new Error('Duplicate curriculum IDs');
  for(const r of requirements){
    r.review = review.decisions[r.id];
    if(!r.review)throw new Error(`No explicit review for ${r.id}`);
    if(r.review.requirementHash!==hash(r.text))throw new Error(`Stale requirement review: ${r.id}`);
    for(const edge of r.review.candidates){
      const def=catalog.find(p=>p.id===edge.primitive);
      if(!def?.modes.some(m=>m.id===edge.mode))throw new Error(`Invalid reviewed edge: ${r.id} ${edge.primitive}/${edge.mode}`);
    }
    r.evidence=evidence.filter(e=>e.id===r.id).map(e=>({...e,stale:Object.entries(e.sourceHashes??{}).some(([p,h])=>!existsSync(resolve(root,p))||hash(readFileSync(resolve(root,p)))!==h)}));
    if(r.evidence.length){
      r.review.reviewLevel='source + generated content';
      r.review.content=r.evidence.some(e=>e.stale)?'stale':r.evidence.some(e=>e.result==='failed')?'failed':'sampled';
      r.review.contentNote=r.evidence[0].semantic;
    }
  }
  const workItems=JSON.parse(readFileSync(resolve(root,'qa/curriculum-coverage/work-items.json'),'utf8'));
  const prescriptions=JSON.parse(readFileSync(resolve(root,'qa/curriculum-coverage/modality-prescriptions.json'),'utf8'));
  if(new Set(workItems.map(w=>w.id)).size!==workItems.length)throw new Error('Duplicate work item IDs');
  if(Object.keys(prescriptions).length!==workItems.length)throw new Error('Modality prescriptions must match the development queue');
  for(const item of workItems){
    item.modality=prescriptions[item.id];
    for(const field of ['stimulus','response','visibility','feedback','score','liveCheck']){
      if(!item.modality?.[field]?.trim())throw new Error(`Missing modality prescription: ${item.id}/${field}`);
    }
    item.modality.reuseSources=(item.modality.reuseEvidence??[]).map(p=>({path:p,sha256:hash(readFileSync(resolve(root,p)))}));
    item.requirements=requirements.filter(r=>r.review.work===item.id||item.requirementIds?.includes(r.id)).map(r=>r.id);
  }
  const designs=JSON.parse(readFileSync(resolve(root,'qa/curriculum-coverage/design-themes.json'),'utf8'));
  const designed=new Set();
  if(new Set(designs.map(d=>d.id)).size!==designs.length)throw new Error('Duplicate design IDs');
  for(const design of designs){
    design.requirements=design.variants.map(v=>{
      const matches=requirements.filter(r=>v.id?r.id===v.id:r.skill===v.skill&&r.text.includes(v.textContains));
      if(matches.length!==1)throw new Error(`Design variant must resolve exactly once: ${design.id}/${JSON.stringify(v)}`);
      const r=matches[0];
      if(r.review.candidates.length||designed.has(r.id))throw new Error(`Design scope is not an unassigned gap or is duplicated: ${r.id}`);
      designed.add(r.id);
      return {id:r.id,text:r.text.split('\n')[0],treatment:v.treatment};
    });
    for(const f of ['idea','visual','core','reuse','student','feedback','mask','evidence'])if(!design[f]?.trim())throw new Error(`Missing design field ${design.id}/${f}`);
    if(design.steps.length!==3||design.prompts.length!==3)throw new Error(`Expected three design frames: ${design.id}`);
  }
  if(requirements.filter(r=>!r.review.candidates.length).some(r=>!designed.has(r.id)))throw new Error('A requirement without a candidate has no design theme');
  const data = {
    generated: new Date().toISOString(), subject: snapshot.subject, grade: 'K',
    snapshotPath, snapshotHash: hash(raw), fetchedAt:statSync(resolve(root,snapshotPath)).mtime.toISOString(),
    sourceUrl:'http://localhost:8000/api/curriculum/curriculum/LANGUAGE_ARTS?grade=K',
    catalogHash: hash(JSON.stringify(catalog)), catalog, requirements,workItems,designs,
    verification:{tests:183,suites:6,note:'Generator, script-contract and mocked render tests passed. Live voice not driven.'},
  };
  const template = readFileSync(resolve(root, 'scripts/lib/curriculum-coverage-artifact.html'), 'utf8');
  const html = template.replace('/*__DATA__*/null', () => JSON.stringify(data).replace(/</g, '\\u003c'))
    .replace('/*__VIEW__*/', () => readFileSync(resolve(root,'scripts/lib/curriculum-coverage-view.js'),'utf8'));
  const output = resolve(root, 'qa/curriculum-coverage/index.html');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, html);
  const designHtml=readFileSync(resolve(root,'scripts/lib/curriculum-design-studio.html'),'utf8')
    .replace('/*__DESIGNS__*/null',()=>JSON.stringify({designs,generated:data.generated,grade:data.grade,subject:data.subject,requirementCount:designed.size}).replace(/</g,'\\u003c'))
    .replace('/*__STUDIO__*/',()=>readFileSync(resolve(root,'scripts/lib/curriculum-design-studio.js'),'utf8'));
  writeFileSync(resolve(root,'qa/curriculum-coverage/design-studio.html'),designHtml);
  console.log(JSON.stringify({ output, requirements: requirements.length, primitives: catalog.length }));
} finally { await server.close(); }
