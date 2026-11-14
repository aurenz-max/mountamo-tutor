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
  /** The levers pulled on this item before this attempt, in pull order. Absent when none were. */
  levers?: string[];
  /** Work on a simpler item a simplify lever opened: ungraded, never an outcome of a session item. */
  practice?: true;
  /**
   * What a wrong gesture shows, computed by the primitive's own check from the learner's work: an id naming
   * the observable pattern (`one_short`, `second_jump_off`), never a guessed cause. Levers declare the misses
   * they answer, so which lever comes next is code, testable without a model. Absent when correct or unnamed.
   */
  miss?: string;
}
export interface TeachingState {
  index: number;
  phase: 'working' | 'checked' | 'completed';
  assisted: boolean;
  answerExposure: 'none' | 'partial' | 'full';
  /** Levers pulled on the current session item. Kept through retry and a simpler item; cleared on advance. */
  levers: readonly string[];
  /** The id of the simpler item on screen in place of the current session item, or null. */
  practice: string | null;
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
  private state: TeachingState = { index: 0, phase: 'working', assisted: false, answerExposure: 'none', levers: [], practice: null,
    lastResponse: null, attempts: [] };
  private listeners = new Set<() => void>();
  private responses = new Set<string>();
  private practiceIds = new Set<string>();
  constructor(private readonly itemIds: readonly string[]) {
    if (!itemIds.length || new Set(itemIds).size !== itemIds.length) throw new Error('Teaching items need unique identities');
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<TeachingState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }
  /** Assistance remains true for the item after aids are hidden or work is reset. A named lever is recorded once. */
  assist(answerExposure: TeachingState['answerExposure'] = 'none', lever?: string) {
    if (this.state.phase === 'completed') return false;
    const rank = { none: 0, partial: 1, full: 2 };
    this.publish({ assisted: true, answerExposure: rank[answerExposure] > rank[this.state.answerExposure] ? answerExposure : this.state.answerExposure,
      ...(lever && !this.state.levers.includes(lever) ? { levers: [...this.state.levers, lever] } : {}) });
    return true;
  }
  /**
   * Put a simpler item in front of the learner in place of the current one. Its id must be new to
   * the session. Its work is recorded as practice: it never becomes an outcome and never advances.
   */
  openPractice(id: string) {
    if (this.state.phase === 'completed' || this.state.practice || this.itemIds.includes(id) || this.practiceIds.has(id)) return false;
    if (this.state.phase === 'checked' && this.state.lastResponse?.correct) return false;
    this.practiceIds.add(id);
    this.publish({ practice: id, phase: 'working', lastResponse: null });
    return true;
  }
  /** Back to the same session item, blank, with its levers and assistance kept. */
  closePractice() {
    if (!this.state.practice || this.state.phase === 'completed') return false;
    this.publish({ practice: null, phase: 'working', lastResponse: null });
    return true;
  }
  submit(responseId: string, response: string, source: TeachingAttempt['source'], correct: boolean, spokenCorrection = false, tutorResponse?: string,
    miss?: string) {
    if (this.responses.has(responseId)) return false;
    // A new, recognizable spoken correction is itself another attempt. It must not
    // disappear because the child answered faster than the dialogue observer.
    const correcting = spokenCorrection && source === 'speech' && this.state.phase === 'checked' && this.state.lastResponse?.correct === false;
    if (this.state.phase !== 'working' && !correcting) return false;
    this.responses.add(responseId);
    const practice = this.state.practice;
    const attempt: TeachingAttempt = { itemId: practice ?? this.itemIds[this.state.index], response, source, correct,
      ...(tutorResponse ? { tutorResponse, judgment: 'tutor' as const } : {}),
      assisted: this.state.assisted, answerExposure: this.state.answerExposure,
      ...(this.state.levers.length ? { levers: [...this.state.levers] } : {}), ...(practice ? { practice: true as const } : {}),
      ...(!correct && miss ? { miss } : {}) };
    this.publish({ phase: 'checked', lastResponse: attempt, attempts: [...this.state.attempts, attempt] });
    return true;
  }
  retry() {
    if (this.state.phase !== 'checked') return false;
    this.publish({ phase: 'working' });
    return true;
  }
  advance() {
    if (this.state.practice || this.state.phase !== 'checked' || !this.state.lastResponse?.correct) return false;
    const last = this.state.index === this.itemIds.length - 1;
    this.publish({ phase: last ? 'completed' : 'working', index: last ? this.state.index : this.state.index + 1,
      assisted: last ? this.state.assisted : false, answerExposure: last ? this.state.answerExposure : 'none',
      levers: last ? this.state.levers : [], lastResponse: last ? this.state.lastResponse : null });
    return true;
  }
}
