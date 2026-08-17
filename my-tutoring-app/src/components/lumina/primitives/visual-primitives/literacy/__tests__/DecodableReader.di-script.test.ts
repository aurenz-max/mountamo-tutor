/**
 * decodableReaderScript — the pedagogy lives here, so this is where it is
 * pinned. Pure, no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (validateJudgedScriptPack)
 *     and every item's answer sits in a BENCHED response class.
 *  2. THE ANSWER-MATERIAL FORK: a one-word answer is SAID, a proposition is
 *     SAID from the printed menu, and the fallback between them is a fork, not
 *     a degrade. EVERY answer in this pack is spoken — the 2026-08-13 ruling
 *     took the tap out, so a `gesture` item reappearing here is the regression.
 *  3. THE COLD READ: a read cue never speaks the line — not in the ask, not in
 *     tap-to-hear — and the per-item guard says so out loud, because the
 *     catalog's scaffolding channel could otherwise re-read it.
 *  4. THE BENCHED WINDOW: 3-8 words comes from di-sentence-reading, not from a
 *     number typed here, and sentences outside it are DROPPED, never trimmed.
 *  5. THE SENTINEL GATE on generated text — including the read-along STORY,
 *     which the tutor narrates and which has no per-sentence item to drop.
 *  6. NEVER SAY THE ANSWER: not in the ask, not on demand, and on a choice
 *     question not in the correction either — only when the cap is reached.
 *  7. The catalog keeps its side: template keys resolve against exactly what
 *     the pack pushes, no catalog sentence opens with a verdict sentinel, and
 *     the steering no longer advertises the costume it shipped for a year.
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_SENTENCE_WORDS,
  MIN_SENTENCE_WORDS,
  affirmLine,
  answerCorrectionLine,
  answerItemFromQuestion,
  askFor,
  buildItems,
  choiceCorrectionLine,
  completeCue,
  contrastCorrectionLine,
  correctionLine,
  decodableReaderHarnessAnswers,
  decodableReaderPackBase,
  evidenceLineFor,
  itemCue,
  itemsFromChallenges,
  moveOnCue,
  opensWithSentinel,
  optionsEarSeparable,
  passageTextFrom,
  pronounceCue,
  readItemFromSentence,
  sentenceText,
  stimulusFor,
  wordsIn,
  type DecodableQuestionLike,
  type DecodableReaderItem,
  type DecodableSentenceLike,
} from '../decodableReaderScript';
import {
  MAX_SENTENCE_WORDS as BENCH_MAX,
  MIN_SENTENCE_WORDS as BENCH_MIN,
} from '../../direct-instruction/diSentenceReadingScript';
import {
  spokenSpanOf,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../../hooks/judgedScriptContract.testkit';
import { LITERACY_CATALOG } from '../../../../service/manifest/catalog/literacy';

// ── Fixtures ────────────────────────────────────────────────────────────────

const wordsOf = (id: string, text: string) => ({
  id,
  words: text.split(' ').map((w, i) => ({ id: `${id}_w${i + 1}`, text: w, phonicsPattern: 'cvc' })),
});

const SENTENCES: DecodableSentenceLike[] = [
  wordsOf('s1', 'The cat sat on a mat.'),
  wordsOf('s2', 'The dog can run.'),
];

const LITERAL_Q: DecodableQuestionLike = {
  question: 'What did the cat sit on?',
  answerWord: 'mat',
  options: [
    { id: 'A', text: 'A mat.', emoji: '🧶' },
    { id: 'B', text: 'A bed.', emoji: '🛏️' },
    { id: 'C', text: 'A box.', emoji: '📦' },
  ],
  correctOptionId: 'A',
};

const PROPOSITION_Q: DecodableQuestionLike = {
  question: 'What is the story mostly about?',
  options: [
    { id: 'A', text: 'A cat and a dog at home.', emoji: '🏠' },
    { id: 'B', text: 'A trip to the moon.', emoji: '🚀' },
    { id: 'C', text: 'Baking a big cake.', emoji: '🎂' },
  ],
  correctOptionId: 'A',
};

const READ = readItemFromSentence(SENTENCES[0], 0)!;
const SPOKEN = answerItemFromQuestion(LITERAL_Q, 0, 'literal', SENTENCES)!;
const CHOICE = answerItemFromQuestion(PROPOSITION_Q, 1, 'main_idea', SENTENCES)!;

const ITEMS: DecodableReaderItem[] = [READ, SPOKEN, CHOICE];

/**
 * The pack exactly as the component assembles it — the SHARED cue surface, not
 * a hand-rolled copy of it. The literal that used to sit here was the eighth
 * such copy the sweep has found: a fixture that re-types the pack can pass
 * while the real one drifts, which is the exact defect 19f caught on both sides
 * of letter-spotter's wire.
 */
const pack: JudgedScriptPack<DecodableReaderItem> =
  decodableReaderPackBase(ITEMS, 'literal');

/** The line the tutor actually SPEAKS — the shared parser, so every port reads
 *  the same span. Everything else in a cue is judge-side instruction. */
const spokenLine = spokenSpanOf;

// ── 1. Structural gates ─────────────────────────────────────────────────────

describe('decodable-reader pack · structural gates', () => {
  it('passes the family gates: validate + performed-directions + repeated-asks', () => {
    // checkPackGates = validateJudgedScriptPack PLUS the two gates that exist
    // because a live drive found the defect after every machine gate passed
    // (the performed "[WAIT silently]"; the byte-identical consecutive ask).
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('a REAL run — consecutive lines of one passage — repeats no ask byte-for-byte', () => {
    // The fixture pack above is one item per kind, which is the ONE shape that
    // cannot trigger findRepeatedConsecutiveAsks: it compares consecutive items
    // of the same action. A passage is read one sentence at a time, so
    // consecutive read_line items are the NORMAL case, and an invariant lead-in
    // there is the port-8/port-11 defect (~14s of identical speech per round).
    expect(checkPackGates({
      ...pack,
      items: buildItems(SENTENCES, [LITERAL_Q, PROPOSITION_Q], 'literal'),
    })).toEqual([]);
  });

  it('the read-along pack passes too — its story rides the opening cue', () => {
    const items = buildItems(SENTENCES, [LITERAL_Q], 'read_along');
    expect(checkPackGates({
      ...pack,
      items,
      completeCue: () => completeCue('read_along'),
    })).toEqual([]);
  });

  it('every item names the class its answer belongs to, and EVERY answer is spoken', () => {
    expect(READ.responseClass).toBe('sentence_read_aloud');
    expect(SPOKEN.responseClass).toBe('short_spoken_word');
    expect(CHOICE.responseClass).toBe('closed_set_choice');
    // REVERT-BITE for the 2026-08-13 ruling: a `gesture` item here means the
    // proposition question went back to being a button.
    for (const item of ITEMS) expect(item.answerKind).toBe('voice');
  });

  it('stamps action per item so the how-to-play re-speaks when the task changes', () => {
    for (const item of ITEMS) expect(item.action).toBe(item.kind);
  });

  it('counts words in CODE, never from the model', () => {
    expect(READ.wordCount).toBe(6);
    expect(wordsIn('The cat sat on a mat.')).toBe(6);
  });

  it('runs the reading first, then the questions — each with its own answer material', () => {
    // Two questions in ONE literal run: the first has a one-word answer, the
    // second is a proposition named from the menu. The fork is per QUESTION,
    // not per session, because it follows the answer, not the mode label.
    const built = buildItems(SENTENCES, [LITERAL_Q, PROPOSITION_Q], 'literal');
    expect(built.map((i) => i.kind)).toEqual(['read_line', 'read_line', 'answer_spoken', 'answer_choice']);
  });
});

// ── 2. The benched window is IMPORTED, and it drops rather than trims ───────

describe('decodable-reader pack · the benched word window', () => {
  it('reads the window from the pack that benched it', () => {
    // REVERT-BITE: re-declaring 3/8 here would let this pack drift away from
    // the sitting silently the day a new sitting moves the ceiling.
    expect(MIN_SENTENCE_WORDS).toBe(BENCH_MIN);
    expect(MAX_SENTENCE_WORDS).toBe(BENCH_MAX);
    expect(MAX_SENTENCE_WORDS).toBe(8);
  });

  it('DROPS a sentence past the ceiling instead of trimming it', () => {
    // A trimmed sentence is a DIFFERENT sentence, and the child is looking at
    // the printed original.
    const long = wordsOf('s9', 'The very small brown dog ran quickly to the little pond today');
    expect(wordsIn(sentenceText(long))).toBeGreaterThan(MAX_SENTENCE_WORDS);
    expect(readItemFromSentence(long, 0)).toBeNull();
  });

  it('DROPS a sentence below the floor — two words is a phrase', () => {
    expect(readItemFromSentence(wordsOf('s9', 'The dog'), 0)).toBeNull();
  });

  it('keeps ids on the sentence id so a drop never renumbers survivors', () => {
    const built = buildItems(
      [SENTENCES[0], wordsOf('s2', 'No'), wordsOf('s3', 'It was a warm day.')],
      [LITERAL_Q],
      'literal',
    );
    expect(built.filter((i) => i.kind === 'read_line').map((i) => i.id)).toEqual(['line-s1', 'line-s3']);
  });
});

// ── 3. The sentinel gate on generated text ──────────────────────────────────

describe('decodable-reader pack · sentinel gate', () => {
  it('DROPS a passage sentence whose own sentence opens with a verdict sentinel', () => {
    // REVERT-BITE: interpolated into a correction this reads
    // "My turn: I was tired. Yes, very tired. Your turn..." — the second
    // sentence opens with the AFFIRM sentinel, so the engine would score the
    // tutor's own correction as an affirmation and advance on a misread.
    expect(opensWithSentinel('I was tired. Yes, very tired.')).toBe(true);
    expect(readItemFromSentence(wordsOf('s9', 'Yes, the cat sat.'), 0)).toBeNull();
    expect(readItemFromSentence(wordsOf('s9', 'My turn to feed it.'), 0)).toBeNull();
  });

  it('a mid-sentence mention is fine — only sentence OPENERS classify', () => {
    const item = readItemFromSentence(wordsOf('s9', 'She said yes to me.'), 0);
    expect(item).not.toBeNull();
    expect(checkPackGates({ ...pack, items: [item!] })).toEqual([]);
  });

  it('SHIPS NOTHING when a read-along STORY would open with a sentinel', () => {
    // The tutor narrates this story; there is no per-sentence item to drop and
    // no safe degrade (cutting the line is a different story, and the answer
    // may live in it). REVERT-BITE for the whole-run gate.
    const story = [wordsOf('s1', 'Yes, the cat sat.'), wordsOf('s2', 'The dog can run.')];
    expect(buildItems(story, [LITERAL_Q], 'read_along')).toEqual([]);
    // The same story in DECODE mode simply drops the one unaskable line.
    expect(buildItems(story, [LITERAL_Q], 'literal').map((i) => i.id)).toEqual(['line-s2', 'q-1']);
  });

  it('DROPS a question or an option that would open a spoken line with a sentinel', () => {
    expect(answerItemFromQuestion(
      { ...PROPOSITION_Q, question: 'Yes or no — did the cat sit?' },
      0,
      'main_idea',
      SENTENCES,
    )).toBeNull();
    expect(answerItemFromQuestion(
      { ...PROPOSITION_Q, options: [{ id: 'A', text: 'Yes it did.' }, { id: 'B', text: 'A bed.' }], correctOptionId: 'A' },
      0,
      'main_idea',
      SENTENCES,
    )).toBeNull();
  });
});

// ── 4. The answer-material fork ─────────────────────────────────────────────

describe('decodable-reader pack · what the answer is MADE of', () => {
  it('a one-word answer in the spoken modes is SAID', () => {
    expect(SPOKEN.kind).toBe('answer_spoken');
    expect(SPOKEN.answerWord).toBe('mat');
    expect(answerItemFromQuestion(LITERAL_Q, 0, 'read_along', SENTENCES)!.kind).toBe('answer_spoken');
  });

  it('a PROPOSITION answer is SAID from the menu, whatever the mode — never tapped', () => {
    // Free spoken production of a proposition would be `open_set_word` (BLOCKED,
    // standing gate 1); the cards close the set, and closing it with a BUTTON is
    // the costume the 2026-08-13 ruling struck down. Comprehension stays the
    // skill either way — what changed is who commits the answer.
    expect(CHOICE.kind).toBe('answer_choice');
    for (const mode of ['sequence', 'inference', 'main_idea'] as const) {
      const item = answerItemFromQuestion(PROPOSITION_Q, 0, mode, SENTENCES)!;
      expect(item.kind).toBe('answer_choice');
      expect(item.answerKind).toBe('voice');
    }
  });

  it('a literal question with no usable one-word answer FORKS to the menu', () => {
    // Not a degrade: the material changed because the answer changed shape.
    const noWord = answerItemFromQuestion({ ...LITERAL_Q, answerWord: '' }, 0, 'literal', SENTENCES)!;
    expect(noWord.kind).toBe('answer_choice');
    const phrase = answerItemFromQuestion(
      { ...LITERAL_Q, answerWord: 'on the soft mat' },
      0,
      'literal',
      SENTENCES,
    )!;
    expect(phrase.kind).toBe('answer_choice');
  });

  it('a yes/no answer word forks to the menu — that is a different response class', () => {
    // `yes_no` is build-ahead with its own accept clauses, and "no" is the
    // VC length `short_spoken_word` records as unbenched. This pack does not
    // launder either through the short-word class.
    for (const answerWord of ['yes', 'no', 'Nope']) {
      expect(answerItemFromQuestion({ ...LITERAL_Q, answerWord }, 0, 'literal', SENTENCES)!.kind)
        .toBe('answer_choice');
    }
  });

  it('DROPS a choice set that cannot be told apart BY EAR', () => {
    // The answer is SPOKEN now, so a subset option is unaskable: a child who
    // says "a cat" has named two of them, and there is no honest verdict for
    // that utterance. Leniency would score a wrong answer right half the time.
    expect(optionsEarSeparable([
      { id: 'A', text: 'A cat.' },
      { id: 'B', text: 'A cat and a dog.' },
    ])).toBe(false);
    expect(optionsEarSeparable(PROPOSITION_Q.options!)).toBe(true);
    expect(answerItemFromQuestion(
      {
        question: 'What is the story mostly about?',
        options: [
          { id: 'A', text: 'A cat.', emoji: '🐈' },
          { id: 'B', text: 'A cat and a dog.', emoji: '🐕' },
        ],
        correctOptionId: 'B',
      },
      0,
      'main_idea',
      SENTENCES,
    )).toBeNull();
  });

  it('DROPS a question that can be asked neither way', () => {
    expect(answerItemFromQuestion(
      { question: 'What is the story about?', options: [{ id: 'A', text: 'A cat.' }], correctOptionId: 'A' },
      0,
      'main_idea',
      SENTENCES,
    )).toBeNull();
    expect(answerItemFromQuestion(
      { ...PROPOSITION_Q, correctOptionId: 'Z' },
      0,
      'main_idea',
      SENTENCES,
    )).toBeNull();
  });

  it('SHIPS NOTHING when a decode run has no readable sentence left', () => {
    // The stage shows one line at a time, so with no lines the child never sees
    // the story — and a question about a story they were never shown is not a
    // harder question, it is a broken one.
    expect(buildItems([wordsOf('s1', 'Go!')], [LITERAL_Q], 'literal')).toEqual([]);
  });
});

// ── 5. The cold read ────────────────────────────────────────────────────────

describe('decodable-reader pack · the cold read', () => {
  it('a read ask never contains the line', () => {
    expect(askFor(READ)).toBe('Your turn. Read it.');
    expect(spokenLine(itemCue(READ))).not.toContain('The cat sat');
  });

  it('the read cue forbids reading the line out loud, per item', () => {
    // The omitted model already withholds it; the guard makes it explicit,
    // because the catalog's scaffolding levels are a second channel.
    expect(itemCue(READ)).toContain('do NOT read the line, or any part of it, before they do');
  });

  it('tap-to-hear on a read line re-speaks the instruction, never the line', () => {
    const heard = pronounceCue(READ);
    expect(heard).toContain('Your turn. Read it.');
    expect(heard).not.toContain('The cat sat on a mat');
    expect(heard).toContain('do NOT read the line');
  });

  it('the reading contract names the signature error and refuses to judge speed', () => {
    expect(itemCue(READ)).toContain('small word swapped for another small word');
    expect(itemCue(READ)).toContain('judge accuracy, never speed');
    expect(itemCue(READ)).toContain('wait for them to finish the whole line before judging it');
  });
});

// ── 6. Never say the answer ─────────────────────────────────────────────────

describe('decodable-reader pack · the answer is never given away', () => {
  it('a spoken question STATES its problem and withholds its answer', () => {
    const spoken = spokenLine(itemCue(SPOKEN));
    expect(spoken).toContain('What did the cat sit on?');
    expect(spoken).not.toMatch(/\bmat\b/i);
  });

  it('tap-to-hear on a question re-asks it and never re-reads the story', () => {
    // For a literal question the story contains the answer verbatim, so
    // re-speaking it on demand would answer the ask.
    const heard = pronounceCue(SPOKEN);
    expect(heard).toContain('What did the cat sit on?');
    expect(heard).not.toContain('The cat sat on a mat');
    expect(heard).toContain('do not re-read the story');
  });

  it('a choice question speaks every choice fairly and marks none of them ALOUD', () => {
    const cue = itemCue(CHOICE);
    const spoken = spokenLine(cue);
    expect(spoken).toContain('What is the story mostly about?');
    for (const option of PROPOSITION_Q.options!) {
      expect(spoken).toContain(option.text.replace(/\.$/, ''));
    }
    expect(spoken).toContain('Tell me which one.');
    expect(spoken).not.toContain('Tap');
    // The judge is told which one is right — it has to judge audio now — but
    // that lives in the INSTRUCTION, never in the line it may speak.
    expect(cue).toContain('The correct one is number 1.');
    expect(spoken).not.toMatch(/correct one is number/i);
    expect(cue).toContain('Never say which one is right');
  });

  it('the choice contract accepts the SHORT form and refuses to guess between two', () => {
    // A five-year-old says "the mat", not the sentence back. Demanding the whole
    // string would fail children for recall and call it comprehension.
    const cue = itemCue(CHOICE);
    expect(cue).toContain('1) "A cat and a dog at home" 2) "A trip to the moon" 3) "Baking a big cake"');
    expect(cue).toContain('the part that tells it apart from the others');
    expect(cue).toContain('where it is in the list');
    expect(cue).toContain('do not guess and do not judge');
  });

  it('a choice correction re-asks fairly and singles out NO card — the retry stays a retry', () => {
    // The re-ask inherits the ask, so it lists every choice again (a pre-reader
    // cannot read the cards). What it must never do is IDENTIFY the right one,
    // which would turn the retry into a formality.
    const correction = choiceCorrectionLine(CHOICE);
    for (const option of PROPOSITION_Q.options!) {
      expect(correction).toContain(option.text.replace(/\.$/, ''));
    }
    expect(correction).not.toMatch(/the answer is|the answer was|that one|the right one/i);
    expect(itemCue(CHOICE)).toContain(correction);
    // …and the CAPPED item closes by naming it, so the child never leaves the
    // story still not knowing.
    expect(moveOnCue(CHOICE, null)).toContain('The answer was A cat and a dog at home.');
  });

  it('the stimulus pushed to the tutor is answer-free by construction', () => {
    // REVERT-BITE for the port's worst live finding: a read item used to push
    // its LINE here, and the tutor fabricated a [CURRENT STATE] block reading
    // it aloud on three consecutive asks — before the child decoded a word.
    // A non-opening read ask is "Your turn. Read it.", which names nothing by
    // design, so the state block was the only content in the room.
    expect(stimulusFor(READ)).not.toContain('The cat sat on a mat');
    expect(stimulusFor(READ)).toContain('6-word line');
    expect(stimulusFor(READ)).toContain('must not guess, describe or announce it');
    // …and the judging contract still quotes it, which is where it is needed.
    expect(itemCue(READ)).toContain('the printed line "The cat sat on a mat." read aloud');
    expect(stimulusFor(SPOKEN)).toBe('What did the cat sit on?');
    expect(stimulusFor(CHOICE)).toBe('What is the story mostly about?');
    expect(stimulusFor(SPOKEN)).not.toMatch(/\bmat\b/i);
  });
});

// ── 7. Verdicts and corrections ─────────────────────────────────────────────

describe('decodable-reader pack · verdicts', () => {
  it('affirmations open with the affirm sentinel', () => {
    expect(affirmLine(READ)).toBe('Yes, that says The cat sat on a mat.');
    expect(affirmLine(SPOKEN)).toBe('Yes, mat.');
    for (const item of ITEMS) expect(affirmLine(item).startsWith('Yes')).toBe(true);
  });

  it('the contrastive reading correction is preferred and names what they said', () => {
    expect(contrastCorrectionLine(READ))
      .toBe('My turn: not ⟨what they said⟩ — The cat sat on a mat. Your turn. Read it again.');
    expect(itemCue(READ)).toContain('do not fall back to the plain re-model');
  });

  it('the plain re-model survives for the miss with nothing to contrast', () => {
    expect(correctionLine(READ)).toBe('My turn: The cat sat on a mat. Your turn. Read it again.');
    expect(itemCue(READ)).toContain('silence, an unintelligible attempt');
  });

  it('a missed comprehension answer is re-modelled from the story sentence itself', () => {
    // Found in CODE, so no new generator field has to be trusted — and it
    // teaches the looking-back move instead of just handing over a word.
    expect(evidenceLineFor('mat', SENTENCES)).toBe('The cat sat on a mat.');
    expect(answerCorrectionLine(SPOKEN))
      .toBe('My turn: The cat sat on a mat. Mat. Your turn. What did the cat sit on?');
  });

  it('an answer that is not in the story still re-models, just without the evidence', () => {
    const item = answerItemFromQuestion(
      { ...LITERAL_Q, question: 'How did the cat feel?', answerWord: 'happy' },
      0,
      'literal',
      SENTENCES,
    )!;
    expect(item.evidenceLine).toBeUndefined();
    expect(answerCorrectionLine(item)).toBe('My turn: Happy. Your turn. How did the cat feel?');
  });

  it('every correction re-models then re-elicits (standing gate 3)', () => {
    expect(correctionLine(READ).startsWith('My turn:')).toBe(true);
    expect(correctionLine(READ)).toContain('Your turn. Read it again.');
    expect(answerCorrectionLine(SPOKEN).startsWith('My turn:')).toBe(true);
    expect(answerCorrectionLine(SPOKEN)).toContain('Your turn. What did the cat sit on?');
    expect(choiceCorrectionLine(CHOICE).startsWith('My turn:')).toBe(true);
    expect(choiceCorrectionLine(CHOICE)).toContain('Your turn. What is the story mostly about?');
  });

  it('the spoken contract accepts the answer inside a phrase and refuses a story word that misses', () => {
    const cue = itemCue(SPOKEN);
    expect(cue).toContain('The answer said inside a phrase or a short sentence');
    expect(cue).toContain('A word from the story that does NOT answer this question is wrong');
  });
});

// ── 8. Read-along: the story is the stimulus, spoken ONCE ───────────────────

describe('decodable-reader pack · read-along', () => {
  const items = buildItems(SENTENCES, [LITERAL_Q, PROPOSITION_Q], 'read_along');

  it('has no read items at all — a pre-reader is not decoding', () => {
    expect(items.every((i) => i.kind !== 'read_line')).toBe(true);
    expect(items.length).toBe(2);
  });

  it('reads the WHOLE story in the opening cue, and only there', () => {
    const opening = spokenLine(itemCue(items[0], { opening: true, howToPlay: true }));
    expect(opening).toContain('Hi! Time for a story!');
    expect(opening).toContain('Listen to our story. The cat sat on a mat. The dog can run.');
    expect(opening).toContain('Your turn. What did the cat sit on?');
    // A later question asks against the story they already heard.
    expect(spokenLine(itemCue(items[1], { howToPlay: true }))).not.toContain('The cat sat on a mat');
  });

  it('closes on what the child actually did — it never praises reading they did not do', () => {
    expect(completeCue('read_along')).toContain('You listened to the whole story');
    expect(completeCue('read_along')).not.toMatch(/you read/i);
    expect(completeCue('literal')).toContain('You read the whole story');
  });

  it('assembles the whole story only for the story panel and the end-of-run view', () => {
    expect(passageTextFrom(SENTENCES)).toBe('The cat sat on a mat. The dog can run.');
  });
});

// ── 9. Session frame + the catalog contract ─────────────────────────────────

describe('decodable-reader pack · session frame and catalog', () => {
  const entry = LITERACY_CATALOG.find((p) => p.id === 'decodable-reader')!;

  it('the opening cue has ONE job; the final cues stop the tutor', () => {
    const opening = spokenLine(itemCue(READ, { opening: true, howToPlay: true }));
    expect(opening).toContain('Hi! Time for a story!');
    expect(opening).toContain('You read it out loud, all by yourself!');
    expect(opening).not.toContain('The cat sat on a mat');
    expect(moveOnCue(CHOICE, null)).toContain('Then stop — the activity is over.');
    expect(completeCue('literal')).toContain('Then stop — the activity is over.');
  });

  it('keeps its side of the contract: audio mode, contextKeys, template keys, sentinel scan', () => {
    expect(checkDiCatalogEntry(entry, pack, READ)).toEqual([]);
  });

  it('the catalog no longer advertises the costume it shipped for a year', () => {
    // "Every word is tappable" and "tracks which words students tap" described
    // an unmeasured reading phase that ended on a button. Manifest steering
    // that still said it would route this primitive as a tap activity forever.
    const steering = `${entry.description} ${entry.constraints}`;
    expect(steering).not.toMatch(/tappable/i);
    expect(steering).not.toMatch(/tracks which words/i);
    expect(steering).not.toMatch(/per-word TTS/i);
    expect(steering).toMatch(/microphone/i);
  });

  it('every scaffolding rung routes through a scripted VERDICT line (18d)', () => {
    // REVERT-BITE. Both rungs used to say "Say the instruction once more, then
    // wait for them alone" — restraint on its face and a STALL in fact: a
    // re-spoken ask opens with neither sentinel, so the reducer records no
    // verdict, the correction counter freezes, and the child waits on a loop
    // that cannot advance.
    const rungs = Object.values(entry.tutoring?.scaffoldingLevels ?? {});
    expect(rungs.length).toBe(3);
    for (const rung of rungs) {
      expect(rung).toMatch(/scripted correction line/i);
      expect(rung).not.toMatch(/say the (instruction|question|ask) (again|once more)/i);
    }
  });

  it('every ACCEPT-side struggle response hands over the scripted line, not just the move (18d)', () => {
    // The worse half of 18d, and no grep for a re-spoken ask reaches it: a row
    // that says "treat it as correct and affirm it" tells the tutor WHAT to do
    // and never gives it the WORDS, so the turn opens with neither sentinel and
    // a child who is RIGHT gets nothing. Three of them shipped here — two rows
    // and one aiDirective.
    const accepts = (entry.tutoring?.commonStruggles ?? [])
      .filter((s) => /treat it as correct|correct answer/i.test(s.response));
    expect(accepts.length).toBeGreaterThan(0);
    for (const struggle of accepts) {
      expect(struggle.response).toMatch(/scripted (affirmation|line)/i);
    }
    const directives = (entry.tutoring?.aiDirectives ?? []).map((d) => d.instruction).join(' ');
    expect(directives).not.toMatch(/affirm it and echo the word/i);
    expect(directives).toMatch(/scripted affirmation line/i);
  });

  it('a "goes quiet" row is NOT 18d and keeps its re-spoken ask', () => {
    // Silence is not an attempt, so no verdict is owed and re-asking is right.
    // This is the line between the two, pinned so a future sweep does not
    // "fix" it (push-pull-arena shipped this shape deliberately).
    const quiet = (entry.tutoring?.commonStruggles ?? [])
      .find((s) => /goes quiet/i.test(s.pattern));
    expect(quiet?.response).toMatch(/once more/i);
  });

  it('the βs moved with the STRUCTURE, not for taste', () => {
    // Every decode mode now contains unaided oral reading judged word by word,
    // so the ladder starts above di-sentence-reading's decodable_sentence (2.5).
    const modes = Object.fromEntries((entry.evalModes ?? []).map((m) => [m.evalMode, m.beta]));
    expect(modes.read_along).toBeLessThan(modes.literal);
    for (const mode of ['literal', 'sequence', 'inference', 'main_idea']) {
      expect(modes[mode]).toBeGreaterThan(2.5);
    }
  });
});

// ── 10. The 18d law and the item-21 tail, on every cue ─────────────────────

describe('decodable-reader pack · the two-branch law and the never-perform tail', () => {
  const everyCue = [
    ...ITEMS.map((item) => itemCue(item, { opening: true, howToPlay: true })),
    ...ITEMS.map((item) => itemCue(item)),
    ...ITEMS.map((item) => moveOnCue(item, null)),
    moveOnCue(READ, SPOKEN, { howToPlay: true }),
    moveOnCue(SPOKEN, CHOICE, { howToPlay: true }),
    ...ITEMS.map(pronounceCue),
    completeCue('literal'),
    completeCue('read_along'),
  ];

  it('every judging contract states the two-branch law BEFORE its branches', () => {
    // The defect is a reply that is NEITHER branch. Family wording, verbatim,
    // so a grep finds every pack that has it and every pack that does not.
    for (const item of ITEMS) {
      const cue = itemCue(item);
      const law = cue.indexOf('Your whole reply to their attempt is ONE of the quoted lines below');
      expect(law).toBeGreaterThan(-1);
      expect(cue).toContain('no reminder of the method, no scaffolding line');
      expect(law).toBeLessThan(cue.indexOf('say exactly'));
    }
  });

  it('every cue carries the item-21 tail, not the weaker bracket-tag line', () => {
    // The measured fix for a fabricated [CURRENT STATE] block, and this pack
    // asks for the family's longest silences — "take your time, I'm listening"
    // is a turn that opens with neither sentinel while the child is mid-word.
    for (const cue of everyCue) {
      expect(cue).toContain('never announce that you are waiting or listening');
      expect(cue).toContain('never announce the activity\'s state');
    }
  });

  it('every cue forbids the tutor asking a question of its OWN', () => {
    // REVERT-BITE for a live finding the two-branch law does NOT cover: the
    // sequence drive's two embellishments both ended by handing the floor back
    // ("Do you want to read another line?"), not by praising. This pack has two
    // real phase boundaries inside one run — the reading ends, the questions
    // begin — so the model gets two wrap-up moments a single-shape pack never
    // offers it, and a question it asks is withdrawn before the child answers.
    for (const cue of everyCue) {
      expect(cue).toContain('Never ask the learner anything that is not inside a quoted line');
    }
  });

  it('the move-on and complete cues still stop the tutor', () => {
    expect(moveOnCue(READ, null)).toContain('Then stop — the activity is over.');
    expect(completeCue('literal')).toContain('Then stop — the activity is over.');
  });
});

// ── 11. The SESSION invariant — no answer is named twice ───────────────────

describe('decodable-reader pack · the session invariant', () => {
  it('DROPS a second question whose answer the tutor already said out loud', () => {
    // §4(d): no single item violates this and no per-item gate can see it.
    // Every comprehension item closes by SAYING its answer ("Yes, mat."), so a
    // second question with the same answer measures recall of the tutor's own
    // last sentence. A K passage is 2-3 sentences and the generator is asked
    // for two questions about it, so this collision is a live draw, not a
    // theoretical one.
    const twice: DecodableQuestionLike = {
      ...LITERAL_Q,
      question: 'Where did the cat have a nap?',
    };
    const built = buildItems(SENTENCES, [LITERAL_Q, twice], 'literal');
    expect(built.filter((i) => i.kind !== 'read_line').map((i) => i.id)).toEqual(['q-1']);
  });

  it('DROPS a second CHOICE question that closes on the same proposition', () => {
    const built = buildItems(
      SENTENCES,
      [PROPOSITION_Q, { ...PROPOSITION_Q, question: 'What is this story about?' }],
      'main_idea',
    );
    expect(built.filter((i) => i.kind !== 'read_line').length).toBe(1);
  });

  it('DROPS a passage sentence printed twice — the affirmation already said it', () => {
    const built = buildItems(
      [SENTENCES[0], SENTENCES[1], wordsOf('s3', 'The dog can run.')],
      [LITERAL_Q],
      'literal',
    );
    expect(built.filter((i) => i.kind === 'read_line').map((i) => i.id))
      .toEqual(['line-s1', 'line-s2']);
  });

  it('KEEPS an already-named answer as a later DISTRACTOR — that is the intended trap', () => {
    // Port 7's other half does NOT transfer here, and gating it would starve a
    // two-question draw for nothing: a distractor that is a true story detail
    // is exactly what the generator is told to build for inference/main_idea,
    // and a child who picks it has made the intended error, not a free one.
    const second: DecodableQuestionLike = {
      question: 'What did the dog do?',
      options: [
        { id: 'A', text: 'The dog ran fast.', emoji: '🐕' },
        { id: 'B', text: 'A cat and a dog at home.', emoji: '🏠' },
      ],
      correctOptionId: 'A',
    };
    const built = buildItems(SENTENCES, [PROPOSITION_Q, second], 'main_idea');
    expect(built.filter((i) => i.kind !== 'read_line').length).toBe(2);
  });

  it('the payload boundary the RUNNER reads is the one the component reads', () => {
    // The mode fork and the legacy single-question coalesce used to live in the
    // component; the DI adapter would have had to re-derive both. `dropped`
    // counts against what was ASKABLE in this mode — a read-along's passage
    // sentences were never candidates.
    const decode = itemsFromChallenges({
      readingMode: 'decode',
      comprehensionType: 'main_idea',
      passage: { sentences: SENTENCES },
      comprehensionQuestion: PROPOSITION_Q,
    });
    expect(decode.mode).toBe('main_idea');
    expect(decode.items.map((i) => i.kind)).toEqual(['read_line', 'read_line', 'answer_choice']);
    expect(decode.dropped).toBe(0);

    const along = itemsFromChallenges({
      readingMode: 'read_along',
      comprehensionType: 'literal',
      passage: { sentences: SENTENCES },
      comprehensionQuestions: [LITERAL_Q],
    });
    expect(along.mode).toBe('read_along');
    expect(along.items.map((i) => i.kind)).toEqual(['answer_spoken']);
    expect(along.dropped).toBe(0);
  });
});

// ── 12. Harness answer material — the contract's claims, made testable ─────

describe('decodable-reader pack · what a right and a wrong child sound like', () => {
  it('a read is answered by saying the line back, and missed by ONE small word', () => {
    // The signature miss the reading contract calls the commonest there is: it
    // keeps the meaning and the rhythm, so a judge grading on gist affirms it.
    const answers = decodableReaderHarnessAnswers(READ);
    expect(answers.correct).toBe('The cat sat on a mat.');
    expect(answers.signatureWrong?.text).toBe('A cat sat on a mat.');
    // …and the contract it drives names that exact substitution.
    expect(itemCue(READ)).toContain('"the" for "a"');
    // The plain wrong swaps a CONTENT word — localisable, so the contrastive
    // branch is the one it should reach.
    expect(answers.plainWrong).not.toBe(answers.correct);
    expect(answers.plainWrong).toMatch(/^The cat sat on a \w+\.$/);
    expect(answers.plainWrong).not.toContain('mat');
  });

  it('the small-word swap stays an utterance a real child could produce', () => {
    // The first signature drive said "A pets are at home", which no five-year-
    // old says — a judge could refuse it as gibberish rather than as the wrong
    // word, and the drive would score a pass it had not earned. The scan skips
    // an article in front of a plural and takes the next candidate, which on
    // that line is the pronoun swap the same child actually makes.
    const plural = readItemFromSentence(wordsOf('s9', 'The pets are at home.'), 0)!;
    const swap = decodableReaderHarnessAnswers(plural).signatureWrong?.text;
    expect(swap).not.toMatch(/^A pets/);
    expect(swap).toBe('The pets are to home.');
  });

  it('a spoken answer is missed by a word from the story that does not answer it', () => {
    // Drawn from the passage's CONTENT words, not the evidence sentence and
    // not the raw passage: the first probe returned "with" (a preposition no
    // judge would affirm) and the second "have". Reading the phonics tags the
    // generator already produces — `sight` IS the function-word tag — turns it
    // into a same-category noun, which is the version a lenient judge affirms.
    const built = buildItems(SENTENCES, [LITERAL_Q], 'literal');
    const spoken = built.find((i) => i.kind === 'answer_spoken')!;
    const answers = decodableReaderHarnessAnswers(spoken);
    expect(answers.correct).toBe('mat');
    expect(spoken.evidenceLine).toBe('The cat sat on a mat.');
    expect(spoken.storyContentWords).toEqual(['the', 'cat', 'sat', 'mat', 'dog', 'can', 'run']);
    // …and never a word the QUESTION already said, which is the contract's
    // OTHER refusal ("the question said back to you"), not this one.
    expect(answers.signatureWrong?.text).toBe('sat');
    expect(spoken.question).not.toContain(answers.signatureWrong!.text);
    expect(itemCue(spoken)).toContain('A word from the story that does NOT answer this question is wrong');
    // The plain wrong is off-story entirely — the baseline refusal test.
    expect(passageTextFrom(SENTENCES)).not.toContain(answers.plainWrong);
  });

  it('a choice answer is SAID IN THE SHORT FORM, and missed by ONE word of a wrong card', () => {
    // The accept side is the contract's whole design, so the harness drives it
    // on the CORRECT beat rather than only on the signature one. The signature
    // is the shortest utterance that still names a wrong card — `shortFormOf`'s
    // tail collapses to the whole card whenever the distinguishing word comes
    // first, which the sequence probe hit on BOTH questions and which left the
    // signature drive byte-identical to the plain one.
    const answers = decodableReaderHarnessAnswers(CHOICE);
    expect(answers.correct).toBe('cat and a dog at home');
    expect(answers.signatureWrong?.text).toBe('trip');
    expect(answers.plainWrong).toBe('A trip to the moon');
    expect(itemCue(CHOICE)).toContain('the part that tells it apart from the others');
  });

  it('DROPS a choice set with a card no five-year-old could say back', () => {
    // The child SAYS the card, so the ceiling is the benched utterance window,
    // not a new number. Dropped, never trimmed: a trimmed option is a different
    // proposition, and it may be the correct one that got shorter.
    expect(answerItemFromQuestion(
      {
        question: 'What is the story mostly about?',
        options: [
          { id: 'A', text: 'Various cute pets enjoying their day at home together.', emoji: '🏠' },
          { id: 'B', text: 'A trip to the moon.', emoji: '🚀' },
        ],
        correctOptionId: 'A',
      },
      0,
      'main_idea',
      SENTENCES,
    )).toBeNull();
    expect(answerItemFromQuestion(PROPOSITION_Q, 0, 'main_idea', SENTENCES)).not.toBeNull();
  });

  it('the READ leak oracle scans the line\'s own content words, with no exemption', () => {
    // This port's sharpest oracle and the one no earlier port has: decoding
    // print is the skill, so print is not the channel — the AUDIO is. It makes
    // the catalog's NEVER READ A LINE THE CHILD HAS NOT READ YET directive
    // machine-checkable.
    const answers = decodableReaderHarnessAnswers(READ);
    expect(answers.leakTokens).toContain('cat');
    expect(answers.leakTokens).toContain('mat');
    expect(answers.leakExemptSpan).toBeUndefined();
    // …and the ask it is scanned against contains none of them.
    expect(spokenLine(itemCue(READ, { opening: true, howToPlay: true })))
      .not.toMatch(/\b(cat|mat|sat)\b/i);
  });

  it('the pack subtracts its OWN prose words, so a move-on cannot fire a false leak', () => {
    // The move-on beat is scanned with the NEXT item's tokens, and this pack's
    // apology says "we will read that one again another DAY". A passage word
    // that is also one of our prose words stops being a leak token; a 3-8 word
    // line has several others and any ONE of them fires the oracle.
    const dayLine = readItemFromSentence(wordsOf('s9', 'The dog naps all day.'), 0)!;
    const answers = decodableReaderHarnessAnswers(dayLine);
    expect(moveOnCue(READ, dayLine)).toContain('again another day');
    expect(answers.leakTokens).not.toContain('day');
    expect(answers.leakTokens).toContain('naps');
  });

  it('read-along subtracts the STORY, decode does not — the tutor reads only one of them', () => {
    const along = buildItems(SENTENCES, [LITERAL_Q], 'read_along');
    const alongAnswers = decodableReaderHarnessAnswers(along[0]);
    expect(alongAnswers.leakExemptSpan)
      .toBe('Listen to our story. The cat sat on a mat. The dog can run. ');
    // In DECODE mode the child reads the story, not the tutor, so the answer
    // word is flat-scanned — which catches a tutor reading ahead.
    expect(decodableReaderHarnessAnswers(SPOKEN).leakExemptSpan).toBeUndefined();
    expect(decodableReaderHarnessAnswers(SPOKEN).leakTokens).toEqual(['mat']);
  });

  it('a choice item never scans a word the QUESTION had to say', () => {
    // Found LIVE, on the sequence drive: "What did the frog hop on first?"
    // against the card "The frog did hop on a stem" filed a HIGH on "hop",
    // which is distinctive of that card and is also how the question is asked.
    // Subtracting the question narrows the oracle to the real answer.
    const item = answerItemFromQuestion(
      {
        question: 'What did the frog hop on first?',
        options: [
          { id: 'A', text: 'The frog did hop on a stem.', emoji: '🌱' },
          { id: 'B', text: 'The bird sang a song.', emoji: '🐦' },
        ],
        correctOptionId: 'A',
      },
      0,
      'sequence',
      SENTENCES,
    )!;
    const answers = decodableReaderHarnessAnswers(item);
    expect(answers.leakTokens).toEqual(['stem']);
    expect(answers.leakTokens).not.toContain('hop');
  });

  it('a read-along CHOICE question needs TWO exempt spans, and gets a list', () => {
    // The first pack in the family with two legitimate spans in one ask: the
    // story it reads aloud and the menu it must name, with the QUESTION sitting
    // between them. One contiguous span would swallow the question — which is
    // exactly where a tutor giving the answer away would do it.
    const along = buildItems(SENTENCES, [PROPOSITION_Q], 'read_along');
    const spans = decodableReaderHarnessAnswers(along[0]).leakExemptSpan;
    expect(Array.isArray(spans)).toBe(true);
    expect(spans).toHaveLength(2);
    expect((spans as string[])[0]).toContain('A trip to the moon');
    expect((spans as string[])[1]).toContain('Listen to our story.');
  });

  it('every item declares a benched class and a correct answer that is not empty', () => {
    for (const item of [...ITEMS, ...buildItems(SENTENCES, [LITERAL_Q], 'read_along')]) {
      const answers = decodableReaderHarnessAnswers(item);
      expect(answers.correct.length).toBeGreaterThan(0);
      expect(answers.plainWrong.length).toBeGreaterThan(0);
      expect(answers.plainWrong).not.toBe(answers.correct);
      expect(answers.signatureWrong?.text ?? 'x').not.toBe(answers.correct);
    }
  });
});
