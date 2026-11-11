// Turn a saved canvas run (qa/canvas/<name>.json) into an agent-canvas lesson payload. Free: no model call, no browser.
// The page is rebuilt from the saved source, so it carries the current page shell.
// Usage:
//   node scripts/canvas-payload.mjs --name=2026-11-10-11-50-patio-paver-delivery [--out=<file>]
// Default out: the journey sweep's payload folder, as agent-canvas.canvas-<slug>.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

const arg = (name) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const name = arg('name');
if (!name) throw new Error('need --name (a file in qa/canvas, without .json)');
const root = process.cwd();
const saved = JSON.parse(readFileSync(resolve(root, 'qa/canvas', `${name}.json`), 'utf8'));

const server = await vite.createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null }, resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
try {
  const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { canvasLesson } = await runner.import('/src/components/lumina/service/core/agent-canvas/canvasLesson.ts');
  const data = canvasLesson(saved, { grade: saved.request?.grade, rebuild: true });
  delete data.agentDebug;
  const slug = String(saved.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const out = arg('out') ?? resolve(root, 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads', `agent-canvas.canvas-${slug}.json`);
  writeFileSync(out, JSON.stringify({ source: `qa/canvas/${name}.json`, primitiveId: 'agent-canvas', evalMode: 'canvas', topic: saved.request?.topic, gradeLevel: saved.request?.grade, data }, null, 1));
  console.log(`wrote ${out}: "${saved.title}", ${data.challenges[0].proof.length} proof steps, ${data.challenges[0].miss.length} miss steps, ${data.challenges.length} challenge(s), ${Math.round((data.page ?? data.challenges[0].html ?? '').length / 1024)} KB page`);
} finally {
  await server.close();
}
