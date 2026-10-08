// One generation draw per (subskill, primitive, mode) through the production eval-test dispatcher.
// Exact published text as topic + intent, grade 2. Saves the full response per draw.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(readFileSync(resolve(dir, 'sample.json'), 'utf8'));
const text = Object.fromEntries(sample.selected.flatMap(g => g.selectedSubskills.map(s => [s.id, s.description])));
const jobs = [
  ['LA002-02-a', 'paragraph-architect', 'informational'],
  ['LA002-02-c', 'paragraph-architect', 'informational'],
  ['LA002-02-c', 'knowledge-check', 'apply'],
  ['LA001-03-c', 'word-builder', 'simple_affix'],
  ['LA001-03-c', 'word-workout', 'read_inflected'],
  ['LA001-03-a', 'syllable-clapper', 'count_parts'],
  ['LA001-05-a', 'decodable-reader', 'literal'],
  ['LA001-05-a', 'read-aloud-studio', 'accuracy'],
  ['LA001-05-a', 'di-sentence-reading', 'read_sentence'],
  ['LA001-05-b', 'read-aloud-studio', 'expression'],
  ['LA001-05-b', 'read-aloud-studio', 'dialogue'],
  ['LA003-01-b', 'media-player', 'story_analysis'],
  ['LA003-01-b', 'passage-studio', 'recall'],
  ['LA003-01-a', 'media-player', 'listen_for_details'],
  ['LA003-01-a', 'story-talk', 'who_what_where'],
  ['LA001-02-b', 'phonics-blender', 'cvce_blend'],
  ['LA001-02-a', 'phonics-blender', 'digraph'],
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
