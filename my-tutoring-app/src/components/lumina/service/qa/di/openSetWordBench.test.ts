/**
 * The bench's own gates — because a bench whose KEY is wrong is worse than no
 * bench at all.
 *
 * Everything else in this repo tests the product. This file tests the
 * MEASURING INSTRUMENT: if a probe is filed in the wrong bucket, the run scores
 * the judge's correct answer as a false affirmation and blocks a response class
 * on our error — or, worse, scores a real false affirmation as agreement and
 * clears a class that teaches five-year-olds that "nake" is a word.
 *
 * The checks that matter are the ones a careless edit would break: a REFUSE
 * probe that is secretly a valid rhyme, an echo probe that is not the stimulus,
 * a stimulus whose buckets do not actually cover the four guards.
 */
import { describe, expect, it } from 'vitest';
import {
  OPEN_SET_BENCH_STIMULI,
  benchPasses,
  isFalseAffirmation,
  isMissedValid,
  isSoftDisagreement,
  type OpenSetProbeResult,
} from './openSetWordBench';
import { buildDiDrivePlan } from './diDrivePlan';

const rimeOf = (family: string) => family.replace(/^-+/, '').toLowerCase();

describe('the fixture covers what the contract claims', () => {
  it('has at least the three rimes the handoff asks for, all distinct', () => {
    const rimes = OPEN_SET_BENCH_STIMULI.map((s) => rimeOf(s.rhymeFamily));
    expect(rimes.length).toBeGreaterThanOrEqual(3);
    expect(new Set(rimes).size).toBe(rimes.length);
  });

  it.each(OPEN_SET_BENCH_STIMULI)('$id probes every guard in the wrong clause', (stimulus) => {
    const buckets = new Set(stimulus.probes.map((p) => p.bucket));
    // One bucket per guard in `openWrongClause`. A guard with no probe is a
    // clause nothing ever checks.
    for (const required of ['echo', 'nonword', 'onset-only', 'off-task'] as const) {
      expect(buckets).toContain(required);
    }
    // …and both sides of the accept clause: the obvious rhyme and the one the
    // judge probably did not think of first.
    expect(buckets).toContain('valid-common');
    expect(buckets).toContain('valid-uncommon');
  });

  it.each(OPEN_SET_BENCH_STIMULI)('$id is weighted toward the WRONG answers', (stimulus) => {
    const refuse = stimulus.probes.filter((p) => p.expect === 'refuse').length;
    const affirm = stimulus.probes.filter((p) => p.expect === 'affirm').length;
    // The asymmetry is the design: a missed valid rhyme costs a turn, a false
    // affirmation teaches the error, so the bench spends its probes there.
    expect(refuse).toBeGreaterThan(affirm);
  });

  it.each(OPEN_SET_BENCH_STIMULI)('$id echoes exactly the stimulus word', (stimulus) => {
    const echo = stimulus.probes.filter((p) => p.bucket === 'echo');
    expect(echo).toHaveLength(1);
    // An "echo" probe that is not the target word is testing something else
    // entirely, and the run record would name the wrong failure.
    expect(echo[0].text).toBe(stimulus.targetWord);
    expect(echo[0].expect).toBe('refuse');
  });

  /**
   * THE ONE THAT WOULD ACTUALLY BITE. Deriving REFUSE probes by rule is the
   * tempting shortcut and it lies: rime "ip" plus onset "z" is "zip", a real
   * word. This cannot check a dictionary, but it can check the failure that
   * dictionary error would PRODUCE — a word filed as both valid and invalid.
   */
  it.each(OPEN_SET_BENCH_STIMULI)('$id never files one word in two buckets', (stimulus) => {
    const seen = new Map<string, string>();
    for (const probe of stimulus.probes) {
      const key = probe.text.toLowerCase();
      const prior = seen.get(key);
      expect(prior, `"${probe.text}" is filed as both ${prior} and ${probe.bucket}`)
        .toBeUndefined();
      seen.set(key, probe.bucket);
    }
  });

  it.each(OPEN_SET_BENCH_STIMULI)('$id marks ONLY the two ambiguous buckets soft', (stimulus) => {
    // `soft` exempts a probe from the hard gate, so it must stay confined to the
    // buckets where BOTH answers are defensible — anywhere else it is a quiet
    // way to stop a real failure from counting.
    //   near-rime   whether "hack" rhymes with "hat" depends on how strict a
    //               rime you teach.
    //   proper-noun a name IS a real word that rhymes ("Bill"/"hill"), so it
    //               must be affirmed — but a five-year-old saying "zell" most
    //               likely means nonsense, and nothing in the audio separates
    //               the two. This bucket exists because the first bench run
    //               filed "zell" as a nonword and blocked the class on it.
    const ambiguous = ['near-rime', 'proper-noun'];
    for (const probe of stimulus.probes) {
      if (probe.soft) expect(ambiguous).toContain(probe.bucket);
      if (ambiguous.includes(probe.bucket)) expect(probe.soft).toBe(true);
    }
  });

  it.each(OPEN_SET_BENCH_STIMULI)('$id keeps names on the AFFIRM side', (stimulus) => {
    // The correction the run forced: refusing names to be safe about nonwords
    // fails real answers to catch invented ones.
    for (const probe of stimulus.probes.filter((p) => p.bucket === 'proper-noun')) {
      expect(probe.expect).toBe('affirm');
    }
  });

  it('gives every probe a stated reason', () => {
    for (const stimulus of OPEN_SET_BENCH_STIMULI) {
      for (const probe of stimulus.probes) {
        // The run record prints `why` beside a miss. An empty one makes a
        // failure unreadable six weeks later.
        expect(probe.why.length).toBeGreaterThan(10);
      }
    }
  });
});

describe('the gate is asymmetric, in code', () => {
  const result = (over: Partial<OpenSetProbeResult['probe']> & { observed: 'affirm' | 'refuse' | null }) => ({
    stimulusId: 'bench-at-hat',
    targetWord: 'hat',
    said: '',
    observed: over.observed,
    probe: {
      text: over.text ?? 'zat',
      bucket: over.bucket ?? ('nonword' as const),
      expect: over.expect ?? ('refuse' as const),
      why: over.why ?? 'why',
      soft: over.soft,
    },
  }) as OpenSetProbeResult;

  it('an affirmed nonword fails the whole run', () => {
    const rows = [result({ observed: 'affirm' })];
    expect(isFalseAffirmation(rows[0])).toBe(true);
    expect(benchPasses(rows)).toBe(false);
  });

  it('a missed valid rhyme does NOT fail the run', () => {
    const rows = [result({ observed: 'refuse', bucket: 'valid-common', expect: 'affirm', text: 'cat' })];
    expect(isMissedValid(rows[0])).toBe(true);
    expect(isFalseAffirmation(rows[0])).toBe(false);
    expect(benchPasses(rows)).toBe(true);
  });

  it('a slant-rhyme disagreement is recorded, not counted', () => {
    const rows = [result({ observed: 'affirm', bucket: 'near-rime', soft: true, text: 'hack' })];
    expect(isSoftDisagreement(rows[0])).toBe(true);
    expect(isFalseAffirmation(rows[0])).toBe(false);
    expect(benchPasses(rows)).toBe(true);
  });

  it('an empty run never passes — nothing measured is not evidence', () => {
    expect(benchPasses([])).toBe(false);
  });

  it('a probe with NO verdict is not silently treated as agreement', () => {
    // The tutor said nothing the reducer could classify. That trial measured
    // nothing; counting it as a pass would let a mute session clear a class.
    const rows = [result({ observed: null, bucket: 'valid-common', expect: 'affirm', text: 'cat' })];
    expect(isMissedValid(rows[0])).toBe(true);
  });
});

describe('the bench plan builds through the REAL pack', () => {
  const plan = buildDiDrivePlan('rhyme-studio', {}, 'Grade 1', { bench: true });

  it('is marked a bench and carries one item per stimulus', () => {
    expect(plan.isBench).toBe(true);
    expect(plan.items).toHaveLength(OPEN_SET_BENCH_STIMULI.length);
    expect(plan.componentId).toBe('rhyme-studio');
  });

  it('attaches the scored key to every item', () => {
    for (const item of plan.items) {
      expect(item.responseClass).toBe('open_set_word');
      expect(item.answerKind).toBe('voice');
      expect(item.answers.probes?.length ?? 0).toBeGreaterThanOrEqual(10);
    }
  });

  it('carries the REAL cues, not a harness replica of them', () => {
    const hat = plan.items.find((i) => i.id === 'bench-at-hat')!;
    expect(hat.affirmLine).toBe('Yes, that rhymes with hat — both end with at.');
    // The GENERAL correction — the last scripted branch. The echo branch is
    // written ahead of it in the contract so the model reaches the specific
    // case before the catch-all.
    expect(hat.correctionLine).toBe(
      'My turn: listen to the end of hat — at. Your turn. Tell me a word that ends with at.',
    );
    // …and the echo branch rides in the cue, opening with the SAME sentinel so
    // the engine can classify it (the stall this fixed).
    expect(hat.cue).toContain('My turn: a word cannot rhyme with itself.');
    // The four guards ride in the cue the tutor actually receives.
    expect(hat.cue).toContain('said back is NOT correct');
    expect(hat.cue).toContain('A made-up word is NOT correct');
  });

  it('opens the run the way the runner does, then settles to the bare ask', () => {
    // Item 0 is the OPENING item, so its ask legitimately carries the greeting,
    // the how-to-play and the code-owned rule model (SWAP-1 — all inside the
    // quoted line). Asserting the bare ask on it would have been asserting a
    // bug. The steady-state ask is what every later item gets.
    const [first, second] = plan.items;
    expect(first.askLine).toContain('Hi! Time to play with rhyming words!');
    expect(first.askLine).toContain('you think of a word that rhymes with it and say it!');
    expect(first.askLine).toContain('Words rhyme when they end the same way.');
    expect(first.askLine.endsWith(
      'Listen to this word: hat. Your turn. Tell me a word that rhymes with hat.',
    )).toBe(true);

    expect(second.askLine).toBe(
      'Listen to this word: cake. Your turn. Tell me a word that rhymes with cake.',
    );
  });

  it('models the rule on a pair from OUTSIDE the bench rimes', () => {
    // `pickModelRhymePair` excludes by FAMILY, not just by word: a model pair
    // drawn from -at would hand away every -at item in the run. The fixture's
    // six rimes must therefore leave it a clean pair to teach with.
    const opening = plan.items[0].askLine;
    const rimes = OPEN_SET_BENCH_STIMULI.map((s) => rimeOf(s.rhymeFamily));
    const modelRime = opening.match(/both end with (\w+)\./)?.[1];
    expect(modelRime).toBeTruthy();
    expect(rimes).not.toContain(modelRime);
  });

  it('passes the pack gates cleanly now the class is benched', () => {
    // For the length of the bench this asserted the OPPOSITE — the validator
    // refused the very class under test, and that line was the honest label on
    // the run. The bench passed 2026-08-19, so the label is gone. Left as a
    // live assertion rather than deleted: it is what would catch the class
    // being pushed back to `blocked` without the fixture following it.
    expect(plan.packGateIssues).toEqual([]);
  });

  it('never sends a generated word into a bench cue', () => {
    // The fixture supplies no acceptableAnswers at all, so there is nothing to
    // leak — but the assertion is on the CUE, which is what the tutor reads.
    for (const item of plan.items) {
      expect(item.answers.leakTokens).toEqual([]);
    }
  });

  it('refuses a bench on a port with no fixture, by name', () => {
    expect(() => buildDiDrivePlan('ten-frame', {}, 'Kindergarten', { bench: true }))
      .toThrow(/no bench fixture/);
  });
});

describe('the ordinary drive path — the adapter is not bench-only', () => {
  /**
   * rhyme-studio shipped its judged loop in August with NO drive adapter, so
   * `--di` could never reach it. Registering one for the bench also opens the
   * three CLOSED modes to headless driving for the first time, and that half
   * has to keep working whatever the bench decides about `open_set_word`.
   */
  const plan = buildDiDrivePlan('rhyme-studio', {
    supportTier: 'medium',
    challenges: [
      {
        id: 'r1', mode: 'recognition', targetWord: 'cat', rhymeFamily: '-at',
        comparisonWord: 'hat', doesRhyme: true,
      },
      {
        id: 'p1', mode: 'production', targetWord: 'sun', rhymeFamily: '-un',
        acceptableAnswers: ['bun', 'run'], bankDistractors: ['dog', 'book', 'milk'],
      },
    ],
  }, 'Grade 1');

  it('builds a real generation with no bench flag and passes every pack gate', () => {
    expect(plan.isBench).toBe(false);
    // `production` is `open_set_word` since the bank was deleted (2026-08-19).
    expect(plan.items.map((i) => i.responseClass)).toEqual(['yes_no', 'open_set_word']);
    expect(plan.packGateIssues).toEqual([]);
  });

  it('gives the headless student a right and a wrong answer per item', () => {
    const [recognition, production] = plan.items;
    expect(recognition.answers.correct).toBe('yes');
    expect(recognition.answers.plainWrong).toBe('no');
    // The signature miss is the same one in both: the stimulus said back.
    expect(recognition.answers.signatureWrong?.text).toBe('cat');
    expect(production.answers.signatureWrong?.text).toBe('sun');
    /**
     * ⭐ THE ANSWER CAME FROM THE BENCH FIXTURE, MATCHED BY RIME.
     *
     * This generated `-un` item is not a bench stimulus, and an OPEN item has
     * no answer of its own to carry. The generator's `acceptableAnswers` is the
     * list that has contained the nonword "NAKE", so taking `correct` from it
     * would make the harness expect an AFFIRM on a nonword and score the
     * judge's correct refusal as a failure. The fixture's hand-checked rhymes
     * are the only trustworthy source — harness material, never spoken.
     */
    expect(production.answers.correct).toBe('fun');
  });

  it('refuses to invent an answer for a rime the fixture does not cover', () => {
    // Silence beats a guess: an uncovered open item is UNDRIVABLE by the plain
    // drive and says so, rather than shipping a fabricated `correct`. Drive it
    // with --di-bench, or extend the fixture with that rime.
    const uncovered = buildDiDrivePlan('rhyme-studio', {
      challenges: [{ id: 'x', mode: 'production', targetWord: 'blue', rhymeFamily: '-ue' }],
    }, 'Grade 1');
    expect(uncovered.items[0].answers.correct).toBe('');
  });
});
