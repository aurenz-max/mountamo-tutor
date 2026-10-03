/**
 * The in-item levers on di-deduction (`/add-support-tiers`, DI family 8; table
 * qa/support-levers/di-deduction-lever-table-2026-10-03.md). No real-learner evidence: the misses are what
 * `deductionSpokenMisses` names, the 09-07 bench, and the catalog's `commonStruggles`.
 *
 * DI's correction is a PARALLEL-ITEM model (user ruling 2026-10-02). The model and the practice case come from SPARE
 * rules the generator writes and truth-reviews at generation time (ruling R3); code swaps them in at runtime with no LLM
 * call. A spare shares no content word with any session rule, so it answers no case of the session.
 *
 * Help:
 * - `model_case` (every mode): a card with the spare rule worked through every verdict it has: a member (so it has the
 *   property: yes), a non-member (no), and, when the spare has a lookalike, "this <kind>" (can't tell), each with its
 *   reason (ruling R1: one model per possible answer, so the card points at none). The cannot_tell subject stays
 *   anonymous; the lookalike is named only in the reason.
 * - `answer_frame`: conclude, "A beetle ___." (the case's subject and an empty box); deny and cannot_tell,
 *   "[ ] because [ ]". Never the property, a verdict, the category, or "so".
 * - `shared_term` (conclude, deny): lights the phrase the two cards share (conclude: the category; deny: the property and
 *   the case's whole negated property). Never on cannot_tell: lighting the matching property is the cue for "yes".
 * Simplify:
 * - `counterexample_card` (cannot_tell): an ungraded cannot_tell case on a spare rule, with a third card printing its
 *   lookalike fact ("A scorpion has eight legs. A scorpion is not a spider."), then the full case.
 * conclude and deny have no simplify: conclude is the mode floor, and dropping deny's reason crosses the mode.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { capitalize, planCases, withArticle, type DeductionCase, type DeductionRuleSpec } from './diDeductionPlan';
import { itemsFromRules, type DeductionItem } from './diDeductionScript';

export const MODEL_CASE = 'model_case';
export const ANSWER_FRAME = 'answer_frame';
export const SHARED_TERM = 'shared_term';
export const COUNTEREXAMPLE_CARD = 'counterexample_card';

const FUNCTION_WORDS = new Set(['a', 'an', 'the', 'is', 'are', 'has', 'have', 'does', 'do', 'not', 'of', 'in', 'on', 'with', 'to',
  'and', 'all', 'can', 'its', 'their', 'from', 'that', 'this', 'it', 'be', 'by', 'at', 'as']);
const stem = (w: string) => w.replace(/(ed|es|s)$/, '');

/** Every content word of a rule: its category, property and entities, stemmed so "insect" meets "insects" and
 *  "blood" meets "blooded". Not the kind noun: every animal rule says "this animal", and it names no answer. */
export function contentWords(rule: DeductionRuleSpec): Set<string> {
  const text = [rule.category, rule.categoryPlural, rule.propertyPlural, rule.propertySingular,
    ...rule.members, ...rule.nonMembers, ...rule.lookalikes].join(' ').toLowerCase();
  return new Set(text.split(/[^a-z]+/).filter(w => w && !FUNCTION_WORDS.has(w)).map(stem));
}

/** True when the spare shares a content word with any of the rules. */
export const spareLeaks = (spare: DeductionRuleSpec, rules: readonly DeductionRuleSpec[]) => {
  const own = contentWords(spare);
  return rules.some(r => Array.from(contentWords(r)).some(w => own.has(w)));
};

/** The spares the generator ships: reviewed rules not used in the session that share no content word with it. */
export const sparesFor = (session: readonly DeductionRuleSpec[], reviewed: readonly DeductionRuleSpec[]): DeductionRuleSpec[] =>
  reviewed.filter(r => !session.some(s => s.id === r.id) && !spareLeaks(r, session))
    .map(r => ({ ...r, shapes: undefined }));

const sessionRules = (items: readonly DeductionItem[]) => Array.from(new Map(items.map(i => [i.ruleId, i.rule])).values());

/** The spare the model uses for an item: a cannot_tell item needs one with a lookalike. Re-checked at mount. */
export function modelRuleFor(item: DeductionItem, items: readonly DeductionItem[], spares: readonly DeductionRuleSpec[]): DeductionRuleSpec | null {
  const rules = sessionRules(items);
  return spares.find(s => !spareLeaks(s, rules) && (item.shape !== 'cannot_tell' || s.lookalikes.length > 0)) ?? null;
}

export interface ModelCase extends DeductionCase { reason: string }

/** The model's cases: the spare worked through every shape it has, each with its reason. */
export function modelCases(spare: DeductionRuleSpec): ModelCase[] {
  const cat = withArticle(spare.category);
  return planCases({ ...spare, shapes: undefined }).map(c => ({ ...c,
    reason: c.shape === 'conclude' ? `${capitalize(c.subject)} is ${cat}, and all ${spare.categoryPlural} ${spare.propertyPlural}.`
      : c.shape === 'deny' ? `No: all ${spare.categoryPlural} ${spare.propertyPlural}, and ${c.subject} ${spare.propertyNegated}.`
        : `Can't tell: ${withArticle(c.lookalike!)} ${spare.propertySingular} too, and it is not ${cat}.` }));
}

/** `counterexample_card`: a cannot_tell practice case on a spare rule (preferring one the model does not use). */
export function counterexampleFor(item: DeductionItem, items: readonly DeductionItem[], spares: readonly DeductionRuleSpec[]): DeductionItem | null {
  if (item.shape !== 'cannot_tell') return null;
  const rules = sessionRules(items), model = modelRuleFor(item, items, spares);
  const usable = spares.filter(s => s.lookalikes.length > 0 && !spareLeaks(s, rules));
  const spare = usable.find(s => s.id !== model?.id) ?? usable[0];
  if (!spare) return null;
  return itemsFromRules([{ ...spare, id: `${item.id}~simpler`, shapes: ['cannot_tell'] }], item.supportTier).items[0] ?? null;
}

/** The lookalike fact a counterexample practice case prints on its third card. */
export const counterexampleFact = (item: DeductionItem) => item.case.lookalike
  ? `${capitalize(withArticle(item.case.lookalike))} ${item.rule.propertySingular}. ${capitalize(withArticle(item.case.lookalike))} is not ${withArticle(item.rule.category)}.`
  : '';

/** The phrases `shared_term` lights on the rule card and the case card. */
export function sharedTerms(item: DeductionItem): { rule: string; case: string } | null {
  if (item.shape === 'conclude') return { rule: item.rule.categoryPlural, case: withArticle(item.rule.category) };
  if (item.shape === 'deny') return { rule: item.rule.propertyPlural, case: item.rule.propertyNegated };
  return null;
}

/** The answer frame's printed text. */
export const frameText = (item: DeductionItem) => item.shape === 'conclude' ? `${capitalize(item.case.subject)} ___.` : '___ because ___';

export const startingLevers = (item: DeductionItem, items: readonly DeductionItem[], spares: readonly DeductionRuleSpec[]): string[] =>
  item.supportTier === 'easy' || !item.supportTier ? (modelRuleFor(item, items, spares) ? [MODEL_CASE] : []) : [];

export function deductionLevers(item: DeductionItem | null, pulled: readonly string[], items: readonly DeductionItem[],
    spares: readonly DeductionRuleSpec[]): WorkspaceLever[] {
  if (!item) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: string[], when: string,
    does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const out: WorkspaceLever[] = [];
  const modeMisses = item.shape === 'conclude' ? ['said_negation', 'read_rule_back', 'read_case_back']
    : item.shape === 'deny' ? ['said_member', 'said_cannot_tell', 'verdict_without_reason']
      : ['backwards_yes', 'said_not_member', 'verdict_without_reason'];
  if (modelRuleFor(item, items, spares)) out.push(lever(MODEL_CASE, 'help', 'both', modeMisses,
    'The learner gives a wrong verdict or no reason, answers from what they know, or does not know how to start.',
    'Shows a card with a DIFFERENT rule worked through each answer it has (yes, no, and can\'t tell), each with its reason '
      + '(onScreen gives them). Say ALL of them as your turn, in order, never only the one like the learner\'s case. Then ask '
      + 'the learner\'s case again. Never apply the model to their rule, and never name a lookalike of their rule.'));
  out.push(lever(ANSWER_FRAME, 'help', 'both', item.shape === 'conclude' ? ['read_rule_back', 'read_case_back'] : ['verdict_without_reason'],
    item.shape === 'conclude' ? 'The learner reads a card back instead of saying what follows.' : 'The learner gives a verdict with no reason.',
    item.shape === 'conclude'
      ? 'Prints the case\'s subject and an empty box under the cards: the answer starts with the subject. Read the frame; never fill the box.'
      : 'Prints "___ because ___" under the verdict words: a verdict and a reason. Read the frame; never fill a box or light a word.'));
  const terms = sharedTerms(item);
  if (terms) out.push(lever(SHARED_TERM, 'help', 'shown', item.shape === 'conclude' ? ['said_negation'] : ['said_member', 'said_cannot_tell'],
    'The learner\'s verdict does not follow from the two cards.',
    'Lights, in one colour, the words the two cards share. Draws no arrow and no verdict; say "look at the lit words".'));
  if (counterexampleFor(item, items, spares)) out.push(lever(COUNTEREXAMPLE_CARD, 'simplify', 'both', ['backwards_yes', 'said_not_member'],
    'The learner runs the rule backwards, or says no.',
    'Opens an easier case first, on a different rule, with a third card that prints its lookalike. It is not graded; the full case comes back after it. '
      + 'Back on the full case, never say what its rule does not say ("not only …") or name a lookalike: that is the answer.'));
  return out;
}

/** What the pulled levers put on screen, as a scene fact. Gives the model; never this case's conclusion. */
export function deductionLeverFacts(item: DeductionItem | null, pulled: readonly string[], items: readonly DeductionItem[],
    spares: readonly DeductionRuleSpec[]): string {
  if (!item) return '';
  const spare = pulled.includes(MODEL_CASE) ? modelRuleFor(item, items, spares) : null;
  const terms = sharedTerms(item);
  return [
    spare && `Beside the cards, a model card shows a different rule, "All ${spare.categoryPlural} ${spare.propertyPlural}.", worked through: `
      + modelCases(spare).map(c => `${c.caseText} ${c.reason}`).join(' ') + ' It is not this rule.',
    pulled.includes(ANSWER_FRAME) && `Under the cards a frame is printed: "${frameText(item)}", with empty boxes.`,
    pulled.includes(SHARED_TERM) && terms && `The words "${terms.rule}" on the rule card and "${terms.case}" on the case card are lit in one colour.`,
  ].filter((s): s is string => !!s).join(' ');
}
