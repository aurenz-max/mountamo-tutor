/**
 * The canvas stage (USER 2026-11-09): where a canvas author runs what it wrote, the way a coding agent runs its code.
 * It loads the canvas page in headless Chromium, does what a child could do (tap, drag, set a control, press a key,
 * wait), and reports what the page then says: whether its goal is met, its scene facts, its text, its errors, where
 * its named elements are, and a screenshot.
 *
 * Every step is real input. Nothing here reaches into the page's state, so a playthrough that ends with the goal met
 * is something a child could do.
 *
 * Authoring-time only: students load a finished canvas in a sandboxed iframe and no lesson server needs a browser.
 */
import { existsSync } from 'node:fs';
import type { Browser, Page } from 'playwright-core';

const CHROME_DEFAULT = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const SETTLE_MS = 250;
const MAX_WAIT_MS = 6000;
export const STAGE_WIDTH = 720;

/** One thing a child does. `target` and `to` are CSS selectors (or Playwright's text=...). */
export interface PlayStep {
  do: 'click' | 'drag' | 'set' | 'press' | 'wait';
  target?: string;
  /** drag: where it ends, as an element... */
  to?: string;
  /** ...or as pixels moved from where it starts. */
  dx?: number; dy?: number;
  /** set: a kit control's label and its new value. */
  label?: string; value?: unknown;
  key?: string;
  ms?: number;
  /** Screenshot the stage after this step, under this name, so a reviewer sees the screens between rest and the end. */
  shot?: string;
}

export interface Snapshot {
  /** What the page last reported with lumina.goal; null when it never did. */
  goal: boolean | null;
  scene: unknown;
  text: string;
  errors: string[];
}

export interface PlayResult {
  rest: Snapshot;
  after: Snapshot;
  /** A step that could not be done, in words. */
  stepErrors: string[];
  /** Elements with an id, in page pixels, so the author can aim a drag. */
  boxes: Array<{ id: string; x: number; y: number; w: number; h: number }>;
  png: Buffer;
  /** Screenshots taken after steps that carry `shot`, in step order. */
  shots: Array<{ name: string; png: Buffer }>;
}

const describe = (s: PlayStep) => `${s.do}${s.target ? ` ${s.target}` : ''}${s.label ? ` "${s.label}"` : ''}`;

export class CanvasStage {
  private browser: Promise<Browser | null> | null = null;

  private open(): Promise<Browser | null> {
    this.browser ??= (async () => {
      const exe = process.env.LUMINA_CHROME_PATH || (existsSync(CHROME_DEFAULT) ? CHROME_DEFAULT : undefined);
      if (!exe) return null;
      // Resolved at run time, never bundled: playwright-core is a dev dependency.
      const pkg = 'playwright-core';
      const { chromium } = await import(/* webpackIgnore: true */ /* @vite-ignore */ pkg) as typeof import('playwright-core');
      return chromium.launch({ executablePath: exe, headless: true });
    })();
    return this.browser;
  }

  async close(): Promise<void> { const b = await this.browser; await b?.close(); this.browser = null; }

  /** Load the canvas fresh, do the steps, and report. Throws when the host has no browser. */
  async play(html: string, steps: readonly PlayStep[] = []): Promise<PlayResult> {
    const browser = await this.open();
    if (!browser) throw new Error('no browser on this host: a canvas is authored where Chromium is installed (LUMINA_CHROME_PATH)');
    const context = await browser.newContext({ viewport: { width: STAGE_WIDTH, height: 900 }, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage();
      const pageErrors: string[] = [];
      page.on('pageerror', e => pageErrors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') pageErrors.push(`console: ${m.text()}`); });
      await page.setContent(html, { waitUntil: 'load' });
      await page.waitForTimeout(SETTLE_MS);
      const snap = async (): Promise<Snapshot> => {
        const s = await page.evaluate(() => {
          const l = (window as unknown as { __lumina?: { errors: string[]; scene: unknown; goal: boolean | null } }).__lumina;
          return { goal: l?.goal ?? null, scene: l?.scene ?? null, text: document.body.innerText, errors: l?.errors ?? ['the page did not start'] };
        });
        return { ...s, text: s.text.replace(/\s+/g, ' ').trim().slice(0, 700), errors: Array.from(new Set([...pageErrors, ...s.errors])).map(e => e.slice(0, 300)) };
      };
      const rest = await snap();
      const stepErrors: string[] = [];
      const shots: PlayResult['shots'] = [];
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        try { await this.act(page, step); } catch (e) { stepErrors.push(`step ${i + 1} (${describe(step)}): ${(e instanceof Error ? e.message : String(e)).split('\n')[0].slice(0, 200)}`); }
        await page.waitForTimeout(80);
        if (step.shot) {
          await page.waitForTimeout(SETTLE_MS);
          shots.push({ name: String(step.shot), png: await page.locator('#root').screenshot({ timeout: 5000 }) });
        }
      }
      await page.waitForTimeout(SETTLE_MS);
      const after = await snap();
      const boxes = await page.evaluate(() => Array.from(document.querySelectorAll('#root [id]')).slice(0, 60).map(el => {
        const r = el.getBoundingClientRect();
        return { id: el.id, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) };
      }));
      const png = await page.locator('#root').screenshot({ timeout: 5000 });
      return { rest, after, stepErrors, boxes, png, shots };
    } finally {
      await context.close();
    }
  }

  private async act(page: Page, step: PlayStep): Promise<void> {
    const center = async (selector: string) => {
      const box = await page.locator(selector).first().boundingBox({ timeout: 2000 });
      if (!box) throw new Error(`nothing on the page matches ${selector}`);
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    if (step.do === 'wait') { await page.waitForTimeout(Math.min(MAX_WAIT_MS, Math.max(0, Number(step.ms) || 300))); return; }
    if (step.do === 'press') { await page.keyboard.press(String(step.key ?? 'Enter')); return; }
    if (step.do === 'set') {
      const moved = await page.evaluate(([label, value]) => {
        const c = (window as unknown as { __lumina: { controls: Record<string, { set: (v: unknown) => void }> } }).__lumina.controls[label as string];
        if (!c) return Object.keys((window as unknown as { __lumina: { controls: object } }).__lumina.controls).join(', ') || 'none';
        c.set(value);
        return null;
      }, [step.label, step.value] as [unknown, unknown]);
      if (moved !== null) throw new Error(`no kit control labelled "${String(step.label)}"; the controls are: ${moved}`);
      return;
    }
    if (!step.target) throw new Error('needs a target');
    const from = await center(step.target);
    if (step.do === 'click') { await page.mouse.click(from.x, from.y); return; }
    const to = step.to ? await center(step.to) : { x: from.x + (Number(step.dx) || 0), y: from.y + (Number(step.dy) || 0) };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
  }
}
