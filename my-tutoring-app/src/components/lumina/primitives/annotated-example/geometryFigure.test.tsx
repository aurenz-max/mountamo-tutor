// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { claimedNumber, measureGeometry, parseGeometryFigure, polygonArea } from './geometryFigure';
import { GeometryFigureView } from './GeometryFigureView';

const rightTriangle = (hyp: string) => ({
  unit: 'cm',
  points: [{ name: 'C', x: 0, y: 0 }, { name: 'A', x: 0, y: 5 }, { name: 'B', x: 12, y: 0 }],
  polygons: [{ vertices: ['A', 'B', 'C'], label: '', shade: 'none' }],
  segments: [{ from: 'A', to: 'C', label: '5 cm', style: 'solid' }, { from: 'C', to: 'B', label: '12 cm', style: 'solid' }, { from: 'A', to: 'B', label: hyp, style: 'solid' }],
  angles: [{ vertex: 'C', from: 'A', to: 'B', label: '', kind: 'right' }],
});

const lShape = (label: string) => ({
  unit: 'm',
  points: [['A', 0, 0], ['B', 6, 0], ['C', 6, 2], ['D', 3, 2], ['E', 3, 5], ['F', 0, 5], ['G', 0, 2]].map(([name, x, y]) => ({ name, x, y })),
  polygons: [{ vertices: ['A', 'B', 'C', 'D', 'G'], label, shade: 'a' }, { vertices: ['G', 'D', 'E', 'F'], label: 'B', shade: 'b' }],
  segments: [{ from: 'G', to: 'D', label: '', style: 'dashed' }, { from: 'D', to: 'E', label: '?', style: 'solid' }],
  angles: [],
});

describe('claimedNumber', () => {
  it('reads numbers with units, degrees and area labels', () => {
    expect(claimedNumber('12 cm', 'cm')).toBe(12);
    expect(claimedNumber('$5\\text{ cm}$', 'cm')).toBe(5);
    expect(claimedNumber('40°', '')).toBe(40);
    expect(claimedNumber('$40^\\circ$', '')).toBe(40);
    expect(claimedNumber('A = 12 m²', 'm')).toBe(12);
    expect(claimedNumber('12 m^2', 'm')).toBe(12);
  });
  it('treats unknowns and names as unchecked', () => {
    for (const label of ['?', 'c', 'x cm', 'h', '? cm', 'A', '']) expect(claimedNumber(label, 'cm')).toBeNull();
  });
});

describe('parseGeometryFigure', () => {
  it('accepts a true figure and measures it', () => {
    const f = parseGeometryFigure(rightTriangle('c'));
    expect(measureGeometry(f)).toEqual(expect.arrayContaining(['AB = 13', 'BC = 12', 'CA = 5', 'angle ACB = 90°', 'area ABC = 30']));
  });
  it('rejects a side label the coordinates do not support', () => {
    expect(() => parseGeometryFigure(rightTriangle('14 cm'))).toThrow(/AB is labeled 14 cm but measures 13/);
  });
  it('rejects a right-angle mark on an angle that is not 90°', () => {
    const f = rightTriangle('c');
    f.angles = [{ vertex: 'A', from: 'B', to: 'C', label: '', kind: 'right' }];
    expect(() => parseGeometryFigure(f)).toThrow(/marked right but measures 67.38°/);
  });
  it('checks area labels on polygons', () => {
    expect(() => parseGeometryFigure(lShape('12 m²'))).not.toThrow();
    expect(() => parseGeometryFigure(lShape('15 m²'))).toThrow(/area is 12/);
    expect(polygonArea(parseGeometryFigure(lShape('A')).points.slice(0, 6))).toBe(21);
  });
  it('rejects references to missing points', () => {
    const f = rightTriangle('c');
    f.segments.push({ from: 'A', to: 'Z', label: '', style: 'solid' });
    expect(() => parseGeometryFigure(f)).toThrow(/"Z"/);
  });
});

describe('GeometryFigureView', () => {
  it('draws polygons, labels, the right-angle mark and point names to scale', () => {
    const f = parseGeometryFigure(rightTriangle('c'));
    const { getByTestId, getAllByTestId, getByText } = render(<GeometryFigureView figure={f} altText="right triangle" />);
    expect(getAllByTestId('geometry-polygon')).toHaveLength(1);
    expect(getAllByTestId('geometry-segment')).toHaveLength(3);
    expect(getByTestId('geometry-right-angle')).toBeTruthy();
    for (const t of ['5 cm', '12 cm', 'c', 'A', 'B', 'C']) expect(getByText(t)).toBeTruthy();
    const lines = getAllByTestId('geometry-segment').map((g) => g.querySelector('line')!);
    const len = (l: SVGLineElement) => Math.hypot(+l.getAttribute('x2')! - +l.getAttribute('x1')!, +l.getAttribute('y2')! - +l.getAttribute('y1')!);
    expect(len(lines[1]) / len(lines[0])).toBeCloseTo(12 / 5, 5);
  });
});
