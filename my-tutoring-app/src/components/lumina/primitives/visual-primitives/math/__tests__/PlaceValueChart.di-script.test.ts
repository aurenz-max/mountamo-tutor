/**
 * place-value-chart · di-script suite (eighth math port; the first past the
 * ≤20 bench, riding `place_value_word` build-ahead on #63).
 *
 * The plumbing is `checkPackGates` + `checkDiCatalogEntry` (testkit). The
 * pedagogy pins are this file's point:
 *  1. The answer-material fork: find_place SPEAKS a place name, say_value
 *     SPEAKS a value word (place_value_word), build_number WRITES — and a
 *     spoken item never carries the silence contract, nor a written item the
 *     spoken one.
 *  2. ANALYZE AND DICTATE ARE DISJOINT: roles strictly alternate over KEPT
 *     challenges, a printed number is never dictated, and no two consecutive
 *     items share an action — the structural reason the repeat-ask gate can
 *     never fire on a real session of this pack.
 *  3. Session-wide dedupe on the thing that gets SAID: a value word spoken by
 *     an earlier ask OR an earlier dictation is spent.
 *  4. Leak rules: the value word is never in its own ask; the place name lives
 *     only inside the tier-conditional menu clause; hard names no menu; the
 *     dictation IS the build ask (exempt there, a leak anywhere else).
 *  5. The ones place collapses digit and worth — the discrimination swaps its
 *     signature to the place-shift instead of refusing the correct answer.
 *  6. The ten-thousands column demands the "ten"; plain thousands under a
 *     5-digit chart gets the disambiguation clause.
 *  7. Build gates DROP: zero highlighted digit, out-of-band numbers, spent
 *     value words, repeated places back-to-back.
 *  8. `buildVerdictCue`: match computed in code; incomplete vs wrong get
 *     different corrections; the model walk runs on a FOREIGN number.
 *  9. The catalog keeps its side; harness answers mirror the discrimination.
 */
import { describe, it, expect } from 'vitest';
import {
  actionFor,
  answerKindFor,
  askFor,
  buildVerdictCue,
  chartPlacesFor,
  digitAtPlace,
  isAskablePlace,
  isInBandTarget,
  itemCue,
  itemsFromChallenges,
  leakExemptSpanFor,
  magnitudeOf,
  moveOnCue,
  namesChoices,
  placeValueHarnessAnswers,
  placeValuePackBase,
  pronounceCue,
  responseClassFor,
  stimulusFor,
  wrongBuildFor,
  type PlaceValueItem,
  type PlaceValueChallengeLike,
} from '../placeValueScript';
import {
  decadeWord,
  digitValueWord,
  digitWord,
  placeWord,
  spokenIntegerWord,
} from '../spokenNumberWords';
import {
  spokenSpanOf,
  spokenSpansOf,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../../hooks/judgedScriptContract.testkit';
import { MATH_CATALOG } from '../../../../service/manifest/catalog/math';

// ── Fixtures ────────────────────────────────────────────────────────────────

const ch = (id: string, targetNumber: number, highlightedDigitPlace: number): PlaceValueChallengeLike =>
  ({ id, targetNumber, highlightedDigitPlace });

/** compare mode, medium tier: analyze(4207@hundreds) → dictate(3156) →
 *  analyze(8471@tens). Five items, the real session shape. */
const COMPARE_SESSION = itemsFromChallenges(
  [ch('c1', 4207, 2), ch('c2', 3156, 3), ch('c3', 8471, 1)],
  { mode: 'compare', tier: 'medium' },
);

/** identify mode, easy tier: 2-digit; i2 dictates "thirteen"; i3 repeats the
 *  tens PLACE over a fresh digit — a fresh ask, kept (repetition over new
 *  numbers is the mode, not recall). */
const IDENTIFY_SESSION = itemsFromChallenges(
  [ch('i1', 47, 1), ch('i2', 13, 0), ch('i3', 86, 1)],
  { mode: 'identify', tier: 'easy' },
);

/** expanded_form, hard tier: the ten-thousands column and its subset ear. */
const EXPANDED_SESSION = itemsFromChallenges(
  [ch('e1', 90417, 4), ch('e2', 30407, 2)],
  { mode: 'expanded_form', tier: 'hard' },
);

/** build mode: the rotation starts on DICTATE — construction is its identity. */
const BUILD_SESSION = itemsFromChallenges(
  [ch('b1', 406, 2), ch('b2', 352, 1)],
  { mode: 'build', tier: 'medium' },
);

/** A single analyze challenge whose glowing digit is in the ONES place. */
const ONES_SESSION = itemsFromChallenges(
  [ch('o1', 4207, 0)],
  { mode: 'compare', tier: 'medium' },
);

const pack = placeValuePackBase(COMPARE_SESSION.items);
const catalogEntry = MATH_CATALOG.find((c) => c.id === 'place-value-chart')!;

const byId = (items: PlaceValueItem[], suffix: string) =>
  items.find((i) => i.id.endsWith(suffix))!;

// ============================================================================

describe('place-value-chart · structural gates', () => {
  it('the compare-session pack passes every family gate', () => {
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('every fixture session passes the family gates', () => {
    for (const session of [IDENTIFY_SESSION, EXPANDED_SESSION, BUILD_SESSION, ONES_SESSION]) {
      expect(checkPackGates(placeValuePackBase(session.items))).toEqual([]);
    }
  });

  it('the repeat-ask gate is AWAKE on this pack\'s cue shape', () => {
    // A REAL session can never put two same-action items adjacent (the rotation
    // pins below), so the gate is structurally quiet here — this duplicate-item
    // pack proves it is on and would catch a recitation if the rotation ever
    // broke. Menu-tier find_place asks run past the 12-word signal limit.
    const a = itemsFromChallenges([ch('x1', 4207, 2)], { mode: 'compare', tier: 'easy' }).items[0];
    const artificial = placeValuePackBase([a, { ...a, id: 'x1dup::place' }]);
    const issues = checkPackGates(artificial as JudgedScriptPack<PlaceValueItem>);
    expect(issues.some((i) => i.includes('byte-identical'))).toBe(true);
  });
});

describe('place-value-chart · the answer-material fork', () => {
  it('find_place speaks a short word, say_value speaks a place_value_word, build writes', () => {
    expect(answerKindFor('find_place')).toBe('voice');
    expect(answerKindFor('say_value')).toBe('voice');
    expect(answerKindFor('build_number')).toBe('gesture');
    expect(responseClassFor('find_place')).toBe('short_spoken_word');
    expect(responseClassFor('say_value')).toBe('place_value_word');
    expect(responseClassFor('build_number')).toBe('manipulation');
  });

  it('a spoken item carries the judging contract, never the silence contract', () => {
    const spoken = byId(COMPARE_SESSION.items, 'c1::value');
    const cue = itemCue(spoken);
    expect(cue).toContain('The correct answer is');
    expect(cue).toContain('If the answer is right');
    expect(cue).not.toContain('with their HANDS');
  });

  it('a written item carries the silence contract and no spoken verdict lines', () => {
    const written = byId(COMPARE_SESSION.items, 'c2::build');
    const cue = itemCue(written);
    expect(cue).toContain('with their HANDS');
    expect(cue).not.toContain('If the answer is right');
    expect(cue).not.toContain('The correct answer is');
  });
});

describe('place-value-chart · analyze/dictate rotation (the port\'s own leak gate)', () => {
  it('roles strictly alternate: analyze yields spoken asks, dictate yields the build', () => {
    const ids = COMPARE_SESSION.items.map((i) => i.id);
    expect(ids).toEqual(['c1::place', 'c1::value', 'c2::build', 'c3::place', 'c3::value']);
  });

  it('build mode starts the rotation on DICTATE — construction is its identity', () => {
    expect(BUILD_SESSION.items[0].kind).toBe('build_number');
    expect(BUILD_SESSION.items[0].id).toBe('b1::build');
  });

  it('no two consecutive items ever share an action, in any fixture', () => {
    for (const session of [COMPARE_SESSION, IDENTIFY_SESSION, EXPANDED_SESSION, BUILD_SESSION]) {
      for (let i = 1; i < session.items.length; i++) {
        expect(session.items[i].action).not.toBe(session.items[i - 1].action);
      }
    }
  });

  it('a printed (analyze) number is never dictated, and vice versa', () => {
    for (const session of [COMPARE_SESSION, IDENTIFY_SESSION, BUILD_SESSION]) {
      const analyzed = new Set(
        session.items.filter((i) => i.kind !== 'build_number').map((i) => i.targetNumber),
      );
      for (const built of session.items.filter((i) => i.kind === 'build_number')) {
        expect(analyzed.has(built.targetNumber)).toBe(false);
      }
    }
  });

  it('a dictation spends its digits\' value words for later say_value asks', () => {
    // 3156's dictation says "fifty" inside "…one hundred fifty-six", so a later
    // challenge glowing 5-in-tens may not ask it. 8471@tens ("seventy") is safe.
    const spent = itemsFromChallenges(
      [ch('c1', 4207, 2), ch('c2', 3156, 3), ch('c3', 8451, 1)],
      { mode: 'compare', tier: 'medium' },
    );
    expect(spent.items.some((i) => i.id === 'c3::value')).toBe(false);
    expect(spent.items.some((i) => i.id === 'c3::place')).toBe(true);
  });

  it('a repeated place over a FRESH digit is a fresh ask — kept, both items', () => {
    const ids = IDENTIFY_SESSION.items.map((i) => i.id);
    expect(ids).toContain('i3::place');
    expect(ids).toContain('i3::value');
  });

  it('the identical twin — same place AND same digit — drops whole: same fact, byte-identical ask', () => {
    const twin = itemsFromChallenges(
      [ch('t1', 47, 1), ch('t2', 92, 0), ch('t3', 41, 1)],
      { mode: 'identify', tier: 'medium' },
    );
    // t3 glows 4-in-tens again: its place ask would be byte-identical to t1's
    // and its value word ("forty") was already affirmed — nothing honest left.
    expect(twin.items.map((i) => i.id)).toEqual(['t1::place', 't1::value', 't2::build']);
    expect(twin.droppedChallenges).toBe(1);
  });
});

describe('place-value-chart · build gates (KEEP-OR-DROP)', () => {
  it('band and askability gates', () => {
    expect(isInBandTarget(11)).toBe(true);
    expect(isInBandTarget(99_999)).toBe(true);
    expect(isInBandTarget(8)).toBe(false);
    expect(isInBandTarget(123_456)).toBe(false);
    expect(isInBandTarget(40.7)).toBe(false);
    expect(isAskablePlace(4207, 2)).toBe(true);
    expect(isAskablePlace(4207, 1)).toBe(false);   // zero digit — "zero" is excluded
    expect(isAskablePlace(4207, 5)).toBe(false);   // off the chart
    expect(isAskablePlace(47, 2)).toBe(false);     // not a column of this number
  });

  it('an unaskable challenge drops whole, never repaired', () => {
    const { items, droppedChallenges } = itemsFromChallenges(
      [ch('z1', 4207, 1), ch('z2', 7, 0), ch('ok', 47, 1)],
      { mode: 'identify', tier: 'medium' },
    );
    expect(droppedChallenges).toBe(2);
    expect(items.map((i) => i.id)).toEqual(['ok::place', 'ok::value']);
  });
});

describe('place-value-chart · leak rules', () => {
  it('the value word is never inside its own ask — INCLUDING the ones place', () => {
    // The ones place is where this bit live: the digit word IS the answer
    // there, so a say_value ask may not name the digit at any place (the
    // di-cap drill confirmed the naming version as a HIGH, 2026-08-18).
    for (const session of [COMPARE_SESSION, IDENTIFY_SESSION, EXPANDED_SESSION, ONES_SESSION]) {
      for (const item of session.items.filter((i) => i.kind === 'say_value')) {
        expect(askFor(item)).not.toContain(item.answerText);
        expect(askFor(item)).not.toContain(digitWord(item.digit));
        expect(spokenSpanOf(itemCue(item)).startsWith('The glowing')).toBe(true);
      }
    }
  });

  it('the place name lives ONLY in the menu clause, and hard names no menu', () => {
    const medium = byId(COMPARE_SESSION.items, 'c1::place');
    expect(namesChoices(medium)).toBe(true);
    const ask = askFor(medium);
    const exempt = leakExemptSpanFor(medium)!;
    expect(ask).toContain(exempt);
    expect(ask.replace(exempt, '')).not.toContain(medium.answerText);

    const hard = byId(EXPANDED_SESSION.items, 'e1::place');
    expect(namesChoices(hard)).toBe(false);
    expect(leakExemptSpanFor(hard)).toBeUndefined();
    expect(askFor(hard)).not.toContain(hard.answerText);
  });

  it('the build ask IS the dictation — stated aloud, in words, and nowhere printed', () => {
    const built = byId(COMPARE_SESSION.items, 'c2::build');
    expect(built.dictationWords).toBe('three thousand one hundred fifty-six');
    expect(askFor(built)).toContain(built.dictationWords);
    expect(pronounceCue(built)).toContain(built.dictationWords);
  });

  it('the greeting and how-to-plays carry no place names and no value words', () => {
    for (const item of COMPARE_SESSION.items) {
      const opening = spokenSpanOf(itemCue(item, { opening: true, howToPlay: true }));
      const preAsk = opening.replace(askFor(item), '');
      for (const p of item.chartPlaces) expect(preAsk).not.toContain(` ${placeWord(p)} `);
      if (item.answerText) expect(preAsk).not.toContain(item.answerText);
    }
  });

  it('the easy-tier model example never uses a VALUE word this session says', () => {
    // Place names are legitimately public at easy/medium (the menu names them);
    // the protected class is the value words — the session's answers and every
    // word a dictation speaks.
    const modeled = IDENTIFY_SESSION.items.filter((i) => i.kind === 'say_value');
    expect(modeled.length).toBeGreaterThan(0);
    const sessionValueWords = IDENTIFY_SESSION.items
      .filter((i) => i.kind === 'say_value')
      .map((i) => i.answerText)
      .concat(
        IDENTIFY_SESSION.items
          .filter((i) => i.kind === 'build_number')
          .map((i) => i.dictationWords),
      );
    for (const item of modeled) {
      expect(item.modelClause.length).toBeGreaterThan(0);
      for (const w of sessionValueWords) expect(item.modelClause).not.toContain(w);
    }
    // medium/hard: no model at all
    for (const item of COMPARE_SESSION.items.filter((i) => i.kind === 'say_value')) {
      expect(item.modelClause).toBe('');
    }
  });

  it('stimulus lines are answer-free by construction', () => {
    for (const item of COMPARE_SESSION.items) {
      const s = stimulusFor(item);
      expect(s).not.toContain(String(item.targetNumber));
      if (item.answerText) expect(s).not.toContain(item.answerText);
    }
  });
});

describe('place-value-chart · the ones place collapses digit and worth', () => {
  it('say_value at ones: the answer IS the digit word, and the signature is the shift', () => {
    const item = byId(ONES_SESSION.items, 'o1::value');
    expect(item.answerText).toBe(digitWord(7));
    const cue = itemCue(item);
    // The generic bare-digit refusal would refuse the CORRECT answer here.
    expect(cue).not.toContain(`"${digitWord(7)}" on its own is the confident wrong answer`);
    expect(cue).toContain(digitValueWord(7, 1)); // "seventy", the shift
    const answers = placeValueHarnessAnswers(item);
    expect(answers.signatureWrong!.text).toBe(digitValueWord(7, 1));
  });

  it('find_place at ones gets its own correction line', () => {
    const item = byId(ONES_SESSION.items, 'o1::place');
    expect(itemCue(item)).toContain('the digit at the very end is always in the ones place');
  });
});

describe('place-value-chart · the ten-thousands ear', () => {
  it('place 4 demands the "ten"; a bare thousands is named as the wrong column', () => {
    const item = byId(EXPANDED_SESSION.items, 'e1::place');
    expect(item.answerText).toBe('ten thousands');
    expect(itemCue(item)).toContain('A bare "thousands" names the wrong column');
  });

  it('ninety thousand is the ten-thousands value word', () => {
    const item = byId(EXPANDED_SESSION.items, 'e1::value');
    expect(item.answerText).toBe('ninety thousand');
  });
});

describe('place-value-chart · spoken number words', () => {
  it('digit values compose digit × place', () => {
    expect(digitValueWord(4, 1)).toBe('forty');
    expect(digitValueWord(3, 2)).toBe('three hundred');
    expect(digitValueWord(9, 4)).toBe('ninety thousand');
    expect(digitValueWord(1, 4)).toBe('ten thousand');
    expect(digitValueWord(7, 0)).toBe('seven');
    expect(decadeWord(5)).toBe('fifty');
  });

  it('dictations spell whole numbers, hyphenated compounds, no "and"', () => {
    expect(spokenIntegerWord(406)).toBe('four hundred six');
    expect(spokenIntegerWord(13)).toBe('thirteen');
    expect(spokenIntegerWord(23)).toBe('twenty-three');
    expect(spokenIntegerWord(90_000)).toBe('ninety thousand');
    expect(spokenIntegerWord(47_306)).toBe('forty-seven thousand three hundred six');
  });

  it('chart helpers agree with arithmetic', () => {
    expect(magnitudeOf(4207)).toBe(4);
    expect(chartPlacesFor(406)).toEqual([2, 1, 0]);
    expect(digitAtPlace(4207, 2)).toBe(2);
  });
});

describe('place-value-chart · the written-number verdict', () => {
  const built = byId(COMPARE_SESSION.items, 'c2::build'); // 3156

  it('a matching chart affirms with the dictation, revealed only now', () => {
    const cue = buildVerdictCue(built, [3, 1, 5, 6]);
    expect(cue).toContain('MATCHES');
    expect(spokenSpanOf(cue)).toContain('Three thousand one hundred fifty-six');
  });

  it('a wrong chart is corrected on a FOREIGN model number, then re-dictated', () => {
    const cue = buildVerdictCue(built, [3, 5, 1, 6]);
    expect(cue).toContain('does NOT match');
    expect(built.modelNumber).not.toBe(built.targetNumber);
    expect(cue).toContain(spokenIntegerWord(built.modelNumber));
    expect(cue).toContain(built.dictationWords);
    // The model walk teaches the zero-trap: the model number carries a zero.
    expect(String(built.modelNumber)).toContain('0');
  });

  it('an incomplete chart gets the every-column-gets-a-digit line, not the walk', () => {
    const cue = buildVerdictCue(built, [3, null, 5, 6]);
    expect(cue).toContain('does NOT match');
    expect(cue).toContain('every column gets exactly one digit');
    expect(cue).not.toContain(spokenIntegerWord(built.modelNumber));
  });

  it('the wrong build is same-magnitude and never the target', () => {
    expect(wrongBuildFor(247)).toBe(427);
    expect(wrongBuildFor(406)).toBe(460);
    const nineNineNine = wrongBuildFor(999);
    expect(nineNineNine).not.toBe(999);
    expect(magnitudeOf(nineNineNine)).toBe(3);
  });
});

describe('place-value-chart · verdict wording', () => {
  it('affirmations open "Yes," and echo the canonical answer; corrections open "My turn:"', () => {
    for (const item of COMPARE_SESSION.items.filter((i) => i.answerKind === 'voice')) {
      const cue = itemCue(item);
      expect(cue).toContain(`say exactly: "Yes,`);
      expect(cue).toContain(`say exactly: "My turn:`);
      expect(cue).toContain(item.answerText);
    }
  });

  it('the move-on names nothing about the item just left', () => {
    const [a, , b] = COMPARE_SESSION.items;
    const cue = moveOnCue(a, b, {});
    expect(spokenSpansOf(cue).join(' ')).not.toContain(a.answerText);
    expect(moveOnCue(a, null, {})).toContain('Good try');
  });

  it('actions are stable identities', () => {
    expect(actionFor('find_place')).toBe('name-place');
    expect(actionFor('say_value')).toBe('say-value');
    expect(actionFor('build_number')).toBe('write-number');
  });
});

describe('place-value-chart · catalog', () => {
  it('the catalog keeps its side of the contract', () => {
    expect(checkDiCatalogEntry(catalogEntry, pack, COMPARE_SESSION.items[0])).toEqual([]);
  });

  it('the steering names the microphone and the DI frame, not buttons', () => {
    expect(catalogEntry.constraints).toContain('microphone');
    expect(catalogEntry.constraints).not.toContain('multiple choice');
    expect(catalogEntry.description).toContain('DI modality');
  });
});

describe('place-value-chart · harness answers mirror the discrimination', () => {
  it('find_place: the signature wrong is the value said for the place', () => {
    const item = byId(COMPARE_SESSION.items, 'c1::place');
    const answers = placeValueHarnessAnswers(item);
    expect(answers.correct).toBe('hundreds');
    expect(answers.signatureWrong!.text).toBe(digitValueWord(item.digit, item.place));
    expect(itemCue(item)).toContain(answers.signatureWrong!.text);
  });

  it('say_value: the signature wrong is the bare digit, refused on purpose', () => {
    const item = byId(COMPARE_SESSION.items, 'c1::value');
    const answers = placeValueHarnessAnswers(item);
    expect(answers.correct).toBe('two hundred');
    expect(answers.signatureWrong!.text).toBe(digitWord(item.digit));
    expect(itemCue(item)).toContain(`"${digitWord(item.digit)}" on its own`);
  });

  it('build: the committed gesture is the whole number, wrong is the transposition', () => {
    const item = byId(COMPARE_SESSION.items, 'c2::build');
    const answers = placeValueHarnessAnswers(item);
    expect(answers.placed).toEqual({ correct: 3156, wrong: wrongBuildFor(3156) });
  });
});
