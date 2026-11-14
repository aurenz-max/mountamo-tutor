// Real JEV replay: no generated verdicts or mutations injected into the runtime.
import { writeFileSync } from 'node:fs';
import { DIALOGUE_CASES, dialogueRequest } from './cases/dialogue-cases.mjs';
const results = [];
for (const [name, tutor, correct, expected] of DIALOGUE_CASES) {
  const request = dialogueRequest([name, tutor, correct]);
  const response = await fetch('http://localhost:3000/api/lumina/live-activity/observe-dialogue', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  if (!response.ok) throw new Error(`Observer HTTP ${response.status}`);
  const result = await response.json();
  const actual = result.accepted ? result.transition : 'none';
  results.push({ name, request, expected, result, passed: actual === expected });
  console.log(name, JSON.stringify(result), actual === expected ? 'PASS' : 'FAIL');
}
writeFileSync(process.argv[2] || 'qa/tutor-reports/counting-board-dialogue-probe-2026-09-19.json', JSON.stringify(results, null, 2));
process.exitCode = results.every(r => r.passed) ? 0 : 1;
