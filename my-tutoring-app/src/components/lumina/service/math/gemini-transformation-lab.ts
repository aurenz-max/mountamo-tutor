import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";
import type {
  TransformationLabData,
  TransformationLabChallenge,
  TransformationLabChallengeType,
  GridPoint,
} from "../../primitives/visual-primitives/math/TransformationLab";

// ---------------------------------------------------------------------------
// Challenge type docs (one per eval mode) — feeds the constrained prompt
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  apply_translation_reflection: {
    promptDoc:
      `"apply_translation_reflection": Grade 8 entry. The student is given a pre-image and an instruction `
      + `(e.g., "translate by (3, -2)" or "reflect over the y-axis") and produces the image by dragging vertices to the correct grid points.`,
    schemaDescription: "'apply_translation_reflection' (produce a translation or reflection image)",
  },
  apply_rotation: {
    promptDoc:
      `"apply_rotation": Grade 8. The student rotates a figure 90°, 180°, or 270° counterclockwise about the origin and drags each vertex to its image.`,
    schemaDescription: "'apply_rotation' (rotate a figure about the origin)",
  },
  identify_transformation: {
    promptDoc:
      `"identify_transformation": Grade 8. Given a pre-image and its image, the student names the single transformation `
      + `(which reflection or which rotation) from multiple choices.`,
    schemaDescription: "'identify_transformation' (name the transformation from a pre/image pair)",
  },
  compose_sequence: {
    promptDoc:
      `"compose_sequence": Grade 8. The student reaches a target image by composing two or more transformations from a palette `
      + `(reflections, rotations, unit translations), reinforcing that a sequence of rigid motions preserves congruence.`,
    schemaDescription: "'compose_sequence' (reach a target with a sequence of transformations)",
  },
  dilation_similarity: {
    promptDoc:
      `"dilation_similarity": Grade 8. The student applies a scale factor about the origin (a dilation), producing a similar `
      + `(not congruent) image, and reasons about why size changes while shape is preserved.`,
    schemaDescription: "'dilation_similarity' (apply a dilation and reason about similarity)",
  },
};

// ---------------------------------------------------------------------------
// Per-mode instance counts
// ---------------------------------------------------------------------------

const DEFAULT_INSTANCE_COUNT = 4;
const MAX_INSTANCE_COUNT = 6;
const MIXED_INSTANCE_COUNT = 8;
const MIXED_MAX_COUNT = 12;

const COUNT_BY_MODE: Record<TransformationLabChallengeType, number> = {
  apply_translation_reflection: 4,
  apply_rotation: 4,
  identify_transformation: 4,
  compose_sequence: 4,
  dilation_similarity: 4,
};

// ---------------------------------------------------------------------------
// WITHIN-MODE SUPPORT TIERS (scaffolding withdrawal — NEVER changes the figure
// or the transformation; those are the eval-mode / task-identity axis).
//
// Levers discovered in TransformationLab.tsx (the drawing block, ~lines 378-398):
//   • showPreImageCoords  — the cyan pre-image vertex (x, y) labels. A perception
//                           aid (modality #1): offloads reading coordinates off
//                           the grid. SAFE at every tier on every mode — the
//                           pre-image is the QUESTION/start figure, never the answer.
//   • showRuleNotation    — an always-visible "transformation guide": the coordinate
//                           mapping rule (e.g. "(x, y) → (−x, y)") shown beside the
//                           canvas (modality #2, instruction-as-scaffold). At easy the
//                           student is handed the rule; at hard they must apply the
//                           transformation from the instruction's description alone.
//
// Intent: easy shows the pre-image reference + the rule notation; hard withdraws
// the rule (and pre-image coords) so the student applies the motion unaided.
//
// ANSWER-LEAK GUARD (acute for this primitive — a result preview IS the answer):
//   • drag modes (apply_*, dilation): the answer is the IMAGE the student produces.
//     We NEVER render expected-image coordinates or pre→image mapping arrows. The
//     pre-image coords are the START figure (safe). The rule notation names the
//     METHOD, not the answer coords — the student must still apply it per vertex.
//   • identify_transformation: the answer is the NAME of the transformation, so the
//     rule notation would BE the answer → showRuleNotation is FALSE at every tier
//     for this mode (only the pre-image coords lever applies).
//   • compose_sequence: the answer is the HOW (the move sequence). The ghost target
//     is shown by design (the WHERE). Rule notation here is generic palette guidance,
//     not the specific sequence → safe at easy.
//   The checker (polygonsMatch / correctOption in the component) reads expectedImage /
//   correctOption only — it is INDEPENDENT of every show* flag.
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/** One field per withdrawable scaffold lever discovered in the component. */
interface SupportScaffold {
  /** Cyan pre-image (x, y) vertex labels — perception aid. */
  showPreImageCoords: boolean;
  /** Always-visible coordinate-rule notation (the "transformation guide"). */
  showRuleNotation: boolean;
}

/** A leak-free coordinate-rule notation string for the always-on guide.
 *  NEVER returned for identify (the rule names the answer). */
function ruleNotation(type: TransformationLabChallengeType, transformLabel: string): string | undefined {
  if (type === 'identify_transformation') return undefined; // rule = the answer → withheld
  const l = transformLabel.toLowerCase();
  if (l.startsWith('translation by')) {
    const m = transformLabel.match(/\((-?\d+),\s*(-?\d+)\)/);
    return m ? `(x, y) → (x + ${m[1]}, y + ${m[2]})` : '(x, y) → (x + a, y + b)';
  }
  if (l.includes('x-axis')) return '(x, y) → (x, −y)';
  if (l.includes('y-axis')) return '(x, y) → (−x, y)';
  if (l.includes('y = x')) return '(x, y) → (y, x)';
  if (l.includes('90°')) return '(x, y) → (−y, x)';
  if (l.includes('180°')) return '(x, y) → (−x, −y)';
  if (l.includes('270°')) return '(x, y) → (y, −x)';
  if (l.startsWith('dilation')) {
    const m = transformLabel.match(/scale factor (\d+)/);
    return m ? `(x, y) → (${m[1]}x, ${m[1]}y)` : '(x, y) → (kx, ky)';
  }
  // compose_sequence and anything else: generic palette guidance (not the specific sequence).
  return 'Use the palette: flips/turns change orientation, arrows slide.';
}

/** Resolve the scaffold + prompt-tone lines for a mode at a tier.
 *  Scaffolding-only — never changes the figure, coordinates, or transformation. */
function resolveSupportStructure(
  type: TransformationLabChallengeType,
  tier: SupportTier,
): { scaffold: SupportScaffold; promptLines: string[] } {
  const isIdentify = type === 'identify_transformation';

  // showRuleNotation ladder: easy → on, medium → on, hard → off.
  // (identify never shows it at any tier — the rule names the answer.)
  const ruleOn = !isIdentify && tier !== 'hard';
  // showPreImageCoords ladder: easy → on, medium → off, hard → off.
  const coordsOn = tier === 'easy';

  const scaffold: SupportScaffold = {
    showPreImageCoords: coordsOn,
    showRuleNotation: ruleOn,
  };

  const promptLines: string[] = [
    'This tier sets the on-screen SCAFFOLDING LEVEL only. The figure, its coordinates, the transformation, and the answer are IDENTICAL across easy/medium/hard — do NOT change any number, vector, angle, or scale factor.',
  ];
  if (isIdentify) {
    promptLines.push(
      tier === 'easy'
        ? 'easy (identify): the pre-image vertex coordinates are labeled so the student can read corners off the grid; the transformation is NOT named (that is the answer).'
        : tier === 'medium'
        ? 'medium (identify): coordinate labels withdrawn — the student perceives the motion from the figures.'
        : 'hard (identify): no coordinate labels; the student names the motion purely from the pre-image/image pair.',
    );
  } else {
    promptLines.push(
      tier === 'easy'
        ? 'easy: a pre-image reference with vertex coordinates AND the coordinate-rule notation (the transformation guide) are shown — the student applies a handed rule per vertex.'
        : tier === 'medium'
        ? 'medium: the coordinate-rule notation stays as a guide, but pre-image coordinate labels are withdrawn.'
        : 'hard: NO rule notation and NO coordinate labels — the student applies the transformation from the written instruction alone.',
    );
  }
  return { scaffold, promptLines };
}

// ---------------------------------------------------------------------------
// Grid bounds (must match the component's GRID_MIN / GRID_MAX)
// ---------------------------------------------------------------------------

const LO = -7;
const HI = 7;

// ---------------------------------------------------------------------------
// Random helpers (deterministic local pool — per-challenge values built in code)
// ---------------------------------------------------------------------------

const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T,>(arr: T[]): T => arr[randInt(0, arr.length - 1)];

const shuffle = <T,>(arr: T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// ---------------------------------------------------------------------------
// Transform specs and pure geometry
// ---------------------------------------------------------------------------

type TransformSpec =
  | { kind: 'translation'; dx: number; dy: number }
  | { kind: 'reflect_x' }
  | { kind: 'reflect_y' }
  | { kind: 'reflect_yx' }
  | { kind: 'rotate90' }
  | { kind: 'rotate180' }
  | { kind: 'rotate270' }
  | { kind: 'dilate'; k: number };

function applyTransform(spec: TransformSpec, p: GridPoint): GridPoint {
  switch (spec.kind) {
    case 'translation': return { x: p.x + spec.dx, y: p.y + spec.dy };
    case 'reflect_x':   return { x: p.x, y: -p.y };
    case 'reflect_y':   return { x: -p.x, y: p.y };
    case 'reflect_yx':  return { x: p.y, y: p.x };
    case 'rotate90':    return { x: -p.y, y: p.x };   // 90° CCW about origin
    case 'rotate180':   return { x: -p.x, y: -p.y };
    case 'rotate270':   return { x: p.y, y: -p.x };   // 270° CCW (= 90° CW)
    case 'dilate':      return { x: p.x * spec.k, y: p.y * spec.k };
  }
}

const applyAll = (spec: TransformSpec, pts: GridPoint[]): GridPoint[] =>
  pts.map((p) => applyTransform(spec, p));

const place = (shape: GridPoint[], ox: number, oy: number): GridPoint[] =>
  shape.map((p) => ({ x: p.x + ox, y: p.y + oy }));

const withinBounds = (pts: GridPoint[]): boolean =>
  pts.every((p) => p.x >= LO && p.x <= HI && p.y >= LO && p.y <= HI);

const ptKey = (p: GridPoint) => `${p.x},${p.y}`;
const sameSet = (a: GridPoint[], b: GridPoint[]): boolean => {
  if (a.length !== b.length) return false;
  const sa = a.map(ptKey).sort();
  const sb = b.map(ptKey).sort();
  return sa.every((v, i) => v === sb[i]);
};
const maxMag = (pts: GridPoint[]): number =>
  pts.reduce((m, p) => Math.max(m, Math.abs(p.x), Math.abs(p.y)), 0);

function specLabel(spec: TransformSpec): string {
  switch (spec.kind) {
    case 'translation': return `Translation by (${spec.dx}, ${spec.dy})`;
    case 'reflect_x':   return 'Reflection over the x-axis';
    case 'reflect_y':   return 'Reflection over the y-axis';
    case 'reflect_yx':  return 'Reflection over the line y = x';
    case 'rotate90':    return 'Rotation 90° counterclockwise about the origin';
    case 'rotate180':   return 'Rotation 180° about the origin';
    case 'rotate270':   return 'Rotation 270° counterclockwise about the origin';
    case 'dilate':      return `Dilation about the origin by scale factor ${spec.k}`;
  }
}

// ---------------------------------------------------------------------------
// Asymmetric base polygons (3-4 vertices, local coords near origin)
// Asymmetry guarantees the image vertex SET differs from the pre-image set.
// ---------------------------------------------------------------------------

const BASE_SHAPES: GridPoint[][] = [
  [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 3 }],                 // right triangle
  [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 1, y: 2 }],                 // scalene triangle
  [{ x: 0, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 3 }],                 // scalene triangle
  [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }, { x: 0, y: 1 }], // trapezoid-ish quad
  [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 2 }, { x: 0, y: 2 }], // irregular quad
];

// Smaller shapes for dilations (so k·coord stays on the grid).
const SMALL_SHAPES: GridPoint[][] = [
  [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }],
  [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 2 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 2 }],
  [{ x: 0, y: 0 }, { x: 2, y: 1 }, { x: 0, y: 2 }],
];

type RawChallenge = Omit<TransformationLabChallenge, 'id'>;

// ---------------------------------------------------------------------------
// Narration contexts
// ---------------------------------------------------------------------------

const TRANS_CTX = ['A chess piece slides across the board', 'A boat drifts on a still lake', 'A sticker is peeled and re-placed', 'A floor tile shifts over'];
const REFLECT_CTX = ['A shape and its mirror image in a calm pond', 'A logo flipped across a fold line', 'A stamp pressed, then flipped', 'A reflection in a window'];
const ROTATE_CTX = ['A Ferris-wheel car swings around the center', 'A spinner turns about its pin', 'A figure pivots around the origin', 'A clock hand sweeps around'];
const IDENTIFY_CTX = ['A designer transformed this logo', 'Two stickers — figure out how one became the other', 'A figure was moved on the grid'];
const COMPOSE_CTX = ['A robot arm must move the part onto the target', 'A puzzle piece needs several moves to fit', 'Plan the moves to dock the shape on the target'];
const DILATE_CTX = ['A photo is enlarged on screen', 'A blueprint is scaled up', 'A shadow grows on the wall', 'A shape zoomed by the projector'];

// ---------------------------------------------------------------------------
// Builders (each returns a fully-formed RawChallenge with pre/image computed)
// ---------------------------------------------------------------------------

type TransReflSub = 'translation' | 'reflect_x' | 'reflect_y' | 'reflect_yx';

function buildTransRefl(sub: TransReflSub): RawChallenge {
  for (let t = 0; t < 200; t++) {
    const shape = pick(BASE_SHAPES);
    let pre: GridPoint[];
    let spec: TransformSpec;

    if (sub === 'translation') {
      pre = place(shape, randInt(-4, 0), randInt(-4, 0));
      const dx = pick([-4, -3, -2, 2, 3, 4]);
      const dy = pick([-3, -2, -1, 1, 2, 3]);
      spec = { kind: 'translation', dx, dy };
    } else if (sub === 'reflect_x') {
      pre = place(shape, randInt(-3, 2), randInt(1, 3)); // above the x-axis
      spec = { kind: 'reflect_x' };
    } else if (sub === 'reflect_y') {
      pre = place(shape, randInt(1, 3), randInt(-3, 1)); // right of the y-axis
      spec = { kind: 'reflect_y' };
    } else {
      pre = place(shape, randInt(-2, 2), randInt(-2, 2));
      spec = { kind: 'reflect_yx' };
    }

    const img = applyAll(spec, pre);
    if (!withinBounds(pre) || !withinBounds(img)) continue;
    if (sameSet(pre, img)) continue;

    const label = specLabel(spec);
    const instruction =
      sub === 'translation'
        ? `Translate the figure by (${(spec as { dx: number }).dx}, ${(spec as { dy: number }).dy}). Drag each pink corner to its new position.`
        : sub === 'reflect_x'
        ? 'Reflect the figure over the x-axis. Drag each pink corner to where it lands.'
        : sub === 'reflect_y'
        ? 'Reflect the figure over the y-axis. Drag each pink corner to its mirror position.'
        : 'Reflect the figure over the line y = x. Drag each pink corner to its image.';
    const hint =
      sub === 'translation'
        ? `Add (${(spec as { dx: number }).dx}, ${(spec as { dy: number }).dy}) to every vertex: x → x + ${(spec as { dx: number }).dx}, y → y + ${(spec as { dy: number }).dy}.`
        : sub === 'reflect_x'
        ? 'Reflecting over the x-axis keeps x and flips the sign of y: (x, y) → (x, −y).'
        : sub === 'reflect_y'
        ? 'Reflecting over the y-axis flips the sign of x: (x, y) → (−x, y).'
        : 'Reflecting over y = x swaps the coordinates: (x, y) → (y, x).';

    return {
      type: 'apply_translation_reflection',
      answerKind: 'drag',
      narration: `${pick(sub === 'translation' ? TRANS_CTX : REFLECT_CTX)}.`,
      instruction,
      hint,
      preImage: pre,
      expectedImage: img,
      transformLabel: label,
    };
  }
  // Fallback — guaranteed valid reflection over the y-axis.
  const pre = [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 3 }];
  return {
    type: 'apply_translation_reflection', answerKind: 'drag',
    narration: `${pick(REFLECT_CTX)}.`,
    instruction: 'Reflect the figure over the y-axis. Drag each pink corner to its mirror position.',
    hint: 'Reflecting over the y-axis flips the sign of x: (x, y) → (−x, y).',
    preImage: pre, expectedImage: applyAll({ kind: 'reflect_y' }, pre),
    transformLabel: 'Reflection over the y-axis',
  };
}

function buildRotation(kind: 'rotate90' | 'rotate180' | 'rotate270'): RawChallenge {
  for (let t = 0; t < 200; t++) {
    const shape = pick(BASE_SHAPES);
    const pre = place(shape, randInt(1, 3), randInt(1, 3)); // Quadrant I
    const spec: TransformSpec = { kind };
    const img = applyAll(spec, pre);
    if (!withinBounds(pre) || !withinBounds(img)) continue;
    if (sameSet(pre, img)) continue;

    const deg = kind === 'rotate90' ? 90 : kind === 'rotate180' ? 180 : 270;
    const instruction =
      kind === 'rotate180'
        ? 'Rotate the figure 180° about the origin. Drag each pink corner to its image.'
        : `Rotate the figure ${deg}° counterclockwise about the origin. Drag each pink corner to its image.`;
    const hint =
      kind === 'rotate90'
        ? 'A 90° counterclockwise turn sends (x, y) → (−y, x).'
        : kind === 'rotate180'
        ? 'A 180° turn sends (x, y) → (−x, −y).'
        : 'A 270° counterclockwise turn sends (x, y) → (y, −x).';

    return {
      type: 'apply_rotation', answerKind: 'drag',
      narration: `${pick(ROTATE_CTX)}.`,
      instruction, hint,
      preImage: pre, expectedImage: img,
      transformLabel: specLabel(spec),
    };
  }
  const pre = [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 2 }];
  return {
    type: 'apply_rotation', answerKind: 'drag',
    narration: `${pick(ROTATE_CTX)}.`,
    instruction: 'Rotate the figure 90° counterclockwise about the origin. Drag each pink corner to its image.',
    hint: 'A 90° counterclockwise turn sends (x, y) → (−y, x).',
    preImage: pre, expectedImage: applyAll({ kind: 'rotate90' }, pre),
    transformLabel: 'Rotation 90° counterclockwise about the origin',
  };
}

// identify — correct answer is one of the 6 reflection/rotation specs; distractors
// are 3 other labels from that pool (so same-category, different-parameter
// distractors appear and the parameter actually has to be read off the figure).
const IDENTIFY_SPECS: TransformSpec[] = [
  { kind: 'reflect_x' }, { kind: 'reflect_y' }, { kind: 'reflect_yx' },
  { kind: 'rotate90' }, { kind: 'rotate180' }, { kind: 'rotate270' },
];
const IDENTIFY_LABELS = IDENTIFY_SPECS.map(specLabel);

function buildIdentify(spec: TransformSpec): RawChallenge {
  let pre: GridPoint[] = [];
  let img: GridPoint[] = [];
  for (let t = 0; t < 200; t++) {
    const shape = pick(BASE_SHAPES);
    pre = place(shape, randInt(1, 3), randInt(1, 3)); // Quadrant I
    img = applyAll(spec, pre);
    if (withinBounds(pre) && withinBounds(img) && !sameSet(pre, img)) break;
  }
  const correctLabel = specLabel(spec);
  const distractors = shuffle(IDENTIFY_LABELS.filter((l) => l !== correctLabel)).slice(0, 3);
  const options = shuffle([correctLabel, ...distractors]);
  const correctOption = options.indexOf(correctLabel);

  return {
    type: 'identify_transformation', answerKind: 'identify',
    narration: `${pick(IDENTIFY_CTX)}.`,
    instruction: 'A single transformation maps the cyan pre-image onto the amber image. Which transformation is it?',
    hint: 'Track one corner from the pre-image to the image. Did it flip across an axis (a reflection) or turn around the origin (a rotation)? Then check the exact axis or angle.',
    preImage: pre, expectedImage: img,
    transformLabel: correctLabel,
    options, correctOption,
  };
}

function buildCompose(op1: TransformSpec): RawChallenge {
  for (let t = 0; t < 300; t++) {
    const shape = pick(BASE_SHAPES);
    const pre = place(shape, randInt(0, 3), randInt(0, 3));
    const mid = applyAll(op1, pre);
    const dx = pick([-3, -2, -1, 1, 2, 3]);
    const dy = pick([-3, -2, -1, 1, 2, 3]);
    const img = applyAll({ kind: 'translation', dx, dy }, mid);
    if (!withinBounds(pre) || !withinBounds(img)) continue;
    if (sameSet(pre, img)) continue;

    return {
      type: 'compose_sequence', answerKind: 'sequence',
      narration: `${pick(COMPOSE_CTX)}.`,
      instruction: 'Use the transformation buttons to move the pink figure exactly onto the dashed target. It takes more than one move.',
      hint: 'First match the orientation with a flip or a turn, then slide the figure onto the target with the arrow buttons.',
      preImage: pre, expectedImage: img,
      transformLabel: `${specLabel(op1)} followed by a translation by (${dx}, ${dy})`,
    };
  }
  const pre = [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 2 }];
  const mid = applyAll({ kind: 'reflect_y' }, pre);
  const img = applyAll({ kind: 'translation', dx: 1, dy: 1 }, mid);
  return {
    type: 'compose_sequence', answerKind: 'sequence',
    narration: `${pick(COMPOSE_CTX)}.`,
    instruction: 'Use the transformation buttons to move the pink figure exactly onto the dashed target. It takes more than one move.',
    hint: 'First match the orientation with a flip or a turn, then slide the figure onto the target with the arrow buttons.',
    preImage: pre, expectedImage: img,
    transformLabel: 'Reflection over the y-axis followed by a translation by (1, 1)',
  };
}

function buildDilation(k: number): RawChallenge {
  for (let t = 0; t < 200; t++) {
    const shape = pick(SMALL_SHAPES);
    const ox = k >= 3 ? 0 : randInt(0, 1);
    const oy = k >= 3 ? 0 : randInt(0, 1);
    const pre = place(shape, ox, oy);
    const spec: TransformSpec = { kind: 'dilate', k };
    const img = applyAll(spec, pre);
    if (!withinBounds(pre) || !withinBounds(img)) continue;
    if (sameSet(pre, img)) continue;

    return {
      type: 'dilation_similarity', answerKind: 'drag',
      narration: `${pick(DILATE_CTX)}.`,
      instruction: `Dilate the figure by a scale factor of ${k} about the origin. Drag each pink corner to its image.`,
      hint: `Multiply every coordinate by ${k}: (x, y) → (${k}x, ${k}y). The shape stays the same; only its size changes.`,
      preImage: pre, expectedImage: img,
      transformLabel: specLabel(spec),
      isSimilarity: true, scaleFactor: k,
    };
  }
  const pre = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }];
  return {
    type: 'dilation_similarity', answerKind: 'drag',
    narration: `${pick(DILATE_CTX)}.`,
    instruction: 'Dilate the figure by a scale factor of 2 about the origin. Drag each pink corner to its image.',
    hint: 'Multiply every coordinate by 2: (x, y) → (2x, 2y). The shape stays the same; only its size changes.',
    preImage: pre, expectedImage: applyAll({ kind: 'dilate', k: 2 }, pre),
    transformLabel: 'Dilation about the origin by scale factor 2',
    isSimilarity: true, scaleFactor: 2,
  };
}

// ---------------------------------------------------------------------------
// Dispatch one challenge of a given type (cycling sub-variants for variance)
// ---------------------------------------------------------------------------

const TRANS_REFL_SUBS: TransReflSub[] = ['translation', 'reflect_y', 'reflect_x', 'reflect_yx'];
const ROTATION_KINDS: Array<'rotate90' | 'rotate180' | 'rotate270'> = ['rotate90', 'rotate180', 'rotate270'];
const COMPOSE_OPS: TransformSpec[] = [
  { kind: 'reflect_y' }, { kind: 'reflect_x' }, { kind: 'rotate90' }, { kind: 'rotate180' }, { kind: 'rotate270' },
];
const DILATION_FACTORS = [2, 3];

function buildForType(type: TransformationLabChallengeType, variantIdx: number): RawChallenge {
  switch (type) {
    case 'apply_translation_reflection':
      return buildTransRefl(TRANS_REFL_SUBS[variantIdx % TRANS_REFL_SUBS.length]);
    case 'apply_rotation':
      return buildRotation(ROTATION_KINDS[variantIdx % ROTATION_KINDS.length]);
    case 'identify_transformation':
      return buildIdentify(IDENTIFY_SPECS[variantIdx % IDENTIFY_SPECS.length]);
    case 'compose_sequence':
      return buildCompose(COMPOSE_OPS[variantIdx % COMPOSE_OPS.length]);
    case 'dilation_similarity':
      return buildDilation(DILATION_FACTORS[variantIdx % DILATION_FACTORS.length]);
  }
}

// ---------------------------------------------------------------------------
// Canonical key for de-duplication within a session
// ---------------------------------------------------------------------------

const canonicalKey = (ch: RawChallenge): string =>
  `${ch.type}|${ch.preImage.map(ptKey).join(';')}|${ch.expectedImage.map(ptKey).join(';')}`;

// ---------------------------------------------------------------------------
// Per-challenge validation — reject anything the component can't render.
// ---------------------------------------------------------------------------

function isValid(ch: RawChallenge): boolean {
  if (!ch.preImage?.length || ch.preImage.length < 3) return false;
  if (!ch.expectedImage?.length || ch.expectedImage.length !== ch.preImage.length) return false;
  if (!withinBounds(ch.preImage) || !withinBounds(ch.expectedImage)) return false;
  if (sameSet(ch.preImage, ch.expectedImage)) return false; // non-identity
  if (!Number.isFinite(ch.expectedImage[0].x)) return false;
  if (ch.answerKind === 'identify') {
    if (!ch.options || ch.options.length !== 4) return false;
    if (ch.correctOption === undefined || ch.correctOption < 0 || ch.correctOption > 3) return false;
    if (new Set(ch.options).size !== 4) return false;
    if (ch.options[ch.correctOption] !== ch.transformLabel) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Build N distinct challenges for a single-mode session, with variance rules.
// ---------------------------------------------------------------------------

export function selectTransformationLabChallenges(
  challengeType: TransformationLabChallengeType,
  count?: number,
): TransformationLabChallenge[] {
  const target = Math.max(
    1,
    Math.min(MAX_INSTANCE_COUNT, count ?? COUNT_BY_MODE[challengeType] ?? DEFAULT_INSTANCE_COUNT),
  );

  const raw: RawChallenge[] = [];
  const seen = new Set<string>();
  // Rotate variants, guaranteeing ≥1 of each sub-category before back-filling.
  for (let a = 0; a < target * 20 && raw.length < target; a++) {
    const ch = buildForType(challengeType, a);
    if (!isValid(ch)) continue;
    const key = canonicalKey(ch);
    if (seen.has(key)) continue;
    seen.add(key);
    raw.push(ch);
  }
  // Fallback — accept duplicates if the candidate space was too narrow.
  let g = 0;
  while (raw.length < target) {
    const ch = buildForType(challengeType, g++);
    if (isValid(ch)) raw.push(ch);
    if (g > target * 40) break;
  }

  // Order easier → harder by figure magnitude (a mild difficulty proxy).
  const sorted = raw.sort((a, b) => maxMag(a.preImage) - maxMag(b.preImage));
  return sorted.map((ch, i) => ({ ...ch, id: `tl-${i + 1}` }));
}

// ---------------------------------------------------------------------------
// MIXED session — interleave all five tiers, easy → hard (SP-21 Auto path).
// ---------------------------------------------------------------------------

const TIER_ORDER: TransformationLabChallengeType[] = [
  'apply_translation_reflection', // β2.5 — slide / flip
  'apply_rotation',               // β3.5 — turn about origin
  'identify_transformation',      // β4.0 — name the motion
  'compose_sequence',             // β5.0 — sequence of motions
  'dilation_similarity',          // β5.5 — scale / similarity
];
const TIER_RANK: Record<TransformationLabChallengeType, number> = TIER_ORDER.reduce(
  (acc, t, i) => { acc[t] = i; return acc; },
  {} as Record<TransformationLabChallengeType, number>,
);

export function selectMixedTransformationLabChallenges(count?: number): TransformationLabChallenge[] {
  const target = Math.max(TIER_ORDER.length, Math.min(MIXED_MAX_COUNT, count ?? MIXED_INSTANCE_COUNT));
  const rotation = shuffle(TIER_ORDER);
  const raw: RawChallenge[] = [];
  const seen = new Set<string>();
  const variantByType: Record<string, number> = {};

  for (let a = 0; a < target * 16 && raw.length < target; a++) {
    const type = rotation[raw.length % rotation.length];
    const v = variantByType[type] ?? 0;
    variantByType[type] = v + 1;
    const ch = buildForType(type, v);
    if (!isValid(ch)) continue;
    const key = canonicalKey(ch);
    if (seen.has(key)) continue;
    seen.add(key);
    raw.push(ch);
  }
  while (raw.length < target) {
    const type = TIER_ORDER[raw.length % TIER_ORDER.length];
    const ch = buildForType(type, raw.length);
    if (isValid(ch)) raw.push(ch);
    else break;
  }

  // Scale low → high: tier rank primary, figure magnitude as the in-tier tiebreaker.
  const sorted = raw.sort((a, b) => {
    const dr = TIER_RANK[a.type] - TIER_RANK[b.type];
    return dr !== 0 ? dr : maxMag(a.preImage) - maxMag(b.preImage);
  });
  return sorted.map((ch, i) => ({ ...ch, id: `tl-${i + 1}` }));
}

// ---------------------------------------------------------------------------
// Schema (wrapper metadata only — Gemini does NOT emit per-challenge data)
// ---------------------------------------------------------------------------

const transformationLabSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Title for the multi-problem transformation session (e.g., 'Rotations on the Coordinate Plane'). Do NOT name specific coordinates, vectors, or answers — the session walks through several figures.",
    },
    description: {
      type: Type.STRING,
      description: "1-2 sentence educational description of what students will practice across the session.",
    },
    challengeType: {
      type: Type.STRING,
      enum: [
        'apply_translation_reflection', 'apply_rotation', 'identify_transformation',
        'compose_sequence', 'dilation_similarity',
      ],
      description: "Difficulty tier of the session. The system uses this to build the transformation problem pool.",
    },
    gradeBand: {
      type: Type.STRING,
      enum: ['8'],
      description: "Target grade band (always '8' for transformations & similarity).",
    },
  },
  required: ['title', 'description', 'challengeType'],
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

type TransformationLabConfig = {
    instanceCount?: number;
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-screen scaffolding within it. NEVER changes numbers.
     */
    difficulty?: string;
};

export const generateTransformationLab = async (
  ctx: GenerationContext,
): Promise<TransformationLabData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as TransformationLabConfig;
  const validTypes: TransformationLabChallengeType[] = [
    'apply_translation_reflection', 'apply_rotation', 'identify_transformation',
    'compose_sequence', 'dilation_similarity',
  ];

  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'transformation-lab',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(transformationLabSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : transformationLabSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // ── Support tier (scaffolding level WITHIN the mode — never changes numbers) ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  // pinnedType drives the prompt TONE only (a blended session has no single mode).
  const pinnedType =
    evalConstraint?.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as TransformationLabChallengeType)
      : undefined;
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier)
    : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT figure or transformation)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  const prompt = `
Create the wrapper metadata for a multi-problem geometry transformation session on "${topic}" for ${gradeLevel} students.

CONTEXT:
- A transformation session contains 3-6 separate problems, all of the same challenge type.
- The system has ALREADY pre-built each problem (figures, coordinates, transformations, and answers) — you do NOT pick coordinates, vectors, angles, scale factors, or answers.
- Your job is only to write the session-level title and description, and to set the challengeType + gradeBand.

${challengeTypeSection}
${tierSection}
REQUIREMENTS:
1. Write a clear, student-friendly title for the whole session. Do NOT name any specific coordinate, vector, angle, or answer.
2. Provide a 1-2 sentence educational description of what students will practice.
3. Set challengeType to the correct difficulty tier (matches the constraint above).
4. Set gradeBand to "8".

Return ONLY the wrapper fields described above.
`;

  logEvalModeResolution('TransformationLab', config?.targetEvalMode, evalConstraint);

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      temperature: 0.9,
      topP: 0.95,
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const wrapper = result.text ? JSON.parse(result.text) : null;
  if (!wrapper) {
    throw new Error('No valid transformation-lab wrapper returned from Gemini API');
  }

  // ── Auto (mixed) path: no eval-mode constraint → interleave ALL five tiers,
  //    scaled easy→hard (SP-21). IRT-pinned modes always have a constraint and
  //    fall through to the single-type path below. ──
  const isMixed = evalConstraint === null;

  // ── Resolve challengeType (Gemini → eval constraint → safe default) ──
  // For mixed sessions this is representative metadata only: the component
  // renders per-challenge from `currentChallenge.type`, never the top-level field.
  let challengeType: TransformationLabChallengeType = isMixed
    ? 'apply_translation_reflection' // lowest tier — where the mixed session begins
    : validTypes.includes(wrapper.challengeType as TransformationLabChallengeType)
      ? (wrapper.challengeType as TransformationLabChallengeType)
      : (evalConstraint?.allowedTypes[0] as TransformationLabChallengeType) ?? 'apply_translation_reflection';
  if (!validTypes.includes(challengeType)) challengeType = 'apply_translation_reflection';

  // ── Build the per-challenge pool locally ──
  const challenges = isMixed
    ? selectMixedTransformationLabChallenges(config?.instanceCount)
    : selectTransformationLabChallenges(challengeType, config?.instanceCount);

  // ── Apply the support tier PER CHALLENGE, from each challenge's OWN mode ──
  //    Gated only on a tier being present (so blended/auto sessions get it too).
  //    Display-only: the checker reads expectedImage / correctOption, never show*.
  if (supportTier) {
    for (const ch of challenges) {
      const { scaffold } = resolveSupportStructure(ch.type, supportTier);
      ch.showPreImageCoords = scaffold.showPreImageCoords;
      // Resolve the leak-free rule notation only when the tier shows it.
      ch.ruleNotation = scaffold.showRuleNotation
        ? ruleNotation(ch.type, ch.transformLabel)
        : undefined;
      ch.supportTier = supportTier;
    }
    console.log(
      `[TransformationLab] Support tier "${supportTier}" applied per-challenge `
      + `(${pinnedType ? `single-mode ${pinnedType}` : 'blended'})`,
    );
  }

  const data: TransformationLabData = {
    title: wrapper.title,
    description: wrapper.description,
    challengeType,
    gradeBand: '8',
    challenges,
  };

  const summary = challenges
    .map((c) => `${c.type}/${c.transformLabel.replace(/ about the origin/, '').slice(0, 22)}`)
    .join(', ');
  console.log(`[TransformationLab] Final: challengeType=${challengeType}, mixed=${isMixed}, instances=${challenges.length} [${summary}]`);

  return data;
};
