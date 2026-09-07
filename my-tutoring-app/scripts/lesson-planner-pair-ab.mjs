import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { format } from 'node:util';
import { buildInput, buildPrompt, responseSchema, validatePlan, hash } from './lib/lesson-planner-pilot.mjs';
import { prepareSemanticDiscovery } from './lib/lesson-planner-discovery.mjs';
import { objectiveNeighborhood } from './lib/lesson-planner-topic.mjs';
import { pairHopper, pairRequest, compileTaskManifest } from './lib/lesson-planner-pairs.mjs';

const root = process.cwd();
const argv = process.argv.slice(2);
const outArg = argv.indexOf('--out');
const out = resolve(root, outArg >= 0 ? argv[outArg+1] : `qa/lesson-planner/pair-hopper-ab/${new Date().toISOString().replace(/[:.]/g, '-')}`);
const rel = relative(root, out);
if (isAbsolute(rel) || rel.startsWith('..')) throw new Error('Output must stay in the app');
const cases = ['ordinal-name', 'ordinal-tenth', 'teen-represent-16-19', 'teen-decompose-16-19', 'teen-equations'];
if (!argv.includes('--run')) { console.log(JSON.stringify({ cases, repetitions: 2, arms: ['production', 'experimental'], out })); process.exit(0); }
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
mkdirSync(out, { recursive: true });
for (const folder of ['records', 'packages', 'fixtures']) mkdirSync(join(out, folder), { recursive: true });
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
  const sourcePaths = ['scripts/lesson-planner-pair-ab.mjs', 'scripts/lib/lesson-planner-pairs.mjs', 'scripts/lib/lesson-planner-pilot.mjs', 'scripts/lib/lesson-planner-discovery.mjs', 'scripts/lib/lesson-planner-topic.mjs',
    'src/components/lumina/service/manifest/gemini-manifest.ts', 'src/components/lumina/service/manifest/flattenManifest.ts', 'src/components/lumina/service/geminiService.ts', 'src/components/lumina/service/qa/lessonCoverage/evaluateLessonCoverage.ts'];
  save(join(out, 'protocol.json'), { cases, repetitions: 2, grade: 'kindergarten', fixtureSource: 'curriculum-ab', catalogHash: hash(catalog.UNIVERSAL_CATALOG),
    sourceHashes: Object.fromEntries(sourcePaths.map(path => [path, hash(readFileSync(path, 'utf8'))])),
    caveats: ['Fixed objectives; topic-to-objective authoring not tested.', 'Both arms use the live production prompt, model settings and lesson structure; experimental replaces catalog with exact task bindings and skips the lesson mode resolver. Retrieval and joint selection change together; this does not isolate either effect.', 'Two concurrent lessons, per-lesson parallel hydration.', 'API transport timeout 120 seconds in both arms.', 'Coverage judge is blinded to arm, not a substitute for human review.'] });
  const fixtures = new Map();
  for (const id of cases) {
    const path = join(out, 'fixtures', `${id}.json`);
    if (existsSync(path)) { fixtures.set(id, JSON.parse(readFileSync(path, 'utf8'))); continue; }
    const priorPath = join(root, 'qa/lesson-planner/production-ab/first-controlled-run/fixtures', `${id}.json`);
    if (existsSync(priorPath)) { const frozen = JSON.parse(readFileSync(priorPath, 'utf8')); save(path, frozen); fixtures.set(id, frozen); continue; }
    const fixture = JSON.parse(readFileSync(`qa/lesson-planner/curriculum-ab/fixtures/${id}.json`, 'utf8'));
    const objective = { ...fixture.objective, verb: id.startsWith('ordinal') ? 'identify' : id.includes('decompose') ? 'analyze' : 'apply', icon: '🎯', grade: 'K' };
    const briefRecord = { phase: 'shared-brief', calls: [] };
    say({ phase: 'shared-brief', caseId: id });
    const t0 = performance.now();
    const originalBrief = await context.run(briefRecord, () => service.generateIntroBriefing(objective.text, 'kindergarten'));
    const frozen = { fixture, objective, originalBrief, brief: { ...originalBrief, objectives: [objective] },
      briefLatencyMs: Math.round(performance.now()-t0), briefCalls: briefRecord.calls };
    save(path, frozen); fixtures.set(id, frozen);
  }
  const schedulePath = join(out, 'schedule.json');
  const schedule = existsSync(schedulePath) ? JSON.parse(readFileSync(schedulePath, 'utf8')) : cases.flatMap((caseId, index) => [1,2].flatMap(rep => {
    const arms = (index + rep) % 2 ? ['production', 'experimental'] : ['experimental', 'production'];
    return arms.map(arm => ({ caseId, rep, arm, blindId: `lesson-${randomUUID().slice(0, 12)}` }));
  }));
  save(schedulePath, schedule);
  async function runOne(task) {
    const path = join(out, 'records', `${task.blindId}.json`);
    if (existsSync(path) && ['complete', 'error'].includes(JSON.parse(readFileSync(path, 'utf8')).status)) return;
    const frozen = fixtures.get(task.caseId);
    const rec = { ...task, status: 'running', phase: 'planning', calls: [], createdAt: new Date().toISOString(), fixtureHash: hash(frozen),
      objective: frozen.objective, topic: frozen.objective.text };
    const persist = () => save(path, rec);
    persist(); say({ phase: 'start', ...task });
    await context.run(rec, async () => {
      try {
        const start = performance.now();
        let manifest;
        if (task.arm === 'production') {
          manifest = await generateExhibitManifestStreaming(rec.topic, 'kindergarten', [frozen.objective]);
        } else {
          const input = buildInput({ ...frozen.fixture, candidateGroups: [], candidateIds: catalog.UNIVERSAL_CATALOG.map(c => c.id) }, catalog.UNIVERSAL_CATALOG);
          rec.discovery = await pairHopper(input, ai, join(root, 'qa/lesson-planner/discovery-cache'), [...catalog.CORE_CATALOG, ...catalog.ASSESSMENT_CATALOG].map(c => c.id));
          const capture = { captureRequest: true, calls: [] };
          try { await context.run(capture, () => generateExhibitManifestStreaming(rec.topic, 'kindergarten', [frozen.objective])); }
          catch (error) { if (error.message !== 'HARNESS_CAPTURE_ONLY') throw error; }
          if (!capture.capturedRequest) throw new Error('Production request capture failed');
          rec.productionRequest = capture.capturedRequest;
          const request = pairRequest(capture.capturedRequest, rec.discovery.selected);
          const stream = await ai.models.generateContentStream(request);
          let answer = '';
          for await (const chunk of stream) for (const part of chunk.candidates?.[0]?.content?.parts ?? []) if (!part.thought && part.text) answer += part.text;
          rec.plan = JSON.parse(answer);
          const native = compileTaskManifest(rec.plan, rec.discovery.selected);
          rec.planValidation = { valid: true, exactTaskBindings: true };
          manifest = flatten.enrichManifestWithLayout(native, [frozen.objective]);
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
        rec.packagePath = relative(root, join(out, 'packages', `${task.blindId}.json`));
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
