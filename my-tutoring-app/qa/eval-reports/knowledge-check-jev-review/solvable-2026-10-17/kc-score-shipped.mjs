import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const m = readFileSync('.env.local', 'utf8').match(/^TYPESAFE_API_KEY=(.*)$/m);
if (m) process.env.TYPESAFE_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
const vite = await import(pathToFileURL(resolve(root, 'node_modules/vite/dist/node/index.js')).href);
const server = await vite.createServer({ root, configFile: false, appType: 'custom', logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
const L = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const R = await L.import('/src/components/lumina/service/knowledge-check/reviewKnowledgeCheck.ts');
const { systemOne } = await L.import('/src/components/lumina/service/manifest/typesafe/typesafeClient.ts');
const { rows } = JSON.parse(readFileSync(process.env.IN, 'utf8'));
const jobs = [];
for (const r of rows) for (const p of r.problems) {
  if (p.type !== 'multiple_choice') continue;
  const choices = p.options.map((o) => o.replace(/^\*/, '').trim());
  const key = p.options.findIndex((o) => o.startsWith('*'));
  const view = { type: 'multiple_choice', shown_on_screen: p.inset ? `an ${p.inset} inset` : 'nothing besides the text', ask: p.ask, choices,
    correct_answer: choices[key], wrong_answers: choices.filter((_, i) => i !== key) };
  jobs.push(systemOne({ lesson: { topic: r.topic, grade: 'Kindergarten' }, problem: view }, { solvable: R.reviewQuestions(view, 0).solvable })
    .then(({ answers }) => { const pr = answers.solvable.probabilities; return [(pr.missing_information + pr.several_answers), pr, r.topic, p.ask, p.options.join(' | ')]; }));
}
const out = (await Promise.all(jobs)).sort((a, b) => b[0] - a[0]);
for (const [un, pr, t, ask, opts] of out) console.log(`un=${un.toFixed(2)} (miss ${pr.missing_information.toFixed(2)} sev ${pr.several_answers.toFixed(2)})  ${t.slice(0, 22).padEnd(22)} ${ask} :: ${opts}`);
await server.close();
