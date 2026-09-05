#!/usr/bin/env node
/**
 * Replicate the phonics finding end to end: regenerate the journey's phonics
 * lessons through the real pipeline, judge them, and check the judge against a
 * deterministic per-letter count read straight from the generated data.
 *
 *   node scripts/lesson-coverage-replicate.mjs generate [--out DIR] [--lessons phonics-1,phonics-2]
 *   node scripts/lesson-coverage-replicate.mjs truth    [--out DIR]
 *
 * `generate` POSTs each lesson's frozen generationRequest to /api/lumina/topic-trace
 * (package=true) and saves the package. `truth` reads every package in DIR and
 * prints, per named letter, how many PRODUCTION items (child says the sound when
 * shown the letter) and how many RECOGNITION items (tap/choose) exist, then reads the
 * judge's verdict stored on the package (`coverage`, from lesson-coverage.mjs eval
 * --write) and reports agreement. Run from my-tutoring-app with the dev server up.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const cmd = argv.shift() ?? 'truth';
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt; };
const OUT = opt('out', join('qa', 'lesson-coverage', `replicate-${new Date().toISOString().slice(0, 10)}`));
const BASE = opt('base', 'http://localhost:3000');
const SCENARIO = join('qa', 'lesson-bench', 'journeys', 'phonics-starter.json');
const only = opt('lessons', '').split(',').filter(Boolean);

async function generate() {
  const scenario = JSON.parse(readFileSync(SCENARIO, 'utf8'));
  mkdirSync(OUT, { recursive: true });
  for (const l of scenario.lessons) {
    if (only.length && !only.includes(l.id)) continue;
    const body = { topic: l.topic, gradeLevel: l.gradeLevel, ...(l.generationRequest ?? {}), package: true };
    const t0 = Date.now();
    process.stdout.write(`${l.id} … `);
    const res = await fetch(`${BASE}/api/lumina/topic-trace`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json();
    const pkg = json.package;
    if (!pkg) { console.log(`FAILED (${res.status}): ${JSON.stringify(json).slice(0, 300)}`); continue; }
    pkg.provenance.generationRequest = body;
    const file = join(OUT, `${l.id}--${pkg.id}.json`);
    writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`${Math.round((Date.now() - t0) / 1000)}s → ${file} (${pkg.components.map((c) => c.componentId).join(', ')})`);
  }
}

// ── Ground truth: which named letters get an item, by demand ────────────────
const lower = (s) => String(s ?? '').trim().toLowerCase();
const namedSet = (text) => {
  const m = String(text).match(/Cumulative\)?:\*{0,2}\s*([a-z](?:\s*,\s*[a-z])+)/i) ?? String(text).match(/set[^:]*:\s*([a-z](?:\s*,\s*[a-z])+)/i);
  return m ? m[1].toLowerCase().split(/\s*,\s*/) : [];
};

/** One entry per item: { letter, demand: 'production' | 'recognition' | 'decode' | 'other', block, id } */
function itemsOf(pkg) {
  const out = [];
  for (const c of pkg.components) {
    const d = c.data ?? {};
    const push = (letter, demand, i) => out.push({ letter: lower(letter), demand, block: `${c.componentId}#${c.instanceId}`, id: `${c.instanceId}#challenges[${i}]` });
    if (c.componentId === 'di-letter-sounds') {
      // Every di-letter-sounds item is production of the letter's sound: an
      // isolated held sound, a clipped stop, or a short vowel elicited through
      // its keyword ("say apple") — the benched way to produce a vowel a K
      // child cannot isolate. Onset items (first_sound_in_word) produce a sound
      // from a spoken word; still production of that grapheme's phoneme.
      (d.challenges ?? []).forEach((it, i) => push(it.letter, 'production', i));
    } else if (c.componentId === 'letter-sound-link') {
      (d.challenges ?? []).forEach((it, i) => push(it.targetLetter, it.mode === 'see-hear' ? 'production' : it.mode === 'hear-see' ? 'recognition' : 'other', i));
    } else if (c.componentId === 'letter-spotter') {
      (d.challenges ?? []).forEach((it, i) => push(it.targetLetter, 'recognition', i));
    } else if (c.componentId === 'phoneme-explorer') {
      (d.challenges ?? []).forEach((it, i) => push(it.phoneme, 'recognition', i));
    } else if (c.componentId === 'phonics-blender') {
      (d.words ?? []).forEach((w, i) => (w.phonemes ?? []).forEach((p) => out.push({ letter: lower(p.letters), demand: 'decode', block: `${c.componentId}#${c.instanceId}`, id: `${c.instanceId}#words[${i}]` })));
    } else if (c.componentId === 'knowledge-check') {
      (d.problems ?? []).forEach((p, i) => {
        const q = lower(p.question ?? p.statement ?? '');
        const answer = (p.options ?? []).find((o) => o.id === p.correctOptionId)?.text ?? '';
        const named = q.match(/(?:letter|sound)\s+['"\/]?([a-z])\b/) ?? q.match(/\b([a-z])\s+sound/) ?? null;
        const letter = named?.[1] ?? (/^[a-z]$/.test(lower(answer)) ? lower(answer) : lower(answer)[0]);
        if (letter) out.push({ letter, demand: 'recognition', block: `${c.componentId}#${c.instanceId}`, id: `${c.instanceId}#problems[${i}]` });
      });
    }
  }
  return out;
}

function truth() {
  const files = readdirSync(OUT).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) { console.error(`no packages in ${OUT}`); process.exit(1); }
  const summary = [];
  for (const f of files) {
    const pkg = JSON.parse(readFileSync(join(OUT, f), 'utf8'));
    const objectives = pkg.curatorBrief?.objectives ?? [];
    const set = namedSet(objectives.map((o) => o.text).join('\n')) ;
    const items = itemsOf(pkg);
    const unaskable = new Set(pkg.components.flatMap((c) => c.data?.unaskableLetters ?? []).map(lower));
    const count = (letter, demand) => items.filter((i) => i.letter === letter && i.demand === demand).length;
    const rows = set.map((L) => ({ L, prod: count(L, 'production'), rec: count(L, 'recognition'), dec: count(L, 'decode'), any: items.filter((i) => i.letter === L).length }));
    const noProd = rows.filter((r) => r.prod === 0).map((r) => r.L);
    const oneProd = rows.filter((r) => r.prod === 1).map((r) => r.L);
    const noneAtAll = rows.filter((r) => r.any === 0).map((r) => r.L);
    console.log(`\n▶ ${f}`);
    console.log(`  named set (${set.length}): ${set.join(' ')}   blocks: ${pkg.components.map((c) => c.componentId).join(', ')}`);
    console.log(`  letter | production | recognition | decode`);
    for (const r of rows) console.log(`  ${r.L.padEnd(6)} | ${String(r.prod).padEnd(10)} | ${String(r.rec).padEnd(11)} | ${r.dec}${unaskable.has(r.L) ? '   ← unaskableLetters' : ''}`);
    console.log(`  NO production item: ${noProd.join(' ') || '—'}   only ONE: ${oneProd.join(' ') || '—'}   not in ANY primitive: ${noneAtAll.join(' ') || '—'}`);
    console.log(`  generator-reported unaskableLetters: ${[...unaskable].join(' ') || '—'}`);
    const cov = pkg.coverage;
    if (cov) {
      const flaggedText = cov.objectives.map((o) => `${o.notes ?? ''} ${cov.summary ?? ''}`).join(' ').toLowerCase();
      const judgeNamed = noProd.filter((L) => new RegExp(`(?:^|[^a-z])['"‘’]?${L}['"‘’]?(?:[^a-z]|$)`).test(flaggedText));
      const missedByJudge = noProd.filter((L) => !judgeNamed.includes(L));
      console.log(`  JUDGE: ${cov.status} · ${cov.objectives.map((o) => `${o.objectiveId} ${o.category} (${o.assessmentCount})`).join(' · ')} · constraints ${cov.detectedConstraints.map((c) => c.type).join(',') || '—'}`);
      console.log(`  JUDGE names as unassessed: ${judgeNamed.join(' ') || '—'}   truth says no production item: ${noProd.join(' ') || '—'}   judge missed: ${missedByJudge.join(' ') || '—'}`);
      const sufficientButGap = cov.objectives.filter((o) => o.category === 'ASSESSED_SUFFICIENTLY').length > 0 && noProd.length > 0;
      console.log(`  agreement: ${sufficientButGap ? 'DISAGREE — judge called an objective SUFFICIENT while letters have no production item' : noProd.length ? 'AGREE — gap flagged, no objective SUFFICIENT' : 'AGREE — no gap'}`);
      summary.push({ f, set: set.length, noProd, judge: cov.status, missedByJudge, sufficientButGap });
    } else {
      console.log('  (no `coverage` on the package — run: node scripts/lesson-coverage.mjs eval <dir> --write)');
    }
  }
  if (summary.length) {
    console.log('\nSUMMARY');
    for (const s of summary) console.log(`  ${s.f.split('--')[0].padEnd(10)} set ${String(s.set).padEnd(3)} no-production ${String(s.noProd.length).padEnd(3)} [${s.noProd.join('')}]  judge ${s.judge.padEnd(5)} missed ${s.missedByJudge.join('') || '—'}  ${s.sufficientButGap ? 'DISAGREE' : 'AGREE'}`);
  }
}

if (cmd === 'generate') await generate();
else if (cmd === 'truth') truth();
else { console.error(`unknown command ${cmd}`); process.exit(1); }
