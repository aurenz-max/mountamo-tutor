import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  resolveEvalModes,
  constrainChallengeTypeEnum,
  buildModeConstraintSection,
  type ChallengeTypeDoc,
} from "../evalMode";
import {
  MatterExplorerData,
  MatterObject,
  MatterChallenge,
} from "../../primitives/visual-primitives/chemistry/MatterExplorer";
// The judged pack's build gates, IMPORTED rather than re-implemented. Two
// hand-synced copies of a leak rule drift — letter-spotter's two sides of the
// wire disagreed live on what a sayable sentence was until the copies were
// deleted — so the generator consumes exactly what `itemFromChallenge` will
// enforce, and a payload that would be dropped build-side is never emitted.
import {
  nameCarriesAnswer,
  gasNamesItsVessel,
  isMatterState,
  isShapeBehaviour,
  changeFitsObject,
  isEverydayChange,
  STATE_OF_SHAPE,
} from "../../primitives/visual-primitives/chemistry/matterExplorerScript";

// Re-export types for convenience (no redefinition — sourced from the component)
export type { MatterExplorerData, MatterObject, MatterChallenge };

/**
 * Schema definition for Matter Explorer Data
 *
 * Describes the JSON structure Gemini must return:
 * - title & description for the activity
 * - objects: everyday items with state & observable properties
 * - challenges: sequenced tasks (sort → describe → predict/mystery)
 * - showOptions: UI toggles
 * - gradeBand: K-1 or 1-2
 */
/**
 * THE THREE TASK IDENTITIES, in the words the prompt uses.
 *
 * These exist because the eval-mode pin was DEAD for this generator: nothing
 * read `ctx.targetEvalMode`, so a lesson that asked for `sort` got a mix of
 * all three and the IRT betas in the catalog were routing to nothing. Found by
 * driving `--eval-mode sort` and watching all three modes come back.
 *
 * Keep each doc a description of the TASK, never of the answer. The fast-fact
 * repair (2026-09-02) is the standing warning here: an unconditional block a
 * few lines below the constraint handed back the very identity the constraint
 * had just excluded, and the enum meant the stamp was the only thing the
 * constraint ever reached.
 */
const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  sort: {
    promptDoc:
      'sort: the tutor names the object and the child says whether it is a solid, a liquid or a gas.',
    schemaDescription: 'say whether the named object is a solid, liquid or gas',
  },
  property: {
    promptDoc:
      'property: the tutor names the object and the child says what it DOES in a cup — keeps its own shape, takes the cup\'s shape, or spreads out and fills the room. The observation that comes before naming the state.',
    schemaDescription: 'say what the named object does when it goes into a cup',
  },
  change: {
    promptDoc:
      'change: the tutor says what HAPPENED to the object — it melted, it was cooked, it was torn — and the child says whether it can go back the way it was or is changed for ever. The object MUST carry an `everydayChange` that fits it (rules 12 and 12a); a challenge naming an object without one is discarded.',
    schemaDescription: 'say whether the change to the named object can be undone',
  },
  mystery: {
    promptDoc:
      'mystery: the object\'s name is WITHHELD from the child and only its look, feel and weight are given as clues; the child says what state it is. Pick objects with at least two vivid observable properties.',
    schemaDescription: 'name the state of a withheld object from observable clues',
  },
};

const matterExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Short, engaging title for the activity (e.g. 'Kitchen Matter Hunt')",
    },
    description: {
      type: Type.STRING,
      description: "One-sentence activity description in kid-friendly language",
    },
    objects: {
      type: Type.ARRAY,
      // BOUNDED. `gemini-flash-lite-latest` truncates mid-object on an
      // unbounded array and `JSON.parse` then throws, which the click era's
      // catch turned into a hard failure with no diagnosis. Bound the arrays
      // FIRST, then set the ceiling (defect class 10).
      minItems: "6",
      maxItems: "8",
      description: "6-8 everyday objects for the student to explore and classify",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier, e.g. 'obj-ice-cube'",
          },
          name: {
            type: Type.STRING,
            description: "Common name kids would use (e.g. 'ice cube', 'juice')",
          },
          state: {
            type: Type.STRING,
            enum: ["solid", "liquid", "gas"],
            description: "Primary state of matter at room temperature",
          },
          properties: {
            type: Type.OBJECT,
            properties: {
              color: {
                type: Type.STRING,
                description: "Observable color of the object",
              },
              texture: {
                type: Type.STRING,
                enum: ["smooth", "rough", "bumpy", "soft", "hard"],
              },
              transparency: {
                type: Type.STRING,
                enum: ["transparent", "translucent", "opaque"],
              },
              flexibility: {
                type: Type.STRING,
                enum: ["rigid", "flexible", "flows"],
              },
              shape: {
                type: Type.STRING,
                enum: ["keeps_shape", "takes_container", "fills_space"],
              },
              weight: {
                type: Type.STRING,
                enum: ["light", "medium", "heavy"],
              },
            },
            required: ["color", "texture", "transparency", "flexibility", "shape", "weight"],
          },
          imagePrompt: {
            type: Type.STRING,
            description: "Short prompt for generating a real-world photo of this object",
          },
          canChangeState: {
            type: Type.BOOLEAN,
            description: "Whether the object can change state with temperature (e.g. ice melts)",
          },
          everydayChange: {
            type: Type.STRING,
            enum: ["melt", "freeze", "boil_to_steam", "cook", "bake", "burn", "tear", "rust"],
            description:
              "The ONE everyday change that really happens to THIS object. melt/freeze/boil_to_steam are only for objects with canChangeState=true; cook/bake/burn/tear/rust only for objects with canChangeState=false. Omit when nothing on the list truly fits. Whether the change can be undone is decided in code — never say it here.",
          },
          stateChangeTemp: {
            type: Type.NUMBER,
            description: "Temperature in °C at which state change occurs (only if canChangeState is true)",
          },
        },
        required: ["id", "name", "state", "properties", "canChangeState"],
      },
    },
    challenges: {
      type: Type.ARRAY,
      // The enum is now the THREE EVAL-MODE IDENTITIES and nothing else. The
      // old five (`describe`/`predict`/`compare`) carried no judgeable answer
      // at all — the component scored predict and compare `correct: true`
      // unconditionally and completed describe on a click — while `property`,
      // which the catalog declared and weighted, was never emitted. Legacy
      // cached payloads still normalize through `normalizeChallengeType`.
      minItems: "3",
      maxItems: "6",
      description:
        "3-6 judged challenges. Each one names ONE object by its id and asks a single question about it.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge identifier",
          },
          type: {
            type: Type.STRING,
            enum: ["sort", "property", "change", "mystery"],
            description:
              "sort = say whether it is a solid, liquid or gas; property = say what it does in a cup; change = say whether the everyday change that happened to it can be undone; mystery = the same as sort, but the object's name is withheld and only clues are given",
          },
          objectId: {
            type: Type.STRING,
            description:
              "The id of the object in `objects` this challenge is about. MUST match one exactly.",
          },
          instruction: {
            type: Type.STRING,
            description: "Kid-friendly instruction for this challenge",
          },
          narration: {
            type: Type.STRING,
            description: "Wonder-driven narration text to spark curiosity",
          },
        },
        // `targetAnswer` and `hint` are GONE from the required set. The answer
        // is computed in code from the object's own `state` and
        // `properties.shape`; an LLM free-text key was what the click era
        // substring-matched a typed guess against.
        required: ["id", "type", "objectId", "instruction", "narration"],
      },
    },
    showOptions: {
      type: Type.OBJECT,
      description: "Which UI panels to enable for this activity",
      properties: {
        showPropertyPanel: {
          type: Type.BOOLEAN,
          description: "Show the property inspection panel when an object is selected",
        },
        showTemperatureSlider: {
          type: Type.BOOLEAN,
          description: "Show the temperature slider for state-change exploration",
        },
        showParticleView: {
          type: Type.BOOLEAN,
          description: "Show animated particle view of matter states",
        },
        showVennDiagram: {
          type: Type.BOOLEAN,
          description: "Show Venn diagram for comparing objects",
        },
      },
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["K-1", "1-2"],
      description: "Target grade band for content complexity",
    },
  },
  required: ["title", "description", "objects", "challenges", "showOptions", "gradeBand"],
};

/**
 * Generate Matter Explorer data using Gemini
 *
 * Creates an interactive matter classification activity for K-2 students with:
 * - Everyday objects to sort into solid / liquid / gas
 * - Observable properties to explore
 * - Temperature-based state change exploration
 * - Mystery material challenges
 *
 * @param topic - The topic or theme for the activity (e.g. "kitchen items", "playground")
 * @param gradeLevel - Grade level context string
 * @param config - Optional config with intent override
 * @returns MatterExplorerData ready for the MatterExplorer component
 */
/**
 * Canonical-grade → band mapper (systemic 14m; found during the sweep — the
 * inline bare-"k" prose test below inverts middle/high-school prose
 * ("thinking") to K-1 and lands K correctly only by accident). Canonical grade
 * wins when present; null keeps the prose fallback reachable (never deleted).
 */
export function matterExplorerGradeBandFromGrade(grade?: string): "K-1" | "1-2" | null {
  if (!grade) return null;
  const g = grade.trim().toUpperCase();
  if (g === "K") return "K-1";
  const n = parseInt(g, 10);
  if (isNaN(n)) return null;
  return n <= 1 ? "K-1" : "1-2";
}

export const generateMatterExplorer = async (ctx: GenerationContext): Promise<MatterExplorerData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const intent = ctx.intent || "";

  // ── Resolve the eval mode from the catalog (single source of truth) ──
  // The pin narrows the schema ENUM as well as the prose, which is what makes
  // it binding: prose alone loses, and the catalog's four betas are only a
  // difficulty ladder if a pinned lesson actually gets that one identity.
  //
  // The pin-only resolver this replaced could not route the fourth mode from a
  // LESSON: an objective about changes that can and cannot be undone arrived
  // with no pin, and an unrouted session generates all four identities. Which
  // was tolerable while the other three were one topic; it is not, now that one
  // of them is the only home for a different K-2 standard.
  const resolution = await resolveEvalModes(
    "matter-explorer",
    { targetEvalMode: ctx.targetEvalMode, intent, objectiveText: ctx.objective?.text },
    CHALLENGE_TYPE_DOCS,
  );
  const activeSchema = resolution
    ? constrainChallengeTypeEnum(
        matterExplorerSchema,
        resolution.allowedTypes,
        CHALLENGE_TYPE_DOCS,
      )
    : matterExplorerSchema;
  const challengeTypeSection = buildModeConstraintSection(resolution, CHALLENGE_TYPE_DOCS);
  // ...and when the mode is not in play the FIELD goes too. Scoping the prose
  // alone left the schema property standing, and a pinned `sort` probe filled
  // it in anyway (a rock that "tears"). An unasked-for field is answered; a
  // field that is not there cannot be.
  if (resolution && !resolution.allowedTypes.includes("change")) {
    const objectProps = (activeSchema.properties?.objects as Schema | undefined)?.items?.properties;
    if (objectProps) delete objectProps.everydayChange;
  }
  // The change rules are SCOPED to sessions that can actually ask a change.
  // Left unscoped they were answered anyway: a pinned `sort` probe came back
  // with `everydayChange: "burn"` on a ROCK -- harmless there, since nothing
  // reads the field, but it is a nonsense pairing sitting in the payload
  // waiting for a mixed session to draw it, and no code gate can see it
  // (a rock IS a solid that does not change state, so `burn` fits the shape).
  // Not asking is the lever; a fourth paragraph about rocks is not.
  const allowsChange = !resolution || resolution.allowedTypes.includes("change");
  const changeRulesSection = allowsChange ? `12. EVERYDAY CHANGE — only for objects where one of these really happens. Set "everydayChange" to
   exactly one key, and the object's own fields must match, or the item is discarded in code:
   - melt (a solid that melts: ice, butter, chocolate, snow) — canChangeState MUST be true
   - freeze (a liquid that freezes: water, juice, milk) — canChangeState MUST be true
   - boil_to_steam (a liquid heated until it steams: water) — canChangeState MUST be true
   - cook (an egg, meat, a raw vegetable) — canChangeState MUST be false
   - bake (bread dough, cake batter, clay) — canChangeState MUST be false
   - burn (paper, wood, toast, a candle) — canChangeState MUST be false
   - tear (paper, a leaf, cloth) — canChangeState MUST be false
   - rust (a nail, a bike chain, a metal tin) — canChangeState MUST be false
12a. PICK THE CHANGE THAT REALLY HAPPENS TO THAT OBJECT. Rocks do not burn, wood does not rust,
   water is not baked. A change that does not fit its object is discarded and the challenge that
   named it goes with it, so a session can come back short.
12b. BALANCE THE CHANGE CHALLENGES. When you write change challenges, at least two must name an
   object with canChangeState=true and at least two must name an object with canChangeState=false
   (so give at least two objects of each kind a change). A change session drawn mostly from one
   kind teaches a child to say one answer every time and scores them right for it.
12c. NEVER say in any field whether a change can be undone, and never use the words "reversible",
   "irreversible", "back" or "for ever" in a name, instruction or narration. That IS the question.` : "";

  console.log(
    `🔬 Matter Explorer modes: ${resolution ? `${resolution.modes.map((m) => m.evalMode).join("+")} (${resolution.source})` : "mixed"}`,
  );

  // Canonical objective grade wins; the prose parser is only the fallback (14m).
  const canonicalBand = matterExplorerGradeBandFromGrade(ctx.grade);
  const gradeBand = canonicalBand ?? (gradeLevel.toLowerCase().includes("k") ||
    gradeLevel.toLowerCase().includes("kindergarten")
    ? "K-1"
    : "1-2");

  const generationPrompt = `Create a Matter Explorer activity about "${topic}" for ${gradeBand === "K-1" ? "Kindergarten to 1st grade" : "1st to 2nd grade"} students.
${intent ? `\nTeaching intent: ${intent}` : ""}

REQUIREMENTS:
1. Choose 6-8 everyday objects kids can see and touch (ice, water, air, rock, milk, balloon, sand, honey, juice, steam, etc.).
2. Include a good mix: at least 2 solids, 2 liquids, and 1-2 gases.
2a. NAME THE GAS ITSELF, NEVER THE CONTAINER THAT HOLDS IT. Choose gases from this menu and
   nothing else: air, steam, breath, smoke, fog, mist, helium. "inflated balloon" and "fizzy
   bottle" are WRONG — the balloon is rubber and the bottle is glass; it is the air inside that
   is the gas. This was caught live: the tutor said "the inflated balloon spreads out and fills
   the whole room", which is false out loud however reasonable it looked in a data field.
2b. Every object name is SINGULAR and takes "is" ("sandbox sand", not "sandbox grains"). The
   tutor says "the NAME is a solid" aloud, and a plural name makes that sentence ungrammatical.
3. For K-1: stick to obvious examples (rock=solid, water=liquid, air=gas).
   For 1-2: include 1-2 trickier materials (honey, sand, toothpaste, fog) that challenge assumptions.
4. At least 2 objects should have canChangeState=true with realistic stateChangeTemp values (e.g. water freezes at 0°C, butter melts around 32°C).
5. Every challenge names ONE object by its objectId, and that id MUST appear in the objects list.
6. Provide 3-6 challenges. Use each object at most once — the activity asks about an object a single time.
   ${challengeTypeSection}
7. NEVER put the words "solid", "liquid", "gas", "flows" or "pours" in an object's NAME. A name like
   "liquid soap" or "solid chocolate" answers its own question out loud and the challenge is discarded.
8. The properties.shape field MUST agree with state: keeps_shape for a solid, takes_container for a liquid,
   fills_space for a gas. A disagreement makes the item unaskable and it is discarded.
9. Every imagePrompt should describe a real-world photo of the object that a young child would recognise.
10. Every narration field should be wonder-driven and spark curiosity (e.g. "I wonder what would happen if we heated the ice cube?").
11. Set showOptions appropriately:
   - showPropertyPanel: always true
   - showTemperatureSlider: true if any object has canChangeState
   - showParticleView: true only for grade 1-2
   - showVennDiagram: true only if a compare challenge is included
   
${changeRulesSection}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        // Set AFTER bounding the arrays, never instead of it. 8192 is a
        // non-thinking number and is safe here because this model does not
        // share the budget with a reasoning trace — the arrays above are what
        // actually keeps the payload inside it.
        maxOutputTokens: 8192,
        systemInstruction:
          "You are an expert early-childhood science educator creating interactive matter-classification activities for Kindergarten through 2nd grade. " +
          "Use simple, wonder-filled language. Choose objects children encounter daily — in the kitchen, playground, bathroom, or outdoors. " +
          "Properties must be physically accurate. State classifications must be scientifically correct (sand is a solid even though it pours). " +
          "Narration should model scientific thinking: observing, comparing, predicting. " +
          "Always sequence challenges from easiest (sort) to hardest (mystery/compare).",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API for matter-explorer");
    }

    const result = JSON.parse(text) as MatterExplorerData;

    // -----------------------------------------------------------------------
    // Validation & Defaults
    // -----------------------------------------------------------------------

    // Ensure gradeBand. With a canonical grade the band is NOT the LLM's
    // choice — code stamps it (14m); the backstop only fixes invalid stamps
    // on the legacy no-grade path.
    if (canonicalBand) {
      result.gradeBand = canonicalBand;
    } else if (!result.gradeBand || !["K-1", "1-2"].includes(result.gradeBand)) {
      result.gradeBand = gradeBand as "K-1" | "1-2";
    }

    // Ensure showOptions defaults
    result.showOptions = {
      showPropertyPanel: result.showOptions?.showPropertyPanel ?? true,
      showTemperatureSlider:
        result.showOptions?.showTemperatureSlider ??
        result.objects?.some((o) => o.canChangeState) ??
        false,
      showParticleView: result.showOptions?.showParticleView ?? false,
      showVennDiagram: result.showOptions?.showVennDiagram ?? false,
    };

    // Ensure every object has required fields with safe defaults
    if (result.objects) {
      result.objects = result.objects.map((obj, idx) => ({
        ...obj,
        id: obj.id || `obj-${idx}`,
        canChangeState: obj.canChangeState ?? false,
        stateChangeTemp: obj.canChangeState ? (obj.stateChangeTemp ?? null) : null,
        properties: {
          color: obj.properties?.color ?? "unknown",
          texture: obj.properties?.texture ?? "smooth",
          transparency: obj.properties?.transparency ?? "opaque",
          flexibility: obj.properties?.flexibility ?? "rigid",
          shape: obj.properties?.shape ?? "keeps_shape",
          weight: obj.properties?.weight ?? "medium",
        },
      }));
    }

    // -----------------------------------------------------------------------
    // KEEP-OR-DROP, never backfill. A placeholder object in a judged loop
    // becomes a spoken ask the tutor must judge with no defensible answer
    // behind it, so an object that fails a gate is REMOVED and the challenges
    // that referenced it go with it. The gates are the pack's own, imported.
    // -----------------------------------------------------------------------
    const rejected: string[] = [];
    result.objects = (result.objects ?? []).filter((obj) => {
      const why =
        !obj.name?.trim() ? "empty name"
          : nameCarriesAnswer(obj.name) ? "name carries its own answer"
            : gasNamesItsVessel(obj.name, obj.state) ? "gas named after its vessel"
            : !isMatterState(obj.state) ? `unknown state "${obj.state}"`
              : !isShapeBehaviour(obj.properties?.shape) ? `unknown shape "${obj.properties?.shape}"`
                : STATE_OF_SHAPE[obj.properties.shape] !== obj.state
                  ? `shape "${obj.properties.shape}" disagrees with state "${obj.state}"`
                  : null;
      if (why) rejected.push(`${obj.name || obj.id}: ${why}`);
      return why === null;
    });

    // The change mode's fit gate, run from the pack's OWN predicate. A change
    // that does not belong to its object is CLEARED rather than dropping the
    // object: the object is still perfectly askable in the other three modes,
    // and the `change` challenges pointing at it drop just below. (Keep-or-drop
    // applies to the ITEM; here the unaskable thing is one field.)
    for (const obj of result.objects) {
      const declared = obj.everydayChange;
      if (declared === undefined) continue;
      if (!isEverydayChange(declared) || !changeFitsObject(declared, obj)) {
        rejected.push(
          `${obj.name}: change "${declared}" does not fit (state ${obj.state}, canChangeState ${obj.canChangeState})`,
        );
        delete obj.everydayChange;
      }
    }

    const liveIds = new Set(result.objects.map((o) => o.id));
    const changeableIds = new Set(
      result.objects.filter((o) => o.everydayChange !== undefined).map((o) => o.id),
    );
    result.challenges = (result.challenges ?? [])
      .map((ch, idx) => ({
        ...ch,
        id: ch.id || `challenge-${idx}`,
        narration: ch.narration || ch.instruction || "",
      }))
      .filter((ch) => !ch.objectId || liveIds.has(ch.objectId))
      // A change challenge whose object carries no usable change has no answer
      // behind it at all — `itemFromChallenge` would return null and the
      // session would silently come back one item shorter than it looks.
      .filter((ch) => ch.type !== "change" || (ch.objectId ? changeableIds.has(ch.objectId) : changeableIds.size > 0));

    if (rejected.length) {
      console.warn("🔬 Matter Explorer dropped objects:", rejected);
    }

    console.log("🔬 Matter Explorer Generated:", {
      title: result.title,
      gradeBand: result.gradeBand,
      objectCount: result.objects?.length ?? 0,
      challengeCount: result.challenges?.length ?? 0,
      withEverydayChange: changeableIds.size,
      hasTemperatureSlider: result.showOptions.showTemperatureSlider,
    });

    return result;
  } catch (error) {
    console.error("Error generating matter explorer data:", error);
    throw error;
  }
};
