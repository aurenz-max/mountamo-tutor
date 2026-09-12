// Run from my-tutoring-app. All diagnostic inputs are synthetic and saved locally.
import ts from 'typescript';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const frontend = process.env.PVC_FRONTEND || 'http://localhost:3000';
const backend = process.env.PVC_BACKEND || 'http://127.0.0.1:8000';
const reuseIndex = process.argv.indexOf('--diagnosis-run');
const previous = reuseIndex >= 0 ? JSON.parse(await readFile(process.argv[reuseIndex + 1], 'utf8')) : null;
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const dir = `qa/misconception/place-value-chart/${runId}`;
await mkdir(dir, { recursive: true });
const save = (name, value) => writeFile(`${dir}/${name}`, JSON.stringify(value, null, 2));
async function moduleFrom(path) {
  async function urlFor(file) {
    let code = ts.transpileModule(await readFile(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    for (const match of [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)]) {
      if (!match[1].startsWith('.')) throw new Error(`Non-pure probe dependency: ${match[1]}`);
      const dependency = await urlFor(resolve(dirname(file), `${match[1]}.ts`));
      code = code.replace(match[0], `from '${dependency}'`);
    }
    return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  }
  return import(await urlFor(resolve(path)));
}
const { DIAGNOSIS_SCENARIOS } = await moduleFrom('src/components/lumina/evaluation/diagnosis/scenarios.ts');
const { compiledWorthContrast, placeValueRemediationMoveFor, selectPlaceValueContrast } = await moduleFrom('src/components/lumina/service/math/placeValueRemediation.ts');
const report = { schema: 'place-value-pilot-v1', synthetic: true, fixture: false, runId, time: new Date().toISOString(), status: 'BLOCKED', gates: {}, diagnoses: [], examples: [], blockers: [], links: ['report.md'] };
try {
  report.revision = execFileSync('git', ['-c', 'safe.directory=C:/Users/xbox3/claude web tutor', 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  report.dirtyFiles = execFileSync('git', ['-c', 'safe.directory=C:/Users/xbox3/claude web tutor', 'status', '--short', '--untracked-files=no'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n');
} catch { report.blockers.push('Revision inventory unavailable'); }
async function request(url, body) {
  const res = await fetch(url, { ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} at ${new URL(url).pathname}`);
  return res.json();
}
try {
  const curriculum = await request(`${backend}/api/curriculum/curriculum/Mathematics?grade=3`);
  const anchors = curriculum.curriculum.flatMap(u => u.skills.flatMap(s => s.subskills.filter(x => x.target_primitive === 'place-value-chart').map(x => ({ grade: u.grade, skillId: s.id, subskillId: x.id, text: x.description }))));
  await save('curriculum-anchors.json', anchors);
  report.anchors = anchors;
  report.gates.curriculum = anchors.some(x => /four.digit|4.digit/.test(x.text)) ? 'NOT RUN' : 'BLOCKED';
  if (report.gates.curriculum === 'BLOCKED') report.blockers.push('Published Grade 3 place-value objectives cover three-digit worth, rounding, or multiplying by ten; no resolved four-digit compare objective. G is an isolated engine probe, not production attribution.');
  for (const scenario of DIAGNOSIS_SCENARIOS.filter(s => s.id.startsWith('place-value-chart-'))) {
    for (let repeat = 0; repeat < (scenario.expectation === 'abstain' ? 3 : 1); repeat++) {
      console.log(`D ${scenario.id} ${repeat + 1}`);
      const saved = previous?.diagnoses?.find(d => d.scenario === scenario.id && d.repeat === repeat);
      if (previous && (!saved || previous.fixture || previous.schema !== 'place-value-pilot-v1')) throw new Error('Invalid real diagnosis run for replay');
      const output = saved ? saved.output : await request(`${frontend}/api/lumina`, { action: 'distillMisconception', params: scenario });
      if (output.abstain && /error|failed|unavailable|timeout|quota/i.test(output.reason || '')) throw new Error('D infrastructure abstention; not a pedagogical verdict');
      const pass = scenario.expectation === 'abstain' ? output.abstain === true : output.abstain === false && !!placeValueRemediationMoveFor('compare', 'medium', output.misconceptionText);
      report.diagnoses.push({ scenario: scenario.id, expectation: scenario.expectation, repeat, output, pass, ...(saved ? { sourceRunId: previous.runId } : {}) });
      await save(`D-${scenario.id}-${repeat}.json`, { input: scenario, output });
    }
  }
  report.gates.D = report.diagnoses.every(x => x.pass) ? 'PASS' : 'FAIL';
  const focus = report.diagnoses.find(x => x.expectation === 'generative' && x.pass)?.output.misconceptionText;
  if (!focus) throw new Error('No usable real D output: G cannot substitute authored diagnosis');
  const fixture = [2345, 6789, 7526].map((targetNumber, i) => ({ id: `pvc-${i}`, targetNumber, highlightedDigitPlace: 1 }));
  report.nonVacuity = { baseline: compiledWorthContrast(fixture).count, targeted: selectPlaceValueContrast(fixture, placeValueRemediationMoveFor('compare', 'medium', focus)).count };
  for (let draw = 0; draw < 4; draw++) {
    const targeted = draw > 0;
    const params = new URLSearchParams({ componentId: 'place-value-chart', evalMode: 'compare', gradeLevel: 'Grade 3', grade: '3', difficulty: 'medium', topic: 'Place value in four-digit whole numbers', ...(targeted ? { remediationFocus: focus } : {}) });
    console.log(`G ${targeted ? 'targeted' : 'baseline'} ${draw}`);
    const output = await request(`${frontend}/api/lumina/eval-test?${params}`);
    await save(`G-${draw}.json`, output);
    const data = output.fullData;
    if (!data?.challenges) throw new Error('G returned no fullData');
    const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const compiled = compiledWorthContrast(data.challenges);
    const saturated = targeted && compiled.count < 2 && compiled.items.filter(i => i.kind === 'say_value').length < 2;
    const invariants = {
      mode: data.challengeType === 'compare', tier: data.supportTier === 'medium', count: data.challenges.length === 3,
      unique: new Set(data.challenges.map(c => c.targetNumber)).size === data.challenges.length,
      legal: data.challenges.every(c => Number.isInteger(c.targetNumber) && c.targetNumber >= 1111 && c.targetNumber <= 9999 && [1, 2].includes(c.highlightedDigitPlace) && String(c.targetNumber).replace(/0/g, '').length >= 3),
      private: !JSON.stringify(data).includes(focus) && !/remediationFocus|misconceptionText/.test(JSON.stringify(data)),
      target: !targeted || compiled.count === 2 || saturated,
    };
    report.examples.push({ targeted, draw, hash, verdict: saturated ? 'SATURATED (not a targeted demonstration)' : targeted ? (compiled.count === 2 ? 'TARGETED' : 'FAIL') : 'BASELINE', invariants, challenges: data.challenges, items: compiled.items, targets: compiled.targets });
    await save(`payload-${draw}.json`, data);
    if (targeted) {
      const plan = await request(`${frontend}/api/lumina/tutor-test?componentId=place-value-chart&probe=1&live=1&di=1&gradeLevel=Grade%203`, { generatedData: data });
      await save(`plan-${draw}.json`, plan);
      invariants.samePayload = plan.probe?.contentHash === hash;
    }
  }
  report.gates.G = !report.examples.every(e => Object.values(e.invariants).every(Boolean)) || report.nonVacuity.baseline >= 2 || report.nonVacuity.targeted !== 2 ? 'FAIL'
    : report.examples.filter(e => e.verdict === 'TARGETED').length >= 2 ? 'PASS' : 'BLOCKED';
} catch (error) {
  report.blockers.push(error.message);
}
const python = process.env.PVC_PYTHON || 'C:/Users/xbox3/miniforge-pypy3/envs/py311env/python.exe';
try {
  const output = execFileSync(python, ['-m', 'pytest', 'tests/test_misconception_round_trip.py', 'tests/test_misconception_generation_context.py', 'tests/test_place_value_misconception.py', '-q', '--disable-warnings', '-p', 'no:cacheprovider'], { cwd: '../backend', encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  await writeFile(`${dir}/R-pytest.txt`, output);
  report.gates.R = 'PASS';
  report.stateTransitions = 'In-memory: seeded diagnosis → matching generation identity → weak / wrong primitive / wrong skill stay active → matched score 90 resolves after fan-out → active read empty. This is not browser capture or durable mastery.';
} catch (error) { report.gates.R = 'FAIL'; await writeFile(`${dir}/R-pytest.txt`, String(error.stdout || '') + String(error.stderr || '')); }
if (process.argv.includes('--store')) {
  try {
    const output = execFileSync(python, ['-W', 'ignore', '../my-tutoring-app/scripts/probe-place-value-exposure.py'], { cwd: '../backend', encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    await writeFile(`${dir}/S4-exposure.json`, output);
    report.gates.S4 = JSON.parse(output.trim()).status;
  } catch { report.gates.S4 = 'BLOCKED'; report.blockers.push('Real-store exposure probe failed; inspect local service credentials.'); }
}
report.gates.Live = 'NOT RUN';
if (process.argv.includes('--live')) {
  const example = report.examples.find(e => e.verdict === 'TARGETED');
  if (example) {
    const independent = example.targets[1].id;
    report.gates.Live = 'PASS';
    for (const [name, flags] of [['plain', ['--di-wrong', 'plain']], ['signature', ['--di-wrong', 'signature']], ['cap', ['--di-wrong', 'signature', '--di-cap']], ['independent', ['--di-wrong', 'signature', '--di-independent-item', independent]]]) {
      console.log(`Live ${name}`);
      try {
        const output = execFileSync(python, ['-u', 'tests/tutor_live/run_tutor_live.py', '--component', 'place-value-chart', '--di', '--grade', 'Grade 3', '--eval-mode', 'compare', '--di-input', resolve(`${dir}/payload-${example.draw}.json`), '--runs', '1', ...flags], { cwd: '../backend', encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        await writeFile(`${dir}/Live-${name}.txt`, output);
        if (!output.includes(example.hash) || /CONFIRMED HIGH/.test(output)) report.gates.Live = 'FAIL';
      } catch (error) {
        report.gates.Live = 'BLOCKED';
        await writeFile(`${dir}/Live-${name}.txt`, String(error.stdout || '') + String(error.stderr || ''));
      }
    }
  } else report.gates.Live = 'BLOCKED';
}
report.gates.S1 = 'BLOCKED';
report.blockers.push('Browser capture, generation-context lesson, matched browser submission and real-store resolution remain unverified. In-memory R is separate evidence.');
report.status = Object.values(report.gates).includes('FAIL') ? 'FAIL' : 'BLOCKED';
await save('run.json', report);
await writeFile(`${dir}/report.md`, `# Place-value pilot ${runId}\n\nSynthetic real-engine probe. Overall: ${report.status}.\n\n${Object.entries(report.gates).map(([g,v]) => `- ${g}: ${v}`).join('\n')}\n\n${report.blockers.join('\n\n')}\n\nD diagnoses, payloads, compiler items and SHA-256 hashes are in run.json and adjacent artifacts. A matched score at least 80 resolves under the current product rule; it is not proof of durable mastery.\n`);
console.log(`${dir}/run.json`);
process.exitCode = report.status === 'FAIL' ? 1 : 0;
