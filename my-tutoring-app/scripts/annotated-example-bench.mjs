// Wall-clock and per-call timing for one annotated-example generation per case.
// Usage: node scripts/annotated-example-bench.mjs [--pipeline=legacy|agent] [--cases=a,b] [--out=name]
// Writes qa/annotated-example-bench/<out>.json. Every call goes through the metered client.
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
const pipeline = arg('pipeline', 'legacy');
const outName = arg('out', `${pipeline}-${new Date().toISOString().slice(0, 10)}`);

const CASES = {
  'g1-nickels': { topic: 'Skip counting coins', gradeContext: 'Grade 1', grade: '1', intent: 'Worked example: count six nickels by fives to find the total of 30 cents.' },
  'g3-equal-groups': { topic: 'Multiplication as equal groups', gradeContext: 'Grade 3', grade: '3', intent: 'Show a word problem with equal groups solved by multiplying.' },
  'g7-two-step': { topic: 'Two-step linear equations from word problems', gradeContext: 'Grade 7', grade: '7' },
  'hs-area-between': { topic: 'Area between two curves', gradeContext: 'High school calculus', grade: '12' },
  // Geometry: the figure carries the givens, so the drawing has to match the math.
  'g3-composite-area': { topic: 'Area of a composite rectilinear shape', gradeContext: 'Grade 3', grade: '3', intent: 'Worked example: find the area of an L-shaped figure by splitting it into two rectangles and adding their areas.' },
  'g8-pythagoras': { topic: 'Pythagorean theorem', gradeContext: 'Grade 8', grade: '8', intent: 'Worked example: find the missing side of a right triangle using the Pythagorean theorem, with the triangle drawn and labeled.' },
};
const selected = arg('cases', Object.keys(CASES).join(',')).split(',');

const logs = [];
for (const m of ['log', 'warn', 'error', 'info', 'debug']) console[m] = (...a) => logs.push(format(...a));

const root = process.cwd();
const out = resolve(root, 'qa/annotated-example-bench');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null }, resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { ai } = await loader.import('/src/components/lumina/service/geminiClient.ts');
  const { priceCall, withSpendSource } = await loader.import('/src/components/lumina/service/spend/spendMeter.ts');
  const entry = pipeline === 'agent'
    ? (await loader.import('/src/components/lumina/service/annotated-example/agent/agent-annotated-example.ts')).generateAnnotatedExampleAgentic
    : (await loader.import('/src/components/lumina/service/annotated-example/gemini-annotated-example.ts')).generateAnnotatedExample;

  // Tag each call with the case that issued it via a per-case async context.
  const { AsyncLocalStorage } = await import('node:async_hooks');
  const caseScope = new AsyncLocalStorage();
  const calls = [];
  const inner = ai.models.generateContent.bind(ai.models);
  ai.models.generateContent = async (params) => {
    const started = Date.now();
    const text = typeof params.contents === 'string' ? params.contents : JSON.stringify(params.contents).slice(0, 400);
    const res = await inner(params);
    calls.push({ case: caseScope.getStore(), model: params.model, startMs: started, ms: Date.now() - started, usd: priceCall(params.model, res?.usageMetadata), head: text.replace(/\s+/g, ' ').slice(0, 90) });
    return res;
  };

  const t0 = Date.now();
  const results = await Promise.all(selected.map(id => caseScope.run(id, () => withSpendSource('harness', `ae-bench:${pipeline}`, async () => {
    const c = CASES[id];
    const started = Date.now();
    try {
      const data = await entry({ topic: c.topic, gradeContext: c.gradeContext, intent: c.intent, canonicalGrade: c.grade });
      return { id, ok: true, ms: Date.now() - started, data };
    } catch (error) {
      return { id, ok: false, ms: Date.now() - started, error: String(error?.message ?? error) };
    }
  }))));
  const wall = Date.now() - t0;

  const summary = results.map(r => {
    const mine = calls.filter(c => c.case === r.id);
    return {
      id: r.id, ok: r.ok, seconds: +(r.ms / 1000).toFixed(1), calls: mine.length,
      usd: +mine.reduce((s, c) => s + c.usd, 0).toFixed(4),
      steps: r.data?.steps?.length, stepTypes: r.data?.steps?.map(s => s.content.type).join(','),
      challenges: r.data?.solverDebug?.challenger?.assignments?.length,
      agentTurns: r.data?.agentDebug?.turns, error: r.error,
    };
  });
  writeFileSync(resolve(out, `${outName}.json`), JSON.stringify({ pipeline, wallSeconds: wall / 1000, summary, calls: calls.map(c => ({ ...c, startMs: c.startMs - t0 })), results, logs }, null, 2));
  process.stdout.write(JSON.stringify({ pipeline, wallSeconds: wall / 1000, summary }, null, 2) + '\n');
  for (const id of selected) {
    process.stdout.write(`\n${id} call timeline:\n`);
    for (const c of calls.filter(x => x.case === id)) process.stdout.write(`  +${((c.startMs - t0) / 1000).toFixed(1).padStart(5)}s ${(c.ms / 1000).toFixed(1).padStart(5)}s ${c.model.padEnd(24)} ${c.head.slice(0, 70)}\n`);
  }
} finally {
  await server.close();
}
