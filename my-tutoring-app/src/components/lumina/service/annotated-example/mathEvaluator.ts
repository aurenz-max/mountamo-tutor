/**
 * Deterministic numerical evaluator for annotated-example step content.
 *
 * LLMs hallucinate arithmetic (e.g. `e^0.9375 ≈ 2.615` instead of 2.553).
 * When an expression is purely numerical, we can verify and overwrite the
 * LLM's answer with a computed one. Symbolic expressions pass through
 * untouched — we only intervene when we can verify.
 */

import { create, all, type MathJsInstance } from 'mathjs';

const math: MathJsInstance = create(all, {});

// ═════════════════════════════════════════════════════════════════════
// KaTeX → mathjs expression translation
// ═════════════════════════════════════════════════════════════════════

/**
 * Translate a KaTeX expression into a mathjs-parseable string.
 * Intentionally narrow — handles the constructs our generators actually
 * produce. Unknown macros fall through and will cause mathjs to throw,
 * which the caller treats as "cannot verify".
 */
export function katexToMath(input: string): string {
  let s = input;

  // Strip $ delimiters and spacing/grouping commands.
  // \left and \right wrap existing delimiters like ( [ | — drop just the macro.
  s = s.replace(/\$/g, '');
  s = s.replace(/\\[,;:!]/g, '');
  s = s.replace(/\\left/g, '').replace(/\\right/g, '');

  // Expand \frac{a}{b} → ((a)/(b)). Repeat until stable (handles nested).
  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '(($1)/($2))');
  }

  // \sqrt{x} → sqrt(x); \sqrt[n]{x} → nthRoot(x,n)
  prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, 'nthRoot($2,$1)');
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt($1)');
  }

  // Superscripts ^{x} → ^(x), subscripts _{x} → dropped (they're labels)
  prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(/\^\s*\{([^{}]*)\}/g, '^($1)');
    s = s.replace(/_\s*\{([^{}]*)\}/g, '');
  }
  // Single-char subscripts like x_0
  s = s.replace(/_[A-Za-z0-9]/g, '');

  // Operators
  s = s.replace(/\\cdot/g, '*');
  s = s.replace(/\\times/g, '*');
  s = s.replace(/\\div/g, '/');
  s = s.replace(/\\pm/g, '+'); // best effort — pick primary branch

  // Constants
  s = s.replace(/\\pi\b/g, 'pi');
  s = s.replace(/\\tau\b/g, '(2*pi)');
  s = s.replace(/\\infty\b/g, 'Infinity');

  // Named functions
  s = s.replace(/\\(sin|cos|tan|sec|csc|cot|log|ln|exp|arcsin|arccos|arctan|sinh|cosh|tanh)\b/g, '$1');
  // mathjs uses `log` base-e by default; translate `ln` to `log`.
  s = s.replace(/\bln\b/g, 'log');

  // Approx / equals → drop (we evaluate RHS only via caller)
  s = s.replace(/\\approx/g, '=');
  s = s.replace(/\\ne\b/g, '!=');
  s = s.replace(/\\le\b/g, '<=').replace(/\\ge\b/g, '>=');

  // Remove stray backslashes + text macros we don't recognize
  s = s.replace(/\\text\s*\{[^{}]*\}/g, '');
  s = s.replace(/\\[a-zA-Z]+/g, ''); // drop unknown macros

  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

// ═════════════════════════════════════════════════════════════════════
// Safe numerical evaluation
// ═════════════════════════════════════════════════════════════════════

/** Strip a leading "A = " or "f(x) = " assignment prefix from an expression. */
function stripAssignmentPrefix(expr: string): string {
  // Match up to the first `=` that isn't inside parens
  let depth = 0;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === '=' && depth === 0) {
      // Only strip if there's at least one non-operator char before =
      const lhs = expr.slice(0, i).trim();
      if (lhs && /^[A-Za-z][A-Za-z0-9_()\s,]*$/.test(lhs)) {
        return expr.slice(i + 1).trim();
      }
      return expr;
    }
  }
  return expr;
}

/** Evaluate a KaTeX expression numerically. Returns null if not purely numerical. */
export function tryEvaluateKatex(katex: string, scope: Record<string, number> = {}): number | null {
  try {
    const translated = katexToMath(katex);
    const rhs = stripAssignmentPrefix(translated);
    if (!rhs) return null;

    // If the result references free variables not in scope, mathjs throws — ok.
    const result = math.evaluate(rhs, scope);

    if (typeof result === 'number' && Number.isFinite(result)) return result;
    // mathjs may return a Fraction/BigNumber/Complex — convert if possible
    if (result != null && typeof result === 'object') {
      const maybe = Number((result as { valueOf: () => number }).valueOf?.());
      if (Number.isFinite(maybe)) return maybe;
    }
    return null;
  } catch {
    return null;
  }
}

/** Evaluate a template expression with numerical variable bindings. */
export function tryEvaluateSubstitution(
  template: string,
  substitutions: Array<{ variable: string; value: string }>,
): number | null {
  const scope: Record<string, number> = {};
  for (const sub of substitutions) {
    const v = tryEvaluateKatex(sub.value);
    if (v == null) return null; // need all subs numerical
    // Variable name: strip any subscripts/function-call syntax from KaTeX
    const rawName = katexToMath(sub.variable).replace(/\([^)]*\)/g, '').trim();
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(rawName)) continue;
    scope[rawName] = v;
  }
  return tryEvaluateKatex(template, scope);
}

// ═════════════════════════════════════════════════════════════════════
// Result string patching — preserve format, swap the number
// ═════════════════════════════════════════════════════════════════════

/**
 * Given the original result string and a computed numerical value,
 * return a corrected string. Strategy:
 *  - Find the last standalone numeric literal in the string
 *  - If computed value differs (>0.5% or >0.01 absolute), replace it
 *  - Otherwise return the original (LLM got it right; don't churn)
 *
 * Returns null if no numeric literal is found — caller keeps the original.
 */
export function patchResultString(original: string, computed: number): string | null {
  // Match numeric literals with optional sign, decimals, and scientific notation.
  // Skip numbers inside ^{...} and _{...} groups (exponents/subscripts).
  const numberRe = /-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g;
  const matches: Array<{ index: number; length: number; value: number }> = [];

  // Simple brace-depth-aware scan so we don't clobber exponents.
  let i = 0;
  let depth = 0;
  let caretArmed = false;
  while (i < original.length) {
    const ch = original[i];
    if (ch === '{') {
      if (caretArmed) depth++;
      caretArmed = false;
      i++;
      continue;
    }
    if (ch === '}') {
      if (depth > 0) depth--;
      i++;
      continue;
    }
    if (ch === '^' || ch === '_') {
      caretArmed = true;
      i++;
      continue;
    }
    caretArmed = false;

    if (depth === 0) {
      numberRe.lastIndex = i;
      const m = numberRe.exec(original);
      if (m && m.index === i) {
        matches.push({ index: m.index, length: m[0].length, value: parseFloat(m[0]) });
        i += m[0].length;
        continue;
      }
    }
    i++;
  }

  if (matches.length === 0) return null;

  // Use the last top-level numeric literal as the "answer"
  const target = matches[matches.length - 1];
  const delta = Math.abs(target.value - computed);
  const rel = Math.abs(computed) > 1e-9 ? delta / Math.abs(computed) : delta;
  if (delta < 0.01 && rel < 0.005) return original; // LLM was right

  // Infer precision from the original literal
  const origStr = original.slice(target.index, target.index + target.length);
  const decMatch = origStr.match(/\.(\d+)/);
  const decimals = decMatch ? decMatch[1].length : (Math.abs(computed) >= 100 ? 2 : 4);
  const formatted = formatNumber(computed, decimals);

  return original.slice(0, target.index) + formatted + original.slice(target.index + target.length);
}

function formatNumber(n: number, decimals: number): string {
  if (Math.abs(n) >= 1e12 || (Math.abs(n) > 0 && Math.abs(n) < 1e-4)) {
    return n.toExponential(Math.min(decimals, 6));
  }
  return n.toFixed(decimals);
}
