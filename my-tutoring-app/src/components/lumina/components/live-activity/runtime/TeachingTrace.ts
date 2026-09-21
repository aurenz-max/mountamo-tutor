export interface TeachingTraceEntry {
  id: number;
  at: number;
  stage: 'learner_response' | 'dialogue' | 'learner_intent';
  status: string;
  reason?: string;
  input?: unknown;
  result?: unknown;
}

/** Browser-only diagnostic journal. Recording never changes action revisions. */
export class TeachingTrace {
  private entries: readonly TeachingTraceEntry[] = [];
  private sequence = 0;
  private listeners = new Set<() => void>();
  getSnapshot = () => this.entries;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  record(entry: Omit<TeachingTraceEntry, 'id' | 'at'>) {
    this.entries = [...this.entries.slice(-49), structuredClone({ ...entry, id: ++this.sequence, at: Date.now() })];
    this.listeners.forEach(fn => fn());
  }
}
