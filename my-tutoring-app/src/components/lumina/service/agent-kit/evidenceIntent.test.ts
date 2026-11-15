import { describe, expect, it } from 'vitest';
import { resolveGenerationContext } from '../generation/resolveGenerationContext';
import { splitLearnerNotes } from '../attemptNotes/notes';
import { splitEvidenceIntent, type EvidenceSpec } from './evidence';

const evidence: EvidenceSpec = {
  act: 'build', on: 'a ten-frame and counters',
  credit: 'the child places enough counters to fill the ten-frame', notCredit: 'counts all the counters from one',
};
const note = { kind: 'struggle', note: 'said 12 for 8 + 5', use: 'Give 8 + 5 again.', include: ['8 + 5'] };
const ctx = (config: Record<string, unknown>) =>
  resolveGenerationContext({ componentId: 'ten-frame', instanceId: 'tf-1', title: 'Make ten', intent: '', config: { intent: 'Fill the frame to make ten.', ...config } } as never, 'Making ten', 'elementary', 'Grade 1');

describe('the evidence spec rides every generator\'s intent', () => {
  it('appends the spec to the intent, and leaves the intent alone without one', () => {
    expect(ctx({}).intent).toBe('Fill the frame to make ten.');
    const intent = ctx({ evidence }).intent!;
    expect(intent.startsWith('Fill the frame to make ten.')).toBe(true);
    expect(intent).toContain('Credit only when: the child places enough counters to fill the ten-frame.');
    expect(intent).toContain('Does not count: counts all the counters from one.');
  });

  it('splits back to the bare intent for a generator that reads the spec as data', () => {
    expect(splitEvidenceIntent(ctx({ evidence }).intent)).toMatchObject({ intent: 'Fill the frame to make ten.' });
  });

  it('sits ahead of learner notes, so each split cuts only its own section', () => {
    const intent = ctx({ evidence, learnerNotes: [note] }).intent!;
    const noNotes = splitLearnerNotes(intent);
    expect(noNotes.intent).toContain('Credit only when');
    expect(noNotes.section).not.toContain('Credit only when');
    const noEvidence = splitEvidenceIntent(intent).intent!;
    expect(noEvidence).not.toContain('Credit only when');
    expect(noEvidence.startsWith('Fill the frame to make ten.')).toBe(true);
    expect(splitLearnerNotes(noEvidence).section).toContain('Give 8 + 5 again.');
  });

  it('gives a final assessment the spec of every objective it covers', () => {
    const say: EvidenceSpec = { act: 'say', on: 'a printed letter', credit: 'the child says the letter sound' };
    const intent = ctx({ intent: 'Check the lesson.', lessonObjectives: [{ id: 'a', text: 'Make ten', evidence }, { id: 'b', text: 'Say letter sounds', evidence: say }, { id: 'c', text: 'No spec' }] }).intent!;
    expect(intent).toContain('For "Make ten":');
    expect(intent).toContain('For "Say letter sounds":');
    expect(intent).not.toContain('No spec');
    expect(splitEvidenceIntent(intent).intent).toBe('Check the lesson.');
  });
});
