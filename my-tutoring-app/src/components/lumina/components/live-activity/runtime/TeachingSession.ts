/**
 * Teaching state independent of speech, React, subjects, and transport.
 * The activity checks a response; the tutor decides what to do with that result.
 * Neither a sentence, a help request, nor elapsed time is a response or progression.
 */
export interface TeachingAttempt {
  itemId: string;
  response: string;
  tutorResponse?: string;
  judgment?: 'tutor' | 'activity';
  source: 'speech' | 'gesture';
  correct: boolean;
  assisted: boolean;
  answerExposure: 'none' | 'partial' | 'full';
}
export interface TeachingState {
  index: number;
  phase: 'working' | 'checked' | 'completed';
  assisted: boolean;
  answerExposure: 'none' | 'partial' | 'full';
  lastResponse: TeachingAttempt | null;
  attempts: readonly TeachingAttempt[];
}

/** Session-local presentation data, not a persisted evaluation or mastery result. */
export interface TeachingSummary {
  solvedCount: number;
  outcomes: Array<{ id: string; solved: boolean; corrections: number; attempts: number; score: number; assisted: boolean }>;
}

export function teachingSummary(itemIds: readonly string[], state: TeachingState): TeachingSummary | null {
  if (state.phase !== 'completed') return null;
  const outcomes = itemIds.map(id => {
    const attempts = state.attempts.filter(a => a.itemId === id);
    const solved = attempts.some(a => a.correct);
    const corrections = attempts.filter(a => !a.correct).length;
    // Keep the existing counting summary's 100/67/33 practice scale.
    return { id, solved, corrections, attempts: attempts.length, assisted: attempts.some(a => a.assisted),
      score: solved ? corrections === 0 ? 100 : corrections === 1 ? 67 : 33 : 0 };
  });
  return { solvedCount: outcomes.filter(o => o.solved).length, outcomes };
}

export class TeachingSession {
  private state: TeachingState = { index: 0, phase: 'working', assisted: false, answerExposure: 'none', lastResponse: null, attempts: [] };
  private listeners = new Set<() => void>();
  private responses = new Set<string>();
  constructor(private readonly itemIds: readonly string[]) {
    if (!itemIds.length || new Set(itemIds).size !== itemIds.length) throw new Error('Teaching items need unique identities');
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<TeachingState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }
  /** Assistance remains true for the item after aids are hidden or work is reset. */
  assist(answerExposure: TeachingState['answerExposure'] = 'none') {
    if (this.state.phase === 'completed') return false;
    const rank = { none: 0, partial: 1, full: 2 };
    this.publish({ assisted: true, answerExposure: rank[answerExposure] > rank[this.state.answerExposure] ? answerExposure : this.state.answerExposure });
    return true;
  }
  submit(responseId: string, response: string, source: TeachingAttempt['source'], correct: boolean, spokenCorrection = false, tutorResponse?: string) {
    if (this.responses.has(responseId)) return false;
    // A new, recognizable spoken correction is itself another attempt. It must not
    // disappear because the child answered faster than the dialogue observer.
    const correcting = spokenCorrection && source === 'speech' && this.state.phase === 'checked' && this.state.lastResponse?.correct === false;
    if (this.state.phase !== 'working' && !correcting) return false;
    this.responses.add(responseId);
    const attempt: TeachingAttempt = { itemId: this.itemIds[this.state.index], response, source, correct,
      ...(tutorResponse ? { tutorResponse, judgment: 'tutor' as const } : {}),
      assisted: this.state.assisted, answerExposure: this.state.answerExposure };
    this.publish({ phase: 'checked', lastResponse: attempt, attempts: [...this.state.attempts, attempt] });
    return true;
  }
  retry() {
    if (this.state.phase !== 'checked') return false;
    this.publish({ phase: 'working' });
    return true;
  }
  advance() {
    if (this.state.phase !== 'checked' || !this.state.lastResponse?.correct) return false;
    const last = this.state.index === this.itemIds.length - 1;
    this.publish({ phase: last ? 'completed' : 'working', index: last ? this.state.index : this.state.index + 1,
      assisted: last ? this.state.assisted : false, answerExposure: last ? this.state.answerExposure : 'none',
      lastResponse: last ? this.state.lastResponse : null });
    return true;
  }
}
