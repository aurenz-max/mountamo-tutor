/**
 * cause-effect-chain — L3 / L4 GATE (2026-09-03)
 *
 * `/add-support-tiers` (axis 1) and `/add-structural-difficulty` (axis 2) both
 * hang off `config.difficulty`. Their guards are invisible when the model
 * behaves, so this suite feeds them adversarial pools the live runs never
 * produce.
 *
 * What is asserted:
 *   1. Axis 1 is a LADDER — easy names the strategy, hard withdraws every
 *      reading aid, medium sits between — and it is applied per challenge to
 *      the live path and the fallback alike.
 *   2. The measures see what they claim to: an anchored chain scores 0
 *      inferred links, a lexical gap scores 1, plurals anchor, generic words do
 *      not; a reworded cause never scores as a "near" non-cause.
 *   3. Selection lands the tier: easy ships the most-anchored chains, hard the
 *      least, over thousands of random pools; a blend keeps every rung; the
 *      shipped count never exceeds MAX_CHALLENGES; the root/proximate ask
 *      still alternates after selection.
 *   4. The untiered path is BYTE-IDENTICAL: no scaffold fields, no supportTier,
 *      the base schema still asks for 3-5.
 *
 * Non-vacuity (mutation-checked on 2026-09-03): flatten the ladder → (1) fails;
 * drop GENERIC_ANCHORS → (2) fails; sort the wrong way in pickWithinType → (3)
 * fails; stamp scaffolds unconditionally → (4) fails.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildChallenge,
  buildFallbackChains,
  validateResponse,
  applySupportTier,
  resolveSupportStructure,
  resolveProblemShape,
  inferredLinks,
  distractorNearness,
  sharedStems,
  measureCandidates,
  selectForShape,
  alternateAsks,
  assignModes,
  type BuiltChallenge,
  type RawChallenge,
  type ShapeCandidate,
} from './gemini-cause-effect-chain';
import type {
  CauseEffectChainChallenge,
  CauseEffectChallengeType,
} from '../../primitives/visual-primitives/history/CauseEffectChain';

const TIERS = ['easy', 'medium', 'hard'] as const;
const MODES: readonly CauseEffectChallengeType[] = ['identify_cause', 'build_chain', 'root_vs_proximate'];

/** A chain whose every link is named in the next card — 0 inferred links. */
const anchored = (over: Partial<RawChallenge> = {}): RawChallenge => ({
  chainTheme: 'town founding',
  outcome: 'A busy town grows beside the station',
  outcomeCategory: 'social',
  cause0Text: 'Engineers build a railroad line across the plains',
  cause0Category: 'technological',
  cause1Text: 'Trains carry crops along the new railroad to the cities',
  cause1Category: 'economic',
  cause2Text: 'Storekeepers open shops beside the train station',
  cause2Category: 'economic',
  explanation: 'The line had to exist before trains ran on it, and shops came for the travellers.',
  hint: 'Which of these is a thing that had to be built?',
  ...over,
});

/**
 * A chain with exactly ONE lexical gap — "fewer hands for the farm harvest" →
 * "every child to attend school" shares nothing; the student has to see that
 * the children were the hands. The other two links are anchored (farm; child /
 * children + school).
 */
const gapped = (over: Partial<RawChallenge> = {}): RawChallenge => ({
  chainTheme: 'school attendance',
  outcome: 'Children spend every day at school',
  outcomeCategory: 'social',
  cause0Text: 'New machines do the heaviest work on the farm',
  cause0Category: 'technological',
  cause1Text: 'Families need fewer hands for the farm harvest',
  cause1Category: 'economic',
  cause2Text: 'Lawmakers require every child to attend school',
  cause2Category: 'political',
  explanation: 'Machines freed the children, and only then could a school law be followed.',
  hint: 'What had to change on the farm before a family could spare a child?',
  ...over,
});

const built = (raw: RawChallenge, index = 0): BuiltChallenge => {
  const out = buildChallenge(raw, index, 3);
  if ('reject' in out) throw new Error(`fixture rejected: ${out.reject}`);
  return out;
};

afterEach(() => { vi.restoreAllMocks(); });

// ---------------------------------------------------------------------------
// 1. Axis 1 — the ladder
// ---------------------------------------------------------------------------

describe('the support ladder', () => {
  it('is a ladder, not a switch — each tier withdraws strictly more', () => {
    for (const mode of MODES) {
      const easy = resolveSupportStructure(mode, 'easy').scaffold;
      const medium = resolveSupportStructure(mode, 'medium').scaffold;
      const hard = resolveSupportStructure(mode, 'hard').scaffold;
      expect(easy).toEqual({ showStrategy: true, showCategoryLabels: true, showSlotNumbers: true, showHint: true });
      expect(medium).toEqual({ showStrategy: false, showCategoryLabels: true, showSlotNumbers: true, showHint: true });
      expect(hard).toEqual({ showStrategy: false, showCategoryLabels: false, showSlotNumbers: false, showHint: false });
    }
  });

  it('carries the guardrail and a tier line into the prompt', () => {
    for (const tier of TIERS) {
      const { promptLines } = resolveSupportStructure('build_chain', tier);
      expect(promptLines[0]).toMatch(/does NOT change the reading level/);
      expect(promptLines.some((l) => l.includes(`SUPPORT TIER ${tier}`))).toBe(true);
    }
  });

  it('stamps every challenge from its OWN rung and the session with the tier', () => {
    const data = buildFallbackChains('3', MODES);
    const tiered = applySupportTier(data, 'hard');
    expect(tiered.supportTier).toBe('hard');
    expect(tiered.challenges).toHaveLength(data.challenges.length);
    for (const c of tiered.challenges) {
      expect(c.showStrategy).toBe(false);
      expect(c.showCategoryLabels).toBe(false);
      expect(c.showHint).toBe(false);
      // Nothing answer-bearing moved.
      const original = data.challenges.find((o) => o.id === c.id)!;
      expect(c.correctOrder).toEqual(original.correctOrder);
      expect(c.nodes.map((n) => n.id)).toEqual(original.nodes.map((n) => n.id));
      expect(c.hint).toBe(original.hint);   // the DATA stays; only the render gate closes
    }
  });
});

// ---------------------------------------------------------------------------
// 2. The measures
// ---------------------------------------------------------------------------

describe('the link-distance measure', () => {
  it('scores an anchored chain 0 and a chain with one lexical gap 1', () => {
    expect(inferredLinks(built(anchored()).challenge)).toBe(0);
    expect(inferredLinks(built(gapped()).challenge)).toBe(1);
  });

  it('anchors plurals and inflections to their stem', () => {
    expect(sharedStems('Engineers build a railroad', 'Trains run on the railroads')).toBe(1);
    expect(sharedStems('Farmers plant wheat', 'The farmer harvests the wheat')).toBe(2);
  });

  it('does not let a generic word anchor two unrelated cards', () => {
    expect(sharedStems('Many people work all day', 'People make many things')).toBe(0);
  });

  it('counts the last cause → outcome link too', () => {
    // Anchored chain, but an outcome sharing nothing with the last cause.
    // (The first draft said "the open grassland" — and "Storekeepers OPEN shops"
    // anchored it. The proxy is lexical and homographs count; noted in the report.)
    const c = built(anchored({ outcome: 'Families settle across the wide grassland' })).challenge;
    expect(inferredLinks(c)).toBe(1);
  });
});

describe('the non-cause nearness measure', () => {
  /** d0 = the CONSEQUENCE card, d1 = the BACKGROUND card (the one measured). */
  const withDistractors = (d0: string, d1: string) => built(anchored({
    distractor0Text: d0, distractor0Category: 'social',
    distractor1Text: d1, distractor1Category: 'social',
  }));

  it('scores a far background 0 and a near one ≥1', () => {
    const far = withDistractors(
      'Children wave at the passengers on the trains',   // consequence: near by nature, NOT measured
      'Tall grass covers the prairie for miles',          // not "the plains" — cause0 says plains
    );
    const near = withDistractors(
      'A newspaper prints its weekly edition',
      'Wagons haul the crops to market over rutted roads', // "crops" anchors cause1
    );
    expect(distractorNearness(far)).toBe(0);
    expect(distractorNearness(near)).toBeGreaterThanOrEqual(1);
  });

  it('ignores the consequence card — a lexical "far" on it is unreachable', () => {
    const c = withDistractors(
      'Trains bring the mail to the new railroad station every week',  // shares train, railroad, station
      'A newspaper prints its weekly edition',
    );
    expect(distractorNearness(c)).toBe(0);
  });

  it('never lets a reworded cause score as "near"', () => {
    // A reworded cause2 as the background — NOT canon-equal (buildChallenge
    // would drop that outright), but overlap 1.0 on content words. Without the
    // guard it would share several stems and win "near" at hard: two right answers.
    const dupe = withDistractors(
      'A newspaper prints its weekly edition',
      'Storekeepers open new shops beside the train station',
    );
    expect(dupe.distractors).toHaveLength(2);   // it survived into the bank…
    expect(distractorNearness(dupe)).toBe(0);   // …and still cannot score as near
  });

  it('does not let a describing word anchor two cards', () => {
    expect(sharedStems('Workers lay heavy wooden ties', 'Families sleep in warm wooden houses')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Selection
// ---------------------------------------------------------------------------

/** Deterministic pools: a seeded PRNG behind Math.random so shuffles replay. */
const seed = (s: number) => {
  let x = s >>> 0;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 0x100000000;
  });
};

const candidate = (
  type: CauseEffectChallengeType,
  links: number,
  nearness: number,
  i: number,
  distractorCount = 2,
): ShapeCandidate => ({
  challenge: {
    id: `c${i}`,
    type,
    chainTheme: `theme ${i}`,
    outcome: { id: `o${i}`, text: `Outcome ${i}`, category: 'social', icon: '👥' },
    nodes: [],
    correctOrder: [],
    explanation: 'x',
  },
  inferredLinks: links,
  nearness,
  distractorCount,
});

describe('selectForShape', () => {
  it('ships the most-anchored chains at easy and the least at hard, over random pools', () => {
    seed(7);
    for (let trial = 0; trial < 2000; trial++) {
      const n = 5 + Math.floor(Math.random() * 4);          // 5..8
      const pool = Array.from({ length: n }, (_, i) =>
        candidate('build_chain', Math.floor(Math.random() * 4), 0, i));
      const sortedLinks = pool.map((c) => c.inferredLinks).sort((a, b) => a - b);

      const easy = selectForShape(pool, 5, 'easy');
      const hard = selectForShape(pool, 5, 'hard');
      expect(easy.length).toBe(Math.min(5, n));
      expect(hard.length).toBe(Math.min(5, n));

      const linksOf = (ch: CauseEffectChainChallenge) => pool.find((c) => c.challenge.id === ch.id)!.inferredLinks;
      const easyLinks = easy.map(linksOf).sort((a, b) => a - b);
      const hardLinks = hard.map(linksOf).sort((a, b) => b - a);
      // Exactly the k smallest / k largest of the pool.
      expect(easyLinks).toEqual(sortedLinks.slice(0, easy.length));
      expect(hardLinks).toEqual([...sortedLinks].reverse().slice(0, hard.length));
    }
  });

  it('ships the farthest non-causes at easy and the nearest at hard', () => {
    seed(11);
    for (let trial = 0; trial < 1000; trial++) {
      const pool = Array.from({ length: 7 }, (_, i) =>
        candidate('identify_cause', 0, Math.floor(Math.random() * 3), i));
      const nearnessOf = (ch: CauseEffectChainChallenge) => pool.find((c) => c.challenge.id === ch.id)!.nearness;
      const sorted = pool.map((c) => c.nearness).sort((a, b) => a - b);
      expect(selectForShape(pool, 5, 'easy').map(nearnessOf).sort((a, b) => a - b)).toEqual(sorted.slice(0, 5));
      expect(selectForShape(pool, 5, 'hard').map(nearnessOf).sort((a, b) => b - a)).toEqual([...sorted].reverse().slice(0, 5));
    }
  });

  it('prefers a round with both non-causes over one that measures "far" by absence', () => {
    const pool = [
      candidate('identify_cause', 0, 0, 0, 1),   // background dropped → nearness 0 by absence
      candidate('identify_cause', 0, 1, 1, 2),
      candidate('identify_cause', 0, 2, 2, 2),
      candidate('identify_cause', 0, 0, 3, 2),
    ];
    const easy = selectForShape(pool, 2, 'easy').map((c) => c.id);
    expect(easy).toEqual(['c1', 'c3']);   // both two-card rounds nearest "far"; c0 never wins by absence
  });

  it('keeps every rung of a blend and never exceeds the cap', () => {
    seed(3);
    for (let trial = 0; trial < 500; trial++) {
      const pool = Array.from({ length: 8 }, (_, i) =>
        candidate(MODES[i % 3], Math.floor(Math.random() * 3), Math.floor(Math.random() * 3), i));
      for (const tier of TIERS) {
        const out = selectForShape(pool, 5, tier);
        expect(out.length).toBe(5);
        expect(new Set(out.map((c) => c.type)).size).toBe(3);
      }
    }
  });

  it('ships in the model\'s order, so the session still reads as one setting', () => {
    const pool = [3, 0, 2, 1, 0, 3].map((links, i) => candidate('build_chain', links, 0, i));
    const ids = selectForShape(pool, 4, 'easy').map((c) => c.id);
    expect(ids).toEqual(['c1', 'c2', 'c3', 'c4']);   // links 0,2,1,0 — kept in pool order
  });

  it('re-alternates the root/proximate ask over the shipped set', () => {
    const pool = [0, 0, 2, 2, 0, 0].map((links, i) => ({
      ...candidate('root_vs_proximate', links, 0, i),
      challenge: { ...candidate('root_vs_proximate', links, 0, i).challenge, ask: 'root' as const },
    }));
    // Hard keeps c2, c3 (links 2) + two of the zeros: whichever survive, asks must alternate.
    const out = selectForShape(pool, 4, 'hard');
    expect(out.map((c) => c.ask)).toEqual(['root', 'proximate', 'root', 'proximate']);
  });

  it('alternateAsks is idempotent on an already-alternated set', () => {
    const set = assignModes(
      [0, 1, 2, 3].map((i) => built(anchored({ chainTheme: `t${i}`, outcome: `Outcome ${i} arrives` }), i)),
      ['root_vs_proximate'],
    );
    expect(alternateAsks(set)).toEqual(set);
  });
});

// ---------------------------------------------------------------------------
// 4. The untiered path is byte-identical
// ---------------------------------------------------------------------------

describe('no tier, no change', () => {
  const session = (challenges: RawChallenge[]) => ({
    title: 'T', description: 'D', context: 'C', periodLabel: 'P', challenges,
  });
  const variant = (n: number): RawChallenge => anchored({
    chainTheme: `theme ${n}`,
    outcome: `Outcome number ${n} arrives in the valley`,
    cause0Text: [
      'Surveyors mark a shallow ford on the wide river',
      'Metalworkers cast reusable letters from a hard alloy',
      'Farmers clear thick woodland along the northern ridge',
      'Sailors chart a safe harbour behind the rocky headland',
    ][n - 1],
  });

  it('ships no scaffold fields and no supportTier without a tier', () => {
    const d = validateResponse(session([variant(1), variant(2), variant(3)]), '3');
    expect(d).not.toBeNull();
    expect(d!.supportTier).toBeUndefined();
    for (const c of d!.challenges) {
      expect(c.showStrategy).toBeUndefined();
      expect(c.showCategoryLabels).toBeUndefined();
      expect(c.showSlotNumbers).toBeUndefined();
      expect(c.showHint).toBeUndefined();
    }
  });

  it('never MEASURES without a tier — the first five survivors ship in model order', () => {
    // The same six-chain pool, both ways. Untiered: the selector is unreachable
    // and the model's first five ship as written. Tiered: the five nearest the
    // tier ship — the pool has three anchored and three gapped chains, so hard
    // must take all three gapped ones.
    const six = [1, 2, 3].map(variant).concat([
      gapped({ chainTheme: 'theme 4', outcome: 'Outcome number 4 arrives in the valley',
        cause0Text: 'Sailors chart a safe harbour behind the rocky headland' }),
      gapped({ chainTheme: 'theme 5', outcome: 'Outcome number 5 arrives in the valley',
        cause0Text: 'Miners dig a deep shaft into the hillside' }),
      gapped({ chainTheme: 'theme 6', outcome: 'Outcome number 6 arrives in the valley',
        cause0Text: 'Weavers set up looms in a riverside mill' }),
    ]);

    const plain = validateResponse(session(six), '3');
    expect(plain?.challenges.map((c) => c.chainTheme))
      .toEqual(['theme 1', 'theme 2', 'theme 3', 'theme 4', 'theme 5']);

    const hard = validateResponse(session(six), '3', 3, ['build_chain'], 'hard');
    const hardThemes = hard!.challenges.map((c) => c.chainTheme);
    expect(hardThemes).toHaveLength(5);
    expect(hardThemes).toEqual(expect.arrayContaining(['theme 4', 'theme 5', 'theme 6']));
  });

  it('with a tier, measures and selects but still ships every rung a pin asked for', () => {
    const d = validateResponse(session([variant(1), variant(2), variant(3), variant(4)]), '3', 3, ['build_chain'], 'hard');
    expect(d).not.toBeNull();
    expect(d!.challengeType).toBe('build_chain');
    expect(d!.challenges.length).toBeLessThanOrEqual(5);
  });

  it('measureCandidates lines candidates up with their built source', () => {
    const b = [built(anchored(), 0), built(gapped({ chainTheme: 'other' }), 1)];
    const laddered = assignModes(b, ['build_chain']);
    const m = measureCandidates(b, laddered);
    expect(m.map((c) => c.inferredLinks)).toEqual([0, 1]);
  });

  it('resolveProblemShape leaves medium unenforced on both levers', () => {
    expect(resolveProblemShape('build_chain', 'medium').inferredLinks).toBeUndefined();
    expect(resolveProblemShape('identify_cause', 'medium').distractorNearness).toBeUndefined();
    expect(resolveProblemShape('build_chain', 'easy').inferredLinks).toEqual({ target: 0, direction: 'at_most' });
    expect(resolveProblemShape('build_chain', 'hard').inferredLinks).toEqual({ target: 1, direction: 'at_least' });
    expect(resolveProblemShape('identify_cause', 'hard').distractorNearness).toBe('near');
  });
});
