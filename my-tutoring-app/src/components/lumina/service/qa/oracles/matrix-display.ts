import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Matrix-display oracle — verifies the pre-built matrix challenge pool against
 * the component's own judging contract.
 *
 * The component (MatrixDisplay.tsx, handleCheck :549-580) chooses its grading
 * path from ONE field:
 *   if (expectedScalar !== undefined)  → SCALAR path: correct =
 *       |parseFloat(input) − expectedScalar| < 1e-6            (determinant)
 *   else if (expectedMatrix)           → MATRIX path: EVERY cell must satisfy
 *       |parseFloat(cell) − expectedMatrix[i][j]| < 1e-6       (all other ops)
 * The source matrices (values, secondMatrix.values) are what the student SEES
 * (MatrixRenderer), and the operation is what they compute on them.
 *
 * THE INDEPENDENCE RULE: the shipped key is expectedScalar / expectedMatrix,
 * pre-computed by the generator's own transpose/add/subtract/multiply/det/inverse
 * helpers. This oracle RE-DERIVES the result from the DISPLAYED source matrices
 * with its own arithmetic (shoelace-style: transpose by index swap, element-wise
 * add/subtract, row·column dot products, ad−bc / Sarrus determinant, (1/det)·
 * [[d,−b],[−c,a]] inverse) and checks the shipped key agrees. It never re-uses
 * the generator's helper outputs — a generator whose helper and displayed source
 * drift (a transpose that keeps the original shape, a product built from the
 * wrong inner dimension, a determinant off by a sign) is the correct-answer-
 * marked-wrong class this oracle exists to catch.
 *
 * A second, subtler desync the oracle checks is the GRADING PATH itself: the
 * component picks scalar-vs-matrix purely from `expectedScalar !== undefined`,
 * not from challengeType. A non-determinant op that ships an expectedScalar is
 * graded as a scalar — the whole result matrix the student fills is IGNORED; a
 * determinant that ships no expectedScalar falls to the matrix path and can
 * never be marked correct. Both are unwinnable and both are flagged.
 *
 * Checks:
 *  - answer-key-desync :
 *      (a) determinant: expectedScalar ≠ det(values) (2×2 ad−bc / 3×3 Sarrus).
 *      (b) matrix op: expectedMatrix ≠ the re-derived result (dimension or any
 *          cell), i.e. the student computing the DISPLAYED source is marked wrong.
 *      (c) grading-path: a non-determinant op with expectedScalar defined (its
 *          result matrix is never graded), or a determinant with no
 *          expectedScalar (unwinnable — the scalar answer has no key).
 *      (d) undefined operation: add/subtract with mismatched operand dims,
 *          multiply with A.columns ≠ B.rows, determinant/inverse non-square, or
 *          a singular inverse — the shipped key describes an operation the
 *          displayed matrices cannot produce.
 *  - scope             : (1) when ctx.evalMode names one of the six operations,
 *      every challenge's challengeType must match it (task identity); (2) source
 *      entry magnitude honors an explicit objective ceiling (ctx.scopeMax ??
 *      topic "to N"). No intrinsic magnitude ceiling — matrix topics rarely
 *      carry one and entries are grade-pooled.
 *  - answer-leak       : the LLM wrapper (title/description/educationalContext)
 *      must not state the determinant value. Matrix-result entries are NOT
 *      checked — result cells overlap the visible source entries too heavily to
 *      value-match without false positives (/eval-test territory). The formula
 *      hints ("det = ad − bc") state the METHOD, never the number, by design.
 *  - clustering        : the answer (scalar, or the flattened result matrix)
 *      must spread across the session (checkAnswerVariety); no byte-identical
 *      card (same op + same source matrices twice — mirrors canonKey).
 *  - schema            : ≥3 challenges (mastery-over-demo); known challengeType;
 *      rows/columns positive integers matching the values grid; rectangular
 *      finite values; well-formed secondMatrix when the op needs one; non-empty
 *      instruction. The hint may be empty (withdrawn at the hard tier), so it is
 *      NOT required.
 *
 * Deliberately NOT checked:
 *  - hint/steps content beyond the value-leak: formula hints are the mode's
 *    intended scaffolding (the answer number never appears), and "Show steps"
 *    masks the un-solved cells by design (StepsReveal revealMask).
 *  - support-tier flags (stepsAfterAttempt / hintLevel): display-only, the
 *    checker never reads them; structural size levers are /eval-test's call.
 *  - inverse det = ±1 "clean integer" preference: the input parses any real to
 *    1e-6, so a fractional inverse is still answerable — a quality call, not an
 *    unreachable state (only a SINGULAR matrix, det = 0, is checked).
 */

const JUDGE_EPS = 1e-6;

const KNOWN_TYPES = new Set(['transpose', 'add', 'subtract', 'multiply', 'determinant', 'inverse']);
const BINARY_OPS = new Set(['add', 'subtract', 'multiply']);

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Narrow an unknown to a rectangular finite number[][]; null when malformed. */
function asMatrix(v: unknown): number[][] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const width = Array.isArray(v[0]) ? v[0].length : -1;
  if (width <= 0) return null;
  const out: number[][] = [];
  for (const row of v) {
    if (!Array.isArray(row) || row.length !== width) return null;
    const r: number[] = [];
    for (const cell of row) {
      if (!isNum(cell)) return null;
      r.push(cell);
    }
    out.push(r);
  }
  return out;
}

function transposeOf(m: number[][]): number[][] {
  const out: number[][] = [];
  for (let j = 0; j < m[0].length; j++) {
    out.push([]);
    for (let i = 0; i < m.length; i++) out[j].push(m[i][j]);
  }
  return out;
}

function elementwise(a: number[][], b: number[][], op: (x: number, y: number) => number): number[][] {
  return a.map((row, i) => row.map((v, j) => op(v, b[i][j])));
}

function multiplyOf(a: number[][], b: number[][]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < a.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < b[0].length; j++) {
      let s = 0;
      for (let k = 0; k < a[0].length; k++) s += a[i][k] * b[k][j];
      row.push(s);
    }
    out.push(row);
  }
  return out;
}

function det2(m: number[][]): number {
  return m[0][0] * m[1][1] - m[0][1] * m[1][0];
}
function det3(m: number[][]): number {
  const [a, b, c] = m[0];
  const [d, e, f] = m[1];
  const [g, h, i] = m[2];
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}
function inverse2(m: number[][]): number[][] {
  const det = det2(m);
  const [a, b] = m[0];
  const [c, d] = m[1];
  return [[d / det, -b / det], [-c / det, a / det]];
}

/** True when two matrices are the same shape and every cell agrees within eps. */
function matricesEqual(a: number[][], b: number[][]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].length !== b[i].length) return false;
    for (let j = 0; j < a[i].length; j++) {
      if (Math.abs(a[i][j] - b[i][j]) > JUDGE_EPS) return false;
    }
  }
  return true;
}

/** Standalone numeric tokens in free text (splits on non-number chars) — avoids
 *  matching a value as a substring of a longer number. */
function numbersIn(text: string): number[] {
  return text
    .split(/[^0-9.-]+/)
    .map((t) => parseFloat(t))
    .filter((n) => Number.isFinite(n));
}

export const matrixDisplayOracle: ContentOracle = {
  componentId: 'matrix-display',
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
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic);
    const wrapperText = `${String(data.title ?? '')} ${String(data.description ?? '')} ${String(data.educationalContext ?? '')}`;

    const answerValues: string[] = [];
    const cardSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const type = String(c.challengeType ?? '');
      if (!KNOWN_TYPES.has(type)) {
        uncheckedTypes.add(type || '(missing type)');
        continue;
      }

      // ── scope (1): the session must deliver the requested eval mode ──
      if (requestedMode && type !== requestedMode) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `challengeType "${type}" but the objective asked for eval mode "${requestedMode}" — a different task identity`,
        });
      }

      const rows = c.rows;
      const columns = c.columns;
      const values = asMatrix(c.values);
      const instruction = typeof c.instruction === 'string' ? c.instruction : '';
      if (
        !isNum(rows) || !Number.isInteger(rows) || rows <= 0 ||
        !isNum(columns) || !Number.isInteger(columns) || columns <= 0 ||
        !values || values.length !== rows || values[0].length !== columns ||
        instruction.trim() === ''
      ) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `malformed challenge: rows=${String(c.rows)} columns=${String(c.columns)} values=${values ? `${values.length}x${values[0].length}` : 'bad'} instruction=${JSON.stringify(c.instruction)}`,
        });
        continue;
      }

      const second = c.secondMatrix as Record<string, unknown> | undefined;
      const bValues = second ? asMatrix(second.values) : null;
      if (BINARY_OPS.has(type) && !bValues) {
        violations.push({
          check: 'schema',
          where: id,
          detail: `${type} needs a well-formed secondMatrix, got ${JSON.stringify(c.secondMatrix)}`,
        });
        continue;
      }
      checked++;

      // ── the component's grading path is chosen by expectedScalar presence ──
      const scalarPath = c.expectedScalar !== undefined;

      if (type === 'determinant') {
        // ── (c) determinant must grade on the scalar path ──
        if (!scalarPath) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `determinant ships no expectedScalar — the component falls to the matrix path and the scalar answer can never be marked correct (unwinnable)`,
          });
        } else if (!isNum(c.expectedScalar)) {
          violations.push({
            check: 'schema',
            where: id,
            detail: `expectedScalar=${String(c.expectedScalar)} is not a finite number`,
          });
        } else if (rows !== columns || (rows !== 2 && rows !== 3)) {
          // ── (d) determinant undefined off a non-2/3 square ──
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `determinant on a ${rows}×${columns} matrix — the component only computes 2×2/3×3 determinants, so the key is unreachable`,
          });
        } else {
          const trueDet = rows === 2 ? det2(values) : det3(values);
          if (Math.abs((c.expectedScalar as number) - trueDet) > JUDGE_EPS) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `expectedScalar=${c.expectedScalar} but det of the displayed matrix is ${trueDet} — the student computing the determinant is marked wrong`,
            });
          }
          answerValues.push(`det:${trueDet}`);
        }
      } else {
        // ── matrix ops: must grade on the matrix path, and (b)/(d) hold ──
        if (scalarPath) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `${type} ships an expectedScalar — the component grades the scalar path and IGNORES the result matrix the student fills (unwinnable matrix answer)`,
          });
        }
        const expectedMatrix = asMatrix(c.expectedMatrix);
        if (!expectedMatrix) {
          if (!scalarPath) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `${type} ships no well-formed expectedMatrix — there is no key to grade the student's result against (unwinnable)`,
            });
          }
        } else {
          // ── (b)/(d): re-derive the result and require the key to agree ──
          let derived: number[][] | null = null;
          let undefinedReason = '';
          if (type === 'transpose') {
            derived = transposeOf(values);
          } else if (type === 'add' || type === 'subtract') {
            if (bValues!.length !== values.length || bValues![0].length !== values[0].length) {
              undefinedReason = `A is ${values.length}×${values[0].length} but B is ${bValues!.length}×${bValues![0].length} — element-wise ${type} is undefined`;
            } else {
              derived = elementwise(values, bValues!, type === 'add' ? (x, y) => x + y : (x, y) => x - y);
            }
          } else if (type === 'multiply') {
            if (values[0].length !== bValues!.length) {
              undefinedReason = `A has ${values[0].length} columns but B has ${bValues!.length} rows — the product is undefined`;
            } else {
              derived = multiplyOf(values, bValues!);
            }
          } else {
            // inverse
            if (rows !== 2 || columns !== 2) {
              undefinedReason = `inverse on a ${rows}×${columns} matrix — the component only inverts 2×2`;
            } else if (Math.abs(det2(values)) < JUDGE_EPS) {
              undefinedReason = `the displayed 2×2 matrix is singular (det = 0) — no inverse exists`;
            } else {
              derived = inverse2(values);
            }
          }

          if (undefinedReason) {
            violations.push({ check: 'answer-key-desync', where: id, detail: undefinedReason });
          } else if (derived && !matricesEqual(expectedMatrix, derived)) {
            violations.push({
              check: 'answer-key-desync',
              where: id,
              detail: `expectedMatrix ${JSON.stringify(expectedMatrix)} but the ${type} of the displayed source is ${JSON.stringify(derived)} — the student computing the result is marked wrong`,
            });
          }
          if (derived) answerValues.push(`${type}:${JSON.stringify(derived)}`);
        }
      }

      // ── scope (2): source entry magnitude honors an explicit objective ceiling ──
      if (ceiling !== undefined) {
        const allEntries = [...values.flat(), ...(bValues ? bValues.flat() : [])];
        const maxMag = Math.max(...allEntries.map((v) => Math.abs(v)));
        if (maxMag > ceiling) {
          violations.push({
            check: 'scope',
            where: id,
            detail: `matrix entry magnitude ${maxMag} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
          });
        }
      }

      // ── answer-leak: the wrapper must not state the determinant value ──
      if (type === 'determinant' && isNum(c.expectedScalar) && numbersIn(wrapperText).includes(c.expectedScalar as number)) {
        violations.push({
          check: 'answer-leak',
          where: id,
          detail: `the title/description/educationalContext states the determinant value ${c.expectedScalar}`,
        });
      }

      const bKey = bValues ? bValues.map((r) => r.join(',')).join('|') : '';
      cardSeen.set(
        `${type}#${rows}x${columns}#${values.map((r) => r.join(',')).join('|')}#${bKey}`,
        (cardSeen.get(`${type}#${rows}x${columns}#${values.map((r) => r.join(',')).join('|')}#${bKey}`) ?? 0) + 1,
      );
    }

    // ── clustering: answers spread; no byte-identical card ──
    const variety = checkAnswerVariety(answerValues, 'challenges[].answer');
    if (variety) violations.push(variety);
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical matrix card "${key.slice(0, 80)}…" appears ${count}× — a duplicated problem`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
