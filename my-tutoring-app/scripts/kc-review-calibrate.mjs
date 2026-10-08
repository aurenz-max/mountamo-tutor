// Runs the production review questions (reviewKnowledgeCheck.ts) over saved sets; dumps raw signals for labelling.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
for (const key of ['TYPESAFE_API_KEY']) {
  const m = readFileSync('.env.local', 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (m) process.env[key] = m[1].trim().replace(/^["']|["']$/g, '');
}
const vite = await import(pathToFileURL(resolve(root, 'node_modules/vite/dist/node/index.js')).href);
const server = await vite.createServer({ root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
const L = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const R = await L.import('/src/components/lumina/service/knowledge-check/reviewKnowledgeCheck.ts');
const { systemOne } = await L.import('/src/components/lumina/service/manifest/typesafe/typesafeClient.ts');

const sets = process.env.IN.split(',').flatMap((f) => JSON.parse(readFileSync(f, 'utf8')));
const rows = [];
for (const set of sets) {
  const topic = set.topic ?? 'Green Excavators and Pink Dump Trucks';
  const lesson = { topic, grade: set.grade === 'K' ? 'Kindergarten' : `Grade ${set.grade}` };
  const problems = set.problems.filter((p) => p.type !== 'production');
  const views = problems.map(R.problemView);
  const answers = await Promise.all(views.map((v, i) => systemOne(R.reviewState(lesson, views, i), R.reviewQuestions(v, i))));
  views.forEach((v, i) => {
    const a = answers[i].answers;
    const d = R.decideReview(v, a, views);
    const tempting = (v.wrong_answers ?? []).map((w, k) => `${w}=${a[`tempting_${k}`].noul.toFixed(2)}`);
    rows.push({ id: `${topic} G${set.grade} P${i + 1}`, view: v, raw: {
      gives_away: +a.gives_away.noul.toFixed(2),
      evidence: `${a.evidence_agrees.choice}:${a.evidence_agrees.probabilities[a.evidence_agrees.choice].toFixed(2)}`,
      repeats: a.repeats ? `${a.repeats.choice}:${a.repeats.probabilities[a.repeats.choice].toFixed(2)}` : '-',
      tempting }, pass: d.pass, notes: d.notes.map((n) => n.split(':')[0].split('.')[0]) });
  });
}
for (const r of rows) {
  const v = r.view;
  console.log(`\n${r.id} ${v.type}: ${v.ask}`);
  if (v.choices) console.log(`   choices: ${v.choices.join(' | ')}  *${v.correct_answer ?? ''}`);
  if (v.items_and_groups) console.log(`   sort: ${v.items_and_groups.join('; ')}`);
  if (v.correct_order) console.log(`   order: ${v.correct_order.join(' > ')}`);
  if (v.type === 'true_false') console.log(`   key: ${v.correct_answer}`);
  if (v.shown_on_screen !== 'nothing besides the text') console.log(`   shown: ${v.shown_on_screen.slice(0, 220)}`);
  console.log(`   JEV giveaway=${r.raw.gives_away} evidence=${r.raw.evidence} repeats=${r.raw.repeats} tempting=[${r.raw.tempting.join(', ')}]`);
  console.log(`   => ${r.pass ? 'PASS' : 'FAIL: ' + r.notes.join(' / ')}`);
}
writeFileSync(process.env.OUTFILE, JSON.stringify(rows, null, 1));
await server.close();
