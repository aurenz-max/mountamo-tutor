/**
 * The engine behind the `set` surface (USER 2026-11-09): the child changes a display until a goal holds, for ANY kit
 * display, with no code per display.
 *
 * A display is already "the agent writes values, code draws". So the agent says which of those values the child can
 * change (`controls`: a number that steps through a range, or numbers put into and out of a list) and what must be true
 * at the end (`goal`: values of the board's own fields, of what code reads off it, or of sums and differences the agent
 * names). This file does the rest for every display: applies a tap, finds the nearest board that meets the goal by
 * searching the controls, refuses a goal that starts true or cannot be reached, and says what the child can do in
 * words for the blind reader.
 *
 * Why not one hand-written board per display: the first `set` (same day) had a facet per display with its own controls
 * and solver, and the author could pick only from the two that existed. That is a menu one level down (I3).
 * A display may still add what only code can know: facts that need geometry (`shares`: parts, equal) and where a mark
 * sits on its drawing. Both are optional, and neither is needed for a display to be a board.
 *
 * Pure: no React, no model.
 */
import { displayErrors, displayLine, displayReading, displaySet, sameValue, type Display } from './displays';

/** One thing the child can change: a number in the board that steps through a range, or numbers toggled in a list field. */
export interface ControlSpec {
  /** A field of the board: "rows", "values[1]", "marks[0].value", "cuts". */
  field: string;
  /** What the child reads beside the control ("rows", "the Dog bar"). */
  label?: string;
  min?: number; max?: number; step?: number;
  /** A dial: stepping past max comes back to min (a clock's hands). */
  wrap?: boolean;
  /** The numbers the child can put into or take out of a list field. */
  toggle?: number[];
}
/** What a fact must be: a value, or a range. */
export type Clause = number | boolean | { min?: number; max?: number };
export type SetGoal = Record<string, Clause>;
/** Facts the author names from the board's numbers. */
export type Derive = Record<string, { sum?: string[]; diff?: string[] }>;
/** The parts of an item this engine reads; a `SurfaceItem` is one. */
export interface SetSpec { board?: Display; controls?: ControlSpec[]; derive?: Derive; setGoal?: SetGoal }

export interface SetAction { id: string; dir?: 1 | -1 }
/** A control as the board draws it. A toggle with x and y sits on the drawing (percent of its box); the rest sit under it. */
export interface SetControl { id: string; label: string; kind: 'toggle' | 'step'; on?: boolean; x?: number; y?: number; size?: number }

const MAX_STATES = 60_000;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// ── Fields of a display, by path ────────────────────────────────────────────

const keys = (path: string) => path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
export const getAt = (o: unknown, path: string): unknown => keys(path).reduce<unknown>((v, k) => (v == null ? undefined : (v as Record<string, unknown>)[k]), o);
export function setAt<T>(o: T, path: string, value: unknown): T {
  const out = JSON.parse(JSON.stringify(o)) as T, ks = keys(path);
  let at = out as unknown as Record<string, unknown>;
  for (const k of ks.slice(0, -1)) at = at[k] as Record<string, unknown>;
  at[ks[ks.length - 1]] = value;
  return out;
}

// ── Controls ────────────────────────────────────────────────────────────────

/** The controls of an item: the author's, or the ones its display comes with (a clock's hands, a shape's cut marks). */
export const setControlSpecs = (s: SetSpec): ControlSpec[] => (s.controls?.length ? s.controls : s.board ? displaySet(s.board).controls?.(s.board) ?? [] : []);

const stepOf = (c: ControlSpec) => (isNum(c.step) && c.step > 0 ? c.step : 1);
const valuesOf = (c: ControlSpec): number[] => { const out: number[] = []; for (let v = c.min!; v <= c.max! + 1e-9; v += stepOf(c)) out.push(Math.round(v * 1e6) / 1e6); return out; };
const listAt = (board: Display, field: string): number[] => { const v = getAt(board, field); return Array.isArray(v) ? v.filter(isNum) : []; };

function controlErrors(board: Display, controls: ControlSpec[]): string[] {
  const e: string[] = [];
  if (!controls.length) return ['set: say what the child can change, in controls (a field of the board and its range)'];
  let states = 1;
  for (const c of controls) {
    const at = getAt(board, c.field);
    if (c.toggle) {
      if (!Array.isArray(at)) e.push(`set: control "${c.field}" toggles numbers in a list, and the board has no list there`);
      else if (!c.toggle.length || c.toggle.length > 14 || !c.toggle.every(isNum) || new Set(c.toggle).size !== c.toggle.length) e.push(`set: control "${c.field}" toggles 1-14 distinct numbers`);
      else states *= 2 ** c.toggle.length;
    } else if (!isNum(at)) e.push(`set: control "${c.field}" is not a number on this board. Name one of the board's own number fields, such as rows, values[1] or marks[0].value`);
    else if (!isNum(c.min) || !isNum(c.max) || c.min >= c.max) e.push(`set: control "${c.field}" needs min and max, with min below max`);
    else if (!valuesOf(c).some(v => sameValue(v, at))) e.push(`set: the board starts with ${c.field} at ${at}, which the control cannot reach (${c.min} to ${c.max} in steps of ${stepOf(c)})`);
    else states *= valuesOf(c).length;
  }
  if (!e.length && states > MAX_STATES) e.push('set: the controls allow too many boards to check. Use fewer controls, a smaller range, or fewer marks');
  return e;
}

// ── Facts and the goal ──────────────────────────────────────────────────────

/** Everything code can say about a board in one state: what it reads, what its display computes, the controlled values, the author's sums. */
export function setFacts(s: SetSpec, board: Display | undefined = s.board): Record<string, number | boolean> {
  if (!board) return {};
  const f: Record<string, number | boolean> = {};
  const shown = displayReading(board);
  if (shown) f.value = shown.value;
  Object.assign(f, displaySet(board).facts?.(board));
  for (const c of setControlSpecs(s)) {
    if (c.toggle) f[`${c.field}.count`] = listAt(board, c.field).length;
    else { const v = getAt(board, c.field); if (isNum(v)) f[c.field] = v; }
  }
  for (const [name, d] of Object.entries(s.derive ?? {})) {
    const nums = (d.sum ?? d.diff ?? []).map(p => getAt(board, p));
    if (nums.length && nums.every(isNum)) f[name] = d.sum ? nums.reduce((a, b) => a + b, 0) : nums.slice(1).reduce((a, b) => a - b, nums[0]);
  }
  return f;
}

/** A goal's fact on a board: a named fact, else any number or yes/no field of the board itself. */
function factAt(s: SetSpec, board: Display, facts: Record<string, number | boolean>, key: string): number | boolean | undefined {
  if (key in facts) return facts[key];
  const v = getAt(board, key);
  return isNum(v) || typeof v === 'boolean' ? v : undefined;
}
const holds = (clause: Clause, v: number | boolean | undefined): boolean => {
  if (v === undefined) return false;
  if (typeof clause === 'object') return isNum(v) && (clause.min === undefined || v >= clause.min - 1e-9) && (clause.max === undefined || v <= clause.max + 1e-9);
  return isNum(clause) && isNum(v) ? sameValue(clause, v) : clause === v;
};

/** The first fact of the goal this board does not have, or null when it meets the goal. */
export function setUnmet(s: SetSpec, board: Display | undefined = s.board): string | null {
  if (!board) return 'board';
  const facts = setFacts(s, board);
  return Object.keys(s.setGoal ?? {}).find(k => !holds(s.setGoal![k], factAt(s, board, facts, k))) ?? null;
}

// ── Moves ───────────────────────────────────────────────────────────────────

const toggleId = (field: string, n: number) => `${field}:${n}`;

/**
 * The board after one tap. A step lands on the next value that leaves a board the display can draw, so the child is
 * never stopped by a value in between (a timeline event stepping past another event's year). A tap with nowhere to
 * land does nothing.
 */
export function setApply(s: SetSpec, board: Display, a: SetAction): Display {
  const [field, n] = a.id.split(':');
  const c = setControlSpecs(s).find(x => x.field === field);
  if (!c) return board;
  let next: Display;
  if (c.toggle) {
    const at = Number(n), list = listAt(board, field);
    if (!c.toggle.includes(at)) return board;
    next = setAt(board, field, (list.includes(at) ? list.filter(x => x !== at) : [...list, at]).sort((x, y) => x - y));
  } else {
    const all = valuesOf(c), i = all.findIndex(v => sameValue(v, getAt(board, field) as number)), dir = a.dir ?? 1;
    if (i < 0) return board;
    for (let k = 1; k < all.length; k++) {
      const j = i + dir * k;
      if (!c.wrap && (j < 0 || j >= all.length)) return board;
      const landed = setAt(board, field, all[((j % all.length) + all.length) % all.length]);
      if (!displayErrors(landed).length) return landed;
    }
    return board;
  }
  return displayErrors(next).length ? board : next;
}

/**
 * The taps that take one board to another, found by making them: each control in turn, the shorter way round a dial.
 * A control that cannot get to its value from here is left where it is, so the caller checks where the taps end.
 */
export function setSteps(s: SetSpec, from: Display, to: Display): SetAction[] {
  const out: SetAction[] = [];
  let now = from;
  for (const c of setControlSpecs(s)) {
    if (c.toggle) {
      const want = listAt(to, c.field);
      for (const n of c.toggle) if (listAt(now, c.field).includes(n) !== want.includes(n)) { const a = { id: toggleId(c.field, n) }, next = setApply(s, now, a); if (next !== now) { out.push(a); now = next; } }
      continue;
    }
    const target = getAt(to, c.field), all = valuesOf(c);
    if (!isNum(target)) continue;
    const i = all.findIndex(v => sameValue(v, getAt(now, c.field) as number)), j = all.findIndex(v => sameValue(v, target));
    const forward = ((j - i) % all.length + all.length) % all.length;
    const first: 1 | -1 = c.wrap ? (forward <= all.length - forward ? 1 : -1) : j >= i ? 1 : -1;
    for (const dir of [first, -first] as Array<1 | -1>) {
      const taps: SetAction[] = [];
      let at = now;
      while (taps.length < all.length && !sameValue(getAt(at, c.field) as number, target)) { const next = setApply(s, at, { id: c.field, dir }); if (next === at) break; at = next; taps.push({ id: c.field, dir }); }
      if (sameValue(getAt(at, c.field) as number, target)) { out.push(...taps); now = at; break; }
    }
  }
  return out;
}

/** Where a list of taps leaves a board. */
export const setWalk = (s: SetSpec, from: Display, taps: readonly SetAction[]): Display => taps.reduce((b, a) => setApply(s, b, a), from);

// ── The solver (I4, I5) ─────────────────────────────────────────────────────

const solved = new Map<string, Display | null>();

/** The board nearest the start that meets the goal, by trying every board the controls can make; null when none does. */
export function setSolve(s: SetSpec): Display | null {
  const board = s.board, controls = setControlSpecs(s);
  if (!board || controlErrors(board, controls).length) return null;
  const memo = JSON.stringify([board, controls, s.derive, s.setGoal]);
  if (solved.has(memo)) return solved.get(memo)!;
  // Every choice of each control, with what it costs in taps from the start.
  const choices: Array<Array<{ apply(b: Display): Display; taps: number }>> = controls.map(c => {
    if (c.toggle) {
      const start = listAt(board, c.field), fixed = start.filter(n => !c.toggle!.includes(n));
      return Array.from({ length: 2 ** c.toggle.length }, (_, mask) => {
        const on = c.toggle!.filter((_, i) => mask & (1 << i));
        return { apply: (b: Display) => setAt(b, c.field, [...fixed, ...on].sort((x, y) => x - y)), taps: c.toggle!.filter(n => on.includes(n) !== start.includes(n)).length };
      });
    }
    const all = valuesOf(c), i = all.findIndex(v => sameValue(v, getAt(board, c.field) as number));
    return all.map((v, j) => ({ apply: (b: Display) => setAt(b, c.field, v), taps: c.wrap ? Math.min(Math.abs(j - i), all.length - Math.abs(j - i)) : Math.abs(j - i) }));
  });
  let best: { board: Display; taps: number } | null = null;
  const walk = (i: number, b: Display, taps: number) => {
    if (best && taps >= best.taps) return;
    if (i === choices.length) { if (taps > 0 && !displayErrors(b).length && !setUnmet(s, b)) best = { board: b, taps }; return; }
    for (const ch of choices[i]) walk(i + 1, ch.taps ? ch.apply(b) : b, taps + ch.taps);
  };
  walk(0, board, 0);
  const out = (best as { board: Display; taps: number } | null)?.board ?? null;
  if (solved.size > 400) solved.clear();
  solved.set(memo, out);
  return out;
}

/** Why a set item cannot run, as sentences the author can act on. */
export function setErrors(s: SetSpec): string[] {
  const board = s.board, goal = s.setGoal ?? {};
  if (!board) return ['set: the item needs a board, the display the child changes'];
  if (displayErrors(board).length) return displayErrors(board).map(x => `board: ${x}`);
  const controls = setControlSpecs(s);
  const e = controlErrors(board, controls);
  if (e.length) return e;
  const facts = setFacts(s, board), known = [...Object.keys(facts)];
  if (!Object.keys(goal).length) return [`set: the goal names at least one fact of the board (${known.join(', ')})`];
  const unknown = Object.keys(goal).filter(k => factAt(s, board, facts, k) === undefined);
  if (unknown.length) return [`set: the goal names ${unknown.join(', ')}, which this board does not have. Its facts are ${known.join(', ')}, and any number field of the board`];
  const stuck = controls.find(c => !c.toggle && setApply(s, board, { id: c.field, dir: 1 }) === board && setApply(s, board, { id: c.field, dir: -1 }) === board);
  if (stuck) return [`set: "${stuck.field}" cannot move from where it starts: every step leaves a board that cannot be drawn. Check its step and range against the display's own rules`];
  if (!setUnmet(s, board)) return ['set: the board already meets the goal before the child does anything'];
  const answer = setSolve(s);
  // The solver tries finished boards; the child gets there one tap at a time, so walk it.
  if (!answer || setUnmet(s, setWalk(s, board, setSteps(s, board, answer)))) return ['set: the child cannot reach this goal with these controls'];
  return [];
}

// ── What the child, the tutor and the reader are given ──────────────────────

/** The controls as the board draws them: marks on the drawing where the display places them, buttons otherwise. */
export function setControls(s: SetSpec, board: Display): SetControl[] {
  const def = displaySet(board);
  return setControlSpecs(s).flatMap((c): SetControl[] => {
    if (!c.toggle) return [{ id: c.field, label: c.label ?? c.field, kind: 'step' }];
    const marks = def.marks?.(board, c.field) ?? [], on = listAt(board, c.field);
    return c.toggle.map(n => {
      const m = marks.find(x => x.n === n);
      return { id: toggleId(c.field, n), label: `${c.label ?? c.field} ${n}`, kind: 'toggle', on: on.includes(n), ...(m ? { x: m.x, y: m.y, size: m.size } : {}) };
    });
  });
}

/** What to look at again when a fact is off. Never a value. */
export function setHint(s: SetSpec, fact: string): string {
  const own = s.board ? displaySet(s.board).hints?.[fact] : undefined;
  if (own) return own;
  const c = setControlSpecs(s).find(x => x.field === fact || `${x.field}.count` === fact);
  return c ? `Look at ${c.label ?? c.field} again.` : fact === 'value' ? 'Look at what the whole picture shows now.' : 'Look at the picture again. Does it match what was asked?';
}

/** What the child can change, in words, for the blind reader. It never says the goal. */
export function setHow(s: SetSpec): string {
  if (!s.board) return '';
  const does = setControlSpecs(s).map(c => (c.toggle
    ? `put any of ${c.toggle.join(', ')} into or out of "${c.field}"`
    : `move "${c.field}" (${c.label ?? c.field}) between ${c.min} and ${c.max} in steps of ${stepOf(c)}${c.wrap ? ', going round' : ''}`));
  return `The picture is this display: ${displayLine(s.board.kind)} The child can: ${does.join('; ')}.`;
}

/** What the author is told about boards, controls and goals. */
export const SET_PROMPT = `A SET ITEM has no options. It has:
  board: any display from the list below, in the state the child starts from.
  controls: what the child can change on it. Each is one of
    {field, label, min, max, step}  a number on the board that the child steps up and down. field is the display's own field: "rows", "tens", "filled", "values[1]" (the second bar), "marks[0].value" (a point on a number line). label is what the child reads beside the buttons.
    {field, label, toggle: [numbers]}  a list on the board that the child puts each number into or out of.
    A clock (its two hands), shares (a mark at every place it can be cut) and a system (every part with min and max) come with controls: leave controls out for them.
  goal: {fact: value} or {fact: {min, max}}, every one of which must hold. A fact is
    a number field of the board ("rows", "values[2]", "hour");
    "value", what code reads off the whole display (a clock's time in minutes after 12, an array's or ten frame's or base ten's count);
    a fact the display works out (shares: parts, equal, rows, columns; system: the id of any rule or part);
    or one you name in derive: {more: {diff: ["values[1]", "values[0]"]}} or {all: {sum: ["values[0]", "values[1]"]}}.
  Any board that meets the goal is right, so a goal on "value" or on a sum has many right answers (12 as 3 rows of 4 or 2 rows of 6; 34 as 3 tens 4 ones or 2 tens 14 ones). Code finds them; you write no key.`;
