/**
 * Take Home Activity Generator - Dedicated service for hands-on learning activities
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

export interface MaterialItem {
  item: string;
  quantity: string;
  essential: boolean;
  substitutes?: string[];
  examples?: string[];
}

export interface ActivityStep {
  stepNumber: number;
  title: string;
  instruction: string;
  tip?: string;
  scienceNote?: string;
  checkpoint?: {
    question: string;
    type: 'confirm' | 'count' | 'reflection';
  };
}

export interface ReflectionPrompt {
  question: string;
  hint?: string;
  connectionTo?: string;
}

export interface Extension {
  title: string;
  description: string;
  difficulty: 'intermediate' | 'advanced';
}

export interface TakeHomeActivityData {
  id: string;
  title: string;
  subject: string;
  topic: string;
  gradeRange: string;
  estimatedTime: string;
  overview: string;
  learningObjectives: string[];
  materials: MaterialItem[];
  safetyNotes?: string[];
  steps: ActivityStep[];
  reflectionPrompts: ReflectionPrompt[];
  extensions?: Extension[];
  documentationPrompt?: {
    instruction: string;
    suggestedCaption: string;
  };
}

/**
 * Generate Take Home Activity content
 *
 * Creates a screen-free, hands-on learning experience using common household materials.
 *
 * @param topic - The topic being explored
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent
 * @returns Complete take-home activity data
 */
export const generateTakeHomeActivity = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
  }
): Promise<TakeHomeActivityData> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: "Unique identifier for this activity" },
      title: { type: Type.STRING, description: "Engaging, action-oriented title" },
      subject: {
        type: Type.STRING,
        enum: ["Science", "Math", "Language Arts", "Social Studies", "Art"],
        description: "Subject area"
      },
      topic: { type: Type.STRING, description: "Specific curriculum topic this addresses" },
      gradeRange: { type: Type.STRING, description: "Grade range like 'K-2', '3-5', '6-8'" },
      estimatedTime: { type: Type.STRING, description: "Time estimate like '30-45 minutes'" },
      overview: { type: Type.STRING, description: "2-3 sentence description that hooks student interest and previews the learning" },
      learningObjectives: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "3 specific, measurable learning outcomes"
      },
      materials: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            item: { type: Type.STRING, description: "Material name" },
            quantity: { type: Type.STRING, description: "Amount needed (household-friendly units)" },
            essential: { type: Type.BOOLEAN, description: "Is this truly necessary?" },
            substitutes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Alternative materials that can be used instead"
            },
            examples: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Specific examples for open-ended items"
            }
          },
          required: ["item", "quantity", "essential"]
        },
        description: "List of 5-10 materials needed"
      },
      safetyNotes: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Safety considerations if applicable"
      },
      steps: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            stepNumber: { type: Type.NUMBER, description: "Step number (1, 2, 3...)" },
            title: { type: Type.STRING, description: "Brief step title" },
            instruction: { type: Type.STRING, description: "Clear, detailed instruction at appropriate reading level" },
            tip: { type: Type.STRING, description: "Optional helpful hint for tricky parts" },
            scienceNote: { type: Type.STRING, description: "Optional explanation of the concept being demonstrated" },
            checkpoint: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING, description: "Question to verify understanding or completion" },
                type: {
                  type: Type.STRING,
                  enum: ["confirm", "count", "reflection"],
                  description: "Type of checkpoint"
                }
              },
              required: ["question", "type"]
            }
          },
          required: ["stepNumber", "title", "instruction"]
        },
        description: "5-8 steps for younger grades, up to 10-12 for older grades"
      },
      reflectionPrompts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: "Open-ended question connecting to learning objectives" },
            hint: { type: Type.STRING, description: "Scaffolding hint to guide thinking" },
            connectionTo: { type: Type.STRING, description: "Reference to which learning objective this addresses" }
          },
          required: ["question"]
        },
        description: "2-4 reflection prompts moving from observation to abstract principle to real-world connection"
      },
      extensions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Extension activity name" },
            description: { type: Type.STRING, description: "Brief description of the challenge" },
            difficulty: {
              type: Type.STRING,
              enum: ["intermediate", "advanced"],
              description: "Difficulty level"
            }
          },
          required: ["title", "description", "difficulty"]
        },
        description: "1-2 optional challenges for deeper exploration"
      },
      documentationPrompt: {
        type: Type.OBJECT,
        properties: {
          instruction: { type: Type.STRING, description: "What to photograph or record" },
          suggestedCaption: { type: Type.STRING, description: "Template for sharing with fill-in-the-blanks" }
        },
        required: ["instruction", "suggestedCaption"]
      }
    },
    required: ["id", "title", "subject", "topic", "gradeRange", "estimatedTime", "overview", "learningObjectives", "materials", "steps", "reflectionPrompts"]
  };

  const prompt = `You are an expert educational content designer specializing in hands-on, inquiry-based learning activities for K-8 homeschool students. Generate a Take Home Activity - a screen-free, hands-on learning experience using common household materials.

CONTEXT:
- Topic: ${topic}
- Target Audience: ${gradeContext}
- Intent: ${config?.intent || 'Provide hands-on exploration of the topic'}

## Design Principles

1. **Safety First**: Activities must be age-appropriate with clear safety guidance. Assume varying levels of adult supervision.

2. **Accessibility**: Prioritize common household materials. ALWAYS provide substitutes for harder-to-find items.

3. **Scientific Rigor**: Even simple activities should teach real concepts accurately. Include the "why" behind each step.

4. **Scaffolded Discovery**: Guide students toward insights rather than just telling them. Use checkpoints and reflection prompts.

5. **Multiple Entry Points**: Activities should engage different learning styles - kinesthetic doing, visual observation, verbal reflection.

6. **Documentation Built-In**: Encourage students to capture and reflect on their work.

## Field Guidelines

### Materials
- List 5-10 materials maximum
- Mark truly necessary items as essential: true
- ALWAYS provide substitutes for specialty items (substitutes array)
- Use examples array for open-ended categories (e.g., "small objects to test")
- Quantities should be household-friendly (tablespoons, cups, "a few")

### Steps
- Aim for 5-8 steps for younger grades (K-2, 3-5), up to 10-12 for older (6-8)
- Each step should be ONE focused action
- Include tip for tricky parts or common mistakes
- Include scienceNote when explaining WHY something happens
- Every 2-3 steps should have a checkpoint to maintain engagement
- Checkpoint types:
  - confirm: Yes/no verification ("Can you see two layers?")
  - count: Numerical observation ("How many different sounds can you make?")
  - reflection: Open observation ("What do you notice about...?")

### Reflection Prompts
- 2-4 prompts that connect hands-on experience to conceptual understanding
- Move from concrete observation → abstract principle → real-world connection
- Hints should scaffold without giving away the answer

### Extensions
- 1-2 optional challenges for students who want more
- Should deepen understanding, not just add busywork
- Mark difficulty clearly so students self-select appropriately

### Safety Notes
- Include for ANY activity involving:
  - Heat, sharp objects, or breakable items
  - Substances that shouldn't be ingested
  - Activities requiring adult supervision
  - Potential mess or stain risks
- For young grades (K-2), always include "Adult helper recommended"

Generate a complete, engaging take-home activity following these guidelines.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);

  console.log('🏠 Take Home Activity Generated from dedicated service:', {
    topic,
    title: data.title,
    stepCount: data.steps?.length || 0
  });

  return data as TakeHomeActivityData;
};
