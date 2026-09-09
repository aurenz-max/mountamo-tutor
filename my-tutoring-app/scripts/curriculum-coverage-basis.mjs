import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { scopeFromArgv } from './lib/curriculum-coverage-scopes.mjs';
// Freezes the reviewed curriculum + catalog for one scope. Refuses to overwrite an existing
// basis unless --refresh is passed: a stale-basis error means "re-review the changed rows",
// never "regenerate the hashes".
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scope = scopeFromArgv();
const dir = resolve(root, scope.dir);
const target = resolve(dir, 'review-basis.json');
const argv = process.argv.slice(2);
if (existsSync(target) && !argv.includes('--refresh')) throw new Error(`${target} exists; pass --refresh only after reviewing the changed requirements/capabilities`);
const hash = v => createHash('sha256').update(v).digest('hex');
const rows = JSON.parse(readFileSync(resolve(dir, 'requirements.json'), 'utf8'));
const catalogDir = 'src/components/lumina/service/manifest/catalog';
const sources = scope.catalogFiles ?? readdirSync(resolve(root, catalogDir)).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).sort().map(f => `${catalogDir}/${f}`);
const noteIdx = argv.indexOf('--note');
const previous = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : null;
const basis = {
  reviewedAt: new Date().toISOString().slice(0, 10),
  scope: scope.id, subject: scope.subject, grade: scope.grade,
  requirements: Object.fromEntries(rows.map(r => [r.id, hash(r.text)])),
  catalogSources: Object.fromEntries(sources.map(p => [p, hash(readFileSync(resolve(root, p)))])),
  catalogReviewNotes: [...(previous?.catalogReviewNotes ?? []), ...(noteIdx >= 0 ? [argv[noteIdx + 1]] : [])],
};
writeFileSync(target, JSON.stringify(basis, null, 2) + '\n');
console.log(JSON.stringify({ scope: scope.id, requirements: rows.length, catalogSources: sources.length, target }));
