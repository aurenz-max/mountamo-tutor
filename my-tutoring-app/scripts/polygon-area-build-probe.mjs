// Real production generation for polygon-area-builder's open build, build_area, checked by the content oracle and by
// code: single-mode routing, distinct whole-number areas inside the scope, the instruction code-written and stating
// its own area, two-shape items in the second half, levers on every item. Also one find_area_triangle_parallelogram
// session for the journey sweep. Writes qa/open-build/polygon-area-builder-<date>/generation.json and, with
// --payloads, the sweep payloads. No student data, no Live session.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate build_area sessions (Grade 3, untiered and scoped) and one triangle session.');
  process.exit(0);
}
for (const file of ['.env.local', '../../../../my-tutoring-app/.env.local']) {
  if (process.env.GEMINI_API_KEY) break;
  try {
    const match = readFileSync(resolve(process.cwd(), file), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
    if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
  } catch { /* try the next */ }
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const clean = (value) => String(value).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(clean(format(...args)));
const print = (...args) => process.stdout.write(`${format(...args)}\n`);

const root = process.cwd();
const date = new Date().toLocaleDateString('en-CA');
const out = resolve(root, `qa/open-build/polygon-area-builder-${date}`);
const payloadDir = resolve(root, 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const runs = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generatePolygonAreaBuilder } = await loader.import('/src/components/lumina/service/math/gemini-polygon-area-builder.ts');
  const { polygonAreaBuilderOracle } = await loader.import('/src/components/lumina/service/qa/oracles/polygon-area-builder.ts');
  const { buildAreaAsk, buildAreaLevers } = await loader.import('/src/components/lumina/primitives/visual-primitives/math/polygonAreaBuild.ts');
  const { validatePolygonAreaData } = await loader.import('/src/components/lumina/components/live-activity/adapters/polygonAreaBuilderLive.ts');
  const cases = [
    ['g3', '3', 'build_area', undefined, 'Area: make shapes with a given number of unit squares',
      'Make shapes with a given area by shading unit squares', null],
    ['g3-scoped', '3', 'build_area', 'hard', 'Area of shapes up to 12 square units',
      'Make two different shapes with the same area, areas up to 12 square units', 12],
    ['g3-plain', '3', 'build_area', undefined, 'Measuring area by counting unit squares', undefined, null],
    ['g6-triangle', '6', 'find_area_triangle_parallelogram', undefined, 'Area of triangles and parallelograms',
      'Find the area of triangles and parallelograms', null],
  ];
  for (const [name, grade, mode, difficulty, topic, intent, scopeMax] of cases) {
    const raw = { targetEvalMode: mode, ...(difficulty ? { difficulty } : {}) };
    const data = await generatePolygonAreaBuilder({ componentId: 'polygon-area-builder', instanceId: `pab-${name}`,
      topic, grade, gradeLevel: 'elementary', gradeContext: `Grade ${grade}`, intent,
      objective: {}, scope: { topic, ...(intent ? { intent } : {}) }, targetEvalMode: mode, raw });
    const ch = data.challenges ?? [];
    const issues = [];
    const types = [...new Set(ch.map(c => c.type))];
    if (types.length !== 1 || types[0] !== mode) issues.push(`routing: got ${JSON.stringify(types)}`);
    try { validatePolygonAreaData(data); } catch (e) { issues.push(`live adapter refuses: ${e.message}`); }
    const oracle = polygonAreaBuilderOracle.verify(data, { componentId: 'polygon-area-builder', evalMode: mode, topic,
      gradeLevel: `Grade ${grade}`, ...(scopeMax ? { scopeMax } : {}) });
    for (const v of oracle.violations) issues.push(`oracle ${v.check} ${v.where}: ${v.detail}`);
    if (oracle.uncheckedTypes.length) issues.push(`oracle unchecked: ${oracle.uncheckedTypes.join(', ')}`);
    if (mode === 'build_area') {
      const areas = ch.map(c => c.targetArea);
      if (new Set(areas).size !== areas.length) issues.push(`repeated area in ${JSON.stringify(areas)}`);
      for (const c of ch) {
        if (c.instruction !== buildAreaAsk(c.targetArea, c.shapesAsked)) issues.push(`instruction not code-written: "${c.instruction}"`);
        if (scopeMax && c.targetArea > scopeMax) issues.push(`area ${c.targetArea} over the stated ${scopeMax}`);
        if (c.showGridOverlay || c.showDecompositionGuides || c.showRegionAreaLabel) issues.push(`aid on: ${c.id}`);
        if (!buildAreaLevers(c, []).length) issues.push(`no levers on ${c.id}`);
      }
      const shapes = ch.map(c => c.shapesAsked);
      if (!shapes.includes(2)) issues.push(`no two-shape item: ${JSON.stringify(shapes)}`);
      if (data.gradeBand !== '3') issues.push(`gradeBand ${data.gradeBand}`);
    }
    runs.push({ name, grade, mode, difficulty: difficulty ?? null, topic, intent: intent ?? null, issues,
      oracle: { violations: oracle.violations.length, checked: oracle.checkedChallenges }, data });
    print(`${name}: ${ch.length} items, ${mode === 'build_area' ? `areas ${JSON.stringify(ch.map(c => `${c.targetArea}x${c.shapesAsked}`))}`
      : `areas ${JSON.stringify(ch.map(c => c.expectedArea))}`}, band ${data.gradeBand}, oracle ${oracle.violations.length} violations / ${oracle.checkedChallenges} checked, ${issues.length ? issues.join('; ') : 'clean'}`);
    print(`  title: ${data.title}`);
    print(`  first: ${ch[0]?.instruction}`);
    if (process.argv.includes('--payloads') && (name === 'g3' || name === 'g6-triangle')) {
      writeFileSync(resolve(payloadDir, `polygon-area-builder.${mode}.json`), `${JSON.stringify({
        source: `qa/open-build/polygon-area-builder-${date}/generation.json#${name}`,
        primitiveId: 'polygon-area-builder', evalMode: mode, data }, null, 1)}\n`);
    }
  }
} finally {
  writeFileSync(resolve(out, 'generation.json'), JSON.stringify({ generatedAt: new Date().toISOString(), runs, logs }, null, 2));
  await server.close();
}
