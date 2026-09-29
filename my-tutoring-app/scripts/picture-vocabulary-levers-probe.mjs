// Real production generation for picture-vocabulary's two noun modes (handoff 22 L4): does the live generator
// record each card's kind and a leak-free spoken clue, so a wrong tap is named and the levers can be offered?
// Checks per session: kinds on every card, clue coverage and clue leaks (`clueLeak`), which levers each item
// declares, and the practice item's R3 rule. Does not submit student data or open a live session.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate receptive_match and naming sessions on three topics.');
  process.exit(0);
}
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const clean = (value) => String(value).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) {
  console[method] = (...args) => logs.push(clean(format(...args)));
}
const root = process.cwd();
const out = resolve(root, 'qa/eval-reports/picture-vocabulary-levers-probe');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({
  root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const summary = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generatePictureVocabulary } = await loader.import('/src/components/lumina/service/literacy/gemini-picture-vocabulary.ts');
  const { itemsFromChallenges, clueLeak } = await loader.import('/src/components/lumina/primitives/visual-primitives/literacy/pictureVocabularyScript.ts');
  const { pictureVocabLevers, practiceItemFor, practiceLeak } =
    await loader.import('/src/components/lumina/primitives/visual-primitives/literacy/pictureVocabularyLevers.ts');

  const topics = [['farm', 'Farm animals'], ['kitchen', 'Things in the kitchen'], ['park', 'A day at the park']];
  for (const mode of ['receptive_match', 'naming']) {
    for (const [slug, topic] of topics) {
      const name = `${mode}-${slug}`;
      const data = await generatePictureVocabulary({
        componentId: 'picture-vocabulary', instanceId: `pv-${name}`, topic, grade: 'K', gradeLevel: 'kindergarten',
        gradeContext: 'Kindergarten', intent: `Name and find pictures of ${topic.toLowerCase()}`, objective: {}, scope: {},
        targetEvalMode: mode, raw: { targetEvalMode: mode },
      });
      const items = itemsFromChallenges(data.challenges ?? []);
      const issues = [];
      const rawClues = (data.challenges ?? []).map((c) => c.clue).filter(Boolean);
      for (const c of data.challenges ?? []) {
        if (c.clue && clueLeak(c.clue, c.word)) issues.push(`${c.id}: clue leaks "${c.clue}"`);
        if (mode === 'receptive_match' && (c.options ?? []).some((o) => !o.category)) issues.push(`${c.id}: a card has no kind`);
      }
      const rows = items.map((item) => {
        const levers = pictureVocabLevers(item, [], items).map((l) => l.id);
        const practice = practiceItemFor(item, items);
        if (practice && practiceLeak(practice, item, items)) issues.push(`${item.id}: practice leaks`);
        return { word: item.word, category: item.category, clue: item.clue,
          cards: (item.options ?? []).map((o) => `${o.word}:${o.category ?? '?'}`), levers,
          practice: practice ? practice.options.map((o) => `${o.word}:${o.category}`) : null };
      });
      writeFileSync(resolve(out, `${name}.json`),
        clean(JSON.stringify({ generatedAt: new Date().toISOString(), data, rows, issues }, null, 2)) + '\n');
      const row = { name, items: items.length, clues: `${rawClues.length}/${data.challenges?.length ?? 0}`,
        withClueLever: rows.filter((r) => r.levers.includes('function_cue')).length,
        withPractice: rows.filter((r) => r.practice).length,
        kinds: [...new Set(rows.flatMap((r) => r.cards.map((c) => c.split(':')[1])).concat(rows.map((r) => r.category)))].join(','),
        issues };
      summary.push(row);
      process.stdout.write(JSON.stringify(row) + '\n');
      if (issues.length) process.exitCode = 1;
    }
  }
} catch (error) {
  process.stderr.write(clean(error?.stack ?? error?.message ?? error) + '\n');
  process.exitCode = 1;
} finally {
  writeFileSync(resolve(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  writeFileSync(resolve(out, 'generation.log'), logs.join('\n') + '\n');
  await server.close();
}
