/**
 * Familiar K-1 words split into their spoken parts, for WRITING syllable-build asks and banks (`syllableBuild.ts`,
 * syllable-clapper `build_parts`). Every card is one clap. The list never JUDGES a build: any real word the learner
 * makes from the cards with the asked number of cards passes (the shared word judge decides "is it real?"), including
 * words that are not here, such as "butter" from but + ter.
 *
 * Kept out: words whose count varies by speaker (`DIALECT_VARIABLE_WORDS`), and cards that are a consonant + silent e
 * ("me", "ne"), which could join into a one-beat word ("time") from two cards. A vitest pins both.
 */
export const SYLLABLE_WORDS: Readonly<Record<string, readonly string[]>> = {
  // Two parts
  popcorn: ['pop', 'corn'], rabbit: ['rab', 'bit'], pencil: ['pen', 'cil'], napkin: ['nap', 'kin'], cupcake: ['cup', 'cake'],
  sunset: ['sun', 'set'], picnic: ['pic', 'nic'], kitten: ['kit', 'ten'], basket: ['bas', 'ket'], muffin: ['muf', 'fin'],
  rocket: ['rock', 'et'], puppet: ['pup', 'pet'], magnet: ['mag', 'net'], hotdog: ['hot', 'dog'], bathtub: ['bath', 'tub'],
  mitten: ['mit', 'ten'], pumpkin: ['pump', 'kin'], tiger: ['ti', 'ger'], monkey: ['mon', 'key'], window: ['win', 'dow'],
  panda: ['pan', 'da'], lemon: ['lem', 'on'], wagon: ['wag', 'on'], robot: ['ro', 'bot'],
  baby: ['ba', 'by'], candy: ['can', 'dy'], cactus: ['cac', 'tus'], rainbow: ['rain', 'bow'], snowman: ['snow', 'man'],
  sandbox: ['sand', 'box'], doctor: ['doc', 'tor'],
  // Three parts
  butterfly: ['but', 'ter', 'fly'], banana: ['ba', 'na', 'na'], dinosaur: ['di', 'no', 'saur'], elephant: ['el', 'e', 'phant'],
  umbrella: ['um', 'brel', 'la'], kangaroo: ['kan', 'ga', 'roo'], octopus: ['oc', 'to', 'pus'], potato: ['po', 'ta', 'to'],
  tomato: ['to', 'ma', 'to'], animal: ['an', 'i', 'mal'], lollipop: ['lol', 'li', 'pop'], hamburger: ['ham', 'bur', 'ger'],
  pajamas: ['pa', 'ja', 'mas'], gorilla: ['go', 'ril', 'la'], computer: ['com', 'pu', 'ter'], volcano: ['vol', 'ca', 'no'],
  basketball: ['bas', 'ket', 'ball'], tornado: ['tor', 'na', 'do'], buffalo: ['buf', 'fa', 'lo'],
  // Four parts (grade 1)
  watermelon: ['wa', 'ter', 'mel', 'on'], alligator: ['al', 'li', 'ga', 'tor'], helicopter: ['hel', 'i', 'cop', 'ter'],
  caterpillar: ['cat', 'er', 'pil', 'lar'], macaroni: ['mac', 'a', 'ro', 'ni'], avocado: ['av', 'o', 'ca', 'do'],
  kindergarten: ['kin', 'der', 'gar', 'ten'], calculator: ['cal', 'cu', 'la', 'tor'],
};

/** The seed words with this many parts. */
export const syllableWordsWith = (parts: number): string[] =>
  Object.keys(SYLLABLE_WORDS).filter(w => SYLLABLE_WORDS[w].length === parts);
