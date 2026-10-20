// Tiered analog-clock and coin-counter sessions through the real registry generator, each checked by the live
// adapter's validator and the content oracle. /add-item-space step 5 for the time and money spaces.
//   node scripts/difficulty-lab/time-money-oracle-probe.mjs --run [--runs 1]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

if (!process.argv.includes('--run')) { console.log('Pass --run.'); process.exit(0); }
if (!process.env.GEMINI_API_KEY) {
  const m = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
}
process.env.LUMINA_FIT_GATE = 'off';
const i = process.argv.indexOf('--runs');
const RUNS = i > 0 ? Number(process.argv[i + 1]) : 1;
const out = console.log.bind(console);
for (const m of ['log', 'warn', 'info', 'debug']) console[m] = () => {};
const CASES = [
  ...['read', 'set_time', 'match', 'elapsed'].map((mode) => ['analog-clock', mode, '2', 'Tell and write time to the nearest five minutes']),
  ...['count-like', 'count-mixed', 'compare', 'make-amount', 'show-amount', 'make-change']
    .map((mode) => ['coin-counter', mode, '2', 'Solve word problems involving dimes, nickels, pennies and quarters']),
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
  const { validateAnalogClockData } = await loader.import('/src/components/lumina/primitives/visual-primitives/math/analogClock.boss.ts');
  const { validateCoinCounterData } = await loader.import('/src/components/lumina/primitives/visual-primitives/math/coinCounter.boss.ts');
  const { analogClockOracle } = await loader.import('/src/components/lumina/service/qa/oracles/analog-clock.ts');
  const { coinCounterOracle } = await loader.import('/src/components/lumina/service/qa/oracles/coin-counter.ts');
  let bad = 0;
  for (const [component, mode, grade, topic] of CASES) for (const difficulty of ['easy', 'medium', 'hard']) for (let run = 0; run < RUNS; run++) {
    const item = { componentId: component, instanceId: `o-${run}`, title: topic, intent: topic,
      config: { intent: topic, targetEvalMode: mode, objectiveGrade: grade, difficulty } };
    let d = {};
    try { d = (await generateComponentContent(item, topic, `Grade ${grade}`))?.data ?? {}; } catch (e) { out(`ERROR ${component} ${mode} ${difficulty}: ${e.message}`); bad++; continue; }
    let valid = 'ok';
    try { (component === 'analog-clock' ? validateAnalogClockData : validateCoinCounterData)(d); } catch (e) { valid = `INVALID ${e.message}`; bad++; }
    const res = (component === 'analog-clock' ? analogClockOracle : coinCounterOracle).verify(d, { componentId: component, topic, intent: topic, evalMode: mode, gradeLevel: `Grade ${grade}`, grade });
    const fails = res.violations ?? [];
    if (fails.length) bad++;
    const spaced = (d.challenges ?? []).every((c) => c.itemSpace);
    out(`${component.padEnd(13)} ${mode.padEnd(12)} ${difficulty.padEnd(6)} ${spaced ? 'space' : 'OWN  '} validate ${valid}; oracle ${fails.length ? JSON.stringify(fails).slice(0, 300) : 'pass'}`);
  }
  out(`\n${bad} failing session(s)`);
} finally { await server.close(); }
