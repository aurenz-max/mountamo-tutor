/**
 * textStructureAnalyzerDomain: the build gates, the ask and the key, pinned. Pure, no jsdom.
 *
 *  1. Every step is SPOKEN (`answerKind: 'voice'`): `find-signal` and `place-idea` take the benched
 *     `short_spoken_word`, `name-structure` takes `closed_set_choice`.
 *  2. ONE `name-structure` item per run, after the linking words: the payload carries one passage and one structure.
 *  3. THE FIND-SIGNAL ASK IS DECIDABLE: its sentence carries exactly ONE connective, counted against the code-owned
 *     list, and a sentence with two drops.
 *  4. THE ASK NEVER READS THE PASSAGE: the find-signal ask says no sentence and no answer; the two menu steps say
 *     their whole menu, and at `hard` above the band floor no menu is spoken.
 *  5. Build gates DROP what cannot be asked: an un-separable or unsayable mat, an idea that names its own mat, a kept
 *     set landing on one mat, an anchor that is also a question.
 *  6. The key: the answer first, a menu key where the ask says the menu, the signature wrong named.
 */
import { describe, it, expect } from 'vitest';
import { askLeaks, spokenKeyText } from '../../../components/live-activity/spokenKey';
import {
  ALL_STRUCTURE_TYPES,
  MAX_MAP_ITEMS,
  MAX_SIGNAL_ITEMS,
  MIN_STRUCTURE_OPTIONS_EASY,
  STRUCTURE_LABEL,
  answerKindFor,
  askFor,
  choicesPhrase,
  countConnectives,
  isSayableLabel,
  isSayableSignalWord,
  itemsFromPayload,
  leakExemptSpanFor,
  locateSignalWords,
  optionsEarSeparable,
  askIsAnswerFree,
  sentenceNumberFor,
  responseClassFor,
  splitSentences,
  textStructureAnalyzerHarnessAnswers,
  textStructureKey,
  textStructureModeOf,
  textStructureScene,
  wordBoundedIndexOf,
  type TextStructureItem,
  type TextStructurePayloadLike,
} from './textStructureAnalyzerDomain';

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
  title: 'How beavers build',
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

const itemOf = (items: TextStructureItem[], action: TextStructureItem['action']) =>
  items.find((i) => i.action === action) as TextStructureItem;


describe('the asks', () => {
  it('every ask varies with its item, so no two consecutive asks are identical', () => {
    const { items } = build();
    const signals = items.filter((i) => i.action === 'find-signal');
    expect(new Set(signals.map(askFor)).size).toBe(signals.length);
    const places = items.filter((i) => i.action === 'place-idea');
    expect(new Set(places.map(askFor)).size).toBe(places.length);
  });

  it('states its problem aloud in every ask, with no hand-over line', () => {
    const { items } = build({ supportTier: 'hard', gradeLevel: '5' });
    for (const item of items) {
      const ask = askFor(item);
      expect(ask).not.toMatch(/Your turn/);
      expect(ask.endsWith('?') || ask.endsWith('.')).toBe(true);
      expect(ask.length).toBeGreaterThan(30);
    }
  });

  it('the tier never changes the find-signal ask', () => {
    const ask = (tier: 'easy' | 'medium' | 'hard') => askFor(itemOf(build({ supportTier: tier, gradeLevel: '2' }).items, 'find-signal'));
    expect(ask('easy')).toBe(ask('medium'));
    expect(ask('medium')).toBe(ask('hard'));
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

// ── 5. The leak discipline ──────────────────────────────────────────────────

describe('leak discipline', () => {
  it('never speaks the passage: the find-signal ask carries no sentence text and no answer', () => {
    const { items } = build();
    for (const item of items.filter((i) => i.action === 'find-signal')) {
      expect(askFor(item)).not.toContain(item.stimulusText);
      expect(leakExemptSpanFor(item)).toBeUndefined();
      expect(askFor(item).toLowerCase()).not.toContain(item.answer.toLowerCase());
    }
  });

  it('says exactly the menu on the two menu steps, and the answer only inside it', () => {
    const { items } = build();
    for (const item of items.filter((i) => i.action !== 'find-signal')) {
      expect(item.namesChoices).toBe(true);
      const exempt = leakExemptSpanFor(item) as string;
      expect(exempt).toBe(choicesPhrase(item));
      expect(askFor(item).replace(exempt, ' ').toLowerCase()).not.toContain(item.answer.toLowerCase());
    }
  });

  it('goes flat at `hard` above the band floor: no menu is spoken, and no ask says its answer', () => {
    const { items } = build({ supportTier: 'hard', gradeLevel: '5' });
    for (const item of items) {
      expect(item.namesChoices).toBe(false);
      expect(leakExemptSpanFor(item)).toBeUndefined();
      expect(askFor(item).toLowerCase()).not.toContain(item.answer.toLowerCase());
    }
  });

  it('BAND FLOOR beats the tier: grade 2 names the choices at `hard` too', () => {
    const { items } = build({ supportTier: 'hard', gradeLevel: '2' });
    for (const item of items.filter((i) => i.action !== 'find-signal')) {
      expect(item.namesChoices).toBe(true);
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

// ── 7. The tier decision written down ──────────────────────────────────────

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

// ── 8. Found by the first live tier probe (2026-08-16) ─────────────────────

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

// ── 9. Found by the first live judged drive (2026-08-17) ───────────────────

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

// ── The key, the scene and the harness ──────────────────────────────────────

describe('the key', () => {
  it('passes askLeaks on every item at every tier: a menu ask says its whole menu, any other ask no answer', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      for (const grade of ['2', '5'] as const) {
        for (const item of build({ supportTier: tier, gradeLevel: grade }).items) {
          expect(askLeaks(askFor(item), textStructureKey(item)), item.id).toEqual([]);
        }
      }
    }
  });

  it('is a menu key exactly where the ask says the menu', () => {
    for (const item of build().items) {
      expect(!!textStructureKey(item).menu).toBe(item.action !== 'find-signal');
    }
    for (const item of build({ supportTier: 'hard', gradeLevel: '5' }).items) expect(textStructureKey(item).menu).toBeUndefined();
  });

  it('starts with the answer and names each step\'s signature wrong', () => {
    const { items } = build();
    const signal = itemOf(items, 'find-signal');
    expect(spokenKeyText(textStructureKey(signal))).toMatch(new RegExp(`^"${signal.answer}"`));
    expect(textStructureKey(signal).signatureError).toContain(signal.stimulusText);
    expect(textStructureKey(itemOf(items, 'name-structure')).signatureError).toMatch(/different structure/);
    const place = itemOf(items, 'place-idea');
    expect(textStructureKey(place).signatureError).toContain(place.stimulusText);
  });

  it('stamps the mode, the title and the session\'s linking words on every item', () => {
    const { items } = build();
    const signals = items.filter((i) => i.action === 'find-signal').map((i) => i.answer);
    for (const item of items) expect(item).toMatchObject({ mode: 'cause_effect', title: 'How beavers build', signals });
    expect(textStructureModeOf('description')).toBe('chronological_description');
    expect(textStructureModeOf('problem-solution')).toBe('problem_solution');
  });
});

describe('the scene', () => {
  it('prints the passage, never asks the tutor to read it, and writes no lever fact', () => {
    const { items } = build();
    for (const item of items) {
      const { facts } = textStructureScene(item, PASSAGE);
      expect(facts.passage).toBe(PASSAGE);
      expect(facts.constraints).toMatch(/Never read the passage/);
      expect('support' in facts || 'onScreen' in facts).toBe(false);
    }
  });
});

describe('harness answers', () => {
  it('a content word of the same sentence is find-signal\'s plain wrong', () => {
    const signal = itemOf(build().items, 'find-signal');
    const answers = textStructureAnalyzerHarnessAnswers(signal);
    expect(answers.correct).toBe(signal.answer);
    expect(signal.stimulusText.toLowerCase()).toContain(answers.plainWrong.toLowerCase());
    expect(answers.plainWrong.toLowerCase()).not.toBe(signal.answer.toLowerCase());
  });

  it('another printed choice is the plain wrong on the menu steps', () => {
    const { items } = build();
    for (const item of items.filter((i) => i.action !== 'find-signal')) {
      const answers = textStructureAnalyzerHarnessAnswers(item);
      expect(item.choices).toContain(answers.plainWrong);
      expect(answers.plainWrong).not.toBe(item.answer);
    }
  });
});
