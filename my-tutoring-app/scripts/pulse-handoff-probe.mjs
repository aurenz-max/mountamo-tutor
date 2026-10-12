// Pulse handoff probe (WORKSTREAMS 7.5): real engine items -> the real Pulse
// manifest (live catalog primitive pick) -> resolvePulseEvalModes (fitting modes
// by LLM, nearest target_beta by code). Optionally hydrates one session to check
// the generator built the pinned mode.
//
// Items come from pulse-agent journey JSONs (backend/reports/GK), so no backend
// or login is needed. Costs a few Flash calls per session.
//
//   node scripts/pulse-handoff-probe.mjs --run [--hydrate]
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to build Pulse manifests for sampled engine sessions.');
  process.exit(0);
}
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const hydrate = process.argv.includes('--hydrate');
const out = console.log.bind(console);
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) {
  console[method] = (...args) => logs.push(format(...args).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]'));
}

const root = process.cwd();
const journeys = resolve(root, '../backend/reports/GK');
// (profile file prefix, session index): frontier-heavy cold start plus three ability levels.
const SAMPLES = [['Cold-Start Cleo', 0], ['Struggling Sofia', 4], ['Steady Sam', 9], ['Gifted Grace', 11]];

const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const report = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generatePulseManifest } = await loader.import('/src/components/lumina/service/manifest/practice-manifest.ts');
  const { hydratePracticeManifest } = await loader.import('/src/components/lumina/service/manifest/practice-content-hydrator.ts');
  const { getComponentById } = await loader.import('/src/components/lumina/service/manifest/catalog/index.ts');

  for (const [profile, si] of SAMPLES) {
    const file = readdirSync(journeys).find((f) => f.startsWith(`journey_${profile}_MATHEMATICS_GK`) && f.endsWith('.json'));
    const session = JSON.parse(readFileSync(join(journeys, file), 'utf8')).sessions[si];
    const items = session.items.map((it) => ({
      item_id: it.item_id, description: it.description, band: it.band,
      target_mode: it.target_mode, target_beta: it.target_beta,
      skill_id: it.skill_id, subskill_id: it.subskill_id, subject: 'MATHEMATICS',
    }));
    const start = logs.length;
    const manifest = await generatePulseManifest(items, 'kindergarten');
    const modeLines = logs.slice(start).filter((l) => l.startsWith('[Pulse] mode'));
    const rows = manifest.items.map((mi, i) => {
      const v = mi.visualPrimitive;
      const line = modeLines.find((l) => l.includes(` ${mi.instanceId} `));
      return {
        item: mi.instanceId, band: items[i].band, subskill: items[i].description,
        targetBeta: items[i].target_beta, targetMode: items[i].target_mode, difficulty: mi.difficulty,
        engineAffinity: session.items[i].primitive_affinity,
        kind: v ? `visual:${v.componentId}` : `standard:${mi.standardProblem?.problemType}/${mi.standardProblem?.evalMode}`,
        modes: v ? (getComponentById(v.componentId)?.evalModes ?? []).map((m) => `${m.evalMode}@${m.beta}`) : [],
        pin: v?.targetEvalMode ?? null, resolverLine: line ?? null,
      };
    });
    let built = null;
    if (hydrate && report.length === 0) {
      const hydrated = await hydratePracticeManifest(manifest);
      built = hydrated.map((h) => ({
        item: h.manifestItem.instanceId,
        pin: h.manifestItem.visualPrimitive?.targetEvalMode ?? null,
        builtEvalMode: h.visualData?.data?.evalMode ?? h.visualData?.evalMode ?? null,
        challengeTypes: [...new Set((h.visualData?.data?.challenges ?? h.visualData?.challenges ?? []).map((c) => c.type ?? c.challengeType).filter(Boolean))],
      }));
    }
    report.push({ profile, session: si, rows, built });
    out(`\n## ${profile} session ${si + 1}`);
    for (const r of rows) out(`- ${r.band.padEnd(8)} β${r.targetBeta.toFixed(1)} ${r.difficulty.padEnd(6)} ${r.kind}  ${r.resolverLine ? r.resolverLine.replace(/^\[Pulse\] mode \S+ \S+: /, '') : ''}\n    subskill: ${r.subskill}`);
    if (built) for (const b of built) out(`  built ${b.item}: pin=${b.pin} generator=${b.builtEvalMode} types=[${b.challengeTypes.join(', ')}]`);
  }
} finally {
  await server.close();
}
const dir = resolve(root, 'qa/pulse-handoff');
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
writeFileSync(join(dir, `probe-${stamp}.json`), JSON.stringify({ report, logs: logs.filter((l) => /\[Pulse\]|resolvePulse/.test(l)) }, null, 2));
out(`\nSaved qa/pulse-handoff/probe-${stamp}.json`);
