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

describe('the bench drive', () => {
  // rhyme-studio's DI_PORTS row, this fixture's only port, was deleted when the family moved to the boss framework
  // (2026-10-20): its drive replayed scripted cues the tutor no longer receives. The fixture above stays as the key.
  it('refuses a bench on a port with no fixture, by name', () => {
    expect(() => buildDiDrivePlan('ten-frame', {}, 'Kindergarten', { bench: true }))
      .toThrow(/no bench fixture/);
  });
});
