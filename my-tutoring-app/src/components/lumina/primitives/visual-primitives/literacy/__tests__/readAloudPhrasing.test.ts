import { describe, expect, it } from 'vitest';
import { validateJudgedScriptPack } from '../../../../hooks/judgedScriptContract';
import type { JudgedRunSummary } from '../../../../hooks/useJudgedScriptRunner';
import {
  markedGroups, phraseGroupsFor, phrasePlanCue, readingSummary, studioHearCue,
  studioItemCue, studioItems, studioMoveCue,
} from '../readAloudPhrasing';

const lines = [{ text: 'After the rain, the birds sang.', phraseGroups: ['After the rain,', 'the birds sang.'], stressWord: 'sang' }];
const [mark, first, reread] = studioItems(lines, 'expression');
const quote = (cue: string) => cue.match(/Say exactly: "([^"]*)"/)?.[1];

describe('phrase, read, model and reread', () => {
  it('builds three ordered steps per line with separate response channels', () => {
    const items = studioItems([...lines, { text: 'The sun came out.' }], 'expression');
    expect(items.map((item) => item.step)).toEqual(['mark', 'first_read', 'reread', 'mark', 'first_read', 'reread']);
    expect(items.map((item) => item.answerKind)).toEqual(['gesture', 'voice', 'voice', 'gesture', 'voice', 'voice']);
    expect(new Set(items.map((item) => item.id)).size).toBe(6);
    expect(validateJudgedScriptPack({ primitiveType: 'read-aloud-studio', activityLine: 'reading',
      items, itemCue: studioItemCue, moveOnCue: studioMoveCue, completeCue: () => 'Done.',
      contextFor: () => ({}) })).toEqual([]);
  });

  it('never reads or reveals the model in the planning or first-read ask/replay', () => {
    for (const item of [mark, first]) {
      for (const cue of [studioItemCue(item, { opening: true }), studioHearCue(item)]) {
        expect(quote(cue)).not.toContain(lines[0].text);
        expect(quote(cue)).not.toContain('After the rain');
      }
    }
    expect(studioItemCue(first)).toContain('Do NOT read the line or model any words before this first attempt');
    expect(studioItemCue(mark)).toContain('Do not judge microphone speech');
    expect(phrasePlanCue(mark, [3])).toContain('Acknowledge completion only, not correctness');
  });

  it('carries learner marks to the first read and models a suggestion on reread', () => {
    expect(studioItemCue(first, {}, [2])).toContain('["After the","rain, the birds sang."]');
    expect(studioItemCue(reread)).toContain('["After the rain,","the birds sang."]');
    expect(quote(studioItemCue(reread))).toContain(`Listen: ${lines[0].text}`);
    expect(studioItemCue(reread)).toContain('A flat or plain reading that gets every word right is CORRECT');
    expect(studioItemCue(reread)).toContain('Only a word error can trigger a correction');
    expect(studioMoveCue(first, reread)).toContain(`Listen: ${lines[0].text}`);
    expect(studioMoveCue(reread, mark)).toContain('Wait for [RA_PLAN]');
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
    expect(quote(studioItemCue(dialogue[0]))).toContain('Mia says: We can go now.');
  });
});
