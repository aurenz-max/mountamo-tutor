// Wiring probe: multiplication-explorer through the real registry generator, with config.difficulty as
// a lesson or Pulse sends it. Expect: a grade-3 facts lesson gets code-picked facts that get harder with
// the tier (anchors 2/5/10 at easy, both factors 6-9 at hard; missing_factor hides the item's slot);
// no tier, or a multi-digit objective no space fits, keeps selectFacts.
//
//   node scripts/difficulty-lab/mx-tier-wiring-probe.mjs --run [--runs 2] [--mode fluency|build|missing_factor]
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
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const RUNS = Number(arg('--runs', 2));
const MODE = arg('--mode', 'fluency');
const out = console.log.bind(console);
const logs = [];
for (const m of ['log', 'warn', 'error', 'info', 'debug']) console[m] = (...a) => logs.push(format(...a));

const TOPIC = 'Multiply within 100 using multiplication facts';
const CASES = [
  ...['easy', 'medium', 'hard'].map((difficulty) => ({ topic: TOPIC, difficulty })),
  { topic: TOPIC, difficulty: undefined },
  { topic: 'Multiply a two-digit number by a one-digit number', difficulty: 'hard' },
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
    const item = { componentId: 'multiplication-explorer', instanceId: `mx-${run}`, title: c.topic, intent: c.topic,
      config: { intent: c.topic, targetEvalMode: MODE, objectiveGrade: '3', ...(c.difficulty ? { difficulty: c.difficulty } : {}) } };
    const start = logs.length;
    const res = await generateComponentContent(item, c.topic, 'Grade 3');
    const d = res?.data ?? {};
    const spaceLog = logs.slice(start).find((l) => l.includes('Item space'));
    out(`\n${c.topic} | ${MODE} | difficulty=${c.difficulty ?? '(none)'} | run ${run + 1} | ${spaceLog && !spaceLog.includes('own path') ? 'item space' : 'own path'}`);
    if (spaceLog) out(`  ${spaceLog}`);
    for (const ch of d.challenges ?? []) {
      const f = ch.fact ?? {};
      const p = f.factor1 * f.factor2;
      const ans = ch.hiddenValue === 'factor1' ? f.factor1 : ch.hiddenValue === 'factor2' ? f.factor2 : p;
      const leak = new RegExp(`(?<![0-9])${ans}(?![0-9])`).test(`${ch.instruction} ${ch.hint}`)
        && !(ch.hiddenValue !== 'product' && (ans === f.factor1 && ans === f.factor2));
      out(`  ${ch.itemSpace ? `[β ${String(ch.itemSpace.beta).padStart(5)} ${ch.itemSpace.structure.padEnd(17)}] ` : '[                         ] '}`
        + `${ch.targetFact.padEnd(12)} hide ${String(ch.hiddenValue).padEnd(7)} ans ${String(ans).padStart(3)} ${leak ? 'NAMES ANSWER ' : ''}"${ch.instruction}"`);
    }
  }
} finally { await server.close(); }
