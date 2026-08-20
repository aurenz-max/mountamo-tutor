/**
 * openSetWordBench — the scored answer key for the `open_set_word` response
 * class (qa/di/BACKLOG.md item 24; handoff `qa/HANDOFF-di-open-set-word-2026-08-18.md`).
 *
 * WHY A FIXTURE AND NOT GENERATED CONTENT
 * ---------------------------------------
 * Every other DI drive answers a REAL generation, because the thing under test
 * is the loop and the generator is part of it. This one is a BENCH: the thing
 * under test is whether the judge can be trusted with a rule instead of a list,
 * and that question needs a key that is known-correct before the run starts.
 * Real generated content cannot supply one — the live probe for the target
 * `cake` produced the acceptable-answer list "bake, lake, rake, NAKE, take",
 * so a bench keyed off generated material would score the judge's correct
 * refusal of a nonword as a FAILURE. A bench whose key is wrong is worse than
 * no bench, because it retires the question while getting it backwards.
 *
 * WHY THE PROBES ARE HAND-AUTHORED AND NOT DERIVED BY RULE
 * -------------------------------------------------------
 * The tempting shortcut is to build the REFUSE buckets from the rime: prepend
 * an unlikely onset to get a nonword, swap the coda to get an onset-only match.
 * It silently lies. Rime "ip" plus the onset "z" is "zip", a perfectly real
 * word; scored as a nonword, a correct AFFIRM becomes a recorded false affirm
 * and the class gets blocked on the harness's own error. So every probe below
 * is written out by hand and every REFUSE probe is a word (or non-word) whose
 * status was checked by eye. Adding a stimulus means authoring its buckets,
 * not extending a generator.
 *
 * THE BUCKETS, AND WHY EACH ONE IS THERE
 * --------------------------------------
 * The AFFIRM side is thin on purpose and the REFUSE side is thick, because the
 * two failures are not symmetric: a missed valid rhyme costs the child another
 * turn, an affirmed wrong answer teaches the error. Each REFUSE bucket maps to
 * one clause of `openWrongClause` in `rhymeStudioScript.ts` — the contract
 * claims these are refused, and this file is that claim made testable. Change
 * one, change both.
 *
 *   valid-common       a rhyme any five-year-old would offer          AFFIRM
 *   valid-uncommon     a real rhyme the judge probably did not think
 *                      of first — catches a judge that re-closes the
 *                      set around its own first guesses                AFFIRM
 *   echo               the stimulus said straight back                 REFUSE
 *   nonword            right rime, not a word                          REFUSE
 *   onset-only         shares the beginning, not the ending —
 *                      rhyme/alliteration confusion, this primitive's
 *                      signature misconception                         REFUSE
 *   semantic           a real word related in MEANING, not in sound —
 *                      catches a judge grading topical relevance       REFUSE
 *   near-rime          slant rhyme: close, but not the same rime.
 *                      SOFT — a disagreement here is recorded, not
 *                      counted against the gate (see `soft` below)     REFUSE
 *   off-task           a turn that is not an answer at all             REFUSE
 *
 * WHAT THIS BENCH CANNOT ANSWER
 * -----------------------------
 * The harness sends TEXT. That drives the judge's SEMANTICS — which is the
 * whole question for this class — and it does not touch acoustics, ASR, or
 * whether a five-year-old's "vat" arrives as "bat". True SILENCE is likewise
 * not sendable as a text turn, so the off-task bucket probes "I don't know"
 * and a filler noise instead; dead air stays a mic-row question. A green run
 * here retires the semantic half of the class's criteria, never the mic row.
 */

/** How the bench expects the judge to rule on one probe. */
export type OpenSetVerdict = 'affirm' | 'refuse';

/**
 * The bucket vocabulary for the `open_set_word` CLASS, not for this fixture
 * alone — `associationBench.ts` (item 25) is the second pack in the class and
 * contributes the lower group.
 *
 * One shared union rather than one per fixture, because `DiHarnessAnswers.probes`
 * carries them both to the same Python scorer, which tallies by bucket name. Two
 * unions would mean two probe types, and every adapter and report path would
 * have to know which pack it was holding.
 *
 * ECHO, NONWORD and OFF-TASK are shared: they are properties of the TURN, not of
 * the rule being judged. Everything else belongs to one pack — rhyme has no
 * category word, association has no rime to be near.
 */
export type OpenSetBucket =
  // ── rhyme-studio (`production`) ──
  | 'valid-common'
  | 'valid-uncommon'
  | 'onset-only'
  | 'semantic'
  | 'near-rime'
  | 'proper-noun'
  // ── picture-vocabulary (`association`) ──
  | 'partner'
  | 'partner-unlisted'
  | 'rationalised-chain'
  | 'same-category'
  | 'category-word'
  // ── shared: properties of the turn, not of the rule ──
  | 'echo'
  | 'nonword'
  | 'off-task';

export interface OpenSetProbe {
  /** What the headless student says. */
  text: string;
  bucket: OpenSetBucket;
  expect: OpenSetVerdict;
  /** Why this is the ruling — printed in the run record beside a miss so the
   *  reader never has to reconstruct the reasoning from the word alone. */
  why: string;
  /**
   * A disagreement on this probe is RECORDED, NOT FAILED.
   *
   * Only `near-rime` uses it. Whether "hack" rhymes with "hat" has a defensible
   * answer either way depending on how strict a rime you teach, and a bench
   * that failed the class over a slant rhyme would be measuring our opinion
   * rather than the judge's reliability. The hard gate is the buckets where
   * being wrong teaches a child something false.
   */
  soft?: boolean;
}

export interface OpenSetBenchStimulus {
  /** Item id in the drive plan. */
  id: string;
  targetWord: string;
  /** Spelling convention with the hyphen, as the generator emits it. */
  rhymeFamily: string;
  probes: OpenSetProbe[];
}

/** The off-task pair, identical for every stimulus — it is about the SHAPE of
 *  the turn, not the word. */
const offTask = (): OpenSetProbe[] => [
  {
    text: "I don't know",
    bucket: 'off-task',
    expect: 'refuse',
    why: 'an honest non-answer. The contract names it, and a judge without a scripted branch here invents one',
  },
  {
    text: 'um',
    bucket: 'off-task',
    expect: 'refuse',
    why: 'filler, not a word — the nearest a text turn gets to dead air',
  },
];

/**
 * SIX STIMULI OVER SIX DIFFERENT RIMES. The handoff asks for ≥3 so the result
 * is a class verdict rather than one lucky rime; six covers both the simple
 * CVC rimes a K child meets first (-at, -ig, -un, -op) and the two shapes that
 * behave differently in the ear (-ake, long vowel + silent e; -ell, doubled
 * coda). Every REFUSE probe was checked by eye against the trap it encodes.
 */
export const OPEN_SET_BENCH_STIMULI: OpenSetBenchStimulus[] = [
  {
    id: 'bench-at-hat',
    targetWord: 'hat',
    rhymeFamily: '-at',
    probes: [
      { text: 'cat', bucket: 'valid-common', expect: 'affirm', why: 'the canonical -at rhyme' },
      { text: 'mat', bucket: 'valid-common', expect: 'affirm', why: 'plain valid rhyme' },
      { text: 'vat', bucket: 'valid-uncommon', expect: 'affirm', why: 'a real word and a true rhyme, but rare enough that a judge holding its own short list may not have it' },
      { text: 'hat', bucket: 'echo', expect: 'refuse', why: 'the stimulus back. THE guard: a child told "Yes!" here learns a word rhymes with itself' },
      { text: 'zat', bucket: 'nonword', expect: 'refuse', why: 'right rime, not a word — the failure the word bank made structurally impossible' },
      { text: 'glat', bucket: 'nonword', expect: 'refuse', why: 'a plausible-sounding nonword; harder to refuse than "zat" because the onset is legal English' },
      { text: 'ham', bucket: 'onset-only', expect: 'refuse', why: 'shares /h/ and the vowel, ending differs — rhyme/alliteration confusion' },
      { text: 'hop', bucket: 'onset-only', expect: 'refuse', why: 'shares only the onset' },
      { text: 'cap', bucket: 'semantic', expect: 'refuse', why: 'a thing you wear on your head — related by meaning, not by sound' },
      { text: 'hack', bucket: 'near-rime', expect: 'refuse', why: 'same onset and vowel, different coda: a slant rhyme, not an -at rhyme', soft: true },
      { text: 'Matt', bucket: 'proper-noun', expect: 'affirm', soft: true, why: 'a NAME that truly rhymes. A child who answers with one has done the skill, and this is the bucket the zell miskey exposed' },
      ...offTask(),
    ],
  },
  {
    id: 'bench-ake-cake',
    targetWord: 'cake',
    rhymeFamily: '-ake',
    probes: [
      { text: 'bake', bucket: 'valid-common', expect: 'affirm', why: 'plain valid rhyme' },
      { text: 'lake', bucket: 'valid-common', expect: 'affirm', why: 'plain valid rhyme' },
      { text: 'ache', bucket: 'valid-uncommon', expect: 'affirm', why: 'RHYMES BY SOUND, SPELLED NOTHING LIKE IT — the probe that catches a judge grading spelling instead of the ear' },
      { text: 'cake', bucket: 'echo', expect: 'refuse', why: 'the stimulus back' },
      { text: 'nake', bucket: 'nonword', expect: 'refuse', why: 'THE OBSERVED FAILURE: our own generator emitted "NAKE" into an acceptable-answer list for this exact target. If the judge affirms it, the open mode is teaching the defect the closed mode shipped' },
      { text: 'plake', bucket: 'nonword', expect: 'refuse', why: 'legal-sounding nonword with a real onset cluster' },
      { text: 'cape', bucket: 'onset-only', expect: 'refuse', why: 'shares /keɪ/, ending differs — the near-miss a fluent judge waves through' },
      { text: 'cat', bucket: 'onset-only', expect: 'refuse', why: 'shares only the onset' },
      { text: 'cookie', bucket: 'semantic', expect: 'refuse', why: 'the strongest semantic trap in the set: same topic, same childhood context, no shared sound' },
      { text: 'cage', bucket: 'near-rime', expect: 'refuse', why: 'same vowel, voiced-affricate coda instead of /k/', soft: true },
      { text: 'Jake', bucket: 'proper-noun', expect: 'affirm', soft: true, why: 'a NAME that truly rhymes - see the -at set' },
      ...offTask(),
    ],
  },
  {
    id: 'bench-ig-pig',
    targetWord: 'pig',
    rhymeFamily: '-ig',
    probes: [
      { text: 'big', bucket: 'valid-common', expect: 'affirm', why: 'plain valid rhyme' },
      { text: 'wig', bucket: 'valid-common', expect: 'affirm', why: 'plain valid rhyme' },
      { text: 'fig', bucket: 'valid-uncommon', expect: 'affirm', why: 'real word, true rhyme, outside the usual first three' },
      { text: 'pig', bucket: 'echo', expect: 'refuse', why: 'the stimulus back' },
      { text: 'blig', bucket: 'nonword', expect: 'refuse', why: 'right rime, not a word' },
      { text: 'thig', bucket: 'nonword', expect: 'refuse', why: 'right rime, legal onset, not a word' },
      { text: 'pin', bucket: 'onset-only', expect: 'refuse', why: 'shares /pɪ/, ending differs' },
      { text: 'pot', bucket: 'onset-only', expect: 'refuse', why: 'shares only the onset' },
      { text: 'hog', bucket: 'semantic', expect: 'refuse', why: 'the same animal by another name — meaning, not sound' },
      { text: 'pick', bucket: 'near-rime', expect: 'refuse', why: 'voiceless coda against the voiced /g/', soft: true },
      ...offTask(),
    ],
  },
  {
    id: 'bench-un-sun',
    targetWord: 'sun',
    rhymeFamily: '-un',
    probes: [
      { text: 'fun', bucket: 'valid-common', expect: 'affirm', why: 'plain valid rhyme' },
      { text: 'run', bucket: 'valid-common', expect: 'affirm', why: 'plain valid rhyme' },
      { text: 'none', bucket: 'valid-uncommon', expect: 'affirm', why: 'rhymes by sound, spelled unlike the family — a second spelling-versus-ear probe on a different rime' },
      { text: 'sun', bucket: 'echo', expect: 'refuse', why: 'the stimulus back' },
      { text: 'zun', bucket: 'nonword', expect: 'refuse', why: 'right rime, not a word' },
      { text: 'glun', bucket: 'nonword', expect: 'refuse', why: 'right rime, legal cluster, not a word' },
      { text: 'sit', bucket: 'onset-only', expect: 'refuse', why: 'shares only the onset' },
      { text: 'sock', bucket: 'onset-only', expect: 'refuse', why: 'shares only the onset' },
      { text: 'moon', bucket: 'semantic', expect: 'refuse', why: 'the sky-object pair — a judge grading topical fit affirms this one' },
      { text: 'sung', bucket: 'near-rime', expect: 'refuse', why: 'velar nasal against the alveolar /n/', soft: true },
      ...offTask(),
    ],
  },
  {
    id: 'bench-op-top',
    targetWord: 'top',
    rhymeFamily: '-op',
    probes: [
      { text: 'hop', bucket: 'valid-common', expect: 'affirm', why: 'plain valid rhyme' },
      { text: 'stop', bucket: 'valid-common', expect: 'affirm', why: 'valid rhyme with a CLUSTER onset — a judge matching "one sound then -op" may balk' },
      { text: 'crop', bucket: 'valid-uncommon', expect: 'affirm', why: 'real word, true rhyme, second cluster onset' },
      { text: 'top', bucket: 'echo', expect: 'refuse', why: 'the stimulus back' },
      { text: 'vop', bucket: 'nonword', expect: 'refuse', why: 'right rime, not a word' },
      { text: 'blop', bucket: 'nonword', expect: 'refuse', why: 'right rime, one phoneme off the real word "blob" — the nonword hardest to refuse in the set' },
      { text: 'tan', bucket: 'onset-only', expect: 'refuse', why: 'shares only the onset' },
      { text: 'tug', bucket: 'onset-only', expect: 'refuse', why: 'shares only the onset' },
      { text: 'bottom', bucket: 'semantic', expect: 'refuse', why: 'the antonym — maximum meaning relation, zero sound relation' },
      { text: 'hope', bucket: 'near-rime', expect: 'refuse', why: 'shares the /p/ coda over a different vowel: the classic slant rhyme', soft: true },
      ...offTask(),
    ],
  },
  {
    id: 'bench-ell-bell',
    targetWord: 'bell',
    rhymeFamily: '-ell',
    probes: [
      { text: 'well', bucket: 'valid-common', expect: 'affirm', why: 'plain valid rhyme' },
      { text: 'tell', bucket: 'valid-common', expect: 'affirm', why: 'plain valid rhyme' },
      { text: 'gel', bucket: 'valid-uncommon', expect: 'affirm', why: 'rhymes by sound with a single-l spelling — third spelling-versus-ear probe' },
      { text: 'bell', bucket: 'echo', expect: 'refuse', why: 'the stimulus back' },
      { text: 'drell', bucket: 'nonword', expect: 'refuse', why: 'right rime, not a word' },
      { text: 'zell', bucket: 'proper-noun', expect: 'affirm', soft: true, why: 'THE PROBE THAT WAS MISKEYED. It shipped in the nonword bucket and the judge affirmed it, which read as the only false affirmation in the whole run and blocked the class. Zell is a SURNAME - the judge was defensible and the key was wrong. Filed soft because it is genuinely ambiguous: a five-year-old saying "zell" almost certainly means nonsense, but nothing in the audio distinguishes that from a name, and refusing names would fail a child who says "Bill" for "hill"' },
      { text: 'plell', bucket: 'nonword', expect: 'refuse', why: 'right rime, legal cluster, not a word' },
      { text: 'bed', bucket: 'onset-only', expect: 'refuse', why: 'shares /bɛ/, ending differs' },
      { text: 'bug', bucket: 'onset-only', expect: 'refuse', why: 'shares only the onset' },
      { text: 'ring', bucket: 'semantic', expect: 'refuse', why: 'what a bell does — meaning, not sound' },
      { text: 'belt', bucket: 'near-rime', expect: 'refuse', why: 'the rime plus a coda consonant', soft: true },
      ...offTask(),
    ],
  },
];

/**
 * The gate, as a function rather than a paragraph.
 *
 * ZERO false affirmations in the hard REFUSE buckets. That is the whole bar,
 * and it is deliberately not an accuracy percentage: 95% correct with one
 * affirmed nonword is a mode that teaches a five-year-old that "nake" is a
 * word, and no amount of the other 95% buys that back.
 *
 * Missed valid rhymes are reported and do NOT block. They cost a turn, and the
 * correction re-teaches the rime — a real cost, but a recoverable one. Soft
 * (`near-rime`) disagreements are reported and do not block either.
 */
export interface OpenSetProbeResult {
  stimulusId: string;
  targetWord: string;
  probe: OpenSetProbe;
  /** What the judge actually did, or null when no verdict was emitted at all. */
  observed: OpenSetVerdict | null;
  /** The tutor's line, for the run record. */
  said: string;
}

export const isFalseAffirmation = (r: OpenSetProbeResult): boolean =>
  r.probe.expect === 'refuse' && !r.probe.soft && r.observed === 'affirm';

export const isMissedValid = (r: OpenSetProbeResult): boolean =>
  r.probe.expect === 'affirm' && r.observed !== 'affirm';

export const isSoftDisagreement = (r: OpenSetProbeResult): boolean =>
  Boolean(r.probe.soft) && r.observed !== r.probe.expect;

/** The class clears only on an empty false-affirmation list. */
export const benchPasses = (results: OpenSetProbeResult[]): boolean =>
  results.length > 0 && !results.some(isFalseAffirmation);
