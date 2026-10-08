// Real production generation for bar-model `make_graph` (open build), K and Grade 1, then the code checks over what came
// back: live validation, the oracle, and a made graph that fits each ask passing the check while one that does not fails.
// Writes qa/open-build/bar-model-2026-10-07/generated-<grade>.json. No student data, no Live session.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

if (!process.env.GEMINI_API_KEY) {
  const m = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const root = process.cwd();
const out = resolve(root, 'qa/open-build/bar-model-2026-10-07');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateBarModel } = await loader.import('/src/components/lumina/service/math/gemini-bar-model.ts');
  const { validateBarModelData } = await loader.import('/src/components/lumina/components/live-activity/adapters/barModelLive.ts');
  const { barModelOracle } = await loader.import('/src/components/lumina/service/qa/oracles/bar-model.ts');
  const { makeGraphMiss } = await loader.import('/src/components/lumina/primitives/visual-primitives/math/barModelBuild.ts');
  const fits = (r, n) => Array.from({ length: n }, (_, i) => r.kind === 'most' ? (i === r.a ? 3 : 1) : r.kind === 'fewest' ? (i === r.a ? 1 : 3)
    : r.kind === 'same' ? (i === r.a || i === r.b ? 2 : 1) : i === r.a ? 1 + r.by : 1);
  for (const [grade, topic] of [['Kindergarten', 'Our class pets survey'], ['Grade 1', 'Fruit we ate at snack time']]) {
    const data = await generateBarModel({
      componentId: 'bar-model', instanceId: 'probe', topic, grade, gradeLevel: 'elementary', gradeContext: grade,
      intent: 'Make a graph that fits a comparison', objective: {}, scope: {}, targetEvalMode: 'make_graph',
      raw: { targetEvalMode: 'make_graph' },
    });
    const report = { grade, topic, title: data.title, challenges: data.challenges.map(c => {
      const bars = fits(c.graphRule, c.values.length);
      return { id: c.id, prompt: c.prompt, rows: c.values.map(v => `${v.emoji} ${v.label}=${v.value}`), rule: c.graphRule,
        fittingGraph: bars, fittingMiss: makeGraphMiss(c.graphRule, bars) ?? null,
        tieMiss: makeGraphMiss(c.graphRule, c.values.map(() => 2)) ?? null };
    }) };
    let valid = 'ok';
    try { validateBarModelData(data); } catch (e) { valid = String(e.message); }
    const oracle = barModelOracle.verify(data, { topic });
    writeFileSync(resolve(out, `generated-${grade === 'Kindergarten' ? 'k' : 'g1'}.json`), JSON.stringify({ report, valid, oracle, data }, null, 2));
    process.stdout.write(JSON.stringify({ report, valid, oracle }, null, 2) + '\n');
  }
} finally {
  await server.close();
}
