// Difficulty demo: does asking for a harder problem produce one?
//
// Same objective, three levels, two arms, judged blind:
//   prompt  — today's Pulse path: target_beta -> Bloom tier (recall / apply / analyze) in the
//             knowledge-check multiple-choice prompt. Nothing else changes.
//   struct  — the tier stays fixed ('apply'); code chooses the problem's structure for the level
//             (math: code draws the exact expression; non-math: a structural recipe) and the
//             generator only writes the item around it.
// A blind judge (no arm, no level) rates each item: expected % correct for a typical student at
// the grade, and the number of reasoning steps. A pairwise judge compares level 1 vs level 3 items
// of the same arm in random order. Math items also get code features (largest number, operations).
//
//   node scripts/difficulty-demo-probe.mjs --run [--n 6]
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate and judge items (about 150 Flash calls).');
  process.exit(0);
}
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const nArg = process.argv.indexOf('--n');
const N = nArg > 0 ? Number(process.argv[nArg + 1]) : 6;
const out = console.log.bind(console);
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) {
  console[method] = (...args) => logs.push(format(...args).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]'));
}

const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];

// ── Code-built structure per level ─────────────────────────────────────────
const add20 = {
  1: () => { const a = rand(1, 6); const b = rand(1, 10 - a); return pick([`${a} + ${b}`, `${a + b} - ${b}`]); },
  2: () => { const a = rand(6, 9); const b = rand(11 - a, 9); return pick([`${a} + ${b}`, `${a + b} - ${b}`]); },
  3: () => pick([
    () => { const a = rand(11, 14); const b = rand(20 - a - 3, 20 - a); const c = rand(3, 9); return `${a} + ${b} - ${c}`; },
    () => { const b = rand(6, 9); const t = rand(12, 17); return `? + ${b} = ${t} (find the missing number)`; },
    () => { const a = rand(13, 18); const b = rand(a - 9, 9); const c = rand(2, 9); return `${a} - ${b} + ${c}`; },
  ])(),
};
const mult100 = {
  1: () => { const a = pick([2, 5, 10]); const b = rand(2, 9); return pick([`${a} × ${b}`, `${a * b} ÷ ${a}`]); },
  2: () => { const a = rand(6, 9); const b = rand(6, 9); return pick([`${a} × ${b}`, `${a * b} ÷ ${a}`]); },
  3: () => pick([
    () => { const a = rand(6, 9); const b = rand(6, 9); return `? × ${a} = ${a * b} (find the missing factor)`; },
    () => { const a = rand(3, 8); const b = rand(4, 9); const c = rand(2, 9); return `${a} × ${b} + ${c} (two steps: equal groups, then some more)`; },
    () => { const a = rand(6, 9); const b = rand(3, 8); const c = rand(2, a * b - 1); return `${a} × ${b} - ${c} (two steps: equal groups, then some taken away)`; },
  ])(),
};
const habitatRecipe = {
  1: () => 'RECALL: name a familiar animal and one stated job ("Which body part does a duck use to swim?"). The answer is common knowledge. All wrong options are clearly unrelated body parts.',
  2: () => 'APPLY TO A NEW CASE: describe an animal the learner has probably not studied by its features and its habitat (do not rely on the name). Ask which feature helps it in THAT habitat. One wrong option is a real feature of the animal that does not help in that habitat.',
  3: () => 'INFER ACROSS TWO FACTS: describe a change to a habitat (for example a pond dries up, snow comes early) and two animals with different features. Ask which animal is more likely to survive the change. Every option names a real feature; each wrong option uses a real feature in the wrong situation. The learner must connect the change to the feature.',
};

const OBJECTIVES = [
  { key: 'add20', grade: '1', gradeLevel: 'elementary', text: 'Add and subtract within 20', build: add20, math: true },
  { key: 'mult100', grade: '3', gradeLevel: 'elementary', text: 'Multiply and divide within 100', build: mult100, math: true },
  { key: 'habitat', grade: '3', gradeLevel: 'elementary', text: "Explain how an animal's body parts help it survive in its habitat", build: habitatRecipe, math: false },
];
const PROMPT_TIER = { 1: 'recall', 2: 'apply', 3: 'analyze' }; // betaToBloomsTier at beta 1.5 / 3.5 / 5.0

const structContext = (o, spec) => o.math
  ? `${o.text}.\n\nTHE PROBLEM IS FIXED BY CODE: the question must ask exactly this computation and nothing more: ${spec}. `
    + 'You may put it in a short story or ask it bare, but keep these exact numbers and operations; the correct option is its result.'
  : `${o.text}.\n\nTHE PROBLEM SHAPE IS FIXED: ${spec}`;

// ── Code features (math) ───────────────────────────────────────────────────
const mathFeatures = (q) => {
  const nums = (q.match(/\d+/g) ?? []).map(Number);
  const ops = (q.match(/[+\-−×x÷*/]|\bplus\b|\bminus\b|\btimes\b|\bmore\b|\bleft\b|\baway\b|\beach\b/gi) ?? []).length;
  return { maxNumber: nums.length ? Math.max(...nums) : 0, numbers: nums.length, opWords: ops };
};

const root = process.cwd();
const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const items = [];
const pairs = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateMultipleChoiceProblems } = await loader.import('/src/components/lumina/service/knowledge-check/gemini-knowledge-check.ts');
  const { ai } = await loader.import('/src/components/lumina/service/geminiClient.ts');

  const json = async (prompt, schema) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await ai.models.generateContent({ model: 'gemini-flash-latest', contents: prompt,
          config: { responseMimeType: 'application/json', responseSchema: schema } });
        return JSON.parse(r.text);
      } catch (e) { if (attempt === 2) throw e; }
    }
  };

  // 1. Generate
  for (const o of OBJECTIVES) {
    for (const arm of ['prompt', 'struct']) {
      for (const level of [1, 2, 3]) {
        const jobs = Array.from({ length: N }, async () => {
          const spec = arm === 'struct' ? o.build[level]() : null;
          const tier = arm === 'prompt' ? PROMPT_TIER[level] : 'apply';
          const context = arm === 'prompt' ? o.text : structContext(o, spec);
          try {
            const [p] = await generateMultipleChoiceProblems(o.text, o.gradeLevel, 1, context, tier, undefined, o.grade);
            const key = p.options.find((x) => x.id === p.correctOptionId)?.text;
            items.push({ obj: o.key, arm, level, spec, tier, question: p.question,
              options: p.options.map((x) => x.text), answer: key, labelled: p.difficulty });
          } catch (e) { items.push({ obj: o.key, arm, level, spec, tier, error: String(e).slice(0, 200) }); }
        });
        await Promise.all(jobs);
        out(`generated ${o.key} ${arm} L${level}`);
      }
    }
  }

  // 2. Blind single-item judge
  const rateSchema = { type: 'object', properties: {
    pCorrect: { type: 'integer', description: 'Percent of typical students at this grade, taught this objective, who answer correctly (0-100).' },
    steps: { type: 'integer', description: 'Number of separate reasoning or computation steps needed.' },
    why: { type: 'string', description: 'One short sentence on what makes it easy or hard.' },
  }, required: ['pCorrect', 'steps', 'why'] };
  const ok = items.filter((it) => !it.error);
  await Promise.all(ok.map(async (it) => {
    const o = OBJECTIVES.find((x) => x.key === it.obj);
    const r = await json(`You rate how hard a test item is. Grade ${o.grade}. Objective: ${o.text}.\n\n`
      + `Question: ${it.question}\nOptions: ${it.options.join(' | ')}\nCorrect: ${it.answer}\n\n`
      + 'Rate it for a typical student at this grade who has been taught the objective.', rateSchema);
    Object.assign(it, { judgeP: r.pCorrect, judgeSteps: r.steps, judgeWhy: r.why });
    if (o.math) Object.assign(it, mathFeatures(it.question));
  }));
  out('judged items');

  // 3. Blind pairwise, L1 vs L3 within an arm
  const pairSchema = { type: 'object', properties: {
    harder: { type: 'string', enum: ['A', 'B', 'same'] }, why: { type: 'string' } }, required: ['harder', 'why'] };
  for (const o of OBJECTIVES) for (const arm of ['prompt', 'struct']) {
    const lo = ok.filter((x) => x.obj === o.key && x.arm === arm && x.level === 1);
    const hi = ok.filter((x) => x.obj === o.key && x.arm === arm && x.level === 3);
    const m = Math.min(lo.length, hi.length);
    await Promise.all(Array.from({ length: m }, async (_, i) => {
      const flip = Math.random() < 0.5;
      const [a, b] = flip ? [hi[i], lo[i]] : [lo[i], hi[i]];
      const r = await json(`Two test items for grade ${o.grade}, objective: ${o.text}. Which one would more typical students get wrong?\n\n`
        + `A: ${a.question}\n   Options: ${a.options.join(' | ')}\n\nB: ${b.question}\n   Options: ${b.options.join(' | ')}`, pairSchema);
      const level3 = r.harder === 'same' ? 'same' : ((r.harder === 'A') === flip ? 'L3' : 'L1');
      pairs.push({ obj: o.key, arm, harder: level3, why: r.why });
    }));
  }
  out('judged pairs');
} finally {
  await server.close();
}

// ── Report ─────────────────────────────────────────────────────────────────
const dir = resolve(root, 'qa/difficulty-demo/2026-10-13');
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'items.json'), JSON.stringify({ items, pairs }, null, 2));
const mean = (xs) => xs.length ? (xs.reduce((s, x) => s + x, 0) / xs.length) : NaN;
const f1 = (x) => Number.isNaN(x) ? '-' : x.toFixed(1);
const lines = ['| Objective | Arm | Level | n | Judge % correct | Judge steps | Largest number | Labelled hard |', '|---|---|---|---|---|---|---|---|'];
for (const o of OBJECTIVES) for (const arm of ['prompt', 'struct']) for (const level of [1, 2, 3]) {
  const cell = items.filter((x) => x.obj === o.key && x.arm === arm && x.level === level && !x.error);
  lines.push(`| ${o.key} | ${arm} | L${level} | ${cell.length} | ${f1(mean(cell.map((x) => x.judgeP)))} | ${f1(mean(cell.map((x) => x.judgeSteps)))} | `
    + `${o.math ? f1(mean(cell.map((x) => x.maxNumber))) : '-'} | ${cell.filter((x) => x.labelled === 'hard').length}/${cell.length} |`);
}
const pl = ['| Objective | Arm | L3 judged harder | L1 judged harder | same |', '|---|---|---|---|---|'];
for (const o of OBJECTIVES) for (const arm of ['prompt', 'struct']) {
  const ps = pairs.filter((p) => p.obj === o.key && p.arm === arm);
  pl.push(`| ${o.key} | ${arm} | ${ps.filter((p) => p.harder === 'L3').length} | ${ps.filter((p) => p.harder === 'L1').length} | ${ps.filter((p) => p.harder === 'same').length} |`);
}
const ex = [];
for (const o of OBJECTIVES) for (const arm of ['prompt', 'struct']) for (const level of [1, 3]) {
  const it = items.find((x) => x.obj === o.key && x.arm === arm && x.level === level && !x.error);
  if (it) ex.push(`- **${o.key} ${arm} L${level}** (judge ${it.judgeP}%, ${it.judgeSteps} steps): ${it.question.replace(/\n/g, ' ')} → ${it.answer}`);
}
writeFileSync(resolve(dir, 'tables.md'), `## Per cell\n\n${lines.join('\n')}\n\n## Pairwise L1 vs L3\n\n${pl.join('\n')}\n\n## One item per cell\n\n${ex.join('\n')}\n`);
writeFileSync(resolve(dir, 'logs.txt'), logs.join('\n'));
out(lines.join('\n')); out(''); out(pl.join('\n')); out(''); out(ex.join('\n'));
out(`errors: ${items.filter((x) => x.error).length}`);
