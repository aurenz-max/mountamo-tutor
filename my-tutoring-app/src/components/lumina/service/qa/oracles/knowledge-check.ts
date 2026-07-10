import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, containsWord } from './helpers';

/**
 * Knowledge-check oracle. `knowledge-check` is a single catalog primitive whose
 * generator (the KC orchestrator) emits a MIXED set: fullData is
 * `{ problems: ProblemData[], ... }` where each problem carries a `type`. So one
 * oracle dispatches per problem type — mirroring how each inner problem component
 * (MultipleChoiceProblem / TrueFalseProblem / MatchingActivityProblem /
 * CategorizationActivityProblem) judges correctness.
 *
 * THE INDEPENDENCE RULE here is structural, not semantic. Whether an MCQ's
 * correct option is the *right* answer to the question, or a TF statement is
 * genuinely true, is a semantic judgment — that stays /eval-test's job. What this
 * oracle re-derives is the answer CONTRACT the component grades against:
 *
 *  - multiple_choice: the component only marks a click correct when
 *    `optionId === correctOptionId`. If `correctOptionId` resolves to no option,
 *    NO click can ever be correct → a guaranteed answer-key-desync (the same
 *    class as vocabulary-explorer's positional fallback). Plus: unique options,
 *    and the stem must not uniquely leak the answer word.
 *  - true_false: `answer === data.correct` — so `correct` must be a real boolean.
 *    Across a set, the booleans must vary (the generator's "don't make them all
 *    true" — the clustering class).
 *  - matching_activity: the component grades by id membership
 *    (`correctRightIds.includes(id)`). Every mapping id must resolve to a real
 *    item, and every left item must carry a mapping — otherwise a rendered row is
 *    ungradable.
 *  - categorization_activity: `itemCategories[itemText] === correctCategory`, and
 *    state is keyed by itemText. So every `correctCategory` must be one of the
 *    real `categories` (a drop zone that exists), and duplicate itemText collides
 *    in the placement map.
 *
 * fill_in_blanks and sequencing_activity also appear in the orchestrated set but
 * are reported in `uncheckedTypes` — honest partial coverage, a natural follow-up
 * oracle (both are answer-bearing with their own leak/order contracts).
 *
 * NOTE: unlike single-mode practice primitives, a knowledge-check legitimately
 * ships a single problem (config.count || 1), so there is deliberately NO
 * demo-size (mastery-over-demo) check here.
 */
export const knowledgeCheckOracle: ContentOracle = {
  componentId: 'knowledge-check',
  verify(data, _ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const problems = asRecordArray(data.problems);
    let checked = 0;

    // Cross-problem clustering accumulators (only bite with ≥3 of a type).
    const mcqCorrectLetters: Array<string | number> = [];
    const tfCorrectValues: Array<string | number> = [];

    for (let i = 0; i < problems.length; i++) {
      const p = problems[i];
      const type = String(p.type ?? '');
      const where = `problem#${i + 1}(${type || String(p.id ?? 'untyped')})`;

      switch (type) {
        case 'multiple_choice':
          checked++;
          checkMultipleChoice(p, where, violations, mcqCorrectLetters);
          break;
        case 'true_false':
          checked++;
          checkTrueFalse(p, where, violations, tfCorrectValues);
          break;
        case 'matching_activity':
          checked++;
          checkMatching(p, where, violations);
          break;
        case 'categorization_activity':
          checked++;
          checkCategorization(p, where, violations);
          break;
        default:
          if (type) uncheckedTypes.add(type);
      }
    }

    const mcqCluster = checkAnswerVariety(mcqCorrectLetters, 'multiple_choice answer positions');
    if (mcqCluster) violations.push(mcqCluster);
    const tfCluster = checkAnswerVariety(tfCorrectValues, 'true_false answers');
    if (tfCluster) violations.push(tfCluster);

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};

function checkMultipleChoice(
  p: Record<string, unknown>,
  where: string,
  violations: OracleViolation[],
  correctLetters: Array<string | number>,
): void {
  const options = asRecordArray(p.options);
  if (options.length < 2) {
    violations.push({ check: 'schema', where, detail: `only ${options.length} option(s) — an MCQ needs at least 2` });
    return;
  }
  const ids = options.map((o) => String(o.id));
  const texts = options.map((o) => String(o.text));

  if (new Set(ids).size !== ids.length) {
    violations.push({ check: 'schema', where, detail: `duplicate option ids: [${ids.join(', ')}]` });
  }
  const normTexts = texts.map((t) => t.trim().toLowerCase());
  if (new Set(normTexts).size !== normTexts.length) {
    violations.push({ check: 'schema', where, detail: `duplicate option labels: [${texts.join(' | ')}] — ambiguous grading` });
  }

  // answer-key-desync: the shipped key must resolve to a real option. If it does
  // not, the component (optionId === correctOptionId) can never mark any click
  // correct — the student is stuck losing.
  const correctId = String(p.correctOptionId ?? '');
  const idx = ids.indexOf(correctId);
  if (idx === -1) {
    violations.push({
      check: 'answer-key-desync',
      where,
      detail: `correctOptionId "${correctId}" matches no option id [${ids.join(', ')}] — no answer can ever be marked correct`,
    });
    return;
  }
  correctLetters.push(correctId);

  // answer-leak: the correct answer word appears in the stem AND no distractor
  // does — i.e. the stem uniquely gives it away. Guarded to alphabetic phrases of
  // ≥4 chars so bare numbers/symbols (which legitimately recur in stems) don't
  // false-positive.
  const correctText = texts[idx].trim();
  if (/[a-z]/i.test(correctText) && correctText.length >= 4) {
    const stem = String(p.question ?? '');
    const distractorInStem = options.some(
      (o) => String(o.id) !== correctId && containsWord(stem, String(o.text).trim()),
    );
    if (containsWord(stem, correctText) && !distractorInStem) {
      violations.push({
        check: 'answer-leak',
        where,
        detail: `question stem contains the answer "${correctText}" and no distractor: "${stem}"`,
      });
    }
  }
}

function checkTrueFalse(
  p: Record<string, unknown>,
  where: string,
  violations: OracleViolation[],
  correctValues: Array<string | number>,
): void {
  if (typeof p.correct !== 'boolean') {
    violations.push({ check: 'schema', where, detail: `"correct" is ${JSON.stringify(p.correct)} — must be a boolean` });
    return;
  }
  correctValues.push(p.correct ? 'true' : 'false');
  if (!String(p.statement ?? '').trim()) {
    violations.push({ check: 'schema', where, detail: 'empty statement' });
  }
}

function checkMatching(p: Record<string, unknown>, where: string, violations: OracleViolation[]): void {
  const leftItems = asRecordArray(p.leftItems);
  const rightItems = asRecordArray(p.rightItems);
  const mappings = asRecordArray(p.mappings);
  if (leftItems.length === 0 || rightItems.length === 0) {
    violations.push({ check: 'schema', where, detail: `leftItems=${leftItems.length}, rightItems=${rightItems.length} — both required` });
    return;
  }

  const leftIds = new Set(leftItems.map((i) => String(i.id)));
  const rightIds = new Set(rightItems.map((i) => String(i.id)));

  // Duplicate on-screen text in a column is ambiguous: the student sees two
  // identical buttons but the key targets one specific id.
  const flagDupText = (items: Array<Record<string, unknown>>, col: string) => {
    const t = items.map((i) => String(i.text).trim().toLowerCase());
    if (new Set(t).size !== t.length) {
      violations.push({ check: 'schema', where, detail: `duplicate ${col}-column text: [${items.map((i) => i.text).join(' | ')}] — indistinguishable when clicked` });
    }
  };
  flagDupText(leftItems, 'left');
  flagDupText(rightItems, 'right');

  const mappedLeft = new Set<string>();
  for (const m of mappings) {
    const leftId = String(m.leftId ?? '');
    mappedLeft.add(leftId);
    if (!leftIds.has(leftId)) {
      violations.push({ check: 'answer-key-desync', where, detail: `mapping.leftId "${leftId}" is not a left item — its pair can never be graded correct` });
    }
    const rIds = Array.isArray(m.rightIds) ? m.rightIds.map(String) : [];
    if (rIds.length === 0) {
      violations.push({ check: 'schema', where, detail: `mapping for left "${leftId}" has no rightIds` });
    }
    for (const r of rIds) {
      if (!rightIds.has(r)) {
        violations.push({ check: 'answer-key-desync', where, detail: `mapping rightId "${r}" (for left "${leftId}") is not a right item` });
      }
    }
  }

  // A rendered left item with no mapping is ungradable — the component only
  // scores items present in data.mappings.
  for (const li of leftItems) {
    if (!mappedLeft.has(String(li.id))) {
      violations.push({ check: 'answer-key-desync', where, detail: `left item "${String(li.id)}" (${String(li.text)}) has no mapping — it renders but can never be graded` });
    }
  }
}

function checkCategorization(p: Record<string, unknown>, where: string, violations: OracleViolation[]): void {
  const categories = Array.isArray(p.categories) ? p.categories.map(String) : [];
  const items = asRecordArray(p.categorizationItems);

  if (categories.length < 2) {
    violations.push({ check: 'schema', where, detail: `only ${categories.length} category(ies) — need at least 2 to sort` });
  }
  const normCats = categories.map((c) => c.trim().toLowerCase());
  if (new Set(normCats).size !== normCats.length) {
    violations.push({ check: 'schema', where, detail: `duplicate categories: [${categories.join(', ')}]` });
  }
  if (items.length === 0) {
    violations.push({ check: 'schema', where, detail: 'no categorization items' });
    return;
  }

  // The component keys placement state by itemText; identical itemText collides.
  const itemTexts = items.map((i) => String(i.itemText).trim().toLowerCase());
  if (new Set(itemTexts).size !== itemTexts.length) {
    violations.push({ check: 'schema', where, detail: 'duplicate itemText — placement state is keyed by itemText, so duplicates collide' });
  }

  const catSet = new Set(normCats);
  const usedCats = new Set<string>();
  for (const it of items) {
    const cc = String(it.correctCategory ?? '');
    const ccNorm = cc.trim().toLowerCase();
    usedCats.add(ccNorm);
    // answer-key-desync: no drop zone for this item's correct category.
    if (!catSet.has(ccNorm)) {
      violations.push({
        check: 'answer-key-desync',
        where,
        detail: `item "${String(it.itemText)}" has correctCategory "${cc}" which is not in categories [${categories.join(', ')}] — it can never be placed correctly`,
      });
    }
    // answer-leak: the item names its own category.
    const ccTrim = cc.trim();
    if (ccTrim.length >= 3 && containsWord(String(it.itemText), ccTrim)) {
      violations.push({ check: 'answer-leak', where, detail: `item "${String(it.itemText)}" contains its correct category "${cc}"` });
    }
  }

  // clustering: every item resolves to a single category — nothing to sort.
  if (categories.length >= 2 && usedCats.size === 1 && items.length >= 3) {
    violations.push({ check: 'clustering', where, detail: `all ${items.length} items belong to one category — nothing to sort` });
  }
}
