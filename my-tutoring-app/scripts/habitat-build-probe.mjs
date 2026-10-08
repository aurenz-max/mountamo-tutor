// Real production generation of habitat-diorama build_habitat (open build), then the habitat-diorama oracle (its own
// search over every subset of each tray) and the live adapter over every session. Pinned sessions make no model call;
// the blend and the intent-routed session call flash-lite. With --payload it also writes the pinned 3-5 session as the
// w1 sweep payload.
// Usage (from my-tutoring-app): node scripts/habitat-build-probe.mjs --run [--env <path to .env.local>] [--payload]
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate build_habitat sessions (pinned K-2 and 3-5, a blend, and by intent).');
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
const out = resolve(root, 'qa/open-build/habitat-diorama-2026-10-07');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateHabitatDiorama } = await loader.import('/src/components/lumina/service/biology/gemini-habitat-diorama.ts');
  const { validateHabitatDioramaData } = await loader.import('/src/components/lumina/components/live-activity/adapters/habitatDioramaLive.ts');
  const { habitatDioramaOracle } = await loader.import('/src/components/lumina/service/qa/oracles/habitat-diorama.ts');
  const { itemsFromChallenges, askFor } = await loader.import('/src/components/lumina/primitives/visual-primitives/biology/habitatDioramaScript.ts');
  const cases = [
    ['pinned-3-5', 'build_habitat', '4', 'What animals need to survive in a habitat', 'Build a habitat that meets every need of an animal'],
    ['pinned-K-2', 'build_habitat', '1', 'Animals need food, water and shelter', 'Make a home where an animal can live'],
    ['blend-3-5', 'observe|build_habitat', '3', 'Pond habitats', 'Observe pond life, then build a habitat an animal can survive in'],
    // Unpinned: reached by intent through the eval-mode resolver.
    ['intent-3-5', undefined, '3', 'Habitats and survival', 'Build a habitat the frog can survive in, with everything it needs'],
  ];
  const summary = [];
  let payload = null;
  for (const [name, targetEvalMode, grade, topic, intent] of cases) {
    const data = await generateHabitatDiorama({ componentId: 'habitat-diorama', instanceId: `habitat-${name}`, topic, grade,
      gradeLevel: 'elementary', gradeContext: `Grade ${grade}`, intent, objective: { text: intent },
      scope: {}, targetEvalMode, raw: {} });
    const issues = [];
    try { validateHabitatDioramaData(data); } catch (e) { issues.push(`live adapter rejects the data: ${e.message}`); }
    const types = [...new Set((data.challenges ?? []).map(c => c.type))];
    if (targetEvalMode === 'build_habitat' && (types.length !== 1 || types[0] !== 'build_habitat')) issues.push(`routing: types ${types.join(',')}`);
    if (targetEvalMode && targetEvalMode.includes('|') && !types.includes('build_habitat')) issues.push('blend lost the build');
    const oracle = habitatDioramaOracle.verify(data, { componentId: 'habitat-diorama', topic, gradeLevel: `Grade ${grade}`, grade, intent,
      evalMode: targetEvalMode ?? 'mixed' });
    if (oracle.violations.length) issues.push(...oracle.violations.map(v => `oracle ${v.check} ${v.where}: ${v.detail}`));
    const items = itemsFromChallenges(data.challenges ?? [], data).items;
    writeFileSync(resolve(out, `${name}.json`), clean(JSON.stringify({ generatedAt: new Date().toISOString(),
      case: { targetEvalMode, grade, topic, intent }, data, oracle, issues,
      logs: logs.splice(0).filter(l => /HabitatDiorama|resolveEvalModes|eval mode/i.test(l)) }, null, 2)) + '\n');
    const line = { name, gradeBand: data.gradeBand, header: data.habitat, count: data.challenges.length, types,
      builds: items.filter(i => i.kind === 'build_habitat').map(i => ({ ask: askFor(i), needs: i.needs, tray: i.tray })),
      oracleChecked: oracle.checkedChallenges, issues };
    summary.push(line);
    process.stdout.write(JSON.stringify(line) + '\n');
    if (issues.length) process.exitCode = 1;
    if (name === 'pinned-3-5' && !issues.length) payload = data;
  }
  writeFileSync(resolve(out, 'generator-run.json'), JSON.stringify(summary, null, 2) + '\n');
  if (process.argv.includes('--payload') && payload) {
    const file = resolve(root, 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads/habitat-diorama.build_habitat.json');
    writeFileSync(file, JSON.stringify({ source: 'qa/open-build/habitat-diorama-2026-10-07/pinned-3-5.json', primitiveId: 'habitat-diorama',
      evalMode: 'build_habitat', data: payload }, null, 1) + '\n');
    process.stdout.write(`payload written: ${file}\n`);
  }
} finally {
  await server.close();
}
