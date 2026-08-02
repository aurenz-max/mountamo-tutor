import { describe, expect, it } from 'vitest';
import {
  rhymeRemediationMoveFor,
  resolveRhymeSupportScaffold,
  applyRhymeSupportTier,
} from './gemini-rhyme-studio';

describe('RhymeStudio remediation affordances', () => {
  it.each([
    ['recognition', 'contrast_rime'],
    ['identification', 'diagnostic_option'],
    ['production', 'constrained_production'],
  ] as const)('maps %s to its remediation move', (mode, expected) => {
    expect(rhymeRemediationMoveFor(mode, 'The student matches onset instead of rime.')).toBe(expected);
  });
  it('leaves baseline untagged', () => expect(rhymeRemediationMoveFor('recognition')).toBeUndefined());
});

describe('RhymeStudio support-tier ladder', () => {
  it('easy shows every help (the legacy full-help render)', () => {
    expect(resolveRhymeSupportScaffold('easy')).toEqual({
      showRhymeFamilyHighlight: true,
      showWordImage: true,
      showInstructionText: true,
      tutorNamesOptions: true,
      productionCorrectCount: 2,
    });
  });

  it('medium withdraws the visual rime cue but keeps instruction + tutor enumeration', () => {
    const sc = resolveRhymeSupportScaffold('medium');
    expect(sc.showRhymeFamilyHighlight).toBe(false);
    expect(sc.showWordImage).toBe(false);
    expect(sc.showInstructionText).toBe(true);
    expect(sc.tutorNamesOptions).toBe(true);
    expect(sc.productionCorrectCount).toBe(2);
  });

  it('hard withdraws every scaffold and thins the production bank to 1 correct', () => {
    expect(resolveRhymeSupportScaffold('hard')).toEqual({
      showRhymeFamilyHighlight: false,
      showWordImage: false,
      showInstructionText: false,
      tutorNamesOptions: false,
      productionCorrectCount: 1,
    });
  });

  it('monotone withdrawal — no lever ever comes BACK as the tier rises', () => {
    const order = ['easy', 'medium', 'hard'] as const;
    const flags = ['showRhymeFamilyHighlight', 'showWordImage', 'showInstructionText', 'tutorNamesOptions'] as const;
    const rungs = order.map(t => resolveRhymeSupportScaffold(t));
    for (const flag of flags) {
      for (let i = 1; i < rungs.length; i++) {
        if (rungs[i][flag]) expect(rungs[i - 1][flag]).toBe(true);
      }
    }
  });
});

describe('applyRhymeSupportTier stamping', () => {
  const challenges = () => ([
    { id: 'c1', mode: 'recognition', targetWord: 'cat' },
    { id: 'c2', mode: 'identification', targetWord: 'cat' },
    { id: 'c3', mode: 'production', targetWord: 'cat' },
  ] as Array<Record<string, unknown>>);

  it('stamps every challenge at hard and only bank-bearing modes get the answer-form lever', () => {
    const chs = challenges();
    applyRhymeSupportTier(chs, 'hard', false);
    for (const ch of chs) {
      expect(ch.showRhymeFamilyHighlight).toBe(false);
      expect(ch.showInstructionText).toBe(false);
      expect(ch.showWordImage).toBe(false);
      expect(ch.tutorNamesOptions).toBe(false);
    }
    expect(chs[0].productionCorrectCount).toBeUndefined();
    expect(chs[1].productionCorrectCount).toBeUndefined();
    expect(chs[2].productionCorrectCount).toBe(1);
  });

  it('PRE band floor WINS over a hard tier: picture + tutor read-aloud stay on', () => {
    const chs = challenges();
    applyRhymeSupportTier(chs, 'hard', true);
    for (const ch of chs) {
      expect(ch.showWordImage).toBe(true);      // the emoji is the K answer surface
      expect(ch.tutorNamesOptions).toBe(true);  // the read-aloud is K's only instruction channel
      // the reader-only scaffolds are still withdrawn (they are inert at PRE anyway)
      expect(ch.showRhymeFamilyHighlight).toBe(false);
      expect(ch.showInstructionText).toBe(false);
    }
  });

  it('never touches the content — words, modes, options and answers are untouched', () => {
    const chs = [{
      id: 'c1', mode: 'production', targetWord: 'cat', rhymeFamily: '-at',
      acceptableAnswers: ['bat', 'hat', 'mat'],
    }] as Array<Record<string, unknown>>;
    applyRhymeSupportTier(chs, 'hard', false);
    expect(chs[0].targetWord).toBe('cat');
    expect(chs[0].mode).toBe('production');
    expect(chs[0].rhymeFamily).toBe('-at');
    expect(chs[0].acceptableAnswers).toEqual(['bat', 'hat', 'mat']);
  });
});
