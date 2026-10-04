/**
 * R8 (lever plan 2026-10-03), checked at the class: on the G2-6 literacy families `config.difficulty` reaches the
 * learner only as where the levers start. Each family's table (Phase 6) says what easy, medium and hard put on
 * screen; a starting lever is never offered as a pull, so it is never recorded as help.
 */
import { describe, expect, it } from 'vitest';
import { startingLevers as wordBuilderStarts } from './wordBuilderLevers';

type Tier = 'easy' | 'medium' | 'hard' | undefined;
const FAMILIES: Array<[family: string, starts: (tier: Tier) => string[], table: Record<string, string[]>]> = [
  ['word-builder', wordBuilderStarts, { easy: ['part_slots'], medium: [], hard: [], none: [] }],
];

describe.each(FAMILIES)('%s', (_family, starts, table) => {
  it.each(['easy', 'medium', 'hard', undefined] as Tier[])('tier %s starts with the table\'s levers', tier => {
    expect([...starts(tier)].sort()).toEqual([...table[tier ?? 'none']].sort());
  });
});
