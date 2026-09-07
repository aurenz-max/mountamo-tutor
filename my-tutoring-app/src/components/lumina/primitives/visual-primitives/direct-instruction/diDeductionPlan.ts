/**
 * diDeductionPlan — the CODE-OWNED case shapes behind di-deduction.
 *
 * The pack's thesis (design brief 2026-09-07, "DI for Older Learners",
 * concept 3): the K-2 packs judge a WORD, di-worked-procedure judges a MOVE,
 * and this one judges a DEDUCTION — a verdict plus the reason that reaches it
 * from a rule. For that to be honest the LOGIC must come from code: the model
 * emits ONE rule ("All insects have six legs") and a handful of entity facts,
 * and this module assembles every case, its ask, and its answer. Nothing in
 * here knows about cues, React, or Gemini — the LLM-window / code-structure
 * rule.
 *
 * THE THREE CASE SHAPES (Corrective Reading Comprehension "deductions"):
 *
 *   conclude     "A beetle is an insect."         → "a beetle has six legs"
 *                affirm the antecedent — the G3 floor.
 *   deny         "A spider does not have six legs." → "no, not an insect, because
 *                all insects have six legs and a spider does not"
 *                deny the consequent.
 *   cannot_tell  "This animal has six legs."      → "can't tell — other things
 *                have six legs too; the rule does not say ONLY insects do"
 *                affirming the consequent is the SIGNATURE ERROR, and the bucket
 *                the class exists for (the G4-5 reasoning standard).
 *
 * WHY THE cannot_tell SUBJECT IS ANONYMOUS ("this animal", never "a turtle").
 * The brief's table names a lookalike in the case. Read against a child, that
 * form asks "A turtle lays eggs. Is a turtle a bird?" — and a fourth-grader who
 * answers "no, it's a reptile" is RIGHT about the world while having done none
 * of the reasoning. A contract cannot refuse a true sentence without teaching
 * that the tutor is wrong about turtles, so the CASE states only the property
 * of an unnamed thing — the DI form ("An animal lays eggs. Is it a bird?" →
 * "Maybe.") — and the named lookalike moves to the FIRM-UP, where it makes
 * "can't tell" concrete and true: "a turtle lays eggs too, and a turtle is not
 * a bird." One cannot_tell case per rule, by construction: a second would be
 * the same ask (recall, not skill).
 *
 * CONTENT GATES (every one "true by construction", so the judge is never asked
 * to discriminate something the bench cannot see):
 *  - THE RULE IS BUILT BY CODE as "All <category plural> <property>." — a
 *    "some"/"most" generalization cannot arrive, because the model never
 *    writes the sentence.
 *  - EVERY ENTITY IS SAYABLE: a bare singular common noun, ≤ 3 words, no
 *    article; the code supplies "a"/"an" so a case reads aloud cleanly.
 *  - NO ENTITY IN TWO LISTS, and none equal to the category — a beetle that is
 *    both a member and a lookalike has no defensible verdict.
 *  - THE RULE TEXT NAMES NO ENTITY (leak): "All insects have six legs" must not
 *    mention the beetle the case is about.
 *  - A NEGATION IS A NEGATION: the singular negated property must carry
 *    not / n't / never, or a `deny` case would assert the property.
 *  - TRUTH IN THE WORLD is NOT checkable here and is gated by the generator's
 *    review call (the spokenPracticePlan precedent) — a child must never be
 *    affirmed on a false fact.
 */

export type DeductionShape = 'conclude' | 'deny' | 'cannot_tell';
export const DEDUCTION_SHAPES: readonly DeductionShape[] = ['conclude', 'deny', 'cannot_tell'];

/** What the generator emits per rule, after code normalization. */
export interface DeductionRuleSpec {
  id: string;
  /** "insect" — singular, no article. */
  category: string;
  /** "insects". */
  categoryPlural: string;
  /** "have six legs" — with a plural subject ("All insects ___"). */
  propertyPlural: string;
  /** "has six legs" — with a singular subject ("a beetle ___"). */
  propertySingular: string;
  /** "does not have six legs" — the singular negation. */
  propertyNegated: string;
  /** "animal" — the kind of thing the rule sorts; the cannot_tell subject is
   *  "this <kindNoun>". */
  kindNoun: string;
  /** Things that ARE a <category>. */
  members: string[];
  /** Things that LACK the property (and so, by the rule, are not a <category>). */
  nonMembers: string[];
  /** Things that HAVE the property and are NOT a <category>. */
  lookalikes: string[];
  /** Which shapes this rule is worked through. Absent = all three. */
  shapes?: DeductionShape[];
}

export interface DeductionCase {
  shape: DeductionShape;
  /** The subject with its article — "a beetle", "this animal". */
  subject: string;
  /** The case card, a full sentence. */
  caseText: string;
  /** The conclusion as the page writes it after the affirmation. */
  conclusionText: string;
  /** The verdict pill that lights on affirm; null for `conclude`. */
  verdict: 'no' | 'cannot_tell' | null;
  /** cannot_tell only: the named counterexample the firm-up cites. */
  lookalike: string | null;
}

// ── Words ────────────────────────────────────────────────────────────────────

export const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** "a"/"an" by the first letter. Good enough for the concrete nouns this pack
 *  ships; a noun starting with a vowel LETTER but a consonant sound ("unicorn")
 *  is the generator's problem to avoid, not this function's to solve. */
export const withArticle = (noun: string): string =>
  `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;

/** The rule sentence, built here and nowhere else. */
export const ruleTextOf = (rule: Pick<DeductionRuleSpec, 'categoryPlural' | 'propertyPlural'>): string =>
  `All ${rule.categoryPlural} ${rule.propertyPlural}.`;

const ARTICLE_RE = /^(a|an|the)\s+/i;
const ENTITY_RE = /^[a-z][a-z' -]*$/;
const NEGATION_RE = /\b(not|never|no)\b|n't\b/i;

/** Lowercase, trimmed, article stripped, whitespace collapsed. */
export const normalizeEntity = (raw: unknown): string =>
  typeof raw === 'string'
    ? raw.trim().toLowerCase().replace(ARTICLE_RE, '').replace(/\s+/g, ' ').replace(/[.!?]+$/, '')
    : '';

const normalizePhrase = (raw: unknown): string =>
  typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '') : '';

const wordCount = (s: string): number => s.split(' ').filter(Boolean).length;

const containsPhrase = (text: string, phrase: string): boolean =>
  new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);

export const MAX_ENTITIES_PER_LIST = 3;
export const MAX_ENTITY_WORDS = 3;

// ── Gates ────────────────────────────────────────────────────────────────────

/**
 * Every reason a rule cannot ship, as strings — the generator logs them, the
 * tests pin them, and an empty array is the only pass. Runs on a NORMALIZED
 * rule (see `sanitizeRule`), so casing and articles are already gone.
 */
export function findRuleDefects(rule: DeductionRuleSpec): string[] {
  const defects: string[] = [];
  const { category, categoryPlural, propertyPlural, propertySingular, propertyNegated, kindNoun } = rule;
  if (!category || wordCount(category) > MAX_ENTITY_WORDS) defects.push('category must be 1-3 words');
  if (!categoryPlural || wordCount(categoryPlural) > MAX_ENTITY_WORDS) defects.push('categoryPlural must be 1-3 words');
  if (!propertyPlural) defects.push('propertyPlural is empty');
  if (!propertySingular) defects.push('propertySingular is empty');
  if (!propertyNegated) defects.push('propertyNegated is empty');
  else if (!NEGATION_RE.test(propertyNegated)) defects.push(`propertyNegated "${propertyNegated}" carries no negation`);
  if (NEGATION_RE.test(propertyPlural) || NEGATION_RE.test(propertySingular)) {
    defects.push('the property itself is negated — a rule must state what all members HAVE or DO');
  }
  if (!kindNoun || wordCount(kindNoun) !== 1 || !ENTITY_RE.test(kindNoun)) defects.push('kindNoun must be one word');
  if (rule.members.length === 0) defects.push('no members');

  const ruleText = ruleTextOf(rule).toLowerCase();
  const seen = new Map<string, string>();
  const lists: Array<[string, string[]]> = [
    ['members', rule.members], ['nonMembers', rule.nonMembers], ['lookalikes', rule.lookalikes],
  ];
  for (const [list, entities] of lists) {
    for (const entity of entities) {
      if (!entity || !ENTITY_RE.test(entity)) defects.push(`${list}: "${entity}" is not a sayable noun`);
      else if (wordCount(entity) > MAX_ENTITY_WORDS) defects.push(`${list}: "${entity}" is longer than ${MAX_ENTITY_WORDS} words`);
      if (entity === category || entity === categoryPlural) defects.push(`${list}: "${entity}" is the category itself`);
      const prior = seen.get(entity);
      if (prior && prior !== list) defects.push(`"${entity}" appears in both ${prior} and ${list}`);
      seen.set(entity, list);
      if (entity && containsPhrase(ruleText, entity)) defects.push(`the rule text names "${entity}" (leak)`);
    }
  }
  return defects;
}

/**
 * Normalize a raw model rule and keep it only if it passes every gate. Lists
 * are deduped and capped at `MAX_ENTITIES_PER_LIST`; a null return is a DROP,
 * never a backfill.
 */
export function sanitizeRule(raw: Record<string, unknown>, id: string): DeductionRuleSpec | null {
  const list = (v: unknown): string[] => {
    const out: string[] = [];
    if (Array.isArray(v)) {
      for (const e of v) {
        const n = normalizeEntity(e);
        if (n && !out.includes(n)) out.push(n);
        if (out.length >= MAX_ENTITIES_PER_LIST) break;
      }
    }
    return out;
  };
  const shapes = Array.isArray(raw.shapes)
    ? (raw.shapes.filter((s): s is DeductionShape => (DEDUCTION_SHAPES as string[]).includes(s as string)))
    : undefined;
  const rule: DeductionRuleSpec = {
    id,
    category: normalizeEntity(raw.category),
    categoryPlural: normalizeEntity(raw.categoryPlural),
    propertyPlural: normalizePhrase(raw.propertyPlural).toLowerCase(),
    propertySingular: normalizePhrase(raw.propertySingular).toLowerCase(),
    propertyNegated: normalizePhrase(raw.propertyNegated).toLowerCase(),
    kindNoun: normalizeEntity(raw.kindNoun),
    members: list(raw.members),
    nonMembers: list(raw.nonMembers),
    lookalikes: list(raw.lookalikes),
    ...(shapes && shapes.length ? { shapes } : {}),
  };
  return findRuleDefects(rule).length === 0 ? rule : null;
}

// ── The cases ────────────────────────────────────────────────────────────────

/**
 * Build the cases of one shape for one rule. `perShape` bounds how many
 * members / non-members are used (a single-shape session drills two per rule;
 * a mixed session works each rule through every shape once). cannot_tell
 * yields at most ONE case, and none when the rule has no lookalike — the
 * firm-up would have nothing true to cite, so the case is refused rather than
 * shipped with a vague reason.
 */
export function casesFor(rule: DeductionRuleSpec, shape: DeductionShape, perShape: number): DeductionCase[] {
  const cat = withArticle(rule.category);
  if (shape === 'conclude') {
    return rule.members.slice(0, perShape).map((m) => {
      const subject = withArticle(m);
      return {
        shape,
        subject,
        caseText: `${capitalize(subject)} is ${cat}.`,
        conclusionText: `${capitalize(subject)} ${rule.propertySingular}.`,
        verdict: null,
        lookalike: null,
      };
    });
  }
  if (shape === 'deny') {
    return rule.nonMembers.slice(0, perShape).map((n) => {
      const subject = withArticle(n);
      return {
        shape,
        subject,
        caseText: `${capitalize(subject)} ${rule.propertyNegated}.`,
        conclusionText: `${capitalize(subject)} is not ${cat}.`,
        verdict: 'no',
        lookalike: null,
      };
    });
  }
  const lookalike = rule.lookalikes[0];
  if (!lookalike) return [];
  const subject = `this ${rule.kindNoun}`;
  return [{
    shape,
    subject,
    caseText: `${capitalize(subject)} ${rule.propertySingular}.`,
    conclusionText: `Can't tell: the rule does not say only ${rule.categoryPlural} ${rule.propertyPlural}.`,
    verdict: 'cannot_tell',
    lookalike,
  }];
}

/** Every case for a rule, in the DI order (conclude → deny → cannot_tell). */
export function planCases(rule: DeductionRuleSpec): DeductionCase[] {
  const shapes = rule.shapes?.length ? rule.shapes : DEDUCTION_SHAPES;
  const perShape = shapes.length === 1 ? 2 : 1;
  return DEDUCTION_SHAPES
    .filter((s) => shapes.includes(s))
    .flatMap((s) => casesFor(rule, s, perShape));
}
