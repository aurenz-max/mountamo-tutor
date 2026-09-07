#!/usr/bin/env node
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { buildInput, buildPresentation, buildPrompt, hash, responseSchema, validatePlan, renderReview } from './lib/lesson-planner-pilot.mjs';
import { runStaged, contractPrompt, contractSchema } from './lib/lesson-planner-staged.mjs';
import { runTopic, topicNeighborhood, objectiveNeighborhood, arcPrompt, arcSchema } from './lib/lesson-planner-topic.mjs';
import { prepareSemanticDiscovery } from './lib/lesson-planner-discovery.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--dry-run') options.dryRun = true;
  else if (['--fixture', '--model', '--out', '--representation', '--pipeline', '--catalog', '--discovery'].includes(arg) && args[i + 1] && !args[i + 1].startsWith('--')) options[arg.slice(2)] = args[++i];
  else throw new Error(`Unknown or incomplete argument: ${arg}`);
}
if (!existsSync(join(root, 'src/components/lumina/service/geminiClient.ts'))) throw new Error('Run from my-tutoring-app');
const fixturePath = resolve(root, options.fixture ?? 'qa/lesson-planner/fixtures/direct-attribute-comparison.json');
const out = resolve(root, options.out ?? 'qa/lesson-planner/runs');
const rel = relative(root, out);
if (rel === '..' || rel.startsWith(`..\\`) || rel.startsWith('../') || isAbsolute(rel)) throw new Error('Output must stay within my-tutoring-app');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const model = options.model ?? 'gemini-flash-latest';
const representation = options.representation ?? 'descriptions';
const pipeline = options.pipeline ?? 'single';
const discovery = options.discovery ?? 'lexical';
if (!['lexical', 'semantic'].includes(discovery)) throw new Error('Discovery must be lexical or semantic');
if (discovery === 'semantic' && (!['topic', 'objective'].includes(pipeline) || options.dryRun)) throw new Error('Semantic discovery requires a live topic/objective run (query embedding API call)');
if (!['single', 'staged', 'topic', 'objective'].includes(pipeline)) throw new Error('Pipeline must be single, staged, topic or objective');
if (options.catalog && !['fixture', 'all'].includes(options.catalog)) throw new Error('Catalog must be fixture or all');
if (!['descriptions', 'mode-cards'].includes(representation)) throw new Error('Representation must be descriptions or mode-cards');

// Same environment-key convention as scripts/lesson-coverage.mjs. Never persist env contents.
if (!process.env.GEMINI_API_KEY && existsSync(join(root, '.env.local'))) {
  const m = readFileSync(join(root, '.env.local'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
}
if (!options.dryRun && !process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing; use --dry-run to inspect inputs offline');

// Use the same Vite SSR mechanism as lesson-coverage, without starting a web server.
const vite = await import('vite');
const server = await vite.createServer({
  configFile: false, root, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { UNIVERSAL_CATALOG, CORE_CATALOG, ASSESSMENT_CATALOG } = await runner.import('/src/components/lumina/service/manifest/catalog/index.ts');
  const effectiveFixture = options.catalog === 'all' ? { ...fixture, candidateGroups: [], candidateIds: UNIVERSAL_CATALOG.map(c => c.id), candidateSource: 'Entire live universal catalog; no candidate filtering before staged retrieval' } : fixture;
  const input = buildInput(effectiveFixture, UNIVERSAL_CATALOG, { core: CORE_CATALOG, assessment: ASSESSMENT_CATALOG });
  if (['topic', 'objective'].includes(pipeline)) input.generalPurposeCandidateIds = [...CORE_CATALOG, ...ASSESSMENT_CATALOG].map(c => c.id);
  const semantic = discovery === 'semantic' ? await prepareSemanticDiscovery(input, (await runner.import('/src/components/lumina/service/geminiClient.ts')).ai, join(root, 'qa/lesson-planner/discovery-cache')) : null;
  const neighborhood = pipeline === 'topic' ? topicNeighborhood(input, 10, semantic) : pipeline === 'objective' ? objectiveNeighborhood(input, 10, semantic) : null;
  const planInput = pipeline === 'objective' ? { ...input, candidates: neighborhood.candidates } : input;
  const presentation = pipeline === 'single' ? buildPresentation(input, representation) : null;
  const prompt = pipeline === 'topic' ? arcPrompt(input, neighborhood) : pipeline === 'staged' ? contractPrompt(input) : buildPrompt(planInput, pipeline === 'objective' ? 'mode-cards' : representation);
  let gitSha = null, workingTreeDirty = null;
  try {
    const git = command => execFileSync('git', ['-c', `safe.directory=${resolve(root, '..').replaceAll('\\', '/')}`, ...command], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    gitSha = git(['rev-parse', 'HEAD']);
    workingTreeDirty = !!git(['status', '--porcelain']);
  } catch { /* Hashes and full input still identify this experiment. */ }
  const record = {
    version: 3, pipeline, representation, discovery, semantic, stages: [], createdAt: new Date().toISOString(), status: options.dryRun ? 'dry-run' : 'pending',
    model, settings: { temperature: 0.3, thinkingLevel: 'LOW', maxOutputTokens: 10000, timeoutMs: 60000 },
    provenance: { gitSha, workingTreeDirty, fixtureHash: hash(fixture), candidateHash: hash(input.candidates), promptHash: hash(prompt), schemaHash: hash(responseSchema), plannerHash: hash(readFileSync(new URL('./lib/lesson-planner-pilot.mjs', import.meta.url), 'utf8')) },
    input, presentation, prompt, responseSchema: pipeline === 'topic' ? arcSchema : pipeline === 'staged' ? contractSchema : responseSchema,
    topicCodeHash: hash(readFileSync(new URL('./lib/lesson-planner-topic.mjs', import.meta.url), 'utf8')),
    discoveryCodeHash: hash(readFileSync(new URL('./lib/lesson-planner-discovery.mjs', import.meta.url), 'utf8')),
    stagedCodeHash: hash(readFileSync(new URL('./lib/lesson-planner-staged.mjs', import.meta.url), 'utf8')),
  };
  mkdirSync(out, { recursive: true });
  const stem = `${fixture.caseId.replace(/[^a-z0-9-]/gi, '-')}-${pipeline}-${representation}-${record.createdAt.replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const jsonPath = join(out, `${stem}.json`);
  const persist = () => writeFileSync(jsonPath, JSON.stringify(record, null, 2) + '\n');
  persist();
  if (!options.dryRun) {
    const { ai } = await runner.import('/src/components/lumina/service/geminiClient.ts');
    const start = performance.now();
    const call = async (name, contents, schema) => {
      const stage = { name, prompt: contents, promptChars: contents.length, promptHash: hash(contents), schema, startedAt: new Date().toISOString() };
      record.stages.push(stage); persist();
      const stageStart = performance.now();
      const abort = new AbortController();
      let timer;
      try {
        const response = await Promise.race([
          ai.models.generateContent({ model, contents, config: { responseMimeType: 'application/json', responseSchema: schema, temperature: record.settings.temperature, thinkingConfig: { thinkingLevel: 'LOW' }, maxOutputTokens: record.settings.maxOutputTokens, abortSignal: abort.signal } }),
          new Promise((_, reject) => { timer = setTimeout(() => { abort.abort(); reject(new Error(`${name} timed out`)); }, record.settings.timeoutMs); }),
        ]);
        Object.assign(stage, { rawResponse: response.text ?? '', usage: response.usageMetadata ?? null, modelVersion: response.modelVersion ?? null, finishReason: response.candidates?.[0]?.finishReason ?? null });
        stage.output = JSON.parse(stage.rawResponse);
        return stage.output;
      } finally { clearTimeout(timer); stage.latencyMs = Math.round(performance.now() - stageStart); persist(); }
    };
    try {
      if (pipeline === 'topic') {
        const result = await runTopic(input, call, (name, output) => { record.stages.push({ name, output }); persist(); }, neighborhood);
        record.plan = result.plan; record.validation = result.validation; record.learningArc = result.arc;
      } else if (pipeline === 'objective') {
        record.stages.push({ name: 'objectiveNeighborhood', output: neighborhood }); persist();
        record.plan = await call('bindAndComposeObjective', prompt, responseSchema);
        record.validation = validatePlan(record.plan, planInput);
      } else if (pipeline === 'staged') {
        const result = await runStaged(input, call, (name, output) => { record.stages.push({ name, output }); persist(); });
        record.plan = result.plan; record.validation = result.validation;
      } else {
        record.plan = await call('single', prompt, responseSchema);
        record.validation = validatePlan(record.plan, input);
      }
      record.latencyMs = Math.round(performance.now() - start);
      record.onlineLatencyMs = record.latencyMs + (semantic?.queryLatencyMs ?? 0) + (semantic?.rankingLatencyMs ?? 0);
      const lastCall = record.stages.filter(s => s.rawResponse !== undefined).at(-1);
      record.rawResponse = lastCall?.rawResponse;
      record.modelVersion = lastCall?.modelVersion;
      record.finishReason = lastCall?.finishReason;
      record.usage = pipeline === 'single' ? lastCall?.usage : { byStage: record.stages.filter(s => s.usage).map(s => ({ name: s.name, usage: s.usage })) };
      record.status = record.validation.valid ? 'generated' : 'invalid';
    } catch (error) {
      record.latencyMs = Math.round(performance.now() - start);
      record.status = 'error';
      // Redact the credential even if a transport error embeds its request URL.
      record.error = String(error?.message ?? error).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
    }
    persist();
    writeFileSync(join(out, `${stem}.md`), renderReview(record));
  }
  console.log(JSON.stringify({ status: record.status, artifact: relative(root, jsonPath), candidates: input.candidates.length, promptChars: prompt.length, latencyMs: record.latencyMs, validation: record.validation, error: record.error }, null, 2));
  if (['error', 'invalid'].includes(record.status)) process.exitCode = 1;
} catch (error) {
  // Also preserve failures during embedding/index preparation, before generation.
  const message = String(error?.message ?? error);
  const failure = { status: 'error', pipeline, discovery, model, input: fixture, stages: [],
    createdAt: new Date().toISOString(), phase: 'setup-or-discovery',
    error: process.env.GEMINI_API_KEY ? message.replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]') : message };
  mkdirSync(out, { recursive: true });
  const path = join(out, `discovery-error-${randomUUID()}.json`);
  writeFileSync(path, JSON.stringify(failure, null, 2) + '\n');
  console.error(JSON.stringify({ status: failure.status, artifact: relative(root, path), error: failure.error }));
  process.exitCode = 1;
} finally {
  await server.close();
}
