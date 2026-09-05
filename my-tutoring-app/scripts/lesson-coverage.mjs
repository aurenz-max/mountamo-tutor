#!/usr/bin/env node
/**
 * Lesson objective-coverage eval — run it on packages, read what it found.
 *
 *   node scripts/lesson-coverage.mjs eval   [pkg.json|dir ...]   judge each Lesson Bench package (default: qa/lesson-bench/packages)
 *   node scripts/lesson-coverage.mjs report [evals.jsonl]        aggregate qa/lesson-coverage/evals.jsonl
 *   node scripts/lesson-coverage.mjs show   <lessonId|substring> print the latest full eval for one lesson
 *
 * Flags: --write        store the verdict as `coverage` on each package file
 *        --no-persist   do not append rows to evals.jsonl
 *        --source NAME  row source tag (default `script`)
 *
 * `eval` loads the TS evaluator through vite's SSR module runner (the loader
 * vitest uses) so the script and the runtime share one digest, one prompt and
 * one catalog. Needs GEMINI_API_KEY — read from .env.local when unset. Run
 * from my-tutoring-app.
 *
 * The runtime path needs no script: every assembled lesson is judged in shadow
 * after `/api/lumina/build-stream` closes its stream (LUMINA_COVERAGE_EVAL).
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
if (!existsSync(join(ROOT, 'node_modules', 'vite'))) {
  console.error('run from my-tutoring-app (node_modules/vite not found in cwd)');
  process.exit(2);
}

const argv = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--source']);
const flags = new Set();
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (VALUE_FLAGS.has(a)) { i++; continue; }
  if (a.startsWith('--')) { flags.add(a); continue; }
  positional.push(a);
}
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt;
};
const cmd = positional.shift() ?? 'report';
const EVALS = join('qa', 'lesson-coverage', 'evals.jsonl');
const PKG_DIR = join('qa', 'lesson-bench', 'packages');

function loadEnvKey() {
  if (process.env.GEMINI_API_KEY) return;
  const envFile = join(ROOT, '.env.local');
  if (!existsSync(envFile)) return;
  const m = readFileSync(envFile, 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
}

async function loadEvaluator() {
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
  const server = await vite.createServer({
    configFile: false,
    root: ROOT,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    resolve: {
      alias: {
        '@': resolve(ROOT, 'src'),
        'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts'),
      },
    },
  });
  const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const evaluator = await runner.import('/src/components/lumina/service/qa/lessonCoverage/evaluateLessonCoverage.ts');
  const sink = await runner.import('/src/components/lumina/service/qa/lessonCoverage/sink.ts');
  const pkgMod = await runner.import('/src/components/lumina/service/qa/lessonBench/lessonPackage.ts');
  return { evaluator, sink, pkgMod, close: () => server.close() };
}

const listPackages = (dir) => readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => join(dir, f));
const expand = (p) => (statSync(p).isDirectory() ? listPackages(p) : [p]);
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const readRows = (file) => (existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '—');

function printEval(ev) {
  console.log(`\n▶ ${ev.lessonId}  ${ev.status.toUpperCase()} · coverage ${ev.overallObjectiveCoverage.toFixed(2)} · ${ev.meta.objectivesFullyCovered}/${ev.meta.objectiveCount} sufficient${ev.blockingFailure ? ' · BLOCKING' : ''} · ${ev.meta.latencyMs}ms${ev.meta.usedSchemaFallback ? ' · schema fallback' : ''}${ev.meta.error ? ` · error: ${ev.meta.error}` : ''}`);
  console.log(`  "${ev.meta.topic}" · ${ev.meta.grade ?? ev.meta.gradeLevel} · ${ev.meta.subject ?? '—'} · ${ev.meta.primitiveTypes.join(', ')}`);
  for (const o of ev.objectives) {
    console.log(`  ${o.severity === 'CRITICAL' ? '✗' : o.severity === 'WARNING' ? '!' : '✓'} ${o.objectiveId} ${o.category} [${o.severity}] taught=${o.taught} items=${o.assessmentCount}`);
    console.log(`      ${o.objective.replace(/\s+/g, ' ').slice(0, 110)}`);
    if (o.assessmentEvidence.length) console.log(`      evidence: ${o.assessmentEvidence.slice(0, 8).join(', ')}${o.assessmentEvidence.length > 8 ? ' …' : ''}`);
    if (o.notes) console.log(`      note: ${o.notes}`);
    if (o.discardedEvidence?.length) console.log(`      discarded citations: ${o.discardedEvidence.join(', ')}`);
  }
  for (const c of ev.detectedConstraints) console.log(`  ⚠ ${c.type}${c.instanceId ? ` @${c.instanceId}` : ''}: ${c.description}`);
  if (ev.summary) console.log(`  summary: ${ev.summary}`);
}

async function evalCmd() {
  loadEnvKey();
  if (!process.env.GEMINI_API_KEY) { console.error('GEMINI_API_KEY is not set and .env.local has none'); process.exit(2); }
  const files = (positional.length ? positional : [PKG_DIR]).flatMap(expand).filter((f) => !f.endsWith('.labeled.json') || positional.length);
  if (!files.length) { console.error('no packages found'); process.exit(1); }
  const bench = await loadEvaluator();
  const source = opt('source', 'script');
  const persist = !flags.has('--no-persist');
  const summary = [];
  try {
    for (const file of files) {
      const raw = readJson(file);
      let pkg;
      try { pkg = bench.pkgMod.parseLessonPackage(raw); } catch (e) { console.log(`skip ${file}: ${e.message}`); continue; }
      const exhibit = bench.pkgMod.exhibitFromPackage(pkg);
      const ev = await bench.evaluator.evaluateLessonCoverage(exhibit, { source, lessonId: pkg.id });
      if (persist) await bench.sink.persistLessonCoverageEval(ev, { console: false });
      printEval(ev);
      if (flags.has('--write')) { raw.coverage = ev; writeFileSync(file, JSON.stringify(raw, null, 2) + '\n'); }
      summary.push(ev);
    }
  } finally {
    await bench.close();
  }
  const counts = summary.reduce((m, e) => ((m[e.status] = (m[e.status] ?? 0) + 1), m), {});
  console.log(`\n${summary.length} lesson(s): ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · ')}${persist ? ` → ${EVALS}` : ''}`);
}

function group(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    for (const k of [].concat(keyFn(r) ?? '—')) {
      const g = m.get(k) ?? { n: 0, fail: 0, warn: 0, error: 0, cov: 0 };
      g.n++; g[r.status] = (g[r.status] ?? 0) + 1; g.cov += r.overallObjectiveCoverage ?? 0;
      m.set(k, g);
    }
  }
  return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
}

function table(title, entries) {
  if (!entries.length) return;
  console.log(`\n${title}`);
  console.log('  n    fail  warn  err   avg cov  key');
  for (const [k, g] of entries) {
    console.log(`  ${String(g.n).padEnd(4)} ${String(g.fail ?? 0).padEnd(5)} ${String(g.warn ?? 0).padEnd(5)} ${String(g.error ?? 0).padEnd(5)} ${(g.cov / g.n).toFixed(2).padEnd(8)} ${k}`);
  }
}

function reportCmd() {
  const file = positional[0] ?? EVALS;
  const rows = readRows(file);
  if (!rows.length) { console.log(`no rows in ${file}`); return; }
  const judged = rows.filter((r) => r.status !== 'error');
  const objectives = judged.flatMap((r) => r.objectives);
  console.log(`${rows.length} eval(s) in ${file} · ${judged.length} judged · ${rows.length - judged.length} errored`);
  console.log(`status: ${['pass', 'warn', 'fail', 'error'].map((s) => `${s} ${rows.filter((r) => r.status === s).length}`).join(' · ')}`);
  console.log(`objectives: ${objectives.length} · fully covered ${pct(objectives.filter((o) => o.category === 'ASSESSED_SUFFICIENTLY').length, objectives.length)} · unassessed ${pct(objectives.filter((o) => o.category === 'TAUGHT_NOT_ASSESSED' || o.category === 'NOT_TAUGHT').length, objectives.length)} · avg assessment items ${(objectives.reduce((a, o) => a + o.assessmentCount, 0) / (objectives.length || 1)).toFixed(1)}`);
  const cats = objectives.reduce((m, o) => ((m[o.category] = (m[o.category] ?? 0) + 1), m), {});
  console.log(`categories: ${Object.entries(cats).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  const cons = judged.flatMap((r) => r.detectedConstraints).reduce((m, c) => ((m[c.type] = (m[c.type] ?? 0) + 1), m), {});
  console.log(`constraints: ${Object.entries(cons).map(([k, v]) => `${k} ${v}`).join(' · ') || 'none'}`);
  const lat = judged.map((r) => r.meta.latencyMs).sort((a, b) => a - b);
  if (lat.length) console.log(`latency: median ${lat[Math.floor(lat.length / 2)]}ms · max ${lat[lat.length - 1]}ms · schema fallback ${judged.filter((r) => r.meta.usedSchemaFallback).length}`);
  table('by subject', group(judged, (r) => r.meta.subject));
  table('by grade', group(judged, (r) => r.meta.grade ?? r.meta.gradeLevel));
  table('by source', group(rows, (r) => r.meta.source));
  table('by subskill (curriculum-launched lessons only)', group(judged.filter((r) => r.meta.subskillIds?.length), (r) => r.meta.subskillIds));
  table('by primitive present in the lesson', group(judged, (r) => r.meta.primitiveTypes));
  // Which primitives carry the evidence when an objective IS sufficiently assessed, and which sit in lessons where it is not.
  const evidenceBlocks = {};
  for (const o of objectives.filter((x) => x.category === 'ASSESSED_SUFFICIENTLY')) {
    for (const id of o.assessmentEvidence) { const inst = id.split('#')[0]; evidenceBlocks[inst] = (evidenceBlocks[inst] ?? 0) + 1; }
  }
  const top = Object.entries(evidenceBlocks).sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (top.length) console.log(`\nblocks cited as sufficient evidence (instanceId · items): ${top.map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  const worst = judged.filter((r) => r.status === 'fail').slice(-10);
  if (worst.length) {
    console.log('\nlatest failing lessons:');
    for (const r of worst) console.log(`  ${r.lessonId} · ${r.meta.topic} · ${r.objectives.filter((o) => o.severity === 'CRITICAL').map((o) => `${o.objectiveId} ${o.category}`).join(', ')}`);
  }
}

function showCmd() {
  const needle = positional[0];
  if (!needle) { console.error('show needs a lessonId (or substring)'); process.exit(1); }
  const rows = readRows(EVALS).filter((r) => r.lessonId.includes(needle));
  if (!rows.length) { console.log('no matching eval'); return; }
  printEval(rows[rows.length - 1]);
}

const commands = { eval: evalCmd, report: reportCmd, show: showCmd };
if (!commands[cmd]) { console.error(`unknown command ${cmd}`); process.exit(1); }
await commands[cmd]();
