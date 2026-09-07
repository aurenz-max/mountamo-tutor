import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const cases = [
  ['excavators-and-dump-trucks', 'Explain and demonstrate how an excavator digs and loads material and a dump truck carries and unloads it, arranging their actions into a simple job sequence.', {
    roles: 'Distinguish excavator digging/loading from dump truck carrying/unloading.',
    sequence: 'Arrange dig, load, carry and unload into a sensible sequence.',
    application: 'Choose the appropriate machine for a new job and explain or demonstrate its action.'
  }],
  ['sea-otters', 'Identify sea otters and describe how their fur, paws and behaviors help them live, eat and stay warm in the ocean.', {
    identify: 'Recognize a sea otter using visible characteristics.',
    function: 'Connect fur or paws to warmth, swimming or finding/handling food.',
    describe: 'Describe a sea otter behavior and what it helps the animal do; recognition alone is partial.'
  }],
  ['volcanoes', 'Describe a volcano as an opening where material from inside Earth can reach the surface, distinguish magma underground from lava at the surface, and sequence a simple eruption model.', {
    parts: 'Identify the opening and underground/surface locations in a simple model.',
    vocabulary: 'Distinguish magma underground from lava at the surface.',
    sequence: 'Sequence material moving from inside Earth through the opening to the surface without claiming all eruptions are alike.'
  }],
  ['solar-system', 'Identify the Sun as a star and Earth as a planet, recognize that planets orbit the Sun, and distinguish the Sun, Earth and Moon in a simple solar-system model.', {
    identities: 'Distinguish the Sun, Earth and Moon and identify Sun as star and Earth as planet.',
    orbit: 'Describe or demonstrate Earth going around the Sun, and Moon around Earth.',
    transfer: 'Interpret a fresh model without depending on exact picture positions or implying schematic sizes/distances are to scale.'
  }],
  ['phonics-sitpin', 'Recognize and produce the common sounds of s, i, t, p and n, then blend and read simple short-i words made only from those letters, such as sit, pin, tin, tip, pit, sip and nip.', {
    sounds: 'Produce /s/, short /i/, /t/, /p/, /n/ from displayed letters; identifying letter names alone is insufficient.',
    blend: 'Blend sounds into short-i words composed only of s, i, t, p, n.',
    read: 'Read fresh in-set words aloud before a model answer; listening and selecting a picture is partial evidence.'
  }],
  ['counting-1-to-10', 'Count sets of one to ten objects with one number word per object, state how many there are using the last number counted, and match each set to its numeral from 1 to 10.', {
    correspondence: 'Count each object once with one number word per object; reciting a sequence alone is insufficient.',
    cardinality: 'State how many objects are in the set after counting.',
    numeral: 'Match sets to numerals 1 through 10 across fresh arrangements, with no values above 10.'
  }],
];
const contributions = {
  meaningful_context: 'Give a concrete age-appropriate reason to learn this topic and orient the child.',
  explanation_and_modeling: 'Explain or demonstrate the core idea or procedure before dependent practice, with accessible visual/spoken support.',
  supported_investigation: 'Let the child actively explore, notice, test or try the target idea with support, using a form appropriate to the topic; physical manipulation is not mandatory for informational topics.',
  comparison_and_description_practice: 'Provide varied supported practice of the objective performance. This identifier is shared with the pilot, but comparison is required only when the objective calls for it.',
  application_to_fresh_examples: 'Use the learned idea in a fresh example or meaningful decision; for phonics decode fresh in-set words, and for counting use new arrangements.',
  closing_independent_assessment: 'Close with fresh opportunities to demonstrate the objective before hints or model answers, followed by a sense of completion. Record evidence limits.'
};
mkdirSync('qa/lesson-planner/fixtures/topics', { recursive: true });
const paths = cases.map(([id, text, evidenceDefinitions]) => {
  const path = `qa/lesson-planner/fixtures/topics/${id}.json`;
  writeFileSync(path, JSON.stringify({ version: 1, caseId: id, objective: { id, text }, learner: { grade: 'K', independentReading: false }, lessonBudgetMinutes: 15,
    assumptions: 'Exploratory topic-to-objective fixture authored for this experiment, not retrieved curriculum. Phonics sitpin interpreted as s,i,t,p,n (not SATPIN). One objective per topic; no multi-objective composition.',
    requiredContributions: Object.keys(contributions), contributionDefinitions: contributions, targetEvidence: Object.keys(evidenceDefinitions), evidenceDefinitions,
    candidateGroups: [], candidateIds: [], capabilityNotes: [], candidateSource: 'Use --catalog all; identical live catalog universe for both arms.' }, null, 2) + '\n');
  return path;
});
if (process.argv.includes('--run')) {
  for (let i = 0; i < paths.length; i++) {
    for (const pipeline of i % 2 ? ['staged', 'single'] : ['single', 'staged']) {
      const result = spawnSync(process.execPath, ['scripts/lesson-planner-pilot.mjs', '--fixture', paths[i], '--pipeline', pipeline, '--representation', 'mode-cards', '--catalog', 'all', '--out', 'qa/lesson-planner/topic-sweep'], { stdio: 'inherit' });
      if (result.error) throw result.error;
      // Preserve failures and continue the planned slice; do not cherry-pick retries.
      if (result.status !== 0) console.log(`Run failed/invalid: ${paths[i]} ${pipeline}`);
    }
  }
} else console.log(`Wrote ${paths.length} fixtures. Add --run for one single/staged pair per topic.`);
