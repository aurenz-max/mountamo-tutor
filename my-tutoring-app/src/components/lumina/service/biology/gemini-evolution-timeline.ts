import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import the data type from the component (single source of truth)
import { EvolutionTimelineData } from "../../primitives/visual-primitives/biology/EvolutionTimeline";

/**
 * Schema definition for Evolution Timeline Data
 *
 * This schema defines the structure for the deep-time evolutionary timeline
 * primitive. Students navigate geological time, explore mass extinctions,
 * trace lineages, and use scale anchors to grasp deep time.
 */
const evolutionTimelineSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    timespan: {
      type: Type.OBJECT,
      properties: {
        startMya: { type: Type.NUMBER, description: "Start of timeline in millions of years ago (e.g., 4500 for 4.5 Bya)" },
        endMya: { type: Type.NUMBER, description: "End of timeline in millions of years ago (e.g., 0 for present)" }
      },
      required: ["startMya", "endMya"]
    },
    eras: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Era name (e.g., 'Precambrian', 'Paleozoic', 'Mesozoic', 'Cenozoic')" },
          startMya: { type: Type.NUMBER, description: "Era start in Mya" },
          endMya: { type: Type.NUMBER, description: "Era end in Mya" },
          color: { type: Type.STRING, description: "Hex color for the era band (e.g., '#7c3aed')" },
          description: { type: Type.STRING, description: "1-2 sentence description of this era" }
        },
        required: ["name", "startMya", "endMya", "color", "description"]
      }
    },
    events: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique event ID (e.g., 'evt-first-life', 'evt-cambrian-explosion')" },
          name: { type: Type.STRING, description: "Short event name" },
          mya: { type: Type.NUMBER, description: "When this event occurred in Mya" },
          type: { type: Type.STRING, enum: ["emergence", "extinction", "adaptation", "environmental"], description: "Event category" },
          description: { type: Type.STRING, description: "2-3 sentence description of what happened" },
          significance: { type: Type.STRING, description: "Why this event matters for the history of life" },
          imagePrompt: { type: Type.STRING, description: "Prompt for generating an illustration of this event, or null", nullable: true }
        },
        required: ["id", "name", "mya", "type", "description", "significance"]
      }
    },
    lineages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Lineage name (e.g., 'Path to Mammals', 'Rise of Flowering Plants')" },
          eventIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Ordered list of event IDs tracing this lineage" }
        },
        required: ["name", "eventIds"]
      }
    },
    scaleAnchors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          analogy: { type: Type.STRING, description: "The scale analogy (e.g., 'If Earth's history were 24 hours...')" },
          mappings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                event: { type: Type.STRING, description: "Event name" },
                analogyPosition: { type: Type.STRING, description: "Where this event falls in the analogy (e.g., '11:58 PM')" }
              },
              required: ["event", "analogyPosition"]
            }
          }
        },
        required: ["analogy", "mappings"]
      }
    },
    massExtinctions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Extinction event name (e.g., 'End-Permian', 'K-Pg')" },
          mya: { type: Type.NUMBER, description: "When it occurred in Mya" },
          cause: { type: Type.STRING, description: "Primary cause(s) of the extinction" },
          percentSpeciesLost: { type: Type.STRING, description: "Approximate percentage of species lost (e.g., '~75%', '~96%')" },
          aftermath: { type: Type.STRING, description: "What happened after — how life recovered and diversified" }
        },
        required: ["name", "mya", "cause", "percentSpeciesLost", "aftermath"]
      }
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["4-5", "6-8"],
      description: "Target grade band"
    }
  },
  required: ["timespan", "eras", "events", "lineages", "scaleAnchors", "massExtinctions", "gradeBand"]
};

/**
 * Grade-specific context for prompt generation
 */
const gradeContext: Record<string, string> = {
  '4-5': `Grade 4-5 students. Use simple, engaging vocabulary. Focus on major events they'd recognize
(dinosaurs, first animals, first plants). Keep descriptions to 1-2 sentences. Include 8-12 events.
Include 2-3 lineages with clear, linear paths. Use 2 scale anchors with familiar references
(football field, 24-hour clock). Include 2-3 mass extinctions (the most dramatic ones).
Avoid technical geological terms — use "ancient ocean" not "Panthalassic Ocean".`,

  '6-8': `Grade 6-8 students. Use scientific vocabulary with brief explanations. Include 12-18 events
covering molecular evolution through modern humans. Include 3-5 lineages showing major evolutionary
transitions (fish to tetrapods, dinosaurs to birds, etc.). Use 2-3 scale anchors with both familiar
and scientific references. Include all 5 major mass extinctions with scientific causes.
Can mention geological terms, plate tectonics, atmospheric changes. Include adaptation events
showing natural selection at work.`
};

/**
 * Generate Evolution Timeline data using Gemini AI
 *
 * @param topic - The evolutionary topic to focus on (e.g., "History of Life on Earth", "Evolution of Mammals")
 * @param gradeBand - Target grade band ('4-5' or '6-8')
 * @param config - Optional partial configuration to merge
 * @returns Complete EvolutionTimelineData
 */
export const generateEvolutionTimeline = async (
  topic: string,
  gradeBand: '4-5' | '6-8' = '4-5',
  config?: Partial<EvolutionTimelineData>
): Promise<EvolutionTimelineData> => {
  const prompt = `Create an interactive deep-time evolution timeline for the topic: "${topic}"

TARGET GRADE BAND: ${gradeBand}
${gradeContext[gradeBand]}

REQUIREMENTS:
1. TIMESPAN: Set appropriate start and end dates in millions of years ago (Mya).
   - For "History of Life on Earth" or broad topics: startMya=4500, endMya=0
   - For focused topics (e.g., "Evolution of Mammals"): narrow the range appropriately

2. ERAS: Include the major geological eras that fall within the timespan.
   - Each era needs a distinct hex color, name, start/end Mya, and brief description.
   - Use colors that contrast well: Precambrian (#6b21a8), Paleozoic (#1e40af),
     Mesozoic (#15803d), Cenozoic (#b45309)

3. EVENTS: Create evolutionary events spread across the timeline.
   - Each event needs a unique ID (e.g., 'evt-first-fish'), name, mya, type, description, significance.
   - Types: 'emergence' (new groups appearing), 'extinction' (species dying out),
     'adaptation' (key evolutionary innovations), 'environmental' (climate/geology changes).
   - Distribute events across different eras — don't cluster them all in one period.
   - Include events that students would find fascinating (first eyes, first flight, etc.)

4. LINEAGES: Create evolutionary paths connecting events.
   - Each lineage is a named path with an ordered list of event IDs.
   - Example: "Path to Mammals" might trace: first vertebrates → first tetrapods →
     first synapsids → first mammals → modern mammals.
   - Every eventId in a lineage MUST exist in the events array.

5. SCALE ANCHORS: Help students grasp deep time with analogies.
   - Example: "If Earth's history were a 24-hour clock, humans appear at 11:58:43 PM"
   - Example: "If Earth's history were a football field (100 yards), dinosaurs appear at the 5-yard line"
   - Each anchor needs 4-6 mapping points connecting events to analogy positions.

6. MASS EXTINCTIONS: Include the major extinction events.
   - Name, when (Mya), cause, percentage of species lost, and aftermath.
   - The aftermath should explain how life recovered and what new groups emerged.

IMPORTANT: Every event ID referenced in lineages MUST exist in the events array.
Return ONLY valid JSON matching the schema.`;

  const result = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: evolutionTimelineSchema,
      temperature: 0.7,
    },
  });

  const parsed = JSON.parse(result.text || '{}') as EvolutionTimelineData;

  // Validate required fields
  if (!parsed.events || parsed.events.length === 0) {
    throw new Error('Evolution Timeline generation failed: no events returned');
  }
  if (!parsed.eras || parsed.eras.length === 0) {
    throw new Error('Evolution Timeline generation failed: no eras returned');
  }
  if (!parsed.lineages || parsed.lineages.length === 0) {
    throw new Error('Evolution Timeline generation failed: no lineages returned');
  }

  // Ensure gradeBand is set
  parsed.gradeBand = gradeBand;

  // Validate lineage event references
  const eventIds = new Set(parsed.events.map(e => e.id));
  for (const lineage of parsed.lineages) {
    lineage.eventIds = lineage.eventIds.filter(id => eventIds.has(id));
  }
  // Remove lineages with fewer than 2 valid events
  parsed.lineages = parsed.lineages.filter(l => l.eventIds.length >= 2);

  // Merge config overrides
  const finalData: EvolutionTimelineData = {
    ...parsed,
    ...config,
    timespan: config?.timespan || parsed.timespan,
    eras: config?.eras || parsed.eras,
    events: config?.events || parsed.events,
    lineages: config?.lineages || parsed.lineages,
    scaleAnchors: config?.scaleAnchors || parsed.scaleAnchors,
    massExtinctions: config?.massExtinctions || parsed.massExtinctions,
    gradeBand: config?.gradeBand || gradeBand,
  };

  console.log('🦕 Evolution Timeline Generated:', {
    topic,
    gradeBand,
    eras: finalData.eras.length,
    events: finalData.events.length,
    lineages: finalData.lineages.length,
    massExtinctions: finalData.massExtinctions.length,
    scaleAnchors: finalData.scaleAnchors.length,
    timespan: `${finalData.timespan.startMya} - ${finalData.timespan.endMya} Mya`,
  });

  return finalData;
};
