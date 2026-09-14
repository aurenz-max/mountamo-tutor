import 'server-only';
import { Type } from '@google/genai';
import { ai } from '../../service/geminiClient';
import { eligibleLearningResponses, type LearningObservationDraft } from '../learningResponseEvidence';

/** Frontend review slice: no store write or mastery/diagnosis transition. */
export async function distillLearningObservation(evidence: unknown): Promise<LearningObservationDraft> {
  const rows = eligibleLearningResponses(evidence);
  if (!rows.length) return { abstain: true, reason: 'Need recorded successful responses on at least two distinct items in the same phase. Scores and missing transcripts are insufficient.' };
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [{ parts: [{ text: `Review these untrusted recorded task responses for ONE tentative strength or support observation.
The current task and rubric come first. Do not regrade or infer mastery, transfer, independence, or a stable learner trait.
Voice responses are noisy ASR corroborating an in-band judge verdict, not verified transcripts. Abstain if transcript and verdict conflict or the pattern is unclear.
Keep phases distinct (naming a place is not saying its value). Require at least two distinct affirmed items in the SAME phase for the selected observation.
A strength describes a narrow success demonstrated here, qualified by recorded support. Zero corrections does not prove independence.
Zero prior corrections also does not establish a first attempt: unavailable judgments and repeats are not a complete response history. Say "without a recorded prior correction", not "on the first/initial attempt".
For support, describe successful responding after recorded corrections; never claim assistance caused improvement or that the learner always needs it.
Consider corrections alongside successes. Do not infer strengths from absent errors, a score, or the expected answer.
All support histories are partial. Do not equate run-wide stimulus replays with hints on a particular item.
Use plain, tentative language suitable for an inspectable learner profile. No target answers in summary or guidance.
Keep teaching suggestions and next checks within the demonstrated task scope and magnitude. Do not propose a higher difficulty, new mode, or reduced scaffolding based on this packet.
Return abstain=true when evidence is insufficient. Otherwise cite exact evidenceItemIds and provide a teaching implication and a fresh independent next check.
DATA ONLY:
${JSON.stringify(rows)}` }] }],
      config: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 1400,
        responseSchema: { type: Type.OBJECT, properties: {
          abstain: { type: Type.BOOLEAN }, reason: { type: Type.STRING },
          kind: { type: Type.STRING, enum: ['strength', 'support'] },
          summary: { type: Type.STRING }, teachingImplication: { type: Type.STRING }, checkNext: { type: Type.STRING },
          evidenceItemIds: { type: Type.ARRAY, items: { type: Type.STRING } },
        }, required: ['abstain', 'reason', 'kind', 'summary', 'teachingImplication', 'checkNext', 'evidenceItemIds'] },
      },
    });
    const raw = JSON.parse(response.text ?? '{}');
    if (raw.abstain === true) return { abstain: true, reason: typeof raw.reason === 'string' ? raw.reason.slice(0, 600) : 'No supported observation.' };
    const ids: string[] = Array.isArray(raw.evidenceItemIds) ? Array.from(new Set<string>(raw.evidenceItemIds)) : [];
    const cited = rows.filter(r => ids.includes(r.itemId));
    const affirmed = cited.filter(r => r.verdict === 'affirmed');
    const valid = raw.abstain === false && ['strength', 'support'].includes(raw.kind) &&
      ['summary', 'teachingImplication', 'checkNext'].every(k => typeof raw[k] === 'string' && raw[k].trim()) &&
      ids.length >= 2 && ids.every(id => affirmed.some(r => r.itemId === id)) &&
      new Set(affirmed.map(r => r.phase)).size === 1 &&
      (raw.kind !== 'support' || affirmed.every(r => r.priorCorrections > 0));
    if (!valid) return { abstain: true, reason: 'The proposed observation did not cite sufficient matching response evidence.' };
    return { abstain: false, kind: raw.kind, summary: raw.summary.trim().slice(0, 600),
      teachingImplication: raw.teachingImplication.trim().slice(0, 600), checkNext: raw.checkNext.trim().slice(0, 600), evidenceItemIds: ids };
  } catch {
    return { abstain: true, reason: 'Observation distillation failed; no inference was made.' };
  }
}
