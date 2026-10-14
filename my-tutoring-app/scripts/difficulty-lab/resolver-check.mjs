// Asks the item-space resolver about each objective (one flash-lite call each) and prints the strand.
//   node scripts/difficulty-lab/resolver-check.mjs <grade> "<objective>" ["<objective>" ...] [--only id,id]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

if (!process.env.GEMINI_API_KEY) {
  const m = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
}
const args = process.argv.slice(2);
const oi = args.indexOf('--only');
const only = oi >= 0 ? args.splice(oi, 2)[1].split(',') : undefined;
const [grade, ...objectives] = args;
const root = process.cwd();
const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { resolveItemSpace } = await loader.import('/src/components/lumina/service/itemSpace/index.ts');
  for (const o of objectives) console.log(`${String(await resolveItemSpace(o, grade, only)).padEnd(15)} ${o}`);
} finally { await server.close(); }
