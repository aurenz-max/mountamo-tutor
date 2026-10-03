/**
 * diSentenceReadingMenu — the curated sentence menu, pure, so the generator and the runtime levers
 * (`diSentenceReadingLevers.ts`) read one table. Moved out of `gemini-di-sentence-reading.ts` 2026-10-03.
 */

export type ShortVowel = 'a' | 'e' | 'i' | 'o' | 'u';

/** One curated menu entry: everything the tutor and the reward need. */
export interface SentenceMenuEntry {
  /** The printed sentence WITH its terminal punctuation — read exactly. */
  text: string;
  /** Short vowels the decodable content words drill (the scoping key). */
  vowels: ShortVowel[];
  /** Sentences carrying a high proportion of IRREGULAR high-frequency words —
   *  the `sight_phrase_sentence` pool. These cannot be sounded out, so they
   *  exercise whole-word recall rather than blending. */
  sightHeavy?: boolean;
  /** Every CONTENT word is short-vowel CVC decodable — the
   *  `decodable_sentence` pool. Function words from the earliest taught set
   *  (the, a, I, is, in, on, can, has, had, and, to, up) are permitted and
   *  expected: that is exactly how a decodable reader is built, and no English
   *  sentence exists without them. What disqualifies an entry is a CONTENT word
   *  that cannot be blended — "see", "ball", "look", "go". Tagged explicitly
   *  rather than inferred, because it is a pedagogical judgement per sentence. */
  decodable?: boolean;
  /** Proven in the standing-gate-1 bench sitting (2026-07-25). These ten were
   *  judged live — including the two deliberate one-word omissions the pack's
   *  viability rests on — so they lead every fallback ladder. */
  benched?: boolean;
  /** POST-affirmation reward picture only (answer-leak rule: the answer IS the
   *  printed sentence, so nothing pictures it before the read). */
  emoji?: string;
  /** Passive whole-utterance ASR cross-check aliases (near-neighbour reads). */
  extraAliases?: string[];
}

/** Normalized whole-utterance form for the passive ASR cross-check. */
export const spokenForm = (text: string) =>
  text.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();

/**
 * The curated sentence menu. Every content word is short-vowel decodable with
 * single-letter graphemes, or one of the earliest high-frequency sight words
 * (the, a, I, is, in, on, to, see, go, can, we, and, has, had, my, up, down,
 * get, look, at). Vocabulary is deliberately carried from the di-word-reading
 * menu so a miss is attributable to CONNECTED TEXT rather than to a new word —
 * the same control the bench probe used.
 *
 * The ten `benched: true` entries are the exact sentences from the sitting.
 *
 * L4 additions (2026-08-03): seven 7-8 word entries — one per pure short
 * vowel plus two sight-heavy — so the hard tier's [7,8] band has pool support
 * in every eval mode. Before them the menu held only three entries above six
 * words and the hard tier would have saturated at 6 for most scopes. Every
 * added word already appears elsewhere in this menu (the attribution control:
 * a miss traces to CONNECTED TEXT, never to a new word), every entry is
 * inside the benched 3-8 class, and each was checked sentinel-safe like the
 * rest (isSentinelSafe rejects at module load regardless).
 */
export const SENTENCE_MENU: Record<string, SentenceMenuEntry> = {
  // ── benched ten (proven live 2026-07-25) ─────────────────────────
  'cat-sat': { text: 'The cat sat.', vowels: ['a'], benched: true, decodable: true, emoji: '🐱' },
  'see-pig': { text: 'I see a pig.', vowels: ['i'], benched: true, emoji: '🐷', extraAliases: ['i sea a pig'] },
  'red-cup': { text: 'Sam has a red cup.', vowels: ['a', 'e', 'u'], benched: true, decodable: true, emoji: '🥤' },
  'sat-mat': { text: 'Sam sat on the mat.', vowels: ['a'], benched: true, decodable: true, extraAliases: ['sam sat on the matt'] },
  'dog-sun': { text: 'The dog is in the sun.', vowels: ['o', 'u'], benched: true, decodable: true, emoji: '🐶', extraAliases: ['the dog is in the son'] },
  'big-pig': { text: 'I can see the big pig.', vowels: ['i'], benched: true, emoji: '🐷' },
  'hen-pen': { text: 'The red hen ran to the pen.', vowels: ['e', 'a'], benched: true, decodable: true, emoji: '🐔' },
  'get-ball': { text: 'Can the dog get the ball?', vowels: ['o', 'e'], benched: true, emoji: '⚽' },
  'up-down': { text: 'We go up and we go down.', vowels: ['u'], benched: true, sightHeavy: true },
  'red-hat': { text: 'The big pig had a red hat on.', vowels: ['i', 'a', 'e'], benched: true, decodable: true, emoji: '🎩' },

  // ── short a ──────────────────────────────────────────────────────
  'sam-hat': { text: 'Sam has a hat.', vowels: ['a'], decodable: true, emoji: '🎩' },
  'cat-mat': { text: 'The cat sat on a mat.', vowels: ['a'], decodable: true, emoji: '🐱' },
  'rat-ran': { text: 'The rat ran.', vowels: ['a'], decodable: true, emoji: '🐀' },
  'pat-cat': { text: 'Sam can pat the cat.', vowels: ['a'], decodable: true, emoji: '🐱' },
  'man-map': { text: 'The man had a map.', vowels: ['a'], decodable: true, emoji: '🗺️' },
  'cat-nap': { text: 'Can the cat nap?', vowels: ['a'], decodable: true, emoji: '😴' },
  'sam-cat-mat': { text: 'Sam and the cat sat on the mat.', vowels: ['a'], decodable: true, emoji: '🐱' },

  // ── short e ──────────────────────────────────────────────────────
  'red-hen': { text: 'The red hen ran.', vowels: ['e', 'a'], decodable: true, emoji: '🐔' },
  'ben-pen': { text: 'Ben has a red pen.', vowels: ['e'], decodable: true, emoji: '🖊️' },
  'hen-in-pen': { text: 'The hen is in the pen.', vowels: ['e'], decodable: true, emoji: '🐔' },
  'ten-men': { text: 'Ten men sat on the bed.', vowels: ['e', 'a'], decodable: true, emoji: '🛏️' },
  'get-net': { text: 'Get the net.', vowels: ['e'], decodable: true, emoji: '🥅' },
  'ten-red-bed': { text: 'Ten men get in the red bed.', vowels: ['e'], decodable: true, emoji: '🛏️' },

  // ── short i ──────────────────────────────────────────────────────
  'pig-dig': { text: 'The pig can dig.', vowels: ['i'], decodable: true, emoji: '🐷' },
  'sit-big': { text: 'Sit on the big rug.', vowels: ['i', 'u'], decodable: true },
  'dig-pit': { text: 'Did the pig dig a pit?', vowels: ['i'], decodable: true, emoji: '🐷' },
  'pin-big': { text: 'The pin is big.', vowels: ['i'], decodable: true, emoji: '📌' },
  'big-pig-pit': { text: 'The big pig can sit in the pit.', vowels: ['i'], decodable: true, emoji: '🐷' },

  // ── short o ──────────────────────────────────────────────────────
  'dog-hot': { text: 'The dog is hot.', vowels: ['o'], decodable: true, emoji: '🐶' },
  'dog-log': { text: 'The dog sat on a log.', vowels: ['o'], decodable: true, emoji: '🪵' },
  'mom-pot': { text: 'Mom got a pot.', vowels: ['o'], decodable: true, emoji: '🍲' },
  'dog-hop': { text: 'The dog can hop.', vowels: ['o'], decodable: true, emoji: '🐶' },
  'hot-dog-log': { text: 'The hot dog can hop on the log.', vowels: ['o'], decodable: true, emoji: '🪵' },

  // ── short u ──────────────────────────────────────────────────────
  'sun-up': { text: 'The sun is up.', vowels: ['u'], decodable: true, emoji: '☀️' },
  'bug-cup': { text: 'A bug is in the cup.', vowels: ['u'], decodable: true, emoji: '🐛' },
  'pup-run': { text: 'The pup can run.', vowels: ['u'], decodable: true, emoji: '🐕' },
  'gus-cup': { text: 'Gus has a red cup.', vowels: ['u', 'e'], decodable: true, emoji: '🥤' },
  'pup-sun-run': { text: 'The pup can run in the sun.', vowels: ['u'], decodable: true, emoji: '🐕' },

  // ── sight-word heavy: IRREGULAR high-frequency density ────────────
  // The `sight_phrase_sentence` pool. Each carries 2+ words that cannot be
  // sounded out (see, go, you, look, my, like, to, here, me), so the sentence
  // exercises whole-word recall rather than blending. None is `decodable`.
  'see-it': { text: 'I can see it.', vowels: ['i'], sightHeavy: true },
  'we-go': { text: 'We can go up.', vowels: ['u'], sightHeavy: true },
  'look-dog': { text: 'Look at the big dog.', vowels: ['i', 'o'], sightHeavy: true, emoji: '🐶' },
  'you-and-i': { text: 'You and I can go.', vowels: [], sightHeavy: true },
  'my-ball': { text: 'My ball is red.', vowels: ['e'], sightHeavy: true, emoji: '⚽' },
  'look-at-me': { text: 'Look at me!', vowels: [], sightHeavy: true },
  'you-see': { text: 'You can see my dog.', vowels: ['o'], sightHeavy: true, emoji: '🐶' },
  'we-like': { text: 'We like to go up.', vowels: ['u'], sightHeavy: true },
  'go-see': { text: 'We go to see the pig.', vowels: ['i'], sightHeavy: true, emoji: '🐷' },
  'here-it-is': { text: 'Here it is.', vowels: ['i'], sightHeavy: true },
  'you-up-down': { text: 'You and I can go up and down.', vowels: [], sightHeavy: true },
  'like-look-dog': { text: 'We like to look at my big dog.', vowels: ['i', 'o'], sightHeavy: true, emoji: '🐶' },
};

