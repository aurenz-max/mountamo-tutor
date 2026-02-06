# Physics Generator Services

This directory contains Gemini AI-powered generator services for physics primitives.

## Purpose

Each generator service creates educational content for a specific physics primitive using the Gemini API with structured outputs.

## File Naming Convention

`gemini-[primitive-name].ts`

Examples:
- `gemini-force-diagram.ts`
- `gemini-motion-simulator.ts`
- `gemini-energy-converter.ts`
- `gemini-circuit-builder.ts`

## Generator Structure

```typescript
import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { MyPrimitiveData } from '../../primitives/visual-primitives/physics/MyPrimitive';

const myPrimitiveSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    // Match the TypeScript interface from the component
  },
  required: [/* required fields */]
};

export const generateMyPrimitive = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<MyPrimitiveData>
): Promise<MyPrimitiveData> => {
  const prompt = `Create physics content for "${topic}" at ${gradeLevel} level...`;

  const result = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: myPrimitiveSchema
    }
  });

  return JSON.parse(result.text || '{}');
};
```

## Integration

Generators are registered in `/service/registry/generators/physicsGenerators.ts` and automatically loaded when the generator registry index is imported.

## Physics Topics Coverage

- **Mechanics**: Forces, motion, friction, gravity
- **Energy**: Potential, kinetic, conservation, transformations
- **Waves**: Sound, light, frequency, amplitude
- **Electricity**: Circuits, Ohm's law, voltage, current
- **Magnetism**: Magnetic fields, electromagnetism
- **Thermodynamics**: Heat, temperature, states of matter
- **Modern Physics**: Light properties, quantum concepts (high school)
