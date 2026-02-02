import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';

// Import data types from component (single source of truth)
import type {
  ScaleComparatorData,
  CelestialObject,
  ReferenceObject,
} from '../../primitives/visual-primitives/astronomy/ScaleComparator';

// ============================================================================
// REFERENCE DATA - Accurate astronomical values for validation/fallback
// These are NOT the only objects that can be used - Gemini can generate any object
// ============================================================================

const KNOWN_CELESTIAL_DATA: Record<string, Partial<CelestialObject>> = {
  // Solar System - Stars
  sun: { diameterKm: 1392000, massKg: 1.989e30, distanceFromSunAu: 0, color: '#FDB813' },

  // Solar System - Planets
  mercury: { diameterKm: 4879, massKg: 3.285e23, distanceFromSunAu: 0.39, color: '#8C7853' },
  venus: { diameterKm: 12104, massKg: 4.867e24, distanceFromSunAu: 0.72, color: '#FFC649' },
  earth: { diameterKm: 12742, massKg: 5.972e24, distanceFromSunAu: 1.0, color: '#4A90E2' },
  mars: { diameterKm: 6779, massKg: 6.39e23, distanceFromSunAu: 1.52, color: '#E27B58' },
  jupiter: { diameterKm: 139820, massKg: 1.898e27, distanceFromSunAu: 5.2, color: '#C88B3A' },
  saturn: { diameterKm: 116460, massKg: 5.683e26, distanceFromSunAu: 9.54, color: '#FAD5A5' },
  uranus: { diameterKm: 50724, massKg: 8.681e25, distanceFromSunAu: 19.19, color: '#4FD0E0' },
  neptune: { diameterKm: 49244, massKg: 1.024e26, distanceFromSunAu: 30.07, color: '#4166F5' },

  // Moons
  moon: { diameterKm: 3474, massKg: 7.342e22, distanceFromSunAu: 1.0, color: '#C0C0C0' },
  europa: { diameterKm: 3121, massKg: 4.8e22, distanceFromSunAu: 5.2, color: '#B8A88A' },
  titan: { diameterKm: 5150, massKg: 1.345e23, distanceFromSunAu: 9.54, color: '#E8B86D' },
  ganymede: { diameterKm: 5268, massKg: 1.482e23, distanceFromSunAu: 5.2, color: '#8B7355' },

  // Dwarf Planets
  pluto: { diameterKm: 2377, massKg: 1.303e22, distanceFromSunAu: 39.5, color: '#C4A484' },
  ceres: { diameterKm: 939, massKg: 9.39e20, distanceFromSunAu: 2.77, color: '#8B8989' },
  eris: { diameterKm: 2326, massKg: 1.66e22, distanceFromSunAu: 67.8, color: '#D4D4D4' },

  // Notable Stars (approximate diameters)
  'proxima-centauri': { diameterKm: 214550, massKg: 2.446e29, distanceLightYears: 4.24, color: '#FF6B6B' },
  sirius: { diameterKm: 2380000, massKg: 4.018e30, distanceLightYears: 8.6, color: '#A0C4FF' },
  betelgeuse: { diameterKm: 1234000000, massKg: 2.188e31, distanceLightYears: 700, color: '#FF4500' },
  'alpha-centauri-a': { diameterKm: 1703000, massKg: 2.188e30, distanceLightYears: 4.37, color: '#FFF5E1' },
  vega: { diameterKm: 3740000, massKg: 4.074e30, distanceLightYears: 25, color: '#BFEFFF' },
  polaris: { diameterKm: 53000000, massKg: 1.192e31, distanceLightYears: 433, color: '#FFFACD' },

  // Galaxies (diameters in km for consistency, though usually measured in light-years)
  'milky-way': { diameterKm: 9.5e17, massKg: 1.5e42, color: '#E8D5B7' }, // ~100,000 ly
  andromeda: { diameterKm: 2.2e18, massKg: 1.5e42, distanceLightYears: 2537000, color: '#B4A7D6' }, // ~220,000 ly
  'triangulum-galaxy': { diameterKm: 5.7e17, massKg: 5e40, distanceLightYears: 2730000, color: '#9FC5E8' },
  'large-magellanic-cloud': { diameterKm: 1.4e17, massKg: 1e40, distanceLightYears: 160000, color: '#F9CB9C' },

  // Nebulae
  'orion-nebula': { diameterKm: 2.3e14, massKg: 4e33, distanceLightYears: 1344, color: '#FF69B4' }, // ~24 ly
  'crab-nebula': { diameterKm: 1.0e14, massKg: 4.6e30, distanceLightYears: 6500, color: '#98FB98' },
  'helix-nebula': { diameterKm: 5.5e13, massKg: 1e30, distanceLightYears: 650, color: '#00CED1' },
};

// Reference objects for familiar comparisons
const REFERENCE_DATA: Record<string, ReferenceObject> = {
  pinhead: { id: 'pinhead', name: 'Pinhead', size: 0.001, emoji: '📍', category: 'everyday', color: '#999999', description: 'A tiny pin head' },
  marble: { id: 'marble', name: 'Marble', size: 0.015, emoji: '🔵', category: 'everyday', color: '#3B82F6', description: 'A small glass marble' },
  'golf-ball': { id: 'golf-ball', name: 'Golf Ball', size: 0.043, emoji: '⛳', category: 'everyday', color: '#FFFFFF', description: 'A golf ball' },
  'tennis-ball': { id: 'tennis-ball', name: 'Tennis Ball', size: 0.067, emoji: '🎾', category: 'everyday', color: '#BFFF00', description: 'A tennis ball' },
  baseball: { id: 'baseball', name: 'Baseball', size: 0.074, emoji: '⚾', category: 'everyday', color: '#FFFFFF', description: 'A baseball' },
  basketball: { id: 'basketball', name: 'Basketball', size: 0.24, emoji: '🏀', category: 'everyday', color: '#FF8C00', description: 'A basketball' },
  'beach-ball': { id: 'beach-ball', name: 'Beach Ball', size: 0.5, emoji: '🏖️', category: 'everyday', color: '#FF6B6B', description: 'A beach ball' },
  person: { id: 'person', name: 'Person', size: 1.7, emoji: '🧍', category: 'everyday', color: '#F59E0B', description: 'Average height person' },
  car: { id: 'car', name: 'Car', size: 4.5, emoji: '🚗', category: 'vehicle', color: '#3B82F6', description: 'A typical car' },
  'school-bus': { id: 'school-bus', name: 'School Bus', size: 12, emoji: '🚌', category: 'vehicle', color: '#FBBF24', description: 'A school bus' },
  house: { id: 'house', name: 'House', size: 10, emoji: '🏠', category: 'building', color: '#EF4444', description: 'A typical house' },
  'football-field': { id: 'football-field', name: 'Football Field', length: 100, emoji: '🏈', category: 'geography', color: '#22C55E', description: 'American football field (100m)' },
  'empire-state': { id: 'empire-state', name: 'Empire State Building', size: 443, emoji: '🏢', category: 'building', color: '#6B7280', description: 'Empire State Building height' },
  'mt-everest': { id: 'mt-everest', name: 'Mt. Everest', size: 8849, emoji: '🏔️', category: 'geography', color: '#E5E7EB', description: 'Tallest mountain on Earth' },
};

// ============================================================================
// GEMINI SCHEMAS
// ============================================================================

const celestialObjectSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: 'Unique identifier (lowercase, hyphenated, no spaces, e.g., "proxima-centauri")',
    },
    name: {
      type: Type.STRING,
      description: 'Display name of the celestial object',
    },
    type: {
      type: Type.STRING,
      enum: ['planet', 'moon', 'star', 'asteroid', 'dwarf_planet', 'comet', 'galaxy', 'nebula', 'star_cluster', 'black_hole', 'exoplanet', 'pulsar', 'quasar'],
      description: 'Type of celestial body',
    },
    diameterKm: {
      type: Type.NUMBER,
      description: 'Diameter in kilometers. MUST be astronomically accurate. For galaxies use full diameter converted to km.',
    },
    massKg: {
      type: Type.NUMBER,
      description: 'Mass in kilograms. Use scientific notation (e.g., 1.989e30 for the Sun).',
    },
    distanceFromSunAu: {
      type: Type.NUMBER,
      description: 'Distance from Sun in AU. Only for solar system objects. 1 AU = Earth-Sun distance.',
      nullable: true,
    },
    distanceLightYears: {
      type: Type.NUMBER,
      description: 'Distance from Earth in light years. For objects outside solar system.',
      nullable: true,
    },
    color: {
      type: Type.STRING,
      description: 'Hex color representing the object (e.g., #4A90E2 for blue). Choose colors that match the object\'s actual appearance.',
    },
    textureGradient: {
      type: Type.STRING,
      description: 'CSS radial-gradient for visual appeal (e.g., "radial-gradient(circle, #light, #main, #dark)")',
    },
    description: {
      type: Type.STRING,
      description: 'Age-appropriate description of the object, engaging and educational.',
    },
    funFact: {
      type: Type.STRING,
      description: 'An interesting, memorable fact about this object.',
      nullable: true,
    },
    category: {
      type: Type.STRING,
      description: 'Category for grouping (e.g., "Solar System", "Milky Way Stars", "Nearby Galaxies")',
      nullable: true,
    },
  },
  required: ['id', 'name', 'type', 'diameterKm', 'massKg', 'color', 'textureGradient', 'description'],
};

const scaleComparatorResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Engaging, age-appropriate title for the comparison activity',
    },
    description: {
      type: Type.STRING,
      description: 'Clear description explaining what students will compare and learn',
    },
    objects: {
      type: Type.ARRAY,
      items: celestialObjectSchema,
      description: 'Array of celestial objects to compare. Choose objects relevant to the topic and scope.',
    },
    scope: {
      type: Type.STRING,
      enum: ['solar_system', 'milky_way', 'local_group', 'observable_universe', 'custom'],
      description: 'The scope/scale of comparison',
    },
    suggestedUnits: {
      type: Type.STRING,
      enum: ['km', 'miles', 'AU', 'light_seconds', 'light_years', 'parsecs'],
      description: 'Best unit for displaying distances at this scope',
    },
    referenceObjectIds: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'IDs of familiar reference objects to include (e.g., ["basketball", "marble"])',
    },
  },
  required: ['title', 'description', 'objects', 'scope', 'suggestedUnits', 'referenceObjectIds'],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getGradeConfig(gradeLevel: string): {
  compareType: 'size' | 'distance' | 'mass' | 'time';
  objectCount: { min: number; max: number };
  showRatios: boolean;
  interactiveWalk: boolean;
  includeScaleModel: boolean;
  allowedScopes: string[];
} {
  switch (gradeLevel) {
    case 'K':
      return {
        compareType: 'size',
        objectCount: { min: 2, max: 3 },
        showRatios: false,
        interactiveWalk: false,
        includeScaleModel: false,
        allowedScopes: ['solar_system'],
      };
    case '1':
      return {
        compareType: 'size',
        objectCount: { min: 3, max: 4 },
        showRatios: false,
        interactiveWalk: false,
        includeScaleModel: false,
        allowedScopes: ['solar_system'],
      };
    case '2':
      return {
        compareType: 'size',
        objectCount: { min: 4, max: 5 },
        showRatios: true,
        interactiveWalk: false,
        includeScaleModel: false,
        allowedScopes: ['solar_system'],
      };
    case '3':
      return {
        compareType: 'distance',
        objectCount: { min: 5, max: 6 },
        showRatios: true,
        interactiveWalk: true,
        includeScaleModel: false,
        allowedScopes: ['solar_system', 'milky_way'],
      };
    case '4':
      return {
        compareType: 'size',
        objectCount: { min: 6, max: 8 },
        showRatios: true,
        interactiveWalk: true,
        includeScaleModel: true,
        allowedScopes: ['solar_system', 'milky_way', 'local_group'],
      };
    case '5':
      return {
        compareType: 'size',
        objectCount: { min: 7, max: 10 },
        showRatios: true,
        interactiveWalk: true,
        includeScaleModel: true,
        allowedScopes: ['solar_system', 'milky_way', 'local_group', 'observable_universe'],
      };
    default:
      return {
        compareType: 'size',
        objectCount: { min: 3, max: 5 },
        showRatios: true,
        interactiveWalk: false,
        includeScaleModel: false,
        allowedScopes: ['solar_system', 'milky_way'],
      };
  }
}

function validateAndEnrichObject(obj: CelestialObject): CelestialObject {
  // Check if we have known data for this object
  const knownData = KNOWN_CELESTIAL_DATA[obj.id];

  if (knownData) {
    // Use known accurate values where available, but keep AI-generated descriptions
    return {
      ...obj,
      diameterKm: knownData.diameterKm ?? obj.diameterKm,
      massKg: knownData.massKg ?? obj.massKg,
      distanceFromSunAu: knownData.distanceFromSunAu ?? obj.distanceFromSunAu,
      distanceLightYears: knownData.distanceLightYears ?? obj.distanceLightYears,
      color: knownData.color ?? obj.color,
    };
  }

  return obj;
}

// ============================================================================
// MAIN GENERATOR FUNCTION
// ============================================================================

export const generateScaleComparator = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<ScaleComparatorData>
): Promise<ScaleComparatorData> => {
  const gradeConfig = getGradeConfig(gradeLevel);

  // Build the prompt for Gemini to generate appropriate objects
  const prompt = `
You are an astronomy education expert creating a scale comparison activity for ${gradeLevel === 'K' ? 'Kindergarten' : `Grade ${gradeLevel}`} students.

**Topic**: ${topic}

**Your Task**: Generate celestial objects that are most relevant and interesting for this topic. You are NOT limited to our solar system - choose objects that best illustrate the concept.

**Grade Level Guidelines**:
${gradeLevel === 'K' ? `
- Use only 2-3 objects (keep it simple)
- Focus on familiar objects: Earth, Moon, Sun
- Use simple comparisons: "big" vs "small"
- Objects should be from the solar system only
` : ''}
${gradeLevel === '1' ? `
- Use 3-4 objects
- Focus on planets that are easy to understand
- Simple size relationships
- Solar system objects only
` : ''}
${gradeLevel === '2' ? `
- Use 4-5 objects
- Can compare the Sun to planets (show how much bigger the Sun is)
- Simple ratios like "109 times bigger"
- Primarily solar system, can mention nearby stars
` : ''}
${gradeLevel === '3' ? `
- Use 5-6 objects
- Can explore distances, not just sizes
- Can include nearby stars like Proxima Centauri or Sirius
- Introduce concept of light-years
` : ''}
${gradeLevel === '4' ? `
- Use 6-8 objects
- Can compare across scales: planets, stars, nebulae
- Include objects from the Milky Way
- Can discuss AU and light-years
` : ''}
${gradeLevel === '5' ? `
- Use 7-10 objects
- Full cosmic scale: planets, stars, galaxies, nebulae
- Can include other galaxies like Andromeda
- Discuss the vastness of space
- Can use scientific notation
` : ''}

**Scope Options**: ${gradeConfig.allowedScopes.join(', ')}
Choose the most appropriate scope based on the topic. For example:
- "Compare Earth to other rocky planets" → solar_system
- "How big is our Sun compared to other stars?" → milky_way
- "How big is our galaxy?" → local_group or observable_universe

**CRITICAL - Astronomical Accuracy**:
- All diameter and mass values MUST be scientifically accurate
- Common values you should know:
  - Sun: 1,392,000 km diameter, 1.989×10³⁰ kg
  - Earth: 12,742 km diameter, 5.972×10²⁴ kg
  - Jupiter: 139,820 km diameter
  - Moon: 3,474 km diameter
  - Betelgeuse: ~1.2 billion km diameter
  - Milky Way: ~100,000 light-years diameter (~9.5×10¹⁷ km)
  - Andromeda: ~220,000 light-years diameter

**Reference Objects to Choose From**:
${Object.values(REFERENCE_DATA).map(r => `- ${r.id}: ${r.name} (${r.size || r.length}m)`).join('\n')}

Choose 3-5 reference objects that make sense for the scale of comparison.

Generate an engaging comparison that will help students understand the incredible scales of the universe!
`.trim();

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: scaleComparatorResponseSchema,
      },
    });

    const generated = JSON.parse(result.text || '{}');

    // Validate and enrich objects with known accurate data
    const validatedObjects: CelestialObject[] = (generated.objects || []).map(validateAndEnrichObject);

    // Get reference objects
    const referenceObjects: ReferenceObject[] = (generated.referenceObjectIds || ['basketball', 'marble', 'car'])
      .map((id: string) => REFERENCE_DATA[id])
      .filter(Boolean);

    // Determine appropriate units based on scope
    const units = generated.suggestedUnits || (
      generated.scope === 'solar_system' ? 'AU' :
      generated.scope === 'milky_way' ? 'light_years' :
      'light_years'
    );

    // Build final data structure
    const data: ScaleComparatorData = {
      title: generated.title || `Exploring ${topic}`,
      description: generated.description || `Let's compare sizes in space!`,
      compareType: gradeConfig.compareType,
      objects: validatedObjects,
      referenceObjects,
      scope: generated.scope || 'solar_system',
      showRatios: gradeConfig.showRatios,
      showFamiliarEquivalent: true,
      interactiveWalk: gradeConfig.interactiveWalk,
      units: units as ScaleComparatorData['units'],
      useLogarithmicScale: true,
      scaleModelBase: gradeConfig.includeScaleModel
        ? { objectId: validatedObjects[0]?.id || 'sun', referenceId: 'basketball' }
        : undefined,
      defaultComparison: validatedObjects.length >= 2
        ? { object1: validatedObjects[0].id, object2: validatedObjects[1].id }
        : undefined,
      gradeLevel: gradeLevel as 'K' | '1' | '2' | '3' | '4' | '5',
    };

    // Apply config overrides
    return { ...data, ...config };

  } catch (error) {
    console.error('Error generating scale comparator:', error);

    // Fallback: Generate basic solar system comparison
    return generateFallbackData(topic, gradeLevel, gradeConfig, config);
  }
};

// Fallback function if Gemini fails
function generateFallbackData(
  topic: string,
  gradeLevel: string,
  gradeConfig: ReturnType<typeof getGradeConfig>,
  config?: Partial<ScaleComparatorData>
): ScaleComparatorData {
  // Basic solar system objects as fallback
  const fallbackObjects: CelestialObject[] = [
    {
      id: 'earth',
      name: 'Earth',
      type: 'planet',
      diameterKm: 12742,
      massKg: 5.972e24,
      distanceFromSunAu: 1.0,
      color: '#4A90E2',
      textureGradient: 'radial-gradient(circle, #7CB3F5, #4A90E2, #2E5F8F)',
      description: 'Our home planet!',
      funFact: 'Earth is the only planet known to have life!',
      category: 'Solar System',
    },
    {
      id: 'moon',
      name: 'Moon',
      type: 'moon',
      diameterKm: 3474,
      massKg: 7.342e22,
      distanceFromSunAu: 1.0,
      color: '#C0C0C0',
      textureGradient: 'radial-gradient(circle, #E0E0E0, #C0C0C0, #909090)',
      description: 'Earth\'s only natural satellite.',
      funFact: 'The same side of the Moon always faces Earth!',
      category: 'Solar System',
    },
    {
      id: 'jupiter',
      name: 'Jupiter',
      type: 'planet',
      diameterKm: 139820,
      massKg: 1.898e27,
      distanceFromSunAu: 5.2,
      color: '#C88B3A',
      textureGradient: 'radial-gradient(circle, #E6B87D, #C88B3A, #9E6B2E)',
      description: 'The largest planet in our solar system!',
      funFact: 'Jupiter has a giant storm called the Great Red Spot!',
      category: 'Solar System',
    },
    {
      id: 'sun',
      name: 'Sun',
      type: 'star',
      diameterKm: 1392000,
      massKg: 1.989e30,
      distanceFromSunAu: 0,
      color: '#FDB813',
      textureGradient: 'radial-gradient(circle, #FFE484, #FDB813, #F77F00)',
      description: 'The star at the center of our solar system.',
      funFact: 'Over 1 million Earths could fit inside the Sun!',
      category: 'Solar System',
    },
  ];

  const objectCount = gradeConfig.objectCount.max;
  const objects = fallbackObjects.slice(0, objectCount);

  return {
    title: `Comparing Sizes: ${topic}`,
    description: 'Explore the incredible sizes of objects in our solar system!',
    compareType: gradeConfig.compareType,
    objects,
    referenceObjects: [REFERENCE_DATA['basketball'], REFERENCE_DATA['marble'], REFERENCE_DATA['car']].filter(Boolean),
    scope: 'solar_system',
    showRatios: gradeConfig.showRatios,
    showFamiliarEquivalent: true,
    interactiveWalk: gradeConfig.interactiveWalk,
    units: 'km',
    useLogarithmicScale: true,
    defaultComparison: { object1: objects[0].id, object2: objects[1]?.id || objects[0].id },
    gradeLevel: gradeLevel as 'K' | '1' | '2' | '3' | '4' | '5',
    ...config,
  };
}
