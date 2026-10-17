// One generation draw per (subskill, primitive, mode) through the production eval-test dispatcher.
// Exact published text as topic + intent, grade K. Saves the full response per draw.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(readFileSync(resolve(dir, 'sample.json'), 'utf8'));
const text = Object.fromEntries(sample.selected.flatMap(g => g.selectedSubskills.map(s => [s.id, s.description])));
const jobs = [
  ['SCI003-01-D', 'media-player', 'listen_and_look'],
  ['SCI003-01-D', 'knowledge-check', 'recall'],
  ['SCI003-01-D', 'di-spoken-practice', 'say_answer'],
  ['SCI003-01-G', 'bar-model', 'make_graph'],
  ['SCI003-01-G', 'bar-model', 'say_what_it_shows'],
  ['SCI003-01-G', 'bar-model', 'compare_two_graphs'],
  ['SCI001-03-G', 'how-it-works', 'guided'],
  ['SCI001-03-G', 'knowledge-check', 'recall'],
  ['SCI001-03-H', 'how-it-works', 'guided'],
  ['SCI001-03-H', 'how-it-works', 'sequence'],
  ['SCI004-01-G', 'ramp-lab', 'compare_conditions'],
  ['SCI004-01-G', 'tower-stacker', 'build_tall'],
  ['SCI004-01-F', 'gravity-drop-tower', 'predict'],
  ['SCI004-01-F', 'open-builder', 'build_to_goal'],
  ['SCI001-02-H', 'reaction-lab', 'predict'],
  ['SCI001-02-H', 'reaction-lab', 'observe'],
  ['SCI001-02-F', 'matter-explorer', 'sort'],
  ['SCI001-02-F', 'matter-explorer', 'property'],
  ['SCI002-02-E', 'media-player', 'listen_and_look'],
  ['SCI002-02-E', 'di-spoken-practice', 'explain_concept'],
  ['SCI002-02-E', 'knowledge-check', 'recall'],
  ['SCI002-02-B', 'habitat-diorama', 'build_habitat'],
  ['SCI002-02-B', 'sorting-station', 'sort_attribute'],
].filter(([id]) => !process.argv[2] || process.argv[2].split(',').includes(id));
mkdirSync(resolve(dir, 'evidence'), { recursive: true });
async function worker() {
  for (;;) {
    const job = jobs.shift(); if (!job) return;
    const [id, primitive, mode] = job;
    const file = resolve(dir, 'evidence', `${id}-${primitive}-${mode}.json`);
    if (existsSync(file) && !process.argv.includes('--redraw')) { console.log('cached', id, primitive, mode); continue; }
    const params = new URLSearchParams({ componentId: primitive, evalMode: mode, topic: text[id], intent: text[id], grade: 'K', gradeLevel: 'Kindergarten', difficulty: 'medium' });
    const started = Date.now(); const record = { id, primitive, mode, requirement: text[id], params: Object.fromEntries(params), requestedAt: new Date().toISOString() };
    try { const r = await fetch(`http://localhost:3000/api/lumina/eval-test?${params}`, { signal: AbortSignal.timeout(240000) }); record.httpStatus = r.status; record.response = await r.json(); }
    catch (e) { record.transportError = String(e); }
    record.durationMs = Date.now() - started;
    writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
    console.log(JSON.stringify({ id, primitive, mode, http: record.httpStatus, status: record.response?.status, error: record.response?.error || record.transportError, ms: record.durationMs }));
  }
}
await Promise.all([worker(), worker(), worker()]);
