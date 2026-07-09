import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Percent-bar oracle — a REACHABILITY + RE-DERIVATION oracle for a multi-step
 * percent primitive whose challenges are either a single bar PLACEMENT
 * (direct/subtraction) or an ordered sequence of place/choice sub-steps
 * (addition: rate → total; comparison: price A → price B → choose). It ships no
 * boolean "correct" flag: the answer IS the (targetPercent) each place step is
 * judged against within a TOLERANCE band, and the (correctOptionId) each choice
 * step is judged against. The oracle proves those keys are REACHABLE and, for the
 * comparison choice, INDEPENDENTLY correct.
 *
 * The component (PercentBar.tsx) judges correctness step-by-step in
 * handleCheckAnswer (:495):
 *  - PLACE step (:516-519): correct = isWithinTolerance(currentPercent,
 *    targetPercent), TOLERANCE = 2 (:151, :420). The bar maps pixel-width to
 *    0..maxPercent (handleBarInteraction, :438) where maxPercent = the step's
 *    `maxPercent ?? 100` (:308). So a targetPercent OUTSIDE [0, maxPercent] can
 *    never be placed — the array-grid "unreachable correct state" class. (Addition
 *    "total" steps legitimately extend the bar past 100%: targetPercent ~112 on a
 *    maxPercent 150 bar — so the ceiling is per-step, NOT a flat 100.)
 *  - CHOICE step (:520-522): correct = selectedOption === correctOptionId, options
 *    rendered by id (:918-938). If correctOptionId ∉ options[].id the correct
 *    option can never be clicked — the vocabulary-explorer "correct answer isn't
 *    among the options" desync. Single-step challenges (direct/subtraction) carry
 *    no `steps` array; the component synthesises one place-step from the legacy
 *    targetPercent/wholeValue/maxPercent (challengeToSteps, :155-168) — the oracle
 *    mirrors that synthesis so those modes are covered too.
 *
 * THE INDEPENDENCE RULE: the oracle never trusts the stored key as its own proof.
 *  - place: it checks the target is on the bar the COMPONENT actually renders
 *    (0 ≤ target ≤ step.maxPercent ?? 100) — the reachability the tolerance-band
 *    judge needs, derived from the same maxPercent the bar interaction reads, not
 *    from any "isCorrect" flag.
 *  - comparison choice: it RE-DERIVES the answer the way a student does — parse the
 *    dollar price off each option's `sublabel` ($54.00 → 54), read "cheaper" vs
 *    "more expensive" off the prompt, and pick the min-/max-price option — then
 *    checks correctOptionId agrees. A generator that computes the sale prices right
 *    but stamps the wrong option (or flips cheaper/expensive) can no longer
 *    false-pass. When a sublabel can't be parsed as a price (non-comparison choice,
 *    or a format change) the re-derivation is skipped — but existence + uniqueness
 *    of correctOptionId among the options is ALWAYS enforced, so the desync floor
 *    holds regardless.
 *
 * Checks:
 *  - answer-key-desync : every place-step target is reachable on its own bar
 *    (0 ≤ target ≤ maxPercent); every choice-step correctOptionId references an
 *    option that exists (unique ids); and — where the sublabel prices + prompt make
 *    it derivable — the correct option re-derived from the prices matches the key.
 *  - scope             : percent is an INTRINSIC 0–100 domain (addition totals
 *    extend to the step's maxPercent by design), so unlike a counting primitive
 *    there is no external magnitude ceiling to bite unless the harness/topic names
 *    one. Honors ctx.scopeMax ?? a "to N" topic as an upper ceiling on every place
 *    target when present; otherwise there is nothing to check (documented, not a
 *    silent skip). The [0, maxPercent] band itself is enforced as reachability above.
 *  - clustering        : the place-step targets must spread across the session (no
 *    "every target is 50%"), and no exact-duplicate challenge card (same type +
 *    same scenario + same step signature twice — a byte-identical problem).
 *  - schema            : ≥3 challenges (mastery-over-demo); each challenge has a
 *    valid type and derivable steps; place steps have a finite target and a
 *    positive whole; choice steps have a non-empty options array with unique string
 *    ids and a string correctOptionId.
 *
 * Deliberately NOT checked: answer-leak. Every prompt states the stimulus the
 * student reasons over by design — the scenario names the price/rate, the
 * calculation panel and hints spell out the arithmetic at the easy/medium support
 * tiers on purpose, and the comparison choice's sublabels ARE the two prices the
 * student just computed (the whole point of the compare step). A leak test would
 * fire on the intended stimulus, worse than an honest gap. Leak/quality (and the
 * hint-explicitness tier contract) stay with /eval-test.
 *
 * uncheckedTypes: records any step `kind` that is neither 'place' nor 'choice'
 * (the two the component knows), and any challenge `type` outside the four modes.
 */

const KNOWN_CHALLENGE_TYPES = new Set(['direct', 'subtraction', 'addition', 'comparison']);
// Default bar ceiling when a place step names no maxPercent (PercentBar.tsx:308).
const DEFAULT_MAX_PERCENT = 100;

interface PlaceStep {
  kind: 'place';
  targetPercent: number;
  wholeValue: number;
  maxPercent: number;
}
interface ChoiceStep {
  kind: 'choice';
  prompt: string;
  options: Array<Record<string, unknown>>;
  correctOptionId: unknown;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Parse a dollar price out of a sublabel like "$54.00" / "42" → number, else null. */
function parsePrice(sublabel: unknown): number | null {
  if (typeof sublabel !== 'string') return null;
  const m = sublabel.match(/-?\$?\s*(\d[\d,]*(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** 'cheaper' → want the min price; 'more expensive' → want the max. Null = undecidable. */
function priceDirection(prompt: string): 'min' | 'max' | null {
  const p = prompt.toLowerCase();
  if (/\bexpensive\b/.test(p)) return 'max';
  if (/\bcheaper\b|\bcheapest\b|\bless\b|\blower\b/.test(p)) return 'min';
  return null;
}

export const percentBarOracle: ContentOracle = {
  componentId: 'percent-bar',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    // Percent is an intrinsic 0–100 domain (addition totals extend to the step's
    // maxPercent), so there is no external ceiling unless the harness/topic names one.
    const externalCeiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic);

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    const placeTargets: number[] = [];
    const cardSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const type = String(c.type ?? '');
      if (!KNOWN_CHALLENGE_TYPES.has(type)) {
        uncheckedTypes.add(type || '(missing type)');
      }

      // Mirror the component's challengeToSteps synthesis (:155-168): single-step
      // challenges carry no `steps` array — build one place step from legacy fields.
      const rawSteps = Array.isArray(c.steps) && c.steps.length > 0
        ? (c.steps as unknown[])
        : [{ kind: 'place', targetPercent: c.targetPercent, wholeValue: c.wholeValue, maxPercent: c.maxPercent }];

      const sigParts: string[] = [type, String(c.scenario ?? '')];
      let challengeChecked = false;

      for (let s = 0; s < rawSteps.length; s++) {
        const stepRaw = rawSteps[s];
        if (typeof stepRaw !== 'object' || stepRaw === null) {
          violations.push({ check: 'schema', where: `${id}.steps[${s}]`, detail: `step is not an object: ${JSON.stringify(stepRaw)}` });
          continue;
        }
        const step = stepRaw as Record<string, unknown>;
        const kind = String(step.kind ?? '');

        if (kind === 'place') {
          const target = step.targetPercent;
          const whole = step.wholeValue;
          const maxPercent = isFiniteNumber(step.maxPercent) ? step.maxPercent : DEFAULT_MAX_PERCENT;
          if (!isFiniteNumber(target)) {
            violations.push({ check: 'schema', where: `${id}.steps[${s}]`, detail: `place step targetPercent is not a finite number: ${JSON.stringify(target)}` });
            continue;
          }
          if (!isFiniteNumber(whole) || whole <= 0) {
            violations.push({ check: 'schema', where: `${id}.steps[${s}]`, detail: `place step wholeValue must be a positive number; got ${JSON.stringify(whole)}` });
            continue;
          }
          challengeChecked = true;
          placeTargets.push(target);
          sigParts.push(`p:${target}@${whole}`);

          // ── answer-key-desync (reachability): the target must sit on the bar the
          //    component actually renders (0..maxPercent). Outside it, the
          //    tolerance-band judge has no placeable value that scores correct. ──
          if (target < 0 || target > maxPercent) {
            violations.push({
              check: 'answer-key-desync',
              where: `${id}.steps[${s}]`,
              detail: `targetPercent ${target} is off the bar (0..${maxPercent}) — no placement scores correct, the step is unwinnable`,
            });
          }

          // ── scope: only when the harness/topic names an external ceiling. ──
          if (externalCeiling !== undefined && target > externalCeiling) {
            violations.push({
              check: 'scope',
              where: `${id}.steps[${s}]`,
              detail: `targetPercent ${target} exceeds objective ceiling ${externalCeiling} (topic "${ctx.topic}")`,
            });
          }
        } else if (kind === 'choice') {
          const options = Array.isArray(step.options) ? (step.options as unknown[]) : null;
          if (!options || options.length === 0) {
            violations.push({ check: 'schema', where: `${id}.steps[${s}]`, detail: `choice step needs a non-empty options array; got ${JSON.stringify(step.options)}` });
            continue;
          }
          const optRecords = options.filter((o) => typeof o === 'object' && o !== null) as Array<Record<string, unknown>>;
          const ids = optRecords.map((o) => (typeof o.id === 'string' ? o.id : null));
          if (optRecords.length !== options.length || ids.some((x) => x === null)) {
            violations.push({ check: 'schema', where: `${id}.steps[${s}]`, detail: `every option must be an object with a string id; got ${JSON.stringify(options)}` });
            continue;
          }
          const stringIds = ids as string[];
          // Duplicate ids → a dead/ambiguous choice.
          if (new Set(stringIds).size !== stringIds.length) {
            violations.push({ check: 'schema', where: `${id}.steps[${s}]`, detail: `duplicate option ids: [${stringIds.join(', ')}]` });
          }
          challengeChecked = true;
          const correctId = step.correctOptionId;
          sigParts.push(`c:${[...stringIds].sort().join('/')}:${String(correctId)}`);

          // ── answer-key-desync: the correct option must EXIST among the options. ──
          if (typeof correctId !== 'string' || !stringIds.includes(correctId)) {
            violations.push({
              check: 'answer-key-desync',
              where: `${id}.steps[${s}]`,
              detail: `correctOptionId ${JSON.stringify(correctId)} is not among option ids [${stringIds.join(', ')}] — the correct option can never be clicked`,
            });
          } else {
            // ── Independence: re-derive the correct option from the displayed
            //    prices + the prompt direction, and check the key agrees. ──
            const dir = priceDirection(String(step.prompt ?? ''));
            const priced = optRecords.map((o) => ({ id: String(o.id), price: parsePrice(o.sublabel) }));
            const allPriced = priced.every((o) => o.price !== null);
            if (dir && allPriced) {
              const target = dir === 'min'
                ? priced.reduce((a, b) => (b.price! < a.price! ? b : a))
                : priced.reduce((a, b) => (b.price! > a.price! ? b : a));
              // Skip on a tie — the "which is X" question is ambiguous, not a desync
              // the oracle can pin (the generator's guard keeps prices ≥ $1 apart).
              const tie = priced.filter((o) => o.price === target.price).length > 1;
              if (!tie && correctId !== target.id) {
                violations.push({
                  check: 'answer-key-desync',
                  where: `${id}.steps[${s}]`,
                  detail: `prompt asks for the ${dir === 'min' ? 'cheaper' : 'more expensive'} option; prices ${priced.map((o) => `${o.id}=$${o.price}`).join(', ')} → ${target.id}, but correctOptionId is "${correctId}" — a correct click would be marked wrong`,
                });
              }
            }
          }
        } else {
          // A step kind the component cannot render — honest coverage gap.
          uncheckedTypes.add(`step:${kind || '(missing kind)'}`);
        }
      }

      if (challengeChecked) {
        checked++;
        const sig = sigParts.join('|');
        cardSeen.set(sig, (cardSeen.get(sig) ?? 0) + 1);
      }
    }

    // ── clustering: place targets spread (no "every target is 50%") ──
    const variety = checkAnswerVariety(placeTargets, 'challenges[].targetPercent');
    if (variety) violations.push(variety);

    // ── clustering: no exact-duplicate challenge card ──
    cardSeen.forEach((count, sig) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical challenge card "${sig}" appears ${count}× — a duplicated problem`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
