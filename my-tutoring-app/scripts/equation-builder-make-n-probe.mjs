// Real production generation of equation-builder make-n (open build), checked by the oracle and the live adapter.
// Pass --run. Writes qa/open-build/equation-builder-<date>/generations.json. Text model only; no Live session.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate make-n for three lessons.');
  process.exit(0);
}
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const log = console.log;
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(format(...args).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]'));
const root = process.cwd();
const out = resolve(root, 'qa/open-build/equation-builder-2026-10-07');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const LESSONS = [
  { grade: 'Grade 1', topic: 'Ways to make 10', intent: 'Make 10 in different ways with addition and subtraction' },
  { grade: 'Kindergarten', topic: 'Addition within 5', intent: 'Compose numbers within 5' },
  { grade: 'Grade 2', topic: 'Add and subtract within 20', intent: 'Write number sentences for a total', difficulty: 'easy' },
];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateEquationBuilder } = await loader.import('/src/components/lumina/service/math/gemini-equation-builder.ts');
  const { equationBuilderOracle } = await loader.import('/src/components/lumina/service/qa/oracles/equation-builder.ts');
  const { validateEquationBuilderData } = await loader.import('/src/components/lumina/components/live-activity/adapters/equationBuilderLive.ts');
  const ws = await loader.import('/src/components/lumina/primitives/visual-primitives/math/equationBuilderWorkspace.ts');
  const results = [];
  for (const lesson of LESSONS) {
    const data = await generateEquationBuilder({ componentId: 'equation-builder', instanceId: 'make-n', topic: lesson.topic,
      grade: lesson.grade, gradeLevel: 'elementary', gradeContext: lesson.grade,
      scope: { topic: lesson.topic, intent: lesson.intent }, raw: { targetEvalMode: 'make-n', intent: lesson.intent, difficulty: lesson.difficulty } });
    const oracle = equationBuilderOracle.verify(data, { componentId: 'equation-builder', evalMode: 'make-n', topic: lesson.topic, gradeLevel: lesson.grade });
    let adapter = 'ok';
    try { validateEquationBuilderData(data); } catch (e) { adapter = String(e.message ?? e); }
    // Each item: the reference ways pass the check, the total alone does not, and the published scene names no value.
    const items = data.challenges.map((c) => {
      const ways = ws.referenceWays(c) ?? [];
      const scene = ws.equationBuilderScene(c, { work: { slots: ways[0] ?? [], made: [] } }).facts;
      return { id: c.id, target: c.target, ways: c.ways, instruction: c.instruction, bank: c.availableTiles.join(' '),
        referencePasses: ways.length > 0 && ws.makeNMiss(c.target, ways[0]) === undefined,
        bareMiss: ws.makeNMiss(c.target, [String(c.target)]), scene };
    });
    results.push({ lesson, title: data.title, maxNumber: data.maxNumber, gradeBand: data.gradeBand, oracle: oracle.violations, adapter, items, data });
    log(`${lesson.grade} | ${lesson.topic}: ${items.map((i) => `${i.target}x${i.ways}`).join(', ')} | oracle ${oracle.violations.length} | adapter ${adapter}`);
  }
  writeFileSync(resolve(out, 'generations.json'), JSON.stringify({ results, logs: logs.filter((l) => l.includes('[EquationBuilder]')) }, null, 1));
} finally {
  await server.close();
}
