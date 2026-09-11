/**
 * gemini-di-deduction — generator for di-deduction, the rule-and-case pack.
 * Fork B with code rails (the spoken-practice shape): Gemini emits the SCOPE —
 * up to four rules, each as a category, a property in three grammatical forms,
 * and three short entity lists — and CODE builds every case, ask and answer
 * (`diDeductionPlan.ts`). The model never writes a rule sentence, a verdict, or
 * a reason.
 *
 * TWO GATES, TWO LAYERS.
 *  - STRUCTURE is code (`sanitizeRule` / `findRuleDefects`, imported from the
 *    plan module and re-run by the stage and the harness): sayable entities,
 *    no entity in two lists, no entity in the rule, a negation that negates.
 *  - TRUTH is a separate review call on `gemini-flash-latest` (the
 *    spokenPracticePlan precedent): is the generalization true of EVERY member
 *    as a grade 3-5 text would state it, is each member really one, does each
 *    non-member really lack the property, does each lookalike really have it
 *    and really not belong? A child must never be affirmed on a false fact, and
 *    the generating model cannot be its own reviewer. A rule that fails review
 *    is DROPPED, never patched.
 *
 * SCOPE: the eval mode is the case SHAPE (conclude / deny / cannot_tell);
 * mixed = every rule worked through all three, the DI format. The objective
 * text steers the SUBJECT (science classification, social-studies rules, ELA
 * inference) through the prompt; the grade rides in the prompt for entity
 * choice only.
 *
 * KEEP-OR-DROP, NEVER BACKFILL: every rule that reaches the stage passed both
 * gates, and `itemsFromRules` re-checks structure on the way in.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { resolveEvalModes } from '../evalMode';
import { supportForSingleDiMode } from '../../hooks/diModeContract';
import {
  DEDUCTION_SHAPES,
  MAX_ENTITIES_PER_LIST,
  normalizeEntity,
  ruleTextOf,
  sanitizeRule,
  withArticle,
  type DeductionRuleSpec,
  type DeductionShape,
} from '../../primitives/visual-primitives/direct-instruction/diDeductionPlan';
import {
  itemsFromRules,
  type DeductionSupportTier,
  type DiDeductionData,
} from '../../primitives/visual-primitives/direct-instruction/diDeductionScript';
import {
  DI_DEDUCTION_CHALLENGE_TYPES,
  DI_DEDUCTION_TYPE_DOCS,
  type DeductionChallengeType,
} from '../../primitives/visual-primitives/direct-instruction/diDeductionModes';

const DEFAULT_CASE_COUNT = 6;
const MIN_CASE_COUNT = 3;
const MAX_CASE_COUNT = 9;
const MAX_RULES = 4;

const SUPPORT_TIERS: readonly DeductionSupportTier[] = ['easy', 'medium', 'hard'];
const normalizeSupportTier = (raw?: unknown): DeductionSupportTier | undefined => {
  const d = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as DeductionSupportTier) : undefined;
};

// ── Eval-mode routing (code stamps the mode; no schema enum exists) ──────────

export const CHALLENGE_TYPE_DOCS = DI_DEDUCTION_TYPE_DOCS;
const ALL_TYPES: readonly DeductionChallengeType[] = DI_DEDUCTION_CHALLENGE_TYPES;

// ── What Gemini writes ───────────────────────────────────────────────────────

const ruleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    category: { type: Type.STRING, description: "Singular common noun, no article: 'insect', 'bird', 'square', 'folktale'." },
    categoryPlural: { type: Type.STRING, description: "Its plural: 'insects', 'birds'." },
    propertyPlural: {
      type: Type.STRING,
      description: "The property with a PLURAL subject, as it completes 'All <plural> ___': 'have six legs', 'lay eggs', 'live in water'.",
    },
    propertySingular: {
      type: Type.STRING,
      description: "The same property with a SINGULAR subject, as it completes 'A beetle ___': 'has six legs', 'lays eggs'.",
    },
    propertyNegated: {
      type: Type.STRING,
      description: "The singular property NEGATED, as it completes 'A spider ___': 'does not have six legs', 'does not lay eggs'.",
    },
    kindNoun: {
      type: Type.STRING,
      description: "ONE word for the kind of thing the rule sorts: 'animal', 'shape', 'number', 'story', 'place'.",
    },
    members: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: `2-${MAX_ENTITIES_PER_LIST} things that ARE a <category>. Bare singular nouns, 1-3 words, no article.`,
    },
    nonMembers: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: `2-${MAX_ENTITIES_PER_LIST} things that truly LACK the property. Bare singular nouns, no article.`,
    },
    lookalikes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        `1-${MAX_ENTITIES_PER_LIST} things that truly HAVE the property but are NOT a <category> (a turtle lays eggs and `
        + 'is not a bird). Bare singular nouns, no article. Empty only if none exists.',
    },
  },
  required: ['category', 'categoryPlural', 'propertyPlural', 'propertySingular', 'propertyNegated', 'kindNoun', 'members', 'nonMembers', 'lookalikes'],
};

const sessionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Short, warm activity title for a grade 3-5 learner (e.g. 'Use the Rule'). It MUST NOT name any category, property, or entity from the rules.",
    },
    description: {
      type: Type.STRING,
      description: 'One sentence telling the child they will use a rule to say what follows, and how they know. Same rule: no category, property, or entity named.',
    },
    rules: {
      type: Type.ARRAY,
      items: ruleSchema,
      description: `${MAX_RULES} rules at most.`,
    },
  },
  required: ['title', 'description', 'rules'],
};

// ── The truth review (a different model, a different question) ───────────────

const reviewSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    verdicts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          ruleTrue: { type: Type.BOOLEAN, description: 'Is the RULE sentence itself true of every member, as a grade 3-5 textbook states it?' },
          badEntities: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Entities (exact strings) that fail their list\'s requirement. Empty when all pass.',
          },
          reason: { type: Type.STRING },
        },
        required: ['id', 'ruleTrue', 'badEntities', 'reason'],
      },
    },
  },
  required: ['verdicts'],
};

const describeForReview = (rule: DeductionRuleSpec): string =>
  `id ${rule.id}: RULE "${ruleTextOf(rule)}" · members (each must BE ${withArticle(rule.category)}): `
  + `${rule.members.join(', ')} · non-members (each must truly satisfy "${rule.propertyNegated}"): `
  + `${rule.nonMembers.join(', ') || '(none)'} · lookalikes (each must truly satisfy "${rule.propertySingular}" `
  + `AND NOT be ${withArticle(rule.category)}): ${rule.lookalikes.join(', ') || '(none)'}`;

/**
 * Keep the rules whose GENERALIZATION is true in the world, trimmed of any
 * entity that fails its list — a bad lookalike costs the lookalike, not the
 * rule (the first live probe lost "All birds have feathers" to a pillow). A
 * rule whose sentence is false is dropped whole; a trimmed rule re-runs the
 * structural gate so it still has a member. A review failure (network,
 * malformed JSON) keeps NOTHING — an unreviewed generalization is a fact a
 * child may be affirmed on, and the stage shows "no rules" honestly rather
 * than gambling.
 */
export async function reviewRuleTruth(rules: DeductionRuleSpec[], gradeLevel: string): Promise<DeductionRuleSpec[]> {
  if (rules.length === 0) return [];
  const prompt = `You are checking facts for a ${gradeLevel} lesson on reasoning from a rule. Judge EXACTLY as a grade 3-5 science, social studies or reading TEACHER would, at the level of an elementary textbook — NOT as a specialist. "All birds have feathers" is TRUE; "a spider does not have hair" is TRUE at this level; "all mammals have hair or fur" is TRUE; a shape or a number is a fine entity when the rule is about shapes or numbers. Reject only what a teacher would call false or would not teach (e.g. "all birds fly" — penguins).

For EACH rule:
1. ruleTrue: is the RULE sentence true of every member of the category, with no exception a child would know?
2. badEntities: list any entity that fails its list — a member that is not really one of the category; a non-member that actually HAS the property; a lookalike that does not really have the property, or that IS one of the category; any entity that is not a real, concrete, nameable thing a child that age knows. Leave the others alone.
Return one verdict per rule id with a short reason.

${rules.map(describeForReview).join('\n')}`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: reviewSchema,
        temperature: 0,
        maxOutputTokens: 8192,
        httpOptions: { timeout: 45000 },
      },
    });
    const parsed = JSON.parse(response.text || '{}') as {
      verdicts?: Array<{ id?: string; ruleTrue?: boolean; badEntities?: string[]; reason?: string }>;
    };
    const verdicts = new Map((parsed.verdicts ?? []).map((v) => [v.id, v]));
    const kept: DeductionRuleSpec[] = [];
    for (const rule of rules) {
      const v = verdicts.get(rule.id);
      if (!v || v.ruleTrue !== true) {
        console.warn(`[DiDeduction] review dropped ${rule.id} ("${ruleTextOf(rule)}"): ${v?.reason ?? 'no verdict returned'}`);
        continue;
      }
      const bad = new Set((v.badEntities ?? []).map(normalizeEntity).filter(Boolean));
      if (bad.size === 0) { kept.push(rule); continue; }
      const trimmed = sanitizeRule({
        ...rule,
        members: rule.members.filter((e) => !bad.has(e)),
        nonMembers: rule.nonMembers.filter((e) => !bad.has(e)),
        lookalikes: rule.lookalikes.filter((e) => !bad.has(e)),
      }, rule.id);
      console.warn(`[DiDeduction] review trimmed ${rule.id} ("${ruleTextOf(rule)}") of ${Array.from(bad).join(', ')}: ${v.reason ?? ''}${trimmed ? '' : ' — nothing left, dropped'}`);
      if (trimmed) kept.push(trimmed);
    }
    return kept;
  } catch (error) {
    console.warn('[DiDeduction] truth review failed — no rule ships unreviewed:', error);
    return [];
  }
}

// ── Wrapper hygiene ──────────────────────────────────────────────────────────

const FUNCTION_WORDS = new Set(['have', 'has', 'does', 'with', 'from', 'their', 'that', 'this', 'are', 'is', 'can', 'will', 'into', 'made', 'live', 'lives', 'grow', 'grows']);
const escapeRe = (w: string): string => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The wrapper may not name the content: a category, an entity, or a content
 *  word of a property ("legs", "eggs", "water"). */
const leaksRuleWords = (text: string, rules: DeductionRuleSpec[]): boolean => {
  const t = text.toLowerCase();
  return rules.some((r) => {
    const names = [r.category, r.categoryPlural, ...r.members, ...r.nonMembers, ...r.lookalikes];
    const propertyWords = r.propertyPlural.split(' ').filter((w) => w.length > 3 && !FUNCTION_WORDS.has(w));
    return [...names, ...propertyWords].some((w) => w && new RegExp(`\b${escapeRe(w)}\b`).test(t));
  });
};

const DEFAULT_TITLE = 'Use the Rule';
const DEFAULT_DESCRIPTION = 'Read the rule and the case, then say what follows — and how you know.';

/** Which shapes a rule is worked through, from the session's modes. */
const shapesFor = (modeTypes: DeductionChallengeType[]): DeductionShape[] =>
  DEDUCTION_SHAPES.filter((s) => modeTypes.includes(s));

/** Take whole rules, in order, until the case budget is met. A rule is never
 *  split — a rule worked through its shapes is the unit the stage shows. */
export const selectRules = (
  rules: DeductionRuleSpec[],
  count: number,
  supportTier?: DeductionSupportTier,
): { rules: DeductionRuleSpec[]; cases: number } => {
  const kept: DeductionRuleSpec[] = [];
  let cases = 0;
  for (const rule of rules) {
    const built = itemsFromRules([rule], supportTier).items.length;
    if (built === 0) continue;
    if (kept.length > 0 && cases + built > count) break;
    kept.push(rule);
    cases += built;
  }
  return { rules: kept, cases };
};

export const generateDiDeduction = async (
  topic: string,
  gradeLevel: string,
  config?: {
    intent?: string;
    objectiveText?: string;
    challengeCount?: number;
    targetEvalMode?: string;
    /** Per-component support tier from the manifest. */
    difficulty?: string;
    supportTier?: string;
    /** Canonical curriculum grade ('K' | '1'..'12') from the generation context. */
    grade?: string;
    [key: string]: unknown;
  },
): Promise<DiDeductionData> => {
  const intent = config?.intent;
  const count = Math.min(
    MAX_CASE_COUNT,
    Math.max(MIN_CASE_COUNT, config?.challengeCount ?? DEFAULT_CASE_COUNT),
  );
  const requestedSupportTier = normalizeSupportTier(config?.supportTier) ?? normalizeSupportTier(config?.difficulty);

  // Which shape(s)? An explicit pin wins; then the resolver over the objective;
  // mixed = every rule through all three, in the DI order.
  const resolution = await resolveEvalModes(
    'di-deduction',
    { targetEvalMode: config?.targetEvalMode, intent, objectiveText: config?.objectiveText },
    CHALLENGE_TYPE_DOCS,
  );
  const supportTier = supportForSingleDiMode(resolution, requestedSupportTier);
  let modeTypes: DeductionChallengeType[] =
    (resolution?.allowedTypes as DeductionChallengeType[] | undefined)?.filter((t) => ALL_TYPES.includes(t)) ?? [];
  if (modeTypes.length === 0) modeTypes = [...ALL_TYPES];
  const shapes = shapesFor(modeTypes);
  const needsLookalikes = shapes.includes('cannot_tell');

  const prompt = `Scope a brisk Direct Instruction DEDUCTION practice for a learner in ${gradeLevel}: the child sees a RULE ("All insects have six legs.") and a CASE ("A beetle is an insect."), and SAYS what the rule tells them, and how they know.

TOPIC: "${topic}"${intent ? `\nOBJECTIVE FOCUS: "${intent}"` : ''}${config?.objectiveText ? `\nOBJECTIVE: "${config.objectiveText}"` : ''}

Write ${MAX_RULES} rules that fit the topic. The code will print each rule EXACTLY as "All <categoryPlural> <propertyPlural>." — so the property must be TRUE OF EVERY member as a ${gradeLevel} textbook states it, with no exception a child would know (never "all birds fly"; yes "all birds lay eggs", "all birds have feathers", "all insects have six legs", "all squares have four equal sides"). Every entity must be a REAL, CONCRETE, NAMEABLE thing (a robin, a spider, a rectangle, a penny) — never a role or a vague noun ("a drawing", "a thing", "a window pane"), and never a made object standing in for a natural one (no pillow for feathers). Prefer generalizations from the subject the objective is about: science classification (animals, plants, matter, shapes), social studies rules (communities, government, geography), or the rules a reading passage states. Every entity is a real, concrete thing a ${gradeLevel} child knows by name.
${needsLookalikes
    ? 'Each rule NEEDS at least one true LOOKALIKE — a thing that has the property and is NOT in the category (a turtle lays eggs and is not a bird; a rectangle has four sides and is not a square). Choose rules where such a thing exists.'
    : 'Lookalikes may be empty when none exists.'}
Do not put the same thing in two lists. Do not name any entity inside the property. Title and description name NO category, property, or entity.

Return the JSON only.`;

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  let reviewed: DeductionRuleSpec[] = [];
  let generated = 0;
  let structurallyDropped = 0;

  for (let attempt = 0; attempt < 2 && reviewed.length === 0; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: sessionSchema,
          temperature: attempt === 0 ? 0.7 : 0.9,
          maxOutputTokens: 2048,
        },
      });
      const parsed = JSON.parse(response.text ?? '{}') as {
        title?: string; description?: string; rules?: Array<Record<string, unknown>>;
      };
      const rawRules = Array.isArray(parsed.rules) ? parsed.rules.slice(0, MAX_RULES) : [];
      generated = rawRules.length;
      const structural: DeductionRuleSpec[] = [];
      rawRules.forEach((raw, i) => {
        const rule = sanitizeRule({ ...raw, shapes }, `dd-${attempt + 1}-${i + 1}`);
        if (rule) structural.push(rule);
        else structurallyDropped++;
      });
      reviewed = await reviewRuleTruth(structural, gradeLevel);
      if (parsed.title?.trim() && !leaksRuleWords(parsed.title, reviewed)) title = parsed.title.trim();
      if (parsed.description?.trim() && !leaksRuleWords(parsed.description, reviewed)) description = parsed.description.trim();
    } catch (error) {
      console.warn(`[DiDeduction] generation attempt ${attempt + 1} failed:`, error);
    }
  }

  const selected = selectRules(reviewed, count, supportTier);
  const primaryType: DeductionChallengeType = shapes.length === 1 ? shapes[0] : modeTypes[0];

  console.log('DI Deduction Generated:', {
    title,
    modes: resolution ? `${resolution.modes.map((m) => m.evalMode).join('+')} (${resolution.source})` : modeTypes.join('+'),
    tier: supportTier ?? 'none',
    generated,
    structurallyDropped,
    reviewPassed: reviewed.length,
    rules: selected.rules.map((r) => `${ruleTextOf(r)} [${r.members.join('/')} | ${r.nonMembers.join('/')} | ${r.lookalikes.join('/') || '-'}]`),
    cases: selected.cases,
    requested: count,
  });

  return {
    title,
    description,
    challengeType: primaryType,
    rules: selected.rules,
    ...(supportTier ? { supportTier } : {}),
    gradeLevel: gradeLevel || 'Grade 3',
  };
};
