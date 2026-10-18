/**
 * The bench's own gates — because a bench whose KEY is wrong is worse than no
 * bench at all (openSetWordBench.test.ts states the argument; the `zell`
 * miskey is the evidence).
 *
 * What a careless edit would break here: a REFUSE probe that is secretly a
 * paraphrase, an echo probe that is not the stimulus, a fixture item the
 * shipped build gate would DROP (which would silently thin the bench), and a
 * `soft` mark on a bucket where being wrong teaches a child something false.
 */
import { describe, expect, it } from 'vitest';
import {
  CONCEPT_BENCH_STIMULI,
  CONCEPT_HARD_REFUSE_BUCKETS,
  PARAPHRASE_AFFIRM_FLOOR,
  allConceptProbes,
  conceptBenchPasses,
  paraphraseAffirmRate,
} from './conceptStatementBench';
import { benchPasses, isFalseAffirmation, type OpenSetProbeResult } from './openSetWordBench';
import {
  buildSpokenItem,
  findConceptDefects,
  gateSpokenItems,
} from '../../../primitives/visual-primitives/direct-instruction/diSpokenPracticeScript';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

describe('the fixture covers what the contract claims', () => {
  it('has at least four stimuli across BOTH sub-shapes', () => {
    // One shape alone could pass 13/13 and hide a contract gap on the other:
    // the session-wide concept (ah5w) and the per-item rule (f00i) are the two
    // frozen failures, and each needs its own evidence.
    expect(CONCEPT_BENCH_STIMULI.length).toBeGreaterThanOrEqual(4);
    const shapes = new Set(CONCEPT_BENCH_STIMULI.map((s) => s.shape));
    expect(shapes).toEqual(new Set(['session-wide', 'per-item']));
    const ids = CONCEPT_BENCH_STIMULI.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(CONCEPT_BENCH_STIMULI)('$id probes every refusal the class records, and every valid form', (s) => {
    const buckets = new Set(s.probes.map((p) => p.bucket));
    for (const required of CONCEPT_HARD_REFUSE_BUCKETS) expect(buckets).toContain(required);
    for (const required of ['valid-canonical', 'valid-paraphrase', 'valid-childlike', 'valid-partial'] as const) {
      expect(buckets).toContain(required);
    }
    // The floor is measured per run, so each stimulus must supply at least two
    // paraphrases or a single miss would swing it by 50%.
    expect(s.probes.filter((p) => p.bucket === 'valid-paraphrase').length).toBeGreaterThanOrEqual(2);
  });

  it.each(CONCEPT_BENCH_STIMULI)('$id is weighted toward the WRONG answers', (s) => {
    const refuse = s.probes.filter((p) => p.expect === 'refuse').length;
    const affirm = s.probes.filter((p) => p.expect === 'affirm').length;
    expect(refuse).toBeGreaterThan(affirm);
  });

  it.each(CONCEPT_BENCH_STIMULI)('$id echoes the whole stimulus and nothing beyond it', (s) => {
    const echo = s.probes.filter((p) => p.bucket === 'echo');
    expect(echo).toHaveLength(1);
    // Digits in the printed instance are spoken as words and operators are
    // spoken as words too ("plus", "equals"); the echo probe is what a child
    // SAYS, so the check is that every content token of the instance is in it
    // and that it adds no idea word the fixture's own accept clause would count.
    const words: Record<string, string> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 8: 'eight', 10: 'ten' };
    const said = new Set(norm(echo[0].text).split(' '));
    for (const token of norm(s.raw.stimulusText).split(' ')) {
      expect(said, `echo for ${s.id} omits "${token}"`).toContain(words[token] ?? token);
    }
    // "plus" and "equals" are how the operators are SPOKEN, not idea words.
    for (const idea of ['same', 'repeat', 'over', 'again', 'add', 'more', 'match', 'both']) {
      if (!norm(s.raw.stimulusText).includes(idea)) {
        expect(said, `echo for ${s.id} adds the idea word "${idea}"`).not.toContain(idea);
      }
    }
    expect(echo[0].expect).toBe('refuse');
  });

  it.each(CONCEPT_BENCH_STIMULI)('$id keeps every paraphrase free of the anchor PHRASES', (s) => {
    // The bucket's definition. A "paraphrase" that contains an anchor is a
    // canonical probe filed under the wrong name, and it would inflate the
    // floor this class is gated on.
    const anchors = [s.raw.expectedAnswer, ...s.raw.alsoAccept.split(',')].map(norm).filter(Boolean);
    for (const p of s.probes.filter((p) => p.bucket === 'valid-paraphrase')) {
      const text = ` ${norm(p.text)} `;
      for (const a of anchors) expect(text, `"${p.text}" contains anchor "${a}"`).not.toContain(` ${a} `);
    }
  });

  it.each(CONCEPT_BENCH_STIMULI)('$id never files one utterance in two buckets', (s) => {
    const seen = new Map<string, string>();
    for (const probe of s.probes) {
      const key = norm(probe.text);
      const prior = seen.get(key);
      expect(prior, `"${probe.text}" is filed as both ${prior} and ${probe.bucket}`).toBeUndefined();
      seen.set(key, probe.bucket);
    }
  });

  it.each(CONCEPT_BENCH_STIMULI)('$id marks ONLY the half-answer bucket soft', (s) => {
    // `soft` exempts a probe from the hard gate, so it stays confined to the
    // one bucket where both verdicts are defensible: "same" for "what does =
    // mean?" is half an idea. Every REFUSE bucket is hard — a false affirmation
    // in any of them teaches a child that the sum, the next number, or the
    // opposite claim IS the explanation.
    for (const probe of s.probes) {
      if (probe.soft) expect(probe.bucket).toBe('valid-partial');
      if (probe.bucket === 'valid-partial') expect(probe.soft).toBe(true);
    }
  });

  it('gives every probe a stated reason', () => {
    for (const s of CONCEPT_BENCH_STIMULI) {
      for (const probe of s.probes) expect(probe.why.length).toBeGreaterThan(10);
    }
  });

  it('carries the ~11-per-stimulus key the handoff sizes the run on', () => {
    expect(allConceptProbes()).toBeGreaterThanOrEqual(CONCEPT_BENCH_STIMULI.length * 11);
  });
});

describe('the fixture survives the SHIPPED build gate', () => {
  /**
   * The bench must go through `buildSpokenItem` + `gateSpokenItems` — the
   * exact gate a generated item passes — or it benches a contract the
   * primitive does not use. So every fixture item must SURVIVE that gate: a
   * dropped one would silently thin the bench and the run would read as "3/4
   * stimuli pass" with nobody asking where the fourth went.
   */
  it.each(CONCEPT_BENCH_STIMULI)('$id builds, places in concept_statement, and passes every content gate', (s) => {
    const item = buildSpokenItem(s.raw, 0, 'explain_concept');
    expect(item).not.toBeNull();
    expect(item!.responseClass).toBe('concept_statement');
    expect(item!.conceptStatement).toBe(s.raw.conceptStatement);
    expect(findConceptDefects([item!])).toEqual([]);
    const { dropped } = gateSpokenItems([item!]);
    expect(dropped).toEqual([]);
  });
});

describe('the gate is asymmetric AND floored, in code', () => {
  const result = (over: Partial<OpenSetProbeResult['probe']> & { observed: 'affirm' | 'refuse' | null }) => ({
    stimulusId: 'bench-concept-equal-sign',
    targetWord: '3 + 2 = 5',
    said: '',
    observed: over.observed,
    probe: {
      text: over.text ?? 'five',
      bucket: over.bucket ?? ('answer-not-explanation' as const),
      expect: over.expect ?? ('refuse' as const),
      why: over.why ?? 'why',
      soft: over.soft,
    },
  }) as OpenSetProbeResult;
  const paraphrase = (observed: 'affirm' | 'refuse' | null, text = 'they match') =>
    result({ observed, bucket: 'valid-paraphrase', expect: 'affirm', text });

  it('an affirmed sum fails the whole run', () => {
    const rows = [result({ observed: 'affirm' }), paraphrase('affirm')];
    expect(isFalseAffirmation(rows[0])).toBe(true);
    expect(benchPasses(rows)).toBe(false);
    expect(conceptBenchPasses(rows)).toBe(false);
  });

  it('an affirmed negated keyword fails the whole run', () => {
    const rows = [
      result({ observed: 'affirm', bucket: 'negated-keyword', text: 'they are not the same' }),
      paraphrase('affirm'),
    ];
    expect(conceptBenchPasses(rows)).toBe(false);
  });

  it('a judge that refuses honest paraphrases does NOT clear — that is closed_set_choice in disguise', () => {
    // The family gate would pass this (nothing false was affirmed); the class
    // gate refuses it, because a judge matching wording never affirms a child
    // who has the idea in their own words.
    const rows = [
      result({ observed: 'refuse' }),
      paraphrase('refuse'), paraphrase('refuse', 'they are even'), paraphrase('affirm', 'it balances'),
    ];
    expect(benchPasses(rows)).toBe(true);
    expect(paraphraseAffirmRate(rows)).toBeCloseTo(1 / 3);
    expect(conceptBenchPasses(rows)).toBe(false);
  });

  it('clears at the floor with zero false affirmations', () => {
    const rows = [
      result({ observed: 'refuse' }),
      ...Array.from({ length: 4 }, (_, i) => paraphrase('affirm', `p${i}`)),
      paraphrase('refuse', 'p-miss'),
    ];
    expect(paraphraseAffirmRate(rows)).toBe(PARAPHRASE_AFFIRM_FLOOR);
    expect(conceptBenchPasses(rows)).toBe(true);
  });

  it('a soft half-answer disagreement is recorded, not counted', () => {
    const rows = [
      result({ observed: 'refuse', bucket: 'valid-partial', expect: 'affirm', soft: true, text: 'same' }),
      paraphrase('affirm'),
    ];
    expect(conceptBenchPasses(rows)).toBe(true);
  });

  it('a paraphrase with NO verdict is not silently treated as affirmed', () => {
    const rows = [result({ observed: 'refuse' }), paraphrase(null)];
    expect(paraphraseAffirmRate(rows)).toBe(0);
    expect(conceptBenchPasses(rows)).toBe(false);
  });

  it('an empty run never passes', () => {
    expect(conceptBenchPasses([])).toBe(false);
  });
});
