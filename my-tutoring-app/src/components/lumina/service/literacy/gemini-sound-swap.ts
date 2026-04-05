import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { SoundSwapData, SoundSwapChallenge } from "../../primitives/visual-primitives/literacy/SoundSwap";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ---------------------------------------------------------------------------
// Curated valid word pairs — guides Gemini toward real-word transformations
// ---------------------------------------------------------------------------

const VALID_ADDITION_PAIRS = [
  // K: VC → CVC
  'at→cat', 'at→bat', 'at→hat', 'at→mat', 'at→rat', 'at→sat', 'at→pat',
  'an→can', 'an→fan', 'an→man', 'an→pan', 'an→ran', 'an→van', 'an→tan',
  'it→bit', 'it→fit', 'it→hit', 'it→kit', 'it→lit', 'it→pit', 'it→sit',
  'in→bin', 'in→fin', 'in→pin', 'in→tin', 'in→win',
  'up→cup', 'up→pup',
  'am→ham', 'am→jam', 'am→ram',
  'ox→box', 'ox→fox',
  'us→bus',
  'ear→hear', 'ear→dear', 'ear→near', 'ear→year',
  'all→ball', 'all→call', 'all→fall', 'all→hall', 'all→tall', 'all→wall',
  'old→bold', 'old→cold', 'old→fold', 'old→gold', 'old→hold', 'old→told',
  'eat→beat', 'eat→heat', 'eat→meat', 'eat→neat', 'eat→seat',
  'ice→dice', 'ice→mice', 'ice→nice', 'ice→rice',
  'age→cage', 'age→page', 'age→sage',
  // Grade 1-2: CVC → CCVC / CVCC
  'lip→slip', 'lip→clip', 'lip→flip',
  'top→stop', 'rim→trim', 'rain→train', 'rain→brain', 'rain→grain',
  'low→flow', 'low→slow', 'low→glow',
  'rip→trip', 'rip→drip', 'rip→grip',
  'lap→clap', 'lap→flap', 'lap→slap',
  'lock→block', 'lock→clock',
];

const VALID_DELETION_PAIRS = [
  // K: CVC → VC (reverse of addition)
  'cat→at', 'bat→at', 'hat→at', 'mat→at', 'rat→at', 'sat→at',
  'can→an', 'fan→an', 'man→an', 'pan→an', 'ran→an', 'van→an',
  'bit→it', 'fit→it', 'hit→it', 'kit→it', 'lit→it', 'pit→it', 'sit→it',
  'bin→in', 'fin→in', 'pin→in', 'tin→in', 'win→in',
  'cup→up', 'pup→up',
  'ham→am', 'jam→am', 'ram→am',
  'box→ox', 'fox→ox',
  'bus→us',
  'hear→ear', 'dear→ear', 'near→ear', 'year→ear',
  'ball→all', 'call→all', 'fall→all', 'hall→all', 'tall→all', 'wall→all',
  'bold→old', 'cold→old', 'fold→old', 'gold→old', 'hold→old', 'told→old',
  'beat→eat', 'heat→eat', 'meat→eat', 'neat→eat', 'seat→eat',
  'dice→ice', 'mice→ice', 'nice→ice', 'rice→ice',
  'cage→age', 'page→age', 'sage→age',
  // Grade 1-2: CCVC → CVC
  'slip→lip', 'clip→lip', 'flip→lip',
  'stop→top', 'trim→rim', 'train→rain', 'brain→rain',
  'flow→low', 'slow→low', 'glow→low',
  'trip→rip', 'drip→rip', 'grip→rip',
  'clap→lap', 'flap→lap', 'slap→lap',
  'block→lock', 'clock→lock',
];

// Common K-2 English words for post-process validation
const COMMON_WORDS = new Set([
  // VC words
  'at', 'an', 'in', 'it', 'on', 'up', 'us', 'am', 'if', 'ox',
  'all', 'old', 'eat', 'ear', 'ice', 'age', 'arm', 'art', 'ask',
  // CVC words
  'bat', 'bed', 'big', 'bit', 'box', 'bud', 'bug', 'bun', 'bus', 'but', 'buy',
  'cab', 'can', 'cap', 'car', 'cat', 'cop', 'cot', 'cow', 'cub', 'cup', 'cut',
  'dad', 'day', 'did', 'dig', 'dim', 'dip', 'dog', 'dot', 'dry', 'dug', 'dye',
  'fan', 'far', 'fat', 'fed', 'fig', 'fin', 'fit', 'fix', 'fly', 'fog', 'for',
  'fox', 'fun', 'fur', 'gap', 'gas', 'get', 'god', 'got', 'gum', 'gun', 'gut', 'guy',
  'had', 'ham', 'has', 'hat', 'hen', 'her', 'hid', 'him', 'hip', 'his', 'hit',
  'hog', 'hop', 'hot', 'how', 'hub', 'hug', 'hum', 'hut',
  'jam', 'jar', 'jaw', 'jet', 'job', 'jog', 'joy', 'jug',
  'key', 'kid', 'kin', 'kit',
  'lab', 'lad', 'lag', 'lap', 'law', 'lay', 'led', 'leg', 'let', 'lid',
  'lip', 'lit', 'log', 'lot', 'low', 'lug',
  'mad', 'man', 'map', 'mat', 'men', 'met', 'mix', 'mob', 'mom', 'mop',
  'mud', 'mug', 'mum',
  'nap', 'net', 'new', 'nod', 'nor', 'not', 'now', 'nun', 'nut',
  'pad', 'pal', 'pan', 'pat', 'paw', 'pay', 'peg', 'pen', 'per', 'pet',
  'pie', 'pig', 'pin', 'pit', 'pod', 'pop', 'pot', 'pox', 'pub', 'pug',
  'pun', 'pup', 'put',
  'rag', 'ram', 'ran', 'rap', 'rat', 'raw', 'ray', 'red', 'rib', 'rid',
  'rig', 'rim', 'rip', 'rob', 'rod', 'rot', 'row', 'rug', 'run', 'rut',
  'sad', 'sag', 'sap', 'sat', 'saw', 'say', 'sea', 'set', 'shy', 'sin',
  'sip', 'sir', 'sis', 'sit', 'six', 'sky', 'sob', 'sod', 'son', 'sop',
  'sow', 'spy', 'sub', 'sue', 'sum', 'sun', 'sup',
  'tab', 'tag', 'tan', 'tap', 'tar', 'tax', 'tea', 'ten', 'the', 'tie',
  'tin', 'tip', 'toe', 'ton', 'too', 'top', 'tow', 'toy', 'try', 'tub', 'tug',
  'van', 'vat', 'vet', 'via', 'vow',
  'wag', 'war', 'was', 'wax', 'way', 'web', 'wed', 'wet', 'who', 'why',
  'wig', 'win', 'wit', 'woe', 'wok', 'won', 'wow',
  'yak', 'yam', 'yap', 'yaw', 'yes', 'yet', 'you',
  'zap', 'zen', 'zip', 'zoo',
  // CCVC / CVCC / longer common words
  'back', 'ball', 'band', 'bang', 'bank', 'bark', 'barn', 'base', 'bath',
  'bean', 'bear', 'beat', 'been', 'bell', 'belt', 'bend', 'bent', 'best',
  'bike', 'bird', 'bite', 'blow', 'blue', 'boat', 'body', 'bold', 'bone',
  'book', 'boot', 'born', 'boss', 'both', 'bowl', 'bump', 'burn', 'bush',
  'buzz', 'cage', 'cake', 'call', 'calm', 'came', 'camp', 'cape', 'card',
  'care', 'cart', 'case', 'cash', 'cast', 'cave', 'chip', 'clam', 'clap',
  'clay', 'clip', 'clock', 'club', 'clue', 'coat', 'code', 'coin', 'cold',
  'come', 'cook', 'cool', 'copy', 'cord', 'corn', 'cost', 'crab', 'crop',
  'crow', 'cube', 'curl', 'cute', 'damp', 'dare', 'dark', 'dart', 'dash',
  'date', 'dawn', 'dead', 'deaf', 'deal', 'dear', 'deck', 'deep', 'deer',
  'desk', 'dice', 'dirt', 'dish', 'dock', 'does', 'done', 'door', 'dose',
  'dove', 'down', 'drag', 'draw', 'drip', 'drop', 'drum', 'duck', 'dull',
  'dump', 'dusk', 'dust', 'each', 'earn', 'east', 'edge', 'face', 'fact',
  'fade', 'fail', 'fair', 'fake', 'fall', 'fame', 'farm', 'fast', 'fate',
  'fear', 'feed', 'feel', 'fell', 'felt', 'fill', 'film', 'find', 'fine',
  'fire', 'firm', 'fish', 'fist', 'five', 'flag', 'flame', 'flap', 'flat',
  'flew', 'flip', 'float', 'flow', 'fold', 'food', 'fool', 'foot', 'fork',
  'form', 'frog', 'from', 'fuel', 'full', 'fund', 'fuse', 'gain', 'game',
  'gate', 'gave', 'gift', 'girl', 'glad', 'glow', 'glue', 'goat', 'goes',
  'gold', 'golf', 'gone', 'good', 'grab', 'gray', 'grew', 'grin', 'grip',
  'grow', 'gulp', 'gust', 'hair', 'half', 'hall', 'hand', 'hang', 'hard',
  'harm', 'hate', 'have', 'head', 'heal', 'hear', 'heat', 'held', 'help',
  'here', 'hero', 'hide', 'high', 'hike', 'hill', 'hint', 'hold', 'hole',
  'home', 'hood', 'hook', 'hope', 'horn', 'hose', 'host', 'hunt', 'hurt',
  'into', 'iron', 'jack', 'jail', 'joke', 'jump', 'just', 'keen', 'keep',
  'kick', 'kill', 'kind', 'king', 'kiss', 'kite', 'knee', 'knob', 'knot',
  'know', 'lace', 'lack', 'lake', 'lamb', 'lamp', 'land', 'lane', 'last',
  'late', 'lawn', 'lead', 'leaf', 'leak', 'lean', 'left', 'lend', 'less',
  'life', 'lift', 'like', 'lime', 'limp', 'line', 'link', 'lion', 'list',
  'live', 'load', 'loan', 'lock', 'long', 'look', 'loop', 'lord', 'lose',
  'lost', 'loud', 'love', 'luck', 'lump', 'lung', 'made', 'mail', 'main',
  'make', 'male', 'mall', 'many', 'mark', 'mask', 'mass', 'meal', 'mean',
  'meet', 'melt', 'mice', 'mild', 'mile', 'milk', 'mill', 'mind', 'mine',
  'miss', 'mode', 'mold', 'moon', 'more', 'moss', 'most', 'move', 'much',
  'must', 'nail', 'name', 'near', 'neat', 'neck', 'need', 'nest', 'next',
  'nice', 'nine', 'nope', 'nose', 'note', 'noun', 'once', 'only', 'open',
  'oven', 'over', 'pace', 'pack', 'page', 'paid', 'pain', 'pair', 'pale',
  'palm', 'park', 'part', 'pass', 'past', 'path', 'pave', 'peak', 'peel',
  'pick', 'pile', 'pine', 'pink', 'pipe', 'plan', 'play', 'plot', 'plug',
  'plum', 'plus', 'poem', 'pole', 'pond', 'pool', 'poor', 'pope', 'pork',
  'pose', 'post', 'pour', 'pray', 'pull', 'pump', 'pure', 'push', 'quit',
  'race', 'rack', 'rage', 'rail', 'rain', 'rake', 'rank', 'rare', 'rash',
  'rate', 'read', 'real', 'rear', 'rent', 'rest', 'rice', 'rich', 'ride',
  'ring', 'rise', 'risk', 'road', 'roam', 'rock', 'rode', 'role', 'roll',
  'roof', 'room', 'root', 'rope', 'rose', 'rude', 'rule', 'rush', 'rust',
  'safe', 'sage', 'said', 'sail', 'sake', 'sale', 'salt', 'same', 'sand',
  'sang', 'save', 'seal', 'seed', 'seek', 'seem', 'seen', 'self', 'sell',
  'send', 'sent', 'shed', 'ship', 'shop', 'shot', 'show', 'shut', 'sick',
  'side', 'sign', 'silk', 'sing', 'sink', 'size', 'skin', 'skip', 'slam',
  'slap', 'slid', 'slim', 'slip', 'slot', 'slow', 'snap', 'snow', 'soap',
  'sock', 'soft', 'soil', 'sold', 'sole', 'some', 'song', 'soon', 'sort',
  'soul', 'sour', 'spin', 'spot', 'star', 'stay', 'stem', 'step', 'stir',
  'stop', 'such', 'suit', 'sure', 'swim', 'tail', 'take', 'tale', 'talk',
  'tall', 'tank', 'tape', 'task', 'team', 'tear', 'tell', 'tend', 'tent',
  'term', 'test', 'text', 'than', 'that', 'them', 'then', 'they', 'thin',
  'this', 'thus', 'tick', 'tide', 'tidy', 'tile', 'till', 'time', 'tiny',
  'tire', 'toad', 'told', 'toll', 'tone', 'took', 'tool', 'tops', 'tore',
  'torn', 'toss', 'tour', 'town', 'trap', 'tray', 'tree', 'trim', 'trip',
  'trot', 'true', 'tube', 'tuck', 'tune', 'turn', 'twin', 'type',
  'upon', 'used', 'user', 'vale', 'vary', 'vast', 'verb', 'very', 'vest',
  'view', 'vine', 'vote', 'wade', 'wage', 'wait', 'wake', 'walk', 'wall',
  'wand', 'want', 'warm', 'warn', 'wash', 'wave', 'weak', 'wear', 'weed',
  'week', 'well', 'went', 'were', 'west', 'what', 'when', 'wide', 'wife',
  'wild', 'will', 'wind', 'wine', 'wing', 'wipe', 'wire', 'wise', 'wish',
  'with', 'woke', 'wolf', 'wood', 'wool', 'word', 'wore', 'work', 'worm',
  'worn', 'wrap', 'yard', 'year', 'yell', 'your', 'zero', 'zone',
  // Additional short real words that appear in phoneme addition/deletion
  'ream', 'seam', 'beam', 'team', 'cream', 'dream', 'stream',
  'lock', 'block', 'clock', 'flock', 'knock', 'rock', 'sock', 'stock',
  'rain', 'brain', 'chain', 'drain', 'grain', 'plain', 'spain', 'stain', 'train',
  'rip', 'drip', 'grip', 'ship', 'skip', 'strip', 'trip', 'whip',
]);

// IPA normalization — map uncommon IPA symbols to component-friendly versions
const IPA_NORMALIZATIONS: Record<string, string> = {
  '/ɹ/': '/r/',
  '/ɾ/': '/r/',
  '/ɻ/': '/r/',
};

function normalizePhonemes(phonemes: string[]): string[] {
  return phonemes.map(p => IPA_NORMALIZATIONS[p] ?? p);
}

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  addition: {
    promptDoc:
      `"addition": Add a phoneme to an existing word to make a new word. `
      + `resultPhonemes has exactly ONE more phoneme than originalPhonemes. `
      + `K: add single consonant to make CVC from VC (e.g., "at" + /k/ = "cat"). `
      + `Grade 1: add consonants/blends (e.g., "lip" → "slip"). `
      + `Grade 2: add to create blends/clusters (e.g., "rain" → "train").`,
    schemaDescription: "'addition' (add a phoneme to make a new word)",
  },
  deletion: {
    promptDoc:
      `"deletion": Remove a phoneme from an existing word to reveal a new word. `
      + `originalPhonemes has exactly ONE more phoneme than resultPhonemes. `
      + `K: remove one consonant from CVC (e.g., "cat" - /k/ = "at"). `
      + `Grade 1: remove from blends/clusters (e.g., "stop" → "top"). `
      + `Grade 2: remove from complex words (e.g., "cream" → "ream").`,
    schemaDescription: "'deletion' (remove a phoneme to reveal a new word)",
  },
  substitution: {
    promptDoc:
      `"substitution": Swap one phoneme for another to transform a word. `
      + `Both arrays have the SAME length, differing at exactly ONE position. `
      + `K: swap beginning sound in CVC (e.g., "cat" → "bat"). `
      + `Grade 1: swap beginning/ending sounds (e.g., "hit" → "sit"). `
      + `Grade 2: swap any position including medial vowels (e.g., "bit" → "bat").`,
    schemaDescription: "'substitution' (swap one phoneme to change the word)",
  },
};

/**
 * Schema definition for Sound Swap Data
 *
 * Generates phoneme manipulation challenges for K-2 students.
 * Three operation types:
 *   - Addition: add a phoneme to make a new word
 *   - Deletion: remove a phoneme to make a new word
 *   - Substitution: swap one phoneme for another to make a new word
 *
 * The schema only asks Gemini for word pairs + phoneme arrays + operation type.
 * All operation-specific fields (oldPhoneme, newPhoneme, position, etc.) are
 * derived deterministically by diffing originalPhonemes vs resultPhonemes.
 * This eliminates inconsistencies where Gemini returns fields that don't
 * match the actual phoneme transformation.
 */
const soundSwapSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the activity (e.g., 'Sound Swap: Animal Fun!')",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier (e.g., 'c1', 'c2')",
          },
          operation: {
            type: Type.STRING,
            enum: ["addition", "deletion", "substitution"],
            description: "The phoneme manipulation operation type",
          },
          originalWord: {
            type: Type.STRING,
            description: "The starting word",
          },
          originalPhonemes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Phonemes of the original word in IPA-style with slashes (e.g., [\"/k/\", \"/æ/\", \"/t/\"])",
          },
          originalImage: {
            type: Type.STRING,
            description: "Brief image description for the original word (3-6 words)",
          },
          resultWord: {
            type: Type.STRING,
            description: "The resulting word after the manipulation",
          },
          resultPhonemes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Phonemes of the result word in IPA-style with slashes",
          },
          resultImage: {
            type: Type.STRING,
            description: "Brief image description for the result word (3-6 words)",
          },
        },
        required: [
          "id",
          "operation",
          "originalWord",
          "originalPhonemes",
          "originalImage",
          "resultWord",
          "resultPhonemes",
          "resultImage",
        ],
      },
      description: "Array of phoneme manipulation challenges mixing all three operation types",
    },
  },
  required: ["title", "challenges"],
};

// ============================================================================
// Derivation — compute operation details from phoneme array diffs
// ============================================================================

interface RawChallenge {
  id: string;
  operation: "addition" | "deletion" | "substitution";
  originalWord: string;
  originalPhonemes: string[];
  originalImage: string;
  resultWord: string;
  resultPhonemes: string[];
  resultImage: string;
}

function positionLabel(idx: number, length: number): "beginning" | "middle" | "end" {
  if (idx === 0) return "beginning";
  if (idx === length - 1) return "end";
  return "middle";
}

/**
 * Derive operation-specific fields by diffing originalPhonemes ↔ resultPhonemes.
 * Returns a full SoundSwapChallenge with all fields populated deterministically.
 */
function deriveOperationFields(raw: RawChallenge): SoundSwapChallenge {
  const base = {
    id: raw.id,
    operation: raw.operation,
    originalWord: raw.originalWord,
    originalPhonemes: raw.originalPhonemes,
    originalImage: raw.originalImage,
    resultWord: raw.resultWord,
    resultPhonemes: raw.resultPhonemes,
    resultImage: raw.resultImage,
  };

  const origP = raw.originalPhonemes;
  const resP = raw.resultPhonemes;

  if (raw.operation === "substitution" && origP.length === resP.length && origP.length > 0) {
    // Find the first index where they differ
    for (let i = 0; i < origP.length; i++) {
      if (origP[i] !== resP[i]) {
        return {
          ...base,
          oldPhoneme: origP[i],
          newPhoneme: resP[i],
          substitutePosition: positionLabel(i, origP.length),
        };
      }
    }
    // Arrays identical — fallback (shouldn't happen with valid data)
    return { ...base, oldPhoneme: origP[0], newPhoneme: resP[0], substitutePosition: "beginning" };
  }

  if (raw.operation === "addition" && resP.length === origP.length + 1) {
    // The extra phoneme in resultPhonemes is the added one
    if (resP[0] !== origP[0]) {
      return { ...base, addPhoneme: resP[0], addPosition: "beginning" };
    }
    // Added at end
    return { ...base, addPhoneme: resP[resP.length - 1], addPosition: "end" };
  }

  if (raw.operation === "deletion" && origP.length === resP.length + 1) {
    // The extra phoneme in originalPhonemes is the deleted one
    if (origP[0] !== resP[0]) {
      return { ...base, deletePhoneme: origP[0], deletePosition: "beginning" };
    }
    if (origP[origP.length - 1] !== resP[resP.length - 1]) {
      return { ...base, deletePhoneme: origP[origP.length - 1], deletePosition: "end" };
    }
    // Middle deletion — find where they diverge
    for (let i = 0; i < origP.length; i++) {
      if (i >= resP.length || origP[i] !== resP[i]) {
        return { ...base, deletePhoneme: origP[i], deletePosition: positionLabel(i, origP.length) };
      }
    }
    return { ...base, deletePhoneme: origP[0], deletePosition: "beginning" };
  }

  // Fallback — array lengths don't match expected pattern.
  // Return base with minimal defaults so the UI doesn't crash.
  console.warn(`[SoundSwap] Could not derive operation fields for ${raw.id} (${raw.operation}): ` +
    `origP.length=${origP.length}, resP.length=${resP.length}`);
  if (raw.operation === "substitution") {
    return { ...base, oldPhoneme: origP[0] ?? "/?/", newPhoneme: resP[0] ?? "/?/", substitutePosition: "beginning" };
  }
  if (raw.operation === "addition") {
    return { ...base, addPhoneme: "/?/", addPosition: "beginning" };
  }
  return { ...base, deletePhoneme: origP[0] ?? "/?/", deletePosition: "beginning" };
}

// ============================================================================
// Generator
// ============================================================================

/**
 * Generate Sound Swap data using Gemini AI
 *
 * Creates phoneme manipulation challenges (addition, deletion, substitution)
 * that progress through the three operation types. This is the most advanced
 * phonological awareness skill and a direct predictor of reading success.
 *
 * @param topic - Theme for the word set (e.g., "Animals", "Food", "At the Park")
 * @param gradeLevel - Grade level ('K', '1', or '2') determines vocabulary complexity
 * @param config - Optional configuration overrides (challengeCount, operations, targetEvalMode)
 * @returns SoundSwapData with grade-appropriate phoneme manipulation challenges
 */
export const generateSoundSwap = async (
  topic: string,
  gradeLevel: string = "K",
  config?: Partial<{
    challengeCount: number;
    operations: string[];
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode: string;
  }>
): Promise<SoundSwapData> => {
  // ── Eval mode resolution ────────────────────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'sound-swap',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('SoundSwap', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(soundSwapSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'operation',
      })
    : soundSwapSchema;

  const gradeLevelKey = ["K", "1", "2"].includes(gradeLevel.toUpperCase())
    ? gradeLevel.toUpperCase()
    : "K";

  const challengeCount = config?.challengeCount ?? 9;

  const gradeGuidelines: Record<string, string> = {
    K: `
KINDERGARTEN GUIDELINES:
- Use simple, concrete CVC words kids know (cat, hat, sun, run, pig, big, mat, sit)
- Keep words to 3-4 letters maximum
- Addition: add a single consonant to CVC to make CCVC or CVCC (e.g., "at" + /k/ = "cat")
- Deletion: remove one consonant from CVC to leave a real word (e.g., "cat" - /k/ = "at")
- Substitution: swap beginning or ending sound in CVC words (e.g., "cat" → "bat" by changing first sound)
- Use only common, well-known words that kindergarteners encounter daily
- Phonemes should be simple single consonants and short vowels
`,
    "1": `
GRADE 1 GUIDELINES:
- Use CVC and CVCC words with common phoneme patterns
- Words can be up to 5 letters
- Addition: add consonants or blends (e.g., "lip" → "slip" by adding /s/ at beginning)
- Deletion: remove consonants from blends or clusters (e.g., "stop" → "top" by removing /s/)
- Substitution: swap beginning, middle, or ending sounds (e.g., "hit" → "sit" by changing first sound)
- Include some words with blends and digraphs
- All result words must be real, common English words
`,
    "2": `
GRADE 2 GUIDELINES:
- Use CVC, CVCC, CCVC, and some multisyllabic words
- Words can be up to 6 letters
- Addition: add phonemes to create blends or clusters (e.g., "rain" → "train")
- Deletion: remove phonemes from blends (e.g., "cream" → "ream", "blend" → "bend")
- Substitution: swap phonemes in any position including medial vowels (e.g., "bit" → "bat" by changing middle vowel)
- Include r-controlled vowels and common digraphs in some challenges
- All result words must be real English words kids would recognize
`,
  };

  // ── Build prompt ────────────────────────────────────────────────────
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const generationPrompt = `Create a phoneme manipulation (Sound Swap) activity for the topic: "${topic}".

TARGET GRADE LEVEL: ${gradeLevelKey}

${gradeGuidelines[gradeLevelKey] || gradeGuidelines["K"]}

Generate exactly ${challengeCount} challenges.

${challengeTypeSection}

PHONEME NOTATION RULES:
- Use IPA-style phoneme notation wrapped in forward slashes: /k/, /æ/, /t/, /s/, /b/, /ɪ/, /ʌ/, /ɛ/, /ɑ/, /ʊ/
- Use /r/ for the R sound, NOT /ɹ/ or /ɾ/
- Each phoneme in originalPhonemes and resultPhonemes must be a single sound in slashes
- Example: "cat" = ["/k/", "/æ/", "/t/"], "bat" = ["/b/", "/æ/", "/t/"]
- Digraphs like "sh" are ONE phoneme: /ʃ/. "ch" = /tʃ/. "th" = /θ/ or /ð/

PHONEME ARRAY RULES (CRITICAL):
- originalPhonemes must exactly represent the sounds in originalWord
- resultPhonemes must exactly represent the sounds in resultWord
- For ADDITION: resultPhonemes has exactly ONE more phoneme than originalPhonemes
- For DELETION: originalPhonemes has exactly ONE more phoneme than resultPhonemes
- For SUBSTITUTION: both arrays have the SAME length, differing at exactly ONE position

CURATED WORD PAIRS (prefer these — both words are guaranteed real English words):
Addition examples: ${VALID_ADDITION_PAIRS.slice(0, 20).join(', ')}
Deletion examples: ${VALID_DELETION_PAIRS.slice(0, 20).join(', ')}
You may create NEW pairs beyond this list, but BOTH originalWord and resultWord MUST be real English words that a K-2 student would recognize. "un", "ig", "ap", "og" are NOT real words — never use them.

CRITICAL RULES:
- EVERY result word must be a REAL English word (no nonsense words like "un", "ig", "ap", "og"!)
- EVERY original word must be a REAL English word (no nonsense words!)
- Image descriptions should be brief (3-6 words) and kid-friendly
- IDs should be sequential: "c1", "c2", "c3", etc.
- Relate words to the topic "${topic}" when possible, but prioritize valid transformations
- Double-check that originalPhonemes and resultPhonemes are accurate for both words
${!evalConstraint ? '- Order challenges: addition first, then deletion, then substitution (easiest → hardest).' : ''}

Now generate the activity for "${topic}" at grade level ${gradeLevelKey}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction:
          "You are an expert K-2 reading specialist who designs phoneme manipulation activities. " +
          "You understand phonemic awareness deeply — addition, deletion, and substitution of individual phonemes. " +
          "You always use proper IPA-style phoneme notation with slashes (e.g., /k/, /æ/, /t/). " +
          "You only produce challenges where both the original and result words are REAL English words. " +
          "You choose concrete, picturable words that young learners know. " +
          "You never reveal answers in labels or descriptions. " +
          "You provide ONLY the word pairs, phoneme arrays, operation type, and image descriptions. " +
          "You do NOT provide operation-specific fields like oldPhoneme, newPhoneme, etc.",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text);

    // ── Validation and defaults ───────────────────────────────────────

    // Ensure title
    if (!result.title || typeof result.title !== "string") {
      result.title = `Sound Swap: ${topic}`;
    }

    // Ensure challenges array
    if (!Array.isArray(result.challenges)) {
      result.challenges = [];
    }

    // Map raw challenges → full SoundSwapChallenge by deriving operation fields
    let rejectedCount = 0;
    const challenges: SoundSwapChallenge[] = result.challenges
      .map((ch: Record<string, unknown>, idx: number) => {
        const originalWord = ((ch.originalWord as string) || "").toLowerCase().trim();
        const resultWord = ((ch.resultWord as string) || "").toLowerCase().trim();

        // Reject challenges where either word is not a real English word
        if (!originalWord || !resultWord || !COMMON_WORDS.has(originalWord) || !COMMON_WORDS.has(resultWord)) {
          console.warn(`[SoundSwap] Rejected c${idx + 1}: "${originalWord}" → "${resultWord}" (not in COMMON_WORDS)`);
          rejectedCount++;
          return null;
        }

        const raw: RawChallenge = {
          id: (ch.id as string) || `c${idx + 1}`,
          operation: ch.operation as RawChallenge["operation"],
          originalWord: (ch.originalWord as string) || "",
          originalPhonemes: normalizePhonemes(Array.isArray(ch.originalPhonemes) ? ch.originalPhonemes as string[] : []),
          originalImage: (ch.originalImage as string) || (ch.originalWord as string) || "",
          resultWord: (ch.resultWord as string) || "",
          resultPhonemes: normalizePhonemes(Array.isArray(ch.resultPhonemes) ? ch.resultPhonemes as string[] : []),
          resultImage: (ch.resultImage as string) || (ch.resultWord as string) || "",
        };

        return deriveOperationFields(raw);
      })
      .filter((ch: SoundSwapChallenge | null): ch is SoundSwapChallenge => ch !== null);

    if (rejectedCount > 0) {
      console.warn(`[SoundSwap] Rejected ${rejectedCount} challenge(s) with non-real words`);
    }

    const finalData: SoundSwapData = {
      title: result.title,
      gradeLevel: gradeLevelKey,
      challenges,
    };

    console.log("Sound Swap Generated:", {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      challengeCount: finalData.challenges.length,
      operations: finalData.challenges.map((c) => c.operation),
    });

    return finalData;
  } catch (error) {
    console.error("Error generating sound swap:", error);
    throw error;
  }
};
