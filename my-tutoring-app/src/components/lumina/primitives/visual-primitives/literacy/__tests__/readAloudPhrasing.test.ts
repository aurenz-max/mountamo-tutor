import { describe, expect, it } from 'vitest';
import type { JudgedRunSummary } from '../../../../hooks/useJudgedScriptRunner';
import { markedGroups, phraseAsk, phraseGroupsFor, readingSummary, studioItems } from '../readAloudPhrasing';
import { readAloudAssignment, readAloudGiven, readAloudKey, readAloudScene, readAloudStep } from '../readAloudStudioWorkspace';

const lines = [{ text: 'After the rain, the birds sang.', phraseGroups: ['After the rain,', 'the birds sang.'], stressWord: 'sang' }];
const [mark, first, reread] = studioItems(lines, 'expression');

describe('phrase, read, model and reread', () => {
  it('builds three ordered steps per line with separate response channels', () => {
    const items = studioItems([...lines, { text: 'The sun came out.' }], 'expression');
    expect(items.map((item) => item.step)).toEqual(['mark', 'first_read', 'reread', 'mark', 'first_read', 'reread']);
    expect(items.map((item) => item.answerKind)).toEqual(['gesture', 'voice', 'voice', 'gesture', 'voice', 'voice']);
    expect(new Set(items.map((item) => item.id)).size).toBe(6);
    // Each step is the card's step name, published as the scene's kind.
    expect(items.slice(0, 3).map(readAloudStep)).toEqual(['mark', 'first_read', 'reread']);
    expect(readAloudScene(mark, []).facts.kind).toBe('mark');
    // The plan is page work with no key; both reads are judged against the line.
    expect(readAloudAssignment(mark).response).toBe('gesture');
    expect(readAloudKey(first)?.answer).toBe(lines[0].text);
  });

  it('never reads the line in the planning or first-read ask; the reread ask carries the model by design', () => {
    for (const item of [mark, first]) {
      expect(phraseAsk(item)).not.toContain('After the rain');
      expect(readAloudGiven(item)).toEqual([]);
    }
    expect(phraseAsk(reread)).toContain(`Listen: ${lines[0].text}`);
    expect(readAloudGiven(reread)).toEqual([lines[0].text]);
  });

  it('carries learner marks to the first read and models a suggestion on reread', () => {
    expect(readAloudScene(first, [2]).facts.plan).toBeUndefined();
    expect(readAloudScene(mark, [2]).facts.plan).toContain('After the / rain, the birds sang.');
    expect(readAloudScene(reread, []).facts.model).toContain('After the rain, / the birds sang.');
  });

  it('accepts no marks and all editable boundaries without inventing a correctness key', () => {
    expect(markedGroups(lines[0].text, [])).toEqual([lines[0].text]);
    expect(markedGroups(lines[0].text, [3, 3, -1, 0, 6, 500, 2.5])).toEqual(lines[0].phraseGroups);
    expect(markedGroups(lines[0].text, [1, 2, 3, 4, 5]).join(' ')).toBe(lines[0].text);
  });

  it('keeps legacy payloads readable and rejects mismatched model bindings', () => {
    expect(phraseGroupsFor({ text: lines[0].text })).toEqual([lines[0].text]);
    for (const phraseGroups of [['After the rain,', 'birds sang.'], [''], ['different words'], ['After', 'the', 'rain,', 'the birds sang.'], ['After the', 'rain, the birds sang.']]) {
      expect(phraseGroupsFor({ text: lines[0].text, phraseGroups })).toEqual([lines[0].text]);
    }
    expect(phraseGroupsFor(lines[0])).toEqual(lines[0].phraseGroups);
  });

  it('does not award reading credit for saving a plan or reading the same line twice', () => {
    const summary = { outcomes: [
      { id: mark.id, solved: true, corrections: 0, score: 100, seconds: 2 },
      { id: first.id, solved: true, corrections: 0, score: 100, seconds: 2 },
      { id: reread.id, solved: false, corrections: 2, score: 0, seconds: 2 },
    ] } as JudgedRunSummary;
    expect(readingSummary([mark, first, reread], summary)).toEqual({
      outcomes: [summary.outcomes[2]], accuracy: 0, passed: false, solvedCount: 0,
      firstTryCount: 0, attemptsCount: 3,
    });
  });

  it('retains the single-reading accuracy and dialogue paths', () => {
    expect(studioItems(lines, 'accuracy')).toHaveLength(1);
    const dialogue = studioItems([{ text: 'We can go now.', speaker: 'Mia' }], 'dialogue');
    expect(dialogue).toHaveLength(1);
    expect(readAloudGiven(dialogue[0])).toEqual(['We can go now.']);
  });
});
