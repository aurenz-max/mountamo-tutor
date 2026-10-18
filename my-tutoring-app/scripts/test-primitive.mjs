// The scoped test gate for ONE primitive adoption (USER 10-16): its own tests, the shared contract and journey sweep
// filtered to its id, and the lesson plan. The full live-activity suite (~5,800 tests, 10-15 min) is only for a change
// to shared framework (live-activity/runtime/, the adapter contract). Free: no model calls.
//   npm run test:primitive -- <primitive-id> [<primitive-id> ...]
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ids = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (!ids.length) { console.error('Usage: npm run test:primitive -- <primitive-id> [...]'); process.exit(2); }

const root = resolve(import.meta.dirname, '..');
const src = join(root, 'src');
const LA = 'src/components/lumina/components/live-activity';

// Own tests: any test file whose name carries the id, kebab or camel (fraction-bar -> fractionBar, FractionBar).
const camel = (id) => id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const pats = ids.flatMap((id) => [id, camel(id)].map((s) => s.toLowerCase()));
const own = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); continue; }
    if (!/\.test\.tsx?$/.test(e.name)) continue;
    const name = e.name.toLowerCase();
    if (pats.some((s) => name.includes(s))) own.push(relative(root, p).replace(/\\/g, '/'));
  }
})(src);

const vitest = (files, extra = []) => {
  console.log(`\n> vitest run ${files.join(' ')} ${extra.join(' ')}`);
  const r = spawnSync(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'run', ...files, ...extra],
    { cwd: root, stdio: 'inherit' });
  return r.status ?? 1;
};

const started = Date.now();
let status = 0;
// 1. Own tests + the lesson plan (unfiltered: their test names need not carry the id).
status ||= vitest([...own, `${LA}/lessonWorkspacePlan.test.ts`, 'src/components/lumina/service/manifest/catalog/misses.test.ts']);
// 2. Shared contract and dry journey, only this primitive's saved payloads.
const filter = ids.map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
status ||= vitest([`${LA}/runtime/workspaceContract.test.tsx`, `${LA}/runtime/journeySweep.test.tsx`], ['-t', filter]);

console.log(`\ntest:primitive ${ids.join(', ')}: ${status ? 'FAILED' : 'passed'} in ${Math.round((Date.now() - started) / 1000)} s`
  + ` (own files: ${own.length}). Also run: npm run typecheck:lumina`);
process.exit(status);
