import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent } } }));
import { generateLetterWorkshop, resolveLetterWorkshopScope, selectLetterWorkshopChallenges, validateLetterWorkshopWrapper } from './gemini-letter-workshop';
import { getLetterTemplate } from '../../primitives/visual-primitives/literacy/letterWorkshopGeometry';

const context = (overrides: Partial<GenerationContext> = {}): GenerationContext => ({
  componentId: 'letter-workshop', instanceId: 'test', topic: 'Letter formation', gradeLevel: 'kindergarten', gradeContext: 'Use simple words for kindergarten.', objective: {}, targetEvalMode: 'trace', scope: {} as GenerationContext['scope'], raw: {}, ...overrides,
});

describe('Letter Workshop code-owned pool', () => {
  it('defaults to four distinct Group 1 guides covering both cases', () => {
    const scope = resolveLetterWorkshopScope(context());
    expect(scope.templateIds).toEqual(Array.from('satipn').flatMap(l => [`uppercase-${l.toUpperCase()}`, `lowercase-${l}`]));
    const challenges = selectLetterWorkshopChallenges(scope);
    expect(challenges).toHaveLength(4);
    expect(new Set(challenges.map(ch => ch.templateId)).size).toBe(4);
    expect(new Set(challenges.map(ch => ch.id)).size).toBe(4);
    challenges.forEach(ch => expect(getLetterTemplate(ch.templateId)).toBeTruthy());
  });
  it.each([
    ['Letter Formation Group 1: s, a, t, i, p, n', 12],
    ['Letter Formation Group 2: c, k, e, h, r, m, d', 26],
    ['Letter Formation Group 3: g, o, u, l, f, b', 38],
    ['Letter Formation Group 4 (Final): j, z, w, v, y, x, q', 52],
  ])('keeps the studio requirement cumulative: %s', (text, total) => {
    expect(resolveLetterWorkshopScope(context({ objective: { text: String(text) } })).templateIds).toHaveLength(Number(total));
  });
  it('accepts the default tester topic with both cases', () => {
    expect(resolveLetterWorkshopScope(context({ topic: 'Assisted uppercase and lowercase letter formation tracing' })).templateIds).toHaveLength(12);
  });
  it.each([1, 2, 3, 4])('uses cumulative group %i', group => {
    const scope = resolveLetterWorkshopScope(context({ raw: { letterGroup: group, letterCase: 'both', challengeCount: 6 } }));
    expect(scope.templateIds).toHaveLength([12, 26, 38, 52][group - 1]);
    const challenges = selectLetterWorkshopChallenges(scope);
    expect(challenges).toHaveLength(6);
    expect(challenges.some(ch => ch.templateId.startsWith('uppercase-'))).toBe(true);
    expect(challenges.some(ch => ch.templateId.startsWith('lowercase-'))).toBe(true);
  });
  it('honors a literal lowercase l outside the default group without fake diversity', () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const scope = resolveLetterWorkshopScope(context({ topic: 'Trace lowercase l' }));
    expect(scope.templateIds).toEqual(['lowercase-l']);
    expect(selectLetterWorkshopChallenges(scope).every(ch => ch.templateId === 'lowercase-l')).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('scope-limited'));
    log.mockRestore();
  });
  it('honors objective and intent lists without splitting prose', () => {
    expect(resolveLetterWorkshopScope(context({ topic: 'Letter formation', intent: 'Trace uppercase letters A, B, C', objective: { text: 'Trace letters B and C' } })).templateIds).toEqual(['uppercase-B', 'uppercase-C']);
  });
  it('honors explicit scope and both case practice', () => {
    expect(resolveLetterWorkshopScope(context({ raw: { letters: ['q'], letterCase: 'both' } })).templateIds).toEqual(['uppercase-Q', 'lowercase-q']);
    expect(resolveLetterWorkshopScope(context({ raw: { letters: 'A, B; C', count: 3 } })).count).toBe(3);
  });
  it('resolves named vowels and explicit alphabet ranges without default-group clipping', () => {
    expect(resolveLetterWorkshopScope(context({ topic: 'Trace lowercase vowels' })).templateIds.sort()).toEqual(['lowercase-a', 'lowercase-e', 'lowercase-i', 'lowercase-o', 'lowercase-u']);
    expect(resolveLetterWorkshopScope(context({ topic: 'Trace uppercase A through Z' })).templateIds).toHaveLength(26);
    expect(() => resolveLetterWorkshopScope(context({ topic: 'Trace z-a' }))).toThrow('alphabetic order');
  });
  it.each([{ letters: [] }, { letters: 'cat' }, { letters: ['ab'] }, { letterCase: 'title' }, { letterGroup: 0 }, { letterGroup: 5 }, { letterGroup: '2' }, { count: 2 }, { count: 7 }, { count: 3.5 }, { letters: ['q'], letterGroup: 1 }])('rejects invalid config %j', raw => {
    expect(() => resolveLetterWorkshopScope(context({ raw }))).toThrow('Letter Workshop:');
  });
  it('rejects conflicting constraints instead of silently replacing them', () => {
    expect(() => resolveLetterWorkshopScope(context({ intent: 'Trace lowercase a', raw: { letterCase: 'uppercase' } }))).toThrow('conflicting case');
    expect(() => resolveLetterWorkshopScope(context({ intent: 'Trace a', raw: { letters: ['q'] } }))).toThrow('no common targets');
  });
  it.each(['Copy uppercase letters', 'Write letters independently', 'Write letters from memory'])('preserves scope for supported natural task %s', intent => {
    expect(resolveLetterWorkshopScope(context({ intent })).templateIds.length).toBeGreaterThan(0);
  });
  it.each(['independent', 'trace|unknown', 'unknown', ''])('rejects unsupported task pin %s', targetEvalMode => {
    expect(() => resolveLetterWorkshopScope(context({ targetEvalMode }))).toThrow('unsupported task');
  });
});

describe('Letter Workshop wrapper boundary', () => {
  beforeEach(() => generateContent.mockReset());
  it.each([null, {}, { title: '', description: 'Trace.', challengeType: 'trace' }, { title: 'Writing', description: 'Trace.', challengeType: 'copy' }, { title: 'Writing', description: 'Write independently.', challengeType: 'trace' }])('rejects malformed wrapper %j', wrapper => {
    expect(() => validateLetterWorkshopWrapper(wrapper)).toThrow();
  });
  it('calls Gemini only for framing and preserves curriculum context and owned geometry', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ title: 'Letter paths', description: 'Start at the dot and follow the arrows.', challengeType: 'trace', challenges: [{ templateId: 'fake' }] }) });
    const data = await generateLetterWorkshop(context({ intent: 'Trace lowercase l', objective: { text: 'Form the letter l' }, grade: 'K', raw: { challengeCount: 3 } }));
    expect(data.challenges).toHaveLength(3);
    expect(data.challenges.every(ch => ch.templateId === 'lowercase-l')).toBe(true);
    expect(data.gradeLevel).toBe('K');
    expect(data.componentIntent).toBe('Trace lowercase l');
    expect(data.objectiveText).toBe('Form the letter l');
    const request = generateContent.mock.calls[0][0];
    expect(request.contents).toContain('Objective: Form the letter l');
    expect(request.config.responseSchema.properties).not.toHaveProperty('challenges');
  });
  it('fails before spending an API call on unsupported tasks', async () => {
    await expect(generateLetterWorkshop(context({ targetEvalMode: 'unknown' }))).rejects.toThrow();
    expect(generateContent).not.toHaveBeenCalled();
  });
  it('surfaces upstream failures without a fake generated fallback', async () => {
    generateContent.mockRejectedValue(new Error('upstream unavailable'));
    await expect(generateLetterWorkshop(context())).rejects.toThrow('upstream unavailable');
    generateContent.mockResolvedValue({ text: '' });
    await expect(generateLetterWorkshop(context())).rejects.toThrow('no session wrapper');
    generateContent.mockResolvedValue({ text: '{invalid' });
    await expect(generateLetterWorkshop(context())).rejects.toThrow('invalid JSON');
  });
});

describe('Letter Workshop eval modes', () => {
  beforeEach(() => generateContent.mockReset());
  it.each(['trace', 'copy', 'write'] as const)('pins %s without a resolver call', async mode => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ title: 'Letter practice', description: 'Make your marks.', challengeType: mode }) });
    const result = await generateLetterWorkshop(context({ targetEvalMode: mode, raw: { letters: ['l'], count: 3 } }));
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(result.challenges.map(ch => ch.type)).toEqual([mode, mode, mode]);
    expect(result.challenges.every(ch => ch.templateId === 'lowercase-l')).toBe(true);
    expect(generateContent.mock.calls[0][0].config.responseSchema.properties.challengeType.enum).toEqual([mode]);
  });
  it.each([3, 6])('covers every type in mixed with count %i without leaving scope', async count => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ title: 'Practice', description: 'Make your marks.', challengeType: 'write' }) });
    const result = await generateLetterWorkshop(context({ targetEvalMode: 'mixed', raw: { letters: ['l'], count } }));
    expect(result.challenges).toHaveLength(count);
    expect(Array.from(new Set(result.challenges.map(ch => ch.type)))).toEqual(['trace', 'copy', 'write']);
    expect(result.challenges.every(ch => ch.templateId === 'lowercase-l')).toBe(true);
  });
  it('constrains a pinned blend and rejects wrapper drift', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ title: 'Practice', description: 'Make your marks.', challengeType: 'copy' }) });
    const result = await generateLetterWorkshop(context({ targetEvalMode: 'trace|copy' }));
    expect(Array.from(new Set(result.challenges.map(ch => ch.type)))).toEqual(['trace', 'copy']);
    expect(generateContent.mock.calls[0][0].config.responseSchema.properties.challengeType.enum).toEqual(['trace', 'copy']);
    await expect(generateLetterWorkshop(context({ targetEvalMode: 'write' }))).rejects.toThrow('task identity');
  });
  it.each([['copy'], ['copy', 'write'], ['trace', 'copy', 'write']])('consumes intent resolution %j', async (...modes) => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ modes }) });
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ title: 'Practice', description: 'Make your marks.', challengeType: modes[0] }) });
    const result = await generateLetterWorkshop(context({ targetEvalMode: undefined, intent: 'Practice the selected letter skills' }));
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(new Set(result.challenges.map(ch => ch.type))).toEqual(new Set(modes));
  });
});


describe('Letter Workshop tier generation', () => {
  it.each(['easy', 'medium', 'hard'])('applies %s per challenge in mixed and preserves a fixed-letter scope', async difficulty => {
    generateContent.mockReset().mockResolvedValue({ text: JSON.stringify({ title: 'Letter practice', description: 'Make your marks.', challengeType: 'trace' }) });
    const result = await generateLetterWorkshop(context({ targetEvalMode: 'mixed', raw: { difficulty, letters: ['l'], count: 3 } }));
    expect(result.challenges.map(ch => ch.type)).toEqual(['trace', 'copy', 'write']);
    for (const ch of result.challenges) {
      expect(ch.templateId).toBe('lowercase-l'); expect(ch.supportTier).toBe(difficulty);
      expect(ch.structure?.complexity).toBe(2);
      if (ch.type !== 'trace') expect(ch.support).toMatchObject({ showStarts: false, showArrows: false });
    }
    expect(generateContent.mock.calls[0][0].contents).toContain('narrow scope');
  });
});
