import type { PlannerDebugPayload, RichExampleStep } from '../../primitives/annotated-example/types';

/** Consolidate identical adjacent algebra work before questions are assigned.
 * Matching results alone is insufficient: a different derivation/check stays. */
export function consolidateRepeatedAlgebra(steps: RichExampleStep[], planner: PlannerDebugPayload): void {
  const fingerprint = (step: RichExampleStep) => step.content.type === 'algebra'
    ? JSON.stringify([step.content.result.replace(/\s/g, ''), step.content.transitions.map(t => [t.from.latex.replace(/\s/g, ''), t.to.latex.replace(/\s/g, '')])])
    : undefined;
  for (let i = steps.length - 1; i > 0; i--) {
    const current = steps[i], prior = steps[i - 1];
    const key = fingerprint(current);
    if (!key || key !== fingerprint(prior) || current.challenge || prior.challenge) continue;
    if (current.content.type !== 'algebra' || prior.content.type !== 'algebra' || !current.content.transitions.length
      || [...current.content.transitions, ...prior.content.transitions].some(t => t.challenge)) continue;
    // Keep all teaching notes and any richer breakdown, without repeating math.
    for (const layer of ['steps', 'strategy', 'misconceptions', 'connections', 'narrative'] as const) {
      prior.annotations[layer] = Array.from(new Set([prior.annotations[layer], current.annotations[layer]].filter(Boolean))).join('\n\n');
    }
    current.content.transitions.forEach((t, idx) => {
      if ((t.subMoves?.length ?? 0) > (prior.content.type === 'algebra' ? prior.content.transitions[idx].subMoves?.length ?? 0 : 0)
        && prior.content.type === 'algebra') prior.content.transitions[idx].subMoves = t.subMoves;
    });
    prior.title = current.title;
    const priorSpec = planner.specs[i - 1], currentSpec = planner.specs[i];
    if (priorSpec && currentSpec) {
      priorSpec.title = prior.title;
      priorSpec.groundingBlockIndices = Array.from(new Set([...priorSpec.groundingBlockIndices, ...currentSpec.groundingBlockIndices])).sort((a, b) => a - b);
      priorSpec.pedagogicalGoal = [priorSpec.pedagogicalGoal, currentSpec.pedagogicalGoal].join(' ');
      priorSpec.seedNotes = [priorSpec.seedNotes, currentSpec.seedNotes].join(' ');
      planner.specs.splice(i, 1);
    }
    steps.splice(i, 1);
  }
  steps.forEach((step, i) => { step.id = i + 1; });
  planner.mergedCount = planner.specs.filter(s => s.groundingBlockIndices.length > 1).length;
}
