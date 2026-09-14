import { digitAtPlace, itemsFromChallenges, type PlaceValueChallengeLike } from '../../primitives/visual-primitives/math/placeValueScript';

export type PlaceValueRemediationMove = 'contrast_digit_worth' | 'contrast_place_name_and_value';

// Exact NBT004-01-b text reviewed with the backend's pinned publication.
// Its examples illustrate a permitted range; they are not fixed lesson targets.
// Any modified objective, or a number in topic/intent, keeps the anchor veto.
const reviewedGradeFourObjective = 'Identify the specific place and numeric value of digits in numbers up to one million. Focus: Mastery of place names and values from ones to millions. Examples: 345,678, 1,000,000, 502,913, 89,456, 712,304, 6,789, 432,198, 999,999. Constraints: Numbers must be within the 0 to 1,000,000 range.';

export function placeValueRemediationRequestFor(request: {
  grade?: string; topic?: string; intent?: string; objectiveText?: string;
  mode: string; tier?: string; focus?: string;
}): PlaceValueRemediationMove | null {
  if (!placeValueTaskAllowsContrast(request)) return null;
  return placeValueRemediationMoveFor(request.mode, request.tier, request.focus);
}

/** Content constraints only; never interprets an observation. */
export function placeValueTaskAllowsContrast(request: {
  grade?: string; topic?: string; intent?: string; objectiveText?: string;
}): boolean {
  const objective = request.grade === '4' && request.objectiveText === reviewedGradeFourObjective
    ? '' : request.objectiveText;
  const text = [request.topic, request.intent, objective].filter(Boolean).join(' ');
  if (!['3', '4'].includes(request.grade ?? '') || /\b\d{2,}\b/.test(text)
    || /\b(?:two|three|[23])[ -]digit|decimal|fraction/i.test(text)) return false;
  return true;
}

/** Legacy receipt-policy recognizer only. Generation uses the shared LLM planner. */
export function placeValueRemediationMoveFor(mode: string, tier: string | undefined, focus?: string): PlaceValueRemediationMove | null {
  if (mode !== 'compare' || tier !== 'medium' || !focus?.trim()) return null;
  const text = focus.toLowerCase();
  if (!/unreliable|missing|contradict|uncertain/.test(text)
    && /place names?|positional name|nam(?:e|ing) (?:a |the )?digit.?s? place/.test(text)
    && /value|worth|digit identity/.test(text)
    && /confus|instead|rather than|interprets|says|gives|responds/.test(text)) return 'contrast_place_name_and_value';
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
