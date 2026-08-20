/**
 * compareObjectsScript — the pedagogy lives here, so this is where it is
 * pinned. Pure: no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (checkPackGates =
 *     validateJudgedScriptPack + performed-stage-directions + repeated-asks),
 *     on the fixture pack AND on the real session shape.
 *  2. THE FORK: identify-attribute, compare-two and non-standard SPEAK;
 *     order-three keeps its hands. Changing a row here is a contract change,
 *     not an edit.
 *  3. BUILD GATES — every one of them a CONTENT fault the spoken ask exposed:
 *     a key that disagrees with the drawn attribute, an attribute menu with
 *     both length and height, a comparison word that is not about the drawing,
 *     a picture that ranks the objects against its own key, names that cannot
 *     be told apart by ear, a board already sitting in the answer order, a
 *     unit count outside the benched window, and G1 modes at K. All DROPPED,
 *     none repaired.
 *  4. ANSWER-LEAK: the spoken ask never contains the answer OUTSIDE the menu
 *     clause it has to name, and position in the ask never predicts the answer.
 *  5. Corrections open "My turn:", model the STRATEGY (never the answer, on
 *     the hands mode) and re-elicit; affirmations open "Yes,".
 *  6. The hands item carries a SILENCE contract; its verdict is code-computed
 *     and names WHICH fault happened.
 *  7. The catalog keeps its side: audio mode, contextKeys, template keys,
 *     sentinel scan — and its steering names the microphone instead of tapping.
 *  8. Harness answer material mirrors the discrimination clauses it drills.
 */
import { describe, it, expect } from 'vitest';
import {
  actionFor,
  answerKindFor,
  askFor,
  askableAttributeOptions,
  buildCompareItems,
  compareObjectsHarnessAnswers,
  compareObjectsPackBase,
  comparisonMatchesAttribute,
  completeCue,
  isSayableName,
  isSayableUnitCount,
  itemCue,
  itemFromChallenge,
  leakExemptSpanFor,
  moveOnCue,
  namesEarSeparable,
  orderCueForPlaced,
  orderVerdictCue,
  pronounceCue,
  responseClassFor,
  stimulusFor,
  visualRankAgrees,
  type CompareObjectsChallengeLike,
  type CompareObjectsItem,
} from '../compareObjectsScript';
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

const CTX_K = { band: 'K' } as const;
const CTX_1 = { band: '1' } as const;

const PENCIL_CRAYON = [
  { name: 'pencil', visualSize: 70, actualValue: 19 },
  { name: 'crayon', visualSize: 40, actualValue: 9 },
];

const IA_CH: CompareObjectsChallengeLike = {
  id: 'c1',
  type: 'identify_attribute',
  attribute: 'length',
  correctAttribute: 'length',
  attributeOptions: ['length', 'weight', 'capacity'],
  objects: PENCIL_CRAYON,
};

/** "Which is longer?" — the winner has the LARGER measurement. */
const CT_CH: CompareObjectsChallengeLike = {
  id: 'c2',
  type: 'compare_two',
  attribute: 'length',
  comparisonWord: 'longer',
  correctAnswer: 'jump rope',
  objects: [
    { name: 'jump rope', visualSize: 75, actualValue: 200 },
    { name: 'shoelace', visualSize: 35, actualValue: 80 },
  ],
};

/** The other direction, on a verb-shaped comparison word: "which holds less?" */
const CT_LESS_CH: CompareObjectsChallengeLike = {
  id: 'c3',
  type: 'compare_two',
  attribute: 'capacity',
  comparisonWord: 'holds_less',
  correctAnswer: 'teacup',
  objects: [
    { name: 'teacup', visualSize: 30, actualValue: 8 },
    { name: 'bucket', visualSize: 80, actualValue: 40 },
  ],
};

const OT_CH: CompareObjectsChallengeLike = {
  id: 'c4',
  type: 'order_three',
  attribute: 'height',
  comparisonWord: 'taller',
  correctAnswer: 'sunflower, tulip, daisy',
  objects: [
    { name: 'tulip', visualSize: 50, actualValue: 60 },
    { name: 'sunflower', visualSize: 80, actualValue: 150 },
    { name: 'daisy', visualSize: 30, actualValue: 30 },
  ],
};

const NS_CH: CompareObjectsChallengeLike = {
  id: 'c5',
  type: 'non_standard',
  attribute: 'length',
  unitName: 'paper clip',
  unitCount: 5,
  objects: [{ name: 'pencil', visualSize: 50, actualValue: 5 }],
};

const IA = itemFromChallenge(IA_CH, CTX_K)!;
const CT = itemFromChallenge(CT_CH, CTX_K)!;
const CT_LESS = itemFromChallenge(CT_LESS_CH, CTX_K)!;
const OT = itemFromChallenge(OT_CH, CTX_1)!;
const NS = itemFromChallenge(NS_CH, CTX_1)!;

const ITEMS: CompareObjectsItem[] = [IA, CT, CT_LESS, OT, NS];

/** The pack's CUE SURFACE — the real one; the component and the DI drive-plan
 *  endpoint spread this same export, so this fixture tests the wire. */
const pack: JudgedScriptPack<CompareObjectsItem> = compareObjectsPackBase(ITEMS);

/**
 * ⚠️ THE REAL SESSION SHAPE (testkit warning): a one-item-per-mode pack is the
 * one shape `findRepeatedConsecutiveAsks` can never fire on, and every port's
 * fixture pack was exactly that. A real single-mode session runs same-action
 * items back to back — which is what makes "every ask names its objects" a
 * load-bearing design choice rather than a stylistic one.
 */
const SESSION_ITEMS = buildCompareItems([
  CT_CH,
  { ...CT_CH, id: 'r2', correctAnswer: 'ribbon', objects: [
    { name: 'ribbon', visualSize: 80, actualValue: 90 },
    { name: 'straw', visualSize: 30, actualValue: 20 },
  ] },
  { ...IA_CH, id: 'r3' },
  { ...IA_CH, id: 'r4', attribute: 'weight', correctAttribute: 'weight',
    attributeOptions: ['weight', 'capacity'],
    objects: [
      { name: 'brick', visualSize: 70, actualValue: 30 },
      { name: 'feather', visualSize: 20, actualValue: 1 },
    ] },
], CTX_K).items;

const sessionPack = compareObjectsPackBase(SESSION_ITEMS);

const catalogEntry = MATH_CATALOG.find((c) => c.id === 'compare-objects')!;

const cuesOf = (item: CompareObjectsItem) => ({
  opening: itemCue(item, { opening: true, howToPlay: true }),
  plain: itemCue(item),
});

// ============================================================================

describe('compare-objects · structural gates', () => {
  it('the pack passes every family gate', () => {
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('a REAL single-mode session passes them too (the repeat-ask gate awake)', () => {
    expect(SESSION_ITEMS.length).toBeGreaterThanOrEqual(4);
    expect(checkPackGates(sessionPack)).toEqual([]);
  });

  it('no cue the pack can emit opens a sentence with a verdict sentinel', () => {
    const cues = ITEMS.flatMap((item, i) => [
      { label: `ask:${item.id}`, text: itemCue(item, { opening: true, howToPlay: true }) },
      { label: `ask2:${item.id}`, text: itemCue(item) },
      { label: `move:${item.id}`, text: moveOnCue(item, ITEMS[i + 1] ?? null) },
      { label: `hear:${item.id}`, text: pronounceCue(item) },
    ]).concat(
      { label: 'complete', text: completeCue() },
      { label: 'order:right', text: orderVerdictCue(OT, OT.answerNames) },
      { label: 'order:reversed', text: orderVerdictCue(OT, [...OT.answerNames].reverse()) },
      { label: 'order:partial', text: orderVerdictCue(OT, [OT.answerNames[0]]) },
    );
    expect(findSentinelCollisions(cues)).toEqual([]);
  });
});

describe('compare-objects · THE ANSWER-MATERIAL FORK', () => {
  it.each([
    ['identify_attribute', 'voice', 'short_spoken_word'],
    ['compare_two', 'voice', 'short_spoken_word'],
    ['non_standard', 'voice', 'number_word_to_20'],
    ['order_three', 'gesture', 'manipulation'],
  ] as const)('%s answers with %s (%s)', (kind, answerKind, responseClass) => {
    expect(answerKindFor(kind)).toBe(answerKind);
    expect(responseClassFor(kind)).toBe(responseClass);
  });

  it('every response class the pack uses is BENCHED — no new class, no #63', () => {
    // The whole point of picking this primitive fourth: it needs no bench
    // sitting and never reaches the multi-word-numeral gate.
    expect(ITEMS.map((i) => i.responseClass).sort()).toEqual([
      'manipulation', 'number_word_to_20', 'short_spoken_word', 'short_spoken_word', 'short_spoken_word',
    ]);
    expect(NS.unitCount).toBeLessThanOrEqual(20);
    expect(NS.unitCount).toBeGreaterThanOrEqual(1);
  });

  it('each mode carries its own action, so the how-to-play re-speaks on a switch', () => {
    expect(new Set(ITEMS.map((i) => i.action)).size).toBe(4);
    expect(actionFor('order_three')).toBe('arrange');
  });

  it('a SPOKEN item is never told the answer arrives with hands', () => {
    for (const item of [IA, CT, NS]) {
      const { plain } = cuesOf(item);
      expect(plain).toContain('The correct answer is');
      expect(plain).toContain('If the answer is right, say exactly:');
      expect(plain).toContain('If it is wrong, say exactly:');
      expect(plain).not.toContain('with their HANDS');
    }
  });

  it('the HANDS item gets the silence contract and no spoken-verdict branches', () => {
    const { plain } = cuesOf(OT);
    expect(plain).toContain('with their HANDS');
    expect(plain).toContain('stay completely silent');
    expect(plain).not.toContain('If the answer is right');
    expect(plain).not.toContain('The correct answer is');
  });
});

describe('compare-objects · BUILD GATES (drop, never repair)', () => {
  it('drops a key that disagrees with the DRAWN attribute', () => {
    // The picture is built from `attribute`; the click era only ever checked
    // that the key was among the options.
    expect(itemFromChallenge(
      { ...IA_CH, correctAttribute: 'weight', attributeOptions: ['length', 'weight'] },
      CTX_K,
    )).toBeNull();
  });

  it('drops an attribute menu offering both length and height', () => {
    expect(askableAttributeOptions(['length', 'height', 'weight'], 'length')).toBeNull();
    expect(itemFromChallenge(
      { ...IA_CH, attributeOptions: ['length', 'height'] },
      CTX_K,
    )).toBeNull();
  });

  it('drops a menu with no distractor, or one made of invented words', () => {
    expect(askableAttributeOptions(['length'], 'length')).toBeNull();
    expect(askableAttributeOptions(['size', 'bigness'], 'length')).toBeNull();
    expect(askableAttributeOptions(['length', 'size', 'weight'], 'length')).toEqual(['length', 'weight']);
  });

  it('drops a comparison word that is not about the drawn attribute', () => {
    expect(comparisonMatchesAttribute('length', 'heavier')).toBe(false);
    expect(itemFromChallenge({ ...CT_CH, comparisonWord: 'heavier' }, CTX_K)).toBeNull();
  });

  it('drops a key that disagrees with the measurements', () => {
    expect(itemFromChallenge({ ...CT_CH, correctAnswer: 'shoelace' }, CTX_K)).toBeNull();
  });

  it('⭐ drops a DRAWING that ranks the objects against its own key', () => {
    // Under a Check button this was invisible; spoken, it refuses a child who
    // read the screen correctly.
    const contradicts = {
      ...CT_CH,
      objects: [
        { name: 'jump rope', visualSize: 20, actualValue: 200 },
        { name: 'shoelace', visualSize: 90, actualValue: 80 },
      ],
    };
    expect(visualRankAgrees(contradicts.objects)).toBe(false);
    expect(itemFromChallenge(contradicts, CTX_K)).toBeNull();
  });

  it('drops names that cannot be told apart by ear', () => {
    expect(namesEarSeparable(['block', 'small block'])).toBe(false);
    expect(namesEarSeparable(['pencil', 'crayon'])).toBe(true);
    expect(isSayableName('ox')).toBe(false);
    expect(isSayableName('obj_1')).toBe(false);
    expect(itemFromChallenge({
      ...CT_CH,
      correctAnswer: 'long block',
      objects: [
        { name: 'long block', visualSize: 75, actualValue: 200 },
        { name: 'block', visualSize: 35, actualValue: 80 },
      ],
    }, CTX_K)).toBeNull();
  });

  it('drops an ordering board already sitting in the answer order', () => {
    expect(itemFromChallenge({
      ...OT_CH,
      objects: [
        { name: 'sunflower', visualSize: 80, actualValue: 150 },
        { name: 'tulip', visualSize: 50, actualValue: 60 },
        { name: 'daisy', visualSize: 30, actualValue: 30 },
      ],
    }, CTX_1)).toBeNull();
  });

  it('drops an ordering key that is not the ranked order', () => {
    expect(itemFromChallenge({ ...OT_CH, correctAnswer: 'tulip, sunflower, daisy' }, CTX_1)).toBeNull();
  });

  it('drops a unit count outside the benched spoken window (zero included)', () => {
    expect(isSayableUnitCount(0)).toBe(false);
    expect(isSayableUnitCount(21)).toBe(false);
    expect(isSayableUnitCount(5)).toBe(true);
    expect(itemFromChallenge({ ...NS_CH, unitCount: 0 }, CTX_1)).toBeNull();
    expect(itemFromChallenge({ ...NS_CH, unitCount: 25 }, CTX_1)).toBeNull();
  });

  it('drops the Grade 1 modes at Kindergarten', () => {
    expect(itemFromChallenge(OT_CH, CTX_K)).toBeNull();
    expect(itemFromChallenge(NS_CH, CTX_K)).toBeNull();
    expect(itemFromChallenge(IA_CH, CTX_K)).not.toBeNull();
  });

  it('dedups SESSION-WIDE, and ignores the direction while doing it', () => {
    // Having heard "the jump rope is longer", the child gets "which is
    // shorter?" over the same pair for free.
    const reversed: CompareObjectsChallengeLike = {
      ...CT_CH, id: 'c2b', comparisonWord: 'shorter', correctAnswer: 'shoelace',
    };
    const { items, droppedChallenges } = buildCompareItems([CT_CH, reversed], CTX_K);
    expect(items).toHaveLength(1);
    expect(droppedChallenges).toBe(1);
  });
});

describe('compare-objects · ANSWER-LEAK', () => {
  it('the ask never says the answer outside the menu clause it must name', () => {
    for (const item of [IA, CT, CT_LESS]) {
      const span = spokenSpanOf(itemCue(item, { opening: true, howToPlay: true }));
      const exempt = leakExemptSpanFor(item)!;
      expect(span).toContain(exempt);
      const answer = item.kind === 'compare_two' ? item.answerNames[0] : 'long';
      // Outside the closed-set clause, the answer must be absent — a leak in
      // the greeting, the how-to-play or the hand-over is still a leak.
      expect(span.replace(exempt, ' ').toLowerCase()).not.toContain(answer.toLowerCase());
    }
  });

  it('the counting ask names no number at all', () => {
    const span = spokenSpanOf(itemCue(NS, { opening: true, howToPlay: true }));
    expect(span).not.toMatch(/\bfive\b|\b5\b/i);
    expect(span).toContain('How many paper clips long is the pencil?');
  });

  it('POSITION in the ask never predicts the answer', () => {
    // A generator listing the winner first every time would teach position the
    // moment the ask says both names aloud. The ORDER is hash-decided.
    const orders = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((id) => {
      const item = itemFromChallenge({ ...CT_CH, id }, CTX_K)!;
      return item.askOrder[0] === item.answerNames[0];
    });
    expect(new Set(orders).size).toBe(2);
  });

  it('the context channel is answer-free by construction', () => {
    // identify_attribute may name NO attribute — the attribute is the answer.
    expect(stimulusFor(IA)).not.toContain('length');
    expect(stimulusFor(NS)).not.toMatch(/\bfive\b|\b5\b/);
    expect(stimulusFor(CT)).not.toContain('jump rope');
    expect(stimulusFor(OT)).not.toContain('sunflower');
  });

  it('tap-to-hear re-speaks the QUESTION and nothing else', () => {
    expect(spokenSpanOf(pronounceCue(CT))).toBe(askFor(CT));
    expect(pronounceCue(CT)).toContain('never say the answer');
  });
});

describe('compare-objects · the DISTAR turn', () => {
  it('affirmations open "Yes," and the correction opens "My turn:"', () => {
    for (const item of [IA, CT, NS]) {
      const cue = itemCue(item);
      expect(cue).toMatch(/If the answer is right, say exactly: "Yes,/);
      expect(cue).toMatch(/If it is wrong, say exactly: "My turn:/);
    }
  });

  it('the correction re-models THEN re-elicits, and is the same line every time', () => {
    const cue = itemCue(CT);
    expect(cue).toContain('line them up at one end and look at the other end');
    expect(cue).toContain('Your turn. Which one is longer');
    expect(cue).toContain('the SAME line on every wrong answer');
  });

  it('the affirmation teaches the grown-up word as the REWARD', () => {
    expect(itemCue(IA)).toContain('Yes, how long they are. That is called length.');
  });

  it('the counting correction is where the count-along is EARNED', () => {
    // The unit boxes no longer print 1..n during the ask; the walk lives here.
    expect(itemCue(NS)).toContain('My turn: count them with me — one, two, three, four, five.');
  });

  it('the contract names the signature error per mode', () => {
    expect(itemCue(CT)).toContain('"shoelace" is the confident wrong answer here');
    expect(itemCue(NS)).toContain('"six" is the confident wrong answer here');
    expect(itemCue(IA)).toContain('may be true of these objects in real life');
  });

  it('the accept clause names the right answer that does not look right', () => {
    expect(itemCue(NS)).toContain('Counting out loud is the learner working, not answering');
    expect(itemCue(IA)).toContain('or the grown-up word "length" — both are right');
  });

  it('a pointing word gets a VERDICT, not a sentiment (18d on the accept side)', () => {
    // "ask once more for the name" would open with neither sentinel, so the
    // engine would see no verdict and a child who answered would stall.
    expect(itemCue(CT)).toContain('treat it as wrong and give the correction');
  });

  it('every spoken line is words — no numerals reach the tutor\'s tongue', () => {
    for (const item of ITEMS) {
      expect(spokenSpanOf(itemCue(item, { opening: true, howToPlay: true }))).not.toMatch(/\d/);
    }
  });

  it('grammar: adjective comparisons take a copula, verb ones do not', () => {
    expect(askFor(CT)).toContain('Which one is longer');
    expect(askFor(CT_LESS)).toContain('Which one holds less');
  });

  it('the how-to-play is spoken on the opener and never per item', () => {
    const { opening, plain } = cuesOf(CT);
    expect(opening).toContain('Look at both things, then say the name');
    expect(plain).not.toContain('Look at both things, then say the name');
  });
});

describe('compare-objects · the hands turn', () => {
  it('the ordering verdict is code-computed and names WHICH fault happened', () => {
    expect(orderVerdictCue(OT, OT.answerNames)).toContain('that MATCHES');
    expect(orderVerdictCue(OT, [...OT.answerNames].reverse())).toContain('does NOT match');
    expect(orderVerdictCue(OT, [OT.answerNames[0]])).toContain('touch all 3 in order');
    expect(orderVerdictCue(OT, [...OT.answerNames].reverse()))
      .toContain('find the tallest one first');
  });

  it('the ordering correction models the STRATEGY, never the order', () => {
    const wrong = orderVerdictCue(OT, [...OT.answerNames].reverse());
    const spoken = spokenSpanOf(wrong);
    for (const name of OT.answerNames) expect(spoken).not.toContain(name);
  });

  it('the harness encoding round-trips through the adapter shape', () => {
    expect(orderCueForPlaced(OT, 1)).toContain('that MATCHES');
    expect(orderCueForPlaced(OT, 0)).toContain('does NOT match');
  });
});

describe('compare-objects · catalog', () => {
  it('the catalog keeps its side of the contract', () => {
    expect(checkDiCatalogEntry(catalogEntry, pack, CT)).toEqual([]);
  });

  it('steering names the microphone and no longer points at buttons', () => {
    const steering = `${catalogEntry.description} ${catalogEntry.constraints}`;
    expect(steering).toContain('microphone');
    expect(steering).toContain('DI modality');
    expect(steering).not.toMatch(/Point to it|tap the|attribute chips are shown/i);
  });

  it('no scaffolding rung offers a speakable replacement line (18d)', () => {
    // A quoted hint here is what the model reaches for at the moment 18c makes
    // it balk at repeating the correction — and it carries no sentinel, so the
    // engine sees no verdict and the counter stalls.
    for (const rung of Object.values(catalogEntry.tutoring?.scaffoldingLevels ?? {})) {
      expect(rung).toMatch(/scripted|script/i);
      expect(rung).not.toMatch(/^\s*"/);
    }
  });

  it('the verdict-ends-the-turn clause is present (VERDICT_ENDS_THE_TURN)', () => {
    const titles = (catalogEntry.tutoring?.aiDirectives ?? []).map((d) => d.title);
    expect(titles).toContain('THE VERDICT ENDS THE TURN');
  });

  it('every eval mode kept its identity and its beta', () => {
    const modes = (catalogEntry.evalModes ?? []).map((m) => [m.evalMode, m.beta]);
    expect(modes).toEqual([
      ['identify_attribute', 1.0],
      ['compare_two', 1.5],
      ['order_three', 2.5],
      ['non_standard', 3.5],
    ]);
  });
});

describe('compare-objects · harness answer material', () => {
  it('mirrors the discrimination claims the contract makes', () => {
    const ct = compareObjectsHarnessAnswers(CT);
    expect(ct.correct).toBe('jump rope');
    expect(ct.signatureWrong?.text).toBe('shoelace');
    expect(ct.signatureWrong?.why).toContain('direction reversal');
    expect(itemCue(CT)).toContain(`"${ct.signatureWrong!.text}" is the confident wrong answer`);

    const ns = compareObjectsHarnessAnswers(NS);
    expect(ns.correct).toBe('five');
    expect(ns.signatureWrong?.text).toBe('six');
    expect(itemCue(NS)).toContain('"six" is the confident wrong answer');
  });

  it('the closed-set modes declare their exempt span; the count mode does not', () => {
    expect(compareObjectsHarnessAnswers(CT).leakExemptSpan).toBe(leakExemptSpanFor(CT));
    expect(compareObjectsHarnessAnswers(IA).leakExemptSpan).toBe(leakExemptSpanFor(IA));
    expect(compareObjectsHarnessAnswers(NS).leakExemptSpan).toBeUndefined();
  });

  it('the hands item commits an order, not a word', () => {
    const ot = compareObjectsHarnessAnswers(OT);
    expect(ot.placed).toEqual({ correct: 1, wrong: 0 });
    expect(ot.leakTokens).toEqual([]);
  });
});
