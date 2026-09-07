import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { resolveEvalModes, constrainChallengeTypeEnum, buildModeConstraintSection, type ChallengeTypeDoc } from '../evalMode';
import { LETTER_WORKSHOP_MODES, isLetterWorkshopMode, type LetterWorkshopMode } from '../../primitives/visual-primitives/literacy/letterWorkshopModes';
import type { GenerationContext } from '../generation/generationContext';
import type { LetterWorkshopData, LetterWorkshopChallenge } from '../../primitives/visual-primitives/literacy/LetterWorkshop';
import { getLetterTemplate } from '../../primitives/visual-primitives/literacy/letterWorkshopGeometry';

// Fork A: Gemini writes the framing only. Every target and its stroke model is
// chosen from the code-owned alphabet. No model-authored geometry is accepted.
const GROUPS = ['satipn', 'satipnckehrmd', 'satipnckehrmdgoulfb', 'satipnckehrmdgoulfbjzwvyxq'];
type LetterCase = 'uppercase' | 'lowercase' | 'both';
export interface LetterWorkshopScope { templateIds: string[]; count: number }

function fail(message: string): never { throw new Error(`Letter Workshop: ${message}`); }

function parseLetters(value: unknown): string[] {
  const tokens = typeof value === 'string' ? value.trim().split(/[\s,;/]+/) : value;
  if (!Array.isArray(tokens) || !tokens.length || tokens.some(token => typeof token !== 'string' || !/^[a-z]$/i.test(token))) {
    fail('letters must be a nonempty list of individual English letters.');
  }
  return Array.from(new Set(tokens as string[]));
}

/** Delimited literal letters only; never split ordinary words into targets. */
function literalLetters(text: string): string[] | undefined {
  const range = /\b([a-z])\s*(?:[-–—]|through|to)\s*([a-z])\b/gi;
  const ranges = Array.from(text.matchAll(range));
  if (ranges.length) {
    return Array.from(new Set(ranges.flatMap(match => {
      const start = match[1].toLowerCase().charCodeAt(0);
      const end = match[2].toLowerCase().charCodeAt(0);
      if (end < start) fail('letter ranges must run in alphabetic order.');
      const uppercase = match[1] === match[1].toUpperCase();
      return Array.from({ length: end - start + 1 }, (_, i) => {
        const letter = String.fromCharCode(start + i);
        return uppercase ? letter.toUpperCase() : letter;
      });
    })));
  }
  const list = /\b(?:letters?|trace|tracing|copy|copying|write|writing|uppercase|lowercase|capital|small)\s+(?:(?:the|letters?|uppercase|lowercase|capital|small)\s+)*["'“‘]?([a-z](?![a-z])(?:["'”’]?(?:\s*[,;/]\s*|\s+and\s+|\s+)["'“‘]?[a-z](?![a-z]))*)/gi;
  const letters = Array.from(text.matchAll(list)).flatMap(match => match[1].replace(/["'“”‘’]/g, '').split(/\s*(?:[,;/]|\band\b)\s*|\s+/).filter(Boolean));
  return letters.length ? Array.from(new Set(letters)) : undefined;
}

export function resolveLetterWorkshopScope(ctx: GenerationContext): LetterWorkshopScope {
  const raw = ctx.raw;
  const signals = [ctx.objective.text, ctx.intent, ctx.title, ctx.topic].filter((s): s is string => Boolean(s));
  const prose = signals.join('\n');
  for (const pin of [ctx.targetEvalMode, raw.challengeType]) {
    if (pin !== undefined && (typeof pin !== 'string' || (pin !== 'mixed' && !pin.split('|').every(isLetterWorkshopMode)))) {
      fail(`unsupported task ${String(pin)}.`);
    }
  }
  const count = raw.challengeCount ?? raw.count ?? 4;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 3 || count > 6) fail('challenge count must be an integer from 3 to 6.');
  const proseGroups = Array.from(prose.matchAll(/\bgroup\s*(\d+)\b/gi)).map(match => Number(match[1]));
  const groups = Array.from(new Set([...(raw.letterGroup === undefined ? [] : [raw.letterGroup]), ...proseGroups]));
  if (groups.some(group => typeof group !== 'number' || !Number.isInteger(group) || group < 1 || group > 4)) fail('letterGroup must be 1, 2, 3, or 4.');
  // Multiple scope ceilings intersect rather than allowing a broader topic to
  // overwrite the objective assigned to this particular primitive.
  const group = groups.length ? Math.min(...groups as number[]) : undefined;
  const explicitCase = raw.letterCase;
  if (explicitCase !== undefined && !['uppercase', 'lowercase', 'both'].includes(String(explicitCase))) fail('invalid letterCase.');
  const hasUpper = /\b(upper\s*case|capital(?:s)?)\b/i.test(prose);
  const hasLower = /\b(lower\s*case|small letters)\b/i.test(prose);
  const proseCase: LetterCase | undefined = hasUpper && hasLower ? 'both' : hasUpper ? 'uppercase' : hasLower ? 'lowercase' : undefined;
  if (explicitCase && proseCase && explicitCase !== 'both' && proseCase !== 'both' && explicitCase !== proseCase) fail('conflicting case constraints.');
  const letterCase = (explicitCase === 'both' ? proseCase ?? explicitCase : explicitCase ?? proseCase) as LetterCase | undefined;
  const constraints = signals.map(literalLetters).filter((letters): letters is string[] => Boolean(letters));
  if (raw.letters !== undefined) constraints.unshift(parseLetters(raw.letters));
  const resolvedCase = letterCase ?? (constraints.length ? undefined : 'both');
  let letters = constraints[0];
  for (const other of constraints.slice(1)) letters = letters.filter(letter => other.some(candidate => candidate.toLowerCase() === letter.toLowerCase()));
  if (constraints.length && !letters.length) fail('letter constraints have no common targets.');
  if (!letters) {
    const pool = GROUPS[group ? group - 1 : /\b(alphabet|all (?:26 )?letters|vowels?|consonants?)\b/i.test(prose) ? 3 : 0];
    letters = Array.from(pool);
    if (/\bvowels?\b/i.test(prose)) letters = letters.filter(letter => 'aeiou'.includes(letter));
    if (/\bconsonants?\b/i.test(prose)) letters = letters.filter(letter => !'aeiou'.includes(letter));
  }
  if (group && letters.some(letter => !GROUPS[group - 1].includes(letter.toLowerCase()))) fail('requested letters fall outside the cumulative letter group.');
  if (!letters.length) fail('scope contains no supported letters.');
  const templateIds = Array.from(new Set(letters.flatMap(letter => {
    const cases: Array<'uppercase' | 'lowercase'> = resolvedCase === 'both' ? ['uppercase', 'lowercase'] : [resolvedCase ?? (letter === letter.toUpperCase() ? 'uppercase' : 'lowercase')];
    return cases.map(casing => `${casing}-${casing === 'uppercase' ? letter.toUpperCase() : letter.toLowerCase()}`);
  })));
  templateIds.forEach(id => getLetterTemplate(id));
  return { templateIds, count };
}

export function selectLetterWorkshopChallenges(scope: LetterWorkshopScope, random: () => number = Math.random, modes: readonly LetterWorkshopMode[] = ['trace']): LetterWorkshopChallenge[] {
  if (!Number.isInteger(scope.count) || scope.count < 3 || scope.count > 6 || !scope.templateIds.length) fail('invalid challenge pool.');
  if (!modes.length || modes.some(mode => !isLetterWorkshopMode(mode))) fail('invalid mode pool.');
  const pool = Array.from(new Set(scope.templateIds));
  pool.forEach(id => getLetterTemplate(id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Cover both cases whenever the selected scope includes both. Dedup until
  // the authorized pool is exhausted; repeated single-letter practice is honest.
  const selected: string[] = [];
  for (const casing of ['uppercase-', 'lowercase-']) {
    const first = pool.find(id => id.startsWith(casing));
    if (first) selected.push(first);
  }
  selected.push(...pool.filter(id => !selected.includes(id)));
  if (pool.length < scope.count) console.info(`[letter-workshop] scope-limited practice: ${pool.length} unique templates across ${scope.count} attempts.`);
  const types = LETTER_WORKSHOP_MODES.filter(mode => modes.includes(mode));
  const pairs = types.flatMap(type => selected.map(templateId => ({ type, templateId })));
  const chosen: Array<{ type: LetterWorkshopMode; templateId: string }> = [];
  // Rotate modes first to guarantee blend/mixed coverage even for three items.
  for (let i = 0; i < scope.count; i++) {
    const type = types[i % types.length];
    const options = pairs.filter(pair => pair.type === type && !chosen.some(ch => ch.type === type && ch.templateId === pair.templateId));
    const templateId = selected[i % selected.length];
    chosen.push(options.find(pair => pair.templateId === templateId) ?? options[0] ?? { type, templateId });
  }
  return chosen.sort((a, b) => types.indexOf(a.type) - types.indexOf(b.type))
    .map((challenge, i) => ({ id: `letter-workshop-${i + 1}`, ...challenge }));
}

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  trace: { promptDoc: '"trace": Follow a visible letter guide with numbered starts and arrows.', schemaDescription: 'assisted tracing' },
  copy: { promptDoc: '"copy": Copy a separate visible model onto blank writing lines.', schemaDescription: 'copy beside model' },
  write: { promptDoc: '"write": Write from an audible letter name and case, with no visible target.', schemaDescription: 'write from listening' },
};
const wrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Brief generic letter practice title, no target letters.' },
    description: { type: Type.STRING, description: 'Neutral encouragement for letter practice; per-item instructions are supplied by code.' },
    challengeType: { type: Type.STRING, enum: [...LETTER_WORKSHOP_MODES] },
  },
  required: ['title', 'description', 'challengeType'],
};

export function validateLetterWorkshopWrapper(value: unknown, allowed: readonly LetterWorkshopMode[] = ['trace']): { title: string; description: string; challengeType: LetterWorkshopMode } {
  if (!value || typeof value !== 'object') fail('missing session wrapper.');
  const wrapper = value as Record<string, unknown>;
  for (const field of ['title', 'description']) {
    if (typeof wrapper[field] !== 'string' || !(wrapper[field] as string).trim() || (wrapper[field] as string).length > 300) fail(`invalid wrapper ${field}.`);
  }
  if (!isLetterWorkshopMode(wrapper.challengeType) || !allowed.includes(wrapper.challengeType)) fail('invalid wrapper task identity.');
  if (allowed.length === 1 && allowed[0] === 'trace' && /\b(copy|independent(?:ly)?|from memory)\b/i.test(`${wrapper.title} ${wrapper.description}`)) fail('wrapper misrepresents assisted tracing.');
  return { title: (wrapper.title as string).trim(), description: (wrapper.description as string).trim(), challengeType: wrapper.challengeType };
}

export async function generateLetterWorkshop(ctx: GenerationContext): Promise<LetterWorkshopData> {
  const scope = resolveLetterWorkshopScope(ctx);
  const resolution = await resolveEvalModes('letter-workshop', {
    targetEvalMode: ctx.targetEvalMode ?? ctx.raw.challengeType as string | undefined,
    intent: ctx.intent ?? ctx.title ?? ctx.topic, objectiveText: ctx.objective.text,
  }, CHALLENGE_TYPE_DOCS);
  const modes = (resolution?.allowedTypes ?? LETTER_WORKSHOP_MODES) as readonly LetterWorkshopMode[];
  const challenges = selectLetterWorkshopChallenges(scope, Math.random, modes);
  const activeSchema = resolution ? constrainChallengeTypeEnum(wrapperSchema, resolution.allowedTypes, CHALLENGE_TYPE_DOCS,
    { fieldName: 'challengeType', rootLevel: true }) : wrapperSchema;
  console.info(`[LetterWorkshop] modes: ${resolution?.modes.map(mode => mode.evalMode).join('+') ?? 'mixed'} (${resolution?.source ?? 'mixed'})`);
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Write generic framing for letter practice. Code owns all targets, stroke models, instructions, and assessment. Never claim handwriting mastery.\nTopic: ${ctx.topic}\nIntent: ${ctx.intent ?? ctx.title ?? ''}\nObjective: ${ctx.objective.text ?? ''}\nGrade: ${ctx.grade ?? ctx.gradeLevel}; ${ctx.gradeContext}\n${buildModeConstraintSection(resolution, CHALLENGE_TYPE_DOCS)}\nWrite a brief neutral title and encouragement without any target letters or mode-specific instructions.`,
    config: { responseMimeType: 'application/json', responseSchema: activeSchema },
  });
  if (!response.text) fail('Gemini returned no session wrapper.');
  let decoded: unknown;
  try { decoded = JSON.parse(response.text); } catch { fail('Gemini returned invalid JSON.'); }
  const wrapper = validateLetterWorkshopWrapper(decoded, modes);
  return { ...wrapper, challengeType: challenges[0].type, challenges, gradeLevel: ctx.grade ?? ctx.gradeLevel,
    componentIntent: ctx.intent ?? ctx.title, objectiveText: ctx.objective.text };
}
