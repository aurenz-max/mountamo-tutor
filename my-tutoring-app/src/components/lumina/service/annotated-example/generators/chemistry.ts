/**
 * Chemistry primitive — Bohr atoms and ions, Lewis structures, the periodic table.
 *
 * The model names which species to draw (element + charge) and, for a Lewis
 * structure, which atoms are bonded. Code computes every count from the
 * element table and rejects a Lewis atom without a full outer shell
 * (chemFigure.ts), so the figure cannot contradict the chemistry.
 */

import { Type, ThinkingLevel, type Schema } from '@google/genai';
import { ai } from '../../geminiClient';
import { parseChemFigure } from '../../../primitives/annotated-example/chemFigure';
import { generateVerifiedStep } from '../content-review';
import type { ChemistryStepContent, StepAnnotations } from '../../../primitives/annotated-example/types';
import {
  ANNOTATIONS_SCHEMA_FIELDS,
  ANNOTATIONS_REQUIRED,
  annotationPromptSuffix,
  buildStepContextPrefix,
  extractAnnotations,
  type PrimitiveDef,
  type StepGeneratorContext,
} from './_shared';

const S = { type: Type.STRING };
const I = { type: Type.INTEGER };
const obj = (properties: Record<string, Schema>): Schema => ({ type: Type.OBJECT, properties, required: Object.keys(properties) });

const CHEMISTRY_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    view: { type: Type.STRING, enum: ['atoms', 'lewis', 'periodic'] },
    species: { type: Type.ARRAY, items: obj({ id: S, element: S, charge: I, massNumber: I }) },
    bonds: { type: Type.ARRAY, items: obj({ a: S, b: S, order: I }) },
    transfers: { type: Type.ARRAY, items: obj({ from: S, to: S, electrons: I }) },
    showValence: { type: Type.BOOLEAN },
    highlight: { type: Type.ARRAY, items: S },
    trend: { type: Type.STRING, enum: ['none', 'electronegativity', 'atomic-radius', 'valence-electrons'] },
    caption: { type: Type.STRING, description: 'One short line under the figure. Must not state a value the student has not been shown yet.' },
    altText: S,
    result: { type: Type.STRING, description: 'What this move establishes, as a short phrase' },
    ...ANNOTATIONS_SCHEMA_FIELDS,
  },
  required: ['view', 'species', 'bonds', 'transfers', 'showValence', 'highlight', 'trend', 'caption', 'altText', 'result', ...ANNOTATIONS_REQUIRED],
};

async function generateChemistryStep(ctx: StepGeneratorContext): Promise<{ content: ChemistryStepContent; annotations: StepAnnotations; result: string }> {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: `Generate a CHEMISTRY step for a worked example on "${ctx.topic}" (${ctx.gradeContext}).

${buildStepContextPrefix(ctx)}

Code draws the figure and computes every number in it from the element table: protons, neutrons, electrons, shells and lone pairs. You only choose what to draw. Elements H to Kr only.
- view "atoms": Bohr models side by side (1-3). species: each atom or ion as { id, element symbol, charge, massNumber (0 = most common) }. Na is charge 0; the sodium ion is charge 1; chloride is element Cl, charge -1. showValence true rings the outer shell. transfers: arrows that move electrons from one drawn species to another, e.g. { from: "na", to: "cl", electrons: 1 }, drawn on the atoms BEFORE the transfer (both neutral); the ions after the transfer belong in the next move.
- view "lewis": species are the atoms; bonds join their ids with order 1, 2 or 3. Lone pairs are computed. Every atom must end with a full outer shell (8, or 2 for H), so choose bond orders that do this (O=C=O, N≡N). An ionic compound is drawn as separate ions with charges and no bonds. Ids: o1, h1, h2...
- view "periodic": highlight lists element symbols to pick out; trend draws an arrow ("electronegativity", "atomic-radius") or the valence-electron count under each main-group column ("valence-electrons"). species empty.
Arrays a view does not use are empty. showValence is false outside atoms.
Draw only what the student knows at this move. A value or structure found in a later move is not drawn yet.${annotationPromptSuffix(ctx.pedagogicalGoal)}`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: CHEMISTRY_SCHEMA,
    },
  });
  const raw = response.text;
  if (!raw) throw new Error('Chemistry generator returned empty');
  const data = JSON.parse(raw);
  const figure = parseChemFigure(data);
  return {
    content: { type: 'chemistry', figure, caption: String(data.caption ?? ''), altText: String(data.altText ?? '') },
    annotations: extractAnnotations(data),
    result: String(data.result ?? ''),
  };
}

export const chemistryPrimitive: PrimitiveDef = {
  id: 'chemistry',
  whenToUse: 'A chemistry figure drawn by code from the element table: Bohr models of atoms and ions with electron-transfer arrows (view atoms), Lewis structures with bonds and computed lone pairs (view lewis), or the periodic table H-Kr with highlighted elements and a trend (view periodic). Code computes every proton, neutron, electron, shell and lone-pair count and rejects a Lewis atom without a full outer shell. Use it for atoms, ions, electron shells, valence electrons, periodic trends and bonding.',
  // parseChemFigure computed every count, so a review that times out does not discard the figure.
  generate: (ctx) => generateVerifiedStep(ctx, generateChemistryStep, { keepOnReviewTimeout: true }),
  extractResult: (_c, explicit) => explicit ?? '',
};
