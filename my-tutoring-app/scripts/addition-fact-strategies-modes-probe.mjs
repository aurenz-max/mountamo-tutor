// Real Gemini generation for every eval mode (pinned) plus intent-resolved cases.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate each eval mode and the intent cases with real Gemini.');
  process.exit(0);
}
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const out = console.log;
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(format(...args).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]'));
const root = process.cwd();
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const BANDS = ['facts_3_4', 'facts_5_6', 'facts_7_8', 'facts_mixed'];
const EXPECT = { plus_zero: ['plus_zero'], plus_one: ['plus_one'], doubles: ['doubles'], turnaround: ['turnaround'], plus_two: ['plus_two'], big_facts: BANDS };
const CASES = [
  ...Object.keys(EXPECT).map((m) => ({ label: `pin ${m}`, topic: 'Addition facts', config: { targetEvalMode: m }, expect: EXPECT[m] })),
  { label: 'pin big_facts, 7s/8s topic', topic: 'Addition facts with 7s and 8s', config: { targetEvalMode: 'big_facts' }, expect: ['facts_7_8'] },
  { label: 'intent doubles', topic: 'Doubles', config: { intent: 'Learn doubles facts like 6 + 6 by heart' }, expect: ['doubles'] },
  { label: 'intent commutative', topic: 'Order of addends', config: { intent: 'Use the commutative property: 3 + 8 and 8 + 3 have the same sum' }, expect: ['turnaround'] },
  { label: 'intent count on 2', topic: 'Counting on', config: { intent: 'Add 2 by counting on two from the bigger number' }, expect: ['plus_two'] },
  { label: 'intent fluency', topic: 'Addition within 20', config: { intent: 'Fluently add within 20 from memory' }, expect: ['facts_mixed', ...BANDS] },
];
const rows = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateAdditionFactStrategies, strategyPool } = await loader.import('/src/components/lumina/service/math/gemini-addition-fact-strategies.ts');
  for (const c of CASES) {
    const start = logs.length;
    const data = await generateAdditionFactStrategies(c.topic, 'Grade 1', c.config);
    const pool = new Set(strategyPool(data.strategy).map(([a, b]) => `${a}+${b}`));
    const offPool = data.challenges.filter((x) => !pool.has(`${x.a}+${x.b}`) && !pool.has(`${x.b}+${x.a}`));
    const ok = c.expect.includes(data.strategy) && offPool.length === 0;
    rows.push({ case: c.label, strategy: data.strategy, ok, title: data.title, facts: data.challenges.map((x) => `${x.a}+${x.b}`).join(' '),
      log: logs.slice(start).filter((l) => /modes:|resolveEvalModes/.test(l)).join(' | ') });
    out(`${ok ? 'PASS' : 'FAIL'}  ${c.label.padEnd(28)} → ${data.strategy.padEnd(12)} "${data.title}"  [${rows.at(-1).facts}]`);
    out(`      ${rows.at(-1).log}`);
  }
} finally {
  await server.close();
}
const dir = resolve(root, 'qa/eval-reports');
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'addition-fact-strategies-modes-probe-2026-10-03.json'), JSON.stringify(rows, null, 2));
out(`${rows.filter((r) => r.ok).length}/${rows.length} pass`);
