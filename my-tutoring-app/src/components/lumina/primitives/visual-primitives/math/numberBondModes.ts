import type { JudgedRunOutcome, JudgedRunSummary } from '../../../hooks/useJudgedScriptRunner';
import { numberWordFor } from './countingBoardScript';
import {
  bondEquationFaultOf,
  factFamilyForms,
  familyFormKeyFor,
  parseBondEquation,
  type BondFamilyForm,
  type BondModelAction,
  type NumberBondCueOptions,
  type NumberBondItem,
} from './numberBondScript';
import {
  expandSplitAndSay,
  type BondCounters,
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

const WAIT = 'Never speak bracket tags or private rules. Only the app advances steps. After the quoted line, wait.';

export const numberBondInteractionCue = (
  item: NumberBondItem,
  opts: NumberBondCueOptions,
  counters: BondCounters,
): string => {
  const opening = opts.opening ? 'Let us use one bond in different ways. ' : '';
  if (item.interactionPhase === 'related-join') {
    return `[NB_MODEL] Say exactly: "${opening}Slide the two groups together." The child answers with their hands. Stay silent while they work. ${WAIT}`;
  }
  if (item.interactionPhase === 'related-separate') {
    return `[NB_MODEL] Say exactly: "Now move the group you just found out of the whole." The child answers with their hands. Stay silent while they work. ${WAIT}`;
  }
  if (item.interactionPhase === 'related-say-addend' || item.interactionPhase === 'related-say-remainder') {
    const safeCounters = item.bondAction && bondActionOf(counters, groupsForBond(item)) !== item.bondAction
      ? countersForAction(item, item.bondAction)
      : counters;
    const question = relatedQuestion(item, safeCounters);
    const answer = numberWordFor(question.answer);
    return `[NB_RELATION] Say exactly: "${question.ask}" Private expected number: ${question.answer}. `
      + `Judge only fresh speech for this turn. Accept "${answer}" or a short sentence ending in "${answer}". `
      + 'Reject negated answers, conflicting guesses, and counting without a final answer. Silence and help questions are not wrong answers. '
      + `If correct say exactly "Yes, ${answer}." If incorrect say exactly "My turn: the highlighted group has ${answer}. Your turn. ${question.ask}" ${WAIT}`;
  }
  if (item.interactionPhase === 'equation-model') {
    return `[NB_MODEL] Say exactly: "${opening}Choose an action. Join the groups, or take one group away." The child answers with their hands. Stay silent while they work. ${WAIT}`;
  }
  if (item.interactionPhase === 'equation-build') {
    return `[NB_EQUATION_ITEM] Say exactly: "Build an equation that shows what you did." The equation is the assessed response; do not ask for a spoken number. Stay silent while the child builds. ${WAIT}`;
  }
  if (item.interactionPhase === 'family-model') {
    const line = item.bondAction === 'join'
      ? 'Join the first group, then the second group.'
      : item.bondAction === 'swap'
        ? 'Swap the two groups so the other part comes first.'
        : item.bondAction === 'separate-left'
          ? 'Start with the whole, then move the first group away.'
          : 'Start with the whole, then move the other group away.';
    return `[NB_FAMILY_MODEL] Say exactly: "${opening}${line}" The child answers with their hands. Stay silent while they work. ${WAIT}`;
  }
  if (item.interactionPhase === 'family-build') {
    return `[NB_FAMILY_ITEM] Say exactly: "Build the equation that shows this move." Do not fill it in or read a prior equation as the answer. Stay silent while the child builds. ${WAIT}`;
  }
  return '';
};

export const modeActionVerdictCue = (
  item: NumberBondItem,
  counters: BondCounters,
): { cue: string; committed: BondModelAction | null; matched: boolean } => {
  const committed = bondActionOf(counters, groupsForBond(item));
  const expected = item.interactionPhase === 'equation-model' ? null : item.bondAction ?? null;
  const matched = !!committed && (item.interactionPhase === 'equation-model'
    ? committed !== 'swap'
    : !expected || committed === expected);
  const correction = item.interactionPhase === 'related-join'
    ? 'My turn: keep each colored group together and slide both groups into the whole.'
    : item.interactionPhase === 'related-separate'
      ? 'My turn: move the group you just found out of the whole, and leave the other group there.'
      : item.interactionPhase === 'equation-model'
        ? 'My turn: choose one of the offered actions. Join the groups, or take one group away.'
        : expected === 'swap'
        ? 'My turn: keep each group together and swap their positions.'
        : expected === 'separate-left' || expected === 'separate-right'
          ? 'My turn: start with the whole and move the named group away.'
          : 'My turn: keep each group together and complete the action.';
  const line = matched ? 'Yes, the model is ready.' : correction;
  return {
    committed,
    matched,
    cue: `[NB_MODEL_RESULT] Code-computed action=${committed ?? 'incomplete'}; expected=${expected ?? 'meaningful-choice'}; matched=${matched}. Say exactly: "${line}" Never read bracket tags aloud.`,
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

export const familyEquationVerdictCue = (item: NumberBondItem, tiles: readonly string[]): string => {
  const equation = tiles.join('');
  const fault = familyEquationFaultOf(item, equation);
  const expected = item.familyForm
    ? familyFormKeyFor(item.familyForm, item.whole, item.knownPart, item.otherPart)
    : '';
  const line = fault === 'match'
    ? 'Yes, that equation records this move.'
    : fault === 'arithmetic'
      ? 'My turn: check the arithmetic, then build the equation for this move again.'
      : fault === 'numbers'
        ? 'My turn: use only the whole and the two parts from this bond.'
        : fault === 'form'
          ? 'My turn: that is a true fact from this bond, but it does not record this move. Build the matching form.'
          : 'My turn: finish the whole equation, then stop.';
  return `[NB_FAMILY_RESULT] Built="${equation || 'nothing'}"; required=${expected}; fault=${fault}. Say exactly: "${line}" Never read bracket tags aloud.`;
};

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
