/**
 * The kit's look capability (USER 2026-11-08): run an item the way a child meets it, so the author can see what it
 * built and fix it, the way a coding agent runs its code and reads the output.
 *
 *   1. draw the item (`itemHtml`: the same displays the component draws, options in their shown order, no key);
 *   2. screenshot it in headless Chromium (`Looker`);
 *   3. a blind solver that never saw the key answers from the screenshot alone and rates the difficulty;
 *   4. code checks (`shortcutChecks`, `itemErrors`) run beside it.
 *
 * The result is a list of problems in sentences plus the screenshot, which the item loop (`itemLoop.ts`) hands back to
 * the author. Evidence (11-07 probe): revising against this feedback took clean items from 4 to 8 of 18 and shortcuts
 * from 7 to 4, and the blind answers matched the author's key on 18 of 18.
 *
 * Without a browser (no Chromium on the host) the solver reads the item in words instead; the result says so.
 */
import { existsSync } from 'node:fs';
import { ai } from '../geminiClient';
import { priceCall } from '../spend/spendMeter';
import { DISPLAY_CSS, displayHtml, displayWords, esc } from './displays';
import { gradeAnswer, itemErrors, shortcutChecks, type SurfaceAnswer, type SurfaceItem, type Tier } from './surfaces';
import { KIT_MODEL, type LookPlan } from './reviewVariants';

const SOLVER_MODEL = KIT_MODEL;
const CHROME_DEFAULT = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';

// ── Drawing the child's view ────────────────────────────────────────────────

const CHILD_CSS = `body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#0f172a;color:#e2e8f0;width:760px}
.prompt{font-size:18px;font-weight:600;margin:0 0 12px}.stim{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:14px;align-items:flex-start;padding:12px;border-radius:12px;background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.1)}
.stim:empty{display:none}.stim>div{max-width:380px;min-width:160px}.opts{display:flex;flex-wrap:wrap;gap:12px}
.card{border:2px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);border-radius:12px;padding:8px;width:170px;text-align:center}.card .tag{font-weight:700;color:#94a3b8;font-size:13px}
.cats{display:flex;gap:12px;margin-top:14px}.cat{border:2px dashed rgba(255,255,255,.2);border-radius:12px;padding:10px 18px;min-width:120px;text-align:center}
.slots{display:flex;gap:8px;margin-top:14px}.slot{border:2px dashed rgba(255,255,255,.2);border-radius:10px;width:60px;height:40px;display:flex;align-items:center;justify-content:center;color:#94a3b8}
${DISPLAY_CSS}`;

/** The item as the child sees it, as a whole HTML page. Option cards are tagged "Card 1..n" in their stored order. */
export function itemHtml(item: SurfaceItem, before = ''): string {
  const body = `${before}<p class="prompt">${esc(item.prompt)}</p>
<div class="stim">${(item.stimulus ?? []).map(d => `<div>${displayHtml(d)}</div>`).join('')}</div>
<div class="opts">${item.options.map((o, i) => `<div class="card"><div class="tag">Card ${i + 1}</div>${o.display ? displayHtml(o.display) : ''}${o.label ? `<div>${esc(o.label)}</div>` : ''}</div>`).join('')}</div>
${item.surface === 'categorize' ? `<div class="cats">${(item.categories ?? []).map(c => `<div class="cat">${esc(c)}</div>`).join('')}</div>` : ''}
${item.surface === 'order' ? `<div class="slots">${item.options.map((_, i) => `<div class="slot">${i + 1}</div>`).join('')}</div>` : ''}`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CHILD_CSS}</style></head><body>${body}</body></html>`;
}

/** The item in words (no key), for a host with no browser. */
function itemWords(item: SurfaceItem): string {
  return [`Prompt: ${item.prompt}`, ...(item.stimulus ?? []).map(d => `Shown: ${displayWords(d)}`),
    ...item.options.map((o, i) => `Card ${i + 1}: ${[o.label, o.display ? displayWords(o.display) : ''].filter(Boolean).join(', ')}`),
    ...(item.categories ? [`Categories: ${item.categories.join(', ')}`] : [])].join('\n');
}

// ── The browser ─────────────────────────────────────────────────────────────

interface Page { setContent(html: string): Promise<void>; screenshot(o: { fullPage: boolean }): Promise<Buffer>; close(): Promise<void> }
interface Browser { newPage(o: { viewport: { width: number; height: number } }): Promise<Page>; close(): Promise<void> }

/** One headless browser per authoring run. `png` returns null when no browser is available. */
export class Looker {
  private browser: Promise<Browser | null> | null = null;
  private open(): Promise<Browser | null> {
    this.browser ??= (async () => {
      const exe = process.env.LUMINA_CHROME_PATH || (existsSync(CHROME_DEFAULT) ? CHROME_DEFAULT : undefined);
      if (!exe) return null;
      try {
        // Resolved at run time, never bundled: playwright-core is a dev dependency and a host without it looks in words.
        const pkg = 'playwright-core';
        const { chromium } = await import(/* webpackIgnore: true */ pkg) as { chromium: { launch(o: object): Promise<unknown> } };
        return (await chromium.launch({ executablePath: exe, headless: true })) as unknown as Browser;
      } catch (e) {
        console.warn(`[look] no browser: ${(e as Error).message}`);
        return null;
      }
    })();
    return this.browser;
  }
  async html(html: string): Promise<Buffer | null> {
    const b = await this.open();
    if (!b) return null;
    const page = await b.newPage({ viewport: { width: 800, height: 600 } });
    try {
      await page.setContent(html);
      return await page.screenshot({ fullPage: true });
    } finally { await page.close(); }
  }
  png(item: SurfaceItem): Promise<Buffer | null> { return this.html(itemHtml(item)); }
  async close(): Promise<void> { const b = await this.browser; await b?.close(); this.browser = null; }
}

// ── The blind solve ─────────────────────────────────────────────────────────

export interface Solved { answer?: unknown; difficulty?: Tier; shortcut: string | null; issues: string | null; error?: string; skipped?: boolean }
export interface Look {
  /** The screenshot the author is shown; null on a host with no browser. */
  png: Buffer | null;
  solved: Solved;
  agree: boolean;
  /** Problems that send the item back: structure, code shortcuts, a disagreeing solve. */
  blocking: string[];
  /** Problems the author should fix if it can: the solver's shortcut and issue notes, a tier the solver reads differently. */
  advisory: string[];
  /** How long each half took, in seconds, and what the solve cost (estimated USD). */
  shotSeconds: number;
  solveSeconds: number;
  costUsd: number;
}

const nil = (v: unknown) => (v == null || /^(null|none|n\/a)?$/i.test(String(v).trim()) ? null : String(v));

function solverPrompt(item: SurfaceItem, grade: string, seen: boolean): string {
  const n = item.options.map((_, i) => String(i + 1));
  const how = item.surface === 'choose' ? '"answer": one card number'
    : item.surface === 'order' ? '"answer": the card numbers in order, as an array'
    : `"answer": an object from each card number to one of ${JSON.stringify(item.categories)}`;
  return `You are checking a learning item for a ${grade} child. ${seen ? 'The image shows exactly what the child sees.' : 'The item is described below.'} The tutor says: "${item.prompt}"
The option cards are Card ${n.join(', Card ')}.
Solve it${seen ? ' from the image' : ''}. Then judge it.
Return JSON: {${how}, "difficulty_for_grade": "easy"|"medium"|"hard", "shortcut": "how a child could get it right WITHOUT the skill (position, odd one out, one picture more detailed, the words give it away), or null", "issues": "anything wrong: false facts, ambiguous pictures, two right answers, an unreadable drawing, words that do not match the pictures, or null"}`;
}

/** The solver's answer in option ids. */
function toAnswer(item: SurfaceItem, raw: unknown): SurfaceAnswer {
  const idOf = (v: unknown) => item.options[Number(String(v).replace(/card/i, '').trim()) - 1]?.id;
  if (item.surface === 'choose') return { choice: idOf(raw) ?? null };
  if (item.surface === 'order') return { order: Array.isArray(raw) ? raw.map(idOf).filter((x): x is string => !!x) : [] };
  const placed: Record<string, string> = {};
  if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw as Record<string, unknown>)) { const id = idOf(k); if (id) placed[id] = String(v); }
  return { placed };
}

// ── Any item's first screen (the look stage of `runAuthor`) ─────────────────

/** What a child meets first, with no key: a page to screenshot and the same screen in words for a host with no browser. */
export interface LookView {
  ask: string;
  html: string;
  words: string;
  /** How the activity works, so the reader does not report its design as a shortcut. */
  design?: string;
  /** The author drew part of this screen itself: it is shown its own screenshot even when the reader finds nothing. */
  drawn?: boolean;
  /** A key the author stated and code cannot compute: the reader answers blind, and a different answer sends it back (I4). */
  solve?: { how: string; agrees(answer: unknown): boolean; key: string };
  /** What earlier screens of this lesson taught, for a lesson that teaches: the reader reports what is needed and was never taught. */
  taught?: string;
}

/** A surface item as a look view: its screen, its words and the blind solve against its key. */
export function surfaceView(item: SurfaceItem, opts: { before?: string; design?: string } = {}): LookView {
  const shown = [...(item.stimulus ?? []), ...item.options.map(o => o.display)];
  const n = item.options.length;
  const how = item.surface === 'choose' ? `one card number (1-${n})` : item.surface === 'order' ? 'the card numbers in order, as an array'
    : `an object from each card number to one of ${JSON.stringify(item.categories)}`;
  return {
    ask: item.prompt, html: itemHtml(item, opts.before ?? ''), words: itemWords(item), ...(opts.design ? { design: opts.design } : {}),
    drawn: shown.some(d => d?.kind === 'svg'),
    solve: { how, agrees: raw => gradeAnswer(item, toAnswer(item, raw)).correct, key: JSON.stringify(item.key) },
  };
}

export interface ViewReading {
  png: Buffer | null;
  /** What the reader would do, in its words: recorded beside the code's key, never compared. */
  answer: string | null;
  difficulty?: Tier;
  shortcut: string | null;
  issues: string | null;
  /** How the screen misses the lesson's objective, when the look was given one; null when it practises it. */
  offObjective?: string | null;
  /** A word or idea the screen needs and the lesson never taught; only when the view says what was taught. */
  untaught?: string | null;
  /** The reader's blind answer differed from the author's key: the sentence to send back. */
  disagrees?: string | null;
  error?: string;
  costUsd: number;
}

/** A whole page around a primitive's own markup, in the look's dark theme, with the displays' CSS. */
export const childPage = (body: string, css = '') =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${CHILD_CSS}${css}</style></head><body>${body}</body></html>`;

/** A blind reader meets the screen the way the child does: it never sees the key or the author's facts. */
export async function readView(view: LookView, opts: { grade: string; looker: Looker; objective?: string }): Promise<ViewReading> {
  let png: Buffer | null = null;
  try { png = await opts.looker.html(view.html); } catch (e) { console.warn(`[look] no screenshot: ${(e as Error).message}`); }
  const ask = `You are checking a learning activity for a ${opts.grade} child. ${png ? 'The image shows exactly what the child sees first.' : 'The screen is described below.'} The tutor says: "${view.ask}"
${opts.objective ? `The lesson's objective: "${opts.objective}". The teacher chose this topic for this child: a hard word that names it is allowed, and a topic above the usual grade is not a problem to report.\n` : ''}${view.design ? `${view.design}\n` : ''}${view.taught !== undefined ? `Earlier screens of this lesson taught: "${view.taught || 'nothing yet'}".\n` : ''}Work out what you would do to succeed, from only what is on the screen. Then judge it.
Return JSON: {"answer": "what you would do, in a few words", ${view.solve ? `"solved": ${view.solve.how}, ` : ''}"difficulty_for_grade": "easy"|"medium"|"hard", "shortcut": "how a child could succeed WITHOUT the idea being taught (position, odd one out, one picture more detailed, the words give it away), or null", "issues": "anything wrong: false facts, ambiguous or unreadable pictures, words that do not match the pictures or that a child of this grade would not know, or null"${opts.objective ? ', "off_objective": "how succeeding here would NOT practise the lesson\'s objective, or null when it does. A different living thing or example that shows the same idea still practises it."' : ''}${view.taught !== undefined ? ', "untaught": "a word or idea the child must already know to succeed here that is not on this screen, not in the panel shown first, not taught on earlier screens, and not something a child of this grade already knows. Name it. Null when everything needed was taught."' : ''}}`;
  try {
    const parts = png
      ? [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }, { text: ask }]
      : [{ text: `${ask}\n\n${view.words}` }];
    const res = await ai.models.generateContent({ model: SOLVER_MODEL, contents: [{ role: 'user', parts }], config: { responseMimeType: 'application/json' } });
    const j = JSON.parse(res.text ?? '{}') as Record<string, unknown>;
    const tier = String(j.difficulty_for_grade ?? '');
    const disagrees = view.solve && !view.solve.agrees(j.solved)
      ? `a careful reader who saw only the screen answered ${JSON.stringify(j.solved)}, but your key is ${view.solve.key}. The screen may not show what decides it, or two answers fit.` : null;
    return { png, answer: nil(j.answer), ...(['easy', 'medium', 'hard'].includes(tier) ? { difficulty: tier as Tier } : {}), shortcut: nil(j.shortcut), issues: nil(j.issues), ...(opts.objective ? { offObjective: nil(j.off_objective) } : {}), ...(view.taught !== undefined ? { untaught: nil(j.untaught) } : {}), ...(disagrees ? { disagrees } : {}), costUsd: priceCall(SOLVER_MODEL, res.usageMetadata) };
  } catch (e) {
    return { png, answer: null, shortcut: null, issues: null, error: (e as Error).message, costUsd: 0 };
  }
}

/** Run one item the way a child meets it and return what the author must fix. */
export async function lookAt(item: SurfaceItem, opts: { grade: string; looker: Looker; plan?: LookPlan }): Promise<Look> {
  const plan = opts.plan ?? { shot: true, solver: true, tierNotes: true };
  const blocking = itemErrors(item);
  if (blocking.length) return { png: null, solved: { shortcut: null, issues: null }, agree: false, blocking, advisory: [], shotSeconds: 0, solveSeconds: 0, costUsd: 0 };
  blocking.push(...shortcutChecks(item).map(s => `code check: ${s}`));
  const shotStarted = Date.now();
  const png = plan.shot ? await opts.looker.png(item) : null;
  const solveStarted = Date.now();
  if (!plan.solver) {
    return { png, solved: { shortcut: null, issues: null, skipped: true }, agree: false, blocking, advisory: [], costUsd: 0,
      shotSeconds: Math.round((solveStarted - shotStarted) / 100) / 10, solveSeconds: 0 };
  }
  let costUsd = 0;
  let solved: Solved;
  try {
    const parts = png
      ? [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }, { text: solverPrompt(item, opts.grade, true) }]
      : [{ text: `${solverPrompt(item, opts.grade, false)}\n\n${itemWords(item)}` }];
    const res = await ai.models.generateContent({ model: SOLVER_MODEL, contents: [{ role: 'user', parts }], config: { responseMimeType: 'application/json' } });
    costUsd = priceCall(SOLVER_MODEL, res.usageMetadata);
    const j = JSON.parse(res.text ?? '{}') as Record<string, unknown>;
    const tier = String(j.difficulty_for_grade ?? '');
    solved = { answer: j.answer, ...(['easy', 'medium', 'hard'].includes(tier) ? { difficulty: tier as Tier } : {}), shortcut: nil(j.shortcut), issues: nil(j.issues) };
  } catch (e) {
    solved = { shortcut: null, issues: null, error: (e as Error).message };
  }
  const agree = !solved.error && gradeAnswer(item, toAnswer(item, solved.answer)).correct;
  if (!agree && !solved.error)
    blocking.push(`a careful solver who saw only the screen answered ${JSON.stringify(toAnswer(item, solved.answer))}, but your key is ${JSON.stringify(item.key)}. The screen may not show the feature that decides it, or two answers fit.`);
  const advisory = [
    ...(solved.shortcut ? [`shortcut: ${solved.shortcut}`] : []),
    ...(solved.issues ? [`issue: ${solved.issues}`] : []),
    ...(plan.tierNotes && solved.difficulty && solved.difficulty !== item.tier ? [`you aimed at ${item.tier}; a solver rated it ${solved.difficulty} for this grade. Reach ${item.tier} through structure (closer wrong options, a misconception trap, more steps), not more reading.`] : []),
  ];
  return {
    png, solved, agree, blocking, advisory, costUsd,
    shotSeconds: Math.round((solveStarted - shotStarted) / 100) / 10,
    solveSeconds: Math.round((Date.now() - solveStarted) / 100) / 10,
  };
}
