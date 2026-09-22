#!/usr/bin/env node
/**
 * DI drill unbind probe (LA-14 S5, handoff 13 step 0).
 *
 * Runs lesson packages through the production binding rule and reports, for every
 * section of the four DI packs whose scripted drill is being deleted, whether it
 * binds the teaching workspace and, if not, why. Also counts sections of ANY
 * primitive that carry a number of objectives other than one, with the producer
 * that made them (objective block, curator brief or final assessment).
 *
 *   node scripts/di-drill-unbind-probe.mjs [pkg.json|dir ...]     default: every saved package under qa/
 *   node scripts/di-drill-unbind-probe.mjs --fresh "K|Topic" ...   also generate fresh packages via :3000
 *   --fresh-only skip the saved packages
 *   --out FILE   write the JSON result (default: print only)
 *
 * The manifest is RE-FLATTENED with the current `flattenManifestToLayout`, so the
 * objective counts come from today's producer rather than whatever the package saved.
 * Run from my-tutoring-app.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
if (!existsSync(join(ROOT, 'node_modules', 'vite'))) { console.error('run from my-tutoring-app'); process.exit(2); }

const PACKS = new Set(['di-letter-sounds', 'di-word-reading', 'di-math-facts', 'di-sentence-reading']);
const argv = process.argv.slice(2);
const out = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : null;
const fresh = [];
const paths = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out') { i++; continue; }
  if (argv[i] === '--fresh') { fresh.push(argv[++i]); continue; }
  if (argv[i] === '--fresh-only') continue;
  paths.push(argv[i]);
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith('.json')) acc.push(p);
  }
  return acc;
}
const files = argv.includes('--fresh-only') ? [] : (paths.length ? paths : ['qa']).flatMap(p => statSync(p).isDirectory() ? walk(p) : [p]);

const vite = await import(pathToFileURL(join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
const server = await vite.createServer({ configFile: false, root: ROOT, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(ROOT, 'src'), 'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts') } } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const { flattenManifestToLayout } = await runner.import('/src/components/lumina/service/manifest/flattenManifest.ts');
const { assembleExhibitFromContent } = await runner.import('/src/components/lumina/service/exhibitAssembly.ts');
const plan = await runner.import('/src/components/lumina/components/live-activity/lessonWorkspacePlan.ts');
const { LIVE_ADAPTERS, isLivePrimitive } = await runner.import('/src/components/lumina/components/live-activity/activityContract.ts');
const { pinBindsWorkspace } = await runner.import('/src/components/lumina/components/live-activity/pinnedModes.ts');

/** The first `workspaceBinding` gate a section fails, in the order the rule checks them. */
function unbindReason(section, pin) {
  if (section.audience === 'caregiver') return 'caregiver audience';
  if (!isLivePrimitive(section.componentId)) return 'not a live primitive';
  const adapter = LIVE_ADAPTERS[section.componentId];
  if (typeof pin !== 'string') return 'no pin';
  if (!adapter.bindsTeachingWorkspace) return 'family does not bind';
  if (!pinBindsWorkspace(section.componentId, adapter.modes, pin)) return `pin outside the catalog (${pin})`;
  if ((section.objectiveIds ?? []).length !== 1) return `${(section.objectiveIds ?? []).length} objectives`;
  try {
    if (!adapter.validate(section.data).challenges?.length) return 'no challenges';
  } catch (e) { return `validate throws: ${String(e?.message ?? e).slice(0, 120)}`; }
  return 'unknown';
}

function probe(pkg, source) {
  const objectives = pkg.provenance?.generationRequest?.objectives;
  const manifest = { ...pkg.manifest, layout: flattenManifestToLayout(pkg.manifest, objectives) };
  const content = new Map(pkg.components.map(c => [c.instanceId, { data: c.data }]));
  const exhibit = assembleExhibitFromContent(manifest, pkg.curatorBrief ?? pkg.manifest.curatorBrief ?? {}, content);
  exhibit.manifest = manifest;
  const bound = plan.lessonWorkspaceItems(exhibit);
  const rows = [];
  const finalId = manifest.finalAssessment?.instanceId;
  for (const item of manifest.layout) {
    const n = (item.objectiveIds ?? []).length;
    if (n !== 1) rows.push({ kind: 'multi-objective', componentId: item.componentId, instanceId: item.instanceId, objectives: n,
      producer: item.componentId === 'curator-brief' ? 'curator brief' : item.instanceId === finalId ? 'final assessment' : 'objective block' });
  }
  for (const section of exhibit.orderedComponents) {
    if (!PACKS.has(section.componentId)) continue;
    const pin = manifest.layout.find(m => m.instanceId === section.instanceId)?.config?.targetEvalMode;
    rows.push({ kind: 'pack', componentId: section.componentId, instanceId: section.instanceId, pin: pin ?? null,
      bound: bound.has(section.instanceId), reason: bound.has(section.instanceId) ? null : unbindReason(section, pin) });
  }
  // A pack in the layout whose content failed never reaches the lesson at all.
  for (const item of manifest.layout) {
    if (PACKS.has(item.componentId) && !exhibit.orderedComponents.some(s => s.instanceId === item.instanceId))
      rows.push({ kind: 'pack', componentId: item.componentId, instanceId: item.instanceId, pin: item.config?.targetEvalMode ?? null,
        bound: false, reason: 'generation failed (section absent)' });
  }
  return { source, id: pkg.id, topic: pkg.provenance?.topic ?? pkg.manifest?.topic, rows };
}

const results = [];
const seen = new Set();
for (const file of files) {
  let raw;
  try { raw = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
  if (raw?.benchVersion !== 1 || !raw.manifest || !Array.isArray(raw.components)) continue;
  if (seen.has(raw.id)) continue;
  seen.add(raw.id);
  try { results.push(probe(raw, file)); }
  catch (e) { results.push({ source: file, id: raw.id, error: String(e?.message ?? e) }); }
}

for (const spec of fresh) {
  const [gradeLevel, topic] = spec.split('|');
  console.log(`▶ fresh "${topic}" (${gradeLevel}) — a full package takes minutes`);
  try {
    const r = await fetch('http://localhost:3000/api/lumina/topic-trace', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topic, gradeLevel, package: true }),
      signal: AbortSignal.timeout(900_000) });
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
    const pkg = (await r.json()).package;
    if (!pkg || pkg.error) throw new Error(pkg?.error ?? 'no package');
    const dest = join('qa', 'tutor-reports', 'di-drill-unbind-packages', `${pkg.id}.json`);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, JSON.stringify(pkg));
    results.push(probe(pkg, dest));
  } catch (e) { results.push({ source: `fresh:${spec}`, error: String(e?.message ?? e) }); }
}
await server.close();

const packRows = results.flatMap(r => (r.rows ?? []).filter(x => x.kind === 'pack').map(x => ({ ...x, pkg: r.id })));
const multi = results.flatMap(r => (r.rows ?? []).filter(x => x.kind === 'multi-objective').map(x => ({ ...x, pkg: r.id })));
const summary = {
  packages: results.length,
  errors: results.filter(r => r.error).map(r => ({ source: r.source, error: r.error })),
  packSections: packRows.length,
  bound: packRows.filter(r => r.bound).length,
  unbound: packRows.filter(r => !r.bound).map(r => ({ pkg: r.pkg, componentId: r.componentId, pin: r.pin, reason: r.reason })),
  multiObjectiveByProducer: multi.reduce((acc, r) => { acc[r.producer] = (acc[r.producer] ?? 0) + 1; return acc; }, {}),
  multiObjectiveNonPlatform: multi.filter(r => r.producer === 'objective block'),
  multiObjectiveFinalComponents: [...new Set(multi.filter(r => r.producer === 'final assessment').map(r => r.componentId))],
};
console.log(JSON.stringify(summary, null, 2));
if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify({ summary, results }, null, 2)); }
