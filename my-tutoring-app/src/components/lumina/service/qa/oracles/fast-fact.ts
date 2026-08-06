import type { ContentOracle, OracleResult, OracleViolation } from './types';
import {
  asRecordArray,
  checkAnswerVariety,
  checkUniqueOptions,
  containsWord,
  parseScopeCeiling,
} from './helpers';

/**
 * Fast-fact oracle. `fast-fact` is a subject-agnostic fluency drill: one flat
 * `challenges[]` of always-choice items, each with a prompt, an optional visual
 * (emoji / large text), a `correctAnswer` string and `options[]`. It is NOT a
 * math primitive — live generations cover counting, sight words, element
 * symbols and state capitals, so every check here is written to bite the same
 * way in any subject.
 *
 * THE INDEPENDENCE RULE here is grading-contract-shaped, not semantic. Whether
 * Austin is really the capital of Texas is a semantic judgment that stays
 * /eval-test's job. What this oracle re-derives is the contract the COMPONENT
 * grades against — FastFact.tsx `isAnswerCorrect(answer, challenge)`:
 *
 *     normalized(answer) === normalized(correctAnswer)
 *       || acceptableAnswers.some(a => normalized(a) === normalized(answer))
 *
 * The oracle applies that predicate to EVERY option and asserts exactly one
 * passes. It never reads `correctAnswer`'s position or trusts the generator's
 * own key placement — which matters because `reconstructChallenge` force-splices
 * `correctAnswer` into `options`, so a naive "is the key in the options" check
 * could never fail. Two states that splice does NOT prevent, and that this
 * catches:
 *   - `acceptableAnswers` collides with a distractor → TWO buttons grade
 *     correct, and the component highlights both as correct.
 *   - the `'???'` sentinel (reconstructChallenge line ~218, `flat.correctAnswer
 *     || '???'`) ships as the key when Gemini omits the answer → unwinnable.
 *
 * ANSWER-LEAK is the reason this oracle exists (observed live 2026-08-06: a
 * "Counting within 20" drill rendered `text-large: "7"` above "Which number is
 * shown here?" with options 6/7/8 — the student pixel-matches the glyph and
 * nothing is measured). Two leak shapes are checked:
 *   - identity leak: the visual IS the answer. The invariant is REPRESENTATION
 *     SHIFT — the visual and the options must be different representations of
 *     the fact. `Fe` → "Iron" is the contract honored; `7` → `7` and `the` →
 *     `the` are the contract broken.
 *   - stem leak: the prompt names the answer as a whole word and names no
 *     distractor, i.e. it uniquely gives it away ("Which option spells 'and'?"
 *     with options and/dad/bad). Expression prompts are exempt — in `7 + 0` the
 *     operands legitimately appear and the answer is computed, not copied.
 *
 * COUNTING items get a genuine independent re-derivation: when a prompt asks
 * "how many"/"count" over an emoji visual, the oracle counts the emoji grapheme
 * clusters itself and compares to the numeric key. A board showing 6 apples with
 * a key of 5 marks a correctly-counting student wrong.
 *
 * `visualType: 'image'` is reported in `uncheckedTypes` — an oracle cannot see
 * what an imageUrl depicts, so a leak through an image is out of reach here.
 */

const norm = (value: unknown): string => String(value ?? '').trim().toLowerCase();

/** Grapheme-cluster count — emoji, ZWJ sequences and variation selectors each count once. */
function countGraphemes(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  // Iterated by hand rather than for..of: the Lumina tsconfig targets ES5-era
  // iteration, so for..of over a non-array Iterable needs --downlevelIteration.
  type GraphemeSegments = { [Symbol.iterator](): Iterator<{ segment: string }> };
  const Segmenter = (Intl as unknown as {
    Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): GraphemeSegments };
  }).Segmenter;
  if (Segmenter) {
    const iterator = new Segmenter('en', { granularity: 'grapheme' }).segment(trimmed)[Symbol.iterator]();
    let n = 0;
    for (let r = iterator.next(); !r.done; r = iterator.next()) {
      if (r.value.segment.trim()) n++;
    }
    return n;
  }
  // Fallback: surrogate pairs count once, skip combining marks / VS / ZWJ.
  return Array.from(trimmed).filter((c) => {
    const cp = c.codePointAt(0) ?? 0;
    if (/\s/.test(c)) return false;
    if (cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f)) return false;
    return true;
  }).length;
}

/** The component's own grading predicate, mirrored exactly (FastFact.tsx isAnswerCorrect). */
function gradesCorrect(option: string, correctAnswer: string, acceptable: string[]): boolean {
  const n = norm(option);
  if (!n) return false;
  if (n === norm(correctAnswer)) return true;
  return acceptable.some((a) => norm(a) === n);
}

const isInteger = (value: string): boolean => /^-?\d+$/.test(value.trim());
/** Prompts that compute rather than name — operands legitimately appear in the stem. */
const isExpressionPrompt = (text: string): boolean => /[+\-×÷*/=]|\bplus\b|\bminus\b|\btimes\b/i.test(text);
const isCountingPrompt = (text: string): boolean => /\bhow many\b|\bcount\b/i.test(text);

const COUNT_STOPWORDS = new Set([
  'the', 'are', 'you', 'do', 'does', 'see', 'all', 'them', 'up', 'and',
  'shown', 'here', 'many', 'there', 'can', 'this', 'that', 'total', 'altogether',
]);

/** Loose singular/plural stem so "apples" matches "apple" and "faces" matches "face". */
const stemWord = (w: string): string => w.replace(/(es|s)$/, '');

/**
 * The nouns the student is asked to count: "How many stars are shown?" → ["stars"].
 * Used to tell a DEPICTED count from a DERIVED one.
 */
function countedNouns(stem: string): string[] {
  const m = stem.match(/\bhow many\s+([a-z' ]{2,40}?)\b(?:\s+(?:are|do|is|does|can|could|make|in|on|has|have|will|would)\b|[?!.,]|$)/i)
    || stem.match(/\bcount\s+(?:all\s+)?(?:the\s+)?([a-z' ]{2,40}?)\b(?:[?!.,]|$)/i);
  if (!m) return [];
  return m[1].toLowerCase().split(/\s+/).filter((w) => w.length >= 3 && !COUNT_STOPWORDS.has(w));
}

/**
 * Does the prompt ask the student to count the things the visual actually depicts?
 *
 * Counting the emoji only re-derives the key when the question is about the
 * DEPICTED objects. "How many fingers make up two full hands?" over 🖐️🖐️ is a
 * legitimate item whose answer (10) is derived, not depicted — counting glyphs
 * there yields 2 and would false-fire. The discriminator is whether the counted
 * noun is attested in the visual's own alt text ("15 stars" ← "How many stars"),
 * which the generator's schema requires it to supply.
 */
function countsTheDepictedThings(stem: string, alt: string): boolean {
  const nouns = countedNouns(stem);
  if (nouns.length === 0 || !alt.trim()) return false;
  const altStem = stemWord(alt.toLowerCase());
  return nouns.some((n) => altStem.includes(stemWord(n)));
}

/** Escape for literal RegExp use (helpers.escapeRegExp is not exported for reuse here). */
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The answer appears QUOTED in the stem — "Which option spells 'and'?" — an unambiguous giveaway. */
const quotedInStem = (stem: string, answer: string): boolean =>
  new RegExp(`['"‘’“”]\\s*${esc(answer)}\\s*['"‘’“”]`, 'i').test(stem);

/**
 * Is a bare (unquoted) occurrence of this answer in the stem meaningful?
 *
 * Short function words ("the", "is", "a", "to") occur incidentally in ordinary
 * instruction text — "Look at the letters" is not leaking the answer "the". So a
 * bare occurrence only counts for alphabetic answers of 4+ characters, mirroring
 * the knowledge-check oracle's guard. A QUOTED occurrence always counts, at any
 * length, which is what catches the real short-word leaks. Numeric answers carry
 * no such guard — they are governed by the distractor test alone, since a number
 * appearing in a stem is either the problem statement (and a distractor appears
 * with it) or a genuine giveaway.
 */
const bareOccurrenceCounts = (answer: string): boolean =>
  !/[a-z]/i.test(answer) || answer.length >= 4;

export const fastFactOracle: ContentOracle = {
  componentId: 'fast-fact',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);
    let checked = 0;

    // Scope ceiling: explicit harness override wins, else parsed from the topic
    // ("Counting to 20" → 20). Undefined means the topic carries no ceiling and
    // the scope check stays silent rather than guessing one.
    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic ?? '');

    // Cross-challenge accumulators.
    const answerValues: Array<string | number> = [];
    const answerPositions: Array<string | number> = [];

    if (challenges.length === 0) {
      violations.push({ check: 'schema', where: 'challenges', detail: 'no challenges generated' });
      return { violations, uncheckedTypes: [], checkedChallenges: 0 };
    }

    // mastery-over-demo: the catalog contract is 8-12 challenges. A 2-item drill
    // is a demo, not a fluency measurement. Floor kept at 6 so a deliberately
    // shorter configured drill is not flagged.
    if (challenges.length < 6) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenges — a fluency drill needs 8-12 (contract) and at least 6 to measure automaticity`,
      });
    }

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const type = String(c.type ?? '');
      const where = `challenge ${id}${type ? `(${type})` : ''}`;
      checked++;

      const prompt = (c.prompt && typeof c.prompt === 'object' ? c.prompt : {}) as Record<string, unknown>;
      const promptText = String(prompt.text ?? '');
      const subtext = String(prompt.subtext ?? '');
      const correctAnswer = String(c.correctAnswer ?? '');
      const acceptable = Array.isArray(c.acceptableAnswers) ? c.acceptableAnswers.map(String) : [];
      const options = Array.isArray(c.options) ? c.options.map(String) : [];

      if (!promptText.trim()) {
        violations.push({ check: 'schema', where, detail: 'empty prompt text — nothing is asked' });
      }

      // The reconstructChallenge sentinel: Gemini omitted correctAnswer entirely.
      if (correctAnswer.trim() === '???') {
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: "correctAnswer is the '???' sentinel — the generator had no answer to ship, so no click can be correct",
        });
      }

      // A one-button challenge is a guaranteed-correct freebie. reconstructChallenge
      // deliberately allows this (the "pathological" branch) rather than invent a
      // fake distractor — correct call there, but it must never reach a student.
      if (options.length < 2) {
        violations.push({
          check: 'answer-leak',
          where,
          detail: `only ${options.length} option(s) — a single button is answered without knowing anything`,
        });
      } else {
        const dup = checkUniqueOptions(options, where);
        if (dup) violations.push(dup);
      }

      // ---- answer-key-desync: exactly one option must grade correct ----------
      const correctIdx = options
        .map((o, idx) => ({ o, idx }))
        .filter(({ o }) => gradesCorrect(o, correctAnswer, acceptable))
        .map(({ idx }) => idx);

      if (options.length >= 1 && correctIdx.length === 0) {
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: `no option grades correct — key "${correctAnswer}" (acceptable: [${acceptable.join(', ')}]) matches none of [${options.join(', ')}]; the student can never be right`,
        });
      } else if (correctIdx.length > 1) {
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: `${correctIdx.length} options grade correct ([${correctIdx.map((k) => options[k]).join(', ')}]) — acceptableAnswers collides with a distractor, so multiple buttons are marked right`,
        });
      } else if (correctIdx.length === 1) {
        answerValues.push(norm(correctAnswer));
        answerPositions.push(String(correctIdx[0]));
      }

      // ---- answer-leak: the visual IS the answer -----------------------------
      const visual = (prompt.visual && typeof prompt.visual === 'object' ? prompt.visual : null) as Record<string, unknown> | null;
      const visualType = visual ? String(visual.type ?? '') : '';
      const visualContent = visual ? String(visual.largeText ?? visual.emoji ?? '') : '';

      if (visualType === 'image') uncheckedTypes.add('image-visual');

      if (visualContent.trim() && correctAnswer.trim()) {
        const leaks = gradesCorrect(visualContent, correctAnswer, acceptable);
        if (leaks) {
          violations.push({
            check: 'answer-leak',
            where,
            detail: `the ${visualType} visual "${visualContent}" IS the answer "${correctAnswer}" — the student matches the glyph to a button instead of recalling the fact; the visual and the options must be DIFFERENT representations (symbol→name, quantity→numeral), never the same one`,
          });
        }
      }

      // ---- answer-leak: the stem uniquely names the answer -------------------
      // Fires only when the answer appears as a whole word AND no distractor
      // does — an incidental mention that also names a distractor is the problem
      // statement, not a giveaway. Expression prompts exempt (operands are the
      // problem). Applied to prompt text and subtext together.
      const stem = `${promptText} ${subtext}`.trim();
      const answerTrim = correctAnswer.trim();
      if (answerTrim && stem && !isExpressionPrompt(stem) && correctIdx.length === 1) {
        const quoted = quotedInStem(stem, answerTrim);
        const named = quoted || (containsWord(stem, answerTrim) && bareOccurrenceCounts(answerTrim));
        const distractorInStem = options.some(
          (o, idx) => idx !== correctIdx[0] && o.trim()
            && (quotedInStem(stem, o.trim()) || containsWord(stem, o.trim())),
        );
        if (named && !distractorInStem) {
          violations.push({
            check: 'answer-leak',
            where,
            detail: `the prompt ${quoted ? 'quotes' : 'names'} the answer "${correctAnswer}" and no distractor: "${stem}" — the student copies it out of the question instead of recalling it`,
          });
        }
      }

      // ---- answer-key-desync: counted quantity vs numeric key ----------------
      // Independent re-derivation: count the emoji ourselves.
      if (visualType === 'emoji' && visualContent.trim() && isInteger(correctAnswer) && isCountingPrompt(stem)) {
        const alt = visual ? String(visual.alt ?? '') : '';
        if (!alt.trim()) {
          // Without alt there is no way to tell a depicted count from a derived
          // one, so the key goes unverified rather than risk a false positive.
          uncheckedTypes.add('emoji-count-without-alt');
        } else if (countsTheDepictedThings(stem, alt)) {
          const shown = countGraphemes(visualContent);
          const keyed = parseInt(correctAnswer.trim(), 10);
          if (shown !== keyed) {
            violations.push({
              check: 'answer-key-desync',
              where,
              detail: `visual shows ${shown} emoji but the key says ${keyed} ("${promptText}") — a student who counts correctly is marked wrong`,
            });
          }
        }
      }

      // ---- scope: numeric answers must respect the topic ceiling -------------
      if (ceiling !== undefined && isInteger(correctAnswer)) {
        const v = parseInt(correctAnswer.trim(), 10);
        if (v > ceiling) {
          violations.push({
            check: 'scope',
            where,
            detail: `answer ${v} exceeds the topic ceiling ${ceiling} ("${ctx.topic}")`,
          });
        }
      }
    }

    // ---- clustering --------------------------------------------------------
    const valueCluster = checkAnswerVariety(answerValues, 'correctAnswer values');
    if (valueCluster) violations.push(valueCluster);

    // Position clustering uses a looser 0.7 threshold than value clustering:
    // binary (yes/no, true/false) items legitimately concentrate onto two
    // positions, so 0.6 would false-fire on a set with several of them.
    const posCluster = checkAnswerVariety(answerPositions, 'correct-option position', 0.7);
    if (posCluster) {
      violations.push({
        ...posCluster,
        detail: `${posCluster.detail} — the correct button sits in the same slot, so the drill is gameable by position`,
      });
    }

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
