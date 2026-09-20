// length-lab named-unit probe (2026-09-18).
// Run from my-tutoring-app:  node scripts/probe-length-lab-named-unit.mjs [--draws=3]
//
// `unitFromObjective` reads the unit the objective NAMES so a "measure with your
// hands" row cannot be handed cubes. Its seven regexes were saved with literal
// backspace bytes in place of their `\b` escapes, so every one of them was dead
// and the unit fell back to a random draw — the exact 2026-09-09 defect the
// docblock says was fixed. This drives the live generator per named unit.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createServer, createServerModuleRunner } from 'vite';

const root = process.cwd();
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync(resolve(root, '.env.local'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const args = process.argv.slice(2);
const draws = Number((args.find((a) => a.startsWith('--draws=')) || '--draws=2').slice(8));
const output = resolve(root, args.find((a) => a.endsWith('.json') && !a.startsWith('--'))
  || 'qa/eval-reports/length-lab-named-unit-2026-09-18.json');

const CASES = [
  { unit: 'hands', topic: 'Measure how long a classroom object is using your hands', objective: 'Measure objects with your hands' },
  { unit: 'feet', topic: 'Measure how long the rug is by walking heel to toe', objective: 'Measure with footsteps, one foot in front of the other' },
  { unit: 'paper_clips', topic: 'Measure a pencil with paper clips laid end to end', objective: 'Measure objects using paper clips' },
  { unit: 'cubes', topic: 'Measure a crayon with cubes laid end to end', objective: 'Measure objects using cubes' },
];
const GRADE = 'Kindergarten';

const server = await createServer({
  configFile: false, root, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const evidence = { startedAt: new Date().toISOString(), grade: GRADE, draws: [] };
const save = () => { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(evidence, null, 2)); };

try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateLengthLab } = await runner.import('/src/components/lumina/service/math/gemini-length-lab.ts');
  for (const kase of CASES) {
    for (let i = 1; i <= draws; i++) {
      const label = `${kase.unit} draw ${i}`;
      try {
        const data = await generateLengthLab({
          topic: kase.topic, gradeContext: GRADE, intent: kase.objective,
          // This generator reads ctx.scope directly (buildScopePromptSection).
          scope: { topic: kase.topic, objectiveText: kase.objective, intent: kase.objective },
          raw: { gradeBand: 'K', objectiveText: kase.objective },
        });
        const mismatched = (data.challenges ?? []).filter((c) => c.unitType && c.unitType !== kase.unit).map((c) => c.unitType);
        const ok = data.unitType === kase.unit && mismatched.length === 0;
        evidence.draws.push({ label, expected: kase.unit, unitType: data.unitType, mismatchedChallengeUnits: mismatched, ok });
        console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: unitType=${data.unitType}${mismatched.length ? ` challenges=${mismatched.join(',')}` : ''}`);
      } catch (error) {
        evidence.draws.push({ label, expected: kase.unit, error: String(error), ok: false });
        console.log(`ERROR ${label}: ${error}`);
      }
      save();
    }
  }
} finally {
  await server.close();
}
const passed = evidence.draws.filter((d) => d.ok).length;
console.log(`${passed}/${evidence.draws.length} draws honored the named unit -> ${output}`);
process.exit(passed === evidence.draws.length ? 0 : 1);
