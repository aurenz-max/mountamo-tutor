import { writeFileSync } from 'node:fs';
const shapePilot = process.argv.includes('--shapes');
const letterPilot = process.argv.includes('--letters');

// The success conditions copied from `diLetterSoundsDomain.assignmentFor`. This
// script is plain .mjs and cannot import the TypeScript domain, so a change to
// those sentences has to be mirrored here or this probe stops replaying the real
// model input.
const SOUND = {
  grapheme: {
    task: 'What sound does the letter "m" make?', expectedAnswer: 'mmm',
    assignment: `The learner must say the continuous sound mmm. The letter's name is not the answer, `
      + 'and naming the picture "moon" is a step toward the sound rather than the sound itself.',
    facts: { kind: 'letter_sound', keyword: 'moon', elicitation: 'isolated', articulation: 'held', printedLetter: 'm' },
  },
  keyword: {
    task: 'Say the word "apple".', expectedAnswer: 'apple',
    assignment: 'The learner must say the word "apple". '
      + 'Saying that word is the whole answer for this short vowel; the isolated vowel is not asked for.',
    facts: { kind: 'letter_sound', keyword: 'apple', elicitation: 'keyword', articulation: 'held', printedLetter: 'a' },
  },
  clipped: {
    task: 'What sound does the letter "t" make?', expectedAnswer: '/t/ or tent',
    assignment: 'The learner must say the clipped sound /t/. '
      + 'A small "uh" after it counts, and so does "tent" or another word starting with that sound. '
      + `The letter's name is not the answer.`,
    facts: { kind: 'letter_sound_review', keyword: 'tent', elicitation: 'isolated', articulation: 'clipped', printedLetter: 't' },
  },
  onset: {
    task: 'What is the first sound in "moon"?', expectedAnswer: 'mmm',
    assignment: 'The learner must say the first sound in "moon": mmm. Saying the whole '
      + 'word "moon" back, or naming a letter, is a step toward the answer and is not it.',
    facts: { kind: 'first_sound_in_word', keyword: 'moon', elicitation: 'isolated', articulation: 'held', printedWord: 'moon' },
  },
};
const soundCase = (shape) => ({
  task: SOUND[shape].task, expectedAnswer: SOUND[shape].expectedAnswer,
  activity: { objects: [
    { id: 'stimulus', label: shape === 'onset' ? 'the word "moon" printed on the card'
      : `the letter "${SOUND[shape].facts.printedLetter}" printed on the card`,
      selected: false, group: 'assignment target (gold ring)' },
    { id: 'picture', label: `a picture of a ${SOUND[shape].facts.keyword}`, selected: false, group: 'keyword picture' },
  ], facts: { ...SOUND[shape].facts, assignment: SOUND[shape].assignment, response: 'speech', presentation: 'ready' } },
});
const wordPilot = process.argv.includes('--words');

// The success conditions copied from `diWordReadingDomain.assignmentFor`, and the
// scene from `DiWordReadingTeaching`. Same mirroring rule as SOUND above: this
// script is plain .mjs and cannot import the TypeScript domain, so a change to
// those sentences has to be mirrored here or the probe stops replaying the real
// model input. The ask deliberately never contains the word.
const WORD_ASK = 'What word is this? Read it out loud.';
const WORD = {
  cvc: {
    kind: 'cvc_reading', word: 'sam', letters: ['s', 'a', 'm'], soundOut: 'sss-aaa-mmm',
    assignment: 'The learner must read the printed word "sam" out loud. '
      + 'Saying the separate sounds slowly and then the whole word is a correct read; stopping at the '
      + 'separate sounds without ever saying the whole word is not. '
      + 'A different word is not a correct read, however close it sounds.',
  },
  review: {
    kind: 'word_reading_review', word: 'sun', letters: ['s', 'u', 'n'], soundOut: 'sss-uuu-nnn',
    assignment: 'The learner must read the printed word "sun" out loud. '
      + 'Saying the separate sounds slowly and then the whole word is a correct read; stopping at the '
      + 'separate sounds without ever saying the whole word is not. '
      + 'A different word is not a correct read, however close it sounds.',
  },
  sight: {
    kind: 'sight_word', word: 'the', letters: [], soundOut: '',
    assignment: 'The learner must read the printed word "the" out loud. '
      + 'It is irregular and is recalled whole, so sounding it out letter by letter is not how it is read. '
      + 'A different word is not a correct read, however close it sounds.',
  },
};
const wordCase = (shape) => {
  const w = WORD[shape];
  return {
    task: WORD_ASK, expectedAnswer: w.word,
    activity: {
      objects: [
        { id: 'word', label: `the word "${w.word}" printed on the card, which the learner must read`,
          selected: false, group: 'assignment target (gold ring)' },
        ...w.letters.map((letter, position) => ({ id: `letter-${position}`, selected: false,
          group: 'printed letter of that word',
          label: `the letter "${letter}", letter ${position + 1} of the printed word` })),
      ],
      demonstration: [],
      facts: { kind: w.kind, assignment: w.assignment, printedWord: w.word,
        wordType: w.letters.length ? 'decodable — blended from its printed letters'
          : 'irregular sight word — recalled whole, never sounded out',
        ...(w.soundOut ? { soundOut: w.soundOut } : {}),
        response: 'speech', presentation: 'ready' },
    },
  };
};

// Word reading. The answer IS the printed word, so the risks are the other
// direction from letter sounds: a near neighbour affirmed as the printed word, a
// sound-out praised before the whole word was ever said, and the tutor's own
// read standing in for the child's.
const WORD_CASES = [
  ['read', 'sam', 'Yes, sam.', 'correct', 'advance', 'sam', undefined, wordCase('cvc')],
  ['noisy', 'saam', "That's right, you read sam.", 'correct', 'advance', 'sam', undefined, wordCase('cvc')],
  // Blending out loud and then saying it fast IS the skill at this stage.
  ['blend_then_word', 'sss aaa mmm sam', 'Yes, you sounded it out and then said sam.', 'correct', 'advance',
    'sam', undefined, wordCase('cvc')],
  // The same blend with no whole word at the end is unfinished, not finished.
  ['blend_substep', 'sss aaa mmm', 'Great sounding out!', 'none', 'none', 'sam',
    'Say each sound with me.', wordCase('cvc')],
  ['rhyme_praise', 'sat', 'Yes, sat is right!', 'none', 'none', 'sam', undefined, wordCase('cvc')],
  ['homophone_praise', 'son', 'Yes, son. That is the word.', 'none', 'none', 'sun', undefined, wordCase('review')],
  // The DEFERRED RISK, stated rather than hidden: when a tutor over-affirms a
  // homophone without naming it, the observer has nothing to catch it with. The
  // learner transcript is excluded from model input by design (so a correct
  // answer in another language cannot be vetoed), and regrading the audio would
  // be a second speech judge. A tutor mishearing "son" as "sun" is therefore a
  // tutor failure that only the human microphone sitting can find.
  ['homophone_unnamed_limit', 'son', "Yes, that's right.", 'correct', 'advance', 'sun', undefined, wordCase('review')],
  // The SAME structural limit as the case above, from the other direction: the
  // child spelled the word instead of reading it and the tutor affirmed anyway.
  // "Correct, s-a-m!" reads as the expected answer, so the observer credits it at
  // 0.98-1.00. Adding a letter-name clause to the success condition changed
  // nothing, because the observer has no view of what the child actually said.
  // Only the tutor can refuse to affirm a spelled word, which is why that rule
  // lives in the adapter guidance and in the catalog block.
  ['letter_names_praise_limit', 'ess ay em', 'Correct, s-a-m!', 'correct', 'advance', 'sam',
    undefined, wordCase('cvc')],
  ['tutor_reads_it', '', 'This word is sam. Listen: sam.', 'none', 'none', 'sam', undefined, wordCase('cvc')],
  ['help', "I don't know", 'Look at the first letter and tell me its sound.', 'none', 'none', 'sam',
    undefined, wordCase('cvc')],
  ['retry', 'sat', 'Not quite, that is a different word. Try this one again.', 'incorrect', 'retry', 'sam',
    undefined, wordCase('cvc')],
  ['open_question', 'sam', 'Sam is right. How did you work it out?', 'correct', 'none', 'sam',
    undefined, wordCase('cvc')],
  // THE OPEN FINDING (LA-13). A bare affirmation after a turn in which the tutor
  // modelled the word classifies `correct` at 0.84 — under the 0.9 gate — so the
  // observer abstains, the item stays open and the still-open cue costs a turn.
  // Letter sounds found the same shape at 0.83-0.88 and attributed it to produced
  // sound; a printed word is a nameable token, so it is not that. No threshold or
  // phrase rule may be used here: it is a shared-criterion question.
  ['wrong_then_corrected', 'sam', 'There you go, you read it!', 'correct', 'advance', 'sam',
    'Listen to me sound it out, then you try.', { ...wordCase('cvc'),
      lastResponse: { response: 'sat', correct: false, assisted: true },
      activity: { ...wordCase('cvc').activity, responseSource: 'speech', attemptNumber: 1,
        assistance: { level: 2, answerExposure: 'full' } } }],
  ['sight_word', 'the', 'Yes, the.', 'correct', 'advance', 'the', undefined, wordCase('sight')],
  // The child read the irregular word; the tutor then sounded it out, which is a
  // teaching error. The observer grades the assignment, not the teaching, so the
  // credit stands and the slip is a transcript finding.
  ['sight_sounded_out', 'the', 'Yes — tuh-huh-eee, the. Well done.', 'correct', 'advance', 'the',
    undefined, wordCase('sight')],
  ['sight_no_restate', 'the', 'Perfect reading!', 'correct', 'advance', 'the', undefined, wordCase('sight')],
];
const trainPilot = process.argv.includes('--trains');

// Number train, before-after: "What number comes after 7?", expected 8. The
// spot-error pair at the end swaps in that mode's own assignment, because naming
// the REPLACEMENT instead of the number that breaks the count is its live risk.
const SPOT_ERROR = { task: 'Listen to this count: 3, 4, 9, 6, 7. Which number does not belong? Say that number.',
  activity: { facts: { kind: 'spot-error', response: 'speech',
    assignment: 'Say which printed number breaks the count. The number that should have been there instead is not the answer to this question.' },
    objects: [3, 4, 9, 6, 7].map((n, i) => ({ id: `car-${i}`, label: `car ${i + 1} showing ${n}`, selected: false, group: 'visible car' })) } };
const TRAIN_CASES = [
  ['next_number', 'eight', 'Yes, eight.', 'correct', 'advance'],
  ['multilingual', 'ocho', 'Yes, eight comes after seven!', 'correct', 'advance'],
  ['noisy', 'ate', 'Exactly, eight is the one.', 'correct', 'advance'],
  // The repaired criterion: a whole-assignment affirmation need not recite the number.
  ['no_restate', 'eight', 'Fantastic job finding the number that comes next!', 'correct', 'advance'],
  ['open_question', 'eight', 'Eight is right. How did you work that out?', 'correct', 'none'],
  ['read_back_visible', 'seven', 'Yes, seven is the number you can already see. Now what comes after it?',
    'none', 'none', 8, 'What number comes after 7?'],
  ['counting_along', 'seven, eight', 'Good counting along with me!', 'none', 'none', 8, 'Count with me starting at seven.'],
  ['wrong_praise', 'nine', 'Correct, nine comes after seven!', 'none', 'none'],
  ['retry', 'six', 'Not quite. Look at the train and try again.', 'incorrect', 'retry'],
  ['help', 'Can you help me?', 'Find the number you can see, then say what belongs in the empty car.', 'none', 'none'],
  ['example', 'show me', 'Here is another train: after two comes three. Now you try yours.', 'none', 'none'],
  ['no_learner', '', 'The number after seven is eight.', 'none', 'none'],
  ['spot_error_named', 'nine', 'Yes, nine does not belong. Five belongs there.', 'correct', 'advance', 9, undefined, SPOT_ERROR],
  // Naming the replacement answers a DIFFERENT question; affirming it is not success here.
  ['spot_error_repair', 'five', 'Yes, five is the number that belongs there.', 'none', 'none', 9, undefined, SPOT_ERROR],
];

// Letter sounds. The whole assignment is one produced sound, so the risks are
// the keyword picture (a route to the sound, not the sound), the letter's NAME,
// and the tutor's own model being mistaken for the child's answer.
const LETTER_CASES = [
  ['sound', 'mmm', 'Yes, mmm.', 'correct', 'advance', null, undefined, soundCase('grapheme')],
  ['noisy', 'hmm', "That's right, the letter m says mmm.", 'correct', 'advance', null, undefined, soundCase('grapheme')],
  // A held phoneme transcribes badly by nature; the tutor heard the audio.
  ['unrecognised_audio', 'um', 'Perfect, that is exactly the sound.', 'correct', 'advance', null,
    'What sound does this letter make?', soundCase('grapheme')],
  ['picture_substep', 'moon', "Yes, that's a moon. Now what sound does moon start with?", 'none', 'none', null,
    'What is this a picture of?', soundCase('grapheme')],
  ['bare_substep', 'moon', 'Exactly right!', 'none', 'none', null,
    'What is this a picture of?', soundCase('grapheme')],
  ['letter_name_praise', 'em', 'Correct, the letter m says em!', 'none', 'none', null, undefined, soundCase('grapheme')],
  ['tutor_model', '', 'This sound is mmm, as in moon. Listen: mmm.', 'none', 'none', null, undefined, soundCase('grapheme')],
  ['help', "I don't know", 'Put your lips together and hum. What do you hear?', 'none', 'none', null, undefined, soundCase('grapheme')],
  ['retry', 'sss', 'Not quite, that is a different sound. Try this one again.', 'incorrect', 'retry', null, undefined, soundCase('grapheme')],
  ['open_question', 'mmm', 'Mmm is right. Where else do you hear that sound?', 'correct', 'none', null, undefined, soundCase('grapheme')],
  ['wrong_then_corrected', 'mmm', 'There you go, that is the sound!', 'correct', 'advance', null,
    'Listen to me say it, then you try.', { ...soundCase('grapheme'),
      lastResponse: { response: 'em', correct: false, assisted: true },
      activity: { ...soundCase('grapheme').activity, responseSource: 'speech', attemptNumber: 1,
        assistance: { level: 2, answerExposure: 'full' } } }],
  ['keyword_elicitation', 'apple', 'Yes. Apple starts with short a.', 'correct', 'advance', null, undefined, soundCase('keyword')],
  ['clipped_stop', 'tuh', 'That is right, a quick /t/ — a little uh at the end is fine.', 'correct', 'advance', null, undefined, soundCase('clipped')],
  ['clipped_keyword', 'tent', 'Yes, tent starts with that sound.', 'correct', 'advance', null, undefined, soundCase('clipped')],
  ['onset', 'mmm', 'Yes, moon starts with mmm.', 'correct', 'advance', null, undefined, soundCase('onset')],
  ['onset_whole_word', 'moon', 'Yes, the word is moon. Now say just its first sound.', 'none', 'none', null,
    'What is the word?', soundCase('onset')],
];

const factPilot = process.argv.includes('--facts');

// The success conditions copied from `diMathFactsDomain.assignmentFor`, and the
// scene from `DiMathFactsTeaching`. Same mirroring rule as SOUND and WORD above.
// The ask never contains the answer, and neither does the printed problem —
// except for `numeral`, the one mode whose stimulus IS what the child must say.
const FACT = {
  addition: {
    kind: 'answer_fact', display: '2 + 1', terms: ['2', '+', '1'], problem: 'two plus one',
    task: 'What is two plus one?',
    answerWord: 'three', route: 'counting up to the answer is a legitimate route',
    assignment: 'The learner must say the answer to "two plus one" out loud: three. '
      + 'A different number is not the answer, however close it is. '
      + 'Counting up to it out loud and then saying it is a correct answer.',
  },
  subtraction: {
    kind: 'subtraction_fact', display: '3 - 1', terms: ['3', '-', '1'], problem: 'three minus one',
    task: 'What is three minus one?',
    answerWord: 'two', route: 'counting back to the answer is a legitimate route',
    assignment: 'The learner must say the answer to "three minus one" out loud: two. '
      + 'A different number is not the answer, however close it is. '
      + 'Counting back to it out loud and then saying it is a correct answer.',
  },
  numeral: {
    kind: 'name_numeral', display: '7', terms: [], problem: 'this number',
    task: 'What is this number?',
    answerWord: 'seven', route: 'none — counting the sequence is not a route to this answer',
    assignment: 'The learner must say the name of the printed numeral 7 out loud: seven. '
      + 'Reciting the counting sequence up to it, or saying a different number, is not naming this numeral.',
  },
  teen: {
    kind: 'counting_next', display: '12 →', terms: ['12', '→'], problem: 'the number after twelve',
    task: 'What is the number after twelve?',
    answerWord: 'thirteen', route: 'counting up to the answer is a legitimate route',
    assignment: 'The learner must say the answer to "the number after twelve" out loud: thirteen. '
      + 'A different number is not the answer, however close it is. '
      + 'A teen and its decade are different numbers, never near misses: thirteen is not thirty. '
      + 'A number said as several words is one answer and must arrive whole. '
      + 'Counting up to it out loud and then saying it is a correct answer.',
  },
};
const factCase = (shape) => {
  const f = FACT[shape];
  return {
    task: f.task, expectedAnswer: f.answerWord,
    activity: {
      objects: [
        { id: 'problem', label: `the printed problem "${f.display}", which the learner must answer out loud`,
          selected: false, group: 'assignment target (the printed problem)' },
        ...f.terms.map((term, position) => ({ id: `term-${position}`, selected: false,
          group: 'part of the printed problem',
          label: /^[0-9]+$/.test(term)
            ? `the printed number "${term}", part ${position + 1} of the problem`
            : `the "${term}" sign in the problem` })),
      ],
      demonstration: [],
      facts: { kind: f.kind, assignment: f.assignment, printedProblem: f.display, spokenProblem: f.problem,
        support: 'the fact may be modelled and said together before the learner answers',
        countingRoute: f.route, response: 'speech', presentation: 'ready' },
    },
  };
};

// Math facts. The answer is NOT on screen, which inverts word reading's risks:
// the tutor can supply the answer before the child says it, an operand echoed
// back sounds like an answer, and a teen and its decade are one unstressed
// syllable apart.
const FACT_CASES = [
  ['answer', 'three', 'Yes, three.', 'correct', 'advance', 'three', undefined, factCase('addition')],
  // Th-fronting is developmental pronunciation of the RIGHT number, not a miss.
  ['noisy', 'free', "That's right, the answer is three.", 'correct', 'advance', 'three', undefined, factCase('addition')],
  ['multilingual', 'tres', 'Yes, three is right!', 'correct', 'advance', 'three', undefined, factCase('addition')],
  // Counting up to the answer is the spoken analog of sounding out a word.
  ['counted_then_answered', 'one two three', 'Yes, you counted up and got three.', 'correct', 'advance',
    'three', undefined, factCase('addition')],
  ['count_substep', 'one, two', 'Good counting along with me!', 'none', 'none', 'three',
    'Count up with me, starting at one.', factCase('addition')],
  // Echoing an operand is a wrong quantity, and praising it credits nothing.
  ['echo_operand_praise', 'two', 'Correct, the answer is two!', 'none', 'none', 'three', undefined, factCase('addition')],
  ['wrong_praise', 'five', 'Yes, five!', 'none', 'none', 'three', undefined, factCase('addition')],
  ['retry', 'five', 'Not quite, that is a different number. Try this one again.', 'incorrect', 'retry',
    'three', undefined, factCase('addition')],
  ['help', "I don't know", 'Put up two fingers, then one more. How many now?', 'none', 'none',
    'three', undefined, factCase('addition')],
  ['tutor_answers', '', 'Two plus one is three. Listen: three.', 'none', 'none', 'three', undefined, factCase('addition')],
  ['open_question', 'three', 'Three is right. How did you work it out?', 'correct', 'none',
    'three', undefined, factCase('addition')],
  // The repaired criterion (number train): a whole-assignment affirmation with
  // no prior corrective turn need not recite the number.
  ['no_restate', 'three', 'Fantastic job answering that fact!', 'correct', 'advance', 'three',
    undefined, factCase('addition')],
  // THE OPEN FINDING (LA-13), asked in a third domain. A bare affirmation after a
  // turn in which the tutor modelled the fact scored 0.83-0.86 for letter sounds
  // and for word reading, under the 0.9 gate, so the observer abstained and the
  // item stalled. A spoken number is as nameable a token as a printed word, so
  // this case is here to say whether the shape reproduces on numbers too. No
  // threshold or phrase rule may be used to move it: it is a shared-criterion question.
  ['wrong_then_corrected', 'three', 'There you go, you got it!', 'correct', 'advance', 'three',
    'Listen to me: two plus one is three. Now you say it.', { ...factCase('addition'),
      lastResponse: { response: 'five', correct: false, assisted: true },
      activity: { ...factCase('addition').activity, responseSource: 'speech', attemptNumber: 1,
        assistance: { level: 2, answerExposure: 'full' } } }],
  // The controlled variant. The case above has the prior tutor turn NAME the
  // answer, which word reading's and letter sounds' failing cases did not — in
  // both of those the model was a demonstration of the act ("listen to me sound
  // it out"). This one matches their shape exactly, so the pair separates "a
  // numeric answer behaves differently" from "the prior turn made the target
  // visible to the observer".
  ['wrong_then_corrected_unnamed_model', 'three', 'There you go, you got it!', 'correct', 'advance', 'three',
    'Listen to me count it out, then you try.', { ...factCase('addition'),
      lastResponse: { response: 'five', correct: false, assisted: true },
      activity: { ...factCase('addition').activity, responseSource: 'speech', attemptNumber: 1,
        assistance: { level: 2, answerExposure: 'full' } } }],
  // The same exchange with the number named, which is what the adapter guidance
  // asks for. The pair is the measurement, not either case alone.
  ['wrong_then_corrected_named', 'three', 'There you go, three!', 'correct', 'advance', 'three',
    'Listen to me: two plus one is three. Now you say it.', { ...factCase('addition'),
      lastResponse: { response: 'five', correct: false, assisted: true },
      activity: { ...factCase('addition').activity, responseSource: 'speech', attemptNumber: 1,
        assistance: { level: 2, answerExposure: 'full' } } }],
  ['subtraction', 'two', 'Yes, three minus one is two.', 'correct', 'advance', 'two', undefined, factCase('subtraction')],
  ['counted_back', 'three, two', 'That is right, you counted back to two.', 'correct', 'advance',
    'two', undefined, factCase('subtraction')],
  ['numeral_named', 'seven', 'Yes, that number is seven.', 'correct', 'advance', 'seven', undefined, factCase('numeral')],
  // Reciting the sequence to reach the numeral is a different act from reading it.
  ['numeral_recited', 'one two three four five six seven', 'Great counting!', 'none', 'none',
    'seven', undefined, factCase('numeral')],
  ['teen', 'thirteen', 'Yes, thirteen comes after twelve.', 'correct', 'advance', 'thirteen', undefined, factCase('teen')],
  // The discrimination the 1-120 extension depends on: affirming the decade for
  // the teen must not record success.
  ['teen_decade_praise', 'thirty', 'Yes, thirty!', 'none', 'none', 'thirteen', undefined, factCase('teen')],
];


const linkPilot = process.argv.includes('--links');

// The success conditions copied from `letterSoundLinkDomain.assignmentFor`, and
// the scene from `LetterSoundLinkTeaching`. Same mirroring rule as the sets
// above: this script is plain .mjs and cannot import the TypeScript domain, so a
// change to those sentences has to be mirrored here or the probe stops replaying
// the real model input.
//
// This is the only MIXED-CHANNEL set. `tap` carries NO expectedAnswer, because
// the binding publishes none: the activity checks the tap and the tutor is never
// told which letter makes the sound.
const LINK = {
  held: {
    task: 'What sound does the letter "m" make?', expectedAnswer: 'mmm',
    facts: { kind: 'see-hear', supportTier: 'medium', printedLetter: 'M', response: 'speech', presentation: 'ready' },
    assignment: 'The learner must say the continuous sound mmm that this letter makes. '
      + 'A short try counts, and so does a little "uh" on the end.'
      + ` The letter's NAME — "em" — is not the answer, however confidently it is said.`,
    objects: [{ id: 'letter', label: 'the letter "m" printed on the card', selected: false,
      group: 'the printed letter this question is about' }],
  },
  clipped: {
    task: 'What sound does the letter "t" make?', expectedAnswer: '/t/ or tent',
    facts: { kind: 'see-hear', supportTier: 'medium', printedLetter: 'T', response: 'speech', presentation: 'ready' },
    assignment: 'The learner must say the clipped sound /t/ that this letter makes. '
      + 'A small "uh" after it counts, and so does "tent" or another word starting with that sound.'
      + ` The letter's NAME — "tee" — is not the answer, however confidently it is said.`,
    objects: [{ id: 'letter', label: 'the letter "t" printed on the card', selected: false,
      group: 'the printed letter this question is about' }],
  },
  tap: {
    task: 'Which letter makes the sound sss? Tap it.', expectedAnswer: null,
    facts: { kind: 'hear-see', supportTier: 'medium', soundToSay: 'sss', response: 'gesture', presentation: 'ready' },
    assignment: 'The learner must TAP the letter that makes the sound sss. '
      + 'The activity checks the tap and reports it; nothing the learner says is an answer to this question. '
      + 'Saying, spelling or pointing out either letter on the screen gives the answer away.',
    objects: [
      { id: 'option-s', label: 'a card showing the letter "S"', selected: false,
        group: 'one of the two letters the learner chooses between' },
      { id: 'option-f', label: 'a card showing the letter "F"', selected: false,
        group: 'one of the two letters the learner chooses between' }],
  },
  word: {
    task: 'Which picture starts with the sound the letter "s" makes? Say the word.', expectedAnswer: 'sun',
    facts: { kind: 'keyword-match', supportTier: 'medium', printedLetter: 'S', response: 'speech', presentation: 'ready' },
    assignment: 'The learner must say the word for the picture that starts with this letter\'s sound: "sun". '
      + 'Another fair name for that same picture counts. '
      + 'The other picture\'s word, "net", is not the answer. '
      + 'The letter\'s sound said on its own — "sss" — is a sound and not the name of a picture, '
      + 'so it is not an answer here however close it sounds.',
    objects: [
      { id: 'letter', label: 'the letter "s" printed on the card', selected: false,
        group: 'the printed letter this question is about' },
      { id: 'picture-sun', label: 'a picture of a sun', selected: false, group: 'one of the two pictures' },
      { id: 'picture-net', label: 'a picture of a net', selected: false, group: 'one of the two pictures' }],
  },
};
const linkCase = (shape, extra = {}) => {
  const l = LINK[shape];
  return {
    task: l.task, ...(l.expectedAnswer === null ? {} : { expectedAnswer: l.expectedAnswer }),
    activity: { responseSource: null, attemptNumber: 0, objects: l.objects, demonstration: [],
      facts: { ...l.facts, assignment: l.assignment },
      assistance: { level: 0, answerExposure: 'none' }, ...extra.activity },
    ...(extra.lastResponse !== undefined ? { lastResponse: extra.lastResponse } : {}),
  };
};
/** A checked TAP: the activity already graded it, and the observer's question is
 *  whether the tutor's settled feedback agrees and may move the lesson on.
 *
 *  `phase: 'checked'` is load-bearing, not decoration. `decideDialogue` grounds a
 *  non-spoken observation on `lastResponse && phase === 'checked'`, so a tap case
 *  left at the default 'working' is refused as `unsupported` before the model's
 *  answer is looked at — which reads as "gesture modes never advance" and is a
 *  harness artefact. */
const tapCase = (correct, response) => ({
  phase: 'checked',
  ...linkCase('tap', {
    lastResponse: { response, correct, assisted: false },
    activity: { responseSource: 'gesture', attemptNumber: 1 },
  }),
});

// letter-sound-link. Three directions and two channels, so the risks differ per
// direction: the letter NAME affirmed as its sound, a tutor verdict that
// contradicts a checked tap, and the letter's own sound accepted as a picture word.
const LINK_CASES = [
  ['sound', 'mmm', 'Yes, mmm.', 'correct', 'advance', 'mmm', undefined, linkCase('held')],
  // A held phoneme transcribes as a fragment; the tutor heard the real audio.
  ['sound_noisy', 'hmm', "That's right, mmm.", 'correct', 'advance', 'mmm', undefined, linkCase('held')],
  // THE signature miss: the NAME said in place of the sound, affirmed fluently.
  ['letter_name_praise', 'em', 'Yes, em is right!', 'none', 'none', 'mmm', undefined, linkCase('held')],
  ['letter_name_corrected', 'em', "That is the letter's name. Its sound is mmm. Try that one again.",
    'incorrect', 'retry', 'mmm', undefined, linkCase('held')],
  ['help', "I don't know", 'Watch my mouth: mmm. Now you try.', 'none', 'none', 'mmm', undefined, linkCase('held')],
  ['open_question', 'mmm', 'Mmm is right. What else starts with that sound?', 'correct', 'none',
    'mmm', undefined, linkCase('held')],
  // LA-13, FIFTH DOMAIN. Here the child's answer and the tutor's model are the
  // same utterance in the SAME channel — the shape di-math-facts isolated as the
  // one that predicts the sub-threshold abstention. Both variants, as there.
  ['wrong_then_corrected', 'mmm', 'There you go, you got it!', 'correct', 'advance', 'mmm',
    'Listen to me: mmm. Now you say it.', linkCase('held', {
      lastResponse: { response: 'em', correct: false, assisted: true },
      activity: { responseSource: 'speech', attemptNumber: 1, assistance: { level: 2, answerExposure: 'full' } } })],
  ['wrong_then_corrected_named', 'mmm', 'There you go, mmm!', 'correct', 'advance', 'mmm',
    'Listen to me: mmm. Now you say it.', linkCase('held', {
      lastResponse: { response: 'em', correct: false, assisted: true },
      activity: { responseSource: 'speech', attemptNumber: 1, assistance: { level: 2, answerExposure: 'full' } } })],
  // A stop cannot be held: the schwa a five-year-old adds is a correct answer,
  // and so is a word that starts with the sound (user ruling 2026-09-05).
  ['clipped_with_schwa', 'tuh', 'Yes, /t/.', 'correct', 'advance', '/t/ or tent', undefined, linkCase('clipped')],
  ['clipped_keyword', 'tent', "That's right, tent starts with /t/.", 'correct', 'advance',
    '/t/ or tent', undefined, linkCase('clipped')],
  // The DIAGNOSTIC PAIR for the two abstentions above, and the reason they are
  // reported as LA-13 input rather than patched here: the same exchange with the
  // affirmation carried in a sentence instead of a bare token. If these pass
  // while their bare-token twins abstain, the failing shape is "the tutor's whole
  // reply is the sound", not the sound itself.
  ['clipped_with_schwa_sentence', 'tuh', "That's right, you said the /t/ sound.", 'correct', 'advance',
    '/t/ or tent', undefined, linkCase('clipped')],
  // The tapped direction. The learner says nothing; the activity has graded.
  ['tap_correct', '', 'Yes, sss.', 'correct', 'advance', null, undefined, tapCase(true, 's')],
  ['tap_correct_question', '', 'Yes, sss. How did you know that one?', 'correct', 'none',
    null, undefined, tapCase(true, 's')],
  ['tap_correct_sentence', '', "That's right, you tapped the letter that makes sss.", 'correct', 'advance',
    null, undefined, tapCase(true, 's')],
  // Praise over a checked-wrong tap. The runtime refuses a verdict that
  // contradicts the activity check, so this measures whether the model agrees
  // with the check before that guard has to.
  ['tap_wrong_praise', '', 'Great job!', 'none', 'none', null, undefined, tapCase(false, 'f')],
  ['tap_wrong_corrected', '', 'That letter makes a different sound. Listen again: sss.', 'incorrect', 'retry',
    null, undefined, tapCase(false, 'f')],
  // The picture-word direction, and its own documented false affirm: the
  // letter's SOUND said back instead of a picture word, affirmed 2 for 2 on the
  // live drive that found it.
  ['picture_word', 'sun', 'Yes, sun.', 'correct', 'advance', 'sun', undefined, linkCase('word')],
  ['sound_said_back_praise', 'sss', "Yes, that's the sound!", 'none', 'none', 'sun', undefined, linkCase('word')],
  ['other_picture_praise', 'net', 'Yes, net!', 'none', 'none', 'sun', undefined, linkCase('word')],
  ['fair_name', 'sunshine', "That's right, the sun.", 'correct', 'advance', 'sun', undefined, linkCase('word')],
  ['word_retry', 'net', 'Not that one. Listen to the sound again and look at both pictures.', 'incorrect', 'retry',
    'sun', undefined, linkCase('word')],
];

const cases = linkPilot ? LINK_CASES : factPilot ? FACT_CASES : wordPilot ? WORD_CASES : letterPilot ? LETTER_CASES : trainPilot ? TRAIN_CASES : shapePilot ? [
  ['name', 'triangle', 'Correct, it is a triangle.', 'correct', 'advance'],
  ['multilingual', 'triángulo', 'Yes, it is a triangle!', 'correct', 'advance'],
  ['noisy', 'try angle', 'Exactly, triangle is right.', 'correct', 'advance'],
  ['side_substep', 'three', 'Yes, it has three sides. What is its name?', 'none', 'none', 'triangle', 'How many sides does it have?'],
  ...(process.argv.includes('--final-after-substep') ? [
    ['final_after_substep', 'triangle', 'Fantastic job, that red shape is indeed a triangle!', 'correct', 'advance', 'triangle', 'How many corners does the red shape have?'],
    // Exact exchange from the failed lesson-protocol audio run 2 (2026-09-19).
    ['final_after_substep_live', 'triangle', 'Fantastic job, that red shape is indeed a triangle!', 'correct', 'advance', 'triangle',
      "Let's count the pointy corners together; how many do you see on the red shape?"],
  ] : []),
  ['bare_substep', 'three', 'Exactly right!', 'none', 'none', 'triangle', 'How many sides does it have?'],
  ['color_substep', 'red', 'Correct, it is red. Now tell me the shape name.', 'none', 'none', 'triangle', 'What color is it?'],
  ['wrong_name_praise', 'circle', 'Correct, the shape inside the gold ring is a circle!', 'none', 'none'],
  ['comparison_praise', 'square', 'Yes, that other shape is a square. Now name the gold-ringed shape.', 'none', 'none', 'triangle', 'What is the other shape called?'],
  ['open_question', 'triangle', 'Triangle is right. How did you recognize it?', 'correct', 'none'],
  ['retry', 'circle', 'Not a circle. Try naming this shape again.', 'incorrect', 'retry'],
  ['help', 'help', 'Look at the sides and corners. What do you notice?', 'none', 'none'],
  ['example', 'show me', 'This example is a triangle. Now you try naming the gold-ringed shape.', 'none', 'none'],
  ['no_learner', '', 'It is a triangle.', 'none', 'none'],
  ['alternate', 'diamond', 'Correct, diamond is another name for this rhombus.', 'correct', 'advance', 'rhombus or diamond'],
] : [
  ['german', 'f\u00fcnf', "That's right, there are five fish on the board.", 'correct', 'advance'],
  ['spanish', 'ocho', 'Spot on! There are eight fish here.', 'correct', 'advance'],
  ['noisy_transcript', "It's 5:00.", 'Perfect, you counted all five fish correctly!', 'correct', 'advance'],
  ['contradictory_transcript', 'six', 'That is correct, there are five fish.', 'correct', 'advance'],
  ['retry', 'unrecognized speech', 'Not quite. Try counting them again.', 'incorrect', 'retry'],
  ['indirect_retry', 'unrecognized speech', "Let's count them together one more time.", 'incorrect', 'retry'],
  ['help', 'Can you help me?', 'Let us touch each fish together and count them.', 'none', 'none'],
  ['example', 'Can you show me?', 'For example, here are five fish. Now you try.', 'none', 'none'],
  ['encouragement', 'I am stuck', 'You are doing great. Keep trying!', 'none', 'none'],
  ['open_question', 'f\u00fcnf', 'Five is correct. How did you count them?', 'correct', 'none'],
  ['no_learner', '', 'There are five fish here.', 'none', 'none'],
  ['first_row', 'ocho', "That's correct, there are eight fish in the first row! Now, how many are in the second row?", 'none', 'none', 18, 'How many fish are in the first row?'],
  ['second_row', 'Another eight?', "That's right, there are eight fish in the second row too. Now let's count the last two fish to finish!", 'none', 'none', 18, 'How many are in the second row?'],
  ['bare_substep_praise', 'ocho', 'Exactly right!', 'none', 'none', 18, 'How many fish are in the first row?'],
  ['wrong_total_praise', 'ocho', 'Correct, there are eight fish in total!', 'none', 'none', 18],
  ['whole_total', '8 + 8 = 16 + 2 = 18', 'That is correct! There are eighteen fish in total. Great job counting them all up!', 'correct', 'advance', 18, 'How many are in the second row?'],
  ['whole_total_question', 'eighteen', 'Eighteen in total is correct. How did you work it out?', 'correct', 'none', 18],
  // Exact exchange from the failed lesson-protocol audio run 3 (2026-09-19): a
  // recount invitation, then a corrected count, then praise that never restates
  // the total. The tutor affirms the whole assignment without reciting "five".
  ['wrong_then_corrected_board', '1 2 3 4 5', 'Fantastic job counting all the blocks correctly!', 'correct', 'advance', 5,
    "Let's count them again slowly. Try again from the start and touch each block as you count.", {
      task: 'Count the blocks. Your turn. How many blocks?',
      lastResponse: { response: '1 2 3 4 5 6', correct: false, assisted: true },
      activity: { responseSource: 'speech', attemptNumber: 1,
        objects: Array.from({ length: 5 }, (_, i) => ({ id: `object-${i}`, label: `block ${i + 1}`, selected: false })),
        facts: { kind: 'count_all', objects: 'blocks', counted: 0, takenOff: 0, putOn: 0, moved: 'no',
          startFrom: '', changeBy: '', constraints: '', response: 'speech', presentation: 'ready' },
        assistance: { level: 2, answerExposure: 'full' } },
    }],
];
const results = [];
for (let repetition = 1; repetition <= 3; repetition++) for (const [name, learner, tutor, verdict, transition, target, priorTutor, overrides] of cases) {
  // `null` means the binding publishes NO expected answer — the tapped direction,
  // where the activity owns the check and the tutor is never told the letter.
  const expectedAnswer = target === null ? null
    : String(target ?? (factPilot ? 'three' : wordPilot ? 'sam' : letterPilot ? 'mmm' : trainPilot ? 8 : shapePilot ? 'triangle' : name === 'spanish' ? 8 : 5));
  const input = { scope: { sessionEpoch: 'probe', instanceId: 'fish', itemId: 'c1', revision: 1 },
    task: linkPilot ? LINK.held.task : factPilot ? FACT.addition.task
      : wordPilot ? WORD_ASK : letterPilot ? SOUND.grapheme.task : trainPilot ? 'What number comes after 7?'
      : shapePilot ? 'Name the shape inside the gold ring. What shape is it?' : 'Count all the fish. How many fish in total?',
    ...(expectedAnswer === null ? {} : { expectedAnswer }), priorTutor, phase: 'working', learner, tutor, lastResponse: null,
    ...(learner ? { pendingResponse: { id: 'turn-1', text: learner } } : {}),
    activity: { responseSource: null, attemptNumber: 0, objects: trainPilot ? [
      { id: 'car-0', label: 'car 1 showing 7', selected: false, group: 'visible car' },
      { id: 'car-1', label: 'car 2, empty', selected: false, group: 'assignment target (the glowing empty car)' },
    ] : shapePilot ? [
      { id: 'shape-0', label: `red ${expectedAnswer}`, selected: false, group: 'assignment target (gold ring)' },
      { id: 'shape-1', label: 'blue square', selected: false, group: 'comparison shape' },
    ] : Array.from({ length: Number(expectedAnswer) }, (_, i) => ({
      id: `object-${i}`, label: `fish ${i + 1}`, selected: false })), demonstration: [],
      facts: trainPilot ? { kind: 'before-after', response: 'speech',
        assignment: 'Say the number that belongs in the empty car. Reading back the number already printed on the train is not the answer.' }
        : { response: 'speech' },
      assistance: { level: 0, answerExposure: 'none' } } };
  if (overrides) Object.assign(input, overrides, { activity: { ...input.activity, ...overrides.activity } });
  const response = await fetch('http://localhost:3000/api/lumina/live-activity/observe-dialogue', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = await response.json();
  const actualVerdict = result.accepted ? result.verdict : 'none', actualTransition = result.accepted ? result.transition : 'none';
  // A recount invitation can be guidance without a verdict; both dispositions
  // leave the assignment open without awarding success credit.
  const expected = name === 'indirect_retry'
    ? [{ verdict: 'incorrect', transition: 'retry' }, { verdict: 'none', transition: 'none' }]
    : [{ verdict, transition }];
  const passed = expected.some(e => actualVerdict === e.verdict && actualTransition === e.transition);
  results.push({ repetition, name, input, expected, result, passed });
  console.log(repetition, name, actualVerdict, actualTransition, result.verdictConfidence, passed ? 'PASS' : 'FAIL');
}
writeFileSync(process.argv.slice(2).find(arg => !arg.startsWith('--')) || `qa/tutor-reports/${linkPilot ? 'letter-sound-link' : factPilot ? 'di-math-facts' : wordPilot ? 'di-word-reading' : letterPilot ? 'di-letter-sounds' : trainPilot ? 'number-sequencer' : shapePilot ? 'shape-sorter' : 'counting-board'}-tutor-verdict-2026-09-19.json`, JSON.stringify(results, null, 2));
process.exitCode = results.every(r => r.passed) ? 0 : 1;
