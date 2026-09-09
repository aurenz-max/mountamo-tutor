import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { scopeFromArgv, sourcesFor } from './lib/curriculum-coverage-scopes.mjs';
import { ENTRY_PREFIX, entryHash, withLiveCatalog } from './lib/curriculum-coverage-catalog.mjs';

// Draws real generations for the scope's reviewed requirement/mode pairs through the
// production eval-test dispatcher (exact curriculum text as topic + intent, canonical grade,
// easy tier). Evidence is cached by an input hash over the job, the requirement text and the
// hashes of the sources that produced it; edit a source (or delete a draw) to request a fresh one.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scope = scopeFromArgv();
const out = resolve(root, scope.dir);
const live = JSON.parse(readFileSync(resolve(out, 'live-curriculum.json'), 'utf8'));
const requirements = live.curriculum.flatMap(u => u.skills.flatMap(s => s.subskills));
const hash = v => createHash('sha256').update(v).digest('hex');
mkdirSync(resolve(out, 'evidence'), { recursive: true });
// Scopes with catalogEntryHashing add `catalog-entry:<id>` (a hash of the primitive's own live
// catalog entry) so a draw goes stale only when ITS entry changes, never on a sibling's edit.
const rawCatalog = scope.catalogEntryHashing ? await withLiveCatalog(root, c => c) : null;
const hashesFor = primitive => Object.fromEntries([
  ...sourcesFor(scope, primitive).map(p => [p, hash(readFileSync(resolve(root, p)))]),
  ...(rawCatalog ? [[ENTRY_PREFIX + primitive, entryHash(rawCatalog, primitive)]] : []),
]);
const jobs = scope.cases.flatMap(([id, primitive, mode]) => [1, 2].map(draw => ({ id, primitive, mode, draw })));
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
async function worker() {
  for (;;) {
    const job = jobs.shift(); if (!job) return;
    if (only && !only.includes(job.id)) continue;
    const requirement = requirements.find(r => r.id === job.id);
    if (!requirement) throw new Error(`Missing published requirement ${job.id}`);
    const file = resolve(out, 'evidence', `${job.id}-${job.primitive}-${job.mode}-${job.draw}.json`);
    const sourceHashes = hashesFor(job.primitive);
    const inputHash = hash(JSON.stringify({ job, text: requirement.description, sourceHashes }));
    if (existsSync(file)) {
      if (JSON.parse(readFileSync(file, 'utf8')).inputHash === inputHash) { console.log(`cached ${job.id} ${job.mode} draw ${job.draw}`); continue; }
      // A saved draw whose sources changed is historical evidence, not garbage: the atlas marks
      // it stale. Only --redraw (or deleting the file) replaces it, so a frozen pilot's findings
      // are never overwritten by a routine re-run.
      if (!argv.includes('--redraw')) { console.log(`stale-kept ${job.id} ${job.mode} draw ${job.draw} (pass --redraw to replace)`); continue; }
    }
    const params = new URLSearchParams({ componentId: job.primitive, evalMode: job.mode,
      topic: requirement.description, intent: requirement.description,
      grade: scope.grade, gradeLevel: scope.gradeLevel, difficulty: 'easy' });
    const started = Date.now();
    const record = { ...job, subject: scope.subject, grade: scope.grade, requirement: requirement.description,
      requestedAt: new Date().toISOString(), inputHash, sourceHashes, params: Object.fromEntries(params) };
    try {
      const response = await fetch(`http://localhost:3000/api/lumina/eval-test?${params}`, { signal: AbortSignal.timeout(180000) });
      record.httpStatus = response.status;
      record.response = await response.json();
    } catch (e) { record.transportError = String(e); }
    record.durationMs = Date.now() - started;
    writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
    console.log(JSON.stringify({ ...job, http: record.httpStatus, status: record.response?.status, error: record.response?.error || record.transportError, durationMs: record.durationMs }));
  }
}
await Promise.all([worker(), worker()]);
