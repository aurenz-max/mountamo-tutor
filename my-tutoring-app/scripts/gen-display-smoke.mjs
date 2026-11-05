// Runs the hand-written displays (gen-display/fixtures.ts) through compile -> page -> headless harness.
// No model calls. Usage: node scripts/gen-display-smoke.mjs [--out=<dir for screenshots>]
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

const outDir = process.argv.find(a => a.startsWith('--out='))?.split('=')[1];
const root = process.cwd();
const server = await vite.createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null }, resolve: { alias: { '@': resolve(root, 'src') } } });
const fail = [];
try {
  const load = (p) => vite.createServerModuleRunner(server.environments.ssr, { hmr: false }).import(p);
  const { compileDisplay } = await load('/src/components/lumina/service/gen-display/compile.ts');
  const { displayDocument } = await load('/src/components/lumina/service/gen-display/document.ts');
  const { runDisplay, closeHarness } = await load('/src/components/lumina/service/gen-display/harness.ts');
  const fx = await load('/src/components/lumina/service/gen-display/fixtures.ts');
  const defaults = (params) => Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v.default]));

  const forbidden = compileDisplay(fx.FORBIDDEN_SOURCE);
  console.log('forbidden ->', forbidden.ok ? 'COMPILED (wrong)' : forbidden.errors);
  if (forbidden.ok) fail.push('forbidden source compiled');

  const lines = compileDisplay(fx.LINES_SOURCE);
  if (!lines.ok) throw new Error(`lines did not compile: ${lines.errors}`);
  const html = displayDocument(lines.js, defaults(fx.LINES_PARAMS));
  const t = Date.now();
  const run = await runDisplay(html, fx.LINES_PROBES);
  console.log(`lines -> ${Date.now() - t} ms, ${html.length} bytes`);
  console.log('  errors:', run.errors);
  console.log('  scene:', JSON.stringify(run.scene));
  console.log('  text:', run.text.replace(/\s+/g, ' ').slice(0, 200));
  for (const p of run.probes) console.log(`  probe "${p.name}": ${p.ok ? 'ok' : 'FAIL ' + p.detail}`);
  if (run.errors.length || run.probes.some(p => !p.ok) || !run.scene) fail.push('lines display');

  // A wrong expectation must fail, or the probes prove nothing.
  const wrong = await runDisplay(html, [{ name: 'wrong on purpose', set: { 'Slope of the cyan line': 0 }, expect: { includes: ['never meet'] } }, { name: 'no such control', set: { 'Speed': 3 } }]);
  for (const p of wrong.probes) console.log(`  negative "${p.name}": ${p.ok ? 'PASSED (wrong)' : 'failed as it should: ' + p.detail}`);
  if (wrong.probes.some(p => p.ok)) fail.push('negative probes passed');

  // Formula: KaTeX rides in the page only when the display uses it, and renders MathML from live values.
  const formula = compileDisplay(fx.FORMULA_SOURCE);
  if (!formula.ok) throw new Error(`formula did not compile: ${formula.errors}`);
  const formulaHtml = displayDocument(formula.js, {});
  const fRun = await runDisplay(formulaHtml, fx.FORMULA_PROBES);
  console.log(`formula -> ${formulaHtml.length} bytes (lines page ${html.length}), errors:`, fRun.errors);
  console.log('  text:', fRun.text.replace(/\s+/g, ' ').slice(0, 200));
  for (const p of fRun.probes) console.log(`  probe "${p.name}": ${p.ok ? 'ok' : 'FAIL ' + p.detail}`);
  if (fRun.errors.length || fRun.probes.some(p => !p.ok)) fail.push('formula display');
  if (html.includes('KaTeX parse error')) fail.push('katex shipped in a page that does not use Formula');

  const throws = compileDisplay(fx.THROWS_SOURCE);
  const thrown = await runDisplay(displayDocument(throws.js, {}));
  console.log('throws -> errors:', thrown.errors);
  if (!thrown.errors.length) fail.push('render error not reported');

  // The production path: the page inside a sandboxed iframe (opaque origin, no network), talking by postMessage.
  {
    const { chromium } = await import('playwright-core');
    const browser = await chromium.launch({ executablePath: 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe', headless: true });
    const page = await browser.newPage();
    const sneaky = displayDocument(compileDisplay(`function Display({ params, lumina }) {
      const [r, setR] = useState('pending');
      useEffect(() => { lumina.scene({ ready: true }); setTimeout(() => { try { const x = new Image(); x.onload = () => setR('loaded'); x.onerror = () => setR('blocked'); x.src = 'https://example.com/x.png'; } catch (e) { setR('blocked'); } }, 10); }, []);
      // Written to slip past the static checks: the sandbox, not the checks, must stop it.
      let cookie = 'none'; try { cookie = String(document['coo' + 'kie']); } catch (e) { cookie = 'denied'; }
      return <Panel title="probe"><Text>{'net:' + r + ' cookie:' + cookie}</Text></Panel>;
    }`).js, {});
    await page.setContent(`<html><body><iframe id="f" sandbox="allow-scripts" style="width:600px;height:200px"></iframe><script>
      window.got = []; addEventListener('message', (e) => { if (e.source === document.getElementById('f').contentWindow) got.push(e.data); });
    </script></body></html>`);
    await page.evaluate((html) => { document.getElementById('f').srcdoc = html; }, sneaky);
    await page.waitForTimeout(1500);
    const got = await page.evaluate(() => window.got);
    const kinds = [...new Set(got.map((m) => m.kind))];
    const frameText = await page.frameLocator('#f').locator('body').innerText();
    console.log('sandboxed iframe -> messages:', kinds.join(', '), '| page:', frameText.replace(/\s+/g, ' '));
    if (!kinds.includes('height') || !kinds.includes('scene')) fail.push('iframe bridge');
    if (!/net:blocked/.test(frameText)) fail.push('network not blocked');
    if (!/cookie:denied/.test(frameText)) fail.push('cookie readable in sandbox');
    await browser.close();
  }

  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, 'lines-rest.png'), Buffer.from(run.screenshot, 'base64'));
    run.probes.forEach((p, i) => writeFileSync(resolve(outDir, `lines-probe-${i}.png`), Buffer.from(p.screenshot, 'base64')));
    writeFileSync(resolve(outDir, 'lines.html'), html);
    writeFileSync(resolve(outDir, 'formula-rest.png'), Buffer.from(fRun.screenshot, 'base64'));
    fRun.probes.forEach((p, i) => writeFileSync(resolve(outDir, `formula-probe-${i}.png`), Buffer.from(p.screenshot, 'base64')));
  }
  await closeHarness();
} finally {
  await server.close();
}
console.log(fail.length ? `FAILED: ${fail.join('; ')}` : 'ALL PASSED');
process.exit(fail.length ? 1 : 0);
