/**
 * numberBondScript — the pedagogy lives here, so this is where it is pinned.
 * Pure: no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (checkPackGates =
 *     validateJudgedScriptPack + performed-stage-directions + repeated-asks).
 *  2. THE FORK: missing-part speaks; decompose / fact-family / build-equation
 *     keep their hands. Changing a row here is a contract change, not an edit.
 *  3. BUILD GATES: invalid parts (0, the whole), out-of-range wholes, symbolic
 *     modes at K, and consecutive duplicate challenges are DROPPED, never
 *     repaired; decompose expands one challenge into one judged turn per pair.
 *  4. ANSWER-LEAK: the spoken ask never contains the missing part — including
 *     the structural phrase "two parts", struck because two IS the answer
 *     whenever whole − part = 2 — and the symmetric bond (whole six, part
 *     three) is the deliberate exception where the ask legitimately says the
 *     answer as the known part.
 *  5. Corrections re-model the count-up walk then re-elicit, and they are the
 *     FIRST place the answer is spoken. The contract names the signature error
 *     (the whole echoed back) and the accept clause ("two more" counts).
 *  6. Hand items carry a SILENCE contract; every verdict is code-computed and
 *     the cue names WHICH fault happened.
 *  7. The catalog keeps its side: audio mode, contextKeys, template keys,
 *     sentinel scan — and its steering names the microphone.
 *  8. Harness answer material mirrors the discrimination clauses it drills.
 */
import { describe, it, expect } from 'vitest';
import {
  actionFor,
  answerKindFor,
  bondEquationFaultOf,
  bondEquationVerdictCue,
  bondVerdictCueForPlaced,
  buildBondItems,
  completeCue,
  familyFaultOf,
  familyHelperExample,
  familyVerdictCue,
  isSayableAnswer,
  isValidBondPart,
  itemCue,
  itemsFromChallenge,
  moveOnCue,
  numberBondHarnessAnswers,
  numberBondPackBase,
  parseBondEquation,
  pronounceCue,
  responseClassFor,
  splitVerdictCue,
  stimulusFor,
  type NumberBondItem,
} from '../numberBondScript';
import {
  findSentinelCollisions,
  spokenSpanOf,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../../hooks/judgedScriptContract.testkit';
import { MATH_CATALOG } from '../../../../service/manifest/catalog/math';

// ── Fixtures ────────────────────────────────────────────────────────────────

const CTX_K = { band: 'K', maxNumber: 5 } as const;
const CTX_1 = { band: '1', maxNumber: 10 } as const;

/** whole 5 → pairs [0,5] [1,4] [2,3] → three judged turns. */
const DECOMPOSE = itemsFromChallenge({ id: 'c1', type: 'decompose', whole: 5 }, CTX_K);
const [D0, D1, D2] = DECOMPOSE;
/** whole 5, part 3 → the child says "two". */
const MP = itemsFromChallenge({ id: 'c2', type: 'missing-part', whole: 5, part1: 3 }, CTX_K)[0];
/** The symmetric bond: whole 6, part 3 → the ANSWER equals the known part. */
const MP_SYM = itemsFromChallenge({ id: 'c3', type: 'missing-part', whole: 6, part1: 3 }, CTX_1)[0];
const FAMILY = itemsFromChallenge({ id: 'c4', type: 'fact-family', whole: 7, part1: 3 }, CTX_1)[0];
const BUILD_EQ = itemsFromChallenge({ id: 'c5', type: 'build-equation', whole: 7, part1: 3 }, CTX_1)[0];

const ITEMS: NumberBondItem[] = [...DECOMPOSE, MP, MP_SYM, FAMILY, BUILD_EQ];

/** The pack's CUE SURFACE — the real one; the component and the DI drive-plan
 *  endpoint spread this same export, so this fixture tests the wire. */
const pack: JudgedScriptPack<NumberBondItem> = numberBondPackBase(ITEMS);

/**
 * ⚠️ THE REAL SESSION SHAPE (testkit warning): a one-item-per-mode pack is the
 * one shape the repeat-ask gate can never fire on. A real single-mode session
 * runs same-action items back to back — including a whole-7 decompose whose
 * two middle turns ask the BYTE-IDENTICAL short line, which is the invariant
 * DI signal the gate must PASS, and two missing-part items whose asks differ
 * only by their numbers.
 */
const DECOMPOSE_7 = itemsFromChallenge({ id: 's1', type: 'decompose', whole: 7 }, CTX_1);
const SESSION_ITEMS: NumberBondItem[] = [
  ...DECOMPOSE_7,
  ...itemsFromChallenge({ id: 's2', type: 'missing-part', whole: 9, part1: 4 }, CTX_1),
  ...itemsFromChallenge({ id: 's3', type: 'missing-part', whole: 8, part1: 2 }, CTX_1),
];
const sessionPack = numberBondPackBase(SESSION_ITEMS);

const spokenLine = spokenSpanOf;

// ── 1. Structural gates ─────────────────────────────────────────────────────

describe('number-bond pack · structural gates', () => {
  it('passes the family gates: validate + performed-directions + repeated-asks', () => {
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('passes the gates in the REAL session shape (same-action items back to back)', () => {
    // whole 7 → four pairs → its two middle asks are byte-identical on purpose:
    // "Find a different way to make seven." is the short invariant DI signal
    // (7 words, under the recitation limit), not a recited frame.
    expect(DECOMPOSE_7).toHaveLength(4);
    expect(itemCue(DECOMPOSE_7[1])).toBe(itemCue(DECOMPOSE_7[2]));
    expect(spokenLine(itemCue(DECOMPOSE_7[1])).split(/\s+/).length).toBeLessThanOrEqual(12);
    expect(checkPackGates(sessionPack)).toEqual([]);
  });

  it('maps modes to the ruled answer material and benched classes', () => {
    // THE FORK. missing-part is sayable across a table, so it is SPOKEN — the
    // stepper was a costume. The other three are the page: splitting counters,
    // writing equations, building the sentence IS the skill.
    expect(answerKindFor('missing-part')).toBe('voice');
    expect(responseClassFor('missing-part')).toBe('number_word_to_20');
    for (const kind of ['decompose', 'fact-family', 'build-equation'] as const) {
      expect(answerKindFor(kind)).toBe('gesture');
      expect(responseClassFor(kind)).toBe('manipulation');
    }
  });

  it('stamps a distinct action per mode so mixed sessions re-speak the how-to-play', () => {
    const actions = (['decompose', 'missing-part', 'fact-family', 'build-equation'] as const)
      .map(actionFor);
    expect(new Set(actions).size).toBe(4);
  });

  it('never hands the tutor a stage direction shaped like something to perform', () => {
    for (const item of ITEMS) {
      for (const cue of [itemCue(item), moveOnCue(item, MP, { howToPlay: true })]) {
        expect(cue).not.toMatch(/Then WAIT/i);
        expect(cue).toContain('The quoted line is the ONLY thing you say');
        expect(cue).toContain('never announce that you are waiting or listening');
      }
    }
  });
});

// ── 2. Build gates — KEEP OR DROP, never backfill ───────────────────────────

describe('number-bond pack · build gates', () => {
  it('DROPS a known part of 0 or of the whole rather than repairing it', () => {
    // Spoken, part 0 puts the whole itself in the child's mouth and part=whole
    // puts "zero" (unbenched) there. REVERT-BITE: this is the gate.
    expect(isValidBondPart(5, 0)).toBe(false);
    expect(isValidBondPart(5, 5)).toBe(false);
    expect(isValidBondPart(5, 3)).toBe(true);
    expect(itemsFromChallenge({ id: 'z1', type: 'missing-part', whole: 5, part1: 0 }, CTX_K)).toEqual([]);
    expect(itemsFromChallenge({ id: 'z2', type: 'missing-part', whole: 5, part1: 5 }, CTX_K)).toEqual([]);
    expect(itemsFromChallenge({ id: 'z3', type: 'fact-family', whole: 7, part1: 0 }, CTX_1)).toEqual([]);
    expect(itemsFromChallenge({ id: 'z4', type: 'build-equation', whole: 7, part1: 7 }, CTX_1)).toEqual([]);
  });

  it('DROPS out-of-range wholes and symbolic modes at K', () => {
    expect(itemsFromChallenge({ id: 'o1', type: 'decompose', whole: 1 }, CTX_K)).toEqual([]);
    expect(itemsFromChallenge({ id: 'o2', type: 'missing-part', whole: 6, part1: 2 }, CTX_K)).toEqual([]);
    expect(itemsFromChallenge({ id: 'o3', type: 'decompose', whole: 11 }, CTX_1)).toEqual([]);
    expect(itemsFromChallenge({ id: 'o4', type: 'fact-family', whole: 5, part1: 2 }, CTX_K)).toEqual([]);
    expect(itemsFromChallenge({ id: 'o5', type: 'build-equation', whole: 5, part1: 2 }, CTX_K)).toEqual([]);
    expect(itemsFromChallenge({ id: 'o6', type: 'mystery', whole: 5 }, CTX_K)).toEqual([]);
  });

  it('keeps every spoken answer inside the benched window by construction', () => {
    expect(isSayableAnswer(0)).toBe(false);
    expect(isSayableAnswer(21)).toBe(false);
    expect(MP.answer).toBe(2);
    expect(MP_SYM.answer).toBe(3);
    for (const item of [MP, MP_SYM]) {
      expect(isSayableAnswer(item.answer)).toBe(true);
    }
  });

  it('expands one decompose challenge into one judged turn per pair', () => {
    expect(DECOMPOSE).toHaveLength(3); // [0,5] [1,4] [2,3]
    expect(DECOMPOSE.map((i) => i.id)).toEqual(['c1::p0', 'c1::p1', 'c1::p2']);
    expect(new Set(DECOMPOSE.map((i) => i.sourceId))).toEqual(new Set(['c1']));
    expect(D2.pairCount).toBe(3);
  });

  it('drops consecutive same-content challenges and duplicate ids in the session build', () => {
    const { items, droppedChallenges } = buildBondItems([
      { id: 'a', type: 'missing-part', whole: 5, part1: 3 },
      { id: 'b', type: 'missing-part', whole: 5, part1: 3 }, // same content — recitation
      { id: 'a', type: 'missing-part', whole: 8, part1: 2 }, // duplicate id
      { id: 'c', type: 'missing-part', whole: 8, part1: 2 },
    ], CTX_1);
    expect(items.map((i) => i.id)).toEqual(['a', 'c']);
    expect(droppedChallenges).toBe(2);
  });
});

// ── 3. Answer-leak: the number never precedes the child's answer ────────────

describe('number-bond pack · answer-leak', () => {
  it('never puts the missing part in a spoken ask — including as "two parts"', () => {
    // MP's answer IS two, so the structural phrase "has two parts" would leak
    // it in every ask. The ask says "is the whole" instead.
    const ask = spokenLine(itemCue(MP));
    expect(ask).toContain('Five is the whole. One part is three.');
    expect(ask).not.toMatch(/\btwo\b/);
    expect(pronounceCue(MP)).not.toMatch(/\btwo\b/);
  });

  it('lets the symmetric bond say its known part — the question, not a leak', () => {
    // whole six, part three: the answer is also three, and the ask must still
    // state the known part aloud. The harness therefore does not flag it.
    expect(spokenLine(itemCue(MP_SYM))).toContain('One part is three.');
    expect(numberBondHarnessAnswers(MP_SYM).leakTokens).toEqual([]);
    expect(numberBondHarnessAnswers(MP).leakTokens).toEqual(['two']);
    // "One part is…" makes "one" always-public, so an answer of one is never
    // flagged against the ask's own phrasing.
    const mpOne = itemsFromChallenge({ id: 'c6', type: 'missing-part', whole: 5, part1: 4 }, CTX_K)[0];
    expect(mpOne.answer).toBe(1);
    expect(numberBondHarnessAnswers(mpOne).leakTokens).toEqual([]);
  });

  it('states the problem aloud in every ask (a pre-reader cannot read the bond)', () => {
    expect(spokenLine(itemCue(D0))).toContain('Here is five. Make five with two parts.');
    expect(spokenLine(itemCue(MP))).toContain('What is the other part?');
    expect(spokenLine(itemCue(FAMILY))).toContain('The parts are three and four, and the whole is seven.');
    expect(spokenLine(itemCue(BUILD_EQ))).toContain('Build a number sentence with the tiles.');
  });

  it('pushes only the answer-free question side through the context channel', () => {
    // missing-part pushes NO number at all — its number is the answer's twin.
    expect(stimulusFor(MP)).not.toMatch(/\d|one|two|three|four|five|six|seven|eight|nine|ten/i);
    expect(stimulusFor(D0)).toContain('five');
    expect(stimulusFor(FAMILY)).toContain('all three numbers shown');
  });

  it('picks the fact-family worked example from a bond the item is NOT', () => {
    // The old hardcoded 2+3=5 helper was the answer sheet whenever the item
    // was that very bond.
    expect(familyHelperExample({ whole: 5, knownPart: 2, otherPart: 3 })).not.toEqual([2, 3, 5]);
    expect(familyHelperExample({ whole: 5, knownPart: 3, otherPart: 2 })).not.toEqual([2, 3, 5]);
    expect(familyHelperExample({ whole: 7, knownPart: 3, otherPart: 4 })).toEqual([2, 3, 5]);
  });
});

// ── 4. The spoken contract: signature error, accept clause, correction ──────

describe('number-bond pack · missing-part judging contract', () => {
  it('names the correct answer and refuses the echo of the ask', () => {
    const cue = itemCue(MP);
    expect(cue).toContain('The correct answer is "two"');
    expect(cue).toContain('"five" and "three"');
    expect(cue).toContain('NOT the answer');
  });

  it('excludes the answer from the echo-refusal list on a symmetric bond', () => {
    // whole six, part three, answer three: refusing "three" said back would
    // refuse the RIGHT answer. Only the whole stays on the refusal list.
    const cue = itemCue(MP_SYM);
    expect(cue).toContain('The correct answer is "three"');
    expect(cue).toContain('"six" out loud');
    expect(cue).not.toContain('"six" and "three"');
  });

  it('carries the accept side — the right answer that does not look right', () => {
    const cue = itemCue(MP);
    expect(cue).toContain('judge the number they OFFER when the counting stops');
    expect(cue).toContain('"two more"');
  });

  it('models the count-up walk in the correction, then re-elicits', () => {
    const cue = itemCue(MP);
    expect(cue).toContain('If it is wrong, say exactly: "My turn:');
    expect(cue).toContain('start at three and count up to five: four, five');
    expect(cue).toContain('That is two more.');
    expect(cue).toContain('Your turn. One part is three — what is the other part?');
  });

  it('affirms with the sentinel and the completed bond', () => {
    expect(itemCue(MP)).toContain('say exactly: "Yes, two — two and three make five."');
  });

  it('binds the correction to script fidelity on REPEATED wrong answers', () => {
    // REGRESSION (first number-bond cap drill, 2026-08-14): on the SECOND
    // identical wrong answer the model balked at the byte-identical scripted
    // correction (18c) and recited the catalog ladder's quoted hints instead —
    // lines opening with neither sentinel, so the engine saw no verdict and
    // the correction counter stalled. Both surfaces now command the SAME line.
    expect(itemCue(MP)).toContain('the SAME line on every wrong answer');
    const entry = MATH_CATALOG.find((p) => p.id === 'number-bond')!;
    const levels = Object.values(entry.tutoring?.scaffoldingLevels ?? {}).join(' ');
    expect(levels).toContain('exactly as written');
    // No ladder level may OFFER a quotable replacement line — that was the fuel.
    expect(levels).not.toContain('Think about the two parts');
    expect(levels).not.toContain('Take your time');
  });
});

// ── 5. Hand items: silence contract + code-computed verdicts ────────────────

describe('number-bond pack · hand items', () => {
  it('hand asks carry a SILENCE contract, not a judging contract', () => {
    for (const item of [D0, FAMILY, BUILD_EQ]) {
      const cue = itemCue(item);
      expect(cue).toContain('stay completely silent');
      expect(cue).toContain('with their HANDS');
      expect(cue).not.toContain('If the answer is right');
      expect(cue).not.toContain('The correct answer is');
    }
    // And the spoken item is never told to ignore the microphone.
    expect(itemCue(MP)).not.toContain('HANDS');
  });

  it('judges a split by sum AND novelty, in code', () => {
    expect(splitVerdictCue(D0, 2, 3, [])).toContain('MATCHES');
    expect(spokenLine(splitVerdictCue(D0, 2, 3, []))).toContain('Two and three make five.');
    // An under-full split is a WRONG answer, not an un-committable state.
    const short = splitVerdictCue(D0, 2, 2, []);
    expect(short).toContain('does NOT match');
    expect(spokenLine(short)).toContain('two and two make four, not five');
    // A repeated pair is the mode's signature error.
    const dup = splitVerdictCue(D1, 4, 1, [[1, 4]]);
    expect(dup).toContain('does NOT match');
    expect(spokenLine(dup)).toContain('you already made one and four');
    // An empty commit is corrected without arithmetic nonsense.
    expect(spokenLine(splitVerdictCue(D0, 0, 0, []))).toContain('the counters go into the circles first');
  });

  it('celebrates the LAST pair as finding every way', () => {
    const final = splitVerdictCue(D2, 2, 3, [[0, 5], [1, 4]]);
    expect(spokenLine(final)).toContain('You found every way to make five!');
    expect(spokenLine(splitVerdictCue(D0, 0, 5, []))).not.toContain('every way');
  });

  it('names WHICH fact-family fault happened', () => {
    const good = ['3+4=7', '4+3=7', '7-3=4', '7-4=3'];
    expect(familyFaultOf(FAMILY, good).fault).toBe('match');
    expect(spokenLine(familyVerdictCue(FAMILY, good))).toContain('You wrote the whole fact family!');
    expect(familyFaultOf(FAMILY, ['3+4=8', '', '', '']).fault).toBe('bad-math');
    expect(familyFaultOf(FAMILY, ['2+5=7', '', '', '']).fault).toBe('wrong-numbers');
    expect(familyFaultOf(FAMILY, ['3+4=7', '7-3=4', '7-3=4', '']).fault).toBe('duplicate');
    expect(familyFaultOf(FAMILY, ['3+4=7', '', '', '']).fault).toBe('incomplete');
    expect(spokenLine(familyVerdictCue(FAMILY, ['2+5=7', '', '', ''])))
      .toContain('SAME three numbers');
  });

  it('accepts ANY valid equation over the bond and names the build fault', () => {
    // The shipped grading, kept: any of the four forms matches.
    expect(bondEquationFaultOf(BUILD_EQ, ['3', '+', '4', '=', '7'])).toBe('match');
    expect(bondEquationFaultOf(BUILD_EQ, ['7', '-', '4', '=', '3'])).toBe('match');
    expect(bondEquationFaultOf(BUILD_EQ, ['3', '+', '4', '=', '8'])).toBe('arithmetic');
    expect(bondEquationFaultOf(BUILD_EQ, ['2', '+', '5', '=', '7'])).toBe('numbers');
    expect(bondEquationFaultOf(BUILD_EQ, ['3', '+'])).toBe('incomplete');
    expect(spokenLine(bondEquationVerdictCue(BUILD_EQ, ['3', '+', '4', '=', '7'])))
      .toContain('Three plus four equals seven');
    expect(spokenLine(bondEquationVerdictCue(BUILD_EQ, ['2', '+', '5', '=', '7'])))
      .toContain('use the three numbers from the bond');
  });

  it('keeps every gesture verdict line free of a sentinel collision', () => {
    const cues = [
      { label: 'split-hit', text: splitVerdictCue(D0, 2, 3, []) },
      { label: 'split-short', text: splitVerdictCue(D0, 2, 2, []) },
      { label: 'split-dup', text: splitVerdictCue(D1, 1, 4, [[1, 4]]) },
      { label: 'family-hit', text: familyVerdictCue(FAMILY, ['3+4=7', '4+3=7', '7-3=4', '7-4=3']) },
      { label: 'family-miss', text: familyVerdictCue(FAMILY, ['2+5=7', '', '', '']) },
      { label: 'eq-hit', text: bondEquationVerdictCue(BUILD_EQ, ['3', '+', '4', '=', '7']) },
      { label: 'eq-miss', text: bondEquationVerdictCue(BUILD_EQ, ['3', '+', '4', '=', '8']) },
    ];
    expect(findSentinelCollisions(cues)).toEqual([]);
  });

  it('shares ONE equation parser across judge, component and harness', () => {
    expect(parseBondEquation('7 = 3 + 4', 7, 3, 4)?.usesCorrectNumbers).toBe(true);
    expect(parseBondEquation('7 − 3 = 4', 7, 3, 4)?.valid).toBe(true); // unicode minus
    expect(parseBondEquation('nonsense', 7, 3, 4)).toBeNull();
  });
});

// ── 6. Session frame ────────────────────────────────────────────────────────

describe('number-bond pack · session frame', () => {
  it('the opening cue has ONE job: greeting + how-to-play + ask inside the quoted line', () => {
    const opening = spokenLine(itemCue(D0, { opening: true, howToPlay: true }));
    expect(opening).toContain('Hi! Time for number bonds!');
    expect(opening).toContain('Tap the two circles');
    expect(opening).toContain('Make five with two parts.');
  });

  it('re-speaks the how-to-play when the ACTION changes', () => {
    expect(moveOnCue(D2, MP, { howToPlay: true })).toContain('say the missing part out loud');
    expect(moveOnCue(D2, MP, {})).not.toContain('say the missing part out loud');
  });

  it('the final move-on and the complete cue both stop the tutor', () => {
    expect(moveOnCue(BUILD_EQ, null, {})).toContain('Then stop');
    expect(completeCue()).toContain('Then stop — the activity is over.');
  });
});

// ── 7. The catalog keeps its side of the contract ───────────────────────────

describe('number-bond catalog · DI frame', () => {
  const entry = MATH_CATALOG.find((p) => p.id === 'number-bond')!;

  it('keeps its side: audio mode, contextKeys, template keys, sentinel scan', () => {
    expect(checkDiCatalogEntry(entry, pack, MP)).toEqual([]);
  });

  it('steers the manifest at the modality, not at a Check button', () => {
    expect(entry.constraints).toMatch(/microphone/i);
    expect(entry.constraints).toMatch(/no Check button/i);
    expect(entry.description).toMatch(/SAY the missing part OUT LOUD/);
    // Eval modes keep their identities and βs — task identities are stable.
    expect(entry.evalModes?.map((m) => m.evalMode))
      .toEqual(['decompose', 'missing_part', 'fact_family', 'build_equation']);
    expect(entry.evalModes?.map((m) => m.beta)).toEqual([1.5, 2.5, 3.5, 4.5]);
  });
});

// ── 8. Harness answer material — the contract's refusal claims, made testable ─

describe('number-bond pack · headless drive answers', () => {
  it('drills the SIGNATURE error the contract promises to refuse', () => {
    // The fluent miss is the WHOLE echoed back — the ask itself just said it.
    const answers = numberBondHarnessAnswers(MP);
    expect(answers.correct).toBe('two');
    expect(answers.signatureWrong?.text).toBe('five');
    expect(itemCue(MP)).toContain('"five" and "three"');
  });

  it('never offers a "wrong" answer that is actually right', () => {
    for (const item of ITEMS) {
      const answers = numberBondHarnessAnswers(item);
      expect(answers.plainWrong).not.toBe(answers.correct);
      if (answers.signatureWrong) {
        expect(answers.signatureWrong.text).not.toBe(answers.correct);
      }
    }
    // The symmetric bond's signature stays the whole ("six"), never the known
    // part — which IS the right answer there.
    expect(numberBondHarnessAnswers(MP_SYM).signatureWrong?.text).toBe('six');
  });

  it('gives hands items a committable artifact whose encodings decode to real verdicts', () => {
    const split = numberBondHarnessAnswers(D0);
    expect(bondVerdictCueForPlaced(D0, split.placed!.correct)).toContain('MATCHES');
    expect(bondVerdictCueForPlaced(D0, split.placed!.wrong)).toContain('does NOT match');
    const family = numberBondHarnessAnswers(FAMILY);
    expect(bondVerdictCueForPlaced(FAMILY, family.placed!.correct)).toContain('MATCHES');
    expect(bondVerdictCueForPlaced(FAMILY, family.placed!.wrong)).toContain('does NOT match');
    const eq = numberBondHarnessAnswers(BUILD_EQ);
    expect(bondVerdictCueForPlaced(BUILD_EQ, eq.placed!.correct)).toContain('MATCHES');
    expect(bondVerdictCueForPlaced(BUILD_EQ, eq.placed!.wrong)).toContain('does NOT match');
  });

  it('keeps spoken drive answers inside the benched number window', () => {
    for (const item of [MP, MP_SYM]) {
      const { plainWrong } = numberBondHarnessAnswers(item);
      expect(plainWrong).not.toMatch(/zero/);
      expect(plainWrong.length).toBeGreaterThan(0);
    }
  });
});
