import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { candidateRecall } from './lib/lesson-planner-discovery.mjs';

const cases = [
  ['ordinal-name', 'Recognize and name ordinal positions (first through fifth) in a simple line or sequence', ['Recognizes positions first through fifth from an explicitly identified starting end.', 'Produces the ordinal position word; naming the object occupying that position is only partial evidence.']],
  ['ordinal-symbol', 'Match ordinal number words (first through fifth) with their corresponding symbols (1st-5th)', ['Connects each ordinal word first through fifth to its corresponding printed symbol 1st-5th.', 'Distinguishes ordinal words/symbols from cardinal quantities; explain whether matching or oral symbol reading is assessed.']],
  ['ordinal-routine', 'Apply ordinal numbers (first through fifth) to daily routines and story sequences', ['Uses ordinal positions first through fifth to describe steps in a daily routine.', 'Uses ordinal language to locate events in a story sequence; distinguish event order from positions of characters in a line.']],
  ['ordinal-tenth', 'Extend ordinal number understanding to tenth position (sixth through tenth)', ['Recognizes positions sixth through tenth in a line with an explicit starting end.', 'Names ordinal positions sixth through tenth; first-through-fifth work alone is not sufficient.']],
  ['ordinal-relative', 'Compare and analyze relative positions using ordinal numbers (e.g., "What comes before fourth?")', ['Determines the position immediately before or after a specified ordinal position.', 'Expresses the resulting ordinal position, such as third before fourth; naming a character is only partial evidence.']],
  ['ordinal-create', 'Create and complete sequences using ordinal numbers (first through tenth)', ['Constructs a sequence from ordinal position clues spanning first through tenth.', 'Completes missing ordinal positions in a sequence; distinguish physical arrangement from verbal recognition.']],
  ['ordinal-problems', 'Solve simple word problems involving ordinal numbers in real-world contexts', ['Interprets a spoken real-world problem about order, with a clear starting end.', 'Determines and communicates the requested ordinal position using the story information.']],
  ['teen-identify', 'Identify a group of ten ones within numbers 11-19 using objects or drawings', ['Identifies exactly ten individual ones within a collection or drawing of 11-19.', 'Distinguishes the ten ones from the remaining ones; counting the total alone is insufficient.']],
  ['teen-represent-11-15', 'Represent numbers 11-15 as ten ones plus additional ones using manipulatives', ['Builds a target in 11-15 with ten ones and 1-5 additional ones.', 'Makes the ten-ones group and extra ones distinguishable through learner manipulation.']],
  ['teen-represent-16-19', 'Represent numbers 16-19 as ten ones plus additional ones using manipulatives', ['Builds a target in 16-19 with ten ones and 6-9 additional ones.', 'Makes the ten-ones group and extra ones distinguishable through learner manipulation.']],
  ['teen-decompose-11-15', 'Break apart numbers 11-15 into ten ones and some further ones using visual models', ['Partitions a shown whole in 11-15 into exactly ten ones and the remaining 1-5 ones.', 'Relates both parts to the original whole; arbitrary splits or merely building the whole supply partial evidence.']],
  ['teen-decompose-16-19', 'Break apart numbers 16-19 into ten ones and some further ones using visual models', ['Partitions a shown whole in 16-19 into exactly ten ones and the remaining 6-9 ones.', 'Relates both parts to the original whole; arbitrary splits or merely building the whole supply partial evidence.']],
  ['teen-equations', 'Compose and decompose numbers 11-19 using equations (e.g., 14 = 10 + 4)', ['Expresses a teen whole as an equation with 10 plus the remaining ones.', 'Composes the whole from 10 and extra ones and decomposes the whole into those parts, staying within 11-19.']],
];
const root = 'qa/lesson-planner/curriculum-ab';
const base = JSON.parse(readFileSync('qa/lesson-planner/fixtures/open-excavators.json', 'utf8'));
mkdirSync(`${root}/fixtures`, { recursive: true });
for (const [index, [id, text, criteria]] of cases.entries()) {
  const evidenceDefinitions = Object.fromEntries(criteria.map((criterion, i) => [`${id}-e${i+1}`, criterion]));
  const fixture = { ...base, entryPoint: 'curriculum', caseId: id,
    topic: index < 7 ? 'Understand ordinal numbers' : 'Compose and Decompose Numbers 11–19',
    objective: { id, text }, targetEvidence: Object.keys(evidenceDefinitions), evidenceDefinitions,
    scopePolicy: 'Preserve the supplied curriculum objective and number/position ranges. Keep kindergarten; report catalog conflicts rather than silently raising grade or weakening the objective.',
    assumptions: 'User confirmed kindergarten to expose curriculum/catalog gaps. Non-reader and 15-minute session remain pilot assumptions. Objective text is user supplied; IDs and evidence criteria are tester-authored. No external curriculum IDs were looked up.' };
  const path = `${root}/fixtures/${id}.json`;
  writeFileSync(path, JSON.stringify(fixture, null, 2) + '\n');
  if (process.argv.includes('--run')) for (const discovery of ['lexical', 'semantic']) {
    const out = `${root}/${id}/${discovery}`;
    mkdirSync(out, { recursive: true });
    if (readdirSync(out).some(f => f.endsWith('.json'))) continue;
    console.log(`Running ${id}: ${discovery}`);
    const result = spawnSync(process.execPath, ['scripts/lesson-planner-pilot.mjs', '--pipeline', 'objective', '--representation', 'mode-cards', '--catalog', 'all', '--fixture', path, '--discovery', discovery, '--out', out], { stdio: 'inherit' });
    if (result.error) throw result.error;
  }
}
const rows = [];
for (const [id, text] of cases) for (const discovery of ['lexical', 'semantic']) {
  const out = `${root}/${id}/${discovery}`;
  let files; try { files = readdirSync(out).filter(f => f.endsWith('.json')).sort(); } catch { continue; }
  if (!files.length) continue;
  const artifact = `${out}/${files.at(-1)}`;
  const r = JSON.parse(readFileSync(artifact, 'utf8'));
  const n = r.stages?.find(s => s.name === 'objectiveNeighborhood')?.output;
  // Discovery relevance only: grade-incompatible candidates must be considered and constrained, not forced into lessons.
  const expected = id.startsWith('ordinal') ? ['ordinal-line'] : id === 'teen-equations' ? ['base-ten-blocks', 'number-bond'] : ['base-ten-blocks', 'ten-frame'];
  rows.push({ id, text, discovery, artifact, status: r.status, error: r.error, model: r.modelVersion,
    candidateHash: r.provenance?.candidateHash, fixtureHash: r.provenance?.fixtureHash,
    recall: n ? candidateRecall(n, expected) : null, poolSize: n?.candidates.length,
    planningMs: r.latencyMs, onlineMs: r.onlineLatencyMs, queryMs: r.semantic?.queryLatencyMs ?? 0,
    selected: r.plan?.experiences.map(e => `${e.componentId}${e.mode ? '/' + e.mode : ''}`),
    experiences: r.plan?.experiences, gaps: r.plan?.unmetRequirements,
    contributions: r.plan?.contributionDecisions, rejected: r.plan?.rejectedCandidates, validation: r.validation });
}
for (const [id] of cases) {
  const pair = rows.filter(r => r.id === id && r.model);
  if (pair.length === 2 && (pair[0].candidateHash !== pair[1].candidateHash || pair[0].fixtureHash !== pair[1].fixtureHash || pair[0].model !== pair[1].model)) throw new Error(`Incomparable A/B pair: ${id}`);
}
const median = values => { const s = values.filter(Number.isFinite).sort((a,b) => a-b); return s.length ? (s[Math.floor((s.length-1)/2)] + s[Math.ceil((s.length-1)/2)]) / 2 : null; };
const metrics = Object.fromEntries(['lexical', 'semantic'].map(arm => {
  const selected = rows.filter(r => r.discovery === arm);
  return [arm, { runs: selected.length, structurallyValid: selected.filter(r => r.validation?.valid).length,
    recalled: selected.reduce((s,r) => s + (r.recall?.hits.length ?? 0), 0), expected: selected.reduce((s,r) => s + (r.recall?.expected.length ?? 0), 0),
    medianOnlineMs: median(selected.map(r => r.onlineMs)), medianQueryMs: median(selected.map(r => r.queryMs)),
    withDeclaredGaps: selected.filter(r => r.gaps?.length).length, overBudget: selected.filter(r => r.validation?.studentMinutes > 15).length }];
}));
writeFileSync(`${root}/summary.json`, JSON.stringify(rows, null, 2) + '\n');
writeFileSync(`${root}/metrics.json`, JSON.stringify(metrics, null, 2) + '\n');
writeFileSync(`${root}/RESULTS.md`, `# Curriculum discovery A/B\n\n13 exact user-supplied objectives. Kindergarten/non-reader, 15 minutes, user-confirmed grade. One generation call per fixed objective; no open-topic arc generation. One sample per arm; candidate recall is consideration, not grade compatibility or full evidence coverage. Structural pass is not a pedagogical pass.\n\n| Objective | Discovery | Recall | Online ms | Minutes | Status | Selected |\n|---|---|---|---|---|---|---|\n${rows.map(r => `| [${r.id}](${r.artifact.slice(root.length+1).replace(/json$/, 'md')}) | ${r.discovery} | ${r.recall?.hits.length}/${r.recall?.expected.length} | ${r.onlineMs} | ${r.validation?.studentMinutes} | ${r.status} | ${r.selected?.join(', ')} |`).join('\n')}\n`);
console.log(JSON.stringify(metrics, null, 2));
