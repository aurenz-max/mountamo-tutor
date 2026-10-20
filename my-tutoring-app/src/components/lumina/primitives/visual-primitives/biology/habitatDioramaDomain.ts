/**
 * habitat-diorama's items, asks, keys, misses and scene: pure, read by the boss (`habitatDiorama.boss.ts`), the
 * component, the lever set, the generator and the oracle.
 *
 * The screen is a living field notebook. Observe, predict and defend are said: one of the choices on screen (a living
 * thing, or an evidence card), judged by the tutor against `habitatKey`. Connect (tap the living thing a relationship
 * leads to) and restore (tap the zone) are checked by the activity, and so is build_habitat (`habitatBuild.ts`, an
 * open build checked at "I'm done!"); they have no key.
 */

import type { ResponseClassId } from '../../../hooks/judgedScriptContract';
import { opensWithSentinel } from '../../../hooks/judgedScriptContract';
import type { JudgedScriptItem } from '../../../hooks/judgedScriptContract';
import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import { containsPhrase, type SpokenKey } from '../../../components/live-activity/spokenKey';
import type { HabitatMiss } from './habitatDiorama.card';
import type {
  HabitatChallenge,
  HabitatChallengeType,
  HabitatDioramaData,
  HabitatZone,
  Organism,
  Relationship,
} from './HabitatDiorama';
import {
  ALL_NEEDS, FEWER_SUFFIX, animalById, buildAsk, fewerNeeds, habitatBuildScene, pieceById, readHabitatBuild, trayFor,
  type HabitatNeed,
} from './habitatBuild';

const TYPES: readonly HabitatChallengeType[] = [
  'observe',
  'connect',
  'predict',
  'restore',
  'defend',
  'build_habitat',
];

const ZONES: readonly HabitatZone[] = [
  'canopy',
  'open-land',
  'water',
  'shoreline',
  'ground',
  'underground',
];

export const ZONE_LABELS: Record<HabitatZone, string> = {
  canopy: 'Canopy', 'open-land': 'Open land', water: 'Open water',
  shoreline: 'Shoreline', ground: 'Ground layer', underground: 'Underground',
};

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
  kind === 'connect' || kind === 'restore' || kind === 'build_habitat' ? 'gesture' : 'voice';

export const responseClassFor = (kind: HabitatChallengeType): ResponseClassId =>
  answerKindFor(kind) === 'gesture' ? 'manipulation' : 'closed_set_choice';

export const actionFor = (kind: HabitatChallengeType): string => ({
  observe: 'name-from-ecological-evidence',
  connect: 'build-ecological-relationship',
  predict: 'predict-population-change',
  restore: 'place-restoration-part',
  defend: 'choose-supporting-evidence',
  build_habitat: 'build-habitat-for-animal',
})[kind];

const roleClue = (role: Organism['role']): string => {
  if (role === 'producer') return 'makes its own food from sunlight';
  if (role === 'decomposer') return 'breaks down dead material and returns nutrients';
  return 'gets energy by eating other living things';
};

/**
 * THE DIRECTION RULE, pinned in one place: `fromId -> toId` follows the flow of
 * ENERGY or BENEFIT. Prey -> predator, host -> parasite, host -> beneficiary.
 * It is also the direction the stage's arrow already draws.
 *
 * This existed nowhere before — not in the type, not in the generator prompt —
 * so the model picked the food-web convention (prey -> predator) while the clue
 * below assumed the opposite, and the 2026-08-21 connect drive had the tutor say
 * "Find Water Lily. Connect it to the living thing it eats." with the key set to
 * Mallard Duck. Five of five live items were inverted, each one contradicted by
 * its own explanation, and every machine gate passed because the key matched the
 * drawing. Defect 8: writing the spoken ask audits the content.
 */
const relationshipClue = (type: Relationship['type']): string => ({
  predation: 'the living thing that eats it',
  'symbiosis-mutualism': 'the partner it helps and gets help from',
  'symbiosis-commensalism': 'the organism that benefits from it without harming it',
  'symbiosis-parasitism': 'the organism that lives on it and harms it',
  competition: 'the organism competing for the same limited resource',
})[type];

/** Trophic rank on the ladder the payload already carries. Decomposers sit off
 * the ladder (they are not predators in this model) and return null. */
const trophicRank = (role: Organism['role']): number | null => ({
  producer: 0,
  'primary-consumer': 1,
  'secondary-consumer': 2,
  'tertiary-consumer': 3,
  decomposer: null,
}[role] as number | null);

/**
 * The gate the prompt alone cannot be trusted to hold. A predation edge is only
 * sayable if the eater really does outrank the eaten: a producer never eats, and
 * a decomposer is not a predator here. Drop rather than degrade — an inverted
 * edge becomes a spoken lie, not a harder question.
 */
export const predationDirectionOk = (prey: Organism, predator: Organism): boolean => {
  const preyRank = trophicRank(prey.role);
  const predatorRank = trophicRank(predator.role);
  if (preyRank === null || predatorRank === null) return false;
  return predatorRank > preyRank;
};

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
  /** build_habitat: the animal (`habitatBuild.ts`), the needs asked, the pieces offered. */
  animalId?: string;
  needs?: HabitatNeed[];
  tray?: string[];
  /** The lesson's tier, stamped on each item (default medium): when connect's model lever comes (`supportFact`). */
  supportTier?: SupportTier;
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

/**
 * build_habitat, the open build: code owns the animal, the needs, the tray, the ask and the explanation, so nothing
 * the model wrote is read. The item is dropped unless every asked need can be met from the tray (buildable) and the
 * tray holds a piece that is not right for the animal (the choice is real).
 */
const buildItemFromChallenge = (
  challenge: HabitatChallenge,
  data: Pick<HabitatDioramaData, 'organisms'>,
  index: number,
): HabitatItem | null => {
  const animal = animalById(challenge.targetAnimal);
  const needs = Array.from(new Set((challenge.needs ?? []).filter((n): n is HabitatNeed => ALL_NEEDS.includes(n))));
  if (!animal || needs.length < 2 || !needs.includes('food') || !needs.includes('water')) return null;
  const id = clean(challenge.id) || `habitat-build_habitat-${index + 1}`;
  const tray = (challenge.trayPieces?.length ? challenge.trayPieces : trayFor(animal, needs, id)).filter(p => pieceById(p));
  if (readHabitatBuild(animal, needs, tray.filter(p => !animal.harmedBy.includes(p))).miss) return null;
  if (tray.every(p => needs.some(n => animal.meets[n].includes(p)))) return null;
  return {
    id,
    kind: 'build_habitat',
    action: actionFor('build_habitat'),
    answerKind: 'gesture',
    responseClass: responseClassFor('build_habitat'),
    prompt: buildAsk(animal, needs),
    explanation: animal.why,
    organismNames: Object.fromEntries((data.organisms ?? []).map((organism) => [organism.id, organism.commonName])),
    answerText: animal.name,
    answerTerms: [],
    optionTexts: [],
    signatureWrong: 'a habitat missing something the animal needs',
    animalId: animal.id,
    needs,
    tray,
  };
};

/**
 * The short form a said name may be answered with: its last word ("heron" for Great Blue Heron) when no other choice
 * has it. Another word of the name is not the name ("rat" is not the Black Rat Snake, "great" is not a heron).
 */
export const headTerm = (item: Pick<HabitatItem, 'kind' | 'answerText' | 'answerTerms'>): string | null => {
  if (item.kind !== 'observe' && item.kind !== 'predict') return null;
  const last = words(item.answerText).at(-1);
  return last && item.answerTerms.includes(last) && last !== item.answerText.toLowerCase() ? last : null;
};

/**
 * A said item whose ask carries the answer's short form (or its plural) is solved by repeating the ask ("Foxes hunt
 * fewer hares" asks for the Snowshoe Hare): dropped, like a prompt that names the whole answer.
 */
const askNamesAnswer = (item: HabitatItem): boolean => {
  const head = headTerm(item);
  return !!head && [head, `${head}s`, `${head}es`].some((form) => containsPhrase(askFor(item), form));
};

const buildItem = (
  challenge: HabitatChallenge,
  data: Pick<HabitatDioramaData, 'organisms' | 'relationships'>,
  index: number,
): HabitatItem | null => {
  if (challenge.type === 'build_habitat') return buildItemFromChallenge(challenge, data, index);
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
    // The spoken clue asserts a direction, so the data must earn it.
    if (relationship.type === 'predation' && !predationDirectionOk(from, to)) return null;
    // One answer: the ask names only the start and the kind of link, so a second link of that kind from the same
    // start is also right, and the check could credit only one of them (RP-7, handoff 20).
    if (data.relationships.some((r) => r.fromId === from.id && r.toId !== to.id && r.type === relationship.type)) return null;
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

export const itemFromChallenge = (
  challenge: HabitatChallenge,
  data: Pick<HabitatDioramaData, 'organisms' | 'relationships'>,
  index = 0,
): HabitatItem | null => {
  const item = buildItem(challenge, data, index);
  return item && !askNamesAnswer(item) ? item : null;
};

/**
 * What the tutor's verdict actually NAMED, which is what a later item would be
 * recalling. For most kinds that is the answer text. Restore is the exception:
 * its answer text is a bare ZONE out of six, but the verdict says "Microscopic
 * Algae belongs in the water zone" — so a later item about a DIFFERENT organism
 * that also lives in the water is a genuine new question, not recall.
 *
 * Keying restore on the zone made five generated challenges collapse to two in
 * the 2026-08-21 drive (three dropped on zone collision alone). Defect 2 is a
 * rule about what was NAMED, and applying it to a six-value answer space starves
 * the session instead of protecting it.
 */
const sessionKeyFor = (item: HabitatItem): string => (
  item.kind === 'restore'
    ? `restore:${item.restorationEntityId ?? item.answerText}`
    : item.kind === 'build_habitat' ? `build:${item.animalId}` : item.answerText.toLowerCase()
);

/** Select rather than blindly truncate, and do not ask for the same spoken
 * answer twice after the tutor has already named it in a verdict. Each item carries the lesson's support tier. */
export const itemsFromChallenges = (
  challenges: readonly HabitatChallenge[],
  data: Pick<HabitatDioramaData, 'organisms' | 'relationships'> & { supportTier?: SupportTier },
  maxItems = 7,
): HabitatBuildResult => {
  const built = challenges.map((challenge, index) => itemFromChallenge(challenge, data, index));
  const kept: HabitatItem[] = [];
  const spokenAnswers = new Set<string>();
  const gestureAnswers = new Set<string>();
  for (const item of built) {
    if (!item) continue;
    const key = sessionKeyFor(item);
    const seen = item.answerKind === 'voice' ? spokenAnswers : gestureAnswers;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ ...item, supportTier: data.supportTier ?? 'medium' });
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
      return `Imagine this change: ${endSentence(item.disruptionEvent ?? '')} Which population will ${item.expectedTrend === 'stay-similar' ? 'stay about the same' : item.expectedTrend}? Say its name.`;
    case 'restore':
      return `Place ${item.organismNames[item.restorationEntityId ?? '']} in the habitat zone where it can best meet its needs.`;
    case 'defend':
      // The generator is told to emit a bare CLAIM and reliably emits an
      // INSTRUCTION instead ("Evaluate the claim that…", "Select the piece of
      // evidence demonstrating that…"). Wrapping either in "Which evidence best
      // supports this claim: … ?" produced a doubly-framed, ungrammatical
      // sentence on every defend item of the 2026-08-21 drives. This phrasing
      // reads correctly for BOTH shapes.
      return `${endSentence(item.prompt)} Say the evidence that fits.`;
    case 'build_habitat':
      // Written by code (`buildAsk`): it names the animal, never its needs.
      return item.prompt;
  }
};

/** Answers that are whole sentences already carry their own full stop. */
const endSentence = (text: string): string => {
  const trimmed = clean(text).replace(/\s+$/, '');
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

export const revealTextFor = (item: HabitatItem): string => item.explanation;

// ── The key and the known misses of a said item ─────────────────────────────

/**
 * A said item's key: the choice's full name or card, a name's short form (`headTerm`), and the tempting wrong choice.
 * A card is said in short or by its number; single words of a card are not accepted (a claim and its cards share
 * words). Null on connect, restore and build_habitat: the activity checks those.
 */
export function habitatKey(item: HabitatItem): SpokenKey | null {
  if (item.answerKind === 'gesture') return null;
  const card = item.kind === 'defend' ? (item.evidenceChoices ?? []).findIndex((c) => c.id === item.correctEvidenceId) + 1 : 0;
  const head = headTerm(item);
  return {
    answer: item.answerText,
    alsoAccept: head ? [head] : [],
    acceptRule: card
      ? `The card's point in the learner's own short words, or its number ("evidence ${card}"), counts.`
      : 'The name alone or inside a short phrase counts.',
    signatureError: `"${item.signatureWrong}", another choice on screen, is wrong.`,
  };
}

/** What a wrong spoken choice shows (handoff 20 Part B). */
export type SpokenHabitatMiss = 'other_choice';

/**
 * observe, predict and defend's known wrong answer: another choice on screen. The build records no relation between
 * a foil and the answer, so the choices are one kind.
 */
export function habitatSpokenMisses(item: HabitatItem): KnownMiss[] {
  if (item.answerKind === 'gesture') return [];
  const others = item.optionTexts.filter(o => o !== item.answerText);
  return others.length ? [{ id: 'other_choice',
    pattern: `The right answer is "${item.answerText}". The learner's answer names another choice on screen: ${others.map(o => `"${o}"`).join(' or ')}.`,
    examples: others.slice(0, 2) }] : [];
}

// ── The scene ───────────────────────────────────────────────────────────────

export interface HabitatView {
  habitatName: string;
  organismNames: string[];
  /** K-2: the learner does not read the names, cards or choices. */
  preReader: boolean;
  /** build_habitat: the pieces the learner has put in, in order. */
  placed?: readonly string[];
}

/** The family's never-say rules: a young child hears names, not trophic words, and no living thing is the villain. */
const NO_JARGON = 'Say each living thing\'s name and what it eats or where it lives; never say producer, consumer, '
  + 'decomposer, herbivore or carnivore.';
const NO_VILLAIN = 'No living thing here is mean or bad; each one is finding its food.';

export function habitatScene(item: HabitatItem, view: HabitatView): WorkspaceScene {
  const animal = item.kind === 'build_habitat' ? animalById(item.animalId) : undefined;
  if (animal) return habitatBuildScene(animal, item.needs ?? [], item.tray ?? [], view.placed ?? []);
  const facts: Record<string, string> = {
    shown: `The ${view.habitatName} habitat with ${view.organismNames.join(', ')}.`.slice(0, 480),
  };
  if (item.kind === 'observe' || item.kind === 'predict') facts.choices = item.optionTexts.join('; ');
  if (item.kind === 'predict' && item.disruptionEvent) facts.change = item.disruptionEvent;
  if (item.kind === 'defend') (item.evidenceChoices ?? []).forEach((c, i) => { facts[`evidence${i + 1}`] = c.text; });
  if (item.kind === 'connect') {
    facts.start = `${item.organismNames[item.fromId ?? '']} is lit up as the start of the connection.`;
    facts.direction = 'A relationship goes from the one eaten or helped to the one that eats it or gets the help.';
  }
  if (item.kind === 'restore') facts.waiting = `${item.organismNames[item.restorationEntityId ?? '']} is off the map, beside six zone buttons: `
    + `${Object.values(ZONE_LABELS).join(', ')}.`;
  facts.constraints = [view.preReader ? NO_JARGON : '', NO_VILLAIN].filter(Boolean).join(' ');
  return { objects: [], facts };
}

// ── The activity's check of a model move ────────────────────────────────────

/** The activity's check of a model move, and how it reads to the tutor and the observer, never the key. */
export const habitatMoveMatches = (item: HabitatItem, move: { toId?: string; zone?: HabitatZone }) =>
  item.kind === 'connect' ? move.toId === item.toId : item.kind === 'restore' && move.zone === item.restorationZone;
export const describeHabitatMove = (item: HabitatItem, move: { toId?: string; zone?: HabitatZone }) =>
  item.kind === 'connect'
    ? `Connected ${item.organismNames[item.fromId ?? ''] ?? 'the start'} to ${item.organismNames[move.toId ?? ''] ?? 'another living thing'}.`
    : `Placed ${item.organismNames[item.restorationEntityId ?? ''] ?? 'the living thing'} in the ${move.zone ? ZONE_LABELS[move.zone] : 'unplaced'} zone.`;

/** What a checked wrong move shows (`HabitatMiss`, the card), from the tap and the habitat's own relationships. */
export function habitatMiss(item: HabitatItem, move: { toId?: string; zone?: HabitatZone },
  relationships: readonly Relationship[]): HabitatMiss | undefined {
  if (habitatMoveMatches(item, move)) return undefined;
  if (item.kind === 'connect') {
    if (!move.toId) return undefined;
    if (relationships.some(r => r.fromId === item.fromId && r.toId === move.toId)) return 'other_kind_link';
    return relationships.some(r => r.fromId === move.toId && r.toId === item.fromId) ? 'leads_to_start' : 'unconnected';
  }
  if (item.kind === 'restore' && move.zone && item.restorationZone) {
    if (move.zone === 'water') return 'water_for_land';
    return item.restorationZone === 'water' ? 'land_for_water' : 'other_land_zone';
  }
  return undefined;
}

// ── The journey harness ─────────────────────────────────────────────────────

/** A tap on a living thing other than the start and the answer (connect), or on another zone (restore). */
export const wrongGestureFor = (item: HabitatItem): string => {
  if (item.kind === 'connect') {
    return Object.keys(item.organismNames).find((id) => id !== item.fromId && id !== item.toId)
      ?? item.fromId
      ?? 'unknown';
  }
  return ZONES.find((zone) => zone !== item.restorationZone) ?? 'ground';
};

/** The label of the button a connect or restore tap presses (its `aria-label`): a living thing's name or a zone's. */
export const habitatTapLabel = (item: HabitatItem, value: string): string =>
  item.kind === 'restore' ? ZONE_LABELS[value as HabitatZone] : item.organismNames[value] ?? value;

/** build_habitat's simplify lever: the same animal, two named needs, its own tray, on an empty scene. */
export function fewerNeedsItem(item: HabitatItem): HabitatItem | null {
  const animal = animalById(item.animalId), needs = fewerNeeds(item.needs ?? []);
  if (item.kind !== 'build_habitat' || !animal || !needs || item.id.endsWith(FEWER_SUFFIX)) return null;
  const id = `${item.id}${FEWER_SUFFIX}`;
  return { ...item, id, needs, prompt: buildAsk(animal, needs, true), tray: trayFor(animal, needs, id) };
}
