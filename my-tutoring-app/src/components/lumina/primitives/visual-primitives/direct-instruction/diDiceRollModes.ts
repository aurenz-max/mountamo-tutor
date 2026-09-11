import {
  buildDiModePlan,
  challengeTypeDocsFromDiModes,
  defineDiMode,
  defineDiModes,
  evalModeDefinitionsFromDiModes,
} from '../../../hooks/diModeContract';

export type DiDiceRollMode = 'count_pips' | 'compare_dice' | 'sum_two_dice';

interface DiceModeItem {
  id: string;
  challengeType: DiDiceRollMode;
}

const mode = defineDiMode<DiceModeItem>();

export const DI_DICE_ROLL_MODES = defineDiModes<DiceModeItem>(
  mode({
    evalMode: 'count_pips',
    label: 'Count the Pips',
    beta: 1.5,
    discrimination: 1.6,
    scaffoldingMode: 1,
    challengeTypes: ['count_pips'],
    description: 'Roll one six-sided die and say its visible pip quantity as a number word.',
    challengeDocs: {
      count_pips: {
        promptDoc: '"count_pips": roll one six-sided die, inspect its pip pattern, and say the quantity as a number word.',
        schemaDescription: "'count_pips' (say one die's pip quantity)",
      },
    },
    responseClass: 'number_word_to_20',
    answerStepId: 'answer',
    groupingKey: (item) => item.challengeType,
    steps: [
      { id: 'roll', label: 'Roll the die', icon: '🎲', answerKind: 'gesture', instruction: 'Tap the die to roll it.', checkingInstruction: 'Rolling the die.' },
      { id: 'answer', label: 'Count the dots', icon: '🎲', answerKind: 'voice', instruction: 'Say how many dots you see.', checkingInstruction: 'Listening to your dice answer.' },
    ],
  }),
  mode({
    evalMode: 'compare_dice',
    label: 'Compare Two Dice',
    beta: 2.5,
    discrimination: 1.6,
    scaffoldingMode: 2,
    challengeTypes: ['compare_dice'],
    description: 'Roll two dice, compare their pip quantities, and say left, right, or same.',
    challengeDocs: {
      compare_dice: {
        promptDoc: '"compare_dice": roll two dice, compare their pip quantities, and say left, right, or same.',
        schemaDescription: "'compare_dice' (say which die has more)",
      },
    },
    responseClass: 'short_spoken_word',
    answerStepId: 'answer',
    groupingKey: (item) => item.challengeType,
    steps: [
      { id: 'roll', label: 'Roll both dice', icon: '🎲', answerKind: 'gesture', instruction: 'Tap both dice to roll them.', checkingInstruction: 'Rolling the dice.' },
      { id: 'answer', label: 'Compare the dice', icon: '🎲', answerKind: 'voice', instruction: 'Say which has more: left, right, or same.', checkingInstruction: 'Listening to your dice answer.' },
    ],
  }),
  mode({
    evalMode: 'sum_two_dice',
    label: 'Add Two Dice',
    beta: 3.5,
    discrimination: 1.6,
    scaffoldingMode: 3,
    challengeTypes: ['sum_two_dice'],
    description: 'Roll two dice, combine both visible pip sets, and say the total from two through twelve.',
    challengeDocs: {
      sum_two_dice: {
        promptDoc: '"sum_two_dice": roll two dice, combine both visible pip sets, and say the total as a number word.',
        schemaDescription: "'sum_two_dice' (say the total of two dice)",
      },
    },
    responseClass: 'number_word_to_20',
    answerStepId: 'answer',
    groupingKey: (item) => item.challengeType,
    steps: [
      { id: 'roll', label: 'Roll both dice', icon: '🎲', answerKind: 'gesture', instruction: 'Tap both dice to roll them.', checkingInstruction: 'Rolling the dice.' },
      { id: 'answer', label: 'Add the dots', icon: '🎲', answerKind: 'voice', instruction: 'Say how many dots there are altogether.', checkingInstruction: 'Listening to your dice answer.' },
    ],
  }),
);

export const DI_DICE_ROLL_EVAL_MODES = evalModeDefinitionsFromDiModes(DI_DICE_ROLL_MODES);
export const DI_DICE_ROLL_TYPE_DOCS = challengeTypeDocsFromDiModes(DI_DICE_ROLL_MODES);
export const DI_DICE_ROLL_CHALLENGE_TYPES = DI_DICE_ROLL_MODES.flatMap(
  (definition) => definition.challengeTypes,
) as DiDiceRollMode[];

export const diDiceRollModePlan = (item: DiceModeItem) =>
  buildDiModePlan(DI_DICE_ROLL_MODES, item);
