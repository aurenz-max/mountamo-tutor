import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { format } from 'node:util';
import { buildInput, buildPrompt, responseSchema, validatePlan, hash } from './lib/lesson-planner-pilot.mjs';
import { cosine, prepareSemanticDiscovery } from './lib/lesson-planner-discovery.mjs';
import { objectiveNeighborhood } from './lib/lesson-planner-topic.mjs';
import { taskCards, pairRequest, compileTaskManifest } from './lib/lesson-planner-pairs.mjs';


const root = process.cwd();
const argv = process.argv.slice(2);
const outArg = argv.indexOf('--out');
const out = resolve(root, outArg >= 0 ? argv[outArg+1] : `qa/lesson-planner/native-mode-ab/${new Date().toISOString().replace(/[:.]/g, '-')}`);
const rel = relative(root, out);
if (isAbsolute(rel) || rel.startsWith('..')) throw new Error('Output must stay in the app');
const caseSpecs=[
 {id:'k-attributes',topic:'Learn to compare objects by length and weight',grade:'K',gradeLevel:'kindergarten'},
 {id:'g2-money',topic:'Grade 2: solve money problems using different coin combinations',grade:'2',gradeLevel:'Grade 2'},
 {id:'g3-elapsed',topic:'Grade 3: solve elapsed-time problems across the hour',grade:'3',gradeLevel:'Grade 3'}
];
const cases=caseSpecs.map(c=>c.id);
if (!argv.includes('--run')) { console.log(JSON.stringify({ cases, repetitions: 2, arms: ['production', 'native-modes'], out })); process.exit(0); }
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
mkdirSync(out, { recursive: true });
for (const folder of ['.raw/records', '.raw/packages', 'fixtures']) mkdirSync(join(out, folder), { recursive: true });
const clean = text => String(text).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const save = (path, value) => writeFileSync(path, clean(JSON.stringify(value, null, 2)) + '\n');
const say = value => process.stdout.write(JSON.stringify(value) + '\n');
for (const name of ['log', 'warn', 'error', 'debug', 'info']) console[name] = (...args) => appendFileSync(join(out, 'runtime.log'), clean(format(...args)) + '\n');
const context = new AsyncLocalStorage();
const vite = await import('vite');
const server = await vite.createServer({ configFile: false, root, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
try {
  const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { ai } = await runner.import('/src/components/lumina/service/geminiClient.ts');
  // Instrument the shared client in this process only. No production source edits.
  for (const method of ['generateContent', 'generateContentStream', 'embedContent']) {
    const original = ai.models[method].bind(ai.models);
    ai.models[method] = async args => {
      const rec = context.getStore();
      if (rec?.captureRequest && method === 'generateContentStream') { rec.capturedRequest = structuredClone(args); throw new Error('HARNESS_CAPTURE_ONLY'); }
      const entry = { method, model: args.model, phase: rec?.phase, startedAt: new Date().toISOString(),
        contents: args.contents, config: args.config };
      rec?.calls.push(entry);
      const started = performance.now();
      const capture = response => {
        entry.modelVersion = response.modelVersion ?? entry.modelVersion;
        entry.usage = response.usageMetadata ?? entry.usage;
        const partText = response.candidates?.[0]?.content?.parts?.filter(p => !p.thought && p.text).map(p => p.text).join('') ?? '';
        entry.responseText = (entry.responseText ?? '') + partText;
      };
      try {
        const result = await original({ ...args, config: { ...args.config, httpOptions: { ...args.config?.httpOptions, timeout: 120000 } } });
        if (method === 'generateContentStream') return (async function* () {
          try { for await (const chunk of result) { capture(chunk); yield chunk; } }
          finally { entry.latencyMs = Math.round(performance.now()-started); }
        })();
        capture(result); entry.latencyMs = Math.round(performance.now()-started); return result;
      } catch (error) { entry.error = clean(error?.message ?? error); entry.latencyMs = Math.round(performance.now()-started); throw error; }
    };
  }
  const [{ generateExhibitManifestStreaming }, service, catalog, pkgMod, scorer, evaluator, flatten] = await Promise.all([
    runner.import('/src/components/lumina/service/manifest/gemini-manifest.ts'),
    runner.import('/src/components/lumina/service/geminiService.ts'),
    runner.import('/src/components/lumina/service/manifest/catalog/index.ts'),
    runner.import('/src/components/lumina/service/qa/lessonBench/lessonPackage.ts'),
    runner.import('/src/components/lumina/service/qa/lessonBench/lessonBenchScorer.ts'),
    runner.import('/src/components/lumina/service/qa/lessonCoverage/evaluateLessonCoverage.ts'),
    runner.import('/src/components/lumina/service/manifest/flattenManifest.ts'),
  ]);
  const sourcePaths = ['scripts/native-mode-ab.mjs', 'scripts/lib/lesson-planner-pairs.mjs', 'scripts/lib/lesson-planner-pilot.mjs', 'scripts/lib/lesson-planner-discovery.mjs', 'scripts/lib/lesson-planner-topic.mjs',
    'src/components/lumina/service/manifest/gemini-manifest.ts', 'src/components/lumina/service/manifest/flattenManifest.ts', 'src/components/lumina/service/geminiService.ts', 'src/components/lumina/service/qa/lessonCoverage/evaluateLessonCoverage.ts'];
  save(join(out, 'protocol.json'), { cases, repetitions: 2, caseSpecs, fixtureSource: 'Unmodified live topic-generated curator brief', catalogHash: hash(catalog.UNIVERSAL_CATALOG),
    sourceHashes: Object.fromEntries(sourcePaths.map(path => [path, hash(readFileSync(path, 'utf8'))])),
    caveats: ['Same prior live-generated math briefs/objectives shared by both arms and two repetitions.', 'Full live catalog in both arms; experimental appends native mode descriptions and binds modes during manifest selection. No retrieval or synthetic metadata. Shared catalog prose, affordance legend, objective allocation rules, model/settings, and generators retained.', 'Experimental binds one mode per activity; production resolver may blend modes. Mode visibility and joint binding are tested together, not visibility alone.', 'Two concurrent lessons; per-lesson parallel hydration. Existing coverage judge and code scorer unchanged, human ratings absent.'] });
  const fixtures = new Map();
  for (const id of cases) {
    const path = join(out, 'fixtures', `${id}.json`);
    if (existsSync(path)) { fixtures.set(id, JSON.parse(readFileSync(path, 'utf8'))); continue; }
    const frozen=JSON.parse(readFileSync(join('qa/lesson-planner/math-topic-ab/k-2-3-first-run/fixtures',id+'.json'),'utf8'));
    save(path,frozen);fixtures.set(id,frozen);
  }
  const fullCards=taskCards(buildInput({candidateIds:catalog.UNIVERSAL_CATALOG.map(c=>c.id)},catalog.UNIVERSAL_CATALOG).candidates);
  save(join(out,'catalog-tasks.json'),fullCards);
  const schedulePath = join(out, 'schedule.json');
  const schedule = existsSync(schedulePath) ? JSON.parse(readFileSync(schedulePath, 'utf8')) : cases.flatMap((caseId, index) => [1,2].flatMap(rep => {
    const arms = (index + rep) % 2 ? ['production', 'native-modes'] : ['native-modes', 'production'];
    return arms.map(arm => ({ caseId, rep, arm, blindId: `lesson-${randomUUID().slice(0, 12)}` }));
  }));
  save(schedulePath, schedule);
  async function runOne(task) {
    const path = join(out, '.raw/records', `${task.blindId}.json`);
    if (existsSync(path) && ['complete', 'error'].includes(JSON.parse(readFileSync(path, 'utf8')).status)) return;
    const frozen = fixtures.get(task.caseId);
    const rec = { ...task, status: 'running', phase: 'planning', calls: [], createdAt: new Date().toISOString(), fixtureHash: hash(frozen),
      objectives: frozen.brief.objectives, topic:frozen.spec.topic, grade:frozen.spec.grade, gradeLevel:frozen.spec.gradeLevel };
    const persist = () => save(path, rec);
    persist(); say({ phase: 'start', ...task });
    await context.run(rec, async () => {
      try {
        const start = performance.now();
        let manifest;
        if (task.arm === 'production') {
          manifest = await generateExhibitManifestStreaming(rec.topic, frozen.spec.gradeLevel, frozen.brief.objectives);
        } else {
          rec.discovery={selected:fullCards,policy:'Full catalog; native mode descriptions only; one mode binding per activity'};
          const capture = { captureRequest: true, calls: [] };
          try { await context.run(capture, () => generateExhibitManifestStreaming(rec.topic, frozen.spec.gradeLevel, frozen.brief.objectives)); }
          catch (error) { if (error.message !== 'HARNESS_CAPTURE_ONLY') throw error; }
          if (!capture.capturedRequest) throw new Error('Production request capture failed');
          rec.productionRequest = capture.capturedRequest;
          const request = pairRequest(capture.capturedRequest, rec.discovery.selected);
          // Keep production catalog lines AND their existing affordance legend intact.
          // Append each primitive's native modes once, without repeating family descriptions.
          const original=capture.capturedRequest.contents;
          const begin=original.indexOf('AVAILABLE COMPONENT TOOLS:');
          const end=original.indexOf('## CRITICAL: OBJECTIVE-CENTRIC DESIGN');
          const middle=original.slice(begin,end).split('\n').map(line=>{
            const id=line.match(/^- ([a-z0-9-]+):/)?.[1];
            if(!id)return line;
            const modes=fullCards.filter(c=>c.componentId===id);
            return line+'\n  Available tasks: '+modes.map(c=>`${c.taskId}: ${c.modeDescription}`).join(' | ');
          }).join('\n');
          request.contents=original.slice(0,begin)+middle+request.contents.slice(request.contents.indexOf('## CRITICAL: OBJECTIVE-CENTRIC DESIGN'));
          // Large whole-catalog enum lists exceed the API schema allowance.
          // Task membership remains enforced by compileTaskManifest before hydration.
          delete request.config.responseSchema.properties.objectiveBlocks.items.properties.components.items.properties.taskId.enum;
          delete request.config.responseSchema.properties.finalAssessment.properties.taskId.enum;
          rec.promptAudit={catalogFamilies:catalog.UNIVERSAL_CATALOG.length,tasks:fullCards.length,originalChars:original.length,experimentalChars:request.contents.length,retainsNativeCatalogLines:true};
          const stream = await ai.models.generateContentStream(request);
          let answer = '';
          for await (const chunk of stream) for (const part of chunk.candidates?.[0]?.content?.parts ?? []) if (!part.thought && part.text) answer += part.text;
          rec.plan = JSON.parse(answer);
          const native = compileTaskManifest(rec.plan, rec.discovery.selected);
          rec.planValidation = { valid: true, exactTaskBindings: true };
          manifest = flatten.enrichManifestWithLayout(native, frozen.brief.objectives);
        }
        rec.planningMs = Math.round(performance.now()-start);
        rec.manifest = manifest; rec.phase = 'hydration'; persist();
        say({ phase: 'hydrate', ...task, planningMs: rec.planningMs, blocks: manifest.layout.length });
        const hydrationStart = performance.now();
        rec.components = await Promise.all(manifest.layout.filter(item => item.componentId !== 'curator-brief').map(async item => {
          const began = performance.now();
          try {
            const result = await service.generateComponentContent({ componentId: item.componentId, instanceId: item.instanceId, config: item.config ?? {} }, manifest.topic, manifest.gradeLevel);
            const data = result && typeof result === 'object' && 'data' in result ? result.data : result;
            return { instanceId: item.instanceId, componentId: item.componentId, generatorInput: item, data: data ?? null,
              status: data ? 'ok' : 'empty', latencyMs: Math.round(performance.now()-began) };
          } catch (error) { return { instanceId: item.instanceId, componentId: item.componentId, generatorInput: item,
            status: 'error', error: clean(error?.message ?? error), data: null, latencyMs: Math.round(performance.now()-began) }; }
        }));
        rec.hydrationMs = Math.round(performance.now()-hydrationStart);
        rec.generationMs = rec.planningMs + rec.hydrationMs;
        rec.withSharedBriefMs = rec.generationMs + frozen.briefLatencyMs;
        const pkg = pkgMod.buildLessonPackage({ manifest, curatorBrief: frozen.brief,
          components: rec.components.filter(c => c.status === 'ok').map(({ instanceId, componentId, data }) => ({ instanceId, componentId, data })),
          source: 'blinded-planner-comparison', id: task.blindId });
        if (pkg.error) throw new Error(pkg.error);
        pkgMod.parseLessonPackage(pkg);
        rec.packagePath = relative(root, join(out, '.raw/packages', `${task.blindId}.json`));
        save(join(root, rec.packagePath), pkg);
        rec.phase = 'coverage'; persist();
        say({ phase: 'judge', ...task, generationMs: rec.generationMs, failures: rec.components.filter(c => c.status !== 'ok').length });
        pkg.coverage = await evaluator.evaluateLessonCoverage(pkgMod.exhibitFromPackage(pkg), { source: 'live-test', lessonId: task.blindId });
        pkg.scores = scorer.scoreLessonPackage(pkg, catalog.UNIVERSAL_CATALOG);
        rec.coverage = pkg.coverage; rec.scores = pkg.scores;
        rec.packageFidelity = pkgMod.packageFidelity(pkg);
        save(join(root, rec.packagePath), pkg);
        rec.status = 'complete'; rec.phase = 'complete'; persist();
        say({ phase: 'complete', ...task, generationMs: rec.generationMs, coverage: rec.coverage.status, objectives: rec.coverage.objectives.map(o => o.category) });
      } catch (error) { rec.status = 'error'; rec.error = clean(error?.message ?? error); persist(); say({ phase: 'error', ...task, error: rec.error }); }
    });
  }
  let cursor = 0;
  await Promise.all([0,1].map(async () => { while (cursor < schedule.length) await runOne(schedule[cursor++]); }));
  say({ phase: 'done', out: relative(root, out), runs: schedule.length });
} catch (error) {
  save(join(out, 'setup-error.json'), { error: clean(error?.message ?? error) });
  say({ phase: 'setup-error', error: clean(error?.message ?? error), out: relative(root, out) });
  process.exitCode = 1;
} finally { await server.close(); }
