/**
 * equation-workspace's in-item levers (/add-support-tiers; report qa/eval-reports/equation-workspace-levers-2026-10-09.md).
 * The misses are what `equationMiss` observes in a wrong operation; there is no real-learner evidence.
 *
 * Every mode has the same levers (the modes differ in steps, highlight and whether the learner applies or only names
 * the next step, not in the choice itself):
 * - `inverse_reminder` (help) the panel that says to undo what is attached to the variable with its inverse, on both
 *   sides. In words. The easy tier already draws it (a starting position, declared pulled).
 * - `layer_order` (help) a panel that says the last thing done to the variable comes off first: work from the outside
 *   in. In words.
 * - `sides_marked` (help) the equation on screen split into the variable's side and the other side, in two boxes. It
 *   prints only what the current line already prints.
 * - `worked_model` (help) a worked example on a different equation with the same kinds of steps, every line of it.
 *   Built here, only when every step is an add, subtract, multiply or divide.
 * - `fewer_steps` (simplify) a practice equation with one step fewer, built here with its own menu, same mode.
 *
 * Leak rules (code): the panels, the lever words and the scene facts for the panels carry no digit; the marked sides
 * are the current line's own two sides; the model and the practice equation share no number with the item (its
 * equation, its lines or its solution) and are never the item's equation.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { EquationWorkspaceChallenge, EquationWorkspaceOperation, EquationWorkspaceSolutionStep } from './EquationWorkspace';
import { currentEquation, latexToText, operationParts, type EquationMiss } from './equationWorkspaceDomain';

export const INVERSE_LEVER = 'inverse_reminder';
export const ORDER_LEVER = 'layer_order';
export const SIDES_LEVER = 'sides_marked';
export const MODEL_LEVER = 'worked_model';
export const FEWER_LEVER = 'fewer_steps';

const SIMPLER = '~simpler';
export const isPracticeEquation = (c: Pick<EquationWorkspaceChallenge, 'id'>) => c.id.endsWith(SIMPLER);
export const practiceParent = (id: string) => id.replace(/~simpler$/, '');

export const INVERSE_TEXT = 'Undo whatever is attached to the variable with the inverse operation: addition and subtraction '
  + 'undo each other, and so do multiplication and division. Do it to both sides.';
export const ORDER_TEXT = 'Undo in reverse order: the last thing done to the variable comes off first. Work from the '
  + 'outside in, one layer at a time.';
const SIMPLIFY_FIRST = 'First tidy each side: clear the parentheses, then combine like terms. ';
const TIDY_VERBS = new Set(['distribute', 'expand', 'combine', 'collect', 'simplify']);
/** An item whose path starts by tidying a side (distribute, combine like terms) before any undoing. */
const tidiesFirst = (c: EquationWorkspaceChallenge) =>
  TIDY_VERBS.has(operationParts({ id: c.solutionSteps[0]?.operationId ?? '', label: c.solutionSteps[0]?.operation ?? '' }).verb);
/** The order panel's words for this item: tidy each side first where the path does, then reverse order. No digit. */
export const orderText = (c: EquationWorkspaceChallenge) => (tidiesFirst(c) ? SIMPLIFY_FIRST : '') + ORDER_TEXT;

/** Leak rule for the lever words, the panels and their scene facts: no digit at all. */
export const leverTextLeaks = (text: string) => /\d/.test(text);

// ── sides_marked ─────────────────────────────────────────────────────────

/** The current line split at its one "=": the side holding the variable, and the other. Null when that is not clear. */
export function markedSides(latex: string, variable: string): { variableSide: string; otherSide: string } | null {
  const parts = latex.split('=');
  if (parts.length !== 2 || !variable) return null;
  const has = (s: string) => new RegExp(`(^|[^A-Za-z\\\\])${variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z]|$)`).test(s);
  const [l, r] = parts.map(s => s.trim());
  if (has(l) === has(r)) return null;
  return has(l) ? { variableSide: l, otherSide: r } : { variableSide: r, otherSide: l };
}

/** Leak rule for the marked sides: together they are exactly the current line, nothing added. */
export const sidesLeak = (sides: { variableSide: string; otherSide: string }, latex: string) => {
  const norm = (s: string) => s.replace(/\s+/g, '');
  const [l, r] = latex.split('=').map(norm);
  const a = norm(sides.variableSide), b = norm(sides.otherSide);
  return !((a === l && b === r) || (a === r && b === l));
};

// ── worked_model and fewer_steps: a linear equation built from the item's kinds of steps ──

const LINEAR = new Set(['add', 'subtract', 'multiply', 'divide']);
/** The numbers an item prints anywhere: its equation, every line of its solution, its menu. */
export function itemNumbers(c: EquationWorkspaceChallenge): Set<number> {
  const text = [c.equation, ...c.solutionSteps.map(s => `${s.resultLatex} ${s.operation}`), ...c.availableOperations.map(o => o.label)].join(' ');
  return new Set((text.match(/\d+(\.\d+)?/g) ?? []).map(Number));
}
const numbersIn = (text: string) => (text.match(/\d+(\.\d+)?/g) ?? []).map(Number);

/** Small deterministic hash, so the model and the practice item are the same on every render and in the harness. */
const seedOf = (s: string) => Array.from(s).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

export interface LinearEquation {
  variable: string;
  /** LaTeX of the starting equation. */
  equation: string;
  /** Each undo step: its operation in words, its verb and number, and the line after it (LaTeX). */
  steps: Array<{ operation: string; verb: string; k: number; resultLatex: string }>;
  solution: number;
}

const OP_WORDS: Record<string, (k: number) => string> = {
  subtract: k => `Subtract ${k} from both sides`, add: k => `Add ${k} to both sides`,
  divide: k => `Divide both sides by ${k}`, multiply: k => `Multiply both sides by ${k}`,
};

/**
 * A linear equation whose undo steps are `verbs` in order (e.g. ['subtract', 'divide'] builds `a·y + b = c`), with
 * numbers from 2-19 none of which is in `avoid`, a whole-number solution and whole numbers on every line. Null when
 * no such numbers are found or a verb is not linear.
 */
export function buildLinear(verbs: readonly string[], variable: string, avoid: ReadonlySet<number>, seed: number): LinearEquation | null {
  if (!verbs.length || !verbs.every(v => LINEAR.has(v))) return null;
  const pick = (from: number[], ok: (n: number) => boolean, salt: number) => {
    const free = from.filter(n => !avoid.has(n) && ok(n));
    return free.length ? free[(seed + salt * 7) % free.length] : undefined;
  };
  for (let attempt = 0; attempt < 12; attempt++) {
    const s = seed + attempt * 13;
    const solution = pick([2, 3, 4, 5, 6, 7, 8, 9, 11, 12], () => true, s);
    if (solution === undefined) return null;
    // Build outward: undo step i is the inverse of the forward operation applied at layer i (innermost last).
    let expr = variable, value = solution, ok = true;
    const lines: Array<{ expr: string; value: number }> = [{ expr, value }];
    const ks: number[] = [];
    for (let i = verbs.length - 1; i >= 0; i--) {
      const v = verbs[i];
      const used = new Set([solution, ...ks, ...lines.map(l => l.value)]);
      let k: number | undefined;
      if (v === 'subtract') k = pick([3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17], n => !used.has(n) && !used.has(value + n), s + i);
      else if (v === 'add') k = pick([2, 3, 4, 5, 6, 7, 8, 9], n => n < value && !used.has(n) && !used.has(value - n), s + i);
      else if (v === 'divide') k = pick([2, 3, 4, 5, 6, 7, 8, 9], n => !used.has(n) && !used.has(value * n) && value * n < 200, s + i);
      else k = pick([2, 3, 4, 5, 6, 7, 8, 9], n => value % n === 0 && value / n > 1 && !used.has(n) && !used.has(value / n), s + i);
      if (k === undefined) { ok = false; break; }
      ks.push(k);
      const atom = expr === variable;
      if (v === 'subtract') { expr = `${expr} + ${k}`; value += k; }
      else if (v === 'add') { expr = `${expr} - ${k}`; value -= k; }
      else if (v === 'divide') { expr = atom ? `${k}${variable}` : `${k}(${expr})`; value *= k; }
      else { expr = `\\frac{${expr}}{${k}}`; value /= k; }
      lines.push({ expr, value });
    }
    if (!ok) continue;
    const all = [solution, ...ks, ...lines.map(l => l.value)];
    if (all.some(n => avoid.has(n) || !Number.isInteger(n) || n < 1)) continue;
    // lines[j] is the equation with j layers; undo step i leaves lines[verbs.length - 1 - i].
    const n = verbs.length;
    const steps = verbs.map((verb, i) => {
      const k = ks[n - 1 - i];
      const after = lines[n - 1 - i];
      return { operation: OP_WORDS[verb](k), verb, k, resultLatex: `${after.expr} = ${after.value}` };
    });
    return { variable, equation: `${lines[n].expr} = ${lines[n].value}`, steps, solution };
  }
  return null;
}

/** The kinds of steps an item takes, when every one is linear. */
export function linearVerbs(c: EquationWorkspaceChallenge): string[] | null {
  const verbs = c.solutionSteps.map(s => operationParts({ id: s.operationId, label: s.operation }).verb);
  return verbs.length && verbs.every(v => LINEAR.has(v)) ? verbs : null;
}

/** Leak rule for a built equation (model or practice): not the item's equation, and no number the item prints. */
export function builtLeaks(c: EquationWorkspaceChallenge, built: LinearEquation): boolean {
  const avoid = itemNumbers(c);
  const text = [built.equation, ...built.steps.map(s => `${s.operation} ${s.resultLatex}`)].join(' ');
  return built.equation.replace(/\s+/g, '') === c.equation.replace(/\s+/g, '') || numbersIn(text).some(n => avoid.has(n));
}

/** The worked model: the item's kinds of steps on a different variable and different numbers. */
export function workedModel(c: EquationWorkspaceChallenge): LinearEquation | null {
  const verbs = linearVerbs(c);
  if (!verbs) return null;
  const variable = c.targetVariable === 'y' ? 'n' : 'y';
  const built = buildLinear(verbs, variable, itemNumbers(c), seedOf(c.id));
  return built && !builtLeaks(c, built) ? built : null;
}

/** The model as lines the screen and the tutor read. */
export const modelLines = (m: LinearEquation) =>
  [latexToText(m.equation), ...m.steps.map(s => `${s.operation}: ${latexToText(s.resultLatex)}`)];

/**
 * The practice equation for `c`: one step fewer (the last undo step dropped, so the first move is the same kind), the
 * item's variable, new numbers, and a menu with each step's right operation, its opposite on the same number, and the
 * same operation on the other side's number. Same type as the item. Null when the item has one step, or a step is not
 * linear.
 */
export function fewerSteps(c: EquationWorkspaceChallenge): EquationWorkspaceChallenge | null {
  if (isPracticeEquation(c)) return null;
  const verbs = linearVerbs(c);
  if (!verbs || verbs.length < 2) return null;
  const variable = /^[A-Za-z]$/.test(c.targetVariable) ? c.targetVariable : 'x';
  const built = buildLinear(verbs.slice(0, -1), variable, itemNumbers(c), seedOf(c.id) + 101);
  if (!built || builtLeaks(c, built)) return null;
  const opposite: Record<string, string> = { add: 'subtract', subtract: 'add', multiply: 'divide', divide: 'multiply' };
  const ops = new Map<string, EquationWorkspaceOperation>();
  const op = (verb: string, k: number) => {
    const id = `algebraic_${verb}_${k}`;
    if (!ops.has(id)) ops.set(id, { id, label: OP_WORDS[verb](k), category: verb === 'add' || verb === 'subtract' ? 'arithmetic' : 'algebraic' });
    return id;
  };
  const steps: EquationWorkspaceSolutionStep[] = built.steps.map(s => ({ operation: s.operation, operationId: op(s.verb, s.k), resultLatex: s.resultLatex }));
  const rhs = Number(built.equation.split('=')[1]);
  built.steps.forEach(s => { op(opposite[s.verb], s.k); if (rhs !== s.k) op(s.verb, rhs); });
  // Order the menu by a fixed shuffle, so the first button is not the first step.
  const menu = Array.from(ops.values()).sort((a, b) => seedOf(a.id + c.id) - seedOf(b.id + c.id));
  return {
    id: `${c.id}${SIMPLER}`, type: c.type, targetVariable: variable, equation: built.equation,
    instruction: c.type === 'identify-operation' ? `Choose the first operation to solve for ${variable}.` : `Solve for ${variable}, one step at a time.`,
    solutionSteps: steps, availableOperations: menu,
    ...(c.type === 'identify-operation' ? { correctOperationId: steps[0].operationId } : {}),
  };
}

/** Leak rule for a practice equation: never the item, a shorter path, no number the item prints. */
export function practiceLeaks(parent: EquationWorkspaceChallenge, practice: EquationWorkspaceChallenge): boolean {
  const avoid = itemNumbers(parent);
  return practice.id === parent.id || practice.equation.replace(/\s+/g, '') === parent.equation.replace(/\s+/g, '')
    || practice.solutionSteps.length >= parent.solutionSteps.length || numbersIn(itemNumbersText(practice)).some(n => avoid.has(n));
}
const itemNumbersText = (c: EquationWorkspaceChallenge) =>
  [c.equation, ...c.solutionSteps.map(s => `${s.resultLatex} ${s.operation}`), ...c.availableOperations.map(o => o.label)].join(' ');

// ── declarations ─────────────────────────────────────────────────────────

export interface EquationLeverContext {
  /** The easy tier already draws the inverse reminder: a starting position, declared pulled. */
  reminderShown: boolean;
  /** Solution steps applied so far, for the marked sides of the current line. */
  done: number;
}

export function equationLevers(c: EquationWorkspaceChallenge | null, pulled: readonly string[], ctx: EquationLeverContext): WorkspaceLever[] {
  if (!c || isPracticeEquation(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly EquationMiss[], when: string, does: string,
    on = pulled.includes(id)): WorkspaceLever => ({ id, kind, carrier: 'shown', pulled: on, answers, when, does });
  const model = workedModel(c), practice = fewerSteps(c);
  return [
    lever(INVERSE_LEVER, 'help', ['not_inverse', 'other_operation'],
      'The learner applies the operation that is attached again, or an operation that does not undo anything attached.',
      'Shows a panel under the equation, in words: undo whatever is attached to the variable with the inverse '
        + 'operation (addition and subtraction undo each other, and so do multiplication and division), on both sides. '
        + 'It names no operation in the menu.', ctx.reminderShown || pulled.includes(INVERSE_LEVER)),
    lever(ORDER_LEVER, 'help', ['later_step'],
      'The learner tries to undo an inner layer (a later step) before the outer one.',
      'Shows a panel under the equation, in words: where the equation has parentheses or like terms, tidy each side '
        + 'first; then undo in reverse order, the last thing done to the variable comes off first, from the outside in. '
        + 'It names no operation in the menu.'),
    lever(SIDES_LEVER, 'help', ['wrong_number', 'other_operation'],
      'The learner uses a number from the other side of the equation instead of one attached to the variable.',
      'Splits the current line into two boxes: the side with the variable and the other side. It shows only what the '
        + 'line already shows.'),
    ...(model ? [lever(MODEL_LEVER, 'help', ['later_step', 'not_inverse', 'wrong_number', 'other_operation'],
      'The learner cannot see how the steps go on any equation of this kind.',
      'Shows a worked example on a different equation with the same kinds of steps and different numbers and variable, '
        + 'every line of it. It never works the learner\'s equation.')] : []),
    ...(practice ? [lever(FEWER_LEVER, 'simplify', ['later_step', 'not_inverse', 'wrong_number', 'other_operation'],
      'This equation has too many layers to hold at once.',
      'Opens a practice equation first, with one step fewer and different numbers. It is not graded; the full item '
        + 'comes back after it, blank.')] : []),
  ];
}

/** What the pulled help levers put on screen, for the tutor and JEV. The panels in words; the model is another equation. */
export function leverFacts(c: EquationWorkspaceChallenge | null, pulled: readonly string[], ctx: EquationLeverContext): string {
  if (!c || isPracticeEquation(c)) return '';
  const on = (id: string) => pulled.includes(id);
  const sides = on(SIDES_LEVER) ? markedSides(currentEquation(c, ctx.done), c.targetVariable) : null;
  const model = on(MODEL_LEVER) ? workedModel(c) : null;
  return [
    (ctx.reminderShown || on(INVERSE_LEVER)) && 'Under the equation is a reminder in words: undo what is attached to the variable with the inverse operation, on both sides.',
    on(ORDER_LEVER) && `Under the equation is a panel in words: ${tidiesFirst(c) ? 'first tidy each side (clear the parentheses, then combine like terms), then ' : ''}undo in reverse order, the last thing done to the variable comes off first.`,
    sides && `The current line is split into two boxes: the variable's side (${latexToText(sides.variableSide)}) and the other side (${latexToText(sides.otherSide)}).`,
    model && `A worked example on a different equation is shown: ${modelLines(model).join('; ')}.`,
  ].filter((s): s is string => !!s).join(' ');
}
