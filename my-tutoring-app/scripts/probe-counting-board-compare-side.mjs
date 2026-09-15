// CNB-2/CNB-3 runtime probe (2026-09-14): real flash-lite counting-board generations through the registry.
// Expectations fixed before running. compare: every board names both drawn groups, 2-3 of 5 larger-first,
// no repeated comparison, oracle clean, every board askable. count / group: no compareGroups, oracle clean.
//   node scripts/probe-counting-board-compare-side.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUT = resolve(ROOT, '../artifacts/eval-fix/counting-board-2026-09-14');
await mkdir(OUT, { recursive: true });
const nextEnv = await import('@next/env');
(nextEnv.loadEnvConfig ?? nextEnv.default.loadEnvConfig)(ROOT);
const vite = await import(pathToFileURL(join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
const server = await vite.createServer({ configFile: false, root: ROOT, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(ROOT, 'src'), 'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts') } } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const script = await runner.import('/src/components/lumina/primitives/visual-primitives/math/countingBoardScript.ts');
const { countingBoardOracle } = await runner.import('/src/components/lumina/service/qa/oracles/counting-board.ts');
const { normalizeGradeLevel } = await runner.import('/src/components/lumina/service/geminiService.ts');
const { getGenerator } = await runner.import('/src/components/lumina/service/registry/contentRegistry.ts');

const CASES = [
  ['compare-g1-easy', 'compare', '1', 'easy', 'Comparing groups to 20', 'Say how many are in the group with more'],
  ['compare-g1-medium-a', 'compare', '1', 'medium', 'Comparing groups to 20', 'Say how many are in the group with more'],
  ['compare-g1-medium-b', 'compare', '1', 'medium', 'Comparing groups to 20', 'Say how many are in the group with more'],
  ['compare-g1-hard', 'compare', '1', 'hard', 'Comparing groups to 20', 'Say how many are in the group with more'],
  ['compare-k-a', 'compare', 'K', 'medium', 'Compare groups up to 10', 'Tell which group has more objects'],
  ['compare-k-b', 'compare', 'K', 'medium', 'Compare groups up to 10', 'Tell which group has more objects'],
  ['count-k', 'count', 'K', 'medium', 'Counting to 10', 'Count how many objects'],
  ['group-g1', 'group', '1', 'medium', 'Counting by groups to 20', 'Count objects in equal groups'],
];
const TYPE = { count: 'count_all', group: 'group_count', compare: 'compare' };
const rows = [];
for (const [name, mode, grade, tier, topic, intent] of CASES) {
  const gradeContext = grade === 'K' ? 'Kindergarten' : 'Grade 1';
  const config = { targetEvalMode: mode, difficulty: tier, objectiveGrade: grade, objectiveSubject: 'MATHEMATICS', intent };
  let payload, error = null;
  try {
    payload = await getGenerator('counting-board')({ componentId: 'counting-board', instanceId: `probe-${name}`, config }, topic, gradeContext, normalizeGradeLevel(gradeContext));
  } catch (e) { error = String(e); }
  const d = payload?.data;
  const cs = d?.challenges ?? [];
  await writeFile(join(OUT, `generation-${name}.json`), JSON.stringify({ config, topic, error, payload }, null, 2));
  const violations = d ? countingBoardOracle.verify(d, { componentId: 'counting-board', evalMode: mode, topic, gradeLevel: gradeContext.toLowerCase() }).violations : [];
  const askable = script.itemsFromChallenges(cs, { objectWord: 'bears' }).length;
  const row = { name, mode, grade, tier, error, boards: cs.length, askable, types: [...new Set(cs.map((c) => c.type))], violations,
    submittedMode: cs[0] ? script.evalModeForKind(cs[0].type) : null };
  let pass = !error && cs.length >= 5 && askable === cs.length && violations.length === 0 && cs.every((c) => c.type === TYPE[mode]);
  if (mode === 'compare') {
    row.drawn = cs.map((c) => c.compareGroups);
    row.largerFirst = cs.filter((c) => c.compareGroups && c.compareGroups[0] > c.compareGroups[1]).length;
    const pairs = cs.map((c) => [...(c.compareGroups ?? [])].sort((a, b) => a - b).join('v'));
    row.distinctPairs = new Set(pairs).size;
    row.maxGroup = Math.max(...cs.map((c) => c.groupSize ?? 0));
    row.maxTotal = Math.max(...cs.map((c) => c.count));
    row.showGroupCircles = d?.showOptions?.showGroupCircles;
    pass = pass && cs.every((c) => Array.isArray(c.compareGroups) && c.compareGroups.length === 2) && [2, 3].includes(row.largerFirst) && row.distinctPairs === cs.length;
  } else {
    row.counts = cs.map((c) => c.count);
    pass = pass && cs.every((c) => c.compareGroups == null) && row.submittedMode === mode;
  }
  row.pass = pass;
  rows.push(row);
  console.log(JSON.stringify(row));
}
await writeFile(join(OUT, 'report.json'), JSON.stringify({ startedAt: new Date().toISOString(), rows }, null, 2));
console.log(`PASS ${rows.filter((r) => r.pass).length}/${rows.length}`);
await server.close();
process.exit(0);
