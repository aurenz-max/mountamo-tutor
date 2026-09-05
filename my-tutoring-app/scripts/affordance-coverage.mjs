#!/usr/bin/env node
/**
 * Which catalog entries carry an `affordances:` block — the rollout ledger for
 * `/add-affordances`. Pure text scan of service/manifest/catalog/*.ts (no TS
 * import), so it runs anywhere:
 *   node scripts/affordance-coverage.mjs            # summary + untagged list
 *   node scripts/affordance-coverage.mjs --tagged   # tagged list instead
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join('src', 'components', 'lumina', 'service', 'manifest', 'catalog');
const ID_RE = /^ {4,6}id: '([^']+)',\s*$/; // comparison-builder's entry sits one indent deeper
;   // comparison-builder's entry is indented one level deeper
const END_RE = /^ {2,3}\},?\s*$/;
;
const tagged = [];
const untagged = [];
for (const f of readdirSync(DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'index.ts' && f !== 'affordances.ts')) {
  const lines = readFileSync(join(DIR, f), 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = ID_RE.exec(lines[i]);
    if (!m) continue;
    let j = i + 1;
    let has = false;
    while (j < lines.length && !END_RE.test(lines[j])) {
      if (lines[j].startsWith('    affordances:')) has = true;
      j++;
    }
    (has ? tagged : untagged).push(`${m[1]} (${f})`);
  }
}
const showTagged = process.argv.includes('--tagged');
console.log(`affordances: ${tagged.length} tagged · ${untagged.length} untagged · ${tagged.length + untagged.length} total`);
for (const id of showTagged ? tagged : untagged) console.log(`  ${showTagged ? '✓' : '·'} ${id}`);
