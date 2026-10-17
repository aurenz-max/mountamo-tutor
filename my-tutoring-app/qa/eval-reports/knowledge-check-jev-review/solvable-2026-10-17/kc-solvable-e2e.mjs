import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import { pathToFileURL } from 'node:url';
const vite = await import(pathToFileURL(resolve(process.cwd(), 'node_modules/vite/dist/node/index.js')).href);
for (const key of ['GEMINI_API_KEY', 'TYPESAFE_API_KEY']) {
  const m = readFileSync('.env.local', 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (m) process.env[key] = m[1].trim().replace(/^["']|["']$/g, '');
}
const logs = [];
const realLog = console.log.bind(console);
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...a) => logs.push(format(...a));
const root = process.cwd();
const TOPICS = ['Measuring length with non-standard units like hands and blocks', 'Wheels and axles', 'Comparing capacity: holds more, holds less',
  'Comparing weight: heavier and lighter', '2D shapes', 'Community helpers'];
const server = await vite.createServer({ root, configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
const L = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const { generateKnowledgeCheck } = await L.import('/src/components/lumina/service/knowledge-check/gemini-knowledge-check.ts');
const rows = [];
const cells = TOPICS.flatMap((t) => [[t, 1], [t, 2]]);
await Promise.all(cells.map(async ([topic, run]) => {
  const before = logs.length;
  let problems = [], error = null;
  try { problems = await generateKnowledgeCheck(topic, 'kindergarten', { preciseGrade: 'K', count: 4 }); } catch (e) { error = String(e); }
  rows.push({ topic, run, error, problems: problems.map((p) => ({ type: p.type, ask: p.question ?? p.statement,
    inset: p.inset ? p.inset.insetType : null,
    options: p.options?.map((o) => `${o.id === p.correctOptionId ? '*' : ''}${o.emoji ?? ''} ${o.text}`), correct: p.correct })) });
}));
// Logs interleave across parallel sets; keep every review/PRE line.
const review = logs.filter((l) => l.includes('[KC Review]') || l.includes('[KC PRE]'));
for (const r of rows.sort((a, b) => a.topic.localeCompare(b.topic) || a.run - b.run)) {
  realLog(`\n== ${r.topic} #${r.run}: ${r.error ?? `${r.problems.length} problems`}`);
  for (const p of r.problems) realLog(`  ${p.type === 'true_false' ? `TF(${p.correct})` : 'MC'}${p.inset ? `[${p.inset}]` : ''} ${p.ask}  ::  ${(p.options ?? []).join(' | ')}`);
}
realLog('\n-- review log --'); for (const l of review) realLog(l.slice(0, 400));
writeFileSync(process.env.OUTFILE, JSON.stringify({ rows, review }, null, 1));
await server.close();
