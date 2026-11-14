/**
 * The `system` display (USER 2026-11-09): a working model of anything with a cause and an effect. The author declares
 * the amounts (`parts`) and how each result follows from them (`rules`); code computes every result, draws the model
 * and moves the author's own drawing of it (`scene`) from the values.
 *
 * Why: every other kit display is a picture of values. A lesson on excavators had nothing a child could operate, so the
 * author could only draw one and ask which. As the board of a `set` item this display is the missing act: the child
 * changes the parts, Check runs the model, and the goal is a condition on a result (`setting.ts` needs no code for it).
 *
 * The rule kinds are structure (arithmetic and comparisons). Which machine, which amounts and which rules are the
 * author's content (I12). Results stay hidden until the model is run, so a child cannot step a part until a tick shows.
 *
 * Pure: no React, no model, and no import from `displays.ts` (which registers this).
 */

export interface SystemPart { id: string; label: string; icon?: string; value: number; unit?: string; /** With `max`: the child can change this part. */ min?: number; max?: number; step?: number }
export const SYSTEM_OPS = ['add', 'subtract', 'multiply', 'divide', 'least', 'most', 'at_least', 'more_than', 'equal'] as const;
export type SystemOp = typeof SYSTEM_OPS[number];
export interface SystemRule { id: string; label: string; unit?: string; op: SystemOp; of: Array<string | number> }
export interface SystemDisplay { kind: 'system'; title?: string; parts: SystemPart[]; rules: SystemRule[]; /** The author's drawing, moved by `data-bind` attributes. */ scene?: string; /** True shows the results; otherwise they are "?". */ run?: boolean;
  /** Set by the host of a set board, never by an author: each changeable part gets ◀ ▶ in its own row, and its piece of the scene can be dragged. */
  controls?: boolean }

type Value = number | boolean;
const YES_NO: readonly SystemOp[] = ['at_least', 'more_than', 'equal'];
const TWO: readonly SystemOp[] = ['subtract', 'divide', ...YES_NO];
const MAX_SCENE = 24_000;
// What fits a row of the panel at its font size. A first real run (excavators, 11-09) lost all 4 items to a cap of 28.
const MAX_LABEL = 44, MAX_UNIT = 16;
/** A label the author left out is the id in words, so a missing label never drops an item. */
const labelOf = (label: unknown, id: unknown) => String(label ?? '').trim() || String(id ?? '').replace(/_/g, ' ');
const ID = /^[a-z][a-z0-9_]{0,23}$/;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const r2 = (v: number) => Math.round(v * 100) / 100;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Every part's amount and every rule's result, by id. A rule that cannot be worked out is NaN. */
export function systemValues(d: SystemDisplay): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const p of d.parts ?? []) out[p.id] = p.value;
  for (const r of d.rules ?? []) {
    const n = (r.of ?? []).map(x => (typeof x === 'number' ? x : out[x])).map(x => (finite(x) ? x : NaN));
    const [a, b] = n;
    out[r.id] = r.op === 'add' ? n.reduce((s, x) => s + x, 0) : r.op === 'multiply' ? n.reduce((s, x) => s * x, 1)
      : r.op === 'least' ? Math.min(...n) : r.op === 'most' ? Math.max(...n)
      : r.op === 'subtract' ? a - b : r.op === 'divide' ? (b === 0 ? NaN : a / b)
      : n.some(Number.isNaN) ? NaN : r.op === 'at_least' ? a >= b - 1e-9 : r.op === 'more_than' ? a > b + 1e-9 : Math.abs(a - b) < 1e-9;
  }
  return out;
}

const attrOf = (attrs: string, name: string) => new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`).exec(attrs)?.[2];
const BOUND = /<([a-zA-Z][\w:-]*)((?:\s[^<>]*?)?\sdata-bind\s*=\s*(["'])([\w-]+)\3[^<>]*?)(\/?)>/g;

/** The ids a scene binds to. */
export const sceneBinds = (svg: string): string[] => Array.from(String(svg ?? '').matchAll(BOUND)).map(m => m[4]);

/**
 * The scene with its bound elements moved to the model's values: turned about a pivot, shifted, or drawn only on a yes
 * or a no. A binding to a result that has not been run yet stays at rest (no turn, no shift, not drawn).
 */
export function bindScene(svg: string, values: Record<string, Value>, live: (id: string) => boolean): string {
  const nums = (s?: string) => (s ?? '').split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isFinite);
  return svg.replace(BOUND, (_all, tag: string, attrs: string, _q: string, id: string, close: string) => {
    const v = values[id], on = live(id), n = on && finite(v) ? v : 0;
    const turn = attrOf(attrs, 'data-turn'), move = attrOf(attrs, 'data-move'), show = attrOf(attrs, 'data-show');
    let t = '';
    if (turn !== undefined) { const [px = 0, py = 0] = nums(attrOf(attrs, 'data-pivot')); t += `rotate(${r2(n * (Number(turn) || 0))} ${px} ${py}) `; }
    if (move !== undefined) { const [dx = 0, dy = 0] = nums(move); t += `translate(${r2(n * dx)} ${r2(n * dy)}) `; }
    const hide = show !== undefined && (!on || (v === true || (finite(v) && v > 0)) !== /^(yes|true)$/i.test(show.trim()));
    let out = attrs;
    if (t) { const own = attrOf(out, 'transform'); out = `${out.replace(/\stransform\s*=\s*(["']).*?\1/, '')} transform="${`${t}${own ?? ''}`.trim()}"`; }
    if (hide) out = `${out.replace(/\sdisplay\s*=\s*(["']).*?\1/, '')} display="none"`;
    return `<${tag}${out}${close}>`;
  });
}

export function systemErrors(d: SystemDisplay): string[] {
  const parts = d.parts, rules = d.rules;
  if (!Array.isArray(parts) || parts.length < 1 || parts.length > 6) return ['system: 1-6 parts'];
  if (!Array.isArray(rules) || rules.length < 1 || rules.length > 5) return ['system: 1-5 rules, each one result worked out from the parts'];
  const ids = [...parts.map(p => p.id), ...rules.map(r => r.id)];
  if (ids.some(id => !ID.test(String(id))) || new Set(ids).size !== ids.length) return ['system: every part and rule has its own id, in lower case letters, digits and _ (pressure, lift_force)'];
  const long = [...parts, ...rules].find(x => x.label.length > MAX_LABEL || (x.unit ?? '').length > MAX_UNIT);
  if (long) return [`system: "${long.id}" has a label of ${long.label.length} characters${long.unit ? ` and a unit of ${long.unit.length}` : ''}; a label is at most ${MAX_LABEL} and a unit at most ${MAX_UNIT}`];
  if (parts.some(p => p.icon !== undefined && (!p.icon || p.icon.length > 8))) return ['system: an icon is one emoji'];
  for (const p of parts) {
    if (!finite(p.value)) return [`system: part "${p.id}" needs a number in value`];
    if (p.min === undefined && p.max === undefined) continue;
    if (!finite(p.min) || !finite(p.max) || p.min >= p.max || p.value < p.min || p.value > p.max || (p.step !== undefined && !(finite(p.step) && p.step > 0))) return [`system: part "${p.id}" needs min below max, its value between them, and a step above 0`];
  }
  const numeric = new Set(parts.map(p => p.id));
  for (const r of rules) {
    if (!SYSTEM_OPS.includes(r.op)) return [`system: rule "${r.id}" has op ${String(r.op)}; it is one of ${SYSTEM_OPS.join(', ')}`];
    const of = Array.isArray(r.of) ? r.of : [];
    if (TWO.includes(r.op) ? of.length !== 2 : of.length < 2 || of.length > 4) return [`system: rule "${r.id}" (${r.op}) takes ${TWO.includes(r.op) ? 'exactly 2' : '2-4'} things in "of"`];
    const bad = of.find(x => (typeof x === 'number' ? !finite(x) : !numeric.has(x)));
    if (bad !== undefined) return [`system: rule "${r.id}" uses "${String(bad)}", which is not a number, a part, or an earlier rule that gives a number`];
    if (!YES_NO.includes(r.op)) numeric.add(r.id);
  }
  const values = systemValues(d);
  const broken = rules.find(r => typeof values[r.id] === 'number' && !finite(values[r.id]));
  if (broken) return [`system: rule "${broken.id}" cannot be worked out with these amounts (it divides by zero)`];
  if (d.scene !== undefined) {
    if (!/^\s*<svg[\s>]/i.test(d.scene) || !/<\/svg>\s*$/i.test(d.scene) || d.scene.length > MAX_SCENE) return [`system: scene is one complete <svg>...</svg> element of at most ${MAX_SCENE} characters`];
    const lost = sceneBinds(d.scene).find(id => !ids.includes(id));
    if (lost) return [`system: the scene binds to "${lost}", which is not a part or rule id (${ids.join(', ')})`];
  }
  return [];
}

const amount = (v: Value | undefined, unit?: string) => (typeof v === 'boolean' ? (v ? 'yes' : 'no') : finite(v) ? `${r2(v)}${unit ? ` ${unit}` : ''}` : '?');
const OP_WORDS: Record<SystemOp, (of: string[]) => string> = {
  add: of => of.join(' plus '), multiply: of => of.join(' times '), least: of => `the least of ${of.join(', ')}`, most: of => `the most of ${of.join(', ')}`,
  subtract: of => `${of[0]} minus ${of[1]}`, divide: of => `${of[0]} divided by ${of[1]}`,
  at_least: of => `${of[0]} is at least ${of[1]}`, more_than: of => `${of[0]} is more than ${of[1]}`, equal: of => `${of[0]} equals ${of[1]}`,
};

/** The model in words, for the tutor and a reader with no screenshot: the amounts and the rules, and the results only once it has run. */
export function systemWords(d: SystemDisplay): string {
  const label = (x: string | number) => (typeof x === 'number' ? String(x) : [...d.parts, ...d.rules].find(y => y.id === x)?.label ?? x);
  const values = systemValues(d);
  const rules = d.rules.map(r => `${r.label} ${YES_NO.includes(r.op) ? 'when' : 'is'} ${OP_WORDS[r.op](r.of.map(label))}${d.run ? ` (${amount(values[r.id], r.unit)})` : ''}`);
  return `a working model${d.title ? ` "${d.title}"` : ''}: ${d.parts.map(p => `${p.label} ${amount(p.value, p.unit)}`).join(', ')}. ${rules.join('. ')}.${d.run ? '' : ' The results are hidden until it is run.'}`;
}

/**
 * Ways a model fails to teach as the board of a set item, as sentences the author can act on (I5). The first real run
 * (excavators, 11-09) passed every other check with models that were combination locks: "boom equals 3", a drawing
 * that never moved, and nothing on screen from which a child could work the numbers out.
 */
export function systemShortcuts(d: SystemDisplay, goal: readonly string[]): string[] {
  const flags: string[] = [];
  const changeable = d.parts.filter(p => finite(p.min) && finite(p.max));
  const part = goal.find(k => d.parts.some(p => p.id === k));
  if (part) flags.push(`the goal is the number of a part ("${part}"), so the child is told or guesses a setting. Make the goal a result a rule works out`);
  for (const r of d.rules.filter(x => goal.includes(x.id) && YES_NO.includes(x.op))) {
    const hidden = r.of.find(x => typeof x === 'number');
    if (hidden !== undefined) flags.push(`"${r.label}" is decided by a number that is only inside the rule (${hidden}), so the child can only guess it. Put that amount on the model as a part with no min and max (how deep the trench is, how heavy the rock is) and compare with that part`);
  }
  if (d.scene && changeable.length) {
    const moved = new Set(Array.from(d.scene.matchAll(BOUND)).filter(m => attrOf(m[2], 'data-turn') !== undefined || attrOf(m[2], 'data-move') !== undefined).map(m => m[4]));
    if (!changeable.some(p => moved.has(p.id))) flags.push(`the drawing does not move when the child changes a part. Bind the piece that ${changeable.map(p => `"${p.id}"`).join(' or ')} moves: data-bind with data-turn and data-pivot, or with data-move`);
  }
  return flags;
}

const INK = { text: '#e2e8f0', muted: '#94a3b8', line: 'rgba(255,255,255,0.18)', track: 'rgba(255,255,255,0.1)', cyan: '#22d3ee', amber: '#fbbf24', yes: '#34d399', no: '#f87171' };

/** The model drawn: the author's scene moved to the values, then a row per part and a row per result. */
export function systemDrawn(d: SystemDisplay, sanitize: (svg: string) => string): string {
  const values = systemValues(d), run = d.run === true, ruleIds = new Set(d.rules.map(r => r.id));
  const W = 420, ROW = 32, RULE = 42, top = d.title ? 28 : 8, gap = 22;
  const H = top + d.parts.length * ROW + gap + d.rules.length * RULE + 6;
  const label = (x: string | number) => (typeof x === 'number' ? String(x) : [...d.parts, ...d.rules].find(y => y.id === x)?.label ?? x);
  const live = (p: SystemPart) => d.controls === true && finite(p.min) && finite(p.max);
  let g = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px" role="${d.controls ? 'group' : 'img'}" aria-label="${esc(d.title ?? 'a working model')}">`;
  if (d.title) g += `<text x="${W / 2}" y="18" text-anchor="middle" font-size="13" font-weight="600" fill="${INK.text}">${esc(d.title)}</text>`;
  d.parts.forEach((p, i) => {
    const y = top + i * ROW + ROW / 2;
    g += `<text x="10" y="${y + 5}" font-size="16">${esc(p.icon ?? '')}</text><text x="${p.icon ? 36 : 10}" y="${y + 4}" font-size="12" fill="${INK.text}">${esc(p.label)}</text>`;
    // The bar sits beside a short label; a long one takes its room.
    const on = live(p), bx = on ? 230 : 212, bw = on ? 84 : 110;
    if (finite(p.min) && finite(p.max) && p.label.length <= 26) {
      const fill = Math.max(0, Math.min(1, (p.value - p.min) / (p.max - p.min)));
      g += `<rect x="${bx}" y="${y - 5}" width="${bw}" height="10" rx="5" fill="${INK.track}"/><rect x="${bx}" y="${y - 5}" width="${r2(Math.max(6, bw * fill))}" height="10" rx="5" fill="${INK.cyan}"/>`;
    }
    // The child's controls sit in the part's own row, beside its bar, not in a row of buttons under the drawing.
    if (on) {
      const step = (x: number, dir: 1 | -1) => {
        const atEnd = dir < 0 ? p.value <= p.min! : p.value >= p.max!;
        return `<g data-step="parts[${i}].value" data-dir="${dir}" role="button" tabindex="0" aria-label="${esc(`${p.label} ${dir < 0 ? 'back' : 'forward'}`)}" style="cursor:pointer;opacity:${atEnd ? 0.35 : 1}">`
          + `<rect x="${x - 16}" y="${y - 15}" width="32" height="30" fill="#000" fill-opacity="0"/>`
          + `<circle cx="${x}" cy="${y}" r="12" fill="rgba(34,211,238,0.12)" stroke="${INK.cyan}" stroke-width="1.5"/>`
          + `<path d="${dir < 0 ? `M${x + 3} ${y - 5} L${x - 4} ${y} L${x + 3} ${y + 5} Z` : `M${x - 3} ${y - 5} L${x + 4} ${y} L${x - 3} ${y + 5} Z`}" fill="${INK.cyan}"/></g>`;
      };
      g += step(212, -1) + step(332, 1);
    }
    g += `<text x="${W - 10}" y="${y + 4}" font-size="13" font-weight="600" text-anchor="end" fill="${INK.text}">${esc(amount(p.value, p.unit))}</text>`;
  });
  const mid = top + d.parts.length * ROW + gap / 2;
  g += `<line x1="10" x2="${W - 10}" y1="${mid}" y2="${mid}" stroke="${INK.line}"/><path d="M${W / 2 - 7} ${mid - 3} L${W / 2 + 7} ${mid - 3} L${W / 2} ${mid + 6} Z" fill="${INK.muted}"/>`;
  d.rules.forEach((r, i) => {
    const y = top + d.parts.length * ROW + gap + i * RULE + RULE / 2, v = values[r.id];
    // The rule is on the screen in words: a child works a result out from it, and cannot from a label alone.
    g += `<text x="10" y="${y - 3}" font-size="12" fill="${INK.amber}">${esc(r.label)}</text><text x="10" y="${y + 11}" font-size="10" fill="${INK.muted}">${esc(`${YES_NO.includes(r.op) ? 'when' : '='} ${OP_WORDS[r.op](r.of.map(label))}`)}</text>`;
    const shown = !run ? '?' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : amount(v, r.unit);
    const color = !run ? INK.muted : typeof v === 'boolean' ? (v ? INK.yes : INK.no) : INK.text;
    const pw = Math.max(34, shown.length * 8 + 16);
    g += `<rect x="${W - 10 - pw}" y="${y - 11}" width="${pw}" height="22" rx="11" fill="none" stroke="${color}"/><text x="${W - 10 - pw / 2}" y="${y + 4}" font-size="13" font-weight="600" text-anchor="middle" fill="${color}">${esc(shown)}</text>`;
  });
  g += '</svg>';
  let drawn = d.scene ? bindScene(sanitize(d.scene), values, id => run || !ruleIds.has(id)) : '';
  // A piece the author bound to a changeable part (data-move or data-turn) is a handle: the child drags it along its own path.
  if (drawn && d.controls) {
    drawn = drawn.replace(BOUND, (all, tag: string, attrs: string, _q: string, id: string, close: string) => {
      const at = d.parts.findIndex(p => p.id === id);
      if (at < 0 || !live(d.parts[at]) || (attrOf(attrs, 'data-move') === undefined && attrOf(attrs, 'data-turn') === undefined)) return all;
      return `<${tag}${attrs} data-drag="parts[${at}].value" role="slider" tabindex="-1" aria-label="${esc(`drag ${d.parts[at].label}`)}" aria-valuenow="${d.parts[at].value}"${close}>`;
    });
  }
  const scene = drawn ? `<div class="ks-svg" style="margin-bottom:6px;touch-action:${d.controls ? 'none' : 'auto'}">${drawn}</div>` : '';
  return `<div class="ks-system" style="max-width:${W}px">${scene}${g}</div>`;
}

/** As a `set` board: every rule and part is a fact a goal can name, and a part with a range is a control. */
export const SYSTEM_SET = {
  facts: (d: SystemDisplay) => Object.fromEntries(Object.entries(systemValues(d)).filter(([, v]) => typeof v === 'boolean' || finite(v))),
  controls: (d: SystemDisplay) => d.parts.flatMap((p, i) => (finite(p.min) && finite(p.max) ? [{ field: `parts[${i}].value`, label: p.label, min: p.min, max: p.max, step: p.step ?? 1 }] : [])),
};

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v));
const list = (v: unknown): Array<Record<string, unknown>> => (Array.isArray(v) ? v : []).map(x => (x ?? {}) as Record<string, unknown>);

export function readSystem(raw: Record<string, unknown>): SystemDisplay {
  const opt = (x: Record<string, unknown>, k: string) => (x[k] === undefined || x[k] === null ? {} : { [k]: num(x[k]) });
  return {
    kind: 'system', ...(text(raw.title) ? { title: text(raw.title) } : {}),
    parts: list(raw.parts).map(p => ({ id: String(p.id ?? ''), label: labelOf(p.label, p.id), ...(text(p.icon) ? { icon: text(p.icon) } : {}), value: num(p.value), ...(text(p.unit) ? { unit: text(p.unit) } : {}), ...opt(p, 'min'), ...opt(p, 'max'), ...opt(p, 'step') })),
    rules: list(raw.rules).map(r => ({ id: String(r.id ?? ''), label: labelOf(r.label, r.id), ...(text(r.unit) ? { unit: text(r.unit) } : {}), op: String(r.op ?? '') as SystemOp, of: (Array.isArray(r.of) ? r.of : []).map(x => (typeof x === 'number' ? x : String(x))) })),
    ...(text(raw.scene) ? { scene: text(raw.scene) } : {}), ...(raw.run === true ? { run: true } : {}),
  };
}

export const SYSTEM_PROMPT = `{kind:"system", title, parts:[{id, label, icon:"one emoji" (optional), value, unit (optional), min, max, step}], rules:[{id, label, unit (optional), op:"add"|"subtract"|"multiply"|"divide"|"least"|"most"|"at_least"|"more_than"|"equal", of:[2-4 part ids, earlier rule ids or numbers]}], scene:"<svg ...>" (optional), run:true to show the results}: a working model of anything with a cause and an effect (a machine, a ramp, a circuit, a recipe, a garden, a shop). parts are its amounts; give min and max to each part the child may change. Each rule works one result out from parts, earlier rules or numbers; at_least, more_than and equal give yes or no ({id:"lifts", label:"Lifts the rock", op:"at_least", of:["force","load"]}). Code prints each rule in words under its result and shows the result as "?" until the model is run, so the child works it out from the amounts on the model. A yes/no result compares with a part on the model (a fixed part with no min and max: the rock's weight, the trench's depth), never with a bare number. As the board of a set item the child changes the parts and Check runs it: leave controls out, and put a result in the goal ({lifts: true}, {reach: {min: 6}}). Labels are a few words. scene is your plain side-view drawing of the thing, a dozen shapes at most and under 1500 characters, and code moves it: on an element put data-bind="a part or rule id" with data-turn="degrees for each 1" and data-pivot="x,y", or data-move="dx,dy" (for each 1), or data-show="yes"|"no" (drawn only when that yes/no result is run and is that). Bind the piece that each changeable part moves, so the drawing answers every tap. Use the topic's real rules with small whole numbers a child of the grade can work out.`;
