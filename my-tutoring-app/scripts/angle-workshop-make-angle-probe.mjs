// Real production generation of angle-workshop (make_angle open build, plus one lesson per classic mode), checked by
// the oracle, the live adapter and the build's own check. Pass --run. Writes
// qa/open-build/angle-workshop-2026-10-07/generations.json and, with --payloads, the W1 payloads. Text model only.
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate angle-workshop lessons (add --payloads to save the W1 payloads).');
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
const out = resolve(root, 'qa/open-build/angle-workshop-2026-10-07');
const payloadDir = resolve(root, 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const LESSONS = [
  { mode: 'make_angle', grade: '4', topic: 'Acute, right, obtuse and straight angles', intent: 'Classify angles by size compared with a right angle' },
  { mode: 'make_angle', grade: '4', topic: 'Obtuse angles', intent: 'Make an obtuse angle', difficulty: 'easy' },
  { mode: 'make_angle', grade: '5', topic: 'Angles of a given size', intent: 'Draw an angle between two given measures' },
  { mode: 'measure', grade: '7', topic: 'Measuring angles with a protractor', intent: 'Read an angle from a protractor' },
  { mode: 'classify_pairs', grade: '7', topic: 'Angle pairs', intent: 'Name complementary, supplementary, vertical and adjacent angles' },
  { mode: 'solve_unknown', grade: '7', topic: 'Unknown angles', intent: 'Find a missing angle from a relationship' },
  { mode: 'solve_algebraic', grade: '7', topic: 'Angle equations', intent: 'Write and solve an equation for an unknown angle' },
  { mode: 'transversal', grade: '8', topic: 'Parallel lines and transversals', intent: 'Find angles formed by a transversal' },
];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateAngleWorkshop } = await loader.import('/src/components/lumina/service/math/gemini-angle-workshop.ts');
  const { angleWorkshopOracle } = await loader.import('/src/components/lumina/service/qa/oracles/angle-workshop.ts');
  const { validateAngleWorkshopData } = await loader.import('/src/components/lumina/components/live-activity/adapters/angleWorkshopLive.ts');
  const ws = await loader.import('/src/components/lumina/primitives/visual-primitives/math/angleWorkshopWorkspace.ts');
  const results = [];
  const saved = new Set();
  for (const lesson of LESSONS) {
    const data = await generateAngleWorkshop({ componentId: 'angle-workshop', instanceId: lesson.mode, topic: lesson.topic,
      grade: lesson.grade, gradeLevel: 'elementary', gradeContext: `Grade ${lesson.grade}`, intent: lesson.intent,
      scope: { topic: lesson.topic, intent: lesson.intent }, raw: { targetEvalMode: lesson.mode, intent: lesson.intent, difficulty: lesson.difficulty } });
    const oracle = angleWorkshopOracle.verify(data, { componentId: 'angle-workshop', evalMode: lesson.mode, topic: lesson.topic, gradeLevel: `grade ${lesson.grade}` });
    let adapter = 'ok';
    try { validateAngleWorkshopData(data); } catch (e) { adapter = String(e.message ?? e); }
    // make_angle: the reference opening passes, the harness's wrong opening misses, and the scene carries no kind word.
    const items = data.challenges.map((c) => c.type !== 'make_angle' ? { id: c.id, type: c.type, expectedAnswer: c.expectedAnswer } : {
      id: c.id, targetKind: c.targetKind, range: c.targetKind === 'range' ? [c.targetMin, c.targetMax] : undefined,
      instruction: c.instruction, narration: c.narration,
      passes: ws.passingOpening(c), passMiss: ws.makeAngleMiss(c, ws.passingOpening(c)) ?? null,
      misses: ws.missingOpening(c), missMiss: ws.makeAngleMiss(c, ws.missingOpening(c)) ?? null,
      boundary: { at86: ws.makeAngleMiss(c, 86) ?? null, at90: ws.makeAngleMiss(c, 90) ?? null, at94: ws.makeAngleMiss(c, 94) ?? null,
        at176: ws.makeAngleMiss(c, 176) ?? null, at178: ws.makeAngleMiss(c, 178) ?? null },
      scene: ws.workspaceScene(c, { answerInput: '', relationship: null, protractorShown: false, opening: ws.missingOpening(c) }).facts,
    });
    results.push({ lesson, title: data.title, gradeBand: data.gradeBand, oracle: oracle.violations, uncheckedTypes: oracle.uncheckedTypes, adapter, items, data });
    log(`${lesson.mode} G${lesson.grade} | ${lesson.topic}: ${items.map((i) => i.targetKind ? `${i.targetKind}${i.range ? `:${i.range.join('-')}` : ''}` : `${i.type}=${i.expectedAnswer}`).join(', ')} | oracle ${oracle.violations.length} | adapter ${adapter}`);
    // One payload per mode: the first lesson of each (the G5 make_angle one carries the degree ranges, so it wins for make_angle).
    const key = lesson.mode;
    const wantPayload = process.argv.includes('--payloads') && adapter === 'ok' && oracle.violations.length === 0
      && (!saved.has(key) || (key === 'make_angle' && lesson.grade === '5'));
    if (wantPayload) {
      saved.add(key);
      writeFileSync(resolve(payloadDir, `angle-workshop.${key}.json`), JSON.stringify({
        source: 'qa/open-build/angle-workshop-2026-10-07/generations.json', primitiveId: 'angle-workshop', evalMode: key, data }, null, 1) + '\n');
    }
  }
  writeFileSync(resolve(out, 'generations.json'), JSON.stringify({ results, logs: logs.filter((l) => l.includes('[AngleWorkshop]')) }, null, 1));
} finally {
  await server.close();
}
