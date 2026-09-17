#!/usr/bin/env node
/**
 * Specialist-suggestion A/B — does handing the curator TypeSafe's top fits per
 * objective (one SPECIALIST SUGGESTIONS block in the manifest prompt) change
 * what it SELECTS, and is the change more than run-to-run noise?
 *
 * Objectives are FIXED from a prior scripts/typesafe-bench.mjs run (its Gemini
 * path already ran the curator brief), so every arm sees the same lesson:
 *   control    the production prompt, run --runs more times (noise floor;
 *              the bench run itself is control run 0)
 *   suggested  same prompt + the suggestion block (topic-trace ?suggestions=typesafe)
 *
 * Scored with NO LLM, per objective:
 *   jaccard(control_i, control_j)   how much the curator varies on its own
 *   jaccard(suggested, control_0)   how far the suggestion arm moved
 *   take rate                       a suggested candidate appears in the block
 *   baseline take rate              the same candidate appeared in control anyway
 *   specialist share                picks with >= 2 eval modes / all picks
 * plus a table of objectives where the suggested block differs from EVERY
 * control run, with the candidates it was shown — that is what to judge.
 *
 * Usage:
 *   node scripts/typesafe-suggest-ab.mjs [--from qa/typesafe/bench-<stamp>.json]
 *        [--runs 1] [--limit 24] [--base http://localhost:3000] [--out qa/typesafe]
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : dflt;
};
const OUT = opt('out', 'qa/typesafe');
const latestBench = () => readdirSync(OUT).filter((f) => /^bench-.*\.json$/.test(f)).sort().at(-1);
const FROM = opt('from', latestBench() ? join(OUT, latestBench()) : null);
if (!FROM) { console.error('no bench json found; run scripts/typesafe-bench.mjs first or pass --from'); process.exit(2); }
const RUNS = Number(opt('runs', '1'));
// topic-trace `suggestions` value: typesafe (fit >= 1.5, max 4) or typesafe-strict (fit >= 2.2, max 3, no policy scaffolds)
const ARM = opt('arm', 'typesafe');
const LIMIT = Number(opt('limit', '999'));
const BASE = opt('base', 'http://localhost:3000');
const PARALLEL = 3;

const bench = JSON.parse(readFileSync(FROM, 'utf8'));
const cases = bench.sample
  .map((s, i) => ({ s, g: bench.gemini[i] }))
  .filter(({ g }) => !g.error && g.objectives.length)
  .slice(0, LIMIT);
console.error(`from ${FROM}: ${cases.length} subskills, ${cases.reduce((a, c) => a + c.g.objectives.length, 0)} objectives`);

const bandOf = (g) => (/^k$/i.test(g) ? 'kindergarten' : Number(g) <= 5 ? 'elementary' : Number(g) <= 8 ? 'middle-school' : 'high-school');
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (x) => (Number.isNaN(x) ? '-' : `${Math.round(x * 100)}%`);
const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); const u = new Set([...A, ...B]); if (!u.size) return 1; let i = 0; for (const x of A) if (B.has(x)) i++; return i / u.size; };

async function pool(items, limit, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}
async function trace(body) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 240_000);
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE}/api/lumina/topic-trace`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, manifestOnly: true }), signal: ctl.signal });
    const ms = Math.round(performance.now() - t0);
    const json = await res.json();
    if (!res.ok || json.status === 'error') throw new Error(json.error || `HTTP ${res.status}`);
    return { json, ms };
  } finally { clearTimeout(t); }
}
const picksOf = (json) => (json.objectives ?? []).map((o) => ({ objectiveId: o.objectiveId, picks: (o.componentConfigs ?? []).map((c) => ({ componentId: c.componentId, pin: c.targetEvalMode ?? null, evalModeCount: c.evalModeCount ?? 0 })) }));

// ---- run arms ---------------------------------------------------------------
const jobs = [];
for (const c of cases) {
  const fixed = c.g.objectives.map((o) => ({ id: o.objectiveId, text: o.text, verb: o.verb || 'understand', icon: 'book', grade: c.s.grade }));
  const body = { topic: c.s.description, gradeLevel: bandOf(c.s.grade), objectives: fixed };
  for (let r = 1; r <= RUNS; r++) jobs.push({ c, arm: 'control', run: r, body });
  jobs.push({ c, arm: 'suggested', run: 1, body: { ...body, suggestions: ARM } });
}
const results = await pool(jobs, PARALLEL, async (job, i) => {
  try {
    const { json, ms } = await trace(job.body);
    console.error(`[${i + 1}/${jobs.length}] ${job.c.s.subskillId} ${job.arm}${job.arm === 'control' ? job.run : ''} ${ms} ms${json.suggestions ? ` · suggestions ${json.suggestions.ms} ms` : ''}`);
    return { ...job, ms, objectives: picksOf(json), suggestions: json.suggestions ?? null, error: null };
  } catch (e) {
    console.error(`[${i + 1}/${jobs.length}] ${job.c.s.subskillId} ${job.arm} FAILED ${e.message}`);
    return { ...job, ms: null, objectives: [], suggestions: null, error: e.message };
  }
});

// ---- score ------------------------------------------------------------------
const rows = [];
for (const c of cases) {
  const controls = [{ run: 0, objectives: c.g.objectives.map((o) => ({ objectiveId: o.objectiveId, picks: o.picks })) }, ...results.filter((r) => r.c === c && r.arm === 'control' && !r.error).map((r) => ({ run: r.run, objectives: r.objectives }))];
  const sug = results.find((r) => r.c === c && r.arm === 'suggested');
  if (!sug || sug.error) continue;
  for (const o of c.g.objectives) {
    const ids = (arm) => [...new Set((arm.objectives.find((x) => x.objectiveId === o.objectiveId)?.picks ?? []).map((p) => p.componentId))];
    const cSets = controls.map((k) => ids(k));
    const sSet = ids(sug);
    const cand = sug.suggestions?.perObjective.find((x) => x.objectiveId === o.objectiveId)?.candidates ?? [];
    const candIds = cand.map((x) => x.id);
    const noise = cSets.length >= 2 ? mean(cSets.slice(1).map((s) => jaccard(cSets[0], s))) : NaN;
    const moved = jaccard(cSets[0], sSet);
    const specShare = (arm) => { const ps = (arm.objectives.find((x) => x.objectiveId === o.objectiveId)?.picks ?? []); return ps.length ? ps.filter((p) => p.evalModeCount >= 2).length / ps.length : NaN; };
    rows.push({
      subskillId: c.s.subskillId, grade: c.s.grade, objective: o.text, objectiveId: o.objectiveId,
      control: cSets, suggested: sSet, candidates: cand,
      noise, moved,
      takeSuggested: candIds.length ? candIds.some((id) => sSet.includes(id)) : null,
      takeTop1Suggested: candIds.length ? sSet.includes(candIds[0]) : null,
      takeControl: candIds.length ? cSets.some((s) => candIds.some((id) => s.includes(id))) : null,
      takeControl0: candIds.length ? candIds.some((id) => cSets[0].includes(id)) : null,
      specControl: mean(controls.map((k) => specShare(k)).filter((x) => !Number.isNaN(x))),
      specSuggested: specShare(sug),
      sizeControl: mean(cSets.map((s) => s.length)), sizeSuggested: sSet.length,
      novel: !cSets.some((s) => jaccard(s, sSet) === 1),
    });
  }
}
const withCand = rows.filter((r) => r.candidates.length);
const summary = {
  subskills: cases.length, objectives: rows.length, objectivesWithCandidates: withCand.length,
  controlRuns: 1 + RUNS,
  noiseJaccard: mean(rows.map((r) => r.noise).filter((x) => !Number.isNaN(x))),
  movedJaccard: mean(rows.map((r) => r.moved)),
  takeSuggested: mean(withCand.map((r) => (r.takeSuggested ? 1 : 0))),
  takeTop1Suggested: mean(withCand.map((r) => (r.takeTop1Suggested ? 1 : 0))),
  takeControl0: mean(withCand.map((r) => (r.takeControl0 ? 1 : 0))),
  takeAnyControl: mean(withCand.map((r) => (r.takeControl ? 1 : 0))),
  specControl: mean(rows.map((r) => r.specControl).filter((x) => !Number.isNaN(x))),
  specSuggested: mean(rows.map((r) => r.specSuggested).filter((x) => !Number.isNaN(x))),
  sizeControl: mean(rows.map((r) => r.sizeControl)), sizeSuggested: mean(rows.map((r) => r.sizeSuggested)),
  novelBlocks: rows.filter((r) => r.novel).length,
  msControl: mean(results.filter((r) => r.arm === 'control' && r.ms).map((r) => r.ms)),
  msSuggested: mean(results.filter((r) => r.arm === 'suggested' && r.ms).map((r) => r.ms)),
  msSuggestionsOnly: mean(results.filter((r) => r.arm === 'suggested' && r.suggestions).map((r) => r.suggestions.ms)),
  failed: results.filter((r) => r.error).length,
};

// ---- report -----------------------------------------------------------------
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const md = [];
md.push(`# Specialist-suggestion A/B (${ARM}) — ${summary.subskills} subskills, ${summary.objectives} objectives`, ``);
md.push(`fixed objectives from ${FROM} · suggestion arm \`${ARM}\` · control runs ${summary.controlRuns} (bench run = run 0) · suggested runs 1 · failed ${summary.failed}`, ``);
md.push(`| metric | control | suggested |`, `|---|---|---|`);
md.push(`| pick-set Jaccard vs control run 0 | ${pct(summary.noiseJaccard)} (noise floor, run 1+ vs 0) | ${pct(summary.movedJaccard)} |`);
md.push(`| objectives whose block matches NO control run | - | ${summary.novelBlocks} / ${summary.objectives} |`);
md.push(`| a shown candidate is in the block (${summary.objectivesWithCandidates} objectives had candidates) | ${pct(summary.takeControl0)} run 0 · ${pct(summary.takeAnyControl)} any control | ${pct(summary.takeSuggested)} |`);
md.push(`| the TOP candidate is in the block | - | ${pct(summary.takeTop1Suggested)} |`);
md.push(`| specialist share of picks (>= 2 eval modes) | ${pct(summary.specControl)} | ${pct(summary.specSuggested)} |`);
md.push(`| picks per objective | ${summary.sizeControl.toFixed(2)} | ${summary.sizeSuggested.toFixed(2)} |`);
md.push(`| manifest ms (brief skipped) | ${Math.round(summary.msControl)} | ${Math.round(summary.msSuggested)} (of which suggestions ${Math.round(summary.msSuggestionsOnly)}) |`);
md.push(``, `Lift = take(suggested) − take(control): the curator already picked the shown candidate in control ${pct(summary.takeControl0)} of the time; with the block it did so ${pct(summary.takeSuggested)}. A block that matches no control run is a real change, not noise.`);

md.push(``, `## Blocks the suggestion changed (differ from every control run)`, ``);
md.push(`| subskill | grade | objective | control run 0 | other control runs | suggested | candidates shown (fit) |`, `|---|---|---|---|---|---|---|`);
for (const r of rows.filter((r) => r.novel)) {
  md.push(`| ${r.subskillId} | ${r.grade} | ${r.objective.replace(/\|/g, '/').slice(0, 80)} | ${r.control[0].join(', ')} | ${r.control.slice(1).map((s) => s.join(', ')).join(' ‖ ') || '-'} | ${r.suggested.join(', ')} | ${r.candidates.map((c) => `${c.id} ${c.fit.toFixed(1)}`).join(', ') || '-'} |`);
}
md.push(``, `## All objectives`, ``);
md.push(`| subskill | objective | control 0 | suggested | candidates | taken |`, `|---|---|---|---|---|---|`);
for (const r of rows) md.push(`| ${r.subskillId} | ${r.objective.replace(/\|/g, '/').slice(0, 70)} | ${r.control[0].join(', ')} | ${r.suggested.join(', ')} | ${r.candidates.map((c) => c.id).join(', ') || '-'} | ${r.takeSuggested == null ? '-' : r.takeSuggested ? 'yes' : 'no'} |`);

mkdirSync(OUT, { recursive: true });
const text = md.join('\n');
const name = `suggest-ab-${ARM}-${stamp}`;
writeFileSync(join(OUT, `${name}.md`), text);
writeFileSync(join(OUT, `${name}.json`), JSON.stringify({ from: FROM, arm: ARM, runs: RUNS, summary, rows, results: results.map(({ c, ...r }) => ({ subskillId: c.s.subskillId, ...r })) }, null, 2));
console.log(text);
console.log(`\nsaved ${join(OUT, name)}.{md,json}`);
