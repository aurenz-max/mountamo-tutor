/**
 * textStructureAnalyzerScript — the pedagogy lives there, so this is where it is
 * pinned. Pure, no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (`checkPackGates` =
 *     validateJudgedScriptPack + the performed-stage-direction scan + the
 *     byte-identical-consecutive-ask gate), on a fixture AND on the real session
 *     shape — several `find-signal` items back to back, which is the only shape
 *     the repeat-ask gate can fire on.
 *  2. THE FORK, both directions: all three steps are SPOKEN, `find-signal` and
 *     `place-idea` take the BENCHED `short_spoken_word`, `name-structure` takes
 *     `closed_set_choice`. The regression this locks out is a step drifting back
 *     to a tap — all three taps were costumes, and `answerKind: 'gesture'`
 *     anywhere here would mean the fork was re-decided.
 *  3. ⭐ ONE `name-structure` ITEM PER RUN, however long the run. The scope
 *     predicted a pinned session would repeat the same structure question with
 *     the same answer on every item; the payload carries one passage and one
 *     structureType, so the shape resolves it. A second one appearing would mean
 *     someone gave this primitive a challenges array.
 *  4. ⭐ THE FIND-SIGNAL ASK IS DECIDABLE. Its sentence carries exactly ONE
 *     connective, counted against the CODE-OWNED list rather than the model's —
 *     a sentence with two of them has two right answers whether or not the model
 *     wrote both down, and that item drops.
 *  5. THE ASK NEVER READS THE PASSAGE, so the find-signal leak oracle is FLAT.
 *     The other two close on a spoken menu and exempt exactly that clause; at
 *     `hard` above the band floor no menu is spoken and the exemption disappears.
 *  6. Build gates DROP what cannot be asked: an un-separable or unsayable mat, an
 *     excerpt that names its own mat, a kept set landing on one mat, an anchor
 *     that is also a question, anything opening with a verdict sentinel.
 *  7. Corrections open "My turn:", NAME the fact, and re-elicit the same item;
 *     the affirm echoes the canonical wording; the move-on carries NO close line.
 *  8. The catalog keeps its side of the contract: the family audio mode, template
 *     keys resolving against exactly what the pack pushes, no sentence opening
 *     with a verdict sentinel, and no steering prose left over for the deleted
 *     tap/highlight/drag surface.
 */
import { describe, it, expect } from 'vitest';
import {
  ALL_STRUCTURE_TYPES,
  MAX_MAP_ITEMS,
  MAX_SIGNAL_ITEMS,
  MIN_STRUCTURE_OPTIONS_EASY,
  STRUCTURE_LABEL,
  answerKindFor,
  askFor,
  choicesPhrase,
  completeCue,
  countConnectives,
  isSayableLabel,
  isSayableSignalWord,
  itemCue,
  itemsFromPayload,
  leakExemptSpanFor,
  locateSignalWords,
  moveOnCue,
  optionsEarSeparable,
  askIsAnswerFree,
  sentenceNumberFor,
  pronounceCue,
  responseClassFor,
  splitSentences,
  stimulusFor,
  textStructureAnalyzerHarnessAnswers,
  textStructureAnalyzerPackBase,
  wordBoundedIndexOf,
  type TextStructureItem,
  type TextStructurePayloadLike,
} from '../textStructureAnalyzerScript';
import {
  spokenSpanOf,
  spokenSpansOf,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../../hooks/judgedScriptContract.testkit';
import { LITERACY_CATALOG } from '../../../../service/manifest/catalog/literacy';

// ── Fixtures ────────────────────────────────────────────────────────────────

/** Four sentences, each carrying exactly ONE connective — the shape the
 *  generator's rule A asks for, and the shape every find-signal item needs. */
const PASSAGE = [
  'Beavers build dams across small streams.',
  'They cut branches because the water must slow down.',
  'First the beavers drag the branches into place.',
  'The pond behind the dam grows deep and calm.',
].join(' ');

const CAUSE_EFFECT: TextStructurePayloadLike = {
  passage: PASSAGE,
  gradeLevel: '4',
  structureType: 'cause-effect',
  signalWords: [{ word: 'because' }, { word: 'First' }],
  structureOptions: [
    { type: 'cause-effect', label: 'Cause and Effect', description: 'One thing makes another happen.' },
    { type: 'problem-solution', label: 'Problem and Solution', description: 'A problem, then a fix.' },
    { type: 'description', label: 'Description', description: 'Details about one topic.' },
  ],
  templateRegions: [
    { regionId: 'r-cause', label: 'Cause' },
    { regionId: 'r-effect', label: 'Effect' },
  ],
  keyIdeas: [
    { ideaId: 'k0', text: 'Beavers cut branches from the trees', correctRegionId: 'r-cause' },
    { ideaId: 'k1', text: 'The pond grows deep and calm', correctRegionId: 'r-effect' },
    { ideaId: 'k2', text: 'The water slows to a crawl', correctRegionId: 'r-effect' },
    { ideaId: 'k3', text: 'Beavers drag the wood into the stream', correctRegionId: 'r-cause' },
  ],
};

const build = (over: Partial<TextStructurePayloadLike> = {}) =>
  itemsFromPayload({ ...CAUSE_EFFECT, ...over });

const packOf = (items: TextStructureItem[]): JudgedScriptPack<TextStructureItem> => ({
  ...textStructureAnalyzerPackBase(items),
});

const plainAsk = (item: TextStructureItem) =>
  spokenSpanOf(itemCue(item, { opening: false, howToPlay: false }));

const openingCue = (item: TextStructureItem) =>
  itemCue(item, { opening: true, howToPlay: true });

const itemOf = (items: TextStructureItem[], action: TextStructureItem['action']) =>
  items.find((i) => i.action === action) as TextStructureItem;

const CATALOG_ENTRY = LITERACY_CATALOG.find((e) => e.id === 'text-structure-analyzer')!;

// ── 1. The structural gates ─────────────────────────────────────────────────

describe('pack gates', () => {
  it('passes checkPackGates on the built session', () => {
    const { items } = build();
    expect(items.length).toBeGreaterThan(0);
    expect(checkPackGates(packOf(items))).toEqual([]);
  });

  /**
   * ⚠️ THE REPEAT-ASK GATE IS ASLEEP ON A ONE-ITEM-PER-ACTION FIXTURE — it
   * compares CONSECUTIVE items of the SAME action, which is exactly what a
   * cover-the-fork fixture cannot produce. This is the real session shape: two
   * find-signal items back to back, then two place-idea items back to back.
   */
  it('passes the repeat-ask gate on consecutive same-action items', () => {
    const { items } = build();
    const signals = items.filter((i) => i.action === 'find-signal');
    const places = items.filter((i) => i.action === 'place-idea');
    expect(signals.length).toBeGreaterThanOrEqual(2);
    expect(places.length).toBeGreaterThanOrEqual(2);
    expect(checkPackGates(packOf(signals))).toEqual([]);
    expect(checkPackGates(packOf(places))).toEqual([]);
  });

  it('every ask varies with its item, so no two consecutive asks are identical', () => {
    const { items } = build();
    const signals = items.filter((i) => i.action === 'find-signal');
    expect(new Set(signals.map(plainAsk)).size).toBe(signals.length);
    const places = items.filter((i) => i.action === 'place-idea');
    expect(new Set(places.map(plainAsk)).size).toBe(places.length);
  });
});

// ── 2. The fork, both directions ────────────────────────────────────────────

describe('the answer-material fork', () => {
  it('is ALL-VOICE — no step answers with its hands', () => {
    const { items } = build();
    expect(items.every((i) => i.answerKind === 'voice')).toBe(true);
    expect(answerKindFor('find-signal')).toBe('voice');
    expect(answerKindFor('name-structure')).toBe('voice');
    expect(answerKindFor('place-idea')).toBe('voice');
  });

  it('takes the BENCHED class for a word and a mat name, and closed_set_choice only for the structure', () => {
    expect(responseClassFor('find-signal')).toBe('short_spoken_word');
    expect(responseClassFor('place-idea')).toBe('short_spoken_word');
    expect(responseClassFor('name-structure')).toBe('closed_set_choice');
  });

  it('never prints a menu for find-signal — a linking word is produced, not chosen', () => {
    const { items } = build();
    for (const item of items.filter((i) => i.action === 'find-signal')) {
      expect(item.choices).toEqual([]);
      expect(item.namesChoices).toBe(false);
    }
  });
});

// ── 3. ⭐ One Identify ask per run ──────────────────────────────────────────

describe('the one-per-session Identify ask', () => {
  it('builds exactly ONE name-structure item however many items the run has', () => {
    const { items } = build();
    expect(items.filter((i) => i.action === 'name-structure')).toHaveLength(1);
    expect(items.length).toBeGreaterThan(4);
  });

  it('asks it AFTER the linking words, so the evidence is produced first', () => {
    const { items } = build();
    const structureAt = items.findIndex((i) => i.action === 'name-structure');
    const lastSignalAt = items.map((i) => i.action).lastIndexOf('find-signal');
    const firstPlaceAt = items.findIndex((i) => i.action === 'place-idea');
    expect(structureAt).toBeGreaterThan(lastSignalAt);
    expect(structureAt).toBeLessThan(firstPlaceAt);
  });
});

// ── 4. ⭐ The find-signal ask is decidable ──────────────────────────────────

describe('the connective gate', () => {
  it('counts our own list, not the model’s — a phrase counts once', () => {
    expect(countConnectives('They cut branches because the water must slow down.')).toBe(1);
    expect(countConnectives('As a result the pond grew.')).toBe(1);
    expect(countConnectives('Then it rested, and after two weeks it flew.')).toBe(2);
    expect(countConnectives('Beavers build dams across small streams.')).toBe(0);
  });

  it('DROPS a sentence carrying two connectives, even when the model listed only one', () => {
    const ambiguous = 'Otters swim well. Then they rest, and after that they hunt again.';
    const { items, dropped } = build({
      passage: ambiguous,
      signalWords: [{ word: 'Then' }],
      keyIdeas: [],
    });
    expect(items.some((i) => i.action === 'find-signal')).toBe(false);
    expect(dropped).toBeGreaterThan(0);
  });

  it('never builds two find-signal items on the same sentence', () => {
    const { items } = build({
      passage: 'Rain fell hard. The river rose because the rain kept falling and then it spilled over.',
      signalWords: [{ word: 'because' }, { word: 'then' }],
      keyIdeas: [],
    });
    const sentenceIndexes = items
      .filter((i) => i.action === 'find-signal')
      .map((i) => i.sentenceIndex);
    expect(new Set(sentenceIndexes).size).toBe(sentenceIndexes.length);
  });

  it('drops a signal word whose sentence has no sayable ordinal', () => {
    expect(sentenceNumberFor(0)).toBe('one');
    expect(sentenceNumberFor(9)).toBe('ten');
    expect(sentenceNumberFor(10)).toBeNull();
  });
});

describe('passage helpers', () => {
  it('splits sentences with offsets that address the original passage', () => {
    const sentences = splitSentences(PASSAGE);
    expect(sentences).toHaveLength(4);
    for (const s of sentences) expect(PASSAGE.slice(s.start, s.end)).toBe(s.text);
  });

  it('locates signal words on a WORD boundary — "so" does not match inside "also"', () => {
    expect(wordBoundedIndexOf('They also ran.', 'so')).toBe(-1);
    expect(wordBoundedIndexOf('It rained so the river rose.', 'so')).toBe(10);
  });

  it('drops a signal word the passage does not contain, and de-duplicates', () => {
    const located = locateSignalWords(PASSAGE, [
      { word: 'because' }, { word: 'because' }, { word: 'nevertheless' },
    ]);
    expect(located.map((s) => s.word)).toEqual(['because']);
  });
});

// ── 5. The leak oracle ──────────────────────────────────────────────────────

describe('leak discipline', () => {
  it('never speaks the passage — the find-signal ask carries no sentence text', () => {
    const { items } = build();
    for (const item of items.filter((i) => i.action === 'find-signal')) {
      for (const span of spokenSpansOf(openingCue(item))) {
        expect(span).not.toContain(item.stimulusText);
      }
    }
  });

  it('keeps the find-signal oracle FLAT — no exemption, and the ask omits the answer', () => {
    const { items } = build();
    for (const item of items.filter((i) => i.action === 'find-signal')) {
      expect(leakExemptSpanFor(item)).toBeUndefined();
      expect(plainAsk(item).toLowerCase()).not.toContain(item.answer.toLowerCase());
    }
  });

  it('exempts exactly the spoken menu on the two menu steps, and nothing else', () => {
    const { items } = build();
    for (const item of items.filter((i) => i.action !== 'find-signal')) {
      expect(item.namesChoices).toBe(true);
      const exempt = leakExemptSpanFor(item) as string;
      expect(exempt).toBe(choicesPhrase(item));
      const askWithoutMenu = plainAsk(item).replace(exempt, ' ');
      expect(askWithoutMenu.toLowerCase()).not.toContain(item.answer.toLowerCase());
    }
  });

  it('goes flat at `hard` above the band floor — no menu is spoken, so nothing is exempted', () => {
    const { items } = build({ supportTier: 'hard', gradeLevel: '5' });
    for (const item of items) {
      expect(item.namesChoices).toBe(false);
      expect(leakExemptSpanFor(item)).toBeUndefined();
      expect(plainAsk(item).toLowerCase()).not.toContain(item.answer.toLowerCase());
    }
  });

  it('BAND FLOOR beats the tier: grade 2 names the choices at `hard` too', () => {
    const { items } = build({ supportTier: 'hard', gradeLevel: '2' });
    for (const item of items.filter((i) => i.action !== 'find-signal')) {
      expect(item.namesChoices).toBe(true);
    }
  });

  it('never names the structure in the context channel — challengeType is the STEP', () => {
    const { items } = build();
    const pack = packOf(items);
    for (const item of items) {
      const ctx = pack.contextFor(item);
      expect(ctx.challengeType).toBe(item.action);
      expect(Object.keys(ctx)).toEqual(['challengeType', 'stimulus']);
      for (const type of ALL_STRUCTURE_TYPES) {
        expect(ctx.stimulus.toLowerCase()).not.toContain(STRUCTURE_LABEL[type].toLowerCase());
      }
    }
    // The stimulus says how MANY choices there are, never what they are.
    const structure = itemOf(items, 'name-structure');
    expect(stimulusFor(structure)).toContain(String(structure.choices.length));
  });

  it('tap-to-hear repeats the question, carrying no more help than the first asking did', () => {
    const { items } = build();
    for (const item of items) {
      const line = spokenSpanOf(pronounceCue(item));
      // It IS the ask minus the DI hand-over - never a hint ladder.
      expect(line).toBe(askFor(item).replace(/^Your turn\. /, ''));
      const exempt = leakExemptSpanFor(item);
      const scanned = exempt ? line.replace(exempt, ' ') : line;
      expect(scanned.toLowerCase()).not.toContain(item.answer.toLowerCase());
    }
  });

  it('tap-to-hear never reads the sentence the child was pointed at', () => {
    const { items } = build();
    for (const item of items.filter((i) => i.action === 'find-signal')) {
      expect(pronounceCue(item)).not.toContain(item.stimulusText);
    }
  });
});

// ── 6. Build gates DROP, never backfill ─────────────────────────────────────

describe('build gates', () => {
  it('drops the placement step when the mats are not separable by ear', () => {
    const { items } = build({
      templateRegions: [
        { regionId: 'a', label: 'Item A' },
        { regionId: 'b', label: 'Item B' },
      ],
      keyIdeas: [
        { ideaId: 'k0', text: 'Beavers cut branches', correctRegionId: 'a' },
        { ideaId: 'k1', text: 'The pond grows deep', correctRegionId: 'b' },
      ],
    });
    expect(items.some((i) => i.action === 'place-idea')).toBe(false);
  });

  it('the ear gate needs a distinguishing WORD, not a distinguishing letter', () => {
    expect(optionsEarSeparable(['Item A', 'Item B'])).toBe(false);
    expect(optionsEarSeparable(['Cause', 'Effect'])).toBe(true);
    expect(optionsEarSeparable(ALL_STRUCTURE_TYPES.map((t) => STRUCTURE_LABEL[t]))).toBe(true);
    // The subset shape: a child who says "big" has answered both.
    expect(optionsEarSeparable(['Big', 'Big Things'])).toBe(false);
  });

  it('drops an excerpt that NAMES its own mat', () => {
    const { items } = build({
      templateRegions: [
        { regionId: 'p', label: 'Problem' },
        { regionId: 's', label: 'Solution' },
      ],
      keyIdeas: [
        { ideaId: 'k0', text: 'The problem was the flooding', correctRegionId: 'p' },
        { ideaId: 'k1', text: 'Engineers built a taller wall', correctRegionId: 's' },
        { ideaId: 'k2', text: 'The town lost its main road', correctRegionId: 'p' },
      ],
    });
    const texts = items.filter((i) => i.action === 'place-idea').map((i) => i.stimulusText);
    expect(texts).not.toContain('The problem was the flooding');
    expect(texts).toContain('Engineers built a taller wall');
  });

  it('drops the placement step when every kept idea lands on ONE mat', () => {
    const { items } = build({
      keyIdeas: [
        { ideaId: 'k0', text: 'Beavers cut branches', correctRegionId: 'r-cause' },
        { ideaId: 'k1', text: 'Beavers drag them along', correctRegionId: 'r-cause' },
      ],
    });
    expect(items.some((i) => i.action === 'place-idea')).toBe(false);
  });

  it('excludes the `easy` worked anchor from the asked items — an exemplar is not a question', () => {
    const { items } = build({ supportTier: 'easy', anchorIdeaId: 'k0' });
    expect(items.some((i) => i.id === 'idea::k0')).toBe(false);
    expect(items.some((i) => i.id === 'idea::k1')).toBe(true);
  });

  it('refuses an unsayable mat label and a sentinel-opening one', () => {
    expect(isSayableLabel('Cause')).toBe(true);
    expect(isSayableLabel('Main Topic')).toBe(true);
    expect(isSayableLabel('Yes it happened')).toBe(false);
    expect(isSayableLabel('The ideas')).toBe(false); // pack-prose collision
    expect(isSayableLabel('A region label that is far too long to say')).toBe(false);
    expect(isSayableSignalWord('on the other hand')).toBe(true);
    expect(isSayableSignalWord('Yes')).toBe(false);
  });

  it('caps the sitting and reports what it held back rather than shortening silently', () => {
    const longPassage = [
      'Ice covered the lake.',
      'The sun rose because spring had come.',
      'First the edges melted away.',
      'Next the middle turned grey.',
      'Then the last sheet cracked apart.',
      'Finally the water ran free.',
    ].join(' ');
    const { items, truncated } = build({
      passage: longPassage,
      signalWords: [
        { word: 'because' }, { word: 'First' }, { word: 'Next' },
        { word: 'Then' }, { word: 'Finally' },
      ],
    });
    expect(items.filter((i) => i.action === 'find-signal')).toHaveLength(MAX_SIGNAL_ITEMS);
    expect(truncated).toBeGreaterThan(0);
    expect(items.filter((i) => i.action === 'place-idea').length).toBeLessThanOrEqual(MAX_MAP_ITEMS);
  });

  it('builds nothing at all from an empty passage rather than a placeholder ask', () => {
    expect(itemsFromPayload({ passage: '' }).items).toEqual([]);
  });
});

// ── 7. Cue wording ──────────────────────────────────────────────────────────

describe('cue wording', () => {
  it('opens the run with the greeting, the how-to-play and the whole first question in ONE line', () => {
    const { items } = build();
    const span = spokenSpanOf(openingCue(items[0]));
    expect(span).toContain('Hi!');
    expect(span).toContain('you read it and tell me which word links the ideas');
    expect(span).toContain(askFor(items[0]));
  });

  it('speaks the how-to-play only when the STEP changes, never per item', () => {
    const { items } = build();
    const signals = items.filter((i) => i.action === 'find-signal');
    const repeat = spokenSpanOf(itemCue(signals[1], { opening: false, howToPlay: false }));
    expect(repeat).toBe(askFor(signals[1]));
    expect(repeat).not.toContain('I point you at one sentence');
  });

  it('states its problem aloud in every ask — an ask that says nothing is broken, not terser', () => {
    const { items } = build({ supportTier: 'hard', gradeLevel: '5' });
    for (const item of items) {
      const ask = askFor(item);
      expect(ask.startsWith('Your turn.')).toBe(true);
      expect(ask.endsWith('?') || ask.endsWith('.')).toBe(true);
      expect(ask.length).toBeGreaterThan(30);
    }
  });

  it('corrections open "My turn:", NAME the fact, and re-elicit the same item', () => {
    const { items } = build();
    for (const item of items) {
      const spans = spokenSpansOf(itemCue(item, { opening: false, howToPlay: false }));
      const correction = spans[2];
      expect(correction.startsWith('My turn:')).toBe(true);
      expect(correction).toContain(item.answer);
      expect(correction).toContain(askFor(item));
    }
  });

  it('affirmations open "Yes," and echo the canonical answer', () => {
    const { items } = build();
    for (const item of items) {
      const affirm = spokenSpansOf(itemCue(item, { opening: false, howToPlay: false }))[1];
      expect(affirm.startsWith('Yes,')).toBe(true);
      expect(affirm).toContain(item.answer);
    }
  });

  it('the move-on carries NO close line — the corrections already named the fact twice', () => {
    const { items } = build();
    const [first, second] = items;
    const span = spokenSpanOf(moveOnCue(first, second, { howToPlay: false }));
    expect(span).toContain('Good try!');
    expect(span).toContain(askFor(second));
    expect(span.toLowerCase()).not.toContain(first.answer.toLowerCase());
  });

  it('the last move-on closes the item without naming anything', () => {
    const { items } = build();
    const span = spokenSpanOf(moveOnCue(items[items.length - 1], null, {}));
    expect(span).toContain('another day');
  });

  it('the complete cue names the modality honestly — this run really was all spoken', () => {
    expect(spokenSpanOf(completeCue())).toContain('told me every answer out loud');
  });

  it('the tier ladder rides the LEAD-IN only, never the ask or the verdicts', () => {
    const ask = (tier: 'easy' | 'medium' | 'hard') => {
      const { items } = build({ supportTier: tier, gradeLevel: '2' });
      return askFor(itemOf(items, 'find-signal'));
    };
    expect(ask('easy')).toBe(ask('medium'));
    expect(ask('medium')).toBe(ask('hard'));

    const openingOf = (tier: 'easy' | 'medium' | 'hard') => {
      const { items } = build({ supportTier: tier, gradeLevel: '2' });
      return spokenSpanOf(openingCue(itemOf(items, 'find-signal')));
    };
    expect(openingOf('easy').length).toBeGreaterThan(openingOf('medium').length);
    expect(openingOf('medium').length).toBeGreaterThan(openingOf('hard').length);
  });
});

// ── 8. Harness answer material ──────────────────────────────────────────────

describe('harness answers', () => {
  it('names a CONTENT word from the same sentence as find-signal’s signature wrong', () => {
    const { items } = build();
    const signal = itemOf(items, 'find-signal');
    const answers = textStructureAnalyzerHarnessAnswers(signal);
    expect(answers.correct).toBe(signal.answer);
    expect(signal.stimulusText.toLowerCase()).toContain(answers.signatureWrong.text.toLowerCase());
    expect(answers.signatureWrong.text.toLowerCase()).not.toBe(signal.answer.toLowerCase());
  });

  it('names the NEAREST structure as name-structure’s signature wrong', () => {
    const { items } = build();
    const structure = itemOf(items, 'name-structure');
    const answers = textStructureAnalyzerHarnessAnswers(structure);
    expect(answers.correct).toBe(STRUCTURE_LABEL['cause-effect']);
    // Axis 2 orders distractors nearest-first, so the leading one is the sibling.
    expect(answers.signatureWrong.text).toBe(STRUCTURE_LABEL['problem-solution']);
    expect(structure.choices).toContain(answers.signatureWrong.text);
  });

  it('names the excerpt SAID BACK as place-idea’s signature wrong', () => {
    const { items } = build();
    const place = itemOf(items, 'place-idea');
    const answers = textStructureAnalyzerHarnessAnswers(place);
    expect(answers.signatureWrong.text).toBe(place.stimulusText);
    expect(answers.plainWrong).not.toBe(place.answer);
  });

  it('carries the answer as its leak token on every item', () => {
    const { items } = build();
    for (const item of items) {
      expect(textStructureAnalyzerHarnessAnswers(item).leakTokens).toEqual([item.answer]);
    }
  });
});

// ── 9. The catalog's side of the contract ───────────────────────────────────

describe('catalog entry', () => {
  it('passes checkDiCatalogEntry', () => {
    const { items } = build();
    expect(checkDiCatalogEntry(CATALOG_ENTRY, packOf(items), items[0])).toEqual([]);
  });

  it('declares the family audio mode and exactly the pack’s context keys', () => {
    expect(CATALOG_ENTRY.audioInput).toEqual({ manual_activity: true });
    expect(CATALOG_ENTRY.tutoring?.contextKeys).toEqual(['challengeType', 'stimulus']);
  });

  /**
   * STEERING REGRESSION. The click-era prose told the manifest this primitive
   * highlights, selects and drags — and a description is what routes a primitive
   * for the rest of its life.
   *
   * It bans the click-era steering PHRASES rather than the tokens, because the
   * DI prose uses the same tokens inside its negations ("nothing is tapped,
   * highlighted or dragged" is the sentence that does the steering work now).
   * A token ban would have to be satisfied by deleting the clearest sentence in
   * the entry.
   */
  it('no longer steers the manifest at a tap, drag or highlight surface', () => {
    const prose = `${CATALOG_ENTRY.description} ${CATALOG_ENTRY.constraints}`.toLowerCase();
    expect(prose).toContain('microphone');
    expect(prose).toContain('out loud');
    expect(prose).toContain('nothing is tapped, highlighted or dragged');
    expect(prose).not.toContain('highlight signal words');
    expect(prose).not.toContain('select structure type');
    expect(prose).not.toContain('drag content onto');
    expect(prose).not.toContain('students drag');
  });

  it('tells the tutor never to read the passage aloud', () => {
    const directives = CATALOG_ENTRY.tutoring?.aiDirectives ?? [];
    const titles = directives.map((d) => d.title);
    expect(titles).toContain('NEVER READ THE PASSAGE ALOUD');
    expect(titles).toContain('LIVE-JUDGED DIRECT INSTRUCTION');
    expect(titles).toContain('WHAT COUNTS AS AN ANSWER');
  });

  it('keeps the four eval modes and their challenge types', () => {
    expect(CATALOG_ENTRY.evalModes?.map((m) => m.evalMode)).toEqual([
      'chronological_description', 'cause_effect', 'compare_contrast', 'problem_solution',
    ]);
  });
});

// ── 10. The tier decision written down ──────────────────────────────────────

describe('the easy option floor', () => {
  it('is THREE, not two — a 1-in-2 guess on the run’s only Identify ask', () => {
    expect(MIN_STRUCTURE_OPTIONS_EASY).toBe(3);
  });

  it('honours the trim while always keeping the correct option', () => {
    const { items } = build({ maxStructureOptions: 2 });
    const structure = itemOf(items, 'name-structure');
    expect(structure.choices).toContain(STRUCTURE_LABEL['cause-effect']);
    expect(structure.choices).toHaveLength(2);
  });

  it('saturates rather than inflating when the band has only two structures', () => {
    const { items } = build({
      structureType: 'chronological',
      maxStructureOptions: 3,
      structureOptions: [
        { type: 'chronological', description: 'In order.' },
        { type: 'description', description: 'Details.' },
      ],
    });
    expect(itemOf(items, 'name-structure').choices).toHaveLength(2);
  });

  it('uses the canonical label for every option, whatever the model wrote', () => {
    const { items } = build({
      structureOptions: [
        { type: 'cause-effect', label: 'Cause/Effect Relationship', description: 'x' },
        { type: 'description', label: 'Descriptive Writing', description: 'y' },
      ],
    });
    expect(itemOf(items, 'name-structure').choices).toEqual([
      'Cause and Effect', 'Description',
    ]);
  });
});

// ── 11. Found by the first live tier probe (2026-08-16) ─────────────────────

describe('excerpt punctuation', () => {
  /**
   * The tutor says `Listen: <excerpt>. Does that go with …`, so an excerpt that
   * carries its own full stop reads as "heavy trees.. Does that go with". A
   * stumble in her mouth, and invisible to every other gate in this family
   * because it is punctuation rather than a word.
   */
  it('strips the trailing stop so the spoken ask never doubles it', () => {
    const { items } = build({
      keyIdeas: [
        { ideaId: 'k0', text: 'Beavers cut down heavy trees.', correctRegionId: 'r-cause' },
        { ideaId: 'k1', text: 'The safe pool grows bigger!', correctRegionId: 'r-effect' },
      ],
    });
    const places = items.filter((i) => i.action === 'place-idea');
    expect(places.map((i) => i.stimulusText)).toEqual([
      'Beavers cut down heavy trees', 'The safe pool grows bigger',
    ]);
    for (const item of places) expect(askFor(item)).not.toMatch(/[.!?],? ?\.\s/);
  });
});

// ── 12. Found by the first live judged drive (2026-08-17) ───────────────────

describe('the scoping device may not say the answer', () => {
  /**
   * CONFIRMED HIGH `di-answer-leak-in-ask`, 2/2 on the first
   * chronological_description drive: the ask named the sentence by ORDINAL
   * ("Read the first sentence") and a chronological passage's signal words ARE
   * ordinals — so on the archetypal item, where "First" opens sentence one, the
   * ask said the answer immediately before asking for it. Worst possible
   * landing: that mode is Tier 1 AND the grade-2 band floor.
   */
  it('names the sentence with a CARDINAL, so an ordinal signal word cannot collide', () => {
    const { items } = build({
      passage: 'First the ice melts away. The puddle spreads wide and thin.',
      signalWords: [{ word: 'First' }],
      keyIdeas: [],
    });
    const signal = itemOf(items, 'find-signal');
    expect(signal.answer).toBe('First');
    expect(askFor(signal)).toContain('Read sentence one');
    expect(askFor(signal).toLowerCase()).not.toMatch(/\bfirst\b/);
  });

  it('DROPS any item whose ask still contains its own answer — the channel, not the symptom', () => {
    // A mat named "Listen" would collide with the ask's own hand-over verb.
    const { items } = build({
      templateRegions: [
        { regionId: 'a', label: 'Before' },
        { regionId: 'b', label: 'Later' },
      ],
      keyIdeas: [
        { ideaId: 'k0', text: 'The stream ran fast and clear', correctRegionId: 'a' },
        { ideaId: 'k1', text: 'A wide pond sat behind the wall', correctRegionId: 'b' },
      ],
    });
    for (const item of items) {
      const menu = leakExemptSpanFor(item);
      expect(askIsAnswerFree(askFor(item), item.answer, menu)).toBe(true);
    }
  });

  it('every built item is answer-free in its own ask, at every tier', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      for (const grade of ['2', '5'] as const) {
        const { items } = build({ supportTier: tier, gradeLevel: grade });
        for (const item of items) {
          expect(askIsAnswerFree(askFor(item), item.answer, leakExemptSpanFor(item))).toBe(true);
        }
      }
    }
  });
});
