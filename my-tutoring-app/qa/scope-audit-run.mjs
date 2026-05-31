// Scope-audit runner — drives the REAL Lumina pipeline over HTTP, exactly as the app does.
//   topic -> /api/lumina/manifest-stream (curator brief + manifest)
//         -> /api/lumina/build-stream    (run every generator)
// Saves the final exhibit JSON so we can review what Gemini actually produced.
//
// Usage: node qa/scope-audit-run.mjs "Counting to 10" elementary

const BASE = 'http://localhost:3000';
const topic = process.argv[2] || 'Counting to 10';
const gradeLevel = process.argv[3] || 'elementary';

const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const outFile = `qa/eval-reports/scope-audit-${slug}.exhibit.json`;

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

async function main() {
  console.log(`\n=== SCOPE AUDIT: "${topic}" (${gradeLevel}) ===\n`);

  // ---- Phase 1: manifest-stream ----
  console.log('PHASE 1 — manifest-stream …');
  let curatorBrief = null;
  let manifest = null;
  const r1 = await fetch(`${BASE}/api/lumina/manifest-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, gradeLevel }),
  });
  if (!r1.ok) throw new Error(`manifest-stream HTTP ${r1.status}: ${await r1.text()}`);
  await readStream(r1, (ev) => {
    if (ev.type === 'status') console.log('   ', ev.message);
    else if (ev.type === 'curator-brief') curatorBrief = ev.curatorBrief;
    else if (ev.type === 'manifest') manifest = ev.manifest;
    else if (ev.type === 'error') throw new Error('manifest-stream error: ' + ev.error);
  });
  if (!manifest || !curatorBrief) throw new Error('No manifest/curatorBrief returned');

  console.log('\n   MANIFEST OBJECTIVES & COMPONENTS:');
  for (const block of (manifest.objectiveBlocks || [])) {
    console.log(`   • [${block.objectiveId}] "${block.objectiveText}" (${block.objectiveVerb})`);
    for (const c of (block.components || [])) {
      console.log(`       → ${c.componentId}  (intent: "${c.intent}")`);
    }
  }
  if (manifest.finalAssessment) {
    console.log(`   • FINAL: ${manifest.finalAssessment.componentId} (intent: "${manifest.finalAssessment.intent}")`);
  }

  // ---- Phase 2: build-stream ----
  console.log('\nPHASE 2 — build-stream …');
  let exhibit = null;
  const r2 = await fetch(`${BASE}/api/lumina/build-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manifest, curatorBrief }),
  });
  if (!r2.ok) throw new Error(`build-stream HTTP ${r2.status}: ${await r2.text()}`);
  await readStream(r2, (ev) => {
    if (ev.type === 'component-complete') console.log(`    ✓ [${ev.index}/${ev.total}] ${ev.componentId}`);
    else if (ev.type === 'exhibit-complete') exhibit = ev.exhibit;
    else if (ev.type === 'error') throw new Error('build-stream error: ' + ev.error);
  });
  if (!exhibit) throw new Error('No exhibit returned');

  const fs = await import('node:fs');
  fs.writeFileSync(outFile, JSON.stringify({ topic, gradeLevel, manifest, exhibit }, null, 2));
  console.log(`\n   Saved exhibit → ${outFile}`);

  // ---- Quick scope scan: max numeric value per component (review aid, not the verdict) ----
  console.log('\nPHASE 3 — numeric scope scan (review aid):');
  const comps = exhibit.orderedComponents || [];
  for (const c of comps) {
    const nums = [];
    (function scan(o){ if(o==null) return; if(typeof o==='number'){nums.push(o);return;} if(Array.isArray(o)){o.forEach(scan);return;} if(typeof o==='object'){for(const k in o) scan(o[k]);} })(c.data);
    const max = nums.length ? Math.max(...nums) : null;
    const extra = [c.data?.mode && `mode=${c.data.mode}`, c.data?.gradeBand && `gradeBand=${c.data.gradeBand}`].filter(Boolean).join(' ');
    console.log(`   • ${c.type.padEnd(22)} maxNumericValue=${String(max).padStart(4)}  ${extra}`);
  }
  console.log('\n=== DONE ===\n');
}

main().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1); });
