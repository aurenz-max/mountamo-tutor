/**
 * Equation workspace on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C17).
 *
 * Pure: the component and any probe read the same assignment and scene. A challenge is one equation to solve for a
 * target variable by choosing operations from a menu. In a solving mode (guided-solve, solve, multi-step) every tap is
 * checked by the activity against the next step of the solution path: the right step is applied to both sides and
 * stays (not a commit, unless it leaves the variable alone); any other operation is a wrong answer and is committed.
 * Under identify-operation the learner chooses one operation and presses Check. The tutor is never handed the
 * solution path, a line the learner has not reached, or which menu item is right.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { EquationWorkspaceChallenge, EquationWorkspaceOperation } from './EquationWorkspace';

/** LaTeX as a tutor can read it aloud: `4 \cdot x + 15 = 47` -> `4 × x + 15 = 47`. Display only, never compared. */
export function latexToText(latex: string): string {
  let s = latex;
  for (let i = 0; i < 4; i++) {
    s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
      .replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)');
  }
  return s.replace(/\\cdot|\\times/g, '×').replace(/\\div/g, '÷')
    .replace(/\\left|\\right/g, '').replace(/\\(sin|cos|tan|log|ln)\b/g, '$1')
    .replace(/\\pi\b/g, 'π').replace(/\\theta\b/g, 'θ').replace(/\\,|\\;|\\!/g, ' ')
    .replace(/[{}]/g, '').replace(/\\/g, '').replace(/\s+/g, ' ').trim();
}

/** The operation the item is asking for now: the identify key, or the solution step after `done` applied steps. */
export function expectedOperationId(c: EquationWorkspaceChallenge, done: number): string | undefined {
  return c.type === 'identify-operation' ? c.correctOperationId ?? c.solutionSteps[0]?.operationId : c.solutionSteps[done]?.operationId;
}

/** The equation on screen after `done` applied steps. */
export const currentEquation = (c: EquationWorkspaceChallenge, done: number) =>
  done > 0 ? c.solutionSteps[done - 1]?.resultLatex ?? c.equation : c.equation;

const opLabel = (c: EquationWorkspaceChallenge, id: string | null | undefined) =>
  c.availableOperations.find(o => o.id === id)?.label ?? id ?? '';

export function workspaceAssignment(challenge: EquationWorkspaceChallenge): TeachingAssignment {
  const eq = latexToText(challenge.equation), v = challenge.targetVariable;
  const ask = challenge.type === 'identify-operation'
    ? `Choose the operation to apply next to ${eq} to solve for ${v}, then press Check.`
    : `Solve ${eq} for ${v} by choosing operations from the menu, one step at a time, until ${v} is alone.`;
  const instruction = challenge.instruction?.trim();
  return { id: challenge.id, task: instruction ? `${instruction} ${ask}` : ask, response: 'gesture' };
}

// ── the activity's check ──────────────────────────────────────────────────

/** The verb and operand an operation applies, from its id (`algebraic_subtract_15`) or else its label. */
export function operationParts(op: Pick<EquationWorkspaceOperation, 'id' | 'label'>): { verb: string; operand: string } {
  const parts = op.id.toLowerCase().split('_').filter(Boolean);
  if (parts.length >= 2) return { verb: parts[1], operand: parts.slice(2).join('_') };
  const words = op.label.toLowerCase().replace(/\b(both sides|from|to|by|of|the)\b/g, ' ').split(/\s+/).filter(Boolean);
  return { verb: words[0] ?? '', operand: words.slice(1).join('_') };
}

/** Steps that commute with each other where they sit side by side: combining the variable terms and the constants. */
const COMMUTING = new Set(['combine', 'collect']);
export const COMBINED_LABEL = 'Combine like terms';

/**
 * The item with each run of adjacent combine steps merged into one ("Combine like terms", ending on the run's last
 * line). The generator splits combining into variable terms and constants in an order it picks, and the check is by
 * order, so a learner who combined in the other order was marked wrong for a valid move. The merged step keeps the
 * first id; the run's other ids leave the menu (the identify key follows). Unchanged items come back as the same object.
 */
export function mergeCommutingSteps(c: EquationWorkspaceChallenge): EquationWorkspaceChallenge {
  if (!Array.isArray(c?.solutionSteps) || !Array.isArray(c.availableOperations)) return c;
  const steps: EquationWorkspaceChallenge['solutionSteps'] = [];
  const dropped = new Map<string, string>();
  let runId: string | null = null;
  for (const s of c.solutionSteps) {
    const commuting = COMMUTING.has(operationParts({ id: s.operationId, label: s.operation }).verb);
    if (commuting && runId) {
      steps[steps.length - 1] = { ...steps[steps.length - 1], operation: COMBINED_LABEL, resultLatex: s.resultLatex };
      if (s.operationId !== runId) dropped.set(s.operationId, runId);
      continue;
    }
    runId = commuting ? s.operationId : null;
    steps.push(s);
  }
  if (steps.length === c.solutionSteps.length) return c;
  const merged = new Set(dropped.values());
  const labelFree = !c.availableOperations.some(o => o.label === COMBINED_LABEL && !merged.has(o.id));
  const ops = c.availableOperations.filter(o => !dropped.has(o.id))
    .map(o => (merged.has(o.id) && labelFree ? { ...o, label: COMBINED_LABEL } : o));
  const relabel = (s: EquationWorkspaceChallenge['solutionSteps'][number]) =>
    ({ ...s, operation: ops.find(o => o.id === s.operationId)?.label ?? s.operation });
  return {
    ...c, solutionSteps: steps.map(s => (merged.has(s.operationId) ? relabel(s) : s)), availableOperations: ops,
    ...(c.correctOperationId ? { correctOperationId: dropped.get(c.correctOperationId) ?? c.correctOperationId } : {}),
  };
}

const INVERSE: Record<string, string> = {
  add: 'subtract', subtract: 'add', multiply: 'divide', divide: 'multiply', square: 'sqrt', sqrt: 'square',
};

/**
 * What a wrong operation shows (`TeachingAttempt.miss`, handoff 20), from the catalog's commonStruggles (wrong order,
 * not the operation that undoes) and the menu's distractors:
 * - `later_step`: an operation the solution does later (undoing an inner layer before the outer one);
 * - `not_inverse`: the same operation as the right step's opposite on the same number (adds 15 where 15 must be
 *   subtracted): it does again what is attached instead of undoing it;
 * - `wrong_number`: the right kind of operation on a number that is not the one attached to the variable;
 * - `other_operation`: any other operation.
 */
export type EquationMiss = 'later_step' | 'not_inverse' | 'wrong_number' | 'other_operation';

const MISSES: readonly EquationMiss[] = ['later_step', 'not_inverse', 'wrong_number', 'other_operation'];
export const EQUATION_MISSES_BY_MODE: Record<string, readonly EquationMiss[]> = {
  'guided-solve': MISSES, 'identify-operation': MISSES, solve: MISSES, 'multi-step': MISSES,
};

export const operationCorrect = (c: EquationWorkspaceChallenge, done: number, opId: string) =>
  opId === expectedOperationId(c, done);

export function equationMiss(c: EquationWorkspaceChallenge, done: number, opId: string): EquationMiss | undefined {
  const expectedId = expectedOperationId(c, done);
  if (!expectedId || opId === expectedId) return undefined;
  const from = c.type === 'identify-operation' ? 0 : done;
  if (c.solutionSteps.slice(from).some(s => s.operationId === opId && s.operationId !== expectedId)) return 'later_step';
  const chosen = c.availableOperations.find(o => o.id === opId), expected = c.availableOperations.find(o => o.id === expectedId);
  if (!chosen || !expected) return 'other_operation';
  const a = operationParts(chosen), b = operationParts(expected);
  if (b.operand && a.operand === b.operand && INVERSE[b.verb] === a.verb) return 'not_inverse';
  if (a.verb === b.verb && a.operand !== b.operand) return 'wrong_number';
  return 'other_operation';
}

/** The learner's work in their terms, never the key. */
export function describeEquationWork(c: EquationWorkspaceChallenge, done: number, chosen: string | null, solved = false): string {
  if (c.type === 'identify-operation') return chosen ? `Chose "${opLabel(c, chosen)}"` : 'Nothing chosen yet';
  const applied = c.solutionSteps.slice(0, done).map(s => s.operation);
  const now = latexToText(currentEquation(c, done));
  if (chosen && !operationCorrect(c, done, chosen)) return `Tried "${opLabel(c, chosen)}" on ${now}`;
  if (!applied.length) return 'Nothing applied yet';
  return `${solved ? 'Solved' : 'Applied so far'}: ${applied.join('; ')}. The equation now reads ${now}`;
}

// ── what is drawn ─────────────────────────────────────────────────────────

export interface EquationView {
  /** Solution steps applied so far (solving modes). */
  done: number;
  /** identify-operation: the operation chosen and not yet checked. */
  selected: string | null;
  /** The wrong operation on screen (its feedback), until Try again. */
  lastWrong: string | null;
  /** One menu operation is highlighted as the next step (guided). */
  highlighted: boolean;
  /** The "undo it with the inverse operation" reminder panel. */
  inverseReminder: boolean;
  /** The balanced-state badge. */
  balanceShown: boolean;
  solved: boolean;
}

/** What is drawn and asked: the lines the learner has reached and the menu; never a step to come or the solved value. */
export function workspaceScene(c: EquationWorkspaceChallenge, view: EquationView): WorkspaceScene {
  const identify = c.type === 'identify-operation';
  const done = identify ? 0 : view.done;
  const facts: Record<string, string> = {
    kind: 'equation workspace',
    equation: latexToText(c.equation),
    solveFor: c.targetVariable,
    operations: c.availableOperations.map(o => o.label).join('; '),
    ...(!identify ? {
      stepsApplied: done ? c.solutionSteps.slice(0, done).map(s => s.operation).join('; ') : 'none yet',
      currentEquation: latexToText(currentEquation(c, done)),
    } : {}),
    ...(view.highlighted && !identify ? { highlight: 'one operation in the menu is highlighted as the next step' } : {}),
    ...(view.inverseReminder ? { reminder: 'shown: undo what is attached to the variable with the inverse operation, on both sides' } : {}),
    ...(view.balanceShown ? { balance: 'a Balanced badge says each operation is applied to both sides' } : {}),
    ...(c.knownValues && Object.keys(c.knownValues).length
      ? { knownValues: Object.entries(c.knownValues).map(([k, n]) => `${k} = ${n}`).join(', ') } : {}),
    ...(identify && view.selected ? { selected: `"${opLabel(c, view.selected)}", not yet checked` } : {}),
    learnerWork: describeEquationWork(c, done, view.lastWrong ?? (identify ? view.selected : null), view.solved),
    constraints: identify
      ? 'The learner taps one operation and presses Check; the activity checks it against the next step itself. You cannot tap or press Check.'
      : 'The learner taps an operation in the menu; the activity checks each tap itself: the next step is applied to both '
        + 'sides and its new line appears, any other operation is not applied. The item is finished when the variable is '
        + 'alone. You cannot tap an operation.',
  };
  return { objects: [], facts };
}

// ── the journey row ──────────────────────────────────────────────────────

/** How many solution steps the screen shows applied, from the scene's current equation. */
export function stepsDoneFrom(c: EquationWorkspaceChallenge, currentText: string | undefined): number {
  if (!currentText || c.type === 'identify-operation') return 0;
  for (let k = c.solutionSteps.length; k > 0; k--) if (latexToText(c.solutionSteps[k - 1].resultLatex) === currentText) return k;
  return 0;
}

/**
 * The journey row's taps (`liveJourneySpec.ts`), as operation labels. `correct`: the remaining steps in order (one
 * choice for identify). `wrong`: the item's signature error at the next step: the opposite operation on the same
 * number, else a later step, else the first other operation in the menu.
 */
export function equationHarnessChoices(c: EquationWorkspaceChallenge, done: number, intent: 'correct' | 'wrong'): string[] {
  const expectedId = expectedOperationId(c, done);
  if (intent === 'correct') {
    if (c.type === 'identify-operation') return [opLabel(c, expectedId)];
    return c.solutionSteps.slice(done).map(s => opLabel(c, s.operationId));
  }
  const others = c.availableOperations.filter(o => o.id !== expectedId);
  const pick = others.find(o => equationMiss(c, done, o.id) === 'not_inverse')
    ?? others.find(o => equationMiss(c, done, o.id) === 'later_step') ?? others[0];
  return pick ? [pick.label] : [];
}
