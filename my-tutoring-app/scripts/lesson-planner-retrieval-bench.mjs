import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { buildInput, hash } from './lib/lesson-planner-pilot.mjs';
import { pairHopper } from './lib/lesson-planner-pairs.mjs';
import { familyHopper } from './lib/lesson-planner-family-search.mjs';

const root = process.cwd();
const out = resolve('qa/lesson-planner/retrieval-bench/family-v1');
mkdirSync(join(out, 'records'), { recursive: true });
const cases = [];
for (const group of ['discovery-ab', 'curriculum-ab']) {
  const rows = JSON.parse(readFileSync(`qa/lesson-planner/${group}/summary.json`, 'utf8'));
  for (const r of rows) if (!cases.some(c => c.id === r.id)) {
    cases.push({ id: r.id, group, fixture: `qa/lesson-planner/${group}/fixtures/${r.id}.json`,
      expected: r.recall.expected, taskProbes: r.id === 'ordinal-name' ? ['ordinal-line::identify', 'ordinal-line::sequence_story'] : r.id === 'teen-equations' ? ['equation-builder::build-simple'] : [] });
  }
}
const save = (name, data) => writeFileSync(join(out,name), JSON.stringify(data,null,2)+'\n');
save('protocol.json', { cases, model: 'gemini-embedding-001', dimensions: 768,
  policy: 'Unchanged flat pair baseline vs family hybrid / mode-focused search. No manifest generation or scorer changes. Existing consideration labels plus three explicit task regression probes, frozen before execution.',
  sourceHashes: Object.fromEntries(['scripts/lib/lesson-planner-pairs.mjs','scripts/lib/lesson-planner-family-search.mjs','scripts/lesson-planner-retrieval-bench.mjs'].map(p => [p,hash(readFileSync(p,'utf8'))])) });
if (!process.argv.includes('--run')) { console.log(JSON.stringify({ cases: cases.length, out })); process.exit(0); }
if (!process.env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = readFileSync('.env.local','utf8').match(/^GEMINI_API_KEY=(.*)$/m)?.[1].trim().replace(/^["']|["']$/g,'');
const { GoogleGenAI } = await import('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const vite = await import('vite');
const server = await vite.createServer({ configFile:false,root,logLevel:'error',appType:'custom',server:{middlewareMode:true,hmr:false,ws:false,watch:null},resolve:{alias:{'@':resolve(root,'src'),'server-only':resolve(root,'vitest.stubs/server-only.ts')}} });
try {
  const runner = vite.createServerModuleRunner(server.environments.ssr,{hmr:false});
  const catalog = await runner.import('/src/components/lumina/service/manifest/catalog/index.ts');
  const general = [...catalog.CORE_CATALOG,...catalog.ASSESSMENT_CATALOG].map(c => c.id);
  for (const c of cases) for (const arm of ['flat','family']) {
    const filename = `records/${c.id}-${arm}.json`;
    if (existsSync(join(out,filename))) continue;
    const fixture = JSON.parse(readFileSync(c.fixture,'utf8'));
    const input = buildInput({ ...fixture,candidateGroups:[],candidateIds:catalog.UNIVERSAL_CATALOG.map(c => c.id) }, catalog.UNIVERSAL_CATALOG);
    const started = performance.now();
    const retrieval = await (arm === 'flat' ? pairHopper : familyHopper)(input,ai,resolve('qa/lesson-planner/discovery-cache'),general);
    const found = new Set(retrieval.selected.map(t => t.componentId));
    const foundTasks = new Set(retrieval.selected.map(t => t.taskId));
    const row = { id:c.id,arm,fixtureHash:hash(fixture),catalogHash:hash(catalog.UNIVERSAL_CATALOG),latencyMs:Math.round(performance.now()-started),
      expected:c.expected,hits:c.expected.filter(id => found.has(id)),missing:c.expected.filter(id => !found.has(id)),
      taskProbes:c.taskProbes,taskHits:c.taskProbes.filter(id => foundTasks.has(id)),
      taskCount:retrieval.selected.length,familyCount:found.size,retrieval };
    save(filename,row);
    console.log(JSON.stringify({ id:c.id,arm,hits:row.hits.length,expected:c.expected.length,taskHits:row.taskHits,tasks:row.taskCount,latencyMs:row.latencyMs }));
  }
  const rows = cases.flatMap(c => ['flat','family'].map(arm => JSON.parse(readFileSync(join(out,`records/${c.id}-${arm}.json`),'utf8'))));
  const metrics = Object.fromEntries(['flat','family'].map(arm => {
    const rs=rows.filter(r => r.arm===arm);
    return [arm,{ recalled:rs.reduce((n,r)=>n+r.hits.length,0),expected:rs.reduce((n,r)=>n+r.expected.length,0),taskHits:rs.reduce((n,r)=>n+r.taskHits.length,0),taskProbes:rs.reduce((n,r)=>n+r.taskProbes.length,0) }];
  }));
  save('metrics.json',metrics);
  save('summary.json',rows.map(({retrieval,...r})=>r));
  console.log(JSON.stringify(metrics,null,2));
} finally { await server.close(); }
