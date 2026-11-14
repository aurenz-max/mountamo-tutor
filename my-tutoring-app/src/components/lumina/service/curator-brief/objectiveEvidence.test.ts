import { describe, expect, it } from 'vitest';
import { attachEvidenceToGiven, parseWrittenObjectives } from './objectiveEvidence';

const spec = { act: 'explain', on: 'a friend who thinks 8 + 5 must be counted on', credit: 'the child says ten plus three is quicker', notCredit: 'names making ten without saying what it does' };

describe('objective evidence from the brief', () => {
  it('keeps a written objective with its parsed spec and drops a spec that does not parse', () => {
    const out = parseWrittenObjectives<{ id: string; evidence?: unknown }>([
      { id: 'obj1', text: 'Explain making ten', verb: 'explain', icon: 'message', evidence: spec },
      { id: 'obj2', text: 'Add within 20', verb: 'apply', icon: 'pencil', evidence: { act: 'ready', credit: '' } },
    ]);
    expect(out[0].evidence).toEqual(spec);
    expect(out[1].evidence).toBeUndefined();
    expect(Object.keys(out[1])).not.toContain('evidence');
  });

  it('given objectives win on identity and take the evidence by id, then by position', () => {
    const given = [
      { id: 'SUB-A', text: 'Curriculum text A', verb: 'apply', subskillId: 'SUB-A', grade: '1' },
      { id: 'SUB-B', text: 'Curriculum text B', verb: 'explain', subskillId: 'SUB-B', grade: '1' },
    ];
    const written = [
      { id: 'obj1', text: 'Paraphrased A', verb: 'identify', evidence: { act: 'set', credit: 'the frame holds ten', notCredit: 'picks the full frame' } },
      { id: 'SUB-B', text: 'Paraphrased B', verb: 'explain', evidence: spec },
    ];
    const out = attachEvidenceToGiven(given, written);
    expect(out[0]).toMatchObject({ text: 'Curriculum text A', verb: 'apply', subskillId: 'SUB-A', evidence: { act: 'set' } });
    expect(out[1]).toMatchObject({ text: 'Curriculum text B', evidence: spec });
  });

  it('never overwrites evidence the lesson already carries', () => {
    const own = { act: 'build', on: 'coins', credit: 'the tray holds 35 cents in five coins', notCredit: 'any five coins' } as const;
    const out = attachEvidenceToGiven([{ id: 'x', text: 't', verb: 'apply', evidence: own }], [{ id: 'x', evidence: spec }]);
    expect(out[0].evidence).toEqual(own);
  });
});
