// Runs the labelled syllable builds (real words, and non-words made from real syllables) through the production judge
// (`judgeWordBuild` with the exact request the surface sends: `letterJudgeRequest`, `only: 'real_word'`) in-process
// through vite's module runner, so no dev server is needed.
// Usage (from my-tutoring-app): node qa/open-build/syllable-clapper-2026-10-08/calibrate-syllables.mjs <tag> [<.env.local>]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

const envFile = process.argv[3] ?? '.env.local';
if (existsSync(envFile)) for (const key of ['GEMINI_API_KEY', 'TYPESAFE_API_KEY']) {
  const m = readFileSync(envFile, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (m && !process.env[key]) process.env[key] = m[1].trim().replace(/^["']|["']$/g, '');
}
const here = new URL('.', import.meta.url);
const cases = JSON.parse(readFileSync(new URL('./labelled.json', here), 'utf8'));
const root = process.cwd();
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { judgeWordBuild } = await loader.import('/src/components/lumina/service/build-layer/word-build-judge.ts');
  const { letterJudgeRequest } = await loader.import('/src/components/lumina/primitives/visual-primitives/literacy/letterBuild.ts');
  const PART = ['zero', 'one', 'two', 'three', 'four', 'five'];
  const rows = [];
  for (let i = 0; i < cases.length; i += 6) {
    rows.push(...await Promise.all(cases.slice(i, i + 6).map(async c => {
      const item = { id: 'x', kind: 'syllables', parts: c.cards.length, ask: `Make a word with ${PART[c.cards.length]} parts.`,
        bank: c.cards, examples: [], ways: 1 };
      const request = letterJudgeRequest(item, c.cards, 'K');
      try { return { ...c, request, verdict: await judgeWordBuild(request) }; } catch (e) { return { ...c, request, error: String(e) }; }
    })));
  }
  const got = r => (r.error ? 'error' : r.verdict.met ? 'pass' : r.verdict.miss);
  for (const r of rows) {
    process.stdout.write(`${r.expect.padEnd(11)} ${r.made.padEnd(11)} got=${got(r).padEnd(11)} rw=${r.verdict?.realWord?.toFixed(2)} (${r.verdict?.judge ?? r.error})\n`);
  }
  const ok = rows.filter(r => got(r) === r.expect).length;
  process.stdout.write(`${ok}/${rows.length} as labelled; false passes ${rows.filter(r => r.expect !== 'pass' && got(r) === 'pass').length}, `
    + `false rejects ${rows.filter(r => r.expect === 'pass' && got(r) !== 'pass').length}\n`);
  writeFileSync(new URL(`./calibration-${process.argv[2] ?? 'run'}.json`, here), JSON.stringify(rows, null, 2) + '\n');
} finally { await server.close(); }
