// Wall-clock, cost and block sequence for one DeepDive generation per case.
// Usage: node scripts/deep-dive-bench.mjs [--pipeline=legacy|agent] [--cases=a,b] [--out=name] [--images=1]
// Image-model calls are stubbed (no image) unless --images=1. Writes qa/deep-dive-bench/<out>.json.
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
const pipeline = arg('pipeline', 'agent');
const images = arg('images', '0') === '1';
const outName = arg('out', `${pipeline}-${new Date().toISOString().slice(0, 10)}`);

const CASES = {
  'g2-leaves': { topic: 'Why leaves change color in fall', grade: '2', gradeContext: 'elementary', evalMode: undefined },
  'g4-railroad': { topic: 'The Underground Railroad', grade: '4', gradeContext: 'elementary', evalMode: 'recall' },
  'g5-weather-climate': { topic: 'Weather versus climate', grade: '5', gradeContext: 'elementary', evalMode: 'apply' },
  'g3-bees': { topic: 'How honeybees make honey', grade: '3', gradeContext: 'elementary', evalMode: 'analyze' },
  'k-float': { topic: 'Things that float and sink', grade: 'K', gradeContext: 'kindergarten', evalMode: 'explore' },
  'g6-integers': { topic: 'Negative numbers and absolute value', grade: '6', gradeContext: 'middle-school', evalMode: 'recall' },
  'g4-water-cycle': { topic: 'The water cycle', grade: '4', gradeContext: 'elementary', evalMode: 'recall' },
  'g5-bill-law': { topic: 'How a bill becomes a law', grade: '5', gradeContext: 'elementary', evalMode: 'recall' },
  'g7-equations': { topic: 'Solving two-step equations', grade: '7', gradeContext: 'middle-school', evalMode: 'apply' },
  'g4-flower': { topic: 'The parts of a flower and what each part does', grade: '4', gradeContext: 'elementary', evalMode: 'apply' },
  'g5-seasons': { topic: 'Why Earth has seasons', grade: '5', gradeContext: 'elementary', evalMode: 'recall' },
  'g2-time': { topic: 'Telling time to the half hour on a clock', grade: '2', gradeContext: 'elementary', evalMode: undefined },
  'g3-otters': { topic: 'Sea otters', grade: '3', gradeContext: 'elementary', evalMode: undefined },
  'g8-systems': { topic: 'Systems of linear equations', grade: '8', gradeContext: 'middle-school', evalMode: 'apply' },
  // DD-20: lessons whose topic is read off a chart or a timeline, to see whether the author chooses a point check.
  'g4-rainfall-graph': { topic: 'Reading a bar graph of monthly rainfall', grade: '4', gradeContext: 'elementary', evalMode: 'apply' },
  'g5-town-line-graph': { topic: 'Reading a line graph of how a town grew over 100 years', grade: '5', gradeContext: 'elementary', evalMode: 'apply' },
  'g5-revolution-timeline': { topic: 'Reading a timeline of the American Revolution', grade: '5', gradeContext: 'elementary', evalMode: 'recall' },
};
const selected = arg('cases', Object.keys(CASES).join(',')).split(',');

const logs = [];
for (const m of ['log', 'warn', 'error', 'info', 'debug']) console[m] = (...a) => logs.push(format(...a));

const root = process.cwd();
const out = resolve(root, 'qa/deep-dive-bench');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null }, resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { ai } = await loader.import('/src/components/lumina/service/geminiClient.ts');
  const { priceCall, withSpendSource } = await loader.import('/src/components/lumina/service/spend/spendMeter.ts');
  const { generateDeepDiveEntry } = await loader.import('/src/components/lumina/service/core/deep-dive-agent/generate-deep-dive.ts');
  const { isEvaluableBlock } = await loader.import('/src/components/lumina/primitives/visual-primitives/core/deep-dive/deepDiveWorkspace.ts');
  const { splitMath, mathIssues } = await loader.import('/src/components/lumina/utils/mathText.ts');
  const { visibleStrings } = await loader.import('/src/components/lumina/service/core/deep-dive-agent/blocks.ts');

  const { AsyncLocalStorage } = await import('node:async_hooks');
  const caseScope = new AsyncLocalStorage();
  const calls = [];
  const inner = ai.models.generateContent.bind(ai.models);
  ai.models.generateContent = async (params) => {
    if (!images && /image/.test(params.model)) return { candidates: [{ content: { parts: [] } }] };
    const started = Date.now();
    const res = await inner(params);
    calls.push({ case: caseScope.getStore(), model: params.model, ms: Date.now() - started, usd: priceCall(params.model, res?.usageMetadata) });
    return res;
  };

  const t0 = Date.now();
  const results = await Promise.all(selected.map(id => caseScope.run(id, () => withSpendSource('harness', `dd-bench:${pipeline}`, async () => {
    const c = CASES[id];
    const started = Date.now();
    const ctx = {
      componentId: 'deep-dive', instanceId: `bench-${id}`, topic: c.topic, gradeLevel: c.gradeContext, gradeContext: c.gradeContext, grade: c.grade,
      intent: `Generate a DeepDive exploration on "${c.topic}"`, objective: {}, scope: {}, targetEvalMode: c.evalMode,
      raw: { targetEvalMode: c.evalMode, pipeline },
    };
    try {
      return { id, ok: true, ms: Date.now() - started, data: await generateDeepDiveEntry(ctx), elapsed: Date.now() - started };
    } catch (error) {
      return { id, ok: false, ms: Date.now() - started, error: String(error?.message ?? error) };
    }
  }))));

  const summary = results.map(r => {
    const mine = calls.filter(c => c.case === r.id);
    const d = r.data;
    return {
      id: r.id, ok: r.ok, seconds: +((r.elapsed ?? r.ms) / 1000).toFixed(1), calls: mine.length,
      usd: +mine.reduce((s, c) => s + c.usd, 0).toFixed(4),
      author: d?.agentDebug ? 'agent' : 'legacy',
      shape: d?.agentDebug?.shape, from: d?.agentDebug?.shapeCandidates?.join('/'),
      turns: d?.agentDebug?.turns, layout: d?.layout,
      blocks: d?.blocks?.map(b => (b.blockType === 'drawer' ? b.drawerId : b.blockType === 'display' ? 'display:' + b.displayId : b.blockType)).join(' > '),
      kinds: d && new Set(d.blocks.map(b => (b.blockType === 'drawer' ? b.drawerId : b.blockType))).size,
      seeAlso: d?.seeAlso?.map(l => l.label),
      sections: d?.sections?.map(s => `${s.heading} (${d.blocks.filter(b => b.section === d.sections.indexOf(s)).length})`),
      evaluable: d?.blocks?.filter(isEvaluableBlock).length,
      advisories: d?.agentDebug?.advisories?.length, error: r.error,
      reviews: d?.agentDebug?.reviews, imagesStarted: d?.agentDebug?.imagesStarted, imagesDiscarded: d?.agentDebug?.imagesDiscarded, costByModel: d?.agentDebug?.cost?.byModel,
      // Typeset expressions in what the student reads, and any the page could not typeset.
      math: d && (() => { const strs = d.blocks.flatMap(b => (b.blockType === 'drawer' || b.blockType === 'display' ? [] : visibleStrings(b))); return { expressions: strs.flatMap(splitMath).filter(x => x.kind === 'math').length, issues: strs.flatMap(mathIssues) }; })(),
    };
  });
  writeFileSync(resolve(out, `${outName}.json`), JSON.stringify({ pipeline, wallSeconds: (Date.now() - t0) / 1000, summary, calls, results: results.map(r => ({ ...r, data: r.data && JSON.parse(JSON.stringify(r.data, (k, v) => (k === 'imageBase64' || k === 'html' ? undefined : v))) })), logs }, null, 2));
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
} finally {
  await server.close();
}
