import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { candidateRecall } from './lib/lesson-planner-discovery.mjs';
import { topicNeighborhood } from './lib/lesson-planner-topic.mjs';

// Frozen before the run. These are candidates to CONSIDER, never forced selections.
const cases = [
  ['excavators', 'Excavators and dump trucks', ['machine-profile', 'hydraulics-lab', 'excavator-arm-simulator', 'dump-truck-loader']],
  ['sea-otters', 'Sea otters', ['species-profile', 'organism-card', 'habitat-diorama']],
  ['volcanoes', 'Volcanoes', ['how-it-works']],
  ['solar-system', 'The solar system', ['solar-system-explorer', 'planetary-explorer']],
  ['phonics-sitpin', 'Phonics with s, i, t, p, n: common letter sounds and short-i words made only from those letters', ['letter-sound-link', 'phoneme-explorer']],
  ['counting', 'Counting objects from 1 to 10', ['counting-board']],
  ['butterflies', 'Butterflies and how they grow', ['species-profile', 'life-cycle-sequencer']],
  ['bicycles', 'How bicycles work', ['machine-profile']],
  ['penguins', 'Emperor penguins', ['species-profile', 'habitat-diorama']],
];
const root = 'qa/lesson-planner/discovery-ab';
mkdirSync(`${root}/fixtures`, { recursive: true });
const base = JSON.parse(readFileSync('qa/lesson-planner/fixtures/open-excavators.json', 'utf8'));
for (const [id, topic, expected] of cases) {
  const path = `${root}/fixtures/${id}.json`;
  writeFileSync(path, JSON.stringify({ ...base, caseId: `discovery-${id}`, topic,
    scopePolicy: 'Choose a coherent first lesson within the budget; explicitly defer related learning questions when they need another session. Do not compress every possible subtopic into this session.',
    assumptions: 'K/non-reader, 15 minutes. No prewritten objectives or preferred primitive IDs.' }, null, 2) + '\n');
  if (process.argv.includes('--run')) for (const discovery of ['lexical', 'semantic']) {
    const out = `${root}/${id}/${discovery}`;
    mkdirSync(out, { recursive: true });
    if (readdirSync(out).some(f => f.endsWith('.json'))) continue;
    console.log(`Running ${id}: ${discovery}`);
    const result = spawnSync(process.execPath, ['scripts/lesson-planner-pilot.mjs', '--pipeline', 'topic', '--catalog', 'all', '--fixture', path, '--discovery', discovery, '--out', out], { stdio: 'inherit' });
    if (result.error) throw result.error;
  }
}
const rows = [];
for (const [id, topic, expected] of cases) for (const discovery of ['lexical', 'semantic']) {
  const out = `${root}/${id}/${discovery}`;
  let files; try { files = readdirSync(out).filter(f => f.endsWith('.json')).sort(); } catch { continue; }
  if (!files.length) continue;
  const artifact = `${out}/${files.at(-1)}`;
  const r = JSON.parse(readFileSync(artifact, 'utf8'));
  const n = r.stages.find(s => s.name === 'topicNeighborhood')?.output;
  rows.push({ id, topic, discovery, artifact, status: r.status, model: r.modelVersion, candidateHash: r.provenance?.candidateHash,
    fixtureHash: r.provenance?.fixtureHash, recall: n ? candidateRecall(n, expected) : null,
    shortlistSensitivity: r.semantic ? [5, 10, 15, 20].map(limit => {
      const pool = topicNeighborhood(r.input, limit, r.semantic);
      return { limit, poolSize: pool.candidates.length, ...candidateRecall(pool, expected) };
    }) : undefined,
    poolSize: n?.candidates.length, topical: n?.topical.map(c => c.componentId),
    planningMs: r.latencyMs, queryMs: r.semantic?.queryLatencyMs ?? 0, onlineMs: r.onlineLatencyMs ?? r.latencyMs,
    indexMs: r.semantic?.indexLatencyMs ?? 0, cacheHit: r.semantic?.cacheHit,
    selected: r.plan?.experiences.map(e => `${e.componentId}${e.mode ? '/' + e.mode : ''}`),
    objectives: r.learningArc?.objectives, validation: r.validation, gaps: r.plan?.unmetRequirements });
}
writeFileSync(`${root}/summary.json`, JSON.stringify(rows, null, 2) + '\n');
for (const [id] of cases) {
  const pair = rows.filter(r => r.id === id && r.candidateHash);
  if (pair.length === 2 && (pair[0].candidateHash !== pair[1].candidateHash || pair[0].fixtureHash !== pair[1].fixtureHash || pair[0].model !== pair[1].model)) throw new Error(`Incomparable A/B inputs/model for ${id}`);
}
const median = values => { const sorted = values.filter(Number.isFinite).sort((a,b) => a-b); return sorted.length ? (sorted[Math.floor((sorted.length-1)/2)] + sorted[Math.ceil((sorted.length-1)/2)]) / 2 : null; };
const metrics = Object.fromEntries(['lexical', 'semantic'].map(arm => {
  const selected = rows.filter(r => r.discovery === arm);
  return [arm, { runs: selected.length, structurallyValid: selected.filter(r => r.status === 'generated').length,
    recalled: selected.reduce((sum,r) => sum + (r.recall?.hits.length ?? 0), 0), expected: selected.reduce((sum,r) => sum + (r.recall?.expected.length ?? 0), 0),
    medianPlanningMs: median(selected.map(r => r.planningMs)), medianOnlineMs: median(selected.map(r => r.onlineMs)), medianQueryMs: median(selected.map(r => r.queryMs)) }];
}));
writeFileSync(`${root}/metrics.json`, JSON.stringify(metrics, null, 2) + '\n');
writeFileSync(`${root}/RESULTS.md`, `# Discovery A/B\n\nOne run per arm/topic; exploratory, not a statistical quality result. Expected candidates measure consideration, not required selection. Volcanoes only has a general-purpose expectation and cannot demonstrate specialist recall improvement. Last three topics are held-out probes. Identical downstream prompts/settings, different candidate pools. Index construction is offline; online latency includes uncached query embedding.\n\n| Topic | Discovery | Recall | Pool | Online ms | Status | Selected |\n|---|---|---|---|---|---|---|\n${rows.map(r => `| ${r.id} | ${r.discovery} | ${r.recall?.hits.length}/${r.recall?.expected.length} | ${r.poolSize} | ${r.onlineMs} | ${r.status} | ${r.selected?.join(', ')} |`).join('\n')}\n`);
console.log(`Wrote ${rows.length} result rows to ${root}`);
