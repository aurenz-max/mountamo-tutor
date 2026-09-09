import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scopeFromArgv } from './lib/curriculum-coverage-scopes.mjs';
import { withLiveCatalog } from './lib/curriculum-coverage-catalog.mjs';

// Lists what changed in the live catalog since the scope's catalog-export.json, entry by
// entry (new/removed primitives, added/removed modes, changed description/constraints/mode
// text), then rewrites the export. This is the review a basis --refresh note needs.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scope = scopeFromArgv();
const exportPath = resolve(root, scope.dir, 'catalog-export.json');
const before = new Map(JSON.parse(readFileSync(exportPath, 'utf8')).map(p => [p.id, p]));
await withLiveCatalog(root, (UNIVERSAL_CATALOG, CATALOGS_BY_DOMAIN) => {
  const catalog = UNIVERSAL_CATALOG.map(c => ({
    id: c.id, description: c.description, constraints: c.constraints,
    domain: Object.entries(CATALOGS_BY_DOMAIN).find(([, es]) => es.some(e => e.id === c.id))?.[0],
    supportsEvaluation: c.supportsEvaluation === true,
    modes: (c.evalModes ?? []).map(m => ({ id: m.evalMode, description: m.description, label: m.label })),
  }));
  const lines = [];
  for (const p of catalog) {
    const o = before.get(p.id);
    if (!o) { lines.push(`NEW ${p.id} [${p.domain}] ${p.modes.map(m => m.id).join(',')}`); continue; }
    const added = p.modes.filter(m => !o.modes.some(x => x.id === m.id)).map(m => m.id);
    const removed = o.modes.filter(m => !p.modes.some(x => x.id === m.id)).map(m => m.id);
    const changed = [];
    if (p.description !== o.description) changed.push('description');
    if (p.constraints !== o.constraints) changed.push('constraints');
    if (p.modes.some(m => { const x = o.modes.find(y => y.id === m.id); return x && (x.description !== m.description || x.label !== m.label); })) changed.push('mode text');
    if (added.length || removed.length || changed.length) lines.push(`CHANGED ${p.id}${added.length ? ' +' + added.join(',') : ''}${removed.length ? ' -' + removed.join(',') : ''}${changed.length ? ' ' + changed.join('/') : ''}`);
  }
  for (const id of before.keys()) if (!catalog.some(p => p.id === id)) lines.push(`REMOVED ${id}`);
  if (!process.argv.includes('--dry')) writeFileSync(exportPath, JSON.stringify(catalog, null, 2) + '\n');
  console.log(lines.length ? lines.join('\n') : 'no catalog changes since the export');
});
