// Export the live catalog (ids, constraints, per-mode answers/beta) for this review.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, createServerModuleRunner } from 'vite';
const root = process.cwd();
const server = await createServer({ configFile: false, root, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null }, resolve: { alias: { '@': resolve(root, 'src') } } });
try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { UNIVERSAL_CATALOG, CATALOGS_BY_DOMAIN } = await runner.import('/src/components/lumina/service/manifest/catalog/index.ts');
  const cat = UNIVERSAL_CATALOG.map(c => ({ id: c.id, domain: Object.entries(CATALOGS_BY_DOMAIN).find(([, es]) => es.some(e => e.id === c.id))?.[0], description: c.description, constraints: c.constraints, affordances: c.affordances, teachingWorkspace: !!c.teachingWorkspace,
    modes: (c.evalModes ?? []).map(m => ({ id: m.evalMode, label: m.label, description: m.description, beta: m.beta, answers: m.affordances?.answers ?? m.answers })) }));
  writeFileSync(process.argv[2], JSON.stringify(cat, null, 2) + '\n');
  console.log(cat.length, 'primitives');
} finally { await server.close(); }
