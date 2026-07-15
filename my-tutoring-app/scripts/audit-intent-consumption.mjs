/**
 * Structural half of the topic-fidelity intent sweep.
 *
 * This is a necessary (not sufficient) contract: every context-native content
 * generator must consume at least one canonical objective axis. Live fixed-topic,
 * varying-intent probes remain the behavioral proof that student-facing output
 * actually tracks the intent.
 */

import fs from 'node:fs';
import path from 'node:path';

const serviceRoot = path.resolve('src/components/lumina/service');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const contextNative = [];
const missing = [];

for (const file of walk(serviceRoot)) {
  const name = path.basename(file);
  if (!name.startsWith('gemini-') || !name.endsWith('.ts') || name.endsWith('.test.ts')) continue;
  const relative = path.relative(serviceRoot, file).replaceAll('\\', '/');
  if (relative === 'manifest/gemini-manifest.ts') continue; // curator, not a registered content primitive

  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes('GenerationContext')) continue;
  contextNative.push(relative);

  const consumesCanonicalObjective = /ctx\.(intent|scope|objective)/.test(source);
  if (!consumesCanonicalObjective) missing.push(relative);
}

if (contextNative.length < 170) {
  throw new Error(`Intent audit found only ${contextNative.length} context-native generator files; expected at least 170.`);
}

if (missing.length > 0) {
  process.stderr.write(
    `Dead intent contract in ${missing.length}/${contextNative.length} context-native generators:\n`
      + missing.map((file) => `- ${file}`).join('\n')
      + '\nRun /topic-fidelity with fixed-topic, varying-intent probes before sweeping a fix.\n',
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Intent consumption contract passed: ${contextNative.length}/${contextNative.length} context-native generator files consume ctx.intent, ctx.scope, or ctx.objective.\n`,
  );
}
