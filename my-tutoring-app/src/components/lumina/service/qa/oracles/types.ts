/**
 * Content oracles — deterministic, per-primitive "calculation engines" that
 * verify generated content against the primitive's own answer contract.
 *
 * An oracle receives the exact `fullData` a generator produced (the same JSON
 * the component would render) and re-derives the answer INDEPENDENTLY from the
 * data, then checks the shipped answer key agrees. It never calls an LLM and
 * never renders a component — pure functions over untrusted generator output.
 *
 * The independence rule: an oracle must derive correctness the way the
 * COMPONENT judges it (from the data contract), never by copying the
 * generator's own answer computation — a shared wrong assumption would
 * false-pass. See `.claude/skills/oracle-test/SKILL.md`.
 */

export interface OracleContext {
  componentId: string;
  evalMode: string;
  topic: string;
  gradeLevel: string;
  /** Explicit numeric scope ceiling from the harness (?scopeMax=10). Overrides topic parsing. */
  scopeMax?: number;
}

export interface OracleViolation {
  /** Stable check id: 'answer-key-desync' | 'scope' | 'answer-leak' | 'clustering' | 'schema' | ... */
  check: string;
  /** Where in the data: challenge id/index, term id, etc. */
  where: string;
  detail: string;
}

export interface OracleResult {
  violations: OracleViolation[];
  /** Challenge types present in the data that this oracle has no checks for (coverage honesty). */
  uncheckedTypes: string[];
  checkedChallenges: number;
}

export interface ContentOracle {
  componentId: string;
  /** Eval modes this oracle understands. Omit = runs on every mode. */
  modes?: string[];
  verify(data: Record<string, unknown>, ctx: OracleContext): OracleResult;
}
