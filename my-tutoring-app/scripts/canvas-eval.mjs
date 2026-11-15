// Canvas QA sweep (/canvas-eval). Free: no model call. Needs Chromium.
// For each canvas spec it runs the gate (scripts/canvas-check.mjs, unchanged), then probes every problem on the real
// stage (layout: overflow, small or overlapping or dim words, small touch targets, a success colour or word only the
// proof shows; shortcuts: tap every control once, random play), and records the result in a ledger keyed by a hash of
// program + spec, so an unchanged canvas is not re-run and a changed one loses its read.
//
// Usage:
//   node scripts/canvas-eval.mjs                    every spec whose hash changed since its last sweep
//   node scripts/canvas-eval.mjs --all              every spec
//   node scripts/canvas-eval.mjs --spec=a,b         these specs
//   node scripts/canvas-eval.mjs --pilot            every spec in the pilot tier
//   node scripts/canvas-eval.mjs --sheet            only rebuild the contact sheet
//   node scripts/canvas-eval.mjs --read=<id> --verdict=ready|heal|reject --notes="..."   record the agent's screenshot read
//   node scripts/canvas-eval.mjs --heal=<id> --notes="..."                               record a heal (one line per change)
//   node scripts/canvas-eval.mjs --play=<id> --problem=2 --steps='[{"do":"click","target":"#a"}]'   one play: goal, scene, boxes, screenshot
//   add --no-gate to skip canvas-check (probes only), --runs=N for random plays per problem (default 8)
//
// Writes qa/canvas/eval/ledger.json (one row per canvas), qa/canvas/eval/runs/<id>.json (the findings) and
// qa/canvas/eval/sheet.html (every canvas's screens, findings and status, for the user to pick what to play).
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

const arg = (name) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const flag = (name) => process.argv.includes(`--${name}`);
const root = process.cwd();
const specsDir = resolve(root, 'qa/canvas/specs');
const evalDir = resolve(root, 'qa/canvas/eval');
const runsDir = resolve(evalDir, 'runs');
const libDir = resolve(root, 'src/components/lumina/service/core/agent-canvas/library');
mkdirSync(runsDir, { recursive: true });
const ledgerPath = resolve(evalDir, 'ledger.json');
const readLedger = () => existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : {};
const ledger = readLedger();
/** Write one row onto the ledger as it is on disk now, so a sweep and a read recorded meanwhile do not overwrite each other. */
const saveRow = (id) => {
  const disk = readLedger();
  const keep = disk[id] ?? {};
  disk[id] = { ...ledger[id], ...(keep.read && !ledger[id].read ? { read: keep.read } : {}), ...(keep.heals && !ledger[id].heals ? { heals: keep.heals } : {}) };
  disk[id].status = statusOf(disk[id]);
  Object.assign(ledger, disk);
  writeFileSync(ledgerPath, JSON.stringify(Object.fromEntries(Object.entries(disk).sort()), null, 2));
};
const now = () => new Date().toISOString();

const allIds = readdirSync(specsDir).filter(d => existsSync(resolve(specsDir, d, 'spec.json'))).sort();
const hashOf = (id) => {
  const spec = readFileSync(resolve(specsDir, id, 'spec.json'), 'utf8');
  const program = JSON.parse(spec).program ?? 'program.tsx';
  return createHash('sha1').update(spec).update(readFileSync(resolve(specsDir, id, program), 'utf8')).digest('hex').slice(0, 12);
};
const tierOf = (id) => existsSync(resolve(libDir, `${id}.json`)) ? 'library' : existsSync(resolve(libDir, 'pilot', `${id}.json`)) ? 'pilot' : 'none';
const votes = () => {
  const p = process.env.CANVAS_VOTES_PATH || resolve(root, 'qa/canvas/votes.jsonl'); // the env path is for testing the hold
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, 'utf8').split('\n')) { try { const v = JSON.parse(line); (out[v.canvasId] ??= []).push(v); } catch { /* blank line */ } }
  return out;
};

/** Status from the gate, the probes and the read. The read counts only for the hash it was made on. */
function statusOf(row) {
  if (!row) return 'new';
  if (row.held) return 'held';
  if (row.gate === 'fail' || row.counts?.blocking) return 'blocked';
  // A read on this hash outranks a major probe finding: the reader judged the finding (a monkey hit on a 3-zone control,
  // a world colour as the first rect) and says why in the notes. It never outranks a blocking one.
  if (row.read?.hash === row.hash) return row.read.verdict === 'ready' ? 'ready' : row.read.verdict === 'reject' ? 'reject' : 'heal';
  if (row.counts?.major) return 'heal';
  return 'read';
}

// ── Record a read or a heal (no browser) ──
if (arg('read') || arg('heal')) {
  const id = arg('read') ?? arg('heal');
  const row = ledger[id];
  if (!row) throw new Error(`${id} has no sweep yet: run --spec=${id} first`);
  if (arg('read')) {
    const verdict = arg('verdict');
    if (!['ready', 'heal', 'reject'].includes(verdict)) throw new Error('--verdict must be ready, heal or reject');
    if (row.hash !== hashOf(id)) throw new Error(`${id} changed since its sweep: run --spec=${id} again, then read the new screenshots`);
    row.read = { verdict, notes: arg('notes') ?? '', hash: row.hash, at: now() };
  } else {
    (row.heals ??= []).push({ notes: arg('notes') ?? '', fromHash: row.hash, at: now() });
  }
  saveRow(id); buildSheet();
  console.log(`${id}: ${ledger[id].status}`);
  process.exit(0);
}
if (flag('sheet')) { buildSheet(); process.exit(0); }

// ── One ad-hoc play: try an alternative solution or aim a drag while healing ──
if (arg('play')) {
  const id = arg('play'), n = Number(arg('problem')) || 1;
  const spec = JSON.parse(readFileSync(resolve(specsDir, id, 'spec.json'), 'utf8'));
  const steps = arg('steps') ? JSON.parse(arg('steps')) : [];
  const server = await vite.createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null }, resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
  try {
    const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
    const { compileDisplay } = await runner.import('/src/components/lumina/service/gen-display/compile.ts');
    const { displayDocument } = await runner.import('/src/components/lumina/service/gen-display/document.ts');
    const { CanvasStage } = await runner.import('/src/components/lumina/service/agent-kit/canvas/stage.ts');
    const compiled = compileDisplay(readFileSync(resolve(specsDir, id, spec.program ?? 'program.tsx'), 'utf8'));
    if (!compiled.ok) throw new Error(compiled.errors.join('; '));
    const stage = new CanvasStage();
    try {
      const r = await stage.play(displayDocument(compiled.js, spec.problems[n - 1].params ?? {}), steps);
      const png = resolve(runsDir, `${id}-play.png`);
      writeFileSync(png, r.png);
      console.log(JSON.stringify({ goal: r.after.goal, scene: r.after.scene, stepErrors: r.stepErrors, errors: r.after.errors, text: r.after.text.slice(0, 300), boxes: r.boxes }, null, 1));
      console.log(`screenshot: ${png}`);
    } finally { await stage.close(); }
  } finally { await server.close(); }
  process.exit(0);
}

// ── Which specs ──
let ids;
if (arg('spec')) ids = arg('spec').split(',').filter(Boolean);
else if (flag('all')) ids = allIds;
else if (flag('pilot')) ids = allIds.filter(id => tierOf(id) === 'pilot');
else ids = allIds.filter(id => ledger[id]?.hash !== hashOf(id));
for (const id of ids) if (!allIds.includes(id)) throw new Error(`no spec ${id}`);
if (!ids.length) { console.log('every spec is unchanged since its last sweep (use --all or --spec=<id>)'); buildSheet(); process.exit(0); }
console.log(`sweeping ${ids.length} canvas(es)`);

const server = await vite.createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null }, resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
let anyBlocked = false;
try {
  const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { compileDisplay } = await runner.import('/src/components/lumina/service/gen-display/compile.ts');
  const { displayDocument } = await runner.import('/src/components/lumina/service/gen-display/document.ts');
  const { CanvasStage } = await runner.import('/src/components/lumina/service/agent-kit/canvas/stage.ts');
  const probes = await runner.import('/src/components/lumina/service/agent-kit/canvas/canvasProbes.ts');
  const runs = Number(arg('runs')) || 8;

  for (const id of ids) {
    const t0 = Date.now();
    const hash = hashOf(id);
    const spec = JSON.parse(readFileSync(resolve(specsDir, id, 'spec.json'), 'utf8'));
    const source = readFileSync(resolve(specsDir, id, spec.program ?? 'program.tsx'), 'utf8');
    const run = { id, hash, at: now(), gate: null, gateLog: '', problems: [] };

    // 1. The gate, unchanged. It also refreshes the canvas's tier entry on a pass, which releases a canvas the user
    // voted down. So a canvas whose last down vote is newer than its last edit is probed but not gated: it stays held.
    const lastEdit = Math.max(...[resolve(specsDir, id, 'spec.json'), resolve(specsDir, id, spec.program ?? 'program.tsx')].map(f => statSync(f).mtimeMs));
    const downs = (votes()[id] ?? []).filter(v => v.vote === 'down').map(v => Date.parse(v.at));
    run.held = downs.length > 0 && Math.max(...downs) > lastEdit;
    if (run.held) console.log(`${id}: HELD by a down vote newer than its last edit; probing only`);
    if (!flag('no-gate') && !run.held) {
      const gate = () => spawnSync(process.execPath, ['scripts/canvas-check.mjs', `--spec=${id}`], { cwd: root, encoding: 'utf8', timeout: 300000 });
      let g = gate(), out = `${g.stdout ?? ''}${g.stderr ?? ''}`;
      // A Windows file lock on the tier index (a dev server reading it) is the host, not the canvas: try once more.
      if (g.status !== 0 && /Error: (UNKNOWN|EBUSY|EPERM)/.test(out)) { g = gate(); out = `${g.stdout ?? ''}${g.stderr ?? ''}`; }
      run.gate = g.status === 0 ? 'pass' : 'fail';
      run.gateLog = out.split('\n').filter(l => /FAIL|BLOCKED|^ - |^   - |advisory|Error/.test(l)).join('\n').slice(0, 3000);
    }

    // 2. Probes, per problem.
    const compiled = compileDisplay(source);
    const stage = new CanvasStage();
    try {
      if (!compiled.ok) run.problems.push({ n: 0, findings: [{ severity: 'blocking', probe: 'compile', detail: compiled.errors.join('; ') }] });
      else for (let i = 0; i < spec.problems.length; i++) {
        const p = spec.problems[i], n = i + 1;
        const html = displayDocument(compiled.js, p.params ?? {});
        const inspect = probes.readLayout;
        const [rest, proof, miss] = await Promise.all([stage.play(html, [], { inspect }), stage.play(html, p.proof ?? [], { inspect }), stage.play(html, p.miss ?? [], { inspect })]);
        const findings = probes.layoutFindings(rest.inspected, proof.inspected, miss.inspected, proof.after.text, miss.after.text);
        const named = rest.boxes.map(b => b.id);
        const len = Math.max(4, Math.min(24, 2 * (p.proof ?? []).length));
        const sc = await probes.shortcuts(stage, html, rest.inspected.interactive, named, len, runs, 7 + n);
        findings.push(...probes.shortcutFindings(sc));
        run.problems.push({ n, params: p.params ?? {}, findings, shortcuts: sc, layout: { rootW: rest.inspected.rootW, rootH: rest.inspected.rootH, interactive: rest.inspected.interactive.length } });
      }
    } finally {
      await stage.close();
    }

    const all = run.problems.flatMap(p => p.findings.map(f => ({ ...f, problem: p.n })));
    const counts = { blocking: all.filter(f => f.severity === 'blocking').length, major: all.filter(f => f.severity === 'major').length, minor: all.filter(f => f.severity === 'minor').length };
    writeFileSync(resolve(runsDir, `${id}.json`), JSON.stringify(run, null, 2));
    const prev = ledger[id] ?? {};
    ledger[id] = {
      id, title: spec.title, grades: spec.serves?.grades ?? [], tier: tierOf(id), problems: spec.problems.length, hash, sweptAt: run.at,
      gate: run.gate ?? prev.gate ?? null, held: run.held, counts, top: all.filter(f => f.severity !== 'minor').slice(0, 6).map(f => `p${f.problem} ${f.probe}: ${f.detail}`),
      ...(prev.read ? { read: prev.read } : {}), ...(prev.heals ? { heals: prev.heals } : {}),
    };
    saveRow(id);
    if (ledger[id].status === 'blocked') anyBlocked = true;
    console.log(`${id}: ${ledger[id].status.toUpperCase()} gate=${ledger[id].gate} blocking=${counts.blocking} major=${counts.major} minor=${counts.minor} (${Math.round((Date.now() - t0) / 1000)}s)${ledger[id].top.map(t => `\n   - ${t}`).join('')}${run.gate === 'fail' ? `\n   gate:\n${run.gateLog.split('\n').map(l => `     ${l}`).join('\n')}` : ''}`);
  }
} finally {
  await server.close();
}
buildSheet();
if (anyBlocked) process.exitCode = 1;

// ── Contact sheet ──
function buildSheet() {
  const v = votes();
  const order = ['blocked', 'heal', 'read', 'ready', 'held', 'reject', 'new'];
  const label = { blocked: 'Blocked: gate or a blocking probe fails', heal: 'Heal: probe or read findings to fix', read: 'Probes clean: screenshots not yet read', ready: 'Ready for you to play', held: 'Held by your thumbs-down: heal the vote reasons, then re-sweep', reject: 'Rejected by the read', new: 'Never swept' };
  const rows = allIds.map(id => ledger[id] ? { ...ledger[id], status: ledger[id].hash === hashOf(id) ? statusOf(ledger[id]) : 'stale' } : { id, status: 'new', title: id });
  const groups = [...order, 'stale'].map(s => [s, rows.filter(r => r.status === s)]).filter(([, r]) => r.length);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const card = (r) => {
    const plays = resolve(specsDir, r.id, 'plays');
    const shots = existsSync(plays) ? readdirSync(plays).filter(f => /^\d+-(rest|proof|miss)\.png$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b) || ['rest', 'proof', 'miss'].indexOf(a.split('-')[1].replace('.png', '')) - ['rest', 'proof', 'miss'].indexOf(b.split('-')[1].replace('.png', ''))) : [];
    const vs = (v[r.id] ?? []).map(x => `${x.vote === 'up' ? '👍' : '👎'} ${esc((x.reasons ?? []).join(', '))} ${esc(x.note ?? '')}`).join('<br>');
    return `<section class="card ${r.status}"><header><h3>${esc(r.title)} <code>${esc(r.id)}</code></h3><span class="pill">${esc(r.status)}</span><span class="meta">${esc(r.tier ?? '')} · grades ${esc((r.grades ?? []).join(', '))} · ${r.problems ?? '?'} problems · gate ${esc(r.gate ?? '-')}${r.counts ? ` · ${r.counts.blocking}/${r.counts.major}/${r.counts.minor} b/M/m` : ''}</span></header>
${r.top?.length ? `<ul class="find">${r.top.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}${r.read ? `<p class="read"><b>read ${esc(r.read.verdict)}</b> ${esc(r.read.notes)}</p>` : ''}${r.heals?.length ? `<p class="heal"><b>heals</b> ${r.heals.map(h => esc(h.notes)).join(' · ')}</p>` : ''}${vs ? `<p class="votes">${vs}</p>` : ''}
<div class="shots">${shots.map(f => `<figure><a href="../specs/${r.id}/plays/${f}" target="_blank"><img loading="lazy" src="../specs/${r.id}/plays/${f}"></a><figcaption>${f.replace('.png', '')}</figcaption></figure>`).join('')}</div></section>`;
  };
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Canvas QA sheet</title>
<style>:root{--bg:#0b1020;--card:#151c2f;--line:#2a3550;--text:#e2e8f0;--muted:#94a3b8}body{margin:0;padding:16px;background:var(--bg);color:var(--text);font:14px/1.45 system-ui,sans-serif}h1{font-size:20px}h2{font-size:16px;margin:28px 0 8px;color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--line);border-radius:10px;padding:12px;margin:10px 0}.card.blocked{border-left-color:#fb7185}.card.heal{border-left-color:#fbbf24}.card.read{border-left-color:#818cf8}.card.ready{border-left-color:#34d399}.card.stale{border-left-color:#94a3b8}
header{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline}h3{margin:0;font-size:15px}code{color:var(--muted);font-size:12px}.pill{font-size:12px;padding:1px 8px;border-radius:99px;border:1px solid var(--line)}.meta{color:var(--muted);font-size:12px}
.find{margin:8px 0;padding-left:18px;color:#fcd34d;font-size:13px}.read,.heal,.votes{margin:6px 0;font-size:13px;color:var(--muted)}.shots{display:flex;gap:8px;overflow-x:auto;padding-top:8px}figure{margin:0;flex:0 0 auto}img{width:220px;border:1px solid var(--line);border-radius:6px;display:block}figcaption{font-size:11px;color:var(--muted);text-align:center}
nav a{color:var(--muted);margin-right:12px}</style>
<h1>Canvas QA sheet</h1><p class="meta">Built ${esc(now())} by scripts/canvas-eval.mjs. ${rows.length} specs. Play a Ready canvas from the dev panel "Canvas (agent)" saved list.</p>
<nav>${groups.map(([s, r]) => `<a href="#${s}">${esc(s)} (${r.length})</a>`).join('')}</nav>
${groups.map(([s, r]) => `<h2 id="${s}">${esc(label[s] ?? 'Changed since its sweep')} (${r.length})</h2>${r.map(card).join('\n')}`).join('\n')}`;
  writeFileSync(resolve(evalDir, 'sheet.html'), html);
  const tally = Object.fromEntries(groups.map(([s, r]) => [s, r.length]));
  console.log(`sheet: ${resolve(evalDir, 'sheet.html')} ${JSON.stringify(tally)}`);
}
