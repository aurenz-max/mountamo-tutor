#!/usr/bin/env node
/**
 * TypeSafe vs Gemini primitive-selection bench over PUBLISHED subskills.
 *
 * For each sampled subskill the PRODUCTION objective path runs once — curator
 * brief → learning objectives → Gemini manifest → eval-mode resolver — via
 * POST /api/lumina/topic-trace {manifestOnly}. Those same objective texts are
 * then handed, one objective at a time (how the curator selects), to the
 * TypeSafe selector via POST /api/lumina/typesafe-select, once per arm:
 *   none         every primitive is an option for every phase role
 *   affordances  each role only sees primitives whose catalog affordances
 *                declare that role (untagged stay in)
 *
 * Scored with NO LLM. Per objective:
 *   hit@roles    share of Gemini's picks that are a TypeSafe role winner
 *                (introduce / visualize / apply)
 *   hit@top5     share of Gemini's picks in TypeSafe's overall skim top 5
 *   modeAgree    on primitives BOTH selected: TypeSafe's single mode is inside
 *                Gemini's resolved pin ('a', 'a|b', or 'mixed')
 * plus a disagreement table (Gemini picks TypeSafe ranks >10; TypeSafe role
 * winners with fit >= 2.5 Gemini skipped) for the caller to judge. Agreement
 * is not correctness: the disagreements are where the judgment call is.
 *
 * Usage:
 *   node scripts/typesafe-bench.mjs [--n 24] [--seed 7] [--arms none,affordances]
 *        [--base http://localhost:3000] [--backend http://127.0.0.1:8000]
 *        [--subjects "Mathematics,Language Arts,Science,Social Studies"] [--grades K,1,2,3,4,5]
 *        [--out qa/typesafe]
 * Needs the dev server on :3000 (Gemini + TypeSafe keys server-side) and the
 * backend on :8000 (published curriculum, public endpoint).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : dflt;
};
const N = Number(opt('n', '24'));
const SEED = Number(opt('seed', '7'));
// Arm name = roleFilter, optionally '-objective' for objective-focused state:
//   none · affordances · affordances-objective · none-objective
const ARMS = opt('arms', 'none,affordances,affordances-objective').split(',').map((s) => s.trim()).filter(Boolean);
const armParams = (arm) => {
  const [roleFilter, focus] = arm.split('-');
  return { roleFilter: roleFilter === 'affordances' ? 'affordances' : 'none', focus: focus === 'objective' ? 'objective' : 'topic' };
};
const BASE = opt('base', 'http://localhost:3000');
const BACKEND = opt('backend', 'http://127.0.0.1:8000');
const SUBJECTS = opt('subjects', 'Mathematics,Language Arts,Science,Social Studies').split(',').map((s) => s.trim());
const GRADES = opt('grades', 'K,1,2,3,4,5').split(',').map((s) => s.trim());
const OUT = opt('out', 'qa/typesafe');
const K = 6;
const GEMINI_PARALLEL = 3;
const TYPESAFE_PARALLEL = 4;

// ---- helpers ----------------------------------------------------------------
const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shuffle = (arr, rnd) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (x) => (Number.isNaN(x) ? '-' : `${Math.round(x * 100)}%`);
const bandOf = (g) => (/^k$/i.test(g) ? 'kindergarten' : Number(g) <= 5 ? 'elementary' : Number(g) <= 8 ? 'middle-school' : 'high-school');

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

async function postJson(url, body, { timeoutMs = 240_000, retries = 2 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const t0 = performance.now();
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
      const ms = Math.round(performance.now() - t0);
      const text = await res.text();
      if ((res.status === 429 || res.status === 502 || res.status === 529) && attempt < retries) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 300)}`);
      return { json: JSON.parse(text), ms };
    } finally {
      clearTimeout(t);
    }
  }
}

// ---- 1. sample published subskills -------------------------------------------
// The endpoint serves ONE grade per call (no grade param = a default grade), so
// fetch every (subject, grade) cell explicitly.
async function fetchSubskills(subject, grade) {
  const res = await fetch(`${BACKEND}/api/curriculum/curriculum/${encodeURIComponent(subject)}?grade=${encodeURIComponent(grade)}`, { signal: AbortSignal.timeout(60_000) });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`backend ${subject} ${grade}: HTTP ${res.status}`);
  const { curriculum } = await res.json();
  const rows = [];
  for (const unit of curriculum ?? []) {
    for (const skill of unit.skills ?? []) {
      for (const sub of skill.subskills ?? []) {
        rows.push({
          // Units come back with grade 'Kindergarten' for ?grade=K — normalize so bandOf() and TypeSafe see 'K'.
          subject, grade: String(unit.grade ?? grade).replace(/^grade\s*/i, '').replace(/^kindergarten$/i, 'K').trim() || String(grade),
          unitId: unit.id, unitTitle: unit.title, skillId: skill.id, skillDescription: skill.description ?? null,
          subskillId: sub.id, description: sub.description,
        });
      }
    }
  }
  return rows;
}

const rnd = mulberry32(SEED);
const cellSpecs = SUBJECTS.flatMap((s) => GRADES.map((g) => [s, g]));
const all = (await pool(cellSpecs, 4, ([s, g]) => fetchSubskills(s, g).catch((e) => { console.error(e.message); return []; }))).flat();
const cells = new Map();
for (const r of all) {
  const key = `${r.subject}|${r.grade}`;
  if (!cells.has(key)) cells.set(key, []);
  cells.get(key).push(r);
}
for (const [k, v] of cells) cells.set(k, shuffle(v, rnd));
const cellKeys = shuffle([...cells.keys()], rnd);
const sample = [];
while (sample.length < N && cellKeys.some((k) => cells.get(k).length)) {
  for (const k of cellKeys) { const c = cells.get(k); if (c.length && sample.length < N) sample.push(c.shift()); }
}
console.error(`published subskills: ${all.length} · cells: ${cells.size} · sampled: ${sample.length}`);

// ---- 2. Gemini arm: brief → manifest → resolver ------------------------------
const gemini = await pool(sample, GEMINI_PARALLEL, async (s, i) => {
  try {
    const { json, ms } = await postJson(`${BASE}/api/lumina/topic-trace`, { topic: s.description, gradeLevel: bandOf(s.grade), manifestOnly: true });
    const objectives = (json.objectives ?? []).map((o) => ({
      objectiveId: o.objectiveId, text: o.objectiveText, verb: o.objectiveVerb,
      picks: (o.componentConfigs ?? []).map((c) => ({ componentId: c.componentId, pin: c.targetEvalMode ?? null, evalModeCount: c.evalModeCount ?? 0 })),
    }));
    const finalAssessment = json.finalAssessment?.componentId ?? null;
    console.error(`[gemini ${i + 1}/${sample.length}] ${s.subskillId} ${ms} ms · ${objectives.length} objectives · ${objectives.reduce((a, o) => a + o.picks.length, 0)} picks`);
    return { ms, objectives, finalAssessment, error: null };
  } catch (e) {
    console.error(`[gemini ${i + 1}/${sample.length}] ${s.subskillId} FAILED ${e.message}`);
    return { ms: null, objectives: [], finalAssessment: null, error: e.message };
  }
});

// ---- 3. TypeSafe arms: one call per objective per arm ------------------------
const jobs = [];
sample.forEach((s, si) => gemini[si].objectives.forEach((o, oi) => ARMS.forEach((arm) => jobs.push({ si, oi, arm, s, o }))));
const tsResults = await pool(jobs, TYPESAFE_PARALLEL, async (job, i) => {
  try {
    const { json, ms } = await postJson(`${BASE}/api/lumina/typesafe-select`, { topic: job.s.description, grade: job.s.grade, objectives: [job.o.text], k: K, ...armParams(job.arm) }, { timeoutMs: 90_000 });
    if (i % 10 === 0) console.error(`[typesafe ${i + 1}/${jobs.length}] ${job.arm} ${ms} ms`);
    return { ...job, ms, result: json, error: null };
  } catch (e) {
    console.error(`[typesafe ${i + 1}/${jobs.length}] ${job.s.subskillId} ${job.arm} FAILED ${e.message}`);
    return { ...job, ms: null, result: null, error: e.message };
  }
});

// ---- 4. score -----------------------------------------------------------------
const modeInPin = (mode, pin) => pin == null || pin === 'mixed' || (mode != null && pin.split('|').includes(mode));
const perObjective = [];
for (const r of tsResults) {
  if (!r.result) { perObjective.push({ ...r, scored: null }); continue; }
  const res = r.result;
  const gemPicks = r.o.picks.filter((p) => p.componentId !== 'curator-brief');
  const gemIds = [...new Set(gemPicks.map((p) => p.componentId))];
  const roleWinners = res.roles.filter((x) => x.role !== 'assess').map((x) => x.id);
  const roleWinnerSet = new Set(roleWinners);
  const top5 = new Set(res.overall.slice(0, 5).map((x) => x.id));
  const rankOf = (id) => res.overall.find((x) => x.id === id)?.rank ?? null;
  const shortlistOf = (id) => res.shortlist.find((x) => x.id === id) ?? null;
  const hitRoles = gemIds.length ? gemIds.filter((id) => roleWinnerSet.has(id)).length / gemIds.length : NaN;
  const hitTop5 = gemIds.length ? gemIds.filter((id) => top5.has(id)).length / gemIds.length : NaN;
  const shared = gemPicks.filter((p) => p.evalModeCount >= 2 && shortlistOf(p.componentId)?.mode);
  const modeAgree = shared.length ? shared.filter((p) => modeInPin(shortlistOf(p.componentId).mode, p.pin)).length / shared.length : NaN;
  const geminiOnly = gemIds.filter((id) => (rankOf(id) ?? 999) > 10 && !roleWinnerSet.has(id)).map((id) => ({ id, rank: rankOf(id), fit: shortlistOf(id)?.fit ?? null }));
  const typesafeOnly = res.roles.filter((x) => x.role !== 'assess' && !gemIds.includes(x.id)).map((x) => ({ id: x.id, role: x.role, p: x.p, fit: shortlistOf(x.id)?.fit ?? null })).filter((x) => (x.fit ?? 0) >= 2.5);
  perObjective.push({ ...r, scored: { gemIds, roleWinners, hitRoles, hitTop5, modeAgree, sharedModes: shared.length, geminiOnly, typesafeOnly, tokens: res.skim.usage.input_tokens + res.verify.usage.input_tokens, roleOptionCounts: res.roleOptionCounts } });
}

const armSummary = {};
for (const arm of ARMS) {
  const rows = perObjective.filter((r) => r.arm === arm && r.scored);
  armSummary[arm] = {
    objectives: rows.length,
    failed: perObjective.filter((r) => r.arm === arm && !r.scored).length,
    hitRoles: mean(rows.map((r) => r.scored.hitRoles).filter((x) => !Number.isNaN(x))),
    hitTop5: mean(rows.map((r) => r.scored.hitTop5).filter((x) => !Number.isNaN(x))),
    modeAgree: mean(rows.map((r) => r.scored.modeAgree).filter((x) => !Number.isNaN(x))),
    sharedModes: rows.reduce((a, r) => a + r.scored.sharedModes, 0),
    msMean: mean(rows.map((r) => r.ms)),
    inputTokensMean: mean(rows.map((r) => r.scored.tokens)),
    geminiOnly: rows.reduce((a, r) => a + r.scored.geminiOnly.length, 0),
    typesafeOnly: rows.reduce((a, r) => a + r.scored.typesafeOnly.length, 0),
    roleOptionCounts: rows[0]?.scored.roleOptionCounts ?? null,
  };
}
const geminiOk = gemini.filter((g) => !g.error);
const geminiMs = mean(geminiOk.map((g) => g.ms));
const geminiObjectives = geminiOk.reduce((a, g) => a + g.objectives.length, 0);

// ---- 5. report ------------------------------------------------------------------
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const md = [];
md.push(`# TypeSafe vs Gemini selection bench — ${sample.length} published subskills`, ``);
md.push(`seed ${SEED} · subjects ${SUBJECTS.join(', ')} · grades ${GRADES.join(',')} · k ${K} · arms ${ARMS.join(', ')}`, ``);
md.push(`Gemini path (brief → manifest → resolver, manifestOnly): ${geminiOk.length}/${sample.length} ok · mean ${Math.round(geminiMs)} ms per subskill · ${geminiObjectives} objectives.`, ``);
md.push(`| arm | objectives | hit@roles | hit@top5 | modeAgree (n) | ms/objective | in-tokens/objective | Gemini-only picks | TypeSafe-only winners | role options |`);
md.push(`|---|---|---|---|---|---|---|---|---|---|`);
for (const arm of ARMS) {
  const a = armSummary[arm];
  const ro = a.roleOptionCounts ? Object.entries(a.roleOptionCounts).map(([k, v]) => `${k[0]}${v}`).join(' ') : '-';
  md.push(`| ${arm} | ${a.objectives}${a.failed ? ` (+${a.failed} failed)` : ''} | ${pct(a.hitRoles)} | ${pct(a.hitTop5)} | ${pct(a.modeAgree)} (${a.sharedModes}) | ${Math.round(a.msMean)} | ${Math.round(a.inputTokensMean)} | ${a.geminiOnly} | ${a.typesafeOnly} | ${ro} |`);
}
md.push(``, `hit@roles: Gemini's picks that TypeSafe made a role winner (introduce/visualize/apply). hit@top5: Gemini's picks in TypeSafe's overall top 5. modeAgree: on primitives both chose, TypeSafe's mode is inside Gemini's resolved pin. Agreement is not correctness — judge the disagreements below.`);

md.push(``, `## Per objective`, ``);
md.push(`| subskill | grade | objective | Gemini picks (pin) | ${ARMS.map((a) => `TypeSafe ${a}: introduce / visualize / apply`).join(' | ')} | ${ARMS.map((a) => `hit@roles ${a}`).join(' | ')} |`);
md.push(`|---|---|---|---|${ARMS.map(() => '---').join('|')}|${ARMS.map(() => '---').join('|')}|`);
sample.forEach((s, si) => {
  gemini[si].objectives.forEach((o, oi) => {
    const rows = ARMS.map((arm) => perObjective.find((r) => r.si === si && r.oi === oi && r.arm === arm));
    const gem = o.picks.map((p) => `${p.componentId}${p.pin ? ` (${p.pin})` : ''}`).join(', ');
    const ts = rows.map((r) => (r?.result ? r.result.roles.filter((x) => x.role !== 'assess').map((x) => `${x.id} ${x.p.toFixed(2)}`).join(' / ') : 'FAILED'));
    const hits = rows.map((r) => (r?.scored ? pct(r.scored.hitRoles) : '-'));
    md.push(`| ${s.subskillId} | ${s.grade} | ${o.text.replace(/\|/g, '/').slice(0, 90)} | ${gem} | ${ts.join(' | ')} | ${hits.join(' | ')} |`);
  });
  if (gemini[si].error) md.push(`| ${s.subskillId} | ${s.grade} | GEMINI FAILED: ${gemini[si].error.slice(0, 80)} | | ${ARMS.map(() => '').join(' | ')} | ${ARMS.map(() => '').join(' | ')} |`);
});

md.push(``, `## Disagreements to judge`, ``);
md.push(`| arm | subskill | objective | Gemini chose, TypeSafe ranked >10 (rank, fit) | TypeSafe role winner fit >= 2.5, Gemini skipped |`, `|---|---|---|---|---|`);
for (const r of perObjective) {
  if (!r.scored || (!r.scored.geminiOnly.length && !r.scored.typesafeOnly.length)) continue;
  md.push(`| ${r.arm} | ${r.s.subskillId} | ${r.o.text.replace(/\|/g, '/').slice(0, 70)} | ${r.scored.geminiOnly.map((x) => `${x.id} (${x.rank ?? '>30'}, ${x.fit?.toFixed(2) ?? '-'})`).join(', ') || '-'} | ${r.scored.typesafeOnly.map((x) => `${x.id} [${x.role}] fit ${x.fit.toFixed(2)}`).join(', ') || '-'} |`);
}

md.push(``, `## Sample`, ``, `| # | subject | grade | subskill | description |`, `|---|---|---|---|---|`);
sample.forEach((s, i) => md.push(`| ${i + 1} | ${s.subject} | ${s.grade} | ${s.subskillId} | ${s.description.replace(/\|/g, '/').slice(0, 120)} |`));

mkdirSync(OUT, { recursive: true });
const text = md.join('\n');
writeFileSync(join(OUT, `bench-${stamp}.md`), text);
writeFileSync(join(OUT, `bench-${stamp}.json`), JSON.stringify({ seed: SEED, arms: ARMS, k: K, sample, gemini, armSummary, perObjective: perObjective.map(({ s, o, ...rest }) => ({ subskillId: s.subskillId, objective: o.text, ...rest })) }, null, 2));
console.log(text);
console.log(`\nsaved ${join(OUT, `bench-${stamp}`)}.{md,json}`);
