import type { ContentOracle, OracleResult, OracleViolation } from './types';
import {
  buildAnnotatedExampleAuthoringContract,
  validateTextAgainstAuthoringContract,
} from '../../annotated-example/authoring-contract';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pushContractViolations(
  target: OracleViolation[],
  where: string,
  text: string,
  contract: ReturnType<typeof buildAnnotatedExampleAuthoringContract>,
): void {
  for (const violation of validateTextAgainstAuthoringContract(text, contract)) {
    target.push({
      check: violation.code === 'grade1-operation' ? 'operation-family' : 'scope',
      where,
      detail: violation.detail,
    });
  }
}

/**
 * Final-payload oracle for reader-fit 14j.
 *
 * Independence: this reads the rendered problem, solver echo/body, and serialized
 * step chain. It does not inspect the authoring prompt or trust orchestrator
 * diagnostics. The manifest intent and canonical grade arrive independently from
 * the oracle harness query, matching the production registry inputs.
 */
export const annotatedExampleOracle: ContentOracle = {
  componentId: 'annotated-example',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const problem = asRecord(data.problem);
    const solverDebug = asRecord(data.solverDebug);
    const steps = Array.isArray(data.steps) ? data.steps : [];
    const statement = typeof problem?.statement === 'string' ? problem.statement : '';
    const problemEcho = typeof solverDebug?.problemEcho === 'string' ? solverDebug.problemEcho : '';
    const solverBody = typeof solverDebug?.body === 'string' ? solverDebug.body : '';
    const contract = buildAnnotatedExampleAuthoringContract({
      intent: ctx.intent,
      canonicalGrade: ctx.grade,
    });

    if (!statement) {
      violations.push({ check: 'schema', where: 'problem.statement', detail: 'missing problem statement' });
    }
    if (steps.length === 0) {
      violations.push({ check: 'schema', where: 'steps', detail: 'worked example has no serialized steps' });
    }
    if (!problemEcho) {
      violations.push({ check: 'pinned-problem', where: 'solverDebug.problemEcho', detail: 'missing solver PROBLEM echo' });
    } else if (problemEcho !== statement) {
      violations.push({
        check: 'pinned-problem',
        where: 'solverDebug.problemEcho',
        detail: 'solver PROBLEM echo is not byte-faithful to problem.statement',
      });
    }

    if (statement) pushContractViolations(violations, 'problem.statement', statement, contract);
    if (solverBody || steps.length > 0) {
      const studentVisibleMath = steps.map((rawStep) => {
        const step = asRecord(rawStep);
        const annotations = asRecord(step?.annotations);
        return {
          content: step?.content,
          narrative: annotations?.narrative,
          challenge: step?.challenge,
        };
      });
      pushContractViolations(
        violations,
        'solver-and-steps',
        `${solverBody}\n${JSON.stringify(studentVisibleMath)}`,
        contract,
      );
    }

    return {
      violations,
      uncheckedTypes: [],
      checkedChallenges: steps.length,
    };
  },
};
