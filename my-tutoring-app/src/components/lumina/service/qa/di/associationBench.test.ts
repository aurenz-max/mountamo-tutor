/**
 * associationBench — the KEY is the instrument, so the key is what gets tested.
 *
 * ⚠️⚠️ WHY THIS FILE EXISTS AT ALL. On 2026-08-19 the rhyme bench produced three
 * confident, well-formatted findings that pointed at the wrong component, and
 * two of them read as product failures until someone re-read the key. A
 * miskeyed probe does not fail loudly — it silently converts a correct tutor
 * verdict into a recorded defect, and one of them (`zell`, a surname filed as a
 * nonword) BLOCKED AN ENTIRE RESPONSE CLASS until the user pushed back.
 *
 * So these assertions are not about the judge. They are about whether the
 * fixture can be trusted to score one, and they are the cheapest place to catch
 * the errors that are otherwise found at the cost of a live run.
 */
import { describe, it, expect } from 'vitest';
import {
  ASSOCIATION_BENCH_STIMULI,
  HARD_REFUSE_BUCKETS,
  allAssociationProbes,
} from './associationBench';
import { isFalseAffirmation, type OpenSetProbeResult } from './openSetWordBench';

describe('associationBench · the key is well-formed', () => {
  it('covers at least 3 stimuli over DIFFERENT relation types', () => {
    // The handoff asks for >=3 so the result is a verdict about the RULE
    // rather than about one lucky pair.
    expect(ASSOCIATION_BENCH_STIMULI.length).toBeGreaterThanOrEqual(3);
    const bases = ASSOCIATION_BENCH_STIMULI.map((s) => s.baseWord);
    expect(new Set(bases).size).toBe(bases.length);
  });

  it('gives every stimulus all three NEW guards plus the three ported ones', () => {
    // Each bucket maps to one clause of `wrongClauseFor` in
    // pictureVocabularyScript.ts. A stimulus missing one is a stimulus that
    // cannot detect the failure that clause claims to prevent.
    for (const s of ASSOCIATION_BENCH_STIMULI) {
      const buckets = new Set(s.probes.map((p) => p.bucket));
      for (const required of [
        'partner',            // the generated partner            AFFIRM
        'partner-unlisted',   // the §2.2 ruling                  AFFIRM
        'echo',               // ported from rhyme                REFUSE
        'nonword',            // ported from rhyme                REFUSE
        'off-task',           // ported from rhyme                REFUSE
        'rationalised-chain', // NEW — the signature failure      REFUSE
        'same-category',      // NEW                              REFUSE
        'category-word',      // NEW                              REFUSE
      ]) {
        expect(buckets, `${s.id} is missing the "${required}" bucket`).toContain(required);
      }
    }
  });

  it('weights the REFUSE side, and the chain bucket most of all', () => {
    /**
     * The two errors are not symmetric: a missed honest partner costs the child
     * one more turn, an affirmed rationalisation teaches that anything goes
     * with anything. The key has to spend its probes accordingly, and the
     * rationalised chain is the failure with no rhyme analogue.
     */
    for (const s of ASSOCIATION_BENCH_STIMULI) {
      const refuse = s.probes.filter((p) => p.expect === 'refuse').length;
      const affirm = s.probes.filter((p) => p.expect === 'affirm').length;
      expect(refuse, `${s.id} must probe more wrong answers than right ones`).toBeGreaterThan(affirm);
      expect(s.probes.filter((p) => p.bucket === 'rationalised-chain').length)
        .toBeGreaterThanOrEqual(2);
    }
  });

  it('affirms the generated partner and at least two UNLISTED ones per stimulus', () => {
    // The unlisted-partner bucket IS ruling §2.2, and it is the only probe that
    // catches a judge quietly re-closing the set around its own first guess.
    for (const s of ASSOCIATION_BENCH_STIMULI) {
      const partner = s.probes.filter((p) => p.bucket === 'partner');
      expect(partner).toHaveLength(1);
      expect(partner[0].text).toBe(s.partnerWord);
      expect(partner[0].expect).toBe('affirm');

      const unlisted = s.probes.filter((p) => p.bucket === 'partner-unlisted');
      expect(unlisted.length).toBeGreaterThanOrEqual(2);
      for (const p of unlisted) {
        expect(p.expect).toBe('affirm');
        // An "unlisted" partner that IS the listed one tests nothing.
        expect(p.text.toLowerCase()).not.toBe(s.partnerWord.toLowerCase());
      }
    }
  });

  it('keys every echo probe to its OWN stimulus, never a borrowed one', () => {
    /**
     * ⚠️ THE THIRD MISKEY OF ITEM 24, PRE-EMPTED. On the rhyme bench an echo
     * probe borrowed across stimuli ("hat" carried onto a `cat` item) was a
     * perfectly VALID answer, the tutor affirmed it correctly, and the run
     * filed di-false-affirm against the tutor for the harness's mistake.
     *
     * The echo needs no fixture material at all: by definition it is the
     * stimulus said back.
     */
    for (const s of ASSOCIATION_BENCH_STIMULI) {
      const echo = s.probes.filter((p) => p.bucket === 'echo');
      expect(echo).toHaveLength(1);
      expect(echo[0].text.toLowerCase()).toBe(s.baseWord.toLowerCase());
      expect(echo[0].expect).toBe('refuse');
    }
  });

  it('never files a stimulus OWN correct partner in a REFUSE bucket', () => {
    // The `signatureWrong`-borrowing miskey, generalised: any REFUSE probe that
    // equals this stimulus's own known-good answer would score a correct AFFIRM
    // as a false affirmation and block the mode on our error.
    for (const s of ASSOCIATION_BENCH_STIMULI) {
      for (const p of s.probes.filter((x) => x.expect === 'refuse')) {
        expect(p.text.toLowerCase(), `${s.id}: "${p.text}" is this item's own partner`)
          .not.toBe(s.partnerWord.toLowerCase());
      }
    }
  });

  it('marks the genuinely arguable calls SOFT, and only those', () => {
    /**
     * Where the author is unsure, the probe is recorded and not counted — that
     * is what the bucket is for, and it is the discipline that stops the bench
     * measuring OUR taste instead of the judge's reliability.
     *
     * The centre of each guard must stay HARD, or the gate stops biting.
     */
    const soft = allAssociationProbes().filter(({ probe }) => probe.soft);
    expect(soft.length).toBeGreaterThan(0);
    expect(soft.length).toBeLessThan(allAssociationProbes().length * 0.2);
    // The echo and the empty-chain probes are never arguable.
    for (const { probe } of allAssociationProbes()) {
      if (probe.bucket === 'echo' || probe.bucket === 'category-word') {
        expect(probe.soft, `"${probe.text}" (${probe.bucket}) must be a hard call`).toBeFalsy();
      }
    }
  });

  it('gives every probe a why that a run record can print beside a miss', () => {
    for (const { stimulusId, probe } of allAssociationProbes()) {
      expect(probe.why.length, `${stimulusId}/"${probe.text}" needs a real why`)
        .toBeGreaterThan(20);
    }
  });

  it('scores a false affirmation in every hard REFUSE bucket, and not in a soft one', () => {
    // The gate itself, exercised — `isFalseAffirmation` is shared with the
    // rhyme bench, so this pins that the new buckets ride it correctly.
    for (const bucket of HARD_REFUSE_BUCKETS) {
      const probe = allAssociationProbes()
        .find(({ probe: p }) => p.bucket === bucket && !p.soft)?.probe;
      expect(probe, `no hard probe in bucket "${bucket}"`).toBeDefined();
      const result: OpenSetProbeResult = {
        stimulusId: 'x', targetWord: 'x', probe: probe!, observed: 'affirm', said: '',
      };
      expect(isFalseAffirmation(result)).toBe(true);
    }

    const softProbe = allAssociationProbes().find(({ probe }) => probe.soft)!.probe;
    expect(isFalseAffirmation({
      stimulusId: 'x', targetWord: 'x', probe: softProbe, observed: 'affirm', said: '',
    })).toBe(false);
  });
});
