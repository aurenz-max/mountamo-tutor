// Real planner + real bar-model generator through /api/lumina/eval-test (the registry path).
// Fictional observations only: no account, no store, no learning or calibration writes.
// Expected outcomes are fixed below before any draw. Every draw is saved; nothing retries a semantic miss.
import { mkdir, writeFile } from 'node:fs/promises';

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = `qa/misconception/bar-model/${stamp}`;
await mkdir(dir, { recursive: true });

const T = 'targeted', A = 'abstain';
const cases = [
  // [name, observation, expected, draws]
  ['baseline', '', A, 1],
  ['distilled', 'The student reads each icon in a picture graph as a single item, reporting the number of icons in a row as its total instead of applying the key value per icon.', T, 1],
  ['paraphrase-says-three', 'Says three when three pictures are shown next to a key where each picture means five.', T, 2],
  ['paraphrase-legend', 'Answers with how many symbols they counted and ignores the legend that says what one symbol is worth.', T, 1],
  ['unrelated-more-fewer', 'Mixes up the words more and fewer when comparing two groups.', A, 1],
  ['nearby-axis-step', 'Reads a bar graph by counting grid lines to the top of the bar, ignoring that the axis counts by twos.', A, 3],
  ['contradictory', 'Evidence is contradictory: the learner applied the picture key correctly on most graphs and the one wrong choice was a tap next to the answer; no pattern about icon values can be inferred.', A, 2],
  ['cross-digit-worth', 'The student gives the bare digit for its worth regardless of position.', A, 3],
];

// Independent JS oracle (does not import the TypeScript selector).
function inspect(d) {
  const items = (d?.challenges ?? []).map((c, index) => {
    const iv = c.scale?.iconValue, row = c.values?.[c.targetBarIndex];
    const ok = c.evalMode === 'picture_graph' && c.graphStyle === 'picture' && iv === 5 && row && row.value === c.expectedValue
      && row.value > 0 && row.value % iv === 0 && row.value <= 8 * iv && c.options?.includes(row.value)
      && c.options.length === 4 && new Set(c.options).size === 4 && c.values.length === 4
      && c.values.every(v => v.value > 0 && v.value % iv === 0 && v.value <= 8 * iv) && c.supportTier === 'medium';
    return { index, ok, iv, count: row ? row.value / iv : null, expected: c.expectedValue,
      bareCountOffered: !!row && c.options?.includes(row.value / iv) };
  });
  const pair = items.flatMap(a => items.filter(b => a.index !== b.index && a.ok && b.ok && a.count === b.expected
    && a.expected !== b.expected).map(b => [a.index, b.index]))[0] ?? null;
  return { items, pair, allValid: items.length === 4 && items.every(i => i.ok), allOfferBareCount: items.every(i => i.bareCountOffered) };
}

const report = { fictional: true, learningWrites: false, startedAt: stamp, cases: [] };
const save = () => writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
for (const [name, focus, expected, draws] of cases) {
  for (let draw = 0; draw < draws; draw++) {
    const query = new URLSearchParams({ componentId: 'bar-model', evalMode: 'picture_graph', gradeLevel: 'elementary', grade: '3',
      difficulty: 'medium', topic: 'Picture graphs of favorite fruits in our class', ...(focus ? { remediationFocus: focus } : {}) });
    let payload, status;
    try {
      const response = await fetch(`http://127.0.0.1:3000/api/lumina/eval-test?${query}`, { signal: AbortSignal.timeout(180000) });
      status = response.status;
      payload = await response.json();
    } catch (error) { payload = { error: String(error) }; }
    await writeFile(`${dir}/${name}-${draw}.json`, JSON.stringify(payload, null, 2));
    const d = payload?.fullData;
    const adaptation = d?.learningAdaptation ?? null;
    const shape = inspect(d);
    const leak = !!focus && JSON.stringify(d ?? {}).includes(focus);
    const outcome = !d ? 'generation-failed'
      : !adaptation ? 'abstain-or-no-call'
      : adaptation.comparisonCount === 2 && shape.pair ? (adaptation.status === 'already-targeted' ? 'already-targeted' : 'targeted')
      : adaptation.status === 'insufficient-capacity' ? 'insufficient-capacity' : 'execution-drift';
    const matches = expected === T ? ['targeted', 'already-targeted'].includes(outcome) : outcome === 'abstain-or-no-call';
    const pass = status === 200 && payload.status === 'pass' && shape.allValid && shape.allOfferBareCount && !leak && matches;
    report.cases.push({ name, draw, expected, outcome, adaptation, pair: shape.pair,
      expectedValues: shape.items.map(i => i.expected), iconCounts: shape.items.map(i => i.count),
      allValid: shape.allValid, allOfferBareCount: shape.allOfferBareCount, leak, pass });
    await save();
    console.log(JSON.stringify(report.cases.at(-1)));
  }
}
report.pass = report.cases.every(c => c.pass);
await save();
console.log(`report: ${dir}/report.json  pass=${report.pass}`);
