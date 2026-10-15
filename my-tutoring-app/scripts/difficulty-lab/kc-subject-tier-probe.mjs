// Subject x grade x tier probe: knowledge-check through the real registry generator (the lesson path),
// config.difficulty easy / medium / hard, one objective per row. Saves every generated problem to
// --out <dir> as <label>.json plus a compact summary.txt, to judge whether the tiers differ by subject.
//
//   node scripts/difficulty-lab/kc-subject-tier-probe.mjs --run --out qa/difficulty-demo/<date>/kc-subjects [--only math] [--count 4]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) { console.log('Pass --run.'); process.exit(0); }
if (!process.env.GEMINI_API_KEY) {
  const m = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
}
process.env.LUMINA_FIT_GATE = 'off';
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const OUT = resolve(arg('--out', 'qa/difficulty-demo/kc-subjects'));
const ONLY = arg('--only');
const GRADES = arg('--grades')?.split(',');
const COUNT = Number(arg('--count', 4));
mkdirSync(OUT, { recursive: true });
const out = console.log.bind(console);
const logs = [];
for (const m of ['log', 'warn', 'error', 'info', 'debug']) console[m] = (...a) => logs.push(format(...a));

const ROWS = [
  ['math', 'K', 'Count objects to tell how many, up to 10'],
  ['math', '1', 'Add and subtract within 20'],
  ['math', '2', 'Tell and write time to the nearest five minutes'],
  ['math', '4', 'Compare two fractions with different numerators and denominators'],
  ['math', '5', 'Add and subtract fractions with unlike denominators'],
  ['science', 'K', 'Plants and animals need water, air, and food to live'],
  ['science', '2', 'Describe and classify materials as solid or liquid by their properties'],
  ['science', '4', 'Energy moves from place to place by sound, light, heat, and electric currents'],
  ['science', '5', 'Plants get the materials they need for growth mainly from air and water'],
  ['literacy', 'K', 'Identify the beginning sound in a spoken word'],
  ['literacy', '1', 'Read words with final -e and long vowel sounds'],
  ['literacy', '3', 'Determine the main idea of a text and the key details that support it'],
  ['literacy', '5', 'Use context clues to figure out the meaning of unknown words'],
].filter(([s, g]) => (!ONLY || s === ONLY) && (!GRADES || GRADES.includes(g)));
const TIERS = ['easy', 'medium', 'hard'];

const line = (p) => {
  const stem = (p.question ?? p.statement ?? p.textWithBlanks ?? p.instruction ?? p.prompt ?? '').replace(/\s+/g, ' ');
  const opts = (p.options ?? []).map((o) => `${o.text}${o.id === p.correctOptionId ? '*' : o.distance ? `(${o.distance[0]})` : ''}`).join(' | ');
  const extra = p.blanks ? ` blanks=${p.blanks.length}` : p.categorizationItems ? ` items=${p.categorizationItems.length}` : p.items ? ` steps=${p.items.length}` : p.leftItems ? ` pairs=${p.leftItems.length}` : p.categories ? ` cats=${p.categories.length}` : '';
  const inset = p.inset ? ` inset=${p.inset.insetType}` : '';
  const space = p.itemSpace ? ` itemSpace β${p.itemSpace.beta}` : '';
  const miss = p.tierMisses?.length ? `  !! ${p.tierMisses.join('; ')}` : '';
  return `[${p.type}/${p.difficulty ?? '-'}${extra}${inset}${space}] ${stem}${opts ? `  {${opts}}` : ''}${miss}`;
};

const root = process.cwd();
const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const summary = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateComponentContent } = await loader.import('/src/components/lumina/service/geminiService.ts');
  const { checkTierShape } = await loader.import('/src/components/lumina/service/knowledge-check/knowledgeCheckTier.ts');
  const gradeBand = (g) => (g === 'K' ? 'kindergarten' : 'elementary');
  await Promise.all(ROWS.map(async ([subject, grade, objective]) => {
    for (const difficulty of TIERS) {
      const label = `${subject}-g${grade}-${difficulty}`;
      const item = { componentId: 'knowledge-check', instanceId: label, title: objective, intent: objective,
        config: { intent: objective, objectiveText: objective, objectiveGrade: grade, count: COUNT, difficulty } };
      let res; let err;
      try { res = await generateComponentContent(item, objective, gradeBand(grade)); } catch (e) { err = String(e); }
      const problems = res?.data?.problems ?? [];
      const band = grade === 'K' ? 'kindergarten' : 'elementary';
      for (const p of problems) if (!p.itemSpace) p.tierMisses = checkTierShape(p, difficulty, band, grade);
      writeFileSync(resolve(OUT, `${label}.json`), JSON.stringify({ subject, grade, objective, difficulty, err, problems }, null, 1));
      summary.push({ key: `${subject}|${grade}|${TIERS.indexOf(difficulty)}`, text:
        `\n## ${subject} G${grade} ${difficulty.toUpperCase()} — ${objective}${err ? `\n  ERROR ${err}` : ''}\n${problems.map((p) => `  ${line(p)}`).join('\n')}` });
      out(`done ${label} (${problems.length})`);
    }
  }));
} finally { await server.close(); }
summary.sort((a, b) => a.key.localeCompare(b.key));
writeFileSync(resolve(OUT, 'summary.txt'), summary.map((s) => s.text).join('\n'));
writeFileSync(resolve(OUT, 'logs.txt'), logs.join('\n'));
out(`wrote ${OUT}`);
