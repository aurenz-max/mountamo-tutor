import { describe, expect, it } from 'vitest';
import {
  HABITAT_ANIMALS, HABITAT_WATCH_NEVER_SAY, animalById, buildAsk, needsForBand, pieceTag, readHabitatBuild, trayFor,
} from './habitatBuild';
import { itemFromChallenge } from './habitatDioramaScript';
import { keepWatchLine } from '../../../service/build-layer/gemini-build-watch';
import { habitatDioramaOracle, passingHabitats } from '../../../service/qa/oracles/habitat-diorama';

const frog = animalById('frog')!;
const ALL = ['food', 'water', 'shelter', 'weather'] as const;

describe('the build check', () => {
  it.each([
    [['pond', 'flies', 'log', 'rain'], undefined, 4],
    [['stream', 'worms', 'tall_grass', 'sun', 'carrots', 'tree'], undefined, 4], // extra pieces do not fail a habitat
    [['pond', 'flies', 'log', 'rain', 'snow'], 'harmful_piece', 4],
    [['pond', 'flies', 'log'], 'one_need_unmet', 3],
    [['pond', 'carrots', 'log', 'rain'], 'other_animals_piece', 3],
    [['sea', 'flies', 'log', 'rain'], 'other_animals_piece', 3],
    [['pond', 'tree'], 'several_needs_unmet', 1],
    [[], 'several_needs_unmet', 0],
  ] as const)('frog %j -> %s', (placed, miss, met) => {
    const read = readHabitatBuild(frog, ALL, placed);
    expect(read.miss).toBe(miss);
    expect(read.needsMet).toBe(met);
  });

  it('the same pieces pass for one animal and fail for another', () => {
    expect(readHabitatBuild(animalById('penguin')!, ALL, ['sea', 'fish', 'ice', 'snow']).miss).toBeUndefined();
    expect(readHabitatBuild(frog, ALL, ['sea', 'fish', 'ice', 'snow']).miss).toBe('harmful_piece');
    expect(readHabitatBuild(animalById('penguin')!, ALL, ['sea', 'fish', 'ice', 'sun']).miss).toBe('harmful_piece');
  });

  it('K-2 asks no weather; the tag lever says what a piece gives this animal', () => {
    expect(needsForBand('K-2')).toEqual(['food', 'water', 'shelter']);
    expect(readHabitatBuild(frog, needsForBand('K-2'), ['pond', 'flies', 'log']).miss).toBeUndefined();
    expect([pieceTag(frog, 'pond'), pieceTag(frog, 'carrots'), pieceTag(frog, 'snow'), pieceTag(animalById('owl')!, 'mice')])
      .toEqual(['water', 'not for a frog', 'bad for a frog', 'food']);
  });

  it('the ask names the animal, never a need; the easier ask names its two', () => {
    expect(buildAsk(frog, ALL)).toBe('Build a habitat where a frog can live. Give it everything it needs.');
    expect(buildAsk(animalById('owl')!, ALL)).toMatch(/^Build a habitat where an owl/);
    expect(buildAsk(frog, ['food', 'water'], true)).toBe('Make a place where a frog can find food and water.');
  });
});

describe('every animal, band and seed is askable, open and leak-free', () => {
  for (const animal of HABITAT_ANIMALS) for (const band of ['K-2', '3-5'] as const) {
    it(`${animal.id} ${band}`, () => {
      const needs = needsForBand(band);
      for (let s = 0; s < 20; s++) {
        const id = `build-${s}-${animal.id}`;
        const tray = trayFor(animal, needs, id);
        const challenge = { id, type: 'build_habitat' as const, prompt: '', explanation: '', targetAnimal: animal.id, needs, trayPieces: tray };
        expect(itemFromChallenge(challenge, { organisms: [], relationships: [] })).not.toBeNull();
        expect(passingHabitats(animal.id, needs, tray, 2).length).toBe(2);
        const oracle = habitatDioramaOracle.verify({ gradeBand: band, challenges: [challenge] },
          { componentId: 'habitat-diorama', evalMode: 'build_habitat', topic: 'habitats', gradeLevel: band });
        expect(oracle.violations).toEqual([]);
      }
    });
  }
});

it('the live line never names a need or how the animal would fare', () => {
  const keep = (line: string) => keepWatchLine(line, 'allowed', HABITAT_WATCH_NEVER_SAY);
  expect(keep('Ooh, a sparkly pond is sitting right beside the frog!')).not.toBe('');
  expect(keep('A log and some flies are gathering around the frog!')).not.toBe('');
  expect(keep('The frog has water and food now!')).toBe('');
  expect(keep('Brr, snowflakes make it so cold for the frog!')).toBe('');
  expect(keep('The frog has a cozy place to hide!')).toBe('');
  expect(keep('The frog still needs a place to rest')).toBe('');
});

it('the oracle catches a closed tray, a leaking ask, a repeat and a band slip', () => {
  const v = (challenges: unknown[], gradeBand = '3-5') => habitatDioramaOracle.verify({ gradeBand, challenges },
    { componentId: 'habitat-diorama', evalMode: 'build_habitat', topic: 'habitats', gradeLevel: gradeBand }).violations.map(x => x.check);
  const base = { id: 'b', type: 'build_habitat', prompt: '', explanation: '', targetAnimal: 'owl', needs: ['food', 'water', 'shelter', 'weather'] };
  expect(v([{ ...base, trayPieces: ['pond', 'mice', 'tree', 'rain', 'carrots'] }])).toEqual([]);
  // One habitat only, and every piece serves the owl: closed and no choice.
  expect(v([{ ...base, trayPieces: ['pond', 'mice', 'tree', 'rain'] }])).toContain('answer-key-desync');
  expect(v([{ ...base, trayPieces: ['sea', 'mice', 'tree', 'rain'] }])).toContain('answer-key-desync');
  expect(v([{ ...base, trayPieces: ['pond', 'mice', 'tree', 'rain', 'carrots'] }, { ...base, id: 'c', trayPieces: ['pond', 'mice', 'tree', 'rain', 'carrots'] }]))
    .toContain('clustering');
  expect(v([{ ...base, trayPieces: ['pond', 'mice', 'tree', 'rain', 'carrots'] }], 'K-2')).toContain('scope');
});
