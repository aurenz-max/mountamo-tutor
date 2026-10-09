// Real production generation of gear-train-builder (three open builds), pinned and intent-routed, checked by the oracle,
// the live adapter and the build's own check on the journey's pass and wrong towers. Pass --run. Writes
// qa/open-build/gear-train-builder-2026-10-08/generator-run.json and, with --payloads, the W1 payloads. Text model only.
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate gear-train-builder sessions (add --payloads to save the W1 payloads).');
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
const out = resolve(root, 'qa/open-build/gear-train-builder-2026-10-08');
const payloadDir = resolve(root, 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
// `expect` is the mode intent resolution should pick (null = mixed or no expectation).
const LESSONS = [
  { pin: 'build_direction', grade: 'K', topic: 'Toys that use gears', intent: 'Gears that touch turn opposite ways' },
  { pin: 'build_direction', grade: '2', topic: 'How gears work', intent: 'Each gear turns the other way from the one it touches' },
  { pin: 'build_speed', grade: '1', topic: 'Big gears and small gears', intent: 'A small gear turns faster than a big one' },
  { pin: 'build_speed', grade: '3', topic: 'Bicycle gears', intent: 'Make a gear turn faster or slower' },
  { pin: 'build_ratio', grade: '4', topic: 'Gear ratios in clocks', intent: 'Count teeth to work out how many times a gear turns' },
  { pin: 'build_ratio', grade: '5', topic: 'Machines and gear ratios', intent: 'Design a gear train for a given speed ratio' },
  { pin: null, expect: 'build_ratio', grade: '5', topic: 'Gear ratios', intent: 'Make the output gear turn exactly three times for each turn of the input' },
  { pin: null, expect: 'build_direction', grade: '2', topic: 'Gears turning', intent: 'Predict which way the last gear turns' },
  { pin: null, expect: null, grade: '3', topic: 'Simple machines: gears', intent: 'Explore how gears work' },
];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateGearTrainBuilder } = await loader.import('/src/components/lumina/service/engineering/gemini-gear-train.ts');
  const { gearTrainBuilderOracle } = await loader.import('/src/components/lumina/service/qa/oracles/gear-train-builder.ts');
  const { validateGearTrainBuilderData } = await loader.import('/src/components/lumina/components/live-activity/adapters/gearTrainBuilderLive.ts');
  const ws = await loader.import('/src/components/lumina/primitives/visual-primitives/engineering/gearWorkspace.ts');
  /** Replay the journey's inputs (tray taps add a gear), then the real check. */
  const replay = (c, wrong) => {
    const train = ws.gearHarnessInputs(c, wrong, null).filter(s => s.type === 'touch').map((s, i) => ({ id: `g${i}`, teeth: Number(s.target.slice(5)) }));
    return { miss: ws.gearMiss(c, train) ?? null, work: ws.describeTrain(train) };
  };
  const results = [];
  const saved = new Set();
  for (const lesson of LESSONS) {
    let data;
    try {
      data = await generateGearTrainBuilder({ componentId: 'gear-train-builder', instanceId: lesson.pin ?? 'mixed', topic: lesson.topic,
        grade: lesson.grade, gradeLevel: 'elementary', gradeContext: lesson.grade === 'K' ? 'Kindergarten' : `Grade ${lesson.grade}`,
        intent: lesson.intent, targetEvalMode: lesson.pin ?? undefined, objective: {}, scope: { topic: lesson.topic, intent: lesson.intent },
        raw: { intent: lesson.intent } });
    } catch (e) {
      results.push({ lesson, error: String(e.message ?? e) });
      log(`${lesson.pin ?? 'unpinned'} G${lesson.grade}: GENERATION FAILED ${e.message ?? e}`);
      continue;
    }
    const oracle = gearTrainBuilderOracle.verify(data, { componentId: 'gear-train-builder', evalMode: lesson.pin ?? 'mixed', topic: lesson.topic, gradeLevel: `grade ${lesson.grade}` });
    let adapter = 'ok';
    try { validateGearTrainBuilderData(data); } catch (e) { adapter = String(e.message ?? e); }
    const items = data.challenges.map((c) => ({ id: c.id, type: c.type, way: c.way, speed: c.speed, ratio: c.ratio, minGears: c.minGears,
      instruction: c.instruction, pass: replay(c, false), wrong: replay(c, true) }));
    const routed = lesson.pin ? null : data.challengeType;
    results.push({ lesson, title: data.title, challengeType: data.challengeType, routed, oracle: oracle.violations, adapter, items, data });
    log(`${lesson.pin ?? `unpinned(expect ${lesson.expect ?? 'any'})`} G${lesson.grade} | "${data.title}" ${data.challengeType} | `
      + `${items.map((i) => `${i.type}:${i.way ?? ''}${i.speed ?? ''}${i.ratio ? `x${i.ratio.toFixed(2)}` : ''}/${i.minGears} pass:${i.pass.miss ?? 'ok'} wrong:${i.wrong.miss}`).join('; ')}`
      + ` | oracle ${oracle.violations.length} | adapter ${adapter}`);
    for (const v of oracle.violations) log(`   ${v.check} ${v.where}: ${v.detail}`);
    if (process.argv.includes('--payloads') && lesson.pin && adapter === 'ok' && oracle.violations.length === 0 && !saved.has(lesson.pin)) {
      saved.add(lesson.pin);
      writeFileSync(resolve(payloadDir, `gear-train-builder.${lesson.pin}.json`), JSON.stringify({
        source: 'qa/open-build/gear-train-builder-2026-10-08/generator-run.json', primitiveId: 'gear-train-builder', evalMode: lesson.pin, data }, null, 1) + '\n');
    }
  }
  writeFileSync(resolve(out, 'generator-run.json'), JSON.stringify({ results, logs: logs.filter((l) => l.includes('GearTrainBuilder')) }, null, 1));
  log(logs.filter((l) => l.includes('[GearTrainBuilder] modes')).join('\n'));
} finally {
  await server.close();
}
