import { describe, expect, it } from 'vitest';
import { evaluateLetterFormation, getLetterTemplate, LETTER_TEMPLATES, type TraceStroke } from './letterWorkshopGeometry';

const ink = (id: string, dx = 0, dy = 0): TraceStroke[] => getLetterTemplate(id).strokes.map(path => ({
  pointerType: 'pen', points: path.map((p, t) => ({ x: p.x + dx, y: p.y + dy, t })),
}));

describe('Provisional free formation checks', () => {
  it.each(LETTER_TEMPLATES.map(t => t.id))('accepts the school model %s at another horizontal position', id => {
    expect(evaluateLetterFormation(getLetterTemplate(id), ink(id, 25)).passed).toBe(true);
  });
  it('preserves writing-line placement rather than normalizing wrong-case height', () => {
    expect(evaluateLetterFormation(getLetterTemplate('lowercase-o'), ink('uppercase-O')).passed).toBe(false);
    expect(evaluateLetterFormation(getLetterTemplate('lowercase-l'), ink('lowercase-l', 0, 55)).passed).toBe(false);
  });
  it('rejects mirrored shapes, reverse direction, missing dots, extra strokes, and blank ink', () => {
    const mirrored = ink('lowercase-b').map(s => ({ ...s, points: s.points.map(p => ({ ...p, x: 400 - p.x })) }));
    expect(evaluateLetterFormation(getLetterTemplate('lowercase-b'), mirrored).passed).toBe(false);
    const reverse = ink('lowercase-l').map(s => ({ ...s, points: [...s.points].reverse() }));
    expect(evaluateLetterFormation(getLetterTemplate('lowercase-l'), reverse).passed).toBe(false);
    expect(evaluateLetterFormation(getLetterTemplate('lowercase-i'), ink('lowercase-i').slice(0, 1)).passed).toBe(false);
    expect(evaluateLetterFormation(getLetterTemplate('lowercase-l'), [...ink('lowercase-l'), ...ink('lowercase-l')]).passed).toBe(false);
    expect(evaluateLetterFormation(getLetterTemplate('lowercase-l'), []).passed).toBe(false);
  });
});
