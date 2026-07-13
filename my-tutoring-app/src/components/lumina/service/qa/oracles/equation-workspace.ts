import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Equation-workspace oracle — verifies the pre-built step-by-step solve pool
 * against the component's own judging contract.
 *
 * The component (EquationWorkspace.tsx) judges by OPERATION-ID SEQUENCE, not by
 * a typed value:
 *  - guided-solve / solve / multi-step (handleApplyOperation :293): the picked
 *      operation is correct iff opId === solutionSteps[nextStepIndex].operationId
 *      — the student walks the solutionSteps in order by selecting operations
 *      from availableOperations.
 *  - identify-operation (handleCheckIdentify :342): correct iff selectedAnswer
 *      === correctOperationId (choosing the single next operation).
 *
 * THE INDEPENDENCE RULE: the "answer" here is a SEQUENCE OF OPERATION IDS, and
 * the equations transform through linear / quadratic / trig / calculus algebra —
 * a full symbolic re-solve is not robustly code-derivable, so re-running the
 * generator's CAS would be the shared-assumption false-pass this skill warns
 * against. This oracle instead verifies the CONTRACT the component grades —
 * whether the answer is REACHABLE and SELF-CONSISTENT — from the shipped data,
 * the way knowledge-check verifies structure rather than semantics:
 *  - REACHABILITY: every solutionSteps[i].operationId must resolve to a real
 *    entry in availableOperations. If a required next operation is not in the
 *    menu, the student can NEVER select it — the correct path is unwinnable
 *    (the identical class to vocabulary-explorer's correctIndex-off-by-one:
 *    a key that points at nothing selectable).
 *  - IDENTIFY CONSISTENCY: for identify-operation the next operation IS the
 *    answer, and the generator wires correctOperationId to solutionSteps[0]
 *    .operationId — so a correctOperationId that is absent, unselectable, or
 *    ≠ the first solve step contradicts the solve path the same primitive
 *    teaches (a solve-mode student and an identify-mode student would be graded
 *    against different "next operations").
 *  - TERMINATION: the FINAL resultLatex must ISOLATE the targetVariable (the
 *    variable alone on one side of =). A step list that ends with the variable
 *    still entangled ("2x = 10") never actually solves — the terminal state the
 *    student is marched toward is not a solution.
 * Whether each symbolic step is algebraically valid is /eval-test's call; this
 * oracle guarantees the graded path exists, is selectable, is internally
 * consistent, and ends solved.
 *
 * Checks:
 *  - answer-key-desync :
 *      (a) empty solutionSteps — nothing to solve / auto-complete with no work.
 *      (b) a step operationId is absent from availableOperations (unreachable
 *          correct step — the menu can never produce it).
 *      (c) identify-operation: correctOperationId missing / not in the menu /
 *          ≠ solutionSteps[0].operationId (the identify answer contradicts the
 *          solve path).
 *      (d) the final resultLatex does not isolate the targetVariable — the
 *          "solution" never solves.
 *  - scope             : when ctx.evalMode names one of the four types, every
 *      challenge's type must match it (task identity). No numeric magnitude
 *      ceiling — the equations are symbolic across grade bands (linear→calculus),
 *      with no single operand ceiling to bind.
 *  - answer-leak       : the instruction must not print the solved form (the
 *      final resultLatex, whitespace-normalized) — value-matched on the whole
 *      "var = …" string, so a bare coefficient can't false-match.
 *  - clustering        : the starting equation must spread across the session
 *      (checkAnswerVariety); no byte-identical card (same equation + target).
 *  - schema            : ≥3 challenges (mastery-over-demo); known type; non-empty
 *      instruction / equation / targetVariable; well-formed solutionSteps
 *      (operation / operationId / resultLatex strings) and availableOperations
 *      (unique id, label, category); multi-step ships ≥2 steps.
 *
 * Deliberately NOT checked:
 *  - the algebraic VALIDITY of each symbolic step (that resultLatex[i+1] really
 *    is resultLatex[i] with the operation applied): a CAS re-derivation across
 *    trig/log/radical/calculus is out of scope and belongs to /eval-test.
 *  - identify-operation instruction naming the correct operation LABEL: op
 *    labels ("Divide by 2") legitimately paraphrase the method in a prompt, so
 *    value-matching them false-fires — only the solve-mode final-answer leak is
 *    checked.
 *  - support-tier scaffold flags (showNextStepHint / showInverseReminder /
 *    showBalanceIndicator): display-only; the checker never reads them.
 */

const KNOWN_TYPES = new Set(['guided-solve', 'solve', 'multi-step', 'identify-operation']);
const CATEGORIES = new Set(['arithmetic', 'algebraic', 'trigonometric', 'logarithmic', 'radical']);

const norm = (s: string): string => s.replace(/\s+/g, '');

interface Step { operation: string; operationId: string; resultLatex: string }
interface Op { id: string; label: string; category: string }

function asSteps(v: unknown): Step[] | null {
  if (!Array.isArray(v)) return null;
  const out: Step[] = [];
  for (const s of v) {
    if (typeof s !== 'object' || s === null) return null;
    const r = s as Record<string, unknown>;
    if (typeof r.operation !== 'string' || r.operation.trim() === '' ||
        typeof r.operationId !== 'string' || r.operationId.trim() === '' ||
        typeof r.resultLatex !== 'string' || r.resultLatex.trim() === '') return null;
    out.push({ operation: r.operation, operationId: r.operationId, resultLatex: r.resultLatex });
  }
  return out;
}

function asOps(v: unknown): Op[] | null {
  if (!Array.isArray(v)) return null;
  const out: Op[] = [];
  for (const o of v) {
    if (typeof o !== 'object' || o === null) return null;
    const r = o as Record<string, unknown>;
    if (typeof r.id !== 'string' || r.id.trim() === '' ||
        typeof r.label !== 'string' || r.label.trim() === '' ||
        typeof r.category !== 'string') return null;
    out.push({ id: r.id, label: r.label, category: r.category });
  }
  return out;
}

/** True when `latex` has `variable` alone on one side of the single '=' . */
function isolatesVariable(latex: string, variable: string): boolean {
  const parts = norm(latex).split('=');
  if (parts.length !== 2) return false;
  const v = norm(variable);
  return parts[0] === v || parts[1] === v;
}

export const equationWorkspaceOracle: ContentOracle = {
  componentId: 'equation-workspace',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    const requestedMode = KNOWN_TYPES.has(ctx.evalMode) ? ctx.evalMode : null;
    void parseScopeCeiling; // no numeric scope ceiling for symbolic equations (see header)

    const equations: string[] = [];
    const cardSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const type = String(c.type ?? '');
      if (!KNOWN_TYPES.has(type)) {
        uncheckedTypes.add(type || '(missing type)');
        continue;
      }

      // ── scope: the session must deliver the requested eval mode ──
      if (requestedMode && type !== requestedMode) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `challenge type "${type}" but the objective asked for eval mode "${requestedMode}" — a different task identity`,
        });
      }

      const instruction = typeof c.instruction === 'string' ? c.instruction : '';
      const equation = typeof c.equation === 'string' ? c.equation : '';
      const targetVariable = typeof c.targetVariable === 'string' ? c.targetVariable : '';
      const steps = asSteps(c.solutionSteps);
      const ops = asOps(c.availableOperations);

      if (instruction.trim() === '' || equation.trim() === '' || targetVariable.trim() === '' || !steps || !ops) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `malformed challenge: instruction=${JSON.stringify(c.instruction)} equation=${JSON.stringify(c.equation)} targetVariable=${JSON.stringify(c.targetVariable)} solutionSteps=${steps ? 'ok' : 'bad'} availableOperations=${ops ? 'ok' : 'bad'}`,
        });
        continue;
      }

      // ── schema: unique operation ids + valid categories + a usable menu ──
      const opIds = ops.map((o) => o.id);
      if (new Set(opIds).size !== opIds.length) {
        violations.push({ check: 'schema', where: id, detail: `availableOperations has duplicate ids: [${opIds.join(', ')}]` });
      }
      if (ops.length < 2) {
        violations.push({ check: 'schema', where: id, detail: `only ${ops.length} availableOperation(s) — a selection menu needs ≥2 choices` });
      }
      for (const o of ops) {
        if (!CATEGORIES.has(o.category)) {
          violations.push({ check: 'schema', where: id, detail: `operation "${o.id}" has unknown category "${o.category}"` });
        }
      }

      // ── answer-key-desync (a): there must be steps to solve ──
      if (steps.length === 0) {
        violations.push({ check: 'answer-key-desync', where: id, detail: `solutionSteps is empty — there is no work to grade (the challenge auto-completes with no solving)` });
        continue;
      }
      if (type === 'multi-step' && steps.length < 2) {
        violations.push({ check: 'schema', where: id, detail: `multi-step has only ${steps.length} step — a multi-step solve needs ≥2 steps` });
      }
      checked++;

      // ── answer-key-desync (b): every required step op must be selectable ──
      const opIdSet = new Set(opIds);
      for (let s = 0; s < steps.length; s++) {
        if (!opIdSet.has(steps[s].operationId)) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `solution step ${s + 1} needs operation "${steps[s].operationId}" but it is not in availableOperations [${opIds.join(', ')}] — the student can never select the correct next step (unreachable)`,
          });
        }
      }

      // ── answer-key-desync (c): identify-operation answer consistency ──
      if (type === 'identify-operation') {
        const correctOp = typeof c.correctOperationId === 'string' ? c.correctOperationId : '';
        if (correctOp === '') {
          violations.push({ check: 'answer-key-desync', where: id, detail: `identify-operation has no correctOperationId — nothing to grade against (unwinnable)` });
        } else {
          if (!opIdSet.has(correctOp)) {
            violations.push({ check: 'answer-key-desync', where: id, detail: `correctOperationId "${correctOp}" is not in availableOperations — the correct choice is unselectable` });
          }
          if (correctOp !== steps[0].operationId) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `correctOperationId "${correctOp}" ≠ the first solve step "${steps[0].operationId}" — the identify answer contradicts the solve path`,
            });
          }
        }
      }

      // ── answer-key-desync (d): a full solve must terminate isolated ──
      // (identify-operation ships only the FIRST step — it never fully solves.)
      const finalLatex = steps[steps.length - 1].resultLatex;
      if (type !== 'identify-operation') {
        if (!isolatesVariable(finalLatex, targetVariable)) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `the final step "${finalLatex}" does not isolate "${targetVariable}" (variable alone on one side of =) — the path never actually solves`,
          });
        }
        // ── answer-leak: the instruction must not print the solved form ──
        if (isolatesVariable(finalLatex, targetVariable) && norm(instruction).includes(norm(finalLatex))) {
          violations.push({
            check: 'answer-leak',
            where: id,
            detail: `the instruction states the solved form "${finalLatex}"`,
          });
        }
      }

      equations.push(norm(equation));
      cardSeen.set(`${norm(equation)}|${norm(targetVariable)}`, (cardSeen.get(`${norm(equation)}|${norm(targetVariable)}`) ?? 0) + 1);
    }

    // ── clustering: equations spread; no byte-identical card ──
    const variety = checkAnswerVariety(equations, 'challenges[].equation');
    if (variety) violations.push(variety);
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical equation "${key}" appears ${count}× — a duplicated card`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
