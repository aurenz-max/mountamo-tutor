/**
 * One-time mechanical migration used by the 2026-07-14 topic-fidelity intent sweep.
 *
 * It handles the common context-native generator shape:
 *   const { topic } = ctx;
 *   const prompt = `... ${topic} ...`;
 *
 * Complex orchestrators that build prompts in top-level sub-generators are left for
 * explicit threading. The permanent regression guard lives in
 * intentConsumptionContract.test.ts; this migration script is intentionally strict
 * and idempotent so the sweep is reviewable.
 */

import fs from 'node:fs';
import path from 'node:path';

const serviceRoot = path.resolve('src/components/lumina/service');
const complex = new Set([
  'calendar/gemini-calendar-explorer.ts',
  'calendar/gemini-timeline-builder.ts',
  'engineering/gemini-transport-challenge.ts',
  'math/gemini-net-folder.ts',
  'math/gemini-shape-composer.ts',
  'math/gemini-strategy-picker.ts',
]);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(serviceRoot).filter((file) => {
  const name = path.basename(file);
  return name.startsWith('gemini-') && name.endsWith('.ts') && !name.endsWith('.test.ts');
});

const changed = [];
for (const file of files) {
  const relative = path.relative(serviceRoot, file).replaceAll('\\', '/');
  if (relative === 'manifest/gemini-manifest.ts' || complex.has(relative)) continue;

  let source = fs.readFileSync(file, 'utf8');
  const isContextNative = source.includes('GenerationContext');
  const consumesIntent = /ctx\.(intent|scope|objective)|buildScopePromptSection/.test(source);
  if (!isContextNative || consumesIntent) continue;

  const contextImport = /import type \{ GenerationContext \} from (["'])\.\.\/generation\/generationContext\1;/;
  if (!contextImport.test(source)) {
    throw new Error(`No standard GenerationContext import in ${relative}`);
  }
  source = source.replace(
    contextImport,
    (line) => `${line}\nimport { buildScopePromptSection } from '../scopeContext';`,
  );

  const topicBinding = 'const { topic } = ctx;';
  const bindingIndex = source.lastIndexOf(topicBinding);
  if (bindingIndex < 0) throw new Error(`No standard topic binding in ${relative}`);
  source = source.slice(0, bindingIndex + topicBinding.length)
    + '\n  const scopeSection = buildScopePromptSection(ctx.scope);'
    + source.slice(bindingIndex + topicBinding.length);

  const topicTokenIndex = source.indexOf('${topic}', bindingIndex);
  if (topicTokenIndex < 0) throw new Error(`No prompt topic token after context binding in ${relative}`);
  source = source.slice(0, topicTokenIndex)
    + '${topic}\n${scopeSection}'
    + source.slice(topicTokenIndex + '${topic}'.length);

  fs.writeFileSync(file, source, 'utf8');
  changed.push(relative);
}

if (changed.length !== 46) {
  throw new Error(`Expected 46 common-shape migrations, changed ${changed.length}: ${changed.join(', ')}`);
}

process.stdout.write(`Intent scope wired into ${changed.length} generators.\n`);
