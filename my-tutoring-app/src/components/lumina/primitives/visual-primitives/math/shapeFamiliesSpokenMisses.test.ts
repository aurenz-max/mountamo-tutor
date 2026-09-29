/**
 * Spoken misses of the three all-spoken shape and sorting families (handoff 20 Part B): each item's ids in
 * precedence order, and no listed example is an accepted answer, on hand-built items and every saved payload.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { buildThreeDShapeItems, type ThreeDShapeChallengeLike } from './threeDShapeExplorerScript';
import { threeDShapeAssignment, threeDShapeSpokenMisses } from './threeDShapeExplorerWorkspace';
import { itemsFromChallenges as shapeItems } from './shapeSorterScript';
import { shapeSorterSpokenMisses, workspaceAssignment as shapeAssignment, type ShapeSorterChallengeLike } from './shapeSorterDomain';
import { itemsFromChallenges as sortingItems } from './sortingStationScript';
import { sortingStationSpokenMisses, workspaceAssignment as sortingAssignment } from './sortingStationWorkspace';

const PAYLOADS = join(process.cwd(), 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads');
const payload = (file: string) => JSON.parse(readFileSync(join(PAYLOADS, `${file}.json`), 'utf-8')).data;
const ids = (misses: Array<{ id: string }>) => misses.map(m => m.id);
const OFF = ['one_short', 'one_over', 'short_by_more', 'over_by_more'];

/** The words the key accepts, lower-cased: every `" or "` part of the assignment's expected answer. */
const accepted = (key: string | undefined, extra: string[] = []) =>
  new Set([...(key ?? '').split(/ or /), ...extra].map(s => s.trim().toLowerCase()).filter(Boolean));

describe('threeDShapeSpokenMisses', () => {
  const solid = (c: ThreeDShapeChallengeLike) => buildThreeDShapeItems([c]).items;
  it.each([
    ['identify cube', solid({ id: 'a', type: 'identify-3d', shape3d: 'cube' })[0], ['flat_look_alike', 'similar_solid', 'other_solid']],
    ['identify sphere (no similar solid)', solid({ id: 'a', type: 'identify-3d', shape3d: 'sphere' })[0], ['flat_look_alike', 'other_solid']],
    ['match a can', solid({ id: 'a', type: 'match-to-real-world', matchPairs: [{ realWorldObject: 'can', shape3d: 'cylinder' }] })[0],
      ['said_object', 'flat_look_alike', 'similar_solid', 'other_solid']],
    ['riddle cone', solid({ id: 'a', type: 'shape-riddle', shape3d: 'cone', clues: ['I have one flat circular face.', 'I have one point.', 'I can roll, but I do not stack.'] })[0],
      ['similar_solid', 'flat_look_alike', 'other_solid']],
    ['classify a cube', solid({ id: 'a', type: '2d-vs-3d', mixedShapes: [{ name: 'cube', is3d: true }] })[0], ['opposite_dimension', 'said_shape_name']],
    ...solid({ id: 'a', type: 'faces-and-properties', displayShape: 'cylinder', propertyQuestions: [
      { propertyKey: 'flatFaces' }, { propertyKey: 'curvedSurfaces' }, { propertyKey: 'faceShape' }, { propertyKey: 'canStack' }] })
      .map((item, i) => [`cylinder property ${i}`, item, [
        ['said_other_surface', 'said_all_surfaces', 'one_short', 'one_over', 'over_by_more'],
        ['said_other_surface', 'said_all_surfaces', 'one_over', 'over_by_more'],
        ['said_solid', 'side_view_shape', 'other_flat_shape'],
        ['opposite_verdict']][i]] as const),
  ] as const)('%s', (_name, item, expected) => {
    expect(ids(threeDShapeSpokenMisses(item))).toEqual(expected);
  });

  it.each(['identify_3d', '2d_vs_3d', 'match_real_world', 'faces_properties', 'shape_riddle'])('%s payload: no example is accepted', mode => {
    for (const item of buildThreeDShapeItems(payload(`3d-shape-explorer.${mode}`).challenges).items) {
      const ok = accepted(item.answer, item.spokenAlternates);
      const { misses } = threeDShapeAssignment(item);
      expect(misses?.length, item.id).toBeGreaterThan(0);
      for (const m of misses ?? []) for (const e of m.examples ?? []) expect(ok.has(e.toLowerCase()), `${item.id} ${m.id} "${e}"`).toBe(false);
    }
  });
});

describe('shapeSorterSpokenMisses', () => {
  const one = (c: ShapeSorterChallengeLike) => shapeItems([c], { isPreReader: false })[0];
  it.each([
    ['identify circle', one({ id: 'a', type: 'identify', shapes: [{ shape: 'circle', color: 'red', size: 'large', rotation: 0 }] } as ShapeSorterChallengeLike),
      ['near_name', 'other_shape_name']],
    ['count a triangle', one({ id: 'a', type: 'count', shapes: [{ shape: 'triangle', color: 'red', size: 'large', rotation: 0 }] } as ShapeSorterChallengeLike),
      ['said_shape_name', ...OFF]],
  ] as const)('%s', (_name, item, expected) => {
    expect(item).toBeDefined();
    expect(ids(shapeSorterSpokenMisses(item!))).toEqual(expected);
  });

  it.each(['identify', 'find_real_object', 'count', 'sort'])('%s payload: ids and no accepted example', mode => {
    const items = shapeItems(payload(`shape-sorter.${mode}`).challenges, { isPreReader: false });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const { misses, expectedAnswer } = shapeAssignment(item);
      const ok = accepted(expectedAnswer);
      if (mode === 'find_real_object') expect(misses?.[0].id).toBe('said_object');
      if (mode === 'sort') expect(ids(misses ?? [])).toEqual(['said_shape_name', 'other_group']);
      for (const m of misses ?? []) for (const e of m.examples ?? []) expect(ok.has(e.toLowerCase()), `${item.id} ${m.id} "${e}"`).toBe(false);
    }
  });
});

describe('sortingStationSpokenMisses', () => {
  const kinds: Record<string, string[]> = {
    sort: ['said_object', 'other_group'], pick_rule: ['other_rule'], odd_one: ['belonging_card', 'said_all_belong'],
    count_group: OFF, both_criteria: ['opposite_verdict', 'one_criterion_only'],
  };
  it.each(['sort_one', 'sort_variety', 'sort_attribute', 'odd_one_out', 'count_compare', 'tally_record', 'two_attributes'])(
    '%s payload: ids by item kind and no accepted example', mode => {
      const data = payload(`sorting-station.${mode}`);
      const items = sortingItems(data.challenges, { tier: data.supportTier, isPreReader: (data.gradeBand ?? 'K') === 'K' });
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        const found = ids(sortingStationSpokenMisses(item));
        if (item.kind === 'compare') {
          expect(found).toEqual(item.answer === 'the same' ? ['other_group', 'bare_more'] : ['other_group', 'said_same', 'bare_more']);
        } else if (item.kind === 'count_group') {
          expect(found).toEqual(OFF.filter(id => item.answerValue! > 1 || (id !== 'one_short' && id !== 'short_by_more'))
            .filter(id => item.answerValue! > 2 || id !== 'short_by_more'));
        } else expect(found, item.id).toEqual(kinds[item.kind]);
        for (const m of sortingAssignment(item).misses ?? []) {
          for (const e of m.examples ?? []) expect(e.toLowerCase(), `${item.id} ${m.id}`).not.toBe(item.answer.toLowerCase());
        }
      }
    });
});
