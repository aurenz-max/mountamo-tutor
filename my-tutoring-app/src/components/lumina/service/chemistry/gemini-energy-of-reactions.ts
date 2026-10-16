import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { resolveEvalModeConstraint, logEvalModeResolution, type ChallengeTypeDoc } from "../evalMode";
import type { EnergyOfReactionsData } from "../../primitives/visual-primitives/chemistry/EnergyOfReactions";
import {
  ENERGY_MODES, NAME_LEAKS, THERMO_REACTIONS, type EnergyMode,
} from "../../primitives/visual-primitives/chemistry/energyOfReactionsWorkspace";

// Re-export type for convenience (no redefinition — sourced from the component)
export type { EnergyOfReactionsData };

/**
 * Energy of Reactions generator. Gemini writes only the title, one sentence, and which library reactions the classify
 * items run (by id, a schema enum); every item, reading, diagram, bond table and key is built by code
 * (`energyOfReactionsWorkspace.ts`), so the schema carries no challenge, answer, ΔH or reaction type.
 */
const CHALLENGE_TYPE_DOCS: Record<EnergyMode, ChallengeTypeDoc> = {
  classify: {
    promptDoc: "classify: the learner runs each chosen reaction in a beaker of water and decides from the thermometer whether it releases or absorbs energy.",
    schemaDescription: "Thermometer evidence: releases or absorbs energy",
  },
  diagram: {
    promptDoc: "diagram: the learner reads unlabelled energy diagrams (code draws them).",
    schemaDescription: "Read an energy diagram",
  },
  bond_energy: {
    promptDoc: "bond_energy: the learner works out the energy change from a table of bond energies (code builds it).",
    schemaDescription: "Energy change from bond energies",
  },
};

const energyOfReactionsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short, engaging title for the lab (e.g. 'The Reaction Energy Lab'). Never say which reaction releases or absorbs energy." },
    description: { type: Type.STRING, description: "One kid-friendly sentence about the lab. Never say which reaction releases or absorbs energy." },
    reactionIds: {
      type: Type.ARRAY,
      description: "4-6 reaction ids from the list, the ones that best fit the topic, in the order to run them.",
      items: { type: Type.STRING, enum: THERMO_REACTIONS.map(r => r.id) },
    },
  },
  required: ["title", "description", "reactionIds"],
};

/** Determine the grade band from grade level context string */
const resolveGradeBand = (gradeLevel: string): "5-6" | "7-8" => {
  const gl = gradeLevel.toLowerCase();
  if (gl.includes("7") || gl.includes("8") || gl.includes("middle") || gl.includes("advanced")) return "7-8";
  return "5-6";
};

/**
 * Canonical-grade → band mapper (systemic 14m). Canonical grade wins when
 * present (below-range grades clamp to the 5-6 floor rung); null keeps the
 * prose fallback reachable (never deleted).
 */
export function energyOfReactionsGradeBandFromGrade(grade?: string): "5-6" | "7-8" | null {
  if (!grade) return null;
  const g = grade.trim().toUpperCase();
  if (g === "K") return "5-6";
  const n = parseInt(g, 10);
  if (isNaN(n)) return null;
  return n <= 6 ? "5-6" : "7-8";
}

/** Without the thermometer task the model still titles the reactions it picked; a title that names no asked task is replaced. */
const TASK_TITLE: Record<Exclude<EnergyMode, "classify">, [RegExp, string]> = {
  diagram: [/diagram|activation|catalyst|hill|enthalpy/i, "Reading Energy Diagrams"],
  bond_energy: [/bond|enthalpy/i, "Bond Energy Lab"],
};
function labTitle(title: string | undefined, modes: EnergyMode[]): string {
  if (modes.includes("classify")) return title || "The Energy Lab";
  const asked = modes.filter((m): m is Exclude<EnergyMode, "classify"> => m !== "classify");
  return title && asked.some(m => TASK_TITLE[m][0].test(title)) ? title : TASK_TITLE[asked[asked.length - 1]][1];
}

export const generateEnergyOfReactions = async (ctx: GenerationContext): Promise<EnergyOfReactionsData> => {
  const { topic } = ctx;
  const config = ctx.raw as Partial<EnergyOfReactionsData>;
  // Canonical objective grade wins; the prose parser is only the fallback (14m).
  const gradeBand = energyOfReactionsGradeBandFromGrade(ctx.grade) ?? resolveGradeBand(ctx.gradeContext);
  const constraint = resolveEvalModeConstraint("energy-of-reactions", ctx.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution("EnergyOfReactions", ctx.targetEvalMode, constraint);
  const modes: EnergyMode[] = constraint
    ? ENERGY_MODES.filter(m => constraint.allowedTypes.includes(m))
    : gradeBand === "7-8" ? ENERGY_MODES : ["classify", "diagram"];

  const intent = ctx.intent ? `\nLEARNING FOCUS: "${ctx.intent}". Choose reactions that serve it.` : "";
  const prompt = `Write the title and pick the reactions for an energy-of-reactions lab about "${topic}" for grades ${gradeBand}.${intent}

The learner will do these tasks (code builds every item):
${modes.map(m => `- ${CHALLENGE_TYPE_DOCS[m].promptDoc}`).join("\n")}

Reactions you can pick from (id: reaction):
${THERMO_REACTIONS.map(r => `- ${r.id}: ${r.words}`).join("\n")}

RULES:
1. Pick 4-6 ids that fit the topic (code uses them only for the thermometer task). Pick both reactions that warm the water and reactions that cool it.
2. The title and description are about the tasks listed above, not only the reactions (a bond-energy lab is about bonds breaking and forming).
3. The title and description must not say which reaction releases or absorbs energy, gets hot or gets cold.`;

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: energyOfReactionsSchema,
      systemInstruction: "You are an expert chemistry educator choosing classroom reactions for a lab on energy in reactions.",
    },
  });
  const text = response.text;
  if (!text) throw new Error("No data returned from Gemini API for energy-of-reactions");
  const result = JSON.parse(text) as Partial<EnergyOfReactionsData>;

  const known = new Set(THERMO_REACTIONS.map(r => r.id));
  const reactionIds = Array.from(new Set((Array.isArray(result.reactionIds) ? result.reactionIds : []).filter(id => known.has(id))));
  // The description is not drawn during an item, but it reaches the manifest's intro: drop one that names a kind.
  const description = result.description && !NAME_LEAKS.test(result.description) ? result.description : undefined;

  const data: EnergyOfReactionsData = {
    title: labTitle(result.title?.trim(), modes),
    description,
    reactionIds: reactionIds.length ? reactionIds : THERMO_REACTIONS.map(r => r.id),
    challengeTypes: modes,
    gradeBand,
    ...(config.title !== undefined ? { title: config.title } : {}),
    ...(config.reactionIds !== undefined ? { reactionIds: config.reactionIds } : {}),
    ...(config.gradeBand !== undefined ? { gradeBand: config.gradeBand } : {}),
  };
  console.log("⚡ Energy of Reactions Generated:", { title: data.title, gradeBand: data.gradeBand, modes, reactions: data.reactionIds });
  return data;
};
