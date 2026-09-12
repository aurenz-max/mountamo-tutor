/**
 * baseTenModes — the DI mode definitions for base-ten-blocks (qa/di/BACKLOG.md
 * item 18, the pilot half of the base-ten port: `read_blocks` and `regroup`).
 *
 * ── THE FENCE WITH place-value-chart ────────────────────────────────────────
 *
 * place-value-chart is SYMBOLIC: its stimulus is a digit sitting in a labeled
 * column, and it owns `find_place` ("which place?"), `say_value` ("what is that
 * digit worth?") and a dictated `build_number`. base-ten-blocks is CONCRETE:
 * its stimulus is physical blocks whose SIZE carries the value. Two acts belong
 * only here, and neither is askable on a chart:
 *
 *   read_blocks — going from a QUANTITY OF OBJECTS to a value. Four ten-sticks
 *                 are worth forty. The chart starts from the digit 4 already
 *                 written in the tens column; the blocks make the child do the
 *                 unitizing that put it there.
 *   regroup     — the TRADE. Ten of one unit physically becoming one of the
 *                 next is the base-ten idea itself, and a chart cannot show it.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1) ─────────────────────────────────
 *
 * `read_blocks` was a KEYPAD: the child typed the number the blocks showed.
 * Both halves of that were wrong for DI. Typing is not how a child answers a
 * teacher across a table, and the composed numeral ("three hundred forty-seven")
 * is explicitly NOT in the `place_value_word` class — a pack may never ask a
 * child to SAY one. So the mode fans out per place and asks the two questions a
 * teacher actually asks at the mat: how many, and what are they worth. Both are
 * plainly sayable, so both are voice. THE CHILD NEVER SAYS THE WHOLE NUMBER;
 * the tutor composes it in the affirmation, which is where it belongs.
 *
 * `regroup` was two buttons: make the trade, press "Check My Trade". The trade
 * itself is honest page-work — moving blocks IS the skill, so it stays a
 * gesture and the Check button goes (code computes the verdict). What the click
 * era never asked at all is the REASONING, so the spoken step comes FIRST and
 * is a prediction: with the blocks still untraded, the child cannot count the
 * answer off the screen, and a wrong prediction is exactly the misconception
 * the mode exists to undo.
 *
 * ── RESPONSE CLASS ARITHMETIC ───────────────────────────────────────────────
 *
 * regroup rides ZERO #63 exposure by construction: a standard-form start caps
 * the receiving digit at 9, so the predicted count is 10-19 and sits inside the
 * benched `number_word_to_20`. read_blocks' `worth` step is `place_value_word`
 * ("forty", "three hundred") — accepted-build-ahead, acceptance riding the same
 * #63 multi-word-numeral sitting as place-value-chart's `say_value`. One
 * sitting clears both; this pack adds no new class.
 */
import {
  buildDiModePlan,
  challengeTypeDocsFromDiModes,
  defineDiMode,
  defineDiModes,
  evalModeDefinitionsFromDiModes,
  type DiModeItem,
} from '../../../hooks/diModeContract';
import {
  blockNoun,
  blockNounPlural,
  startingLowerCount,
  type BtProblem,
} from './baseTenModel';

export interface BaseTenPlanItem extends DiModeItem {
  problem: BtProblem;
}

const mode = defineDiMode<BaseTenPlanItem>();

/** The ask is the same sentence on the screen and in the tutor's mouth. */
export const countAsk = (problem: BtProblem): string =>
  `How many ${blockNounPlural(problem.place)} do you see?`;

export const worthAsk = (problem: BtProblem): string =>
  `What are those ${blockNounPlural(problem.place)} worth altogether?`;

/**
 * The prediction names the starting mat because the child must reason FROM it —
 * this is the one ask in the pack that states quantities, and it states them so
 * the answer is an inference rather than a reading. A place that starts empty
 * says so in words rather than speaking a zero.
 */
export const predictAsk = (problem: BtProblem): string => {
  const lower = startingLowerCount(problem);
  const lowerNoun = blockNounPlural(problem.place - 1);
  const have = lower === 0
    ? `There are no ${lowerNoun} on the mat.`
    : `You have ${lower} ${blockNoun(problem.place - 1, lower)}.`;
  return `${have} You are going to trade one ${blockNoun(problem.place, 1)} for ten ${lowerNoun}. `
    + `How many ${lowerNoun} will you have then?`;
};

export const tradeAsk = (problem: BtProblem): string =>
  `Now make that trade. Tap one ${blockNoun(problem.place, 1)} to break it apart.`;

export const BASE_TEN_DI_MODES = defineDiModes<BaseTenPlanItem>(
  mode({
    evalMode: 'read_blocks',
    label: 'Read the Blocks',
    // β HELD. The mode measures the same concrete-to-value reading it always
    // did; what changed is that the child produces the value aloud instead of
    // transcribing a total into a keypad.
    beta: 2.5,
    scaffoldingMode: 2,
    challengeTypes: ['read_blocks'],
    affordances: { representation: 'concrete', answers: ['spoken'] },
    description:
      'Read a place on the block mat aloud: how many blocks of that size are there, and what are they worth '
      + 'altogether. The child says the place value ("forty"), never the composed numeral; the tutor puts the '
      + 'whole number together in its affirmation.',
    challengeDocs: {
      read_blocks: {
        promptDoc:
          '"read_blocks": blocks are pre-placed and the child reads them ALOUD, one place at a time. '
          + 'Set targetNumber to the number the blocks show; it must be at least 10 so a non-ones place exists '
          + 'to ask about. The instruction is never spoken — code owns every ask — so do not describe the blocks, '
          + 'name any column count, or state the number. Vary the digit patterns.',
        schemaDescription: "'read_blocks' (say what a place on the mat is worth)",
      },
    },
    responseClass: 'place_value_word',
    answerStepId: 'worth',
    groupingKey: () => 'read_blocks',
    steps: [
      {
        id: 'count',
        actionId: 'read-count',
        label: 'Count that size',
        icon: '👀',
        answerKind: 'voice',
        responseClass: 'number_word_to_20',
        instruction: (item) => countAsk(item.problem),
        checkingInstruction: 'Listening to your count.',
      },
      {
        id: 'worth',
        actionId: 'read-worth',
        label: 'Say what they are worth',
        icon: '🎙️',
        answerKind: 'voice',
        instruction: (item) => worthAsk(item.problem),
        checkingInstruction: 'Listening to the value.',
      },
    ],
  }),
  mode({
    evalMode: 'regroup',
    label: 'Trade Ten',
    // β HELD at the click era's value. The trade itself is the same act; the
    // added prediction is a new spoken step inside the mode, not a new identity.
    beta: 3.5,
    scaffoldingMode: 3,
    challengeTypes: ['regroup'],
    affordances: { representation: 'concrete', answers: ['spoken', 'manipulate'] },
    description:
      'Predict the result of a trade aloud, then make it with your hands: one block of a place breaks into ten '
      + 'of the place below. The prediction comes first, while the mat is still untraded, so the count cannot be '
      + 'read off the screen.',
    challengeDocs: {
      regroup: {
        promptDoc:
          '"regroup": the child predicts and then performs a trade, breaking one block into ten of the next place '
          + 'down. Set targetNumber to the number on the mat; it must be at least 10 and must have a non-zero '
          + 'digit above the ones place. The mat always starts in standard form and code chooses which place is '
          + 'traded, so the instruction is never spoken — do not name a trade, a column count, or an arrangement.',
        schemaDescription: "'regroup' (predict a trade, then make it)",
      },
    },
    responseClass: 'manipulation',
    answerStepId: 'trade',
    groupingKey: () => 'regroup',
    steps: [
      {
        id: 'predict',
        actionId: 'trade-predict',
        label: 'Predict the trade',
        icon: '🎙️',
        answerKind: 'voice',
        responseClass: 'number_word_to_20',
        instruction: (item) => predictAsk(item.problem),
        checkingInstruction: 'Listening to your prediction.',
      },
      {
        id: 'trade',
        actionId: 'trade-make',
        label: 'Make the trade',
        icon: '🔄',
        answerKind: 'gesture',
        responseClass: 'manipulation',
        instruction: (item) => tradeAsk(item.problem),
        checkingInstruction: 'Watching the blocks move.',
      },
    ],
  }),
);

export const BASE_TEN_DI_EVAL_MODES = evalModeDefinitionsFromDiModes(BASE_TEN_DI_MODES);
export const BASE_TEN_DI_TYPE_DOCS = challengeTypeDocsFromDiModes(BASE_TEN_DI_MODES);
export const baseTenModePlan = (item: BaseTenPlanItem) => buildDiModePlan(BASE_TEN_DI_MODES, item);

/** The challenge types this port has taken over. The remaining base-ten modes
 *  (`build_number`, `operate`) keep their legacy click transport until they are
 *  ported, which is what `audioInputByMode` in the catalog exists to express. */
export const BASE_TEN_DI_CHALLENGE_TYPES: readonly string[] =
  BASE_TEN_DI_MODES.flatMap((definition) => [...definition.challengeTypes]);

export const isBaseTenDiChallengeType = (type: unknown): type is 'read_blocks' | 'regroup' =>
  typeof type === 'string' && BASE_TEN_DI_CHALLENGE_TYPES.includes(type);
