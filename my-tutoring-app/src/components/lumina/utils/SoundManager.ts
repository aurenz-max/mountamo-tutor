/**
 * SoundManager — Procedural UI sounds via the Web Audio API.
 *
 * No audio files, no MIDI. Every sound is a small data spec (a list of notes,
 * each with a frequency, waveform, start offset and duration). `play()`
 * schedules those notes on an AudioContext with a click-free volume envelope.
 *
 * One source of truth: the same SOUND_SPECS array drives both real playback
 * and the Sound Lab dev tool, so what you audition is exactly what ships.
 *
 * Signal path: every note → a shared master bus (compressor → master gain) →
 * destination. The compressor glues layered notes together and tames peaks, so
 * the celebration sounds can read LOUD and full without clipping; the master
 * gain owns the volume preference (and ramps it smoothly).
 *
 * Design rules for "intuitive" UI sound:
 *   - Keep it short (50–250ms) so repetition never grates.
 *   - Consonant musical intervals (3rds, 5ths, octaves) read as "good".
 *   - Soft, low, short tones read as "neutral / no" without punishing.
 *   - Rising pitch = progress / on; falling pitch = undo / off.
 *   - Impact lives in `correct`, `streak`, `perfect` — NOT in the tiny,
 *     frequent interaction sounds. Punching those up is how an app gets muted.
 *
 * Singleton — import { SoundManager } and call directly.
 */

export type Waveform = OscillatorType; // 'sine' | 'square' | 'sawtooth' | 'triangle'

export interface Note {
  /** Frequency in Hz. */
  freq: number;
  /** Start offset from the trigger moment, in seconds. */
  start: number;
  /** How long the note rings, in seconds. */
  duration: number;
  /** Oscillator shape. Defaults to 'sine'. */
  waveform?: Waveform;
  /** Relative loudness 0–1 (master volume is applied downstream). Defaults to 1. */
  gain?: number;
  /** Optional pitch glide target in Hz (sweeps from `freq` to this over the note). */
  glideTo?: number;
  /**
   * Optional "fatten" amount in cents. When set, a second oscillator is spawned
   * a hair off pitch (±detune/2) so the note reads bigger and more produced.
   * Classic detuned-unison thickening. ~6 cents is plenty; reserve for lead
   * tones in celebration sounds — it adds cost and weight you don't want on taps.
   */
  detune?: number;
}

export type SoundGroup = 'feedback' | 'interaction' | 'celebration';

export interface SoundSpec {
  id: string;
  label: string;
  group: SoundGroup;
  /** Plain-language description of when to play this and what it conveys. */
  description: string;
  notes: Note[];
  /**
   * Optional reverb send amount, 0–1. When set, this sound is fed (in addition
   * to the dry path) into a shared reverb so it blooms in a "space" rather than
   * a vacuum — grandeur for rare, terminal moments. Leave unset for everything
   * frequent: interaction and feedback sounds stay dry and tight.
   */
  reverb?: number;
}

// ── Note frequencies (equal temperament) ────────────────────────────────
const NOTE = {
  C3: 130.81,
  G3: 196.0,
  A3: 220.0,
  C4: 261.63,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
  E6: 1318.51,
  G6: 1567.98,
} as const;

// ── The palette ─────────────────────────────────────────────────────────
// Everything the app can play lives here. Add a sound = add an entry.

export const SOUND_SPECS: SoundSpec[] = [
  // ── Interaction: tiny, frequent, must never annoy ──
  {
    id: 'tap',
    label: 'Tap',
    group: 'interaction',
    description: 'Friendly button / card press. The everyday click — a touch louder, with a small upward lift so it feels warm rather than flat.',
    notes: [{ freq: NOTE.E5, start: 0, duration: 0.07, waveform: 'sine', gain: 0.68, glideTo: NOTE.G5 }],
  },
  {
    id: 'select',
    label: 'Select',
    group: 'interaction',
    description: 'Confirms an option was chosen — a touch brighter than a tap.',
    notes: [{ freq: NOTE.A5, start: 0, duration: 0.08, waveform: 'triangle', gain: 0.5 }],
  },
  {
    id: 'toggleOn',
    label: 'Toggle On',
    group: 'interaction',
    description: 'Switching something on — two quick rising blips.',
    notes: [
      { freq: NOTE.E5, start: 0, duration: 0.05, waveform: 'sine', gain: 0.5 },
      { freq: NOTE.A5, start: 0.05, duration: 0.06, waveform: 'sine', gain: 0.5 },
    ],
  },
  {
    id: 'toggleOff',
    label: 'Toggle Off',
    group: 'interaction',
    description: 'Switching something off — two quick falling blips.',
    notes: [
      { freq: NOTE.A5, start: 0, duration: 0.05, waveform: 'sine', gain: 0.5 },
      { freq: NOTE.E5, start: 0.05, duration: 0.06, waveform: 'sine', gain: 0.5 },
    ],
  },
  {
    id: 'navigate',
    label: 'Navigate',
    group: 'interaction',
    description: 'Moving between screens / panels — a soft rising whoosh.',
    notes: [{ freq: NOTE.G4, start: 0, duration: 0.18, waveform: 'sine', gain: 0.35, glideTo: NOTE.A5 }],
  },
  {
    id: 'pop',
    label: 'Pop',
    group: 'interaction',
    description: 'An element appears / opens — a quick bubble pop.',
    notes: [{ freq: NOTE.C5, start: 0, duration: 0.07, waveform: 'sine', gain: 0.45, glideTo: NOTE.G5 }],
  },
  {
    id: 'snap',
    label: 'Snap / Drop',
    group: 'interaction',
    description: 'A dragged item lands in place — low thunk plus a high click.',
    notes: [
      { freq: NOTE.G3, start: 0, duration: 0.09, waveform: 'triangle', gain: 0.55 },
      { freq: NOTE.E6, start: 0.01, duration: 0.04, waveform: 'sine', gain: 0.3 },
    ],
  },
  {
    id: 'tick',
    label: 'Tick',
    group: 'interaction',
    description: 'Slider / stepper increment — barely-there click for rapid repeats.',
    notes: [{ freq: NOTE.C6, start: 0, duration: 0.025, waveform: 'square', gain: 0.18 }],
  },
  {
    id: 'invalid',
    label: 'Invalid',
    group: 'interaction',
    description: 'A blocked / not-allowed action — soft low "uh-uh" (not a wrong answer).',
    notes: [
      { freq: NOTE.A3, start: 0, duration: 0.07, waveform: 'sine', gain: 0.4 },
      { freq: NOTE.A3, start: 0.1, duration: 0.07, waveform: 'sine', gain: 0.4 },
    ],
  },

  // ── Feedback: answer evaluation ──
  {
    id: 'correct',
    label: 'Correct',
    group: 'feedback',
    description: 'A correct answer — warm ascending major arpeggio (C5 E5 G5) with light body and a sparkle, resolving up an octave. Streak\'s DNA, scaled down for something that fires on every right answer.',
    notes: [
      // Light low body — grounds the arpeggio without overstaying (this fires constantly)
      { freq: NOTE.C4, start: 0, duration: 0.26, waveform: 'sine', gain: 0.4 },
      // Warm, lightly-detuned major arpeggio (C5 E5 G5)
      { freq: NOTE.C5, start: 0, duration: 0.28, waveform: 'triangle', gain: 0.85, detune: 6 },
      { freq: NOTE.E5, start: 0.08, duration: 0.28, waveform: 'triangle', gain: 0.85, detune: 6 },
      { freq: NOTE.G5, start: 0.16, duration: 0.34, waveform: 'triangle', gain: 0.9, detune: 7 },
      // Single sparkle on the landing, an octave above the root
      { freq: NOTE.C6, start: 0.22, duration: 0.3, waveform: 'sine', gain: 0.4 },
    ],
  },
  {
    id: 'incorrect',
    label: 'Incorrect',
    group: 'feedback',
    description: 'A wrong answer — gentle low tone that dips. Feedback, not punishment.',
    notes: [{ freq: NOTE.E4, start: 0, duration: 0.25, waveform: 'sine', gain: 0.5, glideTo: 260 }],
  },

  // ── Celebration: milestones ──
  {
    id: 'streak',
    label: 'Streak',
    group: 'celebration',
    description: 'Several correct in a row — an accelerating "level-up" run that lands bright, with a sparkle on top.',
    notes: [
      // Sub-octave + bass launch — gives the run felt body
      { freq: NOTE.C3, start: 0, duration: 0.32, waveform: 'sine', gain: 0.5 },
      { freq: NOTE.C4, start: 0, duration: 0.28, waveform: 'sine', gain: 0.45 },
      // Accelerating major-pentatonic climb (warm, lightly-detuned triangle)
      { freq: NOTE.C5, start: 0, duration: 0.16, waveform: 'triangle', gain: 0.85, detune: 6 },
      { freq: NOTE.E5, start: 0.06, duration: 0.16, waveform: 'triangle', gain: 0.85, detune: 6 },
      { freq: NOTE.G5, start: 0.12, duration: 0.16, waveform: 'triangle', gain: 0.85, detune: 6 },
      { freq: NOTE.A5, start: 0.18, duration: 0.16, waveform: 'triangle', gain: 0.85, detune: 6 },
      { freq: NOTE.C6, start: 0.24, duration: 0.32, waveform: 'triangle', gain: 0.95, detune: 7 },
      // Sparkle shimmer on the landing
      { freq: NOTE.E6, start: 0.3, duration: 0.35, waveform: 'sine', gain: 0.4 },
      { freq: NOTE.G6, start: 0.36, duration: 0.35, waveform: 'sine', gain: 0.3 },
    ],
  },
  {
    id: 'perfect',
    label: 'Perfect',
    group: 'celebration',
    description: 'A perfect score — the boldest sound in the app. Triumphant arpeggio climbing all the way to E6 over immediate low-end body, crowned with a sparkle, resolving into a big sustained chord that blooms in reverb. Rare and terminal, so it can afford grandeur.',
    reverb: 0.4,
    notes: [
      // Immediate low body at the launch — weight from the very first instant
      { freq: NOTE.C3, start: 0, duration: 0.55, waveform: 'sine', gain: 0.55 },
      // Triumphant rising arpeggio, now climbing a full octave-and-a-third to E6
      { freq: NOTE.C5, start: 0, duration: 0.5, waveform: 'triangle', gain: 0.85, detune: 6 },
      { freq: NOTE.E5, start: 0.1, duration: 0.5, waveform: 'triangle', gain: 0.85, detune: 6 },
      { freq: NOTE.G5, start: 0.2, duration: 0.5, waveform: 'triangle', gain: 0.85, detune: 6 },
      { freq: NOTE.C6, start: 0.3, duration: 0.5, waveform: 'triangle', gain: 0.9, detune: 7 },
      { freq: NOTE.E6, start: 0.4, duration: 0.5, waveform: 'triangle', gain: 0.9, detune: 7 },
      // Sparkle crown on the peak
      { freq: NOTE.G6, start: 0.46, duration: 0.45, waveform: 'sine', gain: 0.4 },
      // Big sustained closing chord with two octaves of low-end body
      { freq: NOTE.C3, start: 0.56, duration: 0.95, waveform: 'sine', gain: 0.55 },
      { freq: NOTE.C4, start: 0.56, duration: 0.95, waveform: 'sine', gain: 0.4 },
      { freq: NOTE.C5, start: 0.56, duration: 0.95, waveform: 'sine', gain: 0.45, detune: 5 },
      { freq: NOTE.E5, start: 0.56, duration: 0.95, waveform: 'sine', gain: 0.45, detune: 5 },
      { freq: NOTE.G5, start: 0.56, duration: 0.95, waveform: 'sine', gain: 0.45, detune: 5 },
      { freq: NOTE.C6, start: 0.56, duration: 0.95, waveform: 'sine', gain: 0.45, detune: 5 },
    ],
  },
];

const SPECS_BY_ID: Record<string, SoundSpec> = Object.fromEntries(
  SOUND_SPECS.map((s) => [s.id, s]),
);

/** Derived "recipe" metadata for display in the Sound Lab. */
export function describeSound(spec: SoundSpec) {
  const waveforms = Array.from(new Set(spec.notes.map((n) => n.waveform ?? 'sine')));
  const freqs = spec.notes.flatMap((n) => [n.freq, n.glideTo].filter((f): f is number => f != null));
  const totalDuration = Math.max(...spec.notes.map((n) => n.start + n.duration));
  return {
    noteCount: spec.notes.length,
    waveforms,
    minFreq: Math.round(Math.min(...freqs)),
    maxFreq: Math.round(Math.max(...freqs)),
    durationMs: Math.round(totalDuration * 1000),
  };
}

const STORAGE_KEY = 'lumina.sound.prefs';
const ATTACK = 0.008; // seconds — short fade-in so onsets don't click
// Notes at/above this duration get the "hit" envelope (fast decay to a sustain
// floor = front-loaded energy = punch). Shorter notes — every interaction
// sound — keep the original tight attack→silence shape so they stay gentle and
// so their envelope keyframes never overlap (e.g. tick is only 25ms).
const HIT_ENVELOPE_MIN_DURATION = 0.2;

class SoundManagerImpl {
  private ctx: AudioContext | null = null;
  private bus: DynamicsCompressorNode | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private enabled = true;
  private volume = 0.3; // 0–1 master

  constructor() {
    this.loadPrefs();
  }

  // ── Preferences (persisted) ──
  private loadPrefs() {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as { enabled?: boolean; volume?: number };
      if (typeof p.enabled === 'boolean') this.enabled = p.enabled;
      if (typeof p.volume === 'number') this.volume = Math.max(0, Math.min(1, p.volume));
    } catch {
      /* ignore corrupt prefs */
    }
  }

  private savePrefs() {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ enabled: this.enabled, volume: this.volume }),
      );
    } catch {
      /* storage may be unavailable */
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        // notes → compressor (glue + peak control) → master gain → out.
        // The compressor lets layered/celebration sounds read loud and full
        // without clipping; the master gain owns the volume preference.
        this.bus = this.ctx.createDynamicsCompressor();
        this.bus.threshold.value = -20;
        this.bus.ratio.value = 5;
        this.bus.attack.value = 0.003;
        this.bus.release.value = 0.18;
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.bus.connect(this.master);
        this.master.connect(this.ctx.destination);
        // Shared reverb for opt-in grandeur (see SoundSpec.reverb). Wet returns
        // straight to the master, post-compressor; dry-by-default for everything
        // else. A short generated impulse keeps it a "room", not a cathedral.
        this.reverb = this.ctx.createConvolver();
        this.reverb.buffer = this.makeImpulse(this.ctx, 1.6, 3.2);
        this.reverb.connect(this.master);
      } catch {
        return null;
      }
    }
    // Browsers start contexts suspended until a user gesture.
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // ── Public settings API ──
  setEnabled(on: boolean) {
    this.enabled = on;
    this.savePrefs();
  }

  isEnabled() {
    return this.enabled;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    // Smoothly ramp the live master node (if a context exists) instead of only
    // affecting future sounds — no zipper noise, applies to in-flight tails too.
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.01);
    }
    this.savePrefs();
  }

  getVolume() {
    return this.volume;
  }

  // ── Core scheduler ──
  /** Play an arbitrary sound spec. Used by the named helpers and the Sound Lab. */
  play(spec: SoundSpec) {
    if (!this.enabled) {
      console.debug('[SoundManager] skip (muted):', spec.id);
      return;
    }
    const ctx = this.getContext();
    if (!ctx) {
      console.debug('[SoundManager] skip (no AudioContext / SSR):', spec.id);
      return;
    }
    console.debug('[SoundManager] play:', spec.id, '| ctx.state =', ctx.state, '| volume =', this.volume);

    const now = ctx.currentTime;
    for (const note of spec.notes) {
      this.scheduleNote(ctx, note, now, spec.reverb ?? 0);
    }
  }

  /** Play a single ad-hoc note (used by the Sound Lab's design-your-own panel). */
  playNote(note: Note) {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    this.scheduleNote(ctx, note, ctx.currentTime);
  }

  /** Play by id — convenient for the Sound Lab buttons. */
  playById(id: string) {
    const spec = SPECS_BY_ID[id];
    if (spec) this.play(spec);
  }

  /** Build a short decaying-noise impulse response for the reverb convolver. */
  private makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buffer = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buffer;
  }

  private scheduleNote(ctx: AudioContext, note: Note, now: number, reverbSend = 0) {
    const t = now + note.start;
    // Master volume is applied by the master gain node downstream, so per-note
    // math only carries the note's own relative loudness.
    const peak = Math.max(0.0001, (note.gain ?? 1) * 0.5);

    const gain = ctx.createGain();
    gain.connect(this.bus ?? ctx.destination);
    // Opt-in wet path: feed a parallel send into the shared reverb.
    if (reverbSend > 0 && this.reverb) {
      const send = ctx.createGain();
      send.gain.value = reverbSend;
      gain.connect(send);
      send.connect(this.reverb);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + ATTACK); // snap up
    if (note.duration >= HIT_ENVELOPE_MIN_DURATION) {
      // "Hit" envelope: quick decay to a sustain floor front-loads the energy,
      // which the ear reads as punch; then a tail to silence.
      const sustain = Math.max(0.0001, peak * 0.35);
      gain.gain.exponentialRampToValueAtTime(sustain, t + ATTACK + 0.04);
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, t + note.duration); // tail to silence

    // Primary oscillator, plus an optional detuned partner to "fatten" the tone.
    this.spawnOscillator(ctx, note, gain, t, note.detune != null ? +note.detune / 2 : 0);
    if (note.detune != null) {
      this.spawnOscillator(ctx, note, gain, t, -note.detune / 2);
    }
  }

  /** Create one oscillator for `note`, offset by `detuneCents`, wired into `gain`. */
  private spawnOscillator(
    ctx: AudioContext,
    note: Note,
    gain: GainNode,
    t: number,
    detuneCents: number,
  ) {
    const osc = ctx.createOscillator();
    osc.type = note.waveform ?? 'sine';
    osc.frequency.setValueAtTime(note.freq, t);
    if (detuneCents !== 0) osc.detune.setValueAtTime(detuneCents, t);
    if (note.glideTo != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, note.glideTo), t + note.duration);
    }
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + note.duration + 0.02);
  }

  // ── Named helpers (stable API for the rest of the app) ──
  tap() { this.play(SPECS_BY_ID.tap); }
  select() { this.play(SPECS_BY_ID.select); }
  toggle(on: boolean) { this.play(SPECS_BY_ID[on ? 'toggleOn' : 'toggleOff']); }
  navigate() { this.play(SPECS_BY_ID.navigate); }
  pop() { this.play(SPECS_BY_ID.pop); }
  snap() { this.play(SPECS_BY_ID.snap); }
  tick() { this.play(SPECS_BY_ID.tick); }
  invalid() { this.play(SPECS_BY_ID.invalid); }

  playCorrect() { this.play(SPECS_BY_ID.correct); }
  playIncorrect() { this.play(SPECS_BY_ID.incorrect); }
  playStreak() { this.play(SPECS_BY_ID.streak); }
  playPerfect() { this.play(SPECS_BY_ID.perfect); }
}

export const SoundManager = new SoundManagerImpl();
