/**
 * Annotated Example Generator - Dedicated service for worked examples with annotation layers
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { AnnotatedExampleData } from "../../types";
import { ai } from "../geminiClient";

/**
 * Generate Annotated Example content
 *
 * Creates a fully solved problem with multiple annotation layers revealing
 * procedural steps, strategic thinking, common errors, and conceptual connections.
 *
 * @param topic - The topic being demonstrated
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent and objective info
 * @returns Annotated example data with steps and annotation layers
 */
export const generateAnnotatedExample = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
    objectiveText?: string;
    objectiveVerb?: string;
  }
): Promise<AnnotatedExampleData> => {
  const objectiveContext = config?.objectiveText
    ? `\n\n🎯 LEARNING OBJECTIVE: "${config.objectiveText}"
The worked example must directly support achieving this specific learning objective.`
    : '';

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Descriptive title of the problem type" },
      subject: { type: Type.STRING, description: "Subject area" },
      problem: {
        type: Type.OBJECT,
        properties: {
          statement: { type: Type.STRING, description: "The problem prompt or question" },
          equations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Any given equations or expressions"
          },
          context: { type: Type.STRING, description: "Optional additional context or given information" }
        },
        required: ["statement"]
      },
      layers: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "Layer ID (steps, strategy, misconceptions, connections)" },
            label: { type: Type.STRING, description: "Display label" },
            color: { type: Type.STRING, description: "Hex color code" },
            icon: { type: Type.STRING, description: "Emoji icon" }
          },
          required: ["id", "label", "color", "icon"]
        },
        description: "Must include these 4 layers: steps, strategy, misconceptions, connections"
      },
      steps: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.NUMBER, description: "Step number (sequential from 1)" },
            title: { type: Type.STRING, description: "Brief title for this step" },
            work: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING, description: "Mathematical expression or work shown" },
                  annotation: { type: Type.STRING, description: "Optional inline note like '× 3'" }
                },
                required: ["text"]
              },
              description: "Lines of mathematical work shown in this step"
            },
            result: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING, description: "Result or simplified form after this step" }
                },
                required: ["text"]
              },
              description: "Result lines after this step (optional)"
            },
            annotations: {
              type: Type.OBJECT,
              properties: {
                steps: { type: Type.STRING, description: "What we're doing procedurally in this step" },
                strategy: { type: Type.STRING, description: "WHY we're making this choice, metacognitive reasoning" },
                misconceptions: { type: Type.STRING, description: "Common errors students make here" },
                connections: { type: Type.STRING, description: "How this connects to underlying concepts" }
              },
              required: ["steps", "strategy", "misconceptions", "connections"]
            }
          },
          required: ["id", "title", "work", "annotations"]
        },
        description: "4-8 steps that solve the problem completely"
      }
    },
    required: ["title", "subject", "problem", "layers", "steps"]
  };

  const prompt = `You are generating a Worked Example with Annotation Layers. The student will study a fully solved problem while toggling different layers that reveal procedural steps, strategic thinking, common errors, and conceptual connections.

CONTEXT:
- Topic: ${topic}
- Target Audience: ${gradeContext}
- Intent: ${config?.intent || 'Demonstrate problem-solving process'}
${objectiveContext}

## Output Format
Return ONLY valid JSON matching the schema provided.

## Layer Design Principles

### Steps Layer (Procedural)
- Describe WHAT is happening mechanically
- Use clear, direct language: "Multiply both sides by 3" not "We should multiply..."
- Focus on the action, not the reasoning
- Should be sufficient for a student to replicate the procedure

### Strategy Layer (Metacognitive)
- Explain WHY this approach was chosen over alternatives
- Make decision points explicit: "I chose elimination over substitution because..."
- Reveal expert thinking patterns: "I notice that... so I'll..."
- Discuss efficiency and elegance when relevant
- Use first person to model internal monologue

### Misconceptions Layer (Error Prevention)
- Flag the SPECIFIC error students commonly make at this step
- Be concrete: "A common error is writing 12x - 3y = 5 instead of 15"
- Explain why the error is tempting
- Don't just say "be careful"—say what to be careful about

### Connections Layer (Conceptual)
- Link to underlying mathematical/scientific principles
- Connect to previously learned concepts
- Provide geometric, visual, or real-world interpretations
- Show how this technique generalizes

## Step Design Principles

1. **Granularity**: Each step should represent ONE logical move. If you're tempted to write "and then" in a step description, split it into two steps.

2. **Work array**: Show the actual mathematical expressions, line by line. Include intermediate steps—don't skip algebra.

3. **Result array**: Show what we have after this step is complete. This becomes the starting point for the next step.

4. **Inline annotations**: Use sparingly for operation indicators (× 3, + equation 1, etc.)

5. **Verification step**: Always include a final step that verifies the answer by substitution or checking. This models good mathematical practice.

## Annotation Quality Checklist

For each step, verify:
- Steps layer tells WHAT without WHY
- Strategy layer reveals expert decision-making
- Misconceptions layer flags a SPECIFIC, COMMON error (not generic warnings)
- Connections layer links to at least one broader concept
- No layer repeats information from another layer

## Required Layers (MUST include all 4)
[
  { "id": "steps", "label": "Steps", "color": "#3b82f6", "icon": "📝" },
  { "id": "strategy", "label": "Strategy", "color": "#8b5cf6", "icon": "🧠" },
  { "id": "misconceptions", "label": "Watch Out", "color": "#ef4444", "icon": "⚠️" },
  { "id": "connections", "label": "Connections", "color": "#22c55e", "icon": "🔗" }
]

Generate a complete worked example with 4-8 steps. Ensure annotations are substantive—each should teach something a student wouldn't get from just watching the procedure.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text) as AnnotatedExampleData;

  console.log('📝 Annotated Example Generated from dedicated service:', {
    topic,
    stepCount: data.steps?.length || 0
  });

  return data;
};
