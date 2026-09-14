// Browser contract over a saved REAL generator response. The microphone reads
// an adult synthetic WAV of that response's first sentence; judging is live HTTP.
const { chromium } = require(process.argv[2] || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve('../artifacts/literacy-grade2-design');
const supportProbe = process.argv.includes('--support');
const artifact = name => path.join(root, `reading-repair-browser-${supportProbe ? 'l2-' : ''}${name}`);
(async () => {
  const generated = JSON.parse(fs.readFileSync(path.join(root, 'reading-repair-generation-1.json'), 'utf8')).fullData;
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${path.join(root, 'reading-repair-audio/generated-first.wav')}`] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, permissions: ['microphone'] });
  const errors = [], evaluations = [], judgments = [], writes = [], sounds = [];
  try {
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', async message => {
      if (message.text().startsWith('Evaluation submitted:')) evaluations.push(await message.args()[1].jsonValue());
      if (message.text().startsWith('[SoundManager] play:')) sounds.push(message.text());
    });
    page.on('request', request => { if (/problems\/submit|pulse.*submit/.test(request.url())) writes.push(request.url()); });
    await page.route('**/api/lumina', async route => {
      const body = route.request().postDataJSON();
      if (body?.action === 'generateComponentContent' && body.params?.componentId === 'reading-repair-studio') {
        await route.fulfill({ json: { type: 'reading-repair-studio', data: generated } });
      } else await route.continue();
    });
    await page.goto('http://localhost:3000/lumina', { timeout: 120000 });
    await page.getByText('Developer Tools', { exact: true }).click();
    await page.getByText('Language Arts', { exact: true }).click();
    await page.getByText('Reading Repair Studio', { exact: true }).click();
    await page.getByRole('button', { name: 'Generate Content', exact: true }).click();
    await page.getByRole('button', { name: 'Record my reading', exact: true }).waitFor();
    await page.screenshot({ path: artifact('first.png'), fullPage: true });
    const judged = page.waitForResponse(response => response.url().endsWith('/reading-repair-judge'), { timeout: 45000 });
    await page.getByRole('button', { name: 'Record my reading', exact: true }).click();
    judgments.push(await (await judged).json());
    await page.getByLabel('Replay my first reading').waitFor();
    assert.equal(await page.getByText(/Your first reading matched/).count(), 0, 'first verdict must remain private');
    const audio = page.getByLabel('Replay my first reading');
    await audio.evaluate(element => element.play());
    await page.waitForTimeout(300);
    assert(await audio.evaluate(element => element.currentTime > 0), 'recorded audio must replay');
    await audio.evaluate(element => element.pause());
    if (supportProbe) {
      const word = page.getByRole('button', { name: /Revisit/ }).first();
      await word.click(); await word.click();
      await page.getByRole('button', { name: 'Help me check', exact: true }).click();
      await page.getByRole('button', { name: 'Another way to check', exact: true }).click();
      await page.getByRole('button', { name: 'Walk me through it', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Hear this tip', exact: true }).count(), 1);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: artifact('help-narrow.png'), fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'help must fit narrow viewport');
      await page.setViewportSize({ width: 1440, height: 1050 });
    }
    await page.screenshot({ path: artifact('review.png'), fullPage: true });
    const finish = async recorded => {
      await page.getByRole('button', { name: recorded ? 'I’m done checking' : 'Continue without a recording', exact: true }).click();
      if (supportProbe && recorded) await page.getByRole('button', { name: 'The letters', exact: true }).click();
      await page.getByRole('button', { name: 'Finish this sentence', exact: true }).click();
    };
    await finish(true);
    for (let i = 1; i < 3; i++) {
      await page.getByRole('button', { name: 'Try a fresh sentence', exact: true }).click();
      assert.equal(await page.getByLabel('Replay my first reading').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Hear this tip', exact: true }).count(), 0);
      await finish(false);
    }
    await page.getByText('Your reading practice', { exact: true }).waitFor();
    await page.screenshot({ path: artifact('summary.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: artifact('narrow.png'), fullPage: true });
    assert.equal(evaluations.length, 1);
    assert.notEqual(judgments[0].status, 'mismatch', 'the accurate synthetic recording must not become a reading error');
    assert.equal(evaluations[0].metrics.accurateFirstReadCount, judgments[0].status === 'matched' ? 1 : 0);
    assert.equal(evaluations[0].metrics.unassessableCount, judgments[0].status === 'matched' ? 2 : 3);
    assert.equal(evaluations[0].studentWork.evidence[0].replayCount, 1);
    assert.equal(writes.length, 0, 'provisional evidence must never submit adaptive scores');
    assert.equal(errors.length, 0);
    if (supportProbe) {
      assert.equal(evaluations[0].studentWork.evidence[0].supportRequested, true);
      for (const id of ['toggleOn', 'toggleOff', 'select']) assert(sounds.some(s => s.includes(`play: ${id} `)), `missing sound ${id}`);
    }
    fs.writeFileSync(artifact('results.json'), JSON.stringify({ judgments, evaluations, writes, errors, sounds }, null, 2));
    console.log(JSON.stringify({ passed: true, recordings: judgments.length, evaluations: evaluations.length, writes, errors, sounds }));
  } catch (error) {
    fs.writeFileSync(artifact('results.json'), JSON.stringify({ judgments, evaluations, writes, errors, sounds }, null, 2));
    await page.screenshot({ path: artifact('failure.png'), fullPage: true }).catch(() => {});
    fs.writeFileSync(artifact('failure.txt'), `${error.stack}\n${await page.locator('body').innerText()}`);
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
