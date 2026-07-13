import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety } from './helpers';

/**
 * Distribution-explorer oracle — verifies the pre-built probability workbench
 * challenge set against the primitive's answer CONTRACT.
 *
 * The component (DistributionExplorer.tsx) renders four challenge types, three of
 * them MCQ-graded on a shuffled option list:
 *  - identify        : radio of [correctFamily, ...distractors]; correct = the
 *      picked family === correctFamily.
 *  - compute         : numeric MCQ of [correctValue, ...distractors]; correct =
 *      the picked value === correctValue.
 *  - predict_shape   : MCQ of [acceptableAnswers[0], ...distractors]; correct =
 *      the pick matches an acceptableAnswer (case-insensitive).
 *  - guided_exploration : open prompt, NO graded answer (auto-completes).
 *
 * SCOPE OF THIS ORACLE — and its honest gap. The compute `correctValue` is
 * LLM-AUTHORED by the orchestrator (a probability like P(X ≥ 3) for a stated
 * family/params), NOT recomputed in code, and the query lives in natural-language
 * prose ("Given the unit survived 3 years, find P(survives 2 more)"). Robustly
 * RE-DERIVING that value would require a probability engine PLUS an NL query
 * parser (binomial/Poisson/exponential PMF/CDF, tail vs conditional vs percentile)
 * — brittle enough that a wrong parse would false-flag correct content, which is
 * worse than no check (the skill's false-pass/false-fail rule). So this oracle
 * does NOT semantically verify the probability value; it verifies the parts of
 * the answer contract that ARE code-decidable — the SAME structural independence
 * knowledge-check uses:
 *  - the MCQ is winnable and UNAMBIGUOUS: exactly one correct option is present
 *    and no distractor collides with the correct answer;
 *  - a "wrong" predict_shape distractor is not actually an accepted answer.
 * Semantic probability correctness is recorded as an unchecked gap for a future
 * numeric probe / eval-test — never silently treated as covered.
 *
 * Checks:
 *  - answer-key-desync :
 *      compute      — a numericDistractor equals correctValue (two correct options
 *                     → the student picking the "wrong" twin is marked wrong /
 *                     the answer is ambiguous).
 *      identify     — correctFamily is among the distractors (the correct family
 *                     appears twice in the radio, one judged wrong).
 *      predict_shape— a distractor case-insensitively matches an acceptableAnswer
 *                     (a "wrong" option is actually correct → ambiguous).
 *  - scope             : the session's authored evalMode (data.evalMode) must
 *      match the requested ctx.evalMode (task identity — an identify session must
 *      not answer a compute_advanced objective). No numeric magnitude ceiling.
 *  - answer-leak       : the prompt/scenario/hint must not print the compute
 *      correctValue, nor (identify) name the correctFamily, nor (predict_shape)
 *      state the acceptable shape word — that hands over the answer.
 *  - clustering        : challenge prompts / answers must spread (checkAnswerVariety);
 *      no byte-identical card (same type + prompt).
 *  - schema            : ≥2 challenges (the orchestrator authors 2-3 per phase);
 *      known challenge type; non-empty prompt + rationale; per-type keys present
 *      and well-typed (identify: valid correctFamily + ≥1 valid distractor family;
 *      compute: finite correctValue + ≥2 distinct numeric distractors; predict_shape:
 *      non-empty acceptableAnswers + ≥2 distractors).
 *
 * Deliberately NOT checked (honest gaps):
 *  - the NUMERIC correctness of compute.correctValue vs the stated distribution
 *    and query (needs a probability engine + NL parser) — a numeric-probe/eval-test
 *    concern. Recorded, not silently skipped.
 *  - guided_exploration has no graded answer — only its prompt/rationale presence
 *    is checked.
 *  - distractor PLAUSIBILITY (are the wrong numbers realistic misconceptions?) —
 *    /eval-test territory.
 */

const FAMILIES = new Set(['binomial', 'poisson', 'exponential']);
const KNOWN_TYPES = new Set(['guided_exploration', 'identify', 'compute', 'predict_shape']);
const KNOWN_EVAL_MODES = new Set(['explore', 'identify', 'compute_basic', 'compute_advanced']);

const EPS = 1e-9;

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
const norm = (s: string): string => s.trim().toLowerCase();

/** Standalone numbers in free text. */
function numbersIn(text: string): number[] {
  return text.split(/[^0-9.]+/).map((t) => parseFloat(t)).filter((n) => Number.isFinite(n));
}

export const distributionExplorerOracle: ContentOracle = {
  componentId: 'distribution-explorer',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    if (challenges.length < 2) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — a distribution phase authors 2-3`,
      });
    }

    // ── scope: the authored evalMode must match the requested one ──
    const dataMode = String(data.evalMode ?? '');
    if (KNOWN_EVAL_MODES.has(ctx.evalMode) && dataMode !== '' && dataMode !== ctx.evalMode) {
      violations.push({
        check: 'scope',
        where: 'evalMode',
        detail: `content authored for evalMode "${dataMode}" but the objective asked for "${ctx.evalMode}" — a different task identity`,
      });
    }

    const answerValues: string[] = [];
    const cardSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const type = String(c.type ?? '');
      if (!KNOWN_TYPES.has(type)) {
        uncheckedTypes.add(type || '(missing type)');
        continue;
      }

      const prompt = typeof c.prompt === 'string' ? c.prompt : '';
      const rationale = typeof c.rationale === 'string' ? c.rationale : '';
      if (prompt.trim() === '' || rationale.trim() === '') {
        violations.push({ check: 'schema', where: id, detail: `missing prompt/rationale: prompt=${JSON.stringify(c.prompt)} rationale=${JSON.stringify(c.rationale)}` });
        continue;
      }
      const leakText = `${prompt} ${String(c.scenario ?? '')} ${String(c.hint ?? '')}`;

      if (type === 'guided_exploration') {
        // No graded answer — only prompt/rationale presence matters (checked above).
        checked++;
        answerValues.push(`guided:${norm(prompt).slice(0, 24)}`);
        cardSeen.set(`guided#${norm(prompt)}`, (cardSeen.get(`guided#${norm(prompt)}`) ?? 0) + 1);
      } else if (type === 'identify') {
        const correctFamily = String(c.correctFamily ?? '');
        const distractors = Array.isArray(c.distractors) ? c.distractors.map(String) : null;
        if (!FAMILIES.has(correctFamily) || !distractors || distractors.length < 1 || distractors.some((d) => !FAMILIES.has(d))) {
          violations.push({ check: 'schema', where: id, detail: `identify malformed: correctFamily=${JSON.stringify(c.correctFamily)} distractors=${JSON.stringify(c.distractors)}` });
          continue;
        }
        checked++;
        // ── the correct family must not also appear as a distractor ──
        if (distractors.includes(correctFamily)) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `correctFamily "${correctFamily}" is also a distractor — it appears twice in the radio, and picking the twin is marked wrong` });
        }
        // ── answer-leak: naming the family hands over the answer ──
        if (new RegExp(`\\b${correctFamily}\\b`, 'i').test(leakText)) {
          violations.push({ check: 'answer-leak', where: id, detail: `prompt/scenario/hint names the correct family "${correctFamily}"` });
        }
        answerValues.push(`identify:${correctFamily}`);
        cardSeen.set(`identify#${norm(prompt)}`, (cardSeen.get(`identify#${norm(prompt)}`) ?? 0) + 1);
      } else if (type === 'compute') {
        const correctValue = c.correctValue;
        const distractors = Array.isArray(c.distractors) ? c.distractors.filter(isNum) : null;
        if (!isNum(correctValue) || !distractors || distractors.length < 2) {
          violations.push({ check: 'schema', where: id, detail: `compute malformed: correctValue=${String(c.correctValue)} distractors=${JSON.stringify(c.distractors)} (need ≥2 numeric distractors)` });
          continue;
        }
        checked++;
        // ── no distractor may equal the correct value (ambiguous MCQ) ──
        const collide = distractors.filter((d) => Math.abs(d - correctValue) <= EPS);
        if (collide.length > 0) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `distractor(s) [${collide.join(', ')}] equal correctValue ${correctValue} — two correct options; the student picking the twin is marked wrong` });
        }
        // duplicate distractors (indistinguishable choices)
        if (new Set(distractors.map((d) => d.toFixed(6))).size !== distractors.length) {
          violations.push({ check: 'schema', where: id, detail: `duplicate distractor values [${distractors.join(', ')}]` });
        }
        // ── answer-leak: the answer value printed in the prompt. Only value-match
        //    DISTINCTIVE answers (a decimal probability, or ≥ 20) — a small integer
        //    moment like E[X] = 4 legitimately collides with a stated parameter
        //    (n, λ), so matching it there is a given, not a leak (circle-explorer precedent). ──
        const distinctive = !Number.isInteger(correctValue) || Math.abs(correctValue) >= 20;
        if (distinctive && numbersIn(leakText).some((n) => Math.abs(n - correctValue) <= EPS)) {
          violations.push({ check: 'answer-leak', where: id, detail: `prompt/scenario/hint states the answer value ${correctValue}` });
        }
        answerValues.push(`compute:${correctValue}`);
        cardSeen.set(`compute#${norm(prompt)}`, (cardSeen.get(`compute#${norm(prompt)}`) ?? 0) + 1);
      } else {
        // predict_shape
        const acceptable = Array.isArray(c.acceptableAnswers) ? c.acceptableAnswers.filter((a): a is string => typeof a === 'string') : null;
        const distractors = Array.isArray(c.distractors) ? c.distractors.filter((d): d is string => typeof d === 'string') : null;
        if (!acceptable || acceptable.length === 0 || !distractors || distractors.length < 2) {
          violations.push({ check: 'schema', where: id, detail: `predict_shape malformed: acceptableAnswers=${JSON.stringify(c.acceptableAnswers)} distractors=${JSON.stringify(c.distractors)}` });
          continue;
        }
        checked++;
        const acceptableSet = new Set(acceptable.map(norm));
        // ── a distractor that matches an acceptable answer is really correct ──
        const bad = distractors.filter((d) => acceptableSet.has(norm(d)));
        if (bad.length > 0) {
          violations.push({ check: 'answer-key-desync', where: id, detail: `distractor(s) [${bad.join(', ')}] match an acceptable answer — a "wrong" option is actually correct (ambiguous)` });
        }
        // ── answer-leak: the shape word stated in the prompt ──
        const leakNorm = norm(leakText);
        if (acceptable.some((a) => new RegExp(`\\b${norm(a).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(leakNorm))) {
          violations.push({ check: 'answer-leak', where: id, detail: `prompt/scenario/hint states an acceptable shape answer` });
        }
        answerValues.push(`shape:${norm(acceptable[0])}`);
        cardSeen.set(`shape#${norm(prompt)}`, (cardSeen.get(`shape#${norm(prompt)}`) ?? 0) + 1);
      }
    }

    // ── clustering: prompts/answers spread; no byte-identical card ──
    const variety = checkAnswerVariety(answerValues, 'challenges[].answer');
    if (variety) violations.push(variety);
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({
          check: 'clustering',
          where: 'challenges[]',
          detail: `identical challenge "${key.slice(0, 80)}…" appears ${count}× — a duplicated card`,
        });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
