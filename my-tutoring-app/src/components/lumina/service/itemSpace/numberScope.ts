/**
 * The range of whole numbers an objective names, for a space's `scopeOf` (8.1c). A knowledge check on
 * "compare two-digit numbers" drew 3 vs 14 because the compare spaces had no scope. Read from the words a
 * standard uses for the range: "two-digit", "three-digit", "teen numbers", "within 20", "to 100", "up to 50".
 * Undefined when the objective names none (the whole strand).
 */
export function namedNumberRange(objective: string): { min: number; max: number } | undefined {
  const o = objective.toLowerCase();
  if (/\b(three|3)[- ]digit\b/.test(o)) return { min: 100, max: 999 };
  if (/\b(two|2)[- ]digit\b/.test(o)) return { min: 10, max: 99 };
  if (/\bteen numbers?\b|\bteens\b/.test(o)) return { min: 11, max: 19 };
  const m = o.match(/\b(?:within|up to|to|through|less than or equal to)\s+(\d{1,4})\b/);
  if (m) return { min: 0, max: Number(m[1]) };
  return undefined;
}
