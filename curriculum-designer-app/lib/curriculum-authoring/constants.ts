/**
 * Canonical grade codes used across the curriculum system.
 *
 * Storage: always use the short code (e.g., "K", "3", "PK").
 * Display: map to label at the UI layer only.
 */
export const GRADE_CODES = {
  PK: 'Pre-K',
  K: 'Kindergarten',
  '1': '1st Grade',
  '2': '2nd Grade',
  '3': '3rd Grade',
  '4': '4th Grade',
  '5': '5th Grade',
  '6': '6th Grade',
  '7': '7th Grade',
  '8': '8th Grade',
  '9': '9th Grade',
  '10': '10th Grade',
  '11': '11th Grade',
  '12': '12th Grade',
} as const;

export type GradeCode = keyof typeof GRADE_CODES;

export const GRADE_CODE_LIST = Object.keys(GRADE_CODES) as GradeCode[];
