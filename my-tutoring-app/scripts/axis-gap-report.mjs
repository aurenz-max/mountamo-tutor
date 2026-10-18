// Context-axis gaps: what lessons asked a primitive for that its axis cannot express.
// Reads qa/fit-gate/axis-gaps-*.jsonl (written by service/contextAxis.ts) and ranks
// axis x gap by count. The top rows are the next mode or primitive to build.
//
//   node scripts/axis-gap-report.mjs [--days 30]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const i = process.argv.indexOf('--days');
const days = i > 0 ? Number(process.argv[i + 1]) : 30;
const dir = process.env.LUMINA_FIT_LEDGER_DIR || join(process.cwd(), 'qa', 'fit-gate');
if (!existsSync(dir)) { console.log(`No ledger at ${dir}`); process.exit(0); }

const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
const rows = readdirSync(dir)
  .filter((f) => /^axis-gaps-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f) && f.slice(10, 20) >= since)
  .flatMap((f) => readFileSync(join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));

const groups = new Map();
for (const r of rows) {
  for (const gap of r.gaps ?? []) {
    const key = `${r.axis} :: ${String(gap).toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { key, n: 0, examples: [] });
    const g = groups.get(key);
    g.n++;
    if (g.examples.length < 2 && r.objective) g.examples.push(`${r.grade}: ${r.objective.slice(0, 110)}`);
  }
}
const ranked = [...groups.values()].sort((a, b) => b.n - a.n);
console.log(`${rows.length} gap rows since ${since}\n`);
for (const g of ranked) {
  console.log(`${String(g.n).padStart(4)}  ${g.key}`);
  for (const e of g.examples) console.log(`        ${e}`);
}
