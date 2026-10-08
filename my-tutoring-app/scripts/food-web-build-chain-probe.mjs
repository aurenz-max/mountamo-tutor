// Real production generation of food-web-builder (build_chain open build, plus complete_web), checked by the oracle,
// the live adapter and the build's own check. Pass --run. Writes qa/open-build/food-web-builder-2026-10-07/generator-run.json
// and, with --payloads, the W1 payloads. Text model only (no Live).
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate food-web-builder lessons (add --payloads to save the W1 payloads).');
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
const out = resolve(root, 'qa/open-build/food-web-builder-2026-10-07');
const payloadDir = resolve(root, 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const LESSONS = [
  { mode: 'build_chain', grade: '3', topic: 'Food chains in a grassland', intent: 'Build a food chain that shows energy moving from a producer to a top consumer' },
  { mode: 'build_chain', grade: '4', topic: 'Pond food chains', intent: 'Arrows in a food chain show who is eaten by whom' },
  { mode: 'build_chain', grade: '5', topic: 'Energy flow in an ocean ecosystem', intent: 'Model how energy moves from producers to consumers (5-LS2-1)' },
  { mode: 'build_chain', grade: '7', topic: 'Forest food webs and trophic levels', intent: 'Construct a food chain across several trophic levels' },
  { mode: 'build_chain', grade: '8', topic: 'Desert ecosystem energy transfer', intent: 'Trace energy from producers through consumers' },
  { mode: 'complete_web', grade: '4', topic: 'Grassland food web', intent: 'Draw who eats whom in a grassland' },
];
const arrowsOf = (chain) => chain.slice(1).map((to, i) => ({ fromId: chain[i], toId: to }));
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateFoodWebBuilder } = await loader.import('/src/components/lumina/service/biology/gemini-food-web-builder.ts');
  const { foodWebBuilderOracle } = await loader.import('/src/components/lumina/service/qa/oracles/food-web-builder.ts');
  const { validateFoodWebBuilderData } = await loader.import('/src/components/lumina/components/live-activity/adapters/foodWebBuilderLive.ts');
  const ws = await loader.import('/src/components/lumina/primitives/visual-primitives/biology/foodWebWorkspace.ts');
  const lv = await loader.import('/src/components/lumina/primitives/visual-primitives/biology/foodWebLevers.ts');
  const results = [];
  const saved = new Set();
  for (const lesson of LESSONS) {
    let data;
    try {
      data = await generateFoodWebBuilder({ componentId: 'food-web-builder', instanceId: lesson.mode, topic: lesson.topic,
        grade: lesson.grade, gradeLevel: 'elementary', gradeContext: `Grade ${lesson.grade}`, intent: lesson.intent, targetEvalMode: lesson.mode,
        objective: {}, scope: { topic: lesson.topic, intent: lesson.intent }, raw: { targetEvalMode: lesson.mode, intent: lesson.intent } });
    } catch (e) {
      results.push({ lesson, error: String(e.message ?? e) });
      log(`${lesson.mode} G${lesson.grade}: GENERATION FAILED ${e.message ?? e}`);
      continue;
    }
    const oracle = foodWebBuilderOracle.verify(data, { componentId: 'food-web-builder', evalMode: lesson.mode, topic: lesson.topic, gradeLevel: `grade ${lesson.grade}` });
    let adapter = 'ok';
    try { validateFoodWebBuilderData(data); } catch (e) { adapter = String(e.message ?? e); }
    const relations = ws.feedingRelations(data.organisms, data.correctConnections);
    const name = (id) => data.organisms.find((o) => o.id === id)?.name ?? id;
    const items = (data.challenges ?? []).map((c) => {
      const chains = ws.feedingChains(data.organisms, relations, c.length).filter((p) => p.length === c.length && p[p.length - 1] === c.endId);
      const ref = chains[0];
      const judge = (placed, arrows) => ws.foodChainMiss(c, data.organisms, relations, placed, arrows) ?? null;
      const reversed = ref ? arrowsOf(ref).map((a) => ({ fromId: a.toId, toId: a.fromId })) : [];
      const shorter = lv.shorterChain(c, data.organisms, relations);
      return {
        id: c.id, length: c.length, end: name(c.endId), instruction: c.instruction,
        chainsThatPass: chains.map((p) => p.map(name).join(' → ')),
        everyChainPasses: chains.every((p) => judge(p, arrowsOf(p)) === null),
        reversedMiss: ref ? judge(ref, reversed) : 'no chain',
        dropFirstMiss: ref ? judge(ref.slice(1), arrowsOf(ref.slice(1))) : 'no chain',
        dropLastMiss: ref ? judge(ref.slice(0, -1), arrowsOf(ref.slice(0, -1))) : 'no chain',
        shorter: shorter?.instruction ?? null,
        levers: lv.foodWebLevers(c, data.organisms, relations, []).map((l) => l.id),
        sceneFacts: ws.workspaceScene(c, { mode: 'build_chain', ecosystem: data.ecosystem, organisms: data.organisms,
          placed: ref ?? [], arrows: ref ? arrowsOf(ref) : [] }).facts,
      };
    });
    results.push({ lesson, ecosystem: data.ecosystem, gradeBand: data.gradeBand,
      organisms: data.organisms.map((o) => `${o.name} (${o.trophicLevel})`),
      relations: relations.map((r) => `${name(r.fromId)} → ${name(r.toId)}`), droppedRelations: data.correctConnections.length - relations.length,
      oracle: oracle.violations, uncheckedTypes: oracle.uncheckedTypes, adapter, items, data });
    log(`${lesson.mode} G${lesson.grade} | ${data.ecosystem}: ${data.organisms.length} organisms, ${relations.length} relations | `
      + `${items.map((i) => `${i.length}→${i.end} (${i.chainsThatPass.length} ways, all pass ${i.everyChainPasses}, rev ${i.reversedMiss}, -first ${i.dropFirstMiss}, -last ${i.dropLastMiss})`).join('; ')}`
      + ` | oracle ${oracle.violations.length} | adapter ${adapter}`);
    for (const v of oracle.violations) log(`   ${v.check} ${v.where}: ${v.detail}`);
    if (process.argv.includes('--payloads') && adapter === 'ok' && oracle.violations.length === 0 && !saved.has(lesson.mode)) {
      saved.add(lesson.mode);
      writeFileSync(resolve(payloadDir, `food-web-builder.${lesson.mode}.json`), JSON.stringify({
        source: 'qa/open-build/food-web-builder-2026-10-07/generator-run.json', primitiveId: 'food-web-builder', evalMode: lesson.mode, data }, null, 1) + '\n');
    }
  }
  writeFileSync(resolve(out, 'generator-run.json'), JSON.stringify({ results, logs: logs.filter((l) => l.includes('[FoodWebBuilder]')) }, null, 1));
} finally {
  await server.close();
}
