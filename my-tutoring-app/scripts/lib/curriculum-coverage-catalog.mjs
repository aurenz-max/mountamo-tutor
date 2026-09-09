import { createHash } from 'node:crypto';
import { createServer, createServerModuleRunner } from 'vite';

// Live catalog access for the coverage scripts, plus per-entry hashing.
//
// Why per-entry: an eval-test draw is produced by ONE primitive's generator reading ONE
// catalog entry (the dispatcher is given componentId, so the manifest never runs). Hashing the
// whole catalog file into every draw's provenance made a bar-model birth stale ten-frame's
// evidence — after one day of slice-7 work every K Math pair read "source changed". A draw is
// stale when ITS entry, ITS generator or ITS component changed, and nothing else.
export const ENTRY_PREFIX = 'catalog-entry:';
const sha = v => createHash('sha256').update(v).digest('hex');

/** Hash of one raw catalog entry (functions drop out of JSON; every data field counts). */
export function entryHash(rawCatalog, id) {
  const entry = rawCatalog.find(c => c.id === id);
  return entry ? sha(JSON.stringify(entry)) : null;
}

/** Runs fn(UNIVERSAL_CATALOG, CATALOGS_BY_DOMAIN) against the live TypeScript catalog. */
export async function withLiveCatalog(root, fn) {
  const server = await createServer({ configFile: false, root, logLevel: 'error', appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
  try {
    const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
    const { UNIVERSAL_CATALOG, CATALOGS_BY_DOMAIN } = await runner.import('/src/components/lumina/service/manifest/catalog/index.ts');
    return await fn(UNIVERSAL_CATALOG, CATALOGS_BY_DOMAIN);
  } finally { await server.close(); }
}
