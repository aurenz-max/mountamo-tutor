#!/usr/bin/env node
/**
 * Affordance-tag A/B — does rendering catalog affordance tags change what the
 * curator SELECTS, and does it cost supply?
 *
 * For each topic: one seed run fixes the objectives (so both arms see the same
 * lesson), then N manifestOnly runs per arm — `affordances=off` (control: the
 * catalog lines exactly as before) and `on` (tags + legend). Each run is scored
 * from the route's `selection` rows (componentId + resolved affordances) with
 * NO LLM:
 *   distinct   distinct primitives in the lesson (curator-brief excluded)
 *   supply     union of distinct primitives across an arm's runs — the ablation
 *              guard: a primitive present under OFF and absent under ON is a
 *              LOSS the tags caused
 *   symOpen    objectives whose FIRST block shows only `symbolic` (Q3)
 *   caregiver  blocks an adult reads; `misplaced` = not last in its objective
 *   readsAbove blocks whose child path needs reading (Q8 at kindergarten)
 *   spoken     blocks answered out loud (G6)
 *   untagged   blocks whose primitive has no affordances yet (unknown, not bad)
 *   minutes    sum of known per-block minutes (the `too-long` reason)
 *
 * Usage:
 *   node scripts/affordance-ab.mjs [--runs 2] [--base http://localhost:3000]
 *                                  [--topics <json file>] [--out qa/lesson-bench/ab]
 * Topics file: [{ "topic": "...", "gradeLevel": "kindergarten" }, ...]
 * Writes <out>/affordances-<stamp>.json + .md and prints the .md.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : dflt;
};
const RUNS = Number(opt('runs', '2'));
const BASE = opt('base', 'http://localhost:3000');
const OUT = opt('out', 'qa/lesson-bench/ab');
const TOPICS = opt('topics', null)
  ? JSON.parse(readFileSync(opt('topics'), 'utf8'))
  : [
      { topic: 'Counting objects to 10', gradeLevel: 'kindergarten' },
      { topic: 'Addition within 5 with objects', gradeLevel: 'kindergarten' },
      { topic: 'Skip counting by 5s to 100', gradeLevel: 'elementary' },
      { topic: 'Adding two-digit numbers with regrouping', gradeLevel: 'elementary' },
      // 2026-09-05: the set was four MATH topics, so `untagged` read 0 in both arms
      // while literacy.ts sat at 0% tagged and was never reached for. One K literacy
      // topic makes the untagged column mean something again — and whatever it picks
      // IS the next tagging queue.
      { topic: 'Identifying beginning sounds in words', gradeLevel: 'kindergarten' },
    ];

async function trace(body) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 240_000);
  try {
    const res = await fetch(`${BASE}/api/lumina/topic-trace`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, manifestOnly: true }),
      signal: ctl.signal,
    });
    if (!res.ok) return { error: `${res.status} ${await res.text().catch(() => '')}`.slice(0, 300) };
    return await res.json();
  } catch (e) {
    return { error: String(e?.message ?? e) };
  } finally {
    clearTimeout(t);
  }
}

function score(resp) {
  const rows = (resp.selection ?? []).filter((r) => r.componentId !== 'curator-brief');
  const byObj = new Map();
  for (const r of rows) {
    const k = r.isFinalAssessment ? '__final__' : (r.objectiveId ?? '__final__');
    if (!byObj.has(k)) byObj.set(k, []);
    byObj.get(k).push(r);
  }
  let symOpen = 0, unknownOpen = 0, caregiver = 0, misplaced = 0, readsAbove = 0, spoken = 0, untagged = 0, minutes = 0;
  for (const [k, list] of byObj) {
    if (k !== '__final__') {
      const a = list[0].affordances;
      if (!a || !a.declared || a.representation.length === 0) unknownOpen++;
      else if (a.representation.every((x) => x === 'symbolic')) symOpen++;
    }
    list.forEach((r, i) => {
      const a = r.affordances;
      if (!a || !a.declared) { untagged++; return; }
      if (a.audience === 'caregiver') { caregiver++; if (i !== list.length - 1) misplaced++; }
      if (a.reader === 'emerging' || a.reader === 'developing') readsAbove++;
      if (a.answers.includes('spoken')) spoken++;
      if (typeof a.minutes === 'number') minutes += a.minutes;
    });
  }
  const ids = rows.map((r) => r.componentId);
  return {
    blocks: rows.length,
    distinct: new Set(ids).size,
    ids: [...new Set(ids)],
    objectives: byObj.size - (byObj.has('__final__') ? 1 : 0),
    symOpen, unknownOpen, caregiver, misplaced, readsAbove, spoken, untagged, minutes,
  };
}

const mean = (xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : 0);

const results = [];
for (const t of TOPICS) {
  process.stderr.write(`\n▶ ${t.topic} (${t.gradeLevel})\n`);
  const seed = await trace({ topic: t.topic, gradeLevel: t.gradeLevel, affordances: false });
  if (seed.error) { process.stderr.write(`  seed failed: ${seed.error}\n`); results.push({ ...t, error: seed.error }); continue; }
  const objectives = (seed.briefObjectives ?? seed.objectives?.map((o) => ({ id: o.objectiveId, text: o.objectiveText, verb: o.objectiveVerb, icon: '🎯' })) ?? []);
  const arms = { off: [], on: [] };
  for (const arm of ['off', 'on']) {
    for (let r = 0; r < RUNS; r++) {
      const resp = await trace({ topic: t.topic, gradeLevel: t.gradeLevel, objectives, affordances: arm === 'on' });
      if (resp.error) { process.stderr.write(`  ${arm}#${r + 1} failed: ${resp.error}\n`); arms[arm].push({ error: resp.error }); continue; }
      const s = score(resp);
      s.affordanceTags = resp.affordanceTags;
      s.selection = resp.selection;
      arms[arm].push(s);
      process.stderr.write(`  ${arm}#${r + 1}: ${s.blocks} blocks, ${s.distinct} distinct, symOpen ${s.symOpen}, caregiver ${s.caregiver}${s.misplaced ? ` (${s.misplaced} misplaced)` : ''}, untagged ${s.untagged}\n`);
    }
  }
  const agg = {};
  for (const arm of ['off', 'on']) {
    const ok = arms[arm].filter((x) => !x.error);
    agg[arm] = {
      runs: ok.length,
      failed: arms[arm].length - ok.length,
      blocks: mean(ok.map((x) => x.blocks)),
      distinct: mean(ok.map((x) => x.distinct)),
      supply: [...new Set(ok.flatMap((x) => x.ids))].sort(),
      symOpen: mean(ok.map((x) => x.symOpen)),
      unknownOpen: mean(ok.map((x) => x.unknownOpen)),
      caregiver: mean(ok.map((x) => x.caregiver)),
      misplaced: mean(ok.map((x) => x.misplaced)),
      readsAbove: mean(ok.map((x) => x.readsAbove)),
      spoken: mean(ok.map((x) => x.spoken)),
      untagged: mean(ok.map((x) => x.untagged)),
      minutes: mean(ok.map((x) => x.minutes)),
    };
  }
  const lost = agg.off.supply.filter((id) => !agg.on.supply.includes(id));
  const gained = agg.on.supply.filter((id) => !agg.off.supply.includes(id));
  results.push({ ...t, objectives, arms: agg, lost, gained, runs: arms });
}

// ── Report ──
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
const md = [];
md.push(`# Affordance-tag A/B — ${stamp}`, '', `Base ${BASE} · ${RUNS} run(s) per arm · fixed objectives per topic (seed run). OFF = catalog lines as before; ON = tags + legend.`, '');
md.push('| topic | grade | arm | runs | blocks | distinct | symOpen | caregiver | misplaced | readsAbove | spoken | untagged | ~min |');
md.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  if (r.error) { md.push(`| ${r.topic} | ${r.gradeLevel} | — | seed failed: ${r.error} |`); continue; }
  for (const arm of ['off', 'on']) {
    const a = r.arms[arm];
    md.push(`| ${r.topic} | ${r.gradeLevel} | ${arm} | ${a.runs}${a.failed ? ` (+${a.failed} failed)` : ''} | ${a.blocks} | ${a.distinct} | ${a.symOpen} | ${a.caregiver} | ${a.misplaced} | ${a.readsAbove} | ${a.spoken} | ${a.untagged} | ${a.minutes} |`);
  }
}
md.push('', '## Supply (union of primitives per arm)', '');
const perGrade = {};
for (const r of results) {
  if (r.error) continue;
  md.push(`- **${r.topic}** (${r.gradeLevel}): OFF ${r.arms.off.supply.length} · ON ${r.arms.on.supply.length}` +
    (r.lost.length ? ` · **LOST under ON: ${r.lost.join(', ')}**` : ' · lost: none') +
    (r.gained.length ? ` · gained: ${r.gained.join(', ')}` : ''));
  const g = (perGrade[r.gradeLevel] ??= { off: new Set(), on: new Set() });
  r.arms.off.supply.forEach((id) => g.off.add(id));
  r.arms.on.supply.forEach((id) => g.on.add(id));
}
md.push('', '| grade | OFF supply | ON supply | lost under ON | gained under ON |', '|---|---|---|---|---|');
for (const [g, s] of Object.entries(perGrade)) {
  const lost = [...s.off].filter((id) => !s.on.has(id));
  const gained = [...s.on].filter((id) => !s.off.has(id));
  md.push(`| ${g} | ${s.off.size} | ${s.on.size} | ${lost.join(', ') || 'none'} | ${gained.join(', ') || 'none'} |`);
}
// ── Noise floor: --against <previous run .json> ──
// OFF arms never see tags, so two runs' OFF arms are two samples of the same
// curator. A "lost under ON" smaller than OFF-vs-OFF is noise, not ablation;
// the ablation signature is UNTAGGED blocks dropping under ON. At n=3 the
// floor was 2-3 primitives per grade (2026-09-04), so read losses pooled.
const AGAINST = opt('against', null);
if (AGAINST) {
  const prev = JSON.parse(readFileSync(AGAINST, 'utf8'));
  const union = (rs, arm) => {
    const g = {};
    for (const t of rs) {
      if (t.error) continue;
      const s = (g[t.gradeLevel] ??= new Set());
      for (const run of t.runs[arm]) if (!run.error) for (const id of run.ids ?? []) s.add(id);
    }
    return g;
  };
  const diff = (x, y) => [...x].filter((id) => !y.has(id));
  const P = { off: union(prev, 'off'), on: union(prev, 'on') };
  const C = { off: union(results, 'off'), on: union(results, 'on') };
  md.push('', `## Noise floor vs ${AGAINST}`, '', '| grade | OFF-vs-OFF lost | OFF-vs-OFF gained | lost under ON (this run) | pooled lost (both runs) | pooled gained |', '|---|---|---|---|---|---|');
  for (const g of Object.keys(C.off)) {
    const pOff = P.off[g] ?? new Set(), pOn = P.on[g] ?? new Set();
    const offAll = new Set([...pOff, ...C.off[g]]);
    const onAll = new Set([...pOn, ...C.on[g]]);
    md.push(`| ${g} | ${diff(pOff, C.off[g]).join(', ') || 'none'} | ${diff(C.off[g], pOff).join(', ') || 'none'} | ${diff(C.off[g], C.on[g]).join(', ') || 'none'} | ${diff(offAll, onAll).join(', ') || 'none'} | ${diff(onAll, offAll).join(', ') || 'none'} |`);
  }
  md.push('', 'Ship when the pooled loss is empty (or only primitives below the OFF-vs-OFF churn) AND untagged blocks are ≈ 0 under both arms.');
}

md.push('', '## Selections', '');
for (const r of results) {
  if (r.error) continue;
  md.push(`### ${r.topic} (${r.gradeLevel})`, '');
  for (const arm of ['off', 'on']) {
    r.runs[arm].forEach((run, i) => {
      if (run.error) { md.push(`- ${arm}#${i + 1}: FAILED ${run.error}`); return; }
      const byObj = new Map();
      for (const s of run.selection.filter((x) => x.componentId !== 'curator-brief')) {
        const k = s.isFinalAssessment ? 'final' : (s.objectiveId ?? 'final');
        if (!byObj.has(k)) byObj.set(k, []);
        byObj.get(k).push(`${s.componentId}${s.targetEvalMode ? `[${s.targetEvalMode}]` : ''}${s.affordances?.audience === 'caregiver' ? '👪' : ''}`);
      }
      md.push(`- ${arm}#${i + 1}: ` + [...byObj].map(([k, v]) => `${k}: ${v.join(' → ')}`).join(' ‖ '));
    });
  }
  md.push('');
}
const text = md.join('\n');
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, `affordances-${stamp}.json`), JSON.stringify(results, null, 2));
writeFileSync(join(OUT, `affordances-${stamp}.md`), text);
console.log(text);
console.log(`\nsaved → ${join(OUT, `affordances-${stamp}.{json,md}`)}`);
