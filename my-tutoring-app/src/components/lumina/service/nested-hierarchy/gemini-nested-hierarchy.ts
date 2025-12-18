import { Type, Schema, ThinkingLevel } from "@google/genai";
import { ai } from "../geminiClient";
import type { NestedHierarchyData } from "./types";

/**
 * Generate Nested Hierarchy visualization
 *
 * Creates an interactive hierarchical tree structure for exploring systems,
 * taxonomies, or organizational structures.
 *
 * @param topic - The topic being visualized
 * @param gradeContext - Educational context for the target audience
 * @param intent - The specific intent/purpose of this hierarchy
 */
export const generateNestedHierarchy = async (
  topic: string,
  gradeContext: string,
  intent?: string
): Promise<NestedHierarchyData> => {
  // Define the recursive node structure
  // We need to manually define multiple levels to satisfy Gemini's schema validation
  const nodePropertiesLevel3 = {
    id: { type: Type.STRING },
    label: { type: Type.STRING },
    type: { type: Type.STRING },
    icon: {
      type: Type.STRING,
      enum: ["activity", "brain", "zap", "git-commit", "layers", "home"]
    },
    description: { type: Type.STRING },
    children: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          label: { type: Type.STRING },
          type: { type: Type.STRING },
          icon: {
            type: Type.STRING,
            enum: ["activity", "brain", "zap", "git-commit", "layers", "home"]
          },
          description: { type: Type.STRING }
        },
        required: ["id", "label", "icon", "description"]
      }
    }
  };

  const nodePropertiesLevel2 = {
    id: { type: Type.STRING },
    label: { type: Type.STRING },
    type: { type: Type.STRING },
    icon: {
      type: Type.STRING,
      enum: ["activity", "brain", "zap", "git-commit", "layers", "home"]
    },
    description: { type: Type.STRING },
    children: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: nodePropertiesLevel3,
        required: ["id", "label", "icon", "description"]
      }
    }
  };

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "Title of the hierarchical system"
      },
      description: {
        type: Type.STRING,
        description: "Brief overview of the system"
      },
      root_node: {
        type: Type.OBJECT,
        description: "The root node of the hierarchy - must be a complete recursive tree structure",
        properties: {
          id: { type: Type.STRING },
          label: { type: Type.STRING },
          type: { type: Type.STRING },
          icon: {
            type: Type.STRING,
            enum: ["activity", "brain", "zap", "git-commit", "layers", "home"]
          },
          description: { type: Type.STRING },
          children: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: nodePropertiesLevel2,
              required: ["id", "label", "icon", "description"]
            },
            description: "Array of child nodes - each with same recursive structure"
          }
        },
        required: ["id", "label", "icon", "description"]
      },
      defaultExpanded: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Array of node IDs that should be expanded by default"
      }
    },
    required: ["title", "root_node"]
  };

  const prompt = `You are generating a Nested Hierarchy visualization. The student will explore a hierarchical system by clicking through nodes in a tree structure, seeing detailed information about each component.

CONTEXT:
- Topic: ${topic}
- Target Audience: ${gradeContext}
${intent ? `- Intent: ${intent}` : ''}

## Design Principles

1. **Clear Hierarchy Levels**: Organize the system into logical levels (e.g., System → Subsystem → Component → Subcomponent)

2. **Balanced Tree**: Aim for 2-4 children per node where possible. Avoid single-child nodes unless structurally necessary.

3. **Meaningful Descriptions**: Each node's description should:
   - Explain what this component does/is
   - Clarify its role in the larger system
   - Be 1-3 sentences, clear and informative

4. **Type Labels**: Use consistent type labels across the same level (e.g., all level-2 nodes might be "Subsystem", level-3 "Component")

5. **Icon Selection**: Choose icons that visually represent the node's function:
   - "activity": General activity, processes, actions
   - "brain": Cognitive functions, control centers, decision-making
   - "zap": Energy, electrical, fast processes
   - "git-commit": Connections, pathways, transmission
   - "layers": Structural layers, organization
   - "home": Root, foundation, central hub

6. **Depth**: Aim for 3-4 levels deep. Too shallow (1-2 levels) lacks detail; too deep (5+ levels) overwhelms.

7. **Default Expanded**: Include the root node ID and 1-2 key subsystem IDs to give students a good starting view.

## Example Structure

For "The Human Nervous System":
- Root: "Human Nervous System" (id: "nervous-system", type: "System", icon: "brain")
  - Level 1: "Central Nervous System" (id: "cns", type: "Division", icon: "brain")
    - Level 2: "Brain" (id: "brain", type: "Organ", icon: "brain")
      - Level 3: "Cerebrum" (id: "cerebrum", type: "Region", icon: "brain")
      - Level 3: "Cerebellum" (id: "cerebellum", type: "Region", icon: "activity")
      - Level 3: "Brain Stem" (id: "brainstem", type: "Region", icon: "git-commit")
    - Level 2: "Spinal Cord" (id: "spinal-cord", type: "Organ", icon: "git-commit")
  - Level 1: "Peripheral Nervous System" (id: "pns", type: "Division", icon: "layers")
    - Level 2: "Somatic" (id: "somatic", type: "Subdivision", icon: "activity")
    - Level 2: "Autonomic" (id: "autonomic", type: "Subdivision", icon: "zap")
      - Level 3: "Sympathetic" (id: "sympathetic", type: "Branch", icon: "zap")
      - Level 3: "Parasympathetic" (id: "parasympathetic", type: "Branch", icon: "home")

defaultExpanded: ["nervous-system", "cns", "pns"]

## Output Requirements

Generate a complete hierarchical tree structure with:
- 1 root node
- 2-5 main branches (children of root)
- Each branch developed to 2-3 additional levels
- Total of 8-20 nodes across the entire tree
- Descriptive content for each node
- Logical type progressions (System → Subsystem → Component)
- All node IDs should be kebab-case (e.g., "light-reactions", "calvin-cycle")

IMPORTANT: Keep the tree depth to a maximum of 4 levels to match the schema structure.

Return ONLY valid JSON matching the schema.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MEDIUM,
        },
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const result = response.text ? JSON.parse(response.text) : null;

    if (!result) {
      throw new Error('No data returned from Gemini API');
    }

    console.log('🌳 Nested Hierarchy Generated from dedicated service:', result);
    return result as NestedHierarchyData;
  } catch (error) {
    console.error('Error generating nested hierarchy:', error);
    throw error;
  }
};
