/**
 * storyTalkScript — the pedagogy lives here, so this is where it is pinned.
 * Pure, no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (checkPackGates: benched
 *     response classes, sentinel discipline over every cue, performed stage
 *     directions, byte-identical consecutive asks) over the REAL session shape —
 *     same-mode items back to back, because a one-item-per-mode fixture is the
 *     one shape the repeat-ask gate cannot see.
 *  2. THE FORK HAS NO SPLIT, and that is the finding: every mode's answer is ONE
 *     WORD, so every mode is SPOKEN and the four-picture menu is gone. The queue
 *     predicted the two inference modes would keep a 4-picture answer space as
 *     `closed_set_choice`; the generator refutes it, and this file pins the
 *     refutation both directions so a later session cannot re-add tiles by
 *     citing the prediction.
 *  3. THE LEAK RULE IS MODE-SHAPED, which is the subtle part. For
 *     who_what_where and why_because the answer word IS inside the story the
 *     tutor reads aloud — that is the comprehension task, not a leak — so the
 *     assert is that the answer never appears in the ask OUTSIDE the story. For
 *     feeling_check the feeling is absent from the story entirely and the flat
 *     rule applies.
 *  4. Build gates DROP unaskable items rather than repairing them — headed by
 *     the one this primitive exists to need: a story whose DIALOGUE opens a
 *     sentence with a verdict sentinel ("Yes, I found it!" is ordinary
 *     children's writing) would be read verbatim and classified as an
 *     affirmation nobody made.
 *  5. Corrections re-model then re-elicit (standing gate 3) with a per-mode
 *     teaching move, and the correction wording is FIXED across attempts — a
 *     line that is neither sentinel reaches the loop as no verdict at all
 *     (number-bond's cap-drill finding, authored in rather than discovered).
 *  6. The catalog keeps its side of the contract and no steering prose survives
 *     for the deleted tap channel.
 *
 * NO TIMED-STIMULUS RE-RENDER TEST, deliberately: this stage presents nothing on
 * a clock. The story is the tutor's own voice, the listening glyph merely mirrors
 * `tutorSpeaking`, and nothing appears or disappears on a beat — so the ten-frame
 * class of defect (a flash keyed to a wall clock) has no surface here.
 */
import { describe, it, expect } from 'vitest';
import {
  answerKindFor,
  askFor,
  affirmFor,
  challengeAskable,
  completeCue,
  containsWord,
  correctionFor,
  itemCue,
  itemFromChallenge,
  itemsFromChallenges,
  moveOnCue,
  pronounceCue,
  responseClassFor,
  speechSafe,
  stimulusFor,
  storyTalkHarnessAnswers,
  storyTalkPackBase,
  MAX_STORY_CHARS,
  type StoryTalkChallengeLike,
  type StoryTalkItem,
} from '../storyTalkScript';
import {
  findSentinelCollisions,
  spokenSpanOf,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../../hooks/judgedScriptContract.testkit';
import { LITERACY_CATALOG } from '../../../../service/manifest/catalog/literacy';

// ── Fixtures — two per mode, so the session shape runs same-mode back to back ─

const WHO_RAW: StoryTalkChallengeLike = {
  id: 'st-who-1',
  type: 'who_what_where',
  storyTitle: 'The Big Oak',
  story:
    'Milo found a big acorn by the fence. He dug a hole under the oak tree. He pushed the acorn deep inside. '
    + 'Then he ran off to play.',
  question: 'Who hid the acorn?',
  answer: 'milo',
  answerEmoji: '🐿️',
  options: [
    { word: 'milo', emoji: '🐿️' },
    { word: 'rabbit', emoji: '🐇' },
    { word: 'badger', emoji: '🦡' },
    { word: 'mouse', emoji: '🐭' },
  ],
};

const WHO2_RAW: StoryTalkChallengeLike = {
  id: 'st-who-2',
  type: 'who_what_where',
  storyTitle: 'Rainy Boots',
  story:
    'Nina pulled on her red boots. The rain had left big puddles by the gate. She jumped in every one of them. '
    + 'Her socks stayed dry the whole time.',
  question: 'What did Nina jump in?',
  answer: 'puddles',
  answerEmoji: '💧',
  options: [
    { word: 'puddles', emoji: '💧' },
    { word: 'leaves', emoji: '🍂' },
    { word: 'grass', emoji: '🌿' },
    { word: 'sand', emoji: '🏖️' },
  ],
};

const FEEL_RAW: StoryTalkChallengeLike = {
  id: 'st-feel-1',
  type: 'feeling_check',
  storyTitle: 'The Missing Kite',
  story:
    'Tomas looked everywhere for his blue kite. It was not under the bed. It was not in the closet. '
    + 'He sat down and his shoulders drooped.',
  question: 'How did Tomas feel?',
  answer: 'sad',
  answerEmoji: '😢',
  options: [
    { word: 'sad', emoji: '😢' },
    { word: 'proud', emoji: '😌' },
    { word: 'angry', emoji: '😠' },
    { word: 'tired', emoji: '😴' },
  ],
};

const FEEL2_RAW: StoryTalkChallengeLike = {
  id: 'st-feel-2',
  type: 'feeling_check',
  storyTitle: 'The Loud Bang',
  story:
    'Ava was reading in the quiet room. A loud bang came from the hallway. She pulled the blanket up to her chin. '
    + 'Her heart went very fast.',
  question: 'How did Ava feel?',
  answer: 'scared',
  answerEmoji: '😨',
  options: [
    { word: 'scared', emoji: '😨' },
    { word: 'happy', emoji: '😊' },
    { word: 'bored', emoji: '🥱' },
    { word: 'excited', emoji: '🤩' },
  ],
};

const WHY_RAW: StoryTalkChallengeLike = {
  id: 'st-why-1',
  type: 'why_because',
  storyTitle: 'Picnic Day',
  story:
    'The picnic was ready on the grass. Big grey clouds came over the hill. Then the rain came down fast. '
    + 'Everyone carried the food inside.',
  question: 'Why did everyone go inside?',
  answer: 'rain',
  answerEmoji: '🌧️',
  options: [
    { word: 'rain', emoji: '🌧️' },
    { word: 'wind', emoji: '💨' },
    { word: 'snow', emoji: '❄️' },
    { word: 'fog', emoji: '🌫️' },
  ],
};

const WHY2_RAW: StoryTalkChallengeLike = {
  id: 'st-why-2',
  type: 'why_because',
  storyTitle: 'The Squeaky Door',
  story:
    'Ben pushed the shed door open. It made a long squeak every time. His dad brought out the oil can. '
    + 'After that the door was quiet.',
  question: 'Why did the door stop squeaking?',
  answer: 'oil',
  answerEmoji: '🛢️',
  options: [
    { word: 'oil', emoji: '🛢️' },
    { word: 'water', emoji: '💧' },
    { word: 'soap', emoji: '🧼' },
    { word: 'paint', emoji: '🎨' },
  ],
};

const build = (ch: StoryTalkChallengeLike) => itemFromChallenge(ch)!;

const WHO = build(WHO_RAW);
const WHO2 = build(WHO2_RAW);
const FEEL = build(FEEL_RAW);
const FEEL2 = build(FEEL2_RAW);
const WHY = build(WHY_RAW);
const WHY2 = build(WHY2_RAW);

/** The real session shape: same-mode items back to back in every mode, so the
 *  repeat-ask gate is awake (testkit warning — a one-item-per-mode fixture is
 *  the one shape that cannot trigger it). */
const ITEMS: StoryTalkItem[] = [WHO, WHO2, FEEL, FEEL2, WHY, WHY2];

/** The pack exactly as the component assembles it (the component spreads the
 *  same base, so this is one source, not a re-declaration). */
const pack: JudgedScriptPack<StoryTalkItem> = { ...storyTalkPackBase(ITEMS) };

const affirmLine = (cue: string): string =>
  cue.match(/If the answer is right, say exactly:\s*"([\s\S]*?)"/)?.[1] ?? '';
const correctionLine = (cue: string): string =>
  cue.match(/If it is wrong, say exactly:\s*"([\s\S]*?)"/)?.[1] ?? '';

/** Every line the tutor can SPEAK for one item, across its whole life. */
const everySpokenLine = (item: StoryTalkItem): string =>
  [
    spokenSpanOf(itemCue(item, { opening: true, howToPlay: true })),
    spokenSpanOf(itemCue(item, { howToPlay: true })),
    spokenSpanOf(itemCue(item)),
    affirmLine(itemCue(item)),
    correctionLine(itemCue(item)),
    spokenSpanOf(moveOnCue(item, null, {})),
    spokenSpanOf(pronounceCue(item)),
  ].join('\n');

/** The ask with the story removed — everything the tutor says that is NOT the
 *  stimulus. For two of three modes the answer legitimately lives in the story,
 *  so this is the span the leak rule actually governs. */
const askOutsideStory = (item: StoryTalkItem): string =>
  askFor(item).split(item.story).join(' ');

// ── 1. Structural gates ─────────────────────────────────────────────────────

describe('story-talk pack · structural gates', () => {
  it('passes the family gates over the session shape: validate + performed-directions + repeated-asks', () => {
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('two same-mode items in a row never recite a byte-identical long ask', () => {
    // The ask carries the whole story, which is new every item, so consecutive
    // same-mode asks cannot be byte-identical by construction.
    for (const pair of [[WHO, WHO2], [FEEL, FEEL2], [WHY, WHY2]]) {
      expect(checkPackGates({ ...pack, items: pair })).toEqual([]);
    }
  });

  it('every mode is SPOKEN — there is no gesture anywhere in this primitive', () => {
    // The table picture: a teacher reads a story to one child and asks "Who hid
    // the acorn?". There is no menu of cards on that table, and every answer
    // here is one word a five-year-old can say.
    for (const mode of ['who_what_where', 'feeling_check', 'why_because'] as const) {
      expect(answerKindFor(mode)).toBe('voice');
      expect(responseClassFor(mode)).toBe('short_spoken_word');
    }
    for (const item of ITEMS) {
      expect(item.answerKind).toBe('voice');
      expect(item.responseClass).toBe('short_spoken_word');
      expect(item.action).toBe(item.mode);
    }
  });

  it('never claims closed_set_choice or manipulation — the queue predicted a split and the content refutes it', () => {
    // Pinned as a REGRESSION, not a preference: `closed_set_choice` is the class
    // that keeps a menu when free production would be open-set, and nothing here
    // is proposition-shaped. An item arriving with either class means someone
    // re-added tiles.
    for (const item of ITEMS) {
      expect(item.responseClass).not.toBe('closed_set_choice');
      expect(item.responseClass).not.toBe('manipulation');
      expect(item.responseClass).not.toBe('open_set_word');
    }
  });
});

// ── 2. Answer leaks ─────────────────────────────────────────────────────────

describe('story-talk pack · answer leaks', () => {
  it('feeling_check never says the feeling anywhere in the ask — the story does not contain it either', () => {
    for (const item of [FEEL, FEEL2]) {
      expect(containsWord(item.story, item.answer)).toBe(false);
      expect(containsWord(askFor(item), item.answer)).toBe(false);
      expect(containsWord(spokenSpanOf(itemCue(item, { opening: true, howToPlay: true })), item.answer)).toBe(false);
    }
  });

  it('the stated-answer modes speak the answer ONLY inside the story, never in the ask around it', () => {
    // The word being inside the read-aloud IS the comprehension task. What must
    // never happen is the tutor singling it out — so the ask minus the story is
    // the span the rule governs.
    for (const item of [WHO, WHO2, WHY, WHY2]) {
      expect(containsWord(item.story, item.answer)).toBe(true);
      expect(containsWord(askOutsideStory(item), item.answer)).toBe(false);
    }
  });

  it('no question contains its own answer, at any tier', () => {
    for (const item of ITEMS) {
      expect(containsWord(item.question, item.answer)).toBe(false);
    }
  });

  it('the context channel is answer-free and carries the question, never the story', () => {
    for (const item of ITEMS) {
      const stimulus = stimulusFor(item);
      expect(containsWord(stimulus, item.answer)).toBe(false);
      expect(stimulus).not.toContain(item.story);
      expect(pack.contextFor(item)).toEqual({
        challengeType: item.mode,
        stimulus,
      });
    }
  });

  it('tap-to-hear re-tells the story and re-asks — it never becomes a hint ladder', () => {
    for (const item of ITEMS) {
      const heard = spokenSpanOf(pronounceCue(item));
      // Byte-identical to the plain ask: the repeat carries no more help than
      // the first telling (cvc-speller's [ISOLATE_VOWEL] was an answer leak on
      // demand — this channel gets no ladder at all).
      expect(heard).toBe(askFor(item));
      expect(containsWord(askOutsideStory(item), item.answer)).toBe(false);
    }
  });

  it('the near-miss word is harness-only — no cue and no context can reach it', () => {
    // Its old job was to be a tile in the deleted menu. If it turns up in a
    // spoken line, the menu came back through the audio channel.
    for (const item of ITEMS) {
      expect(item.nearMissWord).toBeTruthy();
      expect(everySpokenLine(item)).not.toContain(item.nearMissWord!);
      expect(JSON.stringify(pack.contextFor(item))).not.toContain(item.nearMissWord!);
    }
  });

  it('a story title that names the answer is suppressed rather than dropping the story', () => {
    const leaky = build({ ...WHO_RAW, id: 'st-title-leak', storyTitle: 'Milo Hides It' });
    expect(leaky.displayTitle).toBe('');
    // …and a clean title survives, so the gate is not just "always empty".
    expect(WHO.displayTitle).toBe('The Big Oak');
  });
});

// ── 3. Build gates ──────────────────────────────────────────────────────────

describe('story-talk pack · build gates', () => {
  it('DROPS a story whose dialogue opens a sentence with a verdict sentinel', () => {
    // THE gate this primitive exists to need: it is the only judged surface
    // whose read-aloud is character dialogue, and "Yes, look at this!" read
    // verbatim would be classified by the engine as an affirmation nobody made.
    const dialogueSentinel = {
      ...WHO_RAW,
      id: 'st-sentinel',
      story:
        'Milo found a big acorn by the fence. "Yes, this is the one!" he said. He pushed it under the oak tree. '
        + 'Then he ran off to play.',
    };
    expect(itemFromChallenge(dialogueSentinel)).toBeNull();
    expect(challengeAskable(dialogueSentinel)).toBe(false);
  });

  it('KEEPS ordinary dialogue and folds its double quotes to single ones', () => {
    // Dropping every story with speech in it would drop most of them. Quotation
    // marks have no spoken realization, so folding them is a punctuation
    // normalization — but an embedded `"` would close the Say exactly: span.
    const dialogue = {
      ...WHO_RAW,
      id: 'st-dialogue',
      story:
        'Milo found a big acorn by the fence. "Look at this one!" he called. He pushed it under the oak tree. '
        + 'Then he ran off to play.',
    };
    const item = itemFromChallenge(dialogue)!;
    expect(item).not.toBeNull();
    expect(item.story).not.toContain('"');
    expect(item.story).toContain("'Look at this one!'");
    // And the cue's spoken span survives intact — the whole point of the fold.
    expect(spokenSpanOf(itemCue(item))).toContain("'Look at this one!'");
  });

  it('DROPS a feeling_check whose story names the feeling', () => {
    // The mode claims emotion INFERENCE and the how-to-play line promises "the
    // story will not say how they felt". Nothing checked this before the port.
    expect(itemFromChallenge({
      ...FEEL_RAW,
      id: 'st-feel-stated',
      story:
        'Tomas looked everywhere for his blue kite. He could not find it. Tomas felt sad about the kite. '
        + 'He sat down on the step.',
    })).toBeNull();
  });

  it('DROPS a stated-answer mode whose answer is not actually in the story', () => {
    expect(itemFromChallenge({
      ...WHY_RAW,
      id: 'st-why-absent',
      story:
        'The picnic was ready on the grass. Big grey clouds came over the hill. Everyone carried the food inside. '
        + 'They ate at the kitchen table.',
    })).toBeNull();
  });

  it('DROPS a question that gives its own answer away', () => {
    expect(itemFromChallenge({
      ...WHO_RAW,
      id: 'st-q-leak',
      question: 'Who was Milo hiding the acorn from?',
    })).toBeNull();
  });

  it('DROPS a verdict-shaped answer', () => {
    for (const answer of ['yes', 'no', 'yeah', 'nope']) {
      expect(itemFromChallenge({ ...FEEL_RAW, id: `st-verdict-${answer}`, answer })).toBeNull();
    }
  });

  it('DROPS a story that is not a read-aloud: one sentence, over-long, or carrying markup', () => {
    expect(itemFromChallenge({
      ...WHO_RAW,
      id: 'st-one-sentence',
      story: 'Milo hid the acorn under the oak tree.',
    })).toBeNull();

    expect(itemFromChallenge({
      ...WHO_RAW,
      id: 'st-too-long',
      story: `${'Milo dug a hole by the fence. '.repeat(20)}He pushed the acorn deep inside.`,
    })).toBeNull();
    expect(WHO.story.length).toBeLessThanOrEqual(MAX_STORY_CHARS);

    // Bracket tags are the shape the model has been proven to fabricate from,
    // and underscores get read aloud as blanks.
    expect(itemFromChallenge({
      ...WHO_RAW,
      id: 'st-markup',
      story: 'Milo found a big acorn [pause] by the fence. He hid it under the oak tree. Then he ran off.',
    })).toBeNull();
  });

  it('DROPS an unknown mode rather than guessing one', () => {
    expect(itemFromChallenge({ ...WHO_RAW, id: 'st-mode', type: 'retell' })).toBeNull();
  });

  it('drops without backfilling — a broken story shortens the session, never fills it', () => {
    const items = itemsFromChallenges([
      WHO_RAW,
      { ...WHO_RAW, id: 'st-broken', story: 'Just one sentence.' },
      FEEL_RAW,
    ]);
    expect(items.map((item) => item.id)).toEqual(['st-who-1', 'st-feel-1']);
  });

  it('speechSafe flattens whitespace and folds every quote form', () => {
    expect(speechSafe('He said  “hi”\nand   "bye".')).toBe("He said 'hi' and 'bye'.");
  });
});

// ── 4. Corrections and affirmations ─────────────────────────────────────────

describe('story-talk pack · corrections', () => {
  it('affirms with the sentinel and ECHOES the canonical word', () => {
    // The echo is what makes the accept clauses safe: a child who said
    // "unhappy" hears the story's own word back as the model.
    for (const item of ITEMS) {
      const affirm = affirmFor(item);
      expect(affirm.startsWith('Yes,')).toBe(true);
      expect(affirm).toContain(item.answer);
      expect(affirmLine(itemCue(item))).toBe(affirm);
    }
  });

  it('corrects with My turn, re-models, and re-elicits the SAME question', () => {
    for (const item of ITEMS) {
      const correction = correctionFor(item);
      expect(correction.startsWith('My turn:')).toBe(true);
      expect(correction).toContain(item.answer);
      expect(correction).toContain('Your turn.');
      // Every correction re-ask inherits the ask — a pre-reader cannot look the
      // question back up on screen.
      expect(correction).toContain(item.question);
      expect(correctionLine(itemCue(item))).toBe(correction);
    }
  });

  it('gives each mode its own teaching move, not one generic re-model', () => {
    expect(correctionFor(FEEL)).toContain('That is how you feel when that happens.');
    expect(correctionFor(WHY)).toContain('That is why it happened.');
    expect(correctionFor(WHO)).not.toContain('That is why it happened.');
  });

  it('commands a FIXED correction line across attempts — a third wording is a no-verdict stall', () => {
    // number-bond's cap drill, authored in rather than rediscovered: on a
    // repeated wrong answer the model reaches for a sanctioned-sounding
    // alternative, and a line opening with neither sentinel freezes the
    // correction counter (queue item 18d).
    const cue = itemCue(WHO);
    expect(cue).toContain('Say the SAME correction line on every wrong answer');
    expect(cue).toContain('reaches the activity as no verdict at all');
  });

  it('names the answer when the cap is reached, so a capped story never ends unresolved', () => {
    const capped = moveOnCue(WHO, WHO2, {});
    expect(spokenSpanOf(capped)).toContain(`The answer was ${WHO.answer}.`);
    // …and it carries the NEXT story's ask, so the lesson moves without a gap.
    expect(spokenSpanOf(capped)).toContain(WHO2.story);
    const last = moveOnCue(WHY2, null, {});
    expect(spokenSpanOf(last)).toContain(`The answer was ${WHY2.answer}.`);
  });
});

// ── 5. The session frame ────────────────────────────────────────────────────

describe('story-talk pack · session frame', () => {
  it('the opening cue carries greeting, how-to-play, story and question in ONE quoted line', () => {
    const opening = spokenSpanOf(itemCue(WHO, { opening: true, howToPlay: true }));
    expect(opening).toContain('Hi! Story time!');
    expect(opening).toContain('You tell me the answer out loud!');
    expect(opening).toContain(WHO.story);
    expect(opening).toContain(WHO.question);
  });

  it('the how-to-play names what to LISTEN FOR, and only on the opening or a mode change', () => {
    // The lead-in belongs to the introduction of an action, not to every ask.
    expect(spokenSpanOf(itemCue(FEEL, { howToPlay: true }))).toContain('will not say how they felt');
    expect(spokenSpanOf(itemCue(WHY, { howToPlay: true }))).toContain('WHY it happened');
    expect(spokenSpanOf(itemCue(FEEL))).not.toContain('will not say how they felt');
  });

  it('no spoken line anywhere opens a sentence with a verdict sentinel except the verdicts', () => {
    const cues = ITEMS.flatMap((item) => [
      { label: `ask-${item.id}`, text: spokenSpanOf(itemCue(item, { opening: true, howToPlay: true })) },
      { label: `move-${item.id}`, text: spokenSpanOf(moveOnCue(item, null, {})) },
      { label: `hear-${item.id}`, text: spokenSpanOf(pronounceCue(item)) },
    ]);
    cues.push({ label: 'complete', text: spokenSpanOf(completeCue()) });
    expect(findSentinelCollisions(cues)).toEqual([]);
  });

  it('the harness drives the same-category near miss as the signature wrong', () => {
    const answers = storyTalkHarnessAnswers(FEEL);
    expect(answers.correct).toBe('sad');
    expect(answers.signatureWrong?.text).toBe(FEEL.nearMissWord);
    expect(answers.signatureWrong?.why).toContain('feeling');
    expect(answers.leakTokens).toEqual(['sad']);
    // feeling_check keeps the FLAT leak rule — the feeling is absent from the
    // story, so any mention of it in the ask is a leak and nothing is exempt.
    expect(answers.leakExemptSpan).toBeUndefined();
    // The stated-answer modes exempt exactly the read-aloud, and nothing wider:
    // the greeting, how-to-play, question and hand-over stay governed.
    for (const item of [WHO, WHO2, WHY, WHY2]) {
      expect(storyTalkHarnessAnswers(item).leakExemptSpan).toBe(item.story);
    }
    // The plain wrong must not be a word the tutor has just read aloud, or a
    // refusal would be about the story rather than about the answer.
    for (const item of ITEMS) {
      const plain = storyTalkHarnessAnswers(item).plainWrong;
      expect(containsWord(item.story, plain)).toBe(false);
      expect(plain).not.toBe(item.answer);
    }
  });
});

// ── 6. The catalog side ─────────────────────────────────────────────────────

describe('story-talk catalog · DI frame', () => {
  const entry = LITERACY_CATALOG.find((p) => p.id === 'story-talk')!;

  it('keeps the catalog half of the contract: audio mode, contextKeys, template keys, sentinels', () => {
    expect(checkDiCatalogEntry(entry, pack, WHO)).toEqual([]);
  });

  it('steers as a SPOKEN listening activity — no tap prose survives to route it wrong', () => {
    const steering = `${entry.description} ${entry.constraints}`;
    expect(steering).toMatch(/microphone/i);
    expect(steering).toMatch(/aloud|out loud|SAYS/);
    // The click-era prose promised a picture menu forever. A manifest reading it
    // would route this primitive as a tap activity for the rest of its life.
    expect(steering).not.toMatch(/tapping the matching picture|from 4 options|tap the answer/i);
  });

  it('raises β on every mode, because a 1-of-4 tap became unaided production', () => {
    const betas = Object.fromEntries(
      (entry.evalModes ?? []).map((mode) => [mode.evalMode, mode.beta]),
    );
    expect(betas.who_what_where).toBe(2.5);
    expect(betas.feeling_check).toBe(3.5);
    expect(betas.why_because).toBe(4.5);
  });

  it('offers no quoted replacement line in the scaffolding ladder', () => {
    // A ladder that hands the model a speakable alternative is a no-verdict
    // channel waiting for its cap drill (queue item 18d).
    for (const level of Object.values(entry.tutoring?.scaffoldingLevels ?? {})) {
      expect(level).toMatch(/scripted correction|wording is fixed/i);
      expect(level).not.toMatch(/["“”]/);
    }
  });

  it('tells the tutor there is nothing to tap, so it cannot invite a gesture', () => {
    const directives = (entry.tutoring?.aiDirectives ?? [])
      .map((d) => `${d.title}. ${d.instruction}`)
      .join('\n');
    expect(directives).toMatch(/never suggest picking, pointing, or showing you anything/i);
    expect(directives).toMatch(/\[ST_HEAR\]/);
  });
});
