import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Place-value-chart oracle — a CALCULATION oracle for the "digit place values
 * sum to the number" contract. Where math-fact-fluency re-derives op1(±)op2,
 * this one re-derives the PLACE VALUE of the highlighted digit and the
 * buildability of the target number — the three things PlaceValueChart.tsx
 * actually judges a student on, across its within-challenge phases.
 *
 * The component (PlaceValueChart.tsx) judges each challenge in three phases:
 *  - Phase 1 "Identify the Place" (handleCheckPlace, ~L464):
 *    `selectedPlaceName === getPlaceName(highlightedDigitPlace)`. There is no
 *    shipped correctPlaceName field — the correct choice is implicitly the
 *    placeNameChoice that equals the place name of highlightedDigitPlace. So the
 *    contract is: that name MUST appear in placeNameChoices (exactly once), or
 *    the student can never pass Phase 1.
 *  - Phase 2 "Find the Value" (handleCheckValue, ~L508):
 *    `selectedValue === getDigitValue(highlightedDigit, highlightedDigitPlace)`,
 *    where `highlightedDigit = getDigitAtPlace(targetNumber, highlightedDigitPlace)`.
 *    The correct value MUST appear among digitValueChoices[].value (exactly once).
 *  - Phase 3 "Build the Number" (handleSubmitBuild, ~L595):
 *    `Math.abs(studentValue - targetNumber) < 0.0001`, where studentValue is the
 *    sum of digit×10^place over places [minPlace, maxPlace]. So targetNumber MUST
 *    be reconstructible within [minPlace, maxPlace] or it is literally unbuildable.
 *
 * THE INDEPENDENCE RULE: the component AND the generator both extract the digit
 * with `Math.floor(abs / 10^place) % 10`. This oracle deliberately extracts the
 * digit a DIFFERENT way — by indexing the decimal STRING of the number — and
 * re-derives the place value and the build reconstruction from that. It never
 * trusts a shipped answer key (there isn't one; correctness is computed at
 * runtime) — it verifies the choice arrays actually CONTAIN the answer the
 * component will grade correct, and that the build target is achievable.
 *
 * Checks:
 *  - answer-key-desync : correct place name present in placeNameChoices exactly
 *    once; correct digit value present in digitValueChoices exactly once;
 *    targetNumber reconstructs within [minPlace, maxPlace] (buildable); option
 *    integrity (no duplicate place names / duplicate values that would create an
 *    ambiguous or unselectable key).
 *  - scope             : every targetNumber within [0, ceiling]. The per-mode
 *    numberRange (identify 11-99 … expanded_form 1111-99999) is INTRINSIC and is
 *    NOT clamped to the objective — a "Place value to 100" objective resolved to
 *    the compare/expanded modes emits 4-5 digit numbers. Live-catchable.
 *  - clustering        : targetNumbers spread (no "every number is 500"), and no
 *    exact-duplicate challenge (same number + same highlighted place). The SAME
 *    number with a DIFFERENT highlighted place is legitimate multi-column
 *    practice, not a repeat.
 *  - schema            : ≥3 challenges (mastery-over-demo); well-formed place
 *    range; highlightedDigitPlace inside [minPlace, maxPlace] and landing on a
 *    NON-zero digit (the generator guarantees this — a zero highlight is a
 *    degenerate card with no visible highlighted digit).
 *
 * Deliberately NOT checked:
 *  - answer-leak. The target number is the STIMULUS — it is rendered in full
 *    with the queried digit highlighted, and "Highlighted digit: N" is echoed by
 *    design. The place name and value are the answers, but the number itself must
 *    be visible for the task to exist. A leak test would fire on the necessary
 *    stimulus and route phantom bugs to /eval-fix — worse than an honest gap.
 *    Leak/quality stays with /eval-test.
 *  - wordForm↔value consistency of digitValueChoices. The component displays
 *    wordForm but grades on value; verifying the English word-form ("Seventy"↔70)
 *    would require porting the generator's buildDigitValueWord logic, violating
 *    independence. We check value integrity (present-once, no dup values) and
 *    that no two tiles show the same word; deeper word correctness stays with
 *    /eval-test. Listed in uncheckedTypes as "digit-value-wordform".
 */

/** Standard place-value names (mirrors the component's PLACE_NAMES map). */
const PLACE_NAMES: Record<number, string> = {
  6: 'Millions',
  5: 'Hundred Thousands',
  4: 'Ten Thousands',
  3: 'Thousands',
  2: 'Hundreds',
  1: 'Tens',
  0: 'Ones',
  [-1]: 'Tenths',
  [-2]: 'Hundredths',
  [-3]: 'Thousandths',
};

function placeName(place: number): string {
  return PLACE_NAMES[place] ?? `10^${place}`;
}

/**
 * Extract the digit at `place` by indexing the number's decimal STRING —
 * deliberately different from the component/generator's arithmetic
 * `Math.floor(abs / 10^place) % 10` (the independence rule). Returns 0 for any
 * place beyond the number's own digits.
 */
function digitAtPlace(n: number, place: number): number {
  const [intPart, decPart = ''] = Math.abs(n).toString().split('.');
  if (place >= 0) {
    const idx = intPart.length - 1 - place;
    return idx >= 0 && idx < intPart.length ? Number(intPart[idx]) : 0;
  }
  const decIdx = -place - 1;
  return decIdx < decPart.length ? Number(decPart[decIdx]) : 0;
}

const INTRINSIC_MAX = 9_999_999; // component supports up to the Millions place.

export const placeValueChartOracle: ContentOracle = {
  componentId: 'place-value-chart',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    // Objective ceiling wins when the topic/harness carries one; else the
    // primitive's intrinsic max (Millions). The per-mode numberRange is NOT a
    // ceiling — the generator never clamps it to the objective.
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? INTRINSIC_MAX;

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    // The session-level challengeType (identify/build/compare/expanded_form) does
    // not branch the component's judging — every challenge runs the same 3-phase
    // flow — so there are no per-challenge types to skip. Record the ONE gap we
    // deliberately leave inside the checked path.
    uncheckedTypes.add('digit-value-wordform');

    const targetNumbers: number[] = [];
    // Full task identity: a repeat is the SAME number highlighted at the SAME
    // place. The same number with a different highlighted place is different
    // practice (a different column), not a duplicated card.
    const taskSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const where = id;

      const targetNumber = c.targetNumber;
      const place = c.highlightedDigitPlace;
      const minPlace = c.minPlace;
      const maxPlace = c.maxPlace;

      if (typeof targetNumber !== 'number' || !Number.isFinite(targetNumber)) {
        violations.push({ check: 'schema', where, detail: `targetNumber not a finite number: ${JSON.stringify(targetNumber)}` });
        continue;
      }
      if (!Number.isInteger(place) || !Number.isInteger(minPlace) || !Number.isInteger(maxPlace)) {
        violations.push({ check: 'schema', where, detail: `place indices not integers: highlighted=${JSON.stringify(place)} min=${JSON.stringify(minPlace)} max=${JSON.stringify(maxPlace)}` });
        continue;
      }
      const hp = place as number;
      const lo = minPlace as number;
      const hi = maxPlace as number;
      if (lo > hi) {
        violations.push({ check: 'schema', where, detail: `minPlace ${lo} > maxPlace ${hi}` });
        continue;
      }
      checked++;

      // ── highlighted place must be inside the rendered range and land on a
      //    non-zero digit (a zero highlight has no visible digit to reason about) ──
      if (hp < lo || hp > hi) {
        violations.push({ check: 'schema', where, detail: `highlightedDigitPlace ${hp} outside chart range [${lo}, ${hi}]` });
      }
      const digit = digitAtPlace(targetNumber, hp);
      if (digit === 0) {
        violations.push({
          check: 'schema',
          where,
          detail: `highlighted place ${placeName(hp)} (10^${hp}) holds a 0 in ${targetNumber} — degenerate card, no highlighted digit`,
        });
      }

      // ── Phase 1: correct place name must be selectable (present exactly once) ──
      const correctName = placeName(hp);
      const nameChoices = Array.isArray(c.placeNameChoices) ? (c.placeNameChoices as unknown[]).map(String) : [];
      if (nameChoices.length === 0) {
        violations.push({ check: 'schema', where, detail: 'placeNameChoices missing or empty' });
      } else {
        const nameHits = nameChoices.filter((n) => n === correctName).length;
        if (nameHits === 0) {
          violations.push({ check: 'answer-key-desync', where, detail: `correct place name "${correctName}" (place 10^${hp}) is not among placeNameChoices [${nameChoices.join(', ')}]` });
        } else if (nameHits > 1) {
          violations.push({ check: 'answer-key-desync', where, detail: `place name "${correctName}" appears ${nameHits}× in placeNameChoices — ambiguous/duplicated key` });
        }
        if (new Set(nameChoices).size !== nameChoices.length) {
          violations.push({ check: 'schema', where, detail: `duplicate placeNameChoices: [${nameChoices.join(', ')}]` });
        }
      }

      // ── Phase 2: correct digit value must be selectable (present exactly once) ──
      const expectedValue = digit * Math.pow(10, hp);
      const valueChoices = asRecordArray(c.digitValueChoices);
      if (valueChoices.length === 0) {
        violations.push({ check: 'schema', where, detail: 'digitValueChoices missing or empty' });
      } else {
        const values = valueChoices.map((v) => v.value);
        const valueHits = values.filter((v) => v === expectedValue).length;
        if (valueHits === 0) {
          violations.push({
            check: 'answer-key-desync',
            where,
            detail: `correct value ${expectedValue} (digit ${digit} in ${placeName(hp)}) is not among digitValueChoices [${values.join(', ')}]`,
          });
        } else if (valueHits > 1) {
          violations.push({ check: 'answer-key-desync', where, detail: `correct value ${expectedValue} appears ${valueHits}× in digitValueChoices — ambiguous key` });
        }
        // Duplicate VALUES make an ambiguous key (component grades on value).
        if (new Set(values.map(String)).size !== values.length) {
          violations.push({ check: 'answer-key-desync', where, detail: `duplicate values in digitValueChoices: [${values.join(', ')}]` });
        }
        // Duplicate displayed WORDS confuse the student even if values differ.
        const words = valueChoices.map((v) => String(v.wordForm));
        if (new Set(words).size !== words.length) {
          violations.push({ check: 'schema', where, detail: `duplicate wordForms in digitValueChoices: [${words.join(', ')}]` });
        }
      }

      // ── Phase 3: targetNumber must be buildable within [minPlace, maxPlace] ──
      // Reconstruct from OUR own digit extraction over the rendered columns.
      let built = 0;
      for (let p = lo; p <= hi; p++) built += digitAtPlace(targetNumber, p) * Math.pow(10, p);
      if (Math.abs(built - targetNumber) > 1e-9) {
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: `target ${targetNumber} is unbuildable within columns [${lo}, ${hi}] — those columns reconstruct to ${built}`,
        });
      }

      // ── scope: targetNumber within the objective ceiling ──
      if (targetNumber > ceiling || targetNumber < 0) {
        violations.push({
          check: 'scope',
          where,
          detail: `targetNumber ${targetNumber} outside [0, ${ceiling}] (topic "${ctx.topic}")`,
        });
      }

      targetNumbers.push(targetNumber);
      const taskKey = `${targetNumber}@${hp}`;
      taskSeen.set(taskKey, (taskSeen.get(taskKey) ?? 0) + 1);
    }

    // ── clustering: numbers spread, no exact-duplicate card ──
    const variety = checkAnswerVariety(targetNumbers, 'challenges[].targetNumber');
    if (variety) violations.push(variety);
    taskSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({ check: 'clustering', where: 'challenges[]', detail: `identical challenge "${key}" (number @ place) appears ${count}× — a duplicated card` });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
