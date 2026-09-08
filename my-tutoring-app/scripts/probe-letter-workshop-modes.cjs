// Live UI/generator probe; synthetic ink/audio never enters student history.
const { chromium } = require(process.argv[2] || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const tier = process.argv[3];
const suffix = tier ? `-${tier}` : '';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  const errors = [], evaluations = [], generated = [];
  try {
    await page.addInitScript(() => {
      window.__letterCues = [];
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
        speak(utterance) { window.__letterCues.push(utterance.text); setTimeout(() => utterance.onend?.(), 100); },
        cancel() {},
      } });
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', async message => {
      if (message.text().startsWith('Evaluation submitted:')) evaluations.push(await message.args()[1].jsonValue());
    });
    await page.route('**/api/problems/submit**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }));
    await page.goto('http://localhost:3000/lumina', { timeout: 120000 });
    await page.getByText('Developer Tools', { exact: true }).click();
    await page.getByText('Language Arts', { exact: true }).click();
    await page.getByRole('button', { name: 'Letter Workshop' }).click();
    await page.locator('input[placeholder="Assisted uppercase and lowercase letter formation tracing"]').fill('Letter formation lowercase l');

    if (tier) await page.getByLabel('Letter difficulty', { exact: true }).selectOption(tier);
    for (const [mode, label] of [['trace', 'Assisted tracing'], ['copy', 'Copy beside a model'], ['write', 'Write from listening']]) {
      await page.getByRole('button', { name: new RegExp(label) }).click();
      const pending = page.waitForResponse(r => r.url().endsWith('/api/lumina') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Generate Content', exact: true }).click();
      const response = await pending;
      assert(response.ok(), await response.text());
      const payload = await response.json();
      const data = payload.data || payload;
      generated.push(data);
      assert(data.challenges.every(ch => ch.type === mode && ch.templateId === 'lowercase-l'));
      if (tier) assert(data.challenges.every(ch => ch.supportTier === tier));
      const paper = page.getByTestId('letter-writing-paper');
      await paper.waitFor();
      for (let i = 0; i < data.challenges.length; i++) {
        await paper.scrollIntoViewIfNeeded();
        if (mode === 'trace') assert(await paper.locator('path[stroke="#386f72"]').count());
        else assert.equal(await paper.locator('path[stroke="#386f72"]').count(), 0);
        if (tier) {
          assert.equal(await page.getByTestId('letter-start').count(), mode === 'trace' && tier !== 'hard' ? 1 : 0);
          assert.equal(await page.getByTestId('letter-arrow').count(), mode === 'trace' && tier === 'easy' ? 1 : 0);
          assert.equal(await page.getByTestId('letter-line-labels').count(), tier !== 'hard' ? 1 : 0);
          assert.equal(await page.getByTestId('letter-self-check').count(), tier === 'easy' ? 1 : 0);
        }
        if (mode === 'copy') assert.equal(await page.getByTestId('letter-copy-model').count(), 1);
        if (mode === 'write') {
          assert.equal(await page.getByTestId('letter-copy-model').count(), 0);
          assert.equal(await paper.getAttribute('aria-label'), 'Writing paper; draw with a finger, pen, or mouse');
          await page.getByRole('button', { name: 'Hear the letter name', exact: true }).click();
          await page.getByText('Listen to the letter name.', { exact: true }).waitFor({ state: 'hidden' });
        }
        if (i === 0) { await page.waitForTimeout(4000); await page.screenshot({ path: `qa/eval-reports/letter-workshop-${mode}-mode${suffix}.png` }); }
        // Reference lowercase l; copy/write may be placed horizontally elsewhere.
        const points = await paper.evaluate((svg, x) => {
          return [60, 100, 150, 200, 240].map(y => {
            const p = svg.createSVGPoint(); p.x = x; p.y = y;
            const screen = p.matrixTransform(svg.getScreenCTM()); return { x: screen.x, y: screen.y };
          });
        }, mode === 'trace' ? 200 : 240);
        await page.mouse.move(points[0].x, points[0].y); await page.mouse.down();
        for (const point of points.slice(1)) await page.mouse.move(point.x, point.y);
        await page.mouse.up();
        await page.getByRole('button', { name: mode === 'trace' ? 'Check my tracing' : 'Check my writing', exact: true }).click();
        await page.getByText(mode === 'trace' ? 'Path followed' : 'Shape matches', { exact: true }).waitFor();
        await page.getByRole('button', { name: i === data.challenges.length - 1 ? 'Finish practice' : 'Next letter', exact: true }).click();
      }
      await page.getByRole('heading', { name: mode === 'trace' ? 'Your tracing practice' : 'Your letter practice' }).waitFor();
    }
    assert.equal(evaluations.length, 3);
    assert.equal(evaluations[1].studentWork.localOnly, true);
    assert.equal(evaluations[2].studentWork.attempts[0].modelPreviouslySeen, false);
    assert.equal(evaluations[2].studentWork.attempts[1].modelPreviouslySeen, true);
    assert.equal(errors.length, 0, errors.join('\n'));
    const cues = await page.evaluate(() => window.__letterCues);
    fs.writeFileSync(`qa/eval-reports/letter-workshop-modes-browser${suffix}.json`, JSON.stringify({ generated, evaluations, errors, cues, audio: 'Synthetic playback completion; actual device audio requires listening check' }, null, 2));
    console.log('PASS: live generation and pointer lifecycle for trace/copy/write; blank paper, cue gate, evidence, and no stale models. Audio events simulated.');
  } catch (error) {
    await page.screenshot({ path: 'qa/eval-reports/letter-workshop-modes-browser-failure.png' });
    console.error((await page.locator('body').innerText()).slice(-5000));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
