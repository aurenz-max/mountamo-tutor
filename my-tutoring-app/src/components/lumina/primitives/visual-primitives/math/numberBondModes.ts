import type { JudgedRunOutcome, JudgedRunSummary } from '../../../hooks/useJudgedScriptRunner';
import { numberWordFor } from './countingBoardDomain';
import {
  BOND_TEN,
  bondEquationFaultOf,
  factFamilyForms,
  familyFormKeyFor,
  parseBondEquation,
  type BondFamilyForm,
  type BondModelAction,
  type NumberBondItem,
} from './numberBondDomain';
import type { BondMiss } from './numberBond.card';
import {
  expandSplitAndSay,
  hasPair,
  type BondCounters,
  type BondPair,
} from './numberBondSplit';

export type BondGroup = 'left' | 'right';

export interface BondActionEvidence {
  itemId: string;
  logicalId: string;
  expected: BondModelAction | 'choice';
  committed: BondModelAction | null;
  matched: boolean;
  modeled: boolean;
  before: BondCounters;
  after: BondCounters;
}

export interface BondEquationEvidence {
  itemId: string;
  logicalId: string;
  equation: string;
  arithmeticCorrect: boolean;
  usesBondNumbers: boolean;
  actionMatched: boolean;
  familyForm?: BondFamilyForm;
  assisted: boolean;
}

export const groupsForBond = (item: Pick<NumberBondItem, 'whole' | 'knownPart' | 'otherPart' | 'kind' | 'pairIndex'>): BondGroup[] => {
  // related-fact turn 2 swaps knownPart/otherPart for its spoken subtraction
  // ask. Token membership must not swap with those prompt roles.
  const originalLeft = item.kind === 'related-fact' && item.pairIndex === 1
    ? item.otherPart
    : item.knownPart;
  return Array.from({ length: item.whole }, (_, index) => index < originalLeft ? 'left' : 'right');
};

export const countersForParts = (
  item: Pick<NumberBondItem, 'whole' | 'knownPart' | 'otherPart' | 'kind' | 'pairIndex'>,
  swapped = false,
): BondCounters => groupsForBond(item).map((group) => {
  if (!swapped) return group;
  return group === 'left' ? 'right' : 'left';
});

export const countersForAction = (
  item: Pick<NumberBondItem, 'whole' | 'knownPart' | 'otherPart' | 'kind' | 'pairIndex'>,
  action: BondModelAction,
): BondCounters => {
  const groups = groupsForBond(item);
  switch (action) {
    case 'join': return groups.map(() => 'whole');
    case 'swap': return countersForParts(item, true);
    case 'separate-left': return groups.map((group) => group === 'left' ? 'left' : 'whole');
    case 'separate-right': return groups.map((group) => group === 'right' ? 'right' : 'whole');
  }
};

const uniformPlace = (
  counters: BondCounters,
  groups: readonly BondGroup[],
  group: BondGroup,
) => {
  const places = counters.filter((_, index) => groups[index] === group);
  return places.length > 0 && places.every((place) => place === places[0]) ? places[0] : null;
};

/** A complete group model has kept every token in its original group together.
 * Partial drags are exploration and deliberately return null. */
export const bondActionOf = (
  counters: BondCounters,
  groups: readonly BondGroup[],
): BondModelAction | null => {
  if (counters.length !== groups.length) return null;
  const left = uniformPlace(counters, groups, 'left');
  const right = uniformPlace(counters, groups, 'right');
  if (!left || !right) return null;
  if (left === 'whole' && right === 'whole') return 'join';
  if (left === 'right' && right === 'left') return 'swap';
  if (left === 'left' && right === 'whole') return 'separate-left';
  if (left === 'whole' && right === 'right') return 'separate-right';
  return null;
};

export const actionForFamilyForm = (form: BondFamilyForm): BondModelAction => {
  switch (form) {
    case 'add-left': return 'join';
    case 'add-right': return 'swap';
    case 'subtract-left': return 'separate-left';
    case 'subtract-right': return 'separate-right';
  }
};

const runtimePair = (
  item: NumberBondItem,
  actionPhase: NumberBondItem['interactionPhase'],
  responsePhase: NumberBondItem['interactionPhase'],
  action: BondModelAction,
): NumberBondItem[] => [
  {
    ...item,
    id: `${item.id}::model`,
    logicalId: item.id,
    interactionPhase: actionPhase,
    bondAction: action,
    answerKind: 'gesture',
    responseClass: 'manipulation',
    action: actionPhase,
  },
  {
    ...item,
    id: `${item.id}::response`,
    logicalId: item.id,
    interactionPhase: responsePhase,
    bondAction: action,
    action: responsePhase,
  },
];

/** Source challenges and mounted runtime share this one expansion. */
export const expandNumberBondInteractions = (sourceItems: NumberBondItem[]): NumberBondItem[] =>
  expandSplitAndSay(sourceItems).flatMap((item) => {
    if (item.splitPhase) return [item];
    if (item.kind === 'missing-part') {
      return [{ ...item, logicalId: item.id, interactionPhase: 'missing-infer' }];
    }
    if (item.kind === 'related-fact') {
      return runtimePair(
        item,
        item.pairIndex === 0 ? 'related-join' : 'related-separate',
        item.pairIndex === 0 ? 'related-say-addend' : 'related-say-remainder',
        item.pairIndex === 0 ? 'join' : 'separate-right',
      );
    }
    if (item.kind === 'build-equation') {
      return runtimePair(item, 'equation-model', 'equation-build', 'join').map((phase) => (
        phase.interactionPhase === 'equation-build'
          ? { ...phase, answerKind: 'gesture', responseClass: 'manipulation' }
          : { ...phase, bondAction: undefined }
      ));
    }
    if (item.kind === 'fact-family') {
      return factFamilyForms(item.knownPart, item.otherPart).flatMap((form) => {
        const action = actionForFamilyForm(form);
        const logicalId = item.id;
        const suffix = form.replace(/[^a-z]/g, '');
        return [
          {
            ...item,
            id: `${item.id}::${suffix}::model`,
            logicalId,
            interactionPhase: 'family-model' as const,
            familyForm: form,
            bondAction: action,
            answerKind: 'gesture' as const,
            responseClass: 'manipulation' as const,
            action: `family-${form}-model`,
          },
          {
            ...item,
            id: `${item.id}::${suffix}::equation`,
            logicalId,
            interactionPhase: 'family-build' as const,
            familyForm: form,
            bondAction: action,
            answerKind: 'gesture' as const,
            responseClass: 'manipulation' as const,
            action: `family-${form}-equation`,
          },
        ];
      });
    }
    return [item];
  });

export const initialCountersForInteraction = (item: NumberBondItem): BondCounters => {
  if (item.interactionPhase === 'related-say-addend') return countersForAction(item, 'join');
  if (item.interactionPhase === 'related-separate' || item.interactionPhase === 'related-say-remainder') {
    return item.interactionPhase === 'related-separate'
      ? countersForAction(item, 'join')
      : countersForAction(item, 'separate-right');
  }
  if (item.interactionPhase === 'family-model') {
    return item.bondAction === 'join' || item.bondAction === 'swap'
      ? countersForParts(item)
      : countersForAction(item, 'join');
  }
  if (item.interactionPhase === 'family-build' && item.bondAction) return countersForAction(item, item.bondAction);
  return countersForParts(item);
};

export const relatedQuestion = (item: NumberBondItem, counters: BondCounters) => {
  const groups = groupsForBond(item);
  const count = (group: BondGroup, place: BondCounters[number]) => counters.reduce(
    (total, current, index) => total + (current === place && groups[index] === group ? 1 : 0),
    0,
  );
  if (item.interactionPhase === 'related-say-remainder') {
    const removed = count('right', 'right');
    const answer = count('left', 'whole');
    return {
      answer,
      answerGroup: 'left' as const,
      ask: `${numberWordFor(item.whole)} take away ${numberWordFor(removed)} leaves how many?`,
    };
  }
  const known = count('left', 'whole');
  const answer = count('right', 'whole');
  return {
    answer,
    answerGroup: 'right' as const,
    ask: `${numberWordFor(known)} and how many make ${numberWordFor(item.whole)}?`,
  };
};

export type FamilyEquationFault = 'match' | 'incomplete' | 'arithmetic' | 'numbers' | 'form';

export const familyEquationFaultOf = (item: NumberBondItem, equation: string): FamilyEquationFault => {
  const parsed = parseBondEquation(equation, item.whole, item.knownPart, item.otherPart);
  if (!parsed) return 'incomplete';
  if (!parsed.valid) return 'arithmetic';
  if (!parsed.usesCorrectNumbers) return 'numbers';
  if (!item.familyForm || parsed.familyFormKey !== familyFormKeyFor(item.familyForm, item.whole, item.knownPart, item.otherPart)) return 'form';
  return 'match';
};

/** What a wrong split, move or equation shows (`bondMiss`): the card names them (`BondMiss`). Undefined for right
 * work and for the spoken phases. */
export type { BondMiss } from './numberBond.card';

export type BondWork =
  | { split: { left: number; right: number; unplaced: number }; found: readonly BondPair[] }
  | { move: BondModelAction | null; matched: boolean }
  | { tiles: readonly string[]; action?: BondModelAction };

const EQUATION_MISS = { incomplete: 'unfinished_equation', arithmetic: 'false_equation', numbers: 'other_numbers',
  action: 'other_fact', form: 'other_fact' } as const;

export function bondMiss(item: NumberBondItem | null, work: BondWork): BondMiss | undefined {
  if (!item || item.answerKind !== 'gesture') return undefined;
  if ('move' in work) return work.matched || !work.move ? undefined : 'other_move';
  if ('tiles' in work) {
    const fault = item.interactionPhase === 'family-build' ? familyEquationFaultOf(item, work.tiles.join(''))
      : bondEquationFaultOf(item, work.tiles, work.action);
    return fault === 'match' ? undefined : EQUATION_MISS[fault];
  }
  const { left, right, unplaced } = work.split;
  if (unplaced > 0 || left + right !== item.whole) return 'not_all_placed';
  if (item.kind === 'ten-and-ones') {
    if (left === BOND_TEN || right === BOND_TEN) return undefined;
    return [left, right].some(n => Math.abs(n - BOND_TEN) === 1) ? 'ten_one_off' : 'no_full_ten';
  }
  return hasPair(work.found, [Math.min(left, right), Math.max(left, right)]) ? 'same_way_again' : undefined;
}

const outcomeFor = (summary: JudgedRunSummary, id: string) => summary.outcomes.find((outcome) => outcome.id === id);
const secondsTotal = (outcomes: Array<JudgedRunOutcome | undefined>): number | null => {
  const seconds = outcomes.flatMap((outcome) => outcome?.seconds == null ? [] : [outcome.seconds]);
  return seconds.length ? seconds.reduce((sum, value) => sum + value, 0) : null;
};

/** Collapse activity phases back into the existing mastery units. */
export const numberBondInteractionSummary = (
  items: NumberBondItem[],
  raw: JudgedRunSummary,
): JudgedRunSummary => {
  const outcomes: JudgedRunOutcome[] = [];
  const handledFamilies = new Set<string>();

  for (const item of items) {
    if (item.splitPhase === 'build' || item.interactionPhase?.endsWith('model')
      || item.interactionPhase === 'related-join' || item.interactionPhase === 'related-separate') continue;

    const own = outcomeFor(raw, item.id);
    if (item.splitPhase === 'say') {
      if (!own) continue;
      const build = outcomeFor(raw, item.id.replace(/::say$/, '::build'));
      outcomes.push({
        ...own,
        solved: own.solved && !!build?.solved,
        score: Math.min(own.score, build?.score ?? 0),
        corrections: own.corrections + (build?.corrections ?? 0),
        seconds: secondsTotal([build, own]),
      });
      continue;
    }

    if (item.interactionPhase === 'family-build') {
      const logicalId = item.logicalId ?? item.sourceId;
      if (handledFamilies.has(logicalId)) continue;
      handledFamilies.add(logicalId);
      const familyItems = items.filter((candidate) => candidate.logicalId === logicalId && candidate.interactionPhase === 'family-build');
      const familyOutcomes = familyItems.map((candidate) => outcomeFor(raw, candidate.id));
      const score = Math.round(familyOutcomes.reduce((sum, outcome) => sum + (outcome?.score ?? 0), 0) / familyItems.length);
      outcomes.push({
        id: logicalId,
        solved: familyOutcomes.length === familyItems.length && familyOutcomes.every((outcome) => outcome?.solved),
        score,
        corrections: familyOutcomes.reduce((sum, outcome) => sum + (outcome?.corrections ?? 0), 0),
        seconds: secondsTotal(familyOutcomes),
      });
      continue;
    }

    if (!own) continue;
    if (item.interactionPhase === 'related-say-addend' || item.interactionPhase === 'related-say-remainder'
      || item.interactionPhase === 'equation-build') {
      outcomes.push({ ...own, id: item.logicalId ?? item.sourceId });
    } else {
      outcomes.push(own);
    }
  }

  const accuracy = outcomes.length
    ? Math.round(outcomes.reduce((sum, outcome) => sum + outcome.score, 0) / outcomes.length)
    : 0;
  return {
    ...raw,
    outcomes,
    accuracy,
    passed: outcomes.length > 0 && outcomes.every((outcome) => outcome.solved),
    solvedCount: outcomes.filter((outcome) => outcome.solved).length,
    firstTryCount: outcomes.filter((outcome) => outcome.score === 100).length,
    attemptsCount: outcomes.reduce((sum, outcome) => sum + 1 + outcome.corrections, 0),
  };
};

export const equationEvidenceFor = (
  item: NumberBondItem,
  tiles: readonly string[],
  action: BondModelAction | undefined,
  assisted: boolean,
): BondEquationEvidence => {
  const equation = tiles.join('');
  const parsed = parseBondEquation(equation, item.whole, item.knownPart, item.otherPart);
  return {
    itemId: item.id,
    logicalId: item.logicalId ?? item.sourceId,
    equation,
    arithmeticCorrect: !!parsed?.valid,
    usesBondNumbers: !!parsed?.usesCorrectNumbers,
    actionMatched: item.familyForm
      ? familyEquationFaultOf(item, equation) === 'match'
      : bondEquationFaultOf(item, tiles, action) === 'match',
    familyForm: item.familyForm,
    assisted,
  };
};
