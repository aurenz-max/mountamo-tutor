import { describe, expect, it } from 'vitest';
import { parseLessonPackage, type LessonPackage } from '../lessonPackage';
import { canCarryKeep } from '../rerunIdentity';
import { extractLesson } from './extract';
import { ContentLearner, PROFILES, runJourney, validateScenario } from './run';
import type { InstructionEvent, JourneyScenario, LessonContract } from './types';

const letters = ['m', 's', 'f'];
const challenge = (letter: string, i: number, tier = 'easy') => ({ id: `s${i}`, challengeType: 'letter_sound', supportTier: tier, letter, spoken: letter.repeat(3), keyword: { m: 'moon', s: 'sun', f: 'fish' }[letter] ?? 'nest', elicitation: 'isolated', emoji: '' });
const contract = (): LessonContract => ({ id: 'one', topic: 'Sounds', gradeLevel: 'kindergarten', requires: [],
  targets: letters.map((target) => ({ capability: 'sound-production', target, graphemes: [target] })),
  allowedGraphemes: letters, packagePath: 'unused.json',
  probes: letters.flatMap((target) => [0, 1, 2].map((n) => ({ id: `${target}${n}`, capability: 'sound-production' as const, target, graphemes: [target] }))),
});
const scenario = (): JourneyScenario => ({ version: 1, id: 'test', curriculumSource: 'test fixture', lessons: [contract()], minIndependentItems: 2, minProbeAccuracy: .8, retentionDays: 2, seeds: [42] });
function pkg(componentId = 'di-letter-sounds', data: unknown = { challenges: [...letters, ...letters, ...letters].map((l, i) => challenge(l, i, 'hard')) }): LessonPackage {
  return parseLessonPackage({ benchVersion: 1, id: 'fixture', provenance: { generatedAt: '2026-09-05', source: 'test' },
    manifest: { topic: 'Sounds', gradeLevel: 'kindergarten', layout: [{ componentId, instanceId: 'block', title: 'Sounds', intent: '', config: {}, objectiveIds: ['obj1'] }] },
    curatorBrief: { hook: { content: 'Sounds' }, objectives: [{ id: 'obj1', text: 'Produce sounds' }] },
    components: [{ componentId, instanceId: 'block', data }],
  });
}
const run = (p: LessonPackage, profile = PROFILES[0]) => runJourney(scenario(), [{ contract: contract(), package: p }], profile, 42).lessons[0];

describe('actual lesson content, independent evidence and persona controls', () => {
  it('reads the production cue and excludes its private judging answer key', () => {
    const event = extractLesson(pkg(), contract()).events[0];
    expect(event.cue).toBe('Your turn. What sound?');
    expect(event.modeled).toBe(false);
    expect(event.source).toBe('/components/0/data/challenges/0');
    expect(event.skillId).toBeUndefined();
  });
  it('never converts modeled echo success into independent mastery', () => {
    const p = pkg('di-letter-sounds', { challenges: Array.from({ length: 12 }, (_, i) => challenge(letters[i % 3], i)) });
    const r = run(p, PROFILES.find((p) => p.id === 'echo-only')!);
    expect(r.attempts.every((a) => a.finalCorrect)).toBe(true);
    expect(r.independentItems).toBe(0);
    expect(r.after.every((p) => !p.correct)).toBe(true);
    expect(r.decision).toBe('INSUFFICIENT_EVIDENCE');
  });
  it('can advance a prepared learner with independent and delayed evidence', () => {
    const prepared = { ...PROFILES[0], initial: Object.fromEntries(letters.map((l) => [`sound-production:${l}`, 1])), slip: 0, decay: 0 };
    expect(run(pkg(), prepared).decision).toBe('ADVANCE');
  });
  it('can teach an initially unprepared learner, then verify cold retrieval', () => {
    const challenges = Array.from({ length: 90 }, (_, i) => challenge(letters[i % 3], i, 'easy'));
    challenges.push(...Array.from({ length: 9 }, (_, i) => challenge(letters[i % 3], i + 90, 'hard')));
    const r = run(pkg('di-letter-sounds', { challenges }), { ...PROFILES[1], slip: 0, decay: 0 });
    expect(r.before.every((p) => !p.correct)).toBe(true);
    expect(r.decision).toBe('ADVANCE');
  });
  it('routes retained knowledge failure to review instead of advancing on the post-test peak', () => {
    const forgetful = { ...PROFILES[0], initial: Object.fromEntries(letters.map((l) => [`sound-production:${l}`, 1])), slip: 0, decay: 2 };
    expect(run(pkg(), forgetful).decision).toBe('REVIEW');
  });
  it('cannot learn from inaccessible audio even when every catalog role claims instruction', () => {
    const r = run(pkg(), PROFILES.find((p) => p.id === 'no-audio')!);
    expect(r.attempts.every((a) => !a.accessible && a.after === 0)).toBe(true);
    expect(r.decision).not.toBe('ADVANCE');
  });
  it('removing the model changes learning; exposure alone has no effect', () => {
    const e = extractLesson(pkg('di-letter-sounds', { challenges: [challenge('m', 0)] }), contract()).events[0];
    const a = new ContentLearner(PROFILES[0], 42), b = new ContentLearner(PROFILES[0], 42);
    a.act(e, true);
    b.act({ ...e, modeled: false, guided: false, feedback: false }, true);
    expect(a.probability(e)).toBeGreaterThan(0);
    expect(b.probability(e)).toBe(0);
  });
  it('does not teach from held-out probes or by reading the answer key', () => {
    const learner = new ContentLearner(PROFILES[0], 42);
    for (let n = 0; n < 30; n++) learner.probe(contract().probes);
    expect(learner.knowledge).toEqual({});
  });
  it('flags unknown components instead of crediting their catalog description', () => {
    const r = run(pkg('foundation-explorer', { correct: true }));
    expect(r.unknowns[0].code).toBe('NO_CONTENT_ADAPTER');
    expect(r.decision).toBe('INSUFFICIENT_EVIDENCE');
  });
  it('blocks content outside the contract and awards it no learning credit', () => {
    const r = run(pkg('di-letter-sounds', { challenges: [challenge('n', 0)] }));
    expect(r.decision).toBe('BLOCKED');
    expect(r.attempts[0].after).toBe(0);
  });
  it('rejects missing payloads and partially parsed blocks', () => {
    const missing = pkg(); missing.components = [];
    expect(run(missing).findings[0].code).toBe('MISSING_PAYLOAD');
    const malformed = pkg('di-letter-sounds', { challenges: [challenge('m', 0), {}] });
    expect(extractLesson(malformed, contract()).events).toHaveLength(0);
  });
  it('recognizes that hard blender still models the word and supplies no cold assessment', () => {
    const p = pkg('phonics-blender', { nameTargetPhonemes: false, words: [{ id: 'w1', targetWord: 'sam', phonemes: ['s', 'a', 'm'].map((letters) => ({ id: letters, letters, sound: `/${letters}/` })) }] });
    const e = extractLesson(p, { ...contract(), allowedGraphemes: ['s', 'a', 'm'] }).events[0];
    expect(e.modeled).toBe(true); expect(e.explainsRelation).toBe(false);
    expect(e.cue).toContain('Listen: sam');
  });
  it('keyword repetition does not count as production of the vowel sound', () => {
    const p = pkg('di-letter-sounds', { challenges: [{ ...challenge('a', 0, 'hard'), keyword: 'apple', elicitation: 'keyword' }] });
    const e = extractLesson(p, { ...contract(), allowedGraphemes: ['a'] }).events[0];
    expect(e.capability).toBe('keyword'); expect(e.modeled).toBe(true);
  });
  it('decoding requires known graphemes as well as blending skill', () => {
    const learner = new ContentLearner({ ...PROFILES[0], initial: { 'decode:*': 1 } }, 42);
    expect(learner.probability({ capability: 'decode', target: 'sam', graphemes: ['s', 'a', 'm'] })).toBe(0);
  });
  it('invalidates a held-out word that appears in the delivered lesson', () => {
    const s = scenario();
    s.lessons[0] = { ...contract(), allowedGraphemes: ['s', 'a', 'm', 'n'], targets: [{ capability: 'decode', target: '*', graphemes: ['s', 'a', 'm', 'n'] }],
      probes: ['sam', 'man'].map((target) => ({ id: target, capability: 'decode', target, graphemes: target.split('') })) };
    const p = pkg('phonics-blender', { words: [{ id: 'w1', targetWord: 'sam', phonemes: ['s', 'a', 'm'].map((letters) => ({ id: letters, letters, sound: `/${letters}/` })) }] });
    const r = runJourney(s, [{ contract: s.lessons[0], package: p }], PROFILES[1], 42).lessons[0];
    expect(r.reasons.some((r) => r.includes('Transfer probes appeared'))).toBe(true);
    expect(r.after.map((p) => p.target)).toEqual(['man']);
    expect(r.decision).not.toBe('ADVANCE');
  });
  it('blocks the next lesson when prerequisites have not been demonstrated', () => {
    const s = scenario(); s.lessons.push({ ...contract(), id: 'two', requires: ['one'] });
    const r = runJourney(s, s.lessons.map((contract) => ({ contract, package: pkg() })), PROFILES.find((p) => p.id === 'echo-only')!, 42);
    expect(r.lessons[1].decision).toBe('BLOCKED'); expect(r.lessons[1].attempts).toEqual([]);
  });
  it('is reproducible and does not mutate a replayed package', () => {
    const p = pkg(), original = JSON.stringify(p);
    expect(run(p)).toEqual(run(p)); expect(JSON.stringify(p)).toBe(original);
  });
  it('validates the sequence and requires probes per target', () => {
    const s = scenario(); s.lessons[0].requires = ['missing'];
    expect(() => validateScenario(s)).toThrow();
    const t = scenario(); t.lessons[0].probes = [];
    expect(() => validateScenario(t)).toThrow();
  });
});

describe('rerun approval identity', () => {
  it('carries only byte-equivalent reviewed content, scope and difficulty', () => {
    const a = pkg(), b = structuredClone(a);
    expect(canCarryKeep(a, 'block', b, 'block')).toBe(true);
    b.components[0].data = { challenges: [challenge('s', 0)] };
    expect(canCarryKeep(a, 'block', b, 'block')).toBe(false);
    const c = structuredClone(a); c.manifest.layout![0].config = { difficulty: 'hard' };
    expect(canCarryKeep(a, 'block', c, 'block')).toBe(false);
  });
});

describe('tap and exposure adapters keep certification honest without blocking it', () => {
  const kc = { problems: [
    { type: 'multiple_choice', id: 'mc_1', question: 'Which word starts with the sss sound?', options: [{ id: 'A', text: 'Apple' }, { id: 'B', text: 'Sun' }], correctOptionId: 'B' },
    { type: 'true_false', id: 'tf_1', statement: "The letter 'a' makes the short /ă/ sound, like in apple.", correct: true },
  ] };
  it('reads a knowledge-check as onset / sound-recognition by tap, never as production', () => {
    const e = extractLesson(pkg('knowledge-check', kc), contract()).events;
    expect(e.map((x) => [x.capability, x.target, x.modality])).toEqual([['onset', 's', 'tap'], ['sound-recognition', 'a', 'tap']]);
    expect(e[0].cue).toBe('Which word starts with the sss sound? Apple, Sun');
    const r = run(pkg('knowledge-check', kc));
    expect(r.unknowns).toEqual([]);
    expect(r.reasons.some((x) => x.includes('unverified'))).toBe(false);
  });
  it('reads fast-fact "which letter starts…" as sound-recognition and refuses questions it cannot read', () => {
    const ff = { challenges: [{ id: 'c1', challengeType: 'recognize', responseMode: 'choice', prompt: { text: 'Which letter starts the word sun?' }, correctAnswer: 's', options: ['s', 'm'] }] };
    expect(extractLesson(pkg('fast-fact', ff), contract()).events[0]).toMatchObject({ capability: 'sound-recognition', target: 's', modality: 'tap' });
    const odd = { challenges: [{ id: 'c1', challengeType: 'recall', responseMode: 'choice', prompt: { text: 'How many sides has a square?' }, correctAnswer: '4', options: ['3', '4'] }] };
    expect(extractLesson(pkg('fast-fact', odd), contract()).unknowns[0].code).toBe('UNSUPPORTED_CONTENT');
  });
  it('records a card grid as exposure: known, uncredited, not a certification stop', () => {
    const r = run(pkg('concept-card-grid', { cards: [{ title: 'Sun' }] }));
    expect(r.exposures[0].code).toBe('EXPOSURE_ONLY');
    expect(r.unknowns).toEqual([]);
    expect(r.attempts).toEqual([]);
  });
  it('letter-spotter find-it is letterform recognition by tap', () => {
    const spotter = { supportTier: 'easy', challenges: [{ id: 'ch1', mode: 'find-it', targetLetter: 's', targetCase: 'uppercase', letterGrid: ['A', 'S', 'M', 'F', 'A', 'M', 'F', 'A', 'M', 'F', 'A', 'M', 'F', 'A', 'M', 'F'], targetCount: 1, showTargetReference: true }] };
    const e = extractLesson(pkg('letter-spotter', spotter), contract()).events[0];
    expect(e).toMatchObject({ capability: 'letter-recognition', target: 's', modality: 'tap', explainsRelation: false });
  });
  it('--waive-prerequisites runs a chained lesson for audit but can never certify it', () => {
    const s = scenario(); s.lessons.push({ ...contract(), id: 'two', requires: ['one'] });
    const prepared = { ...PROFILES[0], initial: Object.fromEntries(letters.map((l) => [`sound-production:${l}`, 1])), slip: 0, decay: 0 };
    const inputs = s.lessons.map((c) => ({ contract: c, package: pkg('di-letter-sounds', { challenges: [challenge('n', 0)] }) }));
    inputs[1].package = pkg();
    const r = runJourney(s, inputs, prepared, 42, { waivePrerequisites: true });
    expect(r.lessons[0].decision).toBe('BLOCKED');
    expect(r.lessons[1].prerequisitesWaived).toBe(true);
    expect(r.lessons[1].attempts.length).toBeGreaterThan(0);
    expect(r.lessons[1].decision).not.toBe('ADVANCE');
    expect(r.lessons[1].reasons.some((x) => x.includes('waived'))).toBe(true);
  });
});
