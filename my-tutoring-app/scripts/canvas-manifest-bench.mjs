// Does the manifest place a canvas where one fits? Runs canvas retrieval and the real manifest call for each objective a
// canvas spec was built for, as the pilot student (pilot + library pool) or as another student (library only), and
// reports what was offered and what the curator placed. Calls Gemini (one flash-lite match + the manifest + eval-mode
// resolution per run, metered by the shared client).
//
// Usage: node scripts/canvas-manifest-bench.mjs --ids=ten-first,sound-sort [--student=1004] [--extra=slope]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const arg = (n) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const root = process.cwd();
const ids = (arg('ids') ?? '').split(',').filter(Boolean);
const studentId = arg('student') ?? '1004';
const cases = ids.map(id => {
  const s = JSON.parse(readFileSync(resolve(root, 'qa/canvas/specs', id, 'spec.json'), 'utf8'));
  const g = String(s.serves?.grades?.[0] ?? '');
  return { expect: id, topic: s.request?.topic ?? s.title, grade: g, objective: s.request?.objective ?? s.title };
});
if (arg('extra') === 'slope') cases.push(
  { expect: 'slope-two-points', topic: 'Slope as rise over run', grade: '8', objective: 'Find the slope of a line as rise over run from two points on a coordinate grid' },
);
// Objectives no canvas was built for: a canvas offered here should be a near neighbour at best, and placed rarely.
if (arg('extra') === 'negative') cases.push(
  { expect: null, topic: 'Comparing two-digit numbers', grade: '1', objective: 'Compare two two-digit numbers using the symbols >, = and <' },
  { expect: null, topic: 'Main idea', grade: '2', objective: 'Identify the main topic of a short informational text and the key details that support it' },
  { expect: null, topic: 'Butterfly life cycle', grade: '2', objective: 'Put the stages of a butterfly life cycle in order: egg, larva, pupa, adult' },
  { expect: null, topic: 'Measuring length with a ruler', grade: '2', objective: 'Measure the length of an object to the nearest inch with a ruler' },
);
if (!cases.length) throw new Error('need --ids=<spec ids>');
const band = (g) => (g === 'K' ? 'kindergarten' : Number(g) <= 5 ? 'elementary' : Number(g) <= 8 ? 'middle-school' : 'high-school');

const server = await vite.createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null }, resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
const rows = [];
try {
  const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateExhibitManifestStreaming } = await runner.import('/src/components/lumina/service/manifest/gemini-manifest.ts');
  const { canvasCandidates } = await runner.import('/src/components/lumina/service/core/agent-canvas/canvasCandidates.ts');
  for (const c of cases) {
    const objectives = [{ id: 'obj1', text: c.objective, verb: 'apply', icon: '', grade: c.grade }];
    const t0 = Date.now();
    const offers = await canvasCandidates({ topic: c.topic, gradeLevel: band(c.grade), objectives, studentId });
    const manifest = await generateExhibitManifestStreaming(c.topic, band(c.grade), objectives, null, {}, { studentId, canvasOffers: offers });
    const comps = (manifest.objectiveBlocks ?? []).flatMap(b => b.components.map(x => x.componentId === 'agent-canvas' ? `agent-canvas[${x.config?.canvasId ?? '?'}]` : x.componentId));
    const placed = (manifest.objectiveBlocks ?? []).flatMap(b => b.components).filter(x => x.componentId === 'agent-canvas').map(x => x.config?.canvasId);
    const row = { expect: c.expect, offered: offers.map(o => o.entry.id), placed, components: comps, ms: Date.now() - t0 };
    rows.push(row);
    console.log(`${c.expect}: offered [${row.offered.join(', ')}] placed [${placed.join(', ')}] | ${comps.join(' > ')} (${Math.round(row.ms / 1000)} s)`);
  }
} finally {
  await server.close();
}
const hit = rows.filter(r => r.offered.includes(r.expect)).length, placed = rows.filter(r => r.placed.includes(r.expect)).length;
console.log(`\noffered its own canvas ${hit}/${rows.length}; placed it ${placed}/${rows.length}`);
mkdirSync(resolve(root, 'qa/canvas/bench'), { recursive: true });
const out = resolve(root, 'qa/canvas/bench', `manifest-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`);
writeFileSync(out, JSON.stringify({ studentId, rows }, null, 2));
console.log(`saved ${out}`);
