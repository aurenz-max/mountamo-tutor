/**
 * ShapeSorter.di-script — the pedagogy pins for the fifth math DI port.
 *
 * The GATE PLUMBING is one import (`checkPackGates` + `checkDiCatalogEntry`);
 * what is hand-written here is the part a shared helper cannot know: the
 * answer-material fork in both directions, the three content gates the spoken
 * ask exposed, the leak asserts, and the correction/affirm wording.
 *
 * ⚠️ TWO PACKS ARE BUILT, and the second is the point. `findRepeatedConsecutiveAsks`
 * only compares consecutive items of the SAME action, so the natural fixture —
 * one item per mode, to cover the fork — is the one shape that can never trigger
 * it. `sessionShapePack` runs several items of one mode back to back, which is
 * what a real run looks like.
 */

import { describe, expect, it } from 'vitest';
import {
  checkDiCatalogEntry,
  checkPackGates,
  type DiCatalogEntryLike,
} from '../../../../hooks/judgedScriptContract.testkit';
import {
  RESPONSE_CLASSES,
  spokenSpanOf,
  spokenSpansOf,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import { MATH_CATALOG } from '../../../../service/manifest/catalog/math';
import {
  DIAMOND_WINDOW_DEG,
  MAX_ITEMS_PER_SESSION,
  MAX_SORT_GROUPS,
  SHAPE_ALTERNATES,
  affirmFor,
  answerKindFor,
  askFor,
  binLabelFor,
  correctionFor,
  isCountable,
  isNameable,
  isSortable,
  itemsFromChallenge,
  itemsFromChallenges,
  leakExemptSpanFor,
  optionsEarSeparable,
  normalizeSortRule,
  readsAsDiamond,
  responseClassFor,
  shapeSorterHarnessAnswers,
  shapeSorterPackBase,
  stimulusFor,
  type ShapeSorterChallengeLike,
  type ShapeSorterItem,
} from '../shapeSorterScript';

// ── Fixtures ────────────────────────────────────────────────────────────────

const shape = (s: string, color = 'blue', rotation = 0) => ({
  shape: s, color, size: 'medium', rotation,
});

const identifyChallenge: ShapeSorterChallengeLike = {
  id: 'i1',
  type: 'identify',
  ruleAttribute: 'shape',
  targetValue: 'triangle',
  shapes: [shape('triangle'), shape('circle', 'red'), shape('hexagon', 'green')],
};

/**
 * NOTE THE SHAPE: a PENTAGON, not one of the kinds `identifyChallenge` names.
 * The first draft of this fixture counted a hexagon and the build correctly
 * returned nothing — §4d had already spent that kind when the identify pool
 * named it, and hearing "hexagon" hands the count over. The fixture was wrong,
 * not the gate.
 */
const countChallenge: ShapeSorterChallengeLike = {
  id: 'c1',
  type: 'count',
  ruleAttribute: 'shape',
  targetValue: 'pentagon',
  shapes: [shape('pentagon', 'green')],
};

const sortChallenge: ShapeSorterChallengeLike = {
  id: 's1',
  type: 'sort',
  ruleAttribute: 'curved',
  shapes: [shape('circle', 'red'), shape('square'), shape('oval', 'pink'), shape('triangle', 'green')],
};

const packOf = (items: ShapeSorterItem[]): JudgedScriptPack<ShapeSorterItem> => ({
  ...shapeSorterPackBase(items),
});

/** One item per mode — covers the fork, and cannot trip the repeat-ask gate. */
const forkItems = itemsFromChallenges([identifyChallenge, countChallenge, sortChallenge]);
const forkPack = packOf(forkItems);

/** THE REAL SESSION SHAPE: several items of one action, back to back. */
const sessionShapeItems = itemsFromChallenges([
  {
    id: 'ss1',
    type: 'sort',
    ruleAttribute: 'sides',
    shapes: [shape('triangle'), shape('square', 'red'), shape('triangle', 'green'), shape('rectangle', 'pink')],
  },
]);
const sessionShapePack = packOf(sessionShapeItems);

const identifySessionItems = itemsFromChallenges([
  {
    id: 'is1',
    type: 'identify',
    ruleAttribute: 'shape',
    shapes: [shape('triangle'), shape('square', 'red'), shape('hexagon', 'green'), shape('circle', 'pink')],
  },
]);
const identifySessionPack = packOf(identifySessionItems);

const catalogEntry = MATH_CATALOG.find((p) => p.id === 'shape-sorter') as DiCatalogEntryLike;

const itemOfMode = (items: ShapeSorterItem[], mode: string) =>
  items.find((i) => i.mode === mode)!;

// ── The shared gates ────────────────────────────────────────────────────────

describe('pack gates', () => {
  it('the fork pack passes every structural gate', () => {
    expect(checkPackGates(forkPack)).toEqual([]);
  });

  it('the REAL SESSION SHAPE passes — several sort items back to back', () => {
    expect(sessionShapeItems.length).toBeGreaterThan(2);
    expect(checkPackGates(sessionShapePack)).toEqual([]);
  });

  it('the real session shape passes for identify too', () => {
    expect(identifySessionItems.length).toBeGreaterThan(2);
    expect(checkPackGates(identifySessionPack)).toEqual([]);
  });

  it('the catalog entry matches what the pack pushes', () => {
    expect(checkDiCatalogEntry(catalogEntry, forkPack, forkItems[0])).toEqual([]);
  });
});

// ── The answer-material fork, both directions ───────────────────────────────

describe('the answer-material fork', () => {
  it('EVERY mode is spoken — this pack has no gesture item', () => {
    expect(answerKindFor('identify')).toBe('voice');
    expect(answerKindFor('count')).toBe('voice');
    expect(answerKindFor('sort')).toBe('voice');
    expect(forkItems.every((i) => i.answerKind === 'voice')).toBe(true);
  });

  it('each mode carries its benched response class', () => {
    expect(responseClassFor('identify')).toBe('shape_name');
    expect(responseClassFor('count')).toBe('number_word_to_20');
    expect(responseClassFor('sort')).toBe('short_spoken_word');
  });

  it('no item ships a blocked class', () => {
    for (const item of forkItems) {
      expect(RESPONSE_CLASSES[item.responseClass].status).not.toBe('blocked');
    }
  });

  it('every item is told how a SPOKEN answer is judged, and none is told to ignore the microphone', () => {
    for (const item of forkItems) {
      const cue = forkPack.itemCue(item, { opening: false, howToPlay: false });
      expect(cue).toContain('If the answer is right, say exactly:');
      expect(cue).toContain('If it is wrong, say exactly:');
      expect(cue).not.toMatch(/ignore (anything|what) you hear/i);
    }
  });

  it('nothing on this surface is tappable — no cue ever asks the child to touch the screen', () => {
    for (const item of forkItems) {
      const cues = [
        forkPack.itemCue(item, { opening: true, howToPlay: true }),
        forkPack.moveOnCue(item, null, { opening: false, howToPlay: false }),
        forkPack.pronounceCue!(item),
      ];
      for (const cue of cues) {
        for (const span of spokenSpansOf(cue)) {
          expect(span).not.toMatch(/\b(tap|click|drag|press|point to it|touch)\b/i);
        }
      }
    }
  });
});

// ── The three content gates the spoken ask exposed ──────────────────────────

describe('content gate: a counting ask needs a POLYGON', () => {
  it('a circle and an oval have no defensible side count', () => {
    expect(isCountable('circle')).toBe(false);
    expect(isCountable('oval')).toBe(false);
    expect(isCountable('hexagon')).toBe(true);
  });

  it('a curved-shape count challenge DROPS rather than asking "how many sides does a circle have?"', () => {
    const dropped = itemsFromChallenge({
      id: 'x', type: 'count', ruleAttribute: 'shape', targetValue: 'circle',
      shapes: [shape('circle', 'red')],
    });
    expect(dropped).toEqual([]);
  });

  it('every count answer lands inside the benched 1..20 window', () => {
    for (const item of forkItems.filter((i) => i.mode === 'count')) {
      expect(item.countNumeral).toBeGreaterThanOrEqual(1);
      expect(item.countNumeral).toBeLessThanOrEqual(20);
    }
  });
});

describe('content gate: a sides sort cannot hold a curved shape', () => {
  it('isSortable refuses a circle under a sides rule and allows it under curved', () => {
    expect(isSortable('circle', 'sides')).toBe(false);
    expect(isSortable('circle', 'curved')).toBe(true);
    expect(isSortable('square', 'sides')).toBe(true);
  });

  it('a sides sort never mints a "0 sides" group', () => {
    const items = itemsFromChallenge({
      id: 'x', type: 'sort', ruleAttribute: 'sides',
      shapes: [shape('circle', 'red'), shape('triangle'), shape('square', 'green'), shape('triangle', 'pink')],
    });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.choices).not.toContain('0 sides');
      expect(item.shape).not.toBe('circle');
    }
  });

  it('sorting BY SHAPE is refused — the groups would just be the shape names', () => {
    expect(normalizeSortRule('shape')).toBeNull();
    expect(itemsFromChallenge({
      id: 'x', type: 'sort', ruleAttribute: 'shape',
      shapes: [shape('triangle'), shape('square', 'red')],
    })).toEqual([]);
  });

  it('a sort with more than the ceiling of groups drops rather than being narrowed', () => {
    const items = itemsFromChallenge({
      id: 'x', type: 'sort', ruleAttribute: 'sides',
      shapes: [shape('triangle'), shape('square', 'red'), shape('pentagon', 'green'), shape('hexagon', 'pink')],
    });
    expect(MAX_SORT_GROUPS).toBe(3);
    expect(items).toEqual([]);
  });
});

describe('content gate: diamond and rhombus are the SAME drawing', () => {
  it('each accepts the other name, so one drawing never has two verdicts', () => {
    expect(SHAPE_ALTERNATES.diamond).toContain('rhombus');
    expect(SHAPE_ALTERNATES.rhombus).toContain('diamond');
  });

  it('the accept clause reaches the cue', () => {
    const [item] = itemsFromChallenge({
      id: 'x', type: 'identify', ruleAttribute: 'shape',
      shapes: [shape('rhombus', 'purple')],
    });
    expect(item.spokenAlternates).toContain('diamond');
    expect(forkPack.itemCue(item, { opening: false, howToPlay: false })).toContain('"diamond"');
  });

  /**
   * ⭐ FOUND BY THE LIVE PROBE, 2026-08-18 — an `identify @ Grade 1 / hard` draw
   * returned a pool holding BOTH names for the one drawing, and the §4d ledger,
   * keyed on the raw shape kind, kept them as two items. The child would have
   * seen the identical figure twice and been right both times for saying the
   * same word. Every per-item gate passed; the defect only exists BETWEEN items.
   */
  it('a pool holding BOTH names for the one drawing asks about it ONCE', () => {
    const items = itemsFromChallenge({
      id: 'x', type: 'identify', ruleAttribute: 'shape',
      shapes: [shape('diamond', 'purple'), shape('rhombus', 'red'), shape('hexagon', 'green')],
    });
    expect(items.map((i) => i.shape)).toEqual(['diamond', 'hexagon']);
  });

  it('and the ledger carries across challenges too', () => {
    const items = itemsFromChallenges([
      { id: 'a', type: 'identify', ruleAttribute: 'shape', shapes: [shape('rhombus', 'red')] },
      { id: 'b', type: 'identify', ruleAttribute: 'shape', shapes: [shape('diamond', 'purple'), shape('circle', 'green')] },
    ]);
    expect(items.map((i) => i.shape)).toEqual(['rhombus', 'circle']);
  });

  it('square and rectangle stay STRICTLY distinct — the near-name is the error to catch', () => {
    expect(SHAPE_ALTERNATES.square ?? []).not.toContain('rectangle');
    expect(SHAPE_ALTERNATES.rectangle ?? []).not.toContain('square');
    expect(SHAPE_ALTERNATES.circle ?? []).not.toContain('oval');
  });
});

describe('content gate: a square rotated toward 45 degrees IS a diamond', () => {
  it('the window catches the ambiguous rotations and only those', () => {
    expect(readsAsDiamond('square', 45)).toBe(true);
    expect(readsAsDiamond('square', 135)).toBe(true);
    expect(readsAsDiamond('square', 0)).toBe(false);
    expect(readsAsDiamond('square', 90)).toBe(false);
    expect(readsAsDiamond('square', 45 - DIAMOND_WINDOW_DEG - 1)).toBe(false);
  });

  it('it binds NAMING only — a turned square still has four sides', () => {
    expect(isNameable('square', 45)).toBe(false);
    expect(isNameable('triangle', 45)).toBe(true);
    expect(isCountable('square')).toBe(true);
    expect(isSortable('square', 'sides')).toBe(true);

    const counted = itemsFromChallenge({
      id: 'x', type: 'count', ruleAttribute: 'shape', targetValue: 'square',
      shapes: [shape('square', 'red', 45)],
    });
    expect(counted).toHaveLength(1);
    expect(counted[0].answer).toBe('four');
  });

  it('a naming pool drops the ambiguous square and keeps the rest', () => {
    const items = itemsFromChallenge({
      id: 'x', type: 'identify', ruleAttribute: 'shape',
      shapes: [shape('square', 'red', 45), shape('hexagon', 'green', 45)],
    });
    expect(items.map((i) => i.shape)).toEqual(['hexagon']);
  });
});

// ── §4d — an answer said aloud is not asked again ──────────────────────────

describe('one challenge is not one item, and an answer is said once', () => {
  it('an identify pool becomes one ask per DISTINCT kind', () => {
    const items = itemsFromChallenge({
      id: 'x', type: 'identify', ruleAttribute: 'shape',
      shapes: [shape('triangle'), shape('triangle', 'red'), shape('triangle', 'green'), shape('circle', 'pink')],
    });
    expect(items.map((i) => i.shape)).toEqual(['triangle', 'circle']);
  });

  it('a kind NAMED in one challenge is not named again in a later one', () => {
    const items = itemsFromChallenges([
      { id: 'a', type: 'identify', ruleAttribute: 'shape', shapes: [shape('triangle'), shape('circle', 'red')] },
      { id: 'b', type: 'identify', ruleAttribute: 'shape', shapes: [shape('triangle', 'green'), shape('hexagon', 'pink')] },
    ]);
    expect(items.map((i) => i.shape)).toEqual(['triangle', 'circle', 'hexagon']);
  });

  it('a kind whose NAME was spoken cannot then carry a count — the name hands it over', () => {
    const items = itemsFromChallenges([
      { id: 'a', type: 'identify', ruleAttribute: 'shape', shapes: [shape('hexagon')] },
      { id: 'b', type: 'count', ruleAttribute: 'shape', targetValue: 'hexagon', shapes: [shape('hexagon', 'red')] },
    ]);
    expect(items.map((i) => i.mode)).toEqual(['identify']);
  });

  it('but a COUNTED kind may still be NAMED later — a count never says the name', () => {
    const items = itemsFromChallenges([
      { id: 'a', type: 'count', ruleAttribute: 'shape', targetValue: 'hexagon', shapes: [shape('hexagon')] },
      { id: 'b', type: 'identify', ruleAttribute: 'shape', shapes: [shape('hexagon', 'red')] },
    ]);
    expect(items.map((i) => i.mode)).toEqual(['count', 'identify']);
  });

  it('a sort deliberately does NOT dedupe — repeated membership is the practice', () => {
    const shapes = sessionShapeItems.map((i) => i.shape);
    expect(shapes.length).toBeGreaterThan(new Set(shapes).size);
  });

  it('consecutive sort items come from different groups where the material allows', () => {
    const answers = sessionShapeItems.map((i) => i.answer);
    for (let i = 1; i < answers.length; i++) {
      if (answers[i] === answers[i - 1]) {
        // Allowed only once the smaller group is exhausted.
        expect(answers.slice(0, i).filter((a) => a !== answers[i]).length).toBeGreaterThan(0);
      }
    }
  });

  it('sides and corners alternate across a session — the second is never free', () => {
    const items = itemsFromChallenges([
      { id: 'a', type: 'count', ruleAttribute: 'shape', targetValue: 'triangle', shapes: [shape('triangle')] },
      { id: 'b', type: 'count', ruleAttribute: 'shape', targetValue: 'square', shapes: [shape('square', 'red')] },
    ]);
    expect(items.map((i) => i.countNoun)).toEqual(['sides', 'corners']);
  });

  it('the session length cap is a bound, not a gate', () => {
    const many = Array.from({ length: 8 }, (_, n) => ({
      id: `s${n}`,
      type: 'sort' as const,
      ruleAttribute: 'curved',
      shapes: [shape('circle', 'red'), shape('square'), shape('oval', 'pink'), shape('triangle', 'green')],
    }));
    expect(itemsFromChallenges(many).length).toBe(MAX_ITEMS_PER_SESSION);
  });
});

// ── Leak asserts ───────────────────────────────────────────────────────────

describe('the ask never contains its answer', () => {
  it('identify and count asks are answer-free, with no exemption at all', () => {
    for (const item of forkItems.filter((i) => i.mode !== 'sort')) {
      const spoken = spokenSpanOf(forkPack.itemCue(item, { opening: true, howToPlay: true }));
      expect(spoken.toLowerCase()).not.toContain(item.answer.toLowerCase());
      expect(leakExemptSpanFor(item)).toBeUndefined();
    }
  });

  it('a COUNT ask never names the shape — the name hands the count over', () => {
    const item = itemOfMode(forkItems, 'count');
    const spoken = spokenSpanOf(forkPack.itemCue(item, { opening: true, howToPlay: true }));
    expect(spoken.toLowerCase()).not.toContain(item.shape);
    expect(spoken.toLowerCase()).not.toContain(String(item.countNumeral));
  });

  it('an IDENTIFY ask never names the shape either — it is the answer', () => {
    const item = itemOfMode(forkItems, 'identify');
    expect(askFor(item).toLowerCase()).not.toContain(item.shape);
  });

  it('a SORT ask contains its answer only inside the spoken menu, which is the exempt span', () => {
    const item = itemOfMode(forkItems, 'sort');
    const exempt = leakExemptSpanFor(item)!;
    expect(exempt).toBeTruthy();
    const askWithoutMenu = askFor(item).replace(exempt, '');
    expect(askWithoutMenu.toLowerCase()).not.toContain(item.answer.toLowerCase());
  });

  it('at hard for a READER the sort ask names nothing, so the oracle goes flat', () => {
    const [item] = itemsFromChallenge(
      { ...sortChallenge, supportTier: 'hard' },
      { tier: 'hard', isPreReader: false },
    );
    expect(item.namesChoices).toBe(false);
    expect(leakExemptSpanFor(item)).toBeUndefined();
    expect(askFor(item).toLowerCase()).not.toContain(item.answer.toLowerCase());
  });

  it('the K band floor beats the tier — a pre-reader always hears the groups', () => {
    const [item] = itemsFromChallenge(
      { ...sortChallenge, supportTier: 'hard' },
      { tier: 'hard', isPreReader: true },
    );
    expect(item.namesChoices).toBe(true);
  });

  it('the context channel is stimulus-side only and never names the shape', () => {
    for (const item of forkItems) {
      const stimulus = stimulusFor(item).toLowerCase();
      expect(stimulus).not.toContain(item.shape);
      expect(stimulus).not.toContain(item.answer.toLowerCase());
    }
  });

  it('tap-to-hear re-speaks the QUESTION and never the answer', () => {
    for (const item of forkItems) {
      const spoken = spokenSpanOf(forkPack.pronounceCue!(item));
      const exempt = leakExemptSpanFor(item);
      const scanned = exempt ? spoken.replace(exempt, '') : spoken;
      expect(scanned.toLowerCase()).not.toContain(item.answer.toLowerCase());
    }
  });
});

// ── Correction / affirm wording (standing gate 3) ──────────────────────────

describe('verdict wording', () => {
  it('affirmations open "Yes," and corrections open "My turn:"', () => {
    for (const item of forkItems) {
      expect(affirmFor(item).startsWith('Yes,')).toBe(true);
      expect(correctionFor(item).startsWith('My turn:')).toBe(true);
    }
  });

  it('every correction re-models the answer AND re-elicits', () => {
    for (const item of forkItems) {
      const correction = correctionFor(item);
      expect(correction.toLowerCase()).toContain(item.answer.toLowerCase());
      expect(correction).toContain(askFor(item));
    }
  });

  it('the sort correction names the SHAPE — the fact that makes the group learnable', () => {
    const item = itemOfMode(forkItems, 'sort');
    expect(correctionFor(item)).toContain(item.shape);
    expect(affirmFor(item)).toContain(item.shape);
  });

  it('the count affirmation states the count with its noun, and never the shape', () => {
    const item = itemOfMode(forkItems, 'count');
    expect(affirmFor(item)).toBe(`Yes, this shape has ${item.answer} ${item.countNoun}.`);
    expect(affirmFor(item).toLowerCase()).not.toContain(item.shape);
  });

  it('the move-on cue names no answer — the correction already told them twice', () => {
    for (const item of forkItems) {
      const spoken = spokenSpanOf(forkPack.moveOnCue(item, null, { opening: false, howToPlay: false }));
      expect(spoken.toLowerCase()).not.toContain(item.answer.toLowerCase());
    }
  });

  it('the two-branch law and the verdict-ends-the-turn clause ride every ask', () => {
    for (const item of forkItems) {
      const cue = forkPack.itemCue(item, { opening: false, howToPlay: false });
      expect(cue).toContain('A reply that is neither the affirmation nor the correction');
      expect(cue).toContain('Your verdict line is the END of your turn');
    }
  });
});

// ── The DISTAR lead-in is established once, not recited ────────────────────

describe('the lead-in belongs to the INTRODUCTION of an action', () => {
  it('the strategy model is spoken on the opening and withheld on a plain repeat', () => {
    const item = itemOfMode(forkItems, 'identify');
    const opening = spokenSpanOf(forkPack.itemCue(item, { opening: true, howToPlay: true }));
    const repeat = spokenSpanOf(forkPack.itemCue(item, { opening: false, howToPlay: false }));
    expect(opening).toContain('Look at the whole shape before you name it.');
    expect(repeat).not.toContain('Look at the whole shape before you name it.');
    expect(repeat).toBe(askFor(item));
  });

  it('no rung of the tier ladder ever speaks the answer before the child does', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const items = itemsFromChallenge({ ...identifyChallenge, supportTier: tier }, { tier });
      for (const item of items) {
        const spoken = spokenSpanOf(forkPack.itemCue(item, { opening: true, howToPlay: true }));
        expect(spoken.toLowerCase()).not.toContain(item.answer.toLowerCase());
      }
    }
  });
});

// ── Harness answer material mirrors the contract's claims ──────────────────

describe('harness answers', () => {
  it('the identify signature wrong is the NEAR NAME, and the contract refuses it', () => {
    const item = itemOfMode(forkItems, 'identify');
    const answers = shapeSorterHarnessAnswers(item);
    expect(answers.correct).toBe(item.answer);
    expect(answers.signatureWrong!.text).not.toBe(item.answer);
    expect(forkPack.itemCue(item, { opening: false, howToPlay: false })).toContain('Any DIFFERENT shape name is wrong');
  });

  it('the count signature wrong is the OFF-BY-ONE, and the contract names it', () => {
    const item = itemOfMode(forkItems, 'count');
    const answers = shapeSorterHarnessAnswers(item);
    expect(answers.signatureWrong!.text).not.toBe(item.answer);
    expect(forkPack.itemCue(item, { opening: false, howToPlay: false })).toContain('including one more or one less than');
  });

  it('the sort signature wrong is the SHAPE NAME said instead of the group', () => {
    const item = itemOfMode(forkItems, 'sort');
    const answers = shapeSorterHarnessAnswers(item);
    expect(answers.signatureWrong!.text).toBe(item.shape);
    expect(forkPack.itemCue(item, { opening: false, howToPlay: false })).toContain('Naming the SHAPE is not naming the group');
  });

  it('every plain wrong is genuinely wrong', () => {
    for (const item of forkItems) {
      const answers = shapeSorterHarnessAnswers(item);
      expect(answers.plainWrong.toLowerCase()).not.toBe(item.answer.toLowerCase());
      expect(item.spokenAlternates).not.toContain(answers.plainWrong);
    }
  });
});

// ── Revert-bites: the gates that matter fail when removed ──────────────────

describe('revert-bites', () => {
  it('ear-separability refuses a group set an utterance could fit twice', () => {
    expect(optionsEarSeparable(['3 sides', '4 sides'])).toBe(true);
    expect(optionsEarSeparable(['Curved', 'Straight'])).toBe(true);
    expect(optionsEarSeparable(['Sides', 'Sides and corners'])).toBe(false);
  });

  it('binLabelFor is the ONE label builder — a mat and a spoken answer cannot disagree', () => {
    const item = itemOfMode(forkItems, 'sort');
    expect(item.answer).toBe(binLabelFor(item.shape, 'red', item.rule!));
    expect(item.choices).toContain(item.answer);
  });

  it('a sort whose kept shapes reach only one group is refused', () => {
    expect(itemsFromChallenge({
      id: 'x', type: 'sort', ruleAttribute: 'curved',
      shapes: [shape('square'), shape('triangle', 'red')],
    })).toEqual([]);
  });
});

// ── Catalog steering regressions ───────────────────────────────────────────

describe('catalog steering', () => {
  it('the description and constraints route the primitive to a SPOKEN surface', () => {
    expect(catalogEntry.description).toMatch(/LIVE-JUDGED SPOKEN/);
    expect(catalogEntry.description).toMatch(/REQUIRES A MICROPHONE/);
    expect(catalogEntry.constraints).toMatch(/REQUIRES A MICROPHONE/);
  });

  /**
   * The assertion is about prose that ROUTES the primitive to a tap surface,
   * not about the words themselves — this block says "there is no tap, drag,
   * stepper or button path", which is the opposite of the defect and has to
   * survive. A bare word-ban would refuse the very sentence that fixes it.
   */
  it('no click-era routing prose survives to route it wrong forever', () => {
    const prose = `${catalogEntry.description} ${catalogEntry.constraints}`;
    expect(prose).not.toMatch(/tap each|tap the|drag the|find (all|shapes) /i);
    expect(prose).not.toMatch(/find shapes matching a rule|count sides and corners/i);
    // …and it must say so positively, or a manifest reading it learns nothing.
    expect(prose).toMatch(/there is no tap, drag, stepper or button path/i);
  });

  it('the constraints carry all three content gates', () => {
    expect(catalogEntry.constraints).toMatch(/POLYGONS ONLY/);
    expect(catalogEntry.constraints).toMatch(/45 degrees/);
    expect(catalogEntry.constraints).toMatch(/diamond and rhombus are the same drawing/);
  });
});
