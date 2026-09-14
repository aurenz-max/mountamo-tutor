// NT-13 retest: real number-tracer sequence generations through the registry, no observations.
// Expected before running: no window-call failure, every draw under 20 s, windows inside each topic's scope.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUT = resolve(ROOT, '../artifacts/learning-applicability/number-tracer', process.env.RUN ?? 'nt13-retest');
await mkdir(OUT, { recursive: true });
const nextEnv = await import('@next/env');
(nextEnv.loadEnvConfig ?? nextEnv.default.loadEnvConfig)(ROOT);
const vite = await import(pathToFileURL(join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
const server = await vite.createServer({ configFile: false, root: ROOT, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(ROOT, 'src'), 'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts') } } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const { normalizeGradeLevel } = await runner.import('/src/components/lumina/service/geminiService.ts');
const { getGenerator } = await runner.import('/src/components/lumina/service/registry/contentRegistry.ts');

const lines = [];
const log = console.log, warn = console.warn;
console.log = (...a) => { lines.push(a.join(' ')); };
console.warn = (...a) => { lines.push(a.join(' ')); };
const cases = [['K', 'Missing numbers to 10', 9], ['K', 'Counting within 5', 5], ['1', 'Missing numbers to 20', 20]];
const rows = [];
for (const [grade, topic, cap] of cases) {
  for (let draw = 0; draw < 10; draw++) {
    const from = lines.length, t0 = Date.now();
    const gradeContext = grade === 'K' ? 'Kindergarten' : 'Grade 1';
    let data = null, error = null;
    try {
      data = (await getGenerator('number-tracer')({ componentId: 'number-tracer', instanceId: `nt13-${grade}-${draw}`,
        config: { targetEvalMode: 'sequence', difficulty: 'medium', objectiveGrade: grade, objectiveSubject: 'MATHEMATICS' } }, topic, gradeContext, normalizeGradeLevel(gradeContext)))?.data;
    } catch (e) { error = String(e); }
    const mine = lines.slice(from);
    const values = (data?.challenges ?? []).flatMap(c => c.sequenceNumbers ?? []);
    const row = { grade, topic, draw, ms: Date.now() - t0, error, windowFailed: mine.some(l => l.includes('Sequence window generation failed')),
      window: mine.find(l => l.includes('Sequence window ['))?.match(/\[(\d+), (\d+)\]/)?.slice(1).map(Number) ?? null,
      maxValue: Math.max(...values), title: data?.title, answers: (data?.challenges ?? []).map(c => c.digit) };
    row.inScope = row.maxValue <= cap;
    rows.push(row); log(JSON.stringify(row));
  }
}
console.log = log; console.warn = warn;
const summary = { draws: rows.length, errors: rows.filter(r => r.error).length, windowFailures: rows.filter(r => r.windowFailed).length,
  over20s: rows.filter(r => r.ms > 20000).length, maxMs: Math.max(...rows.map(r => r.ms)), outOfScope: rows.filter(r => !r.inScope).length,
  duplicateAnswerDraws: rows.filter(r => new Set(r.answers).size < r.answers.length).length };
await writeFile(join(OUT, 'report.json'), JSON.stringify({ summary, rows }, null, 2));
log(JSON.stringify(summary));
await server.close();
