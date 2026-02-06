import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  TelescopeSimulatorData,
  CelestialTarget,
  TelescopeType,
  SkyViewMode,
} from '../../primitives/visual-primitives/astronomy/TelescopeSimulator';

// Re-export for convenience
export type { TelescopeSimulatorData, CelestialTarget, TelescopeType, SkyViewMode };

/**
 * Schema for Celestial Target
 */
const celestialTargetSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique identifier for this object (e.g., 'venus', 'sirius', 'moon', 'orion-nebula')"
    },
    name: {
      type: Type.STRING,
      description: "Display name for this object (e.g., 'Venus', 'Sirius', 'The Moon')"
    },
    type: {
      type: Type.STRING,
      enum: ["planet", "star", "moon", "constellation", "nebula", "galaxy", "cluster"],
      description: "Type of celestial object"
    },
    azimuth: {
      type: Type.NUMBER,
      description: "Azimuth in degrees (0-360). 0=North, 90=East, 180=South, 270=West. Spread objects across the sky."
    },
    altitude: {
      type: Type.NUMBER,
      description: "Altitude in degrees above horizon (5-85). Higher = closer to overhead."
    },
    magnitude: {
      type: Type.NUMBER,
      description: "Apparent magnitude. Lower = brighter. Moon: -12, Venus: -4, Sirius: -1.5, faint star: 5"
    },
    angularSize: {
      type: Type.NUMBER,
      description: "Apparent angular size in arcminutes. Moon: 31, Venus: 1, Jupiter: 0.7, Orion Nebula: 65, star: 0.01"
    },
    color: {
      type: Type.STRING,
      description: "Hex color code for display (e.g., '#FFE4B5' for Venus, '#FF6B6B' for Mars, '#87CEEB' for hot star)"
    },
    description: {
      type: Type.STRING,
      description: "Age-appropriate 1-2 sentence description of this object"
    },
    funFact: {
      type: Type.STRING,
      description: "Engaging fun fact appropriate for grade level"
    },
    visibleNaked: {
      type: Type.BOOLEAN,
      description: "Whether visible to naked eye. Planets and bright stars: true. Nebulae and galaxies: usually false."
    },
    bestTelescope: {
      type: Type.STRING,
      enum: ["binoculars", "small", "large", "space"],
      description: "Best telescope type for viewing. Moon/planets: small. Nebulae: large. Faint galaxies: space."
    },
    detailLevels: {
      type: Type.OBJECT,
      properties: {
        naked: { type: Type.STRING, description: "What you see with naked eyes" },
        binoculars: { type: Type.STRING, description: "What you see with binoculars" },
        small: { type: Type.STRING, description: "What you see with a small telescope" },
        large: { type: Type.STRING, description: "What you see with a large telescope" },
        space: { type: Type.STRING, description: "What a space telescope reveals" },
      },
      required: ["naked", "binoculars", "small", "large", "space"],
      description: "Description of what is visible at each telescope level"
    },
  },
  required: ["id", "name", "type", "azimuth", "altitude", "magnitude", "angularSize", "color", "description", "funFact", "visibleNaked", "bestTelescope", "detailLevels"]
};

/**
 * Schema for Telescope Simulator Data
 */
const telescopeSimulatorSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the telescope activity"
    },
    description: {
      type: Type.STRING,
      description: "Educational description appropriate for grade level"
    },
    gradeLevel: {
      type: Type.STRING,
      enum: ["K", "1", "2", "3", "4", "5"],
      description: "Target grade level"
    },
    celestialObjects: {
      type: Type.ARRAY,
      items: celestialTargetSchema,
      description: "Celestial objects visible in the sky. ALWAYS include Venus as a suggested object. K: 3-4 bright objects. 1-2: 5-6 objects. 3-4: 7-8 objects. 5: 8-10 objects including faint ones."
    },
    starFieldSeed: {
      type: Type.NUMBER,
      description: "Random seed for star field generation (any positive integer)"
    },
    starCount: {
      type: Type.NUMBER,
      description: "Number of background stars. K: 200. 1-2: 300. 3-4: 400. 5: 500."
    },
    telescopeType: {
      type: Type.STRING,
      enum: ["binoculars", "small", "large", "space"],
      description: "Starting telescope type. K-1: binoculars. 2-3: small. 4-5: large."
    },
    initialMagnification: {
      type: Type.NUMBER,
      description: "Starting magnification. K: 3. 1-2: 5. 3-4: 10. 5: 15."
    },
    viewMode: {
      type: Type.STRING,
      enum: ["visible", "infrared", "radio"],
      description: "Starting view mode. K-2: visible only. 3+: visible (can switch)."
    },
    showLabels: {
      type: Type.BOOLEAN,
      description: "Show object labels by default. K-2: true. 3+: true (can toggle)."
    },
    showGrid: {
      type: Type.BOOLEAN,
      description: "Show coordinate grid by default. K-2: false. 3-4: false. 5: true."
    },
    targetObjects: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "IDs of objects student must find. ALWAYS include 'venus'. K: 1-2 targets. 1-2: 2-3 targets. 3-4: 3-4 targets. 5: 4-5 targets."
    },
    journalMode: {
      type: Type.BOOLEAN,
      description: "Enable observation journal. K-2: false. 3+: true."
    },
    focusMode: {
      type: Type.STRING,
      enum: ["auto", "manual"],
      description: "Focus control mode. K-2: auto (easy). 3-4: auto (with manual toggle). 5: manual (hard)."
    },
    learningFocus: {
      type: Type.STRING,
      description: "Main learning concept for this grade level"
    },
    hints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-4 age-appropriate hints to help students explore"
    },
    funFact: {
      type: Type.STRING,
      description: "General fun fact about telescopes or astronomy for this grade level",
      nullable: true
    }
  },
  required: [
    "title", "description", "gradeLevel", "celestialObjects",
    "starFieldSeed", "starCount", "telescopeType", "initialMagnification",
    "viewMode", "showLabels", "showGrid",
    "targetObjects", "journalMode", "focusMode", "learningFocus", "hints"
  ]
};

/**
 * Generate Telescope Simulator data for visualization
 *
 * Creates virtual telescope experiences appropriate for K-5 astronomy education:
 * - K: We can see space with telescopes
 * - 1: Moon craters, planets are disks
 * - 2: Finding things in the sky
 * - 3: Different telescopes see different things
 * - 4: Systematic observation, logging
 * - 5: Professional astronomy techniques
 *
 * Venus is ALWAYS included as a suggested/target object (user's son loves Venus!).
 *
 * @param topic - The astronomy topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns TelescopeSimulatorData with complete configuration
 */
export const generateTelescopeSimulator = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<TelescopeSimulatorData>
): Promise<TelescopeSimulatorData> => {
  const prompt = `
Create an educational Telescope Simulator experience for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - VIRTUAL TELESCOPE FOR K-5:
The Telescope Simulator is a virtual telescope experience where students explore the night sky,
find celestial objects, and understand how astronomers work. It uses D3 to render an interactive
sky view through a circular telescope eyepiece.

CRITICAL: ALWAYS include Venus as one of the celestial objects and as a target to find.
Venus is a favorite planet and should always be prominent and discoverable.

CELESTIAL OBJECTS DATA:
Venus: { id: "venus", type: "planet", azimuth: 225, altitude: 35, magnitude: -4.0, angularSize: 1, color: "#FFE4B5", visibleNaked: true, bestTelescope: "small", description: "The brightest planet! Sometimes called the Evening Star or Morning Star.", funFact: "Venus is so bright you can see it during the day if you know where to look!" }
Moon: { id: "moon", type: "moon", azimuth: 180, altitude: 55, magnitude: -12, angularSize: 31, color: "#F0E68C", visibleNaked: true, bestTelescope: "binoculars" }
Mars: { id: "mars", type: "planet", azimuth: 140, altitude: 40, magnitude: 1.0, angularSize: 0.3, color: "#FF6B6B", visibleNaked: true, bestTelescope: "small" }
Jupiter: { id: "jupiter", type: "planet", azimuth: 90, altitude: 50, magnitude: -2.5, angularSize: 0.7, color: "#DEB887", visibleNaked: true, bestTelescope: "small" }
Saturn: { id: "saturn", type: "planet", azimuth: 120, altitude: 45, magnitude: 0.5, angularSize: 0.3, color: "#F4D03F", visibleNaked: true, bestTelescope: "small" }
Sirius: { id: "sirius", type: "star", azimuth: 200, altitude: 30, magnitude: -1.5, angularSize: 0.01, color: "#B0E0FF", visibleNaked: true, bestTelescope: "binoculars" }
Betelgeuse: { id: "betelgeuse", type: "star", azimuth: 160, altitude: 55, magnitude: 0.5, angularSize: 0.04, color: "#FF8C69", visibleNaked: true, bestTelescope: "binoculars" }
Polaris: { id: "polaris", type: "star", azimuth: 0, altitude: 40, magnitude: 2.0, angularSize: 0.01, color: "#FFFACD", visibleNaked: true, bestTelescope: "binoculars" }
Orion Nebula: { id: "orion-nebula", type: "nebula", azimuth: 170, altitude: 42, magnitude: 4.0, angularSize: 65, color: "#FF69B4", visibleNaked: false, bestTelescope: "large" }
Pleiades: { id: "pleiades", type: "cluster", azimuth: 250, altitude: 60, magnitude: 1.6, angularSize: 110, color: "#87CEEB", visibleNaked: true, bestTelescope: "binoculars" }
Andromeda: { id: "andromeda", type: "galaxy", azimuth: 30, altitude: 65, magnitude: 3.4, angularSize: 190, color: "#DDA0DD", visibleNaked: false, bestTelescope: "large" }

KEY CONCEPTS (age-appropriate):

KINDERGARTEN (ages 5-6):
"We can see space with telescopes!"
- Focus: Telescopes let us see far-away things
- 3-4 bright objects (Moon, Venus, Jupiter)
- No labels toggle, no grid, auto-focus
- Language: "Point the telescope and find the bright things in the sky!"
- telescopeType: "binoculars" (max 12×), viewMode: "visible", focusMode: "auto"
- targetObjects: ["venus", "moon"] (2 easy targets)
- journalMode: false
- Hints: "Venus is the brightest point of light! Can you find it?", "Drag to move the telescope!"

GRADE 1 (ages 6-7):
"The Moon has bumps and planets look like circles!"
- Focus: Moon craters, planets are disks at magnification
- 5 objects (Moon, Venus, Mars, Jupiter, Sirius)
- showLabels: true, auto-focus
- Language: "Zoom in on the Moon to see its craters!"
- telescopeType: "binoculars" (max 12×), initialMagnification: 5, focusMode: "auto"
- targetObjects: ["venus", "moon", "jupiter"] (3 targets)
- journalMode: false
- Hints: "Venus is super bright! Look for it in the west!", "Zoom in with the slider to see more detail!"

GRADE 2 (ages 7-8):
"There's so much to find in the sky!"
- Focus: Finding specific objects, sky is full of things
- 6 objects including stars and a cluster
- showLabels: true, introduce telescope switching
- Language: "Can you find all the objects on your list?"
- telescopeType: "small" (max 60×), initialMagnification: 5, focusMode: "auto"
- targetObjects: ["venus", "moon", "mars", "pleiades"] (4 targets)
- journalMode: false
- Hints: "Venus shines with a warm yellow glow!", "Try different telescopes to see more!", "Some things are easier to find than others!"

GRADE 3 (ages 8-9):
"Different telescopes see different things!"
- Focus: Telescope types, view modes, systematic searching
- 7 objects with varying visibility requirements
- showLabels: true (toggleable), introduce IR view, journalMode: true
- Language: "Switch telescopes and view modes to see what changes!"
- telescopeType: "small" (max 60×), initialMagnification: 10, focusMode: "auto"
- targetObjects: ["venus", "jupiter", "orion-nebula", "sirius"] (4 targets)
- journalMode: true
- Hints: "Venus appears as a bright crescent in a small telescope!", "Try infrared mode to see the nebula differently!", "Log your observations in the journal!"

GRADE 4 (ages 9-10):
"Real astronomers observe carefully and take notes!"
- Focus: Systematic observation, logging discoveries
- 8 objects including nebulae and galaxies
- All controls available, journalMode: true, grid optional
- Language: "Observe like a professional astronomer - log everything!"
- telescopeType: "large" (max 250×), initialMagnification: 10, focusMode: "auto"
- targetObjects: ["venus", "orion-nebula", "andromeda", "saturn", "pleiades"] (5 targets)
- journalMode: true
- Hints: "Venus shows phases like the Moon!", "The Andromeda galaxy is 2.5 million light years away!", "Use the grid to record object positions!"

GRADE 5 (ages 10-11):
"Professional astronomy techniques!"
- Focus: Manual focus, multiple view modes, systematic surveys
- 8-10 objects including challenging faint objects
- All controls, manual focus (hard mode!), grid, journal
- Language: "Master the art of telescope observation with manual controls!"
- telescopeType: "large" (max 250×), initialMagnification: 15, focusMode: "manual"
- targetObjects: ["venus", "orion-nebula", "andromeda", "betelgeuse", "polaris"] (5 targets)
- journalMode: true, showGrid: true
- Hints: "Manual focus requires patience - adjust slowly!", "Venus shows different phases depending on its orbit!", "Compare what you see in visible vs infrared light!"

DETAIL LEVELS (what you see at each telescope):
Venus detail levels:
- naked: "A very bright point of light in the sky"
- binoculars: "Looks like a tiny bright disk - the brightest planet!"
- small: "You can see Venus has phases like the Moon! It looks like a tiny crescent."
- large: "Beautiful crescent shape is clear. Venus is covered in thick clouds that reflect sunlight."
- space: "Ultraviolet reveals complex cloud patterns. The atmosphere is mostly carbon dioxide with sulfuric acid clouds."

Moon detail levels:
- naked: "A bright round disc in the sky"
- binoculars: "You can see dark and light patches - the seas and highlands!"
- small: "Craters are visible! The largest ones have names like Tycho and Copernicus."
- large: "Amazing detail - mountains, valleys, and hundreds of craters visible along the terminator!"
- space: "Incredible resolution shows tiny features, boulders, and even traces of Apollo landing sites."

FUN FACTS BY GRADE:
K: "Telescopes are like super-powered eyes that can see really far away!"
1: "The first telescope was made over 400 years ago by a person named Hans Lippershey!"
2: "Venus is sometimes called Earth's twin because it's almost the same size!"
3: "The Hubble Space Telescope is as big as a school bus and orbits Earth!"
4: "Venus spins backwards compared to most planets - the Sun rises in the west on Venus!"
5: "The James Webb Space Telescope sees in infrared light and can detect heat from objects billions of light-years away!"

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.telescopeType ? `- Telescope type: ${config.telescopeType}` : ''}
${config.viewMode ? `- View mode: ${config.viewMode}` : ''}
${config.focusMode ? `- Focus mode: ${config.focusMode}` : ''}
${config.journalMode !== undefined ? `- Journal: ${config.journalMode}` : ''}
${config.targetObjects ? `- Target objects: ${config.targetObjects.join(', ')}` : ''}
` : ''}

Return a complete Telescope Simulator configuration appropriate for the grade level and topic.
REMEMBER: Venus MUST be included in celestialObjects and targetObjects!
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: telescopeSimulatorSchema
    },
  });

  console.log('[Telescope Simulator] Gemini API Response:', {
    hasText: !!result.text,
    textType: typeof result.text,
    textLength: result.text?.length,
    textPreview: result.text?.substring(0, 200),
  });

  let data;
  try {
    if (!result.text) {
      throw new Error('No text property in Gemini response');
    }
    data = JSON.parse(result.text);
  } catch (parseError) {
    console.error('[Telescope Simulator] Parse Error:', parseError);
    throw new Error(`Failed to parse Gemini response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
  }

  if (!data) {
    throw new Error('No valid Telescope Simulator data returned from Gemini API');
  }

  // Validation and defaults
  if (!data.celestialObjects || data.celestialObjects.length === 0) {
    data.celestialObjects = getDefaultCelestialObjects(gradeLevel);
  }

  // Ensure Venus is always included
  const hasVenus = data.celestialObjects.some((obj: CelestialTarget) => obj.id === 'venus');
  if (!hasVenus) {
    data.celestialObjects.unshift(getVenusObject(gradeLevel));
  }

  // Ensure Venus is always a target
  if (!data.targetObjects) data.targetObjects = [];
  if (!data.targetObjects.includes('venus')) {
    data.targetObjects.unshift('venus');
  }

  // Ensure all targets exist in celestialObjects
  data.targetObjects = data.targetObjects.filter((id: string) =>
    data.celestialObjects.some((obj: CelestialTarget) => obj.id === id)
  );

  // Ensure celestial object data is valid
  data.celestialObjects = data.celestialObjects.map((obj: CelestialTarget) => ({
    ...obj,
    azimuth: obj.azimuth ?? Math.random() * 360,
    altitude: obj.altitude ?? 30 + Math.random() * 40,
    magnitude: obj.magnitude ?? 2,
    angularSize: obj.angularSize ?? 0.5,
    color: obj.color || '#ffffff',
    visibleNaked: obj.visibleNaked ?? true,
    bestTelescope: obj.bestTelescope || 'small',
    detailLevels: obj.detailLevels || {
      naked: `A point of light in the sky`,
      binoculars: `Slightly brighter through binoculars`,
      small: `More detail visible with a small telescope`,
      large: `Clear view with a large telescope`,
      space: `Amazing detail from space`,
    },
  }));

  // Feature defaults by grade
  if (data.starFieldSeed === undefined) data.starFieldSeed = Math.floor(Math.random() * 10000);
  if (data.starCount === undefined) {
    data.starCount = gradeLevel === 'K' ? 200 : gradeLevel <= '2' ? 300 : gradeLevel <= '4' ? 400 : 500;
  }
  if (!data.telescopeType) {
    data.telescopeType = gradeLevel <= '1' ? 'binoculars' : gradeLevel <= '3' ? 'small' : 'large';
  }
  if (data.initialMagnification === undefined) {
    data.initialMagnification = gradeLevel === 'K' ? 3 : gradeLevel <= '2' ? 5 : gradeLevel <= '4' ? 10 : 15;
  }
  if (!data.viewMode) data.viewMode = 'visible';
  if (data.showLabels === undefined) data.showLabels = true;
  if (data.showGrid === undefined) data.showGrid = gradeLevel === '5';
  if (data.journalMode === undefined) data.journalMode = gradeLevel >= '3';
  if (!data.focusMode) data.focusMode = gradeLevel === '5' ? 'manual' : 'auto';

  if (!data.hints || data.hints.length === 0) {
    data.hints = getDefaultHints(gradeLevel);
  }

  // Apply config overrides
  if (config) {
    if (config.celestialObjects) data.celestialObjects = config.celestialObjects;
    if (config.telescopeType) data.telescopeType = config.telescopeType;
    if (config.viewMode) data.viewMode = config.viewMode;
    if (config.focusMode) data.focusMode = config.focusMode;
    if (config.showLabels !== undefined) data.showLabels = config.showLabels;
    if (config.showGrid !== undefined) data.showGrid = config.showGrid;
    if (config.journalMode !== undefined) data.journalMode = config.journalMode;
    if (config.targetObjects) data.targetObjects = config.targetObjects;
    if (config.initialMagnification !== undefined) data.initialMagnification = config.initialMagnification;
    if (config.starFieldSeed !== undefined) data.starFieldSeed = config.starFieldSeed;
    if (config.starCount !== undefined) data.starCount = config.starCount;
    if (config.hints) data.hints = config.hints;
    if (config.funFact) data.funFact = config.funFact;
  }

  return data;
};

/**
 * Helper: Get Venus object for a given grade level
 */
function getVenusObject(gradeLevel: string): CelestialTarget {
  return {
    id: 'venus',
    name: 'Venus',
    type: 'planet',
    azimuth: 225,
    altitude: 35,
    magnitude: -4.0,
    angularSize: 1,
    color: '#FFE4B5',
    description: gradeLevel <= '2'
      ? 'The brightest planet in the sky! Sometimes called the Evening Star.'
      : 'The brightest planet — often the first "star" you see at sunset. It\'s covered in thick clouds.',
    funFact: gradeLevel <= '2'
      ? 'Venus is so bright you can sometimes see it during the day!'
      : 'A day on Venus (243 Earth days) is longer than a year on Venus (225 Earth days)!',
    visibleNaked: true,
    bestTelescope: 'small',
    detailLevels: {
      naked: 'A very bright point of light — the brightest thing in the sky after the Sun and Moon!',
      binoculars: 'Looks like a tiny bright disk — the brightest planet!',
      small: 'You can see Venus has phases like the Moon! It looks like a tiny crescent.',
      large: 'Beautiful crescent shape is clear. Venus is covered in thick clouds that reflect sunlight.',
      space: 'Ultraviolet reveals swirling cloud patterns. The atmosphere is mostly carbon dioxide.',
    },
  };
}

/**
 * Helper: Get default celestial objects based on grade level
 */
function getDefaultCelestialObjects(gradeLevel: string): CelestialTarget[] {
  const venus = getVenusObject(gradeLevel);

  const moon: CelestialTarget = {
    id: 'moon', name: 'The Moon', type: 'moon',
    azimuth: 180, altitude: 55, magnitude: -12, angularSize: 31, color: '#F0E68C',
    description: 'Our closest neighbor in space!',
    funFact: 'The Moon is slowly moving away from Earth — about 3.8 cm per year!',
    visibleNaked: true, bestTelescope: 'binoculars',
    detailLevels: {
      naked: 'A bright round disc in the sky',
      binoculars: 'You can see dark and light patches — the seas and highlands!',
      small: 'Craters are visible! The largest ones have names like Tycho and Copernicus.',
      large: 'Amazing detail — mountains, valleys, and hundreds of craters!',
      space: 'Incredible resolution shows tiny features and traces of Apollo landing sites.',
    },
  };

  const jupiter: CelestialTarget = {
    id: 'jupiter', name: 'Jupiter', type: 'planet',
    azimuth: 90, altitude: 50, magnitude: -2.5, angularSize: 0.7, color: '#DEB887',
    description: 'The biggest planet — a giant ball of gas!',
    funFact: 'Jupiter has a storm called the Great Red Spot that is bigger than Earth!',
    visibleNaked: true, bestTelescope: 'small',
    detailLevels: {
      naked: 'A bright yellowish point of light',
      binoculars: 'Looks like a tiny disk with up to 4 dots nearby — the Galilean moons!',
      small: 'Cloud bands visible! You can clearly see the four largest moons.',
      large: 'Detailed cloud bands, Great Red Spot, and moon shadows on Jupiter\'s surface!',
      space: 'Complex atmospheric storms, dozens of moons visible.',
    },
  };

  const mars: CelestialTarget = {
    id: 'mars', name: 'Mars', type: 'planet',
    azimuth: 140, altitude: 40, magnitude: 1.0, angularSize: 0.3, color: '#FF6B6B',
    description: 'The Red Planet — maybe humans will live there someday!',
    funFact: 'Mars has the tallest volcano in the solar system — Olympus Mons!',
    visibleNaked: true, bestTelescope: 'small',
    detailLevels: {
      naked: 'A reddish point of light',
      binoculars: 'Still looks like a point, but clearly reddish-orange',
      small: 'Tiny reddish disk. You might see a bright polar ice cap!',
      large: 'Surface features visible — dark markings and white polar caps.',
      space: 'Valleys, volcanoes, and ice caps in stunning detail.',
    },
  };

  const sirius: CelestialTarget = {
    id: 'sirius', name: 'Sirius', type: 'star',
    azimuth: 200, altitude: 30, magnitude: -1.5, angularSize: 0.01, color: '#B0E0FF',
    description: 'The brightest star in the night sky!',
    funFact: 'Sirius is actually two stars orbiting each other!',
    visibleNaked: true, bestTelescope: 'binoculars',
    detailLevels: {
      naked: 'The brightest star — twinkles with blue-white light',
      binoculars: 'Very bright blue-white point with beautiful twinkling',
      small: 'Brilliant blue-white star. Diffraction spikes visible.',
      large: 'Dazzling! With perfect conditions you might detect its faint companion star.',
      space: 'Binary system — Sirius A and its white dwarf companion Sirius B clearly resolved.',
    },
  };

  const pleiades: CelestialTarget = {
    id: 'pleiades', name: 'Pleiades', type: 'cluster',
    azimuth: 250, altitude: 60, magnitude: 1.6, angularSize: 110, color: '#87CEEB',
    description: 'A beautiful group of young blue stars — the Seven Sisters!',
    funFact: 'The Pleiades are about 100 million years old — babies compared to our Sun!',
    visibleNaked: true, bestTelescope: 'binoculars',
    detailLevels: {
      naked: 'A tiny fuzzy patch — you might count 6 or 7 stars',
      binoculars: 'Beautiful! Dozens of bright blue stars spread across the view.',
      small: 'Stunning cluster of bright blue stars with hints of nebulosity.',
      large: 'Hundreds of stars visible with wispy blue reflection nebula.',
      space: 'Thousands of stars in an intricate web of gas and dust.',
    },
  };

  const orionNebula: CelestialTarget = {
    id: 'orion-nebula', name: 'Orion Nebula', type: 'nebula',
    azimuth: 170, altitude: 42, magnitude: 4.0, angularSize: 65, color: '#FF69B4',
    description: 'A giant cloud of gas where new stars are being born!',
    funFact: 'The Orion Nebula is so big that light takes 24 years to cross it!',
    visibleNaked: false, bestTelescope: 'large',
    detailLevels: {
      naked: 'A faint fuzzy patch in Orion\'s sword — hard to see!',
      binoculars: 'A misty glow around a few stars in Orion',
      small: 'Beautiful glowing cloud with embedded bright stars — the Trapezium!',
      large: 'Spectacular! Detailed wisps and tendrils of glowing gas, multiple stars visible.',
      space: 'Breathtaking detail — pillars of gas, protoplanetary disks around young stars.',
    },
  };

  const andromeda: CelestialTarget = {
    id: 'andromeda', name: 'Andromeda Galaxy', type: 'galaxy',
    azimuth: 30, altitude: 65, magnitude: 3.4, angularSize: 190, color: '#DDA0DD',
    description: 'The nearest large galaxy — 2.5 million light-years away!',
    funFact: 'Andromeda contains about 1 trillion stars — twice as many as our Milky Way!',
    visibleNaked: false, bestTelescope: 'large',
    detailLevels: {
      naked: 'A very faint smudge — the most distant thing you can see with your eyes!',
      binoculars: 'An elongated fuzzy glow — you\'re looking at a whole other galaxy!',
      small: 'Oval smudge with a brighter center. Two satellite galaxies might be visible.',
      large: 'Spiral structure hints visible. Dark dust lanes cross the disk.',
      space: 'Stunning spiral galaxy with billions of stars, dust lanes, and satellite galaxies.',
    },
  };

  // Build object list by grade
  if (gradeLevel === 'K') return [venus, moon, jupiter];
  if (gradeLevel === '1') return [venus, moon, jupiter, mars, sirius];
  if (gradeLevel === '2') return [venus, moon, jupiter, mars, sirius, pleiades];
  if (gradeLevel === '3') return [venus, moon, jupiter, mars, sirius, pleiades, orionNebula];
  if (gradeLevel === '4') return [venus, moon, jupiter, mars, sirius, pleiades, orionNebula, andromeda];
  // Grade 5
  const saturn: CelestialTarget = {
    id: 'saturn', name: 'Saturn', type: 'planet',
    azimuth: 120, altitude: 45, magnitude: 0.5, angularSize: 0.3, color: '#F4D03F',
    description: 'The ringed planet — the most beautiful sight in a telescope!',
    funFact: 'Saturn is so light it would float in water — if you could find a bathtub big enough!',
    visibleNaked: true, bestTelescope: 'small',
    detailLevels: {
      naked: 'A steady yellowish point of light',
      binoculars: 'Looks slightly elongated — those are the rings!',
      small: 'Rings clearly visible! One of the most amazing things you can see in a telescope.',
      large: 'Ring structure visible — Cassini Division, cloud bands, and moons!',
      space: 'Incredible ring detail, dozens of moons, hexagonal polar storm.',
    },
  };
  const betelgeuse: CelestialTarget = {
    id: 'betelgeuse', name: 'Betelgeuse', type: 'star',
    azimuth: 160, altitude: 55, magnitude: 0.5, angularSize: 0.04, color: '#FF8C69',
    description: 'A red supergiant star that might explode as a supernova someday!',
    funFact: 'Betelgeuse is so huge that if it replaced our Sun, it would swallow Mars!',
    visibleNaked: true, bestTelescope: 'binoculars',
    detailLevels: {
      naked: 'A distinctly reddish star in Orion\'s shoulder',
      binoculars: 'Beautiful orange-red color. Compare it to blue-white Rigel!',
      small: 'Deep orange color. One of the largest stars visible to us.',
      large: 'Possible surface detail — this star is so huge it can almost be resolved!',
      space: 'Resolved surface showing convection cells and mass ejections.',
    },
  };
  return [venus, moon, jupiter, mars, saturn, sirius, betelgeuse, pleiades, orionNebula, andromeda];
}

/**
 * Helper: Get default hints based on grade level
 */
function getDefaultHints(gradeLevel: string): string[] {
  const hintsByGrade: Record<string, string[]> = {
    'K': [
      "Venus is the brightest light in the sky! Can you find it?",
      "Drag to move your telescope around!",
      "Use the slider to zoom in and see things bigger!"
    ],
    '1': [
      "Venus is super bright! Look for it in the west!",
      "Zoom in on the Moon to see its craters!",
      "Jupiter looks like a tiny disk with dots nearby!"
    ],
    '2': [
      "Venus shines with a warm yellow glow!",
      "Try different telescopes to see more!",
      "Some things are easier to find than others!",
      "The Pleiades look like a tiny group of stars!"
    ],
    '3': [
      "Venus appears as a bright crescent in a small telescope!",
      "Try infrared mode to see the nebula differently!",
      "Log your observations in the journal!",
      "Different telescopes show different details!"
    ],
    '4': [
      "Venus shows phases just like the Moon!",
      "The Andromeda galaxy is 2.5 million light-years away!",
      "Use the grid to record object positions!",
      "Professional astronomers always log their observations!"
    ],
    '5': [
      "Manual focus requires patience — adjust slowly!",
      "Venus shows different phases depending on its orbit!",
      "Compare what you see in visible vs infrared light!",
      "Use the coordinate grid for systematic sky surveys!"
    ],
  };
  return hintsByGrade[gradeLevel] || hintsByGrade['3'];
}
