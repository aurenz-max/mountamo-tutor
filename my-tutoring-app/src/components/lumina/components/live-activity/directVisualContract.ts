type Base = { instruction: string; highlightedIndices: number[] };
const instructionSchema = { type: 'STRING', description: 'Short learner instruction, at most 240 characters. Do not include the answer you are asking for.' };
const schema = (properties: Record<string, unknown>) => ({ type: 'OBJECT', properties: { ...properties, instruction: instructionSchema }, required: [...Object.keys(properties), 'instruction'] });
export const DIRECT_VISUAL_OFFERS = [
  { name: 'show_counters', primitiveId: 'live-counters', description: 'Display 0–20 counters. The learner can tap to cross them out. Replaces the workspace.',
    parameters: schema({ count: { type: 'INTEGER', minimum: 0, maximum: 20 }, layout: { type: 'STRING', enum: ['ten_frame', 'rows'] } }) },
  { name: 'show_fraction', primitiveId: 'live-fraction', description: 'Display a fraction bar with numerator parts shaded out of denominator equal parts. The learner can toggle shading. Replaces the workspace.',
    parameters: schema({ numerator: { type: 'INTEGER', minimum: 0, maximum: 12 }, denominator: { type: 'INTEGER', minimum: 2, maximum: 12 } }) },
  { name: 'show_letter_tiles', primitiveId: 'live-letters', description: 'Display letter or grapheme tiles for blending, spelling or sound discussion. The learner can select tiles. Replaces the workspace.',
    parameters: schema({ tiles: { type: 'ARRAY', minItems: 1, maxItems: 12, items: { type: 'STRING', description: 'One alphabetic letter or grapheme, at most 8 characters.' } } }) },
];

/** Parameter-to-renderer mapping stays beside the renderer contract, never in Python. */
export function buildDirectVisual(name: string, value: unknown): DirectVisualData {
  const args = value as Record<string, any>;
  if (!args || typeof args !== 'object') throw new Error('Invalid visual parameters.');
  const base = { instruction: args.instruction, highlightedIndices: [] };
  if (name === 'show_counters') return parseDirectVisual({ ...base, kind: 'counters', count: args.count, layout: args.layout, removedIndices: [] });
  if (name === 'show_fraction') {
    if (!Number.isInteger(args.numerator) || !Number.isInteger(args.denominator)
      || args.numerator < 0 || args.numerator > args.denominator || args.denominator > 12) throw new Error('Invalid fraction.');
    return parseDirectVisual({ ...base, kind: 'fraction', denominator: args.denominator, shadedIndices: Array.from({ length: args.numerator }, (_, i) => i) });
  }
  if (name === 'show_letter_tiles') return parseDirectVisual({ ...base, kind: 'letters', tiles: args.tiles, selectedIndices: [] });
  throw new Error('Unsupported direct visual tool.');
}
const letterTile = new RegExp('^\\p{L}{1,8}$', 'u');
export type DirectVisualData = Base & (
  | { kind: 'counters'; count: number; layout: 'ten_frame' | 'rows'; removedIndices: number[] }
  | { kind: 'fraction'; denominator: number; shadedIndices: number[] }
  | { kind: 'letters'; tiles: string[]; selectedIndices: number[] }
);
export type MountedVisual = { callId: string; instanceId: string; data: DirectVisualData };
export const visualSize = (data: DirectVisualData) => data.kind === 'counters' ? data.count
  : data.kind === 'fraction' ? data.denominator : data.tiles.length;

export function validIndices(value: unknown, size: number): value is number[] {
  return Array.isArray(value) && value.length <= size
    && value.every(i => Number.isInteger(i) && i >= 0 && i < size) && new Set(value).size === value.length;
}

export function parseDirectVisual(value: unknown): DirectVisualData {
  const d = value as DirectVisualData;
  if (!d || typeof d.instruction !== 'string' || !d.instruction.trim() || d.instruction.length > 240)
    throw new Error('The visual needs a short instruction.');
  if (d.kind === 'counters') {
    if (!Number.isInteger(d.count) || d.count < 0 || d.count > 20 || !['ten_frame', 'rows'].includes(d.layout)
        || !validIndices(d.removedIndices, d.count)) throw new Error('Invalid counters.');
  } else if (d.kind === 'fraction') {
    if (!Number.isInteger(d.denominator) || d.denominator < 2 || d.denominator > 12
        || !validIndices(d.shadedIndices, d.denominator)) throw new Error('Invalid fraction.');
  } else if (d.kind === 'letters') {
    if (!Array.isArray(d.tiles) || !d.tiles.length || d.tiles.length > 12
        || d.tiles.some(t => typeof t !== 'string' || !letterTile.test(t))
        || !validIndices(d.selectedIndices, d.tiles.length)) throw new Error('Invalid letter tiles.');
  } else throw new Error('Unsupported direct visual.');
  if (!validIndices(d.highlightedIndices, visualSize(d))) throw new Error('Invalid highlighting.');
  return d;
}

export function visualState(data: DirectVisualData): Record<string, unknown> {
  return { ...data, ...(data.kind === 'counters' ? { remainingCount: data.count - data.removedIndices.length }
    : data.kind === 'fraction' ? { shadedCount: data.shadedIndices.length }
      : { selectedTiles: data.selectedIndices.map(i => data.tiles[i]) }) };
}
