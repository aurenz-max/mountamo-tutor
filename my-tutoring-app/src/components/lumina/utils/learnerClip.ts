/**
 * The learner's last spoken turn as a WAV clip, for the `spoken_hear` observation (gemini-decision-1 hears the clip
 * blind and names the miss; `spokenHearContract.ts`).
 *
 * The Live mic streams 16 kHz frames to the tutor. While this is enabled, the frames between the end of a tutor
 * turn and the start of the next one are kept: that window is the learner's turn, and it excludes the tutor's own
 * voice through the speaker. On by default since 2026-11-13; `lumina.decisionsAudio` = '0' turns it off (the lab toggles).
 */

const SAMPLE_RATE = 16000;
const MAX_SECONDS = 15;
const STORAGE_KEY = 'lumina.decisionsAudio';

let frames: Float32Array[] = [];
let samples = 0;
let capturing = false;

export function decisionsAudioEnabled(): boolean {
  try { return typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) !== '0'; } catch { return true; }
}
const listeners = new Set<() => void>();
export function setDecisionsAudioEnabled(on: boolean) {
  try { window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch { /* storage blocked */ }
  listeners.forEach(l => l());
}
/** For `useSyncExternalStore`: every toggle (the lab header, the inspector) shows the same state. */
export function subscribeDecisionsAudio(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

/** The tutor finished speaking (or was interrupted): the learner's turn starts now. */
export function learnerTurnOpened() { frames = []; samples = 0; capturing = decisionsAudioEnabled(); }
/** The tutor started speaking again: the learner's turn is over; keep what was captured. */
export function learnerTurnClosed() { capturing = false; }

export function appendLearnerFrame(frame: Float32Array) {
  if (!capturing || samples >= SAMPLE_RATE * MAX_SECONDS) return;
  frames.push(frame.slice());
  samples += frame.length;
}

/** The last learner turn as base64 WAV (16 kHz mono 16-bit), or null when nothing audible was captured. */
export function latestLearnerClip(): { base64: string; ms: number } | null {
  if (!samples) return null;
  const pcm = new Int16Array(samples);
  let i = 0, peak = 0;
  for (const f of frames) for (let k = 0; k < f.length; k++) {
    const v = Math.max(-1, Math.min(1, f[k]));
    peak = Math.max(peak, Math.abs(v));
    pcm[i++] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  if (peak < 0.01) return null;
  return { base64: bytesToBase64(wav(pcm)), ms: Math.round(samples / SAMPLE_RATE * 1000) };
}

export function wav(pcm: Int16Array): Uint8Array {
  const out = new Uint8Array(44 + pcm.length * 2), v = new DataView(out.buffer);
  const str = (o: number, s: string) => { for (let k = 0; k < s.length; k++) out[o + k] = s.charCodeAt(k); };
  str(0, 'RIFF'); v.setUint32(4, out.length - 8, true); str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, SAMPLE_RATE, true);
  v.setUint32(28, SAMPLE_RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data');
  v.setUint32(40, pcm.length * 2, true);
  new Int16Array(out.buffer, 44).set(pcm);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let k = 0; k < bytes.length; k += 0x8000) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(k, k + 0x8000)));
  return btoa(s);
}
