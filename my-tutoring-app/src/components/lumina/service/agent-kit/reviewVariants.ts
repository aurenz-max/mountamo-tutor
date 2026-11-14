/**
 * The review settings the item loop can run (USER 2026-11-08), so a bench can compare them on one first draft and the
 * data decides which checks earn their cost. Plain data: the tester imports it in the browser.
 */

/** The model the item loop's author and solver call. It is an alias: each run's debug records what Google served. */
/** LUMINA_KIT_MODEL overrides it for a model bench (server side only; the browser always sees the default). */
export const KIT_MODEL = (typeof process !== 'undefined' ? process.env?.LUMINA_KIT_MODEL : undefined) || 'gemini-flash-latest';

/** What a look at an item does. */
export interface LookPlan {
  /** Screenshot the item as the child sees it. */
  shot: boolean;
  /** A blind model solves it from the screen and reports shortcuts and issues. */
  solver: boolean;
  /** A difference between the aimed tier and the solver's rating counts as a problem to revise. */
  tierNotes: boolean;
}

export interface ReviewVariant {
  id: string;
  label: string;
  look: LookPlan;
  /** Send items with problems back to the author. */
  revise: boolean;
  /** Show the author its own screenshot once, even when no check found a problem. */
  selfReview: boolean;
}

export const FULL_REVIEW_ID = 'full';

export const REVIEW_VARIANTS: readonly ReviewVariant[] = [
  { id: 'draft', label: 'First draft, no review', look: { shot: false, solver: false, tierNotes: false }, revise: false, selfReview: false },
  { id: 'self', label: 'Author checks its own screenshot', look: { shot: true, solver: false, tierNotes: false }, revise: true, selfReview: true },
  { id: 'solver', label: 'Solver feedback, no difficulty notes', look: { shot: true, solver: true, tierNotes: false }, revise: true, selfReview: false },
  { id: FULL_REVIEW_ID, label: 'Solver and difficulty notes (current)', look: { shot: true, solver: true, tierNotes: true }, revise: true, selfReview: false },
];

export const reviewVariant = (id: string): ReviewVariant | undefined => REVIEW_VARIANTS.find(v => v.id === id);
