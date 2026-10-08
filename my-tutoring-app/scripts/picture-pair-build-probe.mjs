// Real production generation of picture-vocabulary pair_build (open build), then the picture-vocabulary oracle and the
// live adapter over every session. pair_build makes no model call: the boards are code-owned. With --payload it also
// writes the neutral-intent session as the w1 sweep payload.
// Usage (from my-tutoring-app): node scripts/picture-pair-build-probe.mjs --run [--sessions N] [--payload]
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate pair_build sessions (neutral, opposites and goes-together intents, easy tier).');
  process.exit(0);
}
// The generator module builds the shared Gemini client at import; pair_build never calls it, so no real key is needed.
process.env.GEMINI_API_KEY ??= 'unused-pair-build-makes-no-model-call';
const sessionsArg = process.argv.indexOf('--sessions');
const repeat = sessionsArg > 0 ? Number(process.argv[sessionsArg + 1]) : 10;
const logs = [];
const print = console.log;
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(format(...args));
const root = process.cwd();
const out = resolve(root, 'qa/open-build/picture-vocabulary-2026-10-08');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generatePictureVocabulary } = await loader.import('/src/components/lumina/service/literacy/gemini-picture-vocabulary.ts');
  const { validatePictureVocabularyData } = await loader.import('/src/components/lumina/components/live-activity/adapters/pictureVocabularyLive.ts');
  const { pictureVocabularyOracle } = await loader.import('/src/components/lumina/service/qa/oracles/picture-vocabulary.ts');
  const cases = [
    ['neutral-K', 'Kindergarten', 'Word meanings with pictures', 'Make pairs of pictures', undefined],
    ['opposites-K', 'Kindergarten', 'Opposites', 'Find pictures that are opposites, like hot and cold', undefined],
    ['goes-with-1', 'Grade 1', 'Words that go together', 'Sort pictures into things that go together', undefined],
    ['easy-K', 'Kindergarten', 'Word meanings with pictures', 'Make pairs of pictures', 'easy'],
  ];
  const summary = [];
  let payload = null;
  for (const [name, grade, topic, intent, supportTier] of cases) {
    const sessions = [];
    for (let n = 0; n < repeat; n++) {
      const data = await generatePictureVocabulary({ componentId: 'picture-vocabulary', instanceId: `pv-${name}`, topic,
        grade, gradeLevel: 'elementary', gradeContext: grade, intent, objective: { text: intent }, scope: {},
        targetEvalMode: 'pair_build', supportTier, raw: { targetEvalMode: 'pair_build' } });
      const issues = data.pairItems.length === 4 ? [] : [`${data.pairItems.length} boards, not 4`];
      try { validatePictureVocabularyData(data); } catch (e) { issues.push(`live adapter rejects the data: ${e.message}`); }
      const oracle = pictureVocabularyOracle.verify(data, { componentId: 'picture-vocabulary', topic, gradeLevel: grade, grade, intent,
        evalMode: 'pair_build' });
      issues.push(...oracle.violations.map(v => `oracle ${v.check} ${v.where}: ${v.detail}`));
      sessions.push({ items: data.pairItems.length, relations: data.pairItems.map(i => i.relation), issues, data });
      if (name === 'neutral-K' && n === 0) payload = data;
    }
    const issues = sessions.flatMap(s => s.issues);
    summary.push({ name, sessions: sessions.length, boards: sessions.reduce((s, x) => s + x.items, 0),
      relations: [...new Set(sessions.map(s => s.relations.join(',')))], issues });
    writeFileSync(resolve(out, `gen-${name}.json`), JSON.stringify({ generatedAt: new Date().toISOString(), grade, topic, intent,
      supportTier: supportTier ?? null, sessions: sessions.map(s => ({ issues: s.issues, data: s.data })) }, null, 1) + '\n');
  }
  writeFileSync(resolve(out, 'generator-run.json'), JSON.stringify({ generatedAt: new Date().toISOString(), summary, logs: logs.slice(0, 40) }, null, 1) + '\n');
  for (const s of summary) print(`${s.name}: ${s.sessions} sessions, ${s.boards} boards, relations ${s.relations.join(' | ')}, ${s.issues.length} issues`);
  for (const s of summary) for (const i of s.issues) print(`  ${s.name}: ${i}`);
  if (process.argv.includes('--payload') && payload) {
    const file = resolve(root, 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads/picture-vocabulary.pair_build.json');
    writeFileSync(file, JSON.stringify({ source: 'qa/open-build/picture-vocabulary-2026-10-08/gen-neutral-K.json',
      primitiveId: 'picture-vocabulary', evalMode: 'pair_build', data: payload }, null, 1) + '\n');
    print(`payload written: ${file}`);
  }
} finally { await server.close(); }
