/**
 * teachingItemContract — what a taught item IS, with no teaching engine attached.
 *
 * Sunset slice S1 (qa/live-runtime-handoffs/07-sunset-scripted-tutoring.md).
 * The benched response-class registry and the item base used to live inside
 * `judgedScriptContract`, beside the sentinel scanner and the pack validator.
 * That address forced a domain module to import the scripted engine in order
 * to say what class of answer its items ask for — so the pilots could not
 * detach from the runner without dropping standing gate 1 with it.
 *
 * The split runs along ownership:
 *   - HERE: facts about the answer. Which benched class it belongs to, whether
 *     the child says it or does it on the page, what the step is called. These
 *     survive the sunset and both teaching architectures read them.
 *   - `judgedScriptContract`: the retiring control protocol — cue wording,
 *     sentinel verdicts, correction caps, pack validation.
 *
 * Nothing in this file writes a cue or decides progression. Import it from a
 * domain module; import the pack contract only from the legacy runner's side.
 */


// ============================================================================
// Benched response classes — standing gate 1, made structural
// ============================================================================

/**
 * Every judged item must name the CLASS of response the child produces, and
 * the class must have bench evidence behind it before a primitive wires it
 * (qa/di/BACKLOG.md standing gate 1). Free-text expected answers would let a
 * generator launder an unbenched class straight into production — letter
 * names are blocked for exactly that reason.
 *
 * Adding a class here requires a ~30-min di-bench sitting (or an explicit
 * user build-ahead ruling recorded in the queue) — put the run/ruling pointer
 * in `evidence`, never just flip a status.
 */
export type ResponseClassId =
  | 'continuant_sound'
  | 'short_spoken_word'
  | 'yes_no'
  | 'number_word_to_20'
  | 'number_word_to_120'
  | 'place_value_word'
  | 'ordinal_word'
  | 'sentence_read_aloud'
  | 'shape_name'
  | 'manipulation'
  | 'letter_name'
  | 'closed_set_choice'
  | 'open_set_word'
  | 'concept_statement'
  | 'vocabulary_sentence'
  | 'connected_account'
  | 'tense_controlled_account'
  | 'story_experience_connection'
  | 'procedure_step'
  | 'deduction'
  | 'equation_statement';

export type ResponseClassStatus =
  /** Bench sitting (or equivalent live-run evidence) exists. */
  | 'benched'
  /** User build-ahead ruling: built before its sitting; acceptance drive owed. */
  | 'accepted-build-ahead'
  /** Ruled unusable until a bench clears it. The validator REFUSES these. */
  | 'blocked';

export interface ResponseClassRecord {
  status: ResponseClassStatus;
  /** Run/ruling pointer — where the evidence (or the block) lives. */
  evidence: string;
  /** Constraints a pack author must hold that the type system cannot see. */
  notes?: string;
}

export const RESPONSE_CLASSES: Record<ResponseClassId, ResponseClassRecord> = {
  continuant_sound: {
    status: 'benched',
    evidence: 'DI bench runs 2026-07-17..21; di-letter-sounds live.',
    notes: 'Held continuous sounds only — stops/digraphs/blends bench separately.',
  },
  short_spoken_word: {
    status: 'benched',
    evidence:
      'di-word-reading; sound-swap live 9/9 (a964bccc5ca2); word-flip live 5/5 (5269fc87d6da).',
    notes:
      'One short spoken word from a closed per-item set. VC-length (2-sound) words are '
      + 'unbenched at that length — the sound-swap deletion residual (#83).',
  },
  yes_no: {
    status: 'accepted-build-ahead',
    evidence:
      'USER RULING 2026-08-12, from the rhyme-studio port-8 drive: "i think its weird to need '
      + 'the thumbs up and thumbs down [for] do they rhyme? we should just be able to say yes to '
      + 'the tutor". Acceptance drive owed on HUMAN-CHECKS #94.',
    notes:
      'A spoken yes/no VERDICT — the most separable closed pair there is (no shared phonemes), '
      + 'which is why it ships ahead of its sitting. Two things the pack must handle and the '
      + 'class cannot: (1) "no" is VC-length, the length short_spoken_word records as unbenched, '
      + 'so the accept clause must name the natural variants ("yeah", "nope", "they do", "they '
      + 'don\'t") rather than demand the bare word; (2) the child\'s "yes" is NOT a sentinel '
      + 'hazard — the verdict scan reads the TUTOR\'s output only (proven in the port-8 session '
      + 'log: a child "Yes." passed through with no misfire). The tutor\'s own affirmation still '
      + 'opens with "Yes," even when it affirms a NO answer.',
  },
  number_word_to_20: {
    status: 'benched',
    evidence: 'Math-facts probe sitting #46 3/3 (2026-07-24); di-shapes counting 3..6.',
    notes:
      'ZERO is excluded: "zero"/"none" as a spoken answer is an owed bench check '
      + '(di-shapes rung 2 residual). Generators must floor counts at 1.',
  },
  number_word_to_120: {
    status: 'accepted-build-ahead',
    evidence: 'Item 10 build-ahead ruling (3986f77, 2026-08-06); acceptance sitting #63 owed.',
    notes: 'Multi-word numerals (twenty-one…). Ships only where the pack already gates on #63.',
  },
  place_value_word: {
    status: 'accepted-build-ahead',
    evidence:
      'USER BUILD-AHEAD RULING 2026-08-19, from the place-value-chart port (the session that '
      + 're-read the ≤20 bench in code and ruled the >20 tier build-ahead for this shape). '
      + 'Acceptance rides the SAME #63 multi-word-numeral sitting as number_word_to_120 — one '
      + 'sitting clears both.',
    notes:
      'ONE digit\'s worth, said with place vocabulary: 1-2 tokens, each from a closed set — a '
      + 'digit word ("seven"), a decade word ("forty"), or digit/decade + place word ("three '
      + 'hundred", "ninety thousand"). The ≤20 subset sits inside benched number_word_to_20; '
      + 'everything above ships only where the pack already gates on #63. The fully composed '
      + 'numeral ("forty-seven thousand three hundred six") is NOT in this class — a pack must '
      + 'never ask a child to SAY one (the tutor may dictate one; the child answers with hands). '
      + 'Known near-pair for the sitting: the -ty/-teen ear ("forty"/"fourteen").',
  },
  ordinal_word: {
    status: 'benched',
    evidence:
      'Single common words (first..tenth) within the short_spoken_word class; no homophone '
      + 'cluster. Distinct id so an ordinal pack is findable if the class ever needs its own bench.',
  },
  sentence_read_aloud: {
    status: 'benched',
    evidence: 'di-sentence-reading pack, live-gated 2026-07-25.',
  },
  shape_name: {
    status: 'benched',
    evidence:
      'di-shapes bench probe set + pack (cabb3f0); spokenAlternates stated per item. '
      + 'Pack L0 live gate #72 still open.',
  },
  manipulation: {
    status: 'benched',
    evidence:
      'Not a spoken class: the commit is described to the tutor in the cue and the verdict '
      + 'rides the ordinary sentinel scan. First production caller cvc-speller spell_word '
      + '(2026-08-10); its live gate #85 is open.',
    notes: 'Gesture items must follow the runner’s gesture rules — see useJudgedScriptRunner.',
  },
  letter_name: {
    status: 'accepted-build-ahead',
    evidence:
      'USER RULING 2026-08-13, from the letter-spotter drive (session 6ada8c0a1bcf): "in real '
      + 'life if i have a sentence with a missing letter, and i ask the student to use context '
      + 'clues and the word to say the missing letter, they should be able to translate the '
      + 'sentence and missing letter verbally. they dont need to click a button." The prior '
      + 'BLOCKED status is what pushed letter-spotter to an all-tap pack, and that pack is the '
      + 'defect the ruling overturns. Acceptance drive owed on HUMAN-CHECKS.',
    notes:
      'The homophony that motivated the block is REAL but is a per-ITEM constraint, not a class-'
      + 'wide one. The judge is never asked to classify across 26 letters — it is handed ONE '
      + 'target and asked whether the child said it. Two things a pack must do that the class '
      + 'cannot: (1) ACCEPT THE SOUND TOO. "S" or a held /s/ are both right answers from a '
      + 'five-year-old, the sound side is the benched continuant_sound channel, and accepting '
      + 'both makes a cluster confusion need to fail twice. (2) MIND THE CLUSTERS when a wrong '
      + 'answer is plausible: /iː/ = b c d e g p t v z, /ɛ/-initial = f l m n s x, /eɪ/ = a h j k, '
      + '/aɪ/ = i y. A target whose cluster-mate is a likely error for THAT item (b/d on a '
      + 'reversal-prone word) is the item to drop, not the class to block.',
  },
  closed_set_choice: {
    status: 'accepted-build-ahead',
    evidence:
      'USER RULING 2026-08-13, from the decodable-reader drive: "mode sequence/cause effect doesnt let me '
      + 'answer for the 2nd part verbally, i need to click on the button even though im speaking, this is the '
      + 'same issue with inference mode." Third time the same ruling has landed (rhyme-studio recognition, '
      + 'letter-spotter name-it, now this) and the last two both shipped SPOKEN and held. Acceptance drive owed '
      + 'on HUMAN-CHECKS #96 (c) — the decodable-reader row, where the fork lives.',
    notes:
      'The child SAYS which of the N choices on screen they pick. This is NOT open-set production: the judge is '
      + 'handed the exact choice texts and told which one is right, so it classifies an utterance against a '
      + 'printed menu — the same closed-set arithmetic that makes short_spoken_word safe, over a longer string. '
      + 'It is what a proposition-shaped answer needs, because spoken FREE production of a proposition is '
      + 'open_set_word (BLOCKED) and the alternative — a button — is the costume the ruling struck down.\n'
      + 'Two things a pack must do that the class cannot: (1) ACCEPT THE SHORT FORM. A five-year-old answers '
      + '"the mat" or "the second one", not the whole sentence back; a contract that demands the full string '
      + 'fails children for recall, not comprehension. (2) GATE ON EAR-SEPARABILITY. Every choice must carry at '
      + 'least one word no other choice has, or an utterance can fit two of them and the judge cannot honestly '
      + 'score it — a subset option ("A cat." against "A cat and a dog.") is the shape to DROP, not to judge '
      + 'leniently.',
  },
  open_set_word: {
    status: 'benched',
    evidence:
      'BENCHED 2026-08-19 — qa/di-bench/run-2026-08-19-open-set-word.md (item 24), the family\'s '
      + 'first MACHINE-SCORED class bench (`/tutor-test --di-bench`). 72 probes over 6 rimes '
      + 'through the real rhyme-studio contract (`open_production`), plus a 26-probe confirmation '
      + 'run of the amended contract. Gate = ZERO false affirmations in the hard REFUSE buckets, '
      + 'and the headline is the discrimination: across all 72 probes the judge gave exactly 18 '
      + 'affirmations — the 17 planted valid rhymes, and one surname (see the naming note below). '
      + 'It affirmed no echo, no onset match, no semantic neighbour, no slant rhyme, no off-task '
      + 'turn, and none of the ten genuine nonwords, INCLUDING "nake" — the exact string our own '
      + 'generator once emitted into an acceptable-answer list.',
    notes:
      'WHAT A PACK MUST DO THAT THIS CLASS CANNOT — four guards, all in the wrong clause, all '
      + 'scored buckets in the bench (see rhymeStudioScript.ts `openWrongClause` for the shipped '
      + 'wording):\n'
      + '(1) ECHO — the stimulus said straight back. A child told "Yes!" here learns that a word '
      + 'rhymes with itself.\n'
      + '(2) NONWORD — the failure a word bank prevented structurally and a rule cannot. Our own '
      + 'generator has emitted one into an answer list, so a pack must never source a spoken word '
      + 'from generated content in this class.\n'
      + '(3) ONSET-ONLY — rhyme/alliteration confusion, and the miss a judge grading "sounds '
      + 'similar" waves through.\n'
      + '(4) OFF-TASK — a turn that is not an answer. Without a scripted branch the judge invents '
      + 'one.\n'
      + '⭐ NAMES COUNT, AND THE BENCH FOUND THAT THE HARD WAY. The run\'s only apparent false '
      + 'affirmation was "zell" for "bell", filed by the bench as a nonword. Zell is a SURNAME — '
      + 'the judge was defensible and the KEY was wrong, an error the bench\'s own test file warns '
      + 'about. Following it through changed the CONTRACT rather than the key: a child who answers '
      + '"Bill" for "hill" or "Matt" for "hat" HAS DONE THE SKILL, and a clause that refuses names '
      + 'to be safe about nonwords fails real answers to catch invented ones. The amended clause '
      + 'names names as acceptable; the confirmation run affirmed "Matt" for "hat" while still '
      + 'refusing "zat"/"glat"/"drell"/"plell", so the capability was gained without opening a '
      + 'nonword hole.\n'
      + '⚠ THE CORRECTION CAP IS LOAD-BEARING HERE IN A WAY IT IS NOT ELSEWHERE. An open item has '
      + 'no menu bounding its wrong answers, so it reaches long correction runs far more often '
      + 'than any closed item — and the say-exactly grip decays across consecutive corrections '
      + '(verbatim, then embellished, then off-script, then bracket tags read aloud and a new '
      + 'stimulus invented — the port-8 defect under a new trigger). Production caps at 2 and only '
      + 'ever sees the mild end; the bench drove past the cap and that is where its 11 no-verdict '
      + 'turns came from. A pack shipping this class must not raise `maxCorrections`, and the '
      + 'bench owes a fix to honor the cap before the next class is measured on it.',
  },
  concept_statement: {
    status: 'benched',
    evidence:
      'BENCHED 2026-09-07 — qa/di-bench/run-2026-09-07-concept-statement.md (qa/di item 36), the family’s '
      + 'third machine-scored class bench (`/tutor-test di-spoken-practice --di-bench`, one sitting per '
      + 'stimulus). 56 scored probes over 4 stimuli across BOTH sub-shapes (a session-wide concept: the '
      + 'equal sign, a ten rod; a per-instance rule: a growing and a repeating pattern) through the real '
      + 'explain_concept contract. Gate = ZERO false affirmations in the hard REFUSE buckets AND '
      + '`valid-paraphrase` affirmed ≥ 80%: 0/32 false affirmations, paraphrase 8/8 — "they match", "this '
      + 'side and that side are even", "it jumps by two", "it takes turns, one color then the other", '
      + '"they’re both ten", "it’s just the little cubes stuck together" all affirmed with no anchor '
      + 'token in them — and every negated-keyword probe ("they are not the same", "it’s not plus two, '
      + 'it’s plus one") refused. First caller di-spoken-practice `explain_concept`.',
    notes:
      'The child states an IDEA in their own words, 1-10 spoken words, and the judge decides whether '
      + 'the utterance EXPRESSES the concept — not whether it contains a token. Open production of a '
      + 'PROPOSITION: sits between closed_set_choice (a proposition from a printed menu) and '
      + 'open_set_word (any word satisfying a rule), and is distinct from both — no menu bounds the '
      + 'wrong answers, and the target is a MEANING, so token overlap is neither necessary ("they '
      + 'match") nor sufficient ("they are NOT the same").\n'
      + 'Four things a pack must do that the class cannot:\n'
      + '(1) JUDGE MEANING, NOT WORDS. The clause hands the judge ONE concept sentence and 2-3 anchor '
      + 'phrasings, and says explicitly that a five-year-old\'s paraphrase with none of those words '
      + 'counts.\n'
      + '(2) THE FOUR REFUSALS, each a bench bucket: ECHO (the stimulus read back), '
      + 'ANSWER-NOT-EXPLANATION (the arithmetic result — "five"), ADJACENT-CONCEPT (the real '
      + 'misconception — "= means the answer comes next"), NEGATED-KEYWORD (anchor tokens present, '
      + 'idea absent — "they\'re not the same"). Plus OFF-TASK, shared with every open class.\n'
      + '(3) THE CORRECTION CAP IS LOAD-BEARING exactly as open_set_word records: open items reach '
      + 'long correction runs; never raise maxCorrections.\n'
      + '(4) THE LENGTH CEILING IS ON THE ANCHORS, NOT THE CHILD. A rambling correct answer is '
      + 'correct. Anchors ≤ 4 words, the concept sentence ≤ 12, so the affirm line stays speakable.',
  },
  vocabulary_sentence: {
    status: 'accepted-build-ahead',
    evidence:
      'USER BUILD REQUEST 2026-09-09 for Oral Sentence Studio: capture new vocabulary in complete '
      + 'child sentences, judge meaning/use rather than exact wording, and explicitly distinguish '
      + 'valid paraphrases from fragments and unrelated memorized sentences. First caller: '
      + 'oral-sentence-studio. A live microphone/judge acceptance sitting remains owed before '
      + 'adaptive mastery credit.',
    notes:
      'One original spoken sentence grounded in a visible scene and containing exactly two visible '
      + 'target words used with their intended meanings. The judge receives one private scene-meaning '
      + 'sentence plus three distinct valid examples, but treats those only as semantic anchors. A '
      + 'valid paraphrase may change word order, pronouns, grammar, and details. Four failures stay '
      + 'separate because their feedback differs: a fragment lacks a complete thought; a relevant '
      + 'sentence may omit a required word; both words may be present but semantically misused; and a '
      + 'grammatical memorized sentence may be unrelated to the scene. The two-correction cap is '
      + 'load-bearing for this open response and must not be raised.',
  },
  connected_account: {
    status: 'accepted-build-ahead',
    evidence:
      'USER BUILD REQUEST 2026-09-08 for the Story Ribbon design, whose explicit core task is '
      + 'telling a connected account of three pictured events. First caller: story-ribbon. '
      + 'A live microphone/judge acceptance sitting remains owed before adaptive mastery credit.',
    notes:
      'An original spoken account connecting exactly three visible event meanings in chronological order. '
      + 'The judge scores meaning and order, not verbatim sentences or required transition tokens. The pack '
      + 'must accept child grammar, paraphrase and extra relevant detail; refuse disconnected picture labels, '
      + 'missing events, reversed order, and a different invented story. Tense is not part of the birth class. '
      + 'The two-correction cap is load-bearing for this open response and must not be raised.',
  },
  tense_controlled_account: {
    status: 'accepted-build-ahead',
    evidence:
      'USER BUILD REQUEST 2026-09-08 for Story Ribbon L1 modes, explicitly approving separate '
      + 'present-, future-, and past-time story production. First caller: story-ribbon. A live '
      + 'microphone/judge acceptance sitting remains owed before adaptive mastery credit.',
    notes:
      'A connected three-event account with the additional requirement that story time remain '
      + 'consistent with one visible non-conjugated cue: Today, Tomorrow, or Yesterday. Judge meaning, '
      + 'chronology, and temporal consistency rather than exact model verbs. Accept age-appropriate '
      + 'inflection and paraphrase, but refuse an otherwise correct account that switches away from the '
      + 'target time. The two-correction cap is load-bearing.',
  },
  story_experience_connection: {
    status: 'accepted-build-ahead',
    evidence:
      'USER BUILD REQUEST 2026-09-08 for Story Ribbon L1 modes, explicitly approving the '
      + 'story_to_experience task. First caller: story-ribbon. A live microphone/judge acceptance '
      + 'sitting remains owed before adaptive mastery credit.',
    notes:
      'The child identifies one event from a visible three-event story, supplies a personal, familiar, '
      + 'observed, heard-about, or imagined experience, and explains a meaningful connection. The judge '
      + 'must not grade truth, emotional value, or private detail, and must accept a non-personal or imagined '
      + 'alternative when the child declines disclosure. An event alone, an experience alone, or a bare claim '
      + 'that they connect is insufficient. The two-correction cap is load-bearing.',
  },
  procedure_step: {
    status: 'accepted-build-ahead',
    evidence:
      'USER BUILD-AHEAD RULING 2026-09-07 ("these are fantastic… then lets jump in"), from the '
      + '"DI for Older Learners" design brief: the first sequence class — the child narrates a MOVE '
      + 'and the numbers it produces, judged at the step where it happens. First caller '
      + 'di-worked-procedure (talk-through subtraction). The bench fixture ships with the pack '
      + '(service/qa/di/workedProcedureBench.ts, `/tutor-test di-worked-procedure --di-bench`); '
      + 'the sitting is owed, and the mic row is HUMAN-CHECKS #140.',
    notes:
      'A DECISION plus its result, from a per-item CLOSED step grammar (regroup / no regroup, then '
      + 'the numbers), judged on the move and not on the arithmetic alone. Sits above '
      + 'number_word_to_20 (the result with no decision) and beside concept_statement (an idea with '
      + 'no numbers). Four things a pack must do that the class cannot:\n'
      + '(1) THE WRONG MOVE IS FLUENT AND TRUE AS A FACT. "Eight minus two is six" is correct '
      + 'arithmetic and the signature error (smaller-from-larger); the contract names it, and the '
      + 'CONTENT is built so the flip never lands on the right digit (the plan\'s flip ≠ result gate) '
      + '— the judge always has two signals.\n'
      + '(2) HALF A MOVE IS A NAMED MISCONCEPTION. A regroup that names the new ones and never the '
      + 'decremented tens is forgot-to-decrement; it gets its own correction branch, ahead of the '
      + 'general one.\n'
      + '(3) A BARE NUMBER ON A DECIDE STEP IS NOT AN ANSWER — the ask is "tell me what you do".\n'
      + '(4) THE CORRECTION CAP IS LOAD-BEARING exactly as the open classes record; never raise it. '
      + 'A move-on must STATE the step so the page can carry it, or the next ask refers to a number '
      + 'the page never showed.',
  },
  deduction: {
    status: 'accepted-build-ahead',
    evidence:
      'BUILD-AHEAD on the item-37 precedent (qa/di/BACKLOG.md item 38, 2026-09-07; handoff '
      + 'qa/HANDOFF-di-deduction-2026-09-07.md, from the "DI for Older Learners" brief concept 3): the '
      + 'second sequence class — the child states a VERDICT and the REASON that reaches it from a rule, '
      + 'judged on meaning like concept_statement. First caller di-deduction (rule + case). The bench '
      + 'fixture ships with the pack (service/qa/di/deductionBench.ts, `/tutor-test di-deduction '
      + '--di-bench`); the sitting is owed, and the mic row is HUMAN-CHECKS #141.',
    notes:
      'A VERDICT (a conclusion sentence, or no / can\'t tell) plus a REASON that cites the rule, from '
      + 'three code-built case shapes (conclude / deny / cannot_tell), judged on MEANING — "it\'s got '
      + 'eight legs so it\'s not one" is a full answer to a deny case. Sits beside concept_statement (an '
      + 'idea with no verdict) and procedure_step (a move with no rule). Four things a pack must do that '
      + 'the class cannot:\n'
      + '(1) THE SIGNATURE ERROR IS A CONFIDENT YES. "Yes, because it lays eggs" on a cannot_tell case '
      + 'is fluent, cites the rule, and is wrong — the rule does not run backwards. The contract names it '
      + 'first; the bench bucket `affirmed-consequent` must be zero-false-affirm.\n'
      + '(2) A VERDICT WITH NO REASON IS HALF AN ANSWER on deny / cannot_tell — refused, with the "how do '
      + 'you know?" firm-up as its own branch (ONE way, two-branch law). The accept clause names the '
      + 'short forms a child uses ("nope, eight legs").\n'
      + '(3) THE ECHO IS THE RULE READ BACK — true, and no conclusion; bucket `echo`.\n'
      + '(4) THE CORRECTION CAP IS LOAD-BEARING exactly as the open classes record; never raise it. A '
      + 'move-on must STATE the conclusion so the page can carry it.\n'
      + 'CONTENT: the cannot_tell subject is ANONYMOUS ("this animal") by construction, so a child\'s '
      + 'outside knowledge ("no, a turtle is a reptile") can never be a true answer the contract must '
      + 'refuse; the named lookalike moves to the firm-up. Truth in the world is a generator REVIEW gate '
      + '(gemini-flash-latest), never a contract clause.',
  },
  equation_statement: {
    status: 'accepted-build-ahead',
    evidence:
      'BUILD-AHEAD on the item-37 precedent (qa/di/BACKLOG.md item 39, 2026-09-10; handoff '
      + 'qa/HANDOFF-di-word-problem-setup-2026-09-07.md, from the "DI for Older Learners" brief concept 4): '
      + 'the third sequence class — the child SAYS a number family with a slot ("twelve plus box equals '
      + 'twenty"), judged on the right numbers in the right slots. First caller di-word-problem-setup '
      + '(the family step). The bench fixture ships with the pack (service/qa/di/wordProblemBench.ts, '
      + '`/tutor-test di-word-problem-setup --di-bench`); the sitting is owed, and the mic row is on '
      + 'HUMAN-CHECKS.',
    notes:
      'A spoken NUMBER SENTENCE WITH A SLOT: 5-7 tokens from a closed vocabulary — number words, '
      + 'plus / and, equals / is / makes, and box / blank / something / what for the unknown. What the '
      + 'judge scores is the RIGHT NUMBERS IN THE RIGHT SLOTS, never the tokens: "eight and twelve makes '
      + 'something" is the canonical family for 12 + 8 = box. Sits beside procedure_step (a move with '
      + 'no sentence) and closed_set_choice (a choice, not a construction). Four things a pack must do '
      + 'that the class cannot:\n'
      + '(1) THE BIG NUMBER BELONGS AT THE END. "Twenty plus twelve equals box" has every right number '
      + 'and is the signature error ("the biggest number I see" carried into the family); bucket '
      + '`big-number-misplaced`, zero-false-affirm.\n'
      + '(2) THE SUBTRACTION FORM IS NOT A FAMILY. "Twenty minus twelve equals box" is correct arithmetic '
      + 'and skips the decision the step exists to make; bucket `operation-not-family`, its own branch.\n'
      + '(3) BOTH SMALL NUMBERS MUST BE PRESENT (one may be the box); bucket `family-incomplete`.\n'
      + '(4) THE CORRECTION CAP IS LOAD-BEARING exactly as the open classes record; never raise it. A '
      + 'move-on must STATE the family so the page can draw it.\n'
      + 'CONTENT: the two printed numbers are distinct and neither equals the answer, and the answer word '
      + 'never appears in the story (plan gates) — so no wrong family can land on the right numbers by '
      + 'accident.',
  },
};

// ============================================================================
// The item base
// ============================================================================

/**
 * One thing the child is asked to do. Shared by the retiring judged runner
 * (as `JudgedScriptItem`) and the tutor/JEV teaching workspace.
 */
export interface TeachingItem {
  id: string;
  /** What the answer is MADE of — the only per-primitive modality question
   *  (item 16 frame ruling). 'voice' = spoken, judged from audio in-band;
   *  'gesture' = a committed manipulation, described to the tutor.
   *
   *  THE DECISION RULE (user ruling 2026-08-13): picture a teacher at a table
   *  with one student. If the student would naturally answer OUT LOUD, the
   *  answer is 'voice' — the mic is the student's voice, and the screen never
   *  impersonates it with buttons. If the student would do the work ON THE
   *  PAGE (arrange, build, write, point), the screen IS that page and the
   *  answer is 'gesture' — honest page-work, never a workaround for a judge
   *  that finds the spoken answer hard. Full fork: add-di-loop Step 1. */
  answerKind: 'voice' | 'gesture';
  /** Standing gate 1: the benched class this item's answer belongs to. */
  responseClass: ResponseClassId;
  /** Task identity for the how-to-play re-speak policy: when consecutive
   *  items change `action`, the next cue gets `howToPlay: true`. Single-action
   *  packs may omit it. */
  action?: string;
}
