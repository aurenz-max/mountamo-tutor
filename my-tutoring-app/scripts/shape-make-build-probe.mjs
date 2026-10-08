// Real production generation of shape-builder make_shape (open build), then the shape-builder oracle (its own search
// for passing shapes under the board's judge) and the live adapter over every session. With --payload it also writes
// the first pinned 3-5 session as the w1 sweep payload.
// Usage (from my-tutoring-app): node scripts/shape-make-build-probe.mjs --run [--env <path to .env.local>] [--payload]
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate make_shape sessions (K-2 and 3-5, pinned, by intent, and mixed).');
  process.exit(0);
}
const envArg = process.argv.indexOf('--env');
const envFile = envArg > 0 ? process.argv[envArg + 1] : '.env.local';
if (!process.env.GEMINI_API_KEY && existsSync(envFile)) {
  const match = readFileSync(envFile, 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const clean = (value) => String(value).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(clean(format(...args)));
const root = process.cwd();
const out = resolve(root, 'qa/open-build/shape-builder-2026-10-07');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateShapeBuilder } = await loader.import('/src/components/lumina/service/math/gemini-shape-builder.ts');
  const { validateShapeBuilderData } = await loader.import('/src/components/lumina/components/live-activity/adapters/shapeBuilderLive.ts');
  const { shapeBuilderOracle } = await loader.import('/src/components/lumina/service/qa/oracles/shape-builder.ts');
  const cases = [
    ['pinned-3-5', 'make_shape', '4', 'Classifying quadrilaterals by their properties', 'Draw quadrilaterals with given angle and side properties', 'medium'],
    ['pinned-K-2', 'make_shape', '1', 'Shapes and their sides', 'Build shapes with a given number of sides and corners', 'easy'],
    ['pinned-K', 'make_shape', 'K', 'Flat shapes', 'Make shapes with sides and corners', undefined],
    ['pinned-3-5-hard', 'make_shape', '4', 'Lines of symmetry and parallel sides', 'Draw two-dimensional figures with given properties', 'hard'],
    // Unpinned: the open build is reached by a pin or by intent; a mixed session keeps code-owned asks for any it has.
    ['mixed-3-5', undefined, '3', 'Geometry with shapes', 'Explore shapes on a dot grid', undefined],
  ];
  const summary = [];
  let payload = null;
  for (const [name, targetEvalMode, grade, topic, intent, difficulty] of cases) {
    const data = await generateShapeBuilder({ componentId: 'shape-builder', instanceId: `make-${name}`, topic, grade,
      gradeLevel: 'elementary', gradeContext: grade === 'K' ? 'Kindergarten' : `Grade ${grade}`, intent, objective: { text: intent },
      scope: {}, targetEvalMode, raw: { targetEvalMode, difficulty } });
    const issues = [];
    try { validateShapeBuilderData(data); } catch (e) { issues.push(`live adapter rejects the data: ${e.message}`); }
    const types = [...new Set(data.challenges.map(c => c.type))];
    if (targetEvalMode && (types.length !== 1 || types[0] !== 'make_shape')) issues.push(`routing: types ${types.join(',')}`);
    for (const c of data.challenges.filter(c => c.type === 'make_shape')) {
      if (c.showTargetGhost || c.showSideCountBadge) issues.push(`${c.id}: a tier scaffold on the open build`);
    }
    if (grade === 'K' && data.challenges.some(c => c.type === 'make_shape' && Object.values(c.targetProperties ?? {}).filter(v => v != null).length > 1)) {
      issues.push('Kindergarten ask carries more than the number of sides');
    }
    const oracle = shapeBuilderOracle.verify(data, { componentId: 'shape-builder', topic, gradeLevel: `Grade ${grade}`, grade, intent,
      evalMode: targetEvalMode ?? 'mixed' });
    if (oracle.violations.length) issues.push(...oracle.violations.map(v => `oracle ${v.check} ${v.where}: ${v.detail}`));
    writeFileSync(resolve(out, `${name}.json`), clean(JSON.stringify({ generatedAt: new Date().toISOString(),
      case: { targetEvalMode, grade, topic, intent, difficulty }, data, oracle, issues,
      logs: logs.splice(0).filter(l => /ShapeBuilder|EvalMode|eval mode/i.test(l)) }, null, 2)) + '\n');
    const line = { name, gradeBand: data.gradeBand, count: data.challenges.length, types,
      asks: data.challenges.filter(c => c.type === 'make_shape').map(c => c.instruction), oracleChecked: oracle.checkedChallenges, issues };
    summary.push(line);
    process.stdout.write(JSON.stringify(line) + '\n');
    if (issues.length) process.exitCode = 1;
    if (name === 'pinned-3-5' && !issues.length) payload = data;
  }
  writeFileSync(resolve(out, 'generator-run.json'), JSON.stringify(summary, null, 2) + '\n');
  if (process.argv.includes('--payload') && payload) {
    const file = resolve(root, 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads/shape-builder.make_shape.json');
    writeFileSync(file, JSON.stringify({ source: 'qa/open-build/shape-builder-2026-10-07/pinned-3-5.json', primitiveId: 'shape-builder',
      evalMode: 'make_shape', data: payload }, null, 1) + '\n');
    process.stdout.write(`payload written: ${file}\n`);
  }
} finally {
  await server.close();
}
