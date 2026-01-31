import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

/**
 * Schema for blueprint canvas evaluation response
 */
const blueprintEvaluationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    roomsDetected: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          identified: { type: Type.BOOLEAN },
          feedback: { type: Type.STRING }
        },
        required: ["name", "identified", "feedback"]
      },
      description: "List of rooms/spaces detected in the blueprint"
    },
    totalRoomsFound: {
      type: Type.NUMBER,
      description: "Total number of distinct rooms/spaces identified"
    },
    targetMet: {
      type: Type.BOOLEAN,
      description: "Whether the student met the target room count requirement"
    },
    overallFeedback: {
      type: Type.STRING,
      description: "Encouraging 2-3 sentence summary of the blueprint quality"
    },
    technicalQuality: {
      type: Type.NUMBER,
      description: "0-100 score for technical drawing quality (walls, alignment, clarity)"
    },
    spatialPlanning: {
      type: Type.NUMBER,
      description: "0-100 score for spatial planning and room arrangement"
    },
    confidence: {
      type: Type.NUMBER,
      description: "0-100: AI's confidence in this evaluation"
    }
  },
  required: ["roomsDetected", "totalRoomsFound", "targetMet", "overallFeedback", "technicalQuality", "spatialPlanning", "confidence"]
};

export interface BlueprintEvaluationResult {
  roomsDetected: Array<{
    name: string;
    identified: boolean;
    feedback: string;
  }>;
  totalRoomsFound: number;
  targetMet: boolean;
  overallFeedback: string;
  technicalQuality: number;
  spatialPlanning: number;
  confidence: number;
}

export interface EvaluationProgressCallback {
  onProgress?: (stage: 'uploading' | 'analyzing' | 'processing' | 'complete', message: string) => void;
}

/**
 * Evaluate student blueprint drawing using Gemini Vision API
 *
 * @param canvasImageBase64 - Base64 encoded canvas image (PNG/JPEG)
 * @param assignment - Description of what the student was asked to draw
 * @param targetRoomCount - Expected number of rooms/spaces
 * @param viewType - Type of view (plan, elevation, section)
 * @param gradeLevel - Student grade level for appropriate feedback
 * @param callbacks - Optional progress callbacks
 */
export async function evaluateBlueprintCanvas(
  canvasImageBase64: string,
  assignment: string,
  targetRoomCount: number,
  viewType: 'plan' | 'elevation' | 'section',
  gradeLevel: string,
  callbacks?: EvaluationProgressCallback
): Promise<BlueprintEvaluationResult> {
  callbacks?.onProgress?.('uploading', 'Preparing your blueprint...');

  const base64Data = canvasImageBase64.replace(/^data:image\/\w+;base64,/, "");

  const prompt = `You are an expert educational AI evaluating a student's blueprint drawing.

ASSIGNMENT: ${assignment}

STUDENT GRADE LEVEL: ${gradeLevel}

VIEW TYPE: ${viewType} view (${viewType === 'plan' ? 'top-down floor plan' : viewType === 'elevation' ? 'side view' : 'cross-section view'})

TARGET REQUIREMENT: The student should have drawn at least ${targetRoomCount} distinct rooms/spaces.

Analyze the blueprint drawing and provide evaluation:

1. **Room/Space Detection**: Identify all distinct rooms or spaces drawn in the blueprint
   - Look for enclosed areas bounded by walls/lines
   - Count each separate space (bedrooms, kitchens, bathrooms, hallways, etc.)
   - For each room detected, provide:
     * name: What type of room/space it appears to be (e.g., "bedroom", "kitchen", "living room")
     * identified: true if clearly identifiable, false if unclear/ambiguous
     * feedback: Brief encouraging comment about this room (1 sentence)

2. **Target Achievement**: Determine if the student met the ${targetRoomCount} room requirement
   - targetMet: true if totalRoomsFound >= ${targetRoomCount}, false otherwise

3. **Technical Quality** (0-100 score):
   - Are walls/lines relatively straight and clear?
   - Is the grid used for alignment?
   - Are rooms enclosed properly (no missing walls)?
   - Are proportions reasonable?
   - Grade-appropriate expectations: ${gradeLevel === 'Kindergarten' || gradeLevel === 'Grade 1' ? 'Simple shapes are fine, focus on whether spaces are enclosed' : gradeLevel === 'Grade 2' || gradeLevel === 'Grade 3' ? 'Expect clearer walls and better alignment' : 'Expect precise technical drawing with good use of grid'}

4. **Spatial Planning** (0-100 score):
   - Are rooms arranged logically (e.g., bathroom near bedrooms, kitchen accessible)?
   - Are room sizes reasonable relative to each other?
   - Is space used efficiently?
   - Does the layout make functional sense?

5. **Overall Feedback**:
   - Provide 2-3 sentences of encouraging, constructive feedback
   - Celebrate what they did well
   - If target not met, gently encourage adding more rooms
   - Use age-appropriate language for ${gradeLevel}

EVALUATION GUIDELINES:
- Be encouraging and positive - this is about learning spatial reasoning
- Focus on effort and understanding, not perfection
- For younger students (K-2), simple enclosed shapes count as rooms
- For older students (3-5), expect more detailed/realistic room layouts
- Even rough sketches should be valued if they show understanding
- Confidence score should reflect clarity of the drawing (blurry/faint = lower confidence)

Return a detailed evaluation following the schema.`;

  try {
    callbacks?.onProgress?.('analyzing', 'AI is analyzing your blueprint...');

    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: base64Data,
              },
            },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: blueprintEvaluationSchema
      }
    });

    callbacks?.onProgress?.('processing', 'Processing feedback...');

    const text = result.text;
    if (!text) {
      throw new Error('No response from Gemini API');
    }

    const parsed = JSON.parse(text);

    callbacks?.onProgress?.('complete', 'Evaluation complete!');

    return {
      roomsDetected: parsed.roomsDetected || [],
      totalRoomsFound: parsed.totalRoomsFound || 0,
      targetMet: parsed.targetMet || false,
      overallFeedback: parsed.overallFeedback || "Great effort on your blueprint!",
      technicalQuality: parsed.technicalQuality || 50,
      spatialPlanning: parsed.spatialPlanning || 50,
      confidence: parsed.confidence || 70
    };
  } catch (error) {
    console.error("Gemini Blueprint Evaluation Error:", error);
    throw error;
  }
}
