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
import { DISPLAY_CSS, displayHtml, displayParts, displaySeen, displayWords, esc, readDisplay } from './displays';
import { getAt, setAt, setControlSpecs, setHow } from './setting';
import { evidenceAsk, surfaceGap, unsupportedAct, type EvidenceSpec } from './evidence';
import { gradeAnswer, itemErrors, shortcutChecks, type SurfaceAnswer, type SurfaceItem, type Tier } from './surfaces';
import { teachWords, type TeachSpec } from './teachSurface';
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
${item.board ? `<div class="stim"><div>${displayHtml(item.board)}</div></div><p class="prompt" style="font-weight:400;font-size:14px">${item.surface === 'point' ? 'The child taps one part of the picture above.' : 'The child changes the picture above by tapping it.'}</p>` : ''}
${item.surface === 'teach' && item.teach ? `<div class="stim"><div style="max-width:560px"><div class="tag" style="font-weight:700;color:#fcd34d;font-size:13px">${esc(item.teach.character)}</div><div style="border:1px solid rgba(252,211,77,.3);background:rgba(251,191,36,.1);border-radius:14px;padding:10px 14px;font-size:16px">&ldquo;${esc(item.teach.holds)}&rdquo;</div></div></div><p class="prompt" style="font-weight:400;font-size:14px">The child explains out loud to ${esc(item.teach.character)}.</p>` : ''}
<div class="opts">${item.options.map((o, i) => `<div class="card"><div class="tag">Card ${i + 1}</div>${o.display ? displayHtml(o.display) : ''}${o.label ? `<div>${esc(o.label)}</div>` : ''}</div>`).join('')}</div>
${item.surface === 'categorize' ? `<div class="cats">${(item.categories ?? []).map(c => `<div class="cat">${esc(c)}</div>`).join('')}</div>` : ''}
${item.surface === 'make' ? '<div class="cats"><div class="cat">Tray: tap a card to put it on</div></div>' : ''}
${item.surface === 'order' ? `<div class="slots">${item.options.map((_, i) => `<div class="slot">${i + 1}</div>`).join('')}</div>` : ''}`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CHILD_CSS}</style></head><body>${body}</body></html>`;
}

/** The item in words (no key), for a host with no browser and for a reader of a whole lesson. */
export function itemWords(item: SurfaceItem): string {
  return [`Prompt: ${item.prompt}`, ...(item.stimulus ?? []).map(d => `Shown: ${displayWords(d)}`),
    ...item.options.map((o, i) => `Card ${i + 1}: ${[o.label, o.display ? displayWords(o.display) : ''].filter(Boolean).join(', ')}`),
    ...(item.categories ? [`Categories: ${item.categories.join(', ')}`] : []),
    ...(item.surface === 'make' ? ['The child taps cards to put them on a tray.'] : []),
    ...(item.surface === 'teach' && item.teach ? teachWords(item.teach) : []),
    ...(item.board ? [item.surface === 'point' ? `The picture the child taps one part of: ${displaySeen(item.board)}` : `The board the child changes: ${displayWords(item.board)}`] : [])].join('\n');
}

// ── The browser ─────────────────────────────────────────────────────────────

interface Page { setContent(html: string): Promise<void>; waitForTimeout(ms: number): Promise<void>; screenshot(o: { fullPage: boolean }): Promise<Buffer>; close(): Promise<void> }
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
      // A page that draws itself with a script (a canvas) has not painted when the load event fires.
      if (/<script/i.test(html)) await page.waitForTimeout(300);
      return await page.screenshot({ fullPage: true });
    } finally { await page.close(); }
  }
  png(item: SurfaceItem): Promise<Buffer | null> { return this.html(itemHtml(item)); }
  async close(): Promise<void> { const b = await this.browser; await b?.close(); this.browser = null; }
}

// ── The blind solve ─────────────────────────────────────────────────────────

export interface Solved { answer?: unknown; difficulty?: Tier; shortcut: string | null; issues: string | null; evidenceGap?: string | null; error?: string; skipped?: boolean }
export interface Look {
  /** The screenshot the author is shown; null on a host with no browser. */
  png: Buffer | null;
  solved: Solved;
  agree: boolean;
  /** Problems that send the item back: structure, code shortcuts, a disagreeing solve. */
  blocking: string[];
  /** Problems the author should fix if it can: the solver's shortcut and issue notes, a tier the solver reads differently. */
  advisory: string[];
  /** How a right answer here would miss the lesson's evidence, when the look was given a spec; null when it earns credit. */
  evidenceGap?: string | null;
  /** How long each half took, in seconds, and what the solve cost (estimated USD). */
  shotSeconds: number;
  solveSeconds: number;
  costUsd: number;
}

const nil = (v: unknown) => (v == null || /^(null|none|n\/a)?$/i.test(String(v).trim()) ? null : String(v));

export function solverPrompt(item: SurfaceItem, grade: string, seen: boolean, evidence?: EvidenceSpec): string {
  const n = item.options.map((_, i) => String(i + 1));
  const ev = evidence ? evidenceAsk(evidence) : null;
  const how = item.surface === 'point' ? `"answer": the name of the part you would tap, copied exactly from ${JSON.stringify(displayParts(item.board))}`
    : item.surface === 'choose' ? '"answer": one card number'
    : item.surface === 'set' ? '"answer": the board as you would leave it, as the same JSON object with your values'
    : item.surface === 'make' ? '"answer": the card numbers you would put on the tray, as an array'
    : item.surface === 'order' ? '"answer": the card numbers in order, as an array'
    : item.surface === 'teach' ? `"answer": what you, as the child, would say to ${item.teach?.character ?? 'the character'} to make the idea clear, in one or two sentences`
    : `"answer": an object from each card number to one of ${JSON.stringify(item.categories)}`;
  return `You are checking a learning item for a ${grade} child. ${seen ? 'The image shows exactly what the child sees.' : 'The item is described below.'} The tutor says: "${item.prompt}"
${item.surface === 'set' ? setAsk(item) : item.surface === 'point' ? 'There are no cards. The child taps one part of the picture.' : item.surface === 'teach' && item.teach ? `There are no cards. ${teachWords(item.teach).join(' ')}` : `The option cards are Card ${n.join(', Card ')}.`}
${item.surface === 'make' ? 'The child taps cards to put them on the tray; more than one set of cards can be right.\n' : ''}${ev ? ev.context : ''}Solve it${seen ? ' from the image' : ''}. Then judge it.
Return JSON: {${how}, "difficulty_for_grade": "easy"|"medium"|"hard", "shortcut": "how a child could get it right WITHOUT the skill (position, odd one out, one picture more detailed, the words give it away), or null", "issues": "anything wrong: false facts, ambiguous pictures, two right answers, an unreadable drawing, words that do not match the pictures, or null"${ev ? `, ${ev.field}` : ''}}`;
}

/** A set item for the reader: the board as data and what the child can change on it. It never says the goal. */
const setAsk = (item: SurfaceItem) => `There are no cards. The child changes a picture, which starts as ${JSON.stringify(item.board, (k, v) => (k === 'scene' ? undefined : v))}. ${setHow(item)} More than one finished picture can be right.`;

/** The solver's answer in option ids. */
function toAnswer(item: SurfaceItem, raw: unknown): SurfaceAnswer {
  const idOf = (v: unknown) => item.options[Number(String(v).replace(/card/i, '').trim()) - 1]?.id;
  if (item.surface === 'teach') return { said: typeof raw === 'string' ? raw : raw == null ? '' : JSON.stringify(raw) };
  if (item.surface === 'point') { const said = String(raw ?? '').trim().toLowerCase(); return { part: displayParts(item.board).find(p => p.trim().toLowerCase() === said) ?? null }; }
  if (item.surface === 'choose') return { choice: idOf(raw) ?? null };
  if (item.surface === 'order') return { order: Array.isArray(raw) ? raw.map(idOf).filter((x): x is string => !!x) : [] };
  if (item.surface === 'set') {
    // Only what the child can change is read from the reader's board; the rest stays the item's own (a model's rules, its drawing).
    const left = readDisplay(raw), start = item.board;
    if (!left || !start || left.kind !== start.kind) return {};
    return { board: setControlSpecs(item).reduce((b, c) => { const v = getAt(left, c.field); return v === undefined ? b : setAt(b, c.field, v); }, start) };
  }
  if (item.surface === 'make') return { made: Array.from(new Set((Array.isArray(raw) ? raw : []).map(idOf).filter((x): x is string => !!x))) };
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
  const shown = [...(item.stimulus ?? []), ...item.options.map(o => o.display), item.board];
  const n = item.options.length;
  const how = item.surface === 'point' ? `the name of the part you would tap, copied exactly from ${JSON.stringify(displayParts(item.board))}` : item.surface === 'choose' ? `one card number (1-${n})` : item.surface === 'set' ? 'the board as you would leave it, as the same JSON object with your values' : item.surface === 'make' ? 'the card numbers you would put on the tray, as an array' : item.surface === 'order' ? 'the card numbers in order, as an array'
    : item.surface === 'teach' ? `what you, as the child, would say to ${item.teach?.character ?? 'the character'}, in one or two sentences`
    : `an object from each card number to one of ${JSON.stringify(item.categories)}`;
  return {
    ask: item.prompt, html: itemHtml(item, opts.before ?? ''), words: itemWords(item), ...(opts.design ? { design: opts.design } : {}),
    drawn: shown.some(d => d?.kind === 'svg'),
    // teach: this sync reading counts the idea's words (`saysIdea`); the item loop's own look judges meaning (`teachAgrees`).
    solve: { how, agrees: raw => gradeAnswer(item, toAnswer(item, raw)).correct, key: item.surface === 'set' ? `any board with ${JSON.stringify(item.setGoal)}` : item.surface === 'make' ? `any set that meets ${JSON.stringify(item.goal)}` : item.surface === 'teach' ? `any wording that means: ${item.key}` : JSON.stringify(item.key) },
  };
}

/**
 * Whether a blind reader's explanation carries a teach item's idea, judged on meaning (the way the tutor judges the
 * child): "they match" carries "both sides are the same", which a word count cannot see. One small call; a failure
 * reads as agreement, so a judge outage never sends an item back.
 */
export async function teachAgrees(t: TeachSpec, said: string): Promise<{ agrees: boolean; costUsd: number; why: string | null }> {
  if (!said.trim()) return { agrees: false, costUsd: 0, why: 'nothing was said' };
  try {
    const res = await ai.models.generateContent({
      model: SOLVER_MODEL,
      contents: [{ role: 'user', parts: [{ text: `A child is explaining something to ${t.character}, who wrongly thinks: "${t.holds}".
The idea the child must get across: "${t.idea}".
The child said: "${said}"
Does what the child said EXPRESS that idea, in any wording (judge the meaning, not the words)? Saying the opposite, agreeing with ${t.character}, naming the topic without saying why, or reading the question back does not.
Return JSON: {"expresses": true|false, "why": "one short sentence"}` }] }],
      config: { responseMimeType: 'application/json' },
    });
    const j = JSON.parse(res.text ?? '{}') as { expresses?: unknown; why?: unknown };
    return { agrees: j.expresses === true, costUsd: priceCall(SOLVER_MODEL, res.usageMetadata), why: nil(j.why) };
  } catch (e) {
    return { agrees: true, costUsd: 0, why: `meaning judge failed: ${(e as Error).message}` };
  }
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

// ── A drawing, against what its author says it shows ────────────────────────

export interface DrawingToRead {
  png: Buffer;
  grade: string;
  /** What the author says the drawing must make visible. */
  shows: string;
  /** The part each numbered pin marks, in pin order; none for a drawing with no pins. */
  pins?: string[];
}
export interface DrawingReading { problems: string[]; seen: string | null; error?: string; costUsd: number }

/** The reader gets the part names sorted, so their order says nothing about which pin is which. */
export function drawingPrompt(d: Pick<DrawingToRead, 'grade' | 'shows' | 'pins'>): string {
  const names = [...(d.pins ?? [])].sort((a, b) => a.localeCompare(b));
  return `You are checking a drawing for a ${d.grade}. You see only the picture, with no caption. Numbered circles, if any, are pins on the parts.
The drawing is meant to make this visible: "${d.shows}"
Be strict. A generic shape that only a caption could identify does not show the thing it stands for.
${names.length ? `The pins mark these parts, in no particular order: ${names.map(n => `"${n}"`).join(', ')}. For each pin, decide which part it marks from what is drawn under it. Set "drawn" to false when nothing under the pin looks like that part and you are guessing.\n` : ''}Return JSON: {"seen": "what is drawn, in one sentence, as a child would say it", "visible": true or false, whether a child looking at this picture could see what it is meant to make visible, "missing": "what would have to be drawn and is not, or null", ${names.length ? '"pins": [{"pin": 1, "part": "the part name, copied exactly", "drawn": true}], ' : ''}"issues": "anything false, cut off or overlapping, or null"}`;
}

const sameName = (a: unknown, b: string) => String(a ?? '').trim().toLowerCase() === b.trim().toLowerCase();

/** The reader's answer as sentences the author can act on. Code compares each pin with the part it really marks. */
export function drawingProblems(j: Record<string, unknown>, d: Pick<DrawingToRead, 'shows' | 'pins'>): string[] {
  const problems: string[] = [];
  if (j.visible === false || j.visible === 'false') {
    const missing = nil(j.missing);
    problems.push(`a reader who saw only the picture could not see what it is meant to show ("${d.shows}"). It saw: ${nil(j.seen) ?? 'nothing it could name'}.${missing ? ` Missing: ${missing}.` : ''}`);
  }
  const read = Array.isArray(j.pins) ? (j.pins as Array<Record<string, unknown>>) : [];
  (d.pins ?? []).forEach((name, i) => {
    const pin = read.find(p => Number(p?.pin) === i + 1);
    if (!pin) return;
    if (pin.drawn === false || pin.drawn === 'false') problems.push(`pin ${i + 1} marks "${name}", but the reader found nothing drawn there that looks like it.`);
    else if (!sameName(pin.part, name)) problems.push(`pin ${i + 1} marks "${name}", but the reader took it for "${String(pin.part)}".`);
  });
  const issues = nil(j.issues);
  if (issues) problems.push(`issue: ${issues}`);
  return problems;
}

/** A separate reader checks a drawing the author has only judged itself. A failed read reports nothing and ships nothing new. */
export async function lookAtDrawing(d: DrawingToRead, timeoutMs = 20_000): Promise<DrawingReading> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const call = ai.models.generateContent({
      model: SOLVER_MODEL,
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/png', data: d.png.toString('base64') } }, { text: drawingPrompt(d) }] }],
      config: { responseMimeType: 'application/json' },
    });
    const res = await Promise.race([call, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('drawing look timed out')), timeoutMs); })]);
    const j = JSON.parse(res.text ?? '{}') as Record<string, unknown>;
    return { problems: drawingProblems(j, d), seen: nil(j.seen), costUsd: priceCall(SOLVER_MODEL, res.usageMetadata) };
  } catch (e) {
    return { problems: [], seen: null, error: (e as Error).message, costUsd: 0 };
  } finally {
    clearTimeout(timer);
  }
}

/** Run one item the way a child meets it and return what the author must fix. */
export async function lookAt(item: SurfaceItem, opts: { grade: string; looker: Looker; plan?: LookPlan; evidence?: EvidenceSpec }): Promise<Look> {
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
      ? [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }, { text: solverPrompt(item, opts.grade, true, opts.evidence) }]
      : [{ text: `${solverPrompt(item, opts.grade, false, opts.evidence)}\n\n${itemWords(item)}` }];
    const res = await ai.models.generateContent({ model: SOLVER_MODEL, contents: [{ role: 'user', parts }], config: { responseMimeType: 'application/json' } });
    costUsd = priceCall(SOLVER_MODEL, res.usageMetadata);
    const j = JSON.parse(res.text ?? '{}') as Record<string, unknown>;
    const tier = String(j.difficulty_for_grade ?? '');
    solved = { answer: j.answer, ...(['easy', 'medium', 'hard'].includes(tier) ? { difficulty: tier as Tier } : {}), shortcut: nil(j.shortcut), issues: nil(j.issues), ...(opts.evidence ? { evidenceGap: nil(j.evidence_gap) } : {}) };
  } catch (e) {
    solved = { shortcut: null, issues: null, error: (e as Error).message };
  }
  // teach: the reader's explanation is judged on meaning, as the tutor judges the child's; a word count would send back a paraphrase.
  const meaning = !solved.error && item.surface === 'teach' && item.teach ? await teachAgrees(item.teach, toAnswer(item, solved.answer).said ?? '') : null;
  if (meaning) costUsd += meaning.costUsd;
  const agree = !solved.error && (meaning ? meaning.agrees : gradeAnswer(item, toAnswer(item, solved.answer)).correct);
  if (!agree && !solved.error)
    blocking.push(item.surface === 'teach'
      ? `a careful reader who saw only the screen would tell ${item.teach?.character} ${JSON.stringify(toAnswer(item, solved.answer).said)}, which does not carry your idea${meaning?.why ? ` (${meaning.why})` : ''}. The prompt or the picture may not make clear what the child is to explain.`
      : item.surface === 'set'
      ? `a careful solver who saw only the screen left the board as ${JSON.stringify(toAnswer(item, solved.answer).board ?? 'something it could not write')}, which does not have your goal's facts ${JSON.stringify(item.setGoal)}. The prompt may not say clearly what to make.`
      : item.surface === 'make'
      ? `a careful solver who saw only the screen put ${JSON.stringify(toAnswer(item, solved.answer).made)} on the tray, which does not meet your goal ${JSON.stringify(item.goal)}. The prompt may not say the goal clearly, or a piece's value cannot be read.`
      : `a careful solver who saw only the screen answered ${JSON.stringify(toAnswer(item, solved.answer))}, but your key is ${JSON.stringify(item.key)}. The screen may not show the feature that decides it, or two answers fit.`);
  // Code's reading of the gap comes first: a surface that cannot collect the act needs no model to say so.
  const evidenceGap = opts.evidence ? surfaceGap(opts.evidence, item.surface) ?? solved.evidenceGap ?? null : undefined;
  // A gap the kit cannot close (no surface for the act) is recorded and never sent back: a revise round cannot fix it.
  const fixable = !!evidenceGap && !!opts.evidence && !unsupportedAct(opts.evidence);
  const advisory = [
    ...(fixable ? [`evidence: ${evidenceGap}`] : []),
    ...(solved.shortcut ? [`shortcut: ${solved.shortcut}`] : []),
    ...(solved.issues ? [`issue: ${solved.issues}`] : []),
    ...(plan.tierNotes && solved.difficulty && solved.difficulty !== item.tier ? [`you aimed at ${item.tier}; a solver rated it ${solved.difficulty} for this grade. Reach ${item.tier} through structure (closer wrong options, a misconception trap, more steps), not more reading.`] : []),
  ];
  return {
    png, solved, agree, blocking, advisory, costUsd, ...(evidenceGap !== undefined ? { evidenceGap } : {}),
    shotSeconds: Math.round((solveStarted - shotStarted) / 100) / 10,
    solveSeconds: Math.round((Date.now() - solveStarted) / 100) / 10,
  };
}
