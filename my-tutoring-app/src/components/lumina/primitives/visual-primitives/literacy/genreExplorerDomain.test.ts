/**
 * genreExplorerDomain: the build gates, pinned. Pure, no jsdom.
 *
 *  1. Every step is SPOKEN (`answerKind: 'voice'`); the response classes are the benched ones.
 *  2. One payload is many asks, capped by SELECTION: the kept set still reaches both verdicts and both texts.
 *  3. A genre is asked once per session.
 *  4. The read-aloud is safe because the answer is not in the text: an excerpt naming a genre drops, an excerpt too
 *     long to read at the band floor drops, dialogue is made safe to speak.
 *  5. The menu is canonical and pruned for the ear, and an answer is never pruned.
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
  excerptOrdinalFor,
  isBandFloor,
  isReadableAloud,
  isSayablePredicate,
  itemsFromPayload,
  leakExemptSpanFor,
  namesAGenre,
  optionsEarSeparable,
  pruneForEar,
  questionFor,
  responseClassFor,
  speechSafe,
  type GenreExplorerPayloadLike,
} from './genreExplorerDomain';

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


// ---------------------------------------------------------------------------


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
    const spoken = askFor(genre);
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
    // The ask survives whole: the text, then the question.
    expect(askFor(first)).toContain('These grapes are sour');
    expect(askFor(first)).toContain(questionFor(first));
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


// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------

describe('the whole session, end to end', () => {
  it('builds a family-shaped sitting in every mode', () => {
    for (const mode of ['identify_basic', 'classify_genre', 'compare_genres'] as const) {
      const { items } = build({ mode });
      expect(items.length).toBeGreaterThanOrEqual(4);
      expect(items.length).toBeLessThanOrEqual(12);
      expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
      for (const item of items) expect(item.mode).toBe(mode);
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
