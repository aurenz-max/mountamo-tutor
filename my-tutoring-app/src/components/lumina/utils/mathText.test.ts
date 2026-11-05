import { describe, expect, it } from 'vitest';
import { hasMath, mathIssues, spokenMath, splitMath } from './mathText';

describe('splitMath', () => {
  it('splits inline and display math from text', () => {
    expect(splitMath('So $x = 3$ and $$y^2$$.')).toEqual([
      { kind: 'text', text: 'So ' }, { kind: 'math', tex: 'x = 3', display: false },
      { kind: 'text', text: ' and ' }, { kind: 'math', tex: 'y^2', display: true }, { kind: 'text', text: '.' },
    ]);
  });

  it('leaves currency as text', () => {
    expect(hasMath('It costs $5 and $10 later.')).toBe(false);
    expect(splitMath('Pay \\$3 for $x$')).toEqual([{ kind: 'text', text: 'Pay $3 for ' }, { kind: 'math', tex: 'x', display: false }]);
  });
});

describe('mathIssues', () => {
  it('passes good math and plain text', () => {
    expect(mathIssues('Solve $2x + 1 = 5$ for $x$.')).toEqual([]);
    expect(mathIssues('$\\begin{bmatrix} 2 & 1 \\\\ 1 & -1 \\end{bmatrix}$')).toEqual([]);
    expect(mathIssues('No math here.')).toEqual([]);
  });

  it('names unpaired dollars, bare LaTeX, typed matrices and parse errors', () => {
    expect(mathIssues('Then $x = 3 is the answer.')[0]).toMatch(/unpaired \$/);
    expect(mathIssues('The slope is \\frac{1}{2}.')[0]).toMatch(/LaTeX outside/);
    expect(mathIssues('The matrix [2, 1; 1, -1] has two rows.')[0]).toMatch(/types a matrix/);
    expect(mathIssues('$\\frac{1}{2$')[0]).toMatch(/does not render/);
  });
});

describe('spokenMath', () => {
  it.each([
    ['$2(-1) - 1(1) = -3 \\neq 0$', '2 times negative 1 minus 1 times 1 equals negative 3 is not equal to 0'],
    ['$ad - bc$', 'a d minus b c'],
    ['$x^2 + y^3 = z^{10}$', 'x squared plus y cubed equals z to the power of 10'],
    ['$\\frac{3}{4}$ of the pizza', '3 over 4 of the pizza'],
    ['$\\sqrt{16} = 4$', 'the square root of 16 equals 4'],
    ['$\\begin{bmatrix} 2 & 1 \\\\ 1 & -1 \\end{bmatrix}$', 'the matrix with rows 2, 1; then 1, negative 1'],
    ['$90^\\circ$', '90 degrees'],
    ['$1,000 \\times 3$', '1000 times 3'],
    ['Plain words stay.', 'Plain words stay.'],
  ])('%s', (text, said) => expect(spokenMath(text)).toBe(said));
});
