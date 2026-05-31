// Batch scope-audit — drive the REAL Lumina pipeline over many topics and
// assert that every generated component stays inside the lesson's numeric scope.
//
// For each topic:
//   /api/lumina/manifest-stream  (curator brief + manifest)
//   /api/lumina/build-stream     (run every generator → exhibit)
// Then, per built component:
//   - find the OBJECTIVE that bound it (objectiveText),
//   - extract the intended numeric ceiling from that objective (or the topic),
//   - scan the generated data for the largest student-facing value,
//   - and classify the result so the failure points at the right fix.
//
// This is the scale version of scope-audit-run.mjs. It exists to answer one
// question: "are we passing the right scope context all the way to the output?"
//
// Prereq: dev server running on localhost:3000 (npm run dev).
//
// Usage:
//   node qa/scope-audit-batch.mjs                  # built-in topic set
//   node qa/scope-audit-batch.mjs qa/topics.json   # custom set
//
// topics.json: [{ "topic": "Counting to 10", "gradeLevel": "elementary", "ceiling": 10 }]
//   gradeLevel defaults to "elementary"; ceiling is optional and, when given,
//   overrides the ceiling auto-extracted from the objective/topic text.

import fs from 'node:fs';

const BASE = 'http://localhost:3000';

// Default topic set — counting-range cases first (the reported bug), plus a
// couple of non-counting controls so we see the harness pass as well as fail.
const DEFAULT_TOPICS = [
  { topic: 'Counting to 5' },
  { topic: 'Counting to 10' },
  { topic: 'Counting within 10' },
  { topic: 'Numbers to 20' },
  { topic: 'Counting to 100 by tens' },
  { topic: 'Adding within 5' },
  { topic: 'Comparing numbers to 10' },
];

// ---------------------------------------------------------------------------
// Numeric-scope scan
// ---------------------------------------------------------------------------
// Generated data is full of numbers that are NOT student-facing magnitudes:
// flash durations (1500ms), slot indices (0-19), pixel sizes, range metadata.
// A naive max() would flag every lesson. We prune those keys so the value we
// report is the largest number a student would actually see/produce.

const SKIP_KEYS = new Set([
  // timing / animation
  'flashduration', 'duration', 'durationms', 'delay', 'delayms', 'ms', 'timeoutms', 'timestamp',
  // identity / ordering / indices (NOT magnitudes the student reasons about)
  'id', 'instanceid', '__instanceid', 'objectiveid', 'objectiveids', 'componentid',
  'index', 'idx', 'order', 'position', 'positions', 'slot', 'slots', 'col', 'row',
  'x', 'y', 'z', 'missingindex', 'hintindex', 'flashindex',
  // layout / styling
  'width', 'height', 'size', 'fontsize', 'rotation', 'angle', 'opacity', 'zindex',
  'radius', 'strokewidth',
  // range METADATA (describes the band, not a value in it)
  'rangemin', 'rangemax', 'min', 'max',
  // misc engine fields
  'version', 'seed', 'difficulty',
]);

/** Largest student-facing numeric value in a component's data, or null. */
function maxScopeValue(node) {
  let max = null;
  const walk = (o, key) => {
    if (o == null) return;
    if (key && SKIP_KEYS.has(key.toLowerCase())) return; // prune this field / subtree
    if (typeof o === 'number') {
      if (Number.isFinite(o) && (max === null || o > max)) max = o;
      return;
    }
    if (Array.isArray(o)) { for (const v of o) walk(v, key); return; } // elements inherit the (already-vetted) parent key
    if (typeof o === 'object') { for (const k in o) walk(o[k], k); }
  };
  walk(node, '');
  return max;
}

/** Intended ceiling from natural-language scope ("to 10", "within 5", "1-100"). */
function extractCeiling(text) {
  if (!text) return null;
  let m = text.match(/\b(?:to|within|up to|through|less than|under|below)\s+(\d+)/i);
  if (m) return parseInt(m[1], 10);
  m = text.match(/\b\d+\s*[–-]\s*(\d+)/); // "1-100", "0–20"
  if (m) return parseInt(m[1], 10);
  return null;
}

// ---------------------------------------------------------------------------
// Pipeline driver (same transport as scope-audit-run.mjs)
// ---------------------------------------------------------------------------

async function readStream(res, onEvent) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try { onEvent(JSON.parse(line)); } catch { /* partial */ }
    }
  }
  if (buf.trim()) { try { onEvent(JSON.parse(buf.trim())); } catch {} }
}

async function runLesson(topic, gradeLevel) {
  // The real lesson pipeline is THREE steps (see hooks/useExhibitSession.ts):
  //   1. Curator brief  — full IntroBriefingData (hook.content + objectives[]).
  //   2. Manifest        — seeded with the brief's objectives.
  //   3. Build           — needs the FULL brief as curatorBrief (build reads
  //                        curatorBrief.hook.content). The manifest.curatorBrief
  //                        stub is NOT enough — it lacks hook/objectives.

  // ── Step 1: curator brief (plain JSON, action endpoint) ──
  const rb = await fetch(`${BASE}/api/lumina`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'generateIntroBriefing', params: { topic, gradeLevel } }),
  });
  if (!rb.ok) throw new Error(`curator-brief HTTP ${rb.status}: ${await rb.text()}`);
  const brief = await rb.json();
  if (!brief?.objectives) throw new Error('curator brief returned no objectives');

  // ── Step 2: manifest (streamed; final event is { type: 'complete', manifest }) ──
  let manifest = null;
  const r1 = await fetch(`${BASE}/api/lumina/manifest-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, gradeLevel, objectives: brief.objectives }),
  });
  if (!r1.ok) throw new Error(`manifest-stream HTTP ${r1.status}: ${await r1.text()}`);
  await readStream(r1, (ev) => {
    if (ev.type === 'complete') manifest = ev.manifest;
    else if (ev.type === 'error') throw new Error('manifest-stream: ' + ev.error);
  });
  if (!manifest) throw new Error('no manifest returned');

  // ── Step 3: build (streamed; final event is { type: 'exhibit-complete', exhibit }) ──
  let exhibit = null;
  const r2 = await fetch(`${BASE}/api/lumina/build-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manifest, curatorBrief: brief }),
  });
  if (!r2.ok) throw new Error(`build-stream HTTP ${r2.status}: ${await r2.text()}`);
  await readStream(r2, (ev) => {
    if (ev.type === 'exhibit-complete') exhibit = ev.exhibit;
    else if (ev.type === 'error') throw new Error('build-stream: ' + ev.error);
  });
  if (!exhibit) throw new Error('no exhibit returned');

  return { manifest, exhibit };
}

// ---------------------------------------------------------------------------
// Per-lesson audit
// ---------------------------------------------------------------------------

function auditLesson({ topic, ceiling: ceilingOverride }, manifest, exhibit) {
  // objectiveId -> objectiveText, so each built component can name the objective that bound it.
  const objText = {};
  for (const b of manifest.objectiveBlocks || []) objText[b.objectiveId] = b.objectiveText;

  const topicCeiling = extractCeiling(topic);
  const rows = [];

  for (const c of exhibit.orderedComponents || []) {
    const objectiveText = (c.objectiveIds || []).map((id) => objText[id]).find(Boolean) || null;
    const ceiling = ceilingOverride ?? extractCeiling(objectiveText) ?? topicCeiling;
    const maxValue = maxScopeValue(c.data);

    let status;
    if (ceiling == null) status = 'VAGUE';          // nothing encoded a range → manifest/topic problem
    else if (maxValue == null) status = 'N/A';       // no numeric content to check
    else status = maxValue <= ceiling ? 'PASS' : 'FAIL';

    rows.push({
      type: c.componentId || c.type,
      objectiveText,
      ceiling,
      maxValue,
      status,
      overshoot: status === 'FAIL' ? maxValue - ceiling : 0,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const trunc = (s, n) => (s == null ? '—' : s.length > n ? s.slice(0, n - 1) + '…' : s);

function printLesson(topic, rows) {
  console.log(`\n=== "${topic}" ===`);
  for (const r of rows) {
    const mark = { PASS: '✓', FAIL: '✗', VAGUE: '?', 'N/A': '·' }[r.status];
    console.log(
      `  ${mark} ${r.status.padEnd(5)} ${String(r.type).padEnd(24)} ` +
      `max=${String(r.maxValue ?? '—').padStart(4)} ceil=${String(r.ceiling ?? '—').padStart(4)}` +
      (r.status === 'FAIL' ? `  (+${r.overshoot} over)` : '') +
      (r.status === 'VAGUE' ? `  objective: "${trunc(r.objectiveText, 60)}"` : '')
    );
  }
}

function writeReport(results) {
  const lines = ['# Scope Audit — Batch Report', ''];
  const all = results.flatMap((r) => r.rows.map((row) => ({ topic: r.topic, ...row })));
  const counts = all.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
  lines.push(
    `**${all.length}** components across **${results.length}** lessons — ` +
    `${counts.PASS || 0} PASS · ${counts.FAIL || 0} FAIL · ${counts.VAGUE || 0} VAGUE · ${counts['N/A'] || 0} N/A`,
    '',
  );

  const fails = all.filter((r) => r.status === 'FAIL');
  if (fails.length) {
    lines.push('## FAIL — generated values exceed the scope ceiling', '');
    lines.push('| Lesson | Generator | max | ceiling | over | Bounding objective |');
    lines.push('|---|---|---|---|---|---|');
    for (const r of fails) {
      lines.push(`| ${r.topic} | \`${r.type}\` | ${r.maxValue} | ${r.ceiling} | +${r.overshoot} | ${trunc(r.objectiveText, 70)} |`);
    }
    lines.push('');
  }

  const vague = all.filter((r) => r.status === 'VAGUE');
  if (vague.length) {
    lines.push('## VAGUE — objective/topic encoded no numeric range (manifest can\'t bind scope)', '');
    lines.push('| Lesson | Generator | Bounding objective |');
    lines.push('|---|---|---|');
    for (const r of vague) {
      lines.push(`| ${r.topic} | \`${r.type}\` | ${trunc(r.objectiveText, 80)} |`);
    }
    lines.push('');
  }

  lines.push(
    '## How to read a failure',
    '',
    '- **FAIL** — the objective *did* carry a range but the generated values blew past it.',
    '  Check whether that generator calls `buildScopePromptSection` (scopeContext.ts). Only',
    '  ten-frame + number-sequencer are migrated so far; an un-migrated generator here is a',
    '  rollout target. If it *is* migrated, the prompt binding needs strengthening.',
    '- **VAGUE** — the manifest never put a range into the objective text, so there was nothing',
    '  to bind to. Fix upstream in the manifest/curator prompt, not the generator.',
    '- **PASS / N/A** — within scope, or no numeric content to check.',
    '',
  );

  const out = 'qa/eval-reports/scope-audit-batch.md';
  fs.writeFileSync(out, lines.join('\n'));
  fs.writeFileSync('qa/eval-reports/scope-audit-batch.json', JSON.stringify(results, null, 2));
  console.log(`\nReport → ${out}`);
  return counts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const arg = process.argv[2];
  const topics = arg ? JSON.parse(fs.readFileSync(arg, 'utf8')) : DEFAULT_TOPICS;

  console.log(`\nScope audit — ${topics.length} lesson(s) via ${BASE}\n`);
  const results = [];
  for (const t of topics) {
    const gradeLevel = t.gradeLevel || 'elementary';
    process.stdout.write(`• "${t.topic}" (${gradeLevel}) … `);
    try {
      const { manifest, exhibit } = await runLesson(t.topic, gradeLevel);
      const rows = auditLesson(t, manifest, exhibit);
      console.log(`${rows.length} components`);
      printLesson(t.topic, rows);
      results.push({ topic: t.topic, gradeLevel, rows });
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
      results.push({ topic: t.topic, gradeLevel, rows: [], error: e.message });
    }
  }

  const counts = writeReport(results);
  const failed = (counts.FAIL || 0) > 0 || results.some((r) => r.error);
  console.log(`\n${failed ? '✗ scope violations found' : '✓ all in scope'}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('\nFATAL:', e.message); process.exit(1); });
