/**
 * WAV encoding helpers for the spoken-word judge pipeline.
 *
 * Converts raw Float32 mic buffers (any sample rate) into the exact format
 * every judge lane expects: 16kHz 16-bit mono PCM WAV, base64-encoded.
 * Shared by useSpokenWordCapture (primitives) and BlendJudgeLab (bench).
 */

export const JUDGE_SAMPLE_RATE = 16000;

export function downsample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.ceil(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio;
    const i1 = Math.floor(pos);
    const i2 = Math.min(Math.ceil(pos), input.length - 1);
    const frac = pos - i1;
    out[i] = (input[i1] || 0) * (1 - frac) + (input[i2] || 0) * frac;
  }
  return out;
}

/** Concat float chunks → downsample to 16k → 16-bit PCM WAV bytes. */
export function encodeWav16kMono(
  chunks: Float32Array[],
  sourceRate: number,
): { bytes: Uint8Array; durationMs: number } {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const joined = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    joined.set(c, offset);
    offset += c.length;
  }
  const mono = downsample(joined, sourceRate, JUDGE_SAMPLE_RATE);

  const buffer = new ArrayBuffer(44 + mono.length * 2);
  const view = new DataView(buffer);
  const writeStr = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(pos + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + mono.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, JUDGE_SAMPLE_RATE, true);
  view.setUint32(28, JUDGE_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, mono.length * 2, true);
  for (let i = 0; i < mono.length; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return {
    bytes: new Uint8Array(buffer),
    durationMs: Math.round((mono.length / JUDGE_SAMPLE_RATE) * 1000),
  };
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, Math.min(i + CHUNK, bytes.length))));
  }
  return btoa(binary);
}
