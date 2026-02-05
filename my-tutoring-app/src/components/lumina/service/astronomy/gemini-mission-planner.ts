import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  MissionPlannerData,
  DestinationInfo,
  SupplyItem,
  LaunchWindow,
} from '../../primitives/visual-primitives/astronomy/MissionPlanner';

// Re-export for convenience
export type { MissionPlannerData, DestinationInfo, SupplyItem, LaunchWindow };

/**
 * Schema for Destination Info
 */
const destinationInfoSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      enum: ["moon", "mars", "venus", "jupiter", "asteroid"],
      description: "Destination identifier"
    },
    name: {
      type: Type.STRING,
      description: "Display name for the destination (e.g., 'The Moon', 'Mars')"
    },
    distanceFromSunAU: {
      type: Type.NUMBER,
      description: "Distance from Sun in AU. Moon: 1.0, Venus: 0.72, Mars: 1.52, Jupiter: 5.2, Asteroid belt: 2.7"
    },
    orbitAngleDeg: {
      type: Type.NUMBER,
      description: "Angle position in the visualization (0-360 degrees). Space them out for visual clarity."
    },
    color: {
      type: Type.STRING,
      description: "Hex color for the planet (e.g., '#C0C0C0' for Moon, '#E74C3C' for Mars)"
    },
    radiusPx: {
      type: Type.NUMBER,
      description: "Visual radius in pixels. Moon: 5, Venus: 7, Mars: 6, Jupiter: 14, Asteroid: 4"
    },
    travelDaysDirect: {
      type: Type.NUMBER,
      description: "Travel time in days via direct route. Moon: 3, Venus: 110, Mars: 210, Jupiter: 600, Asteroid: 350"
    },
    travelDaysAssist: {
      type: Type.NUMBER,
      description: "Travel time via gravity assist (usually shorter for outer planets, longer for inner). Optional.",
      nullable: true
    },
    assistPlanet: {
      type: Type.STRING,
      description: "Name of planet used for gravity assist (e.g., 'Venus' for Jupiter missions). Optional.",
      nullable: true
    },
    description: {
      type: Type.STRING,
      description: "Short age-appropriate description of the destination"
    },
    funFact: {
      type: Type.STRING,
      description: "Fun fact about this destination appropriate for the grade level"
    }
  },
  required: ["id", "name", "distanceFromSunAU", "orbitAngleDeg", "color", "radiusPx", "travelDaysDirect", "description", "funFact"]
};

/**
 * Schema for Supply Item
 */
const supplyItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique supply identifier (e.g., 'food', 'water', 'oxygen')"
    },
    name: {
      type: Type.STRING,
      description: "Display name for the supply"
    },
    icon: {
      type: Type.STRING,
      description: "Emoji icon for the supply (e.g., '🍎', '💧', '🫧')"
    },
    perDayKg: {
      type: Type.NUMBER,
      description: "Kilograms needed per person per day. Food: 2, Water: 2.5, Oxygen: 1, Medicine: 0.1"
    },
    description: {
      type: Type.STRING,
      description: "Short description of why this supply is needed"
    },
    required: {
      type: Type.BOOLEAN,
      description: "Whether this supply is required for mission success"
    }
  },
  required: ["id", "name", "icon", "perDayKg", "description", "required"]
};

/**
 * Schema for Launch Window
 */
const launchWindowSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique identifier for the launch window"
    },
    label: {
      type: Type.STRING,
      description: "Display label (e.g., 'January 2026', 'Next Summer')"
    },
    description: {
      type: Type.STRING,
      description: "Explanation of this launch window (age-appropriate)"
    },
    optimal: {
      type: Type.BOOLEAN,
      description: "Whether this is the best launch window"
    },
    fuelMultiplier: {
      type: Type.NUMBER,
      description: "Fuel multiplier (1.0 = normal, >1 = more fuel needed, <1 = less fuel). Optimal: 1.0, Bad: 1.5-2.0"
    },
    travelTimeMultiplier: {
      type: Type.NUMBER,
      description: "Travel time multiplier. Optimal: 1.0, Bad: 1.3-1.8"
    }
  },
  required: ["id", "label", "description", "optimal", "fuelMultiplier", "travelTimeMultiplier"]
};

/**
 * Schema for Mission Planner Data
 */
const missionPlannerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the mission planning activity"
    },
    description: {
      type: Type.STRING,
      description: "Educational description using age-appropriate language"
    },
    gradeLevel: {
      type: Type.STRING,
      enum: ["K", "1", "2", "3", "4", "5"],
      description: "Target grade level"
    },
    destinations: {
      type: Type.ARRAY,
      items: destinationInfoSchema,
      description: "Available destinations for the mission. K: 2-3 (Moon, Mars). 1-2: 3 destinations. 3-4: 4 destinations. 5: All 5."
    },
    missionType: {
      type: Type.STRING,
      enum: ["flyby", "orbit", "landing", "return"],
      description: "Type of mission. K-1: flyby. 2-3: landing. 4-5: return."
    },
    crewed: {
      type: Type.BOOLEAN,
      description: "Whether mission is crewed. K-2: false (robotic). 3+: true."
    },
    showLaunchWindows: {
      type: Type.BOOLEAN,
      description: "Show launch window selection. K-2: false. 3+: true."
    },
    showTrajectory: {
      type: Type.BOOLEAN,
      description: "Show flight path visualization. K: false. 1+: true."
    },
    supplyCalculator: {
      type: Type.BOOLEAN,
      description: "Show supply packing interface. K-1: false. 2+: true."
    },
    gravityAssistOption: {
      type: Type.BOOLEAN,
      description: "Allow gravity assist trajectories. K-3: false. 4+: true."
    },
    fuelConstraint: {
      type: Type.NUMBER,
      description: "Available propellant in tons. K-2: 100 (generous). 3-4: 50. 5: 30 (tight)."
    },
    missionClock: {
      type: Type.BOOLEAN,
      description: "Show elapsed time during mission. K: false. 1+: true."
    },
    launchWindows: {
      type: Type.ARRAY,
      items: launchWindowSchema,
      description: "Launch window options. Only for grades 3+. Include 3-4 windows with one optimal.",
      nullable: true
    },
    supplies: {
      type: Type.ARRAY,
      items: supplyItemSchema,
      description: "Supply items for packing. Only for grades 2+. Include 3-5 items.",
      nullable: true
    },
    learningFocus: {
      type: Type.STRING,
      description: "Main learning focus for this grade level"
    },
    hints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-4 age-appropriate hints"
    },
    funFact: {
      type: Type.STRING,
      description: "Fun fact about space travel appropriate for grade level",
      nullable: true
    }
  },
  required: [
    "title", "description", "gradeLevel", "destinations", "missionType",
    "crewed", "showLaunchWindows", "showTrajectory", "supplyCalculator",
    "gravityAssistOption", "fuelConstraint", "missionClock", "learningFocus", "hints"
  ]
};

/**
 * Generate Mission Planner data for visualization
 *
 * Creates interactive mission planning simulations appropriate for K-5 astronomy education:
 * - K: We can visit other places in space
 * - 1: Different places take different times
 * - 2: Need to bring supplies
 * - 3: Launch windows—can't go anytime
 * - 4: Gravity assists—getting help from planets
 * - 5: Trade-offs: speed vs fuel vs payload
 *
 * @param topic - The astronomy topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns MissionPlannerData with complete configuration
 */
export const generateMissionPlanner = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<MissionPlannerData>
): Promise<MissionPlannerData> => {
  const prompt = `
Create an educational Mission Planner visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - MISSION PLANNING FOR K-5:
The Mission Planner is a simplified mission design tool where students plan trips to the Moon, Mars, and beyond.
It covers launch windows, travel times, and what you need to bring.

KEY CONCEPTS (age-appropriate):

KINDERGARTEN (ages 5-6):
"We can visit other places in space!"
- Focus: Space has places we can go
- 2-3 destinations only (Moon, Mars)
- No math, no complex vocabulary
- Language: "Let's pick where to fly our spaceship!"
- Features: showTrajectory: false, supplyCalculator: false, showLaunchWindows: false
- missionType: "flyby", crewed: false
- Hints: "The Moon is close! Mars is farther away!", "Click on a planet to pick it!"

GRADE 1 (ages 6-7):
"Different places take different times to reach!"
- Focus: Distance = time concept
- 3 destinations with travel times shown
- Language: "Some places are farther away and take more time to reach!"
- Features: showTrajectory: true, supplyCalculator: false, showLaunchWindows: false
- missionType: "flyby", crewed: false
- Hints: "The Moon is only 3 days away!", "Mars takes about 7 months - that's a long trip!"

GRADE 2 (ages 7-8):
"Astronauts need food, water, and air!"
- Focus: Supplies for space travel
- 3 destinations, introduce supply calculator
- Language: "How much food and water do astronauts need?"
- Features: showTrajectory: true, supplyCalculator: true, showLaunchWindows: false
- missionType: "landing", crewed: true
- supplies: food, water, oxygen (3 items, simple)
- Hints: "Longer trips need more food!", "Don't forget water and air!"

GRADE 3 (ages 8-9):
"We can't launch whenever we want - planets move!"
- Focus: Launch windows, planetary alignment
- 4 destinations, launch window selection
- Language: "Earth and Mars are always moving, so timing matters!"
- Features: showTrajectory: true, supplyCalculator: true, showLaunchWindows: true
- missionType: "landing", crewed: true
- launchWindows: 3-4 options with one optimal
- supplies: food, water, oxygen, medicine (4 items)
- Hints: "Green means a good time to launch!", "Planets have to be in the right position!"

GRADE 4 (ages 9-10):
"Gravity assists—getting a speed boost from other planets!"
- Focus: Gravity assist concept
- 4-5 destinations with gravity assist options
- Language: "Like a slingshot in space - planets can speed you up!"
- Features: ALL enabled including gravityAssistOption
- missionType: "return", crewed: true
- For Jupiter/asteroid missions, show Venus or Mars as assist planet
- Hints: "A gravity assist saves fuel!", "Venus can help you reach Jupiter faster!"

GRADE 5 (ages 10-11):
"Every kilogram matters - speed vs fuel vs payload!"
- Focus: Trade-offs and optimization
- All 5 destinations, tight fuel constraints
- Language: "More supplies means less fuel. Can you find the perfect balance?"
- Features: ALL enabled, tight fuelConstraint (30 tons)
- missionType: "return", crewed: true
- launchWindows: 4 options with varied multipliers
- supplies: 5 items including science equipment
- Hints: "Return trips need twice the supplies!", "Gravity assists save precious fuel!"

DESTINATION DATA (real-ish values):
Moon: distanceFromSunAU: 1.0 (same as Earth), orbitAngleDeg: 190, color: "#C0C0C0", radiusPx: 5, travelDaysDirect: 3
Venus: distanceFromSunAU: 0.72, orbitAngleDeg: 60, color: "#E8A838", radiusPx: 7, travelDaysDirect: 110
Mars: distanceFromSunAU: 1.52, orbitAngleDeg: 300, color: "#E74C3C", radiusPx: 6, travelDaysDirect: 210
Jupiter: distanceFromSunAU: 5.2, orbitAngleDeg: 45, color: "#D4A46A", radiusPx: 14, travelDaysDirect: 600, travelDaysAssist: 450, assistPlanet: "Venus"
Asteroid: distanceFromSunAU: 2.7, orbitAngleDeg: 150, color: "#8B7355", radiusPx: 4, travelDaysDirect: 350, travelDaysAssist: 280, assistPlanet: "Mars"

STANDARD SUPPLY ITEMS:
- food: { icon: "🍎", perDayKg: 2, required: true }
- water: { icon: "💧", perDayKg: 2.5, required: true }
- oxygen: { icon: "🫧", perDayKg: 1, required: true }
- medicine: { icon: "💊", perDayKg: 0.1, required: false }
- science_equipment: { icon: "🔬", perDayKg: 0.5, required: false }

LAUNCH WINDOW EXAMPLES (for Mars):
- { id: "optimal", label: "July 2026", description: "Earth and Mars are closest!", optimal: true, fuelMultiplier: 1.0, travelTimeMultiplier: 1.0 }
- { id: "good", label: "September 2026", description: "Still a decent window", optimal: false, fuelMultiplier: 1.2, travelTimeMultiplier: 1.15 }
- { id: "poor", label: "January 2027", description: "Planets are far apart", optimal: false, fuelMultiplier: 1.8, travelTimeMultiplier: 1.5 }
- { id: "bad", label: "March 2027", description: "The worst timing - opposite sides of the Sun!", optimal: false, fuelMultiplier: 2.0, travelTimeMultiplier: 1.8 }

FUN FACTS BY GRADE:
K: "The Moon is so close that astronauts got there in just 3 days!"
1: "A trip to Mars takes about as long as a whole school year!"
2: "Astronauts on the space station eat freeze-dried food - even ice cream!"
3: "We can only launch to Mars every 26 months when Earth and Mars line up!"
4: "NASA's Voyager spacecraft used gravity assists from Jupiter and Saturn to explore the outer planets!"
5: "The Cassini mission to Saturn used gravity assists from Venus (twice!), Earth, and Jupiter!"

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.missionType ? `- Mission type: ${config.missionType}` : ''}
${config.crewed !== undefined ? `- Crewed: ${config.crewed}` : ''}
${config.showLaunchWindows !== undefined ? `- Show launch windows: ${config.showLaunchWindows}` : ''}
${config.gravityAssistOption !== undefined ? `- Gravity assist: ${config.gravityAssistOption}` : ''}
` : ''}

Return a complete Mission Planner configuration appropriate for the grade level and topic.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: missionPlannerSchema
    },
  });

  console.log('[Mission Planner] Gemini API Response:', {
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
    console.error('[Mission Planner] Parse Error:', parseError);
    throw new Error(`Failed to parse Gemini response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
  }

  if (!data) {
    throw new Error('No valid Mission Planner data returned from Gemini API');
  }

  // Validation and defaults
  if (!data.destinations || data.destinations.length === 0) {
    data.destinations = getDefaultDestinations(gradeLevel);
  }

  // Ensure destination data is valid
  data.destinations = data.destinations.map((dest: DestinationInfo) => ({
    ...dest,
    radiusPx: dest.radiusPx || 6,
    color: dest.color || '#888888',
    distanceFromSunAU: dest.distanceFromSunAU || 1.5,
    orbitAngleDeg: dest.orbitAngleDeg || Math.random() * 360,
    travelDaysDirect: dest.travelDaysDirect || 100,
  }));

  // Feature toggles by grade
  if (data.showTrajectory === undefined) data.showTrajectory = gradeLevel !== 'K';
  if (data.supplyCalculator === undefined) data.supplyCalculator = gradeLevel >= '2';
  if (data.showLaunchWindows === undefined) data.showLaunchWindows = gradeLevel >= '3';
  if (data.gravityAssistOption === undefined) data.gravityAssistOption = gradeLevel >= '4';
  if (data.missionClock === undefined) data.missionClock = gradeLevel !== 'K';
  if (data.crewed === undefined) data.crewed = gradeLevel >= '2';
  if (!data.missionType) data.missionType = gradeLevel <= '1' ? 'flyby' : gradeLevel <= '3' ? 'landing' : 'return';
  if (!data.fuelConstraint) data.fuelConstraint = gradeLevel <= '2' ? 100 : gradeLevel <= '4' ? 50 : 30;

  // Supplies defaults
  if (data.supplyCalculator && (!data.supplies || data.supplies.length === 0)) {
    data.supplies = getDefaultSupplies(gradeLevel);
  }

  // Launch windows defaults
  if (data.showLaunchWindows && (!data.launchWindows || data.launchWindows.length === 0)) {
    data.launchWindows = getDefaultLaunchWindows(gradeLevel);
  }

  if (!data.hints || data.hints.length === 0) {
    data.hints = getDefaultHints(gradeLevel);
  }

  // Apply config overrides
  if (config) {
    if (config.destinations) data.destinations = config.destinations;
    if (config.missionType) data.missionType = config.missionType;
    if (config.crewed !== undefined) data.crewed = config.crewed;
    if (config.showLaunchWindows !== undefined) data.showLaunchWindows = config.showLaunchWindows;
    if (config.showTrajectory !== undefined) data.showTrajectory = config.showTrajectory;
    if (config.supplyCalculator !== undefined) data.supplyCalculator = config.supplyCalculator;
    if (config.gravityAssistOption !== undefined) data.gravityAssistOption = config.gravityAssistOption;
    if (config.fuelConstraint !== undefined) data.fuelConstraint = config.fuelConstraint;
    if (config.missionClock !== undefined) data.missionClock = config.missionClock;
    if (config.launchWindows) data.launchWindows = config.launchWindows;
    if (config.supplies) data.supplies = config.supplies;
    if (config.hints) data.hints = config.hints;
    if (config.funFact) data.funFact = config.funFact;
  }

  return data;
};

/**
 * Helper: Get default destinations based on grade level
 */
function getDefaultDestinations(gradeLevel: string): DestinationInfo[] {
  const allDestinations: DestinationInfo[] = [
    {
      id: 'moon', name: 'The Moon', distanceFromSunAU: 1.0, orbitAngleDeg: 190,
      color: '#C0C0C0', radiusPx: 5, travelDaysDirect: 3,
      description: 'Our closest neighbor in space!', funFact: 'The Moon is about 384,000 km from Earth.'
    },
    {
      id: 'mars', name: 'Mars', distanceFromSunAU: 1.52, orbitAngleDeg: 300,
      color: '#E74C3C', radiusPx: 6, travelDaysDirect: 210,
      description: 'The Red Planet - maybe humans will live there someday!',
      funFact: 'Mars has the tallest volcano in the solar system - Olympus Mons!'
    },
    {
      id: 'venus', name: 'Venus', distanceFromSunAU: 0.72, orbitAngleDeg: 60,
      color: '#E8A838', radiusPx: 7, travelDaysDirect: 110,
      description: 'The hottest planet - even hotter than Mercury!',
      funFact: 'A day on Venus is longer than a year on Venus!'
    },
    {
      id: 'jupiter', name: 'Jupiter', distanceFromSunAU: 5.2, orbitAngleDeg: 45,
      color: '#D4A46A', radiusPx: 14, travelDaysDirect: 600,
      travelDaysAssist: 450, assistPlanet: 'Venus',
      description: 'The biggest planet - a giant ball of gas!',
      funFact: 'Jupiter is so big that over 1,300 Earths could fit inside it!'
    },
    {
      id: 'asteroid', name: 'Asteroid Belt', distanceFromSunAU: 2.7, orbitAngleDeg: 150,
      color: '#8B7355', radiusPx: 4, travelDaysDirect: 350,
      travelDaysAssist: 280, assistPlanet: 'Mars',
      description: 'Millions of rocky objects between Mars and Jupiter!',
      funFact: 'Some asteroids contain valuable metals like platinum and gold!'
    },
  ];

  const countByGrade: Record<string, number> = {
    'K': 2, '1': 3, '2': 3, '3': 4, '4': 4, '5': 5
  };

  return allDestinations.slice(0, countByGrade[gradeLevel] || 3);
}

/**
 * Helper: Get default supplies based on grade level
 */
function getDefaultSupplies(gradeLevel: string): SupplyItem[] {
  const allSupplies: SupplyItem[] = [
    { id: 'food', name: 'Food', icon: '🍎', perDayKg: 2, description: 'Freeze-dried meals for the crew', required: true },
    { id: 'water', name: 'Water', icon: '💧', perDayKg: 2.5, description: 'Drinking water and hygiene', required: true },
    { id: 'oxygen', name: 'Oxygen', icon: '🫧', perDayKg: 1, description: 'Air to breathe in space', required: true },
    { id: 'medicine', name: 'Medicine', icon: '💊', perDayKg: 0.1, description: 'First aid and health supplies', required: false },
    { id: 'science', name: 'Science Equipment', icon: '🔬', perDayKg: 0.5, description: 'Experiments and research tools', required: false },
  ];

  const countByGrade: Record<string, number> = {
    '2': 3, '3': 4, '4': 4, '5': 5
  };

  return allSupplies.slice(0, countByGrade[gradeLevel] || 3);
}

/**
 * Helper: Get default launch windows
 */
function getDefaultLaunchWindows(gradeLevel: string): LaunchWindow[] {
  return [
    { id: 'optimal', label: 'July 2026', description: 'Planets are closest - best time!', optimal: true, fuelMultiplier: 1.0, travelTimeMultiplier: 1.0 },
    { id: 'good', label: 'September 2026', description: 'Still a good window', optimal: false, fuelMultiplier: 1.2, travelTimeMultiplier: 1.15 },
    { id: 'poor', label: 'January 2027', description: 'Planets are far apart - uses more fuel', optimal: false, fuelMultiplier: 1.8, travelTimeMultiplier: 1.5 },
    ...(gradeLevel >= '4' ? [
      { id: 'bad', label: 'March 2027', description: 'Worst timing - opposite sides of the Sun!', optimal: false, fuelMultiplier: 2.0, travelTimeMultiplier: 1.8 }
    ] : []),
  ];
}

/**
 * Helper: Get default hints based on grade level
 */
function getDefaultHints(gradeLevel: string): string[] {
  const hintsByGrade: Record<string, string[]> = {
    'K': [
      "Pick a planet to visit!",
      "The Moon is very close to Earth!",
      "Press Launch when you're ready! 🚀"
    ],
    '1': [
      "The Moon is only 3 days away!",
      "Mars takes about 7 months - that's a long trip!",
      "Watch the dotted line - that's your flight path!"
    ],
    '2': [
      "Astronauts need food, water, and air!",
      "Longer trips need more supplies!",
      "Make sure you pack enough for the whole journey!"
    ],
    '3': [
      "Planets are always moving around the Sun!",
      "A green launch window means good timing!",
      "Earth and Mars line up about every 26 months!",
      "Bad timing means more fuel and a longer trip!"
    ],
    '4': [
      "A gravity assist is like a slingshot in space!",
      "Planets can speed up your spacecraft as it flies by!",
      "Venus gravity assists help reach Jupiter faster!",
      "Compare direct vs gravity assist travel times!"
    ],
    '5': [
      "Every kilogram of supplies means less fuel!",
      "Return trips need supplies for both directions!",
      "Gravity assists save precious fuel for the mission!",
      "The best missions balance speed, fuel, and payload!"
    ]
  };

  return hintsByGrade[gradeLevel] || hintsByGrade['3'];
}
