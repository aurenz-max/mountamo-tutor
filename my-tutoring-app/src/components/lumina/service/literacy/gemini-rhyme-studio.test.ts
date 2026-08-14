import { describe, expect, it } from 'vitest';
import {
  rhymeRemediationMoveFor,
  resolveRhymeSupportScaffold,
  applyRhymeSupportTier,
  holdsRhymeIntegrity,
} from './gemini-rhyme-studio';

/**
 * The answer-key gate, pinned to the three false keys that live Gemini actually
 * produced across five DI-port probes on 2026-08-12. Live content is not
 * deterministic, so the probe cannot be the regression — this is.
 *
 * All three were silent under the pre-DI tap surface and all three are SPOKEN
 * under the judged loop, which is the whole reason the gate exists: where a port
 * converts a tap into a spoken relation, the content the tap never had to
 * justify has to be re-checked.
 */
describe('rhyme integrity — the answer key, checked in code', () => {
  it('DROPS a target whose rhyme family is not its own ending (live: shark / -ank / "tank")', () => {
    expect(holdsRhymeIntegrity({
      id: 'c1', mode: 'identification', targetWord: 'shark', rhymeFamily: '-ank',
      options: [
        { word: 'tank', isCorrect: true },
        { word: 'shell', isCorrect: false },
      ],
    })).toBe(false);
  });

  it('DROPS a rhyming "distractor" rather than correcting a correct child (live: crab / "fab")', () => {
    const ch: Record<string, unknown> = {
      id: 'c2', mode: 'identification', targetWord: 'crab', rhymeFamily: '-ab',
      options: [
        { word: 'coral', isCorrect: false },
        { word: 'fab', isCorrect: false },   // …but "fab" really does rhyme
        { word: 'grab', isCorrect: true },
      ],
    };
    expect(holdsRhymeIntegrity(ch)).toBe(true);
    expect((ch.options as Array<{ word: string }>).map((o) => o.word)).toEqual(['grab', 'coral']);
  });

  it('DROPS an acceptable answer that does not rhyme (live: jump / "lamp")', () => {
    const ch: Record<string, unknown> = {
      id: 'c3', mode: 'production', targetWord: 'jump', rhymeFamily: '-ump',
      acceptableAnswers: ['bump', 'lamp', 'pump', 'dump'],
    };
    expect(holdsRhymeIntegrity(ch)).toBe(true);
    expect(ch.acceptableAnswers).toEqual(['bump', 'pump', 'dump']);
  });

  it('recomputes doesRhyme from the words — the boolean is a claim, the words are the truth', () => {
    const rhyming: Record<string, unknown> = {
      mode: 'recognition', targetWord: 'cat', rhymeFamily: '-at', comparisonWord: 'hat', doesRhyme: false,
    };
    expect(holdsRhymeIntegrity(rhyming)).toBe(true);
    expect(rhyming.doesRhyme).toBe(true);

    const notRhyming: Record<string, unknown> = {
      mode: 'recognition', targetWord: 'cat', rhymeFamily: '-at', comparisonWord: 'cap', doesRhyme: true,
    };
    expect(holdsRhymeIntegrity(notRhyming)).toBe(true);
    expect(notRhyming.doesRhyme).toBe(false);
  });

  it('drops an identification item left with no distractor at all', () => {
    expect(holdsRhymeIntegrity({
      mode: 'identification', targetWord: 'cat', rhymeFamily: '-at',
      options: [{ word: 'hat', isCorrect: true }, { word: 'bat', isCorrect: false }],
    })).toBe(false);   // "bat" rhymes too — nothing wrong is left to choose between
  });

  it('drops a production item with no surviving rhyme', () => {
    expect(holdsRhymeIntegrity({
      mode: 'production', targetWord: 'jump', rhymeFamily: '-ump',
      acceptableAnswers: ['lamp', 'ramp'],
    })).toBe(false);
  });

  it('passes clean content untouched', () => {
    const ch: Record<string, unknown> = {
      mode: 'production', targetWord: 'cat', rhymeFamily: '-at',
      acceptableAnswers: ['bat', 'hat', 'mat'],
    };
    expect(holdsRhymeIntegrity(ch)).toBe(true);
    expect(ch.acceptableAnswers).toEqual(['bat', 'hat', 'mat']);
  });
});

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
  it('easy shows every help', () => {
    expect(resolveRhymeSupportScaffold('easy')).toEqual({
      showRhymeFamilyHighlight: true,
      showWordImage: true,
      tutorNamesOptions: true,
      productionCorrectCount: 2,
    });
  });

  it('medium withdraws the visual rime cue but keeps the tutor enumeration', () => {
    const sc = resolveRhymeSupportScaffold('medium');
    expect(sc.showRhymeFamilyHighlight).toBe(false);
    expect(sc.showWordImage).toBe(false);
    expect(sc.tutorNamesOptions).toBe(true);
    expect(sc.productionCorrectCount).toBe(2);
  });

  it('hard withdraws every scaffold and thins the production bank to 1 correct', () => {
    expect(resolveRhymeSupportScaffold('hard')).toEqual({
      showRhymeFamilyHighlight: false,
      showWordImage: false,
      tutorNamesOptions: false,
      productionCorrectCount: 1,
    });
  });

  it('monotone withdrawal — no lever ever comes BACK as the tier rises', () => {
    const order = ['easy', 'medium', 'hard'] as const;
    const flags = ['showRhymeFamilyHighlight', 'showWordImage', 'tutorNamesOptions'] as const;
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
      expect(ch.showWordImage).toBe(false);
      expect(ch.tutorNamesOptions).toBe(false);
    }
    expect(chs[0].productionCorrectCount).toBeUndefined();
    expect(chs[1].productionCorrectCount).toBeUndefined();
    expect(chs[2].productionCorrectCount).toBe(1);
  });

  it('PRE band floor WINS over a hard tier: picture + tutor enumeration stay on', () => {
    const chs = challenges();
    applyRhymeSupportTier(chs, 'hard', true);
    for (const ch of chs) {
      expect(ch.showWordImage).toBe(true);      // the emoji is the K answer surface
      // Without the enumeration a non-reader has no closed answer set at all.
      expect(ch.tutorNamesOptions).toBe(true);
      // the reader-only scaffold is still withdrawn (it is inert at PRE anyway)
      expect(ch.showRhymeFamilyHighlight).toBe(false);
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
