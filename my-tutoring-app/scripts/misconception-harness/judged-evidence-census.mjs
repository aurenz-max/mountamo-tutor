// Judged-evidence census: does the runner-owned evidence (hooks/judgedRunEvidence.ts) fire the capture gate and
// give the real distiller enough to name each declared judged source's signature miss?
//
//   RUN=run1 STAGES=G,E,D node scripts/misconception-harness/judged-evidence-census.mjs [--only <id,id>]
//
// G: real registry generation per declared source (first catalog eval mode unless overridden below), saved as
//    data-<id>.json.   E: vitest mounts each component with that data, captures the pack, builds the evidence for
//    a wrong-first / corrected-once run (evaluation/diagnosis/judgedEvidenceCensus.test.tsx), saved as
//    evidence-<id>.json.   D: the real distiller through Next on :3000, saved into report.json.
// Fictional runs, no account, no store writes. Run from my-tutoring-app.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const RUN = process.env.RUN ?? 'run1';
const OUT = resolve(ROOT, '../artifacts/learning-applicability/judged-census', RUN);
const STAGES = (process.env.STAGES ?? 'G,E,D').split(',');
const NEXT = process.env.NEXT_URL ?? 'http://127.0.0.1:3000';
const argv = process.argv.slice(2);
const ONLY = argv.includes('--only') ? new Set(argv[argv.indexOf('--only') + 1].split(',')) : null;
await mkdir(OUT, { recursive: true });
// Every stage needs the app's .env: generation for its model keys, the mounted components for Firebase (the
// evaluation index initialises auth at import and throws `auth/invalid-api-key` without them).
const nextEnv = await import('@next/env');
(nextEnv.loadEnvConfig ?? nextEnv.default.loadEnvConfig)(ROOT);

// Declared judged sources (catalog misconceptionScope + runner evidence submitted), 2026-09-14 inventory, plus
// the two that started submitting the runner evidence in slice 1 (di-spoken-practice, read-aloud-studio).
// Topic and grade are the tester defaults where a tester lists them; the eval mode is the source's judged mode
// where the catalog's first mode is not the judged one.
const SOURCES = {
  '3d-shape-explorer': { topic: '3D shapes', gradeLevel: 'Kindergarten' },
  'compare-objects': { topic: 'Comparing lengths and weights of objects', gradeLevel: 'Kindergarten' },
  'counting-board': { topic: 'Taking away objects and saying how many are left', gradeLevel: 'Kindergarten', evalMode: 'take_away' },   // slice 2: runner evidence, one observation callback
  'decodable-reader': { topic: 'Short a decodable passage', gradeLevel: 'Kindergarten' },
  'di-deduction': { topic: 'Logical deduction with clues', gradeLevel: 'Grade 2' },
  'di-dice-roll': { topic: 'Counting dice pips', gradeLevel: 'Kindergarten' },
  'di-word-problem-setup': { topic: 'Addition word problems within 20', gradeLevel: 'Grade 1' },
  'di-worked-procedure': { topic: 'Two-digit addition with regrouping', gradeLevel: 'Grade 2' },
  'letter-sound-link': { topic: 'Letter sounds', gradeLevel: 'Kindergarten' },
  'letter-spotter': { topic: 'Letter recognition', gradeLevel: 'Kindergarten' },
  'oral-sentence-studio': { topic: 'Using new vocabulary words in sentences', gradeLevel: 'Grade 1' },
  'ordinal-line': { topic: 'Ordinal positions', gradeLevel: 'Grade 1' },
  'phoneme-explorer': { topic: 'Phoneme awareness', gradeLevel: 'Kindergarten' },
  'picture-vocabulary': { topic: 'Animals', gradeLevel: 'Kindergarten', evalMode: 'naming' },   // receptive_match (first mode) is tap-only
  'place-value-chart': { topic: 'Place value', gradeLevel: 'Grade 3' },
  'rhyme-studio': { topic: 'Rhyming words', gradeLevel: 'Kindergarten' },
  'sentence-analyzer': { topic: 'Parts of a sentence', gradeLevel: 'Grade 2' },
  'sorting-station': { topic: 'Sorting shapes and colors', gradeLevel: 'Kindergarten' },
  'syllable-clapper': { topic: 'Syllable counting', gradeLevel: 'Kindergarten' },
  'ten-frame': { topic: 'Subtraction within 10 on a ten frame', gradeLevel: 'Kindergarten', evalMode: 'operate' },   // slice 2: runner evidence, one observation callback
  'word-builder': { topic: 'Building CVC words', gradeLevel: 'Kindergarten' },
  'di-spoken-practice': { topic: 'Counting objects and saying how many', gradeLevel: 'Kindergarten' },   // count_and_say is the first mode; a comparatives topic yielded 0 items
  'read-aloud-studio': { topic: 'Fluency practice with model reading', gradeLevel: 'Grade 1' },
};
const ids = Object.keys(SOURCES).filter((id) => !ONLY || ONLY.has(id));

const reportPath = join(OUT, 'report.json');
const report = existsSync(reportPath) ? JSON.parse(await readFile(reportPath, 'utf8')) : { fictional: true, learningWrites: false, startedAt: new Date().toISOString(), generation: {}, distill: {} };
const save = () => writeFile(reportPath, JSON.stringify(report, null, 2));

// ── G: real generation through the registry ──────────────────────────────────────────────────────────────
if (STAGES.includes('G')) {
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
  const server = await vite.createServer({ configFile: false, root: ROOT, logLevel: 'error', appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    resolve: { alias: { '@': resolve(ROOT, 'src'), 'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts') } } });
  const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateComponentContent } = await runner.import('/src/components/lumina/service/geminiService.ts');
  const { getComponentById } = await runner.import('/src/components/lumina/service/manifest/catalog/index.ts');
  for (const id of ids) {
    const src = SOURCES[id];
    const entry = getComponentById(id);
    const evalMode = src.evalMode ?? entry?.evalModes?.[0]?.evalMode;
    const item = { componentId: id, instanceId: `census-${id}`, config: { ...(evalMode ? { targetEvalMode: evalMode } : {}) } };
    let data = null, error = null;
    try {
      const result = await generateComponentContent(item, src.topic, src.gradeLevel);
      data = result?.data ?? null;
    } catch (e) { error = String(e); }
    report.generation[id] = { evalMode, topic: src.topic, gradeLevel: src.gradeLevel, error, challenges: Array.isArray(data?.challenges) ? data.challenges.length : null };
    await save();
    if (data) await writeFile(join(OUT, `data-${id}.json`), JSON.stringify({ id, evalMode, gradeLevel: src.gradeLevel, topic: src.topic, data }, null, 2));
    console.log('generation', id, evalMode, error ?? `${report.generation[id].challenges ?? '?'} challenges`);
  }
  await server.close();
}

// ── E: mount + evidence (vitest, jsdom) ──────────────────────────────────────────────────────────────────
if (STAGES.includes('E')) {
  const spec = 'src/components/lumina/evaluation/diagnosis/judgedEvidenceCensus.test.tsx';
  const result = spawnSync(process.execPath, [join(ROOT, 'node_modules/vitest/vitest.mjs'), 'run', spec, '--reporter=dot'],
    { cwd: ROOT, env: { ...process.env, JUDGED_CENSUS_DIR: OUT }, stdio: 'inherit', shell: false });
  console.log('evidence stage exit', result.status);
}

// ── D: the real distiller through Next on :3000 ──────────────────────────────────────────────────────────
if (STAGES.includes('D')) {
  const files = (await readdir(OUT)).filter((f) => f.startsWith('evidence-') && f.endsWith('.json'));
  for (const f of files) {
    const row = JSON.parse(await readFile(join(OUT, f), 'utf8'));
    if (ONLY && !ONLY.has(row.id)) continue;
    const base = { id: row.id, evalMode: row.evalMode, itemCount: row.itemCount, wrongCount: row.wrongCount, nullObservations: row.nullObservations,
      score: row.score, gate: row.gate, skipped: row.skipped, error: row.error ? row.error.split('\n')[0] : undefined,
      signature: row.signature?.map((s) => `${s.correct} → said "${s.wrong}"`), why: row.signature?.[0]?.why };
    if (!row.evidence || !row.gate) { report.distill[row.id] = { ...base, distill: row.evidence ? 'gate did not fire' : 'no evidence' }; await save(); console.log('distill', row.id, report.distill[row.id].distill); continue; }
    let distill;
    try {
      const res = await fetch(`${NEXT}/api/lumina`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'distillMisconception', params: { evidence: row.evidence, score: row.score, success: true,
          subskillId: 'CENSUS-a', evalMode: row.evalMode, gradeLevel: row.gradeLevel } }) });
      distill = res.ok ? await res.json() : { error: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
    } catch (e) { distill = { error: String(e) }; }
    report.distill[row.id] = { ...base, distill };
    await save();
    console.log('distill', row.id, distill.abstain === false ? `HYPOTHESIS: ${distill.misconceptionText}` : distill.abstain ? `abstain: ${distill.reason}` : JSON.stringify(distill).slice(0, 200));
  }
}
console.log('report:', reportPath);
