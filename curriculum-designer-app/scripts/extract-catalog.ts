/**
 * Extract primitive catalog data (with eval modes) from the lumina source
 * into a static JSON file for the curriculum designer app.
 *
 * Run: npx tsx scripts/extract-catalog.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// We can't import the catalog directly (types.ts has deep deps),
// so we'll parse the TypeScript source files to extract the data.
// Fortunately the catalog files are simple const arrays.

const CATALOG_DIR = path.resolve(
  __dirname,
  '../../my-tutoring-app/src/components/lumina/service/manifest/catalog'
);

const DOMAIN_FILES = [
  'core', 'math', 'engineering', 'science', 'biology',
  'astronomy', 'physics', 'literacy', 'media', 'assessment',
];

interface ExtractedEvalMode {
  evalMode: string;
  label: string;
  beta: number;
  scaffoldingMode: number;
  challengeTypes: string[];
  description: string;
}

interface ExtractedPrimitive {
  id: string;
  domain: string;
  description: string;
  constraints?: string;
  supportsEvaluation: boolean;
  evalModes: ExtractedEvalMode[];
  hasTutoring: boolean;
}

// Use a Function constructor to eval the catalog exports safely.
// We strip the TypeScript import/type annotations and eval the array.
function extractFromFile(domain: string): ExtractedPrimitive[] {
  const filePath = path.join(CATALOG_DIR, `${domain}.ts`);
  if (!fs.existsSync(filePath)) {
    console.warn(`  Skipping ${domain}.ts (not found)`);
    return [];
  }

  const source = fs.readFileSync(filePath, 'utf-8');

  // Find all object literals in the exported array
  const primitives: ExtractedPrimitive[] = [];

  // Match each object in the catalog array using a regex approach
  // Look for `id: '...'` patterns
  const idRegex = /id:\s*['"]([^'"]+)['"]/g;
  const ids: string[] = [];
  let m;
  while ((m = idRegex.exec(source)) !== null) {
    ids.push(m[1]);
  }

  // For each id, extract its block
  for (const id of ids) {
    // Find the block for this id
    const idPos = source.indexOf(`id: '${id}'`) !== -1
      ? source.indexOf(`id: '${id}'`)
      : source.indexOf(`id: "${id}"`);
    if (idPos === -1) continue;

    // Find the containing object (walk backward to find `{`)
    let braceCount = 0;
    let blockStart = idPos;
    while (blockStart > 0) {
      blockStart--;
      if (source[blockStart] === '{') {
        braceCount++;
        if (braceCount === 1) break;
      }
      if (source[blockStart] === '}') braceCount--;
    }

    // Walk forward to find matching `}`
    braceCount = 0;
    let blockEnd = blockStart;
    while (blockEnd < source.length) {
      if (source[blockEnd] === '{') braceCount++;
      if (source[blockEnd] === '}') {
        braceCount--;
        if (braceCount === 0) {
          blockEnd++;
          break;
        }
      }
      blockEnd++;
    }

    const block = source.slice(blockStart, blockEnd);

    // Extract description
    const descMatch = block.match(/description:\s*['"`]([^'"`]*(?:['"`][^'"`]*)*?)['"`]/s);
    // Try multiline template literal too
    const descMatch2 = block.match(/description:\s*`([\s\S]*?)`/);
    const description = (descMatch2?.[1] || descMatch?.[1] || '').replace(/\s+/g, ' ').trim();

    // Extract constraints
    const constraintMatch = block.match(/constraints:\s*['"`]([\s\S]*?)['"`]/);
    const constraints = constraintMatch?.[1]?.replace(/\s+/g, ' ').trim();

    // Extract supportsEvaluation
    const supportsEval = block.includes('supportsEvaluation: true');

    // Extract hasTutoring
    const hasTutoring = block.includes('tutoring:');

    // Extract evalModes
    const evalModes: ExtractedEvalMode[] = [];
    const evalModesMatch = block.match(/evalModes:\s*\[([\s\S]*?)\]\s*,?\s*(?:tutoring:|supportsEvaluation:|constraints:|$|\})/);

    if (evalModesMatch) {
      const modesBlock = evalModesMatch[1];
      // Extract each evalMode object
      const modeRegex = /\{[^{}]*evalMode:\s*['"]([^'"]+)['"][^{}]*\}/gs;
      let modeMatch;
      while ((modeMatch = modeRegex.exec(modesBlock)) !== null) {
        const modeBlock = modeMatch[0];
        const evalMode = modeMatch[1];

        const labelM = modeBlock.match(/label:\s*['"]([^'"]+)['"]/);
        const betaM = modeBlock.match(/beta:\s*([\d.]+)/);
        const scaffM = modeBlock.match(/scaffoldingMode:\s*(\d+)/);
        const descM = modeBlock.match(/description:\s*['"]([^'"]+)['"]/);

        // Extract challengeTypes array
        const ctMatch = modeBlock.match(/challengeTypes:\s*\[([\s\S]*?)\]/);
        const challengeTypes: string[] = [];
        if (ctMatch) {
          const ctStr = ctMatch[1];
          const ctItems = ctStr.match(/['"]([^'"]+)['"]/g);
          if (ctItems) {
            for (const ct of ctItems) {
              challengeTypes.push(ct.replace(/['"]/g, ''));
            }
          }
        }

        evalModes.push({
          evalMode,
          label: labelM?.[1] || evalMode,
          beta: betaM ? parseFloat(betaM[1]) : 0,
          scaffoldingMode: scaffM ? parseInt(scaffM[1]) : 0,
          challengeTypes,
          description: descM?.[1] || '',
        });
      }
    }

    primitives.push({
      id,
      domain,
      description: description.slice(0, 200), // Truncate long descriptions
      constraints,
      supportsEvaluation: supportsEval,
      evalModes,
      hasTutoring,
    });
  }

  return primitives;
}

// Main
console.log('Extracting primitive catalog...');
const allPrimitives: ExtractedPrimitive[] = [];

for (const domain of DOMAIN_FILES) {
  const primitives = extractFromFile(domain);
  allPrimitives.push(...primitives);
  console.log(`  ${domain}: ${primitives.length} primitives (${primitives.filter(p => p.evalModes.length > 0).length} with eval modes)`);
}

const outPath = path.resolve(__dirname, '../lib/curriculum-authoring/primitive-catalog.json');
fs.writeFileSync(outPath, JSON.stringify(allPrimitives, null, 2));
console.log(`\nWrote ${allPrimitives.length} primitives to ${outPath}`);
console.log(`  ${allPrimitives.filter(p => p.supportsEvaluation).length} support evaluation`);
console.log(`  ${allPrimitives.filter(p => p.evalModes.length > 0).length} have eval modes`);
console.log(`  ${allPrimitives.reduce((n, p) => n + p.evalModes.length, 0)} total eval modes`);
