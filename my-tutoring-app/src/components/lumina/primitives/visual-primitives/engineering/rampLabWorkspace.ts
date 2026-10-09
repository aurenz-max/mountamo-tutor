/**
 * Ramp lab on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch B3). Every challenge is one workspace item:
 *   - compare_conditions / find_threshold / design_with_budget: the lab's own check is the judge
 *     (a gesture; the key is never published);
 *   - plan_fair_test: an unfair plan is a checked miss; a fair plan locks, the learner predicts and
 *     runs both trials, and recording the investigation is the checked success;
 *   - explain_from_trials: after the prediction and both trials, the learner explains aloud and is
 *     judged against the conclusion the deterministic trials support.
 * Free exploration (`freeExplore`) is an ungraded sandbox and binds nothing.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { changedRampVariables, DEFAULT_RAMP_CHALLENGES, easierComparisonChoice, maxWorkableAngle, measureRampTrial, minimumPushSetting,
  type RampChallenge, type RampInvestigationChallenge, type RampScenario } from './rampChallenges';

const VARIABLE: Record<RampInvestigationChallenge['variable'], string> = {
  mass: 'box mass', surface: 'surface', angle: 'ramp angle',
};

/** The comparison both trials support, computed exactly as the test bench measures them. */
export function rampConclusion(c: RampInvestigationChallenge): string {
  const a = measureRampTrial('a', c.scenarios.a), b = measureRampTrial('b', c.scenarios.b);
  const relation = a.firstMovingForce === b.firstMovingForce ? 'Both setups needed the same push'
    : `Setup ${a.firstMovingForce < b.firstMovingForce ? 'A' : 'B'} needed less push`;
  return `${relation}: A first moved at ${a.firstMovingForce.toFixed(1)} newtons and B at ${b.firstMovingForce.toFixed(1)} newtons.`;
}

export const explainAsk = (c: RampInvestigationChallenge) =>
  `What did changing the ${VARIABLE[c.variable]} do to the push? Use your two trial results to explain.`;

export function rampAssignment(c: RampChallenge | RampInvestigationChallenge): TeachingAssignment {
  if (c.mode === 'explain_from_trials') {
    return { id: c.id, task: `${c.brief} Predict, run both trials, then explain aloud: ${explainAsk(c)}`, response: 'speech',
      expectedAnswer: `A true comparison that connects the changed ${VARIABLE[c.variable]} to both trials: ${rampConclusion(c)}`,
      misses: rampSpokenMisses(c) };
  }
  return { id: c.id, task: c.brief, response: 'gesture' };
}

/**
 * What a checked wrong answer shows (handoff 20), from the learner's work alone:
 *   - compare_conditions: `harder_setup` (picked the setup that needs more push), `same_for_different` (picked
 *     "same" when the pushes differ), `one_for_same` (picked one setup when both need the same push);
 *   - find_threshold: `load_did_not_move` (the push is below the threshold), `more_than_minimum` (it moves the
 *     load, but a smaller step would too);
 *   - design_with_budget: `over_budget` (too steep for the force budget), `not_steepest` (it works, but a
 *     steeper ramp would too);
 *   - plan_fair_test: `nothing_changed` (setup B equals A), `other_condition` (the requested condition is
 *     unchanged, another one changed), `extra_condition` (the requested condition and another one changed).
 * explain_from_trials is spoken: `rampSpokenMisses` below.
 */
export type RampMiss = 'harder_setup' | 'same_for_different' | 'one_for_same' | 'load_did_not_move' | 'more_than_minimum'
  | 'over_budget' | 'not_steepest' | 'nothing_changed' | 'other_condition' | 'extra_condition';

/**
 * What a not-credited spoken explanation shows (handoff 20 Part B), from the contract's refusal list: `reversed_comparison`
 * (says the setup that needed more push needed less), `said_same` (says both needed the same push when the trials differ),
 * `one_setup` (talks about one trial only). Slogans, echoes and off-task talk are not a pattern of the comparison.
 */
export type RampSpokenMiss = 'reversed_comparison' | 'said_same' | 'one_setup';

export function rampSpokenMisses(c: RampInvestigationChallenge): KnownMiss[] {
  if (c.mode !== 'explain_from_trials') return [];
  const a = measureRampTrial('a', c.scenarios.a), b = measureRampTrial('b', c.scenarios.b);
  const evidence = `A first moved at ${a.firstMovingForce.toFixed(1)} newtons and B at ${b.firstMovingForce.toFixed(1)} newtons`;
  const one = { id: 'one_setup', pattern: `The trials show ${evidence}. The learner talks about one setup or one trial only, `
    + 'with no comparison to the other.', examples: [`Setup A moved at ${a.firstMovingForce.toFixed(1)} newtons.`] };
  if (a.firstMovingForce === b.firstMovingForce) return [one];
  const [less, more] = a.firstMovingForce < b.firstMovingForce ? ['A', 'B'] : ['B', 'A'];
  return [
    { id: 'reversed_comparison', pattern: `The trials show ${evidence}, so setup ${less} needed less push. The learner says setup `
      + `${more} needed less push, or that setup ${less} needed more.`, examples: [`Setup ${more} needed less push.`] },
    { id: 'said_same', pattern: `The trials show ${evidence}. The learner says both setups needed the same push, or that the `
      + `${VARIABLE[c.variable]} made no difference.`, examples: ['They both needed the same push.'] },
    one,
  ];
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

const CONSTRAINTS: Record<string, string> = {
  compare_conditions: 'The learner picks the setup they predict needs less push and presses Reveal Force Evidence; '
    + 'the lab checks the prediction and then shows the force evidence.',
  find_threshold: 'The learner sets the push slider and presses Test This Force; the lab checks whether it is the '
    + 'smallest step that moves the load.',
  design_with_budget: 'The learner sets the ramp angle and presses Check This Design; the lab checks whether it is the '
    + 'steepest ramp the force budget can climb.',
  plan_fair_test: 'The learner edits setup B so only the requested variable differs and presses Commit my plan; the lab '
    + 'checks the plan. Then they predict, run both trials and press Record investigation.',
  explain_from_trials: 'The learner predicts, runs both trials, then explains the result aloud. The trial notebook '
    + 'stays on screen.',
};

export function rampScene(c: RampChallenge | RampInvestigationChallenge, view: { phase?: string }): WorkspaceScene {
  return { objects: [], facts: {
    mode: c.mode,
    ...(view.phase ? { step: view.phase } : {}),
    constraints: CONSTRAINTS[c.mode] ?? 'The learner works the lab and checks it.',
  } };
}

/** What Hear the question asks the tutor to say: the question only, never the conclusion. */
export const hearQuestionRequest = (c: RampInvestigationChallenge) =>
  `The learner asked to hear the question again. Say only this, once: "${explainAsk(c)}"`;

/** The challenges a mount runs: the generated list, else the legacy default set; free exploration runs none. */
export const rampItems = (data: { freeExplore?: boolean; challenges?: RampChallenge[] }): RampChallenge[] =>
  data.freeExplore ? [] : data.challenges?.length ? data.challenges : DEFAULT_RAMP_CHALLENGES;

/** The journey's gesture inputs need the key; they live here, beside the checks the lab runs. */
export { easierComparisonChoice, maxWorkableAngle, minimumPushSetting } from './rampChallenges';
