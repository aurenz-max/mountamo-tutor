// Author one agent canvas (service/agent-kit/canvas) and save it to qa/canvas. Calls Gemini (metered) and needs Chromium.
// Usage:
//   node scripts/canvas-author.mjs --topic="..." --grade="grade 4" [--objective="..."] [--name=bridge]
// Writes <date>-<name>.json (the canvas and its run record), .html (open it to play: ask, sandboxed canvas, Check) and
// -rest.png / -proof.png (the canvas at rest and after the author's own playthrough).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const arg = (name) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const ask = { topic: arg('topic'), grade: arg('grade') ?? 'grade 4', objective: arg('objective') };
if (!ask.topic) throw new Error('need --topic');
const root = process.cwd();
const name = arg('name') ?? ask.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);

const server = await vite.createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null }, resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
try {
  const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { withSpendSource } = await runner.import('/src/components/lumina/service/spend/spendMeter.ts');
  const { authorCanvas, canvasHostPage } = await runner.import('/src/components/lumina/service/agent-kit/canvas/canvasAuthor.ts');
  const { CanvasStage } = await runner.import('/src/components/lumina/service/agent-kit/canvas/stage.ts');
  const out = resolve(root, 'qa/canvas');
  mkdirSync(out, { recursive: true });
  const base = resolve(out, `${new Date().toISOString().slice(0, 10)}-${name}`);
  let data;
  try {
    data = await withSpendSource('harness', 'canvas:author', () => authorCanvas(ask));
  } catch (e) {
    console.error(`FAILED: ${e.message}`);
    process.exitCode = 1;
  }
  if (data) {
    writeFileSync(`${base}.json`, JSON.stringify({ request: ask, ...data }, null, 2));
    writeFileSync(`${base}.html`, canvasHostPage(data));
    // Replay the author's playthrough on the shipped page: the saved pictures are what a child would see.
    const stage = new CanvasStage();
    const rest = await stage.play(data.html);
    const proof = await stage.play(data.html, data.proof);
    await stage.close();
    writeFileSync(`${base}-rest.png`, rest.png);
    writeFileSync(`${base}-proof.png`, proof.png);
    const d = data.agentDebug;
    console.log(JSON.stringify({
      title: data.title, ask: data.ask, goal: data.goal, sourceChars: data.source.length,
      turns: d.turns, seconds: d.seconds, costUsd: d.costUsd, plays: d.plays,
      replay: { restGoal: rest.rest.goal, proofGoal: proof.after.goal, stepErrors: proof.stepErrors, errors: proof.after.errors },
      proofSteps: data.proof, scene: data.scene, advisories: d.advisories,
    }, null, 1));
    for (const t of d.toolCalls) console.log(`  turn ${t.turn} ${t.name}${t.ok ? '' : ' FAILED'}${t.note ? `: ${t.note}` : ''}`);
    console.log(`saved ${base}.{json,html,-rest.png,-proof.png}`);
  }
} finally {
  await server.close();
}
