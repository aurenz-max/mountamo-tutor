// Saves the hand-written two-lines display (gen-display/fixtures.ts) to the library as a seed, after
// running it through the harness. No model calls. Delete data/gen-display/two-lines-meet-seed.json to remove it.
import { resolve } from 'node:path';
import * as vite from 'vite';

const root = process.cwd();
const server = await vite.createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null }, resolve: { alias: { '@': resolve(root, 'src') } } });
try {
  const load = (p) => vite.createServerModuleRunner(server.environments.ssr, { hmr: false }).import(p);
  const { compileDisplay } = await load('/src/components/lumina/service/gen-display/compile.ts');
  const { displayDocument } = await load('/src/components/lumina/service/gen-display/document.ts');
  const { runDisplay, closeHarness } = await load('/src/components/lumina/service/gen-display/harness.ts');
  const { saveTemplate } = await load('/src/components/lumina/service/gen-display/library.ts');
  const fx = await load('/src/components/lumina/service/gen-display/fixtures.ts');
  const c = compileDisplay(fx.LINES_SOURCE);
  const run = await runDisplay(displayDocument(c.js, Object.fromEntries(Object.entries(fx.LINES_PARAMS).map(([k, v]) => [k, v.default]))), fx.LINES_PROBES);
  await closeHarness();
  if (run.errors.length || run.probes.some(p => !p.ok)) throw new Error('seed failed the harness');
  saveTemplate({
    id: 'two-lines-meet-seed', title: 'When do two lines meet?',
    idea: 'Two lines with different slopes meet at exactly one point; lines with equal slopes never meet unless they are the same line.',
    tags: ['linear equations', 'systems of equations', 'slope', 'intersection', 'graphing lines', 'grades 7-9'],
    source: fx.LINES_SOURCE, params: fx.LINES_PARAMS, probes: fx.LINES_PROBES,
    createdAt: 'seed (hand-written, harness-validated)', uses: 0,
  });
  console.log('saved data/gen-display/two-lines-meet-seed.json');
} finally {
  await server.close();
}
