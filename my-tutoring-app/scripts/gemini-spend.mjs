// Today's Gemini spend from the ledger spendMeter.ts writes (<repo>/.gemini-spend/<PST date>.jsonl). Free: no API call.
//   node scripts/gemini-spend.mjs [YYYY-MM-DD]
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const day = process.argv[2] || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
const file = resolve(process.env.LUMINA_SPEND_DIR || resolve(import.meta.dirname, '../../.gemini-spend'), `${day}.jsonl`);
if (!existsSync(file)) { console.log(`No Gemini calls recorded for ${day}.`); process.exit(0); }

const by = (key) => new Map();
const sources = by(), models = by(), labels = by();
let total = 0, calls = 0;
const add = (m, k, usd) => { const v = m.get(k) ?? { usd: 0, n: 0 }; v.usd += usd; v.n += 1; m.set(k, v); };
for (const line of readFileSync(file, 'utf8').split('\n')) {
  if (!line) continue;
  let r; try { r = JSON.parse(line); } catch { continue; }
  total += r.usd; calls += 1;
  add(sources, r.source, r.usd); add(models, r.model, r.usd); if (r.label) add(labels, `${r.source}:${r.label}`, r.usd);
}
const cap = Number(process.env.LUMINA_AGENT_DAILY_USD || 5);
const show = (title, m, top = 10) => {
  console.log(`\n${title}`);
  for (const [k, v] of [...m].sort((a, b) => b[1].usd - a[1].usd).slice(0, top)) console.log(`  $${v.usd.toFixed(2).padStart(7)}  ${String(v.n).padStart(6)} calls  ${k}`);
};
console.log(`Gemini spend ${day} (PST): $${total.toFixed(2)} over ${calls} calls (estimate; the Google bill is the truth)`);
const auto = (sources.get('agent')?.usd ?? 0) + (sources.get('harness')?.usd ?? 0);
console.log(`Automated (agent + test routes): $${auto.toFixed(2)} of the $${cap.toFixed(2)} cap`);
show('By source', sources); show('By model', models); show('Top labels', labels);
