'use client';

import React from 'react';
import {
  BLOCKS, BLOCK_COLORS, COLS, ROWS, groundAt,
  type BlockColor, type BlockKind, type BuilderScene, type Placed,
} from './openBuilderModel';
import { ringOf, type BoardMark } from './openBuilderLevers';

/**
 * The board as ONE svg: sky, terrain, water, scenery and the child's blocks. The judge gets a PNG of this
 * same svg, so the inspector sees exactly what the child sees. Anything that is a building aid and not
 * part of the build (the drop preview) carries `data-aid` and is stripped from the picture.
 */
export const CELL = 60;
const GROUND = 24;
export const BOARD_W = COLS * CELL;
export const BOARD_H = ROWS * CELL + GROUND;
const yOf = (row: number) => ROWS * CELL - row * CELL;

const Face: React.FC<{ cx: number; cy: number; r: number }> = ({ cx, cy, r }) => (
  <g stroke="#3b4a40" strokeWidth={Math.max(2, r * 0.22)} strokeLinecap="round" fill="none" opacity={0.85}>
    <line x1={cx - r * 0.55} y1={cy - r * 0.35} x2={cx - r * 0.55} y2={cy - r * 0.05} />
    <line x1={cx + r * 0.55} y1={cy - r * 0.35} x2={cx + r * 0.55} y2={cy - r * 0.05} />
    <path d={`M ${cx - r * 0.5} ${cy + r * 0.25} Q ${cx} ${cy + r * 0.7} ${cx + r * 0.5} ${cy + r * 0.25}`} />
  </g>
);

/** One block in board units, its bottom-left at (x, yBottom). */
export const BlockShape: React.FC<{ kind: BlockKind; color: BlockColor; x: number; yBottom: number; cell?: number; ghost?: boolean }> = ({
  kind, color, x, yBottom, cell = CELL, ghost,
}) => {
  const s = BLOCKS[kind], { fill, edge } = BLOCK_COLORS[color];
  const w = s.w * cell, h = s.h * cell, pad = cell * 0.04, top = yBottom - h;
  const style = ghost ? { opacity: 0.45 } : undefined;
  if (kind === 'triangle') {
    return <g style={style}>
      <polygon points={`${x + pad},${yBottom - pad} ${x + w - pad},${yBottom - pad} ${x + w / 2},${top + pad}`}
        fill={fill} stroke={edge} strokeWidth={cell * 0.06} strokeLinejoin="round" />
    </g>;
  }
  if (kind === 'wheel') {
    const r = w / 2 - pad;
    return <g style={style}>
      <circle cx={x + w / 2} cy={yBottom - h / 2} r={r} fill="#3d4148" stroke="#24272c" strokeWidth={cell * 0.05} />
      <circle cx={x + w / 2} cy={yBottom - h / 2} r={r * 0.45} fill={fill} stroke={edge} strokeWidth={cell * 0.04} />
    </g>;
  }
  const faceR = Math.min(w, h) * 0.16;
  return <g style={style}>
    <rect x={x + pad} y={top + pad + cell * 0.05} width={w - 2 * pad} height={h - 2 * pad} rx={cell * 0.14} fill={edge} />
    <rect x={x + pad} y={top + pad} width={w - 2 * pad} height={h - 2 * pad - cell * 0.05} rx={cell * 0.14} fill={fill} />
    <Face cx={x + w / 2} cy={top + h / 2} r={faceR} />
  </g>;
};

export const BuilderBoard = React.forwardRef<SVGSVGElement, {
  scene: BuilderScene;
  placed: Placed[];
  /** The drop preview: where the selected block would land. Never part of the picture. */
  ghost?: { kind: BlockKind; color: BlockColor; col: number; row: number | null } | null;
  /** The help lever `job_marks`: marks on the scenery the goal is about. An aid, never part of the picture. */
  marks?: readonly BoardMark[] | null;
}>(({ scene, placed, ghost, marks }, ref) => {
  const night = scene.sky === 'night';
  const terrainCols = Array.from({ length: COLS }, (_, c) => groundAt(scene, c));
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} width="100%" role="img"
      aria-label={`${scene.title}: ${scene.props.map(p => p.label).join(', ')}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`sky-${scene.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? '#1f2347' : '#cfe6f2'} />
          <stop offset="1" stopColor={night ? '#3a3f6e' : '#eef6f8'} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={BOARD_W} height={BOARD_H} fill={`url(#sky-${scene.id})`} />
      {night && Array.from({ length: 18 }, (_, i) => (
        <circle key={i} cx={(i * 137) % BOARD_W} cy={(i * 71) % (ROWS * CELL * 0.6)} r={1.6 + (i % 3) * 0.6} fill="#f4f1d0" opacity={0.8} />
      ))}
      {/* faint grid so a child can line blocks up */}
      <g stroke={night ? 'rgba(255,255,255,.06)' : 'rgba(60,90,110,.08)'} strokeWidth={1}>
        {Array.from({ length: COLS - 1 }, (_, i) => <line key={`v${i}`} x1={(i + 1) * CELL} x2={(i + 1) * CELL} y1={0} y2={ROWS * CELL} />)}
        {Array.from({ length: ROWS - 1 }, (_, i) => <line key={`h${i}`} y1={(i + 1) * CELL} y2={(i + 1) * CELL} x1={0} x2={BOARD_W} />)}
      </g>

      {/* water sits low in its columns, under the banks */}
      {scene.water && (
        <rect x={scene.water[0] * CELL} y={yOf(1.2)} width={(scene.water[1] - scene.water[0] + 1) * CELL} height={1.2 * CELL + GROUND}
          fill="#5fa8d3" opacity={0.85} />
      )}
      {/* the ground strip, then raised terrain */}
      <rect x={0} y={ROWS * CELL} width={BOARD_W} height={GROUND} fill="#9fb98a" />
      {terrainCols.map((h, c) => h > 0 && (
        <g key={c}>
          <rect x={c * CELL} y={yOf(h)} width={CELL} height={h * CELL} fill="#b08a63" />
          <rect x={c * CELL} y={yOf(h)} width={CELL} height={CELL * 0.18} fill="#8fb27a" />
        </g>
      ))}
      {scene.water && (
        <rect x={scene.water[0] * CELL} y={ROWS * CELL} width={(scene.water[1] - scene.water[0] + 1) * CELL} height={GROUND} fill="#4b94c0" />
      )}

      {/* scenery */}
      {scene.props.map((p, i) => {
        const size = p.size * CELL, cx = p.col * CELL + size / 2, base = yOf(p.row);
        return (
          <text key={i} x={0} y={0} fontSize={size * 0.9} textAnchor="middle" dominantBaseline="auto"
            transform={`translate(${cx} ${base - size * 0.08}) scale(${p.flip ? -1 : 1} 1)`}
            style={{ fontFamily: '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif' }}>{p.emoji}</text>
        );
      })}

      {/* the child's build */}
      {placed.map(p => (
        <g key={p.id} data-block-id={p.id}>
          <BlockShape kind={p.kind} color={p.color} x={p.col * CELL} yBottom={yOf(p.row)} />
        </g>
      ))}

      {marks && marks.length > 0 && (
        <g data-aid="job-marks" data-lever="job-marks" pointerEvents="none">
          {marks.map((m, i) => {
            if (m.kind === 'flag') {
              const x = m.col * CELL + CELL / 2, y = yOf(m.row);
              return <g key={i} data-mark="flag">
                <line x1={x} y1={y} x2={x} y2={y - CELL * 1.1} stroke="#5b4a3a" strokeWidth={4} strokeLinecap="round" />
                <polygon points={`${x},${y - CELL * 1.1} ${x + CELL * 0.6},${y - CELL * 0.92} ${x},${y - CELL * 0.74}`} fill="#f2b33d" stroke="#c98d1f" strokeWidth={2} />
              </g>;
            }
            if (m.kind === 'ring') {
              const r = ringOf(scene.id, m.prop);
              return <circle key={i} data-mark="ring" cx={r.cx * CELL} cy={yOf(r.cy)} r={r.r * CELL} fill="none"
                stroke="#f2b33d" strokeWidth={4} strokeDasharray="10 7" />;
            }
            return <line key={i} data-mark="line" x1={m.fromCol * CELL} x2={m.toCol * CELL} y1={yOf(m.row)} y2={yOf(m.row)}
              stroke="#f2b33d" strokeWidth={4} strokeDasharray="14 9" />;
          })}
        </g>
      )}

      {ghost && ghost.row !== null && (
        <g data-aid="ghost" pointerEvents="none">
          <BlockShape kind={ghost.kind} color={ghost.color} x={ghost.col * CELL} yBottom={yOf(ghost.row)} ghost />
          <rect x={ghost.col * CELL + 2} y={yOf(ghost.row + BLOCKS[ghost.kind].h) + 2} width={BLOCKS[ghost.kind].w * CELL - 4}
            height={BLOCKS[ghost.kind].h * CELL - 4} rx={10} fill="none" stroke="#3b5a66" strokeWidth={3} strokeDasharray="8 6" />
        </g>
      )}
    </svg>
  );
});
BuilderBoard.displayName = 'BuilderBoard';

/** A palette thumbnail of one block kind. */
export const BlockThumb: React.FC<{ kind: BlockKind; color: BlockColor }> = ({ kind, color }) => {
  const s = BLOCKS[kind], cell = 22, w = s.w * cell, h = s.h * cell;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w * 1.4, height: h * 1.4, maxWidth: '100%' }} aria-hidden="true">
      <BlockShape kind={kind} color={color} x={0} yBottom={h} cell={cell} />
    </svg>
  );
};
