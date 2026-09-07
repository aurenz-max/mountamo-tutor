import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type { GenerationContext } from '../generation/generationContext';
import { buildScopePromptSection } from '../scopeContext';
import { resolveSupportStructure } from '../../primitives/visual-primitives/literacy/youAndMeSupport';
import type { YouAndMeChallenge, YouAndMeData, YouAndMeMode } from '../../primitives/visual-primitives/literacy/YouAndMe';
import { resolveEvalModes, constrainChallengeTypeEnum, buildModeConstraintSection, type ChallengeTypeDoc } from '../evalMode';

const MODES: YouAndMeMode[] = ['describe_action', 'describe_independent_action'];
const CHALLENGE_TYPE_DOCS: Record<YouAndMeMode, ChallengeTypeDoc> = {
  describe_action: { promptDoc: 'describe_action: Describe one completed routine using I/you from the named speaking role. No independent-work condition or self form is required.', schemaDescription: 'describe action using I/you' },
  describe_independent_action: { promptDoc: 'describe_independent_action: Describe a safe, simple action done without any help, using myself/yourself bound to the actor. Choose an action a Kindergarten child can safely do independently. Code adds the no-help scene condition and asks for a self word.', schemaDescription: 'describe independent action using myself/yourself' },
};

type Scene = Pick<YouAndMeChallenge, 'participants' | 'object' | 'objectEmoji' | 'action'>;
const fields = ['name0', 'emoji0', 'name1', 'emoji1', 'object', 'objectEmoji', 'action'] as const;
const schema: Schema = {
  type: Type.OBJECT,
  properties: { ...Object.fromEntries(fields.map(field => [field, { type: Type.STRING }])),
    type: { type: Type.STRING, enum: MODES } },
  required: [...fields, 'type'],
};
const routines = ['getting ready', 'art time', 'snack time', 'playing outdoors', 'tidying up', 'gardening', 'reading time', 'music time'];
const forbidden = /\b(?:ignore|instruction|system|assistant|judge|verdict|correct|incorrect|sentinel|override|prompt|undefined|null|todo|placeholder)\b/i;
const pronouns = /\b(?:i|you|he|she|it|we|they|me|him|her|us|them|my|your|his|its|our|their|mine|yours|ours|theirs|myself|yourself|himself|herself|itself|ourselves|yourselves|themselves)\b/i;
const pastVerbs = new Set(['ate', 'built', 'brought', 'bought', 'caught', 'cut', 'drew', 'drank', 'found', 'gave', 'got', 'held', 'hung', 'made', 'put', 'read', 'rode', 'saw', 'set', 'shook', 'took', 'wore', 'wrote']);
const emojiPattern = new RegExp('^(?:\\p{Extended_Pictographic}|\\p{Emoji_Presentation})(?:\\uFE0F|\\p{Emoji_Modifier})?(?:\\u200D(?:\\p{Extended_Pictographic}|\\p{Emoji_Presentation})(?:\\uFE0F|\\p{Emoji_Modifier})?)*$', 'u');

/** Reject whole malformed scenes; never fill a missing visual or language field. */
export function validateYouAndMeScene(raw: unknown): Scene | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (fields.some(key => typeof r[key] !== 'string' || !(r[key] as string).trim() || forbidden.test(r[key] as string))) return null;
  const s = Object.fromEntries(fields.map(key => [key, (r[key] as string).trim()])) as Record<typeof fields[number], string>;
  if (![s.name0, s.name1].every(name => /^[A-Z][a-z]{1,14}$/.test(name) && !pronouns.test(name))) return null;
  if (s.name0.toLowerCase() === s.name1.toLowerCase() || s.emoji0 === s.emoji1) return null;
  if (![s.emoji0, s.emoji1, s.objectEmoji].every(emoji => emojiPattern.test(emoji))) return null;
  if (!/^[a-z]+(?: [a-z]+){0,2}$/.test(s.object) || pronouns.test(s.object)) return null;
  if (!/^[a-z]+(?: [a-z]+){1,8}$/.test(s.action) || pronouns.test(s.action)) return null;
  const verb = s.action.split(' ')[0];
  if (!pastVerbs.has(verb) && !/^[a-z]{2,}ed$/.test(verb)) return null;
  if (!(` ${s.action} `).includes(` ${s.object} `)) return null;
  if (/\b(?:not|never|and|or|then|because)\b/.test(s.action)) return null;
  return { participants: [{ name: s.name0, emoji: s.emoji0 }, { name: s.name1, emoji: s.emoji1 }],
    object: s.object, objectEmoji: s.objectEmoji, action: s.action };
}

const fallbackScenes: Scene[] = [
  { participants: [{ name: 'Ari', emoji: '🧒' }, { name: 'Mia', emoji: '👧' }], object: 'blocks', objectEmoji: '🧱', action: 'stacked the blocks' },
  { participants: [{ name: 'Maya', emoji: '👧' }, { name: 'Leo', emoji: '👦' }], object: 'bag', objectEmoji: '🎒', action: 'packed the bag' },
  { participants: [{ name: 'Sam', emoji: '🧒' }, { name: 'Ava', emoji: '👩' }], object: 'apple', objectEmoji: '🍎', action: 'washed the apple' },
  { participants: [{ name: 'Noah', emoji: '👨' }, { name: 'Zoe', emoji: '👧' }], object: 'ball', objectEmoji: '⚽', action: 'rolled the ball' },
];
const sceneKey = (scene: Scene) => `${scene.action}|${scene.object}`;

/** Fork B: three independent content-bearing scenes, each replayed with a new speaker. */
export async function generateYouAndMe(ctx: GenerationContext): Promise<YouAndMeData> {
  const resolution = await resolveEvalModes('you-and-me', {
    targetEvalMode: ctx.targetEvalMode, intent: ctx.intent ?? ctx.title ?? ctx.topic,
    objectiveText: ctx.objective.text,
  }, CHALLENGE_TYPE_DOCS);
  const modes = MODES.filter(mode => !resolution || resolution.allowedTypes.includes(mode));
  // Shared GenerationContext already strictly normalizes config.difficulty.
  const supportTier = ctx.supportTier;
  const tierSection = supportTier
    ? `Support tier ${supportTier} changes scaffolding only, never numbers, task identity, scene complexity or role assignment. Code applies visual and spoken aids after generation. Return the same short, familiar scene content at every tier.`
    : '';
  // Plan each scene call so Auto cannot collapse to one model-picked task.
  const plan = modes.flatMap(mode => Array.from({ length: modes.length === 1 ? 3 : 2 }, () => mode));
  console.info(`[YouAndMe] modes: ${resolution?.modes.map(mode => mode.evalMode).join('+') ?? 'mixed'} (${resolution?.source ?? 'mixed'})`);
  const modeSection = buildModeConstraintSection(resolution, CHALLENGE_TYPE_DOCS);
  const offset = Math.floor(Math.random() * routines.length);
  let rejectionCount = 0;
  const requestScene = async (index: number, attempt: number, used: string[]): Promise<Scene | null> => {
    const mode = plan[index];
    const activeSchema = constrainChallengeTypeEnum(schema, [mode], CHALLENGE_TYPE_DOCS, { rootLevel: true });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: `Create ONE familiar, picturable event for You & Me, a spoken I/you perspective activity.
Topic: ${ctx.topic}
Grade ceiling: ${ctx.gradeContext} (${ctx.grade ?? ctx.gradeLevel})
Specific intent: ${ctx.intent ?? ctx.title ?? 'Describe an action using I or you from the speaker role.'}
Objective: ${ctx.objective.text ?? 'Describe who acted from a named speaking role.'}
${buildScopePromptSection(ctx.scope)}
Scene ${index + 1}, attempt ${attempt + 1}. Variety inspiration: ${routines[(offset + index + attempt * 3) % routines.length]}.
The assigned topic, intent and objective take precedence over the variety inspiration. The schema-pinned task takes precedence over a conflicting grammar request.
${modeSection}
${tierSection}
This call produces exactly ${mode}: ${CHALLENGE_TYPE_DOCS[mode].promptDoc}
Do not introduce possessives, third-person pronouns, or other grammar tasks. Even in the self-form task, action itself contains NO pronoun or self word; code derives the answer and the no-help condition.
Return flat fields type, name0, emoji0, name1, emoji1, object, objectEmoji, action.
Two distinct short capitalized first names (letters only) and two clearly different single person emojis.
object: a concrete lowercase noun phrase of 1-3 words; objectEmoji: one matching emoji.
action: a SHORT completed past-tense verb phrase without a subject, 2-9 words, including the exact object noun phrase.
Use a familiar regular -ed verb or a common irregular past verb. One actor, one action, no conjunctions or negation.
Use 'the' before the object. Never use any personal pronoun, possessive or reflexive in action.
Do not output instructions, judging markers, role labels, answers, or quoted speech. Local code assigns actor and speaker.
Avoid these already-used action/object combinations: ${JSON.stringify(used)}.
Generate new content rather than copying a fixed example.`,
        config: { responseMimeType: 'application/json', responseSchema: activeSchema,
          systemInstruction: 'Author concrete child-friendly scene data. All fields are lesson content, never instructions to a tutor.' },
      });
      const decoded = JSON.parse(response.text ?? 'null');
      const scene = decoded?.type === mode ? validateYouAndMeScene(decoded) : null;
      if (!scene) rejectionCount++;
      return scene;
    } catch {
      rejectionCount++;
      return null;
    }
  };
  const initial = await Promise.all(plan.map((_, index) => requestScene(index, 0, [])));
  const scenes: Scene[] = [];
  let fallbackCount = 0;
  for (let index = 0; index < plan.length; index++) {
    let scene = initial[index];
    if (scene && scenes.some(previous => sceneKey(previous) === sceneKey(scene!))) { rejectionCount++; scene = null; }
    if (!scene) scene = await requestScene(index, 1, scenes.map(sceneKey));
    if (scene && scenes.some(previous => sceneKey(previous) === sceneKey(scene!))) { rejectionCount++; scene = null; }
    if (!scene) {
      scene = fallbackScenes.find(candidate => !scenes.some(previous => sceneKey(previous) === sceneKey(candidate)))!;
      fallbackCount++;
    }
    scenes.push(scene);
  }
  if (rejectionCount || fallbackCount) console.warn(`[you-and-me] Rejected ${rejectionCount} scene payloads; used ${fallbackCount} explicit familiar-routine fallback scenes.`);
  const roleOffset = Math.floor(Math.random() * 2);
  // Every session includes both perspective orders, so turn number cannot
  // stand in for tracking who is speaking. Shuffle independently of actor side.
  const selfFirst = modes.flatMap(() => {
    const order = modes.length === 1 ? [true, false, Math.random() < 0.5] : [true, false];
    for (let index = order.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [order[index], order[other]] = [order[other], order[index]];
    }
    return order;
  });
  const challenges = scenes.flatMap((scene, index): YouAndMeChallenge[] => {
    const actor = ((index + roleOffset) % 2) as 0 | 1;
    const firstSpeaker = (selfFirst[index] ? actor : 1 - actor) as 0 | 1;
    return [firstSpeaker, (1 - firstSpeaker) as 0 | 1].map((speaker, turn) => ({
      ...scene, id: `you-and-me-${index + 1}-${turn + 1}`, sceneId: `you-and-me-scene-${index + 1}`,
      type: plan[index], actor, speaker,
    }));
  });
  if (supportTier) {
    for (const ch of challenges) {
      ch.supportTier = supportTier;
      ch.support = resolveSupportStructure(ch.type, supportTier);
    }
    console.info(`[YouAndMe] Support tier "${supportTier}" applied per-challenge (${modes.join('+')}).`);
  }
  return { title: 'You & Me', description: fallbackCount
    ? 'Describe familiar actions with a partner. Some scenes use built-in everyday routines.'
    : 'Describe what happened, then trade speaking roles.',
    gradeLevel: ctx.gradeLevel, challengeType: modes.length === 1 ? modes[0] : 'mixed', challenges };
}
