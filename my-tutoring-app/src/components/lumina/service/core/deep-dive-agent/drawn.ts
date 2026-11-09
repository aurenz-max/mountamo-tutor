/**
 * What the author sees of a block it drew: the same drawing and the same numbered pins the student gets, as one SVG.
 * Only drawn blocks are looked at; the author already reads text blocks in full.
 */
import { sanitizeSvg } from '../../agent-kit/displays';
import { viewBoxOf } from '../../../primitives/visual-primitives/core/deep-dive/blocks/drawnDiagram';
import type { DeepDiveBlock, DiagramBlockData, FigureBlockData } from '../../../primitives/visual-primitives/core/deep-dive/types';

export const isDrawn = (b: DeepDiveBlock) => (b.blockType === 'figure' && (b as FigureBlockData).display.kind === 'svg') || (b.blockType === 'diagram' && !!(b as DiagramBlockData).svg);

/** The block's drawing, with a diagram's pins drawn on it. */
export function drawnSvg(b: DeepDiveBlock): string {
  if (b.blockType === 'figure') {
    const { display } = b as FigureBlockData;
    return display.kind === 'svg' ? sanitizeSvg(display.svg) : '';
  }
  const d = b as DiagramBlockData;
  const svg = sanitizeSvg(d.svg ?? '');
  const box = viewBoxOf(svg);
  if (!box) return svg;
  const r = box.width / 36;
  const pins = d.labels.map((l, i) => {
    const x = box.x + ((l.position?.x ?? 0) / 100) * box.width, y = box.y + ((l.position?.y ?? 0) / 100) * box.height;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#14b8a6" stroke="#fff" stroke-width="${r / 5}"/><text x="${x}" y="${y + r * 0.4}" font-size="${r * 1.1}" font-family="sans-serif" text-anchor="middle" fill="#fff">${i + 1}</text>`;
  }).join('');
  return svg.replace(/<\/svg>\s*$/i, `${pins}</svg>`);
}

/** What each pin in the screenshot names. */
export const pinKey = (b: DeepDiveBlock) => (b.blockType === 'diagram' ? (b as DiagramBlockData).labels.map((l, i) => `${i + 1} = ${l.text}`).join(', ') : '');
