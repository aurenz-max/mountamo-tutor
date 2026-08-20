/**
 * Tutor-owned script for habitat-diorama.
 *
 * The screen is a living field notebook: the tutor asks about the ecosystem,
 * the learner either answers aloud or changes the model, and the tutor's own
 * verdict advances the session. Observe, predict, and defend are spoken
 * closed-set choices. Connect and restore are genuine page-work: a relationship
 * or placement is the answer, so those turns stay gesture-driven.
 */

import type {
  JudgedCueSurface,
  JudgedScriptItem,
  ResponseClassId,
} from '../../../hooks/judgedScriptContract';
import { opensWithSentinel } from '../../../hooks/judgedScriptContract';
import type {
  HabitatChallenge,
  HabitatChallengeType,
  HabitatDioramaData,
  HabitatZone,
  Organism,
  Relationship,
} from './HabitatDiorama';

const TYPES: readonly HabitatChallengeType[] = [
  'observe',
  'connect',
  'predict',
  'restore',
  'defend',
];

const ZONES: readonly HabitatZone[] = [
  'canopy',
  'open-land',
  'water',
  'shoreline',
  'ground',
  'underground',
];

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'is', 'it', 'of', 'on',
  'or', 'the', 'this', 'to', 'with', 'would', 'because',
]);

const clean = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const words = (value: string): string[] =>
  value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);

const safeSpokenText = (value: unknown, max = 240): value is string => {
  const text = clean(value);
  return text.length > 0 && text.length <= max && !opensWithSentinel(text);
};

const containsName = (text: string, name: string): boolean =>
  text.toLowerCase().includes(name.toLowerCase());

const organismById = (organisms: readonly Organism[], id?: string): Organism | null =>
  organisms.find((organism) => organism.id === id) ?? null;

const relationshipBetween = (
  relationships: readonly Relationship[],
  fromId?: string,
  toId?: string,
): Relationship | null => relationships.find((relationship) => (
  relationship.fromId === fromId && relationship.toId === toId
)) ?? null;

/** Every displayed option needs a word no other option owns. The child may say
 * that distinguishing short form instead of reciting the whole card. */
export const optionsEarSeparable = (options: readonly string[]): boolean => {
  if (options.length < 2 || options.length > 8) return false;
  const tokenSets = options.map((option) => new Set(
    words(option).filter((word) => word.length > 1 && !STOP_WORDS.has(word)),
  ));
  return tokenSets.every((set, index) => Array.from(set).some((word) => (
    tokenSets.every((other, otherIndex) => otherIndex === index || !other.has(word))
  )));
};

const uniqueTermsFor = (answer: string, options: readonly string[]): string[] => {
  const answerTokens = words(answer).filter((word) => word.length > 1 && !STOP_WORDS.has(word));
  const otherTokens = new Set(
    options.filter((option) => option !== answer).flatMap((option) => words(option)),
  );
  return answerTokens.filter((word) => !otherTokens.has(word));
};

export const answerKindFor = (kind: HabitatChallengeType): 'voice' | 'gesture' =>
  kind === 'connect' || kind === 'restore' ? 'gesture' : 'voice';

export const responseClassFor = (kind: HabitatChallengeType): ResponseClassId =>
  answerKindFor(kind) === 'gesture' ? 'manipulation' : 'closed_set_choice';

export const actionFor = (kind: HabitatChallengeType): string => ({
  observe: 'name-from-ecological-evidence',
  connect: 'build-ecological-relationship',
  predict: 'predict-population-change',
  restore: 'place-restoration-part',
  defend: 'choose-supporting-evidence',
})[kind];

const roleClue = (role: Organism['role']): string => {
  if (role === 'producer') return 'makes its own food from sunlight';
  if (role === 'decomposer') return 'breaks down dead material and returns nutrients';
  return 'gets energy by eating other living things';
};

const relationshipClue = (type: Relationship['type']): string => ({
  predation: 'the living thing it eats',
  'symbiosis-mutualism': 'the partner it helps and gets help from',
  'symbiosis-commensalism': 'the organism it benefits from without harming',
  'symbiosis-parasitism': 'the host it depends on and harms',
  competition: 'the organism competing for the same limited resource',
})[type];

export interface HabitatItem extends JudgedScriptItem {
  kind: HabitatChallengeType;
  prompt: string;
  explanation: string;
  answerText: string;
  answerTerms: string[];
  optionTexts: string[];
  signatureWrong: string;
  focusOrganismId?: string;
  focusRole?: Organism['role'];
  fromId?: string;
  toId?: string;
  relationshipType?: Relationship['type'];
  disruptionEvent?: string;
  expectedTrend?: 'increase' | 'decrease' | 'stay-similar';
  optionOrganismIds?: string[];
  restorationEntityId?: string;
  restorationZone?: HabitatZone;
  evidenceChoices?: Array<{ id: string; text: string }>;
  correctEvidenceId?: string;
  organismNames: Record<string, string>;
}

export interface HabitatBuildResult {
  items: HabitatItem[];
  dropped: number;
}

const candidateOrganismIds = (
  challenge: HabitatChallenge,
  data: Pick<HabitatDioramaData, 'organisms'>,
  answerId: string,
): string[] => {
  const requested = (challenge.optionOrganismIds ?? [])
    .filter((id) => organismById(data.organisms, id));
  const pool = [answerId, ...requested, ...data.organisms.map((organism) => organism.id)];
  return Array.from(new Set(pool)).slice(0, 5);
};

export const itemFromChallenge = (
  challenge: HabitatChallenge,
  data: Pick<HabitatDioramaData, 'organisms' | 'relationships'>,
  index = 0,
): HabitatItem | null => {
  if (!TYPES.includes(challenge.type) || !safeSpokenText(challenge.prompt, 260)
      || !safeSpokenText(challenge.explanation, 320)) return null;

  const organismNames = Object.fromEntries(data.organisms.map((organism) => [
    organism.id,
    organism.commonName,
  ]));
  const base = {
    id: clean(challenge.id) || `habitat-${challenge.type}-${index + 1}`,
    kind: challenge.type,
    action: actionFor(challenge.type),
    answerKind: answerKindFor(challenge.type),
    responseClass: responseClassFor(challenge.type),
    prompt: clean(challenge.prompt),
    explanation: clean(challenge.explanation),
    organismNames,
  } as const;

  if (challenge.type === 'observe') {
    const answer = organismById(data.organisms, challenge.focusOrganismId);
    if (!answer || !safeSpokenText(answer.commonName, 60)) return null;
    const ids = candidateOrganismIds(challenge, data, answer.id);
    const options = ids.map((id) => organismNames[id]).filter(Boolean);
    if (!optionsEarSeparable(options) || containsName(challenge.prompt, answer.commonName)) return null;
    return {
      ...base,
      answerText: answer.commonName,
      answerTerms: uniqueTermsFor(answer.commonName, options),
      optionTexts: options,
      signatureWrong: options.find((option) => option !== answer.commonName) ?? 'another organism',
      focusOrganismId: answer.id,
      focusRole: answer.role,
      optionOrganismIds: ids,
    };
  }

  if (challenge.type === 'connect') {
    const relationship = relationshipBetween(data.relationships, challenge.fromId, challenge.toId);
    const from = organismById(data.organisms, challenge.fromId);
    const to = organismById(data.organisms, challenge.toId);
    if (!relationship || !from || !to || from.id === to.id) return null;
    return {
      ...base,
      answerText: `${from.commonName} to ${to.commonName}`,
      answerTerms: [],
      optionTexts: [],
      signatureWrong: 'a different connection',
      fromId: from.id,
      toId: to.id,
      relationshipType: relationship.type,
    };
  }

  if (challenge.type === 'predict') {
    const answer = organismById(data.organisms, challenge.affectedOrganismId);
    const trend = challenge.expectedTrend;
    if (!answer || !trend || !['increase', 'decrease', 'stay-similar'].includes(trend)
        || !safeSpokenText(challenge.disruptionEvent, 220)
        || containsName(challenge.disruptionEvent ?? '', answer.commonName)) return null;
    const ids = candidateOrganismIds(challenge, data, answer.id);
    const options = ids.map((id) => organismNames[id]).filter(Boolean);
    if (!optionsEarSeparable(options)) return null;
    return {
      ...base,
      answerText: answer.commonName,
      answerTerms: uniqueTermsFor(answer.commonName, options),
      optionTexts: options,
      signatureWrong: options.find((option) => option !== answer.commonName) ?? 'another organism',
      focusOrganismId: answer.id,
      disruptionEvent: clean(challenge.disruptionEvent),
      expectedTrend: trend,
      optionOrganismIds: ids,
    };
  }

  if (challenge.type === 'restore') {
    const entity = organismById(data.organisms, challenge.restorationEntityId);
    const zone = challenge.restorationZone;
    if (!entity || !zone || !ZONES.includes(zone)) return null;
    return {
      ...base,
      answerText: zone,
      answerTerms: [],
      optionTexts: [],
      signatureWrong: 'a different habitat zone',
      restorationEntityId: entity.id,
      restorationZone: zone,
    };
  }

  const choices = (challenge.evidenceChoices ?? [])
    .filter((choice) => safeSpokenText(choice.id, 40) && safeSpokenText(choice.text, 180))
    .slice(0, 4);
  const correct = choices.find((choice) => choice.id === challenge.correctEvidenceId);
  const optionTexts = choices.map((choice) => choice.text);
  if (!correct || !optionsEarSeparable(optionTexts) || containsName(challenge.prompt, correct.text)) return null;
  return {
    ...base,
    answerText: correct.text,
    answerTerms: uniqueTermsFor(correct.text, optionTexts),
    optionTexts,
    signatureWrong: optionTexts.find((option) => option !== correct.text) ?? 'another claim',
    evidenceChoices: choices,
    correctEvidenceId: correct.id,
  };
};

/** Select rather than blindly truncate, and do not ask for the same spoken
 * answer twice after the tutor has already named it in a verdict. */
export const itemsFromChallenges = (
  challenges: readonly HabitatChallenge[],
  data: Pick<HabitatDioramaData, 'organisms' | 'relationships'>,
  maxItems = 7,
): HabitatBuildResult => {
  const built = challenges.map((challenge, index) => itemFromChallenge(challenge, data, index));
  const kept: HabitatItem[] = [];
  const spokenAnswers = new Set<string>();
  const gestureAnswers = new Set<string>();
  for (const item of built) {
    if (!item) continue;
    const key = item.answerText.toLowerCase();
    const seen = item.answerKind === 'voice' ? spokenAnswers : gestureAnswers;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(item);
    if (kept.length >= maxItems) break;
  }
  return { items: kept, dropped: challenges.length - kept.length };
};

export const askFor = (item: HabitatItem): string => {
  switch (item.kind) {
    case 'observe': {
      const clue = item.prompt || (item.focusRole ? roleClue(item.focusRole) : 'fits the clue');
      return `Look across the habitat. ${clue} Which living thing fits that evidence? Say its name.`;
    }
    case 'connect':
      return `Find ${item.organismNames[item.fromId ?? '']}. Connect it to ${relationshipClue(item.relationshipType ?? 'predation')}.`;
    case 'predict':
      return `Imagine this change: ${item.disruptionEvent}. Which population will ${item.expectedTrend === 'stay-similar' ? 'stay about the same' : item.expectedTrend}? Say its name.`;
    case 'restore':
      return `Place ${item.organismNames[item.restorationEntityId ?? '']} in the habitat zone where it can best meet its needs.`;
    case 'defend':
      return `Which evidence best supports this claim: ${item.prompt}? Say the evidence that fits.`;
  }
};

const howToPlayFor = (item: HabitatItem): string => ({
  observe: 'Use the clues in the living scene, then answer with a living thing\'s name. ',
  connect: 'Use your hands to build one relationship on the habitat map. ',
  predict: 'Picture the ecosystem after the change, then answer with a living thing\'s name. ',
  restore: 'Use your hands to place the missing living thing into the best habitat zone. ',
  defend: 'Read or listen to the evidence cards, then say the evidence that best supports the claim. ',
})[item.kind];

const affirmFor = (item: HabitatItem): string => {
  if (item.kind === 'connect') return `Yes, that connection works. ${item.explanation}`;
  if (item.kind === 'restore') return `Yes, that placement helps the habitat recover. ${item.explanation}`;
  return `Yes, ${item.answerText}. ${item.explanation}`;
};

const correctionFor = (item: HabitatItem): string => {
  if (item.kind === 'connect') {
    return `My turn: connect ${item.organismNames[item.fromId ?? '']} to ${item.organismNames[item.toId ?? '']}. ${item.explanation} Your turn: build that connection.`;
  }
  if (item.kind === 'restore') {
    return `My turn: ${item.organismNames[item.restorationEntityId ?? '']} belongs in the ${item.restorationZone} zone. ${item.explanation} Your turn: place it there.`;
  }
  return `My turn: the answer is ${item.answerText}. ${item.explanation} Your turn. ${askFor(item)}`;
};

const acceptClause = (item: HabitatItem): string => {
  const shortForms = item.answerTerms.length > 0
    ? ` Accept the distinguishing short form ${item.answerTerms.map((term) => `"${term}"`).join(' or ')} too.`
    : '';
  return `The correct answer is "${item.answerText}". Accept the full answer alone or inside a short phrase.${shortForms} `
    + `"${item.signatureWrong}" is the tempting wrong answer and must be corrected. `;
};

const judgingContract = (item: HabitatItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner studies the habitat, and their think time is unbounded. `
  + `The choices on screen are the answer set; the learner answers by SAYING one, never by tapping it. `
  + `Never say which choice is right before the learner answers. ${acceptClause(item)}`
  + `If the answer is right, say exactly: "${affirmFor(item)}" and stop there. The verdict ends the turn; add no praise, no next question, and no preview. `
  + `If it is wrong, say exactly: "${correctionFor(item)}" and stop there; use that SAME correction on every wrong answer.`;

const silenceContract = (item: HabitatItem): string =>
  `The quoted line is the ONLY thing you say on this turn; the learner answers with their HANDS on the habitat model, not with their voice, so you then stay completely silent. `
  + `Do not narrate their taps, name the correct ${item.kind === 'connect' ? 'connection' : 'zone'}, or fill the pause. `
  + `You will be told what they built and whether code found a match; only then do you speak.`;

const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, never announce the activity state, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

export const itemCue = (item: HabitatItem, opts: { opening?: boolean; howToPlay?: boolean } = {}): string => {
  const greeting = opts.opening ? 'Hi! Let\'s make this habitat come alive. ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  const contract = item.answerKind === 'gesture' ? silenceContract(item) : judgingContract(item);
  return `[HABITAT_ITEM] Say exactly: "${greeting}${how}${askFor(item)}" ${contract} ${NEVER_PERFORM}`;
};

export const gestureVerdictCue = (
  item: HabitatItem,
  attempt: { fromId?: string; toId?: string; zone?: HabitatZone },
): string => {
  const correct = item.kind === 'connect'
    ? attempt.fromId === item.fromId && attempt.toId === item.toId
    : item.kind === 'restore' && attempt.zone === item.restorationZone;
  const description = item.kind === 'connect'
    ? `${item.organismNames[attempt.fromId ?? 'unknown'] ?? 'one living thing'} to ${item.organismNames[attempt.toId ?? 'unknown'] ?? 'another living thing'}`
    : `${item.organismNames[item.restorationEntityId ?? ''] ?? 'the living thing'} in the ${attempt.zone ?? 'unplaced'} zone`;
  const line = correct ? affirmFor(item) : correctionFor(item);
  return `[HABITAT_GESTURE] The learner committed ${description}. Code computed that it ${correct ? 'MATCHES' : 'does NOT match'} the key. `
    + `Say exactly: "${line}" and stop there. Never add a question of your own and never read bracket tags aloud.`;
};

export const moveOnCue = (
  _item: HabitatItem,
  next: HabitatItem | null,
  opts: { howToPlay?: boolean } = {},
): string => {
  if (!next) return '[HABITAT_MOVE] Say exactly: "Good try. Ecosystems take patient looking, and we will revisit this one another day." Then stop; the activity is over.';
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  const contract = next.answerKind === 'gesture' ? silenceContract(next) : judgingContract(next);
  return `[HABITAT_MOVE] Say exactly: "Good try. ${how}${askFor(next)}" ${contract} ${NEVER_PERFORM}`;
};

export const completeCue = (): string =>
  '[HABITAT_COMPLETE] Say exactly: "You thought like an ecologist today — you looked for connections and consequences. See you next time!" Then stop; the activity is over.';

export const pronounceCue = (item: HabitatItem): string =>
  `[HABITAT_HEAR] The learner asked to hear the question again. Say ONLY this, warmly, then wait: "${askFor(item)}" `
  + 'Add nothing, do not treat anything just heard as an answer, and never say the answer. Never read bracket tags aloud.';

export const stimulusFor = (item: HabitatItem): string => {
  if (item.kind === 'connect') return `the habitat map with ${item.organismNames[item.fromId ?? '']} ready to start a connection; the destination is not named`;
  if (item.kind === 'restore') return `${item.organismNames[item.restorationEntityId ?? '']} waiting beside six habitat zones; the correct zone is not named`;
  if (item.kind === 'predict') return `a disruption card and ${item.optionTexts.length} named populations to compare; the changed population is not marked`;
  if (item.kind === 'defend') return `${item.optionTexts.length} evidence cards supporting or challenging one ecological claim; no card is marked correct`;
  return `${item.optionTexts.length} named living things in one habitat scene; ecological role labels are hidden`;
};

export const revealTextFor = (item: HabitatItem): string => item.explanation;

export interface HabitatHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  tapped?: { correct: string; wrong: string };
  leakTokens: string[];
}

const wrongGestureFor = (item: HabitatItem): string => {
  if (item.kind === 'connect') {
    return Object.keys(item.organismNames).find((id) => id !== item.fromId && id !== item.toId)
      ?? item.fromId
      ?? 'unknown';
  }
  return ZONES.find((zone) => zone !== item.restorationZone) ?? 'ground';
};

/** Answer material for the headless DI drive. Gesture values are IDs/zones,
 * the exact commit material the page sends to `gestureVerdictCue`. */
export const habitatDioramaHarnessAnswers = (item: HabitatItem): HabitatHarnessAnswers => {
  const correctGesture = item.kind === 'connect' ? item.toId : item.restorationZone;
  return {
    correct: item.answerText,
    plainWrong: item.answerKind === 'voice' ? 'I do not know' : wrongGestureFor(item),
    signatureWrong: {
      text: item.signatureWrong,
      why: item.kind === 'predict'
        ? 'a visible population chosen without tracing the disruption through the food web'
        : item.kind === 'defend'
          ? 'a true-looking detail that does not support the ecological claim'
          : 'a plausible living thing or model move that does not match the ecological evidence',
    },
    tapped: item.answerKind === 'gesture' && correctGesture
      ? { correct: correctGesture, wrong: wrongGestureFor(item) }
      : undefined,
    leakTokens: item.answerKind === 'voice' ? [item.answerText] : [],
  };
};

export const habitatDioramaPackBase = (
  items: HabitatItem[],
): JudgedCueSurface<HabitatItem> => ({
  primitiveType: 'habitat-diorama',
  activityLine: 'live direct instruction ecosystem practice — spoken reasoning and hands-on model building',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.kind,
    stimulus: stimulusFor(item),
  }),
});
