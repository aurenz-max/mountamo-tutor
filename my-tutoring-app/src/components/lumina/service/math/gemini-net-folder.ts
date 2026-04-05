import { Type, Schema } from '@google/genai';
import {
  NetFolderData,
  NetFolderChallenge,
  NetFolderSolid,
  SolidType,
  NetLayout,
} from '../../primitives/visual-primitives/math/NetFolder';
import { ai } from '../geminiClient';
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

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

async function generateIdentifyChallenges(
  topic: string,
  gradeLevel: string,
  gradeBand: string,
  chosenSolid: string,
  challengeCount: number,
): Promise<{ solidType: string; challenges: NetFolderChallenge[] }> {
  const pool = gradeSolidPool(gradeBand);
  const prompt = `
Create an educational 3D solid IDENTIFICATION activity for "${topic}" (${gradeLevel} students).
Theme: ${randomTheme()}.

The student sees a 3D "${chosenSolid}" displayed on screen and must identify it from multiple choice options.
IMPORTANT: The solid shown is ALWAYS a ${chosenSolid} for every challenge. Set solidType to "${chosenSolid}".
Set targetAnswer to "${chosenSolid}" for every challenge.

Available distractor solids for options: ${pool.filter(s => s !== chosenSolid).join(', ')}.

For each challenge:
- Write a unique kid-friendly description of the ${chosenSolid} (real-world analogy, property clues, etc.).
- Set option0..option3: 4 plausible solid names. targetAnswer ("${chosenSolid}") MUST be one of the options.
- Vary the descriptions and difficulty, NOT the target solid.
- Do NOT describe a different solid in the instruction text — the student sees a ${chosenSolid}.

Generate exactly ${challengeCount} challenges progressing in difficulty.
`;

  const result = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: identifySchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return { solidType: chosenSolid, challenges: [] };

  const challenges = (data.challenges as FlatChallenge[])
    .map((flat): NetFolderChallenge | null => {
      if (!hasBaseFields(flat)) return null;

      const targetAnswer = typeof flat.targetAnswer === 'string' ? flat.targetAnswer.trim() : '';
      if (!targetAnswer) return null;

      let options = collectStrings(flat, 'option', 4);
      if (!options || options.length < 2) {
        // Derive options from pool
        const others = pool.filter(s => s !== targetAnswer);
        const shuffled = others.sort(() => Math.random() - 0.5);
        options = [targetAnswer, ...shuffled.slice(0, 3)];
        options.sort(() => Math.random() - 0.5);
      }
      // Ensure targetAnswer is in options
      if (!options.includes(targetAnswer)) {
        options[options.length - 1] = targetAnswer;
        options.sort(() => Math.random() - 0.5);
      }

      return {
        id: flat.id as string,
        type: 'identify_solid',
        instruction: flat.instruction as string,
        hint: flat.hint as string,
        narration: flat.narration as string,
        targetAnswer,
        options,
      };
    })
    .filter((c): c is NetFolderChallenge => c !== null);

  return { solidType: chosenSolid, challenges };
}

async function generateMatchFacesChallenges(
  topic: string,
  gradeLevel: string,
  _gradeBand: string,
  chosenSolid: string,
  challengeCount: number,
): Promise<{ solidType: string; challenges: NetFolderChallenge[] }> {
  const geo = SOLID_GEOMETRY[chosenSolid] ?? SOLID_GEOMETRY.cube;

  const prompt = `
Create an educational FACE MATCHING activity for "${topic}" (${gradeLevel} students).
Theme: ${randomTheme()}.

The solid is a ${chosenSolid} with face labels: ${geo.faceLabels.join(', ')}.
Students see a 2D net with one face highlighted and must identify which face it corresponds to on the 3D solid.

For each challenge:
- Set highlightedFace: which face is highlighted on the net (must be one of: ${geo.faceLabels.join(', ')}).
- Set targetAnswer: the correct face label on the 3D solid (same as highlightedFace for this activity).
- Set faceOption0..faceOption3: 4 face label options from the solid. targetAnswer MUST be one of them.
- Vary which face is highlighted across challenges.
- Use kid-friendly, encouraging instructions like "Which face on the solid matches the highlighted part of the net?"

Generate exactly ${challengeCount} challenges.
`;

  const result = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: matchFacesSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return { solidType: chosenSolid, challenges: [] };

  const challenges = (data.challenges as FlatChallenge[])
    .map((flat): NetFolderChallenge | null => {
      if (!hasBaseFields(flat)) return null;

      const highlightedFace = typeof flat.highlightedFace === 'string' ? flat.highlightedFace.trim() : '';
      const targetAnswer = typeof flat.targetAnswer === 'string' ? flat.targetAnswer.trim() : '';
      if (!highlightedFace || !targetAnswer) return null;

      let faceOptions = collectStrings(flat, 'faceOption', 4);
      if (!faceOptions || faceOptions.length < 2) {
        const others = geo.faceLabels.filter(f => f !== targetAnswer);
        const shuffled = others.sort(() => Math.random() - 0.5);
        faceOptions = [targetAnswer, ...shuffled.slice(0, 3)];
        faceOptions.sort(() => Math.random() - 0.5);
      }
      if (!faceOptions.includes(targetAnswer)) {
        faceOptions[faceOptions.length - 1] = targetAnswer;
        faceOptions.sort(() => Math.random() - 0.5);
      }

      return {
        id: flat.id as string,
        type: 'match_faces',
        instruction: flat.instruction as string,
        hint: flat.hint as string,
        narration: flat.narration as string,
        highlightedFace,
        targetAnswer,
        faceOptions,
      };
    })
    .filter((c): c is NetFolderChallenge => c !== null);

  return { solidType: chosenSolid, challenges };
}

async function generateValidNetChallenges(
  topic: string,
  gradeLevel: string,
  _gradeBand: string,
  chosenSolid: string,
  challengeCount: number,
): Promise<{ solidType: string; challenges: NetFolderChallenge[] }> {

  const prompt = `
Create an educational VALID NET CHECK activity for "${topic}" (${gradeLevel} students).
Theme: ${randomTheme()}.

The solid is a ${chosenSolid}. Students see a 2D net arrangement and must decide if it can fold into the solid.

IMPORTANT: Generate a MIX of valid and invalid nets. At least 1 valid and 1 invalid.
- For valid nets: describe standard net arrangements that correctly fold.
- For invalid nets: describe arrangements where faces overlap, are disconnected, or don't form the solid.

For each challenge:
- netLayout: describe the net arrangement (e.g. "cross shape with 4 squares in a row and 1 on top and bottom")
- isValidNet: true if the net folds correctly, false if not
- netExplanation: why it's valid or invalid (1-2 sentences)
- Use encouraging instructions like "Does this net fold into a ${chosenSolid}?"

Generate exactly ${challengeCount} challenges.
`;

  const result = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: validNetSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return { solidType: chosenSolid, challenges: [] };

  const challenges = (data.challenges as FlatChallenge[])
    .map((flat): NetFolderChallenge | null => {
      if (!hasBaseFields(flat)) return null;

      const netLayout = typeof flat.netLayout === 'string' ? flat.netLayout.trim() : '';
      const isValidNet = typeof flat.isValidNet === 'boolean' ? flat.isValidNet : undefined;
      const netExplanation = typeof flat.netExplanation === 'string' ? flat.netExplanation.trim() : '';

      if (!netLayout || isValidNet === undefined || !netExplanation) return null;

      return {
        id: flat.id as string,
        type: 'valid_net',
        instruction: flat.instruction as string,
        hint: flat.hint as string,
        narration: flat.narration as string,
        netLayout,
        isValidNet,
        netExplanation,
        targetAnswer: isValidNet ? 'valid' : 'invalid',
      };
    })
    .filter((c): c is NetFolderChallenge => c !== null);

  return { solidType: chosenSolid, challenges };
}

async function generateSurfaceAreaChallenges(
  topic: string,
  gradeLevel: string,
  _gradeBand: string,
  chosenSolid: string,
  challengeCount: number,
): Promise<{ solidType: string; challenges: NetFolderChallenge[] }> {

  const prompt = `
Create an educational SURFACE AREA activity for "${topic}" (${gradeLevel} students).
Theme: ${randomTheme()}.

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

      const faceDimensions = collectFaceDimensions(flat, 'face', 6);
      if (!faceDimensions || faceDimensions.length < 4) return null;

      // ALWAYS derive targetAnswer from face dimensions — never trust Gemini
      const totalArea = faceDimensions.reduce((sum, fd) => sum + fd.width * fd.height, 0);

      return {
        id: flat.id as string,
        type: 'surface_area',
        instruction: flat.instruction as string,
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

async function generateCountFEVChallenges(
  topic: string,
  gradeLevel: string,
  _gradeBand: string,
  chosenSolid: string,
  challengeCount: number,
): Promise<{ solidType: string; challenges: NetFolderChallenge[] }> {

  const prompt = `
Create an educational COUNTING FACES, EDGES, AND VERTICES activity for "${topic}" (${gradeLevel} students).
Theme: ${randomTheme()}.

The solid is a ${chosenSolid}. Students count the number of faces, edges, and vertices.

For each challenge:
- instruction: ask the student to count faces, edges, and vertices of the solid.
  Vary the phrasing — sometimes ask about all three, sometimes focus on one property.
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
  if (!data?.challenges?.length) return { solidType: chosenSolid, challenges: [] };

  const challenges = (data.challenges as FlatChallenge[])
    .map((flat): NetFolderChallenge | null => {
      if (!hasBaseFields(flat)) return null;

      return {
        id: flat.id as string,
        type: 'count_faces_edges_vertices',
        instruction: flat.instruction as string,
        hint: flat.hint as string,
        narration: flat.narration as string,
        targetAnswer: 'check-solid',
      };
    })
    .filter((c): c is NetFolderChallenge => c !== null);

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
  match_faces: {
    id: 'c1',
    type: 'match_faces',
    instruction: 'The highlighted face on the net is shown in yellow. Which face is it on the 3D solid?',
    hint: 'Try imagining folding the net in your mind — where would this face end up?',
    narration: 'Can you match this face on the net to the solid?',
    highlightedFace: 'top',
    targetAnswer: 'top',
    faceOptions: ['front', 'top', 'right', 'bottom'],
  },
  valid_net: {
    id: 'c1',
    type: 'valid_net',
    instruction: 'Does this net fold into a cube?',
    hint: 'A valid cube net must have exactly 6 connected squares with no overlaps when folded.',
    narration: "Let's see if this flat shape can fold up into a cube!",
    netLayout: 'A cross shape with 4 squares in a row and 1 square above and 1 below the second square.',
    isValidNet: true,
    netExplanation: 'This cross-shaped net is one of the 11 valid cube nets.',
    targetAnswer: 'valid',
  },
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

export const generateNetFolder = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<NetFolderData> => {
  // ── Resolve eval mode ──
  const evalConstraint = resolveEvalModeConstraint(
    'net-folder',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('NetFolder', config?.targetEvalMode, evalConstraint);

  const gradeBand = resolveGradeBand(gradeLevel);
  const allowedTypes = evalConstraint?.allowedTypes ?? Object.keys(CHALLENGE_TYPE_DOCS);

  // ── Pick ONE solid upfront — all sub-generators use the same shape ──
  const chosenSolidType = randomSolid(gradeBand);

  // Single-type mode → 4-5 challenges; mixed mode → 1-2 per type
  const isMixed = allowedTypes.length > 1;
  const perTypeCount = isMixed ? 2 : 5;

  // ── Dispatch sub-generators ──
  type SubResult = { solidType: string; challenges: NetFolderChallenge[] };
  const generators: Promise<SubResult>[] = [];
  const typeOrder: string[] = [];

  for (const type of allowedTypes) {
    typeOrder.push(type);
    switch (type) {
      case 'identify_solid':
        generators.push(generateIdentifyChallenges(topic, gradeLevel, gradeBand, chosenSolidType, perTypeCount));
        break;
      case 'count_faces_edges_vertices':
        generators.push(generateCountFEVChallenges(topic, gradeLevel, gradeBand, chosenSolidType, perTypeCount));
        break;
      case 'match_faces':
        generators.push(generateMatchFacesChallenges(topic, gradeLevel, gradeBand, chosenSolidType, perTypeCount));
        break;
      case 'valid_net':
        generators.push(generateValidNetChallenges(topic, gradeLevel, gradeBand, chosenSolidType, perTypeCount));
        break;
      case 'surface_area':
        generators.push(generateSurfaceAreaChallenges(topic, gradeLevel, gradeBand, chosenSolidType, perTypeCount));
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

  let title = `3D Shapes: Exploring ${solid.name}`;
  let description = `Explore the ${solid.name}, its net, and solve challenges about 3D geometry.`;
  if (allowedTypes.length === 1) {
    title = `${typeLabels[allowedTypes[0]] ?? '3D Shapes'}: ${solid.name}`;
    description = `Practice ${(typeLabels[allowedTypes[0]] ?? '3D shapes').toLowerCase()} with a ${solid.name.toLowerCase()}.`;
  }

  const typeBreakdown = challenges.map(c => c.type).join(', ');
  console.log(`[NetFolder] Final: ${challenges.length} challenge(s) → [${typeBreakdown}] | solid=${chosenSolidType}`);

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
  };
};
