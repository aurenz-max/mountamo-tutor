import { digitAtPlace, itemsFromChallenges, type PlaceValueChallengeLike } from '../../primitives/visual-primitives/math/placeValueScript';

export type PlaceValueRemediationMove = 'contrast_digit_worth';

/** Deliberately limited to the reviewed compare/medium pilot. */
export function placeValueRemediationMoveFor(mode: string, tier: string | undefined, focus?: string): PlaceValueRemediationMove | null {
  if (mode !== 'compare' || tier !== 'medium' || !focus?.trim()) return null;
  const text = focus.toLowerCase();
  if (/transpos|omitt|shift|uncertain|missing|unreliable|place name|naming (?:the |a )?place/.test(text)) return null;
  return /digit/.test(text) && /worth|value/.test(text)
    && /bare|face value|itself|regardless|ignores? (?:its |the )?(?:place|position|column)/.test(text)
    ? 'contrast_digit_worth' : null;
}

export function compiledWorthContrast(challenges: readonly PlaceValueChallengeLike[]) {
  const { items } = itemsFromChallenges(challenges, { mode: 'compare', tier: 'medium' });
  const values = items.filter(i => i.kind === 'say_value' && i.place > 0 && i.digit > 0);
  const pair = values.flatMap((a, index) => values.slice(index + 1)
    .filter(b => a.digit === b.digit && a.place !== b.place).map(b => [a, b]))[0];
  return { items, targets: pair ?? values.slice(0, 1), count: pair ? 2 : Math.min(1, values.length) };
}

/** Bounded deterministic selection, with the production compiler as final arbiter.
 * Only two analyze slots can change. Never adds random draws to the no-op path.
 * Caller rebuilds derived choice arrays AFTER selection. Diagnostics stay in QA.
 */
export function selectPlaceValueContrast<T extends PlaceValueChallengeLike & { targetNumber: number; highlightedDigitPlace: number }>(
  baseline: readonly T[], move: PlaceValueRemediationMove | null,
  range = { min: 1111, max: 9999 },
) {
  const original = compiledWorthContrast(baseline);
  const result = (challenges: readonly T[], reason: string) => ({ challenges, reason, ...compiledWorthContrast(challenges) });
  if (!move) return result(baseline, 'no-focus');
  if (original.count === 2) return result(baseline, 'already-targeted');
  const slots = baseline.map((_, i) => i).filter(i => i % 2 === 0);
  const signature = original.items.map(i => `${i.id}:${i.kind}`).join('|');
  const nz = (n: number) => String(n).replace(/0/g, '').length;
  for (const a of slots) for (const b of slots.filter(i => i > a)) {
    for (const p of [1, 2]) for (const q of [1, 2].filter(v => v !== p)) {
      if (!digitAtPlace(baseline[a].targetNumber, p) || !digitAtPlace(baseline[b].targetNumber, q)) continue;
      const preferred = digitAtPlace(baseline[a].targetNumber, p);
      for (const digit of [preferred, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => d !== preferred)]) {
      const first = baseline[a].targetNumber + (digit - preferred) * 10 ** p;
      const old = baseline[b].targetNumber;
      const target = old + (digit - digitAtPlace(old, q)) * 10 ** q;
      if (target < Math.max(1111, range.min) || target > Math.min(9999, range.max)
        || first < Math.max(1111, range.min) || first > Math.min(9999, range.max)
        || first === target || baseline.some((c, i) => i !== a && i !== b && c.targetNumber === first)
        || nz(target) !== nz(old) || baseline.some((c, i) => i !== b && c.targetNumber === target)) continue;
      const candidate = baseline.map((c, i) => i === a ? { ...c, targetNumber: first, highlightedDigitPlace: p }
        : i === b ? { ...c, targetNumber: target, highlightedDigitPlace: q } : c);
      const compiled = compiledWorthContrast(candidate);
      if (compiled.count === 2 && compiled.items.map(i => `${i.id}:${i.kind}`).join('|') === signature) {
        return result(candidate, 'targeted');
      }
      }
    }
  }
  return result(baseline, 'saturated');
}
