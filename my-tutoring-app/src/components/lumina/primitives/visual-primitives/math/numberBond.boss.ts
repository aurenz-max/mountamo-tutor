/**
 * number-bond's boss, on the spoken preset (`components/live-activity/boss.ts`) and stepped: each challenge expands
 * into steps (`stepOf`), and a say step is a spoken number the tutor judges against the key while a split, move or
 * equation step has no key, the board checks it, and it plays through `show`. The card is `numberBond.card.ts`; this
 * file holds the content check, the steps, the ask and key, the levers and the harness play.
 */
import type { NumberBondData } from './NumberBond';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { numberWordFor } from './countingBoardDomain';
import { numberBondCard, type NumberBondMiss } from './numberBond.card';
import { NUMBER_BOND_LEVERS, smallerBond, smallerTeen } from './numberBondLevers';
import { buildBondItems, familyFormKeyFor, type NumberBondItem } from './numberBondDomain';
import { expandNumberBondInteractions } from './numberBondModes';
import { numberBondAsk, numberBondGiven, numberBondKey, numberBondSpokenMisses, spokenQuestion, stepOf } from './numberBondWorkspace';

const BOND_TYPES = ['decompose', 'missing-part', 'related-fact', 'ten-and-ones', 'fact-family', 'build-equation'];

/** The session's steps, built and expanded exactly as the component builds them (an unaskable challenge is dropped). */
export const numberBondItems = (d: Pick<NumberBondData, 'challenges' | 'gradeBand' | 'maxNumber'>): NumberBondItem[] =>
  expandNumberBondInteractions(buildBondItems(d.challenges ?? [], { band: d.gradeBand ?? 'K', maxNumber: d.maxNumber ?? 10 }).items);

/** Reject a bond whose challenges cannot be ASKED before it reaches a five-year-old. */
export function validateNumberBondData(value: unknown): NumberBondData {
  const d = value as NumberBondData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? '')
      || !Number.isInteger(d.maxNumber) || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id
        || !BOND_TYPES.includes(c.type) || !Number.isInteger(c.whole)))
    throw new Error('Generated number bond has invalid lesson content.');
  // `buildBondItems` DROPS anything unaskable rather than repairing it, so no steps means nothing to ask.
  if (!numberBondItems(d).length) throw new Error('A number-bond challenge cannot run in the lesson.');
  return d;
}

/** The step on screen: a session step, or the easier one a simplify lever opened (`<source>~smaller`). A decompose say
 *  step carries the split the scene shows (`askedSplit`), as the component stamps it. */
function currentStep(ctx: JourneyContext): NumberBondItem | undefined {
  const all = numberBondItems(ctx.data as NumberBondData);
  const id = ctx.itemId ?? '';
  const item = all.find(i => i.id === id) ?? all.flatMap(i => [smallerTeen(i), smallerBond(i, all, 'join')])
    .find((easier): easier is NumberBondItem => easier?.id === id);
  if (item?.kind !== 'decompose' || item.splitPhase !== 'say' || ctx.demand?.countersInLeftPart === undefined) return item;
  return { ...item, askedSplit: { left: Number(ctx.demand.countersInLeftPart), right: Number(ctx.demand.countersInRightPart ?? 0) } };
}

const press = (place: string, n: number): DriverInput[] =>
  Array.from({ length: Math.max(0, n) }, () => ({ type: 'choose' as const, label: `Move counter to ${place}` }));
const MOVE_LABEL = { join: 'Join the groups', swap: 'Swap the groups', 'separate-left': 'Move red group away',
  'separate-right': 'Move blue group away' } as const;

const numberBondBase = spokenBoss<NumberBondData, NumberBondItem, NumberBondMiss>({
  card: numberBondCard,
  validate: validateNumberBondData,
  items: numberBondItems,
  levers: NUMBER_BOND_LEVERS,
  speech: {
    ask: numberBondAsk,
    // A split, a move or an equation has no key: the board checks it.
    key: numberBondKey,
    given: numberBondGiven,
    misses: numberBondSpokenMisses,
    // Wrong is one more than the number asked for.
    say: item => { const n = spokenQuestion(item)?.answer ?? item.answer; return { correct: numberWordFor(n), plainWrong: numberWordFor(n + 1) }; },
    // A split presses the board's own buttons: everything back to the whole, then a complete split (an incomplete one
    // never commits). Wrong is a split with no full ten, or a decompose pair already made; the first way to split a
    // whole has no pair to repeat, so it has no wrong input. A move step presses its move button (the only moves on
    // offer are right ones, so it has no wrong input). An equation step types the equation for the move (join on
    // build_equation), wrong by one on the result.
    show: (right, item, ctx) => {
      const step = stepOf(item);
      if (step === 'move') {
        if (!right) return [];
        return [{ type: 'choose', label: item.interactionPhase === 'equation-model' ? 'Join the groups' : MOVE_LABEL[item.bondAction ?? 'join'] }];
      }
      if (step === 'equation') {
        const key = item.interactionPhase === 'family-build' && item.familyForm
          ? familyFormKeyFor(item.familyForm, item.whole, item.knownPart, item.otherPart) : `${item.knownPart}+${item.otherPart}=${item.whole}`;
        const [lhs, result] = key.split('=');
        return [{ type: 'write', label: 'Equation keyboard entry', text: `${lhs}=${right ? result : Number(result) + 1}` }];
      }
      if (!right && item.kind === 'decompose' && item.pairIndex === 0) return [];
      const placed = Number(ctx.demand?.countersInLeftPart ?? 0) + Number(ctx.demand?.countersInRightPart ?? 0);
      const left = item.kind === 'ten-and-ones' ? (right ? 10 : 9) : !right && item.pairIndex > 0 ? 0 : item.pairIndex;
      return [...press('whole', placed), ...press('left', left), ...press('right', item.whole - left)];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/math/NumberBond.tsx',
    instanceId: 'bond',
    defaults: { grade: 'Kindergarten', mode: 'ten_and_ones', topic: 'Teen numbers as a ten and some ones' },
    mounted: '[data-pip-object="board"]',
    current: currentStep,
  },
});

export const numberBondBoss = { ...numberBondBase, stepOf };
