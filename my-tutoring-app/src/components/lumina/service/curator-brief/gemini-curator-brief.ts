import { Type, Schema, ThinkingLevel } from "@google/genai";
import { IntroBriefingData } from "../../types";
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

/**
 * Generate comprehensive Intro Briefing data for lesson introduction
 *
 * This function creates the curator-brief component content, which includes:
 * - Hook: Engaging opening to capture student attention
 * - Big Idea: Core concept and why it matters
 * - Objectives: Clear learning goals with action verbs
 * - Prerequisites: What students should know and quick check
 * - Roadmap: Learning phases and activities
 * - Connections: Links to prior/future learning and real-world applications
 * - Mindset: Encouragement and learning strategies
 */
export const generateIntroBriefing = async (
  topic: string,
  subject: string,
  gradeLevel: string,
  estimatedTime: string = '15-20 minutes'
): Promise<IntroBriefingData> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      primitive: {
        type: Type.STRING,
        description: "Must be 'intro_briefing'"
      },
      topic: { type: Type.STRING },
      subject: { type: Type.STRING },
      gradeLevel: { type: Type.STRING },
      estimatedTime: { type: Type.STRING },

      hook: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            enum: ['scenario', 'question', 'surprising_fact', 'story'],
            description: 'Type of hook: scenario (imagine situation), question (thought-provoking), surprising_fact (unexpected info), or story (narrative)'
          },
          content: {
            type: Type.STRING,
            description: 'Engaging opening that captures attention and connects to students\' lives, age-appropriate and curiosity-creating'
          },
          visual: {
            type: Type.STRING,
            description: 'A single emoji that represents the hook visually'
          }
        },
        required: ['type', 'content', 'visual']
      },

      bigIdea: {
        type: Type.OBJECT,
        properties: {
          statement: {
            type: Type.STRING,
            description: 'Core concept in one clear, memorable sentence using student-friendly language'
          },
          whyItMatters: {
            type: Type.STRING,
            description: 'Real-world relevance explaining why this topic is worth learning, connecting to students\' lives and future learning'
          }
        },
        required: ['statement', 'whyItMatters']
      },

      objectives: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: 'Unique identifier like obj1, obj2, etc.'
            },
            text: {
              type: Type.STRING,
              description: 'Clear learning objective starting with an action verb'
            },
            verb: {
              type: Type.STRING,
              enum: ['identify', 'explain', 'create', 'analyze', 'compare', 'apply', 'evaluate'],
              description: 'Bloom\'s taxonomy verb category'
            },
            icon: {
              type: Type.STRING,
              description: 'Icon hint: search, message, pencil, lightbulb, scale, puzzle, check'
            }
          },
          required: ['id', 'text', 'verb', 'icon']
        },
        description: '3-4 specific, achievable learning objectives'
      },

      prerequisites: {
        type: Type.OBJECT,
        properties: {
          shouldKnow: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '2-4 genuine prerequisites from recent learning'
          },
          quickCheck: {
            type: Type.OBJECT,
            properties: {
              question: {
                type: Type.STRING,
                description: 'Simple question answerable in under 30 seconds to verify readiness'
              },
              answer: {
                type: Type.STRING,
                description: 'Expected answer to the question'
              },
              hint: {
                type: Type.STRING,
                description: 'Helpful hint that scaffolds thinking without giving the answer'
              }
            },
            required: ['question', 'answer', 'hint']
          }
        },
        required: ['shouldKnow', 'quickCheck']
      },

      roadmap: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            phase: {
              type: Type.STRING,
              description: 'Student-friendly phase name like Explore, Learn, Practice, Apply'
            },
            description: {
              type: Type.STRING,
              description: 'Brief description of what happens in this phase'
            },
            activities: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '1-3 concrete activities for this phase'
            }
          },
          required: ['phase', 'description', 'activities']
        },
        description: '3-5 learning phases that build confidence'
      },

      connections: {
        type: Type.OBJECT,
        properties: {
          buildingFrom: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Concepts from previous grades/units that directly support this topic'
          },
          leadingTo: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Where this knowledge goes next in the curriculum'
          },
          realWorld: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Concrete, relatable applications students can visualize'
          }
        },
        required: ['buildingFrom', 'leadingTo', 'realWorld']
      },

      mindset: {
        type: Type.OBJECT,
        properties: {
          encouragement: {
            type: Type.STRING,
            description: 'Warm, encouraging message acknowledging potential challenges but emphasizing achievability'
          },
          growthTip: {
            type: Type.STRING,
            description: 'Practical learning strategy or study tip specific to this content type'
          }
        },
        required: ['encouragement', 'growthTip']
      }
    },
    required: [
      'primitive', 'topic', 'subject', 'gradeLevel', 'estimatedTime',
      'hook', 'bigIdea', 'objectives', 'prerequisites', 'roadmap', 'connections', 'mindset'
    ]
  };

  const prompt = `You are an expert curriculum designer creating engaging lesson introductions for K-8 homeschool students. Your task is to generate an Intro Briefing schema that orients students to new topics by providing context, relevance, clear objectives, and motivation.

Generate an Intro Briefing schema for the following topic:

**Topic:** ${topic}
**Subject:** ${subject}
**Grade Level:** ${gradeLevel}
**Estimated Lesson Time:** ${estimatedTime}

## Educational Context
This content is for ${gradeLevelContext}

## Guidelines for High-Quality Schemas

### Hook Design
Choose the hook type that best fits the content and grade level:
- **scenario**: "Imagine you're..." - Places student in a relatable situation
- **question**: Poses a thought-provoking question they'll want answered
- **surprising_fact**: Shares something unexpected that creates curiosity
- **story**: Brief narrative that introduces the concept naturally

Younger students often respond better to scenarios and stories; older students engage with questions and surprising facts.

### Objective Writing
- Start each objective with a measurable action verb
- Keep objectives achievable within the estimated time
- Progress from lower to higher Bloom's levels when appropriate
- Limit to 3-4 objectives to maintain focus
- Use age-appropriate language

**Verb Categories:**
- identify: Recognize, locate, name, list
- explain: Describe, summarize, interpret, paraphrase
- create: Design, construct, produce, compose
- analyze: Compare, contrast, examine, differentiate
- compare: Match, relate, distinguish, categorize
- apply: Use, demonstrate, solve, implement
- evaluate: Judge, assess, critique, justify

### Prerequisites
- List 2-4 genuine prerequisites (not too many)
- Quick check should be answerable in under 30 seconds
- The hint should scaffold thinking, not give the answer
- Prerequisites should be from recent learning when possible

### Roadmap Design
- Use 3-5 phases typically
- Phase names should be student-friendly
- Each phase should have 1-3 concrete activities
- The progression should feel logical and build confidence

### Connections
- **buildingFrom**: Concepts from previous grades/units that directly support this topic
- **leadingTo**: Where this knowledge goes next in the curriculum
- **realWorld**: Concrete, relatable applications students can visualize

### Mindset Messages
- Acknowledge potential difficulty without being discouraging
- Reference common misconceptions or challenges
- Provide actionable strategies, not just "try hard"
- Match tone to grade level (warmer for younger, more mature for older)

## Grade-Level Calibration

**K-2:**
- Hooks: Simple scenarios, familiar situations (home, playground, family)
- Language: Short sentences, concrete words, avoid abstractions
- Objectives: 2-3 max, focus on identify/explain
- Time: 10-15 minutes typical

**3-5:**
- Hooks: Can include surprising facts, more complex scenarios
- Language: Can introduce some academic vocabulary with context
- Objectives: 3-4, include some create/apply
- Time: 15-25 minutes typical

**6-8:**
- Hooks: Questions, real-world problems, connections to current interests
- Language: Academic vocabulary expected, more sophisticated reasoning
- Objectives: 3-4, include analyze/evaluate
- Time: 20-30 minutes typical

Create an engaging, age-appropriate Intro Briefing that will excite students about learning this topic!`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const result = response.text ? JSON.parse(response.text) : null;

    if (!result) {
      throw new Error('No data returned from Gemini API');
    }

    console.log('📋 Curator Brief Generated from dedicated service:', result);
    return result as IntroBriefingData;
  } catch (error) {
    console.error('Error generating intro briefing:', error);
    throw error;
  }
};
