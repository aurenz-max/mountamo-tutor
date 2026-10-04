/**
 * Hand-written model texts for genre-explorer's levers (lever plan 2026-10-03 R2), like `rhymeModels.ts`. One or two
 * short texts per kind, each with one feature a child can find in its words: a base-verb predicate completing "Does
 * this one ___?" and the evidence words (underlined on a card). The evidence is also the clue that tells the kind from
 * its sibling. No text names a kind (`namesAGenre`); every text can be read aloud (`isReadableAloud`).
 */
import type { GenreId } from './genreExplorerScript';

export interface GenreModel { kind: GenreId; text: string; predicate: string; evidence: string }
const m = (kind: GenreId, text: string, predicate: string, evidence: string): GenreModel => ({ kind, text, predicate, evidence });

export const GENRE_MODELS: GenreModel[] = [
  m('fable', 'A greedy dog saw his own reflection in a pond and snapped at it. His bone fell in and sank. Wanting more can leave you with less.',
    'end by telling you what to learn', 'Wanting more can leave you with less'),
  m('fable', 'A slow snail kept crawling while a quick hare napped under a tree. The snail reached the hilltop first. Steady work wins.',
    'end by telling you what to learn', 'Steady work wins'),
  m('folktale', 'Long ago, a poor woodcutter shared his last bread with an old stranger. The next morning, his empty basket was full of gold.',
    'begin with long ago', 'Long ago'),
  m('myth', 'The sky goddess wept for her lost son, and her tears became the first rain. That is why rain falls every spring.',
    'explain why something in nature happens', 'That is why rain falls every spring'),
  m('legend', 'Brave Mira swam across the wide lake to warn her village of the flood. People say the lake still sings her name.',
    'say people still talk about a hero', 'People say the lake still sings her name'),
  m('tall-tale', 'Big Bess was so strong she lifted a barn with one hand. When she sneezed, the wind blew the clouds into the next state.',
    'stretch something far bigger than it could be', 'lifted a barn with one hand'),
  m('realistic-fiction', 'Jada left her lunch on the school bus. At recess, her friend Tomas split his sandwich with her.',
    'tell about something that could happen to a kid today', 'split his sandwich with her'),
  m('historical-fiction', 'In 1850, Ruth rode in a covered wagon across the dusty plains. Each night her family cooked beans over a small fire.',
    'happen in a time long past', 'In 1850'),
  m('biography', 'Mae Jemison was born in 1956 in Alabama. She became the first Black woman to travel into space.',
    'tell about a person using she or he', 'She became'),
  m('autobiography', 'I was born in a small town by the sea. When I was nine, I built my first boat with my grandfather.',
    'tell about the writer using I', 'I was born'),
  m('memoir', 'I still remember the summer our kitchen flooded. My mother laughed, handed me a mop, and we danced in the water.',
    'share one thing the writer remembers', 'I still remember'),
  m('informational', 'An octopus has three hearts and blue blood. It can change color in less than a second to hide from enemies.',
    'give numbers', 'three hearts'),
  m('persuasive', 'Our town should build a skate park. It would give kids a safe place to play after school.',
    'try to talk you into something', 'should build'),
  m('poem', 'Raindrops tap upon the pane, soft and quick, a tiny train.',
    'use words that rhyme', 'pane'),
  m('drama', 'MAX, whispering: Is anyone home? LILA: Shh! Hide behind the couch!',
    'show a name before the words someone says', 'LILA:'),
];
