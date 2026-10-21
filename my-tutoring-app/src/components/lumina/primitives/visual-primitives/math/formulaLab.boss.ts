/**
 * formula-lab's boss (`components/live-activity/boss.ts`), bespoke because its modes mix a slider, a track, a token
 * build and a typed output, every one checked by the activity: the card is `formulaLab.card.ts`; this file validates
 * a lesson, lists its challenges, asks one, carries the lever set and plays the harness.
 *
 * Every ask reads the lab (the formula's quantities and output), so the boss gives no item-only `assignment`: the
 * component builds each one with `bossAssignment` from `formulaAsk(data, item)`, and no key reaches the tutor.
 */
import type { FormulaLabChallenge, FormulaLabData } from './FormulaLab';
import { defineBoss } from '../../../components/live-activity/boss';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import { evaluateFormulaExpression, validateFormulaExpression } from './formulaLabMath';
import { formatNumber, formulaAsk, formulaCheck, formulaHarnessInput, tokenizeFormula } from './formulaLabWorkspace';
import { FORMULA_LEVERS, practiceParent, simplerFormula } from './formulaLabLevers';
import { formulaLabCard, type FormulaLabMiss } from './formulaLab.card';

const TYPES = ['free-explore', 'predict-direction', 'predict-magnitude', 'construct-formula', 'transfer-apply'];

/** Reject a formula-lab lesson whose challenges its own check cannot answer. */
export function validateFormulaLabData(value: unknown): FormulaLabData {
  const d = value as FormulaLabData;
  if (!d || typeof d.title !== 'string' || typeof d.expression !== 'string' || !Array.isArray(d.variables) || !d.variables.length
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || !validateFormulaExpression(d.expression, d.variables.map(v => v.symbol))
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)
        || !d.variables.some(v => v.symbol === c.changedVariableSymbol)
        || c.baselineValues?.length !== d.variables.length || c.targetValues?.length !== d.variables.length))
    throw new Error('Generated formula lab has invalid lesson content.');
  // Each challenge's key is what the formula gives, and its own right answer passes its own check.
  for (const c of d.challenges) {
    const scope = (values: number[]) => Object.fromEntries(d.variables.map((v, i) => [v.symbol, values[i]]));
    const target = evaluateFormulaExpression(d.expression, scope(c.targetValues));
    const right = formulaHarnessInput(d, c, 'correct');
    const work = { prediction: right?.kind === 'predict' ? right.percent / 100 : null, tokens: right?.kind === 'build' ? right.tokens : [],
      answer: right?.kind === 'type' ? right.text : '', value: right?.kind === 'value' ? right.value : null };
    if (target === null || Math.abs(target - c.expectedTargetOutput) > 1e-6 * Math.max(1, Math.abs(target))
        || !formulaCheck(d, c, work).correct)
      throw new Error(`A formula-lab ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** The session challenge, or the easier practice problem a simplify lever opened (`~simpler`), rebuilt from its parent. */
function currentItem(ctx: JourneyContext): FormulaLabChallenge | undefined {
  const d = ctx.data as FormulaLabData;
  const parentId = practiceParent(String(ctx.itemId ?? ''));
  const parent = (d.challenges ?? []).find(c => c.id === parentId);
  return parent && parentId !== ctx.itemId ? simplerFormula(d, parent) ?? undefined : parent;
}

/**
 * Every mode through its real controls (`formulaHarnessInput`): the slider ("Changed quantity") set to the target;
 * the prediction ("Your prediction", hundredths of the track) and Lock prediction; the tokens tapped in order and
 * Check formula; the output typed ("Transferred output") and Check. A wrong answer is the mode's signature miss (the
 * other direction, the far end of the track, the reciprocal or another order, the starting values' output).
 * free-explore has no wrong move: every finished move is credited.
 */
function play(right: boolean, c: FormulaLabChallenge, ctx: JourneyContext): DriverInput[] {
  const input = formulaHarnessInput(ctx.data as FormulaLabData, c, right ? 'correct' : 'wrong');
  if (!input) return [];
  const reason = (label: string, text?: string): DriverInput[] => (text ? [{ type: 'write', label, text }] : []);
  switch (input.kind) {
    case 'value': return [{ type: 'write', label: 'Changed quantity', text: String(input.value) }];
    case 'predict': return [...reason('Prediction reason', input.reason),
      { type: 'write', label: 'Your prediction', text: String(input.percent) }, { type: 'choose', label: 'Lock prediction' }];
    case 'build': return [...input.tokens.map((label): DriverInput => ({ type: 'choose', label })), { type: 'check' }];
    case 'type': return [{ type: 'write', label: 'Transferred output', text: input.text },
      ...reason('Calculation reason', input.reason), { type: 'check' }];
  }
}

export const formulaLabBoss = defineBoss<FormulaLabData, FormulaLabChallenge, FormulaLabMiss>({
  card: formulaLabCard,
  validate: validateFormulaLabData,
  items: d => d.challenges,
  ask: (c, d) => formulaAsk(d, c),
  levers: FORMULA_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/FormulaLab.tsx',
    instanceId: 'formula',
    defaults: { grade: 'Grade 8', mode: 'predict-direction', topic: 'How changing one quantity in a formula changes the output' },
    mounted: '[data-pip-object="workspace"]',
    current: currentItem,
    play,
    // The answer as the screen would print it: the output, and on construct the hidden expression.
    replayKeys: ctx => {
      const c = currentItem(ctx);
      if (!c) return [];
      return c.type === 'construct-formula' ? [tokenizeFormula(String((ctx.data as FormulaLabData).expression)).join(' ')]
        : c.type === 'free-explore' ? [] : [formatNumber(c.expectedTargetOutput)];
    },
  },
});
