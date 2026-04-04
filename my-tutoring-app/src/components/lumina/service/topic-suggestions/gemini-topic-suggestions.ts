import { ai } from '../geminiClient';
import { Type } from '@google/genai';

export type TopicCategory = 'investigate' | 'connect' | 'wonder';

export interface TopicSuggestion {
  topic: string;
  emoji: string;
  hook: string;        // 6-8 word question or provocation that invites reasoning
  category: TopicCategory;
}

const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      topic:    { type: Type.STRING },
      emoji:    { type: Type.STRING },
      hook:     { type: Type.STRING },
      category: { type: Type.STRING, enum: ['investigate', 'connect', 'wonder'] },
    },
    required: ['topic', 'emoji', 'hook', 'category'],
  },
};

export async function generateTopicSuggestions(
  gradeLevel: string,
  count: number = 8,
  previousTopics: string[] = [],
): Promise<TopicSuggestion[]> {
  const excludeClause = previousTopics.length > 0
    ? `Do NOT repeat these topics: ${previousTopics.join(', ')}.`
    : '';

  const prompt = `You are a science-center exhibit designer choosing ${count} hands-on stations for a ${gradeLevel}-level learner.

Every topic must be something the student can DO — simulate, measure, build, test, or argue about — not just read a fun fact.

Categories (aim for roughly equal mix):

"investigate" — topics that map to a concrete experiment or simulation.
  Good: "Build a Bridge That Holds 100 Coins" (testable), "What Shape Egg Is Strongest?" (measurable)
  Bad: "Cool Facts About Bridges" (passive), "The History of Eggs" (trivia)

"connect" — topics that link a familiar everyday experience to the science/math behind it.
  Good: "Why Does Your Voice Sound Weird on Recordings?" (connects experience to acoustics)
  Bad: "How Sound Works" (generic textbook heading)

"wonder" — genuine open questions where the answer requires reasoning, not recall.
  Good: "Could You Outrun a Dinosaur?" (requires estimating, comparing, arguing)
  Bad: "Amazing Dinosaur Facts" (trivia list)

Rules:
- Topic titles should be specific and framed as actions or questions, never as textbook headings
- The "hook" is 6-8 words max — pose a challenge, contradiction, or provocation ("Your bones are stronger than concrete" / "Design a paper airplane that flies backward")
- Topics must be age-appropriate and intellectually honest for ${gradeLevel}
- Prefer topics that cross disciplines (math + science, engineering + art) over single-subject trivia
- A single emoji that captures the topic's energy
${excludeClause}

Return a JSON array of objects with: topic, emoji, hook, category.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.85,
    },
  });

  return JSON.parse(response.text!) as TopicSuggestion[];
}
