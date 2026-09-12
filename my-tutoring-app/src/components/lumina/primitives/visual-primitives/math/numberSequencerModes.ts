import { buildDiModePlan, challengeTypeDocsFromDiModes, defineDiMode, defineDiModes,
  evalModeDefinitionsFromDiModes } from '../../../hooks/diModeContract';

export interface SequencerPlanItem {
  id: string;
  challengeType: string;
  answer: number;
  ask: string;
}
const mode = defineDiMode<SequencerPlanItem>();
const identities = [
  ['count_from', 'count-from', 'Count From', 1.5, 1,
    'Continue counting aloud, one number at a time, from a given start. Provide startNumber, direction and correctAnswers; sequence is empty or contains only the start. K counts forward.'],
  ['before_after', 'before-after', 'Before and After', 2.5, 2,
    'Say the adjacent missing number. Provide a two-element sequence with one null and one correct answer.'],
  ['spot_error', 'spot-error', 'Spot the Error', 3.5, 3,
    'Say which printed number breaks the count. Provide a correct consecutive forward sequence of 5-7 numbers; code introduces exactly one error and owns wrongIndex and its replacement.'],
  ['order_cards', 'order-cards', 'Order Cards', 3.5, 3,
    'Arrange shuffled number cards from smallest to largest. Provide distinct numbers in sequence and the same set sorted ascending in correctAnswers. K uses 3-4 cards; Grade 1 uses 4-6.'],
  ['fill_missing', 'fill-missing', 'Fill the Gaps', 4.5, 4,
    'Say each missing number in a sequence. Provide 1-3 nulls, at least two visible terms defining one arithmetic rule, and correctAnswers in blank order.'],
  ['decade_fill', 'decade-fill', 'Cross the Decade', 5.5, 5,
    'Say missing numbers across a decade boundary. Grade 1 only. Provide a consecutive sequence crossing a decade, nulls at the boundary and correctAnswers in blank order.'],
] as const;

export const NUMBER_SEQUENCER_MODES = defineDiModes<SequencerPlanItem>(...identities.map(
  ([evalMode, type, label, beta, scaffoldingMode, description]) => mode({
    evalMode, label, beta, scaffoldingMode, challengeTypes: [type], description,
    ...(type === 'spot-error' ? { discrimination: 1.2 } : {}),
    affordances: { answers: [type === 'order-cards' ? 'tap' : 'spoken'] },
    challengeDocs: { [type]: { promptDoc: `"${type}": ${description}`, schemaDescription: `'${type}' (${label})` } },
    responseClass: (item) => type === 'order-cards' ? 'manipulation'
      : item.answer <= 20 ? 'number_word_to_20' : 'number_word_to_120',
    answerStepId: 'answer', groupingKey: () => type,
    steps: [{ id: 'answer', actionId: type, label, icon: type === 'order-cards' ? '🃏' : '🎙️',
      answerKind: type === 'order-cards' ? 'gesture' : 'voice',
      instruction: (item) => item.ask,
      checkingInstruction: type === 'order-cards' ? 'Checking your number train.' : 'Listening to your number.' }],
  }),
));
export const NUMBER_SEQUENCER_EVAL_MODES = evalModeDefinitionsFromDiModes(NUMBER_SEQUENCER_MODES);
export const NUMBER_SEQUENCER_TYPE_DOCS = challengeTypeDocsFromDiModes(NUMBER_SEQUENCER_MODES);
export const numberSequencerModePlan = (item: SequencerPlanItem) => buildDiModePlan(NUMBER_SEQUENCER_MODES, item);
