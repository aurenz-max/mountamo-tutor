import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

/**
 * Schema for scratch pad analysis result
 */
const scratchPadAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "A brief 1-2 sentence summary of what is written or drawn"
    },
    latex: {
      type: Type.STRING,
      description: "The mathematical content converted to LaTeX format if applicable, otherwise null",
      nullable: true
    },
    feedback: {
      type: Type.STRING,
      description: "Constructive feedback. If solving a problem, check steps. If correct, encourage. If mistake, provide helpful hint without giving answer"
    },
    nextSteps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "1-3 CONCRETE next steps using ACTUAL values from the student's work. Example: 'Calculate (1×3) + (2×4) = ?' NOT 'Identify dimensions'. Always include specific numbers/expressions from their work."
    },
    encouragement: {
      type: Type.STRING,
      description: "A short, motivating message for the student"
    }
  },
  required: ["summary", "feedback", "encouragement"]
};

export interface ScratchPadAnalysisResult {
  summary: string;
  feedback: string;
  latex?: string | null;
  nextSteps?: string[];
  encouragement?: string;
}

export interface AnalysisProgressCallback {
  onProgress?: (stage: 'uploading' | 'analyzing' | 'processing' | 'complete', message: string) => void;
}

/**
 * Analyzes a scratch pad image using Gemini Vision
 * Provides educational feedback, math recognition, and next steps
 * Supports progress callbacks for real-time UI updates
 */
export async function analyzeScratchPad(
  imageBase64: string,
  context?: {
    topic?: string;
    gradeLevel?: string;
  },
  callbacks?: AnalysisProgressCallback
): Promise<ScratchPadAnalysisResult> {
  // Stage 1: Uploading/preparing
  callbacks?.onProgress?.('uploading', 'Preparing your work...');

  // Remove the data URL prefix if present to get just the base64 string
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  const contextInfo = context?.topic
    ? `The student is currently learning about: ${context.topic}. Grade level: ${context.gradeLevel || 'general'}.`
    : '';

  const prompt = `You are an expert AI tutor observing a student's whiteboard/scratch pad.
${contextInfo}

Analyze the visible handwriting, diagrams, and calculations in this image.

Guidelines:
- Provide a brief 1-2 sentence summary of what is written or drawn
- If there's mathematical content, convert it to proper LaTeX format
- Give constructive feedback - if solving a problem, check their steps
- If correct, encourage them enthusiastically
- If there's a mistake, provide a helpful hint without giving the answer immediately
- If it's drawing, comment on creativity and educational value

CRITICAL FOR NEXT STEPS:
- Next steps MUST be concrete and specific to what the student has written
- Tell them EXACTLY what to write or calculate next, with actual numbers/values from their work
- BAD example: "Identify the dimensions of each matrix" (too vague)
- GOOD example: "Multiply the first row [1, 2] by the first column [3, 4] to get: (1×3) + (2×4) = ?"
- GOOD example: "Write 3 + 5 = ___ below your work and fill in the answer"
- GOOD example: "Your next step is to calculate 24 ÷ 6. Write this division below."
- If they've set up a problem but haven't started solving, show them the FIRST calculation step with their actual numbers
- Always reference the specific values, variables, or expressions visible in their work

- Always include an encouraging message
- If the whiteboard is empty or unclear, provide a friendly prompt to start working

Be encouraging, educational, and helpful in tone.`;

  try {
    // Stage 2: Analyzing
    callbacks?.onProgress?.('analyzing', 'Analyzing your work...');

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
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
        responseSchema: scratchPadAnalysisSchema
      }
    });

    // Stage 3: Processing response
    callbacks?.onProgress?.('processing', 'Processing feedback...');

    const text = result.text;
    if (!text) {
      throw new Error('No response from Gemini API');
    }

    const parsed = JSON.parse(text);

    // Stage 4: Complete
    callbacks?.onProgress?.('complete', 'Ready!');

    return {
      summary: parsed.summary || "Analysis complete.",
      feedback: parsed.feedback || "Keep up the great work!",
      latex: parsed.latex || null,
      nextSteps: parsed.nextSteps || [],
      encouragement: parsed.encouragement || "You're doing great!"
    };
  } catch (error) {
    console.error("Gemini Scratch Pad Analysis Error:", error);
    throw error;
  }
}

/**
 * Get a hint for the current work without giving away the answer
 */
export async function getScratchPadHint(
  imageBase64: string,
  hintLevel: number = 1
): Promise<string> {
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  const hintStrength = hintLevel === 1 ? 'subtle' : hintLevel === 2 ? 'moderate' : 'direct';

  const prompt = `You are a helpful tutor. Look at this student's work and provide a ${hintStrength} hint to help them progress.

Hint level: ${hintLevel}/3
- Level 1 (subtle): Give a gentle nudge in the right direction
- Level 2 (moderate): Point out what area needs attention
- Level 3 (direct): Give more specific guidance without solving it completely

Respond with ONLY the hint text, nothing else. Keep it under 2 sentences.`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
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
      ]
    });

    return result.text || "Try looking at your work from a different angle.";
  } catch (error) {
    console.error("Gemini Hint Generation Error:", error);
    throw error;
  }
}

/**
 * Schema for practice problem generation
 */
const practiceProblemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    problem: {
      type: Type.STRING,
      description: "The problem statement using clear, simple language"
    },
    hint: {
      type: Type.STRING,
      description: "A subtle hint that could help if they get stuck"
    }
  },
  required: ["problem", "hint"]
};

/**
 * Generate a practice problem based on the current topic
 */
export async function generatePracticeProblem(
  topic: string,
  gradeLevel: string,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): Promise<{
  problem: string;
  hint?: string;
}> {
  const prompt = `Generate a ${difficulty} practice problem for a ${gradeLevel} student learning about ${topic}.

The problem should be:
- Engaging and appropriate for handwritten work on a scratch pad
- Clear, simple language appropriate for the grade level
- Include a subtle hint that could help if they get stuck

Examples of good problems for different subjects:
- Math: "Calculate 3/4 + 1/2. Show your work step by step."
- Science: "Draw and label the parts of a plant cell."
- Language Arts: "Write a sentence using the word 'because' to explain why you like your favorite food."`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: practiceProblemSchema
      }
    });

    const text = result.text;
    if (!text) {
      throw new Error('No response from Gemini API');
    }

    const parsed = JSON.parse(text);
    return {
      problem: parsed.problem,
      hint: parsed.hint
    };
  } catch (error) {
    console.error("Gemini Problem Generation Error:", error);
    throw error;
  }
}
