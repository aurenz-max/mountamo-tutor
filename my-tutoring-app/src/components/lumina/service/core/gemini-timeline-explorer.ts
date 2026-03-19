/**
 * Timeline Explorer Generator - Horizontal scrollable timeline with event cards.
 *
 * Students explore chronological events, then answer comprehension challenges
 * (identify, order, date, cause_effect).
 *
 * Uses moderately structured Gemini schema with flat challenge fields to avoid
 * malformed nested JSON.
 * Supports eval modes with identify, order, date, cause_effect challenge types.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { TimelineExplorerData } from '../../primitives/visual-primitives/core/TimelineExplorer';
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  identify: {
    promptDoc:
      `"identify": Identify an event from its description. `
      + `Student selects from 4 options.`,
    schemaDescription: "'identify' (identify event from description)",
  },
  order: {
    promptDoc:
      `"order": Drag events into correct chronological sequence. `
      + `Provide 3-5 items that represent timeline events. Student drags them into the right order.`,
    schemaDescription: "'order' (reorder events chronologically)",
  },
  date: {
    promptDoc:
      `"date": Match events to their time periods. `
      + `Student selects from 4 options.`,
    schemaDescription: "'date' (match event to time period)",
  },
  cause_effect: {
    promptDoc:
      `"cause_effect": Connect causes to effects across timeline events. `
      + `Student matches pairs. Provide 3 cause-effect pairs.`,
    schemaDescription: "'cause_effect' (connect causes to effects)",
  },
};

// ---------------------------------------------------------------------------
// Grade-Level Context Helper
// ---------------------------------------------------------------------------

const getGradeLevelContext = (gradeLevel: string): string => {
  const contexts: Record<string, string> = {
    'Toddler': 'toddlers (ages 1-3) — very simple concepts, concrete examples.',
    'Preschool': 'preschool children (ages 3-5) — simple sentences, colorful examples.',
    'Kindergarten': 'kindergarten students (ages 5-6) — clear language, foundational concepts.',
    'Elementary': 'elementary students (grades 1-5) — age-appropriate vocabulary, concrete examples.',
    'Middle School': 'middle school students (grades 6-8) — more complex vocabulary, real-world applications.',
    'High School': 'high school students (grades 9-12) — advanced vocabulary, sophisticated concepts.',
  };
  return contexts[gradeLevel] || contexts['Elementary'];
};

// ---------------------------------------------------------------------------
// Gemini Schema
// ---------------------------------------------------------------------------

const eventSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: "Unique event ID (e.g. 'evt1', 'evt2')" },
    date: { type: Type.STRING, description: "Date or time period label (e.g. '1776', '500 BC', 'March 1969')" },
    sortOrder: { type: Type.NUMBER, description: "Numeric sort order for chronological sorting (1-based)" },
    title: { type: Type.STRING, description: "Short title for the event (3-8 words)" },
    description: { type: Type.STRING, description: "2-3 sentence description of the event and its significance" },
    imagePrompt: { type: Type.STRING, description: "Detailed prompt for AI image generation depicting this event" },
    impact: { type: Type.STRING, description: "Optional: lasting impact or consequence of this event (1 sentence)" },
    connection: { type: Type.STRING, description: "Optional: how this event connects to the next one (1 sentence)" },
  },
  required: ["id", "date", "sortOrder", "title", "description", "imagePrompt"],
};

const challengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: ["identify", "order", "date", "cause_effect"],
      description: "Challenge type",
    },
    question: { type: Type.STRING, description: "The challenge question" },
    // For identify/date (multiple choice)
    option0: { type: Type.STRING, description: "First answer option (for identify/date)" },
    option1: { type: Type.STRING, description: "Second answer option (for identify/date)" },
    option2: { type: Type.STRING, description: "Third answer option (for identify/date)" },
    option3: { type: Type.STRING, description: "Fourth answer option (for identify/date)" },
    correctIndex: { type: Type.NUMBER, description: "Index of correct option 0-3 (for identify/date)" },
    // For order (flat fields for up to 5 items)
    orderItem0Id: { type: Type.STRING, description: "ID for order item 0 (e.g. 'o0')" },
    orderItem0Text: { type: Type.STRING, description: "Text for order item 0" },
    orderItem1Id: { type: Type.STRING, description: "ID for order item 1 (e.g. 'o1')" },
    orderItem1Text: { type: Type.STRING, description: "Text for order item 1" },
    orderItem2Id: { type: Type.STRING, description: "ID for order item 2 (e.g. 'o2')" },
    orderItem2Text: { type: Type.STRING, description: "Text for order item 2" },
    orderItem3Id: { type: Type.STRING, description: "ID for order item 3 (e.g. 'o3')" },
    orderItem3Text: { type: Type.STRING, description: "Text for order item 3" },
    orderItem4Id: { type: Type.STRING, description: "ID for order item 4 (e.g. 'o4')" },
    orderItem4Text: { type: Type.STRING, description: "Text for order item 4" },
    correctOrderCsv: { type: Type.STRING, description: "Comma-separated correct order of IDs (e.g. 'o0,o1,o2,o3')" },
    // For cause_effect (flat fields for up to 3 pairs)
    cause0: { type: Type.STRING, description: "First cause (for cause_effect)" },
    cause1: { type: Type.STRING, description: "Second cause (for cause_effect)" },
    cause2: { type: Type.STRING, description: "Third cause (for cause_effect)" },
    effect0: { type: Type.STRING, description: "First effect (for cause_effect)" },
    effect1: { type: Type.STRING, description: "Second effect (for cause_effect)" },
    effect2: { type: Type.STRING, description: "Third effect (for cause_effect)" },
    correctPairsCsv: { type: Type.STRING, description: "Comma-separated cause-effect index pairs (e.g. '0-0,1-1,2-2')" },
    // Common
    explanation: { type: Type.STRING, description: "Explanation shown after answering (1-2 sentences)" },
    relatedEventId: { type: Type.STRING, description: "Event ID this challenge relates to" },
  },
  required: ["type", "question", "explanation", "relatedEventId"],
};

const summarySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: "1-2 sentence summary of the timeline" },
    keyTheme: { type: Type.STRING, description: "The overarching theme connecting these events" },
    lookingForward: { type: Type.STRING, description: "Optional: what happened next or what to explore further" },
  },
  required: ["text", "keyTheme"],
};

const timeSpanSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    start: { type: Type.STRING, description: "Start date/period of the timeline (e.g. '1750', '500 BC')" },
    end: { type: Type.STRING, description: "End date/period of the timeline (e.g. '1800', '100 AD')" },
  },
  required: ["start", "end"],
};

const timelineExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the timeline (e.g. 'The Age of Exploration')" },
    subtitle: { type: Type.STRING, description: "Short subtitle expanding on the title" },
    overview: { type: Type.STRING, description: "1-2 sentence overview of the timeline" },
    timeSpan: timeSpanSchema,
    events: {
      type: Type.ARRAY,
      items: eventSchema,
      description: "5-8 chronological events",
    },
    summary: summarySchema,
    challenges: {
      type: Type.ARRAY,
      items: challengeSchema,
      description: "3-4 comprehension challenges about the timeline events",
    },
  },
  required: ["title", "subtitle", "overview", "timeSpan", "events", "summary", "challenges"],
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

function validateTimelineExplorerData(raw: any): TimelineExplorerData {
  const title = raw.title || 'Timeline Explorer';
  const subtitle = raw.subtitle || '';
  const overview = raw.overview || '';

  // --- TimeSpan ---
  const timeSpan: TimelineExplorerData['timeSpan'] = {
    start: String(raw.timeSpan?.start || ''),
    end: String(raw.timeSpan?.end || ''),
  };

  // --- Events (5-8) ---
  let events: TimelineExplorerData['events'] = [];
  if (Array.isArray(raw.events)) {
    events = raw.events.slice(0, 8).map((e: any, i: number) => {
      const event: TimelineExplorerData['events'][0] = {
        id: String(e.id || `evt${i + 1}`),
        date: String(e.date || ''),
        sortOrder: typeof e.sortOrder === 'number' ? e.sortOrder : i + 1,
        title: String(e.title || `Event ${i + 1}`),
        description: String(e.description || ''),
        imagePrompt: String(e.imagePrompt || `Event ${i + 1} of ${title}`),
      };
      if (e.impact) event.impact = String(e.impact);
      if (e.connection) event.connection = String(e.connection);
      return event;
    });
  }
  // Pad to minimum 5 events
  while (events.length < 5) {
    const n = events.length + 1;
    events.push({
      id: `evt${n}`,
      date: '',
      sortOrder: n,
      title: `Event ${n}`,
      description: 'Details coming soon.',
      imagePrompt: `Event ${n} of ${title}`,
    });
  }
  // Sort by sortOrder
  events.sort((a, b) => a.sortOrder - b.sortOrder);

  // --- Summary ---
  const summary: TimelineExplorerData['summary'] = {
    text: String(raw.summary?.text || 'Summary coming soon.'),
    keyTheme: String(raw.summary?.keyTheme || 'Key theme to explore.'),
  };
  if (raw.summary?.lookingForward) {
    summary.lookingForward = String(raw.summary.lookingForward);
  }

  // --- Challenges (3-4) ---
  let challenges: NonNullable<TimelineExplorerData['challenges']> = [];
  if (Array.isArray(raw.challenges)) {
    challenges = raw.challenges.slice(0, 4).map((c: any) => {
      const validTypes = ['identify', 'order', 'date', 'cause_effect'];
      const type = validTypes.includes(c.type) ? c.type : 'identify';

      const base = {
        type: type as 'identify' | 'order' | 'date' | 'cause_effect',
        question: String(c.question || 'Question'),
        explanation: String(c.explanation || ''),
        relatedEventId: String(c.relatedEventId || events[0]?.id || 'evt1'),
      };

      if (type === 'identify' || type === 'date') {
        // Reconstruct options array from flat fields
        const options = [
          String(c.option0 || c.options?.[0] || 'Option A'),
          String(c.option1 || c.options?.[1] || 'Option B'),
          String(c.option2 || c.options?.[2] || 'Option C'),
          String(c.option3 || c.options?.[3] || 'Option D'),
        ];
        let correctIndex = typeof c.correctIndex === 'number' ? c.correctIndex : 0;
        if (correctIndex < 0 || correctIndex > 3) correctIndex = 0;
        return { ...base, options, correctIndex };
      }

      if (type === 'order') {
        // Reconstruct orderItems from flat fields
        const orderItems: Array<{ id: string; text: string }> = [];
        for (let i = 0; i < 5; i++) {
          const id = c[`orderItem${i}Id`];
          const text = c[`orderItem${i}Text`];
          if (id && text) {
            orderItems.push({ id: String(id), text: String(text) });
          }
        }
        // Fallback: check if orderItems array exists
        if (orderItems.length === 0 && Array.isArray(c.orderItems)) {
          for (const item of c.orderItems.slice(0, 5)) {
            if (item.id && item.text) {
              orderItems.push({ id: String(item.id), text: String(item.text) });
            }
          }
        }
        // Parse correctOrder from CSV or array
        let correctOrder: string[] = [];
        if (typeof c.correctOrderCsv === 'string') {
          correctOrder = c.correctOrderCsv.split(',').map((s: string) => s.trim()).filter(Boolean);
        } else if (Array.isArray(c.correctOrder)) {
          correctOrder = c.correctOrder.map(String);
        }
        return { ...base, orderItems, correctOrder };
      }

      if (type === 'cause_effect') {
        // Reconstruct causes and effects from flat fields
        const causes: string[] = [];
        const effects: string[] = [];
        for (let i = 0; i < 3; i++) {
          const cause = c[`cause${i}`];
          const effect = c[`effect${i}`];
          if (cause) causes.push(String(cause));
          if (effect) effects.push(String(effect));
        }
        // Fallback: check if arrays exist
        if (causes.length === 0 && Array.isArray(c.causes)) {
          for (const cause of c.causes.slice(0, 3)) {
            causes.push(String(cause));
          }
        }
        if (effects.length === 0 && Array.isArray(c.effects)) {
          for (const effect of c.effects.slice(0, 3)) {
            effects.push(String(effect));
          }
        }
        // Parse correctPairs from CSV or array
        let correctPairs: Array<[number, number]> = [];
        if (typeof c.correctPairsCsv === 'string') {
          correctPairs = c.correctPairsCsv
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
            .map((pair: string) => {
              const [a, b] = pair.split('-').map(Number);
              return [a, b] as [number, number];
            })
            .filter(([a, b]: [number, number]) => !isNaN(a) && !isNaN(b));
        } else if (Array.isArray(c.correctPairs)) {
          correctPairs = c.correctPairs
            .filter((p: any) => Array.isArray(p) && p.length === 2)
            .map((p: any) => [Number(p[0]), Number(p[1])] as [number, number]);
        }
        // Default pairs if none parsed
        if (correctPairs.length === 0 && causes.length > 0) {
          correctPairs = causes.map((_, i) => [i, i] as [number, number]);
        }
        return { ...base, causes, effects, correctPairs };
      }

      return base;
    });
  }
  // Pad to minimum 3 challenges
  while (challenges.length < 3) {
    challenges.push({
      type: 'identify',
      question: 'Which event is described in the timeline?',
      options: ['Event A', 'Event B', 'Event C', 'Event D'],
      correctIndex: 0,
      explanation: 'Review the timeline events for the answer.',
      relatedEventId: events[0]?.id || 'evt1',
    });
  }

  return {
    title,
    subtitle,
    overview,
    timeSpan,
    events,
    summary,
    challenges,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate a TimelineExplorer chronological event exploration.
 *
 * @param topic      - The topic or historical period to explore
 * @param gradeLevel - Grade level string (e.g. "Elementary", "Middle School")
 * @param config     - Optional overrides including targetEvalMode
 */
export const generateTimelineExplorer = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<TimelineExplorerData> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'timeline-explorer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(
        timelineExplorerSchema,
        evalConstraint.allowedTypes,
        CHALLENGE_TYPE_DOCS,
        { arrayName: 'challenges', fieldName: 'type' },
      )
    : timelineExplorerSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `You are a curriculum expert creating an interactive chronological timeline exploration.

TOPIC / HISTORICAL PERIOD: ${topic}
TARGET AUDIENCE: ${gradeLevelContext}

## Your Mission:
Create an engaging, educational timeline about "${topic}" with 5-8 key events that students can explore chronologically.

${challengeTypeSection}

## Content Guidelines:

### Title & Overview
- Title should be clear and engaging (e.g. "The Age of Exploration", "The Story of Flight")
- Subtitle adds context or scope
- Overview is a 1-2 sentence hook

### TimeSpan
- start: The beginning date/period of the timeline
- end: The ending date/period of the timeline

### Events (5-8 items)
- Each event represents a key moment in the timeline
- Events must be in correct chronological order
- id: unique identifier (e.g. "evt1", "evt2")
- date: Date or time period label (e.g. "1776", "500 BC", "March 1969")
- sortOrder: Numeric value for sorting (1, 2, 3, ...)
- title: 3-8 word label for the event
- description: 2-3 sentences explaining what happened and why it matters
- imagePrompt: Detailed description for AI image generation showing this event visually
- impact (optional): Lasting consequence of this event (1 sentence)
- connection (optional): How this event leads to the next one (1 sentence)

### Summary
- text: 1-2 sentence wrap-up of the timeline
- keyTheme: The overarching theme connecting these events
- lookingForward (optional): What happened next or what to explore further

### Challenges (3-4 items)
- Comprehension challenges that test understanding of the timeline events
- Each challenge has a type, question, explanation, and relatedEventId

**Challenge type rules:**

For "identify" challenges:
- Provide option0, option1, option2, option3 (4 multiple choice options)
- Provide correctIndex (0-3)
- Question should ask student to identify an event from its description

For "order" challenges:
- Provide orderItem0Id, orderItem0Text through orderItem4Id, orderItem4Text (3-5 items)
- IDs should be "o0", "o1", etc.
- Provide correctOrderCsv as comma-separated IDs in correct order (e.g. "o0,o1,o2,o3")
- Items describe events that need chronological reordering

For "date" challenges:
- Provide option0, option1, option2, option3 (4 multiple choice options)
- Provide correctIndex (0-3)
- Question should ask student to match an event to its time period

For "cause_effect" challenges:
- Provide cause0, cause1, cause2 (3 causes from timeline events)
- Provide effect0, effect1, effect2 (3 effects, each matching a cause)
- Provide correctPairsCsv as comma-separated index pairs (e.g. "0-0,1-1,2-2")
- Causes and effects should reference real events from the timeline

## Grade-Level Adaptation:
- For K-2: Simple timelines (personal history, seasons, daily routines), 5 events max, very simple language
- For 3-5: Historical events, scientific discoveries, cultural milestones, concrete cause-and-effect
- For 6-8: Complex historical periods, multiple perspectives, connections between events, nuanced analysis

## Critical Rules:
1. Events MUST be in correct chronological order (sortOrder ascending)
2. All content must be historically/factually accurate
3. NEVER reveal challenge answers in event titles or descriptions
4. Challenges must be answerable from the content provided
5. correctIndex must be 0, 1, 2, or 3 — matching the correct option position
6. For order challenges, correctOrderCsv must contain all provided item IDs
7. For cause_effect, correctPairsCsv must have one pair for each cause
8. Mix challenge types for variety (unless constrained by eval mode)
9. Each challenge should reference a specific relatedEventId from the events list

Now generate the Timeline Explorer content.`;

  logEvalModeResolution('TimelineExplorer', config?.targetEvalMode, evalConstraint);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
      },
    });

    if (!response.text) throw new Error("No content generated for timeline-explorer");

    const raw = JSON.parse(response.text);
    const data = validateTimelineExplorerData(raw);

    console.log('[TimelineExplorer] Generated:', {
      topic,
      gradeLevel,
      title: data.title,
      events: data.events.length,
      challenges: data.challenges?.length ?? 0,
    });

    return data;
  } catch (error) {
    console.error("[TimelineExplorer] Generation error:", error);
    throw error;
  }
};
