/**
 * What a component kind must have to exist (`registry.ts`). A new kind fails here until it names a code-owned
 * library with a finite id list, expands observed units onto ids from that list, and has a screen that shows it.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KIND_PATTERN, MAX_COMPONENT_ID, validTallies } from './contract';
import { COMPONENT_KINDS, componentKind, expandTallies } from './registry';

const LUMINA = resolve(__dirname, '../..');

describe('component kinds', () => {
  it('kinds are unique and well named', () => {
    const kinds = COMPONENT_KINDS.map(k => k.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    for (const k of kinds) expect(k).toMatch(KIND_PATTERN);
  });

  it.each(COMPONENT_KINDS.map(k => [k.kind, k] as const))('%s has a library, a finite id list and a display', (_, k) => {
    expect(existsSync(resolve(LUMINA, k.library.replace(/^service\//, 'service/'))), `library ${k.library}`).toBe(true);
    expect(existsSync(resolve(LUMINA, 'components', `${k.display}.tsx`)), `display ${k.display}`).toBe(true);
    const list = k.components();
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(500);
    expect(new Set(list.map(c => c.id)).size).toBe(list.length);
    for (const c of list) {
      expect(c.id.length).toBeLessThanOrEqual(MAX_COMPONENT_ID);
      expect(c.label && c.group).toBeTruthy();
    }
    expect(k.unit.trim() && k.title.trim()).toBeTruthy();
  });

  it.each(COMPONENT_KINDS.map(k => [k.kind, k] as const))('%s evidence only names ids from its own list', (_, k) => {
    const ids = new Set(k.components().flatMap(c => [c.id, ...(c.also ?? [])]));
    const evidence = k.expand([{ unit: 'ship', attempts: 2, correct: 1 }, { unit: 'cake', attempts: 1, correct: 1 }, { unit: 'zzzznotaword', attempts: 1, correct: 1 }]);
    for (const row of evidence) {
      expect(row.kind).toBe(k.kind);
      expect(ids.has(row.id), row.id).toBe(true);
      expect(row.correct).toBeLessThanOrEqual(row.attempts);
    }
  });
});

describe('letter_sound', () => {
  const k = componentKind('letter_sound')!;

  it('shows the taught sequence first: letter group 1 opens with s, a, t, i, p, n', () => {
    const list = k.components();
    expect(list.slice(0, 6).map(c => c.label)).toEqual(['s', 'a', 't', 'i', 'p', 'n']);
    expect(list[0].group).toBe('Letter group 1');
    const groups = Array.from(new Set(list.map(c => c.group)));
    expect(groups.slice(0, 4)).toEqual(['Letter group 1', 'Letter group 2', 'Letter group 3', 'Letter group 4']);
    expect(groups[groups.length - 1]).toBe('Other spellings');
    expect(list.filter(c => c.id === 'ck/K')).toHaveLength(1);
  });

  it('short o is one cell that also counts the library\'s second short o, and each cell names a word it is read in', () => {
    const list = k.components();
    const group3 = list.filter(c => c.group === 'Letter group 3');
    expect(group3.map(c => c.label)).toEqual(['g', 'o', 'u', 'l', 'f', 'b']);
    expect(group3[1]).toMatchObject({ id: 'o/AA', also: ['o/AO'] });
    expect(list.some(c => c.id === 'o/AO')).toBe(false);
    for (const c of list.filter(c => c.group !== 'Other spellings')) {
      expect(c.detail, c.id).toMatch(/^[a-z]{2,}$/);
      expect(c.detail!.includes(c.label.replace('-e', '').replace('-', '')[0]), `${c.id} ${c.detail}`).toBe(true);
    }
  });

  it('a word read counts toward each of its pairs, and a missed word counts against them', () => {
    const evidence = k.expand([{ unit: 'ship', attempts: 2, correct: 1 }, { unit: 'sip', attempts: 1, correct: 1 }]);
    const by = Object.fromEntries(evidence.map(r => [r.id, [r.attempts, r.correct]]));
    expect(by['sh/SH']).toEqual([2, 1]);
    expect(by['s/S']).toEqual([1, 1]);
    expect(by['i/IH']).toEqual([3, 2]);
    expect(by['p/P']).toEqual([3, 2]);
  });

  it('a letter card whose sound was said counts toward that letter\'s taught pair only', () => {
    const evidence = k.expand([{ unit: 'letter:o', attempts: 1, correct: 0 }, { unit: 'letter:sh', attempts: 2, correct: 2 },
      { unit: 'letter:x', attempts: 1, correct: 1 }, { unit: 'letter:zq', attempts: 1, correct: 1 }]);
    const by = Object.fromEntries(evidence.map(e => [e.id, [e.attempts, e.correct]]));
    expect(by).toEqual({ 'o/AA': [1, 0], 'sh/SH': [2, 2], 'x/K S': [1, 1] });
  });

  it('a word read as another counts against only the pairs that differ', () => {
    const ids = (unit: string) => k.expand([{ unit, attempts: 1, correct: 0 }]).map(e => e.id).sort();
    expect(ids('sits>sat')).toEqual(ids('sits').filter(id => id !== 't/T' && id !== 's/S').concat(
      // sits has two s pairs; sat shares one, so the final s still counts.
      k.expand([{ unit: 'sits', attempts: 1, correct: 0 }]).filter(e => e.id === 's/S').map(e => e.id)).sort());
    expect(ids('sits>sat')).not.toContain('t/T');
    expect(ids('cat>cap')).toEqual(['t/T']);
    // Not in the library, or the same pairs in another order: the whole printed word counts.
    expect(ids('cat>zzqx')).toEqual(ids('cat'));
    expect(ids('pots>stop')).toEqual(ids('pots'));
  });

  it('a word the library lacks, and an unknown kind, give no evidence', () => {
    expect(k.expand([{ unit: 'zzzznotaword', attempts: 1, correct: 1 }])).toEqual([]);
    expect(expandTallies([{ kind: 'no_such_kind', units: [{ unit: 'ship', attempts: 1, correct: 1 }] }])).toEqual([]);
  });
});

describe('tally validation', () => {
  it('accepts a well-formed tally and refuses a malformed one', () => {
    expect(validTallies([{ kind: 'letter_sound', units: [{ unit: 'ship', attempts: 2, correct: 1 }] }])).toBe(true);
    expect(validTallies([{ kind: 'Letter', units: [] }])).toBe(false);
    expect(validTallies([{ kind: 'letter_sound', units: [{ unit: 'ship', attempts: 1, correct: 2 }] }])).toBe(false);
    expect(validTallies([{ kind: 'letter_sound', units: [{ unit: '', attempts: 1, correct: 1 }] }])).toBe(false);
    expect(validTallies('x')).toBe(false);
  });
});
