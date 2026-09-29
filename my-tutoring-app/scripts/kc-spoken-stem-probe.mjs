// KC-UB (handoff 28): real orchestrated generations -> the judged build gate.
// Records, per set, whether the teaching workspace can carry it, each stem's
// word count, and every redraw the generator made.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const logs = [];
const realLog = console.log.bind(console);
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(format(...args));
const root = process.cwd();
const out = resolve(root, 'qa/eval-reports/knowledge-check-spoken-stem-probe');
mkdirSync(out, { recursive: true });
const CELLS = [
  ['science', 'Plants need sunlight and water', 'analyze', '2', 'elementary'],
  ['science', 'Plants need sunlight and water', 'evaluate', '2', 'elementary'],
  ['science', 'Plants need sunlight and water', 'apply', '2', 'elementary'],
  ['math', 'Adding within 20', 'evaluate', '2', 'elementary'],
  ['literacy', 'Nouns and verbs', 'recall', '2', 'elementary'],
  ['literacy', 'Nouns and verbs', 'apply', '2', 'elementary'],
  ['science', 'Plants need sunlight and water', 'analyze', '1', 'elementary'],
  ['science', 'Plants need sunlight and water', 'analyze', '7', 'middle-school'],
  ['literacy', 'Nouns and verbs', 'recall', 'K', 'kindergarten'],
];
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const rows = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateKnowledgeCheck } = await loader.import('/src/components/lumina/service/knowledge-check/gemini-knowledge-check.ts');
  const script = await loader.import('/src/components/lumina/primitives/knowledgeCheckScript.ts');
  for (const [subject, topic, mode, grade, band] of CELLS) {
    const before = logs.length;
    let problems = [];
    try {
      problems = await generateKnowledgeCheck(topic, band, { bloomsTier: mode, preciseGrade: grade, count: 3 });
    } catch (e) { rows.push({ subject, mode, grade, error: String(e) }); continue; }
    const redraws = logs.slice(before).filter((l) => l.includes('redrawing once'));
    const per = problems.map((p, i) => {
      const stem = p.question ?? p.statement ?? p.textWithBlanks ?? p.instruction ?? '';
      return { type: p.type, words: script.wordsIn(stem), viable: script.itemsFromProblems([p]).judgedViable, stem };
    });
    const set = script.itemsFromProblems(problems);
    const row = { subject, mode, grade, setViable: set.judgedViable, redraws: redraws.length, problems: per };
    rows.push(row);
    writeFileSync(resolve(out, `${subject}.${mode}.g${grade}.json`), JSON.stringify({ row, problems }, null, 1));
    realLog(`${subject} ${mode} G${grade}: set ${set.judgedViable ? 'WORKSPACE' : 'TAP'} · redraws ${redraws.length} · `
      + per.map((p) => `${p.type}:${p.words}w:${p.viable ? 'ok' : 'X'}`).join(' '));
    for (const p of per) if (!p.viable) realLog(`   X ${p.stem}`);
  }
} finally {
  writeFileSync(resolve(out, 'summary.json'), JSON.stringify(rows, null, 1));
  await server.close();
}
