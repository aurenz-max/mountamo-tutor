// Wiring probe: addition-subtraction-scene `solve_story` through the real registry generator, with
// config.difficulty as a lesson or Pulse sends it. Expect: an add/subtract lesson gets code-picked
// stories that get harder with the tier (crossing ten, change then start unknown); no tier, or an
// objective no space fits, keeps the old path.
//
//   node scripts/difficulty-lab/scene-tier-wiring-probe.mjs --run [--runs 2]
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
const modeArg = process.argv.indexOf('--mode');
const MODE = modeArg > 0 ? process.argv[modeArg + 1] : 'solve_story';
const out = console.log.bind(console);
const logs = [];
for (const m of ['log', 'warn', 'error', 'info', 'debug']) console[m] = (...a) => logs.push(format(...a));

const CASES = [
  ...['easy', 'medium', 'hard'].map((difficulty) => ({ topic: 'Add and subtract within 20, using numbers 11 to 20', difficulty })),
  ...['easy', 'hard'].map((difficulty) => ({ topic: 'Add and subtract within 10 word problems', difficulty })),
  { topic: 'Add and subtract within 20, using numbers 11 to 20', difficulty: undefined },
  { topic: 'Count objects to tell how many', difficulty: 'hard' },
];

const root = process.cwd();
const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const hidden = (c) => (c.unknownPosition === 'change' ? c.changeCount : c.unknownPosition === 'start' ? c.startCount : c.resultCount);
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateComponentContent } = await loader.import('/src/components/lumina/service/geminiService.ts');
  for (const c of CASES) for (let run = 0; run < RUNS; run++) {
    const item = { componentId: 'addition-subtraction-scene', instanceId: `as-${run}`, title: c.topic, intent: c.topic,
      config: { intent: c.topic, targetEvalMode: MODE, objectiveGrade: '1', ...(c.difficulty ? { difficulty: c.difficulty } : {}) } };
    const start = logs.length;
    const res = await generateComponentContent(item, c.topic, 'Grade 1');
    const d = res?.data ?? {};
    const spaceLog = logs.slice(start).filter((l) => l.includes('Item space'));
    out(`\n${c.topic} | ${MODE} | difficulty=${c.difficulty ?? '(none)'} | run ${run + 1} | max ${d.maxNumber} | ${spaceLog.length > 1 ? 'item space' : 'own path'}`);
    for (const l of spaceLog) out(`  ${l}`);
    for (const ch of d.challenges ?? []) {
      const ok = ch.operation === 'addition' ? ch.startCount + ch.changeCount === ch.resultCount : ch.startCount - ch.changeCount === ch.resultCount;
      out(`  ${ch.itemSpace ? `[β ${String(ch.itemSpace.beta).padStart(5)} ${ch.itemSpace.structure.padEnd(12)}] ` : '[                    ] '}`
        + `${ch.type.padEnd(14)} ${ch.storyType ?? ''} ${ch.equation.padEnd(11)} ?=${String(ch.unknownPosition ?? 'result').padEnd(6)} ans ${String(hidden(ch)).padStart(2)} ${ok ? '' : 'KEY MISMATCH '}"${ch.storyText}"${ch.allowedTiles ? ` tiles=${ch.allowedTiles.join(",")}` : ""}`);
    }
  }
} finally { await server.close(); }
