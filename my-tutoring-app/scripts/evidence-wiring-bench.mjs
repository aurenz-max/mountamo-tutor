// Does a primitive's generated content change when its objective carries an evidence spec? (USER 2026-11-14)
// The spec rides every generator's intent (`evidenceIntentBlock`, resolveGenerationContext). This bench replays saved
// generator inputs from the Primer bench lessons through the real generators in two arms:
//   base = the saved config, no spec        spec = the same config with `evidence` (or lessonObjectives[].evidence)
// A blind judge (gemini-flash-latest, never told the arm) reads each output against the spec and counts the items whose
// right answer IS the evidence. A code check counts leaks of the spec's words into the content.
// Usage: node scripts/evidence-wiring-bench.mjs [--cases=a,b] [--runs=2] [--out=name]
// Writes qa/evidence-spec/wiring-<out>.json and prints a table.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const arg = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;

const TRACES = 'qa/topic-traces/primer-bench-2026-11-13';
const trace = (f) => JSON.parse(readFileSync(`${TRACES}/${f}.json`, 'utf8'));
const inputOf = (f, componentId) => {
  const c = trace(f).components.find(x => x.componentId === componentId);
  if (!c) throw new Error(`${f}: no ${componentId}`);
  return structuredClone(c.generatorInput);
};

// Specs as the curator brief writes them (EVIDENCE_WRITING_RULES); the make-ten build spec is the brief's own (teach-freeform).
const SPECS = {
  'make-ten-explain': { act: 'explain', on: 'an addition like 8 + 5 shown on two ten-frames', credit: 'the child says that 8 needs 2 more to make ten, so the 5 is split into 2 and 3, and ten and 3 is 13', notCredit: 'the child counts all the counters from one, or reads 13 back from the screen' },
  'make-ten-build': { act: 'build', on: 'a ten-frame and counters', credit: 'the child places enough counters to fill the ten-frame and states how many empty spaces were filled', notCredit: 'the child counts all the counters one by one from one to ten' },
  'first-sound': { act: 'recognize', on: 'a spoken sound /s/, /a/, /t/ or /p/ and two or three pictures', credit: 'the child picks the picture whose name begins with the sound they heard', notCredit: 'the child picks by a printed letter on the picture, or a picture whose name only contains the sound later' },
  'letter-sound': { act: 'say', on: 'a printed letter s, a, t or p', credit: 'the child says the sound the letter makes (/s/, not "ess")', notCredit: 'the child names the letter instead of its sound' },
};

// Each case: a saved generator input and the spec for its objective.
const CASES = {
  'annotated-example': { file: 'explain-full', componentId: 'annotated-example', spec: 'make-ten-explain' },
  'ten-frame-explain': { file: 'explain-full', componentId: 'ten-frame', spec: 'make-ten-explain' },
  'ten-frame-build': { file: 'explain-full', componentId: 'ten-frame', spec: 'make-ten-build' },
  'di-spoken-practice': { file: 'explain-full', componentId: 'di-spoken-practice', spec: 'make-ten-explain' },
  'knowledge-check-g1': { file: 'explain-full', componentId: 'knowledge-check', spec: 'make-ten-explain', final: true },
  'phoneme-explorer': { file: 'k-letters-full', componentId: 'phoneme-explorer', spec: 'first-sound' },
  'letter-sound-link': { file: 'k-letters-full', componentId: 'letter-sound-link', spec: 'letter-sound' },
  'di-letter-sounds': { file: 'k-letters-full', componentId: 'di-letter-sounds', spec: 'letter-sound' },
  'knowledge-check-k': { file: 'k-letters-full', componentId: 'knowledge-check', spec: 'letter-sound', final: true },
};

// annotated-example is an agent author (~$0.17 and 160-560 s a run): name it with --cases to include it.
const selected = arg('cases', Object.keys(CASES).filter(c => c !== 'annotated-example').join(',')).split(',');
const RUNS = Number(arg('runs', '2'));
const outName = arg('out', new Date().toISOString().slice(0, 10));

const ACT_WORDS = {
  recognize: 'picks the right one from choices', arrange: 'sorts or orders given things', set: 'changes a given picture or model until it is right',
  build: 'makes it from pieces, starting from nothing', 'run-read': 'runs a test and reads what happened', say: 'says or writes the answer', explain: 'says why',
};
const specLines = (e) => `- What the child does: ${ACT_WORDS[e.act]}, on ${e.on}.\n- Credit only when: ${e.credit}.\n- Does not count: ${e.notCredit}.`;

const logs = [];
const write = (s) => process.stdout.write(s + '\n');
for (const m of ['log', 'warn', 'error', 'info', 'debug']) console[m] = (...a) => logs.push(format(...a));

const root = process.cwd();
const out = resolve(root, 'qa/evidence-spec');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null }, resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { ai } = await loader.import('/src/components/lumina/service/geminiClient.ts');
  const { priceCall, withSpendSource } = await loader.import('/src/components/lumina/service/spend/spendMeter.ts');
  const { generateComponentContent } = await loader.import('/src/components/lumina/service/geminiService.ts');
  const { getComponentById } = await loader.import('/src/components/lumina/service/manifest/catalog/index.ts');

  const { AsyncLocalStorage } = await import('node:async_hooks');
  const scope = new AsyncLocalStorage();
  const calls = [];
  const inner = ai.models.generateContent.bind(ai.models);
  ai.models.generateContent = async (params) => {
    if (/image/.test(params.model)) return { candidates: [{ content: { parts: [] } }] };
    const res = await inner(params);
    calls.push({ run: scope.getStore(), model: params.model, usd: priceCall(params.model, res?.usageMetadata) });
    return res;
  };

  const strip = (d) => d && JSON.parse(JSON.stringify(d, (key, v) => (/^(imageBase64|imageData|image|imageUrl|html|png|svg|audio|audioBase64)$/.test(key) ? undefined : v)));

  const generate = (j) => scope.run(j.key, () => withSpendSource('harness', `evidence-wiring:${j.c}`, async () => {
    const k = CASES[j.c];
    const input = inputOf(k.file, k.componentId);
    const item = { ...input.item, instanceId: `${input.item.instanceId}-${j.arm}-${j.run}` };
    if (j.arm === 'spec') {
      const evidence = SPECS[k.spec];
      item.config = k.final
        ? { ...item.config, lessonObjectives: (item.config.lessonObjectives ?? []).map(o => ({ ...o, evidence })) }
        : { ...item.config, evidence };
    }
    const started = Date.now();
    try {
      const res = await generateComponentContent(item, input.topic, input.gradeLevel);
      return { ...j, ok: true, seconds: (Date.now() - started) / 1000, data: strip(res?.data ?? res) };
    } catch (error) {
      return { ...j, ok: false, seconds: (Date.now() - started) / 1000, error: String(error?.message ?? error) };
    }
  }));

  const JUDGE_SCHEMA = {
    type: 'OBJECT',
    properties: {
      items: { type: 'INTEGER', description: 'student-facing items or tasks in the activity' },
      collects: { type: 'INTEGER', description: 'items where getting it right IS the credit condition' },
      weaker: { type: 'INTEGER', description: 'items a child could get right by doing what "does not count" says' },
      verdict: { type: 'STRING', enum: ['collects', 'partly', 'does_not'] },
      reason: { type: 'STRING', description: 'one sentence naming an item' },
    },
    required: ['items', 'collects', 'weaker', 'verdict', 'reason'],
  };
  const judge = (j, r) => scope.run(`judge:${j.key}`, () => withSpendSource('harness', 'evidence-wiring:judge', async () => {
    const k = CASES[j.c];
    const entry = getComponentById(k.componentId);
    const content = JSON.stringify(r.data).slice(0, 14000);
    const prompt = `You are checking one generated activity in a children's lesson against the evidence the lesson must collect.

THE ACTIVITY: "${k.componentId}" - ${String(entry?.description ?? '').slice(0, 400)}
THE EVIDENCE THE LESSON MUST COLLECT:
${specLines(SPECS[k.spec])}

Read the activity's content (JSON, the data the screen is built from). For each student-facing item, ask: when a child gets this item right on this screen, have they done what earns credit? Count it in "collects" only then. Count it in "weaker" when a child could get it right by doing what "does not count" says, or by picking/reading instead of doing the act. An item that teaches but asks nothing counts in neither. Judge the activity as built, not what it could be.

CONTENT:
${content}`;
    try {
      const res = await ai.models.generateContent({ model: 'gemini-flash-latest', contents: prompt, config: { responseMimeType: 'application/json', responseSchema: JUDGE_SCHEMA, temperature: 0 } });
      return JSON.parse(res.text);
    } catch (error) {
      return { error: String(error?.message ?? error) };
    }
  }));

  // Words from the spec that must never reach the child's screen: the marker, the field labels, the credit sentence.
  const leakOf = (j, r) => {
    const text = JSON.stringify(r.data ?? '').toLowerCase();
    const credit = SPECS[CASES[j.c].spec].credit.toLowerCase();
    return ['evidence this objective must collect', 'credit only when', 'does not count:', credit].filter(w => text.includes(w));
  };

  const jobs = selected.flatMap(c => ['base', 'spec'].flatMap(arm => Array.from({ length: RUNS }, (_, run) => ({ key: `${c}/${arm}/${run}`, c, arm, run }))));
  const results = [];
  // Three at a time: the generators share one key and one rate limit.
  for (let i = 0; i < jobs.length; i += 3) {
    const batch = await Promise.all(jobs.slice(i, i + 3).map(async j => {
      const r = await generate(j);
      if (!r.ok) return r;
      return { ...r, judge: await judge(j, r), leaks: leakOf(j, r) };
    }));
    results.push(...batch);
    for (const r of batch) write(`${r.key.padEnd(34)} ${r.ok ? `${r.judge?.collects ?? '?'}/${r.judge?.items ?? '?'} collect, ${r.judge?.weaker ?? '?'} weaker, ${r.judge?.verdict ?? r.judge?.error}${r.leaks?.length ? `  LEAK: ${r.leaks.join(' | ')}` : ''}` : `FAILED ${String(r.error).slice(0, 160)}`}`);
  }

  const usd = (prefix) => +calls.filter(c => String(c.run ?? '').includes(prefix)).reduce((s, c) => s + c.usd, 0).toFixed(4);
  const summary = selected.map(c => {
    const arm = (a) => {
      const rs = results.filter(r => r.c === c && r.arm === a && r.ok && !r.judge?.error);
      const sum = (f) => rs.reduce((s, r) => s + (Number(r.judge[f]) || 0), 0);
      return { runs: rs.length, items: sum('items'), collects: sum('collects'), weaker: sum('weaker'), verdicts: rs.map(r => r.judge.verdict), leaks: rs.filter(r => r.leaks.length).length };
    };
    return { case: c, componentId: CASES[c].componentId, specName: CASES[c].spec, base: arm('base'), spec: arm('spec') };
  });
  writeFileSync(resolve(out, `wiring-${outName}.json`), JSON.stringify({ specs: SPECS, cases: CASES, summary, results, calls, logs }, null, 2));

  write('\n| case | spec act | base collects/items (weaker) | spec collects/items (weaker) | spec verdicts | leaks |');
  write('|---|---|---|---|---|---|');
  for (const s of summary) write(`| ${s.case} | ${SPECS[s.specName].act} | ${s.base.collects}/${s.base.items} (${s.base.weaker}) | ${s.spec.collects}/${s.spec.items} (${s.spec.weaker}) | ${s.spec.verdicts.join(', ')} | ${s.spec.leaks} |`);
  write(`\nGenerators $${(calls.filter(c => !String(c.run).startsWith('judge:')).reduce((s, c) => s + c.usd, 0)).toFixed(2)}, judge $${usd('judge:').toFixed(2)}, ${calls.length} calls. Saved qa/evidence-spec/wiring-${outName}.json`);
} finally {
  await server.close();
}
