// Curriculum-fit generation probe: real Gemini generation from verbatim published requirement
// text. Input regime: topic = skill title, intent = skill title, objectiveText = verbatim
// subskill description, no eval-mode pin (the intent resolver picks the mode).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

const casesPath = process.argv[2];
if (!casesPath) { console.log('usage: node scripts/addition-fact-strategies-fit-probe.mjs <cases.json> [out.json]'); process.exit(0); }
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const out = console.log;
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(format(...args).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]'));
const cases = JSON.parse(readFileSync(casesPath, 'utf8'));
const root = process.cwd();
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const rows = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateAdditionFactStrategies } = await loader.import('/src/components/lumina/service/math/gemini-addition-fact-strategies.ts');
  for (const c of cases) for (let draw = 1; draw <= 2; draw++) {
    const start = logs.length;
    const data = await generateAdditionFactStrategies(c.skill, `Grade ${c.grade}`, { intent: c.skill, objectiveText: c.text });
    const row = { id: c.id, draw, strategy: data.strategy, title: data.title, facts: data.challenges.map((x) => `${x.a}+${x.b}=${x.sum}`),
      intro: data.introExample ?? null, route: logs.slice(start).filter((l) => /modes:|resolveEvalModes/.test(l)).join(' | ') };
    rows.push(row);
    out(`${c.id} #${draw} → ${row.strategy.padEnd(12)} [${row.facts.map((f) => f.split('=')[0]).join(' ')}]\n      ${row.route}`);
  }
} finally { await server.close(); }
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify({ regime: 'topic=skill title, intent=skill title, objectiveText=verbatim subskill, no pin', cases, rows }, null, 2));
