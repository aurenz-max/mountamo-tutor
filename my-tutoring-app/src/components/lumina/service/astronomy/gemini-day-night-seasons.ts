import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';

// Import data types from component (single source of truth)
import type {
  DayNightSeasonsData,
  LocationMarker,
} from '../../primitives/visual-primitives/astronomy/DayNightSeasons';

// ============================================================================
// REFERENCE DATA - Sample locations at various latitudes
// ============================================================================

const SAMPLE_LOCATIONS: LocationMarker[] = [
  // Equator
  { id: 'quito', name: 'Quito, Ecuador', latitude: 0, longitude: -78, emoji: '🌎', color: '#EF4444' },
  { id: 'singapore', name: 'Singapore', latitude: 1, longitude: 103, emoji: '🇸🇬', color: '#DC2626' },

  // Low latitudes (tropical)
  { id: 'miami', name: 'Miami, USA', latitude: 26, longitude: -80, emoji: '🏖️', color: '#F59E0B' },
  { id: 'mumbai', name: 'Mumbai, India', latitude: 19, longitude: 72, emoji: '🇮🇳', color: '#F97316' },
  { id: 'rio', name: 'Rio de Janeiro', latitude: -23, longitude: -43, emoji: '🇧🇷', color: '#FB923C' },

  // Mid-latitudes (temperate)
  { id: 'newyork', name: 'New York, USA', latitude: 41, longitude: -74, emoji: '🗽', color: '#3B82F6' },
  { id: 'london', name: 'London, UK', latitude: 51, longitude: 0, emoji: '🇬🇧', color: '#2563EB' },
  { id: 'tokyo', name: 'Tokyo, Japan', latitude: 35, longitude: 139, emoji: '🇯🇵', color: '#60A5FA' },
  { id: 'sydney', name: 'Sydney, Australia', latitude: -34, longitude: 151, emoji: '🇦🇺', color: '#3B82F6' },
  { id: 'chicago', name: 'Chicago, USA', latitude: 42, longitude: -87, emoji: '🌃', color: '#1D4ED8' },

  // High latitudes (polar regions)
  { id: 'reykjavik', name: 'Reykjavik, Iceland', latitude: 64, longitude: -22, emoji: '🇮🇸', color: '#8B5CF6' },
  { id: 'anchorage', name: 'Anchorage, Alaska', latitude: 61, longitude: -150, emoji: '❄️', color: '#7C3AED' },
  { id: 'tromsø', name: 'Tromsø, Norway', latitude: 69, longitude: 19, emoji: '🇳🇴', color: '#6D28D9' },

  // Near Arctic/Antarctic Circle
  { id: 'barrow', name: 'Utqiagvik, Alaska', latitude: 71, longitude: -156, emoji: '🐧', color: '#4C1D95' },
  { id: 'antarctica', name: 'McMurdo, Antarctica', latitude: -77, longitude: 166, emoji: '🧊', color: '#5B21B6' },
];

// ============================================================================
// GEMINI SCHEMAS
// ============================================================================

const locationMarkerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: 'Unique identifier (lowercase, no spaces)',
    },
    name: {
      type: Type.STRING,
      description: 'Display name of the location (e.g., "New York, USA")',
    },
    latitude: {
      type: Type.NUMBER,
      description: 'Latitude in degrees (-90 to 90, negative = south, 0 = equator)',
    },
    longitude: {
      type: Type.NUMBER,
      description: 'Longitude in degrees (-180 to 180, for rotation positioning)',
    },
    emoji: {
      type: Type.STRING,
      description: 'Emoji representing the location (e.g., 🗽 for New York, 🇬🇧 for London)',
      nullable: true,
    },
    color: {
      type: Type.STRING,
      description: 'Hex color for the marker (e.g., #3B82F6)',
    },
  },
  required: ['id', 'name', 'latitude', 'longitude', 'color'],
};

const dayNightSeasonsResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Engaging, age-appropriate title for the learning activity',
    },
    description: {
      type: Type.STRING,
      description: 'Clear description explaining what students will learn and explore',
    },
    focusMode: {
      type: Type.STRING,
      enum: ['day-night', 'seasons', 'both'],
      description: 'Learning focus: day-night (K-2), seasons (3-5), or both (3-5 advanced)',
    },
    initialEarthPosition: {
      type: Type.STRING,
      enum: ['march_equinox', 'june_solstice', 'sept_equinox', 'dec_solstice'],
      description: 'Starting orbital position. Use june_solstice for summer lessons, dec_solstice for winter.',
    },
    viewPerspective: {
      type: Type.STRING,
      enum: ['space_north', 'space_side', 'surface', 'sun_view'],
      description: 'Viewing angle: space_side is best for showing tilt and seasons',
    },
    showTiltAxis: {
      type: Type.BOOLEAN,
      description: 'Show Earth\'s 23.5° tilt axis. Essential for grades 3+.',
    },
    showSunRays: {
      type: Type.BOOLEAN,
      description: 'Show parallel light rays from Sun. Helpful for visualizing direct vs indirect sunlight.',
    },
    showTerminator: {
      type: Type.BOOLEAN,
      description: 'Show day/night boundary. Essential for day-night focus mode.',
    },
    showDaylightHours: {
      type: Type.BOOLEAN,
      description: 'Display calculated daylight hours for selected location.',
    },
    showTemperatureZones: {
      type: Type.BOOLEAN,
      description: 'Show tropical, temperate, and polar zones (grades 4-5).',
    },
    animationMode: {
      type: Type.STRING,
      enum: ['rotation', 'orbit', 'both', 'manual'],
      description: 'Animation type: rotation for day-night, orbit for seasons, both for advanced.',
    },
    timeSpeed: {
      type: Type.NUMBER,
      description: 'Animation speed multiplier (1-10). Use 5-10 for younger grades to see changes faster.',
    },
    markerLatitudes: {
      type: Type.ARRAY,
      items: locationMarkerSchema,
      description: 'Location markers to track. MUST include varied latitudes (equator, mid-latitudes, polar). K-2: 2-3 locations, 3-5: 3-5 locations.',
    },
    gradeLevel: {
      type: Type.STRING,
      enum: ['K', '1', '2', '3', '4', '5'],
      description: 'Target grade level for content complexity',
    },
    learningObjectives: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Key questions to check understanding. K-2: 1-2 simple questions, 3-5: 2-4 conceptual questions.',
      nullable: true,
    },
  },
  required: [
    'title',
    'description',
    'focusMode',
    'initialEarthPosition',
    'viewPerspective',
    'showTiltAxis',
    'showSunRays',
    'showTerminator',
    'showDaylightHours',
    'showTemperatureZones',
    'animationMode',
    'timeSpeed',
    'markerLatitudes',
    'gradeLevel',
  ],
};

// ============================================================================
// GRADE-APPROPRIATE CONFIGURATION
// ============================================================================

const GRADE_CONFIGURATIONS: Record<string, Partial<DayNightSeasonsData>> = {
  K: {
    focusMode: 'day-night',
    showTiltAxis: false,
    showTemperatureZones: false,
    animationMode: 'rotation',
    timeSpeed: 8,
    showDaylightHours: true,
    learningObjectives: [
      'When is it daytime where you live?',
      'Why does it get dark at night?',
    ],
  },
  '1': {
    focusMode: 'day-night',
    showTiltAxis: false,
    showTemperatureZones: false,
    animationMode: 'rotation',
    timeSpeed: 7,
    showDaylightHours: true,
    learningObjectives: [
      'Does the Sun move across the sky, or do we move?',
      'How long does it take Earth to spin once?',
    ],
  },
  '2': {
    focusMode: 'both',
    showTiltAxis: true,
    showTemperatureZones: false,
    animationMode: 'both',
    timeSpeed: 6,
    showDaylightHours: true,
    learningObjectives: [
      'What causes day and night?',
      'Why do we have different seasons?',
    ],
  },
  '3': {
    focusMode: 'seasons',
    showTiltAxis: true,
    showTemperatureZones: false,
    animationMode: 'orbit',
    timeSpeed: 5,
    showDaylightHours: true,
    learningObjectives: [
      'Why are seasons NOT caused by distance from the Sun?',
      'How does Earth\'s tilt create seasons?',
      'Why are seasons opposite in the Northern and Southern Hemispheres?',
    ],
  },
  '4': {
    focusMode: 'both',
    showTiltAxis: true,
    showTemperatureZones: true,
    animationMode: 'both',
    timeSpeed: 4,
    showDaylightHours: true,
    learningObjectives: [
      'What is the difference between an equinox and a solstice?',
      'Why do different locations have different amounts of daylight?',
      'How does Earth\'s tilt affect the seasons in different hemispheres?',
    ],
  },
  '5': {
    focusMode: 'both',
    showTiltAxis: true,
    showTemperatureZones: true,
    animationMode: 'both',
    timeSpeed: 3,
    showDaylightHours: true,
    learningObjectives: [
      'Explain why the Arctic has 24-hour daylight in summer.',
      'How does latitude affect seasonal temperature changes?',
      'Compare daylight hours at the equator vs polar regions during solstices.',
    ],
  },
};

// ============================================================================
// GENERATOR FUNCTION
// ============================================================================

export const generateDayNightSeasons = async (
  topic: string,
  gradeContext: string,
  config?: Partial<DayNightSeasonsData>
): Promise<DayNightSeasonsData> => {
  const gradeLevel = config?.gradeLevel || (gradeContext.match(/grade\s*(\d|K)/i)?.[1]?.toUpperCase() || '3') as 'K' | '1' | '2' | '3' | '4' | '5';
  const gradeConfig = GRADE_CONFIGURATIONS[gradeLevel] || GRADE_CONFIGURATIONS['3'];

  // Determine focus from topic and grade
  let focusMode: 'day-night' | 'seasons' | 'both' = gradeConfig.focusMode as any;
  if (topic.toLowerCase().includes('season')) {
    focusMode = 'seasons';
  } else if (topic.toLowerCase().includes('day') || topic.toLowerCase().includes('night')) {
    focusMode = 'day-night';
  } else if (gradeLevel === 'K' || gradeLevel === '1') {
    focusMode = 'day-night';
  }

  // Select appropriate locations based on grade and focus
  const numLocations = gradeLevel === 'K' || gradeLevel === '1' ? 2 : gradeLevel === '2' ? 3 : 4;

  const selectedLocations: LocationMarker[] = [];

  // Always include one mid-latitude location (relatable)
  selectedLocations.push(SAMPLE_LOCATIONS.find(l => l.id === 'newyork') || SAMPLE_LOCATIONS[5]);

  // Include equator for comparison (grades 2+)
  if (gradeLevel !== 'K' && gradeLevel !== '1') {
    selectedLocations.push(SAMPLE_LOCATIONS.find(l => l.id === 'quito') || SAMPLE_LOCATIONS[0]);
  }

  // Include polar region for advanced grades (4-5) or if focus is seasons
  if ((gradeLevel === '4' || gradeLevel === '5' || focusMode === 'seasons') && numLocations >= 3) {
    selectedLocations.push(SAMPLE_LOCATIONS.find(l => l.id === 'reykjavik') || SAMPLE_LOCATIONS[10]);
  }

  // Add additional mid-latitude if needed
  if (selectedLocations.length < numLocations) {
    const additionalLocations = SAMPLE_LOCATIONS.filter(
      l => !selectedLocations.includes(l) && Math.abs(l.latitude) > 20 && Math.abs(l.latitude) < 50
    );
    selectedLocations.push(...additionalLocations.slice(0, numLocations - selectedLocations.length));
  }

  const prompt = `
Create an interactive Day/Night & Seasons learning activity for ${gradeContext} students.

**Topic:** ${topic}

**Learning Focus:** ${focusMode === 'day-night' ? 'Day and night cycle from Earth\'s rotation' : focusMode === 'seasons' ? 'Seasons from Earth\'s tilt and orbit' : 'Both day/night cycle and seasons'}

**Grade Level:** ${gradeLevel}

**Key Teaching Points:**
${focusMode === 'day-night' || focusMode === 'both' ? `
- Day/Night: Earth rotates once every 24 hours
- When your location faces the Sun → daytime
- When your location faces away → nighttime
- The Sun doesn't move across the sky—Earth rotates!
` : ''}
${focusMode === 'seasons' || focusMode === 'both' ? `
- Seasons: Earth's axis is tilted 23.5 degrees
- As Earth orbits, different parts get more direct sunlight
- CRITICAL: Seasons are NOT from distance to Sun!
- Northern and Southern Hemispheres have opposite seasons
- Equinoxes: ~12 hours daylight everywhere
- Solstices: Maximum difference in daylight hours
` : ''}

**Learning Progression for Grade ${gradeLevel}:**
${gradeLevel === 'K' ? '- Focus: Day happens when we face the Sun, night when we don\'t' : ''}
${gradeLevel === '1' ? '- Focus: The Sun doesn\'t move, Earth spins!' : ''}
${gradeLevel === '2' ? '- Focus: Seasons exist and are related to Earth\'s path around the Sun' : ''}
${gradeLevel === '3' ? '- Focus: Tilt causes seasons (NOT distance from Sun!)' : ''}
${gradeLevel === '4' ? '- Focus: Hemisphere differences, equinox vs solstice, latitude effects' : ''}
${gradeLevel === '5' ? '- Focus: Arctic phenomena, latitude effects on temperature, precise calculations' : ''}

**Location Selection Guidelines:**
- Include ${numLocations} locations with VARIED latitudes
- MUST include at least one mid-latitude location (relatable for students)
${(gradeLevel !== 'K' && gradeLevel !== '1') ? '- Include an equatorial location (shows minimal seasonal change)' : ''}
${(gradeLevel === '4' || gradeLevel === '5' || focusMode === 'seasons') ? '- Include a polar/high-latitude location (shows extreme seasonal variation)' : ''}
- Choose recognizable cities students may have heard of
- Use appropriate emojis (flags, landmarks, or weather symbols)

**Initial Position:** ${focusMode === 'seasons' || focusMode === 'both' ? 'Choose the orbital position that best demonstrates the concept for current season or topic focus' : 'march_equinox'}

**View Perspective:**
- Use "space_side" for best view of tilt and orbital motion
- This shows Earth from the side, making the 23.5° tilt clearly visible

**Visual Elements:**
- showTiltAxis: ${gradeConfig.showTiltAxis ? 'true (ESSENTIAL for grades 3+)' : 'false (too advanced for K-2)'}
- showSunRays: true (helps visualize direct vs indirect sunlight)
- showTerminator: ${focusMode === 'day-night' || focusMode === 'both' ? 'true (essential for day/night)' : 'true'}
- showDaylightHours: true (concrete data helps understanding)
- showTemperatureZones: ${gradeConfig.showTemperatureZones ? 'true' : 'false'}

**Animation:**
- Mode: ${gradeConfig.animationMode}
- Speed: ${gradeConfig.timeSpeed} (higher = faster, better for younger students)

**Learning Objectives:**
Create ${gradeLevel === 'K' || gradeLevel === '1' ? '1-2' : '2-4'} age-appropriate questions that check understanding of:
${focusMode === 'day-night' ? '- What causes day and night?' : ''}
${focusMode === 'seasons' ? '- What causes seasons? (emphasize TILT, not distance!)' : ''}
${focusMode === 'both' ? '- Both day/night and seasonal concepts' : ''}
${gradeLevel === '3' || gradeLevel === '4' || gradeLevel === '5' ? '- Common misconceptions (distance vs tilt)' : ''}
${gradeLevel === '4' || gradeLevel === '5' ? '- Hemisphere differences, equinox/solstice, latitude effects' : ''}

Generate a complete, educationally sound activity configuration.
`;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: dayNightSeasonsResponseSchema,
      },
    });

    const generatedData = JSON.parse(result.text || '{}');

    // Merge with config overrides and grade defaults
    const finalData: DayNightSeasonsData = {
      ...gradeConfig,
      ...generatedData,
      ...config, // User config overrides everything
      gradeLevel,
      // Ensure we have location markers
      markerLatitudes: generatedData.markerLatitudes?.length > 0
        ? generatedData.markerLatitudes
        : selectedLocations,
    };

    return finalData;
  } catch (error) {
    console.error('Error generating DayNightSeasons content:', error);

    // Fallback to a safe default configuration
    return {
      title: `${focusMode === 'day-night' ? 'Day and Night' : focusMode === 'seasons' ? 'Earth\'s Seasons' : 'Day, Night, and Seasons'}`,
      description: `Explore how ${focusMode === 'day-night' ? 'Earth\'s rotation creates day and night' : focusMode === 'seasons' ? 'Earth\'s tilt and orbit create the seasons' : 'Earth\'s motion creates day, night, and seasons'}.`,
      focusMode: focusMode,
      initialEarthPosition: 'march_equinox',
      viewPerspective: 'space_side',
      showTiltAxis: gradeConfig.showTiltAxis ?? true,
      showSunRays: true,
      showTerminator: true,
      showDaylightHours: true,
      showTemperatureZones: gradeConfig.showTemperatureZones ?? false,
      animationMode: gradeConfig.animationMode as any,
      timeSpeed: gradeConfig.timeSpeed ?? 5,
      markerLatitudes: selectedLocations,
      gradeLevel,
      learningObjectives: gradeConfig.learningObjectives as string[],
      ...config,
    };
  }
};
