// Wiring probe: knowledge-check through the real registry generator, with config.difficulty as a
// lesson sends it. Expect: an add/subtract-within-20 objective gets code-picked problems that get
// harder with the tier; an objective no item space fits keeps the orchestrator path.
//
//   node scripts/difficulty-lab/kc-tier-wiring-probe.mjs --run [--runs 2]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) { console.log('Pass --run.'); process.exit(0); }
if (!process.env.GEMINI_API_KEY) {
  const m = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
}
process.env.LUMINA_FIT_GATE = 'off';
const runsArg = process.argv.indexOf('--runs');
const RUNS = runsArg > 0 ? Number(process.argv[runsArg + 1]) : 2;
const out = console.log.bind(console);
const logs = [];
for (const m of ['log', 'warn', 'error', 'info', 'debug']) console[m] = (...a) => logs.push(format(...a));

// --objective "<text>" --grade 3 probes another strand; --control "<text>" names an objective no space fits.
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const OBJECTIVE = arg('--objective', 'Add and subtract within 20');
const GRADE = arg('--grade', '1');
const CASES = [
  ...['easy', 'medium', 'hard'].map((difficulty) => ({ objective: OBJECTIVE, difficulty })),
  { objective: OBJECTIVE, difficulty: undefined },
  { objective: arg('--control', 'Tell and write time to the hour'), difficulty: 'hard' },
];

const root = process.cwd();
const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateComponentContent } = await loader.import('/src/components/lumina/service/geminiService.ts');
  for (const c of CASES) for (let run = 0; run < RUNS; run++) {
    const item = { componentId: 'knowledge-check', instanceId: `kc-${run}`, title: c.objective, intent: c.objective,
      config: { intent: c.objective, objectiveText: c.objective, objectiveGrade: GRADE, count: 5, ...(c.difficulty ? { difficulty: c.difficulty } : {}) } };
    const start = logs.length;
    const res = await generateComponentContent(item, c.objective, 'elementary');
    const problems = res?.data?.problems ?? [];
    const path = logs.slice(start).find((l) => l.includes('Item space')) ? 'item space' : 'orchestrator';
    out(`\n${c.objective} | difficulty=${c.difficulty ?? '(none)'} | run ${run + 1} | ${path}`);
    for (const p of problems) {
      const opts = (p.options ?? []).map((o) => `${o.text}${o.id === p.correctOptionId ? '*' : ''}${o.distance && o.distance !== 'key' ? `(${o.distance[0]})` : ''}`).join(' ');
      out(`  ${p.itemSpace ? `[β ${String(p.itemSpace.beta).padStart(5)} ${p.itemSpace.structure.padEnd(13)}] ` : `[${p.type} ${p.difficulty}] `}${(p.question ?? p.statement ?? '').replace(/\n/g, ' ')}  ${opts}`);
    }
    const fallbacks = logs.slice(start).filter((l) => l.includes('plain question used')).length;
    if (fallbacks) out(`  (${fallbacks} written question(s) missed the spec; plain question used)`);
  }
} finally { await server.close(); }
