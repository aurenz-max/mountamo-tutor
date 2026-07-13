import type { DiagnosisEvidence } from './types';

/**
 * The golden evidence set — Phase 0 seed.
 *
 * These are canned DiagnosisEvidence packets used by the Diagnosis Lab to tune
 * the distiller before any backend exists, and (later) by `/misconception-test`
 * Probe D as the honesty regression baseline. Per PRD §5.1 this set is the
 * campaign's compounding asset: every primitive family adds its own failure
 * signatures and must-abstain cases here.
 *
 * `expectation` is the bench's ground truth for the ABSTAIN vs GENERATIVE axis:
 *  - 'generative' — a consistent wrong rule is present; the distiller SHOULD
 *    produce a student-model sentence.
 *  - 'abstain'    — weak/noisy/single-slip evidence; the distiller SHOULD
 *    write nothing. (Abstain is success.)
 *
 * The bench cannot auto-grade vagueness/leakage (that is Probe D's LLM judge);
 * `note` says what a human reviewer should look for.
 */
export interface DiagnosisScenario {
  id: string;
  label: string;
  subject: string;
  subskillId: string;
  evalMode: string;
  gradeLevel: string;
  success: false;
  score: number;
  evidence: DiagnosisEvidence;
  expectation: 'generative' | 'abstain';
  /** What a good verdict looks like / why this case is here. */
  note: string;
}

export const DIAGNOSIS_SCENARIOS: DiagnosisScenario[] = [
  // ── Clear signatures — should GENERATE ────────────────────────────────────
  {
    id: 'maya-comparison',
    label: "Maya — 'how many fewer' = the smaller number",
    subject: 'Math',
    subskillId: 'MATH-G2-OA-COMP-02',
    evalMode: 'solve_comparison',
    gradeLevel: '2',
    success: false,
    score: 33,
    evidence: {
      challengeSummary:
        'Tape-diagram comparison: Liam has 13 stickers, Ava has 8. How many fewer does Ava have than Liam?',
      expected: '5 — the difference segment between the two bars (13 − 8).',
      observed: "Answered 8 — the smaller bar's own value, placed as the answer.",
      priorAttempts: [
        { challenge: '11 vs 4 points, how many fewer', observed: '4' },
        { challenge: '15 vs 9 books, how many fewer', observed: '9' },
      ],
    },
    expectation: 'generative',
    note: 'Textbook signature: every answer is the smaller quantity itself. Verdict should predict min(a,b) and never miscalculate the subtraction.',
  },
  {
    id: 'fraction-bigger-denominator',
    label: 'Bigger denominator ⇒ bigger fraction',
    subject: 'Math',
    subskillId: 'MATH-G3-NF-COMP-01',
    evalMode: 'compare_fractions',
    gradeLevel: '3',
    success: false,
    score: 25,
    evidence: {
      challengeSummary: 'Which is greater, 1/4 or 1/8? Tap the larger fraction.',
      expected: '1/4 is greater — smaller denominator means larger equal parts.',
      observed: 'Tapped 1/8.',
      priorAttempts: [
        { challenge: '1/3 vs 1/6, tap the larger', observed: 'tapped 1/6' },
        { challenge: '1/2 vs 1/5, tap the larger', observed: 'tapped 1/5' },
      ],
    },
    expectation: 'generative',
    note: 'Whole-number transfer error: treats the denominator like a count. Verdict should say the student picks the larger denominator; distractor writes itself.',
  },
  {
    id: 'subtraction-smaller-from-larger',
    label: 'Always subtract smaller digit from larger (per column)',
    subject: 'Math',
    subskillId: 'MATH-G2-NBT-SUB-03',
    evalMode: 'multi_digit_subtraction',
    gradeLevel: '2',
    success: false,
    score: 30,
    evidence: {
      challengeSummary: 'Solve 62 − 47 using regrouping.',
      expected: '15 — regroup: 12 − 7 = 5 in the ones, 5 − 4 = 1 in the tens.',
      observed: 'Wrote 25 — did 7 − 2 = 5 in the ones column, 6 − 4 = 2 in the tens.',
      priorAttempts: [
        { challenge: '43 − 28', observed: '25' },
        { challenge: '81 − 36', observed: '55' },
      ],
    },
    expectation: 'generative',
    note: 'Classic "smaller-from-larger" column bug — ignores position, never regroups. Consistent across all three.',
  },
  {
    id: 'area-perimeter-confusion',
    label: 'Adds sides when asked for area',
    subject: 'Math',
    subskillId: 'MATH-G4-MD-AREA-01',
    evalMode: 'compute_area',
    gradeLevel: '4',
    success: false,
    score: 20,
    evidence: {
      challengeSummary: 'A rectangle is 5 cm by 3 cm. What is its AREA in square cm?',
      expected: '15 sq cm — length × width.',
      observed: 'Answered 16 — added 5 + 3 + 5 + 3.',
      priorAttempts: [{ challenge: 'area of a 6×2 rectangle', observed: '16 (added the sides)' }],
    },
    expectation: 'generative',
    note: 'Two consistent instances of perimeter-for-area. Medium/high confidence acceptable. Verdict must not print "multiply length by width".',
  },

  // ── Tier A (judge-backed) — should GENERATE ───────────────────────────────
  {
    id: 'reading-main-idea-judge',
    label: 'Main idea = the first thing mentioned (judge-backed)',
    subject: 'Reading',
    subskillId: 'ELA-G3-RI-MAIN-02',
    evalMode: 'identify_main_idea',
    gradeLevel: '3',
    success: false,
    score: 35,
    evidence: {
      challengeSummary:
        "Passage about how bees help gardens grow. 'What is the main idea?' Free response.",
      expected:
        'The main idea is that bees help plants grow by moving pollen — a whole-passage claim.',
      observed: "Wrote: 'Bees have yellow and black stripes.' (a detail from sentence one)",
      judgeFeedback:
        "The response names a surface detail from the opening sentence rather than the passage's overall point. The student appears to equate 'main idea' with the first concrete fact stated, not the idea the whole passage supports. This pattern recurred across two passages.",
    },
    expectation: 'generative',
    note: 'Tier A — judge already articulated the mental model. Distiller should forward/echo it as a student-model sentence, no extra reasoning needed.',
  },
  {
    id: 'spoken-blend-first-sound-only',
    label: 'Says only the first sound, not the blend (judge-backed)',
    subject: 'Phonics',
    subskillId: 'ELA-GK-PHON-BLEND-01',
    evalMode: 'blend_and_say',
    gradeLevel: 'K',
    success: false,
    score: 40,
    evidence: {
      challengeSummary: "Blend the sounds /m/ /a/ /p/ and say the whole word.",
      expected: 'Says "map" — all three phonemes blended.',
      observed: 'Said "mmm" then stopped.',
      judgeFeedback:
        'Heard the initial /m/ clearly and nothing after it. On the previous item the child produced only the first phoneme as well. The child seems to treat "say the word" as "say the first sound," not blending through to the end.',
    },
    expectation: 'generative',
    note: 'Tier A spoken evidence — the transcript is the highest-fidelity source. Verdict should target blending-through, remediation forces the full blend.',
  },

  {
    id: 'phoneme-explorer-final-sound-omission',
    label: 'Phoneme Explorer — repeatedly omits the final phoneme',
    subject: 'Phonics',
    subskillId: 'ELA-GK-PHON-SEGMENT',
    evalMode: 'segment',
    gradeLevel: 'K',
    success: false,
    score: 20,
    evidence: {
      challengeSummary: 'Segment map into its individual phonemes.',
      expected: '/m/ /a/ /p/',
      observed: 'Chose /m/ /a/.',
      priorAttempts: [
        { challenge: 'Segment sit.', observed: 'Chose /s/ /i/.' },
        { challenge: 'Segment dog.', observed: 'Chose /d/ /o/.' },
      ],
    },
    expectation: 'generative',
    note: 'Stable final-phoneme omission across three words; should predict a two-sound segmentation distractor.',
  },
  {
    id: 'phoneme-explorer-blend-first-sound',
    label: 'Phoneme Explorer — treats the first phoneme as the blended word',
    subject: 'Phonics',
    subskillId: 'ELA-GK-PHON-BLEND',
    evalMode: 'blend',
    gradeLevel: 'K',
    success: false,
    score: 20,
    evidence: {
      challengeSummary: 'Blend /s/ /u/ /n/ into a whole word.',
      expected: 'Choose sun.',
      observed: 'Chose sea, a word beginning with the first sound.',
      priorAttempts: [
        { challenge: 'Blend /m/ /a/ /p/.', observed: 'Chose moon, matching only /m/.' },
      ],
    },
    expectation: 'generative',
    note: 'Repeated onset-only selection; remediation should require blending through all phonemes.',
  },
  {
    id: 'phoneme-explorer-single-slip',
    label: 'Phoneme Explorer — one isolated sound-match slip',
    subject: 'Phonics',
    subskillId: 'ELA-GK-PHON-ISOLATE',
    evalMode: 'isolate',
    gradeLevel: 'K',
    success: false,
    score: 40,
    evidence: {
      challengeSummary: 'Choose a word beginning with /b/.',
      expected: 'Choose ball.',
      observed: 'Chose sun once, then answered the next two sound matches correctly.',
    },
    expectation: 'abstain',
    note: 'One non-patterned tap is insufficient evidence for a misconception.',
  },

  {
    id: 'cvc-speller-vowel-substitution',
    label: 'CVC Speller — consistently substitutes short-e for short-i',
    subject: 'Phonics',
    subskillId: 'ELA-GK-PHON-CVC-ENCODE',
    evalMode: 'spell_word',
    gradeLevel: 'K',
    success: false,
    score: 35,
    evidence: {
      challengeSummary: 'Hear "pig" and spell all three phonemes in order.',
      expected: 'Spell pig, placing i for the middle short-i phoneme.',
      observed: 'Spelled peg, placing e in the middle slot.',
      priorAttempts: [
        { challenge: 'Hear "sit" and spell it.', observed: 'Spelled set.' },
        { challenge: 'Sort "fin" by its middle vowel.', observed: 'Sorted into short-e.' },
      ],
    },
    expectation: 'generative',
    note: 'Repeated cross-mode short-i to short-e substitution. Verdict should predict the e choice without revealing target words.',
  },
  {
    id: 'cvc-speller-spoken-final-omission',
    label: 'CVC Speller — omits the final phoneme aloud (judge-backed)',
    subject: 'Phonics',
    subskillId: 'ELA-GK-PHON-CVC-ENCODE',
    evalMode: 'spell_word',
    gradeLevel: 'K',
    success: false,
    score: 40,
    evidence: {
      challengeSummary: 'Say the whole CVC word after decoding it.',
      expected: 'Produce all three phonemes in order.',
      observed: 'Judge heard "ma" after the student decoded a three-phoneme word.',
      judgeFeedback: 'Across two productions, the student preserved the onset and vowel but omitted the final consonant; the mismatch was high confidence.',
    },
    expectation: 'generative',
    note: 'Tier-A source. The diagnosis should identify final-phoneme deletion, not pronunciation quality generally.',
  },
  {
    id: 'cvc-speller-single-vowel-slip',
    label: 'CVC Speller — one isolated vowel slip',
    subject: 'Phonics',
    subskillId: 'ELA-GK-PHON-CVC-ENCODE',
    evalMode: 'fill_vowel',
    gradeLevel: 'K',
    success: false,
    score: 45,
    evidence: {
      challengeSummary: 'Hear one CVC word and choose its middle vowel.',
      expected: 'Choose a for the middle short-a sound.',
      observed: 'Chose e once, then self-corrected on the next attempt.',
    },
    expectation: 'abstain',
    note: 'One self-corrected slip is not a stable vowel-confusion model. MUST abstain.',
  },

  {
    id: 'letter-sound-voicing-confusion',
    label: 'Letter Sound Link — repeatedly confuses /t/ with /d/',
    subject: 'Phonics',
    subskillId: 'ELA-GK-PHON-LETTER-SOUND',
    evalMode: 'see_hear',
    gradeLevel: 'K',
    success: false,
    score: 30,
    evidence: {
      challengeSummary: 'See T and choose the sound it represents.',
      expected: 'Choose /t/.',
      observed: 'Chose /d/.',
      priorAttempts: [
        { challenge: 'Hear /t/ and choose its letter.', observed: 'Chose d.' },
        { challenge: 'Match T to its keyword.', observed: 'Chose dog instead of top.' },
      ],
    },
    expectation: 'generative',
    note: 'The same voiced/unvoiced substitution appears across all three interaction directions.',
  },
  {
    id: 'letter-sound-spoken-onset-omission',
    label: 'Letter Sound Link — omits keyword onset (judge-backed)',
    subject: 'Phonics',
    subskillId: 'ELA-GK-PHON-LETTER-SOUND',
    evalMode: 'keyword_match',
    gradeLevel: 'K',
    success: false,
    score: 40,
    evidence: {
      challengeSummary: 'Say the keyword that anchors M to /m/.',
      expected: 'Say the whole keyword map.',
      observed: 'Judge heard "ap".',
      judgeFeedback: 'Across repeated productions, the student omitted the initial /m/ from the keyword while preserving the rime; mismatch confidence was high.',
    },
    expectation: 'generative',
    note: 'Tier-A evidence should identify onset deletion, not generic pronunciation difficulty.',
  },
  {
    id: 'letter-sound-single-mistap',
    label: 'Letter Sound Link — one corrected sound mistap',
    subject: 'Phonics',
    subskillId: 'ELA-GK-PHON-LETTER-SOUND',
    evalMode: 'see_hear',
    gradeLevel: 'K',
    success: false,
    score: 45,
    evidence: {
      challengeSummary: 'See S and choose its sound.',
      expected: 'Choose /s/.',
      observed: 'Tapped /z/ once, then selected /s/ on retry.',
    },
    expectation: 'abstain',
    note: 'One self-corrected option tap is insufficient evidence of a stable sound confusion.',
  },

  {
    id: 'rhyme-studio-onset-matching',
    label: 'Rhyme Studio — matches the beginning sound instead of the ending',
    subject: 'Phonics', subskillId: 'ELA-GK-PHON-RHYME', evalMode: 'identification', gradeLevel: 'K', success: false, score: 30,
    evidence: {
      challengeSummary: 'Choose the word that rhymes with cat.', expected: 'Choose hat because both end in -at.', observed: 'Chose cap because both begin with /k/.',
      priorAttempts: [{ challenge: 'Choose a rhyme for sun.', observed: 'Chose sock, matching /s/.' }, { challenge: 'Do map and moon rhyme?', observed: 'Answered yes because both begin with /m/.' }],
    },
    expectation: 'generative', note: 'Repeated onset matching across recognition and identification should produce a predictive diagnosis.',
  },
  {
    id: 'rhyme-studio-spoken-rime-change',
    label: 'Rhyme Studio — changes the rime when speaking (judge-backed)',
    subject: 'Phonics', subskillId: 'ELA-GK-PHON-RHYME', evalMode: 'production', gradeLevel: 'K', success: false, score: 40,
    evidence: { challengeSummary: 'Say a word that rhymes with cat.', expected: 'Produce a word with the -at rime.', observed: 'Judge heard cap.', judgeFeedback: 'The student preserved the onset but changed the final consonant, producing a near-neighbor that does not share the target rime; mismatch confidence was high.' },
    expectation: 'generative', note: 'Tier-A evidence should identify failure to preserve the full rime.',
  },
  {
    id: 'rhyme-studio-single-slip',
    label: 'Rhyme Studio — one corrected rhyme choice',
    subject: 'Phonics', subskillId: 'ELA-GK-PHON-RHYME', evalMode: 'recognition', gradeLevel: 'K', success: false, score: 45,
    evidence: { challengeSummary: 'Do cat and hat rhyme?', expected: 'Yes.', observed: 'Answered no once, then corrected to yes after replay.' },
    expectation: 'abstain', note: 'A single corrected judgment is not a stable rhyme misconception.',
  },

  {
    id:'sound-swap-position-confusion', label:'Sound Swap — always changes the beginning sound', subject:'Phonics', subskillId:'ELA-G1-PHON-MANIP', evalMode:'substitution', gradeLevel:'1', success:false, score:30,
    evidence:{challengeSummary:'Change /i/ to /a/ in bit to make bat.',expected:'Replace the middle vowel /i/ with /a/.',observed:'Changed /b/ to /h/, making hit.',priorAttempts:[{challenge:'Change the final /t/ in cat to /p/.',observed:'Changed initial /k/ instead.'}]},expectation:'generative',note:'Repeatedly manipulates onset regardless of named position.'
  },
  {
    id:'sound-swap-single-slip', label:'Sound Swap — one corrected phoneme tap', subject:'Phonics', subskillId:'ELA-G1-PHON-MANIP', evalMode:'deletion', gradeLevel:'1', success:false, score:45,
    evidence:{challengeSummary:'Delete /s/ from stop.',expected:'Tap the initial /s/.',observed:'Tapped /t/ once, then corrected to /s/.'},expectation:'abstain',note:'One corrected tap is not a stable manipulation rule.'
  },

  // ── Must ABSTAIN — weak / noisy / single slip ─────────────────────────────
  {
    id: 'single-arithmetic-slip',
    label: 'One wrong answer, looks like an arithmetic slip',
    subject: 'Math',
    subskillId: 'MATH-G2-OA-COMP-02',
    evalMode: 'solve_comparison',
    gradeLevel: '2',
    success: false,
    score: 45,
    evidence: {
      challengeSummary: 'Noah has 12 marbles, Emma has 7. How many fewer does Emma have?',
      expected: '5 — the difference (12 − 7).',
      observed: 'Answered 6.',
    },
    expectation: 'abstain',
    note: 'Single attempt, off-by-one from the correct 5 — an arithmetic slip, not a mental model. MUST abstain. This is the OVERREACH trap.',
  },
  {
    id: 'inconsistent-errors',
    label: 'Three wrong answers with no common rule',
    subject: 'Math',
    subskillId: 'MATH-G3-OA-MUL-04',
    evalMode: 'solve_multiplication',
    gradeLevel: '3',
    success: false,
    score: 30,
    evidence: {
      challengeSummary: 'Solve 6 × 4.',
      expected: '24.',
      observed: 'Answered 22.',
      priorAttempts: [
        { challenge: '7 × 3', observed: '21 (correct — but marked others wrong)' },
        { challenge: '8 × 5', observed: '35' },
        { challenge: '6 × 4', observed: '22' },
      ],
    },
    expectation: 'abstain',
    note: 'Errors do not share a rule (22, 35 — no single distortion explains both; one was correct). No coherent misconception. MUST abstain.',
  },
  {
    id: 'guess-then-quit',
    label: 'Random guess, no interaction detail',
    subject: 'Science',
    subskillId: 'SCI-G4-PS-MATTER-02',
    evalMode: 'classify_state',
    gradeLevel: '4',
    success: false,
    score: 50,
    evidence: {
      challengeSummary: 'Is steam a solid, liquid, or gas?',
      expected: 'Gas.',
      observed: 'Selected "liquid" after 2 seconds, then submitted.',
    },
    expectation: 'abstain',
    note: 'Plausible answer (steam looks wet), single item, fast submit — could be a real "steam is water so it must be liquid" idea OR a guess. With one instance and no corroboration, honest verdict is abstain, not a confident diagnosis.',
  },
  {
    id: 'tier-c-no-evidence',
    label: 'Tier C — no expected/observed, no judge',
    subject: 'Math',
    subskillId: 'MATH-G1-OA-ADD-01',
    evalMode: 'solve_addition',
    gradeLevel: '1',
    success: false,
    score: 40,
    evidence: {
      challengeSummary: 'Add 3 + 5.',
      expected: '',
      observed: '',
    },
    expectation: 'abstain',
    note: 'No diagnosable evidence at all. Gate should short-circuit to abstain BEFORE any LLM call (evidenceTier: none).',
  },
];
