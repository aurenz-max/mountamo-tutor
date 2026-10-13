// Fit gate outliers: which primitive x mode most often misses its objective.
// Reads qa/fit-gate/ledger-*.jsonl (written by service/fitGate/fitLedger.ts on
// every generation) and ranks primitive/mode pairs by first-attempt failures.
// Each outlier is the next /eval-fix or /topic-fidelity item; the example rows
// show the objective and what was built.
//
//   node scripts/fit-gate-report.mjs [--days 7] [--min 3]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : dflt;
};
const days = arg('days', 7);
const minN = arg('min', 3);
const dir = process.env.LUMINA_FIT_LEDGER_DIR || join(process.cwd(), 'qa', 'fit-gate');
if (!existsSync(dir)) { console.log(`No ledger at ${dir}`); process.exit(0); }

const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
const rows = readdirSync(dir)
  .filter((f) => /^ledger-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f) && f.slice(7, 17) >= since)
  .flatMap((f) => readFileSync(join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));

const firsts = rows.filter((r) => r.verdict?.attempt === 0);
const redraws = rows.filter((r) => r.verdict?.attempt === 1);
const groups = new Map();
for (const r of firsts) {
  const key = `${r.componentId}/${r.evalMode ?? '-'}`;
  if (!groups.has(key)) groups.set(key, { key, n: 0, fail: 0, teaches: [], reasons: new Map(), examples: [] });
  const g = groups.get(key);
  g.n++;
  if (r.verdict.teaches != null) g.teaches.push(r.verdict.teaches);
  if (!r.verdict.pass) {
    g.fail++;
    for (const note of r.verdict.notes) {
      const reason = note.startsWith('Content check') ? note.split(' failed')[0] : note.split('.')[0];
      g.reasons.set(reason, (g.reasons.get(reason) ?? 0) + 1);
    }
    if (g.examples.length < 2) g.examples.push({ objective: r.objective, grade: r.grade, source: r.source, task: r.view?.tasks?.[0] });
  }
}
const fixed = redraws.filter((r) => r.verdict.pass).length;

console.log(`Fit gate, ledger since ${since}: ${firsts.length} generations, `
  + `${firsts.filter((r) => !r.verdict.pass).length} failed first try, ${redraws.length} redrawn, ${fixed} fixed by the redraw.\n`);
const ranked = [...groups.values()].sort((a, b) => b.fail - a.fail || b.fail / b.n - a.fail / a.n);
console.log('Outliers (first-try failures, n >= ' + minN + ' or any failure):');
for (const g of ranked) {
  if (g.fail === 0 && g.n < minN) continue;
  const mean = g.teaches.length ? (g.teaches.reduce((s, x) => s + x, 0) / g.teaches.length).toFixed(2) : '-';
  console.log(`- ${g.key.padEnd(36)} ${String(g.fail).padStart(3)}/${String(g.n).padEnd(3)} failed  mean teaches ${mean}`);
  for (const [reason, c] of [...g.reasons].sort((a, b) => b[1] - a[1]).slice(0, 2)) console.log(`    ${c}x ${reason}`);
  for (const e of g.examples) console.log(`    e.g. [${e.grade}${e.source ? `, ${e.source}` : ''}] "${String(e.objective).slice(0, 80)}" -> ${String(e.task ?? '').slice(0, 110)}`);
}
