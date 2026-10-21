/**
 * function-machine's boss (`components/live-activity/boss.ts`), bespoke because every mode is answered on the screen
 * and checked by the activity: the card is `functionMachine.card.ts`; this file validates a lesson, lists its items
 * (each with the session's mode), asks one, carries the lever set and plays the harness.
 */
import type { FunctionMachineData } from './FunctionMachine';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import { evaluateRule, makeRuleTarget } from './functionMachineDomain';
import {
  functionMachineItems, functionMachineTask, harnessMachines, harnessWrongRule, observePairsNeeded, ruleTiles,
  type FunctionMachineItem,
} from './functionMachineWorkspace';
import { MACHINE_LEVERS, practiceItem, practiceParent } from './functionMachineLevers';
import { functionMachineCard, type FunctionMachineMiss } from './functionMachine.card';

const CHALLENGE_TYPES = ['observe', 'predict', 'discover_rule', 'create_rule', 'make_rule'];

/** Reject a function-machine lesson whose challenges cannot be attempted: every rule runs on its inputs, or names a pair. */
export function validateFunctionMachineData(value: unknown): FunctionMachineData {
  const d = value as FunctionMachineData;
  if (!d || typeof d.title !== 'string' || !CHALLENGE_TYPES.includes(d.challengeType) || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || typeof c.rule !== 'string' || !Array.isArray(c.inputQueue)))
    throw new Error('Generated function machine has invalid lesson content.');
  for (const c of d.challenges) {
    const ok = d.challengeType === 'make_rule' ? !!makeRuleTarget(c)
      : c.inputQueue.length >= 2 && c.inputQueue.every(x => typeof x === 'number' && evaluateRule(c.rule, x) !== null);
    if (!ok) throw new Error(`A function-machine ${d.challengeType} challenge cannot be answered as generated.`);
  }
  return d;
}

/** The session item, or the easier practice machine a simplify lever opened (`~simpler`), rebuilt from its parent. */
function currentItem(ctx: JourneyContext): FunctionMachineItem | undefined {
  const items = functionMachineItems(ctx.data as FunctionMachineData);
  const parent = practiceParent(ctx.itemId, items);
  return parent ? practiceItem(parent) ?? undefined : items.find(c => c.id === ctx.itemId);
}

/**
 * Every mode through its real controls: feed buttons, the prediction and rule boxes, the tile keypad. The inputs and
 * pairs still on screen are read from the scene facts, since a miss keeps what was already fed. Observe has no wrong
 * answer (Continue is its end). A wrong answer is the mode's signature error: a prediction one over, the shape's
 * typical wrong rule (`harnessWrongRule`), a machine that gives one more than the pair asks.
 */
function play(right: boolean, c: FunctionMachineItem, ctx: JourneyContext): DriverInput[] {
  const left = String(ctx.demand?.inputsToFeed ?? '').split(',').map(t => t.trim()).filter(t => /^-?\d+(\.\d+)?$/.test(t)).map(Number);
  const shown = (String(ctx.demand?.pairsOnScreen ?? '').match(/→/g) ?? []).length;
  const feed = (x: number): DriverInput => ({ type: 'choose', label: `Feed ${x}` });
  const out = (x: number) => evaluateRule(c.rule, x)!;
  switch (c.mode) {
    case 'observe':
      return right ? [...left.slice(0, Math.max(0, observePairsNeeded(c) - shown)).map(feed), { type: 'choose', label: 'Continue →' }] : [];
    case 'predict': {
      const predict = (x: number, value: number): DriverInput[] => [{ type: 'write', label: 'My prediction', text: String(value) }, feed(x)];
      if (right) return left.flatMap(x => predict(x, out(x)));
      // An input that is no other input's output, so naming it after the miss names no key.
      const outputs = new Set(left.map(out));
      const x = left.find(i => !outputs.has(i)) ?? left[0];
      return predict(x, out(x) + 1);
    }
    case 'discover_rule':
    case 'create_rule': {
      const feeds = c.mode === 'discover_rule' ? left.slice(0, Math.max(0, 2 - shown)).map(feed) : [];
      return [...feeds, { type: 'write', label: 'Your rule', text: right ? c.rule : harnessWrongRule(c.rule) }, { type: 'check' }];
    }
    case 'make_rule': {
      const machines = harnessMachines(c);
      if (!machines) throw new Error('function-machine make_rule: the item names no pair');
      const build = (rule: string): DriverInput[] => [...ruleTiles(rule).map((t): DriverInput => ({ type: 'choose', label: `Add ${t}` })),
        { type: 'choose', label: "I'm done!" }];
      if (!right) return build(machines.wrong);
      return [{ type: 'choose', label: 'Start over' }, ...build(machines.right[0]), ...build(machines.right[1])];
    }
  }
}

export const functionMachineBoss = defineBoss<FunctionMachineData, FunctionMachineItem, FunctionMachineMiss>({
  card: functionMachineCard,
  validate: validateFunctionMachineData,
  items: functionMachineItems,
  ask: c => functionMachineTask(c, c.mode),
  // Fed inputs, typed answers and built machines the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, functionMachineTask(c, c.mode), null),
  levers: MACHINE_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/FunctionMachine.tsx',
    instanceId: 'fm',
    defaults: { grade: 'Grade 5', mode: 'discover_rule', topic: 'Function machines: input and output rules' },
    mounted: '[data-pip-object="workspace"]',
    current: currentItem,
    play,
    // The key per mode: the hidden rule (discover, create), the outputs not yet fed (predict), the stored machine (make,
    // one of many that pass). A pair already on screen is not a key.
    replayKeys: ctx => {
      const c = currentItem(ctx);
      if (!c) return [];
      if (c.mode === 'predict') return c.inputQueue.map(x => String(evaluateRule(c.rule, x)));
      return c.mode === 'observe' ? [] : [c.rule];
    },
  },
});
