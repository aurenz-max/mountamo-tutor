import { Type, Schema, ThinkingLevel } from "@google/genai";

import {

  ExhibitManifest,
  ComponentDefinition,
} from ".../types";

import { ai } from "../geminiClient";

/**
 * Convert grade level to descriptive educational context for prompts
 */
const getGradeLevelContext = (gradeLevel: string): string => {
  const contexts: Record<string, string> = {
    'toddler': 'toddlers (ages 1-3) - Use very simple language, basic concepts, concrete examples, and playful engagement. Focus on sensory experiences and foundational learning.',
    'preschool': 'preschool children (ages 3-5) - Use simple sentences, colorful examples, storytelling, and hands-on concepts. Build curiosity and wonder.',
    'kindergarten': 'kindergarten students (ages 5-6) - Use clear language, relatable examples, foundational skills, and engaging visuals. Encourage exploration and basic problem-solving.',
    'elementary': 'elementary students (grades 1-5) - Use age-appropriate vocabulary, concrete examples, structured learning objectives, and interactive elements. Build fundamental understanding.',
    'middle-school': 'middle school students (grades 6-8) - Use more complex vocabulary, abstract concepts, real-world applications, and critical thinking opportunities. Encourage deeper analysis.',
    'high-school': 'high school students (grades 9-12) - Use advanced vocabulary, sophisticated concepts, academic rigor, and college-prep content. Foster analytical and creative thinking.',
    'undergraduate': 'undergraduate college students - Use academic language, theoretical frameworks, research-based content, and interdisciplinary connections. Promote scholarly engagement.',
    'graduate': 'graduate students (Master\'s level) - Use specialized terminology, advanced theoretical concepts, research methodologies, and professional applications. Encourage critical scholarship.',
    'phd': 'doctoral students and researchers - Use expert-level terminology, cutting-edge research, theoretical depth, and scholarly discourse. Foster original thinking and research contributions.'
  };

  return contexts[gradeLevel] || contexts['elementary'];
};


// ============================================================================
// MANIFEST-FIRST ARCHITECTURE
// ============================================================================

/**
 * Universal Catalog - All available components for manifest generation
 */
export const UNIVERSAL_CATALOG: ComponentDefinition[] = [
  {
    id: 'curator-brief',
    description: 'Introduction, learning objectives, and hook. REQUIRED: Always include this first.',
    constraints: 'Must be first component'
  },
  {
    id: 'concept-card-grid',
    description: 'A set of 3-4 distinct key terms or concepts defined with visuals. Use for vocabulary or core principles.'
  },
  {
    id: 'bar-model',
    description: 'Comparative bar visualization showing relative values. Perfect for comparing quantities, showing differences, or teaching basic arithmetic comparisons. ESSENTIAL for elementary math.',
    constraints: 'Requires numeric values to compare'
  },
  {
    id: 'number-line',
    description: 'Interactive number line with highlighted points. Perfect for teaching addition, subtraction, counting, number sequencing, and basic operations. ESSENTIAL for toddlers/kindergarten/elementary math.',
    constraints: 'Requires numeric range and values to highlight'
  },
  {
    id: 'base-ten-blocks',
    description: 'Place value visualization using hundreds, tens, and ones blocks. Perfect for teaching place value, decomposing numbers, and understanding multi-digit numbers. ESSENTIAL for elementary math.',
    constraints: 'Requires a whole number to decompose (best for numbers 1-999)'
  },
  {
    id: 'fraction-circles',
    description: 'Visual pie charts showing fractional parts. Perfect for teaching fractions, parts of a whole, equivalent fractions, and basic fraction comparison. ESSENTIAL for elementary math.',
    constraints: 'Requires fraction values (numerator/denominator)'
  },
  {
    id: 'geometric-shape',
    description: 'Interactive geometric shape with labeled properties. Perfect for teaching shape properties, perimeter, area, angles, vertices, and spatial reasoning. ESSENTIAL for elementary geometry.',
    constraints: 'Requires a shape name and measurable properties'
  },
  {
    id: 'graph-board',
    description: 'Interactive polynomial graphing board where users plot points and visualize fitted polynomial curves. Use for algebra, functions, data analysis, or polynomial interpolation concepts.',
    constraints: 'Best for middle-school and above. Requires mathematical/data analysis context.'
  },
  {
    id: 'comparison-panel',
    description: 'Side-by-side comparison of two entities. Use when distinct "A vs B" analysis aids understanding.'
  },
  {
    id: 'generative-table',
    description: 'Structured rows/columns. Use for datasets, timelines, or categorical attributes.'
  },
  {
    id: 'custom-visual',
    description: 'A bespoke HTML/JS simulation or SVG diagram. Use for complex systems (biology, physics, counting games) that standard math visuals cannot handle. TIP: Provide config with subject, keyTerms, and conceptsCovered for richer content.'
  },
  {
    id: 'formula-card',
    description: 'Mathematical formula display with LaTeX. Use for equations, theorems, or scientific formulas.',
    constraints: 'Requires mathematical formulas'
  },
  {
    id: 'sentence-analyzer',
    description: 'Linguistic breakdown of sentence structure. Use for grammar, syntax, or language learning.',
    constraints: 'Requires language/grammar content'
  },
  {
    id: 'feature-exhibit',
    description: 'Deep-dive editorial section with multiple subsections. Use for comprehensive exploration of a topic.'
  },
  {
    id: 'knowledge-check',
    description: 'Multiple choice quiz question. RECOMMENDED: Include at the end to assess understanding.',
    constraints: 'Typically one per exhibit, at the end'
  },
  {
    id: 'scale-spectrum',
    description: 'Interactive spectrum for placing items along a continuum. Use for teaching nuanced judgments, degrees of intensity, moral/ethical reasoning, or comparative analysis.',
    constraints: 'Best for middle-school and above. Requires items that can be meaningfully positioned on a spectrum.'
  },
  {
    id: 'annotated-example',
    description: 'Step-by-step worked example with multi-layer annotations (procedural steps, strategic thinking, common errors, conceptual connections). Use for demonstrating problem-solving processes in math, science, or any domain requiring systematic reasoning.',
    constraints: 'Best for elementary and above. Requires a well-defined problem with clear solution steps.'
  },
  {
    id: 'nested-hierarchy',
    description: 'Interactive tree structure for exploring hierarchical systems (organizational charts, taxonomies, system architectures, anatomical structures). Users navigate through expandable nodes to see relationships and detailed information about each component.',
    constraints: 'Best for topics with clear hierarchical organization (2-4 levels deep). Use for biology (body systems), government (branches), classification systems, or any nested organizational structure.'
  },
  {
    id: 'image-panel',
    description: 'AI-generated images for visual context (maps, diagrams, illustrations, historical scenes, scientific visualizations). Subject-agnostic - works for geography, history, science, literature, art, or any topic requiring visual representation.',
    constraints: 'Best for topics that benefit from visual representation. Automatically categorizes and styles based on subject matter.'
  },
  {
    id: 'take-home-activity',
    description: 'Hands-on activity using common household materials. Screen-free learning experience with step-by-step instructions, safety notes, reflection prompts, and optional extensions. Perfect for reinforcing concepts through kinesthetic learning and real-world application.',
    constraints: 'Best for science experiments, math manipulatives, art projects, or any topic that benefits from hands-on exploration. Automatically adapts complexity and safety guidance to grade level.'
  },
  {
    id: 'word-builder',
    description: 'Interactive morphology lab where students construct complex words from roots, prefixes, and suffixes to understand their meaning. Drag-and-drop construction with visual breakdown showing how word parts combine. Perfect for vocabulary development, etymology, and morphological analysis in language arts.',
    constraints: 'Best for grades 3-8. Requires words that can be meaningfully broken into morphological components (prefixes, roots, suffixes).'
  },
  {
    id: 'molecule-viewer',
    description: 'Interactive 3D molecular structure visualization with CPK-colored atoms and chemical bonds. Perfect for chemistry lessons on molecular structure, bonding, organic compounds, crystal lattices, proteins, and biochemistry. Features interactive atom selection, bond analysis, and auto-rotating 3D view. HIGHLY RECOMMENDED for any chemistry topic involving molecular structure.',
    constraints: 'Best for middle-school and above. Use for chemistry, biochemistry, organic chemistry, crystal structures, or any topic involving molecules, atoms, and chemical bonds.'
  },
  {
    id: 'periodic-table',
    description: 'Interactive periodic table of all 118 elements with detailed element information, electron shell visualization, stability charts, and category filtering. Perfect for teaching element properties, electron configuration, periodic trends, atomic structure, chemical categories, and the organization of the periodic table. Features clickable elements with modal views showing atomic number, mass, electron shells, valence electrons, phase, and band of stability.',
    constraints: 'Best for middle-school and above. Use for chemistry lessons on periodic trends, element properties, atomic structure, electron configuration, or chemical families. Ideal for introducing the periodic table or exploring specific element groups.'
  },
  {
    id: 'media-player',
    description: 'Audio-visual lesson player with synchronized narration and images. Multi-segment interactive presentation where each segment has AI-generated voiceover narration and accompanying visuals. Perfect for step-by-step explanations, processes, stories, or any content that benefits from multimedia presentation. Features play/pause controls, progress tracking, and segment navigation.',
    constraints: 'Best for topics that benefit from sequential, narrative-driven explanation (processes, stories, step-by-step concepts). Each lesson typically has 3-5 segments. Works for all grade levels - narration and visuals adapt to audience.'
  },
  {
    id: 'flashcard-deck',
    description: 'Interactive flashcard deck for rapid-fire memorization and active recall practice. Students flip cards to reveal answers, mark whether they know each concept, and track their progress. Perfect for vocabulary, key terms, formulas, definitions, facts, language learning, or any content requiring rote memorization. Features 3D flip animations, keyboard shortcuts, audio feedback, shuffle mode, and performance statistics.',
    constraints: 'Best for content with discrete facts or term-definition pairs. Typically generates 12-20 cards per deck. Ideal for review, test prep, or building fluency. Works for all grade levels - vocabulary and definitions adapt to audience. Use when students need active recall practice rather than passive reading.'
  },
  {
    id: 'image-comparison',
    description: 'Interactive before/after image slider for visualizing transformations, processes, or changes. Students drag a slider to reveal differences between two AI-generated images showing a progression (e.g., caterpillar to butterfly, light refraction, cell division, historical changes). Perfect for science processes, biological transformations, physical phenomena, historical evolution, cause-and-effect relationships, or any concept involving visual change over time. Includes educational explanations and key takeaways.',
    constraints: 'Best for topics with clear visual transformations or progressive states. Works for all subjects - science (metamorphosis, phase changes, reactions), history (before/after events), geography (erosion, urban development), biology (life cycles, cellular processes), physics (states of matter, optical phenomena). The AI automatically determines the most educational before/after progression for the topic.'
  }
];

/**
 * Manifest Schema for structured output
 */
const manifestSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    topic: { type: Type.STRING },
    gradeLevel: { type: Type.STRING },
    themeColor: {
      type: Type.STRING,
      description: "Hex color code for the exhibit theme (e.g., #3b82f6)"
    },
    layout: {
      type: Type.ARRAY,
      description: "Ordered array of components to display",
      items: {
        type: Type.OBJECT,
        properties: {
          componentId: {
            type: Type.STRING,
            enum: UNIVERSAL_CATALOG.map(c => c.id),
            description: "Component type from the universal catalog"
          },
          instanceId: {
            type: Type.STRING,
            description: "Unique identifier for this instance (e.g., 'curator-brief-1', 'math-visual-counting')"
          },
          title: {
            type: Type.STRING,
            description: "Display title/heading for this section"
          },
          intent: {
            type: Type.STRING,
            description: "Detailed instructions for what content to generate for this component"
          },
          config: {
            type: Type.OBJECT,
            description: "Optional configuration hints and educational context",
            properties: {
              visualType: { type: Type.STRING, description: "Type of visualization (e.g., 'bar-model', 'number-line')" },
              itemCount: { type: Type.NUMBER, description: "Number of items to generate" },
              difficulty: { type: Type.STRING, description: "Difficulty level" },
              subject: { type: Type.STRING, description: "Subject area (e.g., 'Mathematics', 'Science', 'Language Arts')" },
              unitTitle: { type: Type.STRING, description: "Broader unit context" },
              problemType: {
                type: Type.STRING,
                enum: ["multiple_choice", "true_false", "fill_in_blanks", "matching_activity", "sequencing_activity", "categorization_activity", "scenario_question", "short_answer"],
                description: "For knowledge-check components: Type of problem to generate (e.g., 'multiple_choice', 'true_false', 'sequencing_activity')"
              },
              count: { type: Type.NUMBER, description: "For knowledge-check components: Number of problems to generate" },
              gradeLevel: { type: Type.STRING, description: "For knowledge-check components: Override grade level for this specific check" },
              keyTerms: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Key vocabulary terms to emphasize in the visualization"
              },
              conceptsCovered: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Core concepts to illustrate"
              }
            }
          }
        },
        required: ["componentId", "instanceId", "title", "intent"]
      }
    }
  },
  required: ["topic", "gradeLevel", "themeColor", "layout"]
};

/**
 * Generate Exhibit Manifest (Phase 1 - The Blueprint)
 * This creates a plan for what components to use WITHOUT generating content
 */
export const generateExhibitManifest = async (
  topic: string,
  gradeLevel: string = 'elementary'
): Promise<ExhibitManifest> => {
  try {
    const gradeLevelContext = getGradeLevelContext(gradeLevel);
    const catalogContext = UNIVERSAL_CATALOG.map(c =>
      `- ${c.id}: ${c.description}${c.constraints ? ` [${c.constraints}]` : ''}`
    ).join('\n');

    const prompt = `You are the Lead Curator designing an educational exhibit.

ASSIGNMENT: Create a manifest (blueprint) for: "${topic}"
TARGET AUDIENCE: ${gradeLevelContext}

AVAILABLE COMPONENT TOOLS:
${catalogContext}

DESIGN RULES:
1. ✅ ALWAYS start with 'curator-brief' (this is REQUIRED)
2. ✅ ALWAYS end with either 'knowledge-check' or 'flashcard-deck' to reinforce learning (this is RECOMMENDED)
3. 🎯 Choose the BEST 4-8 components total to explain the topic effectively
4. 📊 Prioritize components that match the subject matter:
   - Elementary Math (Counting, Addition, Subtraction) → Use 'number-line' or 'bar-model'
   - Elementary Math (Place Value) → Use 'base-ten-blocks'
   - Elementary Math (Fractions) → Use 'fraction-circles'
   - Elementary Math (Geometry) → Use 'geometric-shape'
   - Math Problem-Solving (Elementary+) → Use 'annotated-example' to show worked solutions with multi-layer reasoning
   - History/Literature/Social Studies → Use 'comparison-panel', 'generative-table', or 'feature-exhibit'
   - Nuanced Judgment Topics → Use 'scale-spectrum' for ethical dilemmas, degrees of formality, historical significance, etc.
   - Science/Physics/Chemistry → Use 'formula-card' (equations), 'custom-visual' (simulations), 'feature-exhibit', 'annotated-example' (problem-solving), 'molecule-viewer' (atomic and molecular bonds), 'periodic-table' (element properties and periodic trends)
   - Language Arts/Grammar → Use 'sentence-analyzer', 'concept-card-grid'
   - Data Analysis → Use 'graph-board' for polynomial fitting and data visualization
   - Sequential/Process Topics → Use 'media-player' for step-by-step narratives, processes, or stories that benefit from audio-visual presentation
5. 🎨 Pick a themeColor that matches the subject (e.g., blue for science, green for nature, purple for humanities)

OUTPUT INSTRUCTIONS:
- For each component in the layout array:
  * componentId: Pick from the catalog
  * instanceId: Create a unique ID (e.g., 'brief-1', 'number-line-addition-1', 'comparison-democracy-monarchy')
  * title: The heading that will appear above this section
  * intent: DETAILED instructions for what content to generate (be specific!)
  * config: educational context for continuity across components
    - For custom-visual: Include subject, keyTerms, and conceptsCovered to improve content quality
      Example: {"subject": "Mathematics", "keyTerms": ["addition", "sum", "equals"], "conceptsCovered": ["combining quantities", "number sense"]}
    - For knowledge-check: MUST include problemType (choose from: "multiple_choice", "true_false", "fill_in_blanks", "matching_activity", "sequencing_activity", "categorization_activity")
      Example: {"problemType": "multiple_choice", "count": 1, "difficulty": "easy"}
    - For any component: Can include itemCount, difficulty, unitTitle

EXAMPLE MANIFEST STRUCTURE:
{
  "topic": "Addition for Kindergarten",
  "gradeLevel": "kindergarten",
  "themeColor": "#3b82f6",
  "layout": [
    {
      "componentId": "curator-brief",
      "instanceId": "brief-1",
      "title": "Welcome to Addition!",
      "intent": "Create a warm introduction about adding numbers together. Include learning objectives: 1) Understand what addition means, 2) Count objects to add them, 3) Use the plus symbol"
    },
    {
      "componentId": "number-line",
      "instanceId": "number-line-addition-1",
      "title": "Let's Count Together",
      "intent": "Show addition using a number line from 0-10. Highlight 2 + 3 = 5."
    },
    {
      "componentId": "custom-visual",
      "instanceId": "interactive-addition-1",
      "title": "Interactive Counting Game",
      "intent": "Create an interactive HTML game where students drag objects together to add them. Make it colorful and engaging.",
      "config": {
        "subject": "Mathematics",
        "keyTerms": ["addition", "sum", "plus", "equals"],
        "conceptsCovered": ["combining quantities", "number sense", "counting"]
      }
    },
    {
      "componentId": "knowledge-check",
      "instanceId": "quiz-1",
      "title": "Check Your Understanding",
      "intent": "Create a simple addition question: If you have 2 apples and get 1 more, how many do you have?",
      "config": {
        "problemType": "multiple_choice",
        "count": 1,
        "difficulty": "easy"
      }
    }
  ]
}

Now generate the manifest for: "${topic}" (${gradeLevel})
Return ONLY valid JSON matching the schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        responseMimeType: "application/json",
        responseSchema: manifestSchema,
      },
    });

    if (!response.text) throw new Error("No manifest returned");

    let jsonStr = response.text.trim();
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) jsonStr = match[1].trim();

    // Cleanup potential trailing characters
    const firstOpen = jsonStr.indexOf('{');
    const lastClose = jsonStr.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      jsonStr = jsonStr.substring(firstOpen, lastClose + 1);
    }

    const manifest = JSON.parse(jsonStr) as ExhibitManifest;

    console.log('📋 Manifest Generated from standalone service:', manifest);
    return manifest;
  } catch (error) {
    console.error("Manifest generation error:", error);
    throw error;
  }
};