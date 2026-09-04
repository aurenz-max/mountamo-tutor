/**
 * cause-effect-chain — BIRTH AUDIT GATE (2026-09-03)
 *
 * The generator's post-validation is the only thing standing between a
 * plausible-looking Gemini response and a chain the student can sort without
 * one causal thought. Those guards are invisible when the model behaves, which
 * is exactly why they rot silently — so this suite feeds them the adversarial
 * responses the live runs never produced.
 *
 * What is asserted:
 *   1. The answer is never on screen — a bank equal to the answer order cannot
 *      be produced, at any chain length, including the 2-permutation edge case.
 *   2. Each leak class REJECTS: sequence words, causal connectives, years.
 *   3. Structural rejects: short chains, duplicate cards, a cause restating the
 *      outcome, a missing category.
 *   4. Distinctness holds across a session: duplicate outcome, duplicate theme,
 *      and a repeated first cause each cost a challenge.
 *   5. The chain-length floor is a floor — `chainLengthFor` never returns less
 *      than the length at which guessing beats reasoning.
 *   6. The fallback passes its own audits (a fallback that leaks is worse than
 *      no fallback, because it ships silently).
 *
 * Non-vacuity: every assertion fails if its guard is removed. Deleting the
 * ORDINAL_LEAK branch breaks (2); returning `items` unshuffled breaks (1);
 * dropping the theme/overlap dedup breaks (4).
 */
import { describe, it, expect } from 'vitest';
import {
  assignModes,
  buildChallenge,
  validateResponse,
  buildFallbackChains,
  shuffleAwayFrom,
  shuffleBankAwayFromPrefix,
  sessionChallengeType,
  chainLengthFor,
  leaks,
  wordOverlap,
  type BuiltChallenge,
  type RawChallenge,
} from './gemini-cause-effect-chain';

/** A response that passes every audit — each test breaks exactly one thing. */
const clean = (over: Partial<RawChallenge> = {}): RawChallenge => ({
  chainTheme: 'town founding',
  outcome: 'A busy town grows beside the water',
  outcomeCategory: 'social',
  cause0Text: 'Surveyors mark out a crossing on the wide river',
  cause0Category: 'technological',
  cause1Text: 'Traders stop at the crossing to rest their teams',
  cause1Category: 'economic',
  cause2Text: 'A blacksmith opens a shop beside the ford',
  cause2Category: 'economic',
  explanation: 'The crossing had to exist before anyone stopped at it.',
  hint: 'Which of these had to be true of the land itself?',
  ...over,
});

/** The same response, plus the two cards only `identify_cause` needs. */
const withDistractors = (over: Partial<RawChallenge> = {}): RawChallenge => clean({
  distractor0Text: 'A newspaper opens an office on the main street',
  distractor0Category: 'social',
  distractor1Text: 'The river runs high with meltwater every spring',
  distractor1Category: 'social',
  ...over,
});

const built = (raw: RawChallenge, index = 0): BuiltChallenge => {
  const out = buildChallenge(raw, index, 3);
  if ('reject' in out) throw new Error(`fixture rejected: ${out.reject}`);
  return out;
};

const ok = (raw: RawChallenge, min = 3) => {
  const out = buildChallenge(raw, 0, min);
  return 'challenge' in out ? out.challenge : null;
};
const why = (raw: RawChallenge, min = 3) => {
  const out = buildChallenge(raw, 0, min);
  return 'reject' in out ? out.reject : null;
};

describe('the answer is never on screen', () => {
  it('never ships the bank in the answer order, at any length', () => {
    for (let len = 2; len <= 6; len++) {
      const answer = Array.from({ length: len }, (_, i) => ({ id: `n${i}` }));
      for (let trial = 0; trial < 200; trial++) {
        const bank = shuffleAwayFrom([...answer], answer);
        expect(bank).toHaveLength(len);
        expect(new Set(bank)).toEqual(new Set(answer));
        expect(bank.every((x, i) => x === answer[i])).toBe(false);
      }
    }
  });

  it('shuffles the built challenge away from its own correctOrder', () => {
    for (let trial = 0; trial < 200; trial++) {
      const c = ok(clean());
      expect(c).not.toBeNull();
      expect(c!.nodes.map((n) => n.id)).not.toEqual(c!.correctOrder);
      // …while still containing exactly the answer's cards.
      expect(new Set(c!.nodes.map((n) => n.id))).toEqual(new Set(c!.correctOrder));
    }
  });
});

describe('answer-leak audits reject', () => {
  it.each([
    ['sequence word', 'Then the traders stop at the crossing', 'ordinal'],
    ['sequence word (finally)', 'Families finally settle beside the ford', 'ordinal'],
    ['causal connective', 'Traders stop because the crossing is safe', 'connective'],
    ['causal connective (led to)', 'The crossing led to a busy market', 'connective'],
    ['a year', 'Surveyors mark the crossing in 1847', 'date'],
    ['a decade tag', 'Wagons roll through in the 1850s', 'date'],
  ])('%s on a card', (_label, text, kind) => {
    expect(leaks(text)).toBe(kind);
    expect(why(clean({ cause1Text: text }))).toContain(kind);
  });

  it('leaves ordinary sentences and ordinary numbers alone', () => {
    expect(leaks('Three hundred wagons roll through the pass each summer')).toBeNull();
    expect(leaks('Surveyors mark out a crossing on the wide river')).toBeNull();
  });

  it('rejects a leaking OUTCOME too, not only the cards', () => {
    expect(why(clean({ outcome: 'A town grows because the crossing is busy' }))).toContain('connective');
  });

  it('drops a position-naming hint without killing the challenge', () => {
    const c = ok(clean({ hint: 'Which card goes first in the chain?' }));
    expect(c).not.toBeNull();
    expect(c!.hint).toBeUndefined();
  });

  it('keeps a hint that only points at the cards', () => {
    expect(ok(clean())!.hint).toBe('Which of these had to be true of the land itself?');
  });
});

describe('structural rejects', () => {
  it('rejects a chain below the requested length', () => {
    expect(why(clean({ cause2Text: undefined }))).toContain('needed 3');
  });

  it('accepts that same chain when the pass has degraded to the floor', () => {
    // Attempt 2 asks for MIN_CAUSES; a grade-5 four-link ask degrades, it does
    // not drop the session onto the fallback.
    expect(why(clean({ cause3Text: undefined }), 4)).toContain('needed 4');
    expect(ok(clean(), 3)).not.toBeNull();
  });

  it('rejects a duplicate card', () => {
    expect(why(clean({ cause2Text: 'Traders stop at the crossing to rest their teams.' })))
      .toContain('duplicate card');
  });

  it('rejects a cause that restates the outcome', () => {
    expect(why(clean({ cause2Text: 'A busy town grows beside the water' })))
      .toContain('duplicate card');
  });

  it('rejects a missing category rather than defaulting one', () => {
    expect(why(clean({ cause1Category: 'geographic' }))).toContain('missing category');
  });

  it('rejects a missing explanation', () => {
    expect(why(clean({ explanation: '   ' }))).toContain('missing explanation');
  });
});

describe('session distinctness', () => {
  const session = (challenges: RawChallenge[]) => ({
    title: 'T', description: 'D', context: 'C', periodLabel: 'P', challenges,
  });

  /**
   * Genuinely different chains. The first causes share no content words on
   * purpose — an earlier draft of this fixture numbered one sentence, and the
   * overlap guard correctly rejected all four as the same event.
   */
  const OPENERS = [
    'Surveyors mark a shallow ford on the wide river',
    'Metalworkers cast reusable letters from a hard alloy',
    'Farmers clear thick woodland along the northern ridge',
    'Sailors chart a safe harbour behind the rocky headland',
  ];
  const variant = (n: number): RawChallenge => clean({
    chainTheme: `theme ${n}`,
    outcome: `Outcome number ${n} arrives in the valley`,
    cause0Text: OPENERS[n - 1],
  });

  it('accepts three genuinely different chains', () => {
    const d = validateResponse(session([variant(1), variant(2), variant(3)]), '3');
    expect(d?.challenges).toHaveLength(3);
  });

  it('drops a chain that repeats an outcome', () => {
    const dupe = { ...variant(3), outcome: variant(2).outcome as string };
    const d = validateResponse(session([variant(1), variant(2), dupe, variant(4)]), '3');
    expect(d?.challenges.map((c) => c.chainTheme)).toEqual(['theme 1', 'theme 2', 'theme 4']);
  });

  it('drops a chain that repeats a theme', () => {
    const dupe = { ...variant(3), chainTheme: 'theme 2' };
    const d = validateResponse(session([variant(1), variant(2), dupe, variant(4)]), '3');
    expect(d?.challenges.map((c) => c.chainTheme)).toEqual(['theme 1', 'theme 2', 'theme 4']);
  });

  it('drops a chain that starts from the same first cause in other words', () => {
    // The live grade-3 run before this guard shipped four chains all beginning
    // with the railroad being laid.
    const echo = {
      ...variant(3),
      cause0Text: 'Metalworkers cast reusable letters using a hard alloy mould',
    };
    const d = validateResponse(session([variant(1), variant(2), echo, variant(4)]), '3');
    expect(d?.challenges.map((c) => c.chainTheme)).toEqual(['theme 1', 'theme 2', 'theme 4']);
  });

  it('returns null rather than a one-question session', () => {
    expect(validateResponse(session([variant(1), variant(1), variant(1)]), '3')).toBeNull();
  });

  it('scores word overlap on content words, not function words', () => {
    expect(wordOverlap('Workers lay iron tracks across the plains',
      'Workers lay iron tracks across the wide plains')).toBeGreaterThanOrEqual(0.6);
    expect(wordOverlap('Workers lay iron tracks across the plains',
      'Printers cast metal letters in a workshop')).toBeLessThan(0.6);
  });
});

describe('the chain-length floor', () => {
  it('never drops below the length at which guessing beats reasoning', () => {
    // Two cards = two arrangements = a coin flip, and two tries = a certainty.
    for (const g of ['K', '1', '2', '3', '4', '5', '6', 'Elementary', '']) {
      expect(chainLengthFor(g)).toBeGreaterThanOrEqual(3);
    }
  });

  it('gives the older bands the longer chain', () => {
    expect(chainLengthFor('5')).toBe(4);
    expect(chainLengthFor('6')).toBe(4);
    expect(chainLengthFor('2')).toBe(3);
  });
});

describe('the curated fallback', () => {
  it('passes the same audits the generated content must pass', () => {
    for (const grade of ['K', '3', '5']) {
      const data = buildFallbackChains(grade);
      expect(data.challenges.length).toBeGreaterThanOrEqual(3);
      const themes = data.challenges.map((c) => c.chainTheme);
      expect(new Set(themes).size).toBe(themes.length);
      for (const c of data.challenges) {
        expect(c.correctOrder.length).toBeGreaterThanOrEqual(3);
        // Ordering rungs ship exactly the causes; identify_cause ships MORE than
        // the causes, and never only the causes — that is the whole rung.
        if (c.type === 'identify_cause') {
          expect(c.nodes.length).toBeGreaterThan(c.correctOrder.length);
        } else {
          expect(c.nodes.map((n) => n.id)).not.toEqual(c.correctOrder);
          expect(new Set(c.nodes.map((n) => n.id))).toEqual(new Set(c.correctOrder));
        }
        for (const n of [...c.nodes, c.outcome]) {
          expect(leaks(n.text)).toBeNull();
          expect(n.icon).toBeTruthy();
        }
      }
    }
  });

  it('can serve a pinned rung, including the one that needs non-causes', () => {
    // A fallback that silently downgraded the mode would feed the IRT model
    // evidence under a beta that never applied.
    for (const mode of ['identify_cause', 'build_chain', 'root_vs_proximate'] as const) {
      const data = buildFallbackChains('3', [mode]);
      expect(data.challengeType).toBe(mode);
      expect(data.challenges.every((c) => c.type === mode)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// The eval-mode ladder (L1)
// ---------------------------------------------------------------------------

describe('mode assignment is owned by code, not the model', () => {
  const pool = (n: number, raw = withDistractors) =>
    Array.from({ length: n }, (_, i) => built(raw({
      chainTheme: `theme ${i}`,
      outcome: `Outcome ${i} arrives in the valley`,
    }), i));

  it('pins every round when one rung is asked for', () => {
    for (const mode of ['identify_cause', 'build_chain', 'root_vs_proximate'] as const) {
      const out = assignModes(pool(4), [mode]);
      expect(out.every((c) => c.type === mode)).toBe(true);
      expect(sessionChallengeType(out)).toBe(mode);
    }
  });

  it('covers every rung of a blend rather than collapsing to one (SP-21)', () => {
    // The failure this guards is a session LABELLED mixed that is really one
    // type end to end — unreachable here only because code, not Gemini, assigns.
    for (let trial = 0; trial < 50; trial++) {
      const out = assignModes(pool(3), ['identify_cause', 'build_chain', 'root_vs_proximate']);
      expect(new Set(out.map((c) => c.type)).size).toBe(3);
      expect(sessionChallengeType(out)).toBe('mixed');
    }
  });

  it('never gives identify_cause to a challenge with no non-cause cards', () => {
    // `clean()` has no distractors: the rung would ship a bank in which every
    // card is a correct answer.
    for (let trial = 0; trial < 50; trial++) {
      const out = assignModes(pool(3, clean), ['identify_cause', 'build_chain', 'root_vs_proximate']);
      expect(out.some((c) => c.type === 'identify_cause')).toBe(false);
    }
  });

  it('puts the non-causes IN the bank and leaves them OUT of the key', () => {
    const [c] = assignModes([built(withDistractors())], ['identify_cause']);
    expect(c.nodes).toHaveLength(5);           // 3 causes + 2 non-causes
    expect(c.correctOrder).toHaveLength(3);
    const bankIds = new Set(c.nodes.map((n) => n.id));
    for (const id of c.correctOrder) expect(bankIds.has(id)).toBe(true);
    // …and the extras are genuinely gradeable as wrong.
    expect(c.nodes.filter((n) => !c.correctOrder.includes(n.id))).toHaveLength(2);
  });

  it('never opens an identify_cause bank with the answer set', () => {
    for (let trial = 0; trial < 200; trial++) {
      const [c] = assignModes([built(withDistractors())], ['identify_cause']);
      expect(c.nodes.slice(0, 3).map((n) => n.id)).not.toEqual(c.correctOrder);
    }
  });

  it('asks both ends of the chain across a root_vs_proximate session', () => {
    // Always asking for the root would be answerable by "pick the card that
    // sounds oldest" — a habit, not the distinction the rung measures.
    const out = assignModes(pool(4), ['root_vs_proximate']);
    expect(new Set(out.map((c) => c.ask))).toEqual(new Set(['root', 'proximate']));
  });
});

describe('the non-cause cards face the same audits as the causes', () => {
  it.each([
    ['a sequence word', 'Then a newspaper opens on the main street'],
    ['a connective', 'A newspaper opens because the town is busy'],
    ['a year', 'A newspaper opens its office in 1847'],
  ])('drops a distractor carrying %s', (_label, text) => {
    // Dropped, not fatal: the other two rungs never needed the card, so a bad
    // distractor costs the rung and not three sound chains.
    const b = built(withDistractors({ distractor0Text: text }));
    expect(b.distractors).toHaveLength(1);
    expect(b.challenge.nodes).toHaveLength(3);
  });

  it('drops a "non-cause" that restates a cause', () => {
    const b = built(withDistractors({
      distractor0Text: 'Traders stop at the crossing to rest their teams.',
    }));
    expect(b.distractors.map((d) => d.text)).toEqual(['The river runs high with meltwater every spring']);
  });

  it('shuffles a bank away from an answer-order prefix', () => {
    const answer = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as never[];
    const bank = [...answer, { id: 'x' }, { id: 'y' }] as never[];
    for (let trial = 0; trial < 200; trial++) {
      const out = shuffleBankAwayFromPrefix(bank, ['a', 'b', 'c']);
      expect(out).toHaveLength(5);
      expect(out.slice(0, 3).map((n: { id: string }) => n.id)).not.toEqual(['a', 'b', 'c']);
    }
  });
});

describe('a pinned session refuses to substitute a rung', () => {
  const session = (challenges: RawChallenge[]) => ({
    title: 'T', description: 'D', context: 'C', periodLabel: 'P', challenges,
  });
  const variant = (n: number, raw = withDistractors): RawChallenge => raw({
    chainTheme: `theme ${n}`,
    outcome: `Outcome number ${n} arrives in the valley`,
    cause0Text: [
      'Surveyors mark a shallow ford on the wide river',
      'Metalworkers cast reusable letters from a hard alloy',
      'Farmers clear thick woodland along the northern ridge',
    ][n - 1],
  });

  it('serves identify_cause when the non-causes arrived', () => {
    const d = validateResponse(
      session([variant(1), variant(2), variant(3)]), '3', 3, ['identify_cause'],
    );
    expect(d?.challengeType).toBe('identify_cause');
  });

  it('fails rather than shipping build_chain under an identify_cause label', () => {
    // Silently downgrading would look like a working session and poison the
    // calibration evidence with a beta that never applied.
    const d = validateResponse(
      session([variant(1, clean), variant(2, clean), variant(3, clean)]), '3', 3, ['identify_cause'],
    );
    expect(d).toBeNull();
  });
});
