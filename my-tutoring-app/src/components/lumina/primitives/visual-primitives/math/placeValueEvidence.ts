import type { PlaceValueItem } from './placeValueScript';

/** Called only for a corrected attempt. A scripted correction does not identify
 * what was heard; preserve contradictions instead of treating the script as ASR. */
export function placeValueVoiceObservation(item: PlaceValueItem, lastHeard: string | null) {
  const heard = lastHeard?.trim();
  const normalized = heard?.toLowerCase().replace(/[.!?]/g, '');
  const contradictory = normalized === item.answerText.toLowerCase()
    || (item.kind === 'say_value' && normalized === String(item.digit * 10 ** item.place));
  return {
    challenge: item.kind === 'find_place'
      ? `name the place of the ${item.digit} in ${item.targetNumber}`
      : `say the value of the ${item.digit} in ${item.targetNumber}`,
    expected: item.answerText,
    observed: !heard
      ? 'No reliable learner transcription was captured; the scripted correction is not evidence of the learner response.'
      : contradictory
        ? `Conflicting evidence: transcript "${heard}" matches the expected response, but the tutor issued a scripted correction. Do not infer a mathematical error from this attempt.`
        : heard,
  };
}
