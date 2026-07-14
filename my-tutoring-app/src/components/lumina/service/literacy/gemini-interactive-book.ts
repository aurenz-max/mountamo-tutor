import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type { GenerationContext } from '../generation/generationContext';
import type {
  BookCoverColor,
  BookFeatureKind,
  BookWordDifficulty,
  InteractiveBookChallenge,
  InteractiveBookData,
  InteractiveBookFocusWord,
  InteractiveBookPage,
  InteractiveBookVolume,
} from '../../primitives/visual-primitives/literacy/InteractiveBook';
import {
  buildModeConstraintSection,
  resolveEvalModes,
  type ChallengeTypeDoc,
} from '../evalMode';

// Fork B, coherent-book variant: Gemini authors one flat, internally coherent
// nonfiction book. Code reconstructs its pages and derives every scored
// challenge from text that is actually visible in the component.
const MODEL = 'gemini-flash-lite-latest';
const PAGE_COUNT = 3;
const COVER_COLORS: BookCoverColor[] = ['blue', 'emerald', 'amber', 'purple', 'rose'];
const ALL_CHALLENGE_TYPES: InteractiveBookChallenge['type'][] = ['find-feature', 'read-focus-word'];

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'find-feature': {
    promptDoc:
      '"find-feature": the child turns pages and locates visible print features: title, author, heading, caption, and page number.',
    schemaDescription: "'find-feature' (locate printed book features)",
  },
  'read-focus-word': {
    promptDoc:
      '"read-focus-word": the tutor reads a sentence only up to an underlined focus word, pauses, and the child says that one word. '
      + 'Every focus word must be a single token, must not begin its sentence, and must have at least one natural word before it.',
    schemaDescription: "'read-focus-word' (supply an underlined word in oral reading)",
  },
};

const scalar = (description: string): Schema => ({ type: Type.STRING, description });

const schemaProperties: Record<string, Schema> = {
  activityTitle: scalar('A playful 2-5 word activity title. Do not reveal a challenge answer.'),
  activityDescription: scalar('One short friendly sentence explaining that the child will inspect a picture book.'),
  bookTitle: scalar('A distinctive, sayable 1-3 word nonfiction book title.'),
  author: scalar('A fictional, child-safe author name of 1-3 short words.'),
  coverColor: { type: Type.STRING, enum: COVER_COLORS },
  coverImagePrompt: scalar('A concrete cover illustration prompt tied to the topic. No text, letters, or labels in the art.'),
  coverImageAlt: scalar('One short sentence describing exactly what the cover picture shows.'),
};
const schemaRequired = Object.keys(schemaProperties);

for (let index = 0; index < PAGE_COUNT; index += 1) {
  const prefix = `page${index}`;
  Object.assign(schemaProperties, {
    [`${prefix}Heading`]: scalar('A distinctive, sayable 1-3 word section heading.'),
    [`${prefix}Paragraph0`]: scalar('One short factual early-reader paragraph containing both focus words as whole words.'),
    [`${prefix}Paragraph1`]: scalar('A second short factual early-reader paragraph that expands the same page idea.'),
    [`${prefix}ImagePrompt`]: scalar('A concrete picture-book scene showing both focus words clearly. No text, letters, or labels.'),
    [`${prefix}ImageAlt`]: scalar('One short sentence describing the page illustration.'),
    [`${prefix}Caption`]: scalar('A distinctive, sayable 1-3 word picture caption.'),
    [`${prefix}FocusWord0`]: scalar('First focus word. It must appear exactly as a whole word in paragraph0 or paragraph1.'),
    [`${prefix}FocusDefinition0`]: scalar('A child-friendly definition with no circular wording.'),
    [`${prefix}FocusCue0`]: scalar('A short direction telling the child where to see this word represented in the illustration.'),
    [`${prefix}FocusWord1`]: scalar('Second, different focus word. It must appear exactly as a whole word in paragraph0 or paragraph1.'),
    [`${prefix}FocusDefinition1`]: scalar('A child-friendly definition with no circular wording.'),
    [`${prefix}FocusCue1`]: scalar('A short direction telling the child where to see this word represented in the illustration.'),
  });
  schemaRequired.push(
    `${prefix}Heading`, `${prefix}Paragraph0`, `${prefix}Paragraph1`,
    `${prefix}ImagePrompt`, `${prefix}ImageAlt`, `${prefix}Caption`,
    `${prefix}FocusWord0`, `${prefix}FocusDefinition0`, `${prefix}FocusCue0`,
    `${prefix}FocusWord1`, `${prefix}FocusDefinition1`, `${prefix}FocusCue1`,
  );
}

const BOOK_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: schemaProperties,
  required: schemaRequired,
};

type RawBook = Record<string, unknown>;

const text = (raw: RawBook, key: string): string =>
  typeof raw[key] === 'string' ? (raw[key] as string).trim() : '';

const plainParagraph = (raw: RawBook, key: string): string =>
  text(raw, key).replace(/<\/?u>/gi, '').replace(/\*\*|__/g, '').trim();

const wordCount = (value: string): number => value.trim().split(/\s+/).filter(Boolean).length;

const containsWholeWord = (paragraphs: string[], word: string): boolean => {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z])${escaped}([^A-Za-z]|$)`, 'i').test(paragraphs.join(' '));
};

const wholeWordCount = (paragraphs: string[], word: string): number => {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return paragraphs.join(' ').match(new RegExp(`(^|[^A-Za-z])${escaped}(?=[^A-Za-z]|$)`, 'ig'))?.length ?? 0;
};

const sentenceFrameFor = (
  paragraphs: string[],
  word: string,
): { readLead: string; readTail: string } | null => {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|[^A-Za-z])(${escaped})(?=[^A-Za-z]|$)`, 'i');
  for (const paragraph of paragraphs) {
    const match = pattern.exec(paragraph);
    if (!match || match.index === undefined) continue;
    const wordStart = match.index + match[1].length;
    const sentenceStart = Math.max(
      paragraph.lastIndexOf('.', wordStart - 1),
      paragraph.lastIndexOf('!', wordStart - 1),
      paragraph.lastIndexOf('?', wordStart - 1),
    ) + 1;
    const endings = ['.', '!', '?']
      .map((mark) => paragraph.indexOf(mark, wordStart + word.length))
      .filter((index) => index >= 0);
    const sentenceEnd = endings.length > 0 ? Math.min(...endings) + 1 : paragraph.length;
    const readLead = paragraph.slice(sentenceStart, wordStart).trim();
    const readTail = paragraph.slice(wordStart + word.length, sentenceEnd).trim();
    if (readLead) return { readLead, readTail };
  }
  return null;
};

const hideTargetWord = (value: string, word: string): string => {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return value.replace(new RegExp(`(^|[^A-Za-z])${escaped}(?=[^A-Za-z]|$)`, 'ig'), '$1it');
};

const resolveWordDifficulty = (ctx: GenerationContext): BookWordDifficulty => {
  const explicit = ctx.raw.wordDifficulty;
  if (explicit === 'easy' || explicit === 'medium' || explicit === 'hard') return explicit;
  const grade = (ctx.grade ?? ctx.gradeLevel).toLowerCase().trim();
  if (grade === 'k' || grade.includes('kindergarten') || grade.includes('preschool')) return 'easy';
  if (grade === '2' || grade.includes('grade-2') || grade.includes('grade 2')) return 'hard';
  return 'medium';
};

const bandDirections: Record<BookWordDifficulty, string> = {
  easy: 'K/easy: concrete high-frequency and mostly one-syllable CVC/CCVC words; sentences of 3-6 words.',
  medium: 'Grade 1/medium: concrete words with common blends, digraphs, or long-vowel patterns; 1-2 syllables; sentences of 5-9 words.',
  hard: 'Grade 2/hard: concrete, useful domain words up to 2-3 syllables with simple morphology or context support; sentences of 7-12 words. Never use obscure vocabulary.',
};

const buildPrompt = (
  ctx: GenerationContext,
  difficulty: BookWordDifficulty,
  modeSection: string,
  corrective = '',
): string => `
Create one coherent early-literacy NONFICTION picture book about "${ctx.topic}" for a K-2 Book Detective activity.
${ctx.intent ? `Specific learning focus: ${ctx.intent}.` : ''}
Difficulty band: ${bandDirections[difficulty]}

${modeSection}

The book has exactly three interior pages. Each page teaches one concrete idea and has exactly two underlined focus words.
The two focus words MUST appear verbatim as whole words in that page's paragraphs and MUST both be plainly visible as objects/actions in its illustration prompt.
All paragraph fields are PLAIN TEXT. Never add HTML, Markdown, underscores, asterisks, brackets, or <u> tags; the component applies underlining itself.

STRICT PRINT-FEATURE RULES:
- Book title, author, every heading, and every caption must be short, natural to say aloud, and distinct from the other feature text on its page.
- Title, headings, captions: 1-3 words. Author: 1-3 short words.
- Captions describe the picture but do not duplicate the heading.
- Paragraphs are factual, warm, and age-appropriate; no copyrighted characters or real book text.
- Image prompts show the facts and both focus words with large, clear subjects. They contain NO printed text, letters, labels, watermarks, signs, or speech bubbles.
- Image alt text describes the same scene accurately.
- Focus definitions are brief and child-friendly. Picture cues say where to look in that page picture.
- Each focus word appears exactly once in its page paragraphs and may NEVER be the first word of its sentence. The words before it must form a natural phrase the tutor can read aloud and pause after.
- All requested fields are required. Do not add challenge questions or answers; code derives them from the visible book.
${corrective}
`;

const reconstructBook = (
  raw: RawBook,
  difficulty: BookWordDifficulty,
): { title: string; description: string; book: InteractiveBookVolume } | null => {
  const title = text(raw, 'activityTitle');
  const description = text(raw, 'activityDescription');
  const bookTitle = text(raw, 'bookTitle');
  const author = text(raw, 'author');
  const coverColor = text(raw, 'coverColor') as BookCoverColor;
  const coverImagePrompt = text(raw, 'coverImagePrompt');
  const coverImageAlt = text(raw, 'coverImageAlt');

  if (!title || !description || !bookTitle || !author || !coverImagePrompt || !coverImageAlt) return null;
  if (!COVER_COLORS.includes(coverColor)) return null;
  if (wordCount(bookTitle) > 3 || wordCount(author) > 3) return null;
  if (bookTitle.toLowerCase() === author.toLowerCase()) return null;

  const pages: InteractiveBookPage[] = [];
  for (let index = 0; index < PAGE_COUNT; index += 1) {
    const prefix = `page${index}`;
    const heading = text(raw, `${prefix}Heading`);
    const paragraphs = [plainParagraph(raw, `${prefix}Paragraph0`), plainParagraph(raw, `${prefix}Paragraph1`)];
    const imagePrompt = text(raw, `${prefix}ImagePrompt`);
    const imageAlt = text(raw, `${prefix}ImageAlt`);
    const caption = text(raw, `${prefix}Caption`);
    const focusWords: InteractiveBookFocusWord[] = [0, 1].map((focusIndex) => ({
      word: text(raw, `${prefix}FocusWord${focusIndex}`),
      difficulty,
      definition: text(raw, `${prefix}FocusDefinition${focusIndex}`),
      pictureCue: text(raw, `${prefix}FocusCue${focusIndex}`),
    }));

    const requiredText = [heading, ...paragraphs, imagePrompt, imageAlt, caption];
    if (requiredText.some((value) => !value)) return null;
    if (paragraphs.some((paragraph) => /[<>]|\*\*|__/.test(paragraph))) return null;
    if (wordCount(heading) > 3 || wordCount(caption) > 3) return null;
    if (heading.toLowerCase() === caption.toLowerCase()) return null;
    if (focusWords.some((word) => (
      !word.word
      || wordCount(word.word) !== 1
      || !word.definition
      || !word.pictureCue
    ))) return null;
    if (focusWords[0].word.toLowerCase() === focusWords[1].word.toLowerCase()) return null;
    if (focusWords.some((word) => !containsWholeWord(paragraphs, word.word))) return null;
    if (focusWords.some((word) => wholeWordCount(paragraphs, word.word) !== 1)) return null;
    if (focusWords.some((word) => !sentenceFrameFor(paragraphs, word.word))) return null;

    pages.push({
      id: `interactive-book-page-${index + 1}`,
      pageNumber: index + 1,
      heading,
      paragraphs,
      imagePrompt,
      imageAlt,
      imageUrl: null,
      caption,
      focusWords,
    });
  }

  return {
    title,
    description,
    book: {
      id: 'interactive-book-volume-1',
      bookTitle,
      author,
      coverColor,
      coverImagePrompt,
      coverImageAlt,
      coverImageUrl: null,
      pages,
    },
  };
};

const pageOptions = (page: InteractiveBookPage): string[] => [
  page.heading,
  page.caption,
  `Page ${page.pageNumber}`,
];

const makeChallenge = (
  index: number,
  targetPageId: string,
  targetFeature: BookFeatureKind,
  targetText: string,
  optionTexts: string[],
  prompt: string,
  hint: string,
): InteractiveBookChallenge => ({
  id: `interactive-book-challenge-${index + 1}`,
  type: 'find-feature',
  prompt,
  targetPageId,
  targetFeature,
  targetText,
  optionTexts,
  hint,
});

const deriveFeatureChallenges = (book: InteractiveBookVolume): InteractiveBookChallenge[] => {
  const coverOptions = [book.bookTitle, book.author];
  const [page1, page2, page3] = book.pages;
  if (!page1 || !page2 || !page3) throw new Error('[InteractiveBook] cannot derive challenges without three pages');
  return [
    { ...makeChallenge(0, 'cover', 'title', book.bookTitle, coverOptions,
      'Tap the title on the cover.', 'Look for the biggest words that tell what the whole book is about.'),
      id: 'interactive-book-feature-1' },
    { ...makeChallenge(1, 'cover', 'author', book.author, coverOptions,
      'Tap the author name on the cover.', 'Look near the title for the name of the person who wrote the book.'),
      id: 'interactive-book-feature-2' },
    { ...makeChallenge(2, page1.id, 'heading', page1.heading, pageOptions(page1),
      'Tap the heading at the start of this page.', 'A heading sits above the facts and tells the page topic.'),
      id: 'interactive-book-feature-3' },
    { ...makeChallenge(3, page2.id, 'caption', page2.caption, pageOptions(page2),
      'Tap the caption for this picture.', 'A caption is the short line closest to the picture.'),
      id: 'interactive-book-feature-4' },
    { ...makeChallenge(4, page3.id, 'page-number', `Page ${page3.pageNumber}`, pageOptions(page3),
      'Tap the page number.', 'Look near an outer edge for the small number that marks this page.'),
      id: 'interactive-book-feature-5' },
  ];
};

const deriveFocusWordChallenges = (book: InteractiveBookVolume): InteractiveBookChallenge[] =>
  book.pages.flatMap((page) => page.focusWords.map((focusWord, focusIndex) => {
    const frame = sentenceFrameFor(page.paragraphs, focusWord.word);
    if (!frame) throw new Error(`[InteractiveBook] focus word has no readable lead: ${focusWord.word}`);
    return {
      id: `interactive-book-word-${page.pageNumber}-${focusIndex + 1}`,
      type: 'read-focus-word',
      prompt: 'Listen to the sentence. Then say the glowing underlined word.',
      targetPageId: page.id,
      targetFeature: 'focus-word',
      targetText: focusWord.word,
      optionTexts: page.focusWords.map((word) => word.word),
      hint: hideTargetWord(focusWord.pictureCue, focusWord.word),
      readLead: frame.readLead,
      readTail: frame.readTail,
    };
  }));

const deriveChallenges = (
  book: InteractiveBookVolume,
  allowedTypes: InteractiveBookChallenge['type'][],
): InteractiveBookChallenge[] => {
  const featureChallenges = deriveFeatureChallenges(book);
  const focusWordChallenges = deriveFocusWordChallenges(book);
  if (allowedTypes.length === 1 && allowedTypes[0] === 'find-feature') return featureChallenges;
  if (allowedTypes.length === 1 && allowedTypes[0] === 'read-focus-word') return focusWordChallenges;

  // The unpinned/blended path is an honest mixed session: three print-feature
  // tasks and one oral-reading target from each interior page.
  return [
    featureChallenges[0],
    focusWordChallenges[0],
    featureChallenges[2],
    focusWordChallenges[2],
    featureChallenges[3],
    focusWordChallenges[4],
  ];
};

const fallbackFor = (difficulty: BookWordDifficulty): { title: string; description: string; book: InteractiveBookVolume } => {
  const bandWords: Record<BookWordDifficulty, Array<[string, string, string, string, string, string]>> = {
    easy: [
      ['Pond Life', 'A frog can hop by the wet pond.', 'A duck can swim in the water.', 'frog', 'an animal that can hop and swim', 'Find the green frog by the pond.'],
      ['In a Nest', 'A bird sits in a soft nest.', 'This home keeps each egg safe.', 'bird', 'an animal with feathers and wings', 'Find the bird above the nest.'],
      ['Busy Bees', 'A bee can buzz by a red bloom.', 'The insect gets food from the flower.', 'bee', 'a small insect that can buzz', 'Find the bee beside the flower.'],
    ],
    medium: [
      ['Pond Homes', 'A spotted frog rests beside the shallow pond.', 'A turtle swims through the clear water.', 'shallow', 'not deep', 'Look at the water near the pond edge.'],
      ['Safe Nests', 'A robin gathers twigs to shape a strong nest.', 'The branches hold the nest above the ground.', 'branches', 'parts of a tree that grow from its trunk', 'Find the tree arms holding the nest.'],
      ['Flower Food', 'A honeybee collects sweet nectar from a flower.', 'Yellow pollen clings to the bee as it flies.', 'nectar', 'sweet liquid made by flowers', 'Look inside the flower where the bee drinks.'],
    ],
    hard: [
      ['Wetland Habitat', 'A wetland habitat gives frogs water, shelter, and food.', 'Reeds protect tadpoles near the muddy shoreline.', 'habitat', 'the place where a living thing gets what it needs', 'Look across the whole wetland home.'],
      ['Hidden Shelter', 'A woven nest provides shelter for young birds.', 'Its sturdy branches protect the chicks from wind.', 'shelter', 'a safe place that protects a living thing', 'Find the covered nest that keeps the chicks safe.'],
      ['Plant Partners', 'A bee carries powdery pollen between bright blossoms.', 'This pollination helps many plants make seeds.', 'pollination', 'moving pollen so a plant can make seeds', 'Follow the bee traveling between two flowers.'],
    ],
  };
  const secondWords: Record<BookWordDifficulty, Array<[string, string, string]>> = {
    easy: [['pond', 'a small body of water', 'Look at the blue water.'], ['nest', 'a home birds build for eggs', 'Look under the bird.'], ['bloom', 'a flower', 'Find the red flower.']],
    medium: [['turtle', 'an animal with a hard shell', 'Find the shell in the water.'], ['twigs', 'small thin branches', 'Look at the pieces that form the nest.'], ['pollen', 'fine powder made by flowers', 'Look at the yellow dust on the bee.']],
    hard: [['tadpoles', 'young frogs that live in water', 'Find the small swimmers near the reeds.'], ['sturdy', 'strong and not easy to break', 'Look at the thick branches.'], ['blossoms', 'flowers on a plant', 'Find the open flowers around the bee.']],
  };
  const pages = bandWords[difficulty].map((entry, index): InteractiveBookPage => {
    const [heading, paragraph0, paragraph1, word0, definition0, cue0] = entry;
    const [word1, definition1, cue1] = secondWords[difficulty][index];
    const caption = ['Pond Neighbors', 'Nest Above', 'Bee at Work'][index];
    return {
      id: `interactive-book-page-${index + 1}`,
      pageNumber: index + 1,
      heading,
      paragraphs: [paragraph0, paragraph1],
      imagePrompt: `${paragraph0} ${paragraph1} Clearly show ${word0} and ${word1} as the main subjects. No text or labels.`,
      imageAlt: `${heading} with ${word0} and ${word1}.`,
      imageUrl: null,
      caption,
      focusWords: [
        { word: word0, difficulty, definition: definition0, pictureCue: cue0 },
        { word: word1, difficulty, definition: definition1, pictureCue: cue1 },
      ],
    };
  });
  return {
    title: 'Book Detective',
    description: 'Turn the pages, find each book part, and open picture words.',
    book: {
      id: 'interactive-book-volume-1',
      bookTitle: 'Pond Neighbors',
      author: 'Mia Lee',
      coverColor: 'emerald',
      coverImagePrompt: 'A friendly frog, robin, and honeybee sharing a bright pond habitat. Picture-book art, no text or labels.',
      coverImageAlt: 'A frog, bird, and bee near a sunny pond.',
      coverImageUrl: null,
      pages,
    },
  };
};

const validateDerivedChallenges = (book: InteractiveBookVolume, challenges: InteractiveBookChallenge[]): boolean => {
  const pagesById = new Map(book.pages.map((page) => [page.id, page]));
  return challenges.length >= 4 && challenges.length <= 6 && challenges.every((challenge) => {
    if (challenge.type === 'read-focus-word') {
      const page = pagesById.get(challenge.targetPageId);
      const frame = page ? sentenceFrameFor(page.paragraphs, challenge.targetText) : null;
      const pageWords = page?.focusWords.map((word) => word.word) ?? [];
      return !!page
        && !!frame
        && challenge.targetFeature === 'focus-word'
        && pageWords.includes(challenge.targetText)
        && challenge.readLead === frame.readLead
        && challenge.readTail === frame.readTail
        && challenge.optionTexts.length === pageWords.length
        && challenge.optionTexts.every((option, index) => option === pageWords[index])
        && !challenge.prompt.toLowerCase().includes(challenge.targetText.toLowerCase())
        && !challenge.hint.toLowerCase().includes(challenge.targetText.toLowerCase());
    }
    const options = challenge.targetPageId === 'cover'
      ? [book.bookTitle, book.author]
      : (() => {
          const page = pagesById.get(challenge.targetPageId);
          return page ? pageOptions(page) : [];
        })();
    const normalized = options.map((option) => option.toLowerCase());
    const unique = new Set(normalized);
    return options.length === challenge.optionTexts.length
      && unique.size === options.length
      && normalized.filter((option) => option === challenge.targetText.toLowerCase()).length === 1
      && !challenge.prompt.toLowerCase().includes(challenge.targetText.toLowerCase())
      && !challenge.hint.toLowerCase().includes(challenge.targetText.toLowerCase())
      && challenge.optionTexts.every((option, index) => option === options[index]);
  });
};

const callGemini = async (
  ctx: GenerationContext,
  difficulty: BookWordDifficulty,
  modeSection: string,
  corrective = '',
): Promise<RawBook> => {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: buildPrompt(ctx, difficulty, modeSection, corrective),
    config: {
      responseMimeType: 'application/json',
      responseSchema: BOOK_SCHEMA,
      systemInstruction: 'You are an expert K-2 literacy editor and picture-book art director. Return only a coherent, original, age-appropriate nonfiction book matching the schema.',
    },
  });
  if (!response.text) throw new Error('[InteractiveBook] Gemini returned no structured text');
  return JSON.parse(response.text) as RawBook;
};

export const generateInteractiveBook = async (ctx: GenerationContext): Promise<InteractiveBookData> => {
  const difficulty = resolveWordDifficulty(ctx);
  const resolution = await resolveEvalModes(
    'interactive-book',
    {
      targetEvalMode: ctx.targetEvalMode,
      intent: ctx.intent,
      objectiveText: ctx.objective?.text,
    },
    CHALLENGE_TYPE_DOCS,
  );
  const allowedTypes = (resolution?.allowedTypes ?? ALL_CHALLENGE_TYPES) as InteractiveBookChallenge['type'][];
  const modeSection = buildModeConstraintSection(resolution, CHALLENGE_TYPE_DOCS);
  // Gemini authors stimulus content only; it emits no challenge-type or answer
  // fields to constrain. Code derives the allowed challenge types directly from
  // the resolved mode, which is stricter than post-filtering model output.
  console.log(
    `[InteractiveBook] modes: ${resolution ? `${resolution.modes.map((mode) => mode.evalMode).join('+')} (${resolution.source})` : 'mixed'} -> types [${allowedTypes.join(', ')}]`,
  );
  let reconstructed: ReturnType<typeof reconstructBook> = null;

  for (let attempt = 0; attempt < 2 && !reconstructed; attempt += 1) {
    try {
      const raw = await callGemini(
        ctx,
        difficulty,
        modeSection,
        attempt === 1
          ? 'CORRECTIVE RETRY: Return PLAIN TEXT with no HTML/Markdown tags. Ensure every scalar field is nonempty, each focus word occurs verbatim exactly once but never sentence-initial in its page paragraphs, and headings/captions are distinct and at most three words.'
          : '',
      );
      reconstructed = reconstructBook(raw, difficulty);
      if (!reconstructed) console.warn(`[InteractiveBook] rejected malformed generated book (attempt ${attempt + 1})`);
    } catch (error) {
      console.warn(`[InteractiveBook] generation attempt ${attempt + 1} failed`, error);
    }
  }

  if (!reconstructed) {
    console.error('[InteractiveBook] using validated fallback after all generation attempts failed');
    reconstructed = fallbackFor(difficulty);
  }

  const challenges = deriveChallenges(reconstructed.book, allowedTypes);
  if (!validateDerivedChallenges(reconstructed.book, challenges)) {
    console.error('[InteractiveBook] derived challenge contract failed; rebuilding from validated fallback');
    reconstructed = fallbackFor(difficulty);
  }
  const finalChallenges = deriveChallenges(reconstructed.book, allowedTypes);
  const singleType = allowedTypes.length === 1 ? allowedTypes[0] : null;

  return {
    title: reconstructed.title,
    description: reconstructed.description,
    gradeLevel: ctx.grade ?? ctx.gradeLevel,
    mode: singleType === 'find-feature'
      ? 'text-features'
      : singleType === 'read-focus-word'
        ? 'focus-word-reading'
        : 'mixed',
    challengeType: singleType ?? 'mixed',
    wordDifficulty: difficulty,
    books: [reconstructed.book],
    challenges: finalChallenges,
  };
};
