// Live Gemini routing checks: pinned modes are covered by probe-bar-model-explanations.mjs.
// node scripts/probe-bar-model-routing.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createServer, createServerModuleRunner } from 'vite';

const root = process.cwd();
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync(resolve(root, '.env.local'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const server = await createServer({
  configFile: false, root, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});

const cases = [
  { label: 'explanation intent', intent: 'Explain what a one-to-one graph shows in your own words using comparative language', expected: ['say_what_it_shows'] },
  { label: 'related surveys intent', intent: 'Compare two related data sets across morning and afternoon graphs and explain a similarity or difference aloud', expected: ['compare_two_graphs'] },
  { label: 'curated spoken blend', intent: 'Practice both explaining what one graph shows aloud and comparing two related graphs aloud', expected: ['say_what_it_shows', 'compare_two_graphs'] },
  { label: 'unpinned mixed', expected: ['read_one_to_one', 'most_least', 'build_one_to_one', 'say_what_it_shows', 'compare_two_graphs'] },
];
const evidence = [];
try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateBarModel } = await runner.import('/src/components/lumina/service/math/gemini-bar-model.ts');
  for (const c of cases) {
    const data = await generateBarModel({ topic: 'Kindergarten class surveys', gradeContext: 'Kindergarten', intent: c.intent, raw: { instanceCount: 6 } });
    const modes = [...new Set(data.challenges.map((ch) => ch.evalMode))];
    const passed = c.expected.length === modes.length && c.expected.every((m) => modes.includes(m));
    evidence.push({ ...c, modes, passed, data });
    console.log(`${passed ? 'PASS' : 'FAIL'} ${c.label}: ${modes.join(', ')}`);
  }
} finally { await server.close(); }
writeFileSync('qa/eval-reports/bar-model-routing-2026-09-09.json', JSON.stringify(evidence, null, 2));
process.exitCode = evidence.every((c) => c.passed) ? 0 : 1;
