#!/usr/bin/env node
/**
 * Lesson Bench loop — score · triage · rerun · diff. Tier A only (no LLM).
 *
 *   node scripts/lesson-bench.mjs score  [pkg.json|dir ...]   default: every qa/lesson-bench/packages/*.json
 *   node scripts/lesson-bench.mjs triage <labeled.json>        label → layer → executor, paste-ready queue entries
 *   node scripts/lesson-bench.mjs rerun  <labeled.json>        regenerate the same topic+grade, score, diff, carry keeps
 *   node scripts/lesson-bench.mjs diff   <runA> <runB>         per-check deltas between two scoreboard runs
 *
 * Flags: --no-write   do not write `scores` back into the package files
 *        --base URL   dev server for rerun (default http://localhost:3000)
 *        --out DIR    package dir (default qa/lesson-bench/packages)
 *
 * `score` fills `scores.gates / checks` on each package (see lessonBenchScorer.ts
 * for the check list), appends {runId, gitSha, packageId, checkId, score} rows to
 * qa/lesson-bench/scoreboard.jsonl, and — for a package with a human label —
 * prints machine-vs-human agreement per check with the blocks each side cited.
 *
 * The TypeScript scorer and the LIVE catalog are loaded through vite's SSR
 * module runner (the loader vitest uses), so this script and the app share one
 * catalog and one resolveAffordances: nothing here can drift from production.
 * Run from my-tutoring-app.
 */
import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
if (!existsSync(join(ROOT, 'node_modules', 'vite'))) {
  console.error('run from my-tutoring-app (node_modules/vite not found in cwd)');
  process.exit(2);
}

const argv = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--base', '--out']);
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
const cmd = positional.shift() ?? 'score';
const BASE = opt('base', 'http://localhost:3000');
const PKG_DIR = opt('out', join('qa', 'lesson-bench', 'packages'));
const SCOREBOARD = join('qa', 'lesson-bench', 'scoreboard.jsonl');
const TRIAGE_DIR = join('qa', 'lesson-bench', 'triage');
const WRITE = !flags.has('--no-write');
const gitSha = (() => {
  try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return null; }
})();
const runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// ── Load the TS scorer + live catalog ──────────────────────────────────────
async function loadBench() {
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
  const server = await vite.createServer({
    configFile: false,
    root: ROOT,
    logLevel: 'error',
    appType: 'custom',
    // No HMR and no websocket: two runs at once (a background rerun + a score)
    // must not fight over vite's default WS port.
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    resolve: {
      alias: {
        '@': resolve(ROOT, 'src'),
        'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts'),
      },
    },
  });
  const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const scorer = await runner.import('/src/components/lumina/service/qa/lessonBench/lessonBenchScorer.ts');
  const pkgMod = await runner.import('/src/components/lumina/service/qa/lessonBench/lessonPackage.ts');
  const identity = await runner.import('/src/components/lumina/service/qa/lessonBench/rerunIdentity.ts');
  const catalog = (await runner.import('/src/components/lumina/service/manifest/catalog/index.ts')).UNIVERSAL_CATALOG;
  return { scorer, pkgMod, catalog, identity, close: () => server.close() };
}

// ── Helpers ────────────────────────────────────────────────────────────────
const mark = (v) => (v === 1 ? '✓' : v === 0 ? '✗' : '·');
const listPackages = (dir) => readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => join(dir, f));
const expand = (p) => (statSync(p).isDirectory() ? listPackages(p) : [p]);
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const writeJson = (f, v) => writeFileSync(f, JSON.stringify(v, null, 2) + '\n');

function printScores(pkg, scores) {
  const ev = scores.evidence ?? {};
  const band = ev.band ?? {};
  console.log(`\n▶ ${pkg.id}`);
  console.log(`  ${scores.bucket} · gates ${Object.entries(scores.gates).map(([k, v]) => `${k}${mark(v)}`).join(' ')} · checks ${Object.entries(scores.checks).map(([k, v]) => `${k}${mark(v)}`).join(' ')}`);
  console.log(`  band: grade ${band.grade ?? '—'} · pre-reader ${band.preReader ? 'yes' : 'no'} · K-2 ${band.k2 ? 'yes' : 'no'} · subject ${band.subject ?? '—'}`);
  console.log(`  stream: ${(ev.streamOrder ?? []).join(' → ')}${ev.parentCards?.length ? ` ‖ parent cards: ${ev.parentCards.join(', ')}` : ''}`);
  console.log(`  minutes ${ev.minutes}/${ev.lengthCap} known over ${ev.knownMinuteBlocks}/${ev.streamBlocks} blocks${ev.parentCardMinutes ? ` (+${ev.parentCardMinutes} on parent cards)` : ''}${ev.tapOnlyProduction?.length ? ` · tap-only production: ${ev.tapOnlyProduction.join(', ')}` : ''}`);
  for (const c of scores.citations ?? []) console.log(`  ✗ ${c.checkId} ${c.instanceId}: ${c.note}`);
  for (const u of scores.unknowns ?? []) console.log(`  ? ${u.checkId} ${u.instanceId ?? 'lesson'}: ${u.note}`);
}

function printAgreement(a) {
  console.log(`  machine vs human — holistic ${a.holistic ?? '—'} · bucket ${a.bucket} · agree ${a.agreed}/${a.scored} on the checks the machine scored`);
  console.log('  check | machine | human | agree | human blocks → machine blocks');
  for (const r of a.rows) {
    console.log(`  ${r.checkId.padEnd(5)} | ${(r.machine === null ? 'tier B' : r.machine ? 'pass' : 'FAIL').padEnd(7)} | ${r.human.padEnd(5)} | ${(r.agree === null ? '—' : r.agree ? 'yes' : 'NO').padEnd(5)} | ${r.humanBlocks.join(',') || '—'} → ${r.machineBlocks.join(',') || '—'}`);
  }
  for (const u of a.unrouted) console.log(`  unrouted ${u.reaction} on ${u.instanceId}: "${u.note}" → triage by note`);
  for (const p of a.parentCardLabels) console.log(`  parent card ${p.instanceId} carries a ${p.reaction} (${p.reasons.join(',') || 'no reason'}) — now behind the child's path (item 12); re-rate via rerun`);
}

async function scoreOne(file, bench, { write = WRITE, silent = false } = {}) {
  const raw = readJson(file);
  const pkg = bench.pkgMod.parseLessonPackage(raw);
  const scores = bench.scorer.scoreLessonPackage(pkg, bench.catalog, { judge: `tier-a@${gitSha ?? 'nosha'}` });
  if (!silent) {
    printScores(pkg, scores);
    if (pkg.human && bench.pkgMod.isLabelTouched(pkg.human)) {
      printAgreement(bench.scorer.machineVsHuman(scores, pkg.human, new Set(scores.evidence?.parentCards ?? [])));
    }
  }
  if (write) {
    raw.scores = scores;
    writeJson(file, raw);
  }
  return { pkg, scores, raw };
}

function appendScoreboard(entries) {
  const rows = [];
  for (const { file, pkg, scores } of entries) {
    for (const [checkId, score] of [...Object.entries(scores.gates), ...Object.entries(scores.checks)]) {
      rows.push({ runId, gitSha, packageId: pkg.id, checkId, score, bucket: scores.bucket, file: basename(file) });
    }
  }
  if (!rows.length) return;
  mkdirSync(dirname(SCOREBOARD), { recursive: true });
  appendFileSync(SCOREBOARD, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`\nscoreboard += ${rows.length} rows (run ${runId} @ ${gitSha}) → ${SCOREBOARD}`);
}

// ── score ──────────────────────────────────────────────────────────────────
async function cmdScore(bench) {
  const files = positional.length ? positional.flatMap(expand) : listPackages(PKG_DIR);
  const done = [];
  for (const file of files) {
    try {
      const r = await scoreOne(file, bench);
      done.push({ file, ...r });
    } catch (e) {
      console.log(`\nskip ${file}: ${e?.message ?? e}`);
    }
  }
  appendScoreboard(done);
  if (WRITE && done.length) console.log(`scores written into ${done.length} package file(s)`);
}

// ── triage ─────────────────────────────────────────────────────────────────
function triageMarkdown(pkg, entries) {
  const date = (pkg.human?.labeledAt ?? '').slice(0, 10);
  const md = [`# Triage — \`${pkg.id}\` (labeled ${date}, holistic ${pkg.human?.holistic ?? '—'})`, ''];
  md.push('| scope | block | reaction | reason | check | layer | executor | queue |', '|---|---|---|---|---|---|---|---|');
  for (const e of entries) {
    md.push(`| ${e.scope} | ${e.instanceId ? `\`${e.instanceId}\` (${e.componentId}${e.targetEvalMode ? `[${e.targetEvalMode}]` : ''})` : '—'} | ${e.reaction ?? '—'} | ${e.reasonLabel ?? (e.note ? `note: "${e.note}"` : '—')} | ${e.checkId ?? '—'} | **${e.layer}** | ${e.executor} | ${e.queue} |`);
  }
  const queues = [...new Set(entries.map((e) => e.queue))];
  for (const q of queues) {
    md.push('', `## Paste into \`${q}\``, '');
    for (const e of entries.filter((x) => x.queue === q)) {
      const title = `${e.componentId ?? 'lesson'}: ${e.reasonLabel ?? (e.note ? e.note.slice(0, 70) : e.reaction)}`;
      const where = e.scope === 'block'
        ? `block \`${e.instanceId}\` (${e.componentId}${e.targetEvalMode ? `[${e.targetEvalMode}]` : ''}) marked **${e.reaction}**`
        : 'the lesson as a whole';
      md.push(`### N. **${title}** — from Lesson Bench label \`${pkg.id}\` (${date}), ${where}${e.reasonLabel ? ` → "${e.reasonLabel}"${e.checkId ? ` (${e.checkId})` : ''}` : ''}${e.note ? ` — rater: "${e.note}"` : ''}. **LAYER ${e.layer}** — ${e.why}. Executor: \`${e.executor}\`.`, '');
    }
  }
  return md.join('\n');
}

async function cmdTriage(bench) {
  const file = positional[0];
  if (!file) { console.error('usage: triage <labeled.json>'); process.exit(2); }
  const pkg = bench.pkgMod.parseLessonPackage(readJson(file));
  if (!pkg.human || !bench.pkgMod.isLabelTouched(pkg.human)) { console.error('package carries no human label — rate it in the rail first'); process.exit(1); }
  const entries = bench.scorer.triageLabel(pkg, bench.catalog);
  const md = triageMarkdown(pkg, entries);
  console.log(md);
  mkdirSync(TRIAGE_DIR, { recursive: true });
  const out = join(TRIAGE_DIR, `${pkg.id}-${(pkg.human.labeledAt ?? '').slice(0, 10) || 'undated'}.md`);
  writeFileSync(out, md + '\n');
  console.log(`\nsaved → ${out}`);
  const unrouted = entries.filter((e) => e.layer === 'UNROUTED');
  if (unrouted.length) console.log(`${unrouted.length} UNROUTED — ask the rater for a reason before queuing.`);
}

// ── rerun ──────────────────────────────────────────────────────────────────
/** Slots = (objective index : position) so two generations of the same topic align even when instanceIds differ. */
function slotsOf(pkg) {
  const finalId = pkg.manifest.finalAssessment?.instanceId;
  const perObj = new Map();
  const out = [];
  for (const i of pkg.manifest.layout ?? []) {
    if (i.componentId === 'curator-brief') continue;
    const mode = typeof i.config?.targetEvalMode === 'string' ? i.config.targetEvalMode : null;
    if (finalId && i.instanceId === finalId) {
      out.push({ key: 'final', objective: 'final', instanceId: i.instanceId, componentId: i.componentId, mode, title: i.title });
      continue;
    }
    const obj = i.objectiveIds?.[0] ?? '?';
    if (!perObj.has(obj)) perObj.set(obj, { index: perObj.size, pos: 0 });
    const s = perObj.get(obj);
    out.push({ key: `${s.index}:${s.pos++}`, objective: obj, instanceId: i.instanceId, componentId: i.componentId, mode, title: i.title });
  }
  return out;
}
const slotLabel = (s) => `${s.componentId}${s.mode ? `[${s.mode}]` : ''}`;

async function cmdRerun(bench) {
  const file = positional[0];
  if (!file) { console.error('usage: rerun <labeled.json>'); process.exit(2); }
  const labeledRaw = readJson(file);
  const labeled = bench.pkgMod.parseLessonPackage(labeledRaw);
  const topic = labeled.provenance?.topic ?? labeled.manifest.topic;
  const gradeLevel = labeled.provenance?.gradeLevel ?? labeled.manifest.gradeLevel;
  console.log(`▶ rerun ${labeled.id}: "${topic}" (${gradeLevel}) via ${BASE} — a full package takes minutes`);
  const url = `${BASE}/api/lumina/topic-trace`;
  const request = { ...(labeled.provenance.generationRequest ?? { topic, gradeLevel }), package: true };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 900_000);
  let resp;
  try {
    const r = await fetch(url, { signal: ctl.signal, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) });
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 300)}`);
    resp = await r.json();
  } finally {
    clearTimeout(t);
  }
  if (!resp.package || resp.package.error) {
    console.error('no package in the response:', resp.package?.error ?? JSON.stringify(resp).slice(0, 300));
    process.exit(1);
  }
  const freshRaw = resp.package;
  freshRaw.provenance = { ...(freshRaw.provenance ?? {}), gitSha, rerunOf: labeled.id };
  const fresh = bench.pkgMod.parseLessonPackage(freshRaw);

  // Selection diff, slot by slot.
  const before = new Map(slotsOf(labeled).map((s) => [s.key, s]));
  const after = slotsOf(fresh);
  const rows = [];
  const carried = {};
  const reRate = [];
  for (const s of after) {
    const b = before.get(s.key);
    const same = !!b && b.componentId === s.componentId && b.mode === s.mode;
    const label = b ? labeled.human?.blocks?.[b.instanceId] : undefined;
    let status;
    if (!same) {
      status = `CHANGED (was ${b ? slotLabel(b) : 'absent'})`;
      reRate.push(`${s.instanceId} — ${slotLabel(s)} — ${status}`);
    } else if (label?.reaction === 'keep' && bench.identity.canCarryKeep(labeled, b.instanceId, fresh, s.instanceId)) {
      status = 'same · keep carried';
      carried[s.instanceId] = { reaction: 'keep', reasons: [], note: `carried from ${labeled.id}` };
    } else if (label) {
      status = `same · RE-RATE (was ${label.reaction}${label.reasons.length ? `: ${label.reasons.join(',')}` : ''})`;
      reRate.push(`${s.instanceId} — ${slotLabel(s)} — ${status}`);
    } else {
      status = 'same · unrated before';
      reRate.push(`${s.instanceId} — ${slotLabel(s)} — ${status}`);
    }
    rows.push({ key: s.key, before: b ? slotLabel(b) : '—', after: slotLabel(s), status });
    before.delete(s.key);
  }
  for (const [key, b] of before) rows.push({ key, before: slotLabel(b), after: '—', status: 'REMOVED' });

  freshRaw.human = { ...bench.pkgMod.emptyHumanLabel(), blocks: carried };
  const outFile = join(PKG_DIR, `${fresh.id}.json`);
  mkdirSync(PKG_DIR, { recursive: true });
  writeJson(outFile, freshRaw);
  const scoredFresh = await scoreOne(outFile, bench, { write: true });
  // Compare both packages with the same scorer/catalog revision.
  const scoredLabeled = (await scoreOne(file, bench, { write: false, silent: true })).scores;
  appendScoreboard([{ file: outFile, pkg: scoredFresh.pkg, scores: scoredFresh.scores }]);

  const md = [
    `# Rerun — \`${fresh.id}\` from \`${labeled.id}\``, '',
    `Topic "${topic}" · ${gradeLevel} · ${BASE} · ${gitSha} · ${new Date().toISOString()}`, '',
    '## Selection diff (slot = objective index : position)', '',
    '| slot | before | after | status |', '|---|---|---|---|',
    ...rows.map((r) => `| ${r.key} | ${r.before} | ${r.after} | ${r.status} |`),
    '', '## Machine scores', '',
    '| check | before | after |', '|---|---|---|',
    ...[...Object.keys({ ...scoredLabeled.gates, ...scoredLabeled.checks })].map((k) => {
      const bv = scoredLabeled.gates[k] ?? scoredLabeled.checks[k];
      const av = scoredFresh.scores.gates[k] ?? scoredFresh.scores.checks[k];
      return `| ${k} | ${mark(bv)} | ${mark(av)}${bv !== av ? ' ←' : ''} |`;
    }),
    `| bucket | ${scoredLabeled.bucket} | ${scoredFresh.scores.bucket} |`,
    '', '## Re-rate in the rail (everything else carried as keep)', '',
    ...(reRate.length ? reRate.map((r) => `- ${r}`) : ['- nothing — every block matched a kept block']),
    '', `Drop \`${outFile}\` on the Lesson Bench panel; the carried keeps are pre-filled.`,
  ].join('\n');
  const mdFile = join(PKG_DIR, `${fresh.id}.rerun.md`);
  writeFileSync(mdFile, md + '\n');
  console.log(`\n${md}\n\nsaved → ${outFile} + ${mdFile}`);
}

// ── diff ───────────────────────────────────────────────────────────────────
function cmdDiff() {
  const [a, b] = positional;
  if (!a || !b) { console.error('usage: diff <runA> <runB>  (runId prefixes from scoreboard.jsonl)'); process.exit(2); }
  if (!existsSync(SCOREBOARD)) { console.error(`no ${SCOREBOARD}`); process.exit(1); }
  const rows = readFileSync(SCOREBOARD, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const pick = (run) => rows.filter((r) => r.runId.startsWith(run));
  const A = pick(a), B = pick(b);
  if (!A.length || !B.length) { console.error(`run not found: ${!A.length ? a : b}`); process.exit(1); }
  const key = (r) => `${r.packageId}|${r.checkId}`;
  const mapA = new Map(A.map((r) => [key(r), r.score]));
  let changed = 0;
  console.log(`| package | check | ${a} | ${b} |`, '\n|---|---|---|---|');
  for (const r of B) {
    const before = mapA.get(key(r));
    if (before === undefined || before === r.score) continue;
    changed++;
    console.log(`| ${r.packageId} | ${r.checkId} | ${mark(before)} | ${mark(r.score)} |`);
  }
  console.log(`\n${changed} check(s) changed across ${new Set(B.map((r) => r.packageId)).size} package(s).`);
}

// ── main ───────────────────────────────────────────────────────────────────
if (cmd === 'diff') {
  cmdDiff();
} else if (['score', 'triage', 'rerun'].includes(cmd)) {
  const bench = await loadBench();
  try {
    if (cmd === 'score') await cmdScore(bench);
    else if (cmd === 'triage') await cmdTriage(bench);
    else await cmdRerun(bench);
  } finally {
    await bench.close();
  }
} else {
  console.log('usage: node scripts/lesson-bench.mjs score|triage|rerun|diff … (see header)');
  process.exit(2);
}
