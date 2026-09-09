import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, createServerModuleRunner } from 'vite';
import { scopeFromArgv } from './lib/curriculum-coverage-scopes.mjs';

// Code-judged content checks over each saved draw for one scope. The scope names its check
// module (lib/curriculum-coverage-checks/<scope>.mjs), which converts the raw payload with the
// production item/cue builders, runs per-mode checks, and returns readable task samples.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scope = scopeFromArgv();
const dir = resolve(root, scope.dir);
const rules = await import(scope.checks);
const server = await createServer({ configFile: false, root, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null }, resolve: { alias: { '@': resolve(root, 'src') } } });
try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const mods = Object.fromEntries(await Promise.all(Object.entries(rules.modules ?? {}).map(async ([k, p]) => [k, await runner.import(p)])));
  const results = [];
  for (const file of readdirSync(resolve(dir, 'evidence')).filter(f => f.endsWith('.json')).sort()) {
    const r = JSON.parse(readFileSync(resolve(dir, 'evidence', file), 'utf8'));
    const data = r.response?.fullData;
    if (!data) { results.push({ ...r, file, checks: [{ name: 'Generated content exists', pass: false, detail: r.response?.error || r.transportError }], result: 'failed', itemCount: 0, samples: [], semantic: rules.semantic[r.id] }); continue; }
    const { items, checks, samples } = rules.check(r, data, mods);
    results.push({ id: r.id, primitive: r.primitive, mode: r.mode, draw: r.draw, file, inputHash: r.inputHash, sourceHashes: r.sourceHashes,
      requestedAt: r.requestedAt, durationMs: r.durationMs, httpStatus: r.httpStatus, endpointStatus: r.response.status,
      itemCount: items.length, result: checks.every(c => c.pass) ? 'sampled' : 'failed', checks, semantic: rules.semantic[r.id], samples,
      interaction: 'not_tested', interactionNote: rules.interactionNote });
  }
  writeFileSync(resolve(dir, 'content-checks.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify({ scope: scope.id, draws: results.length, sampled: results.filter(r => r.result === 'sampled').length, failed: results.filter(r => r.result === 'failed').length, items: results.reduce((n, r) => n + (r.itemCount ?? 0), 0) }));
} finally { await server.close(); }
