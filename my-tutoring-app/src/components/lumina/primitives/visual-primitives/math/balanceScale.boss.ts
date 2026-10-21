/**
 * balance-scale's boss, on the spoken preset (`components/live-activity/boss.ts`) and stepped: each challenge expands
 * into steps (`stepOf`). A hands step (place weights, set a known weight aside, share units) has no key, the scale
 * checks it, and it plays through `show`; a spoken step is a number (or, in two_step, an explanation) the tutor judges
 * against the key. The card is `balanceScale.card.ts`; this file holds the content check, the steps, the ask and key,
 * the levers and the harness play.
 */
import type { BalanceScaleData } from './BalanceScale';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { spokenNumber } from '../../../components/live-activity/runtime/spokenMissContract';
import { balanceScaleCard, type SpokenBalanceMiss } from './balanceScale.card';
import { BALANCE_LEVERS, balanceLeverCtx } from './balanceScaleLevers';
import { WEIGHTS } from './balanceEqualityModel';
import { TRAY } from './balanceWorkshopModel';
import { balanceAsk, balanceGiven, balanceItems, balanceKey, balanceSpokenMisses, balanceSurface, expectedOf,
  explainHarnessAnswers, isEqualityItem, stepOf, weightsFor, type BalanceItem } from './balanceScaleWorkspace';

/** Reject a scale whose challenges cannot be ASKED: one challenge type per session, each one its surface can run. */
export function validateBalanceScaleData(value: unknown): BalanceScaleData {
  const d = value as BalanceScaleData | null;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || d.challenges.some(c => !c || typeof c.type !== 'string' || typeof c.instruction !== 'string'
        || !Array.isArray(c.leftSide) || !Array.isArray(c.rightSide) || !Number.isFinite(c.variableValue)))
    throw new Error('Generated balance scale has invalid lesson content.');
  if (!balanceSurface(d)) throw new Error('A balance-scale session has one challenge type; this one mixes them.');
  try { if (!balanceItems(d).length) throw new Error('empty'); }
  catch { throw new Error('A balance-scale challenge cannot run in the lesson.'); }
  return d;
}

/** The step on screen: a session step, or the easier one a simplify lever opened (`<source>~simpler`). The practice
 *  target never depends on the learner's load beyond the lever being offered, so any load past the floor rebuilds it. */
function currentStep(ctx: JourneyContext): BalanceItem | undefined {
  const all = balanceItems(ctx.data as BalanceScaleData);
  const id = ctx.itemId ?? '';
  const own = all.find(i => i.id === id);
  if (own) return own;
  const parent = all.find(i => `${i.id}~simpler` === id);
  if (!parent) return undefined;
  const lever = balanceLeverCtx(all, 99);
  return BALANCE_LEVERS.specs.filter(s => s.type === 'easier')
    .map(s => BALANCE_LEVERS.simpler(parent, lever, s.id)).find((i): i is BalanceItem => !!i);
}

const add = (values: number[]): DriverInput[] => values.map(v => ({ type: 'choose', label: `Add ${v} weight` }));

const balanceScaleBase = spokenBoss<BalanceScaleData, BalanceItem, SpokenBalanceMiss>({
  card: balanceScaleCard,
  validate: validateBalanceScaleData,
  items: balanceItems,
  levers: BALANCE_LEVERS,
  speech: {
    ask: balanceAsk,
    // A hands step has no key: the scale checks it.
    key: balanceKey,
    given: balanceGiven,
    misses: balanceSpokenMisses,
    // Wrong is one more than the number asked for; the explanation's wrong answer is a number with no reason.
    say: item => {
      if (item.step === 'explain') return explainHarnessAnswers;
      const n = expectedOf(item) ?? 0;
      return { correct: spokenNumber(n), plainWrong: spokenNumber(n + 1) };
    },
    // Hands steps press the real controls after clearing the step. A hands step commits only when complete, so wrong
    // is an incomplete move (one weight short, one group filled) that stays exploration; the learner then claims it is
    // done, as a child does, and the tutor answers that claim.
    show: (right, item, ctx) => {
      const claim = (inputs: DriverInput[]): DriverInput[] => (right ? inputs
        : [...inputs, { type: 'answer', text: 'I think I am done.' }]);
      const short = (target: number, tray: readonly number[]) => weightsFor(right ? target : Math.max(0, target - 1), tray);
      if (isEqualityItem(item)) {
        const clear: DriverInput[] = Number(ctx.demand?.weightsOnRight ?? 0) > 0 ? [{ type: 'choose', label: 'Clear weights' }] : [];
        return claim([...clear, ...add(short(item.problem.target, WEIGHTS))]);
      }
      const reset: DriverInput = { type: 'choose', label: 'Reset this step' };
      const w = item.problem;
      if (item.step === 'separate') return claim([reset, { type: 'choose', label: `Set aside known ${w.known} weight` },
        ...Array.from({ length: right ? w.known : w.known - 1 }, (_, i): DriverInput => ({ type: 'choose', label: `Unit ${i + 1}` }))]);
      if (item.step === 'share') return claim([reset, ...Array.from({ length: right ? w.parcels : 1 }, (_, g) =>
        Array.from({ length: w.target }, (): DriverInput => ({ type: 'choose', label: `Place unit in group ${g + 1}` }))).flat()]);
      // A second combination must differ from the first (greedy), so it is all ones.
      if (item.step === 'recompose') return claim([reset, ...add(right ? Array(w.target).fill(1) : short(w.target, TRAY))]);
      return claim([reset, ...add(short(w.target, TRAY))]);
    },
  },
  drive: {
    component: 'primitives/visual-primitives/math/BalanceScale.tsx',
    instanceId: 'scale',
    defaults: { grade: 'Grade 1', mode: 'equality', topic: 'Balancing a mystery weight with numbered weights, then adding them' },
    mounted: '[aria-label="Balance scale workspace"]',
    current: currentStep,
  },
});

export const balanceScaleBoss = { ...balanceScaleBase, stepOf };
