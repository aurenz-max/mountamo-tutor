/**
 * Chemistry figure model for the `chemistry` worked-example step.
 *
 * The model names species (an element and a charge) and, for a Lewis
 * structure, the bonds between them. Code owns every chemical fact: protons,
 * neutrons, electrons, shells, valence electrons, lone pairs, electronegativity
 * and bond type all come from the element table here, so a drawn sodium ion
 * always has 10 electrons and a drawn water molecule always has two lone pairs
 * on oxygen. A Lewis structure in which an atom does not reach a full shell is
 * rejected. Pure: the generator, the agent's chem_compute tool, the view and
 * vitest share it.
 */

import { ELEMENTS } from '../chemistry-primitives/constants';

/** Elements a chemistry step may draw: hydrogen through krypton (periods 1-4). */
export const MAX_Z = 36;

/** Pauling electronegativity, Z 1-36. Noble gases He, Ne, Ar have none. */
const PAULING: Record<string, number> = {
  H: 2.2, Li: 0.98, Be: 1.57, B: 2.04, C: 2.55, N: 3.04, O: 3.44, F: 3.98,
  Na: 0.93, Mg: 1.31, Al: 1.61, Si: 1.9, P: 2.19, S: 2.58, Cl: 3.16,
  K: 0.82, Ca: 1.0, Sc: 1.36, Ti: 1.54, V: 1.63, Cr: 1.66, Mn: 1.55, Fe: 1.83, Co: 1.88, Ni: 1.91, Cu: 1.9, Zn: 1.65,
  Ga: 1.81, Ge: 2.01, As: 2.18, Se: 2.55, Br: 2.96, Kr: 3.0,
};

/** The ion each main-group element usually forms (0 = none drawn as typical). */
const COMMON_CHARGE_BY_GROUP: Record<number, number> = { 1: 1, 2: 2, 13: 3, 15: -3, 16: -2, 17: -1 };

export interface ElementFacts {
  symbol: string;
  name: string;
  atomicNumber: number;
  /** Atomic mass in u, from the table. */
  atomicMass: number;
  /** Most common mass number (atomic mass rounded). */
  massNumber: number;
  group: number;
  period: number;
  category: string;
  metal: boolean;
  /** Electrons per shell, innermost first, for the neutral atom. */
  shells: number[];
  /** Outer-shell electrons used in Lewis structures (main group only; null for transition metals). */
  valenceElectrons: number | null;
  electronegativity: number | null;
  /** The ion it usually forms, e.g. +1 for Na, -2 for O; null when it has no single typical ion. */
  commonCharge: number | null;
}

const BY_SYMBOL = new Map(ELEMENTS.filter((e) => e.number <= MAX_Z).map((e) => [e.symbol.toLowerCase(), e]));

export function elementFacts(symbol: string): ElementFacts | null {
  const e = BY_SYMBOL.get(symbol.trim().toLowerCase());
  if (!e) return null;
  const group = e.xpos;
  const mainGroup = group <= 2 || group >= 13;
  const metal = /alkali|alkaline|transition/.test(e.category) && !/metalloid/.test(e.category);
  const valence = e.symbol === 'He' ? 2 : group <= 2 ? group : group >= 13 ? group - 10 : null;
  const common = e.symbol === 'H' ? 1 : mainGroup ? (COMMON_CHARGE_BY_GROUP[group] ?? null) : null;
  return {
    symbol: e.symbol,
    name: e.name === 'Aluminium' ? 'Aluminum' : e.name,
    atomicNumber: e.number,
    atomicMass: e.atomic_mass,
    massNumber: Math.round(e.atomic_mass),
    group,
    period: e.ypos,
    category: e.category,
    metal,
    shells: [...e.electron_shells],
    valenceElectrons: valence,
    electronegativity: PAULING[e.symbol] ?? null,
    commonCharge: common === 0 ? null : common,
  };
}

/** Shells of an atom or ion: electrons come off or go onto the outermost shell. */
export function ionShells(facts: ElementFacts, charge: number): number[] {
  const shells = [...facts.shells];
  if (charge > 0) {
    let remove = charge;
    while (remove > 0 && shells.length) {
      const last = shells.length - 1;
      const take = Math.min(remove, shells[last]);
      shells[last] -= take;
      remove -= take;
      if (shells[last] === 0) shells.pop();
    }
  } else if (charge < 0) {
    shells[shells.length - 1] += -charge;
  }
  return shells;
}

export type BondKind = 'nonpolar covalent' | 'polar covalent' | 'ionic';

/** Bond type between two elements: metal + nonmetal is ionic; otherwise by electronegativity difference (0.4). */
export function bondBetween(a: ElementFacts, b: ElementFacts): { difference: number | null; kind: BondKind | null } {
  if (a.electronegativity == null || b.electronegativity == null) return { difference: null, kind: null };
  const difference = Number(Math.abs(a.electronegativity - b.electronegativity).toFixed(2));
  if (a.metal !== b.metal) return { difference, kind: 'ionic' };
  if (a.metal && b.metal) return { difference, kind: null };
  return { difference, kind: difference < 0.4 ? 'nonpolar covalent' : 'polar covalent' };
}

/** Parse "Na", "Na+", "O2-", "Fe3+", "Cl^-" into a symbol and a charge. */
export function parseSpecies(text: string): { symbol: string; charge: number } | null {
  const m = text.trim().replace(/[\^{}\s]/g, '').match(/^([A-Z][a-z]?)(\d*)([+-]?)$/);
  if (!m) return null;
  if (m[2] && !m[3]) return null;
  const size = m[2] ? Number(m[2]) : 1;
  return { symbol: m[1], charge: m[3] === '+' ? size : m[3] === '-' ? -size : 0 };
}

/** Element counts and molar mass of a formula like H2O, Ca(OH)2, C6H12O6. */
export function formulaFacts(formula: string): { counts: Record<string, number>; molarMass: number } | { error: string } {
  const tokens = formula.replace(/\s/g, '').match(/[A-Z][a-z]?|\d+|\(|\)/g);
  if (!tokens || tokens.join('') !== formula.replace(/\s/g, '')) return { error: `cannot read formula ${formula}` };
  const stack: Record<string, number>[] = [{}];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];
    const mult = next && /^\d+$/.test(next) ? Number(next) : 1;
    if (t === '(') stack.push({});
    else if (t === ')') {
      const group = stack.pop();
      if (!group || !stack.length) return { error: `unbalanced parentheses in ${formula}` };
      for (const [s, n] of Object.entries(group)) stack[stack.length - 1][s] = (stack[stack.length - 1][s] ?? 0) + n * mult;
      if (next && /^\d+$/.test(next)) i++;
    } else if (/^\d+$/.test(t)) return { error: `misplaced number in ${formula}` };
    else {
      const all = ELEMENTS.find((e) => e.symbol === t);
      if (!all) return { error: `unknown element ${t}` };
      stack[stack.length - 1][t] = (stack[stack.length - 1][t] ?? 0) + mult;
      if (next && /^\d+$/.test(next)) i++;
    }
  }
  if (stack.length !== 1) return { error: `unbalanced parentheses in ${formula}` };
  const counts = stack[0];
  const molarMass = Object.entries(counts).reduce((sum, [s, n]) => sum + (ELEMENTS.find((e) => e.symbol === s)?.atomic_mass ?? 0) * n, 0);
  return { counts, molarMass: Number(molarMass.toFixed(3)) };
}

// ── Figure ───────────────────────────────────────────────────────────

export type ChemView = 'atoms' | 'lewis' | 'periodic';
export type ChemTrend = 'none' | 'electronegativity' | 'atomic-radius' | 'valence-electrons';

export interface ChemSpecies {
  id: string;
  symbol: string;
  charge: number;
  /** Mass number; the most common one when the model gave 0. */
  massNumber: number;
}
export interface ChemBond { a: string; b: string; order: 1 | 2 | 3 }
export interface ChemTransfer { from: string; to: string; electrons: number }

export interface ChemFigure {
  view: ChemView;
  species: ChemSpecies[];
  bonds: ChemBond[];
  transfers: ChemTransfer[];
  /** Atoms view: ring the outer shell. */
  showValence: boolean;
  /** Periodic view: element symbols to pick out. */
  highlight: string[];
  trend: ChemTrend;
}

/** What code computed for one drawn species. */
export interface SpeciesFacts {
  id: string;
  label: string;
  protons: number;
  neutrons: number;
  electrons: number;
  shells: number[];
  /** Lewis view: electrons in lone pairs and in bonds around this atom. */
  lonePairs?: number;
  bondCount?: number;
  shellTotal?: number;
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback);

export function speciesLabel(symbol: string, charge: number): string {
  if (!charge) return symbol;
  const size = Math.abs(charge) === 1 ? '' : String(Math.abs(charge));
  return `${symbol}${size}${charge > 0 ? '+' : '−'}`;
}

/**
 * Parse model output into a figure, rejecting anything chemically wrong:
 * unknown elements, impossible charges or mass numbers, bonds to atoms that
 * are not drawn, and Lewis atoms that do not reach a full outer shell.
 */
export function parseChemFigure(data: Record<string, unknown>): ChemFigure {
  const view = text(data.view, 20) as ChemView;
  if (!['atoms', 'lewis', 'periodic'].includes(view)) throw new Error(`view must be atoms, lewis or periodic, not "${view}"`);
  const errors: string[] = [];
  const species: ChemSpecies[] = [];
  const rawSpecies = Array.isArray(data.species) ? data.species : [];
  rawSpecies.forEach((raw, i) => {
    const r = raw as Record<string, unknown>;
    const id = text(r.id, 12) || `s${i + 1}`;
    const facts = elementFacts(text(r.element, 3));
    if (!facts) { errors.push(`species ${id}: "${text(r.element, 12)}" is not an element from H to Kr`); return; }
    const charge = int(r.charge);
    if (Math.abs(charge) > 3) errors.push(`species ${id}: a charge of ${charge} is outside what this step draws (-3 to +3)`);
    if (charge > 0 && charge > facts.atomicNumber) errors.push(`species ${id}: ${facts.symbol} has only ${facts.atomicNumber} electrons to lose`);
    let massNumber = int(r.massNumber);
    if (massNumber <= 0) massNumber = facts.massNumber;
    const neutrons = massNumber - facts.atomicNumber;
    if (neutrons < 0 || (facts.atomicNumber > 1 && neutrons > facts.atomicNumber * 1.7)) errors.push(`species ${id}: mass number ${massNumber} is not possible for ${facts.symbol} (atomic number ${facts.atomicNumber})`);
    if (species.some((s) => s.id === id)) errors.push(`species id ${id} is used twice`);
    species.push({ id, symbol: facts.symbol, charge, massNumber });
  });
  const ids = new Set(species.map((s) => s.id));

  const bonds: ChemBond[] = [];
  if (view === 'lewis') {
    for (const raw of Array.isArray(data.bonds) ? data.bonds : []) {
      const r = raw as Record<string, unknown>;
      const a = text(r.a, 12), b = text(r.b, 12);
      const order = int(r.order, 1);
      if (!ids.has(a) || !ids.has(b) || a === b) { errors.push(`bond ${a}-${b} must join two different drawn species`); continue; }
      if (order < 1 || order > 3) { errors.push(`bond ${a}-${b}: order must be 1, 2 or 3`); continue; }
      if (bonds.some((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))) { errors.push(`bond ${a}-${b} is listed twice`); continue; }
      bonds.push({ a, b, order: order as 1 | 2 | 3 });
    }
  }

  const transfers: ChemTransfer[] = [];
  if (view === 'atoms') {
    for (const raw of Array.isArray(data.transfers) ? data.transfers : []) {
      const r = raw as Record<string, unknown>;
      const from = text(r.from, 12), to = text(r.to, 12);
      const electrons = int(r.electrons, 1);
      if (!ids.has(from) || !ids.has(to) || from === to) { errors.push(`transfer ${from}->${to} must join two different drawn species`); continue; }
      if (electrons < 1 || electrons > 3) { errors.push(`transfer ${from}->${to}: 1 to 3 electrons`); continue; }
      transfers.push({ from, to, electrons });
    }
  }

  const highlight = (Array.isArray(data.highlight) ? data.highlight : [])
    .map((h) => elementFacts(text(h, 3))?.symbol)
    .filter((s): s is string => !!s);
  const trendRaw = text(data.trend, 30);
  const trend: ChemTrend = (['electronegativity', 'atomic-radius', 'valence-electrons'] as const).includes(trendRaw as never) ? trendRaw as ChemTrend : 'none';

  if (view !== 'periodic' && !species.length) errors.push(`an ${view} view needs at least one species`);
  if (view === 'atoms' && species.length > 3) errors.push('an atoms view draws at most 3 atoms or ions side by side');
  if (view === 'lewis' && species.length > 12) errors.push('a Lewis view draws at most 12 atoms');
  if (view === 'periodic' && !highlight.length && trend === 'none') errors.push('a periodic view needs elements to highlight or a trend to show');

  const figure: ChemFigure = { view, species, bonds, transfers, showValence: data.showValence === true, highlight, trend };
  if (view === 'lewis' && !errors.length) errors.push(...lewisErrors(figure));
  if (errors.length) throw new Error(`Chemistry figure rejected: ${errors.join('; ')}`);
  return figure;
}

/** Electrons around each Lewis atom: lone pairs from valence electrons, minus bonding, minus charge. */
export function lewisFacts(figure: ChemFigure): Map<string, { lonePairs: number; bondCount: number; shellTotal: number; nonbonding: number }> {
  const out = new Map<string, { lonePairs: number; bondCount: number; shellTotal: number; nonbonding: number }>();
  for (const s of figure.species) {
    const facts = elementFacts(s.symbol)!;
    const bondCount = figure.bonds.filter((b) => b.a === s.id || b.b === s.id).reduce((n, b) => n + b.order, 0);
    const nonbonding = (facts.valenceElectrons ?? 0) - s.charge - bondCount;
    out.set(s.id, { lonePairs: Math.max(0, Math.floor(nonbonding / 2)), bondCount, shellTotal: nonbonding + 2 * bondCount, nonbonding });
  }
  return out;
}

function lewisErrors(figure: ChemFigure): string[] {
  const errors: string[] = [];
  const facts = lewisFacts(figure);
  for (const s of figure.species) {
    const el = elementFacts(s.symbol)!;
    const f = facts.get(s.id)!;
    const label = `${speciesLabel(s.symbol, s.charge)} (${s.id})`;
    if (el.valenceElectrons == null) { errors.push(`${label}: transition metals are not drawn as Lewis structures here`); continue; }
    if (f.nonbonding < 0) { errors.push(`${label} makes ${f.bondCount} bonds but has only ${el.valenceElectrons - s.charge} valence electrons`); continue; }
    if (f.nonbonding % 2) { errors.push(`${label} is left with an unpaired electron; check its bonds and charge`); continue; }
    const duet = el.period === 1 || (s.charge > 0 && el.period === 2 && el.group <= 2);
    const emptiedCation = s.charge > 0 && f.bondCount === 0 && f.nonbonding === 0;
    const lowOctet = (el.symbol === 'B' || el.symbol === 'Al') ? 6 : el.symbol === 'Be' ? 4 : null;
    const expanded = el.period >= 3 && f.shellTotal > 8 && f.shellTotal <= 12 && f.bondCount > 0;
    const ok = emptiedCation || (duet ? f.shellTotal === 2 : f.shellTotal === 8) || f.shellTotal === lowOctet || expanded;
    if (!ok) errors.push(`${label} has ${f.shellTotal} electrons around it (${f.bondCount} bonding pairs, ${f.lonePairs} lone pairs); it needs ${duet ? 2 : 8}`);
  }
  return errors;
}

/** The facts code computed for each species, as the agent and the reviewers see them. */
export function measureChem(figure: ChemFigure): SpeciesFacts[] {
  const lewis = figure.view === 'lewis' ? lewisFacts(figure) : null;
  return figure.species.map((s) => {
    const el = elementFacts(s.symbol)!;
    const l = lewis?.get(s.id);
    return {
      id: s.id,
      label: speciesLabel(s.symbol, s.charge),
      protons: el.atomicNumber,
      neutrons: s.massNumber - el.atomicNumber,
      electrons: el.atomicNumber - s.charge,
      shells: ionShells(el, s.charge),
      ...(l ? { lonePairs: l.lonePairs, bondCount: l.bondCount, shellTotal: l.shellTotal } : {}),
    };
  });
}

/** One line per figure for the judge, the challenger and the content review. */
export function chemSummary(figure: ChemFigure): string {
  if (figure.view === 'periodic') {
    return `periodic table (H-Kr), highlighted ${figure.highlight.join(', ') || 'none'}${figure.trend !== 'none' ? `, trend arrow: ${figure.trend}` : ''}`;
  }
  const facts = measureChem(figure);
  const parts = facts.map((f) => figure.view === 'lewis'
    ? `${f.label}[${f.id}] ${f.bondCount} bonding pairs, ${f.lonePairs} lone pairs`
    : `${f.label}[${f.id}] ${f.protons}p ${f.neutrons}n ${f.electrons}e shells ${f.shells.join(',')}`);
  const bonds = figure.bonds.map((b) => `${b.a}${b.order === 1 ? '-' : b.order === 2 ? '=' : '≡'}${b.b}`);
  const transfers = figure.transfers.map((t) => `${t.electrons}e ${t.from}->${t.to}`);
  return `${figure.view}: ${parts.join('; ')}${bonds.length ? ` | bonds ${bonds.join(' ')}` : ''}${transfers.length ? ` | transfer ${transfers.join(' ')}` : ''}${figure.showValence ? ' | outer shell ringed' : ''}`;
}

// ── Lewis layout ─────────────────────────────────────────────────────

export interface LewisAtomLayout { id: string; x: number; y: number; label: string; charge: number; pairs: Array<{ x: number; y: number; angle: number }>; bracket: boolean }
export interface LewisLayout { width: number; height: number; atoms: LewisAtomLayout[]; bonds: Array<{ x1: number; y1: number; x2: number; y2: number; order: number }> }

const BOND = 64;
const PAIR_R = 20;

/**
 * Place each connected molecule as a tree from its most-bonded atom, then put
 * lone pairs in the widest gaps between bonds. Separate pieces (ions, or two
 * molecules) sit side by side.
 */
export function layoutLewis(figure: ChemFigure): LewisLayout {
  const facts = lewisFacts(figure);
  const neighbors = new Map<string, string[]>(figure.species.map((s) => [s.id, []]));
  for (const b of figure.bonds) { neighbors.get(b.a)!.push(b.b); neighbors.get(b.b)!.push(b.a); }
  const pos = new Map<string, { x: number; y: number }>();
  const placed = new Set<string>();
  let offsetX = 0;
  const pieces: Array<{ ids: string[]; minX: number; maxX: number }> = [];

  for (const start of figure.species) {
    if (placed.has(start.id)) continue;
    // Collect the piece, then root it at its most-bonded non-hydrogen atom.
    const piece: string[] = [];
    const queue = [start.id];
    const seen = new Set([start.id]);
    while (queue.length) {
      const id = queue.shift()!;
      piece.push(id);
      for (const n of neighbors.get(id)!) if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
    const sym = (id: string) => figure.species.find((s) => s.id === id)!.symbol;
    const root = [...piece].sort((a, b) => (neighbors.get(b)!.length - neighbors.get(a)!.length) || ((sym(a) === 'H' ? 1 : 0) - (sym(b) === 'H' ? 1 : 0)))[0];
    const local = new Map<string, { x: number; y: number }>([[root, { x: 0, y: 0 }]]);
    const dirIn = new Map<string, number>();
    const bfs = [root];
    while (bfs.length) {
      const id = bfs.shift()!;
      const kids = neighbors.get(id)!.filter((n) => !local.has(n));
      const p = local.get(id)!;
      let angles: number[];
      if (id === root) {
        const k = kids.length;
        angles = k === 2 ? [Math.PI, 0] : k === 3 ? [Math.PI, 0, -Math.PI / 2] : Array.from({ length: k }, (_, i) => Math.PI - (i * 2 * Math.PI) / Math.max(k, 1));
      } else {
        const base = dirIn.get(id)!;
        const spread = kids.length === 1 ? [0] : kids.length === 2 ? [-Math.PI / 2, Math.PI / 2] : [-Math.PI / 2, 0, Math.PI / 2];
        angles = spread.slice(0, kids.length).map((d) => base + d);
      }
      kids.forEach((kid, i) => {
        const a = angles[i] ?? 0;
        local.set(kid, { x: p.x + BOND * Math.cos(a), y: p.y + BOND * Math.sin(a) });
        dirIn.set(kid, a);
        bfs.push(kid);
      });
    }
    const xs = Array.from(local.values()).map((p) => p.x);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    local.forEach((p, id) => pos.set(id, { x: p.x - minX + offsetX, y: p.y }));
    pieces.push({ ids: piece, minX: offsetX, maxX: offsetX + maxX - minX });
    offsetX += maxX - minX + (figure.bonds.length ? 110 : 90);
    piece.forEach((id) => placed.add(id));
  }

  const atoms: LewisAtomLayout[] = figure.species.map((s) => {
    const p = pos.get(s.id)!;
    const f = facts.get(s.id)!;
    const bondAngles = neighbors.get(s.id)!.map((n) => Math.atan2(pos.get(n)!.y - p.y, pos.get(n)!.x - p.x));
    const candidates = [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, (3 * Math.PI) / 4, -Math.PI / 4, (-3 * Math.PI) / 4];
    const gap = (a: number) => Math.min(Math.PI, ...bondAngles.map((b) => { const d = Math.abs(((a - b + 3 * Math.PI) % (2 * Math.PI)) - Math.PI); return d; }));
    const chosen: number[] = [];
    for (let i = 0; i < f.lonePairs; i++) {
      const best = candidates
        .filter((c) => !chosen.includes(c))
        .map((c) => ({ c, score: Math.min(gap(c), ...chosen.map((x) => Math.abs(((c - x + 3 * Math.PI) % (2 * Math.PI)) - Math.PI))) }))
        .sort((a, b) => b.score - a.score)[0];
      if (best) chosen.push(best.c);
    }
    const isIon = s.charge !== 0 && !neighbors.get(s.id)!.length;
    return {
      id: s.id, x: p.x, y: p.y, label: s.symbol, charge: s.charge, bracket: isIon,
      pairs: chosen.map((a) => ({ x: p.x + PAIR_R * Math.cos(a), y: p.y + PAIR_R * Math.sin(a), angle: a })),
    };
  });
  const bonds = figure.bonds.map((b) => {
    const p = pos.get(b.a)!, q = pos.get(b.b)!;
    return { x1: p.x, y1: p.y, x2: q.x, y2: q.y, order: b.order };
  });
  const xs = atoms.map((a) => a.x), ys = atoms.map((a) => a.y);
  const pad = 46;
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
  const shift = (v: { x: number; y: number }) => { v.x -= minX; v.y -= minY; };
  atoms.forEach((a) => { shift(a); a.pairs.forEach(shift); });
  bonds.forEach((b) => { b.x1 -= minX; b.x2 -= minX; b.y1 -= minY; b.y2 -= minY; });
  return { width: Math.max(...xs) - Math.min(...xs) + 2 * pad, height: Math.max(...ys) - Math.min(...ys) + 2 * pad, atoms, bonds };
}

/** Elements H-Kr laid out as on the table: [symbol, group (column), period (row)]. */
export const MINI_TABLE: ReadonlyArray<{ symbol: string; group: number; period: number; z: number }> =
  ELEMENTS.filter((e) => e.number <= MAX_Z).map((e) => ({ symbol: e.symbol, group: e.xpos, period: e.ypos, z: e.number }));
