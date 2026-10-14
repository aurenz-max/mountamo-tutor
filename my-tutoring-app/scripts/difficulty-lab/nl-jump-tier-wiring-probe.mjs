// Wiring probe: number-line `jump` through the real registry generator, with config.difficulty or
// config.difficulty as a lesson or Pulse sends it. Expect: a within-20 jump lesson gets code-picked
// jumps that get harder with the tier (crossing ten, subtraction, two steps); a lesson no item space
// fits (a 0-100 line) keeps the old path.
//
//   node scripts/difficulty-lab/nl-jump-tier-wiring-probe.mjs --run [--runs 2] [--mode plot|order|between] [--topic ...]
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

const modeArg = process.argv.indexOf('--mode');
const MODE = modeArg > 0 ? process.argv[modeArg + 1] : 'jump';
const topicArg = process.argv.indexOf('--topic');
const ONE_TOPIC = topicArg > 0 ? process.argv[topicArg + 1] : null;
const ALL_CASES = [
  ...['easy', 'medium', 'hard'].map((difficulty) => ({ topic: 'Numbers 11 to 20', difficulty })),
  ...['easy', 'hard'].map((difficulty) => ({ topic: 'Add and subtract within 20 by counting on and back', difficulty })),
  { topic: 'Add and subtract within 20 by counting on and back', difficulty: undefined },
  { topic: 'Add tens on a number line to 100', difficulty: 'hard' },
];
// Other modes: the three tiers on one topic (default "Numbers 0 to 20").
const CASES = MODE === 'jump' ? ALL_CASES
  : ['easy', 'medium', 'hard'].map((difficulty) => ({ topic: ONE_TOPIC ?? 'Numbers 0 to 20', difficulty }));

const root = process.cwd();
const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const land = (o) => (o.type === 'add' ? o.startValue + o.changeValue : o.startValue - o.changeValue);
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateComponentContent } = await loader.import('/src/components/lumina/service/geminiService.ts');
  for (const c of CASES) for (let run = 0; run < RUNS; run++) {
    const tag = `difficulty=${c.difficulty ?? '(none)'}`;
    const item = { componentId: 'number-line', instanceId: `nl-${run}`, title: c.topic, intent: c.topic,
      config: { intent: c.topic, targetEvalMode: MODE, objectiveGrade: '1',
        ...(c.difficulty ? { difficulty: c.difficulty } : {}) } };
    const start = logs.length;
    const res = await generateComponentContent(item, c.topic, 'Grade 1');
    const d = res?.data ?? {};
    const spaceLog = logs.slice(start).find((l) => l.includes('Item space'));
    out(`\n${c.topic} | ${tag} | run ${run + 1} | ${spaceLog ? 'item space' : 'own path'} | line ${d.range?.min}-${d.range?.max}`);
    if (spaceLog) out(`  ${spaceLog}`);
    if (MODE !== 'jump') {
      for (const ch of d.challenges ?? []) {
        const { id, title, description, hint, instruction, ...rest } = ch;
        out(`  ${JSON.stringify(rest).slice(0, 260)}\n    "${instruction ?? ''}"`);
      }
      continue;
    }
    for (const ch of d.challenges ?? []) {
      const ops = (ch.operations ?? []).map((o) => `${o.startValue}${o.type === 'add' ? '+' : '-'}${o.changeValue}=${land(o)}${o.showJumpArc ? '(arc)' : ''}`).join(' → ');
      const ok = (ch.operations ?? []).every((o, j, a) => j === 0 || o.startValue === land(a[j - 1]))
        && JSON.stringify(ch.targetValues) === JSON.stringify((ch.operations ?? []).map(land));
      out(`  ${ch.itemSpace ? `[β ${String(ch.itemSpace.beta).padStart(5)} ${ch.itemSpace.structure.padEnd(13)}] ` : '[                     ] '}${ops.padEnd(22)} ${ok ? '' : 'KEY MISMATCH '}"${ch.instruction}"`);
    }
  }
} finally { await server.close(); }
