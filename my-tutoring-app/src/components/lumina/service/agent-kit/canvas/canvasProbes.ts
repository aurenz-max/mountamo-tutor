/**
 * Canvas QA probes (USER 2026-11-15): what `scripts/canvas-eval.mjs` measures on a canvas beyond the gate's proof and
 * miss. Two kinds, both on the real stage with real input:
 *
 * - Layout, read from the DOM after a play: overflow past the 720px stage, words too small to read, touch targets
 *   under 44px, words that overlap, text too dim on the stage colour, the stage colour itself.
 * - Shortcuts: does tapping every control once, or random play, meet the goal? A canvas a child can pass by
 *   poking is not measuring the objective.
 *
 * Findings are facts with a severity; the skill (`/canvas-eval`) decides what to heal. Nothing here reads the
 * program's state: a probe sees only what a child's input and the page show.
 */
import type { Page } from 'playwright-core';
import { CANVAS_COLORS } from './canvasStyle';
import type { CanvasStage, PlayStep } from './stage';

export interface Layout {
  rootW: number; rootH: number; scrollW: number;
  stageFill: string | null;
  /** Visible words drawn under 12px on screen. */
  smallText: Array<{ text: string; px: number }>;
  /** Things the child can grab or tap (pointer/grab cursor, buttons, inputs) smaller than 44px on a side. */
  smallTargets: Array<{ id: string; w: number; h: number }>;
  /** Pairs of words whose boxes cover each other. */
  overlaps: Array<[string, string]>;
  /** Words or named elements drawn past the stage edge. */
  offStage: string[];
  /** Controls whose boxes cover each other, so a tap can land on the wrong one. */
  controlOverlaps: Array<[string, string]>;
  /** Words whose colour has under 3:1 contrast on what is drawn behind them. */
  dimText: Array<{ text: string; color: string; ratio: number }>;
  /** Ids of things the child can act on, in page order. */
  interactive: string[];
  /** Every fill and stroke colour drawn, for comparing the proof's end with the miss's. */
  colors: string[];
}

/** Read the page's layout. Runs inside the page, so it is self-contained. */
export function readLayout(page: Page): Promise<Layout> {
  return page.evaluate(() => {
    const root = document.querySelector('#root') as HTMLElement;
    const R = root.getBoundingClientRect();
    const rgb = (c: string): number[] | null => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (m) { const p = m[1].split(',').map(Number); return p.length === 4 && p[3] === 0 ? null : p.slice(0, 3); }
      const h = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (!h) return null;
      const x = h[1].length === 3 ? h[1].split('').map(d => d + d).join('') : h[1];
      return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16));
    };
    const hex = (p: number[]) => '#' + p.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    const lum = (p: number[]) => { const [r, g, b] = p.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    // The stage is the first painted rect outside <defs>, <clipPath>, <mask>, <pattern> and <symbol>.
    const firstRect = (Array.from(root.querySelectorAll('svg rect')) as SVGRectElement[])
      .find(r => !r.closest('defs, clipPath, mask, pattern, symbol') && rgb(getComputedStyle(r).fill)) ?? null;
    const stageFill = firstRect ? (() => { const p = rgb(getComputedStyle(firstRect).fill); return p ? hex(p) : null; })() : null;
    const stageRgb = rgb(stageFill ?? '#0f172a') ?? [15, 23, 42];
    const letters = new RegExp('[\\p{L}\\p{N}]', 'u');
    // A keycap emoji ("1️⃣") holds a digit but is a picture, drawn in its own colours.
    const pictograph = new RegExp('\\p{Extended_Pictographic}|\\u20e3', 'u');
    const pictureChars = new RegExp('[\\p{Extended_Pictographic}\\u20e3\\ufe0f\\p{N}\\s]', 'gu');
    const emojiOnly = (t: string) => !letters.test(t) || (pictograph.test(t) && t.replace(pictureChars, '') === '');
    // A straight line has a zero-height (or zero-width) box and is still drawn, so one side is enough.
    const visible = (el: Element) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return (r.width > 0 || r.height > 0) && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05; };

    // Words: SVG text elements and HTML elements that hold a text node directly.
    const words: Array<{ el: Element; text: string; px: number; color: string; r: DOMRect }> = [];
    for (const el of Array.from(root.querySelectorAll('*'))) {
      const own = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent ?? '').join('').trim();
      if (!own || !visible(el)) continue;
      const cs = getComputedStyle(el);
      let px = parseFloat(cs.fontSize) || 16;
      const svg = (el as SVGGraphicsElement).ownerSVGElement;
      if (svg) px *= svg.getScreenCTM()?.a ?? 1;
      words.push({ el, text: own.slice(0, 40), px: Math.round(px * 10) / 10, color: svg ? cs.fill : cs.color, r: el.getBoundingClientRect() });
    }
    const smallText = words.filter(w => w.px < 12 && !emojiOnly(w.text)).map(w => ({ text: w.text, px: w.px }));
    // What is drawn behind a word: in SVG, the topmost filled shape before it whose box holds its centre; in HTML, the
    // nearest ancestor with a background; else the page.
    const htmlBg = (el: Element | null): number[] => {
      for (let e = el; e; e = e.parentElement) { const p = rgb(getComputedStyle(e).backgroundColor); if (p) return p; }
      return stageRgb;
    };
    const behind = (el: Element, r: DOMRect): number[] => {
      const svg = (el as SVGGraphicsElement).ownerSVGElement;
      if (!svg) return htmlBg(el.parentElement);
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let hit: number[] | null = null;
      for (const sh of Array.from(svg.querySelectorAll('rect, circle, ellipse, path, polygon'))) {
        if (!(sh.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) || sh.closest('defs, clipPath, mask, pattern, symbol')) continue;
        const cs = getComputedStyle(sh), p = rgb(cs.fill);
        if (!p || Number(cs.fillOpacity) * Number(cs.opacity) < 0.5) continue;
        const b = sh.getBoundingClientRect();
        if (cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom) hit = p;
      }
      return hit ?? htmlBg(svg.parentElement);
    };
    const dimText = words.flatMap(w => {
      const p = rgb(w.color); if (!p || emojiOnly(w.text)) return [];
      const a = lum(p), b = lum(behind(w.el, w.r)); const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      return ratio < 3 ? [{ text: w.text, color: hex(p), ratio: Math.round(ratio * 100) / 100 }] : [];
    });
    const overlaps: Array<[string, string]> = [];
    for (let i = 0; i < words.length; i++) for (let j = i + 1; j < words.length; j++) {
      const a = words[i], b = words[j];
      if (a.el.contains(b.el) || b.el.contains(a.el) || emojiOnly(a.text) || emojiOnly(b.text)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > 0 && h > 0 && w * h > 0.3 * Math.min(a.r.width * a.r.height, b.r.width * b.r.height)) overlaps.push([a.text, b.text]);
    }
    const offStage: string[] = [];
    for (const el of [...words.map(w => w.el), ...Array.from(root.querySelectorAll('[id]'))]) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.left < R.left - 2 || r.right > R.right + 2 || r.top < R.top - 2 || r.bottom > R.bottom + 2) offStage.push(el.id ? `#${el.id}` : (el.textContent ?? '').trim().slice(0, 40));
    }
    const interactiveEls = Array.from(root.querySelectorAll('*')).filter(el => {
      if (!visible(el)) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === 'button' || tag === 'input' || tag === 'select') return true;
      const cur = getComputedStyle(el).cursor;
      const parentCur = el.parentElement ? getComputedStyle(el.parentElement).cursor : '';
      return /pointer|grab/.test(cur) && cur !== parentCur; // the element that sets the cursor, not every child under it
    });
    const smallTargets = interactiveEls.map(el => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => Math.min(r.width, r.height) < 43.5)
      .map(({ el, r }) => ({ id: el.id || el.tagName.toLowerCase(), w: Math.round(r.width), h: Math.round(r.height) }));
    const controlOverlaps: Array<[string, string]> = [];
    for (let i = 0; i < interactiveEls.length; i++) for (let j = i + 1; j < interactiveEls.length; j++) {
      const A = interactiveEls[i], B = interactiveEls[j];
      if (A.contains(B) || B.contains(A)) continue;
      const a = A.getBoundingClientRect(), b = B.getBoundingClientRect();
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 0 && h > 0 && w * h > 0.3 * Math.min(a.width * a.height, b.width * b.height)) controlOverlaps.push([A.id || A.tagName.toLowerCase(), B.id || B.tagName.toLowerCase()]);
    }
    const colors = new Set<string>();
    for (const el of Array.from(root.querySelectorAll('svg *'))) {
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      for (const c of [cs.fill, cs.stroke]) { const p = rgb(c); if (p) colors.add(hex(p)); }
    }
    return {
      rootW: Math.round(R.width), rootH: Math.round(R.height), scrollW: document.documentElement.scrollWidth,
      stageFill, smallText, smallTargets, overlaps: overlaps.slice(0, 12), controlOverlaps: controlOverlaps.slice(0, 12), offStage: Array.from(new Set(offStage)).slice(0, 12), dimText,
      interactive: interactiveEls.map(el => el.id).filter(Boolean), colors: Array.from(colors).sort(),
    };
  });
}

export interface Finding { severity: 'blocking' | 'major' | 'minor'; probe: string; detail: string }

const GREENS = /^#(34d399|10b981|22c55e|16a34a|4ade80|059669|00ff00|008000)$/i;
const VERDICT_WORDS = /\b(correct|right!|well done|great job|you did it|perfect|solved|success|wrong|incorrect|try again)\b/i;

/** Turn the rest, proof-end and miss-end layouts of one problem into findings. */
export function layoutFindings(rest: Layout, proof: Layout, miss: Layout, proofText: string, missText: string): Finding[] {
  const f: Finding[] = [];
  const add = (severity: Finding['severity'], probe: string, detail: string) => f.push({ severity, probe, detail });
  if (rest.scrollW > 724) add('major', 'overflow', `the page is ${rest.scrollW}px wide; the stage is 720px`);
  // The frame grows to its page, so a tall stage scrolls the lesson rather than clipping: 640 is the bar, 760 a laptop screen.
  if (rest.rootH > 640) add(rest.rootH > 760 ? 'major' : 'minor', 'height', `the stage is ${rest.rootH}px tall; the bar is 640px`);
  if (rest.stageFill && rest.stageFill.toLowerCase() !== CANVAS_COLORS.stage) add('minor', 'stage-colour', `the first rect is ${rest.stageFill}, the stage colour is ${CANVAS_COLORS.stage}`);
  if (!rest.stageFill) add('minor', 'stage-colour', 'no <svg><rect> stage: the house look is one svg on the stage colour');
  for (const [when, l] of [['rest', rest], ['proof end', proof]] as const) {
    // 12px authored in a viewBox a little wider than the stage draws at 11.9px: that is the guide's floor, not a miss.
    const tinyText = l.smallText.filter(t => t.px < 11);
    if (tinyText.length) add('major', 'small-text', `${when}: ${tinyText.slice(0, 4).map(t => `"${t.text}" ${t.px}px`).join(', ')}${tinyText.length > 4 ? ` (+${tinyText.length - 4})` : ''}`);
    else if (l.smallText.some(t => t.px < 11.5)) add('minor', 'small-text', `${when}: ${l.smallText.slice(0, 4).map(t => `"${t.text}" ${t.px}px`).join(', ')}${l.smallText.length > 4 ? ` (+${l.smallText.length - 4})` : ''}`);
    if (l.overlaps.length) add('major', 'overlap', `${when}: ${l.overlaps.slice(0, 3).map(([a, b]) => `"${a}" over "${b}"`).join(', ')}`);
    if (l.offStage.length) add('major', 'off-stage', `${when}: ${l.offStage.slice(0, 4).join(', ')}`);
    // At rest only, and minor: after a play, things placed in a box or on a terminal overlap by design, and a pile of
    // identical units or two wire ends on one terminal overlap at rest too. The read decides.
    if (when === 'rest' && l.controlOverlaps.length) add('minor', 'control-overlap', `${when}: ${l.controlOverlaps.slice(0, 3).map(([a, b]) => `${a} over ${b}`).join(', ')}`);
    if (l.dimText.length) add('minor', 'dim-text', `${when}: ${l.dimText.slice(0, 3).map(t => `"${t.text}" ${t.color} ${t.ratio}:1`).join(', ')}`);
  }
  const tiny = rest.smallTargets.filter(t => Math.min(t.w, t.h) < 32);
  if (tiny.length) add('major', 'touch-target', `under 32px: ${tiny.slice(0, 5).map(t => `${t.id} ${t.w}x${t.h}`).join(', ')}`);
  else if (rest.smallTargets.length) add('minor', 'touch-target', `under 44px: ${rest.smallTargets.slice(0, 5).map(t => `${t.id} ${t.w}x${t.h}`).join(', ')}`);
  if (!rest.interactive.length) add('major', 'no-controls', 'nothing at rest has a pointer or grab cursor, a button or an input: the child may not see what to touch');
  // A verdict before Check: a green, or a verdict word, that only the proof's end shows.
  const proofOnly = proof.colors.filter(c => !miss.colors.includes(c) && !rest.colors.includes(c) && GREENS.test(c));
  if (proofOnly.length) add('major', 'verdict-colour', `the proof's end draws ${proofOnly.join(', ')} that neither rest nor the miss draws: read the proof screenshot for a success colour`);
  const words = proofText.match(new RegExp(VERDICT_WORDS, 'gi')) ?? [];
  const leaked = words.filter(w => !new RegExp(`\\b${w}\\b`, 'i').test(missText));
  if (leaked.length) add('blocking', 'verdict-words', `the proof's end says ${Array.from(new Set(leaked)).join(', ')} and the miss does not`);
  return f;
}

/** A small seeded random source, so a probe run is repeatable. */
function rng(seed: number) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

export interface ShortcutResult { tapAll: boolean | null; monkeyRuns: number; monkeyMet: number; errors: string[] }

/**
 * Shortcut probes on one problem's page. `tapAll`: tap every control once in page order. Monkey: `runs` random plays
 * of `len` taps and drags over the controls and named places.
 */
export async function shortcuts(stage: CanvasStage, html: string, interactive: string[], named: string[], len: number, runs = 8, seed = 7): Promise<ShortcutResult> {
  const sel = (id: string) => `[id="${id}"]`;
  const errors: string[] = [];
  let tapAll: boolean | null = null;
  if (interactive.length) {
    const r = await stage.play(html, interactive.slice(0, 40).map(id => ({ do: 'click', target: sel(id) }) as PlayStep));
    tapAll = r.after.goal === true;
    errors.push(...r.after.errors);
  }
  const pool = interactive.length ? interactive : named;
  let met = 0;
  if (pool.length) {
    const plays = Array.from({ length: runs }, (_, k) => {
      const rand = rng(seed + k * 101);
      const pick = (a: string[]) => a[Math.floor(rand() * a.length)];
      return Array.from({ length: len }, (): PlayStep => {
        const t = pick(pool), roll = rand();
        if (roll < 0.5) return { do: 'click', target: sel(t) };
        if (roll < 0.8 && named.length) return { do: 'drag', target: sel(t), to: sel(pick(named)) };
        return { do: 'drag', target: sel(t), dx: Math.round((rand() - 0.5) * 400), dy: Math.round((rand() - 0.5) * 300) };
      });
    });
    const results = await Promise.all(plays.map(steps => stage.play(html, steps)));
    for (const r of results) { if (r.after.goal === true) met++; errors.push(...r.after.errors); }
  }
  return { tapAll, monkeyRuns: pool.length ? runs : 0, monkeyMet: met, errors: Array.from(new Set(errors)).slice(0, 4) };
}

export function shortcutFindings(s: ShortcutResult): Finding[] {
  const f: Finding[] = [];
  if (s.errors.length) f.push({ severity: 'blocking', probe: 'monkey-errors', detail: `random play throws: ${s.errors.slice(0, 2).join('; ')}` });
  if (s.tapAll) f.push({ severity: 'major', probe: 'tap-all', detail: 'tapping every control once meets the goal: the child can pass without the idea' });
  // Half or more is a goal a child can stumble into; fewer is noise on 8 runs, but worth a look at the goal's tolerance.
  if (s.monkeyRuns && s.monkeyMet / s.monkeyRuns >= 0.5) f.push({ severity: 'major', probe: 'monkey', detail: `${s.monkeyMet} of ${s.monkeyRuns} random plays meet the goal` });
  else if (s.monkeyMet) f.push({ severity: 'minor', probe: 'monkey', detail: `${s.monkeyMet} of ${s.monkeyRuns} random plays meet the goal: read how wide the goal's tolerance is` });
  return f;
}
