import { compiledWorthContrast, placeValueRemediationMoveFor, placeValueRemediationRequestFor } from './placeValueRemediation';
import type { LearningObservationRetest } from '../../types';
import type { PlaceValueChartData } from '../../primitives/visual-primitives/math/PlaceValueChart';

/** Stable projection: excludes render callbacks, attribution injections and receipts. */
export function placeValueContentIdentity(data: PlaceValueChartData): string {
  return JSON.stringify({ challengeType: data.challengeType, supportTier: data.supportTier,
    challenges: data.challenges.map(c => ({ id: c.id, targetNumber: c.targetNumber,
      highlightedDigitPlace: c.highlightedDigitPlace, minPlace: c.minPlace, maxPlace: c.maxPlace })) });
}

/** Private server metadata. Compiler drops/caps take precedence over selection. */
export function certifyPlaceValueItems(data: PlaceValueChartData, focus: string) {
  if (placeValueRemediationMoveFor(data.challengeType, data.supportTier, focus) !== 'contrast_digit_worth') return null;
  if (data.challenges.some(c => !Number.isInteger(c.targetNumber) || c.targetNumber < 1111 || c.targetNumber > 9999)) return null;
  const compiled = compiledWorthContrast(data.challenges);
  if (compiled.count !== 2) return null;
  const targets = new Set(compiled.targets.map(i => i.id));
  return compiled.items.map(i => ({ id: i.id, kind: i.kind, target_number: i.targetNumber,
    place: i.place, digit: i.digit, answer_text: i.answerText, eligible: targets.has(i.id),
    // The backend judges transcripts against these; it carries no place-value arithmetic.
    accepted_answers: i.kind === 'say_value' ? [i.answerText, String(i.digit * 10 ** i.place)] : [i.answerText] }));
}

/** Safe enum/count diagnostics; never diagnosis prose or answer-bearing fields. */
export function placeValueOpportunityOutcome(data: PlaceValueChartData, focus: string) {
  if (placeValueRemediationMoveFor(data.challengeType, data.supportTier, focus) !== 'contrast_digit_worth') return 'unsupported-focus-or-mode';
  if (data.challenges.some(c => !Number.isInteger(c.targetNumber) || c.targetNumber < 1111 || c.targetNumber > 9999)) return 'incompatible-range';
  return compiledWorthContrast(data.challenges).count === 2 ? 'compiled-eligible' : 'insufficient-compiled-opportunities';
}

/** Delivery gate on the manifest config: the certified retest runs on compare at medium. */
export function placeValueDeliveryEligible(config: Record<string, unknown>): boolean {
  return config.targetEvalMode === 'compare' && config.difficulty === 'medium';
}

/** Catalog retest declaration: an immediate certified retest of the bare-digit-for-worth hypothesis. */
export const placeValueRetest: LearningObservationRetest = {
  capabilityId: 'digit_face_value_for_worth', capabilityVersion: 1,
  policyVersion: 'place-value-immediate-retest-v1', compilerVersion: 'place-value-items-v1',
  certify(data: PlaceValueChartData, request) {
    if (data.learningAdaptation?.move !== 'contrast_digit_worth') return null;
    if (!placeValueRemediationRequestFor({ grade: request.grade, topic: request.topic, intent: request.intent,
      objectiveText: request.objectiveText, mode: data.challengeType, tier: data.supportTier, focus: request.focus })) return null;
    const items = certifyPlaceValueItems(data, request.focus);
    console.info('[PlaceValue opportunity]', { outcome: placeValueOpportunityOutcome(data, request.focus) });
    return items ? { items, contentIdentity: placeValueContentIdentity(data), mode: data.challengeType, tier: data.supportTier } : null;
  },
};
