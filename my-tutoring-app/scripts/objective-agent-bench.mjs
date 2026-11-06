// Manifest vs one-agent-per-objective, on the same curator brief.
//
//   node scripts/objective-agent-bench.mjs [--cases=a,b] [--arms=manifest,agent,single] [--out=name]
//
// Arm `single`: ONE agent builds the whole lesson (sees every objective, so it can vary
// primitives across them) and is told objective 1 streams to the student first; its
// first-primitive time is when objective 1's first primitive lands.
//
// Both arms share one curator brief (same objectives). The manifest arm is production:
// manifest -> eval-mode resolver -> every generator in parallel. The agent arm runs one
// function-calling agent per objective, all in parallel; each agent picks primitives and
// eval modes from the live catalog, runs the REAL registered generator, reads the result
// back, and may replace it before finishing.
//
// Every lesson is saved as a Lesson Package (drop it on the Lesson Bench dev panel to play
// it, tutor and all) under qa/objective-agent-bench/packages/, and indexed in
// qa/objective-agent-bench/library.jsonl so a later agent can search past lessons.
// Image-model calls are stubbed. Spend is metered by the shared client (daily cap applies).
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const arg = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const outName = arg('out', `run-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}`);
const arms = arg('arms', 'manifest,agent').split(',');

const CASES = {
  'k-float': { topic: 'Things that float and sink', gradeLevel: 'kindergarten' },
  'g2-regroup': { topic: 'Adding two-digit numbers with regrouping', gradeLevel: '2nd grade' },
  'g3-main-idea': { topic: 'Finding the main idea and key details of a paragraph', gradeLevel: '3rd grade' },
  'g4-water-cycle': { topic: 'The water cycle', gradeLevel: '4th grade' },
};
const selected = arg('cases', Object.keys(CASES).join(',')).split(',');

const AGENT_MODEL = 'gemini-flash-latest';
const MAX_TURNS = 5;
const SOFT_MS = 60_000;
const HARD_MS = 90_000;

const logs = [];
for (const m of ['log', 'warn', 'error', 'info', 'debug']) console[m] = (...a) => logs.push(format(...a));
const say = (s) => process.stdout.write(s + '\n');
const GEN_TIMEOUT_MS = 120_000;
// A turn waits this long for its generations; slower ones keep running and join the sequence when they land.
const TURN_WAIT_MS = 25_000;
const withTimeout = (p, ms, what) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${what} timed out after ${ms / 1000}s`)), ms); })]).finally(() => clearTimeout(t)); };
const T0 = Date.now();
const trace = (s) => process.stderr.write(`[${((Date.now() - T0) / 1000).toFixed(0)}s] ${s}\n`);

const root = process.cwd();
const outDir = resolve(root, 'qa/objective-agent-bench');
const pkgDir = resolve(outDir, 'packages');
mkdirSync(pkgDir, { recursive: true });

const server = await vite.createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null }, resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
try {
  const load = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { ai } = await load.import('/src/components/lumina/service/geminiClient.ts');
  const { priceCall, withSpendSource } = await load.import('/src/components/lumina/service/spend/spendMeter.ts');
  const { generateComponentContent, generateIntroBriefing } = await load.import('/src/components/lumina/service/geminiService.ts');
  const { generateExhibitManifestStreaming, buildCatalogContext } = await load.import('/src/components/lumina/service/manifest/gemini-manifest.ts');
  const { flattenManifestToLayout } = await load.import('/src/components/lumina/service/manifest/flattenManifest.ts');
  const { UNIVERSAL_CATALOG, getComponentById } = await load.import('/src/components/lumina/service/manifest/catalog/index.ts');
  const { buildLessonPackage } = await load.import('/src/components/lumina/service/qa/lessonBench/lessonPackage.ts');

  // ── Metering: every model call, tagged with case + arm ──
  const { AsyncLocalStorage } = await import('node:async_hooks');
  const scope = new AsyncLocalStorage();
  const calls = [];
  const inner = ai.models.generateContent.bind(ai.models);
  ai.models.generateContent = async (params) => {
    if (/image/.test(params.model)) return { candidates: [{ content: { parts: [] } }] };
    const t = Date.now();
    const res = await inner(params);
    calls.push({ ...(scope.getStore() ?? {}), model: params.model, ms: Date.now() - t, usd: priceCall(params.model, res?.usageMetadata) });
    return res;
  };
  if (ai.models.generateContentStream) {
    const innerStream = ai.models.generateContentStream.bind(ai.models);
    ai.models.generateContentStream = async (params) => {
      const t = Date.now();
      const store = scope.getStore() ?? {};
      const stream = await innerStream(params);
      return (async function* () {
        let usage;
        for await (const chunk of stream) { if (chunk?.usageMetadata) usage = chunk.usageMetadata; yield chunk; }
        calls.push({ ...store, model: params.model, ms: Date.now() - t, usd: priceCall(params.model, usage), stream: true });
      })();
    };
  }

  const stripImages = (v) => JSON.parse(JSON.stringify(v ?? null, (k, x) => (/base64|imageData|^html$/i.test(k) && typeof x === 'string' ? '[image]' : x)));
  const preview = (data) => { const s = JSON.stringify(stripImages(data)); return s.length > 2500 ? s.slice(0, 2500) + '…' : s; };
  const modesOf = (id) => (getComponentById(id)?.evalModes ?? []).map(m => m.evalMode);

  // ── Arm 1: production manifest ──
  async function manifestArm(c, brief) {
    const t0 = Date.now();
    const manifest = await generateExhibitManifestStreaming(c.topic, c.gradeLevel, brief.objectives);
    const manifestMs = Date.now() - t0;
    trace(`manifest done ${(manifestMs / 1000).toFixed(1)}s: ${(manifest.layout ?? []).map(i => i.componentId).join(', ')}`);
    const items = (manifest.layout ?? []).filter(i => i.componentId !== 'curator-brief');
    const done = await Promise.all(items.map(async (item) => {
      try {
        const r = await withTimeout(generateComponentContent({ componentId: item.componentId, instanceId: item.instanceId, config: item.config || {} }, manifest.topic, manifest.gradeLevel), GEN_TIMEOUT_MS, item.componentId);
        trace(`manifest gen ok ${item.componentId}`);
        const data = r && typeof r === 'object' && 'data' in r ? r.data : r;
        return { item, data: data ?? null, at: Date.now() - t0 };
      } catch (e) {
        return { item, data: null, at: Date.now() - t0, error: String(e?.message ?? e) };
      }
    }));
    return {
      manifest,
      components: done.filter(d => d.data).map(d => ({ instanceId: d.item.instanceId, componentId: d.item.componentId, data: d.data })),
      metrics: {
        manifestMs,
        firstMs: done[0]?.at ?? null,
        totalMs: Date.now() - t0,
        failed: done.filter(d => !d.data).map(d => `${d.item.componentId}: ${d.error ?? 'empty'}`),
        picks: items.map(i => ({ objectiveId: i.objectiveIds?.[0], componentId: i.componentId, evalMode: i.config?.targetEvalMode ?? null, intent: i.intent })),
      },
    };
  }

  // ── Arm 2: one agent per objective ──
  const NOT_FOR_AGENT = new Set(['curator-brief']);
  const { catalogContext } = buildCatalogContext(undefined, UNIVERSAL_CATALOG.filter(d => !NOT_FOR_AGENT.has(d.id)));
  const tools = [{
    functionDeclarations: [
      {
        name: 'inspect_primitives',
        description: 'Read the eval modes (task types, with difficulty beta) of up to 5 catalog primitives before choosing.',
        parameters: { type: 'OBJECT', properties: { ids: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['ids'] },
      },
      {
        name: 'add_primitive',
        description: 'Generate one primitive with its real generator and append it to this objective. Returns a preview of the generated content so you can check it teaches the objective.',
        parameters: {
          type: 'OBJECT',
          properties: {
            objectiveId: { type: 'STRING', description: 'Which objective this primitive teaches (whole-lesson mode only).' },
            componentId: { type: 'STRING', description: 'Catalog id.' },
            evalMode: { type: 'STRING', description: 'One eval mode key from inspect_primitives, "a|b" for a blend, or "mixed". Omit for primitives with no eval modes.' },
            difficulty: { type: 'STRING', enum: ['easy', 'medium', 'hard'] },
            title: { type: 'STRING', description: 'Student-facing title. Must not reveal an answer.' },
            intent: { type: 'STRING', description: 'What the generator must build: the content, scope and the specific thing the student does. Be concrete.' },
          },
          required: ['componentId', 'title', 'intent'],
        },
      },
      {
        name: 'remove_primitive',
        description: 'Remove the primitive at index (0-based) from this objective.',
        parameters: { type: 'OBJECT', properties: { index: { type: 'INTEGER' } }, required: ['index'] },
      },
      {
        name: 'finish',
        description: 'Submit this objective\'s sequence.',
        parameters: { type: 'OBJECT', properties: { rationale: { type: 'STRING', description: 'One sentence: why this sequence teaches the objective.' } } },
      },
    ],
  }];

  const lessonSystem = (c, all) => `You design a whole ${c.gradeLevel} lesson on "${c.topic}" by composing interactive primitives from a live catalog.

OBJECTIVES, in lesson order:
${all.map(o => `- ${o.id} (Bloom verb "${o.verb}"): ${o.text}`).join(String.fromCharCode(10))}

For each objective build 2-3 primitives that take a ${c.gradeLevel} student from first meeting the idea to doing it on their own; pass its objectiveId on every add_primitive. Every primitive must teach something real: no answer revealed in titles, intents or default state.

The lesson streams: the student starts on ${all[0]?.id}'s first primitive as soon as it is generated, while you build the rest. So add ${all[0]?.id}'s opening primitive by your second turn, then the others.

Across objectives, vary what the student does. Reuse a primitive in a second objective only with a different eval mode and only when it is clearly the best fit.

How to work:
1. Pick candidates from the catalog. Prefer the most specific primitive for the content; a general one (deep-dive, annotated-example, knowledge-check) only where no specific one fits. inspect_primitives to see eval modes, and choose the eval mode that matches what the student must do.
2. add_primitive generates real content. Read each preview: is it on its objective, at this grade, and does the student act? If not, remove it and try a different intent or primitive.
3. You have about ${Math.round(SOFT_MS / 1000)} seconds. Call independent add_primitive calls in the same turn so they generate in parallel. Then finish.

CATALOG:
${catalogContext}`;

  const agentSystem = (c, objective, all) => `You design the part of a ${c.gradeLevel} lesson on "${c.topic}" that teaches ONE learning objective, by composing interactive primitives from a live catalog. Other agents handle the other objectives in parallel.

YOUR OBJECTIVE (${objective.id}, Bloom verb "${objective.verb}"): ${objective.text}
The lesson's other objectives (not yours; do not teach them): ${all.filter(o => o.id !== objective.id).map(o => o.text).join(' | ') || 'none'}

Build a sequence of 2-3 primitives that takes a ${c.gradeLevel} student from first meeting this idea to doing it on their own. Every primitive must teach something real: no answer revealed in titles, intents or default state.

How to work:
1. Pick candidates from the catalog. Prefer the most specific primitive for the content; a general one (deep-dive, annotated-example, knowledge-check) only where no specific one fits. inspect_primitives to see eval modes, and choose the eval mode that matches what the student must do.
2. add_primitive generates real content. Read each preview: is it on this objective, at this grade, varied, and does the student act? If not, remove it and try a different intent or primitive.
3. You have about ${Math.round(SOFT_MS / 1000)} seconds. Call independent add_primitive calls in the same turn so they generate in parallel. Then finish.

CATALOG:
${catalogContext}`;

  async function runObjectiveAgent(c, mine, all, t0, onFirst) {
    const started = Date.now();
    const whole = mine.length > 1;
    const objective = whole ? { id: 'lesson' } : mine[0];
    const maxTurns = whole ? MAX_TURNS + 1 : MAX_TURNS;
    const entries = [];
    const debug = { turns: 0, toolCalls: [], rationale: '', deadline: 'none', lateFailures: [] };
    const contents = [{ role: 'user', parts: [{ text: 'Build the sequence now.' }] }];
    let finished = false;
    let n = 0;
    const pending = new Set();
    while (!finished && debug.turns < maxTurns && Date.now() - started < HARD_MS) {
      debug.turns++;
      trace(`${objective.id} turn ${debug.turns}`);
      const res = await withTimeout(ai.models.generateContent({
        model: AGENT_MODEL, contents,
        config: { systemInstruction: whole ? lessonSystem(c, all) : agentSystem(c, objective, all), thinkingConfig: { thinkingLevel: 'LOW' }, tools },
      }), GEN_TIMEOUT_MS, `${objective.id} agent turn`);
      const content = res.candidates?.[0]?.content;
      if (!content) break;
      contents.push(content);
      const fcs = res.functionCalls ?? [];
      if (!fcs.length) { contents.push({ role: 'user', parts: [{ text: 'Use the tools; call finish when done.' }] }); continue; }
      const out = new Array(fcs.length);
      const note = (i, t, v) => { out[i] = v; debug.toolCalls.push({ turn: debug.turns, name: fcs[i].name, ms: Date.now() - t, ok: !v?.error, args: fcs[i].name === 'add_primitive' ? `${fcs[i].args?.componentId}/${fcs[i].args?.evalMode ?? '-'}` : undefined, note: v?.error?.slice?.(0, 160) }); };
      // inspections and removals first, then all generations in parallel, then finish
      fcs.forEach((f, i) => {
        if (f.name !== 'inspect_primitives') return;
        const t = Date.now();
        note(i, t, { primitives: (f.args?.ids ?? []).slice(0, 5).map(id => { const d = getComponentById(id); return d ? { id, description: d.description, evalModes: (d.evalModes ?? []).map(m => ({ evalMode: m.evalMode, label: m.label, beta: m.beta, description: m.description })) } : { id, error: 'not in catalog' }; }) });
      });
      fcs.map((f, i) => ({ f, i })).filter(x => x.f.name === 'remove_primitive').sort((a, b) => b.f.args.index - a.f.args.index).forEach(({ f, i }) => {
        const t = Date.now();
        if (!entries[f.args.index]) note(i, t, { error: `no primitive at ${f.args.index}` });
        else { entries.splice(f.args.index, 1); note(i, t, { ok: true, count: entries.length }); }
      });
      await Promise.all(fcs.map(async (f, i) => {
        if (f.name !== 'add_primitive') return;
        const t = Date.now();
        const a = f.args ?? {};
        const def = getComponentById(a.componentId);
        if (!def || NOT_FOR_AGENT.has(a.componentId)) return note(i, t, { error: `"${a.componentId}" is not a teaching primitive in the catalog` });
        const modes = modesOf(a.componentId);
        const ev = a.evalMode && a.evalMode !== 'mixed' ? String(a.evalMode).split('|') : [];
        if (ev.some(m => !modes.includes(m))) return note(i, t, { error: `eval mode "${a.evalMode}" is not one of ${a.componentId}'s: ${modes.join(', ') || 'none'}` });
        const target = whole ? mine.find(o => o.id === a.objectiveId) : mine[0];
        if (!target) return note(i, t, { error: `objectiveId must be one of ${mine.map(o => o.id).join(', ')}` });
        const instanceId = `${target.id}-${a.componentId}-${++n}`;
        const config = {
          ...(a.evalMode && modes.length ? { targetEvalMode: a.evalMode } : {}),
          ...(a.difficulty ? { difficulty: a.difficulty } : {}),
          objectiveId: target.id, objectiveText: target.text, objectiveVerb: target.verb,
        };
        trace(`${objective.id} gen ${a.componentId}/${a.evalMode ?? '-'}`);
        const job = withTimeout(generateComponentContent({ componentId: a.componentId, instanceId, title: a.title, intent: a.intent, config }, c.topic, c.gradeLevel), GEN_TIMEOUT_MS, a.componentId)
          .then((r) => {
            const data = r && typeof r === 'object' && 'data' in r ? r.data : r;
            if (!data) return { error: 'generator returned nothing; try another intent or primitive' };
            trace(`${objective.id} gen ok ${a.componentId} ${((Date.now() - t) / 1000).toFixed(0)}s`);
            entries.push({ objectiveId: target.id, component: { componentId: a.componentId, instanceId, title: a.title, intent: a.intent, config: { ...(config.targetEvalMode ? { targetEvalMode: config.targetEvalMode } : {}), ...(config.difficulty ? { difficulty: config.difficulty } : {}) } }, data, at: Date.now() - t0 });
            onFirst?.(Date.now() - t0, target.id);
            return { ok: true, index: entries.length - 1, generatedPreview: preview(data) };
          })
          .catch((e) => ({ error: `generator failed: ${String(e?.message ?? e).slice(0, 300)}` }));
        let late = false;
        pending.add(job);
        job.then((v) => { pending.delete(job); if (late && v.error) debug.lateFailures.push(`${a.componentId}: ${v.error}`); });
        let timer;
        const v = await Promise.race([job, new Promise((r) => { timer = setTimeout(() => r(null), TURN_WAIT_MS); })]);
        clearTimeout(timer);
        late = !v;
        note(i, t, v ?? { ok: true, pending: true, note: 'Still generating; it joins the sequence when it lands. Do not add it again.' });
      }));
      fcs.forEach((f, i) => {
        if (f.name !== 'finish') return;
        const t = Date.now();
        if (!entries.length && !pending.size) return note(i, t, { error: 'add at least one primitive first' });
        debug.rationale = f.args?.rationale ?? '';
        finished = true;
        note(i, t, { ok: true });
      });
      const left = SOFT_MS - (Date.now() - started);
      if (left <= 0 && debug.deadline === 'none') debug.deadline = 'soft';
      contents.push({
        role: 'user',
        parts: [
          ...fcs.map((f, i) => ({ functionResponse: { id: f.id, name: f.name, response: { output: out[i] ?? { error: 'not executed' } } } })),
          ...(finished ? [] : [{ text: JSON.stringify({ sequence: entries.map((e, k) => `${k}. ${e.objectiveId} ${e.component.componentId}/${e.component.config.targetEvalMode ?? '-'}: ${e.component.title}`), time: left > 0 ? `${Math.round(left / 1000)}s left` : 'Time is up: call finish now.' }) }]),
        ],
      });
    }
    if (pending.size) { trace(`${objective.id} waiting on ${pending.size} generation(s)`); await Promise.all([...pending]); }
    if (!finished) debug.deadline = Date.now() - started >= HARD_MS ? 'hard' : debug.deadline === 'none' ? 'turns' : debug.deadline;
    return { objective, mine, entries, debug, ms: Date.now() - started };
  }

  async function agentArm(c, brief, single) {
    const t0 = Date.now();
    let firstMs = null;
    const objectives = brief.objectives ?? [];
    const onFirst = (ms, objectiveId) => { if (objectiveId === objectives[0]?.id) firstMs ??= ms; };
    const runs = single
      ? [await runObjectiveAgent(c, objectives, objectives, t0, onFirst)]
      : await Promise.all(objectives.map((o) => runObjectiveAgent(c, [o], objectives, t0, onFirst)));
    const all = runs.flatMap(r => r.entries);
    const manifest = {
      topic: c.topic,
      gradeLevel: c.gradeLevel,
      themeColor: '#6366f1',
      curatorBrief: { instanceId: 'curator-brief', title: brief.hook?.title ?? c.topic, intent: `Introduce ${c.topic}` },
      objectiveBlocks: objectives.map(o => ({ objectiveId: o.id, objectiveText: o.text, objectiveVerb: o.verb, components: all.filter(e => e.objectiveId === o.id).map(e => e.component) })),
    };
    manifest.layout = flattenManifestToLayout(manifest, objectives);
    return {
      manifest,
      components: all.map(e => ({ instanceId: e.component.instanceId, componentId: e.component.componentId, data: e.data })),
      metrics: {
        firstMs,
        totalMs: Date.now() - t0,
        perObjective: runs.map(r => ({ objectiveId: r.objective.id, seconds: +(r.ms / 1000).toFixed(1), turns: r.debug.turns, deadline: r.debug.deadline, rationale: r.debug.rationale, toolCalls: r.debug.toolCalls })),
        failed: runs.flatMap(r => [...r.debug.toolCalls.filter(x => x.name === 'add_primitive' && !x.ok).map(x => `${x.args}: ${x.note}`), ...r.debug.lateFailures]),
        replaced: runs.reduce((s, r) => s + r.debug.toolCalls.filter(x => x.name === 'remove_primitive' && x.ok).length, 0),
        picks: objectives.flatMap(o => all.filter(e => e.objectiveId === o.id).map(e => ({ objectiveId: o.id, componentId: e.component.componentId, evalMode: e.component.config.targetEvalMode ?? null, intent: e.component.intent }))),
      },
    };
  }

  // ── Run ──
  const summary = [];
  for (const id of selected) {
    const c = CASES[id];
    if (!c) { say(`unknown case ${id}`); continue; }
    say(`\n== ${id}: ${c.topic} (${c.gradeLevel})`);
    const tb = Date.now();
    const brief = await scope.run({ case: id, arm: 'brief' }, () => withSpendSource('harness', 'objective-agent-bench', () => generateIntroBriefing(c.topic, c.gradeLevel)));
    const briefMs = Date.now() - tb;
    say(`brief ${(briefMs / 1000).toFixed(1)}s, ${brief.objectives?.length ?? 0} objectives`);
    const results = await Promise.all(arms.map(arm => scope.run({ case: id, arm }, () => withSpendSource('harness', `objective-agent-bench:${arm}`, async () => {
      try { return { arm, ...(arm === 'agent' ? await agentArm(c, brief, false) : arm === 'single' ? await agentArm(c, brief, true) : await manifestArm(c, brief)) }; } catch (e) { return { arm, error: String(e?.stack ?? e) }; }
    }))));
    for (const r of results) {
      const usd = calls.filter(x => x.case === id && x.arm === r.arm).reduce((s, x) => s + x.usd, 0);
      if (r.error) { summary.push({ case: id, arm: r.arm, error: r.error.slice(0, 400) }); say(`${r.arm}: ERROR ${r.error.slice(0, 200)}`); continue; }
      const pkg = buildLessonPackage({
        manifest: r.manifest, curatorBrief: brief, components: r.components, source: `objective-agent-bench:${r.arm}`,
        generationRequest: { topic: c.topic, gradeLevel: c.gradeLevel, arm: r.arm, objectives: brief.objectives, curatorBrief: brief },
      });
      const file = `${outName}-${id}-${r.arm}.json`;
      if (!pkg.error) writeFileSync(resolve(pkgDir, file), JSON.stringify(pkg, null, 2));
      const m = r.metrics;
      const row = {
        case: id, arm: r.arm,
        firstSec: m.firstMs != null ? +((briefMs + m.firstMs) / 1000).toFixed(1) : null,
        totalSec: +((briefMs + m.totalMs) / 1000).toFixed(1),
        usd: +usd.toFixed(4),
        primitives: m.picks.length,
        distinctPrimitives: new Set(m.picks.map(p => p.componentId)).size,
        distinctModes: new Set(m.picks.map(p => `${p.componentId}/${p.evalMode ?? '-'}`)).size,
        failedGenerations: m.failed.length,
        replaced: m.replaced ?? null,
        sequence: m.picks.map(p => `${p.objectiveId}:${p.componentId}/${p.evalMode ?? '-'}`).join(' > '),
        package: pkg.error ? `NOT SAVED: ${pkg.error}` : `qa/objective-agent-bench/packages/${file}`,
      };
      summary.push({ ...row, metrics: m });
      if (!pkg.error) {
        appendFileSync(resolve(outDir, 'library.jsonl'), JSON.stringify({
          packageId: pkg.id, file: row.package, arm: r.arm, savedAt: new Date().toISOString(),
          topic: c.topic, gradeLevel: c.gradeLevel,
          objectives: (brief.objectives ?? []).map(o => ({ id: o.id, text: o.text, verb: o.verb })),
          primitives: m.picks,
        }) + '\n');
      }
      say(`${r.arm.padEnd(8)} first ${row.firstSec}s  total ${row.totalSec}s  $${row.usd}  ${row.primitives} prims (${row.distinctPrimitives} distinct)  failed ${row.failedGenerations}${row.replaced != null ? `  replaced ${row.replaced}` : ''}`);
      say(`         ${row.sequence}`);
    }
  }
  writeFileSync(resolve(outDir, `${outName}.json`), JSON.stringify({ arms, summary, calls, logs }, null, 2));
  say(`\nwrote qa/objective-agent-bench/${outName}.json; spend $${calls.reduce((s, x) => s + x.usd, 0).toFixed(3)}`);
} finally {
  await server.close();
}
