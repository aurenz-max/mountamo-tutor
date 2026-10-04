/**
 * Hand-labelled sentences and wall examples for sentence-analyzer's levers (lever plan 2026-10-03 R2). The keys are
 * hand-checked because the generator's are not reliable enough to model from (table D1-D3).
 *
 * Notation: `word:POS:ROLE`, `|` between the complete subject and the predicate. POS: N Noun, V Verb, A Adjective,
 * Av Adverb, Pr Pronoun, P Preposition, C Conjunction, D Determiner, I Interjection. Role: S Subject, P Predicate,
 * M Modifier, DO Direct Object, IO Indirect Object, OP Object of Preposition. A preposition's job is Modifier (its
 * phrase adds detail), as the generator keys it.
 */
import type { PosLabel, RoleLabel, SentenceTypeLabel } from './sentenceAnalyzerScript';

export interface PoolWord { text: string; pos: PosLabel; role: RoleLabel }
export interface PoolSentence { sentence: string; words: PoolWord[]; subjectEnd: number | null; kind: SentenceTypeLabel }

const POS: Record<string, PosLabel> = { N: 'Noun', V: 'Verb', A: 'Adjective', Av: 'Adverb', Pr: 'Pronoun', P: 'Preposition',
  C: 'Conjunction', D: 'Determiner', I: 'Interjection' };
const ROLE: Record<string, RoleLabel> = { S: 'Subject', P: 'Predicate', M: 'Modifier', DO: 'Direct Object',
  IO: 'Indirect Object', OP: 'Object of Preposition' };

/** "My:D:M little:A:M brother:N:S | sings:V:P loudly:Av:M" + end mark → a keyed sentence. */
const s = (spec: string, end: '.' | '?' | '!' = '.', kind?: SentenceTypeLabel): PoolSentence => {
  const words: PoolWord[] = [];
  let subjectEnd: number | null = null;
  for (const token of spec.split(' ')) {
    if (token === '|') { subjectEnd = words.length - 1; continue; }
    const [text, pos, role] = token.split(':');
    words.push({ text, pos: POS[pos], role: ROLE[role] });
  }
  words[words.length - 1] = { ...words[words.length - 1], text: words[words.length - 1].text + end };
  const first = words[0];
  words[0] = { ...first, text: first.text[0].toUpperCase() + first.text.slice(1) };
  return { sentence: words.map(w => w.text).join(' '), words, subjectEnd,
    kind: kind ?? (end === '?' ? 'Interrogative' : end === '!' ? 'Exclamatory' : 'Declarative') };
};

/** Model cards: every word labelled. Subjects open with a small word and a describing word where they can. */
export const MODEL_SENTENCES: PoolSentence[] = [
  s('my:D:M little:A:M brother:N:S | sings:V:P'),
  s('a:D:M tiny:A:M frog:N:S | jumped:V:P'),
  s('that:D:M yellow:A:M bus:N:S | stopped:V:P'),
  s('my:D:M little:A:M brother:N:S | sings:V:P loudly:Av:M'),
  s('a:D:M tiny:A:M frog:N:S | jumped:V:P happily:Av:M'),
  s('we:Pr:S | watched:V:P the:D:M bright:A:M moon:N:DO carefully:Av:M'),
  s('this:D:M brave:A:M puppy:N:S | chased:V:P them:Pr:DO quickly:Av:M'),
  s('she:Pr:S | quickly:Av:M painted:V:P a:D:M purple:A:M kite:N:DO'),
  s('they:Pr:S | found:V:P a:D:M shiny:A:M shell:N:DO nearby:Av:M'),
  s('this:D:M brave:A:M puppy:N:S | chased:V:P the:D:M red:A:M ball:N:DO'),
  s('a:D:M tiny:A:M frog:N:S | chased:V:P a:D:M fly:N:DO into:P:M the:D:M pond:N:OP'),
  s('our:D:M kind:A:M teacher:N:S | hung:V:P a:D:M map:N:DO on:P:M the:D:M wall:N:OP'),
  s('those:D:M small:A:M ducks:N:S | swim:V:P slowly:Av:M near:P:M us:Pr:OP'),
  s('our:D:M kind:A:M teacher:N:S | slowly:Av:M read:V:P us:Pr:IO a:D:M funny:A:M story:N:DO after:P:M lunch:N:OP'),
  s('the:D:M old:A:M farmer:N:S | gave:V:P the:D:M horse:N:IO a:D:M shiny:A:M apple:N:DO near:P:M the:D:M barn:N:OP'),
  s('her:D:M quiet:A:M uncle:N:S | gently:Av:M handed:V:P me:Pr:IO a:D:M warm:A:M blanket:N:DO'),
];

/** Practice items: short, one structural step less than a session sentence. */
export const PRACTICE_POS: PoolSentence[] = [
  s('tall:A:M trees:N:S | sway:V:P'), s('owls:N:S | hoot:V:P softly:Av:M'), s('she:Pr:S | runs:V:P fast:Av:M'),
  s('my:D:M shoes:N:S | squeak:V:P'), s('a:D:M red:A:M kite:N:S | flew:V:P'), s('he:Pr:S | laughed:V:P loudly:Av:M'),
  s('frogs:N:S | leap:V:P high:Av:M'), s('wet:A:M socks:N:S | drip:V:P'), s('they:Pr:S | clapped:V:P twice:Av:M'),
];
export const PRACTICE_ROLE: PoolSentence[] = [
  s('owls:N:S | catch:V:P mice:N:DO'), s('kids:N:S | fly:V:P kites:N:DO'), s('bakers:N:S | make:V:P bread:N:DO'),
  s('cows:N:S | eat:V:P grass:N:DO'), s('owls:N:S | hoot:V:P softly:Av:M'), s('wet:A:M socks:N:S | drip:V:P'),
  s('frogs:N:S | leap:V:P high:Av:M'), s('girls:N:S | kick:V:P balls:N:DO'),
];
/** Two-word complete subject (a small word and a naming word), then the predicate. */
export const PRACTICE_SIDE: PoolSentence[] = [
  s('a:D:M bell:N:S | rang:V:P loudly:Av:M'), s('the:D:M ship:N:S | sailed:V:P away:Av:M'),
  s('my:D:M uncle:N:S | drives:V:P a:D:M truck:N:DO'), s('this:D:M lamp:N:S | glows:V:P softly:Av:M'),
  s('her:D:M kitten:N:S | naps:V:P often:Av:M'), s('that:D:M train:N:S | whistled:V:P twice:Av:M'),
];
/** One per kind in its plainest form: a question opens with a question word or helper, a command with its verb. */
export const PRACTICE_KIND: PoolSentence[] = [
  s('owls:N:S | hunt:V:P at:P:M night:N:OP'), s('is:V:P the:D:M bus:N:S late:A:M', '?'),
  s('shut:V:P the:D:M gate:N:DO', '.', 'Imperative'), s('what:D:M a:D:M huge:A:M wave:N:S', '!'),
  s('seals:N:S | swim:V:P fast:Av:M'), s('can:V:P you:Pr:S whistle:V:P', '?'),
  s('wash:V:P your:D:M hands:N:DO', '.', 'Imperative'), s('how:Av:M fast:Av:M you:Pr:S ran:V:P', '!'),
];

/** Two example phrases per label; `word` is the underlined word. Fixed per label, never chosen from the item. */
export interface WallExample { phrase: string; word: string }
const ex = (phrase: string, word: string): WallExample => ({ phrase, word });
export const WALL_EXAMPLES: Record<string, WallExample[]> = {
  Noun: [ex('a big barn', 'barn'), ex('the wide river', 'river'), ex('my pencil', 'pencil'), ex('one turtle', 'turtle')],
  Verb: [ex('birds fly', 'fly'), ex('we jumped', 'jumped'), ex('owls hoot', 'hoot'), ex('Pat sneezed', 'sneezed')],
  Adjective: [ex('a tall tree', 'tall'), ex('a soft pillow', 'soft'), ex('a muddy boot', 'muddy'), ex('a round rug', 'round')],
  Adverb: [ex('ran fast', 'fast'), ex('spoke quietly', 'quietly'), ex('waved twice', 'twice'), ex('hummed softly', 'softly')],
  Pronoun: [ex('they waved', 'they'), ex('it fell', 'it'), ex('we hid', 'we'), ex('you won', 'you')],
  Preposition: [ex('under the bed', 'under'), ex('over the hill', 'over'), ex('behind a door', 'behind'), ex('inside a box', 'inside')],
  Conjunction: [ex('salt and pepper', 'and'), ex('tiny but tough', 'but'), ex('tea or milk', 'or'), ex('pens and paper', 'and')],
  Determiner: [ex('a cup', 'a'), ex('those shoes', 'those'), ex('this mug', 'this'), ex('an egg', 'an')],
  Interjection: [ex('Wow, look!', 'Wow'), ex('Oops, it broke!', 'Oops'), ex('Ouch, a bee!', 'Ouch')],
  Subject: [ex('Bees buzz.', 'Bees'), ex('Rain fell.', 'Rain'), ex('Pat sneezed.', 'Pat')],
  Predicate: [ex('Bees buzz.', 'buzz'), ex('Rain fell.', 'fell'), ex('Pat sneezed.', 'sneezed')],
  'Direct Object': [ex('Mia kicked the ball.', 'ball'), ex('Leo baked bread.', 'bread'), ex('Ana hugged a puppy.', 'puppy')],
  'Indirect Object': [ex('Tom gave Sam a book.', 'Sam'), ex('Ana sent Leo a card.', 'Leo')],
  'Object of Preposition': [ex('under the table', 'table'), ex('across the road', 'road'), ex('inside a tent', 'tent')],
  Modifier: [ex('the red kite', 'red'), ex('ran quickly', 'quickly'), ex('a muddy boot', 'muddy')],
  Declarative: [ex('The sun is warm.', '.'), ex('Owls sleep by day.', '.'), ex('Pat has a pet.', '.')],
  Interrogative: [ex('Is it raining?', '?'), ex('Where is my hat?', '?')],
  Imperative: [ex('Close the door.', 'Close'), ex('Wash the cup.', 'Wash'), ex('Sit here.', 'Sit')],
  Exclamatory: [ex('What a huge wave!', '!'), ex('How fast you ran!', '!'), ex('What a mess!', '!')],
};
