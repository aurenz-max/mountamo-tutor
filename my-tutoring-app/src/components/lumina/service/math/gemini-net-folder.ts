import { Type, Schema } from '@google/genai';
import {
  NetFolderData,
  NetFolderChallenge,
  NetFolderSolid,
  SolidType,
  NetLayout,
} from '../../primitives/visual-primitives/math/NetFolder';
import { ai } from '../geminiClient';
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection } from '../scopeContext';
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';
import { boxDims, matchItem, solidWords, validItem } from '../../primitives/visual-primitives/math/netFolderWorkspace';
import { INVALID_CUBE_NETS, VALID_CUBE_NETS, cellsOf } from '../../primitives/visual-primitives/math/netFolderGeometry';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  identify_solid: {
    promptDoc:
      `"identify_solid": Student sees a 3D solid and must identify it from multiple choice options. `
      + `Generate 4 plausible solid names as options.`,
    schemaDescription: "'identify_solid' (Identify the 3D Solid)",
  },
  count_faces_edges_vertices: {
    promptDoc:
      `"count_faces_edges_vertices": Student counts the faces, edges, and vertices of a 3D solid. `
      + `No special challenge data needed — component checks against solid properties.`,
    schemaDescription: "'count_faces_edges_vertices' (Count FEV)",
  },
  match_faces: {
    promptDoc:
      `"match_faces": Student matches a highlighted face on the 2D net to the corresponding face on the 3D solid. `
      + `Generate the highlighted face label and face options.`,
    schemaDescription: "'match_faces' (Match Net Faces to Solid)",
  },
  valid_net: {
    promptDoc:
      `"valid_net": Student determines whether a given net arrangement folds into a valid solid. `
      + `Generate the net layout description, whether it's valid, and an explanation.`,
    schemaDescription: "'valid_net' (Valid Net Check)",
  },
  surface_area: {
    promptDoc:
      `"surface_area": Student calculates total surface area by adding up face areas. `
      + `Generate face dimensions for each face.`,
    schemaDescription: "'surface_area' (Surface Area Calculation)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode support tiers (config.difficulty) — FOLD-SCAFFOLD axis
// ---------------------------------------------------------------------------
// The tier toggles FOLD SCAFFOLDS only (fold-line guides + face-match hints) —
// it never changes the net, the chosen solid, or which solid the net folds into.
// That (the net complexity / target solid) is the EVAL-MODE axis. See
// [[feedback_support-tiers-natural-levers]] / [[structural-difficulty-not-numeric]].

type ChallengeType =
  | 'identify_solid'
  | 'count_faces_edges_vertices'
  | 'match_faces'
  | 'valid_net'
  | 'surface_area';

type SupportTier = 'easy' | 'medium' | 'hard';

const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/**
 * STRICT lookup — the manifest enum-constrains config.difficulty to these.
 * Unknown/absent → null (no tier applied; grade-band defaults stand).
 */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

interface SupportScaffold {
  /** Dashed fold-line guides between adjacent net faces — show where the net
   *  hinges/folds. The core fold scaffold; withdrawn at the hard tier. */
  showFoldGuides: boolean;
  /** Face-match correspondence highlighting (tap a net face → its match lights
   *  up on the solid). ANSWER-LEAK GUARD: forced false at EVERY tier on
   *  match_faces / valid_net, where the correspondence IS the asked answer. */
  showFaceMatchHints: boolean;
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

/**
 * Resolve the on-screen FOLD scaffolds for a tier on a given challenge type.
 * Support is withdrawn as the tier hardens; the per-mode lines reframe the SAME
 * task with fewer fold cues — never a different net, never a different solid.
 *
 * ANSWER-LEAK GUARD: on match_faces / valid_net the face↔solid correspondence
 * IS (or directly reveals) the asked answer, so face-match highlighting is OFF
 * at every tier for those modes — it can only appear where the match is NOT the
 * answer (identify_solid / surface_area / count_faces_edges_vertices). The
 * component's checkers read only targetAnswer / isValidNet, never any show*
 * flag, so the checker stays independent of these scaffolds.
 */
function resolveSupportStructure(pinnedType: ChallengeType, tier: SupportTier): SupportScaffold {
  const showFoldGuides = tier !== 'hard';
  // Match-is-the-answer guard: never expose correspondence on these modes.
  const matchIsAnswer = pinnedType === 'match_faces' || pinnedType === 'valid_net';
  const showFaceMatchHints = !matchIsAnswer && tier === 'easy';

  const promptLines: string[] = [
    `Support tier: ${tier.toUpperCase()} — this sets on-screen FOLD SCAFFOLDING only (${tier === 'easy' ? 'maximum support: fold-line guides and face-match hints help the student see how the net folds' : tier === 'medium' ? 'moderate support: fold-line guides stay, face-match hints withdrawn' : 'minimum support: no fold-line guides, no face-match hints — the student imagines the fold unaided'}). NEVER change the net, the chosen solid, or which solid the net folds into (that is the eval-mode axis); only change how much fold help is on screen.`,
  ];
  switch (pinnedType) {
    case 'match_faces':
      promptLines.push(
        tier === 'easy'
          ? 'Fold-line guides are shown on the net so the student can trace the hinges to the highlighted face; face-match highlighting stays OFF because the correspondence is the answer. Hints may describe the folding path without naming the target face.'
          : tier === 'hard'
            ? 'No fold-line guides; the student must imagine folding the net edge by edge. Hints ask the student what they picture, never name which face the highlighted net face folds to.'
            : 'Fold-line guides are shown; hints prompt the student to follow the hinges themselves without naming the target face.',
      );
      break;
    case 'valid_net':
      promptLines.push(
        tier === 'easy'
          ? 'Fold-line guides mark every hinge so the student can mentally fold and check for overlaps/gaps; face-match highlighting stays OFF (validity is the answer). Hints describe how to test the fold without revealing valid/invalid.'
          : tier === 'hard'
            ? 'No fold-line guides; the student must visualize the whole fold unaided. Hints ask what would happen as faces come together, never state whether it is valid.'
            : 'Fold-line guides are shown; the student folds along them mentally and decides, with hints that do not reveal the verdict.',
      );
      break;
    case 'identify_solid':
    case 'count_faces_edges_vertices':
    case 'surface_area':
      promptLines.push(
        tier === 'easy'
          ? 'Fold-line guides and face-match highlighting are both available so the student can connect the net to the solid; hints may walk through the fold.'
          : tier === 'hard'
            ? 'No fold-line guides and no face-match highlighting; hints ask the student to reason about the solid by imagining the fold themselves.'
            : 'Fold-line guides are shown but face-match highlighting is withdrawn; hints point to the hinges without doing the matching for the student.',
      );
      break;
  }
  return { showFoldGuides, showFaceMatchHints, promptLines };
}

// ---------------------------------------------------------------------------
// Solid geometry lookup table — NEVER trust Gemini for these values
// ---------------------------------------------------------------------------

interface SolidGeometry {
  faces: number;
  edges: number;
  vertices: number;
  faceLabels: string[];
  defaultLayout: NetLayout;
}

const SOLID_GEOMETRY: Record<string, SolidGeometry> = {
  cube: {
    faces: 6, edges: 12, vertices: 8,
    faceLabels: ['front', 'back', 'left', 'right', 'top', 'bottom'],
    defaultLayout: 'cross',
  },
  rectangular_prism: {
    faces: 6, edges: 12, vertices: 8,
    faceLabels: ['front', 'back', 'left', 'right', 'top', 'bottom'],
    defaultLayout: 'cross',
  },
  triangular_prism: {
    faces: 5, edges: 9, vertices: 6,
    faceLabels: ['front', 'back', 'left', 'right', 'bottom'],
    defaultLayout: 'cross',
  },
  square_pyramid: {
    faces: 5, edges: 8, vertices: 5,
    faceLabels: ['base', 'front', 'back', 'left', 'right'],
    defaultLayout: 'cross',
  },
  triangular_pyramid: {
    faces: 4, edges: 6, vertices: 4,
    faceLabels: ['base', 'front', 'left', 'right'],
    defaultLayout: 'cross',
  },
};

const SOLID_TYPES = Object.keys(SOLID_GEOMETRY);

function isValidSolidType(s: unknown): s is string {
  return typeof s === 'string' && SOLID_TYPES.includes(s);
}

// ---------------------------------------------------------------------------
// Grade-band helpers
// ---------------------------------------------------------------------------

function resolveGradeBand(gradeLevel: string): '3-4' | '4-5' {
  const gl = gradeLevel.toLowerCase();
  if (gl.includes('5') || gl.includes('4-5')) return '4-5';
  return '3-4';
}

/**
 * Canonical-grade → band mapper (systemic 14m). resolveGradeBand() above only
 * ever saw `gradeContext` PROSE, and its bare-'5' test matches the '5' in the
 * production elementary sentence ("grades 1-5") — so EVERY elementary lesson
 * landed '4-5' (5-solid pool + grid overlay) and '3-4' was unreachable. The
 * legacy test only promoted an explicit 5, so the mapper keeps grades ≤4 on
 * '3-4' (below-range grades clamp to that floor rung) and 5+ on '4-5'.
 * Returns null without a canonical grade (the prose fallback stands).
 */
export function netFolderGradeBandFromGrade(grade?: string): '3-4' | '4-5' | null {
  if (!grade) return null;
  const g = grade.trim().toUpperCase();
  if (g === 'K') return '3-4';
  const n = parseInt(g, 10);
  if (isNaN(n)) return null;
  return n >= 5 ? '4-5' : '3-4';
}

function gradeSolidPool(gradeBand: string): string[] {
  if (gradeBand === '3-4') return ['cube', 'rectangular_prism', 'square_pyramid'];
  return ['cube', 'rectangular_prism', 'triangular_prism', 'square_pyramid', 'triangular_pyramid'];
}

function randomSolid(gradeBand: string): string {
  const pool = gradeSolidPool(gradeBand);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Randomize themes
const SCENARIO_THEMES = [
  'exploring a gift box factory',
  'building a cardboard fort',
  'designing a treasure chest',
  'creating a birdhouse',
  'making a dice for board games',
  'constructing a pyramid model',
];

function randomTheme(): string {
  return SCENARIO_THEMES[Math.floor(Math.random() * SCENARIO_THEMES.length)];
}

// ---------------------------------------------------------------------------
// Build the top-level solid data from Gemini's chosen type (or override)
// ---------------------------------------------------------------------------

function buildSolid(solidType: string, gradeBand: string): NetFolderSolid {
  const geo = SOLID_GEOMETRY[solidType] ?? SOLID_GEOMETRY.cube;
  const friendlyNames: Record<string, string> = {
    cube: 'Cube',
    rectangular_prism: 'Rectangular Prism',
    triangular_prism: 'Triangular Prism',
    square_pyramid: 'Square Pyramid',
    triangular_pyramid: 'Triangular Pyramid',
  };

  // Reasonable dimensions per solid type
  const dims: Record<string, { length: number; width: number; height: number }> = {
    cube: { length: 80, width: 80, height: 80 },
    rectangular_prism: { length: 100, width: 60, height: 50 },
    triangular_prism: { length: 80, width: 60, height: 70 },
    square_pyramid: { length: 80, width: 80, height: 70 },
    triangular_pyramid: { length: 70, width: 70, height: 60 },
  };

  const d = dims[solidType] ?? dims.cube;

  return {
    type: solidType as SolidType,
    name: friendlyNames[solidType] ?? 'Cube',
    dimensions: { length: d.length, width: d.width, height: d.height },
    faces: geo.faces,
    edges: geo.edges,
    vertices: geo.vertices,
  };
}

// ---------------------------------------------------------------------------
// Flat → structured helpers
// ---------------------------------------------------------------------------

interface FlatChallenge {
  [key: string]: unknown;
}

function collectStrings(flat: FlatChallenge, prefix: string, maxSlots: number): string[] | undefined {
  const out: string[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const v = flat[`${prefix}${i}`];
    if (typeof v === 'string' && v.trim()) out.push(v.trim());
  }
  return out.length > 0 ? out : undefined;
}

function collectFaceDimensions(
  flat: FlatChallenge,
  prefix: string,
  maxSlots: number,
): Array<{ width: number; height: number }> | undefined {
  const dims: Array<{ width: number; height: number }> = [];
  for (let i = 0; i < maxSlots; i++) {
    const w = flat[`${prefix}${i}Width`];
    const h = flat[`${prefix}${i}Height`];
    if (typeof w === 'number' && w > 0 && typeof h === 'number' && h > 0) {
      dims.push({ width: w, height: h });
    }
  }
  return dims.length > 0 ? dims : undefined;
}

// ---------------------------------------------------------------------------
// Validate base challenge fields (shared across all types)
// ---------------------------------------------------------------------------

function hasBaseFields(flat: FlatChallenge): boolean {
  return (
    typeof flat.id === 'string' && flat.id.trim() !== '' &&
    typeof flat.instruction === 'string' && flat.instruction.trim() !== '' &&
    typeof flat.hint === 'string' && flat.hint.trim() !== '' &&
    typeof flat.narration === 'string' && flat.narration.trim() !== ''
  );
}

// ===========================================================================
// Per-type schemas — focused, all fields required, no nullable fields
// ===========================================================================

const identifySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    solidType: {
      type: Type.STRING,
      description: "Solid type for this activity: 'cube', 'rectangular_prism', 'triangular_prism', 'square_pyramid', 'triangular_pyramid'",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Unique challenge ID' },
          instruction: { type: Type.STRING, description: 'Student-facing instruction' },
          hint: { type: Type.STRING, description: 'Hint shown after incorrect attempts' },
          narration: { type: Type.STRING, description: 'AI tutor narration for this challenge' },
          targetAnswer: { type: Type.STRING, description: 'The correct solid name' },
          option0: { type: Type.STRING, description: 'Answer option 1 (a solid name)' },
          option1: { type: Type.STRING, description: 'Answer option 2 (a solid name)' },
          option2: { type: Type.STRING, description: 'Answer option 3 (a solid name)' },
          option3: { type: Type.STRING, description: 'Answer option 4 (a solid name)' },
        },
        required: ['id', 'instruction', 'hint', 'narration', 'targetAnswer', 'option0', 'option1', 'option2', 'option3'],
      },
      description: '4-5 identify challenges',
    },
  },
  required: ['solidType', 'challenges'],
};

const matchFacesSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    solidType: {
      type: Type.STRING,
      description: "Solid type: 'cube', 'rectangular_prism', 'square_pyramid'",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Unique challenge ID' },
          instruction: { type: Type.STRING, description: 'Student-facing instruction' },
          hint: { type: Type.STRING, description: 'Hint shown after incorrect attempts' },
          narration: { type: Type.STRING, description: 'AI tutor narration' },
          highlightedFace: { type: Type.STRING, description: "Which face is highlighted on the net (e.g. 'top', 'front')" },
          targetAnswer: { type: Type.STRING, description: 'Correct face label on the solid' },
          faceOption0: { type: Type.STRING, description: 'Face option 1' },
          faceOption1: { type: Type.STRING, description: 'Face option 2' },
          faceOption2: { type: Type.STRING, description: 'Face option 3' },
          faceOption3: { type: Type.STRING, description: 'Face option 4' },
        },
        required: ['id', 'instruction', 'hint', 'narration', 'highlightedFace', 'targetAnswer', 'faceOption0', 'faceOption1', 'faceOption2', 'faceOption3'],
      },
      description: '4-5 match_faces challenges',
    },
  },
  required: ['solidType', 'challenges'],
};

const validNetSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    solidType: {
      type: Type.STRING,
      description: "Solid type: 'cube', 'rectangular_prism', 'square_pyramid'",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Unique challenge ID' },
          instruction: { type: Type.STRING, description: 'Student-facing instruction' },
          hint: { type: Type.STRING, description: 'Hint for incorrect attempts' },
          narration: { type: Type.STRING, description: 'AI tutor narration' },
          netLayout: { type: Type.STRING, description: 'Description of the net arrangement' },
          isValidNet: { type: Type.BOOLEAN, description: 'Whether this net folds into the solid' },
          netExplanation: { type: Type.STRING, description: 'Explanation of why the net is valid or invalid' },
        },
        required: ['id', 'instruction', 'hint', 'narration', 'netLayout', 'isValidNet', 'netExplanation'],
      },
      description: '4-5 valid_net challenges (mix of valid and invalid)',
    },
  },
  required: ['solidType', 'challenges'],
};

const surfaceAreaSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    solidType: {
      type: Type.STRING,
      description: "Solid type: 'cube', 'rectangular_prism'",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Unique challenge ID' },
          instruction: { type: Type.STRING, description: 'Student-facing instruction' },
          hint: { type: Type.STRING, description: 'Hint for incorrect attempts' },
          narration: { type: Type.STRING, description: 'AI tutor narration' },
          unitLabel: { type: Type.STRING, description: "Unit label e.g. 'square cm', 'square units'" },
          face0Width: { type: Type.NUMBER, description: 'Face 1 width' },
          face0Height: { type: Type.NUMBER, description: 'Face 1 height' },
          face1Width: { type: Type.NUMBER, description: 'Face 2 width' },
          face1Height: { type: Type.NUMBER, description: 'Face 2 height' },
          face2Width: { type: Type.NUMBER, description: 'Face 3 width' },
          face2Height: { type: Type.NUMBER, description: 'Face 3 height' },
          face3Width: { type: Type.NUMBER, description: 'Face 4 width' },
          face3Height: { type: Type.NUMBER, description: 'Face 4 height' },
          face4Width: { type: Type.NUMBER, description: 'Face 5 width' },
          face4Height: { type: Type.NUMBER, description: 'Face 5 height' },
          face5Width: { type: Type.NUMBER, description: 'Face 6 width' },
          face5Height: { type: Type.NUMBER, description: 'Face 6 height' },
        },
        required: [
          'id', 'instruction', 'hint', 'narration', 'unitLabel',
          'face0Width', 'face0Height', 'face1Width', 'face1Height',
          'face2Width', 'face2Height', 'face3Width', 'face3Height',
          'face4Width', 'face4Height', 'face5Width', 'face5Height',
        ],
      },
      description: '4-5 surface_area challenges for 6-faced solids',
    },
  },
  required: ['solidType', 'challenges'],
};

const countFEVSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    solidType: {
      type: Type.STRING,
      description: "Solid type for the activity",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Unique challenge ID' },
          instruction: { type: Type.STRING, description: 'Student-facing instruction about counting faces, edges, vertices' },
          hint: { type: Type.STRING, description: 'Hint for incorrect attempts' },
          narration: { type: Type.STRING, description: 'AI tutor narration' },
        },
        required: ['id', 'instruction', 'hint', 'narration'],
      },
      description: '4-5 counting FEV challenges',
    },
  },
  required: ['solidType', 'challenges'],
};

// ===========================================================================
// Per-type sub-generators
// ===========================================================================

/**
 * One challenge per solid (`solids`, in order): the model writes the words, code sets each challenge's solid, its
 * answer and its options (the answer and three other solids). Five challenges on one solid had one answer five times.
 */
async function generateIdentifyChallenges(
  topic: string,
  scopeSection: string,
  gradeLevel: string,
  solids: string[],
  tierSection: string,
): Promise<{ solidType: string; challenges: NetFolderChallenge[] }> {
  const prompt = `
Create an educational 3D solid IDENTIFICATION activity for "${topic}" (${gradeLevel} students).
${scopeSection}
Theme: ${randomTheme()}.
${tierSection}

The student sees a 3D solid drawn on screen and names it from multiple choice options.
Write exactly ${solids.length} challenges, in this order, one for each solid: ${solids.map((x, i) => `${i + 1}. ${x}`).join(', ')}.

For each challenge:
- instruction: ask the student to name the solid shown. NEVER write the solid's name. Do NOT describe its faces, base,
  edges or point; the picture shows them. You may say what real-world thing it is used for in the theme.
- hint: one property to look at (count the faces, look at the base), without naming the solid.
- narration: a short encouraging line.
- targetAnswer: the solid's id as written in the list; option0..option3: any four solid ids (code replaces them).
`;

  const result = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: identifySchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  const flats: FlatChallenge[] = Array.isArray(data?.challenges) ? data.challenges : [];
  const all = Object.keys(SOLID_GEOMETRY);
  const challenges = solids.map((target, i): NetFolderChallenge => {
    const flat = flats[i] ?? {};
    // A sentence that names the solid, or describes its faces, base or point, answers from the words instead of the
    // picture; the code's own words then stand.
    const named = (t: string) => t.toLowerCase().replace(/_/g, ' ').includes(solidWords(target))
      || /\b(faces?|bases?|edges?|vertex|vertices|corners?|points?|pointy|triangles?|triangular|squares?|rectangles?|rectangular|sides?|pyramids?|prisms?|cubes?)\b/i.test(t);
    const text = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() && !named(v) ? v.trim() : fallback);
    const others = all.filter(x => x !== target).sort(() => Math.random() - 0.5).slice(0, 3);
    return {
      id: `identify-${i + 1}`,
      type: 'identify_solid',
      instruction: text(flat.instruction, 'Look at the solid on the screen. What is its name?'),
      hint: text(flat.hint, 'Look at the base and count the faces.'),
      narration: text(flat.narration, "Let's name this solid!"),
      targetAnswer: target,
      options: [target, ...others].sort(() => Math.random() - 0.5),
      solid: buildSolid(target, ''),
    };
  });
  return { solidType: solids[0], challenges };
}

/**
 * Code-built: a cube net from the eleven, two squares labelled (front, and one beside it), one square yellow. The fold
 * decides the answer (`matchItem`). The model's version labelled every square with its face, the yellow square's own
 * label was the answer, and the yellow was never drawn.
 */
function buildMatchFacesChallenges(count: number): NetFolderChallenge[] {
  const nets = [...VALID_CUBE_NETS].sort(() => Math.random() - 0.5);
  const out: NetFolderChallenge[] = [];
  let lastTarget = '';
  for (let n = 0; out.length < count && n < 200; n++) {
    const cells = cellsOf(nets[n % nets.length]);
    const root = Math.floor(Math.random() * cells.length);
    const beside = cells.map((_, i) => i)
      .filter(i => Math.abs(cells[i][0] - cells[root][0]) + Math.abs(cells[i][1] - cells[root][1]) === 1);
    if (!beside.length) continue;
    const anchor = beside[Math.floor(Math.random() * beside.length)];
    const rest = cells.map((_, i) => i).filter(i => i !== root && i !== anchor);
    const item = matchItem(`match-${out.length + 1}`, cells, root, anchor, rest[Math.floor(Math.random() * rest.length)]);
    if (!item || item.targetAnswer === lastTarget) continue;
    lastTarget = String(item.targetAnswer);
    out.push(item);
  }
  return out;
}

/**
 * Code-built: nets drawn from the eleven cube nets and from arrangements that do not fold, at least one of each; the
 * fold decides the verdict (`validItem`). The model's version described a net in words that were never shown, and the
 * screen always drew the solid's own net, so an invalid item could not be answered from the picture.
 */
function buildValidNetChallenges(count: number): NetFolderChallenge[] {
  const valid = [...VALID_CUBE_NETS].sort(() => Math.random() - 0.5);
  const invalid = [...INVALID_CUBE_NETS].sort(() => Math.random() - 0.5);
  const verdicts = Array.from({ length: count }, (_, i) => (i === 0 ? true : i === 1 ? false : Math.random() < 0.5))
    .sort(() => Math.random() - 0.5);
  let v = 0, x = 0;
  return verdicts.map((ok, i) => validItem(`net-${i + 1}`, cellsOf(ok ? valid[v++ % valid.length] : invalid[x++ % invalid.length])));
}

async function generateSurfaceAreaChallenges(
  topic: string,
  scopeSection: string,
  gradeLevel: string,
  _gradeBand: string,
  chosenSolid: string,
  challengeCount: number,
  tierSection: string,
): Promise<{ solidType: string; challenges: NetFolderChallenge[] }> {

  const prompt = `
Create an educational SURFACE AREA activity for "${topic}" (${gradeLevel} students).
${scopeSection}
Theme: ${randomTheme()}.
${tierSection}

The solid is a ${chosenSolid}. Students calculate total surface area by summing face areas.
The solid has 6 faces. Provide width and height for each face.

IMPORTANT RULES:
- For a cube: ALL 6 faces must have EQUAL width and height (e.g. all 4×4).
- For a rectangular prism: faces come in 3 pairs of equal dimensions.
  e.g. if dimensions are 5×3×2: two 5×3 faces, two 5×2 faces, two 3×2 faces.
- Use small whole numbers for dimensions (2-10 for grade 3-4, 3-15 for grade 4-5).
- unitLabel should be "square units" or "square cm".

For each challenge, provide face0Width/Height through face5Width/Height (6 faces).
The student must calculate the total by summing width×height for each face.

Generate exactly ${challengeCount} challenges progressing in difficulty (larger numbers = harder).
`;

  const result = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: surfaceAreaSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return { solidType: chosenSolid, challenges: [] };

  const challenges = (data.challenges as FlatChallenge[])
    .map((flat): NetFolderChallenge | null => {
      if (!hasBaseFields(flat)) return null;

      const unitLabel = typeof flat.unitLabel === 'string' ? flat.unitLabel.trim() : 'square units';

      let faceDimensions = collectFaceDimensions(flat, 'face', 6);
      let instruction = flat.instruction as string;
      // Six faces in a box's three pairs, or a box built here: the drawn box and its net are built from them.
      const dims = boxDims(faceDimensions);
      const cubeAsked = chosenSolid === 'cube';
      if (!dims || (cubeAsked && !(dims[0] === dims[1] && dims[1] === dims[2]))) {
        const r = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
        const [lo, hi] = _gradeBand === '3-4' ? [2, 6] : [3, 10];
        const l = r(lo, hi), w = cubeAsked ? l : r(lo, hi), h = cubeAsked ? l : r(lo, hi);
        faceDimensions = [{ width: l, height: w }, { width: l, height: w }, { width: l, height: h }, { width: l, height: h },
          { width: w, height: h }, { width: w, height: h }];
        instruction = `Find the total surface area of this ${cubeAsked ? 'cube' : 'box'}: find the area of each face, then add all six.`;
      }
      if (!faceDimensions) return null;

      // ALWAYS derive targetAnswer from face dimensions — never trust Gemini
      const totalArea = faceDimensions.reduce((sum, fd) => sum + fd.width * fd.height, 0);

      return {
        id: flat.id as string,
        type: 'surface_area',
        instruction,
        hint: flat.hint as string,
        narration: flat.narration as string,
        faceDimensions,
        targetAnswer: totalArea,
        unitLabel,
      };
    })
    .filter((c): c is NetFolderChallenge => c !== null);

  return { solidType: chosenSolid, challenges };
}

/** One challenge per solid (`solids`): each item counts its own solid, so the items are not one answer repeated. */
async function generateCountFEVChallenges(
  topic: string,
  scopeSection: string,
  gradeLevel: string,
  solids: string[],
  tierSection: string,
): Promise<{ solidType: string; challenges: NetFolderChallenge[] }> {
  const chosenSolid = solids[0];
  const challengeCount = solids.length;

  const prompt = `
Create an educational COUNTING FACES, EDGES, AND VERTICES activity for "${topic}" (${gradeLevel} students).
${scopeSection}
Theme: ${randomTheme()}.
${tierSection}

Each challenge shows a different solid, in this order: ${solids.join(', ')}. Students count its faces, edges, and vertices.

For each challenge:
- instruction: ask the student to count the faces, edges, and vertices of the solid shown and type all three.
  NEVER state a count. Vary the phrasing.
- hint: a helpful hint about how to count (e.g. "Remember, an edge is where two faces meet.")
- narration: encouraging tutor narration.

The component checks against the solid's actual geometry — no targetAnswer data needed from you.
Generate exactly ${challengeCount} challenges with varied instructions.
`;

  const result = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: countFEVSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  const flats: FlatChallenge[] = Array.isArray(data?.challenges) ? data.challenges : [];
  // A digit in the model's words could be a count; the code's own words then stand.
  const text = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() && !/[0-9]/.test(v) ? v.trim() : fallback);
  const challenges = solids.map((type, i): NetFolderChallenge => ({
    id: `count-${i + 1}`,
    type: 'count_faces_edges_vertices',
    instruction: text(flats[i]?.instruction, 'Count the faces, edges, and vertices of this solid. Type all three, then press Check.'),
    hint: text(flats[i]?.hint, 'A face is a flat side, an edge is where two faces meet, and a vertex is a corner.'),
    narration: text(flats[i]?.narration, "Let's count the parts of this 3D shape together!"),
    targetAnswer: 'check-solid',
    solid: buildSolid(type, ''),
  }));
  return { solidType: chosenSolid, challenges };
}

// ===========================================================================
// Fallbacks — one per type, correct by construction
// ===========================================================================

const FALLBACKS: Record<string, NetFolderChallenge> = {
  identify_solid: {
    id: 'c1',
    type: 'identify_solid',
    instruction: 'What 3D shape is shown? Look at the faces and edges carefully.',
    hint: 'Count the faces — a cube has 6 equal square faces.',
    narration: 'Look at this 3D shape. Can you figure out what it is?',
    targetAnswer: 'cube',
    options: ['cube', 'rectangular_prism', 'square_pyramid', 'triangular_prism'],
  },
  count_faces_edges_vertices: {
    id: 'c1',
    type: 'count_faces_edges_vertices',
    instruction: 'Count the faces, edges, and vertices of this solid.',
    hint: 'A face is a flat surface. An edge is where two faces meet. A vertex is a corner point.',
    narration: "Let's count the parts of this 3D shape together!",
    targetAnswer: 'check-solid',
  },
  match_faces: matchItem('c1', cellsOf('.X../XXXX/.X..'), 2, 0, 3)!,
  valid_net: validItem('c1', cellsOf('.X../XXXX/.X..')),
  surface_area: {
    id: 'c1',
    type: 'surface_area',
    instruction: 'Find the total surface area of this cube by adding up all the face areas.',
    hint: 'A cube has 6 faces, all the same size. Find the area of one face and multiply by 6.',
    narration: "Let's calculate the surface area by adding up the areas of all the faces!",
    faceDimensions: [
      { width: 4, height: 4 },
      { width: 4, height: 4 },
      { width: 4, height: 4 },
      { width: 4, height: 4 },
      { width: 4, height: 4 },
      { width: 4, height: 4 },
    ],
    targetAnswer: 96,
    unitLabel: 'square units',
  },
};

// ===========================================================================
// Main generator — dispatches to per-type sub-generators
// ===========================================================================

type NetFolderConfig = Partial<{
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how many FOLD scaffolds within it. NEVER changes the net or
     * which solid it folds into.
     */
    difficulty?: string;
  }>;

export const generateNetFolder = async (
  ctx: GenerationContext,
): Promise<NetFolderData> => {
  const { topic } = ctx;
  const scopeSection = buildScopePromptSection(ctx.scope);
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as NetFolderConfig;
  // ── Resolve eval mode ──
  const evalConstraint = resolveEvalModeConstraint(
    'net-folder',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('NetFolder', config?.targetEvalMode, evalConstraint);

  // Canonical objective grade wins; the prose parser is only the fallback (14m).
  const gradeBand = netFolderGradeBandFromGrade(ctx.grade) ?? resolveGradeBand(gradeLevel);
  const allowedTypes = evalConstraint?.allowedTypes ?? Object.keys(CHALLENGE_TYPE_DOCS);

  // ── Resolve support tier (fold-scaffold axis) ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  // pinnedType is ONLY for the prompt tone (a mixed session has no single mode).
  const pinnedType =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as ChallengeType)
      : undefined;
  const tierScaffold =
    pinnedType && supportTier ? resolveSupportStructure(pinnedType, supportTier) : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (fold-scaffold level — NOT net complexity)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  // ── Solids. identify and count give each item its own solid (no two items one answer); match_faces and valid_net
  // fold cube nets; surface_area draws each item's own box. The session solid is what the other items fall back to.
  const pool = [...gradeSolidPool(gradeBand)].sort(() => Math.random() - 0.5);
  const isMixed = allowedTypes.length > 1;
  const perTypeCount = isMixed ? 2 : 5;
  const itemSolids = pool.slice(0, Math.min(perTypeCount, pool.length));
  const boxSolid = Math.random() < 0.5 ? 'cube' : 'rectangular_prism';
  const chosenSolidType = isMixed || allowedTypes.includes('match_faces') || allowedTypes.includes('valid_net') ? 'cube'
    : allowedTypes.includes('surface_area') ? boxSolid : itemSolids[0] ?? randomSolid(gradeBand);

  // ── Dispatch sub-generators ──
  type SubResult = { solidType: string; challenges: NetFolderChallenge[] };
  const generators: Promise<SubResult>[] = [];

  for (const type of allowedTypes) {
    switch (type) {
      case 'identify_solid':
        generators.push(generateIdentifyChallenges(topic, scopeSection, gradeLevel, itemSolids, tierSection));
        break;
      case 'count_faces_edges_vertices':
        generators.push(generateCountFEVChallenges(topic, scopeSection, gradeLevel, itemSolids, tierSection));
        break;
      case 'match_faces':
        generators.push(Promise.resolve({ solidType: 'cube', challenges: buildMatchFacesChallenges(perTypeCount) }));
        break;
      case 'valid_net':
        generators.push(Promise.resolve({ solidType: 'cube', challenges: buildValidNetChallenges(perTypeCount) }));
        break;
      case 'surface_area':
        generators.push(generateSurfaceAreaChallenges(topic, scopeSection, gradeLevel, gradeBand,
          isMixed ? 'cube' : boxSolid, perTypeCount, tierSection));
        break;
    }
  }

  const results = await Promise.all(generators);

  // ── Combine results ──
  let challenges: NetFolderChallenge[] = results.flatMap(r => r.challenges);

  // Re-assign IDs sequentially
  challenges = challenges.map((c, i) => ({ ...c, id: `c${i + 1}` }));

  // ── Fallback if empty ──
  if (challenges.length === 0) {
    const fallbackType = allowedTypes[0] ?? 'identify_solid';
    console.log(`[NetFolder] No valid challenges — using ${fallbackType} fallback`);
    challenges = [FALLBACKS[fallbackType] ?? FALLBACKS.identify_solid];
  }

  // ── Build solid data from lookup table (never from Gemini) ──
  const solid = buildSolid(chosenSolidType, gradeBand);
  const geo = SOLID_GEOMETRY[chosenSolidType] ?? SOLID_GEOMETRY.cube;

  // ── Build title ──
  const typeLabels: Record<string, string> = {
    identify_solid: '3D Shape Identification',
    count_faces_edges_vertices: 'Counting Faces, Edges & Vertices',
    match_faces: 'Net-to-Solid Face Matching',
    valid_net: 'Valid Net Detective',
    surface_area: 'Surface Area Calculation',
  };

  // Each identify and count item has its own solid, and an identify item asks for the name: no title names one.
  const named = !allowedTypes.some(t => t === 'identify_solid' || t === 'count_faces_edges_vertices' || t === 'surface_area');
  let title = named ? `3D Shapes: Exploring the ${solid.name}` : '3D Shapes: Solids and Their Nets';
  let description = 'Explore 3D solids, their nets, and solve challenges about 3D geometry.';
  if (allowedTypes.length === 1) {
    title = `${typeLabels[allowedTypes[0]] ?? '3D Shapes'}${named ? `: ${solid.name}` : ''}`;
    description = `Practice ${(typeLabels[allowedTypes[0]] ?? '3D shapes').toLowerCase()}.`;
  }

  const typeBreakdown = challenges.map(c => c.type).join(', ');
  console.log(`[NetFolder] Final: ${challenges.length} challenge(s) → [${typeBreakdown}] | solid=${chosenSolidType}`);

  // ── Apply the support-tier FOLD scaffolds deterministically ──
  // showOptions is component-global (one net rendered at a time), so we resolve
  // each challenge's scaffold from its OWN type and combine to the SAFEST setting:
  //   • showFoldGuides — never answer-bearing → follows the tier uniformly (ON
  //     unless hard). True only if EVERY challenge would show it.
  //   • showFaceMatchHints — ANSWER-LEAK GUARD: forced OFF if ANY challenge is a
  //     match_faces / valid_net (correspondence = answer there). Code-only; the
  //     component checkers never read these flags, so the checker stays independent.
  // Gated ONLY on a tier being present, so the no-tier path is byte-identical.
  let showOptions: NetFolderData['showOptions'] | undefined;
  if (supportTier) {
    let showFoldGuides = true;
    let showFaceMatchHints = true;
    for (const ch of challenges) {
      const sc = resolveSupportStructure(ch.type as ChallengeType, supportTier);
      showFoldGuides = showFoldGuides && sc.showFoldGuides;
      showFaceMatchHints = showFaceMatchHints && sc.showFaceMatchHints;
    }
    showOptions = { showFoldGuides, showFaceMatchHints };
    console.log(
      `[NetFolder] Support tier "${supportTier}" applied per-challenge `
      + `(${pinnedType ? `single-mode ${pinnedType}` : 'mixed'}) → `
      + `foldGuides=${showFoldGuides}, faceMatchHints=${showFaceMatchHints}`,
    );
  }

  return {
    title,
    description,
    solid,
    net: {
      layout: geo.defaultLayout,
      faceLabels: geo.faceLabels,
      gridOverlay: gradeBand === '4-5',
    },
    challenges,
    gradeBand,
    ...(showOptions ? { showOptions } : {}),
    ...(supportTier ? { supportTier } : {}),
  };
};
