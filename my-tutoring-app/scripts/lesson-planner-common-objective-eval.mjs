import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const root = process.cwd();
const out = resolve(process.argv[2] ?? 'qa/lesson-planner/production-ab/first-controlled-run');
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local','utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g,'');
}
const vite = await import('vite');
const server = await vite.createServer({configFile:false,root,logLevel:'error',appType:'custom',server:{middlewareMode:true,hmr:false,ws:false,watch:null},resolve:{alias:{'@':resolve(root,'src'),'server-only':resolve(root,'vitest.stubs/server-only.ts')}}});
try {
  const runner = vite.createServerModuleRunner(server.environments.ssr,{hmr:false});
  const [pkgMod,evaluator] = await Promise.all([runner.import('/src/components/lumina/service/qa/lessonBench/lessonPackage.ts'),runner.import('/src/components/lumina/service/qa/lessonCoverage/evaluateLessonCoverage.ts')]);
  const files = readdirSync(join(out,'.raw/records')).filter(f=>f.endsWith('.json')).sort();
  async function evaluate(file) {
    const path = join(out,'.raw/records',file);
    const r = JSON.parse(readFileSync(path,'utf8'));
    if (r.status !== 'complete' || r.normalizedCoverage || !r.packagePath) return;
    const pkg = JSON.parse(readFileSync(resolve(root,r.packagePath),'utf8'));
    // Evaluation-only view: keep all content, selection and ordering unchanged.
    // The experiment has exactly ONE supplied objective per lesson. Judge that
    // same target in both arms; retain raw manifests/packages and raw verdicts.
    const oldIds = pkg.manifest.objectiveBlocks.map(b=>b.objectiveId);
    if (!oldIds.length) throw new Error('No objective blocks to normalize');
    for (const b of pkg.manifest.objectiveBlocks) { b.objectiveId=r.objective.id; b.objectiveText=r.objective.text; b.objectiveVerb=r.objective.verb; }
    for (const item of pkg.manifest.layout) {
      item.objectiveIds = item.objectiveIds?.length ? [r.objective.id] : [];
      if (item.config?.objectiveId) item.config.objectiveId=r.objective.id;
    }
    pkg.curatorBrief.objectives=[r.objective];
    // No arm label, prior verdict or planner rationale is passed to the judge.
    delete pkg.coverage; pkg.scores=null;
    const coverage = await evaluator.evaluateLessonCoverage(pkgMod.exhibitFromPackage(pkg),{source:'live-test',lessonId:pkg.id});
    const current = JSON.parse(readFileSync(path,'utf8'));
    current.normalizedCoverage=coverage;
    current.normalizedEvaluation={scope:'single authoritative supplied objective; IDs/text normalized for judging only',oldIds,contentChanged:false};
    writeFileSync(path,JSON.stringify(current,null,2)+'\n');
    console.log(JSON.stringify({lessonId:pkg.id,status:coverage.status,categories:coverage.objectives.map(o=>o.category)}));
  }
  let cursor = 0;
  await Promise.all([0,1].map(async () => { while (cursor < files.length) await evaluate(files[cursor++]); }));
} finally { await server.close(); }
