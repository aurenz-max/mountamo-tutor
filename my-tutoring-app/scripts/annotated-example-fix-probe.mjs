import { mkdirSync, writeFileSync } from 'node:fs';
const round = process.argv.find(arg => arg.startsWith('--round='))?.split('=')[1] || 'initial';
if (!/^[a-z0-9-]+$/.test(round)) throw new Error('Invalid round name');
const out = `qa/annotated-example-presentation/fixes/${round}`;
mkdirSync(out, { recursive: true });
// Declared before running; retain every response, including errors.
const matrix = [
  [2, 'Add 24 and 13 without regrouping'],
  [3, 'Find the total in 3 groups of 4 apples'],
  [4, 'Find an equivalent fraction for 1/2 with denominator 8'],
  [5, 'Add 0.4 and 0.3'],
  [2, 'Subtract 12 from 45 without regrouping'],
  [3, 'Find the total in 4 groups of 3 buttons'],
  [4, 'Find an equivalent fraction for 2/3 with denominator 9'],
  [5, 'Add 0.6 and 0.2'],
  [7, 'Solve 2x + 3 = 11', 'Use this exact worked example: Solve 2x + 3 = 11.'],
  [12, 'Find the area between y=x^2 and y=x from x=0 to x=1', 'Use this exact worked example: Find the area between y=x^2 and y=x from x=0 to x=1.'],
];
writeFileSync(`${out}/matrix.json`, JSON.stringify(matrix, null, 2));
const results = [];
let next = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < matrix.length) {
    const index = next++;
    const [grade, topic, intent] = matrix[index];
    const query = new URLSearchParams({ componentId: 'annotated-example', evalMode: 'auto', difficulty: 'easy', grade: String(grade), gradeLevel: `grade ${grade}`, topic });
    if (intent) query.set('intent', intent);
    const started = Date.now();
    try {
      const response = await fetch(`http://localhost:3000/api/lumina/eval-test?${query}`, { signal: AbortSignal.timeout(300000) });
      const data = await response.json();
      const record = { index, grade, topic, intent, httpStatus: response.status, elapsed: Date.now() - started, data };
      writeFileSync(`${out}/runtime-${index}.json`, JSON.stringify(record, null, 2));
      const summary = { index, grade, status: response.status, steps: data.fullData?.steps?.length ?? 0, types: data.fullData?.steps?.map(s => s.content.type), challenges: data.fullData?.solverDebug?.challenger?.assignments?.length ?? 0, dropped: data.fullData?.solverDebug?.challenger?.dropped?.length ?? 0 };
      results.push(summary);
      console.log(JSON.stringify(summary));
    } catch (error) {
      const record = { index, grade, topic, error: String(error), elapsed: Date.now() - started };
      writeFileSync(`${out}/runtime-${index}.json`, JSON.stringify(record, null, 2));
      results.push(record); console.log(JSON.stringify(record));
    }
  }
}));
writeFileSync(`${out}/runtime-summary.json`, JSON.stringify(results.sort((a, b) => a.index - b.index), null, 2));
