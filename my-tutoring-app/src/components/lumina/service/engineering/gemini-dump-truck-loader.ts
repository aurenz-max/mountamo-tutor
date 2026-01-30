import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  DumpTruckLoaderData,
} from '../../primitives/visual-primitives/engineering/DumpTruckLoader';

// Re-export for convenience if needed elsewhere
export type { DumpTruckLoaderData };

/**
 * Schema for Dump Truck Loader Data
 */
const dumpTruckLoaderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the dump truck activity (e.g., 'Load and Haul!', 'Dump Truck Challenge')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining the activity and what students will learn. Use age-appropriate language."
    },
    truckCapacity: {
      type: Type.NUMBER,
      description: "Maximum load weight in units (K: 20-30, grades 1-2: 30-50, grades 3-5: 50-100)"
    },
    bedVolume: {
      type: Type.NUMBER,
      description: "Maximum load volume in cubic units (K: 10-15, grades 1-2: 15-25, grades 3-5: 25-50)"
    },
    materialType: {
      type: Type.STRING,
      enum: ["dirt", "gravel", "sand", "debris"],
      description: "Type of material to load. 'dirt' for most scenarios, 'sand' for beaches, 'gravel' for construction, 'debris' for cleanup"
    },
    materialDensity: {
      type: Type.NUMBER,
      description: "Weight per volume unit (dirt: 1.5, sand: 1.6, gravel: 1.8, debris: 1.2)"
    },
    showWeight: {
      type: Type.BOOLEAN,
      description: "Display current load weight. True for grades 2+ (introduces weight concept)"
    },
    showFillLevel: {
      type: Type.BOOLEAN,
      description: "Display volume used percentage. True for all grades (visual feedback)"
    },
    tripDistance: {
      type: Type.NUMBER,
      description: "Haul route length in pixels (K: 200-300, grades 1-2: 300-450, grades 3-5: 400-600)"
    },
    sourceSize: {
      type: Type.NUMBER,
      description: "Total material to move in units (K: 50-80, grades 1-2: 100-150, grades 3-5: 150-300)"
    },
    targetLoads: {
      type: Type.NUMBER,
      description: "Number of loads to complete (optional). K: 3-5, grades 1-2: 5-8, grades 3-5: 8-15",
      nullable: true
    },
    timeLimit: {
      type: Type.NUMBER,
      description: "Optional time limit in seconds (grades 4-5 only for efficiency challenges)",
      nullable: true
    },
    theme: {
      type: Type.STRING,
      enum: ["realistic", "cartoon", "simple"],
      description: "Visual theme. 'cartoon' for K-1, 'simple' for 2-3, 'realistic' for 4-5"
    },
    truckColor: {
      type: Type.STRING,
      description: "Color of the truck (e.g., '#F59E0B' amber, '#EAB308' yellow, '#F97316' orange)"
    }
  },
  required: [
    "title", "description", "truckCapacity", "bedVolume", "materialType",
    "materialDensity", "showWeight", "showFillLevel", "tripDistance",
    "sourceSize", "theme", "truckColor"
  ]
};

/**
 * Generate Dump Truck Loader data for visualization
 *
 * Creates dump truck loading simulations appropriate for K-5 engineering education:
 * - K: Full and empty concepts, basic loading
 * - K-1: Capacity and "too much" understanding
 * - 1-2: Counting loads, sequencing operations
 * - 2-3: Weight limits and distribution
 * - 4-5: Efficiency (loads per time), optimization
 *
 * @param topic - The engineering topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns DumpTruckLoaderData with complete configuration
 */
export const generateDumpTruckLoader = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<DumpTruckLoaderData>
): Promise<DumpTruckLoaderData> => {
  const prompt = `
Create an educational Dump Truck Loader visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - DUMP TRUCK LOADING ENGINEERING:
A dump truck is a vehicle with a tilting bed used to transport and dump loose materials:
1. LOADING - Material is scooped or loaded into the truck bed
2. TRANSPORT - Truck drives to the dump location
3. DUMPING - Hydraulic lift raises the bed at an angle, material slides out
4. RETURN - Truck returns to loading area for next load

KEY ENGINEERING PRINCIPLES:
- Capacity constraints: Both weight (how heavy) and volume (how much space) matter
- Overloading: Too much weight can damage the truck or make it unsafe
- Overfilling: Material can spill over the sides if volume exceeds bed size
- Efficiency: More material per trip = fewer trips = better efficiency
- Weight distribution: Material should be evenly distributed in the bed
- Material properties: Different materials have different densities (weight per volume)

REAL-WORLD CONNECTIONS:
- Construction sites use dump trucks to move earth, gravel, and materials
- Mining operations transport ore and rock
- Landscaping services deliver soil, mulch, and stone
- Road construction crews move asphalt and aggregate
- Waste management uses dump trucks for debris removal
- Snow removal operations clear streets after storms

GRADE-LEVEL GUIDELINES:

KINDERGARTEN (ages 5-6):
- Concept: Full and empty - "The truck is empty, now it's full!"
- Challenge: Simple loading - fill the truck and dump it
- Truck config: Small capacity (20-30 units), large bed volume (10-15 units)
- Material: 'dirt' (familiar material)
- Density: 1.5 (simple ratio)
- showWeight: false (weight is abstract)
- showFillLevel: true (visual feedback)
- tripDistance: 200-250 (short trips)
- sourceSize: 50-70 (achievable in a few loads)
- targetLoads: 3-5 loads
- timeLimit: null (no pressure)
- theme: 'cartoon' (bright, friendly)
- truckColor: Bright colors like '#FBBF24' (bright yellow) or '#F59E0B' (amber)
- Language: "Fill the truck with dirt, drive to the dump site, and dump it out! Can you make 3 trips?"

KINDERGARTEN - GRADE 1 (ages 5-7):
- Concept: Capacity and "too much" - "Oops, that's too much for the truck!"
- Challenge: Learn not to overload the truck
- Truck config: Capacity 25-35 units, bed volume 12-15 units
- Material: 'dirt' or 'sand'
- Density: 1.5
- showWeight: false
- showFillLevel: true
- tripDistance: 250-300
- sourceSize: 70-100
- targetLoads: 4-6 loads
- timeLimit: null
- theme: 'cartoon'
- truckColor: '#F59E0B' (amber) or '#EAB308' (yellow)
- Language: "Load the truck carefully! Don't put in too much or it will be too full. How many trips will you need?"

GRADES 1-2 (ages 6-8):
- Concept: Counting loads - "How many loads will it take?"
- Challenge: Predict and count the number of trips needed
- Truck config: Capacity 35-50 units, bed volume 15-25 units
- Material: 'dirt', 'sand', or 'gravel'
- Density: 1.5-1.8 (introduce heavier materials)
- showWeight: true (introduce weight concept)
- showFillLevel: true
- tripDistance: 300-400
- sourceSize: 100-150
- targetLoads: 5-8 loads
- timeLimit: null
- theme: 'simple' or 'cartoon'
- truckColor: '#F59E0B' (amber)
- Language: "The truck can hold [bedVolume] scoops. You need to move [sourceSize] units. How many trips? Count your loads!"

GRADES 2-3 (ages 7-9):
- Concept: Weight limits and distribution - "Heavy materials vs light materials"
- Challenge: Understand that weight and volume both matter
- Truck config: Capacity 40-60 units, bed volume 20-30 units
- Material: 'gravel' (denser) or 'debris' (lighter)
- Density: Vary between 1.2 (debris) and 1.8 (gravel)
- showWeight: true
- showFillLevel: true
- tripDistance: 350-500
- sourceSize: 120-180
- targetLoads: 6-10 loads
- timeLimit: null
- theme: 'simple' or 'realistic'
- truckColor: '#F59E0B' (amber) or '#F97316' (orange)
- Language: "Watch both weight and volume! Gravel is heavy - you might fill by weight before you fill by volume. Plan your loads!"

GRADES 3-4 (ages 8-10):
- Concept: Efficiency - "Fewer trips with fuller loads"
- Challenge: Maximize material per trip
- Truck config: Capacity 50-80 units, bed volume 25-40 units
- Material: Mixed materials (vary density)
- Density: 1.2-1.8
- showWeight: true
- showFillLevel: true
- tripDistance: 400-550
- sourceSize: 150-250
- targetLoads: 8-12 loads
- timeLimit: null (introduced later)
- theme: 'realistic'
- truckColor: '#F59E0B' (amber) or '#EA580C' (orange-red)
- Language: "Maximize efficiency! Load as much as you can without overloading. Fewer trips = better efficiency!"

GRADES 4-5 (ages 9-11):
- Concept: Optimization and time efficiency - "Fastest way to complete the job"
- Challenge: Complete the task with optimal efficiency under time pressure
- Truck config: Capacity 70-100 units, bed volume 30-50 units
- Material: Any type (real-world scenarios)
- Density: Realistic values (1.2-1.8)
- showWeight: true
- showFillLevel: true
- tripDistance: 450-600
- sourceSize: 200-300
- targetLoads: 10-15 loads
- timeLimit: 180-300 seconds (efficiency challenge)
- theme: 'realistic'
- truckColor: Construction colors like '#F59E0B' (amber)
- Language: "Optimize your hauling strategy! Balance load size with trip frequency. Minimize time while respecting capacity limits!"

MATERIAL DENSITY GUIDELINES:
- Dirt: 1.5 (standard, most common)
- Sand: 1.6 (slightly heavier than dirt)
- Gravel: 1.8 (heavy, compact)
- Debris: 1.2 (lighter, irregular shapes)

VALIDATION RULES:
1. truckCapacity and bedVolume should both constrain loading
   - Capacity (weight) = bedVolume * materialDensity * efficiency factor
   - Set capacity slightly higher than bedVolume * density for realism
2. sourceSize should require multiple trips (sourceSize > bedVolume * 1.5)
3. targetLoads should be achievable (targetLoads >= sourceSize / bedVolume)
4. tripDistance should scale with grade level (longer for older students)
5. showWeight should be false for K, true for grades 1+
6. timeLimit should only be set for grades 4-5
7. Material type should match real-world scenarios

COLOR SUGGESTIONS:
- Construction theme: '#F59E0B' (amber), '#EAB308' (yellow), '#F97316' (orange)
- For cartoon theme: Bright colors like '#FBBF24' (bright yellow), '#FCD34D' (light yellow)
- For realistic theme: Construction equipment colors like '#F59E0B' (amber), '#DC2626' (red)

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.truckCapacity ? `- Truck capacity: ${config.truckCapacity}` : ''}
${config.bedVolume ? `- Bed volume: ${config.bedVolume}` : ''}
${config.materialType ? `- Material type: ${config.materialType}` : ''}
${config.materialDensity ? `- Material density: ${config.materialDensity}` : ''}
${config.showWeight !== undefined ? `- Show weight: ${config.showWeight}` : ''}
${config.showFillLevel !== undefined ? `- Show fill level: ${config.showFillLevel}` : ''}
${config.tripDistance ? `- Trip distance: ${config.tripDistance}` : ''}
${config.sourceSize ? `- Source size: ${config.sourceSize}` : ''}
${config.targetLoads ? `- Target loads: ${config.targetLoads}` : ''}
${config.timeLimit ? `- Time limit: ${config.timeLimit}` : ''}
${config.theme ? `- Theme: ${config.theme}` : ''}
` : ''}

Return a complete Dump Truck Loader configuration appropriate for the grade level and topic.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: dumpTruckLoaderSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Dump Truck Loader data returned from Gemini API');
  }

  // Validation: ensure truck capacity is reasonable
  if (!data.truckCapacity || data.truckCapacity < 20 || data.truckCapacity > 150) {
    console.warn('Invalid truckCapacity. Setting default.');
    data.truckCapacity = 50;
  }

  // Validation: ensure bed volume is reasonable
  if (!data.bedVolume || data.bedVolume < 10 || data.bedVolume > 60) {
    console.warn('Invalid bedVolume. Setting default.');
    data.bedVolume = 30;
  }

  // Validation: ensure material density is realistic
  if (!data.materialDensity || data.materialDensity < 1.0 || data.materialDensity > 2.5) {
    console.warn('Invalid materialDensity. Setting default.');
    data.materialDensity = 1.5;
  }

  // Validation: ensure source size requires multiple trips
  if (!data.sourceSize || data.sourceSize < data.bedVolume * 2) {
    console.warn('sourceSize too small. Setting default.');
    data.sourceSize = data.bedVolume * 5;
  }

  // Validation: ensure trip distance is valid
  if (!data.tripDistance || data.tripDistance < 150 || data.tripDistance > 700) {
    console.warn('Invalid tripDistance. Setting default.');
    data.tripDistance = 400;
  }

  // Validation: ensure material type is valid
  if (!['dirt', 'gravel', 'sand', 'debris'].includes(data.materialType)) {
    data.materialType = 'dirt';
  }

  // Validation: ensure theme is valid
  if (!['realistic', 'cartoon', 'simple'].includes(data.theme)) {
    data.theme = 'realistic';
  }

  // Validation: ensure truck color is set
  if (!data.truckColor) {
    data.truckColor = '#F59E0B';
  }

  // Set sensible defaults for boolean fields
  if (data.showWeight === undefined) data.showWeight = true;
  if (data.showFillLevel === undefined) data.showFillLevel = true;

  // Apply config overrides
  if (config) {
    if (config.truckCapacity !== undefined) data.truckCapacity = config.truckCapacity;
    if (config.bedVolume !== undefined) data.bedVolume = config.bedVolume;
    if (config.materialType) data.materialType = config.materialType;
    if (config.materialDensity !== undefined) data.materialDensity = config.materialDensity;
    if (config.showWeight !== undefined) data.showWeight = config.showWeight;
    if (config.showFillLevel !== undefined) data.showFillLevel = config.showFillLevel;
    if (config.tripDistance !== undefined) data.tripDistance = config.tripDistance;
    if (config.sourceSize !== undefined) data.sourceSize = config.sourceSize;
    if (config.targetLoads !== undefined) data.targetLoads = config.targetLoads;
    if (config.timeLimit !== undefined) data.timeLimit = config.timeLimit;
    if (config.theme) data.theme = config.theme;
    if (config.truckColor) data.truckColor = config.truckColor;
  }

  return data;
};
