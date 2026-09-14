// Live L1 routing/content checks followed by a real pinned tester session.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve('../artifacts/literacy-grade2-design');
const mode = 'notice_and_repair';
const topic = 'A trip to the pond';
const cases = [
  { name: 'pinned', pin: mode },
  ...['easy', 'medium', 'hard'].map(difficulty => ({ name: difficulty, pin: mode, difficulty })),
  { name: 'scope-conflict', pin: mode, topic: 'Read a long 100-word passage about a trip to the pond' },
  { name: 'auto-intent', intent: 'Notice and repair word recognition errors using the print and sentence meaning' },
  { name: 'mixed', pin: 'mixed' },
];
function check(data) {
  assert.equal(data.challengeType, mode);
  assert.equal(data.challenges.length, 3);
  assert.equal(new Set(data.challenges.map(c => c.text.toLowerCase())).size, 3);
  for (const c of data.challenges) {
    assert.equal(c.challengeType, mode);
    assert(c.text.split(/\s+/).length >= 5 && c.text.split(/\s+/).length <= 8);
    assert(/^[A-Z][a-zA-Z ,'-]+[.!?]$/.test(c.text));
  }
}
async function probe(c) {
  const response = await fetch('http://localhost:3000/api/lumina', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'generateComponentContent', params: {
      componentId: 'reading-repair-studio', topic: c.topic || topic, gradeLevel: 'elementary',
      config: { objectiveGrade: '2', objectiveText: 'Check your own reading against the printed sentence',
        ...(c.pin ? { targetEvalMode: c.pin } : {}), ...(c.intent ? { intent: c.intent } : {}),
        ...(c.difficulty ? { difficulty: c.difficulty } : {}) },
    } }),
  });
  const result = await response.json();
  fs.writeFileSync(path.join(root, `reading-repair-l1-${c.name}.json`), JSON.stringify(result, null, 2));
  assert(response.ok, `${c.name}: ${JSON.stringify(result)}`);
  const data = result.data || result;
  check(data);
  return { case: c.name, count: data.challenges.length, texts: data.challenges.map(c => c.text) };
}
(async () => {
  if (!process.argv.includes('--browser-only')) {
  const results = [];
  for (let i = 0; i < cases.length; i += 2) results.push(...await Promise.all(cases.slice(i, i + 2).map(probe)));
  const evalResponse = await fetch(`http://localhost:3000/api/lumina/eval-test?componentId=reading-repair-studio&evalMode=${mode}&grade=2&topic=${encodeURIComponent(topic)}`);
  const evaluated = await evalResponse.json();
  fs.writeFileSync(path.join(root, 'reading-repair-l1-eval-test.json'), JSON.stringify(evaluated, null, 2));
  assert.equal(evaluated.status, 'pass');
  assert.equal(evaluated.catalogMeta.beta, 4.5);
  assert.equal(evaluated.validation.challengeCount, 3);
  check(evaluated.fullData);
  fs.writeFileSync(path.join(root, 'reading-repair-l1-generation-summary.json'), JSON.stringify(results, null, 2));
  console.log(`Live generation PASS: ${cases.length} routing cases plus pinned eval-test`);
  }

  const { chromium } = require(process.argv[2] || 'playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const writes = [], errors = [], evaluations = [], requests = [];
  try {
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => {
      if (/problems\/submit|pulse.*submit/.test(r.url())) writes.push(r.url());
      if (r.url().endsWith('/api/lumina') && r.method() === 'POST') requests.push(r.postDataJSON());
    });
    page.on('console', async m => {
      if (m.text().startsWith('Evaluation submitted:')) evaluations.push(await m.args()[1].jsonValue());
    });
    await page.goto('http://localhost:3000/lumina', { timeout: 120000 });
    await page.getByText('Developer Tools', { exact: true }).click();
    await page.getByText('Language Arts', { exact: true }).click();
    await page.getByText('Reading Repair Studio', { exact: true }).click();
    await page.getByRole('combobox').selectOption('2');
    await page.getByRole('button', { name: /Notice and Repair \(Practice\)/ }).click();
    await page.getByRole('button', { name: 'Generate Content', exact: true }).click();
    await page.getByRole('button', { name: 'Continue without a recording', exact: true }).waitFor({ timeout: 90000 });
    assert(requests.some(r => r.params?.componentId === 'reading-repair-studio' && r.params.config?.targetEvalMode === mode));
    await page.screenshot({ path: path.join(root, 'reading-repair-l1-tester.png'), fullPage: true });
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Continue without a recording', exact: true }).click();
      await page.getByRole('button', { name: 'Finish this sentence', exact: true }).click();
      if (i < 2) await page.getByRole('button', { name: 'Try a fresh sentence', exact: true }).click();
    }
    await page.getByText('Your reading practice', { exact: true }).waitFor();
    assert.equal(evaluations.length, 1);
    assert.equal(evaluations[0].metrics.masteryEligible, false);
    assert.equal(evaluations[0].metrics.unassessableCount, 3);
    assert.equal(writes.length, 0);
    assert.equal(errors.length, 0);
    fs.writeFileSync(path.join(root, 'reading-repair-l1-browser.json'), JSON.stringify({ requests, evaluations, writes, errors }, null, 2));
    console.log('Pinned tester PASS: actual generation, one local ledger, zero adaptive writes');
  } catch (error) {
    await page.screenshot({ path: path.join(root, 'reading-repair-l1-tester-failure.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
