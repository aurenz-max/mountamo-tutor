// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { bondBetween, chemSummary, elementFacts, formulaFacts, measureChem, parseChemFigure, parseSpecies } from './chemFigure';
import { ChemFigureView } from './ChemFigureView';

const lewis = (species: Array<[string, string, number?]>, bonds: Array<[string, string, number]>) =>
  parseChemFigure({
    view: 'lewis',
    species: species.map(([id, element, charge]) => ({ id, element, charge: charge ?? 0, massNumber: 0 })),
    bonds: bonds.map(([a, b, order]) => ({ a, b, order })),
    transfers: [], highlight: [], trend: 'none', showValence: false,
  });

describe('element facts', () => {
  it('reads shells, valence and ions from the table', () => {
    const na = elementFacts('Na')!;
    expect(na).toMatchObject({ atomicNumber: 11, shells: [2, 8, 1], valenceElectrons: 1, commonCharge: 1, metal: true });
    expect(elementFacts('cl')).toMatchObject({ valenceElectrons: 7, commonCharge: -1, metal: false });
    expect(elementFacts('Al')!.name).toBe('Aluminum');
    expect(elementFacts('Ag')).toBeNull();
  });

  it('classifies bonds', () => {
    expect(bondBetween(elementFacts('Na')!, elementFacts('Cl')!).kind).toBe('ionic');
    expect(bondBetween(elementFacts('H')!, elementFacts('O')!)).toEqual({ difference: 1.24, kind: 'polar covalent' });
    expect(bondBetween(elementFacts('C')!, elementFacts('H')!).kind).toBe('nonpolar covalent');
  });

  it('parses species and formulas', () => {
    expect(parseSpecies('O2-')).toEqual({ symbol: 'O', charge: -2 });
    expect(parseSpecies('Na^+')).toEqual({ symbol: 'Na', charge: 1 });
    expect(parseSpecies('Fe3')).toBeNull();
    expect(formulaFacts('H2O')).toEqual({ counts: { H: 2, O: 1 }, molarMass: 18.015 });
    expect(formulaFacts('Ca(OH)2')).toMatchObject({ counts: { Ca: 1, O: 2, H: 2 } });
    expect(formulaFacts('C6H12O6')).toMatchObject({ counts: { C: 6, H: 12, O: 6 } });
    expect(formulaFacts('Xx2')).toHaveProperty('error');
  });
});

describe('parseChemFigure', () => {
  it('computes ion electrons and shells', () => {
    const fig = parseChemFigure({ view: 'atoms', species: [{ id: 'na', element: 'Na', charge: 1, massNumber: 0 }, { id: 'cl', element: 'Cl', charge: -1, massNumber: 0 }], bonds: [], transfers: [], highlight: [], trend: 'none', showValence: true });
    expect(measureChem(fig)).toMatchObject([
      { label: 'Na+', protons: 11, neutrons: 12, electrons: 10, shells: [2, 8] },
      { label: 'Cl−', protons: 17, neutrons: 18, electrons: 18, shells: [2, 8, 8] },
    ]);
  });

  it('accepts full-shell Lewis structures and computes lone pairs', () => {
    const water = lewis([['o1', 'O'], ['h1', 'H'], ['h2', 'H']], [['o1', 'h1', 1], ['o1', 'h2', 1]]);
    expect(measureChem(water).find((f) => f.id === 'o1')).toMatchObject({ lonePairs: 2, bondCount: 2, shellTotal: 8 });
    const co2 = lewis([['c1', 'C'], ['o1', 'O'], ['o2', 'O']], [['c1', 'o1', 2], ['c1', 'o2', 2]]);
    expect(measureChem(co2).map((f) => f.lonePairs)).toEqual([0, 2, 2]);
    const salt = lewis([['na', 'Na', 1], ['cl', 'Cl', -1]], []);
    expect(measureChem(salt).map((f) => f.lonePairs)).toEqual([0, 4]);
    expect(() => lewis([['n1', 'N'], ['n2', 'N']], [['n1', 'n2', 3]])).not.toThrow();
  });

  it('rejects Lewis atoms without a full shell, unknown elements and bad bonds', () => {
    expect(() => lewis([['c1', 'C'], ['o1', 'O'], ['o2', 'O']], [['c1', 'o1', 1], ['c1', 'o2', 1]])).toThrow(/needs 8/);
    expect(() => lewis([['o1', 'O'], ['h1', 'H'], ['h2', 'H']], [['o1', 'h1', 2], ['o1', 'h2', 1]])).toThrow(/only 1 valence/);
    expect(() => lewis([['x', 'Q']], [])).toThrow(/not an element/);
    expect(() => lewis([['o1', 'O']], [['o1', 'zz', 1]])).toThrow(/two different drawn species/);
    expect(() => parseChemFigure({ view: 'periodic', species: [], highlight: [], trend: 'none' })).toThrow(/highlight or a trend/);
  });

  it('summarises for the judge', () => {
    const water = lewis([['o1', 'O'], ['h1', 'H'], ['h2', 'H']], [['o1', 'h1', 1], ['o1', 'h2', 1]]);
    expect(chemSummary(water)).toContain('O[o1] 2 bonding pairs, 2 lone pairs');
  });
});

describe('ChemFigureView', () => {
  it('draws Bohr shells with computed electrons and a transfer arrow', () => {
    const fig = parseChemFigure({ view: 'atoms', species: [{ id: 'na', element: 'Na', charge: 0, massNumber: 0 }, { id: 'cl', element: 'Cl', charge: 0, massNumber: 0 }], bonds: [], transfers: [{ from: 'na', to: 'cl', electrons: 1 }], highlight: [], trend: 'none', showValence: true });
    const { getAllByTestId, getByTestId } = render(<ChemFigureView figure={fig} altText="Na and Cl" />);
    expect(getAllByTestId('chem-atom')).toHaveLength(2);
    const shells = getAllByTestId('chem-shell').map((g) => Number(g.getAttribute('data-electrons')));
    expect(shells).toEqual([2, 8, 1, 2, 8, 7]);
    expect(getByTestId('chem-transfer').textContent).toContain('1 e⁻');
  });

  it('draws Lewis bonds and lone pairs', () => {
    const co2 = lewis([['c1', 'C'], ['o1', 'O'], ['o2', 'O']], [['c1', 'o1', 2], ['c1', 'o2', 2]]);
    const { getAllByTestId } = render(<ChemFigureView figure={co2} altText="CO2" />);
    expect(getAllByTestId('chem-bond').map((b) => b.getAttribute('data-order'))).toEqual(['2', '2']);
    expect(getAllByTestId('chem-lone-pair')).toHaveLength(4);
  });

  it('draws the periodic table with highlights', () => {
    const fig = parseChemFigure({ view: 'periodic', species: [], highlight: ['Na', 'Cl'], trend: 'electronegativity' });
    const { getAllByTestId, getByTestId } = render(<ChemFigureView figure={fig} altText="table" />);
    expect(getAllByTestId('chem-cell-highlight')).toHaveLength(2);
    expect(getAllByTestId('chem-cell')).toHaveLength(34);
    expect(getByTestId('chem-trend')).toBeTruthy();
  });
});
