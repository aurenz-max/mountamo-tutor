/**
 * ramp-lab's boss, on the spoken preset (`components/live-activity/boss.ts`): an explain_from_trials item is a spoken
 * explanation the tutor judges on meaning against the comparison both trials support; every other item has no key and
 * the lab checks it (a compare pick, a push or an angle on the controls, a fair-test plan), played through `show`. The
 * card is `rampLab.card.ts`; this file holds the content check, the items, the ask and key, the levers and the harness
 * play.
 */
import type { RampLabData } from './RampLab';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { rampLabCard, type RampLabMiss } from './rampLab.card';
import { RAMP_LEVERS, practiceFromId } from './rampLabLevers';
import { easierComparisonChoice, maxWorkableAngle, minimumPushSetting, type RampChallenge, type RampInvestigationChallenge } from './rampChallenges';
import { rampAsk, rampHarnessAnswers, rampItems, rampKey, rampSpokenMisses } from './rampLabWorkspace';

const MODES = ['compare_conditions', 'find_threshold', 'plan_fair_test', 'design_with_budget', 'explain_from_trials'];

/** Reject a lab the workspace cannot run: free exploration grades nothing, and every challenge needs a mode and a brief. */
export function validateRampLabData(value: unknown): RampLabData {
  const d = value as RampLabData;
  if (!d || typeof d.title !== 'string' || d.freeExplore) throw new Error('Ramp lab free exploration has no graded items.');
  const items = rampItems(d);
  if (!items.length || items.length > 12 || new Set(items.map(c => c?.id)).size !== items.length
      || items.some(c => !c || !MODES.includes(c.mode) || typeof c.brief !== 'string' || !c.brief.trim()))
    throw new Error('Generated ramp lab has invalid lesson content.');
  return d;
}

const steps = (n: number, up: string, down: string): DriverInput[] =>
  Array.from({ length: Math.abs(n) }, () => ({ type: 'choose', label: n > 0 ? up : down }));

export const rampLabBoss = spokenBoss<RampLabData, RampChallenge, RampLabMiss>({
  card: rampLabCard,
  validate: validateRampLabData,
  items: rampItems,
  levers: RAMP_LEVERS,
  speech: {
    ask: rampAsk,
    // Only an explanation is spoken; the lab checks every other item.
    key: rampKey,
    misses: rampSpokenMisses,
    say: c => rampHarnessAnswers(c as RampInvestigationChallenge),
    // An explanation: predict and run both trials first, unless the explain step is already open.
    before: (_c, ctx) => (ctx.demand?.step === 'explain' ? [] : [{ type: 'choose', label: 'Setup A' },
      { type: 'choose', label: 'Record prediction' }, { type: 'choose', label: 'Run trial A' },
      { type: 'choose', label: 'Run trial B' }, { type: 'choose', label: 'Explain my results' }]),
    // The lab's own controls. Threshold and design: Reset Challenge, then the step buttons to the answer or one step
    // past it, then check. Compare: the other setup is the wrong pick. The plan's selects have no driver input
    // (journey-sweep-baseline J1; RampLab.levers.workspace.test.tsx drives it).
    show: (right, c, ctx) => {
      if (c.mode === 'find_threshold') {
        const answer = minimumPushSetting(c.scenario, c.forceStep);
        const n = Math.round(((right ? answer : answer - c.forceStep) - ((ctx.data as RampLabData).pushForce ?? 0)) / c.forceStep);
        return [{ type: 'choose', label: 'Reset Challenge' }, ...steps(n, 'More push', 'Less push'), { type: 'choose', label: 'Test This Force' }];
      }
      if (c.mode === 'design_with_budget') {
        const answer = maxWorkableAngle(c.scenario, c.forceBudget, c.angleRange);
        return [{ type: 'choose', label: 'Reset Challenge' }, ...steps((right ? answer : answer + 1) - c.scenario.angle, 'Steeper', 'Gentler'),
          { type: 'choose', label: 'Check This Design' }];
      }
      if (c.mode === 'compare_conditions') {
        const key = easierComparisonChoice(c);
        const pick = right ? key : key === 'a' ? 'b' : 'a';
        return [{ type: 'choose', label: `Setup ${pick.toUpperCase()}` }, { type: 'choose', label: 'Reveal Force Evidence' }];
      }
      throw new Error(`ramp-lab ${c.mode} uses selects the driver cannot set; RampLab.levers.workspace.test.tsx drives it`);
    },
    modeOf: c => c.mode,
  },
  drive: {
    component: 'primitives/visual-primitives/engineering/RampLab.tsx',
    instanceId: 'ramp',
    defaults: { grade: 'Grade 3', mode: 'compare_conditions',
      topic: 'How the angle and surface of a ramp change the push needed to move a load' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the practice item (`~simpler`) rebuilt from its parent with the same builder.
    current: ctx => {
      const items = rampItems(ctx.data as RampLabData);
      return items.find(c => c.id === ctx.itemId) ?? practiceFromId(items, ctx.itemId ?? '') ?? undefined;
    },
  },
});
