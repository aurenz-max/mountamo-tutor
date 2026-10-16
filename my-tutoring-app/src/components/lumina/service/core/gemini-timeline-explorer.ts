/**
 * Timeline Explorer generator. Gemini writes the timeline the learner reads: 5-8 events with a date, a title, a
 * description, an impact line, a one-sentence clue that names neither the event's title nor its date, and the later
 * event each one led to (if any). Every check item, option and key is built by code from the events' time order
 * (`timelineExplorerWorkspace.ts`, `buildTimelineItems`): the old schema had the model write each question and its
 * key. The eval mode picks the kinds (explore: identify; order: order and identify; connect: cause_effect and date);
 * `config.difficulty` picks the structure (easy: three far-apart options, three spread cards, two links; hard: options
 * and cards next to each other in time, an extra effect earlier than every cause).
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection, gradeToBand, buildGradeLine } from "../scopeContext";
import type { TimelineExplorerData } from '../../primitives/visual-primitives/core/TimelineExplorer';
import {
  buildTimelineItems, clueLeaks, deckOf, identifiable, linksOf, sessionPlan, TIMELINE_KINDS,
  type TimelineEvent, type TimelineKind, type TimelineTier,
} from '../../primitives/visual-primitives/core/timelineExplorerWorkspace';
import { resolveEvalModeConstraint, logEvalModeResolution, type ChallengeTypeDoc } from '../evalMode';

const CHALLENGE_TYPE_DOCS: Record<TimelineKind, ChallengeTypeDoc> = {
  identify: { promptDoc: 'identify an event from a clue', schemaDescription: 'Which event?' },
  date: { promptDoc: 'say when an event happened', schemaDescription: 'When did it happen?' },
  order: { promptDoc: 'put events in time order', schemaDescription: 'Put them in order' },
  cause_effect: { promptDoc: 'match each cause to the event it led to', schemaDescription: 'Cause and effect' },
};

// ---------------------------------------------------------------------------
// Grade-level context
// ---------------------------------------------------------------------------

function inferGradeLevelFromContext(gradeContext: string): string {
  const g = (gradeContext || '').toLowerCase();
  if (g.includes('toddler')) return 'Toddler';
  if (g.includes('preschool')) return 'Preschool';
  if (g.includes('kindergarten')) return 'Kindergarten';
  if (g.includes('elementary') || g.includes('grades 1-5')) return 'Elementary';
  if (g.includes('middle') || g.includes('grades 6-8')) return 'Middle School';
  if (g.includes('high') || g.includes('grades 9-12')) return 'High School';
  return 'Elementary';
}

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
// Gemini schema: the timeline only (4 object types)
// ---------------------------------------------------------------------------

const eventSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: "Unique event ID: 'evt1', 'evt2', ... in time order" },
    date: { type: Type.STRING, description: "Date or time period label (e.g. '1776', '500 BC', 'March 1969'). Every event has a different date." },
    sortOrder: { type: Type.NUMBER, description: "1-based position in time order" },
    title: { type: Type.STRING, description: "Short title for the event (3-6 words). Every title is different." },
    description: { type: Type.STRING, description: "2-3 sentences: what happened and why it mattered" },
    imagePrompt: { type: Type.STRING, description: "Prompt for an image of this event" },
    impact: { type: Type.STRING, description: "One sentence: the lasting consequence of this event" },
    connection: { type: Type.STRING, description: "One sentence: how this event connects to the next one" },
    clue: { type: Type.STRING, description: "One sentence describing what happened, for a 'which event is this?' question. It uses NO word from this event's title and NO date or year." },
    ledTo: { type: Type.STRING, description: "The id of ONE LATER event on this timeline that this event directly helped cause, or '' if none" },
  },
  required: ["id", "date", "sortOrder", "title", "description", "imagePrompt", "impact", "clue", "ledTo"],
};

const timelineSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the timeline (e.g. 'The Age of Exploration')" },
    subtitle: { type: Type.STRING, description: "Short subtitle expanding on the title" },
    overview: { type: Type.STRING, description: "1-2 sentence overview of the timeline" },
    timeSpan: {
      type: Type.OBJECT,
      properties: {
        start: { type: Type.STRING, description: "Start date/period of the timeline" },
        end: { type: Type.STRING, description: "End date/period of the timeline" },
      },
      required: ["start", "end"],
    },
    events: { type: Type.ARRAY, items: eventSchema, description: "6-8 events in time order" },
    summary: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: "1-2 sentence summary of the timeline" },
        keyTheme: { type: Type.STRING, description: "The overarching theme connecting these events" },
        lookingForward: { type: Type.STRING, description: "Optional: what happened next" },
      },
      required: ["text", "keyTheme"],
    },
  },
  required: ["title", "subtitle", "overview", "timeSpan", "events", "summary"],
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function validateEvents(raw: any): TimelineEvent[] {
  const seen = new Set<string>();
  const events: TimelineEvent[] = (Array.isArray(raw?.events) ? raw.events : []).slice(0, 8).map((e: any, i: number) => {
    let id = String(e?.id || `evt${i + 1}`);
    if (seen.has(id)) id = `evt${i + 1}-${i}`;
    seen.add(id);
    const event: TimelineEvent = {
      id,
      date: String(e?.date || '').trim(),
      sortOrder: typeof e?.sortOrder === 'number' ? e.sortOrder : i + 1,
      title: String(e?.title || '').trim(),
      description: String(e?.description || '').trim(),
      imagePrompt: String(e?.imagePrompt || ''),
    };
    if (e?.impact) event.impact = String(e.impact);
    if (e?.connection) event.connection = String(e.connection);
    if (e?.clue) event.clue = String(e.clue).trim();
    if (e?.ledTo) event.ledTo = String(e.ledTo).trim();
    return event;
  }).filter((e: TimelineEvent) => e.title && e.date && e.description);
  // A ledTo that names no event, itself, or an earlier event is dropped (linksOf ignores it too).
  const deck = deckOf(events);
  for (const e of events) {
    if (e.ledTo && (!deck.byId.has(e.ledTo) || (deck.rank.get(e.ledTo)! <= deck.rank.get(e.id)!))) delete e.ledTo;
  }
  return events;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** What the session needs from the events: enough clue-safe events for identify, enough links for cause_effect. */
function shortfall(events: TimelineEvent[], kinds: TimelineKind[]): string | null {
  if (events.length < 5) return `only ${events.length} usable events`;
  const deck = deckOf(events), plan = sessionPlan(kinds);
  const needIdentify = plan.filter(k => k === 'identify').length;
  if (needIdentify && identifiable(deck).length < needIdentify + 1) {
    return `clues name their event on ${events.filter(e => clueLeaks(deck, e.id)).length} of ${events.length} events`;
  }
  if (plan.includes('cause_effect') && linksOf(deck).length < 3) return `only ${linksOf(deck).length} usable led-to links`;
  return null;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

const normalizeTier = (d?: string): TimelineTier => {
  const t = (d ?? '').toLowerCase().trim();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

export const generateTimelineExplorer = async (ctx: GenerationContext): Promise<TimelineExplorerData> => {
  const { topic } = ctx;
  const config = (ctx.raw ?? {}) as { targetEvalMode?: string; difficulty?: string };
  const bandKey = (ctx.grade && gradeToBand(ctx.grade)) || inferGradeLevelFromContext(ctx.gradeContext);
  const gradeLevelContext = getGradeLevelContext(bandKey);
  const gradeLine = buildGradeLine(ctx.grade);

  const pin = ctx.targetEvalMode ?? config.targetEvalMode;
  const constraint = resolveEvalModeConstraint('timeline-explorer', pin, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('TimelineExplorer', pin, constraint);
  const kinds: TimelineKind[] = constraint
    ? TIMELINE_KINDS.filter(k => constraint.allowedTypes.includes(k))
    : [...TIMELINE_KINDS];
  const tier = normalizeTier(ctx.supportTier ?? config.difficulty);
  const intent = ctx.intent ? `\nLEARNING FOCUS: "${ctx.intent}".` : '';

  const prompt = `You are a curriculum expert writing a chronological timeline that students read before answering questions about it.

TOPIC / HISTORICAL PERIOD: ${topic}${intent}
${buildScopePromptSection(ctx.scope)}
TARGET AUDIENCE: ${gradeLevelContext}
${gradeLine}

Write 6-8 key events about "${topic}" in correct time order. Code will ask the learner to ${kinds.map(k => CHALLENGE_TYPE_DOCS[k].promptDoc).join(', and to ')}, using only what you write here.

For each event:
- id: "evt1", "evt2", ... in time order; sortOrder 1, 2, 3, ...
- date: the date or period; every event has a DIFFERENT date.
- title: 3-6 words; every title is different and names the event plainly.
- description: 2-3 sentences on what happened and why it mattered.
- impact: one sentence on its lasting consequence.
- connection: one sentence on how it connects to the next event.
- clue: one sentence describing what happened, so a learner who read the timeline can tell which event it is. Use NO word from the event's own title and NO date, year or century.
- ledTo: the id of ONE later event on this timeline that this event directly helped cause, or "" if none. Give at least 4 events a ledTo, each pointing to a different later event.

Also write a title, subtitle, overview (1-2 sentences, no dates of individual events), the time span, and a summary with its key theme.

Rules:
1. Events MUST be in correct time order and historically or factually accurate.
2. For K-2, use simple, familiar sequences and very simple language; for 3-5, concrete historical events, discoveries and milestones; for 6-8, more complex periods and connections.
3. A clue never contains a word from its event's title, and never a date.
4. A ledTo always points to a LATER event, and the cause really did lead to it.`;

  let data: TimelineExplorerData | null = null;
  for (let attempt = 1; attempt <= 2 && !data; attempt++) {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: timelineSchema },
    });
    if (!response.text) throw new Error('No content generated for timeline-explorer');
    const raw = JSON.parse(response.text);
    const events = validateEvents(raw);
    const short = shortfall(events, kinds);
    if (short && attempt === 1) { console.warn(`[TimelineExplorer] Regenerating: ${short}`); continue; }
    if (short) console.warn(`[TimelineExplorer] Building with a shortfall: ${short}`);
    const items = buildTimelineItems({ events, kinds, tier, rng: Math.random });
    data = {
      title: String(raw.title || topic || 'Timeline Explorer'),
      subtitle: String(raw.subtitle || ''),
      overview: String(raw.overview || ''),
      timeSpan: { start: String(raw.timeSpan?.start || events[0]?.date || ''), end: String(raw.timeSpan?.end || events.at(-1)?.date || '') },
      events,
      summary: { text: String(raw.summary?.text || ''), keyTheme: String(raw.summary?.keyTheme || ''),
        ...(raw.summary?.lookingForward ? { lookingForward: String(raw.summary.lookingForward) } : {}) },
      challengeTypes: kinds,
      difficulty: tier,
      items,
    };
  }

  console.log('[TimelineExplorer] Generated:', { topic, tier, kinds, title: data!.title, events: data!.events.length, items: data!.items?.map(i => i.id) });
  return data!;
};
