// Prints each tier band of an item space: how many items, by structure, with sample computations.
//   node scripts/difficulty-lab/item-space-table.mjs <space-id>
import { resolve } from 'node:path';
import * as vite from 'vite';

process.env.GEMINI_API_KEY ??= 'unused-no-calls';
const id = process.argv[2] ?? 'mult-div-facts';
const root = process.cwd();
const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { getItemSpace, TIER_BANDS } = await loader.import('/src/components/lumina/service/itemSpace/index.ts');
  const space = getItemSpace(id);
  for (const [tier, [lo, hi]] of Object.entries(TIER_BANDS)) {
    const picks = space.pick(12, lo, hi);
    console.log(`\n${tier} [${lo}, ${hi}]`);
    for (const p of picks) console.log(`  β ${p.beta.toFixed(2).padStart(5)}  ${p.structure.padEnd(22)} ${space.solve(p).spec}`);
  }
} finally { await server.close(); }
