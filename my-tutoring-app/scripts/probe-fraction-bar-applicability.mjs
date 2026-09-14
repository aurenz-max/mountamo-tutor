// Real distiller + shared planner + fraction-bar generator through the running Next
// app. Fictional evidence; no account, submission, calibration or store writes.
import { mkdir, writeFile } from 'node:fs/promises';
const dir = '../artifacts/learning-applicability/fraction-bar';
await mkdir(dir, { recursive: true });
const base = 'http://127.0.0.1:3000';
const report = { fictional: true, learningWrites: false, startedAt: new Date().toISOString(), cases: [] };
const save = () => writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));

// Same shape fractionBarDiagnosisEvidence emits for the mounted-test scenario:
// two numerator swaps and one bar shaded to the denominator, every item corrected.
const support = n => `Attempt ${n} on this question; 0 hint(s) viewed on this fraction before responding; support tier medium; feedback followed every earlier response in the session.`;
const evidence = {
  firstResponseScore: 0,
  challengeSummary: 'Fraction bar (build): for each of 3 fractions the student chooses the numerator from four numbers, then the denominator from four numbers, then shades that many equal parts on a bar. A question repeats until answered correctly.',
  expected: "Choose the top number as the numerator and the bottom number as the denominator, then shade as many of the bar's equal parts as the numerator.",
  observed: '3/4 numerator, attempt 1: 4; 4/5 numerator, attempt 1: 5; 2/6 build, attempt 1: shaded 6 of 6 parts',
  phases: [
    { itemId: 'fraction-bar-1', phase: 'numerator', challenge: 'Fraction 3/4: which number is the numerator? Choices: 3, 4, 2, 5.', expected: '3', observed: '4', support: support(1) },
    { itemId: 'fraction-bar-2', phase: 'numerator', challenge: 'Fraction 4/5: which number is the numerator? Choices: 4, 5, 3, 6.', expected: '4', observed: '5', support: support(1) },
    { itemId: 'fraction-bar-3', phase: 'build', challenge: 'Fraction 2/6: shade parts of a bar divided into 6 equal parts.', expected: 'shaded 2 of 6 parts', observed: 'shaded 6 of 6 parts', support: support(1) },
  ],
};
const distill = await fetch(`${base}/api/lumina`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000),
  body: JSON.stringify({ action: 'distillMisconception', params: { evidence, score: 87, success: true, subskillId: 'NF001-03-b', evalMode: 'build', gradeLevel: '3' } }) });
const diagnosis = await distill.json();
await writeFile(`${dir}/distilled.json`, JSON.stringify({ evidence, diagnosis }, null, 2));
report.distilled = { abstain: diagnosis.abstain, confidence: diagnosis.confidence, evidenceTier: diagnosis.evidenceTier };
if (diagnosis.abstain || !diagnosis.misconceptionText) { await save(); throw new Error(`distiller abstained on successful retry-until-correct evidence: ${diagnosis.reason}`); }

const POS = 'contrast_shared_digit_roles';
// [name, focus, mode, tier, expected move or null, draws]
const cases = [
  ['baseline', '', 'build', 'medium', null, 1],
  ['distilled', diagnosis.misconceptionText, 'build', 'medium', POS, 2],
  ['paraphrase-a', 'When asked how many parts are shaded, the learner reports how many equal parts the whole is cut into.', 'build', 'medium', POS, 2],
  ['paraphrase-b', 'Says the bottom number is how many are shaded.', 'build', 'medium', POS, 3],
  ['hard-tier', diagnosis.misconceptionText, 'build', 'hard', POS, 1],
  ['unrelated', 'Adds the denominators together when adding two fractions.', 'build', 'medium', null, 2],
  ['nearby', 'Believes a fraction with a larger denominator is always the larger fraction when comparing two fractions.', 'build', 'medium', null, 3],
  ['contradictory', 'The selection records are unreliable and contradict each other; no consistent pattern about which number of a fraction plays which role can be inferred.', 'build', 'medium', null, 2],
  ['other-representation', 'The student gives the bare digit for its worth regardless of its position in a whole number.', 'build', 'medium', null, 2],
  ['identify-ineligible', diagnosis.misconceptionText, 'identify', 'medium', null, 1],
];
const window = c => c.numerator >= 2 && c.numerator < c.denominator && c.denominator >= 3 && c.denominator <= 6;
const offers = c => [c.numerator, c.denominator].every(v => c.numeratorChoices.includes(v) && c.denominatorChoices.includes(v));
const contrast = cs => cs.some((c, i) => i + 1 < cs.length && (c.denominator === cs[i + 1].numerator || c.numerator === cs[i + 1].denominator) && offers(c) && offers(cs[i + 1]));
for (const [name, focus, mode, tier, expected, draws] of cases) {
  for (let draw = 0; draw < draws; draw++) {
    const query = new URLSearchParams({ componentId: 'fraction-bar', evalMode: mode, gradeLevel: '3', grade: '3', difficulty: tier,
      topic: 'Build fractions a/b by shading parts of a bar', ...(focus ? { remediationFocus: focus } : {}) });
    const response = await fetch(`${base}/api/lumina/eval-test?${query}`, { signal: AbortSignal.timeout(120000) });
    const payload = await response.json();
    await writeFile(`${dir}/${name}-${draw}.json`, JSON.stringify(payload, null, 2));
    const d = payload.fullData;
    const cs = d?.challenges ?? [];
    const structural = response.ok && payload.status === 'pass' && d.challengeType === mode && d.supportTier === tier
      && cs.length === (mode === 'build' ? 3 : 7) && (mode !== 'build' || (cs.every(window) && new Set(cs.map(c => `${c.numerator}/${c.denominator}`)).size === cs.length))
      && cs.every(c => c.numeratorChoices.includes(c.numerator) && c.denominatorChoices.includes(c.denominator))
      && (!focus || !JSON.stringify(payload).includes(focus));
    const adaptation = d?.learningAdaptation;
    const outcome = !adaptation ? 'abstain-or-none' : adaptation.status;
    const semantic = expected ? adaptation?.move === expected && ['targeted', 'already-targeted'].includes(adaptation.status) && adaptation.comparisonCount === 2 && contrast(cs)
      : !adaptation;
    report.cases.push({ name, draw, mode, tier, focus, expected, adaptation, outcome,
      fractions: cs.map(c => `${c.numerator}/${c.denominator}`), structural, semantic, pass: structural && semantic });
    await save();
    console.log(JSON.stringify(report.cases.at(-1)));
  }
}
report.pass = report.cases.every(c => c.pass);
report.finishedAt = new Date().toISOString();
await save();
console.log(`fraction-bar applicability: ${report.cases.filter(c => c.pass).length}/${report.cases.length} draws pass`);
