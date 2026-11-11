// One generation draw per (subskill, primitive, mode) through the production eval-test dispatcher.
// Exact published text as topic + intent, grade 2. Saves the full response per draw.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(readFileSync(resolve(dir, 'sample.json'), 'utf8'));
const text = Object.fromEntries(sample.selected.flatMap(g => g.selectedSubskills.map(s => [s.id, s.description])));
const jobs = [
  ["GEOM002-02-a", "array-grid", "build_array"],
  ["GEOM002-02-a", "array-grid", "make_array"],
  ["GEOM002-02-b", "array-grid", "count_array"],
  ["OPS002-01-c", "addition-subtraction-scene", "solve_story"],
  ["OPS002-01-c", "di-word-problem-setup", "classify_and_build"],
  ["OPS002-01-c", "tape-diagram", "solve_part_whole"],
  ["OPS002-01-a", "regrouping-workbench", "add_no_regroup"],
  ["GEOM002-01-a", "shape-sorter", "count"],
  ["GEOM002-01-a", "shape-builder", "classify"],
  ["GEOM002-01-b", "shape-tracer", "draw_from_description"],
  ["GEOM002-01-b", "shape-builder", "make_shape"],
  ["GEOM002-03-a", "fraction-circles", "build"],
  ["GEOM002-03-a", "fraction-circles", "touch_fraction"],
  ["GEOM002-03-c", "fraction-circles", "build_equal"],
  ["GEOM002-03-c", "fraction-bar", "build_equal"],
  ["MEAS002-05-b", "coin-counter", "count-mixed"],
  ["MEAS002-05-c", "coin-counter", "make-amount"],
  ["MEAS002-05-c", "coin-counter", "show-amount"],
  ["MEAS002-05-c", "coin-counter", "make-change"],
].filter(([id]) => !process.argv[2] || process.argv[2].startsWith("--") || process.argv[2].split(",").includes(id));
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
