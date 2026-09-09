/**
 * tenFrameScript — the pedagogy lives here, so this is where it is pinned.
 * Pure: no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (validateJudgedScriptPack:
 *     benched response classes, sentinel discipline over every cue, cue
 *     builders that don't throw).
 *  2. THE FORK: which modes speak and which keep their hands, including the
 *     make_ten band split that contract R6 requires. Changing a row here is a
 *     contract change, not an edit.
 *  3. THE TWO DROP CONDITIONS this primitive owns — an answer of ZERO and an
 *     answer above 20 — plus structural incoherence. Nothing is backfilled.
 *  4. ANSWER-LEAK: no spoken ask, pronounce line or context push ever contains
 *     the answer; the asks DO state their problem aloud, because a pre-reader
 *     cannot read the screen and every correction re-ask inherits the ask.
 *  5. Corrections re-model then re-elicit, and they are the FIRST place the
 *     answer is spoken. Each names its signature error and its accept clause.
 *  6. Hand items carry a SILENCE contract; the verdict is code-computed.
 *  7. The catalog keeps its side: template keys resolve against exactly what
 *     the pack pushes, and no catalog sentence opens with a verdict sentinel.
 */
import { describe, it, expect } from 'vitest';
import {
  actionFor,
  answerKindFor,
  completeCue,
  frameVerdictCue,
  isSayableAnswer,
  itemCue,
  itemFromChallenge,
  itemsFromChallenges,
  judgeSplit,
  judgeTeen,
  moveOnCue,
  pronounceCue,
  responseClassFor,
  splitKey,
  splitVerdictCue,
  scatterCells,
  stimulusFor,
  teenVerdictCue,
  tenFrameHarnessAnswers,
  tenFramePackBase,
  waysToSplit,
  type TenFrameItem,
} from '../tenFrameScript';
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

// ── Fixtures — one item per mode, session-shaped ────────────────────────────

const K = { capacity: 10, band: 'K' } as const;
const READER = { capacity: 10, band: '1-2' } as const;
/** The teen modes are the one K context with a DOUBLE frame (contract R2 fork,
 *  2026-09-08): a ten and some ones will not fit on one frame. */
const K_DOUBLE = { capacity: 20, band: 'K' } as const;

const build = (id = 'tf-1') =>
  itemFromChallenge({ id, type: 'build', targetCount: 5 }, K)!;
const subitize = (id = 'tf-2') =>
  itemFromChallenge({ id, type: 'subitize', targetCount: 4 }, K)!;
const makeTenK = (id = 'tf-3') =>
  itemFromChallenge({ id, type: 'make_ten', targetCount: 6 }, K)!;
const makeTenReader = (id = 'tf-4') =>
  itemFromChallenge({ id, type: 'make_ten', targetCount: 6 }, READER)!;
const add = (id = 'tf-5') =>
  itemFromChallenge({ id, type: 'add', targetCount: 5, addend1: 3, addend2: 2 }, READER)!;
const subtract = (id = 'tf-6') =>
  itemFromChallenge({ id, type: 'subtract', targetCount: 4, startCount: 7 }, READER)!;
/** Two split items on the SAME total — the shape the mode needs, because
 *  "in more than one way" is not assessable from a single item. */
const SPLITS = itemsFromChallenges(
  [
    { id: 'tf-7', type: 'split', targetCount: 5 },
    { id: 'tf-8', type: 'split', targetCount: 5 },
  ],
  K,
);

const TEENS = itemsFromChallenges(
  [
    { id: 'tf-9', type: 'build_teen', targetCount: 14 },
    { id: 'tf-10', type: 'decompose_teen', targetCount: 14 },
  ],
  K_DOUBLE,
);

const BUILD = build();
const SUBITIZE = subitize();
const MAKE_TEN_K = makeTenK();
const MAKE_TEN_READER = makeTenReader();
const ADD = add();
const SUBTRACT = subtract();

const [SPLIT_FIRST, SPLIT_AGAIN] = SPLITS;
const [BUILD_TEEN, DECOMPOSE_TEEN] = TEENS;

const ITEMS: TenFrameItem[] = [
  BUILD, SUBITIZE, MAKE_TEN_K, MAKE_TEN_READER, ADD, SUBTRACT, SPLIT_FIRST, SPLIT_AGAIN,
  BUILD_TEEN, DECOMPOSE_TEEN,
];

/**
 * The pack's CUE SURFACE — the real one. This used to be re-typed here, and a
 * re-typed pack can pass every gate while production sends something else; the
 * surface is now exported and both the component and the DI drive-plan endpoint
 * spread it, so this fixture tests what actually goes on the wire.
 */
const pack: JudgedScriptPack<TenFrameItem> = tenFramePackBase(ITEMS);

/** The line the tutor actually SPEAKS — the shared parser, so every port
 *  reads the same span. Everything else in a cue is judge-side instruction. */
const spokenLine = spokenSpanOf;

// ── 1. Structural gates ─────────────────────────────────────────────────────

describe('ten-frame pack · structural gates', () => {
  it('passes the family gates: validate + performed-directions + repeated-asks', () => {
    // checkPackGates = validateJudgedScriptPack PLUS the two gates that exist
    // because a live drive found the defect after every machine gate passed
    // (the performed "[WAIT silently]"; the byte-identical consecutive ask).
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('maps modes to the ruled answer material and benched classes', () => {
    // THE FORK. `build` and K make-ten keep their hands because placing the
    // counters IS the skill; contract R6 pins the K row specifically.
    expect(answerKindFor('build', 'K')).toBe('gesture');
    expect(answerKindFor('make_ten', 'K')).toBe('gesture');
    expect(responseClassFor('build', 'K')).toBe('manipulation');
    expect(responseClassFor('make_ten', 'K')).toBe('manipulation');

    // `split` answers a PAIR, and a pair has no benched spoken class — which is
    // the reason it is enacted, not the consequence. It is gesture at EVERY
    // band, unlike make_ten: a reader who can say "two and three" has still not
    // shown they can partition a set.
    for (const band of ['K', '1-2'] as const) {
      expect(answerKindFor('split', band)).toBe('gesture');
      expect(responseClassFor('split', band)).toBe('manipulation');
    }

    // Everything else reports a NUMBER, and the stepper that used to carry it
    // was a costume: a child who cannot subitize can still operate a stepper.
    expect(answerKindFor('make_ten', '1-2')).toBe('voice');
    for (const kind of ['subitize', 'add', 'subtract'] as const) {
      for (const band of ['K', '1-2'] as const) {
        expect(answerKindFor(kind, band)).toBe('voice');
        expect(responseClassFor(kind, band)).toBe('number_word_to_20');
      }
    }
  });

  it('never hands the tutor a stage direction shaped like something to perform', () => {
    // REGRESSION (drive 2, 2026-08-13): the tutor VOICED "[WAIT silently]" to
    // the child, straight after the ask. It took the contract's old "Then WAIT
    // silently…" opener, wrapped it in a bracket tag mimicking [TF_ITEM], and
    // performed it — an imperative aimed at the tutor reads like one more thing
    // on the list of things to say. The wait is now stated as a fact about the
    // turn, and every contract-carrying cue names the failure explicitly.
    for (const item of ITEMS) {
      for (const cue of [itemCue(item), moveOnCue(item, ADD, { howToPlay: true })]) {
        expect(cue).not.toMatch(/Then WAIT/i);
        expect(cue).toContain('The quoted line is the ONLY thing you say');
        expect(cue).toContain('never announce that you are waiting or listening');
      }
    }
  });

  it('stamps action per item so mixed sessions re-speak the how-to-play on change', () => {
    // The two make-ten bands are different ACTIONS (fill vs. say), so a session
    // that crosses them re-speaks what to do.
    expect(actionFor('make_ten', 'K')).toBe('fill');
    expect(actionFor('make_ten', '1-2')).toBe('complement');
    expect(actionFor('add', 'K')).toBe(actionFor('subtract', 'K'));
    expect(actionFor('build', 'K')).not.toBe(actionFor('subitize', 'K'));
  });
});

// ── 2. Build gates — the two drop conditions this primitive owns ─────────────

describe('ten-frame pack · build gates', () => {
  it('DROPS an item whose spoken answer is zero', () => {
    // An empty frame is a legitimate subitize stimulus and a subtraction can
    // land on nothing — but "zero" is an unbenched spoken answer, so neither
    // item may be asked. REVERT-BITE: this is the gate, not a preference.
    expect(itemFromChallenge({ id: 'z1', type: 'subitize', targetCount: 0 }, K)).toBeNull();
    expect(itemFromChallenge({ id: 'z2', type: 'subtract', targetCount: 0, startCount: 5 }, K)).toBeNull();
    // A make-ten with a full frame has a complement of zero.
    expect(itemFromChallenge({ id: 'z3', type: 'make_ten', targetCount: 10 }, READER)).toBeNull();
  });

  it('DROPS an item whose spoken answer leaves the benched range', () => {
    expect(isSayableAnswer(20)).toBe(true);
    expect(isSayableAnswer(21)).toBe(false);
    expect(isSayableAnswer(0)).toBe(false);
    // A double frame tops out at 20, so nothing in range is lost; a capacity
    // change could not launder an unbenched class past this.
    expect(itemFromChallenge({ id: 'o1', type: 'subitize', targetCount: 21 }, { capacity: 30, band: '1-2' })).toBeNull();
    expect(itemFromChallenge({ id: 'o2', type: 'add', targetCount: 24, addend1: 12, addend2: 12 }, { capacity: 30, band: '1-2' })).toBeNull();
  });

  it('DROPS a structurally incoherent item rather than repairing it', () => {
    expect(itemFromChallenge({ id: 'b1', type: 'add', targetCount: 5 }, READER)).toBeNull();
    expect(itemFromChallenge({ id: 'b2', type: 'subtract', targetCount: 6, startCount: 4 }, READER)).toBeNull();
    expect(itemFromChallenge({ id: 'b3', type: 'build', targetCount: 14 }, K)).toBeNull();
    expect(itemFromChallenge({ id: 'b4', type: 'subitize', targetCount: 12 }, K)).toBeNull();
  });

  it('keeps a K make-ten whose complement would be unsayable as a HAND item', () => {
    // The K complement is enacted, not spoken, so the spoken bench does not
    // bind it — the band fork is what makes this legal.
    const wide = itemFromChallenge({ id: 'w1', type: 'make_ten', targetCount: 1 }, { capacity: 30, band: 'K' });
    expect(wide?.answerKind).toBe('gesture');
    expect(wide?.answer).toBe(29);
    // The same numbers spoken at a reader grade are refused.
    expect(itemFromChallenge({ id: 'w2', type: 'make_ten', targetCount: 1 }, { capacity: 30, band: '1-2' })).toBeNull();
  });

  it('derives the answer from the numeric fields, never from a flag', () => {
    expect(MAKE_TEN_READER.answer).toBe(4);   // 10 − 6
    expect(ADD.answer).toBe(5);               // 3 + 2
    expect(SUBTRACT.answer).toBe(4);          // 7 − 3
    expect(SUBTRACT.removed).toBe(3);
    expect(MAKE_TEN_K.commitAt).toBe(10);     // R6: judges when the frame is full
    expect(BUILD.commitAt).toBeUndefined();   // build has no terminal state
  });
});

// ── 3. Answer-leak: the number never precedes the child's answer ────────────

describe('ten-frame pack · answer-leak', () => {
  it('never puts the answer in a spoken ask', () => {
    expect(spokenLine(itemCue(SUBITIZE))).not.toContain('four');
    expect(spokenLine(itemCue(MAKE_TEN_READER))).not.toContain('four');
    expect(spokenLine(itemCue(ADD))).not.toContain('five');
    expect(spokenLine(itemCue(SUBTRACT))).not.toContain('four');
  });

  it('says nothing at all about the quantity on a flash item', () => {
    // Subitize's ask must survive against a HIDDEN frame (R4): if the ask
    // named or hinted a quantity, the mode would be answerable without looking.
    const ask = spokenLine(itemCue(SUBITIZE));
    expect(ask).toMatch(/how many counters did you see/i);
    expect(ask).not.toMatch(/one|two|three|four|five|six|seven|eight|nine|ten/i);
  });

  it('states the problem aloud in every ask (the pre-reader cannot read it)', () => {
    // `findUnspokenStimulus`'s rule — and the defect a live drive of
    // di-spoken-practice caught.
    expect(spokenLine(itemCue(ADD))).toContain('Three plus two');
    expect(spokenLine(itemCue(SUBTRACT))).toContain('Seven counters');
    expect(spokenLine(itemCue(SUBTRACT))).toContain('Take away three');
    expect(spokenLine(itemCue(MAKE_TEN_READER))).toContain('six counters');
    expect(spokenLine(itemCue(MAKE_TEN_READER))).toContain('make ten');
    // On a hand item the target IS the question, so it is spoken.
    expect(spokenLine(itemCue(BUILD))).toContain('five counters');
  });

  it('re-speaks the QUESTION on tap-to-hear, never the answer', () => {
    expect(pronounceCue(SUBITIZE)).not.toContain('four');
    expect(pronounceCue(MAKE_TEN_READER)).not.toContain('four');
    expect(pronounceCue(ADD)).not.toContain('five');
    expect(pronounceCue(SUBTRACT)).not.toContain('four');
    expect(pronounceCue(ADD)).toContain('Three plus two');
  });

  it('pushes only the answer-free question side through the context channel', () => {
    // Subitize pushes NO quantity at all — its count is the answer.
    expect(stimulusFor(SUBITIZE)).not.toMatch(/\d|one|two|three|four|five/i);
    expect(stimulusFor(MAKE_TEN_READER)).toContain('six');
    expect(stimulusFor(MAKE_TEN_READER)).not.toContain('four');
    expect(stimulusFor(ADD)).toBe('three plus two');
    expect(stimulusFor(SUBTRACT)).toContain('take away three');
    expect(stimulusFor(SUBTRACT)).not.toContain('four');
    expect(stimulusFor(BUILD)).toContain('five');
  });

  it('agrees with pluralisation so a one-counter ask is sayable', () => {
    const one = itemFromChallenge({ id: 'p1', type: 'build', targetCount: 1 }, K)!;
    expect(spokenLine(itemCue(one))).toContain('one counter on the frame');
    expect(spokenLine(itemCue(one))).not.toContain('one counters');
  });
});

// ── 4. Corrections re-model then re-elicit; the answer is EARNED there ──────

describe('ten-frame pack · corrections', () => {
  it('every spoken correction opens with the sentinel, names the answer, and re-elicits', () => {
    const subitizeCue = itemCue(SUBITIZE);
    expect(subitizeCue).toContain('If it is wrong, say exactly: "My turn:');
    expect(subitizeCue).toContain('it was four');
    expect(subitizeCue).toContain('Your turn. How many counters did you see?');

    const makeTen = itemCue(MAKE_TEN_READER);
    expect(makeTen).toContain('six and four make ten');
    expect(makeTen).toContain('Your turn. How many more counters make ten?');

    const addCue = itemCue(ADD);
    expect(addCue).toContain('One, two, three, four, five');   // the counted walk, at ten or below
    expect(addCue).toContain('Five altogether');

    const subtractCue = itemCue(SUBTRACT);
    expect(subtractCue).toContain('seven take away three leaves four');
    expect(subtractCue).toContain('Four are left');
  });

  it('names the signature error per mode — the fluent, confident miss', () => {
    expect(itemCue(SUBITIZE)).toContain('counting up one at a time');
    expect(itemCue(MAKE_TEN_READER)).toContain('The total "ten" said back is NOT the answer');
    expect(itemCue(ADD)).toContain('Either addend said back ("three" or "two") is NOT the answer');
    expect(itemCue(SUBTRACT)).toContain('The starting number "seven" and the number taken away "three" are NOT the answer');
  });

  it('carries the accept side — the right answer that does not look right', () => {
    // Subitize refuses a counted route but MUST accept land-on-the-total: a
    // child who says "four" and then verifies by counting is correct.
    expect(itemCue(SUBITIZE)).toContain('checking it by counting AFTER saying it is still correct');
    expect(itemCue(MAKE_TEN_READER)).toContain('"four more" or "four counters" counts as "four"');
    expect(itemCue(ADD)).toContain('Counting aloud that ENDS on "five" counts as that answer');
    expect(itemCue(SUBTRACT)).toContain('Counting aloud that ENDS on "four" counts as that answer');
  });

  it('models the counted walk only where it is sayable', () => {
    const big = itemFromChallenge(
      { id: 'g1', type: 'add', targetCount: 17, addend1: 9, addend2: 8 },
      { capacity: 20, band: '1-2' },
    )!;
    expect(itemCue(big)).not.toContain('One, two, three, four, five, six');
    expect(itemCue(big)).toContain('count on');
  });
});

// ── 5. Hand items: silence contract + code-computed verdict ─────────────────

describe('ten-frame pack · hand items', () => {
  it('hand asks carry a SILENCE contract, not a judging contract', () => {
    for (const item of [BUILD, MAKE_TEN_K]) {
      const cue = itemCue(item);
      expect(cue).toContain('stay completely silent');
      expect(cue).toContain('with their HANDS on the frame');
      expect(cue).not.toContain('If the answer is right');
    }
    expect(itemCue(BUILD)).toContain('never say how many are on the frame');
    expect(itemCue(MAKE_TEN_K)).toContain('Never say how many more are needed');
  });

  it('computes the verdict in code and hands the tutor its exact line', () => {
    const built = frameVerdictCue(BUILD, 5);
    expect(built).toContain('MATCHES');
    expect(spokenLine(built)).toContain('Five counters on the frame');

    const missed = frameVerdictCue(BUILD, 3);
    expect(missed).toContain('does NOT match');
    expect(spokenLine(missed).startsWith('My turn:')).toBe(true);
    expect(spokenLine(missed)).toContain('One, two, three, four, five');
  });

  it('judges the K make-ten complement by what the child PLACED', () => {
    // The enacted complement is filledCount − seeded, so the verdict is about
    // the four counters the child added, not the six that were seeded (R6).
    const filled = frameVerdictCue(MAKE_TEN_K, 4);
    expect(filled).toContain('fills it');
    expect(spokenLine(filled)).toContain('Six and four make ten');

    // Stopping early is now a WRONG answer — which is what makes the item
    // judgeable at all. The correction never names the missing count.
    const short = frameVerdictCue(MAKE_TEN_K, 2);
    expect(short).toContain('does NOT fill it');
    expect(spokenLine(short)).not.toContain('four');
    expect(spokenLine(short)).toContain('keep tapping the empty boxes');
  });

  it('keeps every gesture verdict line free of a sentinel collision', () => {
    const cues = [BUILD, MAKE_TEN_K].flatMap((item) => [
      { label: `verdict-hit-${item.id}`, text: frameVerdictCue(item, item.answer) },
      { label: `verdict-miss-${item.id}`, text: frameVerdictCue(item, item.answer - 1) },
    ]);
    expect(findSentinelCollisions(cues)).toEqual([]);
  });
});

// ── 6. Session frame ────────────────────────────────────────────────────────

describe('ten-frame pack · session frame', () => {
  it('the opening cue has ONE job: greeting + how-to-play + ask inside the quoted line', () => {
    const opening = spokenLine(itemCue(SUBITIZE, { opening: true, howToPlay: true }));
    expect(opening).toContain('Hi! Time to work with the ten frame!');
    expect(opening).toContain('show for just a moment');
    expect(opening).toContain('How many counters did you see?');
  });

  it('re-speaks the how-to-play when the ACTION changes', () => {
    const crossing = moveOnCue(SUBITIZE, MAKE_TEN_K, { howToPlay: true });
    expect(crossing).toContain('Tap the empty boxes');
    expect(moveOnCue(SUBITIZE, MAKE_TEN_K, {})).not.toContain('Tap the empty boxes');
  });

  it('the final move-on and the complete cue both stop the tutor', () => {
    expect(moveOnCue(SUBTRACT, null, {})).toContain('Then stop');
    expect(completeCue()).toContain('Then stop — the activity is over.');
  });
});

// ── 7. The catalog keeps its side of the contract ───────────────────────────

describe('ten-frame catalog · DI frame', () => {
  const entry = MATH_CATALOG.find((p) => p.id === 'ten-frame')!;

  it('keeps its side of the contract: audio mode, contextKeys, template keys, sentinel scan', () => {
    expect(checkDiCatalogEntry(entry, pack, SUBITIZE)).toEqual([]);
  });

  it('steers the manifest at the modality, not at a Check button', () => {
    // "tap the tiles" prose routes a primitive wrong forever; this entry has to
    // say out loud that it needs a microphone.
    expect(entry.constraints).toMatch(/microphone/i);
    expect(entry.constraints).toMatch(/no Check button/i);
    // Ordered lowest β → highest, and `decompose` (2.0) sits between the
    // concrete build and the pictorial subitize. The two K.NBT.1 teen modes
    // slot in by difficulty rather than by arrival: `build_teen` (2.0) is a
    // concrete placement beside a GIVEN ten, `decompose_teen` (3.0) makes the
    // child find the ten inside a scattered group.
    expect(entry.evalModes?.map((m) => m.evalMode))
      .toEqual(['build', 'decompose', 'build_teen', 'subitize', 'decompose_teen', 'make_ten', 'operate']);
    expect(entry.evalModes?.map((m) => m.beta)).toEqual([...entry.evalModes!].map((m) => m.beta).sort((a, b) => a - b));
    // The mic sentence must no longer read as covering the whole primitive:
    // build and decompose are judged from hands and need no spoken answer.
    expect(entry.constraints).toMatch(/hands-only modes \(build, decompose\)/);
  });
});

// ── 8. Harness answer material — the contract's refusal claims, made testable ─

describe('ten-frame pack · headless drive answers', () => {
  // These feed the judged-loop harness (run_tutor_live.py --di), which answers
  // every spoken item WRONG on purpose before answering it right. The pins that
  // matter are the ones tying each wrong answer back to the clause of
  // `discriminationFor` that claims the judge refuses it — the claim and the
  // test of the claim have to move together or the harness drills a straw man.

  it('never offers a "wrong" answer that is actually right', () => {
    for (const item of ITEMS) {
      const answers = tenFrameHarnessAnswers(item);
      expect(answers.plainWrong).not.toBe(answers.correct);
      if (answers.signatureWrong) {
        expect(answers.signatureWrong.text).not.toBe(answers.correct);
      }
    }
  });

  it('names the SIGNATURE error each judging contract promises to refuse', () => {
    // make-ten: six shown in a frame of ten, so the ANSWER is four — and the
    // signature error is the TOTAL ("ten") said back, which is the fluent miss
    // the contract names. The two must not be confused: drilling "four" here
    // would be drilling the right answer.
    expect(MAKE_TEN_READER.answer).toBe(4);
    expect(tenFrameHarnessAnswers(MAKE_TEN_READER).signatureWrong?.text).toBe('ten');
    expect(itemCue(MAKE_TEN_READER, {})).toContain('"ten" said back is NOT the answer');
    // add: the contract refuses either addend said back.
    expect(tenFrameHarnessAnswers(ADD).signatureWrong?.text).toBe('three');
    expect(itemCue(ADD, {})).toContain('Either addend said back');
    // subtract: the contract refuses the starting number.
    expect(tenFrameHarnessAnswers(SUBTRACT).signatureWrong?.text).toBe('seven');
    expect(itemCue(SUBTRACT, {})).toContain('The starting number "seven"');
  });

  it('only forbids the answer word where the ask does not already say it', () => {
    // subitize states no quantity at all — hearing the count back IS the leak.
    expect(tenFrameHarnessAnswers(SUBITIZE).leakTokens).toEqual(['four']);
    // build SPEAKS its target: the number is the question, not the answer, and
    // flagging it would file a finding against the ask itself.
    expect(tenFrameHarnessAnswers(BUILD).leakTokens).toEqual([]);
  });

  it('gives hands items a placement to commit, not a word to say', () => {
    const answers = tenFrameHarnessAnswers(BUILD);
    expect(answers.placed).toEqual({ correct: BUILD.answer, wrong: BUILD.answer - 1 });
    expect(answers.signatureWrong).toBeUndefined();
  });

  it('keeps the spoken answers inside the benched number window', () => {
    for (const item of ITEMS.filter((i) => i.answerKind === 'voice')) {
      const { plainWrong } = tenFrameHarnessAnswers(item);
      expect(plainWrong).not.toMatch(/zero/);
      expect(plainWrong.length).toBeGreaterThan(0);
    }
  });
});

// ── 9. `split` — the decomposition mode (contract R9) ───────────────────────

/** Number words that would be a PART of a total of five if they appeared. */
const PART_WORD = /\b(one|two|three|four)\b/i;

/**
 * "two groups" / "two colour groups" says HOW MANY GROUPS — the shape of the
 * task, spoken in every ask. It is not a part of the total, and stripping it is
 * what lets the leak assertion below stay blunt about everything else,
 * including the "two" of a genuine pair, which is the thing it exists to catch.
 *
 * ⚠ This helper was silently VACUOUS once: a shell round-trip turned its two
 * \b word boundaries into literal backspace bytes, so PART_WORD matched nothing
 * and the leak test passed against a stimulus string that does say "two". If
 * this assertion ever goes quiet, check the regex bytes before trusting it.
 */
const withoutGroupCount = (text: string) =>
  text.replace(/\btwo (?:colour )?groups\b/gi, 'GROUPS');

describe('ten-frame pack · split / decompose', () => {
  it('seeds the WHOLE group and asks the child to partition it, never to build it', () => {
    // The distinction is the whole mode: `build` hands the child an empty frame
    // and asks for a quantity; `split` hands them the quantity and asks where
    // the line goes. Seeding `shown = answer` is what makes the total
    // un-driftable, so the only thing the item can measure is the partition.
    expect(SPLIT_FIRST.shown).toBe(5);
    expect(SPLIT_FIRST.answer).toBe(5);
    expect(SPLIT_FIRST.answerKind).toBe('gesture');
    expect(SPLIT_FIRST.commitAt).toBeUndefined();   // closes on stillness, like build
  });

  it('DROPS a group that cannot be split at all', () => {
    // A group of one has no two non-empty parts, so the item would have no
    // right answer. Dropped, not repaired — the family rule.
    expect(itemFromChallenge({ id: 's0', type: 'split', targetCount: 1 }, K)).toBeNull();
    expect(itemFromChallenge({ id: 's0b', type: 'split', targetCount: 0 }, K)).toBeNull();
    expect(itemFromChallenge({ id: 's0c', type: 'split', targetCount: 11 }, K)).toBeNull();
    // Two is the floor and it is legal: exactly one way (1+1).
    expect(itemFromChallenge({ id: 's2', type: 'split', targetCount: 2 }, K)).not.toBeNull();
    expect(waysToSplit(2)).toBe(1);
    expect(waysToSplit(5)).toBe(4);   // ordered: 1+4, 2+3, 3+2, 4+1
  });

  it('stamps the ordinal per TOTAL so the second ask demands a different way', () => {
    expect(SPLIT_FIRST.splitOrdinal).toBe(1);
    expect(SPLIT_AGAIN.splitOrdinal).toBe(2);

    // Ordinals are per-total, not per-session: a new total starts over at one,
    // because the child has not shown any way to make IT yet.
    const mixed = itemsFromChallenges(
      [
        { id: 'm1', type: 'split', targetCount: 4 },
        { id: 'm2', type: 'split', targetCount: 5 },
        { id: 'm3', type: 'split', targetCount: 4 },
      ],
      K,
    );
    expect(mixed.map((i) => i.splitOrdinal)).toEqual([1, 1, 2]);
  });

  it('asks for A way first and a DIFFERENT way after', () => {
    const first = spokenLine(itemCue(SPLIT_FIRST));
    expect(first).toContain('Here are five counters');
    expect(first).toContain('turn some yellow');
    expect(first).not.toMatch(/different/i);

    const again = spokenLine(itemCue(SPLIT_AGAIN));
    expect(again).toMatch(/DIFFERENT way/);
  });

  it('never names a pair in the ask, the how-to-play, the re-ask or the context push', () => {
    // THE LEAK HERE IS A PAIR, not a count — and one pair spoken aloud answers
    // every remaining item on that total, not just the one on screen. The TOTAL
    // is public (the ask states it); the parts never are.
    const surfaces = [
      spokenLine(itemCue(SPLIT_FIRST, { opening: true, howToPlay: true })),
      spokenLine(itemCue(SPLIT_AGAIN)),
      spokenLine(pronounceCue(SPLIT_FIRST)),
      stimulusFor(SPLIT_FIRST),
    ];
    for (const text of surfaces) {
      // "five" is the TOTAL and is allowed — the ask states it. Any smaller
      // number word would be a PART of it, i.e. half of the answer.
      expect(withoutGroupCount(text)).not.toMatch(PART_WORD);
    }
  });

  it('carries a SILENCE contract that bans pairs for the whole item', () => {
    const cue = itemCue(SPLIT_FIRST);
    expect(cue).toContain('stay completely silent');
    expect(cue).toContain('Never suggest a pair of numbers that makes five');
    expect(cue).toContain('never say how many to turn yellow');
    expect(cue).not.toContain('If the answer is right');   // no spoken judging contract
  });

  it('judges the pair in CODE: any two non-empty groups are right', () => {
    // There is no single right answer, which is the property that makes this a
    // decomposition task rather than an arithmetic one.
    expect(judgeSplit(SPLIT_FIRST, { a: 4, b: 1 })).toBe('correct');
    expect(judgeSplit(SPLIT_FIRST, { a: 3, b: 2 })).toBe('correct');
    expect(judgeSplit(SPLIT_FIRST, { a: 1, b: 4 })).toBe('correct');
  });

  it('refuses the signature miss: one group and an empty one', () => {
    // Flipping all or none is the fluent, finished-looking action that is not a
    // decomposition. It is the reason the mode needs a judge at all — every
    // other state on this frame is already correct.
    expect(judgeSplit(SPLIT_FIRST, { a: 5, b: 0 })).toBe('empty_part');
    expect(judgeSplit(SPLIT_FIRST, { a: 0, b: 5 })).toBe('empty_part');
    const verdict = splitVerdictCue(SPLIT_FIRST, { a: 5, b: 0 });
    expect(verdict).toContain('EMPTY_PART');
    expect(spokenLine(verdict).startsWith('My turn:')).toBe(true);
    expect(spokenLine(verdict)).toContain('Not all red. Not all yellow.');
    // The correction models the PROPERTY, never a pair — modelling "turn one
    // yellow" would hand over a valid answer.
    expect(withoutGroupCount(spokenLine(verdict))).not.toMatch(PART_WORD);
  });

  it('refuses a REPEAT while another way is still available, and accepts it once they run out', () => {
    const shown = new Set([splitKey({ a: 3, b: 2 })]);
    expect(judgeSplit(SPLIT_AGAIN, { a: 3, b: 2 }, shown)).toBe('repeat');
    // Ordered pairs: 3+2 and 2+3 are different pictures and different bonds.
    expect(judgeSplit(SPLIT_AGAIN, { a: 2, b: 3 }, shown)).toBe('correct');

    const repeat = splitVerdictCue(SPLIT_AGAIN, { a: 3, b: 2 }, shown);
    expect(repeat).toContain('REPEAT');
    expect(spokenLine(repeat)).toContain('the same way you showed me before');
    expect(spokenLine(repeat)).toContain('turn a different number of counters yellow');

    // EXHAUSTION: a total of two has exactly one way, so once it is shown the
    // item can never be answered any other way. Demanding a new one would make
    // the item unwinnable, so the repeat rule stands down.
    const two = itemFromChallenge({ id: 'x2', type: 'split', targetCount: 2 }, K)!;
    const usedUp = new Set([splitKey({ a: 1, b: 1 })]);
    expect(judgeSplit(two, { a: 1, b: 1 }, usedUp)).toBe('correct');
  });

  it('names the pair in exactly ONE place: the affirmation of what the child built', () => {
    const hit = splitVerdictCue(SPLIT_FIRST, { a: 3, b: 2 });
    expect(hit).toContain('CORRECT');
    expect(spokenLine(hit)).toBe('Yes! Three red and two yellow make five.');
  });

  it('keeps every split verdict line free of a sentinel collision', () => {
    const cues = [
      { label: 'split-correct', text: splitVerdictCue(SPLIT_FIRST, { a: 3, b: 2 }) },
      { label: 'split-empty', text: splitVerdictCue(SPLIT_FIRST, { a: 5, b: 0 }) },
      { label: 'split-repeat', text: splitVerdictCue(SPLIT_AGAIN, { a: 3, b: 2 }, new Set([splitKey({ a: 3, b: 2 })])) },
      { label: 'split-miscount', text: splitVerdictCue(SPLIT_FIRST, { a: 2, b: 2 }) },
    ];
    expect(findSentinelCollisions(cues)).toEqual([]);
  });

  it('routes the gesture channel through frameVerdictCue as a YELLOW count', () => {
    // The harness and the stage both commit ONE number. The total is fixed by
    // the item, so `b` determines `a` and no adapter needs a second field.
    expect(frameVerdictCue(SPLIT_FIRST, 2)).toBe(splitVerdictCue(SPLIT_FIRST, { a: 3, b: 2 }));
    expect(frameVerdictCue(SPLIT_FIRST, 5)).toContain('EMPTY_PART');
  });

  it('drives the harness at the signature miss, not at an arithmetic slip', () => {
    const answers = tenFrameHarnessAnswers(SPLIT_FIRST);
    expect(answers.placed).toEqual({ correct: 2, wrong: 5 });
    expect(answers.signatureWrong?.text).toContain('all 5 turned yellow');
    expect(answers.leakTokens).toEqual([]);
    expect(judgeSplit(SPLIT_FIRST, { a: 5 - answers.placed!.correct, b: answers.placed!.correct }))
      .toBe('correct');
    expect(judgeSplit(SPLIT_FIRST, { a: 5 - answers.placed!.wrong, b: answers.placed!.wrong }))
      .toBe('empty_part');
  });

  it('re-speaks the how-to-play when the action changes into a split', () => {
    const crossing = moveOnCue(BUILD, SPLIT_FIRST, { howToPlay: true });
    expect(crossing).toContain('Tap a counter to turn it yellow');
    expect(actionFor('split', 'K')).toBe('split');
    expect(actionFor('split', 'K')).not.toBe(actionFor('build', 'K'));
  });
});

// ── 10. The teen modes — K.NBT.1 on a double frame (contract R2 fork) ───────

/** Number words that would be the ONES of fourteen if they appeared. */
const ONES_WORD = /\bfour\b/i;

describe('ten-frame pack · teen numbers', () => {
  it('pins both teen modes to a DOUBLE frame and drops them on a single one', () => {
    // This is the fork, as a test. R2 keeps K on a single frame for every other
    // mode; a teen number has no ten-and-some-ones picture there at all, so the
    // item DROPS rather than shipping as a truncated build — which is exactly
    // the defect the K Math atlas found (`ten-frame / build` emitting a single
    // frame with a target of 5 for an objective naming 11-19).
    expect(itemFromChallenge({ id: 't1', type: 'build_teen', targetCount: 14 }, K)).toBeNull();
    expect(itemFromChallenge({ id: 't2', type: 'decompose_teen', targetCount: 14 }, K)).toBeNull();
    expect(BUILD_TEEN.capacity).toBe(20);
    expect(DECOMPOSE_TEEN.capacity).toBe(20);
  });

  it("DROPS anything outside 11-19 — the objective's own window", () => {
    for (const target of [9, 10, 20, 21]) {
      expect(itemFromChallenge({ id: `x${target}`, type: 'build_teen', targetCount: target }, K_DOUBLE)).toBeNull();
      expect(itemFromChallenge({ id: `y${target}`, type: 'decompose_teen', targetCount: target }, K_DOUBLE)).toBeNull();
    }
    for (const target of [11, 19]) {
      expect(itemFromChallenge({ id: `a${target}`, type: 'build_teen', targetCount: target }, K_DOUBLE)).not.toBeNull();
      expect(itemFromChallenge({ id: `b${target}`, type: 'decompose_teen', targetCount: target }, K_DOUBLE)).not.toBeNull();
    }
  });

  it('gives each mode the right board: a GIVEN ten, or a scattered group', () => {
    // build_teen hands the child the ten and asks for the ones.
    expect(BUILD_TEEN.shown).toBe(10);
    expect(BUILD_TEEN.answer).toBe(4);
    expect(BUILD_TEEN.teenTotal).toBe(14);
    expect(BUILD_TEEN.answerKind).toBe('gesture');
    // No terminal state — the frames hold twenty and the teen number is short
    // of it — so it closes on stillness, unlike K make-ten's frame-full commit.
    expect(BUILD_TEEN.commitAt).toBeUndefined();

    // decompose_teen hands the child the whole group and asks for the ten.
    expect(DECOMPOSE_TEEN.shown).toBe(14);
    expect(DECOMPOSE_TEEN.answer).toBe(14);
    expect(DECOMPOSE_TEEN.seedCells).toHaveLength(14);
    expect(BUILD_TEEN.seedCells).toBeUndefined();
  });

  it('SCATTERS the decompose group so no full frame hands over the ten', () => {
    // The load-bearing property: seeded top-frame-first, "flip the full row"
    // would be a layout cue a child who cannot count to ten could follow, which
    // is the trivial-from-layout failure pedagogy rule #1 forbids.
    for (const total of [11, 12, 13, 14, 15, 16, 17, 18]) {
      const cells = scatterCells(total, 20, `seed-${total}`);
      expect(cells).toHaveLength(total);
      expect(new Set(cells).size).toBe(total);
      const top = cells.filter((c) => c < 10).length;
      expect(top).toBeLessThan(10);
      expect(total - top).toBeLessThan(10);
    }
    // NINETEEN is the exception and it is GEOMETRY: nineteen counters over two
    // frames of ten must fill one of them, so the guard cannot hold there. The
    // mode keeps nineteen anyway — the published objective names 16-19, and a
    // cap below what the objective names is the defect this mode closes. The
    // cost is recorded in `scatterCells`: at nineteen the item asks the child
    // to SPOT the full frame rather than count ten out of a scatter.
    const nineteen = scatterCells(19, 20, 'seed-19');
    expect(nineteen).toHaveLength(19);
    expect(new Set(nineteen).size).toBe(19);
    // Deterministic in the item id: a scatter that moved under a re-render
    // would slide counters out from under the child's finger mid-count.
    expect(scatterCells(14, 20, 'tf-10')).toEqual(scatterCells(14, 20, 'tf-10'));
    expect(scatterCells(14, 20, 'tf-10')).not.toEqual(scatterCells(14, 20, 'tf-11'));
  });

  it('states the ten and the total aloud, and never the ones', () => {
    // BOTH the ten and the teen number are the QUESTION here — "a full frame is
    // ten" IS the model K.NBT.1 teaches, so saying it is the lesson, not a
    // leak. What must never precede the child's answer is the LEFTOVER.
    const surfaces = [
      spokenLine(itemCue(BUILD_TEEN, { opening: true, howToPlay: true })),
      spokenLine(itemCue(DECOMPOSE_TEEN, { opening: true, howToPlay: true })),
      spokenLine(pronounceCue(BUILD_TEEN)),
      spokenLine(pronounceCue(DECOMPOSE_TEEN)),
      stimulusFor(BUILD_TEEN),
      stimulusFor(DECOMPOSE_TEEN),
    ];
    for (const surface of surfaces) {
      expect(surface).not.toMatch(ONES_WORD);
    }
    expect(spokenLine(itemCue(BUILD_TEEN))).toContain('That is ten');
    expect(spokenLine(itemCue(BUILD_TEEN))).toContain('make fourteen');
    expect(spokenLine(itemCue(DECOMPOSE_TEEN))).toContain('turn ten of them yellow');
  });

  it("bans the leftover from the tutor's mouth for the whole hand turn", () => {
    expect(itemCue(BUILD_TEEN)).toContain('Never say how many more than ten are needed');
    expect(itemCue(DECOMPOSE_TEEN)).toContain('Never say how many counters will be left red');
    for (const item of [BUILD_TEEN, DECOMPOSE_TEEN]) {
      expect(itemCue(item)).toContain('the learner answers with their HANDS');
      expect(itemCue(item)).toContain('You will be told what they placed');
    }
  });

  it('judges the count in CODE and forks the correction on which miss it was', () => {
    // build_teen measures the ONES placed beside the given ten.
    expect(judgeTeen(BUILD_TEEN, 4)).toBe('correct');
    expect(judgeTeen(BUILD_TEEN, 2)).toBe('too_few');
    expect(judgeTeen(BUILD_TEEN, 14)).toBe('too_many');
    // decompose_teen measures the counters turned yellow, and the target is
    // TEN whatever the total is.
    expect(judgeTeen(DECOMPOSE_TEEN, 10)).toBe('correct');
    expect(judgeTeen(DECOMPOSE_TEEN, 8)).toBe('too_few');
    expect(judgeTeen(DECOMPOSE_TEEN, 14)).toBe('too_many');

    const short = teenVerdictCue(BUILD_TEEN, 2);
    const over = teenVerdictCue(BUILD_TEEN, 14);
    expect(short).toContain('does NOT match');
    expect(spokenLine(short)).toContain('that is not fourteen yet');
    expect(spokenLine(over)).toContain('that is past fourteen');
    // The correction is where the answer is EARNED: build_teen models counting
    // ON from the ten and names the ones there and only there.
    expect(spokenLine(short)).toContain('eleven, twelve, thirteen, fourteen');
    expect(spokenLine(short)).toContain('four more than ten');
  });

  it('never names the leftover on a decompose_teen correction — its model is the ten', () => {
    // The correction MODELS counting one-to-ten, so every number word from one
    // to ten passes the tutor's lips — including, for a total of fourteen, the
    // word "four". A word scan would call that a leak and be wrong: the walk
    // runs to ten on EVERY item regardless of the total, so it carries no
    // information about the leftover at all. The property that actually proves
    // it is INVARIANCE — the correction is byte-identical across totals, so
    // nothing in it can be about the answer.
    const other = itemsFromChallenges(
      [{ id: 'tf-17', type: 'decompose_teen', targetCount: 17 }],
      K_DOUBLE,
    )[0];
    for (const produced of [0, 8, 14]) {
      const cue = spokenLine(teenVerdictCue(DECOMPOSE_TEEN, produced));
      expect(cue).toContain('Stop at ten');
      expect(cue).toBe(spokenLine(teenVerdictCue(other, produced)));
    }
    // The one place the leftover may be spoken is the affirmation, and there it
    // DOES vary with the total, because it names what the child produced.
    expect(spokenLine(teenVerdictCue(other, 10))).toContain('seven left red');
    expect(spokenLine(teenVerdictCue(DECOMPOSE_TEEN, 10))).toMatch(ONES_WORD);
  });

  it('names the whole decomposition ONLY in the affirmation the child earned', () => {
    expect(spokenLine(teenVerdictCue(BUILD_TEEN, 4)))
      .toBe('Yes! Ten and four make fourteen.');
    expect(spokenLine(teenVerdictCue(DECOMPOSE_TEEN, 10)))
      .toBe('Yes! Ten yellow, and four left red. Fourteen is ten and four.');
  });

  it('routes both modes through the shared gesture entry point', () => {
    // The component and the headless harness both call `frameVerdictCue` with
    // one number; neither needs to know what the target is.
    expect(frameVerdictCue(BUILD_TEEN, 4)).toBe(teenVerdictCue(BUILD_TEEN, 4));
    expect(frameVerdictCue(DECOMPOSE_TEEN, 10)).toBe(teenVerdictCue(DECOMPOSE_TEEN, 10));
  });

  it('drives the harness at the signature miss, not at an arithmetic slip', () => {
    // build_teen: rebuilding the whole teen number instead of counting on from
    // the ten already there — the child who has not yet seen a full frame as
    // ONE ten. decompose_teen: flipping everything, which separates no ten out
    // of anything (`split`'s empty-part miss, one mode over).
    const built = tenFrameHarnessAnswers(BUILD_TEEN);
    expect(built.placed).toEqual({ correct: 4, wrong: 14 });
    expect(built.signatureWrong?.why).toMatch(/counting on from the ten/);
    expect(built.leakTokens).toEqual(['four']);
    expect(judgeTeen(BUILD_TEEN, built.placed!.wrong)).toBe('too_many');

    const found = tenFrameHarnessAnswers(DECOMPOSE_TEEN);
    expect(found.placed).toEqual({ correct: 10, wrong: 14 });
    expect(found.leakTokens).toEqual([]);   // both public numbers are in the ask
    expect(judgeTeen(DECOMPOSE_TEEN, found.placed!.wrong)).toBe('too_many');
  });

  it('re-speaks the how-to-play when the action changes into a teen mode', () => {
    expect(actionFor('build_teen', 'K')).toBe('place-ones');
    expect(actionFor('decompose_teen', 'K')).toBe('find-ten');
    expect(actionFor('build_teen', 'K')).not.toBe(actionFor('build', 'K'));
    // decompose_teen's gesture is split's, but its RULE is not — the line is
    // fixed at ten — so a child arriving from `split` is told again.
    expect(actionFor('decompose_teen', 'K')).not.toBe(actionFor('split', 'K'));
    expect(moveOnCue(BUILD, BUILD_TEEN, { howToPlay: true }))
      .toContain('The top frame is already full');
    expect(moveOnCue(SPLIT_FIRST, DECOMPOSE_TEEN, { howToPlay: true }))
      .toContain('count them out as you go');
  });

  it('answers with hands at EVERY band — a teen number is a picture, not a word', () => {
    for (const band of ['K', '1-2'] as const) {
      for (const kind of ['build_teen', 'decompose_teen'] as const) {
        expect(answerKindFor(kind, band)).toBe('gesture');
        expect(responseClassFor(kind, band)).toBe('manipulation');
      }
    }
  });
});
