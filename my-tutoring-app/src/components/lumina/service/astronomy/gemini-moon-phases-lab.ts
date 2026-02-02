import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';

// Import data types from component (single source of truth)
import type {
  MoonPhasesLabData,
  ViewMode,
  MoonPhase,
} from '../../primitives/visual-primitives/astronomy/MoonPhasesLab';

// ============================================================================
// GEMINI SCHEMAS
// ============================================================================

const moonPhasesLabResponseSchema: Schema = {
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
    viewMode: {
      type: Type.STRING,
      enum: ['from_earth', 'from_space', 'split_view'],
      description: 'View perspective: from_earth shows Moon appearance, from_space shows orbital geometry, split_view shows both',
    },
    moonPosition: {
      type: Type.NUMBER,
      description: 'Initial Moon position in degrees (0-360). 0 = new moon, 90 = first quarter, 180 = full moon, 270 = third quarter',
    },
    showSunDirection: {
      type: Type.BOOLEAN,
      description: 'Show arrows indicating where sunlight comes from. Essential for understanding phases.',
    },
    showOrbit: {
      type: Type.BOOLEAN,
      description: 'Display the Moon\'s orbital path around Earth.',
    },
    phaseLabels: {
      type: Type.BOOLEAN,
      description: 'Show phase name labels on the orbital path.',
    },
    showEarthView: {
      type: Type.BOOLEAN,
      description: 'Show inset of how Moon appears from Earth\'s surface.',
    },
    showTidalLocking: {
      type: Type.BOOLEAN,
      description: 'Explain why we always see the same side of the Moon (grades 4-5).',
    },
    interactivePosition: {
      type: Type.BOOLEAN,
      description: 'Allow students to drag the Moon around its orbit.',
    },
    animateOrbit: {
      type: Type.BOOLEAN,
      description: 'Enable animation to watch the lunar cycle unfold.',
    },
    cycleSpeed: {
      type: Type.NUMBER,
      description: 'Animation speed in days per second. Higher = faster. Use 5-10 for younger grades, 2-4 for older.',
    },
    gradeLevel: {
      type: Type.STRING,
      enum: ['K', '1', '2', '3', '4', '5'],
      description: 'Target grade level for content complexity',
    },
    learningObjectives: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Key questions to check understanding. 1-2 for K-2, 2-4 for 3-5.',
      nullable: true,
    },
    challengePhase: {
      type: Type.STRING,
      enum: ['new_moon', 'waxing_crescent', 'first_quarter', 'waxing_gibbous', 'full_moon', 'waning_gibbous', 'third_quarter', 'waning_crescent'],
      description: 'Optional challenge: ask student to find a specific phase',
      nullable: true,
    },
  },
  required: [
    'title',
    'description',
    'viewMode',
    'moonPosition',
    'showSunDirection',
    'showOrbit',
    'phaseLabels',
    'showEarthView',
    'showTidalLocking',
    'interactivePosition',
    'animateOrbit',
    'cycleSpeed',
    'gradeLevel',
  ],
};

// ============================================================================
// GRADE-APPROPRIATE CONFIGURATION
// ============================================================================

const GRADE_CONFIGURATIONS: Record<string, Partial<MoonPhasesLabData>> = {
  K: {
    viewMode: 'from_earth',
    showSunDirection: false,
    showOrbit: false,
    phaseLabels: false,
    showEarthView: true,
    showTidalLocking: false,
    interactivePosition: true,
    animateOrbit: true,
    cycleSpeed: 8,
    learningObjectives: [
      'Does the Moon look different on different nights?',
      'Which Moon shape is your favorite?',
    ],
  },
  '1': {
    viewMode: 'from_earth',
    showSunDirection: false,
    showOrbit: false,
    phaseLabels: true,
    showEarthView: true,
    showTidalLocking: false,
    interactivePosition: true,
    animateOrbit: true,
    cycleSpeed: 7,
    learningObjectives: [
      'Can you name the different Moon shapes?',
      'What comes after a full moon?',
    ],
  },
  '2': {
    viewMode: 'split_view',
    showSunDirection: true,
    showOrbit: true,
    phaseLabels: true,
    showEarthView: true,
    showTidalLocking: false,
    interactivePosition: true,
    animateOrbit: true,
    cycleSpeed: 6,
    learningObjectives: [
      'Where is the Moon when we see a full moon?',
      'How long does it take to go from new moon to new moon?',
    ],
  },
  '3': {
    viewMode: 'split_view',
    showSunDirection: true,
    showOrbit: true,
    phaseLabels: true,
    showEarthView: true,
    showTidalLocking: false,
    interactivePosition: true,
    animateOrbit: true,
    cycleSpeed: 5,
    learningObjectives: [
      'Why does the Moon\'s shape appear to change?',
      'Where does the light that illuminates the Moon come from?',
      'How does the Moon\'s position relate to its phase?',
    ],
  },
  '4': {
    viewMode: 'split_view',
    showSunDirection: true,
    showOrbit: true,
    phaseLabels: true,
    showEarthView: true,
    showTidalLocking: true,
    interactivePosition: true,
    animateOrbit: true,
    cycleSpeed: 4,
    learningObjectives: [
      'If you see a first quarter moon tonight, what phase will it be in one week?',
      'Why do we always see the same side of the Moon?',
      'How does the angle between Sun, Earth, and Moon determine the phase?',
    ],
  },
  '5': {
    viewMode: 'split_view',
    showSunDirection: true,
    showOrbit: true,
    phaseLabels: true,
    showEarthView: true,
    showTidalLocking: true,
    interactivePosition: true,
    animateOrbit: true,
    cycleSpeed: 3,
    learningObjectives: [
      'Explain why the Moon\'s phase depends on its orbital position, not Earth\'s shadow.',
      'Why is tidal locking related to the Moon\'s rotation period?',
      'Predict the Moon phase for a given Sun-Earth-Moon geometry.',
      'How might a lunar eclipse occur during certain phases?',
    ],
  },
};

// ============================================================================
// GENERATOR FUNCTION
// ============================================================================

export const generateMoonPhasesLab = async (
  topic: string,
  gradeContext: string,
  config?: Partial<MoonPhasesLabData>
): Promise<MoonPhasesLabData> => {
  const gradeLevel = config?.gradeLevel || (gradeContext.match(/grade\s*(\d|K)/i)?.[1]?.toUpperCase() || '3') as 'K' | '1' | '2' | '3' | '4' | '5';
  const gradeConfig = GRADE_CONFIGURATIONS[gradeLevel] || GRADE_CONFIGURATIONS['3'];

  // Determine initial moon position based on topic
  let initialPosition = 0;
  if (topic.toLowerCase().includes('full')) {
    initialPosition = 180;
  } else if (topic.toLowerCase().includes('quarter') || topic.toLowerCase().includes('half')) {
    initialPosition = 90;
  } else if (topic.toLowerCase().includes('crescent')) {
    initialPosition = 45;
  }

  const prompt = `
Create an interactive Moon Phases Lab activity for ${gradeContext} students.

**Topic:** ${topic}

**Grade Level:** ${gradeLevel}

**Learning Progression for Grade ${gradeLevel}:**
${gradeLevel === 'K' ? '- Focus: Moon looks different on different nights. Name recognition of basic shapes (full, crescent).' : ''}
${gradeLevel === '1' ? '- Focus: Moon phase names and their sequence. The Moon changes in a pattern.' : ''}
${gradeLevel === '2' ? '- Focus: The Moon goes around Earth. The cycle takes about a month.' : ''}
${gradeLevel === '3' ? '- Focus: Phase is about geometry—the angle of light from the Sun. Not Earth\'s shadow!' : ''}
${gradeLevel === '4' ? '- Focus: Predicting phases based on position. Understanding the 29.5-day cycle.' : ''}
${gradeLevel === '5' ? '- Focus: Tidal locking, lunar eclipse geometry, advanced orbital mechanics.' : ''}

**Key Concepts to Teach:**
- The Moon doesn't produce its own light - it reflects sunlight
- We see different phases because the Moon orbits Earth
- The phase depends on the Moon's position relative to Sun and Earth
- IMPORTANT: Phases are NOT caused by Earth's shadow (common misconception!)
- The lunar cycle takes about 29.5 days

**Phase Sequence:**
1. New Moon (0°) - Moon between Earth and Sun, dark side faces us
2. Waxing Crescent (45°) - Small sliver visible on right
3. First Quarter (90°) - Right half illuminated
4. Waxing Gibbous (135°) - More than half, growing
5. Full Moon (180°) - Earth between Moon and Sun, fully lit
6. Waning Gibbous (225°) - More than half, shrinking
7. Third Quarter (270°) - Left half illuminated
8. Waning Crescent (315°) - Small sliver on left

**View Mode Guidelines:**
- from_earth: Best for K-1, shows Moon as it appears in the sky
- from_space: Shows orbital geometry (why phases happen)
- split_view: Best for grades 2-5, shows both perspectives

**Configuration Guidelines for Grade ${gradeLevel}:**
- showSunDirection: ${gradeConfig.showSunDirection ? 'true (essential for understanding)' : 'false (too advanced for this grade)'}
- showOrbit: ${gradeConfig.showOrbit ? 'true' : 'false'}
- phaseLabels: ${gradeConfig.phaseLabels ? 'true' : 'false'}
- showTidalLocking: ${gradeConfig.showTidalLocking ? 'true (grades 4-5 only)' : 'false'}
- cycleSpeed: ${gradeConfig.cycleSpeed} (higher = faster for younger students)

**Learning Objectives:**
Create ${gradeLevel === 'K' || gradeLevel === '1' ? '1-2' : '2-4'} age-appropriate questions that check understanding of:
- Phase names and sequence
${gradeLevel === '2' || gradeLevel === '3' || gradeLevel === '4' || gradeLevel === '5' ? '- Why phases occur (geometry, not Earth\'s shadow!)' : ''}
${gradeLevel === '3' || gradeLevel === '4' || gradeLevel === '5' ? '- Predicting next phase in sequence' : ''}
${gradeLevel === '4' || gradeLevel === '5' ? '- Tidal locking and lunar cycle timing' : ''}

${topic.toLowerCase().includes('challenge') || topic.toLowerCase().includes('find') ? `
**Challenge Mode:**
Include a challengePhase to ask students to identify a specific Moon phase.
Choose a phase appropriate for the grade level.
` : ''}

Generate a complete, educationally sound activity configuration.
`;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: moonPhasesLabResponseSchema,
      },
    });

    const generatedData = JSON.parse(result.text || '{}');

    // Merge with config overrides and grade defaults
    const finalData: MoonPhasesLabData = {
      ...gradeConfig,
      ...generatedData,
      ...config, // User config overrides everything
      gradeLevel,
      moonPosition: config?.moonPosition ?? generatedData.moonPosition ?? initialPosition,
    };

    return finalData;
  } catch (error) {
    console.error('Error generating MoonPhasesLab content:', error);

    // Fallback to a safe default configuration
    return {
      title: 'Moon Phases Explorer',
      description: 'Discover why the Moon appears to change shape as it orbits Earth!',
      viewMode: gradeConfig.viewMode as ViewMode ?? 'split_view',
      moonPosition: initialPosition,
      showSunDirection: gradeConfig.showSunDirection ?? true,
      showOrbit: gradeConfig.showOrbit ?? true,
      phaseLabels: gradeConfig.phaseLabels ?? true,
      showEarthView: gradeConfig.showEarthView ?? true,
      showTidalLocking: gradeConfig.showTidalLocking ?? false,
      interactivePosition: gradeConfig.interactivePosition ?? true,
      animateOrbit: gradeConfig.animateOrbit ?? true,
      cycleSpeed: gradeConfig.cycleSpeed ?? 5,
      gradeLevel,
      learningObjectives: gradeConfig.learningObjectives as string[],
      ...config,
    };
  }
};
