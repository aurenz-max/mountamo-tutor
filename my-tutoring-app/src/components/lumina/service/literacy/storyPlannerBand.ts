/**
 * story-planner reading band — shared by the generator and the component.
 *
 * Why a shared module rather than a constant in each file: the generator DECIDES
 * whether to emit picture-choice content and the component DECIDES whether to
 * render the picture surface. If those two lists are hand-copied they drift, and
 * the failure is silent — the component renders empty compose fields to a
 * five-year-old, or the generator ships choices nothing reads. Same lesson as
 * `service/biology/gradeBand.ts` (four generators had independently written the
 * same wrong lookup); obtain the behaviour by import.
 *
 * Pure: no React, no Gemini. Safe on both sides of the client boundary.
 */

/**
 * The grades that get the tap-a-picture planner instead of the free-text one.
 * K and 1 cannot read the prompts or type an answer (PRE / EMERGING band
 * contract rules 3 and 6), so their plan is assembled by tapping pictures.
 */
export const STORY_PLANNER_PICTURE_BAND: readonly string[] = ['K', '1'];

/** Options offered per element at K-1. Band-contract rule 4: few things per screen. */
export const STORY_PLANNER_MAX_CHOICES = 3;

/**
 * Canonical grade key from whatever ended up on `data.gradeLevel`.
 *
 * The generator stamps the resolved rung, so on the happy path this sees a bare
 * 'K'..'6'. The prose and long-form cases are a backstop, not the contract —
 * `scale-comparator` shipped a whole sentence into this field through an `as`
 * cast, which killed a band gate that looked correct. Returns null when nothing
 * grade-shaped is present, so callers fall back rather than guess.
 */
export function normalizeStoryPlannerGrade(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (/^(k\b|kindergarten|kinder|pre-?k|preschool)/.test(s)) return 'K';
  const digits = s.match(/\d+/);
  if (!digits) return null;
  const n = parseInt(digits[0], 10);
  if (isNaN(n)) return null;
  if (n === 0) return 'K';
  return String(Math.min(n, 6));
}

/** True when this grade gets the tap-a-picture planner. */
export function isStoryPlannerPictureBand(raw?: string | null): boolean {
  const grade = normalizeStoryPlannerGrade(raw);
  return grade !== null && STORY_PLANNER_PICTURE_BAND.includes(grade);
}
