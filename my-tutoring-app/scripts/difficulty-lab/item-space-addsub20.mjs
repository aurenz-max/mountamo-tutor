// Difficulty lab: code owns the whole item space for one strand (G1 add/subtract within 20).
//
// 1. Enumerate every item: a ± b within 20, unknown position (result / change / start), one step;
//    plus two-step items a + b - c / a - b + c. Code computes the answer.
// 2. Compute each item's difficulty features and a predicted beta (a linear logistic test model:
//    beta = sum of feature weights; the weights are literature-shaped priors, to be refit on real
//    first-try data).
// 3. For a grid of target betas, sample items near the target (variety comes from sampling).
// 4. Distractors come from code: bug rules (off by one, wrong operation, the number shown,
//    smaller-from-larger) for near sets, far values for easy items.
// 5. The LLM writes the story only. A blind judge rates each item; we report the rank correlation
//    between predicted beta and judged difficulty, and the same for numeric jitter within one
//    structure (which should not move).
//
//   node scripts/difficulty-lab/item-space-addsub20.mjs --run [--per 4]
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';

if (!process.argv.includes('--run')) { console.log('Pass --run.'); process.exit(0); }
const key = process.env.GEMINI_API_KEY
  ?? readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m)?.[1].trim().replace(/^["']|["']$/g, '');
const ai = new GoogleGenAI({ apiKey: key, httpOptions: { timeout: 90000 } });
const perArg = process.argv.indexOf('--per');
const PER = perArg > 0 ? Number(process.argv[perArg + 1]) : 4;

// ── 1. Item space ──────────────────────────────────────────────────────────
const crosses = (a, b, op) => op === '+' ? (a % 10) + (b % 10) >= 10 : (a % 10) < (b % 10) && a >= 10;
const items = [];
for (let a = 0; a <= 20; a++) for (let b = 0; b <= 20; b++) {
  if (a + b <= 20) for (const unknown of ['result', 'change', 'start']) items.push({ steps: [{ a, b, op: '+' }], unknown });
  if (a - b >= 0 && a <= 20) for (const unknown of ['result', 'change', 'start']) items.push({ steps: [{ a, b, op: '-' }], unknown });
}
for (let a = 1; a <= 20; a++) for (let b = 1; b <= 20; b++) for (let c = 1; c <= 20; c++) {
  const m1 = a + b; if (m1 <= 20 && m1 - c >= 1) items.push({ steps: [{ a, b, op: '+' }, { a: m1, b: c, op: '-' }], unknown: 'result' });
  const m2 = a - b; if (m2 >= 1 && m2 + c <= 20) items.push({ steps: [{ a, b, op: '-' }, { a: m2, b: c, op: '+' }], unknown: 'result' });
}

// ── 2. Features and predicted beta ─────────────────────────────────────────
function features(it) {
  const s0 = it.steps[0];
  const all = it.steps;
  const small = Math.min(s0.a, s0.b);
  return {
    twoStep: all.length === 2 ? 1 : 0,
    bridges: all.filter((s) => crosses(s.a, s.b, s.op)).length,
    subtraction: all.some((s) => s.op === '-') ? 1 : 0,
    unknownChange: it.unknown === 'change' ? 1 : 0,
    unknownStart: it.unknown === 'start' ? 1 : 0,
    zeroOrOne: all.length === 1 && small <= 1 ? 1 : 0,
    countOnTwoThree: all.length === 1 && small >= 2 && small <= 3 ? 1 : 0,
    double: all.length === 1 && s0.op === '+' && s0.a === s0.b ? 1 : 0,
    tenPlus: all.length === 1 && (s0.a === 10 || s0.b === 10 || (s0.op === '-' && s0.b === 10)) ? 1 : 0,
    teen: all.some((s) => Math.max(s.a, s.op === '+' ? s.a + s.b : s.a) > 10) ? 1 : 0,
    size: Math.min(s0.a, s0.b) / 10, // problem-size effect on the smaller operand
  };
}
// Priors in logits; the shape follows the early-arithmetic literature (bridging ten, unknown
// position, subtraction, ties and +1 facts). To be refit from real first-try results.
const W = { base: -1.6, twoStep: 1.1, bridges: 1.0, subtraction: 0.4, unknownChange: 0.8, unknownStart: 1.5,
  zeroOrOne: -0.8, countOnTwoThree: -0.3, double: -0.5, tenPlus: -0.6, teen: 0.3, size: 0.8 };
const predict = (f) => W.base + Object.entries(f).reduce((s, [k, v]) => s + (W[k] ?? 0) * v, 0);
for (const it of items) { it.f = features(it); it.beta = predict(it.f); }

// ── 3. Sample by target ────────────────────────────────────────────────────
const signature = (it) => JSON.stringify({ ...it.f, size: undefined });
function sampleNear(target, n) {
  const near = items.filter((it) => Math.abs(it.beta - target) <= 0.25);
  const out = []; const usedSig = new Map();
  for (const it of near.sort(() => Math.random() - 0.5)) {
    const sig = signature(it);
    if ((usedSig.get(sig) ?? 0) >= 2) continue; // vary structure inside a level, not only digits
    usedSig.set(sig, (usedSig.get(sig) ?? 0) + 1);
    out.push(it); if (out.length === n) break;
  }
  return out;
}

// ── 4. Answers and code distractors ────────────────────────────────────────
function solve(it) {
  if (it.steps.length === 2) {
    const [s1, s2] = it.steps; const m = s1.op === '+' ? s1.a + s1.b : s1.a - s1.b;
    return { answer: s2.op === '+' ? m + s2.b : m - s2.b, shown: [s1.a, s1.b, s2.b], expr: `${s1.a} ${s1.op} ${s1.b} ${s2.op} ${s2.b}` };
  }
  const { a, b, op } = it.steps[0]; const r = op === '+' ? a + b : a - b;
  if (it.unknown === 'result') return { answer: r, shown: [a, b], expr: `${a} ${op} ${b} = ?` };
  if (it.unknown === 'change') return { answer: b, shown: [a, r], expr: `${a} ${op} ? = ${r}` };
  return { answer: a, shown: [b, r], expr: `? ${op} ${b} = ${r}` };
}
function distractors(it, answer, shown) {
  const near = it.beta >= 0;
  const set = new Set();
  const add = (v) => { if (Number.isInteger(v) && v >= 0 && v <= 30 && v !== answer) set.add(v); };
  if (near) {
    const { a, b, op } = it.steps[0];
    if (it.unknown !== 'result') add(shown[0] + shown[1]); // added the two numbers shown
    if (it.unknown === 'start' && op === '+') add(shown[1] - shown[0] === answer ? shown[1] : shown[1]); // the total shown
    if (op === '-' && crosses(a, b, '-')) add(10 * Math.floor(a / 10) - 10 * Math.floor(b / 10) + Math.abs((a % 10) - (b % 10))); // smaller from larger
    add(op === '+' ? Math.abs(a - b) : a + b); // wrong operation
    add(answer + 1); add(answer - 1);
  } else {
    add(answer + 5); add(answer + 8); add(Math.max(0, answer - 4));
  }
  const pool = [...set].slice(0, 3);
  while (pool.length < 3) { const v = answer + pool.length + 3; if (!pool.includes(v)) pool.push(v); }
  return pool;
}

// ── 5. LLM writes the story; blind judge ───────────────────────────────────
async function json(prompt, schema, model = 'gemini-flash-lite-latest') {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: 'application/json', responseSchema: schema } });
      return JSON.parse(r.text);
    } catch (e) { if (i === 2) throw e; }
  }
}
const storySchema = { type: Type.OBJECT, properties: { question: { type: Type.STRING } }, required: ['question'] };
const unknownWords = { result: 'the result is unknown (how many in the end)', change: 'the amount added or taken is unknown', start: 'the starting amount is unknown' };
async function word(it, sol) {
  const r = await json(`Write ONE short word problem for a first grader (one or two short sentences, everyday objects).\n`
    + `It must be exactly this computation: ${sol.expr}${it.steps.length === 1 ? `; ${unknownWords[it.unknown]}` : ' (two steps, in this order)'}.\n`
    + `The answer is ${sol.answer}. Use only these numbers in the story: ${sol.shown.join(', ')}. Do not state the answer or the equation.`, storySchema);
  return r.question;
}
const rateSchema = { type: Type.OBJECT, properties: {
  pCorrect: { type: Type.INTEGER, description: 'Percent of typical first graders, taught this, who answer correctly (0-100).' },
  why: { type: Type.STRING } }, required: ['pCorrect', 'why'] };
const judge = (q, options) => json(`You rate how hard a test item is for first graders who were taught addition and subtraction within 20.\n\n`
  + `Question: ${q}\nOptions: ${options.join(' | ')}\n\nRate it.`, rateSchema);

// ── Run ────────────────────────────────────────────────────────────────────
const TARGETS = [-1.5, -0.75, 0, 0.75, 1.5, 2.25, 3.0];
const chosen = TARGETS.flatMap((t) => sampleNear(t, PER).map((it) => ({ ...it, target: t })));
// Jitter control: one structure (one step, result unknown, addition, no bridging), different digits.
const jitter = items.filter((it) => it.steps.length === 1 && it.unknown === 'result' && it.steps[0].op === '+'
  && !it.f.bridges && !it.f.zeroOrOne && !it.f.double && !it.f.tenPlus && !it.f.teen)
  .sort(() => Math.random() - 0.5).slice(0, PER > 1 ? 6 : 3).map((it) => ({ ...it, target: 'jitter' }));
let done = 0;
const rows = await Promise.all([...chosen, ...jitter].map(async (it) => {
  const sol = solve(it);
  const options = [sol.answer, ...distractors(it, sol.answer, sol.shown)].sort(() => Math.random() - 0.5).map(String);
  const question = await word(it, sol);
  const j = await judge(question, options);
  if (++done % 5 === 0) console.log(`done ${done}`);
  const shownOk = sol.shown.every((n) => question.includes(String(n))) && !new RegExp(`\\b${sol.answer}\\b`).test(question.replace(new RegExp(sol.shown.map((n) => `\\b${n}\\b`).join('|'), 'g'), ''));
  return { target: it.target, beta: +it.beta.toFixed(2), expr: sol.expr, answer: sol.answer, options, question, judgeP: j.pCorrect, why: j.why, shownOk,
    features: Object.fromEntries(Object.entries(it.f).filter(([, v]) => v)) };
}));

// Spearman between predicted beta and judged difficulty (100 - pCorrect)
const rank = (xs) => { const s = xs.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = Array(xs.length);
  for (let i = 0; i < s.length;) { let j = i; while (j + 1 < s.length && s[j + 1][0] === s[i][0]) j++; for (let k = i; k <= j; k++) r[s[k][1]] = (i + j) / 2; i = j + 1; } return r; };
const spearman = (x, y) => { const rx = rank(x), ry = rank(y); const n = x.length; const mx = (n - 1) / 2;
  let num = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - mx); dx += (rx[i] - mx) ** 2; dy += (ry[i] - mx) ** 2; } return num / Math.sqrt(dx * dy); };
const main = rows.filter((r) => r.target !== 'jitter');
const rho = spearman(main.map((r) => r.beta), main.map((r) => 100 - r.judgeP));
const jit = rows.filter((r) => r.target === 'jitter');

const dir = resolve('qa/difficulty-demo/2026-10-13');
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'item-space-addsub20.json'), JSON.stringify({ itemSpace: items.length, weights: W, rho, rows }, null, 2));
console.log(`item space: ${items.length} items; sampled ${main.length}; Spearman(predicted beta, judged difficulty) = ${rho.toFixed(2)}`);
for (const t of TARGETS) {
  const cell = main.filter((r) => r.target === t);
  console.log(`\nbeta ${t}: judge mean ${(cell.reduce((s, r) => s + r.judgeP, 0) / cell.length).toFixed(0)}% correct`);
  for (const r of cell) console.log(`  [${r.beta}] ${r.expr.padEnd(14)} judge ${String(r.judgeP).padStart(3)}%  ${r.shownOk ? '' : '(story drift) '}| ${r.question} | ${r.options.join(' / ')}`);
}
console.log(`\njitter control (same structure, different digits): ${jit.map((r) => `${r.expr} ${r.judgeP}%`).join(', ')}`);
