// Real production generation for oral-sentence-studio (handoff 22 L4): does the live generator return a meaning
// picture per target word that is not one of the scene's own pictures, so `word_pictures` can be offered? Checks per
// session: picture coverage, the leak rule (`wordPicturesLeak`), which levers each item declares, and that every
// challenge still passes the build gate. Does not submit student data or open a live session.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate one session per mode on two topics.');
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
const out = resolve(root, 'qa/eval-reports/oral-sentence-studio-levers-probe');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({
  root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const summary = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateOralSentenceStudio } = await loader.import('/src/components/lumina/service/literacy/gemini-oral-sentence-studio.ts');
  const { itemsFromChallenges } = await loader.import('/src/components/lumina/primitives/visual-primitives/literacy/oralSentenceStudioScript.ts');
  const { oralSentenceLevers, wordPicturesLeak } =
    await loader.import('/src/components/lumina/primitives/visual-primitives/literacy/oralSentenceStudioLevers.ts');

  const topics = [['garden', 'Helping in the garden'], ['beach', 'A day at the beach']];
  for (const mode of ['describe_scene', 'guided_writing_rehearsal', 'use_story_words']) {
    for (const [slug, topic] of topics) {
      const name = `${mode}-${slug}`;
      const data = await generateOralSentenceStudio({
        componentId: 'oral-sentence-studio', instanceId: `oss-${name}`, topic, grade: '1', gradeLevel: 'elementary',
        gradeContext: 'Grade 1', intent: `Use new words in whole sentences about ${topic.toLowerCase()}`,
        objective: { text: `Use new words in whole sentences about ${topic.toLowerCase()}` }, scope: {},
        targetEvalMode: mode, raw: { targetEvalMode: mode },
      });
      const items = itemsFromChallenges(data.challenges ?? []);
      const issues = [];
      if (items.length !== (data.challenges?.length ?? 0)) issues.push('a challenge failed the build gate');
      const rows = items.map((item) => ({ words: item.challenge.targetWords, pictures: item.challenge.wordEmojis ?? null,
        scene: [item.challenge.actorEmoji, item.challenge.actionEmoji, item.challenge.objectEmoji, item.challenge.settingEmoji],
        leak: wordPicturesLeak(item), levers: oralSentenceLevers(item, []).map((l) => l.id) }));
      writeFileSync(resolve(out, `${name}.json`),
        clean(JSON.stringify({ generatedAt: new Date().toISOString(), data, rows, issues }, null, 2)) + '\n');
      const row = { name, items: items.length, withPictures: rows.filter((r) => r.levers.includes('word_pictures')).length,
        pictures: rows.map((r) => `${r.words.join('/')}=${(r.pictures ?? ['-', '-']).join('')}`).join(' '), issues };
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
