/**
 * Canonical grade → biology complexity band.
 *
 * The shared fix for the biology flavour of the 2026-08-04 `14m` prose-grade
 * class, found by the reader-fit supply-side sweep (item 15B, S9/S13/S14/S15).
 * Four biology generators independently wrote:
 *
 *   const gradeBandMap: Record<string, 'K-2' | '3-5' | '6-8'> = {
 *     'K': 'K-2', '1': 'K-2', … '8': '6-8', 'K-2': 'K-2', …
 *   };
 *   const gradeBand = config.gradeBand || gradeBandMap[ctx.gradeContext] || '3-5';
 *
 * The map is keyed on bare grade TOKENS but indexed with `ctx.gradeContext`,
 * which is PROSE ("kindergarten students - Use age-appropriate…"). The lookup
 * therefore missed on every input at every grade, and the `|| '3-5'` default
 * always won — verified by probe at `grade=K` on classification-sorter
 * (`gradeBand:'3-5'`, three categories against a catalog K-2 rung reading
 * "Binary sorts only (2 categories)") and on life-cycle-sequencer.
 *
 * `generationContext.ts` states the contract outright: never parse grade out of
 * `gradeContext`; read `ctx.grade`.
 *
 * Extracted to one module so the four copies cannot drift, and so a future
 * biology generator gets the correct behaviour by import rather than by
 * re-deriving it.
 */

export type BiologyBand = 'K-2' | '3-5' | '6-8';

/**
 * Canonical-first resolver. Returns null when there is no canonical grade, so
 * the caller's prose fallback stands rather than a rung being invented.
 */
export const biologyBandFromGrade = (grade?: string): BiologyBand | null => {
  const g = (grade ?? '').toString().trim().toUpperCase();
  if (!g) return null;
  if (g === 'K' || g === 'KINDERGARTEN' || g === 'PRESCHOOL') return 'K-2';
  if (g === 'K-2' || g === '3-5' || g === '6-8') return g as BiologyBand;
  const n = parseInt(g, 10);
  if (isNaN(n)) return null;
  if (n <= 2) return 'K-2';
  if (n <= 5) return '3-5';
  return '6-8';
};

/**
 * Legacy prose fallback — the SECOND resolver, never the first.
 *
 * Note this actually parses prose, unlike the map it replaces: the old
 * `gradeBandMap` could never match a prose string, which is precisely why every
 * grade silently collapsed to '3-5'.
 */
export const biologyBandFromProse = (prose?: string): BiologyBand => {
  const p = (prose ?? '').toLowerCase();
  if (/\b(kindergarten|preschool|grade 1|1st grade|grade 2|2nd grade)\b/.test(p)) return 'K-2';
  if (/\b(grade [345]|[345](rd|th) grade)\b/.test(p)) return '3-5';
  if (/\b(grade [678]|[678]th grade|middle school)\b/.test(p)) return '6-8';
  return '3-5';
};

/**
 * The whole resolution in one call: explicit config override wins, then the
 * canonical grade, then prose.
 */
export const resolveBiologyBand = (
  configBand: string | undefined,
  canonicalGrade: string | undefined,
  gradeContextProse: string | undefined,
): BiologyBand =>
  (configBand as BiologyBand | undefined)
  ?? biologyBandFromGrade(canonicalGrade)
  ?? biologyBandFromProse(gradeContextProse);
