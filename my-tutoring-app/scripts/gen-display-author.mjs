// Author generated displays into the library (data/gen-display). Calls Gemini (metered).
// Usage:
//   node scripts/gen-display-author.mjs --idea="..." --topic="..." --grade="grade 8 student" [--interaction="..."]
//   node scripts/gen-display-author.mjs --requests[=N]   work through the first N lesson requests (requests.jsonl)
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const arg = (name) => process.argv.find(a => a === `--${name}` || a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const root = process.cwd();
let asks;
if (process.argv.some(a => a.startsWith('--requests'))) {
  const file = resolve(root, 'data/gen-display/requests.jsonl');
  const all = existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  asks = all.slice(0, Number(arg('requests') || 1)).map(r => ({ idea: r.idea, topic: r.topic, gradeLevel: r.gradeLevel, interaction: r.interaction }));
} else {
  asks = [{ idea: arg('idea'), topic: arg('topic'), gradeLevel: arg('grade') ?? 'grade 5 student', interaction: arg('interaction') }];
}
if (!asks.length || asks.some(a => !a.idea || !a.topic)) throw new Error('need --idea and --topic, or --requests');

const server = await vite.createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null }, resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
try {
  const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { withSpendSource } = await runner.import('/src/components/lumina/service/spend/spendMeter.ts');
  const { authorDisplay } = await runner.import('/src/components/lumina/service/gen-display/author.ts');
  const { closeHarness } = await runner.import('/src/components/lumina/service/gen-display/harness.ts');
  const out = resolve(root, 'qa/gen-display');
  mkdirSync(out, { recursive: true });
  for (const ask of asks) {
    const { template, log } = await withSpendSource('harness', 'gen-display:author', () => authorDisplay(ask));
    console.log(JSON.stringify({ idea: ask.idea, saved: template?.id ?? null, turns: log.turns, seconds: log.seconds }, null, 1));
    for (const a of log.attempts) console.log(`  turn ${a.turn} ${a.stage}: ${a.notes.join(' | ').slice(0, 400)}`);
    writeFileSync(resolve(out, `${new Date().toISOString().slice(0, 10)}-${(template?.id ?? 'failed-' + Date.now())}.json`), JSON.stringify({ ask, log, template }, null, 2));
  }
  await closeHarness();
} finally {
  await server.close();
}
