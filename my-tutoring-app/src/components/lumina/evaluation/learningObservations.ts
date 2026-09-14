/** Frontend product contract. Observations are hypotheses with provenance, not grades. */
export interface LearningObservation {
  id: string;
  kind: 'pattern' | 'strength' | 'support';
  status: 'suspected' | 'supported' | 'resolved';
  summary: string;
  problem?: string;
  primitiveType?: string;
  evalMode?: string;
  subject: string;
  grade: string;
  subskillId: string;
  evidence: Array<{ attemptId: string; task: string; response: string; support: string; phase?: string; itemId?: string; referenceKind?: 'client-attempt' }>;
  updatedAt: string;
  teachingImplication: string;
  checkNext: string;
}

export interface LearningActivityScope {
  componentId: string;
  subject: string;
  grade: string;
  subskillId: string;
  evalMode: string;
}

/** Exact curriculum scope is intentional until cross-skill relevance is validated. */
export function selectLearningObservations(observations: LearningObservation[], activity: LearningActivityScope) {
  return observations.map(observation => {
    const reason = observation.status === 'resolved' ? 'Resolved; retained as history'
      : observation.subject !== activity.subject ? 'Different subject'
      : observation.grade !== activity.grade ? 'Different grade'
      : observation.subskillId !== activity.subskillId ? 'Different learning objective'
      : 'Matches this activity’s subject, grade and learning objective';
    return { observation, selected: reason.startsWith('Matches'), reason };
  });
}

export function buildLearningContext(observations: LearningObservation[], activity: LearningActivityScope) {
  const selected = selectLearningObservations(observations, activity).filter(row => row.selected);
  const observationsForActivity = selected.map(({ observation: o }) => ({
    id: o.id, kind: o.kind, status: o.status, summary: o.summary,
    evidenceAttemptIds: o.evidence.map(e => e.attemptId),
  }));
  return {
    activity,
    generation: {
      observations: observationsForActivity,
      guidance: selected.map(({ observation: o }) => o.teachingImplication),
      nextChecks: selected.map(({ observation: o }) => o.checkNext),
      constraint: 'Preserve the selected objective, evaluation mode and supported primitive interactions.',
    },
    evaluation: {
      observations: observationsForActivity,
      instruction: 'Judge the current response against the current problem and rubric first. Use prior observations only to interpret evidence and tailor feedback. A prior hypothesis never overrides a correct answer. Distinguish independent responses from hints and corrections; abstain when evidence is insufficient.',
    },
  };
}
