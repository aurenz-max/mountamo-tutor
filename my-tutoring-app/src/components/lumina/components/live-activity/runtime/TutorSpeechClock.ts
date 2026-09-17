/** A turn is settled only after its end event and its playback buffer drain. */
export class TutorSpeechClock {
  private ended = 0;
  private pending = false;
  private listeners = new Set<() => void>();
  output() { this.pending = true; }
  end(audioPending: boolean) { this.ended++; this.pending = audioPending; this.flush(); }
  audio(audioPending: boolean) { this.pending = audioPending; this.flush(); }
  private flush() { if (!this.pending) Array.from(this.listeners).forEach(fn => fn()); }
  afterNextTurn(callback: () => void) {
    const baseline = this.ended;
    const check = () => {
      if (this.ended <= baseline || this.pending) return;
      this.listeners.delete(check); callback();
    };
    this.listeners.add(check);
    return () => { this.listeners.delete(check); };
  }
  clear() { this.listeners.clear(); }
}
