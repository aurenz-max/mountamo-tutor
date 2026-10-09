// Real production generation for polygon-area-builder's perimeter open build, build_perimeter (3.MD.D.8), checked by
// the content oracle and by the judge itself: single-mode routing, distinct even perimeters inside the scope, the
// instruction code-written and stating its own perimeter, two-shape items in the second half, levers on every item,
// and for every item two DIFFERENT shapes (rectangles) that the judge passes, plus one off by two that it names.
// Writes qa/open-build/polygon-area-builder-overnight/generation.json and, with --payloads, the sweep payload.
// No student data, no Live session (one flash-lite wrapper call and one scope call per case).
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate build_perimeter sessions (Grade 3, untiered and scoped).');
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
const out = resolve(root, 'qa/open-build/polygon-area-builder-overnight');
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
  const { buildPerimeterAsk, buildPerimeterLevers, buildPerimeterMiss } =
    await loader.import('/src/components/lumina/primitives/visual-primitives/math/polygonAreaBuild.ts');
  const { validatePolygonAreaData } = await loader.import('/src/components/lumina/components/live-activity/adapters/polygonAreaBuilderLive.ts');
  /** A rectangle `rows` tall with perimeter p, at the top-left. */
  const rect = (p, rows) => { const cols = p / 2 - rows; return Array.from({ length: rows * cols }, (_, i) => ({ c: i % cols, r: Math.floor(i / cols) })); };
  const cases = [
    ['g3', '3', undefined, 'Perimeter: make shapes with a given perimeter on a grid',
      'Make shapes with a given perimeter by shading unit squares; same perimeter, different shapes', null],
    ['g3-scoped', '3', 'hard', 'Perimeter of shapes up to 12 units',
      'Make two different shapes with the same perimeter, perimeters up to 12 units', 12],
    ['g3-plain', '3', undefined, 'Perimeter of polygons', undefined, null],
  ];
  for (const [name, grade, difficulty, topic, intent, scopeMax] of cases) {
    const mode = 'build_perimeter';
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
    const ps = ch.map(c => c.targetPerimeter);
    if (new Set(ps).size !== ps.length) issues.push(`repeated perimeter in ${JSON.stringify(ps)}`);
    const judged = [];
    for (const c of ch) {
      const p = c.targetPerimeter;
      if (c.instruction !== buildPerimeterAsk(p, c.shapesAsked)) issues.push(`instruction not code-written: "${c.instruction}"`);
      if (scopeMax && p > scopeMax) issues.push(`perimeter ${p} over the stated ${scopeMax}`);
      if (c.showGridOverlay || c.showDecompositionGuides || c.showRegionAreaLabel) issues.push(`aid on: ${c.id}`);
      if (!buildPerimeterLevers(c, []).length) issues.push(`no levers on ${c.id}`);
      // The judge on this item: two different shapes pass (the second against the first), one narrower is named.
      const firstRows = p / 2 - 1 > 10 ? 2 : 1;
      const first = rect(p, firstRows), second = rect(p, firstRows + 1), narrow = rect(p - 2, firstRows);
      const verdicts = { first: buildPerimeterMiss(p, first, null) ?? 'pass',
        second: buildPerimeterMiss(p, second, first) ?? 'pass', firstAgain: buildPerimeterMiss(p, first, first) ?? 'pass',
        narrow: buildPerimeterMiss(p, narrow, null) ?? 'pass' };
      judged.push({ id: c.id, p, ...verdicts });
      if (verdicts.first !== 'pass' || verdicts.second !== 'pass' || verdicts.firstAgain !== 'same_as_first'
        || verdicts.narrow === 'pass') issues.push(`judge on ${c.id} (${p}): ${JSON.stringify(verdicts)}`);
    }
    if (!ch.some(c => c.shapesAsked === 2)) issues.push(`no two-shape item: ${JSON.stringify(ch.map(c => c.shapesAsked))}`);
    if (data.gradeBand !== '3') issues.push(`gradeBand ${data.gradeBand}`);
    runs.push({ name, grade, mode, difficulty: difficulty ?? null, topic, intent: intent ?? null, issues, judged,
      oracle: { violations: oracle.violations.length, checked: oracle.checkedChallenges }, data });
    print(`${name}: ${ch.length} items, perimeters ${JSON.stringify(ch.map(c => `${c.targetPerimeter}x${c.shapesAsked}`))}, band ${data.gradeBand}, `
      + `oracle ${oracle.violations.length} violations / ${oracle.checkedChallenges} checked, ${issues.length ? issues.join('; ') : 'clean'}`);
    print(`  title: ${data.title}`);
    print(`  first: ${ch[0]?.instruction}`);
    print(`  judge: ${judged.map(j => `${j.p}: ${j.first}/${j.second}/${j.firstAgain}/${j.narrow}`).join(' | ')}`);
    if (process.argv.includes('--payloads') && name === 'g3') {
      writeFileSync(resolve(payloadDir, `polygon-area-builder.${mode}.json`), `${JSON.stringify({
        source: `qa/open-build/polygon-area-builder-overnight/generation.json#${name}`,
        primitiveId: 'polygon-area-builder', evalMode: mode, data }, null, 1)}\n`);
    }
  }
} finally {
  writeFileSync(resolve(out, 'generation.json'), JSON.stringify({ generatedAt: new Date().toISOString(), runs, logs }, null, 2));
  await server.close();
}
