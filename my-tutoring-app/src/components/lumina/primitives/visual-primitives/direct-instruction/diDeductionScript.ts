/**
 * diDeductionScript — HAND-AUTHORED Direct Instruction script for
 * di-deduction, the second pack in the "DI for Older Learners" tier (design
 * brief 2026-09-07, concept 3). Two cards — a RULE and a CASE — and the child
 * SAYS what the rule tells them, and how they know. Nothing is tapped: a
 * teacher at a table asks "so what do you know about the beetle?" and the
 * child answers out loud.
 *
 * WHAT IS NEW, AND WHAT IS NOT. The runner, the sentinels, the correction cap
 * and the context sync are the family's (`useJudgedScriptRunner`). What this
 * module adds is a unit of judgment: a DEDUCTION. Class `deduction` — a
 * VERDICT (a conclusion sentence, or no / can't tell) plus a REASON that comes
 * from the rule, judged on MEANING the way `concept_statement` is: "it's got
 * eight legs so it's not one" is a full answer to a `deny` case.
 *
 * THE FOUR THINGS THE PACK HOLDS THAT THE CLASS CANNOT (the contract clauses):
 *   1. THE SIGNATURE ERROR IS A CONFIDENT YES. "Yes, because it lays eggs" on a
 *      `cannot_tell` case is fluent, cites the rule, and is wrong — the rule
 *      does not run backwards. It has its own correction branch, first.
 *   2. A VERDICT WITH NO REASON IS HALF AN ANSWER on `deny` / `cannot_tell`.
 *      Decided ONE way (two-branch law): the contract REFUSES it, and the
 *      specific correction is the DI "how do you know?" firm-up — the verdict
 *      is granted, the reason is modeled, the case is re-asked. The accept
 *      clause names the short forms a child really uses ("nope, eight legs").
 *   3. THE ECHO IS THE RULE READ BACK. "All insects have six legs" answers
 *      nothing about the beetle; it routes to the general branch.
 *   4. THE CORRECTION CAP IS LOAD-BEARING (open class). Never raise it.
 *
 * THE ASK NEVER NAMES THE ANSWER. The rule is read aloud on the FIRST case of
 * each rule (and on every case at the `easy` tier) — it is the stimulus, and
 * on a `conclude` case the property is the answer BY DESIGN (the story-talk
 * precedent: `leakExemptSpansFor` subtracts the rule sentence). "Can't tell"
 * is named ONCE, in the how-to-play, because a child who has never heard the
 * verdict cannot produce it; it is never in a per-case ask.
 *
 * THE SCREEN ONLY FOLLOWS. The conclusion is written under the cards on the
 * affirmation, and the verdict pill lights then — never before. The cases
 * come from `diDeductionPlan.ts`, never from the model.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn"); every correction
 * re-models the reasoning then re-elicits (standing gate 3). Corrections are
 * CONTRASTIVE where a wrong verdict was said (⟨what they said⟩ is a slot the
 * tutor fills from the audio — never spoken as marks), and each shape scripts
 * its SPECIFIC branches ahead of the general one, in the family's order: ask,
 * affirm, specific corrections, general last (`diDrivePlan.ts` item 27).
 *
 * MOVE-ON CARRIES THE CONCLUSION. When the cap is reached the tutor states it
 * before the next ask and the page writes it as carried — otherwise the ledger
 * under the rule would have a hole where a case was closed.
 */

import type { JudgedCueOptions, JudgedCueSurface, JudgedScriptItem } from '../../../hooks/judgedScriptContract';
import {
  capitalize,
  planCases,
  ruleTextOf,
  sanitizeRule,
  withArticle,
  type DeductionCase,
  type DeductionRuleSpec,
  type DeductionShape,
} from './diDeductionPlan';

export type { DeductionRuleSpec, DeductionShape, DeductionCase } from './diDeductionPlan';

/** The eval modes ARE the case shapes. */
export type DeductionChallengeType = DeductionShape;
/** L3 lever: at `easy` every ask re-reads the rule; otherwise only the first
 *  case of a rule does. `medium` and `hard` are identical in this pilot — a
 *  later /add-support-tiers pass owns the split. */
export type DeductionSupportTier = 'easy' | 'medium' | 'hard';

export interface DeductionItem extends JudgedScriptItem {
  action: 'deduce';
  responseClass: 'deduction';
  answerKind: 'voice';
  challengeType: DeductionChallengeType;
  shape: DeductionShape;
  supportTier?: DeductionSupportTier;
  ruleId: string;
  /** Position of this rule in the session (0-based). */
  ruleIndex: number;
  /** Position of this case within its rule (0-based). */
  caseIndex: number;
  isFirstCase: boolean;
  isLastCase: boolean;
  rule: DeductionRuleSpec;
  /** "All insects have six legs." — the printed rule card. */
  ruleText: string;
  case: DeductionCase;
  /** The canonical utterance, for evidence and the harness. */
  answerSpoken: string;
}

export interface DiDeductionData {
  title: string;
  description: string;
  challengeType: DeductionChallengeType;
  rules: DeductionRuleSpec[];
  supportTier?: DeductionSupportTier;
  gradeLevel?: string;
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: unknown) => void;
}

// ── Items from rules (the ONE builder; the harness calls it too) ─────────────

const itemsForRule = (
  rule: DeductionRuleSpec,
  ruleIndex: number,
  supportTier: DeductionSupportTier | undefined,
): DeductionItem[] => {
  const cases = planCases(rule);
  const ruleText = ruleTextOf(rule);
  const cat = withArticle(rule.category);
  return cases.map((c, caseIndex) => {
    const answerSpoken = c.shape === 'conclude'
      ? `${c.subject} ${rule.propertySingular}`
      : c.shape === 'deny'
        ? `no, ${c.subject} is not ${cat}, because all ${rule.categoryPlural} ${rule.propertyPlural} and ${c.subject} ${rule.propertyNegated}`
        : `can't tell, because the rule does not say only ${rule.categoryPlural} ${rule.propertyPlural}`;
    return {
      id: `${rule.id}-c${caseIndex}-${c.shape}`,
      action: 'deduce' as const,
      answerKind: 'voice' as const,
      responseClass: 'deduction' as const,
      challengeType: c.shape,
      shape: c.shape,
      ...(supportTier ? { supportTier } : {}),
      ruleId: rule.id,
      ruleIndex,
      caseIndex,
      isFirstCase: caseIndex === 0,
      isLastCase: caseIndex === cases.length - 1,
      rule,
      ruleText,
      case: c,
      answerSpoken,
    };
  });
};

/**
 * Build the judged items for a session. Rules that fail the plan gates, or
 * that build NO case for the shapes they promised, are DROPPED and counted —
 * a placeholder case in a judged loop becomes a spoken ask the tutor must
 * judge, so nothing is ever backfilled.
 */
export function itemsFromRules(
  rules: readonly DeductionRuleSpec[],
  supportTier?: DeductionSupportTier,
): { items: DeductionItem[]; dropped: number } {
  const items: DeductionItem[] = [];
  let dropped = 0;
  let ruleIndex = 0;
  for (const raw of rules) {
    const rule = sanitizeRule(raw as unknown as Record<string, unknown>, raw.id);
    if (!rule) { dropped++; continue; }
    const built = itemsForRule(rule, ruleIndex, supportTier);
    if (built.length === 0) { dropped++; continue; }
    items.push(...built);
    ruleIndex++;
  }
  return { items, dropped };
}

/** Every distinct rule in item order — the stage renders one at a time. */
export const rulesOf = (items: readonly DeductionItem[]): string[] =>
  Array.from(new Set(items.map((it) => it.ruleId)));

// ── The spoken lines ─────────────────────────────────────────────────────────

const readsRule = (item: DeductionItem): boolean => item.isFirstCase || item.supportTier === 'easy';

/** The rule as the tutor reads it — the ONE exempt span of a `conclude` ask. */
export const ruleReadAloud = (item: DeductionItem): string =>
  `${item.isFirstCase ? 'Here is the rule' : 'The rule'}: ${item.ruleText}`;

const question = (item: DeductionItem): string =>
  item.shape === 'conclude'
    ? `So what does the rule tell you about ${item.case.subject}?`
    : `Is ${item.case.subject} ${withArticle(item.rule.category)}? How do you know?`;

/** The ask for one case — what the child hears right before their turn. */
export const askLine = (item: DeductionItem): string => {
  const lead = readsRule(item) ? `${ruleReadAloud(item)} ` : 'Same rule. ';
  return `${lead}${item.case.caseText} ${question(item)}`;
};

/** The short re-ask every correction ends on. Never restates the rule. */
const reAsk = (item: DeductionItem): string => `Your turn. ${question(item)}`;

/** Spoken ONCE, on the opening turn (and on an action change, which this
 *  single-action pack never has). It is where "can't tell" is taught, so the
 *  verdict exists for the child before any case can need it. */
export const HOW_TO_PLAY =
  'We are going to use rules. I read a rule and a fact, and you tell me what the rule says about it, '
  + 'and how you know. Use only the rule, not what you already know. Sometimes the rule cannot tell you; '
  + 'then you say can\'t tell. ';

/** The resolved case as a statement — the affirmation's body and the
 *  move-on's carry line. */
const resolution = (item: DeductionItem): string => {
  const r = item.rule;
  const s = item.case.subject;
  const cat = withArticle(r.category);
  if (item.shape === 'conclude') return `${s} is ${cat}, so ${s} ${r.propertySingular}.`;
  if (item.shape === 'deny') {
    return `${s} is not ${cat}, because all ${r.categoryPlural} ${r.propertyPlural} and ${s} ${r.propertyNegated}.`;
  }
  const look = withArticle(item.case.lookalike as string);
  return `you can't tell. All ${r.categoryPlural} ${r.propertyPlural}, but the rule does not say only `
    + `${r.categoryPlural} ${r.propertyPlural} — ${look} ${r.propertySingular} too, and ${look} is not ${cat}.`;
};

/** Affirmation. MUST begin with "Yes" — the engine scans that sentinel. */
export const verifyLine = (item: DeductionItem): string => `Yes, ${resolution(item)}`;

/** The model of the reasoning, spoken by the tutor in every correction. */
const modelOf = (item: DeductionItem): string => {
  const r = item.rule;
  const s = item.case.subject;
  const cat = withArticle(r.category);
  const rule = `The rule says all ${r.categoryPlural} ${r.propertyPlural}.`;
  if (item.shape === 'conclude') return `${rule} ${capitalize(s)} is ${cat}, so ${s} ${r.propertySingular}.`;
  if (item.shape === 'deny') return `${rule} ${capitalize(s)} ${r.propertyNegated}, so ${s} is not ${cat}.`;
  const look = withArticle(item.case.lookalike as string);
  return `${rule} It does not say only ${r.categoryPlural} ${r.propertyPlural} — ${look} ${r.propertySingular} too, `
    + `and ${look} is not ${cat}. So the rule can't tell you.`;
};

/**
 * The correction branches for one case, SPECIFIC first and the general
 * fallback LAST (the harness reads the final span as the catch-all). Every
 * line opens with "My turn" and ends on the re-ask.
 */
export const correctionLines = (item: DeductionItem): {
  affirmedConsequent?: string;
  wrongVerdict?: string;
  noReason?: string;
  contrast?: string;
  fallback: string;
} => {
  const end = ` ${reAsk(item)}`;
  const model = modelOf(item);
  if (item.shape === 'conclude') {
    return {
      contrast: `My turn: not ⟨what they said⟩ — ${model}${end}`,
      fallback: `My turn: ${model}${end}`,
    };
  }
  if (item.shape === 'deny') {
    return {
      noReason: `My turn: how do you know? ${model}${end}`,
      contrast: `My turn: not ⟨what they said⟩ — ${model}${end}`,
      fallback: `My turn: ${model}${end}`,
    };
  }
  return {
    affirmedConsequent: `My turn: the rule does not work backwards. ${model}${end}`,
    wrongVerdict: `My turn: not ⟨what they said⟩ — ${model}${end}`,
    noReason: `My turn: how do you know? ${model}${end}`,
    fallback: `My turn: ${model}${end}`,
  };
};

// ── The judging contract ─────────────────────────────────────────────────────

const WAIT_FACT = 'You then stay silent while the learner works. ';
const SLOT_RULE =
  'Replace ⟨what they said⟩ with the words they actually said, and never speak the ⟨ ⟩ marks. ';
const MEANING =
  'Judge the MEANING of what you heard, not the words — a child\'s own phrasing with none of these '
  + 'words counts when the idea is there. ';
const CLOSING_LAW =
  'After you affirm, you stop; the application sends the next case, and you never continue into '
  + 'another case or another rule yourself. Never begin any other sentence with the word "Yes" or '
  + 'the words "My turn". Speak nothing beyond these exact lines, and never announce that you are '
  + 'waiting or listening — simply stop speaking.';

const stimulusFact = (item: DeductionItem): string =>
  `The rule is "${item.ruleText}" and the case is "${item.case.caseText}" `;

const concludeContract = (item: DeductionItem): string => {
  const r = item.rule;
  const s = item.case.subject;
  const cat = withArticle(r.category);
  const lines = correctionLines(item);
  return (
    WAIT_FACT
    + stimulusFact(item)
    + `${capitalize(s)} is ${cat}, so ${s} ${r.propertySingular}. The learner is stating that conclusion in `
    + `their own words, and there is no single right wording — "${s} ${r.propertySingular}", `
    + `"it ${r.propertySingular}", "so it ${r.propertySingular} too", or the property alone, `
    + `"${r.propertySingular}". Any wording that means ${s} ${r.propertySingular} counts. ${MEANING}`
    + `The rule read back — "all ${r.categoryPlural} ${r.propertyPlural}" — says nothing about ${s} and `
    + `is not an answer; neither is the case read back, and neither is a fact about ${s} the rule does `
    + 'not say. '
    + `If the answer is right, say exactly: "${verifyLine(item)}" `
    + `If the learner says ${s} is not ${cat}, that it ${r.propertyNegated}, or that the rule cannot tell `
    + `them, that is the wrong conclusion; say exactly: "${lines.contrast}" ${SLOT_RULE}`
    + 'If there is no answer, only a filler sound like "um" or "hmm", the rule or the case read back, '
    + `"I don't know", or a fact the rule does not say, say exactly: "${lines.fallback}" `
    + CLOSING_LAW
  );
};

const denyContract = (item: DeductionItem): string => {
  const r = item.rule;
  const s = item.case.subject;
  const cat = withArticle(r.category);
  const lines = correctionLines(item);
  return (
    WAIT_FACT
    + stimulusFact(item)
    + `Every one of the ${r.categoryPlural} ${r.propertyPlural} and ${s} ${r.propertyNegated}, so ${s} is `
    + `NOT ${cat}. The learner gives a VERDICT and a REASON. A right answer says no — not ${cat} — and `
    + `connects it to the rule: "no, because all ${r.categoryPlural} ${r.propertyPlural} and it ${r.propertyNegated}", `
    + `"nope, it ${r.propertyNegated}", "not ${cat}, because ${r.categoryPlural} ${r.propertyPlural}". `
    + `The short form counts: a no plus the fact that it ${r.propertyNegated}, in any words, is a full `
    + `answer. ${MEANING}`
    + `If the answer is right, say exactly: "${verifyLine(item)}" `
    + `If the learner says no with no reason, or with a reason that does not come from the rule — nothing `
    + `about whether it ${r.propertySingular} — such as "no", "no, because it's ${s}", or `
    + `"no, because it just isn't", the verdict is right and the reason is missing; say exactly: `
    + `"${lines.noReason}" `
    + `If the learner says yes, that ${s} is ${cat}, or that the rule cannot tell them, that is the wrong `
    + `verdict; say exactly: "${lines.contrast}" ${SLOT_RULE}`
    + 'If there is no answer, only a filler sound like "um" or "hmm", the rule or the case read back, or '
    + `"I don't know", say exactly: "${lines.fallback}" `
    + CLOSING_LAW
  );
};

const cannotTellContract = (item: DeductionItem): string => {
  const r = item.rule;
  const s = item.case.subject;
  const cat = withArticle(r.category);
  const look = withArticle(item.case.lookalike as string);
  const lines = correctionLines(item);
  return (
    WAIT_FACT
    + stimulusFact(item)
    + `The rule says every one of the ${r.categoryPlural} ${r.propertyPlural}; it does NOT say that only `
    + `${r.categoryPlural} ${r.propertyPlural} — ${look} ${r.propertySingular} too, and ${look} is not ${cat}. `
    + `So the rule cannot tell us whether ${s} is ${cat}. The learner gives a VERDICT and a REASON. A right `
    + `answer says you can't tell — "can't tell", "maybe", "not sure", "the rule doesn't say", "it might be" — `
    + `and why: other things ${r.propertyPlural} too, just because it ${r.propertySingular} doesn't make it `
    + `${cat}, the rule doesn't say only ${r.categoryPlural} ${r.propertyPlural}. `
    + `"No, because other things ${r.propertyPlural} too" carries that reason and counts. ${MEANING}`
    + `If the answer is right, say exactly: "${verifyLine(item)}" `
    + `THE SIGNATURE ERROR is a confident yes — "yes, because it ${r.propertySingular}" — which cites the rule `
    + `and is wrong, because the rule does not run backwards. If the learner says yes, that ${s} is ${cat}, `
    + `say exactly: "${lines.affirmedConsequent}" `
    + `If the learner says no, that ${s} is not ${cat}, with no reason that other things `
    + `${r.propertyPlural} too, say exactly: "${lines.wrongVerdict}" ${SLOT_RULE}`
    + `If the learner says can't tell, maybe, or "I don't know" but gives no reason, say exactly: `
    + `"${lines.noReason}" `
    + 'If there is no answer, only a filler sound like "um" or "hmm", or the rule or the case read back, '
    + `say exactly: "${lines.fallback}" `
    + CLOSING_LAW
  );
};

export const judgingContract = (item: DeductionItem): string => {
  if (item.shape === 'conclude') return concludeContract(item);
  if (item.shape === 'deny') return denyContract(item);
  return cannotTellContract(item);
};

// ── Cues ─────────────────────────────────────────────────────────────────────

/** One case's ask. The how-to-play rides INSIDE the quoted line on the opening
 *  turn only (SWAP-1); every later ask is the short case signal. */
export const itemCue = (item: DeductionItem, opts: JudgedCueOptions): string => {
  const how = opts.opening || opts.howToPlay ? HOW_TO_PLAY : '';
  return `[DD_ITEM] Say exactly: "${how}${askLine(item)}" ${judgingContract(item)}`;
};

/** Cap reached: the tutor STATES the conclusion (so the page can carry it),
 *  then asks the next case. The last case of the run closes warmly. */
export const moveOnCue = (
  item: DeductionItem,
  next: DeductionItem | null,
  opts: JudgedCueOptions,
): string => {
  const carry = `Good try. ${capitalize(resolution(item))}`;
  if (!next) {
    return `[DD_MOVE_ON] Say exactly: "${carry} That's the end of our rule work for today." Then stop — the activity is over.`;
  }
  const how = opts.howToPlay ? HOW_TO_PLAY : '';
  return `[DD_MOVE_ON] Say exactly: "${carry} ${how}${askLine(next)}" ${judgingContract(next)}`;
};

export const completeCue = (): string =>
  '[DD_COMPLETE] Say exactly: "That\'s the end of our rule work. You used every rule yourself. '
  + 'Great thinking today!" Then stop — the activity is over.';

/** Tap-to-hear: the RULE and the CASE, never a conclusion or a verdict. */
export const pronounceCue = (item: DeductionItem): string =>
  `[DD_HEAR] Say exactly: "${item.ruleText} ${item.case.caseText}" Then stop — say nothing else.`;

/** RUNTIME STATE, stimulus side only: the printed rule and case. Never a
 *  conclusion, never a verdict. Keys stay in lockstep with `contextKeys` on
 *  the catalog entry. */
export const contextFor = (item: DeductionItem): Record<string, string> => ({
  challengeType: item.challengeType,
  rule: item.ruleText,
  case: item.case.caseText,
  supportTier: item.supportTier ?? 'medium',
});

// ── Gates the generator and the harness share ────────────────────────────────

/**
 * The ask must not say the case's answer. A `conclude` ask guards the property
 * (which the rule sentence carries by design — exempt below); a `deny` ask
 * guards the verdict word and the negated category; a `cannot_tell` ask guards
 * the verdict itself, which only the how-to-play may name.
 */
export const leakTokensFor = (item: DeductionItem): string[] => {
  const r = item.rule;
  if (item.shape === 'conclude') return [r.propertySingular, r.propertyPlural];
  if (item.shape === 'deny') return ['no', `not ${withArticle(r.category)}`];
  return ["can't tell", 'cannot tell', 'maybe'];
};

export const leakExemptSpansFor = (item: DeductionItem): string[] => [
  HOW_TO_PLAY.trim(),
  ruleReadAloud(item),
];

// ── The cue surface — exported once, spread by the component and the harness ─

export const diDeductionPackBase = (items: DeductionItem[]): JudgedCueSurface<DeductionItem> => ({
  primitiveType: 'di-deduction',
  activityLine: 'live direct instruction deductions: a rule, a case, and the child says what follows and why',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor,
});
