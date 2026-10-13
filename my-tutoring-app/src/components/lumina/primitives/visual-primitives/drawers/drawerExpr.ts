/**
 * Safe arithmetic for drawers. Gemini writes a formula as text ("(v/3.6)^2/(2*mu*9.8)"); this
 * compiles it into a function over named inputs. Nothing the model writes is executed: the grammar
 * is numbers, + - * / ^, parentheses, names supplied by the caller and a fixed list of functions.
 */
export type Env = Record<string, number>;
export type Compiled = (env: Env) => number;

const FNS: Record<string, (...a: number[]) => number> = {
  min: Math.min, max: Math.max, sqrt: Math.sqrt, abs: Math.abs, round: Math.round,
  floor: Math.floor, ceil: Math.ceil, log10: Math.log10, ln: Math.log, exp: Math.exp,
};

const TOKEN = /^\s*(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|[A-Za-z_]\w*|[-+*/^(),])/;

export function compileExpr(src: string): Compiled {
  const toks: string[] = [];
  let rest = src;
  while (rest.trim().length) {
    const m = TOKEN.exec(rest);
    if (!m) throw new Error(`Unexpected character at ${src.length - rest.length} in "${src}"`);
    toks.push(m[1]);
    rest = rest.slice(m[0].length);
  }
  let i = 0;
  const peek = () => toks[i];
  const eat = (t: string) => { if (toks[i] !== t) throw new Error(`Expected "${t}" in "${src}"`); i++; };

  function expr(): Compiled {
    let f = term();
    while (peek() === '+' || peek() === '-') {
      const op = toks[i++], a = f, b = term();
      f = op === '+' ? e => a(e) + b(e) : e => a(e) - b(e);
    }
    return f;
  }
  function term(): Compiled {
    let f = unary();
    while (peek() === '*' || peek() === '/') {
      const op = toks[i++], a = f, b = unary();
      f = op === '*' ? e => a(e) * b(e) : e => a(e) / b(e);
    }
    return f;
  }
  function unary(): Compiled {
    if (peek() === '-') { i++; const a = unary(); return e => -a(e); }
    return power();
  }
  function power(): Compiled {
    const a = primary();
    if (peek() === '^') { i++; const b = unary(); return e => Math.pow(a(e), b(e)); }
    return a;
  }
  function primary(): Compiled {
    const t = toks[i++];
    if (t === undefined) throw new Error(`Formula ends early: "${src}"`);
    if (/^[\d.]/.test(t)) { const n = parseFloat(t); return () => n; }
    if (t === '(') { const a = expr(); eat(')'); return a; }
    if (/^[A-Za-z_]/.test(t)) {
      if (peek() === '(') {
        if (!Object.prototype.hasOwnProperty.call(FNS, t)) throw new Error(`Unknown function "${t}"`);
        i++;
        const args: Compiled[] = [];
        if (peek() !== ')') { args.push(expr()); while (peek() === ',') { i++; args.push(expr()); } }
        eat(')');
        const fn = FNS[t];
        return e => fn(...args.map(a => a(e)));
      }
      return e => {
        if (!Object.prototype.hasOwnProperty.call(e, t)) throw new Error(`Unknown name "${t}"`);
        return e[t];
      };
    }
    throw new Error(`Unexpected "${t}" in "${src}"`);
  }
  const f = expr();
  if (i < toks.length) throw new Error(`Unexpected "${toks[i]}" in "${src}"`);
  return f;
}

/** Fixed-decimal display with thousands separators. */
export function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Decimal places implied by a step (0.1 → 1, 5 → 0). */
export function stepDigits(step: number): number {
  const s = String(step);
  return s.includes('.') ? s.split('.')[1].length : 0;
}

const SUPERSCRIPT: Record<string, string> = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

/** Three significant figures; powers of ten for very large or very small values ("1.27 × 10⁷"). */
export function formatSig(n: number): string {
  const a = Math.abs(n);
  if (a !== 0 && (a >= 1e9 || a < 1e-3)) {
    const e = Math.floor(Math.log10(a));
    const m = Number((n / 10 ** e).toPrecision(3));
    return `${m} × 10${String(e).split('').map(c => SUPERSCRIPT[c]).join('')}`;
  }
  return Number(n.toPrecision(3)).toLocaleString('en-US', { maximumFractionDigits: 6 });
}

/** Large numbers in words a child reads: "3.1 billion"; below a million, the number in full. */
export function formatWords(n: number): string {
  const a = Math.abs(n);
  for (const [v, w] of [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']] as const) {
    if (a >= v) return `${Number((n / v).toPrecision(2))} ${w}`;
  }
  return formatSig(n);
}

/** "10⁻⁶" for -6. */
export const powerOfTen = (e: number) => `10${String(e).split('').map(c => SUPERSCRIPT[c]).join('')}`;
