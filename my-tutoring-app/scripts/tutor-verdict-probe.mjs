// Replays the outcome observer's model input against the real route and scores its verdict.
//
// Every task, expected answer, workspace object and scene fact comes from the domain
// module the component calls (`workspaceAssignment`, `workspaceScene`), loaded through the
// Vite module runner and built from a small challenge fixture by the real item builder. A
// domain sentence therefore changes here when it changes in the lesson. Cases own only the
// conversation: the learner transcript, the tutor reply, the prior tutor turn and the
// evidence state.
//
//   node scripts/tutor-verdict-probe.mjs [--shapes|--letters|--words|--trains|--facts|--links|--sentences|--procedure|--wordproblem] [out.json] [--dry]
//
// No domain flag runs counting-board. `--dry` prints each model input without calling the route.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

const server = await vite.createServer({ root: process.cwd(), configFile: false, appType: 'custom', logLevel: 'error',
  resolve: { alias: [{ find: '@', replacement: resolve('src') }] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const domain = path => runner.import('/src/components/lumina/primitives/visual-primitives/' + path);

const [board, shapes, sounds, words, facts, trains, links, sentences, procedure, wordProblem] = await Promise.all([
  'math/countingBoardDomain.ts', 'math/shapeSorterDomain.ts', 'direct-instruction/diLetterSoundsDomain.ts',
  'direct-instruction/diWordReadingDomain.ts', 'direct-instruction/diMathFactsDomain.ts',
  'math/numberSequencerDomain.ts', 'literacy/letterSoundLinkDomain.ts',
  'direct-instruction/diSentenceReadingDomain.ts', 'direct-instruction/diWorkedProcedureWorkspace.ts',
  'direct-instruction/diWordProblemWorkspace.ts'].map(domain));

/** One built item per fixture. Built one at a time, because two builders drop an item that
 *  repeats a letter or shape an earlier item already named. */
const only = (built, key) => {
  if (built.length < 1) throw new Error(`Fixture ${key} built no item; the domain refused it`);
  return built[0];
};
const FRESH_BOARD = { counted: new Set(), removed: new Set(), added: new Set(), moved: false, covered: 0, hidden: false };
const shapePool = shapeList => shapeList.map(([shape, color, rotation = 0]) => ({ shape, color, size: 'medium', rotation }));

// ── Counting board ──────────────────────────────────────────────────────────
const boardItem = (count, objectWord = 'fish') => {
  const item = only(board.itemsFromChallenges([{ id: `count-${count}`, type: 'count_all', targetAnswer: count, count }],
    { objectWord }), `count-${count}`);
  return { assignment: board.workspaceAssignment(item), scene: board.workspaceScene(item, FRESH_BOARD) };
};
const BOARD_ITEMS = { five: boardItem(5), eight: boardItem(8), eighteen: boardItem(18), blocks: boardItem(5, 'blocks') };
const BOARD_CASES = [
  ['german', 'fünf', "That's right, there are five fish on the board.", 'correct', 'advance', 'five'],
  ['spanish', 'ocho', 'Spot on! There are eight fish here.', 'correct', 'advance', 'eight'],
  ['noisy_transcript', "It's 5:00.", 'Perfect, you counted all five fish correctly!', 'correct', 'advance', 'five'],
  ['contradictory_transcript', 'six', 'That is correct, there are five fish.', 'correct', 'advance', 'five'],
  ['retry', 'unrecognized speech', 'Not quite. Try counting them again.', 'incorrect', 'retry', 'five'],
  ['indirect_retry', 'unrecognized speech', "Let's count them together one more time.", 'incorrect', 'retry', 'five'],
  ['help', 'Can you help me?', 'Let us touch each fish together and count them.', 'none', 'none', 'five'],
  ['example', 'Can you show me?', 'For example, here are five fish. Now you try.', 'none', 'none', 'five'],
  ['encouragement', 'I am stuck', 'You are doing great. Keep trying!', 'none', 'none', 'five'],
  ['open_question', 'fünf', 'Five is correct. How did you count them?', 'correct', 'none', 'five'],
  ['no_learner', '', 'There are five fish here.', 'none', 'none', 'five'],
  ['first_row', 'ocho', "That's correct, there are eight fish in the first row! Now, how many are in the second row?", 'none', 'none', 'eighteen', 'How many fish are in the first row?'],
  ['second_row', 'Another eight?', "That's right, there are eight fish in the second row too. Now let's count the last two fish to finish!", 'none', 'none', 'eighteen', 'How many are in the second row?'],
  ['bare_substep_praise', 'ocho', 'Exactly right!', 'none', 'none', 'eighteen', 'How many fish are in the first row?'],
  ['wrong_total_praise', 'ocho', 'Correct, there are eight fish in total!', 'none', 'none', 'eighteen'],
  ['whole_total', '8 + 8 = 16 + 2 = 18', 'That is correct! There are eighteen fish in total. Great job counting them all up!', 'correct', 'advance', 'eighteen', 'How many are in the second row?'],
  ['whole_total_question', 'eighteen', 'Eighteen in total is correct. How did you work it out?', 'correct', 'none', 'eighteen'],
  // Exact exchange from the failed lesson-protocol audio run 3 (2026-09-19): a
  // recount invitation, then a corrected count, then praise that never restates
  // the total. The tutor affirms the whole assignment without reciting "five".
  ['wrong_then_corrected_board', '1 2 3 4 5', 'Fantastic job counting all the blocks correctly!', 'correct', 'advance', 'blocks',
    "Let's count them again slowly. Try again from the start and touch each block as you count.", {
      lastResponse: { response: '1 2 3 4 5 6', correct: false, assisted: true },
      activity: { responseSource: 'speech', attemptNumber: 1, assistance: { level: 2, answerExposure: 'full' } } }],
  // LA-13 (2026-09-22): whole-task praise that states no result, and praise for the
  // quality of the whole count. Both credit the assignment the prior turn asked.
  ['la13_whole_praise', 'five', 'You did it!', 'correct', 'advance', 'five', 'How many fish are on the board?'],
  ['la13_quality_praise', 'five', 'You counted every fish, nice and carefully!', 'correct', 'advance', 'five', 'How many fish are on the board?'],
];

// ── Shape sorter (identify, count, sort, real-object) ───────────────────────
const shapeItem = (id, pool, type = 'identify', ruleAttribute = 'shape') => {
  const drawn = shapePool(pool);
  const item = only(shapes.itemsFromChallenges([{ id, type, ruleAttribute, shapes: drawn }], { isPreReader: true }), id);
  return { assignment: shapes.workspaceAssignment(item), scene: shapes.workspaceScene(item, drawn) };
};
const realObjectPool = list => list.map(([shape, color, realObject, realObjectId]) =>
  ({ shape, color, size: 'large', rotation: 0, realObject, realObjectId }));
const realObjectItem = (id, list) => {
  const drawn = realObjectPool(list);
  const item = only(shapes.itemsFromChallenges([{ id, type: 'identify-real-object', ruleAttribute: 'shape', shapes: drawn }],
    { isPreReader: true }), id);
  return { assignment: shapes.workspaceAssignment(item), scene: shapes.workspaceScene(item, drawn) };
};
const SHAPE_ITEMS = {
  triangle: shapeItem('triangle', [['triangle', 'red'], ['square', 'blue']]),
  rhombus: shapeItem('rhombus', [['rhombus', 'red', 45], ['circle', 'blue']]),
  hexagon_count: shapeItem('hexagon-count', [['hexagon', 'blue']], 'count'),
  sort_sides: shapeItem('sort-sides',
    [['triangle', 'red'], ['square', 'blue'], ['triangle', 'green'], ['rectangle', 'yellow']], 'sort', 'sides'),
  door: realObjectItem('door', [['rectangle', 'blue', 'door', 'door']]),
  sort_curved_circle: shapeItem('sort-curved-circle', [['circle', 'blue'], ['triangle', 'red'], ['square', 'green']], 'sort', 'curved'),
  sort_curved_triangle: shapeItem('sort-curved-triangle', [['triangle', 'red'], ['circle', 'blue'], ['square', 'green']], 'sort', 'curved'),
};
const SHAPE_CASES = [
  ['name', 'triangle', 'Correct, it is a triangle.', 'correct', 'advance', 'triangle'],
  ['multilingual', 'triángulo', 'Yes, it is a triangle!', 'correct', 'advance', 'triangle'],
  ['noisy', 'try angle', 'Exactly, triangle is right.', 'correct', 'advance', 'triangle'],
  ['side_substep', 'three', 'Yes, it has three sides. What is its name?', 'none', 'none', 'triangle', 'How many sides does it have?'],
  ...(process.argv.includes('--final-after-substep') ? [
    ['final_after_substep', 'triangle', 'Fantastic job, that red shape is indeed a triangle!', 'correct', 'advance', 'triangle', 'How many corners does the red shape have?'],
    // Exact exchange from the failed lesson-protocol audio run 2 (2026-09-19).
    ['final_after_substep_live', 'triangle', 'Fantastic job, that red shape is indeed a triangle!', 'correct', 'advance', 'triangle',
      "Let's count the pointy corners together; how many do you see on the red shape?"],
  ] : []),
  ['bare_substep', 'three', 'Exactly right!', 'none', 'none', 'triangle', 'How many sides does it have?'],
  ['color_substep', 'red', 'Correct, it is red. Now tell me the shape name.', 'none', 'none', 'triangle', 'What color is it?'],
  ['wrong_name_praise', 'circle', 'Correct, the shape inside the gold ring is a circle!', 'none', 'none', 'triangle'],
  ['comparison_praise', 'square', 'Yes, that other shape is a square. Now name the gold-ringed shape.', 'none', 'none', 'triangle', 'What is the other shape called?'],
  ['open_question', 'triangle', 'Triangle is right. How did you recognize it?', 'correct', 'none', 'triangle'],
  ['retry', 'circle', 'Not a circle. Try naming this shape again.', 'incorrect', 'retry', 'triangle'],
  ['help', 'help', 'Look at the sides and corners. What do you notice?', 'none', 'none', 'triangle'],
  ['example', 'show me', 'This example is a triangle. Now you try naming the gold-ringed shape.', 'none', 'none', 'triangle'],
  ['no_learner', '', 'It is a triangle.', 'none', 'none', 'triangle'],
  ['alternate', 'diamond', 'Correct, diamond is another name for this rhombus.', 'correct', 'advance', 'rhombus'],
  // COUNT: the answer is a number; the off-by-one and the shape's own name are the risks.
  ['count', 'six', 'Yes, this shape has six sides.', 'correct', 'advance', 'hexagon_count'],
  ['count_aloud', 'one two three four five six', "That's right, six sides.", 'correct', 'advance', 'hexagon_count'],
  ['count_off_by_one_praise', 'five', 'Yes, five is right!', 'none', 'none', 'hexagon_count'],
  ['count_off_by_one_corrected', 'five', 'Not quite — count again, one more time around.', 'incorrect', 'retry', 'hexagon_count'],
  ['count_shape_name_praise', 'hexagon', 'Yes, hexagon is correct!', 'none', 'none', 'hexagon_count'],
  ['count_open_question', 'six', 'Six is right. How did you count them?', 'correct', 'none', 'hexagon_count'],
  ['count_help', 'help', 'Start at the top and count each side once.', 'none', 'none', 'hexagon_count'],
  ['count_no_learner', '', 'This shape has six sides.', 'none', 'none', 'hexagon_count'],
  // SORT: the answer is the printed group; the shape's own name is the signature wrong.
  ['group', '3 sides', 'Yes, this triangle belongs with the 3 sides group.', 'correct', 'advance', 'sort_sides'],
  ['group_bare_number', 'three', "That's right, 3 sides.", 'correct', 'advance', 'sort_sides'],
  ['group_shape_name_praise', 'triangle', 'Yes, triangle is correct!', 'none', 'none', 'sort_sides'],
  ['group_wrong_corrected', '4 sides', 'Not that mat — this shape belongs with 3 sides. Try again.', 'incorrect', 'retry', 'sort_sides'],
  ['group_open_question', '3 sides', '3 sides is right. What tells you that?', 'correct', 'none', 'sort_sides'],
  ['group_help', 'help', 'Look at what each mat is collecting, then check this shape against them.', 'none', 'none', 'sort_sides'],
  // Real-object naming: the object's own name is the risk, never the answer.
  ['object_shape', 'rectangle', 'Yes, the door is drawn as a rectangle.', 'correct', 'advance', 'door'],
  ['object_name_praise', 'a door', 'Yes, a door is right!', 'none', 'none', 'door'],
  ['object_open_question', 'rectangle', 'Rectangle is right. What tells you that?', 'correct', 'none', 'door'],
  ['object_help', 'help', "Trace the door's outline with your eyes.", 'none', 'none', 'door'],
  // LA-13: whole-task and quality praise for the naming task.
  ['la13_whole_praise', 'triangle', 'You did it!', 'correct', 'advance', 'triangle', 'What is the name of the shape in the gold ring?'],
  ['la13_quality_praise', 'triangle', 'You named it just right!', 'correct', 'advance', 'triangle', 'What is the name of the shape in the gold ring?'],
  // LA-13, verbatim from the refused connected `sort` runs (2026-09-22). The mat label IS
  // the property a sub-step asks for, and the scene says so, so stating the property as
  // the learner's is the group. `sort_live_should_place` is honestly ambiguous: "you
  // should place it" can read as a further step; it is labelled before any run.
  ['sort_live_three_sides', 'three sides', "That's right! You found that the shape has three straight sides.", 'correct', 'advance', 'sort_sides',
    "Let's try counting the sides on that triangle one more time together. How many straight sides do you see?"],
  ['sort_live_straight', 'straight', 'Exactly! The triangle has straight lines and pointy corners, so it belongs on the straight mat.', 'correct', 'advance', 'sort_curved_triangle',
    'Do you see any straight lines or pointy corners on this one?'],
  ['sort_live_should_place', 'curved', 'Exactly! Since the circle is curved all the way around, you should place it on the mat printed "Curved".', 'correct', 'advance', 'sort_curved_circle',
    "Let's take another look at the shape's edge. It goes all the way around in a smooth, round way without any sharp corners or flat sides."],
];

// ── di-letter-sounds ────────────────────────────────────────────────────────
// The whole assignment is one produced sound, so the risks are the keyword picture
// (a route to the sound, not the sound), the letter's NAME, and the tutor's own
// model being mistaken for the child's answer.
const soundItem = challenge => {
  const item = only(sounds.buildLetterSoundItems([challenge]), challenge.id);
  return { assignment: sounds.workspaceAssignment(item), scene: sounds.workspaceScene(item) };
};
const SOUND_ITEMS = {
  grapheme: soundItem({ id: 'm', challengeType: 'letter_sound', letter: 'm', spoken: 'mmm', keyword: 'moon', emoji: '🌙', elicitation: 'isolated', articulation: 'held' }),
  keyword: soundItem({ id: 'a', challengeType: 'letter_sound', letter: 'a', spoken: 'aaa', keyword: 'apple', emoji: '🍎', elicitation: 'keyword' }),
  clipped: soundItem({ id: 't', challengeType: 'letter_sound_review', letter: 't', spoken: '/t/', keyword: 'tent', emoji: '⛺', elicitation: 'isolated', articulation: 'clipped' }),
  onset: soundItem({ id: 'moon', challengeType: 'first_sound_in_word', letter: 'm', spoken: 'mmm', keyword: 'moon', emoji: '🌙', elicitation: 'isolated' }),
};
const CORRECTED_SPEECH = { responseSource: 'speech', attemptNumber: 1, assistance: { level: 2, answerExposure: 'full' } };
const SOUND_CASES = [
  ['sound', 'mmm', 'Yes, mmm.', 'correct', 'advance', 'grapheme'],
  ['noisy', 'hmm', "That's right, the letter m says mmm.", 'correct', 'advance', 'grapheme'],
  // A held phoneme transcribes badly by nature; the tutor heard the audio.
  ['unrecognised_audio', 'um', 'Perfect, that is exactly the sound.', 'correct', 'advance', 'grapheme', 'What sound does this letter make?'],
  ['picture_substep', 'moon', "Yes, that's a moon. Now what sound does moon start with?", 'none', 'none', 'grapheme', 'What is this a picture of?'],
  ['bare_substep', 'moon', 'Exactly right!', 'none', 'none', 'grapheme', 'What is this a picture of?'],
  ['letter_name_praise', 'em', 'Correct, the letter m says em!', 'none', 'none', 'grapheme'],
  ['tutor_model', '', 'This sound is mmm, as in moon. Listen: mmm.', 'none', 'none', 'grapheme'],
  ['help', "I don't know", 'Put your lips together and hum. What do you hear?', 'none', 'none', 'grapheme'],
  ['retry', 'sss', 'Not quite, that is a different sound. Try this one again.', 'incorrect', 'retry', 'grapheme'],
  ['open_question', 'mmm', 'Mmm is right. Where else do you hear that sound?', 'correct', 'none', 'grapheme'],
  ['wrong_then_corrected', 'mmm', 'There you go, that is the sound!', 'correct', 'advance', 'grapheme',
    'Listen to me say it, then you try.', { lastResponse: { response: 'em', correct: false, assisted: true }, activity: CORRECTED_SPEECH }],
  ['keyword_elicitation', 'apple', 'Yes. Apple starts with short a.', 'correct', 'advance', 'keyword'],
  ['clipped_stop', 'tuh', 'That is right, a quick /t/ — a little uh at the end is fine.', 'correct', 'advance', 'clipped'],
  ['clipped_keyword', 'tent', 'Yes, tent starts with that sound.', 'correct', 'advance', 'clipped'],
  ['onset', 'mmm', 'Yes, moon starts with mmm.', 'correct', 'advance', 'onset'],
  ['onset_whole_word', 'moon', 'Yes, the word is moon. Now say just its first sound.', 'none', 'none', 'onset', 'What is the word?'],
  // LA-13, verbatim from the refused live `--audio` run 1 (2026-09-22): the synthetic
  // "mmm" transcribed as "M", after a correction that modelled the sound.
  ['la13_live_just_right', 'M', 'Great job, you made the "mmm" sound just right.', 'correct', 'advance', 'grapheme',
    'That\'s the sound for a different letter. Try making the "mmm" sound, like when you taste something yummy.',
    { lastResponse: { response: 'S', correct: false, assisted: true }, activity: CORRECTED_SPEECH }],
  ['la13_whole_praise', 'mmm', 'You did it!', 'correct', 'advance', 'grapheme', 'What sound does this letter make?'],
  ['la13_quality_praise', 'mmm', 'That sound was just right, nice and long!', 'correct', 'advance', 'grapheme', 'What sound does this letter make?'],
];

// ── di-word-reading ─────────────────────────────────────────────────────────
// The answer IS the printed word, so the risks are the other direction from letter
// sounds: a near neighbour affirmed as the printed word, a sound-out praised before
// the whole word was ever said, and the tutor's own read standing in for the child's.
const wordItem = challenge => {
  const item = only(words.buildWordReadingItems([challenge]), challenge.id);
  return { assignment: words.workspaceAssignment(item), scene: words.workspaceScene(item) };
};
const WORD_ITEMS = {
  cvc: wordItem({ id: 'sam', challengeType: 'cvc_reading', word: 'sam', wordType: 'cvc', graphemes: ['s', 'a', 'm'] }),
  review: wordItem({ id: 'sun', challengeType: 'word_reading_review', word: 'sun', wordType: 'cvc', graphemes: ['s', 'u', 'n'] }),
  sight: wordItem({ id: 'the', challengeType: 'sight_word', word: 'the', wordType: 'sight' }),
};
const WORD_CASES = [
  ['read', 'sam', 'Yes, sam.', 'correct', 'advance', 'cvc'],
  ['noisy', 'saam', "That's right, you read sam.", 'correct', 'advance', 'cvc'],
  // Blending out loud and then saying it fast IS the skill at this stage.
  ['blend_then_word', 'sss aaa mmm sam', 'Yes, you sounded it out and then said sam.', 'correct', 'advance', 'cvc'],
  // The same blend with no whole word at the end is unfinished, not finished.
  ['blend_substep', 'sss aaa mmm', 'Great sounding out!', 'none', 'none', 'cvc', 'Say each sound with me.'],
  ['rhyme_praise', 'sat', 'Yes, sat is right!', 'none', 'none', 'cvc'],
  ['homophone_praise', 'son', 'Yes, son. That is the word.', 'none', 'none', 'review'],
  // A STATED LIMIT: when a tutor over-affirms a homophone without naming it, the
  // observer has nothing to catch it with. The learner transcript is excluded from
  // model input by design (so a correct answer in another language cannot be
  // vetoed), and regrading the audio would be a second speech judge. Only the human
  // microphone sitting can find a tutor mishearing "son" as "sun".
  ['homophone_unnamed_limit', 'son', "Yes, that's right.", 'correct', 'advance', 'review'],
  // The same structural limit from the other direction: the child spelled the word
  // and the tutor affirmed anyway. Only the tutor can refuse to affirm a spelled
  // word, which is why that rule lives in the adapter guidance and the catalog block.
  ['letter_names_praise_limit', 'ess ay em', 'Correct, s-a-m!', 'correct', 'advance', 'cvc'],
  ['tutor_reads_it', '', 'This word is sam. Listen: sam.', 'none', 'none', 'cvc'],
  ['help', "I don't know", 'Look at the first letter and tell me its sound.', 'none', 'none', 'cvc'],
  ['retry', 'sat', 'Not quite, that is a different word. Try this one again.', 'incorrect', 'retry', 'cvc'],
  ['open_question', 'sam', 'Sam is right. How did you work it out?', 'correct', 'none', 'cvc'],
  // LA-13: a bare affirmation after a turn in which the tutor modelled the word.
  ['wrong_then_corrected', 'sam', 'There you go, you read it!', 'correct', 'advance', 'cvc',
    'Listen to me sound it out, then you try.', { lastResponse: { response: 'sat', correct: false, assisted: true }, activity: CORRECTED_SPEECH }],
  ['sight_word', 'the', 'Yes, the.', 'correct', 'advance', 'sight'],
  // The child read the irregular word; the tutor then sounded it out, which is a
  // teaching error. The observer grades the assignment, not the teaching.
  ['sight_sounded_out', 'the', 'Yes — tuh-huh-eee, the. Well done.', 'correct', 'advance', 'sight'],
  ['sight_no_restate', 'the', 'Perfect reading!', 'correct', 'advance', 'sight'],
  ['la13_whole_praise', 'sam', 'You read it!', 'correct', 'advance', 'cvc', 'Read this word.'],
  ['la13_quality_praise', 'sam', 'You read that word smoothly, every sound!', 'correct', 'advance', 'cvc', 'Read this word.'],
];

// ── di-math-facts ───────────────────────────────────────────────────────────
// The answer is NOT on screen, which inverts word reading's risks: the tutor can
// supply the answer before the child says it, an operand echoed back sounds like an
// answer, and a teen and its decade are one unstressed syllable apart.
const factItem = challenge => {
  const item = only(facts.buildMathFactItems([challenge]), challenge.id);
  return { assignment: facts.workspaceAssignment(item), scene: facts.workspaceScene(item) };
};
const FACT_ITEMS = {
  addition: factItem({ id: 'add', challengeType: 'answer_fact', a: 2, b: 1, display: '2 + 1', problem: 'two plus one', answerWord: 'three', answerNumeral: 3, solvedDisplay: '2 + 1 = 3' }),
  subtraction: factItem({ id: 'sub', challengeType: 'subtraction_fact', a: 3, b: 1, display: '3 - 1', problem: 'three minus one', answerWord: 'two', answerNumeral: 2, solvedDisplay: '3 - 1 = 2' }),
  numeral: factItem({ id: 'num', challengeType: 'name_numeral', a: 7, b: 0, display: '7', problem: 'this number', answerWord: 'seven', answerNumeral: 7, solvedDisplay: '7' }),
  teen: factItem({ id: 'teen', challengeType: 'counting_next', a: 12, b: 1, display: '12 →', problem: 'the number after twelve', answerWord: 'thirteen', answerNumeral: 13, solvedDisplay: '12 → 13' }),
};
const WRONG_FIVE = { lastResponse: { response: 'five', correct: false, assisted: true }, activity: CORRECTED_SPEECH };
const FACT_CASES = [
  ['answer', 'three', 'Yes, three.', 'correct', 'advance', 'addition'],
  // Th-fronting is developmental pronunciation of the RIGHT number, not a miss.
  ['noisy', 'free', "That's right, the answer is three.", 'correct', 'advance', 'addition'],
  ['multilingual', 'tres', 'Yes, three is right!', 'correct', 'advance', 'addition'],
  // Counting up to the answer is the spoken analog of sounding out a word.
  ['counted_then_answered', 'one two three', 'Yes, you counted up and got three.', 'correct', 'advance', 'addition'],
  ['count_substep', 'one, two', 'Good counting along with me!', 'none', 'none', 'addition', 'Count up with me, starting at one.'],
  // Echoing an operand is a wrong quantity, and praising it credits nothing.
  ['echo_operand_praise', 'two', 'Correct, the answer is two!', 'none', 'none', 'addition'],
  ['wrong_praise', 'five', 'Yes, five!', 'none', 'none', 'addition'],
  ['retry', 'five', 'Not quite, that is a different number. Try this one again.', 'incorrect', 'retry', 'addition'],
  ['help', "I don't know", 'Put up two fingers, then one more. How many now?', 'none', 'none', 'addition'],
  ['tutor_answers', '', 'Two plus one is three. Listen: three.', 'none', 'none', 'addition'],
  ['open_question', 'three', 'Three is right. How did you work it out?', 'correct', 'none', 'addition'],
  ['no_restate', 'three', 'Fantastic job answering that fact!', 'correct', 'advance', 'addition'],
  // LA-13 in a third domain, as a controlled pair: the prior turn names the answer,
  // or models the act without naming it, as word reading's and letter sounds' did.
  ['wrong_then_corrected', 'three', 'There you go, you got it!', 'correct', 'advance', 'addition',
    'Listen to me: two plus one is three. Now you say it.', WRONG_FIVE],
  ['wrong_then_corrected_unnamed_model', 'three', 'There you go, you got it!', 'correct', 'advance', 'addition',
    'Listen to me count it out, then you try.', WRONG_FIVE],
  ['wrong_then_corrected_named', 'three', 'There you go, three!', 'correct', 'advance', 'addition',
    'Listen to me: two plus one is three. Now you say it.', WRONG_FIVE],
  ['subtraction', 'two', 'Yes, three minus one is two.', 'correct', 'advance', 'subtraction'],
  ['counted_back', 'three, two', 'That is right, you counted back to two.', 'correct', 'advance', 'subtraction'],
  ['numeral_named', 'seven', 'Yes, that number is seven.', 'correct', 'advance', 'numeral'],
  // Reciting the sequence to reach the numeral is a different act from reading it.
  ['numeral_recited', 'one two three four five six seven', 'Great counting!', 'none', 'none', 'numeral'],
  ['teen', 'thirteen', 'Yes, thirteen comes after twelve.', 'correct', 'advance', 'teen'],
  // The discrimination the 1-120 extension depends on: affirming the decade for the
  // teen must not record success.
  ['teen_decade_praise', 'thirty', 'Yes, thirty!', 'none', 'none', 'teen'],
  ['la13_whole_praise', 'three', 'You did it!', 'correct', 'advance', 'addition', 'What is two plus one?'],
  ['la13_quality_praise', 'three', 'Quick and right, great job on that fact!', 'correct', 'advance', 'addition', 'What is two plus one?'],
];

// ── Number train ────────────────────────────────────────────────────────────
const trainItem = challenge => {
  const item = only(trains.buildSequencerItems([challenge]).items, challenge.id);
  return { assignment: trains.workspaceAssignment(item), scene: trains.workspaceScene(item, { shown: item.sequence, placed: [] }) };
};
const TRAIN_ITEMS = {
  next: trainItem({ id: 'after-7', type: 'before-after', sequence: [7, null], correctAnswers: [8], rangeMin: 7, rangeMax: 8 }),
  spot: trainItem({ id: 'spot', type: 'spot-error', sequence: [3, 4, 9, 6, 7], correctAnswers: [5], wrongIndex: 2, rangeMin: 3, rangeMax: 9 }),
};
const TRAIN_CASES = [
  ['next_number', 'eight', 'Yes, eight.', 'correct', 'advance', 'next'],
  ['multilingual', 'ocho', 'Yes, eight comes after seven!', 'correct', 'advance', 'next'],
  ['noisy', 'ate', 'Exactly, eight is the one.', 'correct', 'advance', 'next'],
  // The repaired criterion: a whole-assignment affirmation need not recite the number.
  ['no_restate', 'eight', 'Fantastic job finding the number that comes next!', 'correct', 'advance', 'next'],
  ['open_question', 'eight', 'Eight is right. How did you work that out?', 'correct', 'none', 'next'],
  ['read_back_visible', 'seven', 'Yes, seven is the number you can already see. Now what comes after it?',
    'none', 'none', 'next', 'What number comes after 7?'],
  ['counting_along', 'seven, eight', 'Good counting along with me!', 'none', 'none', 'next', 'Count with me starting at seven.'],
  ['wrong_praise', 'nine', 'Correct, nine comes after seven!', 'none', 'none', 'next'],
  ['retry', 'six', 'Not quite. Look at the train and try again.', 'incorrect', 'retry', 'next'],
  ['help', 'Can you help me?', 'Find the number you can see, then say what belongs in the empty car.', 'none', 'none', 'next'],
  ['example', 'show me', 'Here is another train: after two comes three. Now you try yours.', 'none', 'none', 'next'],
  ['no_learner', '', 'The number after seven is eight.', 'none', 'none', 'next'],
  ['spot_error_named', 'nine', 'Yes, nine does not belong. Five belongs there.', 'correct', 'advance', 'spot'],
  // Naming the replacement answers a DIFFERENT question; affirming it is not success here.
  ['spot_error_repair', 'five', 'Yes, five is the number that belongs there.', 'none', 'none', 'spot'],
  ['la13_whole_praise', 'eight', 'You did it!', 'correct', 'advance', 'next', 'What number comes after 7?'],
  ['la13_quality_praise', 'eight', 'You found the missing number just right!', 'correct', 'advance', 'next', 'What number comes after 7?'],
];

// ── letter-sound-link ───────────────────────────────────────────────────────
// Three directions and two channels, so the risks differ per direction: the letter
// NAME affirmed as its sound, a tutor verdict that contradicts a checked tap, and the
// letter's own sound accepted as a picture word. `tap` publishes NO expected answer:
// the activity checks the tap and the tutor is never told which letter makes the sound.
const linkItem = challenge => {
  const item = only(links.buildLetterSoundLinkItems([challenge], 'medium'), challenge.id);
  return { assignment: links.workspaceAssignment(item), scene: links.workspaceScene(item) };
};
const LINK_ITEMS = {
  held: linkItem({ id: 'see-m', mode: 'see-hear', targetLetter: 'm', targetSound: '/m/', keywordWord: 'map' }),
  clipped: linkItem({ id: 'see-t', mode: 'see-hear', targetLetter: 't', targetSound: '/t/', keywordWord: 'tent' }),
  tap: linkItem({ id: 'hear-s', mode: 'hear-see', targetLetter: 's', targetSound: '/s/', keywordWord: 'sun',
    options: [{ letter: 's', isCorrect: true }, { letter: 'f', isCorrect: false }] }),
  word: linkItem({ id: 'match-s', mode: 'keyword-match', targetLetter: 's', targetSound: '/s/', keywordWord: 'sun',
    options: [{ sound: 'sun', isCorrect: true }, { sound: 'net', isCorrect: false }] }),
};
/** A checked TAP: the activity already graded it, and the observer's question is whether
 *  the tutor's settled feedback agrees and may move the lesson on. `phase: 'checked'` is
 *  load-bearing: `decideDialogue` grounds a non-spoken observation on `lastResponse &&
 *  phase === 'checked'`, so a tap case left at 'working' is refused before the model is read. */
const tapped = (correct, response) => ({ phase: 'checked', lastResponse: { response, correct, assisted: false },
  activity: { responseSource: 'gesture', attemptNumber: 1 } });
const LINK_CASES = [
  ['sound', 'mmm', 'Yes, mmm.', 'correct', 'advance', 'held'],
  // A held phoneme transcribes as a fragment; the tutor heard the real audio.
  ['sound_noisy', 'hmm', "That's right, mmm.", 'correct', 'advance', 'held'],
  // THE signature miss: the NAME said in place of the sound, affirmed fluently.
  ['letter_name_praise', 'em', 'Yes, em is right!', 'none', 'none', 'held'],
  ['letter_name_corrected', 'em', "That is the letter's name. Its sound is mmm. Try that one again.", 'incorrect', 'retry', 'held'],
  ['help', "I don't know", 'Watch my mouth: mmm. Now you try.', 'none', 'none', 'held'],
  ['open_question', 'mmm', 'Mmm is right. What else starts with that sound?', 'correct', 'none', 'held'],
  // LA-13: the child's answer and the tutor's model are the same utterance in the same channel.
  ['wrong_then_corrected', 'mmm', 'There you go, you got it!', 'correct', 'advance', 'held',
    'Listen to me: mmm. Now you say it.', { lastResponse: { response: 'em', correct: false, assisted: true }, activity: CORRECTED_SPEECH }],
  ['wrong_then_corrected_named', 'mmm', 'There you go, mmm!', 'correct', 'advance', 'held',
    'Listen to me: mmm. Now you say it.', { lastResponse: { response: 'em', correct: false, assisted: true }, activity: CORRECTED_SPEECH }],
  // A stop cannot be held: the schwa a five-year-old adds is a correct answer, and so
  // is a word that starts with the sound (user ruling 2026-09-05).
  ['clipped_with_schwa', 'tuh', 'Yes, /t/.', 'correct', 'advance', 'clipped'],
  ['clipped_keyword', 'tent', "That's right, tent starts with /t/.", 'correct', 'advance', 'clipped'],
  // The diagnostic pair for the bare-token abstentions: the same exchange with the
  // affirmation carried in a sentence instead of a bare token.
  ['clipped_with_schwa_sentence', 'tuh', "That's right, you said the /t/ sound.", 'correct', 'advance', 'clipped'],
  // The tapped direction. The learner says nothing; the activity has graded.
  ['tap_correct', '', 'Yes, sss.', 'correct', 'advance', 'tap', undefined, tapped(true, 's')],
  ['tap_correct_question', '', 'Yes, sss. How did you know that one?', 'correct', 'none', 'tap', undefined, tapped(true, 's')],
  ['tap_correct_sentence', '', "That's right, you tapped the letter that makes sss.", 'correct', 'advance', 'tap', undefined, tapped(true, 's')],
  // Praise over a checked-wrong tap. The runtime refuses a verdict that contradicts
  // the activity check; this measures whether the model agrees before that guard has to.
  ['tap_wrong_praise', '', 'Great job!', 'none', 'none', 'tap', undefined, tapped(false, 'f')],
  ['tap_wrong_corrected', '', 'That letter makes a different sound. Listen again: sss.', 'incorrect', 'retry', 'tap', undefined, tapped(false, 'f')],
  // The picture-word direction, and its own documented false affirm: the letter's
  // SOUND said back instead of a picture word.
  ['picture_word', 'sun', 'Yes, sun.', 'correct', 'advance', 'word'],
  ['sound_said_back_praise', 'sss', "Yes, that's the sound!", 'none', 'none', 'word'],
  ['other_picture_praise', 'net', 'Yes, net!', 'none', 'none', 'word'],
  ['fair_name', 'sunshine', "That's right, the sun.", 'correct', 'advance', 'word'],
  ['word_retry', 'net', 'Not that one. Listen to the sound again and look at both pictures.', 'incorrect', 'retry', 'word'],
  ['la13_whole_praise', 'mmm', 'You did it!', 'correct', 'advance', 'held', 'What sound does this letter make?'],
  ['la13_quality_praise', 'mmm', 'That sound was just right!', 'correct', 'advance', 'held', 'What sound does this letter make?'],
];

// ── di-sentence-reading ─────────────────────────────────────────────────────
// The answer IS the printed sentence and is already on screen, so the risks are the
// ones connected text adds: one word dropped, added or swapped inside an otherwise
// right read; praise for part of the sentence; a slow read or a self-correction that
// must still count; and the tutor's own model standing in for the child's read.
const sentenceItem = challenge => {
  const item = only(sentences.buildSentenceReadingItems([challenge]), challenge.id);
  return { assignment: sentences.workspaceAssignment(item), scene: sentences.workspaceScene(item) };
};
const SENTENCE_ITEMS = {
  cat: sentenceItem({ id: 'cat', challengeType: 'decodable_sentence', text: 'The cat sat.', wordCount: 3 }),
  pig: sentenceItem({ id: 'pig', challengeType: 'read_sentence', text: 'I see a big pig.', wordCount: 5 }),
};
const SENTENCE_CASES = [
  ['read', 'The cat sat.', 'Yes, that says the cat sat.', 'correct', 'advance', 'cat'],
  ['noisy', 'the kat sat', 'You read every word. The cat sat!', 'correct', 'advance', 'cat'],
  ['slow_read', 'The... cat... sat.', 'Yes, you read every word, nice and careful.', 'correct', 'advance', 'cat'],
  ['self_correction', 'I see a pig, a big pig.', 'You caught that and fixed it — I see a big pig. Well done.', 'correct', 'advance', 'pig'],
  // Partial praise: the tutor credits the first words and asks for the rest.
  ['partial_praise', 'I see a', 'Good, I see a. Keep going, read the rest.', 'none', 'none', 'pig'],
  // The tutor affirms a reading it names, and the reading it names drops a word.
  ['skipped_word_praise', 'I see a pig.', 'Yes! I see a pig.', 'none', 'none', 'pig'],
  ['swapped_word_praise', 'The cat sit.', 'Yes, the cat sit. Good reading!', 'none', 'none', 'cat'],
  ['tutor_models', '', 'Listen: The cat sat. Now you read it.', 'none', 'none', 'cat'],
  ['help', "I can't read that", 'Let us look at the first word together. What sound does it start with?', 'none', 'none', 'pig'],
  ['retry', 'I see a big pin.', 'Almost. Look at the last word again, and read the whole sentence once more.', 'incorrect', 'retry', 'pig'],
  ['open_question', 'The cat sat.', 'You read it all! What did the cat do?', 'correct', 'none', 'cat'],
  ['wrong_then_corrected', 'The cat sat.', 'There you go, every word!', 'correct', 'advance', 'cat',
    'Listen to me read it, then you read it: The cat sat.', { lastResponse: { response: 'The cat sit.', correct: false, assisted: true }, activity: CORRECTED_SPEECH }],
  ['la13_whole_praise', 'The cat sat.', 'You did it!', 'correct', 'advance', 'cat', 'Read this sentence.'],
  ['la13_quality_praise', 'The cat sat.', 'You read it smoothly, every single word!', 'correct', 'advance', 'cat', 'Read this sentence.'],
];

// ── di-worked-procedure ─────────────────────────────────────────────────────
// Each item is ONE step of a larger subtraction: a column decision or a column's difference. The risk
// LA-13 part 2 measures is the reverse of counting-board's rows: the tutor's natural words for a correct
// item ("step", "ready to subtract") read as partial credit on the whole problem. The false-credit risks
// stay: the flipped column, the regroup without the decremented place, a sub-step of the item itself.
const procedureItem = (minuend, subtrahend, challengeType, id) => {
  const item = procedure.workedProcedureItems({ problems: [{ id: `p${minuend}`, minuend, subtrahend, challengeType }] })
    .find(i => i.id === id);
  if (!item) throw new Error(`Fixture ${id} built no item`);
  return { assignment: procedure.workedProcedureAssignment(item), scene: procedure.workedProcedureScene(item) };
};
const PROCEDURE_ITEMS = {
  clean_ones: procedureItem(69, 54, 'subtract_no_regroup', 'p69-c0-decide'),
  regroup_ones: procedureItem(92, 75, 'subtract_regroup', 'p92-c0-decide'),
  regroup_subtract: procedureItem(92, 75, 'subtract_regroup', 'p92-c0-subtract'),
  regroup_tens: procedureItem(92, 75, 'subtract_regroup', 'p92-c1-decide'),
  live_ones: procedureItem(66, 39, 'subtract_regroup', 'p66-c0-decide'),
};
const PROCEDURE_CASES = [
  // Verbatim from C6 (`subtract_no_regroup-audio-r3`, `subtract_regroup-text-r2`); both pass once the task is
  // the column instruction alone and no problem number reaches the observer (the binding's workarounds).
  ['column_fact', 'nine minus four is five', 'Excellent, nine minus four is indeed five.', 'correct', 'advance', 'clean_ones',
    'Look at the ones column. What do you do there?'],
  ['tens_fact', 'eight minus seven is one', 'Spot on, eight minus seven gives us one!', 'correct', 'advance', 'regroup_tens',
    'Now look at the tens column. What do you do there?'],
  // Verbatim from `subtract_regroup-audio`: the first reply names both new numbers; the second is the
  // confirming reply after `confirm_credit`, refused `unsupported` 3/3.
  ['live_regroup', "I can't take nine from six, so I regroup five tens, 16 ones.",
    'Exactly! You regrouped one ten from the tens place, leaving five tens and making sixteen ones.', 'correct', 'advance', 'live_ones',
    "Not quite. Since we can't subtract the numbers that way, what do you need to do in the ones column to get ready to subtract?"],
  ['live_regroup_confirming', "I can't take nine from six, so I regroup five tens, 16 ones.",
    "That's right, you nailed the regrouping step and are ready to subtract!", 'correct', 'advance', 'live_ones',
    "Not quite. Since we can't subtract the numbers that way, what do you need to do in the ones column to get ready to subtract?",
    { confirming: true }],
  // Step-framed praise. With no result it is honestly ambiguous in isolation; here the item IS the step, so
  // crediting "that step" credits the task. Labelled before any run.
  ['step_praise_no_result', 'twelve minus five is seven', 'Great job on that step!', 'correct', 'advance', 'regroup_subtract',
    'Subtract the ones column. What do you get?'],
  ['step_praise_result', 'twelve minus five is seven', 'Yes, seven ones. That step is done!', 'correct', 'advance', 'regroup_subtract',
    'Subtract the ones column. What do you get?'],
  ['flipped_praise', 'five minus two is three', 'Yes, three!', 'none', 'none', 'regroup_subtract'],
  ['forgot_decrement_praise', 'I regroup, twelve ones', 'Right, twelve ones!', 'none', 'none', 'regroup_ones'],
  // A sub-step OF the item: the tutor credits "regroup" and asks for the new numbers.
  ['substep_of_item', 'I regroup', 'Yes, you need to regroup! Now what are the two new numbers?', 'none', 'none', 'regroup_ones',
    'Look at the ones column. What do you do there?'],
  ['wrong_step', 'three', 'Not quite, that takes the top from the bottom. Try the ones column again.', 'incorrect', 'retry', 'regroup_subtract'],
  ['help', "I don't know", 'Look at the ones column. Is the top digit bigger or smaller than the bottom one?', 'none', 'none', 'regroup_ones'],
  ['tutor_models', '', 'Here we take one ten, so we have eight tens and twelve ones.', 'none', 'none', 'regroup_ones'],
  ['open_question', 'twelve minus five is seven', 'Seven is right. How did you work it out?', 'correct', 'none', 'regroup_subtract'],
];

// ── di-word-problem-setup ───────────────────────────────────────────────────
// Each item is one setup step of a printed story. The build step is a checked gesture (the activity's
// check decides correctness, the observer only reads whether the tutor settled it); the rest are spoken.
const THEME = { nameA: 'Ben', nameB: 'Ava', nounPlural: 'shells', gainPast: 'picked', gainBase: 'pick', losePast: 'dropped', loseBase: 'drop' };
const wordProblemItem = (problem, kind, familyShown = false) => {
  const item = wordProblem.wordProblemItems({ problems: [problem] }).find(i => i.kind === kind);
  if (!item) throw new Error(`Fixture ${problem.id} built no ${kind} item`);
  return { assignment: wordProblem.wordProblemAssignment(item), scene: wordProblem.wordProblemScene(item, { familyShown }) };
};
const PART_WHOLE = { id: 'wps-1-part_whole-part', frameId: 'part_whole:part', theme: THEME, first: 7, second: 5, adjectivePair: 2, challengeType: 'build_family', maxNumber: 20 };
const LOSS = { id: 'wps-2-change-loss_change', frameId: 'change:loss_change', theme: THEME, first: 12, second: 7, adjectivePair: 0, challengeType: 'build_family', maxNumber: 20 };
const WORD_PROBLEM_ITEMS = {
  build: wordProblemItem(PART_WHOLE, 'big_number'), build_loss: wordProblemItem(LOSS, 'big_number'),
  family: wordProblemItem(PART_WHOLE, 'family', true), operation: wordProblemItem(PART_WHOLE, 'operation', true),
  solve: wordProblemItem(PART_WHOLE, 'solve', true),
};
const built = (correct, response) => ({ phase: 'checked', lastResponse: { response, correct, assisted: false },
  activity: { responseSource: 'gesture', attemptNumber: 1 } });
const RIGHT_BUILD = built(true, 'Built the family with "striped shells" and "spotted shells" as the small amounts and "all the shells" as the big amount.');
const WRONG_BUILD = built(false, 'Built the family with "all the shells" and "spotted shells" as the small amounts and "striped shells" as the big amount.');
const RIGHT_LOSS = built(true, 'Built the family with "what Ben has now" and "what Ben dropped" as the small amounts and "what Ben started with" as the big amount.');
/** A spoken answer already credited (`transition_uncertain`): the item is held in `checked` with the
 *  learner's speech as its last response, and the next tutor reply must move it on. */
const HELD_FAMILY = { phase: 'checked', lastResponse: { response: '5 + box = 7', correct: true, assisted: false },
  activity: { responseSource: 'speech', attemptNumber: 1 } };
// For a checked response the runtime reads only the transition (`DialogueObserver`): a certain `advance`
// with no verdict also moves the lesson, so it passes too.
const CHECKED_ADVANCE = { alsoAccept: [{ verdict: 'none', transition: 'advance' }] };
const STORY_PART_WHOLE = 'There are 7 shells. 5 of them are striped. The rest are spotted. How many shells are spotted?';
const FAMILY_ASK = 'Now, let\'s read the number family you built out loud, saying "box" for the unknown amount.';
const WORD_PROBLEM_CASES = [
  // Verbatim from `build_family-audio-r1`: verdict none 0.76, advance 0.87.
  ['build_live_starting', '', 'Great job placing the starting number of shells in the big spot!', 'correct', 'advance', 'build_loss',
    'Ben had 12 shells. Then Ben dropped some of them. Now Ben has 7 shells. How many shells did Ben drop?', { ...RIGHT_LOSS, ...CHECKED_ADVANCE }],
  // Verbatim from `build_family-audio` (advanced at 0.99 in that run).
  ['build_live_all', '', "That's exactly right, you put all the shells in the big spot!", 'correct', 'advance', 'build',
    "Good try, but that part isn't the biggest amount. Let's try again.", { ...RIGHT_BUILD, ...CHECKED_ADVANCE }],
  // `build_family-audio-r1` story 1, with the story's noun: refused uncertain.
  ['build_step_praise', 'I am ready for the next one.', 'Excellent job placing the total number of shells in the big spot!', 'correct', 'advance', 'build',
    STORY_PART_WHOLE, { ...RIGHT_BUILD, ...CHECKED_ADVANCE }],
  ['build_step_no_result', '', 'Nice work on that step!', 'correct', 'advance', 'build', STORY_PART_WHOLE, { ...RIGHT_BUILD, ...CHECKED_ADVANCE }],
  ['build_right_question', '', 'Yes, all the shells go in the big spot. Which card tells how many are striped?', 'correct', 'none', 'build',
    STORY_PART_WHOLE, { ...RIGHT_BUILD, alsoAccept: [{ verdict: 'none', transition: 'none' }] }],
  ['build_wrong_corrected', '', "Good try, but that part isn't the biggest amount. Let's try again.", 'incorrect', 'retry', 'build',
    STORY_PART_WHOLE, WRONG_BUILD],
  ['build_wrong_praise', '', 'Great job building the family!', 'none', 'none', 'build', STORY_PART_WHOLE, WRONG_BUILD],
  // Verbatim from `build_family-audio`: the first reply went to `confirm_credit`, the confirming reply came
  // back correct 0.94 with the transition uncertain, and the held item never advanced on the next reply.
  ['family_live', '5 + box = 7', 'Perfect, you read that family just right!', 'correct', 'advance', 'family', FAMILY_ASK],
  ['family_live_confirming', '5 + box = 7', 'You got it right by saying five plus box equals seven!---', 'correct', 'advance', 'family',
    FAMILY_ASK, { confirming: true }],
  ['family_live_held', 'I am ready to finish.', "You've done an amazing job setting up this problem, let's keep going!", 'correct', 'advance', 'family',
    'You got it right by saying five plus box equals seven!---', { ...HELD_FAMILY, ...CHECKED_ADVANCE }],
  ['family_step_no_result', '5 + box = 7', 'Great job with that step!', 'correct', 'advance', 'family', FAMILY_ASK],
  ['family_step_result', '5 + box = 7', 'Yes, five plus box equals seven. That step is done!', 'correct', 'advance', 'family'],
  ['family_misplaced_praise', 'seven plus box equals five', 'Yes, seven plus box equals five!', 'none', 'none', 'family'],
  ['family_partial', 'five plus box', 'Good, five plus box. Now what does it equal?', 'none', 'none', 'family'],
  ['operation', 'subtract', "That's right, we subtract because we are looking for a missing small part of the total.", 'correct', 'advance', 'operation',
    'Will you add or subtract to find the missing number?'],
  ['operation_wrong', 'add', 'Not quite. Look at where the box is, and try again.', 'incorrect', 'retry', 'operation'],
  ['help', "I don't know", 'Which number in the story is the whole amount?', 'none', 'none', 'family'],
  ['solve', 'two', "That's correct, there are two spotted shells!", 'correct', 'advance', 'solve'],
];

const DOMAINS = [
  { flag: '--shapes', report: 'shape-sorter', items: SHAPE_ITEMS, cases: SHAPE_CASES },
  { flag: '--letters', report: 'di-letter-sounds', items: SOUND_ITEMS, cases: SOUND_CASES },
  { flag: '--words', report: 'di-word-reading', items: WORD_ITEMS, cases: WORD_CASES },
  { flag: '--trains', report: 'number-sequencer', items: TRAIN_ITEMS, cases: TRAIN_CASES },
  { flag: '--facts', report: 'di-math-facts', items: FACT_ITEMS, cases: FACT_CASES },
  { flag: '--links', report: 'letter-sound-link', items: LINK_ITEMS, cases: LINK_CASES },
  { flag: '--sentences', report: 'di-sentence-reading', items: SENTENCE_ITEMS, cases: SENTENCE_CASES },
  { flag: '--procedure', report: 'di-worked-procedure', items: PROCEDURE_ITEMS, cases: PROCEDURE_CASES },
  { flag: '--wordproblem', report: 'di-word-problem-setup', items: WORD_PROBLEM_ITEMS, cases: WORD_PROBLEM_CASES },
];
const chosen = DOMAINS.find(d => process.argv.includes(d.flag))
  ?? { report: 'counting-board', items: BOARD_ITEMS, cases: BOARD_CASES };

/** The request `DialogueObserver` builds, from the same assignment and scene the component
 *  publishes (`demand` = the scene facts plus `response` and `presentation`). */
function requestFor({ assignment, scene }, [, learner, tutor, , , , priorTutor, extra = {}]) {
  return {
    scope: { sessionEpoch: 'probe', instanceId: 'probe', itemId: assignment.id, revision: 1 },
    task: assignment.task,
    ...(assignment.expectedAnswer !== undefined ? { expectedAnswer: assignment.expectedAnswer } : {}),
    ...(priorTutor ? { priorTutor } : {}),
    phase: extra.phase ?? 'working', learner, tutor, lastResponse: extra.lastResponse ?? null,
    // A checked item has no pending answer: the learner's words are conversation, not a response.
    ...(learner && extra.phase !== 'checked' ? { pendingResponse: { id: 'turn-1', text: learner } } : {}),
    ...(extra.confirming ? { confirming: true } : {}),
    activity: { responseSource: null, attemptNumber: 0, objects: scene.objects, demonstration: [],
      facts: { ...scene.facts, response: assignment.response, presentation: 'ready' },
      assistance: { level: 0, answerExposure: 'none' }, ...extra.activity },
  };
}

const results = [];
try {
  if (process.argv.includes('--dry')) {
    for (const c of chosen.cases) console.log(JSON.stringify({ name: c[0], input: requestFor(chosen.items[c[5]], c) }));
  } else {
    for (let repetition = 1; repetition <= 3; repetition++) for (const c of chosen.cases) {
      const [name, , , verdict, transition, itemKey, , extra = {}] = c;
      const input = requestFor(chosen.items[itemKey], c);
      const response = await fetch('http://localhost:3000/api/lumina/live-activity/observe-dialogue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      const actualVerdict = result.accepted ? result.verdict : 'none', actualTransition = result.accepted ? result.transition : 'none';
      // A recount invitation can be guidance without a verdict; both dispositions leave
      // the assignment open without awarding success credit.
      const expected = name === 'indirect_retry'
        ? [{ verdict: 'incorrect', transition: 'retry' }, { verdict: 'none', transition: 'none' }]
        : [{ verdict, transition }, ...(extra.alsoAccept ?? [])];
      // USER RULING 09-24 (no dead end after an answer): where no credit is expected, a below-gate
      // "not credited" retry and a confirm-credit request both grant nothing, so both pass.
      const noCredit = expected.every(e => e.verdict === 'none')
        && (result.reason === 'confirm_credit' || result.resolution === 'not_credited');
      const passed = noCredit || expected.some(e => actualVerdict === e.verdict && actualTransition === e.transition);
      results.push({ repetition, name, input, expected, result, passed });
      console.log(repetition, name, actualVerdict, actualTransition, result.verdictConfidence, passed ? 'PASS' : 'FAIL');
    }
    const out = process.argv.slice(2).find(arg => !arg.startsWith('--'))
      || `qa/tutor-reports/${chosen.report}-tutor-verdict-${new Date().toISOString().slice(0, 10)}.json`;
    writeFileSync(out, JSON.stringify(results, null, 2));
    // False credit: success recorded where none was expected. Under-credit: an expected
    // success that was not recorded. Everything else that failed is `other`.
    const got = r => r.result.accepted ? r.result.verdict : 'none';
    const falseCredit = results.filter(r => got(r) === 'correct' && r.expected.every(e => e.verdict !== 'correct'));
    const underCredit = results.filter(r => !r.passed && r.expected.some(e => e.verdict === 'correct') && got(r) !== 'correct');
    console.log(`${results.filter(r => r.passed).length}/${results.length} passed, false credit ${falseCredit.length}, `
      + `under-credit ${underCredit.length}, other ${results.filter(r => !r.passed).length - falseCredit.length - underCredit.length} -> ${out}`);
  }
} finally {
  await server.close();
}
