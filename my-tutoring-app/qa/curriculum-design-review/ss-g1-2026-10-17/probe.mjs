// One generation draw per (subskill, primitive, mode) through the production eval-test dispatcher.
// Exact published text as topic + intent, grade 1. Saves the full response per draw.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(readFileSync(resolve(dir, 'sample.json'), 'utf8'));
const text = Object.fromEntries(sample.selected.flatMap(g => g.selectedSubskills.map(s => [s.id, s.description])));
const jobs = [
  ['SS005-04-b', 'knowledge-check', 'recall'],
  ['SS005-04-b', 'word-sorter', 'match_pairs'],
  ['SS005-04-d', 'knowledge-check', 'apply'],
  ['SS005-04-d', 'story-bridge', 'venn_place'],
  ['SS005-03-c', 'knowledge-check', 'apply'],
  ['SS005-03-c', 'story-bridge', 'say_alike'],
  ['SS005-03-d', 'di-spoken-practice', 'explain_concept'],
  ['SS003-06-a', 'spatial-scene', 'identify'],
  ['SS003-06-a', 'spatial-scene', 'place_between'],
  ['SS003-06-a', 'vocabulary-explorer', 'recall'],
  ['SS003-06-c', 'spatial-scene', 'describe_scene'],
  ['SS003-06-c', 'spatial-scene', 'follow_directions'],
  ['SS004-02-c', 'timeline-builder', 'sequence-yearly'],
  ['SS004-02-c', 'calendar-explorer', 'month_sequence'],
  ['SS004-02-a', 'how-it-works', 'sequence'],
  ['SS004-02-a', 'timeline-explorer', 'order'],
  ['SS002-02-c', 'knowledge-check', 'apply'],
  ['SS002-02-c', 'di-spoken-practice', 'explain_concept'],
  ['SS002-02-a', 'knowledge-check', 'recall'],
  ['SS002-02-a', 'how-it-works', 'guided'],
].filter(([id]) => !process.argv[2] || process.argv[2].split(',').includes(id));
mkdirSync(resolve(dir, 'evidence'), { recursive: true });
async function worker() {
  for (;;) {
    const job = jobs.shift(); if (!job) return;
    const [id, primitive, mode] = job;
    const file = resolve(dir, 'evidence', `${id}-${primitive}-${mode}.json`);
    if (existsSync(file) && !process.argv.includes('--redraw')) { console.log('cached', id, primitive, mode); continue; }
    const params = new URLSearchParams({ componentId: primitive, evalMode: mode, topic: text[id], intent: text[id], grade: '1', gradeLevel: '1st Grade', difficulty: 'medium' });
    const started = Date.now(); const record = { id, primitive, mode, requirement: text[id], params: Object.fromEntries(params), requestedAt: new Date().toISOString() };
    try { const r = await fetch(`http://localhost:3000/api/lumina/eval-test?${params}`, { signal: AbortSignal.timeout(240000) }); record.httpStatus = r.status; record.response = await r.json(); }
    catch (e) { record.transportError = String(e); }
    record.durationMs = Date.now() - started;
    writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
    console.log(JSON.stringify({ id, primitive, mode, http: record.httpStatus, status: record.response?.status, error: record.response?.error || record.transportError, ms: record.durationMs }));
  }
}
await Promise.all([worker(), worker(), worker()]);
