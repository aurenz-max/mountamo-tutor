#!/usr/bin/env node
/**
 * Replays saved verdict-probe runs (`scripts/tutor-verdict-probe.mjs` output) through the CURRENT
 * `decideDialogue`, so a change to the observer's decision rule is measured on the same real model
 * answers the saved run recorded — no new model calls. Compares against the decision the run recorded.
 *
 *   node scripts/observer-rule-replay.mjs <run.json|dir> ...
 *
 * Counts per file: pass (matches the case's expected verdict/transition), false credit (success
 * recorded where none was expected), and dead ends: a spoken answer whose finished tutor reply was a real
 * verdict (the case expects advance or retry), left with no transition — the child is stranded.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const files = process.argv.slice(2).flatMap(p => statSync(p).isDirectory()
  ? readdirSync(p).filter(f => f.endsWith('.json')).map(f => join(p, f)) : [p]);
const vite = await import('vite');
const server = await vite.createServer({ root: ROOT, configFile: false, appType: 'custom', logLevel: 'error',
  resolve: { alias: { '@': resolve(ROOT, 'src'), 'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts') } },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const { decideDialogue } = await runner.import('/src/components/lumina/service/typesafe/observeDialogue.ts');

const got = d => ({ verdict: d.accepted ? d.verdict : 'none', transition: d.accepted ? d.transition : 'none', confirm: !d.accepted || d.transition === 'none' ? !!d.replyFinished : false });
const finished = r => { const p = r.result?.assessment?.answers?.feedback?.probabilities; return !!p && p.finished > p.open; };
const spokenAnswer = r => !!r.input.pendingResponse && r.input.activity?.facts?.response === 'speech';
function score(rows, pick) {
  const s = { n: rows.length, pass: 0, falseCredit: 0, deadEnd: 0, confirm: 0, retryNotCredited: 0 };
  for (const r of rows) {
    const d = pick(r);
    if (r.expected.some(e => e.verdict === d.verdict && e.transition === d.transition)) s.pass++;
    if (d.verdict === 'correct' && r.expected.every(e => e.verdict !== 'correct')) s.falseCredit++;
    // Stranded: the reply was a real verdict (the case expects credit or a retry), yet nothing moved.
    if (d.confirm) s.confirm++;
    // A praised-but-wrong answer ("none" expected) that now reopens for a retry: not credited, never stranded.
    if (d.transition === 'retry' && r.expected.every(e => e.verdict === 'none')) s.retryNotCredited++;
    if (spokenAnswer(r) && finished(r) && d.transition === 'none' && !d.confirm && r.expected.every(e => e.transition !== 'none')) s.deadEnd++;
  }
  return s;
}
const total = { old: { n: 0, pass: 0, falseCredit: 0, deadEnd: 0, confirm: 0, retryNotCredited: 0 }, now: { n: 0, pass: 0, falseCredit: 0, deadEnd: 0, confirm: 0, retryNotCredited: 0 } };
for (const file of files) {
  const rows = JSON.parse(readFileSync(file, 'utf8')).filter(r => r.result?.assessment?.answers);
  const old = score(rows, r => got(r.result));
  const now = score(rows, r => got(decideDialogue(r.input, r.result.assessment.answers, 0)));
  for (const k of ['n', 'pass', 'falseCredit', 'deadEnd', 'confirm', 'retryNotCredited']) { total.old[k] += old[k]; total.now[k] += now[k]; }
  console.log(`${file.split(/[\\/]/).pop().padEnd(16)} recorded: ${old.pass}/${old.n} pass, false credit ${old.falseCredit}, dead ends ${old.deadEnd}`
    + `  |  current rule: ${now.pass}/${now.n} pass, false credit ${now.falseCredit}, dead ends ${now.deadEnd}`);
  for (const r of rows) {
    const a = got(r.result), b = got(decideDialogue(r.input, r.result.assessment.answers, 0));
    if (a.verdict !== b.verdict || a.transition !== b.transition) console.log(`   changed ${r.name}: ${a.verdict}/${a.transition} -> ${b.verdict}/${b.transition}`
      + ` (expected ${r.expected.map(e => e.verdict + '/' + e.transition).join(' or ')}) p=${JSON.stringify(r.result.assessment.answers.verdict.probabilities)}`);
  }
}
console.log(`\nTOTAL recorded ${total.old.pass}/${total.old.n}, false credit ${total.old.falseCredit}, dead ends ${total.old.deadEnd}`
  + `  |  current rule ${total.now.pass}/${total.now.n}, false credit ${total.now.falseCredit}, dead ends ${total.now.deadEnd}`);
await server.close();
