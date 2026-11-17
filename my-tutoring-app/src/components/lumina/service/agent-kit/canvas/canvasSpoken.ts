/**
 * Say and show on a canvas (USER 2026-11-15). A canvas whose ask has one value a child can say reports it with
 * `lumina.answer(value, misrules)`: the program computes it from its params, as it computes its goal. The author's
 * playthroughs record what the page reported, so no author writes a key into a tool call or a spec. The child may then
 * say the answer (the tutor judges it against this key) or show it on the canvas and press Check (the program's goal
 * judges it). A canvas that reports no answer is shown only, as before.
 *
 * One pure module for both authors' gates (`canvasAuthor.ts`, `scripts/canvas-check.mjs`), the boss and the tests.
 */
import { askLeaks, type SpokenKey } from '../../../components/live-activity/spokenKey';
import { spokenNumber, type KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';

/** A wrong answer a child holding one misrule says, and the misrule in a few words. */
export interface CanvasMisrule { says: string | number; because: string }

/**
 * What a canvas problem's page reported with `lumina.answer`. `choices` are the words the ask offers ("first",
 * "second", "same"; "yes", "no"): the answer and every misrule are among them, and the ask says them all.
 */
export interface CanvasSpoken { answer: string | number; misrules?: CanvasMisrule[]; choices?: string[] }

/** The miss ids a canvas can name from speech, in the order the program lists its misrules. */
export const MISRULE_IDS = ['misrule_first', 'misrule_second', 'misrule_third'] as const;

const MAX_WORDS = 40;
const sayable = (v: unknown): v is string | number =>
  typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' && !!v.trim() && v.trim().length <= MAX_WORDS;
const same = (a: unknown, b: unknown) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/** The page's report as a `CanvasSpoken`, or null when it reported none or one that cannot be read. */
export function readSpoken(reported: unknown): CanvasSpoken | null {
  const r = reported as { value?: unknown; answer?: unknown; misrules?: unknown; choices?: unknown } | null;
  const value = r && typeof r === 'object' ? r.value ?? r.answer : undefined;
  if (!sayable(value)) return null;
  const misrules = (Array.isArray(r!.misrules) ? r!.misrules : []).flatMap((m): CanvasMisrule[] => {
    const says = (m as CanvasMisrule | null)?.says, because = (m as CanvasMisrule | null)?.because;
    return sayable(says) && typeof because === 'string' && because.trim() ? [{ says: typeof says === 'string' ? says.trim() : says, because: because.trim().slice(0, 200) }] : [];
  });
  const choices = Array.isArray(r!.choices) ? r!.choices.filter(sayable).map(c => String(c).trim()) : [];
  return { answer: typeof value === 'string' ? value.trim() : value, ...(misrules.length ? { misrules } : {}), ...(choices.length ? { choices } : {}) };
}

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
/** A whole number below one hundred in words. */
const underHundred = (n: number): string =>
  n <= 20 ? spokenNumber(n) : TENS[Math.floor(n / 10)] + (n % 10 ? ` ${spokenNumber(n % 10)}` : '');
/**
 * A whole number in words, to 9,999 (place value in wave 2 says 305, 3,005 and 4,050); null past that (said as
 * digits). "three hundred five": the "and" form is added by `spokenForms`.
 */
const numberWord = (n: number): string | null => {
  if (!Number.isInteger(n) || n < 0 || n > 9999) return null;
  if (n < 100) return underHundred(n);
  const th = Math.floor(n / 1000), h = Math.floor((n % 1000) / 100), rest = n % 100;
  return [th ? `${spokenNumber(th)} thousand` : '', h ? `${spokenNumber(h)} hundred` : '', rest ? underHundred(rest) : '']
    .filter(Boolean).join(' ');
};
/** The name of one of `d` equal parts, and of several. */
const PARTS: Record<number, [string, string]> = {
  2: ['half', 'halves'], 3: ['third', 'thirds'], 4: ['fourth', 'fourths'], 5: ['fifth', 'fifths'], 6: ['sixth', 'sixths'],
  7: ['seventh', 'sevenths'], 8: ['eighth', 'eighths'], 9: ['ninth', 'ninths'], 10: ['tenth', 'tenths'],
  12: ['twelfth', 'twelfths'], 16: ['sixteenth', 'sixteenths'], 100: ['hundredth', 'hundredths'],
};
const DIGITS = (s: string) => s.split('').map(d => spokenNumber(Number(d))).join(' ');

/**
 * How a child says the value. The first form is the value as the program wrote it; the last is the most usual way to
 * say it (the harness speaks that one). A whole number to 100 has its word; "3/4" is "three fourths" (and "three
 * quarters", "three over four"); "0.35" is "zero point three five" (and "point three five", "thirty five hundredths").
 */
export function spokenForms(v: string | number): string[] {
  const raw = String(v).trim();
  const out = [raw];
  // A negative number (DI wave 6, 11-16: -7 on a number line, a slope of -2/3) takes the positive's spoken forms
  // after "minus" or "negative"; "negative ..." comes last, the form a grade 6-8 child is taught.
  const neg = /^-\s*(\d.*)$/.exec(raw);
  if (neg) {
    const words = spokenForms(neg[1]).slice(1);
    out.push(...words.map(w => `minus ${w}`), ...words.map(w => `negative ${w}`));
    return out.filter((f, i) => out.indexOf(f) === i);
  }
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(raw), dec = /^(\d*)\.(\d+)$/.exec(raw);
  if (frac) {
    const n = Number(frac[1]), d = Number(frac[2]), top = numberWord(n), bottom = numberWord(d), part = PARTS[d];
    if (top && bottom) out.push(`${top} over ${bottom}`);
    if (top && d === 4) out.push(`${top} ${n === 1 ? 'quarter' : 'quarters'}`);
    // Past one whole, a child may say the mixed number: "one and one fourth" for 5/4.
    if (part && d > 1 && n > d && n % d) out.push(`${numberWord(Math.floor(n / d))} and ${numberWord(n % d)} ${part[n % d === 1 ? 0 : 1]}`);
    if (top && part) out.push(`${top} ${part[n === 1 ? 0 : 1]}`);
  } else if (dec) {
    const whole = Number(dec[1] || 0), places = dec[2].length, count = numberWord(Number(dec[2]));
    if (whole === 0 && count && places <= 2) out.push(`${count} ${PARTS[places === 1 ? 10 : 100][Number(dec[2]) === 1 ? 0 : 1]}`);
    if (whole === 0) out.push(`point ${DIGITS(dec[2])}`);
    out.push(`${numberWord(whole) ?? String(whole)} point ${DIGITS(dec[2])}`);
  } else if (/^\d{1,3}(,\d{3})*$|^\d+$/.test(raw)) {
    const n = Number(raw.replace(/,/g, '')), word = numberWord(n);
    // "three hundred and five" is how many children say it; the plain form stays last (the harness speaks it).
    if (word && n > 100 && n % 100) out.push(`${numberWord(n - (n % 100))} and ${underHundred(n % 100)}`);
    // A child asked "how many are left" says "none" as often as "zero".
    if (n === 0) out.push('none', 'nothing');
    if (word) out.push(word);
  }
  return out.filter((f, i) => out.indexOf(f) === i);
}
const forms = spokenForms;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** A fraction's value as [top, bottom] in lowest terms, or null when the value is not a fraction. */
const fractionValue = (v: string | number): [number, number] | null => {
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(String(v).trim());
  if (!m || !Number(m[2])) return null;
  const n = Number(m[1]), d = Number(m[2]), g = gcd(n, d) || 1;
  return [n / g, d / g];
};
const sameValue = (a: unknown, b: unknown) => {
  const x = fractionValue(String(a)), y = fractionValue(String(b));
  return same(a, b) || (!!x && !!y && x[0] === y[0] && x[1] === y[1]);
};

/**
 * The other names of a fraction's amount: 3/6 is also one half, two fourths and six twelfths (DI batch 2, 11-15: a child who recuts 1/2 + 1/4 into eighths says "six eighths", which is right). Only denominators with a part name, so
 * every form is one a child says. A whole number is not added: "one whole" is how an ask states the amount to shade.
 */
function equalFractionForms(v: string | number): string[] {
  const f = fractionValue(v);
  if (!f || f[1] === 1) return [];
  const [n, d] = f;
  return Object.keys(PARTS).map(Number)
    .filter(p => p % d === 0 && (n * p) / d <= 100)
    .map(p => `${(n * p) / d}/${p}`)
    .filter(x => !same(x, v))
    // The part names only ("two fourths", "one and one half"): the tutor reads this list, so no digits or "over" forms.
    .flatMap(x => forms(x).filter(f => f !== x && !f.includes(' over ')));
}

/** The key the tutor judges by. Never written by an author: read from what the page reported. */
export function canvasSpokenKey(s: CanvasSpoken): SpokenKey {
  const [answer, ...alsoAccept] = forms(s.answer);
  const equal = equalFractionForms(s.answer).filter(x => x !== answer && !alsoAccept.includes(x));
  return { answer, alsoAccept: [...alsoAccept, ...equal], ...(s.choices?.length ? { menu: s.choices } : {}) };
}

/** The known wrong answers of this problem, one per misrule the program named. */
export function canvasSpokenMisses(s: CanvasSpoken): KnownMiss[] {
  return (s.misrules ?? []).slice(0, MISRULE_IDS.length).map((m, i) => ({
    id: MISRULE_IDS[i], pattern: `The learner's answer is ${String(m.says)}: ${m.because}.`, examples: forms(m.says).slice(-1),
  }));
}

/** The harness's spoken answers: the key's own words, and a misrule's answer or a plainly different one. */
export function canvasSay(s: CanvasSpoken): { correct: string; plainWrong: string } {
  const wrong = s.misrules?.[0]?.says ?? s.choices?.find(c => !same(c, s.answer)) ?? (typeof s.answer === 'number' ? s.answer + 1 : 'banana');
  return { correct: forms(s.answer).at(-1)!, plainWrong: forms(wrong).at(-1)! };
}

/**
 * What blocks a said answer, as sentences an author can act on. `reports` are the raw `lumina.answer` reports of the
 * plays that were run (rest, after the proof, after the wrong attempt); a stored lesson passes none.
 */
export function spokenIssues(ask: string, rest: unknown, reports: readonly unknown[] = []): string[] {
  if (rest == null) return reports.some(r => r != null) ? ['lumina.answer is reported only after the child acts: report it from the first render, from params'] : [];
  const s = readSpoken(rest);
  if (!s) return ['lumina.answer takes one value a child can say: a number or a few words (under 40 characters)'];
  const e: string[] = [];
  // The assignment is fixed when the problem opens, so the said answer cannot depend on what the child does.
  if (reports.some(r => !same(readSpoken(r)?.answer, s.answer)))
    e.push('the said answer changed when the child acted: lumina.answer must be the one answer to the ask for these params, computed from params, not from the child\'s work');
  const raw = (rest as { misrules?: unknown }).misrules;
  const listed = Array.isArray(raw) ? raw.length : 0;
  if (listed > MISRULE_IDS.length) e.push(`at most ${MISRULE_IDS.length} misrules: keep the wrong answers children most often give`);
  if (listed !== (s.misrules?.length ?? 0)) e.push('each misrule needs { says, because }: the wrong value a child says, and the wrong rule behind it in a few words');
  for (const m of s.misrules ?? []) if (sameValue(m.says, s.answer)) e.push(`a misrule says ${String(m.says)}, which is the right answer`);
  if (new Set((s.misrules ?? []).map(m => String(m.says).toLowerCase())).size !== (s.misrules?.length ?? 0)) e.push('two misrules say the same value');
  const rawChoices = (rest as { choices?: unknown }).choices;
  if (rawChoices != null) {
    const c = s.choices ?? [];
    if (!Array.isArray(rawChoices) || c.length !== rawChoices.length || c.length < 2 || c.length > 4 || new Set(c.map(x => x.toLowerCase())).size !== c.length)
      e.push('choices takes 2 to 4 different words the child chooses from ("first", "second", "same")');
    else {
      if (!c.some(x => same(x, s.answer))) e.push(`the answer ${String(s.answer)} is not one of the choices`);
      for (const m of s.misrules ?? []) if (!c.some(x => same(x, m.says))) e.push(`a misrule says ${String(m.says)}, which is not one of the choices`);
      e.push(...askLeaks(ask, canvasSpokenKey(s)).map(problem => `the ask ${problem}: an ask with choices says every choice, so the child knows what to pick from`));
    }
  } else e.push(...askLeaks(ask, canvasSpokenKey(s)).map(problem => `the ask ${problem}, and the child may answer out loud`));
  return e;
}

/**
 * What blocks a spec that states a `rule` (a DI canvas, `qa/canvas/DI_CANVAS_ROADMAP.md`): one rule shown over a range
 * of problems, with the wrong rule it replaces named where the two give different answers. `problems` are each
 * problem's report at rest, in order (null: shown only).
 */
export function ruleIssues(problems: ReadonlyArray<CanvasSpoken | null>): string[] {
  const e: string[] = [];
  if (problems.length < 5) e.push(`a rule needs a range of examples: 5 or more problems (it has ${problems.length})`);
  const named = problems.filter(p => p?.misrules?.length).length;
  if (named < 3) e.push(`${named} problem(s) name a misrule: at least 3 need one, on problems where the wrong rule gives a different answer from the right one`);
  const said = problems.map(p => (p ? String(p.answer).toLowerCase() : null));
  const run = said.findIndex((a, i) => a !== null && a === said[i + 1] && a === said[i + 2]);
  if (run >= 0) e.push(`problems ${run + 1} to ${run + 3} have the same answer (${said[run]}): a child can repeat it without using the rule`);
  return e;
}
