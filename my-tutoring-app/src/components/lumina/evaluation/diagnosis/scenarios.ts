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
    id: 'picture-vocabulary-animal-overgeneralization',
    label: 'Picture Vocabulary — calls every four-legged animal “dog”',
    subject: 'Literacy',
    subskillId: 'ELA-GK-VOCAB-NAMING',
    evalMode: 'naming',
    gradeLevel: 'K',
    success: false,
    score: 20,
    evidence: {
      challengeSummary: 'Name the pictured farm animal.',
      expected: 'Say the specific animal name shown.',
      observed: 'Said “dog” for a goat.',
      judgeFeedback: 'The child clearly said “dog.” Across the session they also called a horse and a cow “dog,” using one familiar animal label for several different four-legged animals.',
      priorAttempts: [
        { challenge: 'Name the pictured horse.', observed: 'Said “dog”.' },
        { challenge: 'Name the pictured cow.', observed: 'Said “dog”.' },
      ],
    },
    expectation: 'generative',
    note: 'Tier-A semantic overgeneralization. Diagnosis should predict “dog” for other four-legged animals without naming the current target.',
  },
  {
    id: 'picture-vocabulary-repeats-prompt-object',
    label: 'Picture Vocabulary — repeats the pictured object instead of naming its partner',
    subject: 'Literacy',
    subskillId: 'ELA-GK-VOCAB-ASSOCIATION',
    evalMode: 'association',
    gradeLevel: 'K',
    success: false,
    score: 20,
    evidence: {
      challengeSummary: 'Name something that naturally goes with a sock.',
      expected: 'Produce its functional partner, a shoe.',
      observed: 'Said “sock,” repeating the pictured object.',
      priorAttempts: [
        { challenge: 'Name something that goes with a spoon.', observed: 'Said “spoon,” repeating the pictured object.' },
        { challenge: 'Name something that goes with a pencil.', observed: 'Said “pencil,” repeating the pictured object.' },
      ],
    },
    expectation: 'generative',
    note: 'Repeated prompt-object repetition instead of producing the relationship partner; diagnosis should predict the displayed base object.',
  },
  {
    id: 'picture-vocabulary-single-naming-slip',
    label: 'Picture Vocabulary — one corrected naming slip',
    subject: 'Literacy',
    subskillId: 'ELA-GK-VOCAB-NAMING',
    evalMode: 'naming',
    gradeLevel: 'K',
    success: false,
    score: 40,
    evidence: {
      challengeSummary: 'Name one pictured everyday object.',
      expected: 'Say the pictured object’s conventional name.',
      observed: 'Initially said “cup,” then immediately self-corrected to “bowl” and named the next items correctly.',
      judgeFeedback: 'The first word was a clear mismatch, followed immediately by a correct self-correction. No repeated error pattern was observed.',
    },
    expectation: 'abstain',
    note: 'A single self-corrected semantic neighbor is not a stable misconception; MUST abstain.',
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

  // ── Direct Instruction family (2026-07-25) ────────────────────────────────
  // The packets below are the EXACT shape `diDiagnosisEvidence.ts` builds, down
  // to the wording of `challengeSummary` and `observed`, so Probe D regresses
  // the real evidence rather than a hand-written idealisation of it.
  //
  // Every DI packet is Tier A: the Live tutor judges the audio in-band and
  // speaks its verdict, and since contrastive correction that verdict NAMES the
  // error. `judgeFeedback` here is a real correction line from the script.
  //
  // Note what the task-identity prefix is doing: `misconceptionScope` is
  // 'primitive' and di-math-facts has four identities, so the summary has to
  // carry the identity or a subtraction diagnosis would be offered on
  // `counting_next`, where counting up is CORRECT.
  {
    id: 'di-math-facts-successor-for-subtraction',
    label: 'DI math facts — subtraction returns the successor (judge-backed)',
    subject: 'Math', subskillId: 'MATH-GK-OPS-SUB-01', evalMode: 'subtraction_fact', gradeLevel: 'K', success: false, score: 0,
    evidence: {
      challengeSummary: 'Direct Instruction math facts — answering a printed SUBTRACTION (take-away) fact aloud. "5 - 1" was printed on screen and the tutor asked what five minus one is. The learner answers by SPEAKING a number word; the tutor judges the audio.',
      expected: 'Say the number word "four" (4).',
      observed: 'Student said: "six".',
      judgeFeedback: 'My turn: not six — five minus one is four. Your turn. What is five minus one?',
      priorAttempts: [
        { challenge: 'Direct Instruction math facts — answering a printed SUBTRACTION (take-away) fact aloud. "3 - 1" was printed on screen and the tutor asked what three minus one is.', observed: 'Student said: "four". Tutor judged: "My turn: not four — three minus one is two. Your turn. What is three minus one?"' },
        { challenge: 'Direct Instruction math facts — answering a printed SUBTRACTION (take-away) fact aloud. "3 - 1" was printed on screen and the tutor asked what three minus one is.', observed: 'Student said: "four". Tutor judged: "My turn: not four — three minus one is two. Your turn. What is three minus one?"' },
        { challenge: 'Direct Instruction math facts — answering a printed SUBTRACTION (take-away) fact aloud. "5 - 1" was printed on screen and the tutor asked what five minus one is.', observed: 'Student said: "six". Tutor judged: "My turn: not six — five minus one is four. Your turn. What is five minus one?"' },
      ],
    },
    expectation: 'generative',
    note: 'The handoff\'s worked example. Every answer is first+1: counting UP the sequence where the fact counts back. Verdict should predict the successor and should stay bounded to SUBTRACTION — a sentence that generalises to "the student counts up" would be wrong on this pack\'s counting_next mode.',
  },
  {
    id: 'di-math-facts-echoes-last-number',
    label: 'DI math facts — answers with the last number heard (judge-backed)',
    subject: 'Math', subskillId: 'MATH-GK-OPS-ADD-01', evalMode: 'answer_fact', gradeLevel: 'K', success: false, score: 0,
    evidence: {
      challengeSummary: 'Direct Instruction math facts — answering a printed ADDITION fact aloud. "2 + 1" was printed on screen and the tutor asked what two plus one is. The learner answers by SPEAKING a number word; the tutor judges the audio.',
      expected: 'Say the number word "three" (3).',
      observed: 'Student said: "one".',
      judgeFeedback: 'My turn: not one — two plus one is three. Your turn. What is two plus one?',
      priorAttempts: [
        { challenge: 'Direct Instruction math facts — answering a printed ADDITION fact aloud. "3 + 2" was printed on screen and the tutor asked what three plus two is.', observed: 'Student said: "two". Tutor judged: "My turn: not two — three plus two is five. Your turn. What is three plus two?"' },
        { challenge: 'Direct Instruction math facts — answering a printed ADDITION fact aloud. "4 + 1" was printed on screen and the tutor asked what four plus one is.', observed: 'Student said: "one". Tutor judged: "My turn: not one — four plus one is five. Your turn. What is four plus one?"' },
      ],
    },
    expectation: 'generative',
    note: 'The echo signature the catalog names as a commonStruggle: the answer is always the SECOND addend, i.e. the last number spoken. Verdict should predict the repeated addend, not "the student cannot add".',
  },
  {
    id: 'di-letter-sounds-name-for-sound',
    label: 'DI letter sounds — produces the letter NAME instead of its sound (judge-backed)',
    subject: 'Phonics', subskillId: 'ELA-GK-PHON-LSC-01', evalMode: 'letter_sound', gradeLevel: 'K', success: false, score: 0,
    evidence: {
      challengeSummary: 'Direct Instruction letter sounds — saying the continuous SOUND a printed letter makes (grapheme → phoneme). The letter "m" was printed on screen (keyword "moon"). The learner PRODUCES the sound aloud; the tutor judges the audio.',
      expected: 'Produce the held continuous sound "mmm" — the sound, never the letter name.',
      observed: 'Student said: "em".',
      judgeFeedback: 'My turn: not em — mmm, as in moon. Your turn. What sound?',
      priorAttempts: [
        { challenge: 'Direct Instruction letter sounds — the letter "s" was printed on screen (keyword "sun").', observed: 'Student said: "ess". Tutor judged: "My turn: not ess — sss, as in sun. Your turn. What sound?"' },
        { challenge: 'Direct Instruction letter sounds — the letter "f" was printed on screen (keyword "fan").', observed: 'Student said: "ef". Tutor judged: "My turn: not ef — fff, as in fan. Your turn. What sound?"' },
      ],
    },
    expectation: 'generative',
    note: 'The pack\'s signature K error, and one only a spoken judge can see. Verdict should predict the letter NAME as the produced response. LEAK check matters here: naming the target sound "mmm" is fine (it is the rule), reciting the item list is not.',
  },
  {
    id: 'di-math-facts-single-fact-slip',
    label: 'DI math facts — one wrong fact, corrected on the retry',
    subject: 'Math', subskillId: 'MATH-GK-OPS-ADD-01', evalMode: 'answer_fact', gradeLevel: 'K', success: false, score: 33,
    evidence: {
      challengeSummary: 'Direct Instruction math facts — answering a printed ADDITION fact aloud. "4 + 1" was printed on screen and the tutor asked what four plus one is. The learner answers by SPEAKING a number word; the tutor judges the audio.',
      expected: 'Say the number word "five" (5).',
      observed: 'Student said: "six".',
      judgeFeedback: 'My turn: not six — four plus one is five. Your turn. What is four plus one?',
      priorAttempts: [],
    },
    expectation: 'abstain',
    note: 'The DI OVERREACH trap: one miss, off by one, and every other fact in the session was affirmed. A judge-backed (Tier A) packet is NOT automatically diagnosable — presence of judgeFeedback must not talk the distiller into a rule that one item cannot support.',
  },
  {
    id: 'di-sentence-reading-mixed-misreads',
    label: 'DI sentence reading — three misreads with no shared rule',
    subject: 'Reading', subskillId: 'ELA-G1-READ-ACC-01', evalMode: 'read_sentence', gradeLevel: '1', success: false, score: 33,
    evidence: {
      challengeSummary: 'Direct Instruction sentence reading — reading a printed short sentence aloud, every word in order. The 4-word sentence "Mom got a pot." was printed on screen. The learner READS it aloud; the tutor judges the audio word by word — a skipped, added, or swapped word is a miss however small the word.',
      expected: 'Read the sentence aloud accurately, every word in order: "Mom got a pot.".',
      observed: 'Student said: "Mom got the pot".',
      judgeFeedback: 'My turn: not the pot — Mom got a pot. Your turn. Read it again.',
      priorAttempts: [
        { challenge: 'Direct Instruction sentence reading — the 5-word sentence "The big red hen ran." was printed on screen.', observed: 'Student said: "The big red hen ran" — affirmed on the retry.' },
        { challenge: 'Direct Instruction sentence reading — the 4-word sentence "I see a pig." was printed on screen.', observed: 'Student said: "I see a pig" after a long pause.' },
      ],
    },
    expectation: 'abstain',
    note: 'One article substitution plus two reads that were actually accurate. No rule connects them — a self-corrected pause and a slow read are not errors. MUST abstain; this guards against the distiller treating any Tier-A packet as a diagnosis.',
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
