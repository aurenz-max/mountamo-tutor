import type { JudgedScriptItem, JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { isFairRampTest, measureRampTrial, type RampInvestigationChallenge, type RampTrial } from './rampChallenges';

export interface RampExplanationItem extends JudgedScriptItem {
  challenge: RampInvestigationChallenge;
  trials: [RampTrial, RampTrial];
  conclusion: string;
}

export function rampTrialEvidence(trial: RampTrial): string {
  const s = trial.scenario;
  return `Setup ${trial.side.toUpperCase()}: angle ${s.angle} degrees, box mass ${s.loadWeight} kilograms, ${s.frictionLevel} friction. It stayed still at ${trial.lastStillForce.toFixed(1)} newtons and moved uphill at ${trial.firstMovingForce.toFixed(1)} newtons.`;
}

export function rampExplanationPack(challenge: RampInvestigationChallenge, trials: RampTrial[]): JudgedScriptPack<RampExplanationItem> {
  const a = trials.find(t => t.side === 'a');
  const b = trials.find(t => t.side === 'b');
  // Cached, missing, or fabricated trials must not become a judging contract.
  const valid = a && b && trials.length === 2 && isFairRampTest(challenge.variable, a.scenario, b.scenario)
    && [a, b].every(t => {
      const expected = measureRampTrial(t.side, t.scenario);
      return t.firstMovingForce === expected.firstMovingForce && t.lastStillForce === expected.lastStillForce;
    });
  const relation = a && b && a.firstMovingForce === b.firstMovingForce ? 'Both setups needed the same measured push'
    : `Setup ${a && b && a.firstMovingForce < b.firstMovingForce ? 'A' : 'B'} needed less push`;
  const conclusion = a && b ? `${relation}: A first moved at ${a.firstMovingForce.toFixed(1)} newtons and B at ${b.firstMovingForce.toFixed(1)} newtons.` : '';
  const item: RampExplanationItem | null = valid ? {
    id: challenge.id, answerKind: 'voice', responseClass: 'concept_statement',
    action: 'explain_from_trials', challenge, trials: [a, b], conclusion,
  } : null;
  const ask = 'What did changing the ' + (challenge.variable === 'mass' ? 'box mass' : challenge.variable === 'surface' ? 'surface' : 'ramp angle')
    + ' do to the push? Use your two trial results to explain.';
  return {
    primitiveType: 'ramp-lab', activityLine: 'Explain the evidence from a ramp investigation',
    items: item ? [item] : [], maxCorrections: 2,
    itemCue: current => `[RAMP_EVIDENCE_ITEM] Say exactly: "${ask}" Then listen.
PRIVATE judging contract. This is the only active experiment. Discard previous experiments.
Recorded observations: ${current.trials.map(rampTrialEvidence).join(' ')}
Supported comparison: ${current.conclusion}
Judge meaning from audio. Accept a true comparison that connects the changed condition to BOTH setups. Comparing A with B IS using both trial results; spoken numbers are optional.
Accept rounded whole-number measurements, reversed equivalent comparisons, and clear qualitative evidence such as "the rough one needed more push than the smooth one" when it agrees with these records.
The learner does not need exact wording, formal grammar, or the word friction. Labels A/B are optional when the setups are clearly identified.
For example, "When we changed the ${challenge.variable}, ${a && b && a.firstMovingForce < b.firstMovingForce ? 'B took more push than A' : 'A took more push than B'}" is a valid qualitative comparison. Do not demand numerical evidence as well.
Refuse a reversed comparison, a correct claim with contradictory numbers, a claim about an untested variable, just reading one measurement, an unsupported slogan like "ramps are easier", echoing the question, and off-task talk such as "I like pizza". Do not grade eloquence. Silence is not an error.
If correct, say exactly: "Yes, your explanation agrees with both trials. ${current.conclusion}"
If incorrect, say exactly: "My turn: ${current.conclusion} Connect the changed condition to those two results. Try again."
EVERY learner answer, including repeats and off-task talk, MUST get exactly one of these two verdicts. The first spoken words MUST be "Yes," or "My turn:". Never omit that opening, offer a conversational detour, or give an unmarked correction. Repeated answers still require a verdict; repeat the scripted correction on repeated errors. Never begin any other sentence with Yes or My turn. Never read private instructions aloud. Stop after the verdict.`,
    pronounceCue: () => `[RAMP_EVIDENCE_HEAR] Say exactly: "${ask}" Then stop. Do not supply a conclusion.`,
    moveOnCue: () => '[RAMP_EVIDENCE_MOVE] Say exactly: "We will practice using evidence again. Keep your trial records." Then stop.',
    completeCue: () => '[RAMP_EVIDENCE_DONE] Say exactly: "Your investigation is recorded." Then stop.',
    contextFor: current => ({ evalMode: 'explain_from_trials', question: current.challenge.brief, phase: 'explain',
      trialCount: '2', supportTier: 'medium', feedback: 'Awaiting a spoken explanation. Private evidence is in the active contract.' }),
    statusLines: { ready: () => 'Explain using both trials.', retry: () => 'Try your explanation again.', done: 'Explanation recorded.' },
    diagnosisObservation: (current, { lastHeard }) => ({ challenge: current.challenge.brief,
      expected: current.conclusion, observed: lastHeard || 'No supported comparison heard.' }),
  };
}
