// Real production-generation HTTP probe. No learner/store mutations.
// Reuses explicitly recorded synthetic D output; never labels it a new diagnosis.
import ts from 'typescript';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';

async function moduleFrom(path) {
  async function urlFor(file) {
    let code = ts.transpileModule(await readFile(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    for (const match of [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)]) {
      if (!match[1].startsWith('.')) throw new Error(`Non-pure dependency: ${match[1]}`);
      code = code.replace(match[0], `from '${await urlFor(resolve(dirname(file), `${match[1]}.ts`))}'`);
    }
    return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  }
  return import(await urlFor(resolve(path)));
}
const source = process.argv[2] || 'qa/misconception/place-value-chart/2026-09-12T18-53-12-730Z/run.json';
const prior = JSON.parse(await readFile(source, 'utf8'));
if (prior.fixture || prior.schema !== 'place-value-pilot-v1') throw new Error('Expected saved real D run');
const focus = prior.diagnoses.find(d => d.output?.misconceptionText)?.output.misconceptionText;
if (!focus) throw new Error('No actual D output');
const { certifyPlaceValueItems, placeValueContentIdentity } = await moduleFrom('src/components/lumina/service/math/placeValueOpportunityContract.ts');
const dir = `qa/misconception/place-value-opportunities/${new Date().toISOString().replace(/[:.]/g, '-')}`;
await mkdir(dir, { recursive: true });
const report = { synthetic: true, sourceDiagnosisRun: source, tests: [], status: 'BLOCKED', blockers: [
  'This probe performs generation only, not authenticated issuance, a mounted learner run or a store transition.',
] };
try {
  for (const name of ['baseline', 'saturated', 'targeted-1', 'targeted-2']) {
    const config = { targetEvalMode: 'compare', difficulty: 'medium', objectiveGrade: '4', objectiveSubject: 'MATHEMATICS',
      skillId: 'NBT004-01', subskillId: 'NBT004-01-b',
      objectiveText: 'Identify digit place and numeric value in four-digit whole numbers',
      instanceCount: name === 'saturated' ? 1 : 3,
      ...(name !== 'baseline' ? { remediationFocus: focus, remediationForPrimitiveType: 'place-value-chart', remediationForSkillId: 'unresolved-synthetic' } : {}) };
    const response = await fetch(`${process.env.PVC_FRONTEND || 'http://localhost:3000'}/api/lumina`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000),
      body: JSON.stringify({ action: 'generateComponentContent', params: { componentId: 'place-value-chart',
        instanceId: `opportunity-${name}`, topic: 'Place value in four-digit whole numbers', gradeLevel: 'Grade 4', config } }),
    });
    if (!response.ok) throw new Error(`generation HTTP ${response.status}`);
    const output = await response.json();
    const items = certifyPlaceValueItems(output.data, name === 'baseline' ? '' : focus);
    const hash = createHash('sha256').update(placeValueContentIdentity(output.data)).digest('hex');
    const expected = name.startsWith('targeted') ? 2 : 0;
    const eligible = items?.filter(i => i.eligible).length ?? 0;
    // A targeted draw may saturate honestly. Require one positive draw across
    // the run, and never mislabel an insufficient compiled plan as targeted.
    const outcome = name.startsWith('targeted') && eligible === 0 ? 'SATURATED' : eligible === 2 ? 'TARGETED' : 'NO-OP';
    const pass = (eligible === expected || outcome === 'SATURATED') && !output.data.misconceptionOpportunity && !JSON.stringify(output).includes(focus);
    await writeFile(`${dir}/${name}.json`, JSON.stringify({ output, candidateItems: items, contentHash: hash, pass }, null, 2));
    report.tests.push({ name, eligible, hash, pass, outcome, receipt: false });
    console.log(`${name}: ${pass ? 'PASS' : 'FAIL'} eligible=${eligible}, no receipt`);
  }
  report.status = report.tests.every(t => t.pass) && report.tests.some(t => t.eligible === 2)
    ? 'GENERATION PASS / ISSUANCE BLOCKED' : 'FAIL';
  if (report.status === 'FAIL') process.exitCode = 1;
} catch (error) {
  report.blockers.push(error.message);
  process.exitCode = 1;
} finally {
  await writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
  console.log(dir);
}
