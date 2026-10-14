// Difficulty demo, part 2: math primitives given the same objective and config.difficulty
// easy / medium / hard. Prints every challenge's numbers so the change (or none) is visible.
//
//   node scripts/difficulty-demo-primitives.mjs --run [--n 3]
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) { console.log('Pass --run.'); process.exit(0); }
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
process.env.LUMINA_FIT_GATE = 'off';
const nArg = process.argv.indexOf('--n');
const N = nArg > 0 ? Number(process.argv[nArg + 1]) : 3;
const out = console.log.bind(console);
const logs = [];
for (const m of ['log', 'warn', 'error', 'info', 'debug']) console[m] = (...a) => logs.push(format(...a));

const OBJECTIVE = 'Add and subtract within 20, using numbers 11 to 20';
const CASES = [
  { componentId: 'number-line', mode: 'jump' },
  { componentId: 'addition-subtraction-scene', mode: 'solve_story' },
];
// The numeric fields of a challenge, compactly.
const NUMERIC = /^(start\w*|change\w*|result\w*|target\w*|value|values|jump\w*|operand\w*|answer|correctAnswer|unknownPosition|storyType|operation|hops?)$/;
const summarize = (c) => Object.fromEntries(Object.entries(c).filter(([k, v]) => NUMERIC.test(k) && v !== undefined && v !== null));

const root = process.cwd();
const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const rows = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  await loader.import('/src/components/lumina/service/registry/generators/index.ts').catch(() => null);
  const { generateComponentContent } = await loader.import('/src/components/lumina/service/geminiService.ts');
  for (const c of CASES) for (const difficulty of ['easy', 'medium', 'hard']) {
    await Promise.all(Array.from({ length: N }, async (_, run) => {
      const item = { componentId: c.componentId, instanceId: `${c.componentId}-${difficulty}-${run}`, title: OBJECTIVE,
        intent: OBJECTIVE, config: { intent: OBJECTIVE, objectiveText: OBJECTIVE, objectiveGrade: '1', targetEvalMode: c.mode, difficulty } };
      try {
        const res = await generateComponentContent(item, OBJECTIVE, 'elementary');
        const data = res?.data ?? res;
        const challenges = data?.challenges ?? data?.problems ?? [];
        rows.push({ ...c, difficulty, run, range: data?.range ?? data?.maxNumber ?? null,
          challenges: challenges.map((ch) => ({ type: ch.type ?? ch.challengeType, ...summarize(ch),
            text: String(ch.instruction ?? ch.story ?? ch.prompt ?? ch.question ?? '').slice(0, 110) })) });
      } catch (e) { rows.push({ ...c, difficulty, run, error: String(e).slice(0, 200) }); }
    }));
    out(`generated ${c.componentId} ${difficulty}`);
  }
} finally { await server.close(); }

const dir = resolve(root, 'qa/difficulty-demo/2026-10-13');
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'primitives.json'), JSON.stringify(rows, null, 2));
writeFileSync(resolve(dir, 'primitives-logs.txt'), logs.join('\n'));
for (const r of rows.sort((a, b) => a.componentId.localeCompare(b.componentId) || ['easy', 'medium', 'hard'].indexOf(a.difficulty) - ['easy', 'medium', 'hard'].indexOf(b.difficulty))) {
  out(`\n${r.componentId} ${r.difficulty} #${r.run}${r.error ? ` ERROR ${r.error}` : ''}`);
  for (const ch of r.challenges ?? []) out(`  ${JSON.stringify(ch)}`);
}
