import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const base = JSON.parse(readFileSync('qa/lesson-planner/fixtures/open-excavators.json', 'utf8'));
const topics = [
  ['sea-otters', 'Sea otters'],
  ['volcanoes', 'Volcanoes'],
  ['solar-system', 'The solar system'],
  ['phonics-sitpin', 'Phonics with s, i, t, p, n: common letter sounds and short-i words made only from those letters'],
  ['counting-1-to-10', 'Counting objects from 1 to 10'],
];
mkdirSync('qa/lesson-planner/fixtures/open-topics', { recursive: true });
for (const [id, topic] of topics) {
  const path = `qa/lesson-planner/fixtures/open-topics/${id}.json`;
  writeFileSync(path, JSON.stringify({ ...base, caseId: `open-${id}`, topic,
    scopePolicy: 'Choose a coherent first lesson within the budget; explicitly defer related learning questions when they need another session. Do not compress every possible subtopic into this session.',
    assumptions: 'Open-topic generalization pilot. K/non-reader, 15 minutes; no prewritten learning objectives or preferred primitive IDs. Sitpin means s,i,t,p,n (not SATPIN); counting stays 1-10.' }, null, 2) + '\n');
  if (process.argv.includes('--run')) {
    const r = spawnSync(process.execPath, ['scripts/lesson-planner-pilot.mjs', '--pipeline', 'topic', '--fixture', path, '--catalog', 'all', '--out', 'qa/lesson-planner/open-topic-sweep'], { stdio: 'inherit' });
    if (r.error) throw r.error;
    if (r.status !== 0) console.log(`Preserved failed/invalid run: ${id}`);
  }
}
