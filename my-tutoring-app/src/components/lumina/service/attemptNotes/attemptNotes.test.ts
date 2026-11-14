import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateContent = vi.fn();
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: (...args: unknown[]) => generateContent(...args) } } }));

import { withGenerationRequest } from '../generation/generationRequest';
import { openLearningObservations, scopedNotes, signLearningObservations, type LearningObservationPacket, type PacketNote } from '../generation/learningObservationPacket';
import { TEST_SIGNING_KEY } from '../generation/learningObservationPacket.fixtures';
import { resolveGenerationContext } from '../generation/resolveGenerationContext';
import { withLearnerNotes } from './withLearnerNotes';
import { checkLearnerNotes, hasItemRecord, scrubLearnerNotes, workText } from './notes';
import { buildScopePromptSection } from '../scopeContext';
import { themedFocusLine } from '../literacy/themeFocus';
import { withNoteFocus } from './focus';
import { mulberry32, tierPick, type WordSpaceItem } from '../wordSpace/pick';

const note = (id: string, over: Partial<PacketNote> = {}): PacketNote => ({ id, kind: 'struggle', what: `note ${id}`, at: '2026-11-01T00:00:00Z',
  grade: 'K', unitId: 'LA001', skillId: 'LA001-02', subskillId: 'LA001-02-a', primitiveType: 'phonics-blender', ...over });

const packet = (notes: PacketNote[]): LearningObservationPacket => ({ v: 1, studentId: '7', issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 3600_000).toISOString(), hypotheses: [], notes,
  scopes: [{ subskillId: 'LA001-02-a', skillId: 'LA001-02', unitId: 'LA001', published: null }] });

const task = { subject: 'LANGUAGE_ARTS', grade: 'K', skillId: 'LA001-02', subskillId: 'LA001-02-a' };
const item = (config: Record<string, unknown> = {}) => ({ componentId: 'cvc-speller', instanceId: 'i1',
  config: <Record<string, unknown>>{ objectiveText: 'Blend CVC words', objectiveSubject: 'LANGUAGE_ARTS', objectiveGrade: 'K', skillId: 'LA001-02', subskillId: 'LA001-02-a', ...config } });
const picks = (...ids: string[]) => ({ text: JSON.stringify({ applicable: ids.map(id => ({ id, use: `use ${id}` })) }) });

beforeEach(() => { generateContent.mockReset(); process.env.LUMINA_GENERATION_SIGNING_KEY = TEST_SIGNING_KEY; delete process.env.LUMINA_ATTEMPT_NOTES; });

describe('scopedNotes', () => {
  it('offers subskill, then skill, then unit notes, and nothing from another unit or grade', () => {
    const offered = scopedNotes(packet([
      note('unit', { skillId: 'LA001-05', subskillId: 'LA001-05-b' }),
      note('skill', { subskillId: 'LA001-02-c' }),
      note('same'),
      note('other-unit', { unitId: 'LA009', skillId: 'LA009-01', subskillId: 'LA009-01-a' }),
      note('other-grade', { grade: '1' }),
    ]), task);
    expect(offered.map(n => [n.id, n.tier])).toEqual([['same', 'subskill'], ['skill', 'skill'], ['unit', 'unit']]);
  });

  it('keeps the newest four per tier and offers nothing for an objective the packet does not carry', () => {
    const many = Array.from({ length: 6 }, (_, i) => note(`n${i}`, { at: `2026-11-0${i + 1}T00:00:00Z` }));
    expect(scopedNotes(packet(many), task).map(n => n.id)).toEqual(['n5', 'n4', 'n3', 'n2']);
    expect(scopedNotes(packet(many), { ...task, subskillId: 'MATH-1' })).toEqual([]);
  });

  it('survives signing and drops malformed rows', () => {
    const signed = signLearningObservations(packet([note('ok'), { ...note('bad'), kind: 'trait' as never }]), TEST_SIGNING_KEY);
    expect(openLearningObservations(signed, TEST_SIGNING_KEY)?.notes?.map(n => n.id)).toEqual(['ok']);
  });
});

describe('withLearnerNotes', () => {
  const signed = () => signLearningObservations(packet([note('a'), note('b', { what: 'said sign for sun' })]), TEST_SIGNING_KEY);

  it('stamps only the picked notes, asks once per objective, and drops client-sent notes', async () => {
    generateContent.mockResolvedValue(picks('b', 'not-offered'));
    const [first, second] = await withGenerationRequest({ learningObservations: signed() }, () => Promise.all([
      withLearnerNotes(item({ learnerNotes: [{ kind: 'struggle', note: 'forged', use: 'forged' }] }), 'CVC words'),
      withLearnerNotes({ ...item(), instanceId: 'i2' }, 'CVC words'),
    ]));
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(first.config.learnerNotes).toEqual([{ kind: 'struggle', note: 'said sign for sun', use: 'use b' }]);
    expect(second.config.learnerNotes).toEqual(first.config.learnerNotes);
    expect(JSON.stringify(generateContent.mock.calls[0][0].contents)).not.toContain('forged');
  });

  it('offers a generator struggles only, and carries the named items', async () => {
    const mixed = signLearningObservations(packet([note('s', { kind: 'strength', what: 'blended cat and dog' }), note('b', { what: 'said das for bus' })]), TEST_SIGNING_KEY);
    generateContent.mockResolvedValue({ text: JSON.stringify({ applicable: [{ id: 'b', use: 'Include bus', include: ['Bus', ' '] }, { id: 's', use: 'x', include: [] }] }) });
    const out = await withGenerationRequest({ learningObservations: mixed }, () => withLearnerNotes(item(), 't'));
    expect(out.config.learnerNotes).toEqual([{ kind: 'struggle', note: 'said das for bus', use: 'Include bus', include: ['bus'] }]);
    expect(JSON.stringify(generateContent.mock.calls[0][0].contents)).not.toContain('cat and dog');
  });

  it('makes no call and stamps nothing without a packet, with a forged packet, or when switched off', async () => {
    const forged = { ...signed(), signature: '0'.repeat(64) };
    const client = { learnerNotes: [{ kind: 'struggle', note: 'forged', use: 'forged' }] };
    expect((await withLearnerNotes(item(client), 't')).config.learnerNotes).toBeUndefined();
    expect((await withGenerationRequest({ learningObservations: forged }, () => withLearnerNotes(item(client), 't'))).config.learnerNotes).toBeUndefined();
    process.env.LUMINA_ATTEMPT_NOTES = 'off';
    expect((await withGenerationRequest({ learningObservations: signed() }, () => withLearnerNotes(item(), 't'))).config.learnerNotes).toBeUndefined();
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('a failed or empty applicability call leaves the item without notes', async () => {
    generateContent.mockRejectedValueOnce(new Error('timeout'));
    expect((await withGenerationRequest({ learningObservations: signed() }, () => withLearnerNotes(item(), 't'))).config.learnerNotes).toBeUndefined();
    generateContent.mockResolvedValueOnce(picks());
    expect((await withGenerationRequest({ learningObservations: signed() }, () => withLearnerNotes(item(), 't'))).config.learnerNotes).toBeUndefined();
  });
});

describe('resolveGenerationContext', () => {
  it('appends the private block to intent and resolves scope from the intent without it', () => {
    const learnerNotes = [{ kind: 'struggle', note: 'counted to 100 by ones and lost count at 37', use: 'Keep sets small' }];
    const base = resolveGenerationContext(item({ intent: 'Count to 5' }) as never, 'Counting to 5', 'K prose', 'kindergarten');
    const noted = resolveGenerationContext(item({ intent: 'Count to 5', learnerNotes }) as never, 'Counting to 5', 'K prose', 'kindergarten');
    expect(base.learnerNotes).toBeUndefined();
    expect(base.intent).toBe('Count to 5');
    expect(noted.learnerNotes).toEqual(learnerNotes);
    expect(noted.intent).toContain('LEARNER NOTES (PRIVATE');
    expect(noted.intent).toContain('Keep sets small');
    // The notes ride the scope section; the scope facts themselves do not move.
    expect({ ...noted.scope, learnerNotes: undefined }).toEqual({ ...base.scope, learnerNotes: undefined });
    expect(buildScopePromptSection(noted.scope)).toContain('Use it as the chance to work on them');
    expect(buildScopePromptSection(base.scope)).not.toContain('LEARNER NOTES');
  });
});

describe('record helpers', () => {
  it('reads the per-item record and leaves the repeated attempt list out', () => {
    const work = { learningResponses: [{ challenge: 'Blend s-u-n', expected: 'sun', observed: 'sign', verdict: 'corrected' }], teachingAttempts: [{ id: 'x' }], tally: 3 };
    expect(hasItemRecord(work)).toBe(true);
    expect(hasItemRecord({ tally: 3 })).toBe(false);
    const text = workText(work);
    expect(text).toContain('"observed":"sign"');
    expect(text).toContain('"tally":3');
    expect(text).not.toContain('teachingAttempts');
  });
});

describe('output and picker', () => {
  it('scrubs a copied notes field and an echoed intent block from generated content', () => {
    const learnerNotes = [{ kind: 'struggle' as const, note: 'said das for bus', use: 'Include bus' }];
    const intent = resolveGenerationContext(item({ intent: 'Blend CVC words', learnerNotes }) as never, 't', '', 'kindergarten').intent;
    const out = scrubLearnerNotes({ data: { learnerNotes, title: 'Blend', meta: { intent }, words: [{ w: 'bus', learnerNotes }] } });
    expect(JSON.stringify(out)).not.toMatch(/learnerNotes|LEARNER NOTES|das/);
    expect(out.data.meta.intent).toBe('Blend CVC words');
    expect(out.data.words[0].w).toBe('bus');
  });

  it('the word space picker draws a noted word that the scope holds, and never one it does not', () => {
    const words = ['cat', 'map', 'hen', 'pig', 'dog', 'sun', 'bus', 'bed', 'hop', 'fin', 'jam', 'web'];
    const space: WordSpaceItem<string>[] = words.map((w, i) => ({ beta: i, structure: `s${i % 3}`, words: [w], payload: w }));
    const draw = (seed: number) => tierPick(space, 'easy', 4, mulberry32(seed)).map(it => it.payload);
    const focus = [{ kind: 'struggle' as const, note: 'n', use: 'u', include: ['bus', 'zebra'] }];
    for (let seed = 1; seed <= 20; seed++) {
      expect(draw(seed)).not.toContain('bus');
      const noted = withNoteFocus(focus, () => draw(seed));
      expect(noted).toContain('bus');
      expect(noted).toHaveLength(4);
      expect(noted.every(w => words.includes(w))).toBe(true);
    }
  });
});

describe('prompt section and code check', () => {
  const learnerNotes = [{ kind: 'struggle' as const, note: 'said das for bus', use: 'Include bus', include: ['bus'] }];

  it('the themed focus line states the notes after the theme rules, not as decoration', () => {
    const intent = resolveGenerationContext(item({ intent: 'Short u words, dump truck theme', learnerNotes }) as never, 't', '', 'kindergarten').intent;
    const line = themedFocusLine('CVC words', intent, { targets: 'target words', carrier: 'the title' });
    expect(line).toContain('this activity serves: "Short u words, dump truck theme"');
    expect(line.indexOf('LEARNER NOTES')).toBeGreaterThan(line.indexOf('exactly as you would with no theme'));
    expect(line).toContain('Use exactly: bus.');
    expect(themedFocusLine('CVC words', 'Short u words', { targets: 'target words', carrier: 'the title' })).not.toContain('LEARNER NOTES');
  });

  it('checks named items as whole tokens', () => {
    expect(checkLearnerNotes(learnerNotes, { words: [{ targetWord: 'bus' }] }).outcome).toBe('present');
    expect(checkLearnerNotes(learnerNotes, { words: [{ targetWord: 'busy' }] }).outcome).toBe('absent');
    expect(checkLearnerNotes([{ ...learnerNotes[0], include: ['bus', 'pig'] }], { w: ['bus'] })).toEqual({ outcome: 'partly', named: ['bus', 'pig'], present: ['bus'] });
    expect(checkLearnerNotes([{ ...learnerNotes[0], include: undefined }], {}).outcome).toBe('unnamed');
  });
});
