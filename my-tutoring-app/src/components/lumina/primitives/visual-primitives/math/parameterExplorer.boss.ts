/**
 * parameter-explorer's boss (`components/live-activity/boss.ts`), bespoke because its modes mix sliders, a tapped
 * choice and a typed number, every one checked by the activity: the card is `parameterExplorer.card.ts`; this file
 * validates a lesson, lists its challenges, asks one, carries the lever set and plays the harness.
 *
 * Every ask reads the lab (the formula and its parameters), so the boss gives no item-only `assignment`: the component
 * builds each one with `bossAssignment` from `parameterAsk(data, item)`, and no key reaches the tutor.
 */
import type { ParameterExplorerChallenge, ParameterExplorerData } from './ParameterExplorer';
import { defineBoss } from '../../../components/live-activity/boss';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import {
  EMPTY_WORK, askedOutput, evaluateFormula, formatOutput, parameterAsk, parameterCheck, parameterHarnessInput,
  settleChallenge, startingValues, type Direction,
} from './parameterExplorerWorkspace';
import { PARAMETER_LEVERS, practiceParent, simplerParameter } from './parameterExplorerLevers';
import { parameterExplorerCard, type ParameterExplorerMiss } from './parameterExplorer.card';

const TYPES = ['explore', 'predict-direction', 'predict-value', 'identify-relationship'];

/** Reject a parameter-explorer lesson whose challenges its own check cannot answer. */
export function validateParameterExplorerData(value: unknown): ParameterExplorerData {
  const d = value as ParameterExplorerData;
  if (!d || typeof d.title !== 'string' || typeof d.jsExpression !== 'string' || typeof d.formula !== 'string'
      || !Array.isArray(d.parameters) || d.parameters.length < 2
      || d.parameters.some(p => !p || typeof p.symbol !== 'string' || !(p.max > p.min) || !(p.default >= p.min && p.default <= p.max))
      || evaluateFormula(d.jsExpression, startingValues(d)) === null
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)))
    throw new Error('Generated parameter explorer has invalid lesson content.');
  for (const c of d.challenges) {
    // The key is the formula's at a setting on the slider (`settleChallenge` keeps it unchanged), and its own right
    // answer passes its own check.
    const settled = settleChallenge(d, c);
    const right = parameterHarnessInput(d, c, 'correct');
    const work = { ...EMPTY_WORK,
      direction: right?.kind === 'direction' ? (right.label === 'Increase' ? 'increase' : right.label === 'Decrease' ? 'decrease' : 'stay-same') as Direction : null,
      value: right?.kind === 'type' ? right.text : '',
      parameter: right?.kind === 'parameter' ? d.parameters.find(p => right.label.startsWith(`${p.symbol} (`))?.symbol ?? null : null,
      moved: right?.kind === 'move' ? [right.symbol] : [] };
    if (!settled || settled.prediction?.newValue !== c.prediction?.newValue || !right || !parameterCheck(d, c, work))
      throw new Error(`A parameter-explorer ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** The session challenge, or the easier practice problem a simplify lever opened (`~simpler`), rebuilt from its parent. */
function currentItem(ctx: JourneyContext): ParameterExplorerChallenge | undefined {
  const d = ctx.data as ParameterExplorerData;
  const parentId = practiceParent(String(ctx.itemId ?? ''));
  const parent = (d.challenges ?? []).find(c => c.id === parentId);
  return parent && parentId !== ctx.itemId ? simplerParameter(d, parent) ?? undefined : parent;
}

/**
 * Every mode through its real controls (`parameterHarnessInput`): explore writes the first parameter's slider
 * ("<name> (<symbol>) slider") one step and presses Done Exploring; predict-direction chooses Increase / Decrease /
 * Stay Same and Check; predict-value types "Your prediction" and Check; identify chooses "<symbol> (<name>)" and Check.
 * A wrong answer is the mode's signature miss (the other direction, the starting output, the parameter with the
 * largest starting number). explore has no wrong move: Done Exploring opens only after a move.
 */
function play(right: boolean, c: ParameterExplorerChallenge, ctx: JourneyContext): DriverInput[] {
  const input = parameterHarnessInput(ctx.data as ParameterExplorerData, c, right ? 'correct' : 'wrong');
  if (!input) {
    if (c.type === 'explore') return [];
    throw new Error(`parameter-explorer ${c.type}: no input for this item`);
  }
  switch (input.kind) {
    case 'move': return [{ type: 'write', label: input.label, text: String(input.value) }, { type: 'choose', label: 'Done Exploring' }];
    case 'direction': return [{ type: 'choose', label: input.label }, { type: 'check' }];
    case 'type': return [{ type: 'write', label: 'Your prediction', text: input.text }, { type: 'check' }];
    case 'parameter': return [{ type: 'choose', label: input.label }, { type: 'check' }];
  }
}

export const parameterExplorerBoss = defineBoss<ParameterExplorerData, ParameterExplorerChallenge, ParameterExplorerMiss>({
  card: parameterExplorerCard,
  validate: validateParameterExplorerData,
  items: d => d.challenges,
  ask: (c, d) => parameterAsk(d, c),
  levers: PARAMETER_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/ParameterExplorer.tsx',
    instanceId: 'parameter',
    defaults: { grade: 'Grade 9', mode: 'predict-direction', topic: 'How each variable in a physics formula affects the result' },
    mounted: '[data-pip-object="workspace"]',
    current: currentItem,
    play,
    // The answer as the screen would print it: predict-value's output. The direction words and the parameter names are
    // on screen as choices, so they are read by hand in the replies.
    replayKeys: ctx => {
      const c = currentItem(ctx);
      const value = c?.type === 'predict-value' ? askedOutput(ctx.data as ParameterExplorerData, c) : null;
      return value === null ? [] : [formatOutput(value)];
    },
  },
});
