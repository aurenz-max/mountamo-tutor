'use client';

/**
 * The board for molecule-constructor's open build, `make_molecule` (moleculeBuild.ts). One `<svg>` holds only the
 * learner's atoms and bonds, so `svgPicture` is exactly what the learner made. Everything else on it is an aid and
 * carries `data-aid`: tap targets, the selection ring, and the levers' marks (hollow dots for bonds an atom can still
 * make, each atom's bond tally, a tint per separate piece). No atom is numbered and nothing names a molecule.
 */
import React from 'react';
import { LuminaButton } from '../../../ui';
import {
  BOARD, ELEMENT_NAME, SLOTS, VALENCE, bondsFree, bondsUsed, piecesOf, type MoleculeBuild,
} from './moleculeBuild';

export const ELEMENT_COLOR: Readonly<Record<string, string>> = {
  H: '#3b82f6', C: '#eab308', N: '#22c55e', O: '#06b6d4', F: '#a855f7', S: '#f97316', P: '#ec4899', Cl: '#a855f7',
};
const PIECE_TINTS = ['#f472b6', '#38bdf8', '#a3e635', '#fbbf24', '#c084fc'];
const ATOM_R = 22;
/** Transparent tap area round an atom: about 44 px across at phone width. */
const HIT_R = 32;

export interface MoleculeBuildSceneProps {
  build: MoleculeBuild;
  selected: string | null;
  palette: readonly string[];
  /** Building is open (not checking, not solved, not blocked). */
  open: boolean;
  svgRef: React.MutableRefObject<SVGSVGElement | null>;
  onAdd: (element: string) => void;
  onTapAtom: (id: string) => void;
  onTapBond: (a: string, b: string) => void;
  /** Levers pulled on this item. */
  showOpenBonds: boolean;
  showTally: boolean;
  showPieces: boolean;
}

const slotOf = (build: MoleculeBuild, id: string) => SLOTS[build.atoms.find(a => a.id === id)?.slot ?? 0];

export function MoleculeBuildScene(p: MoleculeBuildSceneProps) {
  const { build } = p;
  const pieces = p.showPieces ? piecesOf(build) : null;
  return (
    <div className="flex flex-col items-center gap-3">
      <svg ref={p.svgRef} viewBox={`0 0 ${BOARD.width} ${BOARD.height}`} width="100%"
        className="h-auto max-w-full rounded-xl bg-black/20" role="group" aria-label="Your molecule board"
        data-build-scene="molecule-constructor">
        <rect x={0} y={0} width={BOARD.width} height={BOARD.height} fill="#0f172a" />

        {/* Piece tints (lever): one colour per separate piece, under everything. */}
        {pieces && build.atoms.map(a => {
          const s = SLOTS[a.slot];
          return <circle key={`tint-${a.id}`} data-aid="piece-tint" data-lever="piece-colors" cx={s.x} cy={s.y} r={ATOM_R + 12}
            fill={PIECE_TINTS[(pieces.get(a.id) ?? 0) % PIECE_TINTS.length]} opacity={0.35} />;
        })}

        {/* Bonds: the learner's lines, then a wide transparent tap line that takes one step of the bond away. */}
        {build.bonds.map(b => {
          const s1 = slotOf(build, b.a), s2 = slotOf(build, b.b);
          const dx = s2.x - s1.x, dy = s2.y - s1.y, len = Math.hypot(dx, dy) || 1;
          const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
          const sx = s1.x + ux * ATOM_R, sy = s1.y + uy * ATOM_R, ex = s2.x - ux * ATOM_R, ey = s2.y - uy * ATOM_R;
          const offsets = b.order === 1 ? [0] : b.order === 2 ? [-4, 4] : [-6, 0, 6];
          const name = (id: string) => ELEMENT_NAME[build.atoms.find(a => a.id === id)?.element ?? ''] ?? 'atom';
          const key = `${b.a}-${b.b}`;
          return (
            <g key={key} data-bond={key} data-order={b.order}>
              {offsets.map(o => (
                <line key={o} x1={sx + nx * o} y1={sy + ny * o} x2={ex + nx * o} y2={ey + ny * o}
                  stroke="#cbd5e1" strokeWidth={b.order === 1 ? 3 : 2.5} strokeLinecap="round" pointerEvents="none" />
              ))}
              <line data-aid="hit" role="button" aria-label={`Take a step off the bond between ${name(b.a)} and ${name(b.b)}`}
                data-pip-object={`bond-${b.a.replace('atom-', '')}-${b.b.replace('atom-', '')}`}
                x1={sx} y1={sy} x2={ex} y2={ey} stroke="transparent" strokeWidth={22} style={{ pointerEvents: p.open ? 'stroke' : 'none', cursor: 'pointer' }}
                onClick={() => p.onTapBond(b.a, b.b)} />
            </g>
          );
        })}

        {/* Atoms: a transparent hit circle first (a <g> paints nothing of its own), then the atom. */}
        {build.atoms.map(a => {
          const s = SLOTS[a.slot], color = ELEMENT_COLOR[a.element] ?? '#94a3b8';
          const free = Math.max(0, bondsFree(build, a)), selected = p.selected === a.id;
          return (
            <g key={a.id} role="button" aria-label={`${ELEMENT_NAME[a.element] ?? a.element} atom`} aria-pressed={selected}
              data-pip-object={a.id} data-element={a.element} onClick={() => p.onTapAtom(a.id)}
              style={{ cursor: p.open ? 'pointer' : 'default' }}>
              <circle data-aid="hit" cx={s.x} cy={s.y} r={HIT_R} fill="transparent" style={{ pointerEvents: 'all' }} />
              {selected && <circle data-aid="selected" cx={s.x} cy={s.y} r={ATOM_R + 6} fill="none" stroke="#22d3ee"
                strokeWidth={2.5} strokeDasharray="5 3" pointerEvents="none" />}
              <circle cx={s.x} cy={s.y} r={ATOM_R} fill={color} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} pointerEvents="none" />
              <text x={s.x} y={s.y + 1} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={a.element.length > 1 ? 15 : 17}
                fontWeight="bold" fontFamily="monospace" pointerEvents="none">{a.element}</text>
              {p.showOpenBonds && Array.from({ length: free }, (_, i) => {
                const angle = -Math.PI / 2 + (i * Math.PI * 2) / Math.max(free, 1) + Math.PI / 4;
                return <circle key={i} data-aid="open-bond" data-lever="open-bonds" cx={s.x + Math.cos(angle) * (ATOM_R + 9)}
                  cy={s.y + Math.sin(angle) * (ATOM_R + 9)} r={4} fill="none" stroke="#fde68a" strokeWidth={2} pointerEvents="none" />;
              })}
              {p.showTally && (
                <text data-aid="bond-tally" data-lever="bond-tally" x={s.x} y={s.y + ATOM_R + 18} textAnchor="middle"
                  fill="#fde68a" fontSize={13} pointerEvents="none">
                  {`${bondsUsed(build, a.id)} of ${VALENCE[a.element] ?? 1}`}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* The palette: tap an element to add an atom. Each element says how many bonds it makes. */}
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Atoms to add">
        {p.palette.map(e => (
          <LuminaButton key={e} aria-label={`Add ${e}`} disabled={!p.open || build.atoms.length >= SLOTS.length}
            onClick={() => p.onAdd(e)} className="h-auto min-h-[44px] min-w-[64px] flex-col gap-0 px-3 py-1.5"
            style={{ borderColor: `${ELEMENT_COLOR[e] ?? '#94a3b8'}88` }}>
            <span className="font-mono text-base font-bold" style={{ color: ELEMENT_COLOR[e] }}>{e}</span>
            <span className="text-[11px] text-slate-300">makes {VALENCE[e] ?? 1} bond{(VALENCE[e] ?? 1) === 1 ? '' : 's'}</span>
          </LuminaButton>
        ))}
      </div>
    </div>
  );
}
