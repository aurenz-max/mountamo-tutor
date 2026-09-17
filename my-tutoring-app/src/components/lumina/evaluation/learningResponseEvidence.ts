/** A judged response, not an inference about ability. Transcription can be noisy. */
export interface LearningResponseEvidence {
  itemId: string;
  phase: string;
  challenge: string;
  expected: string;
  observed: string;
  verdict: 'affirmed' | 'corrected';
  source: 'voice' | 'gesture';
  priorCorrections: number;
  /** Run-wide count at response time; deliberately not attributed to this item. */
  hearTapsSoFar: number;
  support: string;
}

/** Untrusted HTTP input: bound the packet and require actual successful evidence. */
export function eligibleLearningResponses(value: unknown): LearningResponseEvidence[] {
  if (!Array.isArray(value) || value.length > 100) return [];
  const rows = value.filter((r): r is LearningResponseEvidence => !!r &&
    ['itemId', 'phase', 'challenge', 'expected', 'observed', 'support'].every(k =>
      typeof r[k] === 'string' && r[k].trim().length > 0 && r[k].length <= 2000) &&
    ['affirmed', 'corrected'].includes(r.verdict) && ['voice', 'gesture'].includes(r.source) &&
    Number.isInteger(r.priorCorrections) && r.priorCorrections >= 0 &&
    Number.isInteger(r.hearTapsSoFar) && r.hearTapsSoFar >= 0);
  // Repetition within one corrected item is not corroboration across tasks.
  const successful = rows.filter(r => r.verdict === 'affirmed');
  const phases = new Set(successful.map(r => r.phase));
  if (!Array.from(phases).some(phase => new Set(successful.filter(r => r.phase === phase).map(r => r.itemId)).size >= 2)) return [];
  return rows.slice(-40);
}

/** Optional TypeSafe verification of the draft (service/typesafe/verify.ts); see LUMINA_TYPESAFE_VERIFY. */
export type LearningObservationVerification = import('../service/typesafe/verify').Verification;

export type LearningObservationDraft = { abstain: true; reason: string; verification?: LearningObservationVerification } | {
  abstain: false;
  kind: 'strength' | 'support';
  summary: string;
  teachingImplication: string;
  checkNext: string;
  evidenceItemIds: string[];
  verification?: LearningObservationVerification;
};
