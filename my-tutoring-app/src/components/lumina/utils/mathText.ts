/**
 * Math inside model-written text. The convention is LaTeX's: `$...$` is inline math, `$$...$$` is display math, and
 * `\$` is a literal dollar sign. `LuminaMathText` renders it; `mathIssues` is the code check an author runs before
 * shipping text; `spokenMath` turns the math into the words a tutor or read-aloud says ("$x^2 - 1 = 0$" ->
 * "x squared minus 1 equals 0"), because a voice cannot read LaTeX.
 *
 * Inline math follows Pandoc's currency guard: the opening `$` is not followed by a space, the closing `$` is not
 * preceded by one or followed by a digit, so "$5 and $10" stays text.
 */
import katex from 'katex';

export type MathSegment = { kind: 'text'; text: string } | { kind: 'math'; tex: string; display: boolean };

const ESCAPED = '\u0001';
const MAX_INLINE = 160;
const MATH = /\$\$([\s\S]+?)\$\$|\$(?![\s$])([^$\n]+?)(?<!\s)\$(?!\d)/g;

/** Segments with `\$` still protected, so a stray `$` is visible to the check. */
function scan(text: string): Array<{ kind: 'text'; text: string } | { kind: 'math'; tex: string; display: boolean }> {
  const src = text.replace(/\\\$/g, ESCAPED);
  const out: ReturnType<typeof scan> = [];
  let last = 0;
  for (const m of Array.from(src.matchAll(MATH))) {
    const display = m[1] !== undefined;
    const tex = (m[1] ?? m[2]).trim();
    if (!display && tex.length > MAX_INLINE) continue;
    if (m.index! > last) out.push({ kind: 'text', text: src.slice(last, m.index) });
    out.push({ kind: 'math', tex, display });
    last = m.index! + m[0].length;
  }
  if (last < src.length) out.push({ kind: 'text', text: src.slice(last) });
  return out;
}

const restore = (s: string, to: string) => s.split(ESCAPED).join(to);

/** Text and math in order. A text segment's `\$` is a plain `$`. */
export function splitMath(text: string): MathSegment[] {
  if (!text || !text.includes('$')) return text ? [{ kind: 'text', text }] : [];
  return scan(text).map((s) => (s.kind === 'text' ? { kind: 'text', text: restore(s.text, '$') } : { ...s, tex: restore(s.tex, '\\$') }));
}

export const hasMath = (text: string | undefined) => !!text && splitMath(text).some((s) => s.kind === 'math');

/** KaTeX HTML for one expression; never throws (a bad expression renders red in place). */
export function renderTex(tex: string, display = false): string {
  return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' });
}

const clip = (s: string) => (s.length > 60 ? `${s.slice(0, 60)}…` : s);
const LATEX_IN_TEXT = /\\(frac|dfrac|sqrt|begin|end|cdot|times|div|neq|leq|geq|le|ge|pi|theta|alpha|left|right|text)\b|\^\{|_\{/;
const MATRIX_IN_TEXT = /\[[^\]$]*\d[^\]$]*;[^\]$]*\]/;

/**
 * What is wrong with the math in one string, as instructions to its author: an unpaired `$`, LaTeX left outside
 * `$...$`, a matrix typed as "[a, b; c, d]", or an expression KaTeX cannot parse. Empty when the text is fine.
 */
export function mathIssues(text: string): string[] {
  if (!text) return [];
  const issues: string[] = [];
  for (const s of scan(text)) {
    if (s.kind === 'text') {
      if (s.text.includes('$')) issues.push(`unpaired $ in "${clip(restore(s.text, '\\$'))}": put math between $...$ (no space inside the $), and write a dollar sign as \\$`);
      else if (LATEX_IN_TEXT.test(s.text)) issues.push(`LaTeX outside $...$ in "${clip(s.text)}": wrap the expression in $...$`);
      else if (MATRIX_IN_TEXT.test(s.text)) issues.push(`"${clip(s.text)}" types a matrix as text: write it as $\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$`);
      continue;
    }
    try {
      katex.renderToString(restore(s.tex, '\\$'), { displayMode: s.display, throwOnError: true, strict: 'ignore' });
    } catch (e) {
      issues.push(`$${clip(s.tex)}$ does not render: ${String((e as Error).message ?? e).replace(/^KaTeX parse error:\s*/, '')}`);
    }
  }
  return issues;
}

/** For a generator with no repair loop: an expression KaTeX cannot parse becomes its source as plain text. */
export function repairMath(text: string): string {
  if (!text || !text.includes('$')) return text;
  return scan(text).map((s) => {
    if (s.kind === 'text') return restore(s.text, '\\$');
    const tex = restore(s.tex, '\\$');
    try {
      katex.renderToString(tex, { displayMode: s.display, throwOnError: true, strict: 'ignore' });
      return s.display ? `$$${tex}$$` : `$${tex}$`;
    } catch {
      return tex;
    }
  }).join('');
}

/** `repairMath` over every string in a value, leaving `html` and image fields alone. */
export function repairMathDeep<T>(v: T, key = ''): T {
  if (typeof v === 'string') return (/^(html|imageBase64|id)$/.test(key) ? v : repairMath(v)) as T;
  if (Array.isArray(v)) return v.map((x) => repairMathDeep(x, key)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, repairMathDeep(x, k)])) as T;
  return v;
}

/** The convention, as an instruction to a model that writes student text. */
export const MATH_WRITING_RULE = 'Write every mathematical expression in LaTeX between single dollar signs, inline: "$2x + 3 = 7$", '
  + '"$\\frac{3}{4}$", "$x^2$", "$a \\neq b$". Write a matrix as "$\\begin{bmatrix} 2 & 1 \\\\ 1 & -1 \\end{bmatrix}$", never as '
  + '"[2, 1; 1, -1]". A plain number in a sentence needs no dollar signs ("about 300 kilometers"); a dollar sign for money is "\\$5". '
  + 'Answer options follow the same rule.';

// ── Speech ───────────────────────────────────────────────────────────

const GREEK = /^(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Pi|Sigma|Phi|Omega)$/;
const FUNCTIONS = /^(sin|cos|tan|log|ln|exp|min|max|det|lim)$/;
const OPS: Record<string, string> = {
  cdot: 'times', times: 'times', div: 'divided by', pm: 'plus or minus', mp: 'minus or plus',
  neq: 'is not equal to', ne: 'is not equal to', le: 'is less than or equal to', leq: 'is less than or equal to',
  ge: 'is greater than or equal to', geq: 'is greater than or equal to', lt: 'is less than', gt: 'is greater than',
  approx: 'is about', sim: 'is about', cong: 'is congruent to', equiv: 'is equivalent to', propto: 'is proportional to',
  perp: 'is perpendicular to', parallel: 'is parallel to', in: 'is in', to: 'to', rightarrow: 'gives', Rightarrow: 'so',
  implies: 'so', iff: 'if and only if', therefore: 'so',
};
const NOUNS: Record<string, string> = {
  infty: 'infinity', degree: 'degrees', circ: 'degrees', '%': 'percent', $: 'dollars', angle: 'angle', triangle: 'triangle',
  ldots: 'and so on', cdots: 'and so on', dots: 'and so on', prime: 'prime',
};
const SILENT = /^(left|right|displaystyle|textstyle|big|Big|bigg|Bigg|quad|qquad|,|;|:|!| |limits|nolimits)$/;
const TEXTLIKE = /^(text|textbf|textit|mathrm|mathbf|mathit|operatorname|mbox)$/;
const MATRIX = /^(matrix|bmatrix|pmatrix|Bmatrix|vmatrix|Vmatrix|smallmatrix|array)$/;
const SYMBOLS: Record<string, string> = { '+': 'plus', '=': 'equals', '<': 'is less than', '>': 'is greater than', '/': 'over', '*': 'times', '·': 'times', '×': 'times', '÷': 'divided by', '≠': 'is not equal to', '≤': 'is less than or equal to', '≥': 'is greater than or equal to', '−': 'minus' };

/** One argument after `i`: a `{group}`, a `\command`, or a single character. */
function arg(s: string, i: number): [string, number] {
  while (s[i] === ' ') i++;
  if (s[i] === '{') {
    let depth = 1;
    let j = i + 1;
    for (; j < s.length && depth; j++) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; }
    return [s.slice(i + 1, j - 1), j];
  }
  if (s[i] === '\\') { const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i))!; return [m[0], i + m[0].length]; }
  return [s[i] ?? '', i + 1];
}

/** Rows of a matrix or aligned environment, each a list of cells. */
const rowsOf = (body: string) => body.split(/\\\\/).map((r) => r.trim()).filter(Boolean).map((r) => r.split('&').map((c) => c.trim()));

/** LaTeX as words: "\frac{a}{b}" -> "a over b", "x^2" -> "x squared", "-1" after an operator -> "negative 1". */
export function speakTex(s: string): string {
  const out: string[] = [];
  // Whether the last thing said is a value (so "-" is "minus" and "(" means times) or an operator.
  let operand = false;
  const value = (w: string) => { out.push(w); operand = true; };
  const op = (w: string) => { out.push(w); operand = false; };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c) || c === '{' || c === '}') { i++; continue; }
    const num = /^(?:\d{1,3}(?:,\d{3})+(?!\d)|\d+)(?:\.\d+)?/.exec(s.slice(i));
    if (num) { value(num[0].replace(/,/g, '')); i += num[0].length; continue; }
    if (/[A-Za-z]/.test(c)) { value(c); i++; continue; }
    if (c === '-') { op(operand ? 'minus' : 'negative'); i++; continue; }
    if (SYMBOLS[c]) { op(SYMBOLS[c]); i++; continue; }
    if (c === '(' || c === '[') { if (operand) op('times'); i++; continue; }
    if (c === ')' || c === ']') { operand = true; i++; continue; }
    if (c === '|') { i++; continue; }
    if (c === ',' || c === ';') { op(','); i++; continue; }
    if (c === '!') { if (operand) value('factorial'); i++; continue; }
    if (c === '^') {
      const [g, j] = arg(s, i + 1);
      i = j;
      const t = g.trim();
      if (t === '2') value('squared');
      else if (t === '3') value('cubed');
      else if (/^\\circ$/.test(t)) value('degrees');
      else if (/^\\prime$|^'$/.test(t)) value('prime');
      else value(`to the power of ${speakTex(t)}`);
      continue;
    }
    if (c === '_') { const [g, j] = arg(s, i + 1); value(`sub ${speakTex(g)}`); i = j; continue; }
    if (c === '&') { op(','); i++; continue; }
    if (c !== '\\') { i++; continue; }

    const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i))!;
    const name = m[1];
    i += m[0].length;
    if (name === '\\') { op(';'); continue; }
    if (SILENT.test(name)) continue;
    if (/^d?t?frac$/.test(name)) {
      const [a, j] = arg(s, i);
      const [b, k] = arg(s, j);
      value(`${speakTex(a)} over ${speakTex(b)}`);
      i = k;
      continue;
    }
    if (name === 'sqrt') {
      let n = '';
      if (s[i] === '[') { const close = s.indexOf(']', i); n = s.slice(i + 1, close); i = close + 1; }
      const [a, j] = arg(s, i);
      value(`${n === '3' ? 'the cube root of' : n ? `the root ${speakTex(n)} of` : 'the square root of'} ${speakTex(a)}`);
      i = j;
      continue;
    }
    if (TEXTLIKE.test(name)) { const [a, j] = arg(s, i); value(a.trim()); i = j; continue; }
    if (name === 'begin') {
      const [env, j] = arg(s, i);
      const end = s.indexOf(`\\end{${env}}`, j);
      const body = s.slice(env === 'array' ? arg(s, j)[1] : j, end < 0 ? s.length : end);
      i = end < 0 ? s.length : end + `\\end{${env}}`.length;
      const rows = rowsOf(body);
      if (MATRIX.test(env)) {
        const said = rows.map((r) => r.map(speakTex).join(', ')).join('; then ');
        value(`${/^v/i.test(env) ? 'the determinant of the matrix' : 'the matrix'} with rows ${said}`);
      } else value(rows.map((r) => r.map(speakTex).join(' ')).join('; '));
      continue;
    }
    if (name === 'end') { i = arg(s, i)[1]; continue; }
    if (OPS[name]) { op(OPS[name]); continue; }
    if (NOUNS[name]) { value(NOUNS[name]); continue; }
    if (GREEK.test(name) || FUNCTIONS.test(name)) { if (operand && FUNCTIONS.test(name)) op('times'); value(name); continue; }
    if (name === 'not') continue;
    value(name);
  }
  return out.join(' ').replace(/\s+([,;])/g, '$1').replace(/\s+/g, ' ').trim();
}

/** The text as a voice says it: math in words, `\$` as "$", everything else as written. */
export function spokenMath(text: string): string {
  if (!text || !text.includes('$')) return text;
  return splitMath(text).map((s) => (s.kind === 'text' ? s.text : speakTex(s.tex))).join('');
}

/** Spoken form of a string, a list or a record of strings (for scene facts). */
export function spokenMathDeep<T>(v: T): T {
  if (typeof v === 'string') return spokenMath(v) as T;
  if (Array.isArray(v)) return v.map(spokenMathDeep) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, spokenMathDeep(x)])) as T;
  return v;
}
