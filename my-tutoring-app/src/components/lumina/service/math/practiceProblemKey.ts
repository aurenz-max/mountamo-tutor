/**
 * Code check of a generated practice problem's answer key against its own worked steps (contract G1).
 *
 * The judge grounds on `canonicalAnswer`, so a key that disagrees with the steps marks a correct derivation wrong
 * (2026-10-09: `4(m + 2) + 14 = 134` keyed `m = 27`, its steps giving `m + 2 = 30`; `3x - 7 = 14` keyed
 * `x = \frac{21}{3}` in a simplest-form problem whose last step is `x = 7`).
 *
 * Scope: one-variable linear equations and numbers, written with + - * / ( ), implicit products (`4(m + 2)`, `3x`),
 * `\frac{a}{b}`, `\cdot`, `\times`. Anything else (a second variable, a power of the variable, prose) is left
 * unchecked rather than guessed at.
 */

/** A value linear in the one variable: `a * v + b`. */
interface Lin { a: number; b: number }
const EPS = 1e-9;
const close = (x: number, y: number) => Math.abs(x - y) <= EPS * Math.max(1, Math.abs(x), Math.abs(y));

/** TeX to plain arithmetic; null when it is not plain arithmetic in at most one letter. */
function plain(tex: string): string | null {
  let s = tex.replace(/\$|\\left|\\right|\\[,;!]|\\displaystyle/g, '').replace(/\\(?:cdot|times)/g, '*')
    .replace(/\\div/g, '/').replace(/−/g, '-');
  // \frac{a}{b} -> ((a)/(b)), innermost first.
  for (let i = 0; i < 6 && /\\[dt]?frac/.test(s); i++) s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))');
  s = s.replace(/\\text\{[^}]*\}/g, '').replace(/,(?=\d{3}\b)/g, '').trim();
  return /^[0-9a-zA-Z.+\-*/()= \t]*$/.test(s) ? s : null;
}

/** Parses arithmetic in one variable into a linear form; null when it is not linear in one variable. */
function linear(expr: string, variable: { name: string | null }): Lin | null {
  const tokens = expr.match(/\d+(?:\.\d+)?|[a-zA-Z]|[+\-*/()]/g);
  if (!tokens || tokens.join('') !== expr.replace(/\s+/g, '')) return null;
  let at = 0;
  const peek = () => tokens[at];
  const mul = (x: Lin, y: Lin): Lin | null => (Math.abs(x.a) > EPS && Math.abs(y.a) > EPS ? null : { a: x.a * y.b + y.a * x.b, b: x.b * y.b });
  const div = (x: Lin, y: Lin): Lin | null => (Math.abs(y.a) > EPS || Math.abs(y.b) < EPS ? null : { a: x.a / y.b, b: x.b / y.b });
  const primary = (): Lin | null => {
    const t = peek();
    if (t === undefined) return null;
    if (t === '-') { at++; const p = primary(); return p && { a: -p.a, b: -p.b }; }
    if (t === '+') { at++; return primary(); }
    if (t === '(') { at++; const e = sum(); if (peek() !== ')') return null; at++; return e; }
    if (/^\d/.test(t)) { at++; return { a: 0, b: Number(t) }; }
    if (/^[a-zA-Z]$/.test(t)) {
      if (variable.name && variable.name !== t) return null;
      variable.name = t; at++; return { a: 1, b: 0 };
    }
    return null;
  };
  const product = (): Lin | null => {
    let left = primary();
    while (left) {
      const t = peek();
      if (t === '*' || t === '/') { at++; const r = primary(); if (!r) return null; left = t === '*' ? mul(left, r) : div(left, r); }
      else if (t === '(' || (t !== undefined && /^[a-zA-Z\d]/.test(t))) { const r = primary(); if (!r) return null; left = mul(left, r); }
      else break;
    }
    return left;
  };
  const sum = (): Lin | null => {
    let left = product();
    while (left && (peek() === '+' || peek() === '-')) {
      const op = tokens[at++]; const r = product(); if (!r) return null;
      left = op === '+' ? { a: left.a + r.a, b: left.b + r.b } : { a: left.a - r.a, b: left.b - r.b };
    }
    return left;
  };
  const out = sum();
  return out && at === tokens.length ? out : null;
}

/** The solution of a one-variable linear equation, with its variable; null when it is not one. */
export function solveLinear(tex: string): { variable: string; value: number } | null {
  const s = plain(tex);
  if (!s || (s.match(/=/g) ?? []).length !== 1) return null;
  const v = { name: null as string | null };
  const [l, r] = s.split('=').map(side => linear(side, v));
  if (!l || !r || !v.name || close(l.a, r.a)) return null;
  return { variable: v.name, value: (r.b - l.b) / (l.a - r.a) };
}

/** A key's value: `v = value` or a bare number. */
function keyValue(key: string): { variable: string | null; value: number; text: string } | null {
  const s = plain(key);
  if (!s) return null;
  const parts = s.split('=');
  if (parts.length > 2) return null;
  const rhs = parts.at(-1)!;
  const variable = parts.length === 2 ? parts[0].trim() : null;
  if (variable !== null && !/^[a-zA-Z]$/.test(variable)) return null;
  const v = { name: null as string | null };
  const value = linear(rhs, v);
  if (!value || Math.abs(value.a) > EPS) return null;
  return { variable, value: value.b, text: key.split('=').at(-1)!.trim() };
}

/** An unreduced fraction (21/3, 6/8) in the key's value. */
function unreduced(text: string): boolean {
  const s = plain(text) ?? '';
  const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x);
  return Array.from(s.matchAll(/\(\((\d+)\)\/\((\d+)\)\)|(\d+)\s*\/\s*(\d+)/g)).some(m => {
    const p = Number(m[1] ?? m[3]), q = Number(m[2] ?? m[4]);
    return q !== 0 && gcd(p, q) > 1;
  });
}

const fmt = (n: number) => {
  if (close(n, Math.round(n))) return String(Math.round(n));
  for (let q = 2; q <= 100; q++) if (close(n * q, Math.round(n * q))) {
    const p = Math.round(n * q);
    return `${p < 0 ? '-' : ''}\\frac{${Math.abs(p)}}{${q}}`;
  }
  return String(Number(n.toPrecision(10)));
};

export type KeyCheck =
  | { status: 'ok'; key: string }
  | { status: 'corrected'; key: string; reason: string }
  | { status: 'inconsistent'; reason: string }
  | { status: 'unchecked'; key: string; reason: string };

/**
 * Reads each step's equations (`from -> [op] -> to`) and the key. Every checkable equation must have the same solution
 * (else `inconsistent`: the steps themselves are wrong, regenerate). A key that disagrees with that solution, or is an
 * unreduced fraction when the problem asks for simplest form, is replaced by the last step's result (`corrected`).
 */
export function checkPracticeKey(p: {
  problem: { statement: string; equations?: string[] };
  steps: Array<{ canonicalBody: string }>;
  canonicalAnswer: string;
}): KeyCheck {
  const sides = p.steps.flatMap((s, i) => s.canonicalBody.split('->').map(t => ({ step: i, text: t.trim() })))
    .filter(t => t.text && !t.text.startsWith('['));
  const solved = sides.map(t => ({ ...t, sol: solveLinear(t.text) })).filter(t => t.sol);
  if (!solved.length) return { status: 'unchecked', key: p.canonicalAnswer, reason: 'no step is a one-variable linear equation' };
  const { variable, value } = solved[0].sol!;
  const off = solved.find(t => t.sol!.variable === variable && !close(t.sol!.value, value));
  if (off) return { status: 'inconsistent',
    reason: `step ${off.step + 1} "${off.text}" solves to ${fmt(off.sol!.value)}, not ${fmt(value)} as "${solved[0].text}"` };
  const last = sides.at(-1)!;
  // The last step's own result when it reads `v = value`, else the value the steps solve to.
  const lastKey = last.step === p.steps.length - 1 ? keyValue(last.text) : null;
  const lastResult = lastKey?.variable === variable && close(lastKey.value, value) && !unreduced(lastKey.text)
    ? last.text : `${variable} = ${fmt(value)}`;
  const key = keyValue(p.canonicalAnswer);
  if (!key) return { status: 'unchecked', key: p.canonicalAnswer, reason: `key "${p.canonicalAnswer}" is not a number or var = number` };
  if (key.variable && key.variable !== variable) return { status: 'unchecked', key: p.canonicalAnswer, reason: `key names ${key.variable}, steps solve ${variable}` };
  if (!close(key.value, value))
    return { status: 'corrected', key: lastResult, reason: `key ${fmt(key.value)} disagrees with the steps' ${fmt(value)}` };
  if (/simplest|lowest terms|simplif/i.test(p.problem.statement) && unreduced(key.text))
    return { status: 'corrected', key: lastResult, reason: `key "${p.canonicalAnswer}" is not in simplest form` };
  return { status: 'ok', key: p.canonicalAnswer };
}
