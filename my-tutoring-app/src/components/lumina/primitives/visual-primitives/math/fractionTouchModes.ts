import { buildDiModePlan, challengeTypeDocsFromDiModes, defineDiMode, defineDiModes, evalModeDefinitionsFromDiModes } from '../../../hooks/diModeContract';

export interface FractionTouchTarget { id: string; challengeType: 'touch_fraction'; numerator: number; denominator: number }
export const fractionName = (n: number, d: number): string => {
  const numbers = ['zero', 'one', 'two', 'three'];
  const unit = d === 2 ? 'half' : d === 3 ? 'third' : 'fourth';
  return `${numbers[n]} ${n === 1 ? unit : d === 2 ? 'halves' : `${unit}s`}`;
};
const mode = defineDiMode<FractionTouchTarget>();
export const FRACTION_TOUCH_MODES = defineDiModes<FractionTouchTarget>(mode({
  evalMode: 'touch_fraction', label: 'Touch the Fraction', beta: 1.25, scaffoldingMode: 1,
  challengeTypes: ['touch_fraction'],
  description: 'Hear a proper fraction in halves, thirds, or fourths and touch its shaded picture.',
  affordances: { representation: 'pictorial', answers: ['tap'] },
  challengeDocs: { touch_fraction: {
    promptDoc: '"touch_fraction": listen to a named fraction and touch the matching circle. Use proper fractions with denominators 2, 3, 4 only. Code builds three distinct picture choices and speaks the ask. Vary the target across challenges; no generated labels or answer positions.',
    schemaDescription: "'touch_fraction' (touch a picture matching a spoken fraction)",
  } },
  responseClass: 'manipulation', answerStepId: 'touch',
  steps: [{ id: 'touch', label: 'Touch the fraction', icon: '◔', answerKind: 'gesture',
    instruction: (item) => `Touch the picture showing ${fractionName(item.numerator, item.denominator)}.`,
    checkingInstruction: 'Look at the picture you touched and listen.' }],
}));
export const FRACTION_TOUCH_EVAL_MODES = evalModeDefinitionsFromDiModes(FRACTION_TOUCH_MODES);
export const FRACTION_TOUCH_TYPE_DOCS = challengeTypeDocsFromDiModes(FRACTION_TOUCH_MODES);
export const fractionTouchPlan = (item: FractionTouchTarget) => buildDiModePlan(FRACTION_TOUCH_MODES, item);
