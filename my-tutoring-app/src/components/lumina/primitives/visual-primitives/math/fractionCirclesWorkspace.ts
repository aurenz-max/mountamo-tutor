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
 * Pure: the component and any probe read the same assignment and scene.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { FractionCirclesChallenge } from './FractionCircles';
import type { FractionPicture, FractionTouchItem } from './fractionTouchScript';

// ── identify / build / compare / equivalent (plain surface) ─────────────────

export function workspaceAssignment(challenge: FractionCirclesChallenge): TeachingAssignment {
  return { id: challenge.id, task: challenge.instruction, response: 'gesture' };
}

/** What the learner has entered on the plain surface. */
export interface FractionCirclesView {
  typed: string;
  shaded: number;
  choice: 'left' | 'right' | 'equal' | '';
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
      if (challenge.showWorkingCount !== false) facts.learnerWork = describeWork(challenge, view);
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
      if (challenge.showWorkingCount !== false) facts.learnerWork = describeWork(challenge, view);
      facts.constraints = 'The learner shades slices on the second circle to show the same amount and presses Check. '
        + 'You cannot shade slices.';
      break;
  }
  return { objects: [], facts };
}

// ── touch_fraction (picture-touch surface) ──────────────────────────────────

/** The ask the tutor must say: the spoken fraction is the stimulus. Nothing about which picture matches. */
export function touchAssignment(item: FractionTouchItem): TeachingAssignment {
  return { id: item.id, task: item.actionContract.instruction, response: 'gesture' };
}

const pictureOf = (item: FractionTouchItem, choiceId: string): FractionPicture | undefined =>
  item.choices.find(c => c.id === choiceId);

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
      constraints: 'Three unlabelled shaded circles are shown and the fraction is not printed: say it. '
        + 'The learner touches one picture and the activity checks it.',
    },
  };
}
