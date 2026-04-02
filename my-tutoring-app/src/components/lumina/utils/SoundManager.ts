/**
 * SoundManager — Procedural celebration sounds via Web Audio API.
 *
 * No audio files needed. Generates short tones/chimes on the fly.
 * Singleton pattern — import and use directly.
 */

class SoundManagerImpl {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private volume = 0.3; // 0–1

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    // Resume if suspended (browsers require user gesture first)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
  }

  /** Short rising two-tone chime — correct answer */
  playCorrect() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(this.volume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    // First tone
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(523.25, now); // C5
    o1.connect(gain);
    o1.start(now);
    o1.stop(now + 0.15);

    // Second tone (higher)
    const gain2 = ctx.createGain();
    gain2.connect(ctx.destination);
    gain2.gain.setValueAtTime(this.volume * 0.4, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(659.25, now + 0.1); // E5
    o2.connect(gain2);
    o2.start(now + 0.1);
    o2.stop(now + 0.35);
  }

  /** Three-note ascending arpeggio — streak */
  playStreak() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((freq, i) => {
      const t = now + i * 0.1;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(this.volume * 0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  /** Triumphant fanfare — perfect score */
  playPerfect() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // C major arpeggio + octave: C5 E5 G5 C6
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, i) => {
      const t = now + i * 0.12;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(this.volume * 0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.5);
    });

    // Sustain chord at the end
    const chordTime = now + 0.48;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq) => {
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(this.volume * 0.15, chordTime);
      gain.gain.exponentialRampToValueAtTime(0.001, chordTime + 0.8);

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, chordTime);
      osc.connect(gain);
      osc.start(chordTime);
      osc.stop(chordTime + 0.7);
    });
  }

  /** Soft low tone — incorrect answer (not punishing, just feedback) */
  playIncorrect() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(this.volume * 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(330, now); // E4
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.2); // gentle drop
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.25);
  }
}

export const SoundManager = new SoundManagerImpl();
