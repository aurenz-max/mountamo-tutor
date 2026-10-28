// One generation draw per (subskill, primitive, mode) through the production eval-test dispatcher.
// Exact published text as topic + intent, grade 2. Saves the full response per draw.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(readFileSync(resolve(dir, 'sample.json'), 'utf8'));
const text = Object.fromEntries(sample.selected.flatMap(g => g.selectedSubskills.map(s => [s.id, s.description])));
const jobs = [
  ['OPS002-03-a', 'tape-diagram', 'solve_part_whole'],
  ['OPS002-03-a', 'tape-diagram', 'multi_step'],
  ['OPS002-03-c', 'tape-diagram', 'solve_comparison'],
  ['OPS002-03-c', 'tape-diagram', 'multi_step'],
  ['OPS002-04-a', 'addition-fact-strategies', 'doubles'],
  ['OPS002-04-a', 'addition-fact-strategies', 'big_facts'],
  ['OPS002-04-a', 'di-math-facts', 'answer_fact'],
  ['OPS002-04-c', 'math-fact-fluency', 'equation_solve'],
  ['OPS002-04-c', 'di-math-facts', 'subtraction_fact'],
  ['OPS002-01-a', 'regrouping-workbench', 'add_no_regroup'],
  ['OPS002-01-c', 'di-word-problem-setup', 'build_family'],
  ['OPS002-02-a', 'regrouping-workbench', 'subtract_no_regroup'],
  ['OPS002-02-b', 'regrouping-workbench', 'subtract_regroup'],
  ['OPS002-02-b', 'base-ten-blocks', 'regroup'],
  ['MEAS002-04-b', 'analog-clock', 'set_time'],
  ['MEAS002-04-b', 'time-sequencer', 'time-of-day'],
  ['MEAS002-04-c', 'time-sequencer', 'sequence-5'],
  ['MEAS002-04-c', 'timeline-builder', 'sequence-daily'],
].filter(([id]) => !process.argv[2] || process.argv[2].split(',').includes(id));
mkdirSync(resolve(dir, 'evidence'), { recursive: true });
async function worker() {
  for (;;) {
    const job = jobs.shift(); if (!job) return;
    const [id, primitive, mode] = job;
    const file = resolve(dir, 'evidence', `${id}-${primitive}-${mode}.json`);
    if (existsSync(file) && !process.argv.includes('--redraw')) { console.log('cached', id, primitive, mode); continue; }
    const params = new URLSearchParams({ componentId: primitive, evalMode: mode, topic: text[id], intent: text[id], grade: '2', gradeLevel: 'Grade 2', difficulty: 'medium' });
    const started = Date.now(); const record = { id, primitive, mode, requirement: text[id], params: Object.fromEntries(params), requestedAt: new Date().toISOString() };
    try { const r = await fetch(`http://localhost:3000/api/lumina/eval-test?${params}`, { signal: AbortSignal.timeout(240000) }); record.httpStatus = r.status; record.response = await r.json(); }
    catch (e) { record.transportError = String(e); }
    record.durationMs = Date.now() - started;
    writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
    console.log(JSON.stringify({ id, primitive, mode, http: record.httpStatus, status: record.response?.status, error: record.response?.error || record.transportError, ms: record.durationMs }));
  }
}
await Promise.all([worker(), worker(), worker()]);
