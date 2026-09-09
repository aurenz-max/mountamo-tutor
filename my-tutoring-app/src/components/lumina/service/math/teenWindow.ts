/**
 * teenWindow — the number window a K.NBT.1 lesson is actually about, and the
 * sweep that covers it.
 *
 * WHY THIS EXISTS. The first live draw of `ten-frame / decompose_teen` against
 * the published objective "Break apart numbers 16-19 into ten ones and some
 * further ones" came back 13, 14, 14, 15, 15, 16 — one item of six inside the
 * window the objective names. The prompt said 11-19 and flash-lite drifted to
 * the bottom of it, which is the same shape as the cap-below-the-objective
 * defect the K Math atlas filed against `ten-frame / build` in the first place.
 * Fixing that by asking the model more firmly would be the move the standing
 * ruling rejects: the LLM emits scope, CODE builds structure and the answer.
 *
 * So the teen numbers are code-owned outright. The model still chooses the
 * hints, the narration and the title; it does not choose which teen numbers a
 * teen-number lesson is about.
 *
 * WHY IT IS NOT IN `scopeContext`. That module states as a rule that it injects
 * no number ranges and does not parse the topic — the objective text binds the
 * model and primitive-specific guidance stays in the primitive. A teen window
 * is exactly that kind of primitive-specific knowledge, so it lives here, in
 * one place, shared by the two generators that need it (`gemini-ten-frame` and
 * `gemini-number-bond`) rather than copied into both.
 */

/** CCSS K.NBT.1's own range: "numbers from 11 to 19". */
export const TEEN_MIN = 11;
export const TEEN_MAX = 19;

export interface TeenWindow {
  start: number;
  end: number;
}

const TEEN_WORDS: Record<string, number> = {
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

/**
 * The teen numbers a lesson's own words name, as a window.
 *
 * Deliberately narrow: only standalone two-digit tokens in 11..19 and the nine
 * teen WORDS count. "ten ones" contributes nothing (ten is not a teen number),
 * a year or a standard code contributes nothing (they are not standalone
 * two-digit tokens in range), and a lesson that names no teen number at all
 * gets the full 11-19 — the objective's range when it does not narrow it.
 */
export const resolveTeenWindow = (...texts: Array<string | undefined>): TeenWindow => {
  const found: number[] = [];
  for (const text of texts) {
    if (!text) continue;
    const lower = text.toLowerCase();
    // `match` rather than `matchAll` — the project's tsconfig target predates
    // the iterator protocol matchAll returns.
    for (const token of lower.match(/\d+/g) ?? []) {
      const value = Number(token);
      if (token.length === 2 && value >= TEEN_MIN && value <= TEEN_MAX) found.push(value);
    }
    for (const [word, value] of Object.entries(TEEN_WORDS)) {
      if (new RegExp(`\\b${word}\\b`).test(lower)) found.push(value);
    }
  }
  if (found.length === 0) return { start: TEEN_MIN, end: TEEN_MAX };
  return { start: Math.min(...found), end: Math.max(...found) };
};

/**
 * `count` teen numbers that cover the window, ascending and wrapping.
 *
 * Ascending because the prompt already promises challenges that "progress in
 * difficulty" and counting on from ten gets harder as the ones grow. Wrapping
 * because a window of four asked six times has to repeat something, and
 * repeating the whole window in order is more honest practice than repeating
 * one number — the same reason `split` repeats each total rather than drawing
 * at random.
 */
export const teenSweep = (window: TeenWindow, count: number): number[] => {
  const start = Math.max(TEEN_MIN, Math.min(TEEN_MAX, window.start));
  const end = Math.max(start, Math.min(TEEN_MAX, window.end));
  const size = end - start + 1;
  return Array.from({ length: Math.max(0, count) }, (_, i) => start + (i % size));
};
