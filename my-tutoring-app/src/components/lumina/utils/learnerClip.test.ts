// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { appendLearnerFrame, decisionsAudioEnabled, latestLearnerClip, learnerTurnClosed, learnerTurnOpened, setDecisionsAudioEnabled } from './learnerClip';

const tone = (n: number, amp = 0.5) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin(i / 5));
const header = (b64: string) => { const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); return { bytes, view: new DataView(bytes.buffer) }; };

describe('learnerClip', () => {
  afterEach(() => { setDecisionsAudioEnabled(false); learnerTurnOpened(); learnerTurnClosed(); });

  it('is on by default and captures nothing once turned off', () => {
    window.localStorage.clear();
    expect(decisionsAudioEnabled()).toBe(true);
    setDecisionsAudioEnabled(false);
    learnerTurnOpened(); appendLearnerFrame(tone(1600));
    expect(latestLearnerClip()).toBeNull();
  });

  it('keeps only the frames between a tutor turn ending and the next one starting', () => {
    setDecisionsAudioEnabled(true);
    learnerTurnOpened(); appendLearnerFrame(tone(1600)); appendLearnerFrame(tone(1600));
    learnerTurnClosed(); appendLearnerFrame(tone(1600)); // tutor speaking: not the learner
    const clip = latestLearnerClip()!;
    expect(clip.ms).toBe(200);
    const { bytes, view } = header(clip.base64);
    expect(String.fromCharCode(...Array.from(bytes.subarray(0, 4)))).toBe('RIFF');
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(40, true)).toBe(3200 * 2);
  });

  it('drops a silent turn and starts fresh on the next turn', () => {
    setDecisionsAudioEnabled(true);
    learnerTurnOpened(); appendLearnerFrame(tone(1600, 0.001));
    expect(latestLearnerClip()).toBeNull();
    learnerTurnOpened(); appendLearnerFrame(tone(800));
    expect(latestLearnerClip()!.ms).toBe(50);
  });
});
