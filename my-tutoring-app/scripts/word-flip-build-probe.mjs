// Real production generation of word-flip build_inflect (open build, OB-8L), then the word-flip oracle (its own
// spelling of every build the board allows) and the live adapter over every session. Pinned sessions call flash-lite
// once for topic words; the intent case is routed by the eval-mode resolver; the blend must drop the build.
// With --payload it writes the pinned grade 2 session as the w1 sweep payload.
// Usage (from my-tutoring-app): node scripts/word-flip-build-probe.mjs --run [--env <path to .env.local>] [--payload]
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate build_inflect sessions (pinned G1, G2, G2 easy, by intent, and a blend).');
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
const out = resolve(root, 'qa/open-build/word-flip-2026-10-08');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateWordFlip } = await loader.import('/src/components/lumina/service/literacy/gemini-word-flip.ts');
  const { validateWordFlipData } = await loader.import('/src/components/lumina/components/live-activity/adapters/wordFlipLive.ts');
  const { wordFlipOracle } = await loader.import('/src/components/lumina/service/qa/oracles/word-flip.ts');
  const cases = [
    ['pinned-g1', 'build_inflect', '1', 'Animals at the farm', 'Make words that mean more than one, and words that tell it already happened', undefined],
    ['pinned-g2', 'build_inflect', '2', 'Things in the kitchen', 'Add -s, -es, or change y to ies; add -ed for the past', undefined],
    ['pinned-g2-easy', 'build_inflect', '2', 'At the park', 'Plural and past tense endings', 'easy'],
    // Unpinned: reached by intent through the eval-mode resolver.
    ['intent-g2', undefined, '2', 'Plural nouns and past tense', 'Build plural and past-tense words by putting an ending card on a base word', undefined],
    // A blend with a spoken mode: one mount is one shape, so the spoken mode runs and the build is left out.
    ['blend-g1', 'plural_s|build_inflect', '1', 'Pets', 'Plurals', undefined],
  ];
  const summary = [];
  let payload = null;
  for (const [name, targetEvalMode, grade, topic, intent, supportTier] of cases) {
    const issues = [];
    let data = null;
    try {
      data = await generateWordFlip({ componentId: 'word-flip', instanceId: `flip-${name}`, topic, grade,
        gradeLevel: 'elementary', gradeContext: `Grade ${grade}`, intent, objective: { text: intent },
        scope: {}, targetEvalMode, supportTier, raw: {} });
    } catch (e) { issues.push(`generator threw: ${e.message}`); }
    if (!data) { summary.push({ name, issues }); process.exitCode = 1; continue; }
    try { validateWordFlipData(data); } catch (e) { issues.push(`live adapter rejects the data: ${e.message}`); }
    const isBuild = data.task === 'build_inflect';
    if (targetEvalMode === 'build_inflect' && !isBuild) issues.push('routing: pinned build did not build');
    if (targetEvalMode?.includes('|') && isBuild) issues.push('routing: a blend produced the build');
    const oracle = wordFlipOracle.verify(data, { componentId: 'word-flip', topic, gradeLevel: `Grade ${grade}`, grade, intent,
      evalMode: targetEvalMode ?? 'mixed' });
    if (oracle.violations.length) issues.push(...oracle.violations.map(v => `oracle ${v.check} ${v.where}: ${v.detail}`));
    writeFileSync(resolve(out, `${name}.json`), clean(JSON.stringify({ generatedAt: new Date().toISOString(),
      case: { targetEvalMode, grade, topic, intent, supportTier }, data, oracle, issues,
      logs: logs.splice(0).filter(l => /WordFlip|Word Flip|resolveEvalModes|eval mode/i.test(l)) }, null, 2)) + '\n');
    const line = { name, task: data.task ?? 'spoken', title: data.title,
      board: isBuild ? data.availableParts.map(p => p.text).join(' ') : undefined,
      asks: isBuild ? data.buildItems.map(i => `${i.ask}${i.ways === 2 ? ' (x2)' : ''}`) : data.challenges.map(c => `${c.type}:${c.sourceWord}`),
      oracleChecked: oracle.checkedChallenges, unchecked: oracle.uncheckedTypes, issues };
    summary.push(line);
    process.stdout.write(JSON.stringify(line) + '\n');
    if (issues.length) process.exitCode = 1;
    if (name === 'pinned-g2' && !issues.length) payload = data;
  }
  writeFileSync(resolve(out, 'generator-run.json'), JSON.stringify(summary, null, 2) + '\n');
  if (process.argv.includes('--payload') && payload) {
    const file = resolve(root, 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads/word-flip.build_inflect.json');
    writeFileSync(file, JSON.stringify({ source: 'qa/open-build/word-flip-2026-10-08/pinned-g2.json', primitiveId: 'word-flip',
      evalMode: 'build_inflect', data: payload }, null, 1) + '\n');
    process.stdout.write(`payload written: ${file}\n`);
  }
} finally {
  await server.close();
}
