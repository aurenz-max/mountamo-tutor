// Real planner + generator calls; fictional/saved synthetic observations, no account or learning writes.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const dir = '../artifacts/learning-applicability';
await mkdir(dir, { recursive: true });
const saved = JSON.parse(await readFile('qa/misconception/place-value-opportunities/pvc-http-qa-d562ee3ca0d94c5d8856f08a6ce90e1e/bridge-diagnosis.json', 'utf8'));
const cases = [
  ['baseline', '', null],
  ['distilled', saved.misconceptionText, 'worth'],
  ['paraphrase-a', 'The learner treats a written numeral as having a fixed contribution even when it is relocated to another column.', 'worth'],
  ['paraphrase-b', 'Moving a symbol one column to the left does not change the amount the learner says it represents; they report the same quantity in both locations.', 'worth'],
  ['unrelated', 'The learner reverses the numerator and denominator when comparing fractions.', null],
  ['uncertain', 'The audio evidence is unreliable and contradictory; no pattern about positional quantities can be inferred.', null],
  ['place-name', 'Asked which position a highlighted symbol occupies, the learner reports the amount it contributes instead of the name of that position.', 'naming'],
];
const report = { fictional: true, learningWrites: false, cases: [] };
const save = () => writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
for (const [primitive, mode] of [['place-value-chart', 'compare'], ['base-ten-blocks', 'read_blocks']]) {
  for (const [name, focus, category] of cases) {
    for (let draw = 0; draw < 4; draw++) {
    const query = new URLSearchParams({ componentId: primitive, evalMode: mode, gradeLevel: '4', grade: '4',
      difficulty: 'medium', topic: 'Place value in four-digit whole numbers', remediationFocus: focus });
    const response = await fetch(`http://127.0.0.1:3000/api/lumina/eval-test?${query}`, { signal: AbortSignal.timeout(120000) });
    const payload = await response.json();
    await writeFile(`${dir}/${primitive}-${name}-${draw}.json`, JSON.stringify(payload, null, 2));
    const d = payload.fullData;
    const expected = category === 'worth' ? (primitive === 'place-value-chart' ? 'contrast_digit_worth' : 'contrast_block_count_and_worth')
      : category === 'naming' && primitive === 'place-value-chart' ? 'contrast_place_name_and_value' : null;
    const pass = response.ok && payload.status === 'pass' && d?.supportTier === 'medium'
      && (expected ? d.learningAdaptation?.move === expected && d.learningAdaptation.comparisonCount === 2 : !d.learningAdaptation)
      && d.challenges.every(c => Number.isInteger(c.targetNumber) && c.targetNumber >= 1000 && c.targetNumber <= 9999)
      && (!focus || !JSON.stringify(d).includes(focus));
    report.cases.push({ primitive, name, draw, focus, expected, adaptation: d?.learningAdaptation, pass });
    await save();
    console.log(JSON.stringify(report.cases.at(-1)));
    if (!pass && d?.learningAdaptation?.move === expected && d.learningAdaptation.status === 'insufficient-capacity' && draw < 3) continue;
    if (!pass) throw new Error(`${primitive}/${name} failed; raw response preserved`);
    break;
    }
  }
  console.log(`${primitive}: gate passed before proceeding`);
}
report.pass = true;
await save();
