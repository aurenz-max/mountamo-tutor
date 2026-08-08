/**
 * L3 support tiers for di-shapes. The whole ladder is instruction-as-scaffold
 * (modality #2): a tier withdraws DISTAR sub-steps from the SPOKEN cue and
 * changes nothing else. These tests pin both halves of that claim — what
 * withdraws, and what must NOT.
 *
 * The pack-specific assertions the three sibling suites don't have:
 *  - TWO answer classes on one stage (a shape NAME, a side/corner COUNT), so
 *    `hard` has to withhold a different token per mode;
 *  - the counting inversion — under a counting mode the shape's NAME is also an
 *    answer leak (triangle → three), so a cold count must withhold BOTH;
 *  - this pack ships the CONTRASTIVE correction as well as the plain one, so
 *    standing gate 3 has two lines to hold, not one.
 */

import { describe, expect, it } from 'vitest';
import { DI_SENTINELS, scanForSentinel } from '../../../hooks/judgedLoopModel';
import {
  contrastCorrectionLine,
  correctionLine,
  itemCue,
  moveOnCue,
  testLine,
  verifyLine,
  type DiShapesChallenge,
  type DiShapesSupportTier,
} from './diShapesScript';

const TIERS: DiShapesSupportTier[] = ['easy', 'medium', 'hard'];

/** A naming item: the answer token is "triangle". It appears nowhere in the
 *  test line, so a `toContain('triangle')` hit inside a hard spoken block can
 *  only come from a leaked model/guide. */
const naming = (
  supportTier?: DiShapesSupportTier,
  over: Partial<DiShapesChallenge> = {},
): DiShapesChallenge => ({
  id: 'dish-1-triangle',
  challengeType: 'name_shape',
  shape: 'triangle',
  shapeWord: 'triangle',
  article: 'a',
  sides: 3,
  corners: 3,
  rotationDeg: 12,
  asrAliases: ['triangle'],
  ...(supportTier ? { supportTier } : {}),
  ...over,
});

/** Review is the same NAMING act over a wider draw — same lines, own identity. */
const review = (supportTier?: DiShapesSupportTier): DiShapesChallenge =>
  naming(supportTier, {
    id: 'dish-2-square', challengeType: 'shape_review',
    shape: 'square', shapeWord: 'square', sides: 4, corners: 4,
  });

/** A sides item: the answer token is "three" and the NAME is a hint for it. */
const sides = (supportTier?: DiShapesSupportTier): DiShapesChallenge =>
  naming(supportTier, {
    id: 'dish-3-triangle', challengeType: 'count_sides',
    countNumeral: 3, countWord: 'three', asrAliases: ['three', '3'],
  });

/** A corners item on a hexagon: answer "six". */
const corners = (supportTier?: DiShapesSupportTier): DiShapesChallenge =>
  naming(supportTier, {
    id: 'dish-4-hexagon', challengeType: 'count_corners',
    shape: 'hexagon', shapeWord: 'hexagon', sides: 6, corners: 6, rotationDeg: -8,
    countNumeral: 6, countWord: 'six', asrAliases: ['six', '6'],
  });

/** A rhombus naming item — carries the judged "diamond" alternate. */
const rhombus = (supportTier?: DiShapesSupportTier): DiShapesChallenge =>
  naming(supportTier, {
    id: 'dish-5-rhombus', challengeType: 'name_shape',
    shape: 'rhombus', shapeWord: 'rhombus', sides: 4, corners: 4, rotationDeg: 0,
    spokenAlternates: ['diamond'],
  });

const ALL_MAKERS = [naming, review, sides, corners, rhombus];

/** The block the tutor is told to "Speak exactly" — everything it may say. */
const spokenBlock = (cue: string): string => {
  const m = cue.match(/Speak exactly:\n"([\s\S]*?)"/);
  if (!m) throw new Error(`no spoken block in cue:\n${cue}`);
  return m[1];
};

describe('di-shapes support tiers — the DISTAR ladder', () => {
  it('easy hands over the FULL sequence: model + guide + test', () => {
    const spoken = spokenBlock(itemCue(naming('easy')));
    expect(spoken).toContain('Listen: this shape is a triangle.');
    expect(spoken).toContain('Together: this shape is a triangle.');
    expect(spoken).toContain('Your turn. What shape is this?');
  });

  it('medium withdraws the choral guide but keeps the model', () => {
    const spoken = spokenBlock(itemCue(naming('medium')));
    expect(spoken).toContain('Listen: this shape is a triangle.');
    expect(spoken).not.toContain('Together:');
    expect(spoken).toContain('Your turn. What shape is this?');
  });

  it('hard is a COLD answer — the tutor is given nothing to say but the ask', () => {
    const spoken = spokenBlock(itemCue(naming('hard')));
    expect(spoken).not.toContain('Listen:');
    expect(spoken).not.toContain('Together:');
    expect(spoken.trim()).toBe('Your turn. What shape is this?');
  });

  it('the ladder composes per-mode — every task identity reduces to its own ask at hard', () => {
    // No carve-out on any mode, and that is a PACK property rather than luck:
    // the stimulus here is DRAWN, so it is already on screen at every tier and
    // `ask()` is answer-free by construction. (di-letter-sounds needed an
    // inversion guard because its onset ask must keep SPEAKING the stimulus.)
    for (const make of ALL_MAKERS) {
      const item = make('hard');
      expect(spokenBlock(itemCue(item)).trim()).toBe(testLine(item));
    }
  });

  it('hard NEVER puts the ANSWER in the spoken block (the point of the tier)', () => {
    // The model line is the echo route: it speaks the very answer the child is
    // about to produce. At hard the answer exists only on the child's screen as
    // a drawing. The judging contract still carries it — judging never changes.
    const nameCue = itemCue(naming('hard'));
    expect(spokenBlock(nameCue)).not.toContain('triangle');
    expect(nameCue).toContain('triangle'); // still judged against it

    const sidesCue = itemCue(sides('hard'));
    expect(spokenBlock(sidesCue)).not.toContain('three');
    expect(sidesCue).toContain('three');
  });

  it('COUNTING inversion at hard: the shape NAME is withheld too, because it gives the count away', () => {
    // triangle → three, hexagon → six. Under a counting mode the name is not
    // the answer but it hands the answer to any child who knows it, so a cold
    // count has to withhold both tokens and say so explicitly.
    for (const item of [sides('hard'), corners('hard')]) {
      const cue = itemCue(item);
      expect(spokenBlock(cue)).not.toContain(item.shapeWord);
      expect(spokenBlock(cue)).not.toContain(item.countWord!);
      expect(cue).toContain("do NOT say the shape's name (it gives the count away)");
      expect(cue).toContain('do NOT describe or count the drawing aloud');
    }
  });

  it('the cold guard is present at hard and absent at every other tier', () => {
    for (const make of ALL_MAKERS) {
      expect(itemCue(make('hard'))).toContain('answering this one cold on purpose');
      expect(itemCue(make('medium'))).not.toContain('answering this one cold on purpose');
      expect(itemCue(make('easy'))).not.toContain('answering this one cold on purpose');
      expect(itemCue(make(undefined))).not.toContain('answering this one cold on purpose');
    }
  });

  it('an absent tier behaves exactly as easy (pre-L3 sessions are unchanged)', () => {
    for (const make of ALL_MAKERS) {
      expect(itemCue(make(undefined))).toBe(itemCue(make('easy')));
      expect(itemCue(make(undefined), true)).toBe(itemCue(make('easy'), true));
    }
  });

  it('the opening cue carries the tier too', () => {
    const cue = itemCue(naming('hard'), true);
    expect(spokenBlock(cue).trim()).toBe('Your turn. What shape is this?');
    expect(cue).toContain('brisk shape practice for a young learner');
  });
});

describe('di-shapes support tiers — what must NOT change', () => {
  it('BOTH corrections re-model the answer at every tier (standing gate 3)', () => {
    // Remediation is not scaffolding: DISTAR always re-models on an error, so a
    // hard tier withholds the up-front model and still re-states on a miss.
    // This pack ships the contrastive line as well as the plain one — the
    // near-name/near-count IS the error class — so both are byte-pinned.
    for (const tier of TIERS) {
      expect(correctionLine(naming(tier)))
        .toBe('My turn: this shape is a triangle. Your turn. What shape is this?');
      expect(contrastCorrectionLine(naming(tier)))
        .toBe('My turn: not ⟨what they said⟩ — this shape is a triangle. Your turn. What shape is this?');
      expect(correctionLine(sides(tier)))
        .toBe('My turn: this shape has three sides. Your turn. How many sides does this shape have?');
      expect(contrastCorrectionLine(corners(tier)))
        .toBe('My turn: not ⟨what they said⟩ — this shape has six corners. Your turn. How many corners does this shape have?');
    }
  });

  it('the restating AFFIRM is identical at every tier', () => {
    for (const tier of TIERS) {
      expect(verifyLine(naming(tier))).toBe('Yes, this shape is a triangle.');
      expect(verifyLine(sides(tier))).toBe('Yes, this shape has three sides.');
      expect(verifyLine(corners(tier))).toBe('Yes, this shape has six corners.');
    }
  });

  it('the judging contract is byte-identical across tiers', () => {
    // A tier changes how much help precedes the attempt — never how it is
    // judged. If this drifts, the tiers stop being comparable evidence.
    for (const make of ALL_MAKERS) {
      const contractOf = (tier: DiShapesSupportTier) =>
        itemCue(make(tier)).split('Then wait for the learner.')[1];
      expect(contractOf('medium')).toBe(contractOf('easy'));
      expect(contractOf('hard')).toBe(contractOf('easy'));
    }
  });

  it('the judged "diamond" alternate survives every tier', () => {
    for (const tier of TIERS) {
      expect(itemCue(rhombus(tier))).toContain('may also call this shape "diamond"');
    }
  });

  it('the item itself is untouched by tier — support moves, content does not', () => {
    for (const tier of TIERS) {
      const ch = sides(tier);
      expect(ch.shape).toBe('triangle');
      expect(ch.rotationDeg).toBe(12);
      expect(ch.countNumeral).toBe(3);
      expect(ch.countWord).toBe('three');
      expect(ch.challengeType).toBe('count_sides');
    }
  });
});

describe('di-shapes support tiers — move-on cue', () => {
  it("composes the NEXT item at the NEXT item's tier", () => {
    const spoken = spokenBlock(moveOnCue(naming('easy'), corners('hard')));
    expect(spoken).toContain('Good try.');
    expect(spoken).not.toContain('Listen:');
    expect(spoken).not.toContain('six');     // the next item's count stays unsaid
    expect(spoken).not.toContain('hexagon'); // and so does the name that implies it
    expect(spoken).toContain('Your turn. How many corners does this shape have?');
    expect(moveOnCue(naming('easy'), corners('hard'))).toContain('answering this one cold on purpose');
  });

  it('still models the next item at easy', () => {
    const spoken = spokenBlock(moveOnCue(naming('hard'), review('easy')));
    expect(spoken).toContain('Listen: this shape is a square.');
    expect(spoken).toContain('Together: this shape is a square.');
  });

  it('the final move-on (no next item) closes the session at any tier', () => {
    for (const tier of TIERS) {
      expect(moveOnCue(naming(tier))).toContain("That's the end of our shape practice.");
    }
  });
});

describe('di-shapes support tiers — sentinel collision scan at every tier', () => {
  it('no cue sentence outside the verdict branches opens with a sentinel', () => {
    // The L3 fade adds a NEW unquoted sentence to every hard cue (the cold
    // guard), so the pack's structural invariant is re-run across the whole
    // tier grid: a guard line opening "Yes"/"My turn" would forge a verdict.
    // Same scan shape as the L1 suite — strip the QUOTED verdict lines, then
    // read the rest sentence by sentence exactly as the engine would.
    const nextItem = (tier?: DiShapesSupportTier) => corners(tier);
    for (const tier of [...TIERS, undefined]) {
      for (const make of ALL_MAKERS) {
        const item = make(tier);
        const next = nextItem(tier);
        const cues = [
          itemCue(item, true),
          itemCue(item),
          moveOnCue(item, next),
          moveOnCue(item),
        ];
        for (const cue of cues) {
          const withoutQuoted = [item, next].reduce(
            (text, ref) => text
              .split(verifyLine(ref)).join(' ')
              .split(correctionLine(ref)).join(' ')
              .split(contrastCorrectionLine(ref)).join(' '),
            cue,
          );
          for (const sentence of withoutQuoted.split(/[.!?]+/)) {
            const scanned = scanForSentinel(`${sentence.trim()}.`, DI_SENTINELS);
            expect(scanned, `collision at ${tier ?? 'no-tier'} in: "${sentence.trim()}"`)
              .not.toBe('affirmed');
            expect(scanned, `collision at ${tier ?? 'no-tier'} in: "${sentence.trim()}"`)
              .not.toBe('corrected');
          }
        }
      }
    }
  });
});
