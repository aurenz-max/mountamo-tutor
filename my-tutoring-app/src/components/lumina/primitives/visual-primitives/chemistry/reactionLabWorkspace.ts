/**
 * Reaction lab on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, C26).
 *
 * Pure: the component, the adapter, the journey row and the tests read the same items, checks, misses, assignment and
 * scene. Every item is one generated challenge with a code-held key (`correctOptionId`, `correctBoolean`, or a classify
 * `targetAnswer` of chemical/physical). A predict challenge is asked before the substances are mixed; every other
 * challenge after the reaction has run. A choice is tapped and checked, or said aloud (user ruling 10-13: a sayable
 * choice takes speech as well as the tap); JEV judges speech against `expectedAnswer`.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { stableShuffle } from '../../../utils/choiceOrder';
import type { ChallengeOption, ReactionChallenge, ReactionLabData } from './ReactionLab';

/** Before: asked with the substances unmixed. After: asked once the reaction has run. */
export type ReactionStage = 'before' | 'after';
export const stageOf = (c: Pick<ReactionChallenge, 'type'>): ReactionStage => (c.type === 'predict' ? 'before' : 'after');

export interface ReactionItem { id: string; challenge: ReactionChallenge; stage: ReactionStage }

/** How a challenge is answered on screen. `open` (a typed answer) has no code-held key. */
export type AnswerForm = 'true_false' | 'choice' | 'classify' | 'open';
export function answerForm(c: ReactionChallenge): AnswerForm {
  if (c.isTrueFalse && typeof c.correctBoolean === 'boolean') return 'true_false';
  if (c.options?.length && c.correctOptionId && c.options.some(o => o.id === c.correctOptionId)) return 'choice';
  if (c.type === 'classify' && /^(chemical|physical)$/i.test((c.targetAnswer ?? '').trim())) return 'classify';
  return 'open';
}

/**
 * The challenges in the order they are asked: every predict challenge first (before mixing), then the rest, each group
 * in generated order. `checkedOnly` (workspace path) keeps only challenges with a code-held key.
 */
export function reactionItems(challenges: readonly ReactionChallenge[] = [], opts: { checkedOnly?: boolean } = {}): ReactionItem[] {
  const kept = challenges.filter(c => !!c && (!opts.checkedOnly || answerForm(c) !== 'open'));
  const items = kept.map((challenge): ReactionItem => ({ id: challenge.id, challenge, stage: stageOf(challenge) }));
  return [...items.filter(i => i.stage === 'before'), ...items.filter(i => i.stage === 'after')];
}

export interface ReactionChoice { value: string; label: string; letter: string }
const LETTERS = 'ABCDEFGH';

/**
 * The choices as shown. Generated options are shuffled by a seed (the generator often lists the right one first, and
 * its option id is the printed letter), then lettered by position. Stable across renders.
 */
export function shownOptions(options: readonly ChallengeOption[], seed: string): ReactionChoice[] {
  return stableShuffle(options, seed).map((o, i) => ({ value: o.id, label: o.text.trim(), letter: LETTERS[i] ?? String(i + 1) }));
}

export function itemChoices(c: ReactionChallenge): ReactionChoice[] {
  switch (answerForm(c)) {
    case 'true_false': return [{ value: 'true', label: 'True', letter: 'A' }, { value: 'false', label: 'False', letter: 'B' }];
    case 'classify': return [{ value: 'chemical', label: 'Chemical Change', letter: 'A' }, { value: 'physical', label: 'Physical Change', letter: 'B' }];
    case 'choice': return shownOptions(c.options ?? [], c.id);
    default: return [];
  }
}

/** The value of the right choice, or null for a typed answer. */
export function keyValue(c: ReactionChallenge): string | null {
  switch (answerForm(c)) {
    case 'true_false': return String(c.correctBoolean);
    case 'choice': return c.correctOptionId ?? null;
    case 'classify': return c.targetAnswer.trim().toLowerCase();
    default: return null;
  }
}
export const keyLabel = (c: ReactionChallenge) => itemChoices(c).find(x => x.value === keyValue(c))?.label ?? '';
const labelOf = (c: ReactionChallenge, value: string) => itemChoices(c).find(x => x.value === value)?.label;

export const reactionCorrect = (item: ReactionItem | null | undefined, value: string | null) =>
  !!item && value !== null && value === keyValue(item.challenge);

/**
 * What a wrong choice shows (`TeachingAttempt.miss`, handoff 20). The options record no reason for being wrong, so a
 * pattern is named only where the choice shows one:
 * - `true_false_flipped`: a true-false statement judged the other way;
 * - `chemical_physical_swap`: chemical picked for physical or the other way (the classify buttons, or a choice that
 *   says the other kind of change);
 * - `unbalanced_equation`: on a balance challenge, an equation that is not balanced;
 * - `no_change`: a choice saying nothing happens or nothing changes, where the right one says something does;
 * - `other_choice`: any other choice.
 */
export type ReactionMiss = 'true_false_flipped' | 'chemical_physical_swap' | 'unbalanced_equation' | 'no_change' | 'other_choice';

export const REACTION_MISSES: Record<'predict' | 'observe' | 'explain', readonly ReactionMiss[]> = {
  predict: ['no_change', 'chemical_physical_swap', 'true_false_flipped', 'other_choice'],
  observe: ['chemical_physical_swap', 'no_change', 'true_false_flipped', 'other_choice'],
  explain: ['unbalanced_equation', 'chemical_physical_swap', 'true_false_flipped', 'no_change', 'other_choice'],
};

const NO_CHANGE = /\b(nothing|no (visible |observable |new )?changes?|no reaction|stays? the same|no signs?)\b/i;
const kindOf = (t: string) => (/\bchemical\b/i.test(t) ? 'chemical' : /\bphysical\b/i.test(t) ? 'physical' : null);

function choiceMiss(c: ReactionChallenge, label: string): ReactionMiss {
  const form = answerForm(c);
  if (form === 'true_false') return 'true_false_flipped';
  if (form === 'classify') return 'chemical_physical_swap';
  if (c.type === 'balance') return 'unbalanced_equation';
  const key = keyLabel(c);
  if (kindOf(key) && kindOf(label) && kindOf(key) !== kindOf(label)) return 'chemical_physical_swap';
  if (NO_CHANGE.test(label) && !NO_CHANGE.test(key)) return 'no_change';
  return 'other_choice';
}

export function reactionMiss(item: ReactionItem | null | undefined, value: string | null): ReactionMiss | undefined {
  if (!item || value === null || reactionCorrect(item, value)) return undefined;
  const label = labelOf(item.challenge, value);
  return label === undefined ? undefined : choiceMiss(item.challenge, label);
}

/** The learner's work in their own terms, never the key. */
export const describeReactionWork = (item: ReactionItem | null | undefined, value: string | null) => {
  const label = item && value !== null ? labelOf(item.challenge, value) : undefined;
  return label ? `Chose "${label}"` : 'Nothing chosen yet';
};

/** The ask the tutor is given. */
export function askOf(item: ReactionItem): string {
  const c = item.challenge, form = answerForm(c), text = c.instruction.trim();
  if (form === 'true_false') return `True or false: ${text}`;
  if (form === 'classify') return `${text} (Chemical Change or Physical Change)`;
  return text;
}

const stripEnd = (t: string) => t.trim().replace(/[.!?]+$/, '');
const quoted = (xs: readonly string[]) => xs.map(x => `"${stripEnd(x)}"`).join(', ');
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

/** The answer a spoken reply is judged against, with the ways a learner says it. */
export function reactionExpectedAnswer(item: ReactionItem): string {
  const c = item.challenge, form = answerForm(c);
  if (form === 'true_false') {
    const truth = c.correctBoolean === true;
    return `${truth ? 'true' : 'false'}: the statement is ${truth ? 'true' : 'false'}. `
      + `${truth ? '"yes", "yeah", "right", "it is"' : '"no", "nope", "wrong", "it is not"'} count too, alone or in a short `
      + 'sentence. The statement said back gives no verdict and is not it.';
  }
  if (form === 'classify') {
    const key = keyValue(c)!, other = key === 'chemical' ? 'physical' : 'chemical';
    return `"${key}": a ${key} change. "${key}", "${key} change" or "it's ${key}" count. "${other}" is wrong, and so is `
      + 'naming both or hedging between them.';
  }
  const choices = itemChoices(c), at = choices.findIndex(x => x.value === keyValue(c));
  const others = choices.filter((_, i) => i !== at).map(x => x.label);
  return `"${stripEnd(choices[at]?.label ?? '')}" (choice ${choices[at]?.letter}, ${at + 1} of ${choices.length}). The whole choice, `
    + `the part that tells it apart from the others, its letter, or its place in the list ("the ${ORDINAL[at] ?? 'last'} one") all `
    + `count. ${quoted(others)} ${others.length > 1 ? 'are' : 'is'} wrong, and so is naming two choices or hedging between them.`;
}

/** A spoken item's known wrong answers, most specific first, with the tap's ids (the catalog's lists). */
export function reactionSpokenMisses(item: ReactionItem): KnownMiss[] {
  const c = item.challenge, form = answerForm(c);
  if (form === 'true_false') {
    const truth = c.correctBoolean === true;
    return [{ id: 'true_false_flipped', pattern: `The statement is ${truth ? 'true' : 'false'}. The learner's answer says it is ${truth ? 'false' : 'true'}.`,
      examples: truth ? ['false', 'no'] : ['true', 'yes'] }];
  }
  if (form === 'classify') {
    const key = keyValue(c)!, other = key === 'chemical' ? 'physical' : 'chemical';
    return [{ id: 'chemical_physical_swap', pattern: `This was a ${key} change. The learner's answer says it was a ${other} change.`,
      examples: [other, `${other} change`] }];
  }
  const key = stripEnd(keyLabel(c));
  const groups = new Map<ReactionMiss, string[]>();
  for (const x of itemChoices(c)) {
    if (x.value === keyValue(c)) continue;
    const m = choiceMiss(c, x.label);
    groups.set(m, [...(groups.get(m) ?? []), stripEnd(x.label)]);
  }
  const what: Record<ReactionMiss, (xs: string[]) => string> = {
    true_false_flipped: () => '',
    chemical_physical_swap: xs => `is ${quoted(xs)}, the other kind of change`,
    unbalanced_equation: xs => `is ${quoted(xs)}, an equation that is not balanced`,
    no_change: xs => `is ${quoted(xs)}, that nothing happens or changes`,
    other_choice: xs => `is ${quoted(xs)}`,
  };
  const order: ReactionMiss[] = ['chemical_physical_swap', 'unbalanced_equation', 'no_change', 'other_choice'];
  return order.filter(m => groups.has(m)).map(m => ({ id: m, pattern: `The right choice is "${key}". The learner's answer ${what[m](groups.get(m)!)}.`,
    examples: groups.get(m)!.slice(0, 6) }));
}

export function workspaceAssignment(item: ReactionItem): TeachingAssignment {
  const misses = reactionSpokenMisses(item);
  return { id: item.id, task: `${askOf(item)} The learner answers by saying it, or tapping one choice and pressing Check Answer.`,
    response: 'speech', acceptsGesture: true, expectedAnswer: reactionExpectedAnswer(item), ...(misses.length ? { misses } : {}) };
}

// ── What is on screen ─────────────────────────────────────────────────────

/**
 * The equation bar is hidden while a predict or balance challenge is open: it prints the products (a prediction's
 * answer) and the balanced equation (a balance answer).
 */
export const equationHidden = (c: Pick<ReactionChallenge, 'type'> | null | undefined, solved: boolean) =>
  !!c && !solved && (c.type === 'predict' || c.type === 'balance');

const EFFECT_WORDS: Record<string, string> = {
  bubbles: 'bubbles', foam: 'foam', colorShift: 'color shift', steamRise: 'steam rising', precipitate: 'precipitate',
  glow: 'glow', explosion: 'burst',
};
export const effectLabel = (effect: string) => EFFECT_WORDS[effect] ?? effect;

export interface ReactionView {
  /** The substances have been mixed and the reaction has run (it stays shown). */
  reactionRun: boolean;
  /** The beaker is animating now. */
  animating: boolean;
  choice: string | null;
  particleOpen: boolean;
  equationShown: boolean;
  showTemperature: boolean;
}

type Lab = Pick<ReactionLabData, 'experiment' | 'substances' | 'reaction' | 'animation'>;

/**
 * What is drawn and asked. The choices are named, never which is right. After the reaction the beaker's badges are
 * the observation itself, so they are named as drawn.
 */
export function workspaceScene(item: ReactionItem, view: ReactionView, lab: Lab): WorkspaceScene {
  const facts: Record<string, string> = {};
  const subs = (lab.substances ?? []).map(s => `${s.amount} of ${s.name} (${s.state}, ${s.color})`).join('; ');
  facts.experiment = `${lab.experiment.name}. Substances: ${subs}.`;
  if (item.stage === 'before') {
    facts.shown = 'The substances on the shelf, not mixed yet. The learner predicts before the experiment runs; the '
      + 'reaction is not shown until the predictions are done.';
  } else if (!view.reactionRun) {
    facts.shown = 'The substances, ready to mix. The question opens when the learner presses Mix Substances!';
  } else {
    const temp = view.showTemperature && lab.animation.realView.temperatureChange != null
      ? ` A badge beside the beaker reads ${lab.animation.realView.temperatureChange > 0 ? '+' : ''}${lab.animation.realView.temperatureChange}°.` : '';
    const energy = lab.reaction.energyChange === 'exothermic' ? ' Under the beaker: "Exothermic — released heat".'
      : lab.reaction.energyChange === 'endothermic' ? ' Under the beaker: "Endothermic — absorbed heat".' : '';
    facts.shown = `The reaction has run in the beaker${view.animating ? ' and is playing now' : ''}. Badges under the beaker: `
      + `${lab.animation.realView.effects.map(effectLabel).join(', ') || 'none'}.${temp}${energy}`
      + (view.particleOpen ? ` The particle view is open to the right of the beaker: reactants ${lab.animation.particleView.reactantMolecules.join(', ')}; `
        + `products ${lab.animation.particleView.productMolecules.join(', ')}; no caption.` : '');
  }
  if (view.equationShown && lab.reaction.equation) facts.equation = `The equation bar shows ${lab.reaction.equation}.`;
  if (item.stage === 'before' || view.reactionRun) {
    facts.question = askOf(item);
    facts.choices = itemChoices(item.challenge).map(x => `${x.letter}) ${x.label}`).join('  ');
    facts.learnerWork = describeReactionWork(item, view.choice);
  }
  facts.constraints = 'The learner answers by saying it, or by tapping one choice and pressing Check Answer; the activity '
    + 'judges the tap. You cannot tap, check, mix or point at a choice for the learner.';
  return { objects: [], facts };
}

/** The journey's answers: the key's label, and the wrong choice showing the most telling miss. */
export function reactionHarnessAnswers(item: ReactionItem): { correct: string; plainWrong: string } {
  const c = item.challenge;
  const rank: ReactionMiss[] = ['true_false_flipped', 'chemical_physical_swap', 'unbalanced_equation', 'no_change', 'other_choice'];
  const wrong = itemChoices(c).filter(x => x.value !== keyValue(c))
    .sort((a, b) => rank.indexOf(choiceMiss(c, a.label)) - rank.indexOf(choiceMiss(c, b.label)));
  return { correct: keyLabel(c), plainWrong: wrong[0]?.label ?? '' };
}
