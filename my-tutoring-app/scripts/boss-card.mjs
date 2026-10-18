// Print a primitive's boss card: how it is wired to the live tutor, read from its `<name>.card.ts` + `<name>.boss.ts`. Free: no API call.
//   node scripts/boss-card.mjs classification-sorter      one card, plus the guidance the tutor receives
//   node scripts/boss-card.mjs                            every boss
import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const want = process.argv[2];
const files = readdirSync(join(ROOT, 'src'), { recursive: true }).filter(f => String(f).endsWith('.boss.ts'))
  .map(f => '/' + relative(ROOT, join(ROOT, 'src', String(f))).replace(/\\/g, '/'));

const vite = await import(pathToFileURL(join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
const server = await vite.createServer({ configFile: false, root: ROOT, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(ROOT, 'src'), 'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts') } } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
try {
  const { renderBoss } = await runner.import('/src/components/lumina/components/live-activity/boss.ts');
  const { getComponentById } = await runner.import('/src/components/lumina/service/manifest/catalog/index.ts');
  const bosses = [];
  for (const file of files) {
    const mod = await runner.import(file);
    for (const value of Object.values(mod)) if (value && typeof value === 'object' && value.drive && value.card) bosses.push({ file, boss: value });
  }
  const shown = bosses.filter(b => !want || b.boss.card.id === want);
  if (!shown.length) { console.log(want ? `No boss for ${want}. Bosses: ${bosses.map(b => b.boss.card.id).join(', ')}` : 'No bosses yet.'); process.exitCode = 1; }
  for (const { file, boss } of shown) {
    console.log(renderBoss(boss, getComponentById(boss.card.id)?.evalModes ?? []));
    console.log(`  (${file.slice(1)})\n`);
    if (want) {
      const { LIVE_ADAPTERS } = await runner.import('/src/components/lumina/components/live-activity/activityContract.ts');
      console.log('GUIDANCE THE TUTOR RECEIVES\n' + LIVE_ADAPTERS[boss.card.id].guidance);
    }
  }
} finally {
  await server.close();
}
