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
import { DEFAULT_RAMP_CHALLENGES, measureRampTrial, type RampChallenge, type RampInvestigationChallenge, type RampScenario } from './rampChallenges';

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
      expectedAnswer: `A true comparison that connects the changed ${VARIABLE[c.variable]} to both trials: ${rampConclusion(c)}` };
  }
  return { id: c.id, task: c.brief, response: 'gesture' };
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
