// Real production generation of tower-stacker (three open builds), pinned and intent-routed, checked by the oracle,
// the live adapter and the build's own check on the journey's pass and wrong towers. Pass --run. Writes
// qa/open-build/tower-stacker-2026-10-08/generator-run.json and, with --payloads, the W1 payloads. Text model only.
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate tower-stacker sessions (add --payloads to save the W1 payloads).');
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
const out = resolve(root, 'qa/open-build/tower-stacker-2026-10-08');
const payloadDir = resolve(root, 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
// `expect` is the mode intent resolution should pick (null = mixed or no expectation).
const LESSONS = [
  { pin: 'build_tall', grade: 'K', topic: 'Building with blocks', intent: 'Stack blocks to build a tall tower' },
  { pin: 'build_tall', grade: '2', topic: 'Towers and buildings', intent: 'Build a tower that does not fall' },
  { pin: 'build_few', grade: '3', topic: 'Engineering design with limited materials', intent: 'Reach a height using as few pieces as possible' },
  { pin: 'build_few', grade: '5', topic: 'Material efficiency in structures', intent: 'Design a tall structure with limited materials' },
  { pin: 'build_windproof', grade: '2', topic: 'Strong buildings', intent: 'Build a tower that stays up in the wind' },
  { pin: 'build_windproof', grade: '4', topic: 'Designing for wind and weather', intent: 'Design a tower that resists wind (3-5-ETS1)' },
  { pin: null, expect: 'build_windproof', grade: '4', topic: 'Skyscrapers and wind', intent: 'Test whether a tower can survive strong wind' },
  { pin: null, expect: 'build_few', grade: '3', topic: 'Saving materials', intent: 'Build tall while using the fewest pieces' },
  { pin: null, expect: null, grade: '3', topic: 'Structures and stability', intent: 'Explore what makes structures stable' },
];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateTowerStacker } = await loader.import('/src/components/lumina/service/engineering/gemini-tower-stacker.ts');
  const { towerStackerOracle } = await loader.import('/src/components/lumina/service/qa/oracles/tower-stacker.ts');
  const { validateTowerStackerData } = await loader.import('/src/components/lumina/components/live-activity/adapters/towerStackerLive.ts');
  const ws = await loader.import('/src/components/lumina/primitives/visual-primitives/engineering/towerWorkspace.ts');
  /** Replay the journey's inputs through the real drop rule, then the real check. */
  const replay = (c, wrong) => {
    let pieces = [], kind = null, turned = false, n = 0;
    for (const step of ws.towerHarnessInputs(c, wrong, null)) {
      if (step.type === 'touch' && step.target.startsWith('tray-')) { kind = step.target.slice(5); turned = false; }
      else if (step.type === 'choose' && step.label === 'Turn') turned = !turned;
      else if (step.type === 'touch' && step.target.startsWith('column-')) {
        const { w } = ws.pieceSize(kind, turned);
        const landed = ws.dropPiece(pieces, kind, turned, ws.leftEdgeFor(Number(step.target.slice(7)), w), `p${++n}`);
        if ('piece' in landed) pieces = [...pieces, landed.piece];
      }
    }
    return { miss: ws.towerMiss(c, pieces) ?? null, work: ws.describeTower(pieces) };
  };
  const results = [];
  const saved = new Set();
  for (const lesson of LESSONS) {
    let data;
    try {
      data = await generateTowerStacker({ componentId: 'tower-stacker', instanceId: lesson.pin ?? 'mixed', topic: lesson.topic,
        grade: lesson.grade, gradeLevel: 'elementary', gradeContext: lesson.grade === 'K' ? 'Kindergarten' : `Grade ${lesson.grade}`,
        intent: lesson.intent, targetEvalMode: lesson.pin ?? undefined, objective: {}, scope: { topic: lesson.topic, intent: lesson.intent },
        raw: { intent: lesson.intent } });
    } catch (e) {
      results.push({ lesson, error: String(e.message ?? e) });
      log(`${lesson.pin ?? 'unpinned'} G${lesson.grade}: GENERATION FAILED ${e.message ?? e}`);
      continue;
    }
    const oracle = towerStackerOracle.verify(data, { componentId: 'tower-stacker', evalMode: lesson.pin ?? 'mixed', topic: lesson.topic, gradeLevel: `grade ${lesson.grade}` });
    let adapter = 'ok';
    try { validateTowerStackerData(data); } catch (e) { adapter = String(e.message ?? e); }
    const items = data.challenges.map((c) => ({ id: c.id, type: c.type, targetHeight: c.targetHeight, maxPieces: c.maxPieces, wind: c.wind,
      instruction: c.instruction, pass: replay(c, false), wrong: replay(c, true) }));
    const routed = lesson.pin ? null : data.challengeType;
    results.push({ lesson, title: data.title, challengeType: data.challengeType, routed, oracle: oracle.violations, adapter, items, data });
    log(`${lesson.pin ?? `unpinned(expect ${lesson.expect ?? 'any'})`} G${lesson.grade} | "${data.title}" ${data.challengeType} | `
      + `${items.map((i) => `${i.type}@${i.targetHeight}${i.maxPieces ? `/${i.maxPieces}` : ''} pass:${i.pass.miss ?? 'ok'} wrong:${i.wrong.miss}`).join('; ')}`
      + ` | oracle ${oracle.violations.length} | adapter ${adapter}`);
    for (const v of oracle.violations) log(`   ${v.check} ${v.where}: ${v.detail}`);
    if (process.argv.includes('--payloads') && lesson.pin && adapter === 'ok' && oracle.violations.length === 0 && !saved.has(lesson.pin)) {
      saved.add(lesson.pin);
      writeFileSync(resolve(payloadDir, `tower-stacker.${lesson.pin}.json`), JSON.stringify({
        source: 'qa/open-build/tower-stacker-2026-10-08/generator-run.json', primitiveId: 'tower-stacker', evalMode: lesson.pin, data }, null, 1) + '\n');
    }
  }
  writeFileSync(resolve(out, 'generator-run.json'), JSON.stringify({ results, logs: logs.filter((l) => l.includes('TowerStacker')) }, null, 1));
  log(logs.filter((l) => l.includes('[TowerStacker] modes')).join('\n'));
} finally {
  await server.close();
}
