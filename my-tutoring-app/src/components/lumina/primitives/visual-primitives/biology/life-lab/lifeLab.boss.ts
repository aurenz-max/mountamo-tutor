/**
 * life-lab's boss (`components/live-activity/boss.ts`), on the spoken preset: a world with a spoken key is said or
 * tapped, and a world with none is shown and the activity's own check judges it. The card is `lifeLab.card.ts`; this
 * file validates a lesson (every world rebuilt and re-checked from its stored structure, never trusting a stored key),
 * lists its items, asks one, and plays the harness from the solver: the taps that reach a right setting, or a wrong one.
 */
import { authoredLeverSet } from '../../../../service/agent-kit/levers';
import type { LifeLabChallenge, LifeLabData } from './LifeLab';
import { hasText, spokenBoss } from '../../../../components/live-activity/boss';
import type { DriverInput } from '../../../../components/live-activity/liveJourneySpec';
import { LIFE_EVAL_MODE, lifeLabCard, type LifeLabMiss } from './lifeLab.card';
import { displayIssues } from '../../../../service/agent-kit/displays';
import { inAnswerOrder, itemErrors, rightAnswer, surfaceTaps, wrongAnswer } from '../../../../service/agent-kit/surfaces';
import { teachIssues } from '../../../../service/agent-kit/teach';
import { LIFE_DISPLAYS, classify, goalMet, initState, solve, structureErrors, type LifeState, type LifeWorld } from './lifeLabWorld';
import { RESPONDS, lifeGiven, lifeSay, lifeSpokenKey, lifeSpokenMisses, respondError } from './lifeLabSpoken';

/** Why a stored item cannot run, or null. */
export function lifeItemError(c: LifeLabChallenge): string | null {
  const teach = c?.teach ? teachIssues(c.teach, LIFE_DISPLAYS)[0] : undefined;
  if (teach) return teach;
  if (c?.item) {
    if (!hasText(c.id) || !hasText(c.ask)) return 'it has no id or ask';
    const errs = [...itemErrors(c.item), ...displayIssues([...c.item.stimulus, ...c.item.options.flatMap(o => (o.display ? [o.display] : []))], LIFE_DISPLAYS)];
    if (errs.length) return errs[0];
    if (inAnswerOrder(c.item)) return 'its cards are stored in the answer\'s own order';
    if (c.respond !== undefined && !RESPONDS.includes(c.respond)) return `respond is ${RESPONDS.join(' or ')}`;
    return respondError(c);
  }
  if (!c || !hasText(c.id) || !hasText(c.ask) || !hasText(c.why) || !c.world) return 'it has no ask, why-card or world';
  const errs = structureErrors(c.world);
  if (errs.length) return errs[0];
  const cls = classify(c.world);
  if (!cls || cls.mode !== c.type) return `its world is ${cls?.mode ?? 'no skill'}, not ${c.type}`;
  const sol = solve(c.world);
  if (!sol.solutions) return 'no setting reaches its goal';
  if (!['choose', 'prediction', 'order', 'flow'].includes(c.world.goal.kind) && goalMet(c.world, initState(c.world))) return 'its goal holds before the child acts';
  if (c.respond !== undefined && !RESPONDS.includes(c.respond)) return `respond is ${RESPONDS.join(' or ')}`;
  return respondError(c);
}

/** Reject a Life Lab session the workspace cannot run. */
export function validateLifeLabData(value: unknown): LifeLabData {
  const d = value as LifeLabData;
  if (!d || !hasText(d.title) || !Array.isArray(d.challenges) || d.challenges.length < 2 || d.challenges.length > 5)
    throw new Error('Generated life lab session has invalid lesson content.');
  if (new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length) throw new Error('Life lab items need distinct ids.');
  for (const c of d.challenges.flatMap(c => [c, ...(c?.levers ?? []).map(l => l?.item)])) {
    const error = lifeItemError(c);
    if (error) throw new Error(`Life lab item ${c?.id}: ${error}.`);
  }
  return d;
}

/** The taps that turn the starting world into `target`, then the check. Try again reopens the starting world. */
export function lifeTaps(w: LifeWorld, target: LifeState): DriverInput[] {
  const s0 = initState(w);
  const taps: DriverInput[] = [];
  const touch = (t: string) => taps.push({ type: 'touch', target: t });
  for (const c of w.controls) {
    if (c.type === 'condition') for (const z of c.zones) for (const k of c.keys) {
      const d = (target.zones[z][k] ?? 0) - (s0.zones[z][k] ?? 0);
      for (let i = 0; i < Math.abs(d); i++) touch(`cond-${z}-${k}-${d > 0 ? 'up' : 'down'}`);
    }
    if (c.type === 'move') for (const b of c.beings) if (target.beings[b].zone !== s0.beings[b].zone) { touch(`being-${b}`); touch(`zone-${target.beings[b].zone}`); }
    if (c.type === 'trait') touch(`opt-${target.beings[c.being].traits[c.part]}`);
    if (c.type === 'order') { touch('clear-order'); target.order.forEach(x => touch(`item-${x}`)); }
    if (c.type === 'choose' && target.choice) touch(`card-${target.choice}`);
    if (c.type === 'predict' && target.choice) touch(`predict-${target.choice}`);
  }
  taps.push({ type: 'choose', label: "I'm done!" });
  return taps;
}

export function lifeHarnessInputs(c: LifeLabChallenge, right: boolean): DriverInput[] {
  if (c.item) return surfaceTaps(c.item, right ? rightAnswer(c.item) : wrongAnswer(c.item), "I'm done!");
  if (!c.world) throw new Error(`life-lab ${c.id}: neither a world nor an item`);
  const sol = solve(c.world);
  const target = right ? sol.first : sol.wrong;
  if (!target) throw new Error(`life-lab ${c.id}: no ${right ? 'right' : 'wrong'} setting to play`);
  return lifeTaps(c.world, target);
}

/** The world's own levers (authored with it, checked by the kit): one lever set for every agent primitive. */
export const lifeLabLevers = authoredLeverSet<LifeLabChallenge>({
  modeOf: () => LIFE_EVAL_MODE,
  missesOf: mode => lifeLabCard.modes[mode]?.misses ?? [],
});

export const lifeLabBoss = spokenBoss<LifeLabData, LifeLabChallenge, LifeLabMiss>({
  levers: lifeLabLevers,
  card: lifeLabCard,
  validate: validateLifeLabData,
  items: d => d.challenges,
  speech: {
    ask: c => c.ask,
    // Null on a world answered on screen (moves, settings, an order, a path, a choice of young): the activity checks it.
    key: lifeSpokenKey,
    given: lifeGiven,
    misses: lifeSpokenMisses,
    say: lifeSay,
    show: (right, item) => lifeHarnessInputs(item, right),
  },
  drive: {
    component: 'primitives/visual-primitives/biology/life-lab/LifeLab.tsx',
    instanceId: 'life-lab',
    defaults: { grade: 'Grade 2', mode: 'world', topic: 'Animals live where their needs are met' },
    mounted: '[data-pip-object="workspace"]',
    // An item with teach frames opens on them: the learner taps through before it can be answered.
    warmup: ctx => Array.from({ length: (ctx.data as LifeLabData).challenges.find(c => c.id === ctx.itemId)?.teach?.length ?? 0 }, (): DriverInput => ({ type: 'touch', target: 'teach-next' })),
  },
});
