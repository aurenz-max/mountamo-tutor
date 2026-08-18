/**
 * genreExplorerScript — the pedagogy lives there, so this is where it is pinned.
 * Pure, no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (`checkPackGates` =
 *     validateJudgedScriptPack + the performed-stage-direction scan + the
 *     byte-identical-consecutive-ask gate), on a fixture AND on the real session
 *     shape — several `check-feature` items back to back, which is the only shape
 *     the repeat-ask gate can fire on.
 *  2. THE FORK, both directions: all three steps are SPOKEN, `name-genre` takes
 *     the BENCHED `short_spoken_word` (NOT the roster's `closed_set_choice`),
 *     `pick-excerpt` the benched `ordinal_word`, `check-feature` the build-ahead
 *     `yes_no`. The regression this locks out is a step drifting back to a tap —
 *     all three taps were costumes, and `answerKind: 'gesture'` anywhere here
 *     would mean the fork was re-decided.
 *  3. ⭐ DEFECT CLASS 1: one click-era challenge becomes N judged items, capped
 *     and SELECTED rather than truncated — the kept set still reaches both
 *     verdicts and both texts, or a session is answerable "yes"/"the first one"
 *     every round.
 *  4. ⭐ DEFECT CLASS 2 IN ITS DEFAULT-STATE FORM: excerpts that are all one
 *     genre yield exactly ONE genre ask, because after the first the child can
 *     say it without reading.
 *  5. THE READ-ALOUD IS SAFE BECAUSE THE ANSWER IS NOT IN THE TEXT. Any excerpt
 *     naming a genre drops; any excerpt opening a sentence with a verdict
 *     sentinel drops; double quotes never reach a `Say exactly:` span.
 *  6. The menu is CANONICAL and pruned for the EAR — "Fiction" cannot stand
 *     beside "Historical Fiction", and an answer is never trimmed away.
 *  7. Corrections open "My turn:", NAME the fact, and re-elicit the same item;
 *     the affirmation opens "Yes," EVEN WHEN IT AFFIRMS A "NO"; the move-on
 *     carries no close line.
 *  8. ⭐ THE PROTOCOL IS SPOKEN ONCE PER ACTION. This pack interleaves its
 *     actions, so the runner's action-change how-to-play policy would recite a
 *     19-word protocol six times in nine items; `introducesAction` absorbs it.
 *  9. The catalog keeps its side of the contract: the family audio mode, template
 *     keys resolving against exactly what the pack pushes, no sentence opening
 *     with a verdict sentinel, and no steering prose left over for the deleted
 *     checkbox/tap surface.
 */
import { describe, it, expect } from 'vitest';
import {
  ALL_GENRE_IDS,
  GENRE_LABEL,
  MAX_CONTRAST_ITEMS,
  MAX_EXCERPTS,
  MAX_FEATURE_ITEMS_PER_EXCERPT,
  MIN_GENRE_OPTIONS_EASY,
  answerKindFor,
  askFor,
  askIsAnswerFree,
  canonicalGenre,
  choicesPhrase,
  completeCue,
  excerptOrdinalFor,
  genreExplorerHarnessAnswers,
  genreExplorerPackBase,
  isBandFloor,
  isReadableAloud,
  isSayablePredicate,
  itemCue,
  itemsFromPayload,
  leakExemptSpanFor,
  moveOnCue,
  namesAGenre,
  optionsEarSeparable,
  pronounceCue,
  pruneForEar,
  questionFor,
  responseClassFor,
  speechSafe,
  stimulusFor,
  type GenreExplorerItem,
  type GenreExplorerPayloadLike,
} from '../genreExplorerScript';
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

// ---------------------------------------------------------------------------
// Fixtures — real-shaped content, no genre word anywhere in an excerpt
// ---------------------------------------------------------------------------

const FABLE =
  'A fox saw some grapes hanging high on a vine. He jumped and jumped but could not reach them. '
  + 'At last he walked away and said they were sour anyway.';
const LIFE =
  'Marie Curie was born in Warsaw in 1867. She moved to Paris to study science. '
  + 'She won two Nobel prizes for her work with radium.';

const payload = (over: Partial<GenreExplorerPayloadLike> = {}): GenreExplorerPayloadLike => ({
  gradeLevel: '4',
  mode: 'classify_genre',
  excerpts: [
    { excerptId: 'e1', text: FABLE, genre: 'fable' },
    { excerptId: 'e2', text: LIFE, genre: 'biography' },
  ],
  features: [
    { featureId: 'talk', predicate: 'have animals that talk', presentIn: ['e1'] },
    { featureId: 'lesson', predicate: 'teach a lesson at the end', presentIn: ['e1'] },
    { featureId: 'real', predicate: 'tell about a real person who lived', presentIn: ['e2'] },
    { featureId: 'dates', predicate: 'give dates you could look up', presentIn: ['e2'] },
  ],
  genreOptions: ['fable', 'biography', 'myth', 'informational'],
  ...over,
});

const build = (over: Partial<GenreExplorerPayloadLike> = {}) => itemsFromPayload(payload(over));

const packOf = (items: GenreExplorerItem[]): JudgedScriptPack<GenreExplorerItem> =>
  genreExplorerPackBase(items) as JudgedScriptPack<GenreExplorerItem>;

const catalogEntry = LITERACY_CATALOG.find((p) => p.id === 'genre-explorer')!;

// ---------------------------------------------------------------------------

describe('genre-explorer — the family gates', () => {
  it('passes checkPackGates on the fixture pack', () => {
    expect(checkPackGates(packOf(build().items))).toEqual([]);
  });

  /**
   * ⚠️ THE REPEAT-ASK GATE IS ASLEEP ON A ONE-ITEM-PER-MODE FIXTURE, so this is
   * the real session shape: two `check-feature` items back to back on the same
   * text, which is exactly what a sitting runs.
   */
  it('passes checkPackGates on consecutive same-action items', () => {
    const { items } = build();
    const features = items.filter((i) => i.action === 'check-feature');
    expect(features.length).toBeGreaterThanOrEqual(2);
    expect(features[0].action).toBe(features[1].action);
    expect(checkPackGates(packOf(features.slice(0, 2)))).toEqual([]);
  });

  it('passes checkPackGates on consecutive name-genre items (compare mode)', () => {
    const { items } = build({ mode: 'compare_genres' });
    const genres = items.filter((i) => i.action === 'name-genre');
    expect(genres.length).toBe(2);
    expect(checkPackGates(packOf(genres))).toEqual([]);
  });

  it('passes checkPackGates on consecutive pick-excerpt items', () => {
    const { items } = build({ mode: 'compare_genres' });
    const contrasts = items.filter((i) => i.action === 'pick-excerpt');
    expect(contrasts.length).toBeGreaterThanOrEqual(2);
    expect(checkPackGates(packOf(contrasts.slice(0, 2)))).toEqual([]);
  });

  it('keeps the catalog side of the contract', () => {
    const { items } = build();
    expect(checkDiCatalogEntry(catalogEntry, packOf(items), items[0])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('the answer-material fork', () => {
  it('answers every item with the VOICE — no gesture anywhere', () => {
    const { items } = build();
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item.answerKind).toBe('voice');
    for (const item of build({ mode: 'compare_genres' }).items) {
      expect(item.answerKind).toBe('voice');
    }
    expect(answerKindFor('check-feature')).toBe('voice');
    expect(answerKindFor('name-genre')).toBe('voice');
    expect(answerKindFor('pick-excerpt')).toBe('voice');
  });

  /**
   * ⭐ `name-genre` is `short_spoken_word`, NOT the roster's `closed_set_choice`.
   * "Fable" is a NAME — word-sorter's mats and text-structure-analyzer's regions
   * exactly — and that class is BENCHED rather than build-ahead, so it is the
   * stronger footing of the two. This assertion is the correction, pinned.
   */
  it('takes the BENCHED class for every action it can', () => {
    expect(responseClassFor('name-genre')).toBe('short_spoken_word');
    expect(responseClassFor('pick-excerpt')).toBe('ordinal_word');
    expect(responseClassFor('check-feature')).toBe('yes_no');
  });

  it('never prints a menu on a yes/no item', () => {
    for (const item of build().items) {
      if (item.action === 'check-feature') expect(item.choices).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------

describe('defect class 1 — one challenge is not one item', () => {
  it('expands one payload into a judged ask per feature AND per text', () => {
    const { items } = build();
    // 2 texts × 2 features (capped) + 2 genre calls
    expect(items.filter((i) => i.action === 'check-feature')).toHaveLength(4);
    expect(items.filter((i) => i.action === 'name-genre')).toHaveLength(2);
  });

  it('caps features per text and reports the held-back ones as truncation, not drops', () => {
    const { items, truncated, dropped } = build({
      features: [
        { featureId: 'a', predicate: 'have animals that talk', presentIn: ['e1'] },
        { featureId: 'b', predicate: 'teach a lesson at the end', presentIn: ['e1'] },
        { featureId: 'c', predicate: 'use rhyme', presentIn: [] },
        { featureId: 'd', predicate: 'give dates you could look up', presentIn: ['e2'] },
        { featureId: 'e', predicate: 'name a real place', presentIn: ['e2'] },
      ],
    });
    for (const excerptId of ['e1', 'e2']) {
      const forExcerpt = items.filter((i) => i.id.startsWith(`feature::${excerptId}::`));
      expect(forExcerpt.length).toBeLessThanOrEqual(MAX_FEATURE_ITEMS_PER_EXCERPT);
    }
    expect(truncated).toBeGreaterThan(0);
    expect(dropped).toBe(0);
  });

  /** SELECT, don't truncate: a blind slice can leave a text with only "yes"
   *  answers, and then the child never has to read one. */
  it('selects features so both verdicts survive the cap', () => {
    const { items } = build({
      features: [
        { featureId: 'a', predicate: 'have animals that talk', presentIn: ['e1'] },
        { featureId: 'b', predicate: 'teach a lesson at the end', presentIn: ['e1'] },
        { featureId: 'c', predicate: 'give dates you could look up', presentIn: ['e2'] },
      ],
    });
    const forE1 = items.filter((i) => i.id.startsWith('feature::e1::'));
    expect(new Set(forE1.map((i) => i.answer))).toEqual(new Set(['yes', 'no']));
  });

  it('caps the contrast step and keeps both texts as answers', () => {
    const { items, truncated } = build({
      mode: 'compare_genres',
      features: [
        { featureId: 'a', predicate: 'have animals that talk', presentIn: ['e1'] },
        { featureId: 'b', predicate: 'teach a lesson at the end', presentIn: ['e1'] },
        { featureId: 'c', predicate: 'name a real city', presentIn: ['e2'] },
        { featureId: 'd', predicate: 'give dates you could look up', presentIn: ['e2'] },
        { featureId: 'e', predicate: 'use short lines', presentIn: ['e1'] },
        { featureId: 'f', predicate: 'name a real school', presentIn: ['e2'] },
      ],
    });
    const contrasts = items.filter((i) => i.action === 'pick-excerpt');
    expect(contrasts).toHaveLength(MAX_CONTRAST_ITEMS);
    expect(new Set(contrasts.map((i) => i.answer)).size).toBe(2);
    expect(truncated).toBeGreaterThan(0);
  });

  it('caps the number of texts', () => {
    const { excerpts } = build({
      excerpts: [
        { excerptId: 'e1', text: FABLE, genre: 'fable' },
        { excerptId: 'e2', text: LIFE, genre: 'biography' },
        { excerptId: 'e3', text: FABLE, genre: 'myth' },
        { excerptId: 'e4', text: LIFE, genre: 'informational' },
      ],
    });
    expect(excerpts).toHaveLength(MAX_EXCERPTS);
  });
});

// ---------------------------------------------------------------------------

describe('defect class 2 — an answer may be asked once', () => {
  it('asks the genre ONCE when every text is the same genre', () => {
    const { items, dropped } = build({
      excerpts: [
        { excerptId: 'e1', text: FABLE, genre: 'fable' },
        { excerptId: 'e2', text: LIFE, genre: 'fable' },
      ],
    });
    expect(items.filter((i) => i.action === 'name-genre')).toHaveLength(1);
    expect(dropped).toBeGreaterThan(0);
  });

  it('asks it per text when the genres differ', () => {
    expect(build().items.filter((i) => i.action === 'name-genre')).toHaveLength(2);
  });

  /**
   * ⭐ A LIVE PROBE BROKE THE WEAKER "ALL ONE GENRE" RULE (classify_genre @ grade
   * 4, 2026-08-17): the model returned [biography, biography, historical-fiction],
   * which HAS two distinct genres — so the weak rule let all three asks through
   * and "Biography" answered two of them. After the tutor affirms it once, saying
   * it again wins two of three with no reading at all.
   */
  it('asks each genre once even when only SOME texts repeat one', () => {
    const { items } = build({
      excerpts: [
        { excerptId: 'e1', text: FABLE, genre: 'biography' },
        { excerptId: 'e2', text: LIFE, genre: 'biography' },
        { excerptId: 'e3', text: FABLE, genre: 'historical-fiction' },
      ],
      genreOptions: ['biography', 'historical-fiction', 'informational'],
    });
    const genres = items.filter((i) => i.action === 'name-genre');
    expect(genres.map((i) => i.answer)).toEqual(['Biography', 'Historical Fiction']);
    // The repeated text keeps its EVIDENCE items — only the recall ask goes.
    expect(items.some((i) => i.id.startsWith('feature::e2::'))).toBe(true);
  });

  it('drops a contrast feature that is true of BOTH texts — it has no answer', () => {
    const { items } = build({
      mode: 'compare_genres',
      features: [
        { featureId: 'both', predicate: 'have more than one sentence', presentIn: ['e1', 'e2'] },
        { featureId: 'none', predicate: 'use rhyme', presentIn: [] },
        { featureId: 'one', predicate: 'have animals that talk', presentIn: ['e1'] },
        { featureId: 'other', predicate: 'give dates you could look up', presentIn: ['e2'] },
      ],
    });
    const contrasts = items.filter((i) => i.action === 'pick-excerpt');
    expect(contrasts.map((i) => i.id)).toEqual(['contrast::one', 'contrast::other']);
  });
});

// ---------------------------------------------------------------------------

describe('the leak policy', () => {
  it('never says the genre in a name-genre ask outside the printed menu', () => {
    for (const item of build().items) {
      if (item.action !== 'name-genre') continue;
      expect(askIsAnswerFree(askFor(item), item.answer, leakExemptSpanFor(item))).toBe(true);
    }
  });

  /** At `hard` above the band floor no menu is spoken and the oracle goes FLAT —
   *  the strongest form of this port's leak gate. */
  it('goes flat at hard: no menu clause, and the answer is absent from the whole line', () => {
    const { items } = build({ supportTier: 'hard' });
    const genre = items.find((i) => i.action === 'name-genre')!;
    expect(genre.namesChoices).toBe(false);
    expect(leakExemptSpanFor(genre)).toBeUndefined();
    const spoken = spokenSpanOf(itemCue(genre, { opening: true, howToPlay: true }));
    expect(spoken.toLowerCase()).not.toContain(genre.answer.toLowerCase());
    // …and it still STATES its problem. An ask that says nothing is broken.
    expect(spoken).toContain('What kind of writing is');
  });

  it('names the menu at the band floor even at hard', () => {
    const { items } = build({ supportTier: 'hard', gradeLevel: '2' });
    const genre = items.find((i) => i.action === 'name-genre');
    expect(genre?.namesChoices).toBe(true);
  });

  it('DROPS an excerpt that names a genre — the read-aloud would hand it over', () => {
    const { items, dropped } = build({
      excerpts: [
        { excerptId: 'e1', text: 'This fable is about a fox who wanted grapes he could not reach.', genre: 'fable' },
        { excerptId: 'e2', text: LIFE, genre: 'biography' },
      ],
    });
    expect(items.some((i) => i.id.includes('e1'))).toBe(false);
    expect(dropped).toBeGreaterThan(0);
  });

  it('DROPS a feature predicate that names a genre', () => {
    const { items } = build({
      features: [
        { featureId: 'leak', predicate: 'read like a fable', presentIn: ['e1'] },
        { featureId: 'ok', predicate: 'have animals that talk', presentIn: ['e1'] },
      ],
    });
    expect(items.some((i) => i.id.includes('leak'))).toBe(false);
    expect(items.some((i) => i.id.includes('ok'))).toBe(true);
  });

  /** ⚠️ The label-derived version of this gate refused ordinary tall trees. */
  it('refuses genre NAMES without refusing narrative vocabulary', () => {
    expect(namesAGenre('This fable teaches a lesson.')).toBe(true);
    expect(namesAGenre('a short biography of Marie Curie')).toBe(true);
    expect(namesAGenre('The tall tree stood by the story-teller.')).toBe(false);
    expect(namesAGenre('The children play in the tall grass.')).toBe(false);
  });

  it('never puts the genre in the context channel', () => {
    for (const item of build().items) {
      const context = genreExplorerPackBase([item]).contextFor(item);
      expect(context.challengeType).toBe(item.action);
      for (const value of Object.values(context)) {
        for (const id of ALL_GENRE_IDS) {
          expect(value.toLowerCase()).not.toContain(GENRE_LABEL[id].toLowerCase());
        }
      }
      expect(stimulusFor(item)).not.toContain(item.answer);
    }
  });
});

// ---------------------------------------------------------------------------

describe('the tutor reads the text at the band floor', () => {
  it('reads each text once, on the first item that lands on it', () => {
    const { items } = build({ gradeLevel: '1', mode: 'identify_basic' });
    const withRead = items.filter((i) => i.readAloud !== '');
    expect(withRead).toHaveLength(2);
    expect(withRead[0].readAloud).toContain('Listen to the first one.');
    expect(withRead[0].readAloud).toContain('A fox saw some grapes');
    // …and never again on the same text.
    const e1Items = items.filter((i) => i.excerptIndex === 0);
    expect(e1Items.filter((i) => i.readAloud !== '')).toHaveLength(1);
  });

  it('reads BOTH texts before the first contrast, because the ask is about both', () => {
    const { items } = build({ gradeLevel: '2', mode: 'compare_genres' });
    const contrasts = items.filter((i) => i.action === 'pick-excerpt');
    expect(contrasts[0].readAloud).toContain('A fox saw some grapes');
    expect(contrasts[0].readAloud).toContain('Marie Curie was born');
    for (const later of contrasts.slice(1)) expect(later.readAloud).toBe('');
  });

  it('reads nothing above the band floor — those children read it themselves', () => {
    for (const item of build({ gradeLevel: '5' }).items) expect(item.readAloud).toBe('');
    expect(isBandFloor('2')).toBe(true);
    expect(isBandFloor('3')).toBe(false);
  });

  /**
   * ⚠️ A grade-1 judged drive came back with the tutor NOT reading, because this
   * compared the field for exact equality with "1" and the field was whatever the
   * generation wrote there. Everywhere else a wrapper costs a cosmetic label; here
   * it withdraws a READER-FIT ACCOMMODATION and leaves a six-year-old in front of
   * four sentences nobody will read to them.
   */
  it('floors on the wrapper forms a generation actually writes', () => {
    for (const wrapped of ['1', 'Grade 1', 'grade 2', '2nd', 'K', 'kindergarten', '']) {
      expect(isBandFloor(wrapped)).toBe(true);
    }
    for (const above of ['3', 'Grade 4', '6th', 'elementary']) {
      expect(isBandFloor(above)).toBe(false);
    }
    expect(build({ gradeLevel: 'Grade 1' }).readsAloud).toBe(true);
  });

  /** The correction re-ask drops the read-aloud: the text is printed, the child
   *  just heard it, and tap-to-hear reads it again on demand. */
  it('does not re-read the text inside the correction', () => {
    const { items } = build({ gradeLevel: '1', mode: 'identify_basic' });
    const first = items.find((i) => i.readAloud !== '')!;
    const cue = itemCue(first, { opening: true, howToPlay: true });
    const correction = cue.slice(cue.indexOf('If it is wrong'));
    expect(correction).not.toContain('A fox saw some grapes');
    expect(correction).toContain('My turn:');
  });

  it('DROPS an excerpt too long to read aloud at the band floor', () => {
    const long = `${'The dog ran fast. '.repeat(30)}`;
    const { items } = build({
      gradeLevel: '1',
      excerpts: [
        { excerptId: 'e1', text: long, genre: 'fiction' },
        { excerptId: 'e2', text: LIFE, genre: 'nonfiction' },
      ],
      genreOptions: ['fiction', 'nonfiction'],
    });
    expect(items.some((i) => i.id.includes('e1'))).toBe(false);
    expect(isReadableAloud(long)).toBe(false);
  });

  /** ⚠️ THE ONLY PACK WHOSE TUTOR SPEAKS GENERATED NARRATIVE AT LENGTH. */
  it('DROPS an excerpt whose sentence opens with a verdict sentinel', () => {
    const { items } = build({
      gradeLevel: '1',
      excerpts: [
        { excerptId: 'e1', text: 'The fox looked up at the grapes. Yes, he thought, I will have those.', genre: 'fiction' },
        { excerptId: 'e2', text: LIFE, genre: 'nonfiction' },
      ],
      genreOptions: ['fiction', 'nonfiction'],
    });
    expect(items.some((i) => i.id.includes('e1'))).toBe(false);
  });

  /** A `"` closes the `Say exactly:` span early, so the child hears half a fable
   *  and no question. Fables are full of dialogue, so this is the common case. */
  it('makes dialogue safe to speak instead of dropping it', () => {
    const spoken = speechSafe('The fox said, "These grapes are sour."');
    expect(spoken).not.toContain('"');
    const { items } = build({
      gradeLevel: '1',
      excerpts: [
        { excerptId: 'e1', text: 'The fox said, "These grapes are sour." Then he walked away.', genre: 'fiction' },
        { excerptId: 'e2', text: LIFE, genre: 'nonfiction' },
      ],
      genreOptions: ['fiction', 'nonfiction'],
    });
    const first = items.find((i) => i.readAloud !== '')!;
    const cue = itemCue(first, { opening: true, howToPlay: true });
    // The spoken span survives whole — the question is still inside it.
    expect(spokenSpanOf(cue)).toContain('These grapes are sour');
    expect(spokenSpanOf(cue)).toContain('Your turn.');
  });
});

// ---------------------------------------------------------------------------

describe('the canonical menu', () => {
  it('maps generated strings onto canonical ids, and drops what it cannot', () => {
    expect(canonicalGenre('fable')).toBe('fable');
    expect(canonicalGenre('Folk Tale')).toBe('folktale');
    expect(canonicalGenre('poetry')).toBe('poem');
    expect(canonicalGenre('informational text')).toBe('informational');
    expect(canonicalGenre('historical fiction')).toBe('historical-fiction');
    expect(canonicalGenre('science fiction')).toBeNull();
    expect(canonicalGenre('')).toBeNull();
  });

  /** ⭐ THE SUBSET SHAPE. "fiction" said out loud fits both options, and there is
   *  no honest verdict — so the generic label loses to the specific one. */
  it('never lets a bare label stand beside a compound that contains it', () => {
    expect(optionsEarSeparable(['Fiction', 'Historical Fiction'])).toBe(false);
    expect(optionsEarSeparable(['Nonfiction', 'Historical Fiction'])).toBe(true);
    const kept = pruneForEar(['Historical Fiction'], ['Fiction', 'Biography']);
    expect(kept).toEqual(['Historical Fiction', 'Biography']);
  });

  it('never prunes an ANSWER away', () => {
    const { items } = build({
      excerpts: [
        { excerptId: 'e1', text: FABLE, genre: 'historical-fiction' },
        { excerptId: 'e2', text: LIFE, genre: 'biography' },
      ],
      genreOptions: ['fiction', 'historical-fiction', 'biography'],
    });
    const genres = items.filter((i) => i.action === 'name-genre');
    expect(genres).toHaveLength(2);
    for (const item of genres) expect(item.choices).toContain(item.answer);
    expect(genres[0].choices).not.toContain('Fiction');
  });

  it('trims the menu from the back at easy but keeps every answer', () => {
    const { items } = build({
      supportTier: 'easy',
      maxGenreOptions: MIN_GENRE_OPTIONS_EASY,
      genreOptions: ['fable', 'biography', 'myth', 'informational', 'legend'],
    });
    const genre = items.find((i) => i.action === 'name-genre')!;
    expect(genre.choices).toHaveLength(MIN_GENRE_OPTIONS_EASY);
    for (const item of items.filter((i) => i.action === 'name-genre')) {
      expect(item.choices).toContain(item.answer);
    }
  });

  /** `identify_basic` is a two-genre mode by construction: the floor SATURATES at
   *  2 rather than inflating, and the session length is what deletes the guess. */
  it('saturates at two options in the binary mode', () => {
    const { items } = build({
      mode: 'identify_basic',
      supportTier: 'easy',
      maxGenreOptions: MIN_GENRE_OPTIONS_EASY,
      excerpts: [
        { excerptId: 'e1', text: FABLE, genre: 'fiction' },
        { excerptId: 'e2', text: LIFE, genre: 'nonfiction' },
      ],
      genreOptions: ['fiction', 'nonfiction'],
    });
    const genres = items.filter((i) => i.action === 'name-genre');
    expect(genres[0].choices).toEqual(['Fiction', 'Nonfiction']);
    // The guess floor is deleted by the SESSION, not by the menu: two genre
    // calls plus four feature calls is 1/64, not 1/2.
    expect(items.length).toBeGreaterThanOrEqual(6);
  });

  /**
   * ⭐ THE MODE IS THE TASK IDENTITY. A live probe caught `identify_basic` coming
   * back as `[nonfiction, fiction, poem]` with a THREE-option menu at grade 2 —
   * a Tier-1 β-2.0 binary quietly measuring something else. `poem` and `drama`
   * are deliberately unbucketed: a poem can sit on either side, and an ambiguous
   * ask is a broken task rather than a harder one.
   */
  it('keeps identify_basic BINARY, bucketing what has a side and dropping what does not', () => {
    const { items, excerpts } = build({
      mode: 'identify_basic',
      excerpts: [
        { excerptId: 'e1', text: FABLE, genre: 'fable' },
        { excerptId: 'e2', text: LIFE, genre: 'biography' },
        { excerptId: 'e3', text: FABLE, genre: 'poem' },
      ],
      genreOptions: ['fiction', 'nonfiction', 'poem'],
    });
    // The poem has no defensible side and drops; the fable and the life story
    // bucket onto the two the mode is about.
    expect(excerpts.map((e) => e.genre)).toEqual(['fiction', 'nonfiction']);
    const genres = items.filter((i) => i.action === 'name-genre');
    expect(genres.map((i) => i.answer)).toEqual(['Fiction', 'Nonfiction']);
    for (const item of genres) expect(item.choices).toEqual(['Fiction', 'Nonfiction']);
  });

  it('leaves the richer genres alone outside the binary mode', () => {
    const { items } = build({ mode: 'classify_genre' });
    expect(items.find((i) => i.action === 'name-genre')!.answer).toBe('Fable');
  });

  it('builds no genre ask when the menu cannot be asked', () => {
    const { items, menu } = build({
      excerpts: [{ excerptId: 'e1', text: FABLE, genre: 'fable' }],
      genreOptions: ['fable'],
    });
    expect(menu).toEqual([]);
    expect(items.filter((i) => i.action === 'name-genre')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------

describe('the predicate contract', () => {
  it('accepts a base-verb phrase and refuses a checklist heading', () => {
    expect(isSayablePredicate('have animals that talk')).toBe(true);
    expect(isSayablePredicate('rhyme')).toBe(true);
    expect(isSayablePredicate('tell about a real person who lived')).toBe(true);
    // The click-era label forms — they produce "Does this one has characters?"
    expect(isSayablePredicate('Has characters')).toBe(false);
    expect(isSayablePredicate('Is it make-believe?')).toBe(false);
    expect(isSayablePredicate('Does it rhyme?')).toBe(false);
    expect(isSayablePredicate('The story has a moral')).toBe(false);
  });

  it('drops a legacy checklist payload rather than conjugating it', () => {
    const { items } = itemsFromPayload({
      gradeLevel: '4',
      mode: 'classify_genre',
      excerpts: [
        { excerptId: 'e1', text: FABLE, genre: 'fable', features: [{ featureId: 'c', label: 'Has characters', present: true }] },
        { excerptId: 'e2', text: LIFE, genre: 'biography', features: [{ featureId: 'c', label: 'Has characters', present: false }] },
      ],
      genreOptions: ['fable', 'biography'],
    });
    expect(items.filter((i) => i.action === 'check-feature')).toHaveLength(0);
    // …but the genre asks still build. A broken checklist costs its step, not the run.
    expect(items.filter((i) => i.action === 'name-genre')).toHaveLength(2);
  });

  it('drops a feature pointing at a text that is not there', () => {
    const { items } = build({
      features: [
        { featureId: 'ghost', predicate: 'have animals that talk', presentIn: ['e9'] },
        { featureId: 'ok', predicate: 'use rhyme', presentIn: [] },
      ],
    });
    expect(items.some((i) => i.id.includes('ghost'))).toBe(false);
    expect(items.some((i) => i.id.includes('ok'))).toBe(true);
  });

  it('reads a base predicate cleanly in BOTH question shapes', () => {
    const { items } = build({ mode: 'compare_genres' });
    const contrast = items.find((i) => i.action === 'pick-excerpt')!;
    expect(questionFor(contrast)).toMatch(
      /^Does the first one .+, or does the second one\?$/,
    );
    const feature = build().items.find((i) => i.action === 'check-feature')!;
    expect(questionFor(feature)).toMatch(/^Does the (first|second) one .+\?$/);
  });
});

// ---------------------------------------------------------------------------

describe('the spoken surface', () => {
  it('corrects with My turn:, NAMES the fact, and re-elicits the same item', () => {
    for (const item of [...build().items, ...build({ mode: 'compare_genres' }).items]) {
      const cue = itemCue(item, {});
      expect(cue).toContain('My turn:');
      expect(cue).toContain(`If it is wrong, say exactly: "My turn:`);
      const correction = cue.slice(cue.indexOf('If it is wrong'));
      expect(correction).toContain('Your turn.');
    }
  });

  /** ⚠️ THE AFFIRMATION OPENS "Yes," EVEN WHEN IT AFFIRMS A "NO" ANSWER — the
   *  sentinel is the tutor's verdict marker, not an echo of the child's word. */
  it('affirms a "no" with the affirm sentinel', () => {
    const { items } = build();
    const negative = items.find((i) => i.action === 'check-feature' && i.answer === 'no')!;
    const cue = itemCue(negative, {});
    expect(cue).toContain('If the answer is right, say exactly: "Yes, that is right —');
    expect(cue).toContain('does not');
  });

  it('carries the two-branch law, the never-perform tail and the verdict-ends-the-turn clause', () => {
    const cue = itemCue(build().items[0], {});
    expect(cue).toContain('A reply that is neither the affirmation nor the correction');
    expect(cue).toContain('never announce that you are waiting or listening');
    expect(cue).toContain('Your verdict line is the END of your turn');
  });

  /** The contract states FACTS about the turn; an imperative gets PERFORMED. */
  it('states the wait as a fact, never as an order', () => {
    const cue = itemCue(build().items[0], {});
    expect(cue).toContain('you then stay silent');
    expect(cue).not.toMatch(/Then WAIT/i);
  });

  it('carries no close line on the move-on', () => {
    const { items } = build();
    const cue = moveOnCue(items[0], items[1], {});
    expect(cue).toContain('Good try! Here comes the next one.');
    expect(spokenSpanOf(cue)).not.toContain(items[0].answer === 'yes' ? 'does have' : 'does not');
  });

  it('re-speaks the QUESTION on tap-to-hear and never the answer', () => {
    for (const item of build().items) {
      const cue = pronounceCue(item);
      const spoken = spokenSpanOf(cue);
      expect(spoken).toContain(questionFor(item));
      expect(spoken).not.toContain('Your turn.');
      if (item.action === 'name-genre') {
        expect(askIsAnswerFree(spoken, item.answer, leakExemptSpanFor(item))).toBe(true);
      }
    }
  });

  it('carries the text into tap-to-hear at the band floor — there it IS the question', () => {
    const { items } = build({ gradeLevel: '1', mode: 'identify_basic' });
    const first = items.find((i) => i.readAloud !== '')!;
    expect(spokenSpanOf(pronounceCue(first))).toContain('A fox saw some grapes');
  });

  it('closes the run without naming anything', () => {
    const spoken = spokenSpanOf(completeCue());
    for (const id of ALL_GENRE_IDS) {
      expect(spoken.toLowerCase()).not.toContain(GENRE_LABEL[id].toLowerCase());
    }
  });

  it('speaks the menu as a list the child can hear', () => {
    const genre = build().items.find((i) => i.action === 'name-genre')!;
    expect(choicesPhrase(genre)).toMatch(/, or [A-Z].+\?$/);
    expect(askFor(genre)).toContain(choicesPhrase(genre));
  });

  it('names the text by position, or says "this one" when there is only one', () => {
    expect(excerptOrdinalFor(0, 2)).toBe('the first one');
    expect(excerptOrdinalFor(1, 2)).toBe('the second one');
    expect(excerptOrdinalFor(0, 1)).toBe('this one');
  });
});

// ---------------------------------------------------------------------------

describe('the protocol is spoken once per action', () => {
  /**
   * ⭐ This pack INTERLEAVES its actions (features → genre → features → genre),
   * so the runner's action-change how-to-play policy would fire six times in a
   * nine-item run. `introducesAction` is what stops a 19-word protocol line
   * becoming recitation — the ruling of 2026-08-13, arriving through the ORDERING
   * rather than through the ask.
   */
  it('stamps exactly one introducer per action', () => {
    for (const mode of ['classify_genre', 'compare_genres'] as const) {
      const { items } = build({ mode });
      const actions = Array.from(new Set(items.map((i) => i.action)));
      for (const action of actions) {
        const introducers = items.filter((i) => i.action === action && i.introducesAction);
        expect(introducers).toHaveLength(1);
        // …and it is the FIRST item of that action.
        expect(items.find((i) => i.action === action)!.introducesAction).toBe(true);
      }
    }
  });

  it('speaks the how-to-play on the introduction and never on a switch back', () => {
    const { items } = build();
    const firstGenre = items.find((i) => i.action === 'name-genre')!;
    const laterGenre = items.filter((i) => i.action === 'name-genre')[1];
    expect(spokenSpanOf(itemCue(firstGenre, { howToPlay: true })))
      .toContain('Now you tell me what kind of writing it is.');
    // The runner offers howToPlay again when the action changes back; the cue
    // declines it and goes straight to the ask.
    expect(spokenSpanOf(itemCue(laterGenre, { howToPlay: true })))
      .not.toContain('Now you tell me what kind of writing it is.');
    expect(spokenSpanOf(itemCue(laterGenre, { howToPlay: true }))).toContain('Your turn.');
  });

  it('keeps the DISTAR lead-in on the introduction only, and drops it at hard', () => {
    const easy = build({ supportTier: 'easy' }).items.find((i) => i.action === 'check-feature')!;
    expect(spokenSpanOf(itemCue(easy, { opening: true, howToPlay: true })))
      .toContain('Answer from the words in front of you');
    expect(spokenSpanOf(itemCue(easy, {}))).not.toContain('Answer from the words in front of you');

    const hard = build({ supportTier: 'hard' }).items.find((i) => i.action === 'check-feature')!;
    expect(spokenSpanOf(itemCue(hard, { opening: true, howToPlay: true })))
      .not.toContain('Answer from the words in front of you');
  });
});

// ---------------------------------------------------------------------------

describe('the harness answer material', () => {
  it('names a signature wrong the contract actually claims to refuse', () => {
    const { items } = build();
    const feature = items.find((i) => i.action === 'check-feature')!;
    const featureAnswers = genreExplorerHarnessAnswers(feature);
    expect(featureAnswers.signatureWrong?.text).toBe(feature.predicate);
    expect(itemCue(feature, {})).toContain('is NOT an answer however confident it');

    const genre = items.find((i) => i.action === 'name-genre')!;
    const genreAnswers = genreExplorerHarnessAnswers(genre);
    expect(genre.choices).toContain(genreAnswers.signatureWrong?.text);
    expect(genreAnswers.signatureWrong?.text).not.toBe(genre.answer);
    expect(itemCue(genre, {})).toContain('close relative of the right one');

    const contrast = build({ mode: 'compare_genres' }).items
      .find((i) => i.action === 'pick-excerpt')!;
    expect(genreExplorerHarnessAnswers(contrast).signatureWrong?.text).toBe('both of them');
    expect(itemCue(contrast, {})).toContain('"Both" and "neither" are also wrong');
  });

  /**
   * ⚠️ TWO OF THREE ACTIONS SHIP AN EMPTY `leakTokens`, and that is a property of
   * the answer material rather than a softened gate: "yes" is the tutor's own
   * affirm sentinel and "the first one" is half the question. The discrimination
   * oracle carries those two; `name-genre`'s leak oracle is what bites.
   */
  it('leaves the leak oracle to the one action that can carry it', () => {
    const { items } = build({ mode: 'compare_genres' });
    for (const item of items) {
      const answers = genreExplorerHarnessAnswers(item);
      if (item.action === 'name-genre') {
        expect(answers.leakTokens).toEqual([item.answer]);
      } else {
        expect(answers.leakTokens).toEqual([]);
      }
      expect(answers.correct).toBe(item.answer);
      expect(answers.plainWrong).not.toBe(item.answer);
    }
  });
});

// ---------------------------------------------------------------------------

describe('the catalog steers the judged loop, not the deleted checklist', () => {
  it('describes a spoken activity and names the microphone', () => {
    expect(catalogEntry.description).toMatch(/SPOKEN|OUT LOUD/);
    expect(catalogEntry.description).toContain('MICROPHONE');
    expect(catalogEntry.constraints).toContain('MICROPHONE');
  });

  it('leaves no steering prose for the deleted tap surface', () => {
    const prose = `${catalogEntry.description} ${catalogEntry.constraints}`.toLowerCase();
    for (const phrase of ['feature checklist', 'check the box', 'tap the', 'click the', 'drag the']) {
      expect(prose).not.toContain(phrase);
    }
  });

  it('declares the family audio mode', () => {
    expect(catalogEntry.audioInput).toEqual({ manual_activity: true });
  });

  it('keeps every eval mode and its beta', () => {
    const modes = catalogEntry.evalModes!.map((m) => `${m.evalMode}:${m.beta}`);
    expect(modes).toEqual([
      'identify_basic:2',
      'classify_genre:3',
      'compare_genres:4.5',
    ]);
  });

  /** Meta-commentary in `commonStruggles` gets recited verbatim to a child, and
   *  a response that produces a SENTIMENT rather than a VERDICT stalls a correct
   *  child (18d on the accept side — the letter-sound-link finding). */
  it('gives every struggle a performable script move', () => {
    for (const struggle of catalogEntry.tutoring!.commonStruggles!) {
      expect(struggle.response).toMatch(/scripted (correction|line)|affirm it with the scripted line|wait/);
    }
  });
});

// ---------------------------------------------------------------------------

describe('the whole session, end to end', () => {
  it('builds a family-shaped sitting in every mode', () => {
    for (const mode of ['identify_basic', 'classify_genre', 'compare_genres'] as const) {
      const { items } = build({ mode });
      expect(items.length).toBeGreaterThanOrEqual(4);
      expect(items.length).toBeLessThanOrEqual(12);
      expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
      expect(checkPackGates(packOf(items))).toEqual([]);
      const spans = items.flatMap((i) => spokenSpansOf(itemCue(i, { opening: true, howToPlay: true })));
      for (const span of spans) expect(span).not.toContain('[');
    }
  });

  it('builds nothing rather than a placeholder when the payload is empty', () => {
    expect(itemsFromPayload({}).items).toEqual([]);
    expect(itemsFromPayload({ excerpts: [] }).items).toEqual([]);
  });

  /**
   * ⭐ A LIVE PROBE PRODUCED THIS (compare_genres @ grade 6 hard, 2026-08-17):
   * one of the two texts was dropped generator-side for naming a genre, and the
   * pack happily built a valid TWO-item session — one yes/no and one genre call.
   * That is a Tier-1 shape delivered under a Tier-4 β of 4.5, so the θ it
   * produces measures the wrong thing. Refusing is the honest answer; the
   * component shows the "still being written" panel and the lesson regenerates.
   */
  it('refuses to degrade compare_genres into a session it is not', () => {
    const oneText = build({
      mode: 'compare_genres',
      excerpts: [{ excerptId: 'e1', text: FABLE, genre: 'fable' }],
    });
    expect(oneText.items).toEqual([]);
    expect(oneText.dropped).toBeGreaterThan(0);

    const noContrast = build({
      mode: 'compare_genres',
      features: [
        { featureId: 'both', predicate: 'have more than one sentence', presentIn: ['e1', 'e2'] },
        { featureId: 'one', predicate: 'have animals that talk', presentIn: ['e1'] },
      ],
    });
    expect(noContrast.items).toEqual([]);
  });
});
