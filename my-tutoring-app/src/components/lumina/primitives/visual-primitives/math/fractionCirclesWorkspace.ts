/**
 * Fraction circles on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch B1).
 *
 * Two surfaces, one family. identify/build/compare/equivalent are the plain surface's
 * own Check; touch_fraction is the picture-touch surface, where the tutor says the
 * fraction and the learner touches one of three unlabelled circles. Every item is a
 * gesture checked by code, so no key reaches the tutor: not the typed fraction, not
 * the larger circle, not the matching picture.
 *
 * Pure: the component, the generator, the live adapter and any probe read the same items,
 * assignment and scene.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { DiActionContract, JudgedScriptItem } from '../../../hooks/judgedScriptContract';
import type { FractionCirclesChallenge } from './FractionCircles';
import { fractionTouchPlan } from './fractionTouchModes';
import { COUNT_LEVER, TWO_PICTURES_LEVER, leverFacts } from './fractionCirclesLevers';
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';

// ── identify / build / compare / equivalent (plain surface) ─────────────────

export function workspaceAssignment(challenge: FractionCirclesChallenge): TeachingAssignment {
  return { id: challenge.id, task: challenge.instruction, response: 'gesture' };
}

/** What the learner has entered on the plain surface. */
export interface FractionCirclesView {
  typed: string;
  shaded: number;
  choice: 'left' | 'right' | 'equal' | '';
  /** Levers on screen for this item, pulled at runtime or from the start. */
  levers?: readonly string[];
  /** An easier practice item stands in for the item (a simplify lever). */
  practice?: boolean;
}

const CHOICE_WORDS = { left: 'the left circle is larger', right: 'the right circle is larger', equal: 'they are equal' } as const;

/** The learner's checked work, in their terms. Never the key. */
export function describeWork(challenge: FractionCirclesChallenge, view: FractionCirclesView): string {
  switch (challenge.type) {
    case 'identify': return `Typed ${view.typed.trim() || 'nothing'}`;
    case 'compare': return view.choice ? `Chose: ${CHOICE_WORDS[view.choice]}` : 'Chose nothing';
    case 'equivalent': return `Shaded ${view.shaded} of ${challenge.equivalentDenominator} slices`;
    default: return `Shaded ${view.shaded} of ${challenge.denominator} slices`;
  }
}

export function workspaceScene(challenge: FractionCirclesChallenge, view: FractionCirclesView): WorkspaceScene {
  const facts: Record<string, string | number> = { kind: challenge.type };
  // The running count is a lever: the learner's own tally reaches the tutor only while it is on screen.
  const countShown = (view.levers ?? []).includes(COUNT_LEVER);
  switch (challenge.type) {
    case 'identify':
      // The shaded circle is the question; only its printed captions are facts here.
      if (challenge.showTotalPieces !== false) facts.printedCaption = `${challenge.denominator} equal pieces`;
      facts.learnerWork = describeWork(challenge, view);
      facts.constraints = 'A circle is drawn with some slices shaded. The learner types the fraction (like 1/2) and presses Check; '
        + 'the circle checks it. You cannot type or shade.';
      break;
    case 'build':
      facts.printedTarget = `${challenge.numerator}/${challenge.denominator}`;
      facts.slices = challenge.denominator;
      if (countShown) facts.learnerWork = describeWork(challenge, view);
      facts.constraints = 'The learner taps slices to shade them and presses Check. You cannot shade slices.';
      break;
    case 'compare':
      // With labels withdrawn the comparison is by area alone, so the values stay off the packet too.
      if (challenge.showFractionLabels !== false && challenge.compareFraction) {
        facts.printedLeft = `${challenge.numerator}/${challenge.denominator}`;
        facts.printedRight = `${challenge.compareFraction.numerator}/${challenge.compareFraction.denominator}`;
      } else facts.labels = 'hidden: compare the shaded area only';
      facts.learnerWork = describeWork(challenge, view);
      facts.constraints = 'Two shaded circles are drawn. The learner picks left larger, equal, or right larger and presses Check. '
        + 'You cannot choose for them.';
      break;
    case 'equivalent':
      facts.printedReference = `${challenge.numerator}/${challenge.denominator}`;
      facts.buildSlices = challenge.equivalentDenominator ?? 0;
      if (countShown) facts.learnerWork = describeWork(challenge, view);
      facts.constraints = 'The learner shades slices on the second circle to show the same amount and presses Check. '
        + 'You cannot shade slices.';
      break;
  }
  const onScreen = leverFacts(challenge, view.levers ?? []);
  if (onScreen.length) facts.onScreen = onScreen.join(' ');
  if (view.practice) facts.practice = 'An easier practice item is on screen in place of the item. It is not graded; the full item comes back after it.';
  return { objects: [], facts };
}

// ── touch_fraction (picture-touch surface) ──────────────────────────────────

/** The answer is a pictured amount, not its name (which is already in the ask). A single touch
 * closes the gesture and code owns the verdict. All choices remain available on every retry. */
export interface FractionPicture { id: string; numerator: number; denominator: number; shaded: number[] }
export interface FractionTouchItem extends JudgedScriptItem {
  challengeType: 'touch_fraction'; numerator: number; denominator: number;
  actionContract: DiActionContract; choices: FractionPicture[]; correctChoiceId: string;
}
const shuffle = <T,>(values: T[], random: () => number): T[] => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
/** Three distinct pictures per touch_fraction challenge; throws on a target the pictures cannot show. */
export function buildFractionTouchItems(challenges: readonly FractionCirclesChallenge[], random = Math.random): FractionTouchItem[] {
  return challenges.filter(c => c.type === 'touch_fraction').map(c => {
    if (![2, 3, 4].includes(c.denominator) || !Number.isInteger(c.numerator) || c.numerator < 1 || c.numerator >= c.denominator) {
      throw new Error(`Invalid touch_fraction target ${c.id}: ${c.numerator}/${c.denominator}`);
    }
    const target = { id: c.id, challengeType: 'touch_fraction' as const, numerator: c.numerator, denominator: c.denominator };
    // Same-denominator near miss first; another denominator prevents counting
    // shaded pieces alone from solving all unit-fraction items.
    const pool = [2, 3, 4].flatMap(d => Array.from({ length: d - 1 }, (_, i) => ({ numerator: i + 1, denominator: d })))
      .filter(f => f.numerator * c.denominator !== c.numerator * f.denominator);
    const same = shuffle(pool.filter(f => f.denominator === c.denominator), random)[0];
    const different = shuffle(pool.filter(f => f.denominator !== c.denominator), random);
    const first = same ?? different[0];
    const second = different.find(f => f.numerator * first.denominator !== first.numerator * f.denominator)!;
    const wrong = [first, second];
    const choices = shuffle([target, ...wrong], random).map((f, index) => ({
      id: `${c.id}-picture-${index}`, numerator: f.numerator, denominator: f.denominator,
      shaded: shuffle(Array.from({ length: f.denominator }, (_, i) => i), random).slice(0, f.numerator),
    }));
    const correctChoiceId = choices.find(f => f.numerator * c.denominator === c.numerator * f.denominator)!.id;
    const plan = fractionTouchPlan(target);
    return { ...target, answerKind: 'gesture', responseClass: 'manipulation', action: 'touch_fraction',
      actionContract: plan.answerStep.actionContract, choices, correctChoiceId };
  });
}

/** The ask the tutor must say: the spoken fraction is the stimulus. Nothing about which picture matches. */
export function touchAssignment(item: FractionTouchItem): TeachingAssignment {
  return { id: item.id, task: item.actionContract.instruction, response: 'gesture' };
}

const pictureOf = (item: FractionTouchItem, choiceId: string): FractionPicture | undefined =>
  item.choices.find(c => c.id === choiceId);

/**
 * What a wrong touch shows, by the kind of picture touched, never which one (`TeachingAttempt.miss`):
 * `same_parts_other_shading` (as many equal parts as the fraction, a different amount shaded),
 * `same_shading_other_parts` (as many shaded parts, cut into a different number), `other_fraction`.
 */
export type TouchMiss = 'same_parts_other_shading' | 'same_shading_other_parts' | 'other_fraction';

export function touchMiss(item: FractionTouchItem, choiceId: string): TouchMiss | undefined {
  const picture = pictureOf(item, choiceId);
  if (!picture || touchMatches(item, choiceId)) return undefined;
  if (picture.denominator === item.denominator) return 'same_parts_other_shading';
  return picture.numerator === item.numerator ? 'same_shading_other_parts' : 'other_fraction';
}

/** Code's verdict on a touch: the touched picture shows the same amount as the spoken fraction. */
export function touchMatches(item: FractionTouchItem, choiceId: string): boolean {
  const picture = pictureOf(item, choiceId);
  return !!picture && picture.numerator * item.denominator === item.numerator * picture.denominator;
}

/** The touch as the tutor and the observer read it: which picture and what it shows. */
export function describeTouch(item: FractionTouchItem, choiceId: string): string {
  const index = item.choices.findIndex(c => c.id === choiceId);
  const picture = item.choices[index];
  return picture ? `Touched picture ${index + 1}, which shows ${picture.numerator} of ${picture.denominator} equal parts shaded`
    : 'Touched a picture';
}

export function touchScene(item: FractionTouchItem): WorkspaceScene {
  return {
    objects: [],
    facts: {
      kind: 'touch_fraction',
      pictures: item.choices.length,
      constraints: `${item.choices.length === 2 ? 'Two' : 'Three'} unlabelled shaded circles are shown and the fraction is not printed: say it. `
        + 'The learner touches one picture and the activity checks it.',
      ...(item.id.endsWith('~two') ? { practice: 'An easier practice item is on screen in place of the item: another fraction, two pictures. '
        + 'It is not graded; the full item comes back after it.' } : {}),
    },
  };
}

/**
 * `two_pictures` (simplify): another fraction to touch, with two pictures, the match and a far picture
 * with a different number of parts. Never the learner's fraction or an equal amount, so the full item's
 * match is not rehearsed. Deterministic, so the live journey can rebuild it from its parent.
 */
export function twoPictureItem(item: FractionTouchItem): FractionTouchItem | null {
  const same = (a: number, b: number) => a * item.denominator === item.numerator * b;
  const pick = ([[1, 2], [1, 4], [3, 4], [1, 3], [2, 3]] as const).find(([n, d]) => !same(n, d));
  if (!pick) return null;
  const [numerator, denominator] = pick;
  const foil = [2, 3, 4].filter(d => d !== denominator)
    .flatMap(d => Array.from({ length: d - 1 }, (_, i) => ({ numerator: i + 1, denominator: d })))
    .sort((x, y) => Math.abs(y.numerator / y.denominator - numerator / denominator)
      - Math.abs(x.numerator / x.denominator - numerator / denominator))[0];
  const id = `${item.id}~two`;
  const target = { id, challengeType: 'touch_fraction' as const, numerator, denominator };
  const match = { numerator, denominator }, pair = (item.numerator + item.denominator) % 2 ? [foil, match] : [match, foil];
  const choices = pair.map((f, index) => ({ id: `${id}-picture-${index}`, numerator: f.numerator, denominator: f.denominator,
    shaded: Array.from({ length: f.numerator }, (_, i) => i) }));
  return { ...target, answerKind: 'gesture', responseClass: 'manipulation', action: 'touch_fraction',
    actionContract: fractionTouchPlan(target).answerStep.actionContract, choices,
    correctChoiceId: choices[pair.indexOf(match)].id };
}

export function touchLevers(item: FractionTouchItem | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!item || item.choices.length < 3 || !twoPictureItem(item)) return [];
  return [{ id: TWO_PICTURES_LEVER, kind: 'simplify', carrier: 'shown', pulled: pulled.includes(TWO_PICTURES_LEVER),
    answers: ['same_parts_other_shading', 'same_shading_other_parts', 'other_fraction'],
    when: 'The learner picks a picture with the right number of parts but the wrong amount shaded, or cannot choose among three.',
    does: 'Opens an easier touch first: another fraction, two pictures far apart. It is not graded; the full item comes back after it.' }];
}
