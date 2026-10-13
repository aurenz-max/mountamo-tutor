// Real production generation of di-shapes `build_shape` (the open build: the tutor names a shape, the child makes it on
// dots), checked by the live adapter and the build's own judge on every item's witnesses. Pass --run. Writes
// qa/open-build/di-shapes-2026-10-11/generations.json and, with --payloads, the W1 payload. Text model only.
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate di-shapes build_shape lessons (add --payloads to save the W1 payload).');
  process.exit(0);
}
for (const envFile of ['.env.local', process.env.LUMINA_ENV_FILE].filter(Boolean)) {
  if (process.env.GEMINI_API_KEY || !existsSync(envFile)) continue;
  const match = readFileSync(envFile, 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key (set GEMINI_API_KEY or LUMINA_ENV_FILE)');
const log = console.log;
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(format(...args).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]'));
const root = process.cwd();
const out = resolve(root, 'qa/open-build/di-shapes-2026-10-11');
const payloadDir = resolve(root, 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const LESSONS = [
  { grade: 'Kindergarten', topic: 'Naming flat shapes: circle, square, triangle, rectangle', intent: 'Make shapes the tutor names' },
  { grade: 'Kindergarten', topic: 'Circles and ovals', intent: 'Build round shapes', difficulty: 'hard' },
  { grade: 'Grade 1', topic: 'Squares, rhombuses and trapezoids', intent: 'Build shapes from their defining attributes', difficulty: 'easy' },
  { grade: 'Grade 1', topic: 'Pentagons and hexagons', intent: 'Draw shapes with a given number of sides' },
];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateDiShapes } = await loader.import('/src/components/lumina/service/direct-instruction/gemini-di-shapes.ts');
  const { validateDiShapesData } = await loader.import('/src/components/lumina/components/live-activity/adapters/diShapesLive.ts');
  const b = await loader.import('/src/components/lumina/primitives/visual-primitives/direct-instruction/diShapesBuild.ts');
  const ws = await loader.import('/src/components/lumina/primitives/visual-primitives/direct-instruction/diShapesWorkspace.ts');
  const results = [];
  let saved = false;
  for (const lesson of LESSONS) {
    const data = await generateDiShapes(lesson.topic, lesson.grade, { targetEvalMode: 'build_shape', intent: lesson.intent,
      objectiveText: lesson.intent, difficulty: lesson.difficulty });
    let adapter = 'ok';
    try { validateDiShapesData(data); } catch (e) { adapter = String(e.message ?? e); }
    // Each item: buildable, both witnesses pass, the wrong build misses, and the ask/scene name no count.
    const items = data.challenges.map((c) => {
      const pass = (b.BUILD_WITNESSES[c.shape] ?? []).map((pts) => b.buildMissFor(c.shape, { points: pts, closed: true }) ?? null);
      const wrong = b.buildMissFor(c.shape, { points: c.shape === 'triangle' ? b.WRONG_BUILD.triangle : b.WRONG_BUILD.other, closed: true });
      const ask = ws.shapesAskFor(c);
      const scene = ws.shapesScene(c).facts;
      return { id: c.id, type: c.challengeType, shape: c.shape, tier: c.supportTier ?? null, rotationDeg: c.rotationDeg,
        buildable: b.isBuildable(c.shape), pass, wrong, ask, sceneHasCount: /\b(three|four|five|six)\b/i.test(JSON.stringify(scene)) };
    });
    const faults = items.flatMap((i) => [
      i.type !== 'build_shape' && `${i.id}: type ${i.type}`,
      !i.buildable && `${i.id}: ${i.shape} cannot be built`,
      i.pass.some((m) => m !== null) && `${i.id}: a witness misses`,
      !i.wrong && `${i.id}: the wrong build passes`,
      i.sceneHasCount && `${i.id}: scene names a count`,
    ].filter(Boolean));
    if (/\b(circle|oval|triangle|square|rectangle|hexagon|pentagon|rhombus|trapezoid|diamond)s?\b/i.test(`${data.title} ${data.description}`)) {
      faults.push('wrapper names a shape');
    }
    results.push({ lesson, title: data.title, description: data.description, adapter, faults, items, data });
    log(`${lesson.grade} | ${lesson.topic}${lesson.difficulty ? ` [${lesson.difficulty}]` : ''}: ${items.map((i) => i.shape).join(', ')} | adapter ${adapter} | faults ${faults.length ? faults.join('; ') : 0}`);
    if (process.argv.includes('--payloads') && !saved && adapter === 'ok' && faults.length === 0) {
      saved = true;
      writeFileSync(resolve(payloadDir, 'di-shapes.build_shape.json'), JSON.stringify({
        source: 'qa/open-build/di-shapes-2026-10-11/generations.json', primitiveId: 'di-shapes', evalMode: 'build_shape', data }, null, 1) + '\n');
    }
  }
  writeFileSync(resolve(out, 'generations.json'), JSON.stringify({ results, logs: logs.filter((l) => /DiShapes|DI Shapes|evalMode/i.test(l)) }, null, 1));
} finally {
  await server.close();
}
