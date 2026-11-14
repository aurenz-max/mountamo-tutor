/**
 * Real-model cases for the advisory learner-turn observation (`learner_intent`).
 *
 *   node scripts/learner-intent-probe.mjs [--shapes|--trains|--letters|--words|--facts|--links|--sentences] [output.json]
 *
 * No flag runs the Counting Board set. Each adopter domain has its own set because the
 * false-request risk is domain-specific: a held phoneme transcribes as "hmm", which reads
 * like thinking aloud, and a sounded-out word reads like filler.
 *
 * Needs the frontend on :3000 with TYPESAFE_API_KEY. Three repetitions per case, the
 * same shape as tutor-verdict-probe.mjs. A case names the flag values it requires;
 * `null` means either value is acceptable, because the turn is honestly ambiguous and
 * a bench that forced a side would be grading the case writer, not the model.
 *
 * The risk being measured is a FALSE help or stop request: those are the two flags
 * that send the tutor a packet of their own.
 */
import { writeFileSync } from 'node:fs';
import { CASES, COUNT, DOMAINS, agrees, agreesAnswer, YES } from './cases/learner-intent-cases.mjs';
const flag = Object.keys(DOMAINS).find(f => process.argv.includes(f));
const [domainName, cases] = flag ? DOMAINS[flag] : ['counting-board', CASES];

const results = [];
for (let repetition = 1; repetition <= 3; repetition++) for (const [name, learner, want, context = COUNT] of cases) {
  const input = { scope: { sessionEpoch: 'probe', instanceId: 'fish', itemId: 'c1' }, turnId: `${name}-${repetition}`,
    task: context.task, priorTutor: context.priorTutor, learner };
  const response = await fetch('http://localhost:3000/api/lumina/observe-learner', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = await response.json();
  const passed = result.accepted === true && agrees(result.asksForHelp, want.help) && agrees(result.wantsToStop, want.stop)
    && agreesAnswer(result.attemptsAnswer, want.answer);
  results.push({ repetition, name, input, expected: want, result, passed });
  const f = v => typeof v === 'number' ? v.toFixed(2) : String(v);
  console.log(repetition, name.padEnd(22), `help ${f(result.asksForHelp)} stop ${f(result.wantsToStop)} answer ${f(result.attemptsAnswer)}`,
    `${result.ms}ms`, passed ? 'PASS' : `FAIL (${result.reason})`);
}
const failed = results.filter(r => !r.passed);
const falseRequests = results.filter(r => r.result.accepted
  && ((r.expected.help === false && r.result.asksForHelp >= YES) || (r.expected.stop === false && r.result.wantsToStop >= YES)));
const ms = results.map(r => r.result.ms).filter(Number.isFinite).sort((a, b) => a - b);
console.log(`\n${results.length - failed.length}/${results.length} passed · false help/stop requests: ${falseRequests.length}`
  + ` · latency median ${ms[Math.floor(ms.length / 2)]}ms, p90 ${ms[Math.floor(ms.length * .9)]}ms`);
writeFileSync(process.argv.slice(2).find(arg => !arg.startsWith('--')) || `qa/tutor-reports/${domainName}-learner-intent-2026-09-20.json`,
  JSON.stringify(results, null, 2));
process.exitCode = failed.length ? 1 : 0;
