#!/usr/bin/env node
/**
 * Jev (TypeSafe System One) vs Gemini Decisions (`gemini-decision-1`) on the JEV observation kinds, with the
 * kinds' own questions, decisions and labelled case sets: item_score, learner_intent (every domain), and
 * assignment_outcome (the dialogue observer, the one kind with a runtime consumer). Runs in-process through
 * vite's module runner; no dev server.
 *
 *   node scripts/decisions-bench.mjs [--runs 2] [--models jev-latest,gemini-decision-1] [--kinds item,intent,dialogue] [out.json]
 *
 * spoken_miss has its own generator of cases; run it per model with
 *   LUMINA_SYSTEM_ONE_MODEL=gemini-decision-1 node scripts/spoken-miss-probe.mjs
 *
 * Per kind and model: pass rate, the safety count each probe treats as must-be-zero (false credit, false
 * help/stop request, false advance), run-to-run flips, latency, and for item_score the Brier score.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as IS from './cases/item-score-cases.mjs';
import * as LI from './cases/learner-intent-cases.mjs';
import { DIALOGUE_CASES, dialogueRequest } from './cases/dialogue-cases.mjs';

const ROOT = process.cwd();
if (!existsSync(join(ROOT, 'node_modules', 'vite'))) { console.error('run from my-tutoring-app'); process.exit(1); }
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(TYPESAFE_[A-Z_]+|GEMINI_API_KEY)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const argv = process.argv.slice(2);
const opt = (name, dflt) => argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : dflt;
const RUNS = Number(opt('runs', '2'));
const MODELS = opt('models', 'jev-latest,gemini-decision-1').split(',');
const KINDS = opt('kinds', 'item,intent,dialogue').split(',');
const OUT = argv.find(a => a.endsWith('.json')) || `qa/typesafe/decisions-bench-${new Date().toISOString().slice(0, 10)}.json`;

const vite = await import(pathToFileURL(join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
const server = await vite.createServer({ configFile: false, root: ROOT, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(ROOT, 'src'), 'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts') } } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const L = '/src/components/lumina/service/typesafe';
const { systemOne } = await runner.import('/src/components/lumina/service/manifest/typesafe/typesafeClient.ts');
const { itemScoreKind } = await runner.import(`${L}/observeItemScore.ts`);
const { learnerIntentKind } = await runner.import(`${L}/observeLearnerIntent.ts`);
const { assignmentOutcomeKind } = await runner.import(`${L}/observeDialogue.ts`);

/** runObservation without the TypeSafe-key gate and with the model chosen per call; same state, questions, decide. */
async function observe(kind, request, model) {
  const t0 = performance.now();
  try {
    const questions = typeof kind.questions === 'function' ? kind.questions(request) : kind.questions;
    const r = await systemOne(kind.state(request), questions, { model, signal: AbortSignal.timeout(15000) });
    return { ...kind.decide(request, r.answers, r.ms, r.model), raw: r.answers, tokens: r.usage?.input_tokens };
  } catch (e) { return { ...kind.abstain('unavailable', Math.round(performance.now() - t0)), error: String(e.message || e).slice(0, 200) }; }
}

async function pool(items, limit, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

// ── case builders: each returns [{ id, kind, request, score(decision) -> { pass, unsafe, brier? } }] ──
function itemCases() {
  return IS.CASES.map(([name, item, learner, tutor, label, priorTutor]) => ({ id: `item/${name}`, kind: itemScoreKind,
    request: { scope: { sessionEpoch: 'bench', instanceId: 'bench', itemId: name }, attemptIndex: 0, ...item, learner, tutor, ...(priorTutor ? { priorTutor } : {}) },
    score: d => {
      const p = d.learnerCorrect;
      const grade = !d.accepted || typeof p !== 'number' ? 'unclear' : p >= 0.8 ? 'correct' : p <= 0.2 ? 'not_correct' : 'unclear';
      const want = label === true ? 'correct' : label === false ? 'not_correct' : 'unclear';
      return { pass: grade === want, unsafe: label === false && grade === 'correct', reading: grade, p, label,
        brier: typeof p === 'number' && label !== null ? (p - (label ? 1 : 0)) ** 2 : undefined };
    } }));
}
function intentCases() {
  const sets = [['counting-board', LI.CASES], ...Object.values(LI.DOMAINS)];
  return sets.flatMap(([dom, cases]) => cases.map(([name, learner, want, context = LI.COUNT]) => ({ id: `intent/${dom}/${name}`, kind: learnerIntentKind,
    request: { scope: { sessionEpoch: 'bench', instanceId: 'fish', itemId: 'c1' }, turnId: name, task: context.task, priorTutor: context.priorTutor, learner },
    score: d => ({ pass: d.accepted === true && LI.agrees(d.asksForHelp, want.help) && LI.agrees(d.wantsToStop, want.stop) && LI.agreesAnswer(d.attemptsAnswer, want.answer),
      unsafe: d.accepted === true && ((want.help === false && d.asksForHelp >= LI.YES) || (want.stop === false && d.wantsToStop >= LI.YES)),
      reading: d.accepted ? `h${d.asksForHelp?.toFixed(1)} s${d.wantsToStop?.toFixed(1)} a${d.attemptsAnswer?.toFixed(1)}` : d.reason }) })));
}
function dialogueCases() {
  return DIALOGUE_CASES.map(c => ({ id: `dialogue/${c[0]}`, kind: assignmentOutcomeKind, request: dialogueRequest(c),
    score: d => { const actual = d.accepted ? d.transition : 'none';
      return { pass: actual === c[3], unsafe: actual === 'advance' && c[3] !== 'advance', reading: actual }; } }));
}

const cases = [...(KINDS.includes('item') ? itemCases() : []), ...(KINDS.includes('intent') ? intentCases() : []),
  ...(KINDS.includes('dialogue') ? dialogueCases() : [])];
const jobs = MODELS.flatMap(model => Array.from({ length: RUNS }, (_, rep) => cases.map(c => ({ model, rep, c })))).flat();
console.log(`${cases.length} cases × ${RUNS} runs × ${MODELS.length} models = ${jobs.length} calls`);
const rows = await pool(jobs, 6, async ({ model, rep, c }) => {
  const d = await observe(c.kind, c.request, model);
  return { model, rep, id: c.id, ms: d.ms, tokens: d.tokens, error: d.error, ...c.score(d) };
});

// ── report ─────────────────────────────────────────────────────────────────
const q = (xs, f) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length * f)] : NaN; };
const summary = [];
for (const kind of ['item', 'intent', 'dialogue']) for (const model of MODELS) {
  const rs = rows.filter(r => r.model === model && r.id.startsWith(kind + '/'));
  if (!rs.length) continue;
  const byCase = Object.groupBy(rs, r => r.id);
  const flips = Object.values(byCase).filter(g => new Set(g.map(r => r.reading)).size > 1).length;
  const briers = rs.map(r => r.brier).filter(Number.isFinite);
  summary.push({ kind, model, n: rs.length, pass: rs.filter(r => r.pass).length, unsafe: rs.filter(r => r.unsafe).length,
    errors: rs.filter(r => r.error).length, flips, cases: Object.keys(byCase).length,
    brier: briers.length ? +(briers.reduce((a, b) => a + b, 0) / briers.length).toFixed(3) : null,
    p50: q(rs.map(r => r.ms), .5), p90: q(rs.map(r => r.ms), .9),
    tokensPerCall: Math.round(rs.reduce((a, r) => a + (r.tokens || 0), 0) / rs.length) });
}
console.table(summary.map(s => ({ ...s, pass: `${s.pass}/${s.n} (${Math.round(100 * s.pass / s.n)}%)` })));
// Cases where the two models disagree on pass in the majority of runs: the rows to read.
const verdict = (id, model) => { const g = rows.filter(r => r.id === id && r.model === model); return g.filter(r => r.pass).length * 2 > g.length; };
const disagreements = [...new Set(rows.map(r => r.id))].filter(id => MODELS.length > 1 && new Set(MODELS.map(m => verdict(id, m))).size > 1)
  .map(id => ({ id, ...Object.fromEntries(MODELS.map(m => [m, rows.filter(r => r.id === id && r.model === m).map(r => `${r.pass ? 'P' : 'F'}:${r.reading}`).join(' ')])) }));
console.log('\nDisagreements (majority pass differs):');
for (const d of disagreements) console.log(' ', JSON.stringify(d));
const errs = rows.filter(r => r.error).slice(0, 5);
if (errs.length) console.log('\nFirst errors:', errs.map(r => `${r.model} ${r.id}: ${r.error}`));
writeFileSync(OUT, JSON.stringify({ date: new Date().toISOString(), runs: RUNS, models: MODELS, summary, disagreements, rows }, null, 2));
console.log(`\nsaved ${OUT}`);
await server.close();
