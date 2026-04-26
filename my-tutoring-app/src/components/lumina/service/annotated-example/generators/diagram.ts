/**
 * Diagram primitive — a labeled figure or geometric setup.
 *
 * Renders as a generated image with callouts.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../../geminiClient';
import type { DiagramStepContent, StepAnnotations } from '../../../primitives/annotated-example/types';
import {
  ANNOTATIONS_SCHEMA_FIELDS,
  ANNOTATIONS_REQUIRED,
  annotationPromptSuffix,
  buildStepContextPrefix,
  extractAnnotations,
  type PrimitiveDef,
  type StepGeneratorContext,
} from './_shared';

const DIAGRAM_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    imagePrompt: { type: Type.STRING, description: 'Detailed image generation prompt for the diagram' },
    altText: { type: Type.STRING, description: 'Accessibility alt text' },
    label0Text: { type: Type.STRING, description: 'Label 1 text' },
    label0Desc: { type: Type.STRING, description: 'Label 1 description' },
    label1Text: { type: Type.STRING },
    label1Desc: { type: Type.STRING },
    label2Text: { type: Type.STRING, nullable: true },
    label2Desc: { type: Type.STRING, nullable: true },
    label3Text: { type: Type.STRING, nullable: true },
    label3Desc: { type: Type.STRING, nullable: true },
    label4Text: { type: Type.STRING, nullable: true },
    label4Desc: { type: Type.STRING, nullable: true },
    result: { type: Type.STRING, description: 'KaTeX expression or conclusion from the diagram' },
    ...ANNOTATIONS_SCHEMA_FIELDS,
  },
  required: ['imagePrompt', 'altText', 'label0Text', 'label0Desc', 'label1Text', 'label1Desc', 'result', ...ANNOTATIONS_REQUIRED],
};

async function generateDiagramStep(
  ctx: StepGeneratorContext,
): Promise<{ content: DiagramStepContent; annotations: StepAnnotations; result: string }> {
  const contextPrefix = buildStepContextPrefix(ctx);

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate a DIAGRAM step for a worked example on "${ctx.topic}" (${ctx.gradeContext}).

${contextPrefix}

Describe a diagram with 2-5 labeled parts. The imagePrompt should describe a clean educational diagram.
Include a result — the key conclusion or expression derived from the diagram.${annotationPromptSuffix(ctx.pedagogicalGoal)}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: DIAGRAM_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Diagram generator returned empty');
  const data = JSON.parse(text);

  const labels = [];
  for (let i = 0; i < 5; i++) {
    const labelText = data[`label${i}Text`];
    const desc = data[`label${i}Desc`];
    if (labelText && desc) labels.push({ text: labelText, description: desc });
  }

  return {
    content: { type: 'diagram', imagePrompt: data.imagePrompt, altText: data.altText, labels },
    annotations: extractAnnotations(data),
    result: data.result,
  };
}

export const diagramPrimitive: PrimitiveDef = {
  id: 'diagram',
  whenToUse: 'A labeled figure or geometric setup. Renders as a generated image with callouts.',
  generate: generateDiagramStep,
  extractResult: (_c, explicit) => explicit ?? '',
};
