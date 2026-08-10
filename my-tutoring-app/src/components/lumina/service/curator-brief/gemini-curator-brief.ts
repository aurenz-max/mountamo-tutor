import { Type, Schema, ThinkingLevel } from "@google/genai";
import { IntroBriefingData } from "../../types";
import { ai } from "../geminiClient";
import { HOOK_VISUAL_THEMES, emojiForHookTheme } from "../../utils/hookVisual";
// Type-only — keeps the client-side auth stack out of this server module.
import type { StudentPersona } from "../studentContext/types";

/**
 * Build the personal-framing block for the brief prompt — WORDS ONLY.
 *
 * Mirrors the manifest's buildStudentVoiceBlock (words-vs-numbers division),
 * but scoped to the brief: the curator brief is the natural place to greet the
 * student by name and tie today's topic to their last session. Returns '' when
 * no persona is given, so the prompt is byte-identical for unpersonalized runs.
 */
const buildBriefVoiceBlock = (
  persona?: StudentPersona | null,
  sessionHandoff?: string | null,
): string => {
  if (!persona && !sessionHandoff) return '';

  const facts: string[] = [];
  if (persona?.firstName) facts.push(`- Name: ${persona.firstName} (greet the student directly by name)`);
  if (persona?.interests?.length) facts.push(`- Interests: ${persona.interests.join(', ')}`);
  if (sessionHandoff) {
    // Mid-session: continuity comes from the block the student JUST finished,
    // minutes ago. Cross-day facts (streak, yesterday's session) read as
    // stale/robotic when the day is already in motion — suppress them.
    facts.push(`- Moments ago, in THIS session: ${sessionHandoff}`);
  } else {
    if ((persona?.currentStreak ?? 0) >= 2) facts.push(`- Learning streak: ${persona?.currentStreak} days running`);
    if (persona?.lastSession?.summary) facts.push(`- Last session: ${persona?.lastSession.summary}`);
  }
  if (facts.length === 0) return '';

  return `

## STUDENT VOICE (personal framing — affects WORDING ONLY)
${facts.join('\n')}

HOW TO USE THE VOICE:
- hook.content: open by greeting the student by name.${sessionHandoff
    ? ' A "Moments ago" fact is present: the student is mid-session and just finished that block — open by handing off from it in one warm phrase (e.g. "Nice work exploring landforms — now let\'s play with word sounds"). Do NOT mention streaks, previous days, or any earlier session: the handoff is the only continuity that belongs here.'
    : ' If a last-session fact is present, connect today\'s topic to it in one short phrase (e.g. "Last time you worked with ten frames — today we build on that"). Acknowledge an active streak in at most one short clause.'}
- mindset.encouragement: you may address the student warmly by name.
- Where an interest fits the topic NATURALLY, you may theme the hook around it — the hook only, and only if it genuinely fits.

VOICE RULES (hard constraints):
- The voice changes WORDING ONLY. It must NEVER change the objectives, prerequisites, the quick-check answer, or the difficulty of the content.
- Use ONLY the facts listed above. NEVER invent details about the student.
- NEVER reveal the quick-check answer, and NEVER mention this block, profiles, or personalization mechanics in any student-facing text.
- Keep it natural: one greeting woven into the hook, not a paragraph about the student.`;
};

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
  estimatedTime: string = '15-20 minutes',
  persona?: StudentPersona | null,
  intent?: string,
  /** Mid-session continuity: what the student finished moments ago (daily
   *  session blocks). Supersedes streak/last-session facts in the voice. */
  sessionHandoff?: string | null
): Promise<IntroBriefingData> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);
  const voiceBlock = buildBriefVoiceBlock(persona, sessionHandoff);

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
          visualTheme: {
            type: Type.STRING,
            enum: [...HOOK_VISUAL_THEMES],
            description: 'The menu theme that best matches the hook. Code attaches the emoji — never write a glyph or a free-form word here.'
          }
        },
        required: ['type', 'content', 'visualTheme']
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

  const prompt = `You are an expert curriculum designer creating engaging lesson plans for a given subject. Your task is to generate an Intro Briefing schema that orients students to new topics by providing context, relevance, clear objectives, and motivation.

Generate an Intro Briefing schema for the following topic:

**Topic:** ${topic}
**Subject:** ${subject}
**Grade Level:** ${gradeLevel}
**Estimated Lesson Time:** ${estimatedTime}${intent ? `
**This Lesson's Specific Focus:** ${intent}
> The broad topic above sets the theme, but THIS briefing must orient the student to the specific focus on this line. Aim the hook, big idea, and objectives at this focus — stay within the range/scope it implies (the grade level is a ceiling, not a target), and never restate the focus verbatim as a quick-check answer.` : ''}

## Educational Context
This content is for ${gradeLevelContext}${voiceBlock}

## Guidelines for High-Quality Schemas

### Hook Design
Choose the hook type that best fits the content and grade level:
- **scenario**: "Imagine you're..." - Places student in a relatable situation
- **question**: Poses a thought-provoking question they'll want answered
- **surprising_fact**: Shares something unexpected that creates curiosity
- **story**: Brief narrative that introduces the concept naturally

Younger students often respond better to scenarios and stories; older students engage with questions and surprising facts.

For **visualTheme**, pick the single menu value closest to what the hook is ABOUT (a hook about counting marbles is \`counting\`, not \`game\`). It is a category label, not student-facing text — the interface renders an icon for it.

### Objective Writing
- Start each objective with a measurable action verb
- Keep objectives achievable within the estimated time
- Use age-appropriate language

**ORDERING — hard rule.** The objectives are TAUGHT in the order you list them, and
each one becomes a block of activities in that sequence. The student meets objective 1
first, so objective 1 must be the one they can succeed at on day one.

Order by these THREE rules, in this priority. Rule 1 beats rule 2, rule 2 beats rule 3.

**RULE 1 — PREREQUISITE FIRST.** When the student cannot do objective X without already
knowing objective Y, Y is listed first — whatever the two verbs are, and whichever is
more concrete. Examples: knowing that the last number counted tells you "how many"
(cardinality) comes BEFORE counting a group to find how many; knowing the sound each
letter makes comes BEFORE blending letters into whole words. If you are unsure whether
one truly requires the other, it is not a prerequisite — go to rule 2.

**RULE 2 — CONCRETE BEFORE THE SYMBOL FOR IT.** With no prerequisite between them: when
one objective has the student work with real or pictured THINGS (objects to count,
sounds to hear, a machine part to move) and another has them work with the WRITTEN
SYMBOL for the same content (numerals, letters, notation, equations), the concrete
objective is listed FIRST — even when its verb sits at a higher Bloom level. A child
must count seven bears before "7" means anything; must hear the sounds in a word before
mapping them to letters.
- Example, and it is the most common failure: "Apply counting to find how many objects
  are in a group" (apply, level 3) comes BEFORE "Identify the numbers 1-10 in order"
  (identify, level 1). Counting real things is concrete; a grid of written numerals is
  abstract. The higher Bloom verb goes first here, and that is correct.
- This applies hardest at K-2 and in any first encounter with a notation, at any grade.
- If both objectives are equally concrete, or the topic has no symbol/thing split
  (naming the parts of a machine you can see, describing what a plant part does), this
  rule is silent — go to rule 3.

**RULE 3 — otherwise, NON-DECREASING Bloom order.** With rules 1 and 2 satisfied, do
not place a lower-level objective after a higher-level one. The most common mistake
this catches is appending a conceptual "explain" objective LAST, after an "apply"
objective: if a lesson needs the student to understand a concept AND use it, the
understanding objective comes first — level (2) before level (3).

**Verb categories, lowest Bloom level to highest:**
- (1) identify — Remember: recognize, locate, name, list
- (2) explain — Understand: describe, summarize, interpret, paraphrase
- (2) compare — Understand: match, relate, distinguish, categorize
- (3) apply — Apply: use, demonstrate, solve, implement
- (4) analyze — Analyze: contrast, examine, differentiate
- (5) evaluate — Evaluate: judge, assess, critique, justify
- (6) create — Create: design, construct, produce, compose

Before you finalize: read objective 1 back and ask whether a student who has never met
this topic could start there today. If objective 1 asks them to recognize a symbol they
have not yet been given a meaning for, you have ordered it wrong — apply rule 2.

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
- Objectives: 2-3 max. Lead with the one where the child DOES something with real or
  pictured things ("apply" is fine and often correct first at this age); symbol
  recognition follows it, never opens.
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
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.7
      },
    });

    const result = response.text ? JSON.parse(response.text) : null;

    if (!result) {
      throw new Error('No data returned from Gemini API');
    }

    // Attach the hook's emoji code-side from the theme the model picked. The
    // model never writes the glyph — asked for one directly it returns a word
    // ("marbles"), which renders as giant text in the brief's text-5xl slot.
    if (result.hook) {
      result.hook.visual = emojiForHookTheme(result.hook.visualTheme, result.hook.type);
      delete result.hook.visualTheme;
    }

    // Stamp the name deterministically (code-side) for the "Prepared for X"
    // header chip — never trust the LLM to emit a reliable UI label.
    if (persona?.firstName) {
      result.preparedFor = persona.firstName;
    }

    console.log('📋 Curator Brief Generated from dedicated service:', result);
    return result as IntroBriefingData;
  } catch (error) {
    console.error('Error generating intro briefing:', error);
    throw error;
  }
};
