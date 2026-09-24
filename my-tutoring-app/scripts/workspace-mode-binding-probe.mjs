#!/usr/bin/env node
/**
 * Does every catalog mode of a workspace-only family generate content that binds?
 *
 * For each family and each catalog eval mode (plus Auto = no pin), generates real content through the
 * tester's endpoint (`/api/lumina` generateComponentContent on :3000), then runs it through the production
 * binding rule (`workspaceBinding`). A mode whose content fails is a mode a lesson would show as the
 * NeedsTutor card. Run from my-tutoring-app with the dev server up.
 *
 *   node scripts/workspace-mode-binding-probe.mjs [family ...] [--mode m] [--runs N] [--grade "Grade 1"] [--out FILE]
 *   (--mode auto probes only the unpinned case)
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = process.cwd();
if (!existsSync(join(ROOT, 'node_modules', 'vite'))) { console.error('run from my-tutoring-app'); process.exit(2); }
const argv = process.argv.slice(2);
const flag = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const runs = Number(flag('--runs', 1));
const out = flag('--out', null);
const grades = { 'balance-scale': 'Grade 2', 'base-ten-blocks': 'Grade 1', 'bar-model': 'Kindergarten', 'fraction-circles': 'Grade 3' };
const skip = new Set(['--runs', '--grade', '--out', '--mode'].flatMap(f => (argv.includes(f) ? [f, argv[argv.indexOf(f) + 1]] : [])));
const families = argv.filter(a => !skip.has(a));
const chosen = families.length ? families : Object.keys(grades);

const vite = await import('vite');
const server = await vite.createServer({ root: ROOT, configFile: false, appType: 'custom', logLevel: 'error',
  resolve: { alias: { '@': resolve(ROOT, 'src'), 'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts') } },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const { workspaceBinding } = await runner.import('/src/components/lumina/components/live-activity/lessonWorkspacePlan.ts');
const { LIVE_ADAPTERS } = await runner.import('/src/components/lumina/components/live-activity/activityContract.ts');
const { getComponentById } = await runner.import('/src/components/lumina/service/manifest/catalog/index.ts');

async function generate(componentId, mode, gradeLevel) {
  const entry = getComponentById(componentId);
  const r = await fetch('http://localhost:3000/api/lumina', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'generateComponentContent', params: { componentId, topic: entry?.description?.slice(0, 80) ?? componentId,
      gradeLevel: flag('--grade', gradeLevel), config: mode ? { targetEvalMode: mode } : {} } }),
    signal: AbortSignal.timeout(300_000) });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`);
  const body = await r.json();
  return body.data ?? body;
}

const rows = [];
for (const id of chosen) {
  const only = flag('--mode', null);
  const modes = [...LIVE_ADAPTERS[id].modes, null].filter(m => !only || (m ?? 'auto') === only);
  for (const mode of modes) for (let i = 0; i < runs; i++) {
    const row = { family: id, mode: mode ?? 'auto', bound: false, reason: '' };
    try {
      const data = await generate(id, mode, grades[id] ?? 'Grade 1');
      const binding = workspaceBinding({ instanceId: 'probe', primitiveId: id, pin: mode ?? undefined, objectiveIds: ['probe'], data });
      row.bound = !!binding;
      row.challenges = Array.isArray(data?.challenges) ? data.challenges.length : null;
      row.types = [...new Set((data?.challenges ?? []).map(c => c?.type ?? c?.evalMode ?? c?.challengeType))].join(',');
      if (!binding) {
        try { LIVE_ADAPTERS[id].validate(data); row.reason = 'validated, but the pin does not bind'; }
        catch (e) { row.reason = String(e?.message ?? e).slice(0, 160); }
      }
    } catch (e) { row.reason = `generation failed: ${String(e?.message ?? e).slice(0, 160)}`; }
    rows.push(row);
    console.log(`${row.bound ? 'BOUND  ' : 'UNBOUND'} ${id} ${row.mode} [${row.types ?? ''}]${row.reason ? ' — ' + row.reason : ''}`);
  }
}
await server.close();
const unbound = rows.filter(r => !r.bound);
console.log(`\n${rows.length - unbound.length}/${rows.length} bound`);
if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(rows, null, 2)); }
process.exit(0);
