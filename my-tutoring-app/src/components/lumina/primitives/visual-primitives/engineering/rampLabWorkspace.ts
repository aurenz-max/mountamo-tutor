/**
 * Ramp lab on the shared tutor/JEV teaching workspace (its wiring is `rampLab.card.ts` + `rampLab.boss.ts`). Every
 * challenge is one workspace item:
 *   - compare_conditions / find_threshold / design_with_budget: the lab's own check is the judge (no key reaches the
 *     tutor);
 *   - plan_fair_test: an unfair plan is a checked miss; a fair plan locks, the learner predicts and runs both trials,
 *     and recording the investigation is the checked success;
 *   - explain_from_trials: after the prediction and both trials, the learner explains aloud and the tutor judges the
 *     meaning against the comparison the deterministic trials support (`rampKey`).
 * Free exploration (`freeExplore`) is an ungraded sandbox and binds nothing.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { changedRampVariables, DEFAULT_RAMP_CHALLENGES, easierComparisonChoice, maxWorkableAngle, measureRampTrial, minimumPushSetting,
  type RampChallenge, type RampInvestigationChallenge, type RampScenario } from './rampChallenges';
import type { RampMiss } from './rampLab.card';

export { RAMP_MISSES_BY_MODE, type RampLabMiss, type RampMiss, type RampSpokenMiss } from './rampLab.card';

const VARIABLE: Record<RampInvestigationChallenge['variable'], string> = {
  mass: 'box mass', surface: 'surface', angle: 'ramp angle',
};

/** Both trials, measured exactly as the test bench measures them. */
const trialsOf = (c: RampInvestigationChallenge) =>
  [measureRampTrial('a', c.scenarios.a).firstMovingForce, measureRampTrial('b', c.scenarios.b).firstMovingForce] as const;

/** The comparison both trials support, computed exactly as the test bench measures them. */
export function rampConclusion(c: RampInvestigationChallenge): string {
  const [a, b] = trialsOf(c);
  const relation = a === b ? 'Both setups needed the same push' : `Setup ${a < b ? 'A' : 'B'} needed less push`;
  return `${relation}: A first moved at ${a.toFixed(1)} newtons and B at ${b.toFixed(1)} newtons.`;
}

export const explainAsk = (c: RampInvestigationChallenge) =>
  `What did changing the ${VARIABLE[c.variable]} do to the push? Use your two trial results to explain.`;

/** What the learner is asked on one item. Never the answer. */
export const rampAsk = (c: RampChallenge): string => (c.mode === 'explain_from_trials'
  ? `${c.brief} Predict, run both trials, then explain aloud: ${explainAsk(c)}` : c.brief);

/**
 * An explanation's key, judged on meaning: the changed condition linked to both trials. Null on every other mode: the
 * lab checks it.
 */
export function rampKey(c: RampChallenge): SpokenKey | null {
  if (c.mode !== 'explain_from_trials') return null;
  const [a, b] = trialsOf(c);
  const [less, more] = a < b ? ['A', 'B'] : ['B', 'A'];
  const same = a === b;
  return {
    answer: same ? 'Both setups needed the same push' : `Setup ${less} needed less push than setup ${more}`,
    alsoAccept: same ? [`Changing the ${VARIABLE[c.variable]} did not change the push`]
      : [`Setup ${more} needed more push than setup ${less}`],
    meaning: { idea: `Changing the ${VARIABLE[c.variable]} changed the push the trials measured: ${rampConclusion(c)}`,
      notIt: 'one trial\'s result read alone, a slogan such as "ramps make work easier", a claim about a condition that '
        + 'was not changed, or the question said back' },
    acceptRule: 'Numbers are optional, rounded numbers count, and the labels A and B are optional when the setups are '
      + 'clearly named (the rough one, the steeper one).',
  };
}

/**
 * What a not-credited spoken explanation shows (`RampSpokenMiss`), each with the trials' real direction.
 */
export function rampSpokenMisses(c: RampChallenge): KnownMiss[] {
  if (c.mode !== 'explain_from_trials') return [];
  const [a, b] = trialsOf(c);
  const evidence = `A first moved at ${a.toFixed(1)} newtons and B at ${b.toFixed(1)} newtons`;
  const one = { id: 'one_setup', pattern: `The trials show ${evidence}. The learner talks about one setup or one trial only, `
    + 'with no comparison to the other.', examples: [`Setup A moved at ${a.toFixed(1)} newtons.`] };
  if (a === b) return [one];
  const [less, more] = a < b ? ['A', 'B'] : ['B', 'A'];
  return [
    { id: 'reversed_comparison', pattern: `The trials show ${evidence}, so setup ${less} needed less push. The learner says setup `
      + `${more} needed less push, or that setup ${less} needed more.`, examples: [`Setup ${more} needed less push.`] },
    { id: 'said_same', pattern: `The trials show ${evidence}. The learner says both setups needed the same push, or that the `
      + `${VARIABLE[c.variable]} made no difference.`, examples: ['They both needed the same push.'] },
    one,
  ];
}

/** The journey's spoken answers: the supported comparison, or its reverse (on equal trials, a made-up difference). */
export function rampHarnessAnswers(c: RampInvestigationChallenge): { correct: string; plainWrong: string } {
  const [a, b] = trialsOf(c);
  const plainWrong = a === b ? 'Setup A needed less push than setup B.' : `Setup ${a < b ? 'B' : 'A'} needed less push than setup ${a < b ? 'A' : 'B'}.`;
  return { correct: rampConclusion(c), plainWrong };
}

const PLAN_KEY = { angle: 'angle', surface: 'frictionLevel', mass: 'loadWeight' } as const;

export function rampMiss(c: RampChallenge, work: { choice?: string | null; push?: number; angle?: number; planB?: RampScenario }): RampMiss | undefined {
  switch (c.mode) {
    case 'compare_conditions': {
      const right = easierComparisonChoice(c);
      if (!work.choice || work.choice === right) return undefined;
      return right === 'same' ? 'one_for_same' : work.choice === 'same' ? 'same_for_different' : 'harder_setup';
    }
    case 'find_threshold': {
      const answer = minimumPushSetting(c.scenario, c.forceStep);
      if (work.push == null || Math.abs(work.push - answer) < 0.001) return undefined;
      return work.push < answer ? 'load_did_not_move' : 'more_than_minimum';
    }
    case 'design_with_budget': {
      const answer = maxWorkableAngle(c.scenario, c.forceBudget, c.angleRange);
      if (work.angle == null || work.angle === answer) return undefined;
      return work.angle > answer ? 'over_budget' : 'not_steepest';
    }
    case 'plan_fair_test': {
      if (!work.planB) return undefined;
      const changed = changedRampVariables(c.scenarios.a, work.planB);
      if (!changed.length) return 'nothing_changed';
      if (!changed.includes(PLAN_KEY[c.variable])) return 'other_condition';
      return changed.length > 1 ? 'extra_condition' : undefined;
    }
    default: return undefined;
  }
}

const describeSetup = (s: RampScenario) => `${s.angle} degrees, ${s.loadWeight} kg, ${s.frictionLevel} friction`;

/** The learner's checked work in their terms, never the key. */
export const describeRampCheck = (mode: string, view: { choice?: string | null; push?: number; angle?: number;
  planB?: RampScenario; prediction?: string | null; trials?: number }) => {
  switch (mode) {
    case 'compare_conditions': return `Predicted setup ${(view.choice ?? '?').toUpperCase()} needs less push`;
    case 'find_threshold': return `Tested a push of ${view.push?.toFixed(1)} N`;
    case 'design_with_budget': return `Checked a ${view.angle} degree ramp`;
    default: return view.trials != null
      ? `Recorded the investigation: prediction ${view.prediction ?? 'none'}, ${view.trials} trials`
      : `Committed a plan with setup B at ${view.planB ? describeSetup(view.planB) : 'unknown'}`;
  }
};

/** The scene: the mode and the investigation's step. The moves are the card's; the levers write their own facts. */
export function rampScene(c: RampChallenge | RampInvestigationChallenge, view: { phase?: string }): SceneOf {
  return { objects: [], facts: { mode: c.mode, ...(view.phase ? { step: view.phase } : {}) } };
}

/** What Hear the question asks the tutor to say: the question only, never the conclusion. */
export const hearQuestionRequest = (c: RampInvestigationChallenge) =>
  `The learner asked to hear the question again. Say only this, once: "${explainAsk(c)}"`;

/** The challenges a mount runs: the generated list, else the legacy default set; free exploration runs none. */
export const rampItems = (data: { freeExplore?: boolean; challenges?: RampChallenge[] }): RampChallenge[] =>
  data.freeExplore ? [] : data.challenges?.length ? data.challenges : DEFAULT_RAMP_CHALLENGES;