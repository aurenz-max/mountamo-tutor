// Live browser smoke: node scripts/probe-letter-workshop.cjs <playwright-module-path>
const { chromium } = require(process.argv[2] || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const output = 'qa/eval-reports';

(async () => {
  const browser = await chromium.launch({ headless: true });
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
    const evaluations = [];
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', async message => {
      if (message.text().startsWith('Evaluation submitted:')) {
        evaluations.push(await message.args()[1].jsonValue());
      }
    });
    // Synthetic handwriting must never reach a student's history.
    await page.route('**/api/problems/submit**', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }),
    }));
    await page.goto('http://localhost:3000/lumina', { timeout: 120000 });
    await page.getByText('Developer Tools', { exact: true }).click();
    await page.getByText('Language Arts', { exact: true }).click();
    await page.getByRole('button', { name: 'Letter Workshop' }).click();
    const generated = page.waitForResponse(response => response.url().endsWith('/api/lumina') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Generate Content' }).click();
    const response = await generated;
    assert(response.ok(), `Live generation failed: ${await response.text()}`);
    const payload = await response.json();
    fs.writeFileSync(`${output}/letter-workshop-browser-generated.json`, JSON.stringify(payload, null, 2));
    const paper = page.getByTestId('letter-writing-paper');
    await paper.waitFor({ timeout: 120000 });
    await paper.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/letter-workshop-desktop.png` });

    async function draw(reverse = false) {
      await paper.scrollIntoViewIfNeeded();
      const paths = await paper.evaluate(svg => {
        const matrix = svg.getScreenCTM();
        return Array.from(svg.querySelectorAll('path[stroke="#386f72"]')).map(path => {
          const length = path.getTotalLength();
          return Array.from({ length: Math.max(2, Math.ceil(length / 4)) }, (_, index) => {
            const count = Math.max(2, Math.ceil(length / 4));
            const point = path.getPointAtLength(length * index / (count - 1));
            const screen = point.matrixTransform(matrix);
            return { x: screen.x, y: screen.y };
          });
        });
      });
      for (const points of paths) {
        if (reverse) points.reverse();
        await page.mouse.move(points[0].x, points[0].y);
        await page.mouse.down();
        for (const point of points.slice(1)) await page.mouse.move(point.x, point.y);
        await page.mouse.up();
      }
    }

    await draw(true);
    await page.getByRole('button', { name: 'Check my tracing' }).click();
    await page.getByText('Try this', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Try this letter again' }).click();
    const count = (payload.data || payload).challenges.length;
    for (let index = 0; index < count; index++) {
      await draw();
      await page.getByRole('button', { name: 'Check my tracing' }).click();
      await page.getByText('Path followed', { exact: true }).waitFor();
      if (index === 0) await page.screenshot({ path: `${output}/letter-workshop-feedback.png` });
      await page.getByRole('button', { name: index === count - 1 ? 'Finish practice' : 'Next letter', exact: true }).click();
    }
    await page.getByRole('heading', { name: /Your tracing practice/ }).waitFor();
    assert.equal(evaluations.length, 1);
    assert.equal(evaluations[0].metrics.correctCount, count);
    assert.equal(evaluations[0].studentWork.attempts.length, count + 1);
    assert.equal(evaluations[0].studentWork.attempts[0].assessment.passed, false);
    await page.screenshot({ path: `${output}/letter-workshop-summary.png` });
    fs.writeFileSync(`${output}/letter-workshop-browser-result.json`, JSON.stringify({ evaluations, errors }, null, 2));
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(`PASS: live generated ${count} challenges; reverse rejected, retry passed, all advances and one evidence submission verified.`);
  } catch (error) {
    if (page) {
      await page.screenshot({ path: `${output}/letter-workshop-browser-failure.png` });
      console.error((await page.locator('body').innerText()).slice(-7000));
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
