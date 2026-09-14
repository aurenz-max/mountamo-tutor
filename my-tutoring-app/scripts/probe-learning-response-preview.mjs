// Real Next/LLM boundary; fictional evidence only, no submission or store writes.
import { mkdir, writeFile } from 'node:fs/promises';
const url = process.env.LUMINA_QA_URL || 'http://127.0.0.1:3000';
const rows = [
  ['a', 'Say the value of 2 in 2258, highlighted in the hundreds place', 'two hundred'],
  ['b', 'Say the value of 9 in 3997, highlighted in the tens place', 'ninety'],
  ['c', 'Say the value of 2 in 9027, highlighted in the tens place', 'twenty'],
].map(([itemId, challenge, answer]) => ({ itemId, phase: 'say_value', challenge, expected: answer, observed: answer,
  verdict: 'affirmed', source: 'voice', priorCorrections: 0, hearTapsSoFar: 0,
  support: 'No prior corrections on this item. Other assistance and independence are not established.' }));
const report = { fictional: true, writesLearningRecords: false, cases: [] };
for (const [name, evidence] of [['score-only', { score: 100 }], ['successful-responses', rows],
  ['supported-responses', rows.flatMap(r => [{ ...r, observed: 'the bare digit', verdict: 'corrected' },
    { ...r, priorCorrections: 1, support: 'One prior tutor correction on this item. Other assistance and independence are not established.' }])]]) {
  const response = await fetch(`${url}/api/lumina`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'distillLearningObservation', params: { evidence } }) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const result = await response.json();
  const pass = name === 'score-only' ? result.abstain === true : result.abstain === false &&
    result.kind === (name === 'supported-responses' ? 'support' : 'strength') &&
    result.evidenceItemIds?.length >= 2 && result.evidenceItemIds.every(id => rows.some(r => r.itemId === id));
  report.cases.push({ name, evidence, result, pass });
}
report.pass = report.cases.every(c => c.pass);
await mkdir('../artifacts', { recursive: true });
await writeFile('../artifacts/learning-response-preview-live.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, cases: report.cases.map(({ name, pass, result }) => ({ name, pass, result })) }, null, 2));
if (!report.pass) process.exitCode = 1;
