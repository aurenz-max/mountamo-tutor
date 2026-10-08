// Real production generation of syllable-clapper build_parts (open build), then the syllable-clapper oracle (its own
// search of the seed table for every word each bank can make) and the live adapter over every session. Pinned sessions
// make no model call; the intent-routed session calls the eval-mode resolver. With --payload it also writes the pinned
// grade 1 session as the w1 sweep payload.
// Usage (from my-tutoring-app): node scripts/syllable-build-probe.mjs --run [--env <path to .env.local>] [--payload]
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate build_parts sessions (pinned K and grade 1, repeated, and by intent).');
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
const out = resolve(root, 'qa/open-build/syllable-clapper-2026-10-08');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateSyllableClapper } = await loader.import('/src/components/lumina/service/literacy/gemini-syllable-clapper.ts');
  const { validateSyllableClapperData } = await loader.import('/src/components/lumina/components/live-activity/adapters/syllableClapperLive.ts');
  const { syllableClapperOracle } = await loader.import('/src/components/lumina/service/qa/oracles/syllable-clapper.ts');
  const cases = [
    ['pinned-K', 'build_parts', 'K', 'Syllables in animal words', 'Make words with two or three parts'],
    ['pinned-K-b', 'build_parts', 'K', 'Syllables', 'Make words with two or three parts'],
    ['pinned-G1', 'build_parts', '1', 'Syllables in longer words', 'Build words with a given number of syllables'],
    ['pinned-G1-b', 'build_parts', '1', 'Syllables', 'Build words with a given number of syllables'],
    // Unpinned: reached by intent through the eval-mode resolver.
    ['intent-K', undefined, 'K', 'Syllables', 'The child builds a word that has a given number of syllables from syllable cards'],
    // The spoken path after the change: a spoken pin, and a blend with the build (one payload, one shape: spoken only).
    ['spoken-count-K', 'count_parts', 'K', 'Animal words', 'Clap and count the parts in animal words'],
    ['blend-count-build-K', 'count_parts|build_parts', 'K', 'Animal words', 'Count parts and build words with parts'],
  ];
  const summary = [];
  let payload = null;
  for (const [name, targetEvalMode, grade, topic, intent] of cases) {
    const data = await generateSyllableClapper({ componentId: 'syllable-clapper', instanceId: `syllables-${name}`, topic, grade,
      gradeLevel: 'elementary', gradeContext: grade === 'K' ? 'Kindergarten' : `Grade ${grade}`, intent, objective: { text: intent },
      scope: {}, targetEvalMode, raw: { targetEvalMode } });
    const issues = [];
    try { validateSyllableClapperData(data); } catch (e) { issues.push(`live adapter rejects the data: ${e.message}`); }
    if (targetEvalMode === 'build_parts' && data.task !== 'letter_build') issues.push('routing: the pin did not reach the build');
    if (targetEvalMode?.startsWith('count_parts') && (data.task === 'letter_build'
        || (data.challenges ?? []).some(c => c.challengeType !== 'count_parts'))) issues.push('routing: a spoken pin left count_parts');
    const oracle = syllableClapperOracle.verify(data, { componentId: 'syllable-clapper', topic, gradeLevel: grade, grade, intent,
      evalMode: targetEvalMode ?? 'mixed' });
    if (oracle.violations.length) issues.push(...oracle.violations.map(v => `oracle ${v.check} ${v.where}: ${v.detail}`));
    writeFileSync(resolve(out, `${name}.json`), clean(JSON.stringify({ generatedAt: new Date().toISOString(),
      case: { targetEvalMode, grade, topic, intent }, data, oracle, issues,
      logs: logs.splice(0).filter(l => /SyllableClapper|syllable-clapper|resolveEvalModes|eval mode/i.test(l)) }, null, 2)) + '\n');
    const line = { name, task: data.task ?? 'spoken', count: (data.buildItems ?? data.challenges ?? []).length,
      builds: (data.buildItems ?? []).map(i => ({ ask: i.ask, parts: i.parts, bank: i.bank.join(' '), examples: i.examples })),
      oracleChecked: oracle.checkedChallenges, issues };
    summary.push(line);
    process.stdout.write(JSON.stringify(line) + '\n');
    if (issues.length) process.exitCode = 1;
    if (name === 'pinned-G1' && !issues.length) payload = data;
  }
  writeFileSync(resolve(out, 'generator-run.json'), JSON.stringify(summary, null, 2) + '\n');
  if (process.argv.includes('--payload') && payload) {
    const file = resolve(root, 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads/syllable-clapper.build_parts.json');
    writeFileSync(file, JSON.stringify({ source: 'qa/open-build/syllable-clapper-2026-10-08/pinned-G1.json', primitiveId: 'syllable-clapper',
      evalMode: 'build_parts', data: payload }, null, 1) + '\n');
    process.stdout.write(`payload written: ${file}\n`);
  }
} finally {
  await server.close();
}
