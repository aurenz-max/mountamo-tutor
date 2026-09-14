import { beforeEach, describe, expect, it, vi } from 'vitest';
const generate = vi.hoisted(() => vi.fn());
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: generate } } }));
import { generateReadingRepairStudio, validRepairSentence } from './gemini-reading-repair-studio';
import { judgeReadingRepair, parseReadingTranscript } from './reading-repair-judge';
import type { GenerationContext } from '../generation/generationContext';
import { resolveGenerationContext } from '../generation/resolveGenerationContext';
import { getComponentById } from '../manifest/catalog';

const ctx = { componentId: 'reading-repair-studio', topic: 'A pond', gradeLevel: '2', gradeContext: 'Grade 2',
  objective: {}, scope: {}, instanceId: 'test' } as GenerationContext;
const sentences = ['Yesterday the duck swam across the pond.', 'The little frog sat on a log.', 'Rain made the narrow path muddy.'];
beforeEach(() => generate.mockReset());
describe('reading repair generator contract', () => {
  it.each(['notice_and_repair', 'mixed', undefined])('routes %s without an extra model call or a different task', async targetEvalMode => {
    sentences.forEach(text => generate.mockResolvedValueOnce({ text: JSON.stringify({ text }) }));
    const resolved = resolveGenerationContext({ componentId: 'reading-repair-studio', instanceId: 'routing-test',
      intent: 'Check my reading against the print',
      config: { targetEvalMode, objectiveText: 'Notice and repair word recognition errors', objectiveGrade: '2' },
    }, 'A pond', 'Grade 2', 'elementary');
    expect(resolved).toMatchObject({ targetEvalMode, intent: 'Check my reading against the print',
      objective: { text: 'Notice and repair word recognition errors' }, grade: '2' });
    const data = await generateReadingRepairStudio(resolved);
    expect(generate).toHaveBeenCalledTimes(3);
    expect(data.challenges.every(c => c.challengeType === 'notice_and_repair')).toBe(true);
    for (const [call] of generate.mock.calls) {
      expect(call.contents).toContain('Check my reading against the print');
      expect(call.contents).toContain('notice_and_repair');
      expect(call.contents).not.toContain('mixed session');
    }
  });
  it('keeps task routing metadata separate from assessment eligibility', () => {
    const entry = getComponentById('reading-repair-studio');
    expect(entry?.supportsEvaluation).toBe(false);
    expect(entry?.evalModes).toEqual([expect.objectContaining({
      evalMode: 'notice_and_repair', challengeTypes: ['notice_and_repair'], beta: 4.5,
    })]);
  });
  it('uses the objective when no component intent is supplied', async () => {
    sentences.forEach(text => generate.mockResolvedValueOnce({ text: JSON.stringify({ text }) }));
    await generateReadingRepairStudio({ ...ctx, objective: { text: 'Check every letter when rereading' } });
    expect(generate.mock.calls[0][0].contents).toContain('Check every letter when rereading');
  });
  it.each(['default', 'find_mismatch', 'notice_and_repair|find_mismatch'])('rejects unsupported pin %s before generating', async targetEvalMode => {
    await expect(generateReadingRepairStudio({ ...ctx, targetEvalMode })).rejects.toThrow('Unsupported eval mode');
    expect(generate).not.toHaveBeenCalled();
  });
  it('produces three fresh indexed challenges from independent calls', async () => {
    sentences.forEach(text => generate.mockResolvedValueOnce({ text: JSON.stringify({ text }) }));
    const data = await generateReadingRepairStudio(ctx);
    expect(data.challenges.map(c => c.text)).toEqual(sentences);
    expect(data.challenges.map(c => c.id)).toEqual(['reading-repair-1', 'reading-repair-2', 'reading-repair-3']);
    expect(generate).toHaveBeenCalledTimes(3);
    expect(data.challenges.every(validRepairSentence)).toBe(true);
  });
  it('regenerates duplicates and malformed content instead of inserting fixtures', async () => {
    [sentences[0], sentences[0], 'Duck.', sentences[1], sentences[2]].forEach(text => generate.mockResolvedValueOnce({ text: JSON.stringify({ text }) }));
    expect((await generateReadingRepairStudio(ctx)).challenges).toHaveLength(3);
    expect(generate).toHaveBeenCalledTimes(5);
  });
  it('fails explicitly when retries cannot fill the contract', async () => {
    generate.mockResolvedValue({ text: JSON.stringify({ text: 'Duck.' }) });
    await expect(generateReadingRepairStudio(ctx)).rejects.toThrow('three valid unique sentences');
  });
  it('rejects unsafe or ambiguous printed references', () => {
    for (const text of ['Duck.', 'The wind blew across the pond.', 'There are 12 small ducks here.', 'The duck swims. The frog hops.', '<b>The duck swims away today.</b>']) {
      expect(validRepairSentence({ text })).toBe(false);
    }
  });
});
describe('blind audio judge boundary', () => {
  it('does not provide the printed answer to either transcription call', async () => {
    generate.mockResolvedValue({ text: JSON.stringify({ transcript: 'Yesterday Sam ride to the pond', confidence: 'high', complete: true }) });
    const verdict = await judgeReadingRepair('base64-audio', 'Yesterday, Sam rode to the pond.');
    expect(verdict.status).toBe('mismatch');
    expect(verdict.mismatchIndexes).toEqual([2]);
    for (const [call] of generate.mock.calls) expect(JSON.stringify(call.contents)).not.toContain('rode');
  });
  it('rejects malformed confidence instead of coercing it into a reading score', () => {
    expect(() => parseReadingTranscript({ transcript: 'hello', confidence: 'high', complete: 'true' })).toThrow();
  });
});
