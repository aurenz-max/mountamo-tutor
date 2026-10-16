/**
 * Reader-fit: orbit-mechanics-lab, re-based on the 2026-10-16 rebuild.
 *
 * Item 15A / S2 (2026-08-07) ruled that K is served here, not floored away: a live K topic-trace selected this
 * primitive. Those rulings still hold, re-stated against the rebuilt lab:
 *   1. The grade rung comes from the canonical grade, never from prose (prose once put a Kindergartener on Grade 3).
 *   2. K and Grade 1 get pick_speed only: a tap on a push picture, the asked outcome shown as a picture.
 *   3. The K-1 answer is no longer the middle picture every time (the triage leak): the asked outcome varies, so the
 *      key moves between pushes, and the push order on screen is shuffled.
 *   4. The catalog keeps a tutoring block for the scripted path, with the pre-reader read-aloud and a never-name-the-
 *      answer directive.
 */
import { describe, it, expect } from 'vitest';
import { orbitMechanicsGradeFromGrade } from './gemini-orbit-mechanics-lab';
import { ASTRONOMY_CATALOG } from '../manifest/catalog/astronomy';
import {
  buildOrbitItems, defaultModes, pushPath, seededRng, tapKey, type SpeedItem,
} from '../../primitives/visual-primitives/astronomy/orbitWorkspace';

describe('orbit-mechanics-lab — reader-fit after the rebuild', () => {
  describe('orbitMechanicsGradeFromGrade — canonical grade, NO floor', () => {
    it('resolves Kindergarten to its own rung', () => {
      for (const g of ['K', 'k', 'kindergarten', 'preschool']) expect(orbitMechanicsGradeFromGrade(g)).toBe('K');
    });
    it('passes every served grade through, and tops out at 5', () => {
      for (const g of ['1', '2', '3', '4', '5']) expect(orbitMechanicsGradeFromGrade(g)).toBe(g);
      expect(orbitMechanicsGradeFromGrade('6')).toBe('5');
      expect(orbitMechanicsGradeFromGrade('12')).toBe('5');
    });
    it('returns null with no canonical grade so the prose fallback stands', () => {
      for (const g of [undefined, '', 'nonsense']) expect(orbitMechanicsGradeFromGrade(g)).toBeNull();
    });
    it('never puts a low grade on the Grade 3 rung or floors K away', () => {
      for (const g of ['K', 'k', 'kindergarten', '1', '2']) expect(orbitMechanicsGradeFromGrade(g)).not.toBe('3');
      expect(orbitMechanicsGradeFromGrade('K')).not.toBe('2');
    });
  });

  describe('modes by grade', () => {
    it('K and Grade 1 ask pick_speed only; the ladder opens from Grade 2', () => {
      expect(defaultModes('K')).toEqual(['pick_speed']);
      expect(defaultModes('1')).toEqual(['pick_speed']);
      expect(defaultModes('2')).toEqual(['pick_speed', 'orbit_speed']);
      expect(defaultModes('3')).toEqual(['pick_speed', 'orbit_speed', 'predict_burn']);
      expect(defaultModes('5')).toEqual(['pick_speed', 'orbit_speed', 'predict_burn', 'circularize']);
    });
  });

  describe('the K-1 answer is not always the middle picture', () => {
    const items = [1, 2, 3, 4, 5, 6].flatMap(seed => (['easy', 'medium'] as const).flatMap(tier =>
      buildOrbitItems({ modes: ['pick_speed'], tier, rng: seededRng(`k${seed}${tier}`) }) as SpeedItem[]));

    it('the asked outcome varies, so the right push size varies', () => {
      expect(new Set(items.map(i => i.ask)).size).toBeGreaterThanOrEqual(3);
      expect(new Set(items.map(i => pushPath(i, i.pushes[tapKey(i)]))).size).toBeGreaterThanOrEqual(3);
    });
    it('the key sits in every place on screen', () => {
      const three = items.filter(i => i.pushes.length === 3);
      expect(new Set(three.map(tapKey)).size).toBe(3);
    });
  });

  describe('catalog tutoring scaffold (the scripted path)', () => {
    const entry = ASTRONOMY_CATALOG.find((c) => c.id === 'orbit-mechanics-lab')!;

    it('keeps a pre-reader read-aloud and a never-name-the-answer directive', () => {
      const directives = entry.tutoring!.aiDirectives ?? [];
      const pre = directives.find(d => /PRE-READER/i.test(d.title))!;
      expect(pre.instruction).toMatch(/READ_CHALLENGE/);
      expect(pre.instruction).toMatch(/going around and around/i);
      const never = directives.find(d => /NEVER NAME THE ANSWER/i.test(d.title))!;
      expect(never.instruction).toMatch(/medium one/i);
    });
    it('every contextKey referenced in the task description is declared, with no handlebars conditionals', () => {
      const keys = entry.tutoring!.contextKeys ?? [];
      const referenced = (entry.tutoring!.taskDescription.match(/\{\{\w+\}\}/g) ?? []).map(m => m.slice(2, -2));
      expect(referenced.length).toBeGreaterThan(0);
      for (const k of referenced) expect(keys).toContain(k);
      expect(JSON.stringify(entry.tutoring)).not.toMatch(/\{\{#/);
    });
    it('does not carry a band floor; K-1 are told the task is a tap on pictures', () => {
      expect(entry.constraints).not.toMatch(/BAND FLOOR|Grade 2\+ ONLY/i);
      expect(entry.constraints).toMatch(/K and Grade 1 MAY be routed here/);
      expect(entry.teachingWorkspace!.grades).toContain('Kindergarten');
    });
  });
});
