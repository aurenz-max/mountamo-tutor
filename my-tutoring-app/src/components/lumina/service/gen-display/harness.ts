/**
 * Run a generated display in headless Chromium and report what happened: runtime errors, the
 * text and screenshot of its starting state, the scene it published, and each probe's result.
 * A probe loads the display fresh, moves kit controls by label, then checks the page text.
 *
 * Authoring-time only (the create_display loop and scripts): students load validated displays,
 * so no server that serves lessons needs a browser.
 */
import type { Browser } from 'playwright-core';
import type { DisplayProbe } from './types';

const CHROME = process.env.LUMINA_CHROME_PATH ?? 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const SETTLE_MS = 250;

export interface ProbeResult {
  name: string;
  ok: boolean;
  /** Why it failed, or empty. */
  detail: string;
  text: string;
  screenshot: string;
}

export interface DisplayRun {
  errors: string[];
  text: string;
  scene: unknown;
  /** PNG, base64, of the display at rest. */
  screenshot: string;
  probes: ProbeResult[];
}

let browser: Promise<Browser> | undefined;
async function getBrowser(): Promise<Browser> {
  // A variable specifier keeps bundlers from pulling playwright into app code.
  const name = 'playwright-core';
  browser ??= import(/* @vite-ignore */ name).then((pw: typeof import('playwright-core')) => pw.chromium.launch({ executablePath: CHROME, headless: true }));
  return browser;
}

export async function closeHarness() {
  if (browser) await (await browser).close();
  browser = undefined;
}

type PageState = { errors: string[]; scene: unknown; text: string; controls: string[] };

export async function runDisplay(html: string, probes: DisplayProbe[] = []): Promise<DisplayRun> {
  const context = await (await getBrowser()).newContext({ viewport: { width: 720, height: 900 }, deviceScaleFactor: 1 });
  try {
    const open = async () => {
      const page = await context.newPage();
      const pageErrors: string[] = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(`console: ${m.text()}`); });
      await page.setContent(html, { waitUntil: 'load' });
      await page.waitForTimeout(SETTLE_MS);
      return { page, pageErrors };
    };
    const state = (page: import('playwright-core').Page) => page.evaluate((): PageState => {
      const l = (window as unknown as { __lumina: { errors: string[]; scene: unknown; controls: Record<string, unknown> } }).__lumina;
      return { errors: l?.errors ?? ['the page did not start'], scene: l?.scene ?? null, text: document.body.innerText, controls: Object.keys(l?.controls ?? {}) };
    });
    const shot = async (page: import('playwright-core').Page) => (await page.locator('#root').screenshot({ timeout: 5000 })).toString('base64');

    const first = await open();
    const rest = await state(first.page);
    const run: DisplayRun = {
      errors: Array.from(new Set([...first.pageErrors, ...rest.errors])),
      text: rest.text,
      scene: rest.scene,
      screenshot: await shot(first.page),
      probes: [],
    };
    await first.page.close();

    for (const probe of probes) {
      const { page, pageErrors } = await open();
      const problems: string[] = [];
      for (const [label, value] of Object.entries(probe.set ?? {})) {
        const moved = await page.evaluate(([l, v]) => {
          const c = (window as unknown as { __lumina: { controls: Record<string, { set: (v: unknown) => void }> } }).__lumina.controls[l];
          if (!c) return false;
          c.set(v);
          return true;
        }, [label, value] as [string, unknown]);
        if (!moved) problems.push(`no kit control labelled "${label}"`);
        await page.waitForTimeout(80);
      }
      await page.waitForTimeout(SETTLE_MS);
      const after = await state(page);
      const text = after.text.toLowerCase();
      for (const s of probe.expect?.includes ?? []) if (!text.includes(s.toLowerCase())) problems.push(`page text lacks "${s}"`);
      for (const s of probe.expect?.excludes ?? []) if (text.includes(s.toLowerCase())) problems.push(`page text shows "${s}"`);
      const errors = Array.from(new Set([...pageErrors, ...after.errors]));
      if (errors.length) problems.push(`runtime errors: ${errors.join('; ').slice(0, 300)}`);
      if (problems.some((p) => p.startsWith('no kit control'))) problems.push(`controls on the page: ${after.controls.join(', ') || 'none'}`);
      run.probes.push({ name: probe.name, ok: !problems.length, detail: problems.join('; '), text: after.text.slice(0, 600), screenshot: await shot(page) });
      await page.close();
    }
    return run;
  } finally {
    await context.close();
  }
}
