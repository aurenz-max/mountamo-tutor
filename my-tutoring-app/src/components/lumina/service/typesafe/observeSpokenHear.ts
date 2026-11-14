import 'server-only';
import { hearBlind } from './hearWordBlind';
import { hearCandidates } from './blindWordCandidates';
import { abstainSpokenHear, HEAR_GATE, missOfHearing, type SpokenHearDecision, type SpokenHearRequest }
  from '../../components/live-activity/runtime/spokenHearContract';

/** `spoken_hear` (`spokenHearContract.ts`): the blind choice over the item's options, read back by code. */
export async function observeSpokenHear(input: SpokenHearRequest, signal?: AbortSignal): Promise<SpokenHearDecision> {
  const options = hearCandidates(input.hear, input.misses);
  if (!options) return abstainSpokenHear('too few options to hear blind');
  const { candidates, setting } = options;
  const h = await hearBlind(candidates, input.audioBase64, setting, signal);
  if (h.error || !h.heard || h.p === null) return abstainSpokenHear(h.error ? `unavailable: ${h.error}` : 'no pick', h.ms);
  const accepted = h.p >= HEAR_GATE;
  const miss = accepted ? missOfHearing(h.reading, h.heard, input.misses) : null;
  const said = candidates.find(c => c.key === h.heard)?.says ?? h.heard;
  return { miss, reading: h.reading, p: h.p, accepted, heard: h.heard, top: h.top, ms: h.ms, model: 'gemini-decision-1',
    reason: `Heard "${h.heard}" (${h.p.toFixed(2)}): ${said} Read as ${h.reading}${accepted ? '' : `, below the ${HEAR_GATE} gate`}.` };
}
