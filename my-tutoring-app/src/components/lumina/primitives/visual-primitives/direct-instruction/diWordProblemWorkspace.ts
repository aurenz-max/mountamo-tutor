/**
 * di-word-problem-setup on the shared tutor/JEV teaching workspace (rollout C6). A printed story is set
 * up one step at a time: name the story kind (spoken), place the big amount or build the whole family
 * with the story-part cards (hands; the activity checks it), read the family, choose add or subtract,
 * and solve (spoken). Pure: the component and the journey read the same assignment and scene.
 *
 * What the scripted judging contracts carried that is task structure stays in the keys: the three story
 * kinds and each kind's signature error, a family judged on the right numbers in the right slots in any
 * wording (the small numbers in either order, the box said as box, a solved box counts), the big number in
 * a small slot as the signature error, the operation decided by the family rather than the story's verb,
 * and the wrong-way answer. The hands step is checked in code: only which card sits in the big slot
 * decides it, exactly as `bigNumberVerdictCue` did.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import {
  familyAsSubtraction, familyMisplaced, familySolved, familySpoken, familySpokenSwapped, numberWord as w,
  SHAPE_WORD, STORY_SHAPES, wrongWayAnswer, type FamilySlot, type WordProblemPlan,
} from './diWordProblemPlan';
import { itemsFromProblems, type DiWordProblemSetupData, type WordProblemItem } from './diWordProblemScript';
import { numberMisses, offByMisses, spokenNumber, type KnownMiss, type OffByMiss } from '../../../components/live-activity/runtime/spokenMissContract';

export type FamilyPlacements = Record<FamilySlot, string | null>;

/** The steps a payload asks, built by the one builder the generator and the drive harness use. */
export const wordProblemItems = (data: Pick<DiWordProblemSetupData, 'problems'>): WordProblemItem[] =>
  itemsFromProblems(data.problems ?? []).items;

/** The step's own question; the story is printed above it. Never the answer. */
export const wordProblemAskFor = (item: WordProblemItem): string => item.actionContract.instruction;

const quoted = (words: readonly string[]) => words.map(word => `"${word}"`).join(', ');
const boxRole = (plan: WordProblemPlan) => (plan.unknown.slot === 'big' ? 'the big number' : 'a small number');
const SHAPE_WHY: Record<WordProblemPlan['shape'], string> = {
  comparison: 'it compares two amounts', change: 'it starts with an amount that changes', part_whole: 'two parts make one whole',
};

export function wordProblemKey(item: WordProblemItem): string | undefined {
  const p = item.plan;
  switch (item.kind) {
    case 'classify': {
      const variants = p.shape === 'comparison' ? ['comparison', 'compare', 'a compare problem']
        : p.shape === 'change' ? ['change', 'a change problem', 'changing'] : ['part-whole', 'part whole', 'parts and whole'];
      const others = STORY_SHAPES.filter(shape => shape !== p.shape).map(shape => `"${SHAPE_WORD[shape]}"`).join(' or ');
      const signature = p.shape === 'change'
        ? `Taking the kind from the last sentence ("${p.verbCueWord}" sounds like a comparison) is the signature error.`
        : p.shape === 'comparison'
          ? 'Calling it a change problem because a sentence says "has" is the signature error: nothing changes.'
          : 'Calling it a comparison because two kinds are named is the signature error: nothing is compared.';
      return `"${SHAPE_WORD[p.shape]}" (${quoted(variants)}, alone or in a sentence), because ${SHAPE_WHY[p.shape]}. `
        + `${others} is wrong. ${signature}`;
    }
    case 'big_number':
      return undefined; // checked by the activity
    case 'family': {
      const subtraction = familyAsSubtraction(p);
      return `The family "${familySpoken(p)}" (or "${familySpokenSwapped(p)}"), in any wording that puts the right numbers in `
        + 'the right slots: "and" for plus, "makes" or "is" for equals, "box", "blank" or "what" for the unknown. Said in '
        + `pieces still counts, and so does the solved number in the box's place ("${familySolved(p)}"). The big number `
        + `in a small slot ("${familyMisplaced(p)}") is the signature error${subtraction ? `; a subtraction sentence ("${subtraction}") `
          + 'is arithmetic, not the family' : ''}; a family with a number missing is not yet the answer.`;
    }
    case 'operation': {
      const words = p.operation === 'add' ? ['add', 'plus', 'put them together'] : ['subtract', 'minus', 'take away'];
      const verb = p.verbCueOperation !== p.operation
        ? ` The story's word "${p.verbCueWord}" sounds like ${p.verbCueOperation}; taking the operation from it is the signature error.` : '';
      return `"${p.operation}" (${quoted(words)}), because the box is ${boxRole(p)} in "${familySpoken(p)}".${verb}`;
    }
    case 'solve':
      return `"${w(p.answer)}": the bare number or a sentence like "${p.answerSentence}", straight away or after counting. `
        + `${w(wrongWayAnswer(p))} is the story numbers combined the wrong way.`;
  }
}

/** What a wrong spoken step shows (handoff 20 Part B). */
export type SpokenWordProblemMiss = OffByMiss | 'signature_kind' | 'other_kind' | 'big_in_small_slot' | 'subtraction_sentence'
  | 'opposite_operation' | 'wrong_way' | 'said_story_number';

/** The story kind a child most often names instead: the one the scripted key calls the signature error. */
const SIGNATURE_KIND: Record<WordProblemPlan['shape'], WordProblemPlan['shape']> = {
  change: 'comparison', comparison: 'change', part_whole: 'comparison',
};

/**
 * A spoken step's known wrong answers, in precedence order, for the `spoken_miss` observer: the story's own kinds,
 * family and numbers stated first, then the learner's words. Concrete per story, never a cause. The hands step
 * (`big_number`) names none here: `wordProblemMiss` checks it.
 */
export function wordProblemSpokenMisses(item: WordProblemItem): KnownMiss[] {
  const p = item.plan;
  switch (item.kind) {
    case 'classify': {
      const fact = `This story is a ${SHAPE_WORD[p.shape]} story.`;
      const signature = SIGNATURE_KIND[p.shape], other = STORY_SHAPES.find(s => s !== p.shape && s !== signature)!;
      return [
        { id: 'signature_kind', pattern: `${fact} The learner's answer is ${SHAPE_WORD[signature]}.`, examples: [SHAPE_WORD[signature]] },
        { id: 'other_kind', pattern: `${fact} The learner's answer is ${SHAPE_WORD[other]}.`, examples: [SHAPE_WORD[other]] },
      ];
    }
    case 'family': {
      const subtraction = familyAsSubtraction(p);
      const fact = `The story's family is "${familySpoken(p)}".`;
      return [
        { id: 'big_in_small_slot', pattern: `${fact} The learner says "${familyMisplaced(p)}", the big number in a small slot.`, examples: [familyMisplaced(p)] },
        ...(subtraction ? [{ id: 'subtraction_sentence', pattern: `${fact} The learner says a subtraction, "${subtraction}", instead of the family.`,
          examples: [subtraction] }] : []),
      ];
    }
    case 'operation': {
      const wrong = p.operation === 'add' ? 'subtract' : 'add';
      return [{ id: 'opposite_operation', pattern: `The box is ${boxRole(p)} in "${familySpoken(p)}", so the operation is ${p.operation}. `
        + `The learner's answer is ${wrong}.`, examples: [wrong, wrong === 'add' ? 'plus' : 'minus'] }];
    }
    case 'solve': {
      const known = p.quantities.filter(x => x.known).map(x => x.value);
      const fact = `The story's numbers are ${known.join(' and ')}; the answer is ${p.answer}.`;
      const wrongWay = numberMisses(p.answer, [{ id: 'wrong_way', value: wrongWayAnswer(p),
        pattern: v => `${fact} The learner's answer is ${v}, the two numbers ${p.operation === 'add' ? 'subtracted' : 'added'}.` }]);
      const printed = Array.from(new Set(known)).filter(v => v >= 1 && v !== p.answer && v !== wrongWayAnswer(p));
      return [...wrongWay,
        ...(printed.length ? [{ id: 'said_story_number', pattern: `${fact} The learner's answer is ${printed.join(' or ')}, a number printed in the story.`,
          examples: printed.map(spokenNumber) }] : []),
        ...offByMisses(p.answer, `the answer ${p.answer}`)];
    }
    default: return [];
  }
}

export function wordProblemAssignment(item: WordProblemItem): TeachingAssignment {
  const key = wordProblemKey(item);
  const misses = key === undefined ? [] : wordProblemSpokenMisses(item);
  return key === undefined
    ? { id: item.id, task: wordProblemAskFor(item), response: 'gesture' }
    : { id: item.id, task: wordProblemAskFor(item), response: 'speech', expectedAnswer: key, ...(misses.length ? { misses } : {}) };
}

/** The hands step's check, as the scripted verdict cue computed it: the card in the big slot decides, and a
 *  family build must fill all three slots before it commits at all. */
export const bigSlotMatches = (item: WordProblemItem, board: FamilyPlacements): boolean => board.big === item.plan.big.id;
/**
 * What a wrong placement shows (`TeachingAttempt.miss`, handoff 20): a small amount sits in the big slot, either
 * `box_in_big` (the story's unknown box) or `printed_small_in_big` (a number the story prints). The spoken steps
 * name none: the tutor judges them.
 */
export type WordProblemMiss = 'box_in_big' | 'printed_small_in_big';

export function wordProblemMiss(item: WordProblemItem | null, board: FamilyPlacements): WordProblemMiss | undefined {
  if (!item || item.kind !== 'big_number' || !board.big || bigSlotMatches(item, board)) return undefined;
  return board.big === item.plan.unknown.id ? 'box_in_big' : 'printed_small_in_big';
}

export const boardComplete = (item: WordProblemItem, board: FamilyPlacements): boolean =>
  item.challengeType === 'find_big_number' ? !!board.big : !!board.small1 && !!board.small2 && !!board.big;

/** The learner's placement in words, never the key. */
export function describePlacement(item: WordProblemItem, board: FamilyPlacements): string {
  const label = (id: string | null) => item.plan.quantities.find(q => q.id === id)?.label ?? 'nothing';
  return item.challengeType === 'find_big_number'
    ? `Placed "${label(board.big)}" in the big-amount box.`
    : `Built the family with "${label(board.small1)}" and "${label(board.small2)}" as the small amounts and "${label(board.big)}" as the big amount.`;
}

export function wordProblemScene(item: WordProblemItem, view: { familyShown: boolean }): WorkspaceScene {
  const hands = item.kind === 'big_number';
  return {
    objects: [
      { id: 'story', selected: false, group: 'assignment target', label: 'the printed story' },
      ...(hands ? item.plan.quantities.map(q => ({ id: q.id, selected: false, group: 'story-part card', label: q.label })) : []),
    ],
    facts: { kind: item.kind, printedStory: item.plan.story, ...(item.supportTier ? { supportTier: item.supportTier } : {}),
      constraints: hands
        ? (item.challengeType === 'find_big_number'
          ? 'The learner drags or taps a story-part card into the big-amount box; the activity checks it. You cannot place a card.'
          : 'The learner puts all three story-part cards into small + small = big; the activity checks the big slot. You cannot place a card.')
        : `The learner answers aloud. ${view.familyShown ? 'The family they built is drawn on screen. ' : ''}`
          + 'Nothing the learner must say is printed before it is credited.' },
  };
}

/** The journey's answers: the pack's canonical utterance, or the plainest wrong answer of the same kind. */
export function diWordProblemHarnessAnswers(item: WordProblemItem): { correct: string; plainWrong: string } {
  const p = item.plan;
  switch (item.kind) {
    case 'classify': return { correct: SHAPE_WORD[p.shape], plainWrong: SHAPE_WORD[STORY_SHAPES.find(s => s !== p.shape)!] };
    case 'family': return { correct: familySpoken(p), plainWrong: familyMisplaced(p) };
    case 'operation': return { correct: p.operation, plainWrong: p.operation === 'add' ? 'subtract' : 'add' };
    case 'solve': return { correct: w(p.answer), plainWrong: w(wrongWayAnswer(p)) };
    default: throw new Error('The big-number step is placed by hand, not said');
  }
}

/** The journey's placements: the right card per slot, or a small amount in the big slot. */
export function wordProblemHarnessPlacements(item: WordProblemItem, wrong: boolean): FamilyPlacements {
  const p = item.plan;
  if (item.challengeType === 'find_big_number') return { small1: null, small2: null, big: wrong ? p.small1.id : p.big.id };
  return wrong ? { small1: p.big.id, small2: p.small2.id, big: p.small1.id } : { small1: p.small1.id, small2: p.small2.id, big: p.big.id };
}

/** A payload the stage can ask: at least one problem, and every problem builds its steps. */
export function wordProblemDataValid(data: Pick<DiWordProblemSetupData, 'problems'>): boolean {
  if (!Array.isArray(data?.problems) || !data.problems.length) return false;
  const built = itemsFromProblems(data.problems);
  return built.dropped === 0 && built.items.length > 0;
}
