import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  SolarSystemExplorerData,
  CelestialBody,
} from '../../primitives/visual-primitives/astronomy/SolarSystemExplorer';

// Re-export for convenience if needed elsewhere
export type { SolarSystemExplorerData, CelestialBody };

/**
 * Schema for Celestial Body
 */
const celestialBodySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique identifier (lowercase, hyphenated). E.g., 'sun', 'mercury', 'earth', 'mars', 'jupiter'"
    },
    name: {
      type: Type.STRING,
      description: "Display name of the celestial body. E.g., 'Sun', 'Mercury', 'Earth', 'Mars'"
    },
    type: {
      type: Type.STRING,
      enum: ["star", "planet", "dwarf-planet"],
      description: "Type of celestial body. Sun is 'star', planets are 'planet', Pluto is 'dwarf-planet'."
    },
    color: {
      type: Type.STRING,
      description: "Hex color code representing the body. Sun: '#FDB813', Mercury: '#8C7853', Venus: '#FFC649', Earth: '#4A90E2', Mars: '#CD5C5C', Jupiter: '#C88B3A', Saturn: '#FAD5A5', Uranus: '#4FD0E0', Neptune: '#4169E1', Pluto: '#A0826D'"
    },
    radiusKm: {
      type: Type.NUMBER,
      description: "Radius in kilometers. Sun: 696000, Mercury: 2440, Venus: 6052, Earth: 6371, Mars: 3390, Jupiter: 69911, Saturn: 58232, Uranus: 25362, Neptune: 24622, Pluto: 1188"
    },
    distanceAu: {
      type: Type.NUMBER,
      description: "Average distance from Sun in AU (Astronomical Units). Sun: 0, Mercury: 0.39, Venus: 0.72, Earth: 1.0, Mars: 1.52, Jupiter: 5.2, Saturn: 9.54, Uranus: 19.19, Neptune: 30.07, Pluto: 39.48"
    },
    orbitalPeriodDays: {
      type: Type.NUMBER,
      description: "Time to orbit Sun in Earth days. Sun: 0, Mercury: 88, Venus: 225, Earth: 365.25, Mars: 687, Jupiter: 4333, Saturn: 10759, Uranus: 30687, Neptune: 60190, Pluto: 90560"
    },
    rotationPeriodHours: {
      type: Type.NUMBER,
      description: "Time for one rotation in hours. Sun: 609.12, Mercury: 1407.6, Venus: 5832.5, Earth: 24, Mars: 24.6, Jupiter: 9.9, Saturn: 10.7, Uranus: 17.2, Neptune: 16.1, Pluto: 153.3"
    },
    moons: {
      type: Type.NUMBER,
      description: "Number of known moons. Sun: 0, Mercury: 0, Venus: 0, Earth: 1, Mars: 2, Jupiter: 95, Saturn: 146, Uranus: 28, Neptune: 16, Pluto: 5"
    },
    description: {
      type: Type.STRING,
      description: "Age-appropriate description (2-3 sentences) explaining what makes this body special. Focus on observable features and fun facts."
    },
    textureGradient: {
      type: Type.STRING,
      description: "CSS gradient string for visual representation. E.g., 'radial-gradient(circle, #4A90E2 0%, #2E5C8A 100%)'"
    },
    temperatureC: {
      type: Type.NUMBER,
      description: "Average surface temperature in Celsius. Sun: 5500, Mercury: 167, Venus: 464, Earth: 15, Mars: -65, Jupiter: -110, Saturn: -140, Uranus: -195, Neptune: -200, Pluto: -225"
    },
    funFact: {
      type: Type.STRING,
      description: "Optional fun fact for kids (1 sentence). E.g., 'A day on Venus is longer than its year!'",
      nullable: true
    }
  },
  required: ["id", "name", "type", "color", "radiusKm", "distanceAu", "orbitalPeriodDays", "rotationPeriodHours", "moons", "description", "textureGradient", "temperatureC"]
};

/**
 * Schema for Solar System Explorer Data
 */
const solarSystemExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the solar system activity (e.g., 'Explore Our Solar System', 'Journey Through Space')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will explore. Use age-appropriate language."
    },
    bodies: {
      type: Type.ARRAY,
      items: celestialBodySchema,
      description: "Array of celestial bodies to display. Always include Sun. For K-2: Sun + 4 inner planets. For 3-5: All 8 planets + optional dwarf planets."
    },
    initialZoom: {
      type: Type.STRING,
      enum: ["system", "inner", "outer", "planet", "moon"],
      description: "Starting zoom level. K-1: 'inner' (easier to see), 2-3: 'system' (full view), 4-5: 'system' or 'inner'"
    },
    focusBody: {
      type: Type.STRING,
      description: "ID of body to initially highlight/select. Common: 'earth' for relatability, 'sun' for overview, null for no selection",
      nullable: true
    },
    timeScale: {
      type: Type.NUMBER,
      description: "Simulation speed multiplier (100-20000). K-2: 8000-10000 (faster, engaging), 3-5: 5000-8000 (observable patterns)"
    },
    showOrbits: {
      type: Type.BOOLEAN,
      description: "Display orbital paths. Default: true"
    },
    showLabels: {
      type: Type.BOOLEAN,
      description: "Display planet names. Default: true"
    },
    scaleMode: {
      type: Type.STRING,
      enum: ["size_accurate", "distance_accurate", "hybrid"],
      description: "Scaling mode. K-2: 'hybrid' (balanced), 3-4: 'size_accurate' (compare sizes), 5: 'distance_accurate' (teach scale)"
    },
    showHabitableZone: {
      type: Type.BOOLEAN,
      description: "Highlight the habitable 'Goldilocks Zone'. K-2: false (too advanced), 3-5: true (introduces astrobiology)"
    },
    dateTime: {
      type: Type.STRING,
      description: "ISO date string for initial planet positions. Default: current date. Use specific dates for special events (e.g., '2024-04-08' for eclipse)",
      nullable: true
    },
    showDistances: {
      type: Type.BOOLEAN,
      description: "Display distances in AU. K-2: false, 3-4: optional, 5: true (teaches astronomical units)"
    },
    compareMode: {
      type: Type.BOOLEAN,
      description: "Enable side-by-side planet comparison. K-2: false, 3-5: true (comparative analysis)"
    },
    gradeLevel: {
      type: Type.STRING,
      enum: ["K", "1", "2", "3", "4", "5"],
      description: "Target grade level for content"
    }
  },
  required: ["title", "description", "bodies", "initialZoom", "timeScale", "showOrbits", "showLabels", "scaleMode", "showHabitableZone", "showDistances", "compareMode", "gradeLevel"]
};

/**
 * Generate Solar System Explorer data for visualization
 *
 * Creates interactive solar system models appropriate for K-5 astronomy education:
 * - K: Planet names, order from sun, "our Earth"
 * - 1: Inner vs outer planets, relative sizes
 * - 2: Orbital paths, day/year concepts
 * - 3: Moons, rings, asteroid belt
 * - 4: Orbital periods, distance in AU
 * - 5: Gravity effects, Kepler's insights
 *
 * @param topic - The astronomy topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns SolarSystemExplorerData with complete configuration
 */
export const generateSolarSystemExplorer = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<SolarSystemExplorerData>
): Promise<SolarSystemExplorerData> => {
  const prompt = `
Create an educational Solar System Explorer visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - SOLAR SYSTEM ASTRONOMY:
The Solar System Explorer is a dynamic, interactive model showing:
1. THE SUN - Our star at the center (99.86% of solar system mass)
2. INNER PLANETS - Rocky, small, close to Sun (Mercury, Venus, Earth, Mars)
3. OUTER PLANETS - Gas/ice giants, huge, far from Sun (Jupiter, Saturn, Uranus, Neptune)
4. DWARF PLANETS - Small bodies like Pluto, Ceres, Eris (optional for advanced grades)
5. ORBITS - Elliptical paths planets follow around the Sun
6. ASTRONOMICAL UNIT (AU) - Distance from Earth to Sun (~150 million km)

KEY ASTRONOMICAL CONCEPTS:
- Planets orbit the Sun due to gravity
- Inner planets are rocky and small; outer planets are gas giants
- Orbital period increases with distance (Kepler's Third Law)
- The habitable zone is where liquid water can exist (around 1 AU for Sun-like stars)
- Day = one rotation, Year = one orbit
- Size vs. distance scale challenge (can't show both accurately at once)

GRADE-LEVEL LEARNING PROGRESSION:

KINDERGARTEN (ages 5-6):
- Focus: Planet names, order from Sun, "our Earth"
- Bodies: Sun, Mercury, Venus, Earth, Mars (inner planets only - simpler!)
- Description: "Let's visit the planets in our neighborhood! Can you find Earth, our home?"
- initialZoom: 'inner' (zoomed to inner planets for visibility)
- focusBody: 'earth' (highlight our home)
- timeScale: 10000 (fast, engaging movement)
- scaleMode: 'hybrid' (balanced, visible)
- showOrbits: true (see the paths)
- showLabels: true (always show names)
- showDistances: false (too abstract)
- showHabitableZone: false (too advanced)
- compareMode: false (keep it simple)
- Language: "Our Sun is like a big ball of fire! The planets go around and around it."

GRADE 1 (ages 6-7):
- Focus: Inner vs outer planets, relative sizes
- Bodies: Sun + all 8 planets (introduce full system)
- Description: "Discover the eight planets! Some are small and rocky. Some are HUGE and gassy!"
- initialZoom: 'system' (see all planets)
- focusBody: 'earth' (start with familiar)
- timeScale: 8000
- scaleMode: 'hybrid'
- showOrbits: true
- showLabels: true
- showDistances: false
- showHabitableZone: false
- compareMode: false
- Language: "The four inner planets are small and rocky. The four outer planets are giant balls of gas!"

GRADE 2 (ages 7-8):
- Focus: Orbital paths, day/year concepts
- Bodies: Sun + 8 planets
- Description: "Watch the planets orbit! See how they move at different speeds around the Sun."
- initialZoom: 'system'
- focusBody: null (let students explore)
- timeScale: 6000 (slower, observable patterns)
- scaleMode: 'hybrid'
- showOrbits: true (emphasize paths)
- showLabels: true
- showDistances: false
- showHabitableZone: false
- compareMode: false
- Language: "A year is how long it takes a planet to go around the Sun. Earth takes 365 days!"

GRADE 3 (ages 8-9):
- Focus: Moons, rings, asteroid belt concepts
- Bodies: Sun + 8 planets (+ optional Pluto as dwarf planet)
- Description: "Explore moons and rings! Many planets have their own smaller worlds orbiting them."
- initialZoom: 'system'
- focusBody: 'saturn' or 'jupiter' (moon-rich planets)
- timeScale: 5000
- scaleMode: 'size_accurate' (compare planet sizes)
- showOrbits: true
- showLabels: true
- showDistances: true (introduce AU concept)
- showHabitableZone: true (introduce "Goldilocks Zone")
- compareMode: true (enable comparisons)
- Language: "Jupiter has 95 moons! Saturn's beautiful rings are made of ice and rock."

GRADE 4 (ages 9-10):
- Focus: Orbital periods, distance in AU
- Bodies: Sun + 8 planets + Pluto
- Description: "Measure distances in space! Learn why planets farther from the Sun take longer to orbit."
- initialZoom: 'system'
- focusBody: null
- timeScale: 4000 (slower for observation)
- scaleMode: 'distance_accurate' (teach true scale)
- showOrbits: true
- showLabels: true
- showDistances: true (emphasize AU measurements)
- showHabitableZone: true
- compareMode: true
- Language: "Neptune is 30 AU from the Sun! That's 30 times farther than Earth. No wonder its year is 165 Earth years!"

GRADE 5 (ages 10-11):
- Focus: Gravity effects, Kepler's laws, astrobiology
- Bodies: Sun + 8 planets + dwarf planets (Pluto, Ceres, Eris)
- Description: "Uncover the laws of planetary motion! Explore how gravity shapes our solar system."
- initialZoom: 'system'
- focusBody: null
- timeScale: 3000 (precise observation)
- scaleMode: 'distance_accurate' (true scale understanding)
- showOrbits: true
- showLabels: true
- showDistances: true
- showHabitableZone: true (link to life potential)
- compareMode: true
- Language: "Kepler discovered that planets farther from the Sun move slower and take longer to orbit. Can you see the pattern?"

ACCURATE CELESTIAL DATA (Use these values):

SUN:
- id: 'sun', name: 'Sun', type: 'star'
- color: '#FDB813'
- radiusKm: 696000
- distanceAu: 0
- orbitalPeriodDays: 0
- rotationPeriodHours: 609.12
- moons: 0
- temperatureC: 5500
- description: "The Sun is our star! It's a giant ball of hot gas that gives us light and warmth."
- funFact: "The Sun is so big that over 1 million Earths could fit inside it!"

MERCURY:
- id: 'mercury', name: 'Mercury', type: 'planet'
- color: '#8C7853'
- radiusKm: 2440
- distanceAu: 0.39
- orbitalPeriodDays: 88
- rotationPeriodHours: 1407.6
- moons: 0
- temperatureC: 167
- description: "Mercury is the smallest planet and closest to the Sun. It's rocky and has lots of craters!"
- funFact: "Mercury is super fast! It zips around the Sun in just 88 days."

VENUS:
- id: 'venus', name: 'Venus', type: 'planet'
- color: '#FFC649'
- radiusKm: 6052
- distanceAu: 0.72
- orbitalPeriodDays: 225
- rotationPeriodHours: 5832.5
- moons: 0
- temperatureC: 464
- description: "Venus is Earth's 'sister planet' but it's covered in thick, poisonous clouds. It's the hottest planet!"
- funFact: "A day on Venus (243 Earth days) is longer than its year (225 Earth days)!"

EARTH:
- id: 'earth', name: 'Earth', type: 'planet'
- color: '#4A90E2'
- radiusKm: 6371
- distanceAu: 1.0
- orbitalPeriodDays: 365.25
- rotationPeriodHours: 24
- moons: 1
- temperatureC: 15
- description: "Earth is our home! It's the only planet we know with life, thanks to liquid water and a protective atmosphere."
- funFact: "Earth is the only planet not named after a god or goddess!"

MARS:
- id: 'mars', name: 'Mars', type: 'planet'
- color: '#CD5C5C'
- radiusKm: 3390
- distanceAu: 1.52
- orbitalPeriodDays: 687
- rotationPeriodHours: 24.6
- moons: 2
- temperatureC: -65
- description: "Mars is the red planet! It has the biggest volcano and canyon in the solar system."
- funFact: "Mars looks red because its soil contains rusty iron!"

JUPITER:
- id: 'jupiter', name: 'Jupiter', type: 'planet'
- color: '#C88B3A'
- radiusKm: 69911
- distanceAu: 5.2
- orbitalPeriodDays: 4333
- rotationPeriodHours: 9.9
- moons: 95
- temperatureC: -110
- description: "Jupiter is the biggest planet! It's a gas giant with a famous giant storm called the Great Red Spot."
- funFact: "Jupiter has 95 moons and counting! Its moon Ganymede is bigger than Mercury."

SATURN:
- id: 'saturn', name: 'Saturn', type: 'planet'
- color: '#FAD5A5'
- radiusKm: 58232
- distanceAu: 9.54
- orbitalPeriodDays: 10759
- rotationPeriodHours: 10.7
- moons: 146
- temperatureC: -140
- description: "Saturn is famous for its beautiful rings made of ice and rock! It's a gas giant with 146 moons."
- funFact: "Saturn is so light it could float in water (if you had a bathtub big enough)!"

URANUS:
- id: 'uranus', name: 'Uranus', type: 'planet'
- color: '#4FD0E0'
- radiusKm: 25362
- distanceAu: 19.19
- orbitalPeriodDays: 30687
- rotationPeriodHours: 17.2
- moons: 28
- temperatureC: -195
- description: "Uranus is an ice giant that spins on its side! It looks blue-green because of methane gas."
- funFact: "Uranus rolls around the Sun like a ball instead of spinning like a top!"

NEPTUNE:
- id: 'neptune', name: 'Neptune', type: 'planet'
- color: '#4169E1'
- radiusKm: 24622
- distanceAu: 30.07
- orbitalPeriodDays: 60190
- rotationPeriodHours: 16.1
- moons: 16
- temperatureC: -200
- description: "Neptune is the farthest planet from the Sun. It's a windy, icy blue world with supersonic storms!"
- funFact: "Neptune has the fastest winds in the solar system - up to 1,200 mph!"

PLUTO (optional for grades 3+):
- id: 'pluto', name: 'Pluto', type: 'dwarf-planet'
- color: '#A0826D'
- radiusKm: 1188
- distanceAu: 39.48
- orbitalPeriodDays: 90560
- rotationPeriodHours: 153.3
- moons: 5
- temperatureC: -225
- description: "Pluto used to be called the 9th planet, but now it's a dwarf planet. It's small, icy, and far away!"
- funFact: "Pluto has a heart-shaped glacier on its surface!"

CSS GRADIENT EXAMPLES:
- Sun: 'radial-gradient(circle, #FDB813 0%, #FD8813 50%, #FD6013 100%)'
- Earth: 'radial-gradient(circle, #4A90E2 0%, #2E5C8A 50%, #1E3A5A 100%)'
- Mars: 'radial-gradient(circle, #CD5C5C 0%, #A04040 50%, #803030 100%)'
- Jupiter: 'radial-gradient(circle, #E5B88A 0%, #C88B3A 50%, #A06020 100%)'
- Saturn: 'radial-gradient(circle, #FAD5A5 0%, #E5B88A 50%, #D0A070 100%)'

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.initialZoom ? `- Initial zoom: ${config.initialZoom}` : ''}
${config.focusBody ? `- Focus body: ${config.focusBody}` : ''}
${config.scaleMode ? `- Scale mode: ${config.scaleMode}` : ''}
${config.showHabitableZone !== undefined ? `- Show habitable zone: ${config.showHabitableZone}` : ''}
${config.showDistances !== undefined ? `- Show distances: ${config.showDistances}` : ''}
${config.compareMode !== undefined ? `- Compare mode: ${config.compareMode}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. bodies array must always include the Sun (id: 'sun', distanceAu: 0)
2. K-2: Include at least inner planets (Mercury, Venus, Earth, Mars)
3. Grades 3+: Include all 8 planets
4. Grade 5: Can include dwarf planets (Pluto, Ceres, Eris)
5. Use accurate astronomical data from the reference above
6. Ensure textureGradient is a valid CSS gradient string
7. descriptions and funFacts must be age-appropriate and scientifically accurate
8. timeScale should be higher for younger grades (faster = more engaging)

Return a complete Solar System Explorer configuration appropriate for the grade level and topic.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: solarSystemExplorerSchema
    },
  });

  // Debug logging to help diagnose the issue
  console.log('[Solar System Explorer] Gemini API Response:', {
    hasText: !!result.text,
    textType: typeof result.text,
    textLength: result.text?.length,
    textPreview: result.text?.substring(0, 200),
    resultKeys: Object.keys(result)
  });

  let data;
  try {
    if (!result.text) {
      throw new Error('No text property in Gemini response');
    }

    // Log the raw text before parsing
    console.log('[Solar System Explorer] Raw text to parse:', result.text.substring(0, 500));

    data = JSON.parse(result.text);
  } catch (parseError) {
    console.error('[Solar System Explorer] Parse Error Details:', {
      error: parseError instanceof Error ? parseError.message : String(parseError),
      textContent: result.text,
      textType: typeof result.text
    });
    throw new Error(`Failed to parse Gemini response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Response text: ${result.text?.substring(0, 200)}`);
  }

  if (!data) {
    throw new Error('No valid Solar System Explorer data returned from Gemini API');
  }

  // Validation: ensure bodies array exists and includes Sun
  if (!data.bodies || data.bodies.length === 0) {
    console.warn('No bodies provided. Setting default solar system.');
    data.bodies = getDefaultBodies(gradeLevel);
  }

  const hasSun = data.bodies.some((b: CelestialBody) => b.id === 'sun');
  if (!hasSun) {
    console.warn('Sun missing from bodies. Adding Sun.');
    data.bodies.unshift({
      id: 'sun',
      name: 'Sun',
      type: 'star',
      color: '#FDB813',
      radiusKm: 696000,
      distanceAu: 0,
      orbitalPeriodDays: 0,
      rotationPeriodHours: 609.12,
      moons: 0,
      description: "The Sun is our star! It's a giant ball of hot gas that gives us light and warmth.",
      textureGradient: 'radial-gradient(circle, #FDB813 0%, #FD8813 50%, #FD6013 100%)',
      temperatureC: 5500,
      funFact: "The Sun is so big that over 1 million Earths could fit inside it!"
    });
  }

  // Validation: ensure timeScale is reasonable
  if (!data.timeScale || data.timeScale < 100 || data.timeScale > 25000) {
    console.warn('Invalid timeScale. Setting default.');
    data.timeScale = 5000;
  }

  // Apply config overrides
  if (config) {
    if (config.bodies) data.bodies = config.bodies;
    if (config.initialZoom) data.initialZoom = config.initialZoom;
    if (config.focusBody !== undefined) data.focusBody = config.focusBody;
    if (config.timeScale !== undefined) data.timeScale = config.timeScale;
    if (config.showOrbits !== undefined) data.showOrbits = config.showOrbits;
    if (config.showLabels !== undefined) data.showLabels = config.showLabels;
    if (config.scaleMode) data.scaleMode = config.scaleMode;
    if (config.showHabitableZone !== undefined) data.showHabitableZone = config.showHabitableZone;
    if (config.dateTime !== undefined) data.dateTime = config.dateTime;
    if (config.showDistances !== undefined) data.showDistances = config.showDistances;
    if (config.compareMode !== undefined) data.compareMode = config.compareMode;
  }

  // Set sensible defaults
  if (data.showOrbits === undefined) data.showOrbits = true;
  if (data.showLabels === undefined) data.showLabels = true;
  if (data.scaleMode === undefined) data.scaleMode = 'hybrid';
  if (data.initialZoom === undefined) data.initialZoom = 'system';

  return data;
};

/**
 * Helper: Get default celestial bodies based on grade level
 */
function getDefaultBodies(gradeLevel: string): CelestialBody[] {
  const sun: CelestialBody = {
    id: 'sun',
    name: 'Sun',
    type: 'star',
    color: '#FDB813',
    radiusKm: 696000,
    distanceAu: 0,
    orbitalPeriodDays: 0,
    rotationPeriodHours: 609.12,
    moons: 0,
    description: "The Sun is our star! It's a giant ball of hot gas that gives us light and warmth.",
    textureGradient: 'radial-gradient(circle, #FDB813 0%, #FD8813 50%, #FD6013 100%)',
    temperatureC: 5500,
    funFact: "The Sun is so big that over 1 million Earths could fit inside it!"
  };

  const innerPlanets: CelestialBody[] = [
    {
      id: 'mercury',
      name: 'Mercury',
      type: 'planet',
      color: '#8C7853',
      radiusKm: 2440,
      distanceAu: 0.39,
      orbitalPeriodDays: 88,
      rotationPeriodHours: 1407.6,
      moons: 0,
      description: "Mercury is the smallest planet and closest to the Sun. It's rocky and has lots of craters!",
      textureGradient: 'radial-gradient(circle, #A08863 0%, #8C7853 50%, #786543 100%)',
      temperatureC: 167,
      funFact: "Mercury is super fast! It zips around the Sun in just 88 days."
    },
    {
      id: 'venus',
      name: 'Venus',
      type: 'planet',
      color: '#FFC649',
      radiusKm: 6052,
      distanceAu: 0.72,
      orbitalPeriodDays: 225,
      rotationPeriodHours: 5832.5,
      moons: 0,
      description: "Venus is Earth's 'sister planet' but it's covered in thick, poisonous clouds. It's the hottest planet!",
      textureGradient: 'radial-gradient(circle, #FFD96A 0%, #FFC649 50%, #E5B030 100%)',
      temperatureC: 464,
      funFact: "A day on Venus is longer than its year!"
    },
    {
      id: 'earth',
      name: 'Earth',
      type: 'planet',
      color: '#4A90E2',
      radiusKm: 6371,
      distanceAu: 1.0,
      orbitalPeriodDays: 365.25,
      rotationPeriodHours: 24,
      moons: 1,
      description: "Earth is our home! It's the only planet we know with life, thanks to liquid water and a protective atmosphere.",
      textureGradient: 'radial-gradient(circle, #5AA0F2 0%, #4A90E2 50%, #3A70B2 100%)',
      temperatureC: 15,
      funFact: "Earth is the only planet not named after a god or goddess!"
    },
    {
      id: 'mars',
      name: 'Mars',
      type: 'planet',
      color: '#CD5C5C',
      radiusKm: 3390,
      distanceAu: 1.52,
      orbitalPeriodDays: 687,
      rotationPeriodHours: 24.6,
      moons: 2,
      description: "Mars is the red planet! It has the biggest volcano and canyon in the solar system.",
      textureGradient: 'radial-gradient(circle, #DD6C6C 0%, #CD5C5C 50%, #BD4C4C 100%)',
      temperatureC: -65,
      funFact: "Mars looks red because its soil contains rusty iron!"
    }
  ];

  const outerPlanets: CelestialBody[] = [
    {
      id: 'jupiter',
      name: 'Jupiter',
      type: 'planet',
      color: '#C88B3A',
      radiusKm: 69911,
      distanceAu: 5.2,
      orbitalPeriodDays: 4333,
      rotationPeriodHours: 9.9,
      moons: 95,
      description: "Jupiter is the biggest planet! It's a gas giant with a famous giant storm called the Great Red Spot.",
      textureGradient: 'radial-gradient(circle, #E5B88A 0%, #C88B3A 50%, #A06020 100%)',
      temperatureC: -110,
      funFact: "Jupiter has 95 moons! Its moon Ganymede is bigger than Mercury."
    },
    {
      id: 'saturn',
      name: 'Saturn',
      type: 'planet',
      color: '#FAD5A5',
      radiusKm: 58232,
      distanceAu: 9.54,
      orbitalPeriodDays: 10759,
      rotationPeriodHours: 10.7,
      moons: 146,
      description: "Saturn is famous for its beautiful rings made of ice and rock! It's a gas giant with 146 moons.",
      textureGradient: 'radial-gradient(circle, #FFE5C5 0%, #FAD5A5 50%, #E5C090 100%)',
      temperatureC: -140,
      funFact: "Saturn is so light it could float in water!"
    },
    {
      id: 'uranus',
      name: 'Uranus',
      type: 'planet',
      color: '#4FD0E0',
      radiusKm: 25362,
      distanceAu: 19.19,
      orbitalPeriodDays: 30687,
      rotationPeriodHours: 17.2,
      moons: 28,
      description: "Uranus is an ice giant that spins on its side! It looks blue-green because of methane gas.",
      textureGradient: 'radial-gradient(circle, #6FE0F0 0%, #4FD0E0 50%, #3FC0D0 100%)',
      temperatureC: -195,
      funFact: "Uranus rolls around the Sun like a ball!"
    },
    {
      id: 'neptune',
      name: 'Neptune',
      type: 'planet',
      color: '#4169E1',
      radiusKm: 24622,
      distanceAu: 30.07,
      orbitalPeriodDays: 60190,
      rotationPeriodHours: 16.1,
      moons: 16,
      description: "Neptune is the farthest planet from the Sun. It's a windy, icy blue world with supersonic storms!",
      textureGradient: 'radial-gradient(circle, #5179F1 0%, #4169E1 50%, #3159D1 100%)',
      temperatureC: -200,
      funFact: "Neptune has the fastest winds in the solar system!"
    }
  ];

  // K-2: Inner planets only
  if (gradeLevel === 'K' || gradeLevel === '1' || gradeLevel === '2') {
    return [sun, ...innerPlanets];
  }

  // 3+: All planets
  return [sun, ...innerPlanets, ...outerPlanets];
}
