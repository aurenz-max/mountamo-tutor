/**
 * Knowledge Check Generator - Dedicated service for assessment problem generation
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 *
 * Supports 6 problem types:
 * - Multiple Choice
 * - True/False
 * - Fill in Blanks
 * - Categorization Activity
 * - Matching Activity
 * - Sequencing Activity
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  ProblemType,
  ProblemData,
  MultipleChoiceProblemData,
  TrueFalseProblemData,
  FillInBlanksProblemData,
  CategorizationActivityProblemData,
  MatchingActivityProblemData,
  SequencingActivityProblemData,
} from "../../types";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
// MULTIPLE CHOICE PROBLEMS
// ============================================================================

/**
 * Generate multiple choice problems for KnowledgeCheck component
 * Following the problem registry architecture from KNOWLEDGE_CHECK_SYSTEM.md
 */
export const generateMultipleChoiceProblems = async (
  topic: string,
  gradeLevel: string,
  count: number = 1,
  context?: string
): Promise<MultipleChoiceProblemData[]> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  const multipleChoiceSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      problems: {
        type: Type.ARRAY,
        description: `Array of ${count} multiple choice problems`,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Unique identifier (e.g., 'mc_1', 'mc_2')"
            },
            difficulty: {
              type: Type.STRING,
              enum: ["easy", "medium", "hard"],
              description: "Problem difficulty level"
            },
            question: {
              type: Type.STRING,
              description: "The multiple choice question"
            },
            options: {
              type: Type.ARRAY,
              description: "Array of 4 answer options",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "Option letter (A, B, C, D)" },
                  text: { type: Type.STRING, description: "Option text" }
                },
                required: ["id", "text"]
              }
            },
            correctOptionId: {
              type: Type.STRING,
              description: "The correct option ID (A, B, C, or D)"
            },
            rationale: {
              type: Type.STRING,
              description: "Detailed explanation of the correct answer and why it's correct (2-3 sentences)"
            },
            teachingNote: {
              type: Type.STRING,
              description: "Optional teaching tip or additional context for educators (can be empty string)"
            },
            successCriteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Learning objectives this problem assesses (1-3 criteria)"
            }
          },
          required: ["id", "difficulty", "question", "options", "correctOptionId", "rationale", "teachingNote", "successCriteria"]
        }
      }
    },
    required: ["problems"]
  };

  const prompt = `You are an expert educational assessment designer creating multiple choice questions for a knowledge check.

TOPIC: ${topic}
TARGET AUDIENCE: ${gradeLevelContext}
${context ? `ADDITIONAL CONTEXT: ${context}\n` : ''}
NUMBER OF PROBLEMS: ${count}

## Your Mission:
Create ${count} high-quality multiple choice question${count > 1 ? 's' : ''} that effectively assess understanding of "${topic}".

## Quality Standards:

### 1. QUESTION DESIGN
- Write clear, unambiguous questions appropriate for the grade level
- Focus on conceptual understanding, not just memorization
- Use age-appropriate vocabulary and sentence structure
- Questions should test genuine comprehension, not trick students

### 2. ANSWER OPTIONS
- Provide exactly 4 options labeled A, B, C, D
- Make all distractors (wrong answers) plausible but clearly incorrect
- Avoid "all of the above" or "none of the above" options
- Ensure options are parallel in structure and length
- Mix up the position of the correct answer (don't always make it B or C)

### 3. DIFFICULTY PROGRESSION
${count > 1 ? `- Start with easier questions, build to harder ones
- Balance difficulty: some easy, some medium, some hard` : '- Set appropriate difficulty for the topic and grade level'}

### 4. RATIONALE (Most Important!)
- Explain WHY the correct answer is right (not just repeating it)
- Connect to broader concepts or principles
- Address common misconceptions if relevant
- Use encouraging, educational language
- 2-3 sentences that genuinely teach

### 5. TEACHING NOTE
- Provide optional pedagogical context or teaching strategies
- Suggest connections to other concepts
- Highlight common student difficulties
- Can be empty if no special note needed

### 6. SUCCESS CRITERIA
- List 1-3 specific learning objectives this problem assesses
- Use action verbs (identify, explain, apply, analyze, etc.)
- Make criteria measurable and specific to the problem

Now generate ${count} problem${count > 1 ? 's' : ''}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: multipleChoiceSchema,
      },
    });

    if (!response.text) throw new Error("No content generated");
    const data = JSON.parse(response.text);

    const problems = data.problems.map((problem: any) => ({
      type: 'multiple_choice' as const,
      id: problem.id,
      difficulty: problem.difficulty,
      gradeLevel: gradeLevel,
      question: problem.question,
      options: problem.options,
      correctOptionId: problem.correctOptionId,
      rationale: problem.rationale,
      teachingNote: problem.teachingNote,
      successCriteria: problem.successCriteria
    }));

    console.log('Multiple Choice Generated from dedicated service:', {
      topic,
      count: problems.length
    });

    return problems;
  } catch (error) {
    console.error("Multiple choice problem generation error:", error);
    throw error;
  }
};

// ============================================================================
// TRUE/FALSE PROBLEMS
// ============================================================================

/**
 * Generate true/false problems for KnowledgeCheck component
 */
export const generateTrueFalseProblems = async (
  topic: string,
  gradeLevel: string,
  count: number = 1,
  context?: string
): Promise<TrueFalseProblemData[]> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  const trueFalseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      problems: {
        type: Type.ARRAY,
        description: `Array of ${count} true/false problems`,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Unique identifier (e.g., 'tf_1', 'tf_2')"
            },
            difficulty: {
              type: Type.STRING,
              enum: ["easy", "medium", "hard"],
              description: "Problem difficulty level"
            },
            statement: {
              type: Type.STRING,
              description: "A clear declarative statement that is either true or false"
            },
            correct: {
              type: Type.BOOLEAN,
              description: "Whether the statement is true (true) or false (false)"
            },
            rationale: {
              type: Type.STRING,
              description: "Detailed explanation of why the statement is true or false, addressing potential misconceptions (2-3 sentences)"
            },
            teachingNote: {
              type: Type.STRING,
              description: "Optional teaching tip, real-world connection, or common student misconception to address (can be empty string)"
            },
            successCriteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Learning objectives this problem assesses (1-3 criteria)"
            }
          },
          required: ["id", "difficulty", "statement", "correct", "rationale", "teachingNote", "successCriteria"]
        }
      }
    },
    required: ["problems"]
  };

  const prompt = `You are an expert educational assessment designer creating true/false questions for a knowledge check.

TOPIC: ${topic}
TARGET AUDIENCE: ${gradeLevelContext}
${context ? `ADDITIONAL CONTEXT: ${context}\n` : ''}
NUMBER OF PROBLEMS: ${count}

## Your Mission:
Create ${count} high-quality true/false statement${count > 1 ? 's' : ''} that effectively assess understanding of "${topic}".

## Quality Standards:

### 1. STATEMENT DESIGN
- Write clear, unambiguous declarative statements
- Each statement should be definitively true or false (no "sometimes" or "maybe")
- Focus on important concepts, not trivial facts
- Avoid trick questions or overly complex wording
- Use age-appropriate vocabulary and sentence structure
- Avoid absolute words like "always," "never," "all," "none" unless genuinely accurate

### 2. BALANCE TRUE AND FALSE
${count > 1 ? `- Mix true and false statements roughly equally
- Don't create patterns (e.g., T, F, T, F or all true)
- Randomize the distribution naturally` : '- Make it either true or false based on what best assesses understanding'}

### 3. MISCONCEPTION TARGETING
- Target common student misconceptions with false statements
- Use false statements that reflect plausible but incorrect thinking
- Avoid obscure or trick false statements
- True statements should reinforce key accurate understandings

### 4. RATIONALE (Most Important!)
- Explain WHY the statement is true or false
- For FALSE statements: explain what makes it false AND what the truth is
- For TRUE statements: explain what makes it accurate and important
- Address any misconceptions the statement targets
- Use clear, educational language
- 2-3 sentences that genuinely teach

Now generate ${count} problem${count > 1 ? 's' : ''}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: trueFalseSchema,
      },
    });

    if (!response.text) throw new Error("No content generated");
    const data = JSON.parse(response.text);

    const problems = data.problems.map((problem: any) => ({
      type: 'true_false' as const,
      id: problem.id,
      difficulty: problem.difficulty,
      gradeLevel: gradeLevel,
      statement: problem.statement,
      correct: problem.correct,
      rationale: problem.rationale,
      teachingNote: problem.teachingNote,
      successCriteria: problem.successCriteria
    }));

    console.log('True/False Generated from dedicated service:', {
      topic,
      count: problems.length
    });

    return problems;
  } catch (error) {
    console.error("True/false problem generation error:", error);
    throw error;
  }
};

// ============================================================================
// FILL IN BLANKS PROBLEMS
// ============================================================================

/**
 * Generate fill in blanks problems for KnowledgeCheck component
 */
export const generateFillInBlanksProblems = async (
  topic: string,
  gradeLevel: string,
  count: number = 1,
  context?: string
): Promise<FillInBlanksProblemData[]> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  const fillInBlanksSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      problems: {
        type: Type.ARRAY,
        description: `Array of ${count} fill in blanks problems`,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Unique identifier (e.g., 'fib_1', 'fib_2')"
            },
            difficulty: {
              type: Type.STRING,
              enum: ["easy", "medium", "hard"],
              description: "Problem difficulty level - Easy: 1 blank, Medium: 2 blanks, Hard: 3 blanks"
            },
            textWithBlanks: {
              type: Type.STRING,
              description: "Complete sentence or passage with blanks marked as [blank_1], [blank_2], etc. The blanks should test key vocabulary or concepts."
            },
            blanks: {
              type: Type.ARRAY,
              description: "Array of blank definitions, one for each [blank_N] in the text. Easy should have 1 blank, Medium 2 blanks, Hard 3 blanks.",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: {
                    type: Type.STRING,
                    description: "Blank identifier matching the text (e.g., 'blank_1', 'blank_2')"
                  },
                  correctAnswer: {
                    type: Type.STRING,
                    description: "The single correct answer for this blank (will be included in word bank)"
                  },
                  caseSensitive: {
                    type: Type.BOOLEAN,
                    description: "Whether answers should be case-sensitive (usually false)"
                  }
                },
                required: ["id", "correctAnswer", "caseSensitive"]
              }
            },
            wordBank: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Word bank containing all correct answers PLUS 2-3 plausible distractors. Distractors should be related to the topic but clearly incorrect for the given context."
            },
            rationale: {
              type: Type.STRING,
              description: "Detailed explanation of the correct answers and why they're important (2-3 sentences)"
            },
            teachingNote: {
              type: Type.STRING,
              description: "Optional teaching tip about vocabulary usage, context clues, or common errors (can be empty string)"
            },
            successCriteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Learning objectives this problem assesses (1-3 criteria)"
            }
          },
          required: ["id", "difficulty", "textWithBlanks", "blanks", "wordBank", "rationale", "teachingNote", "successCriteria"]
        }
      }
    },
    required: ["problems"]
  };

  const prompt = `You are an expert educational assessment designer creating fill-in-the-blank questions with drag-and-drop word banks.

TOPIC: ${topic}
TARGET AUDIENCE: ${gradeLevelContext}
${context ? `ADDITIONAL CONTEXT: ${context}\n` : ''}
NUMBER OF PROBLEMS: ${count}

## Your Mission:
Create ${count} high-quality fill-in-the-blank problem${count > 1 ? 's' : ''} with word banks that effectively assess understanding of "${topic}".

## Quality Standards:

### 1. TEXT DESIGN
- Create complete, meaningful sentences or short passages (1-3 sentences)
- Use age-appropriate vocabulary and complexity
- Make the context clear enough that students can use context clues
- Ensure the sentence makes sense with the blanks filled in
- Use natural, flowing language (not awkward or forced)

### 2. DIFFICULTY LEVELS (CRITICAL - FOLLOW EXACTLY)
- **EASY**: Exactly 1 blank per problem
- **MEDIUM**: Exactly 2 blanks per problem
- **HARD**: Exactly 3 blanks per problem
- Mark blanks using the format [blank_1], [blank_2], [blank_3], etc.

### 3. BLANK PLACEMENT
- Place blanks strategically at KEY TERMS or CONCEPTS (not trivial words)
- Don't blank out articles (a, an, the) or prepositions unless testing those specifically
- Space blanks out - don't put them right next to each other

### 4. WORD BANK DESIGN (CRITICAL)
- Include ALL correct answers in the word bank
- Add 2-3 PLAUSIBLE DISTRACTORS (wrong answers that seem related)
- Distractors should be:
  * Related to the same topic/subject area
  * Similar part of speech as the correct answers
  * Tempting but clearly incorrect in context
- Total word bank size: (number of blanks) + 2 or 3 distractors

### 5. CASE SENSITIVITY
- Usually set caseSensitive to false (most forgiving for students)
- Only use caseSensitive: true when testing proper nouns or when case genuinely matters

Now generate ${count} problem${count > 1 ? 's' : ''}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: fillInBlanksSchema,
      },
    });

    if (!response.text) throw new Error("No content generated");
    const data = JSON.parse(response.text);

    const problems = data.problems.map((problem: any) => ({
      type: 'fill_in_blanks' as const,
      id: problem.id,
      difficulty: problem.difficulty,
      gradeLevel: gradeLevel,
      textWithBlanks: problem.textWithBlanks,
      blanks: problem.blanks,
      wordBank: problem.wordBank,
      rationale: problem.rationale,
      teachingNote: problem.teachingNote,
      successCriteria: problem.successCriteria
    }));

    console.log('Fill in Blanks Generated from dedicated service:', {
      topic,
      count: problems.length
    });

    return problems;
  } catch (error) {
    console.error("Fill in blanks problem generation error:", error);
    throw error;
  }
};

// ============================================================================
// CATEGORIZATION PROBLEMS
// ============================================================================

/**
 * Generate categorization activity problems for KnowledgeCheck component
 */
export const generateCategorizationProblems = async (
  topic: string,
  gradeLevel: string,
  count: number = 1,
  context?: string
): Promise<CategorizationActivityProblemData[]> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  const categorizationSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      problems: {
        type: Type.ARRAY,
        description: `Array of ${count} categorization activity problems`,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Unique identifier (e.g., 'cat_1', 'cat_2')"
            },
            difficulty: {
              type: Type.STRING,
              enum: ["easy", "medium", "hard"],
              description: "Problem difficulty level"
            },
            instruction: {
              type: Type.STRING,
              description: "Clear instruction telling students what to categorize and how (e.g., 'Sort these words by part of speech')"
            },
            categories: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2-4 category names that items will be sorted into"
            },
            categorizationItems: {
              type: Type.ARRAY,
              description: "6-12 items to be categorized (should be balanced across categories)",
              items: {
                type: Type.OBJECT,
                properties: {
                  itemText: {
                    type: Type.STRING,
                    description: "The text/word/concept to be categorized"
                  },
                  correctCategory: {
                    type: Type.STRING,
                    description: "The category this item belongs to (must match one of the categories exactly)"
                  }
                },
                required: ["itemText", "correctCategory"]
              }
            },
            rationale: {
              type: Type.STRING,
              description: "Educational explanation of the categorization logic, common patterns, and why items belong in their categories (2-3 sentences)"
            },
            teachingNote: {
              type: Type.STRING,
              description: "Optional teaching tip, common categorization errors to watch for, or scaffolding suggestions (can be empty string)"
            },
            successCriteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Learning objectives this problem assesses (1-3 criteria)"
            }
          },
          required: ["id", "difficulty", "instruction", "categories", "categorizationItems", "rationale", "teachingNote", "successCriteria"]
        }
      }
    },
    required: ["problems"]
  };

  const prompt = `You are an expert educational assessment designer creating categorization activities for a knowledge check.

TOPIC: ${topic}
TARGET AUDIENCE: ${gradeLevelContext}
${context ? `ADDITIONAL CONTEXT: ${context}\n` : ''}
NUMBER OF PROBLEMS: ${count}

## Your Mission:
Create ${count} high-quality categorization activit${count > 1 ? 'ies' : 'y'} that effectively assess understanding of "${topic}".

## Quality Standards:

### 1. INSTRUCTION DESIGN
- Write clear, concise instructions that explain the categorization task
- Be specific about what attribute/characteristic determines the categories
- Use age-appropriate language
- Make the task unambiguous (students should know exactly what to do)

### 2. CATEGORY SELECTION
- Choose 2-4 distinct, well-defined categories
- Categories should be mutually exclusive (no overlap)
- Categories should be collectively exhaustive for the given items
- Use clear, recognizable category labels
- Ensure categories are appropriate for the grade level

### 3. ITEM SELECTION (6-12 items per problem)
- Choose items that clearly belong to one category
- Distribute items relatively evenly across categories (avoid having all items in one category)
- Include some items that might be tempting to miscategorize (to assess deeper understanding)
- Use items that are familiar to students at the target grade level
- Vary complexity within items (some obvious, some requiring more thought)
- Ensure each item has exactly ONE correct category

### 4. BALANCED DISTRIBUTION
- Aim for roughly equal numbers of items per category
- For 2 categories: 3-6 items each (6-12 total)
- For 3 categories: 2-4 items each (6-12 total)
- For 4 categories: 2-3 items each (8-12 total)

### 5. RATIONALE (Most Important!)
- Explain the logic behind the categorization system
- Highlight key distinguishing features of each category
- Address common categorization errors students might make
- Explain why tricky items belong where they do
- Use clear, educational language
- 2-3 sentences that genuinely teach the categorization skill

Now generate ${count} problem${count > 1 ? 's' : ''}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: categorizationSchema,
      },
    });

    if (!response.text) throw new Error("No content generated");
    const data = JSON.parse(response.text);

    const problems = data.problems.map((problem: any) => ({
      type: 'categorization_activity' as const,
      id: problem.id,
      difficulty: problem.difficulty,
      gradeLevel: gradeLevel,
      instruction: problem.instruction,
      categories: problem.categories,
      categorizationItems: problem.categorizationItems,
      rationale: problem.rationale,
      teachingNote: problem.teachingNote,
      successCriteria: problem.successCriteria
    }));

    console.log('Categorization Generated from dedicated service:', {
      topic,
      count: problems.length
    });

    return problems;
  } catch (error) {
    console.error("Categorization problem generation error:", error);
    throw error;
  }
};

// ============================================================================
// MATCHING PROBLEMS
// ============================================================================

/**
 * Generate matching activity problems for KnowledgeCheck component
 */
export const generateMatchingProblems = async (
  topic: string,
  gradeLevel: string,
  count: number = 1,
  context?: string
): Promise<MatchingActivityProblemData[]> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  const matchingSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      problems: {
        type: Type.ARRAY,
        description: `Array of ${count} matching activity problems`,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Unique identifier (e.g., 'match_1', 'match_2')"
            },
            difficulty: {
              type: Type.STRING,
              enum: ["easy", "medium", "hard"],
              description: "Problem difficulty level - Easy: 3-4 matches, Medium: 5-6 matches, Hard: 7-8 matches"
            },
            prompt: {
              type: Type.STRING,
              description: "Clear instruction for the matching task (e.g., 'Match each scientist to their discovery', 'Connect each country with its capital')"
            },
            leftItems: {
              type: Type.ARRAY,
              description: "Items in the left column (3-8 items depending on difficulty). These are what students will select first.",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: {
                    type: Type.STRING,
                    description: "Unique identifier (e.g., 'L1', 'L2', 'L3')"
                  },
                  text: {
                    type: Type.STRING,
                    description: "The text to display"
                  }
                },
                required: ["id", "text"]
              }
            },
            rightItems: {
              type: Type.ARRAY,
              description: "Items in the right column (same count as leftItems). These are the matching targets.",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: {
                    type: Type.STRING,
                    description: "Unique identifier (e.g., 'R1', 'R2', 'R3')"
                  },
                  text: {
                    type: Type.STRING,
                    description: "The text to display"
                  }
                },
                required: ["id", "text"]
              }
            },
            mappings: {
              type: Type.ARRAY,
              description: "Correct mappings from left items to right items. Each left item maps to exactly one right item (1:1 relationship).",
              items: {
                type: Type.OBJECT,
                properties: {
                  leftId: {
                    type: Type.STRING,
                    description: "ID of the left item"
                  },
                  rightIds: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Array containing exactly ONE right item ID (use array format for consistency, but only include one ID)"
                  }
                },
                required: ["leftId", "rightIds"]
              }
            },
            rationale: {
              type: Type.STRING,
              description: "Detailed explanation of the relationships and why they're important (2-4 sentences)"
            },
            teachingNote: {
              type: Type.STRING,
              description: "Optional teaching tip about the relationships, common confusions, or mnemonic devices (can be empty string)"
            },
            successCriteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Learning objectives this problem assesses (1-3 criteria)"
            }
          },
          required: ["id", "difficulty", "prompt", "leftItems", "rightItems", "mappings", "rationale", "teachingNote", "successCriteria"]
        }
      }
    },
    required: ["problems"]
  };

  const prompt = `You are an expert educational assessment designer creating matching activities for knowledge checks.

TOPIC: ${topic}
TARGET AUDIENCE: ${gradeLevelContext}
${context ? `ADDITIONAL CONTEXT: ${context}\n` : ''}
NUMBER OF PROBLEMS: ${count}

## Your Mission:
Create ${count} high-quality matching activity problem${count > 1 ? 's' : ''} that effectively assess understanding of "${topic}".

## Quality Standards:

### 1. PROMPT DESIGN
- Write a clear, specific instruction (e.g., "Match each scientist to their discovery")
- Make it obvious what kind of relationship to look for
- Use age-appropriate language
- Be specific about what's being matched

### 2. DIFFICULTY LEVELS (CRITICAL - FOLLOW EXACTLY)
- **EASY**: Exactly 3-4 matching pairs
- **MEDIUM**: Exactly 5-6 matching pairs
- **HARD**: Exactly 7-8 matching pairs
- More pairs = harder because there are more options to choose from

### 3. ITEM DESIGN (Left Column)
- Use clear, concise labels
- Keep items parallel in structure (all nouns, all people, all concepts, etc.)
- Make items distinct from each other
- Avoid overly similar items that would cause confusion
- Left items are typically the "key" items (e.g., scientists, countries, terms)

### 4. ITEM DESIGN (Right Column)
- Should match the grammatical structure needed for the relationship
- Keep parallel structure across all right items
- Make each right item clearly distinct
- Right items are typically the "values" (e.g., discoveries, capitals, definitions)

### 5. RELATIONSHIP DESIGN
- Create ONE-TO-ONE relationships (each left item matches to exactly ONE right item)
- Even though rightIds is an array, ONLY include ONE ID per mapping
- Ensure all relationships are factually correct and unambiguous
- Test important, meaningful relationships (not trivial connections)
- All left items must have a match (no unmatched items)
- All right items must have a match (no extra distractors)

### 6. RATIONALE (Most Important!)
- Explain the nature of the relationships
- Highlight why these connections matter
- Connect to broader concepts or patterns
- Address any potentially confusing pairs
- Use clear, educational language
- 2-4 sentences that genuinely teach

Now generate ${count} problem${count > 1 ? 's' : ''}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: matchingSchema,
      },
    });

    if (!response.text) throw new Error("No content generated");
    const data = JSON.parse(response.text);

    const problems = data.problems.map((problem: any) => ({
      type: 'matching_activity' as const,
      id: problem.id,
      difficulty: problem.difficulty,
      gradeLevel: gradeLevel,
      prompt: problem.prompt,
      leftItems: problem.leftItems,
      rightItems: problem.rightItems,
      mappings: problem.mappings,
      rationale: problem.rationale,
      teachingNote: problem.teachingNote,
      successCriteria: problem.successCriteria
    }));

    console.log('Matching Generated from dedicated service:', {
      topic,
      count: problems.length
    });

    return problems;
  } catch (error) {
    console.error("Matching activity problem generation error:", error);
    throw error;
  }
};

// ============================================================================
// SEQUENCING PROBLEMS
// ============================================================================

/**
 * Generate sequencing activity problems for KnowledgeCheck component
 */
export const generateSequencingProblems = async (
  topic: string,
  gradeLevel: string,
  count: number = 1,
  context?: string
): Promise<SequencingActivityProblemData[]> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  const sequencingSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      problems: {
        type: Type.ARRAY,
        description: `Array of ${count} sequencing activity problems`,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Unique identifier (e.g., 'seq_1', 'seq_2')"
            },
            difficulty: {
              type: Type.STRING,
              enum: ["easy", "medium", "hard"],
              description: "Problem difficulty level"
            },
            instruction: {
              type: Type.STRING,
              description: "Clear instruction telling students what to sequence and how (e.g., 'Arrange the life cycle stages of a butterfly in order')"
            },
            items: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "4-8 items in the CORRECT ORDER. These will be shuffled when presented to students. Each item should be a clear, concise step or stage."
            },
            rationale: {
              type: Type.STRING,
              description: "Educational explanation of why this is the correct sequence, the logic or principle that determines the order (2-3 sentences)"
            },
            teachingNote: {
              type: Type.STRING,
              description: "Optional teaching tip, common sequencing errors students make, or scaffolding suggestions (can be empty string)"
            },
            successCriteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Learning objectives this problem assesses (1-3 criteria)"
            }
          },
          required: ["id", "difficulty", "instruction", "items", "rationale", "teachingNote", "successCriteria"]
        }
      }
    },
    required: ["problems"]
  };

  const prompt = `You are an expert educational assessment designer creating sequencing activities for a knowledge check.

TOPIC: ${topic}
TARGET AUDIENCE: ${gradeLevelContext}
${context ? `ADDITIONAL CONTEXT: ${context}\n` : ''}
NUMBER OF PROBLEMS: ${count}

## Your Mission:
Create ${count} high-quality sequencing activit${count > 1 ? 'ies' : 'y'} that effectively assess understanding of "${topic}".

## Quality Standards:

### 1. INSTRUCTION DESIGN
- Write clear, concise instructions that explain what needs to be sequenced
- Be specific about the ordering principle (chronological, procedural, logical, etc.)
- Use age-appropriate language
- Make the task unambiguous (students should know exactly what to do)

### 2. ITEM SELECTION (4-8 items per problem)
- Choose items that have a clear, logical sequence
- Each item should be distinct and necessary for the sequence
- Items should be concise (1-2 short sentences or a brief phrase)
- Use parallel structure (all items formatted similarly)
- Ensure the sequence has ONE correct order (not multiple valid orderings)
- Avoid items that could logically go in multiple positions

### 3. SEQUENCE TYPES TO CONSIDER
- **Chronological**: Events in time order (historical events, life cycles, timelines)
- **Procedural**: Steps in a process (scientific method, recipe, instructions)
- **Logical**: Progression of ideas (simple to complex, cause to effect)
- **Developmental**: Stages of growth or development (life cycles, skill progression)
- **Narrative**: Story sequence (plot events, problem-solving steps)

### 4. DIFFICULTY PROGRESSION
- Easy: Obvious sequences with distinct stages (4-5 items)
- Medium: Familiar sequences requiring some thought (5-6 items)
- Hard: Complex sequences with subtle distinctions (6-8 items)

### 5. RATIONALE (Most Important!)
- Explain WHY this is the correct sequence
- Describe the principle or logic that determines the order
- Highlight key transitions or turning points in the sequence
- Address why certain items must come before or after others
- Use clear, educational language
- 2-3 sentences that genuinely teach the sequencing logic

## Key Insight:
The ITEMS array you provide must be in the CORRECT ORDER. The frontend will shuffle them for display, and students will drag them to recreate your correct sequence.

Now generate ${count} problem${count > 1 ? 's' : ''}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: sequencingSchema,
      },
    });

    if (!response.text) throw new Error("No content generated");
    const data = JSON.parse(response.text);

    const problems = data.problems.map((problem: any) => ({
      type: 'sequencing_activity' as const,
      id: problem.id,
      difficulty: problem.difficulty,
      gradeLevel: gradeLevel,
      instruction: problem.instruction,
      items: problem.items,
      rationale: problem.rationale,
      teachingNote: problem.teachingNote,
      successCriteria: problem.successCriteria
    }));

    console.log('Sequencing Generated from dedicated service:', {
      topic,
      count: problems.length
    });

    return problems;
  } catch (error) {
    console.error("Sequencing problem generation error:", error);
    throw error;
  }
};

// ============================================================================
// MAIN DISPATCHER
// ============================================================================

/**
 * Generate knowledge check problems based on config
 * This is the main entry point for manifest-driven problem generation
 *
 * @param topic - The topic to generate problems about
 * @param gradeContext - Grade level context string (already converted)
 * @param config - Configuration specifying problemType, count, difficulty
 * @returns Array of problems matching the specified type
 */
export const generateKnowledgeCheck = async (
  topic: string,
  gradeContext: string,
  config?: {
    problemType?: ProblemType;
    count?: number;
    difficulty?: string;
    context?: string;
    objectiveText?: string;
  }
): Promise<ProblemData[]> => {
  const problemType = config?.problemType || 'multiple_choice';
  const count = config?.count || 1;
  const context = config?.context || config?.objectiveText;

  // Extract grade level from context (reverse the context -> grade mapping for internal use)
  // The gradeContext is already the descriptive string, we need to extract the grade level for the problem
  let gradeLevel = 'elementary';
  if (gradeContext.includes('toddler')) gradeLevel = 'toddler';
  else if (gradeContext.includes('preschool')) gradeLevel = 'preschool';
  else if (gradeContext.includes('kindergarten')) gradeLevel = 'kindergarten';
  else if (gradeContext.includes('elementary') || gradeContext.includes('grades 1-5')) gradeLevel = 'elementary';
  else if (gradeContext.includes('middle school') || gradeContext.includes('grades 6-8')) gradeLevel = 'middle-school';
  else if (gradeContext.includes('high school') || gradeContext.includes('grades 9-12')) gradeLevel = 'high-school';
  else if (gradeContext.includes('undergraduate')) gradeLevel = 'undergraduate';
  else if (gradeContext.includes('graduate') || gradeContext.includes('Master')) gradeLevel = 'graduate';
  else if (gradeContext.includes('doctoral') || gradeContext.includes('PhD')) gradeLevel = 'phd';

  console.log('[Knowledge Check] Starting problem generation from dedicated service:');
  console.log('  Topic:', topic);
  console.log('  Grade Level:', gradeLevel);
  console.log('  Problem Type:', problemType);
  console.log('  Count:', count);
  console.log('  Context:', context || '(none)');

  // Map problem types to their generator functions
  const generatorMap: Record<ProblemType, (topic: string, gradeLevel: string, count: number, context?: string) => Promise<ProblemData[]>> = {
    'multiple_choice': generateMultipleChoiceProblems,
    'true_false': generateTrueFalseProblems,
    'fill_in_blanks': generateFillInBlanksProblems,
    'matching_activity': generateMatchingProblems,
    'sequencing_activity': generateSequencingProblems,
    'categorization_activity': generateCategorizationProblems,
    'scenario_question': async () => { throw new Error('Scenario questions not yet implemented'); },
    'short_answer': async () => { throw new Error('Short answer not yet implemented'); },
  };

  const generator = generatorMap[problemType];
  if (!generator) {
    console.error(`Unknown problem type: ${problemType}`);
    throw new Error(`Unknown problem type: ${problemType}`);
  }

  try {
    const problems = await generator(topic, gradeLevel, count, context);
    console.log(`  Successfully generated ${problems.length} problem(s) of type: ${problemType}`);
    return problems;
  } catch (error) {
    console.error(`Error generating ${problemType} problems:`, error);
    throw error;
  }
};

// Export for backward compatibility (geminiService.ts may still reference these)
export {
  generateMultipleChoiceProblems as generateMultipleChoice,
  generateTrueFalseProblems as generateTrueFalse,
  generateFillInBlanksProblems as generateFillInBlanks,
  generateCategorizationProblems as generateCategorization,
  generateMatchingProblems as generateMatching,
  generateSequencingProblems as generateSequencing,
};
