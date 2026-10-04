/**
 * R8 (lever plan 2026-10-03), checked at the class: on the G2-6 literacy families `config.difficulty` reaches the
 * learner only as where the levers start. Each family's table (Phase 6) says what easy, medium and hard put on
 * screen; a starting lever is never offered as a pull, so it is never recorded as help.
 */
import { describe, expect, it } from 'vitest';
import { startingLevers as wordBuilderStarts } from './wordBuilderLevers';
import { startingLevers as sentenceStarts } from './sentenceAnalyzerLevers';
import { startingLevers as genreStarts } from './genreExplorerLevers';
import type { GenreExplorerItem } from './genreExplorerScript';

const genreAt = (action: GenreExplorerItem['action']) => (tier: Tier) => genreStarts(tier, { action } as GenreExplorerItem);

type Tier = 'easy' | 'medium' | 'hard' | undefined;
const FAMILIES: Array<[family: string, starts: (tier: Tier) => string[], table: Record<string, string[]>]> = [
  ['word-builder', wordBuilderStarts, { easy: ['part_slots'], medium: [], hard: [], none: [] }],
  ['sentence-analyzer', sentenceStarts, { easy: ['wall_examples'], medium: [], hard: [], none: [] }],
  ['genre-explorer check-feature', genreAt('check-feature'), { easy: ['sentence_rows'], medium: [], hard: [], none: [] }],
  ['genre-explorer pick-excerpt', genreAt('pick-excerpt'), { easy: ['two_checks'], medium: [], hard: [], none: [] }],
  ['genre-explorer name-genre', genreAt('name-genre'), { easy: ['read_glosses'], medium: [], hard: [], none: [] }],
];

describe.each(FAMILIES)('%s', (_family, starts, table) => {
  it.each(['easy', 'medium', 'hard', undefined] as Tier[])('tier %s starts with the table\'s levers', tier => {
    expect([...starts(tier)].sort()).toEqual([...table[tier ?? 'none']].sort());
  });
});
