import { describe, expect, it } from 'vitest';
import { drawingProblems, drawingPrompt } from './look';

const pins = ['Signal Lantern', 'Attic Space', 'Barn Loft'];
const shows = 'where people hid inside a safe house';

describe('the blind drawing look', () => {
  it('gives the reader the part names in an order that says nothing about the pins', () => {
    const p = drawingPrompt({ grade: 'grade 4 student', shows, pins });
    expect(p.indexOf('"Attic Space"')).toBeLessThan(p.indexOf('"Barn Loft"'));
    expect(p.indexOf('"Barn Loft"')).toBeLessThan(p.indexOf('"Signal Lantern"'));
  });

  it('asks nothing about pins for a drawing with none', () => {
    expect(drawingPrompt({ grade: 'grade 4 student', shows })).not.toMatch(/"pins"/);
  });

  it('passes a drawing the reader could read', () => {
    const j = { visible: true, seen: 'a house', missing: null, issues: 'null', pins: [{ pin: 1, part: 'signal lantern', drawn: true }, { pin: 2, part: 'Attic Space', drawn: true }, { pin: 3, part: 'Barn Loft', drawn: true }] };
    expect(drawingProblems(j, { shows, pins })).toEqual([]);
  });

  it('sends back a drawing that does not show its claim, with what the reader saw', () => {
    const [p] = drawingProblems({ visible: false, seen: 'two houses', missing: 'a hiding place' }, { shows });
    expect(p).toContain(shows);
    expect(p).toContain('two houses');
    expect(p).toContain('a hiding place');
  });

  it('reports a pin read as another part, and a pin with nothing under it', () => {
    const j = { visible: true, pins: [{ pin: 1, part: 'Barn Loft', drawn: true }, { pin: 2, part: 'Attic Space', drawn: false }] };
    const out = drawingProblems(j, { shows, pins });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatch(/pin 1 marks "Signal Lantern".*"Barn Loft"/);
    expect(out[1]).toMatch(/pin 2 marks "Attic Space".*nothing drawn/);
  });

  it('adds nothing for a pin the reader skipped', () => {
    expect(drawingProblems({ visible: true, pins: [] }, { shows, pins })).toEqual([]);
  });
});
