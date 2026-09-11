// Real tester/browser drive. Synthetic evaluations are intercepted before persistence.
const { chromium } = require(process.argv[2] || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
  const evaluations = [], errors = [], runs = [];
  try {
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', async message => {
      if (message.text().startsWith('Evaluation submitted:')) evaluations.push(await message.args()[1].jsonValue());
    });
    await page.route('**/api/problems/submit**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }));
    await page.goto('http://localhost:3000/lumina', { timeout: 120000 });
    await page.getByText('Developer Tools', { exact: true }).click();
    await page.getByText('Engineering', { exact: true }).click();
    await page.getByText('Ramp Lab', { exact: true }).click();
    const generate = async mode => {
      await page.getByLabel('Ramp task', { exact: true }).selectOption(mode);
      await page.locator('input[placeholder="Understanding inclined planes and ramps"]').fill('Investigate how surface friction changes the push needed to move a box.');
      const pending = page.waitForResponse(r => r.url().endsWith('/api/lumina') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Generate Content', exact: true }).click();
      const response = await pending; assert(response.ok(), await response.text());
      const payload = await response.json(); const data = payload.data || payload;
      assert(data.challenges.every(ch => ch.mode === mode && ch.variable === 'surface'));
      await page.getByTestId('ramp-investigation').waitFor(); return data;
    };
    const collect = async () => {
      const panel = page.getByTestId('ramp-investigation');
      await panel.getByRole('button', { name: 'Setup B', exact: true }).click();
      await panel.getByRole('button', { name: 'Record prediction', exact: true }).click();
      await panel.getByRole('button', { name: 'Run trial A', exact: true }).click();
      await panel.getByRole('button', { name: 'Run trial B', exact: true }).waitFor();
      await panel.getByRole('button', { name: 'Run trial B', exact: true }).click({ timeout: 20000 });
      await panel.getByRole('button', { name: /Record investigation|Explain my results/, exact: true }).waitFor({ timeout: 20000 });
    };
    const plan = await generate('plan_fair_test');
    for (let i = 0; i < plan.challenges.length; i++) {
      const ch = plan.challenges[i];
      const panel = page.getByTestId('ramp-investigation');
      assert.equal(await panel.getByText('Your trial notebook', { exact: true }).count(), 0);
      const opposite = ch.scenarios.a.frictionLevel === 'high' ? 'low' : 'high';
      await panel.getByLabel('Setup B surface').selectOption(opposite);
      if (i === 0) {
        await panel.getByLabel('Setup B angle').selectOption(String(ch.scenarios.a.angle === 35 ? 15 : 35));
        await panel.getByRole('button', { name: 'Commit my plan' }).click();
        await panel.getByText(/cannot isolate/).waitFor();
        await panel.screenshot({ path: 'qa/eval-reports/ramp-lab-plan-repair-2026-09-10.png' });
        await panel.getByLabel('Setup B angle').selectOption(String(ch.scenarios.a.angle));
      }
      await panel.getByRole('button', { name: 'Commit my plan' }).click();
      assert(await panel.getByLabel('Setup B angle').isDisabled());
      await collect();
      if (i === 0) await panel.screenshot({ path: 'qa/eval-reports/ramp-lab-trial-notebook-2026-09-10.png' });
      await panel.getByRole('button', { name: 'Record investigation' }).click();
      if (i < plan.challenges.length - 1) await page.getByRole('button', { name: 'Next Challenge', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Finish Session', exact: true }).click();
    await page.waitForTimeout(400);
    assert(evaluations.length === 1, 'one synthetic evaluation');
    const observations = evaluations[0].studentWork.investigations;
    assert.equal(observations.length, plan.challenges.length);
    assert.deepEqual(observations[0].planAttempts.map(attempt => attempt.fair), [false, true]);
    assert.equal(evaluations[0].metrics.predictionAccuracy, Math.round(100 * observations.filter(result => result.predictionCorrect).length / observations.length));
    assert(observations.some(result => result.solved && !result.predictionCorrect), 'wrong prediction does not invalidate a fair test');
    runs.push({ mode: 'plan_fair_test', challenges: plan.challenges.length, evaluation: evaluations[0] });
    const explain = await generate('explain_from_trials');
    await collect();
    await page.getByRole('button', { name: 'Explain my results' }).click();
    await page.getByRole('button', { name: 'Hear the question', exact: true }).waitFor();
    await page.getByTestId('ramp-investigation').screenshot({ path: 'qa/eval-reports/ramp-lab-explain-ready-2026-09-10.png' });
    runs.push({ mode: 'explain_from_trials', generated: explain.challenges.length, browser: 'both trials recorded; spoken panel reached', microphone: 'not exercised' });
    assert.deepEqual(errors, []);
    fs.writeFileSync('qa/eval-reports/ramp-lab-browser-2026-09-10.json', JSON.stringify({ status: 'pass', runs, errors }, null, 2));
    console.log(JSON.stringify({ status: 'pass', planChallenges: plan.challenges.length, explanationPanel: true, errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
