/**
 * habitat-diorama's in-item levers, one lever set by type (`HABITAT_LEVERS`, `components/live-activity/bossLevers.ts`;
 * `/add-support-tiers` class sweeps 2026-10-08/09, report qa/eval-reports/habitat-diorama-levers-2026-10-08.md). No
 * real-learner evidence: the misses are what `habitatSpokenMisses`, `habitatMiss` and `readHabitatBuild` name.
 *
 * observe (a spoken choice of a living thing from a clue)
 * - `food_lines` (help): draws every relationship in the habitat as an arrow, the way the explore view does. Answers
 *   `other_choice`. Leak rule: every relationship is drawn, never a subset; refused when every relationship touches the
 *   answer (the lines would single it out) or there are none.
 * - `easier_clue` (simplify): an ungraded observe item first, two choices and a plain role clue about a living thing
 *   of another role; the stuck item's answer is neither its answer nor a choice. Then the full item.
 * connect (tap the living thing a relationship from the lit start leads to)
 * - `direction_model` (help): a model pair beside the habitat, two pictures no living thing on screen uses, the arrow
 *   pointing the way the asked kind of relationship goes. Answers `leads_to_start`, `other_kind_link`.
 * - `start_lines` (help): plain lines, no arrowheads, from the start to every living thing it has a relationship
 *   with. Answers `unconnected`. Leak rule: offered only when the start has two or more partners, so no single line
 *   is the answer; the lines carry no direction and no kind.
 * - `easier_link` (simplify): an ungraded connect item first, from another start, never touching the stuck item's
 *   answer, of a plainer shape (a predation link, a start with fewer partners). Then the full item.
 *
 * predict, restore, defend (class sweep 2026-10-09, same report):
 * - predict `change_mark` (help): a ring on the habitat around each living thing the change names. Never the answer
 *   (the build gate keeps it out of the change text, and the ring skips it anyway); refused when the change names none.
 * - predict / defend `food_lines` (help): the observe lever, same leak rule.
 * - predict `easier_change` (simplify): an ungraded one-step predict first: every one of a predator leaves, which
 *   population will increase; two choices, its prey and a living thing three or more links from the predator. Never
 *   the stuck answer, a living thing the stuck change names, or the stuck change. Then the full item.
 * - restore `zone_pictures` (help): a picture on each of the six zone buttons, all six alike, none marked.
 * - restore `its_partners` (help): rings around the living things the missing one has a relationship with. No zone is
 *   drawn on the habitat, so no ring names one; refused when it has no partner on the map.
 * - restore `body_clues` (help): the missing one's adaptations beside it, dropping any that names a zone or a place
 *   word; refused when none is left.
 * - restore has no simplify: no other living thing carries a zone in the data, and a two-zone copy is the stuck item.
 * - defend `card_pictures` (help): each evidence card shows the pictures of the living things it names. Refused when
 *   only the key card would get a picture, or when the key card is the only one sharing a living thing with the claim.
 * - defend `easier_claim` (simplify): an ungraded two-card defend first, written by code from one eating link of
 *   living things the stuck item never names ("The X needs other living things for its food.") against a
 *   true-looking card that does not support it. Then the full item.
 * build_habitat (the open build, `habitatBuild.ts`): `needs_list` (legend), `piece_tags` (marks), `fewer_needs` (easier).
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { HABITAT_MISSES } from './habitatDiorama.card';
import type { HabitatChallenge, HabitatZone, Organism, Relationship } from './HabitatDiorama';
import { ZONE_LABELS, fewerNeedsItem, itemFromChallenge, predationDirectionOk, type HabitatItem } from './habitatDioramaDomain';
import { FEWER_NEEDS_LEVER, NEEDS_LIST_LEVER, PIECE_TAGS_LEVER } from './habitatBuild';

export const FOOD_LINES_LEVER = 'food_lines';
export const EASIER_CLUE_LEVER = 'easier_clue';
export const DIRECTION_MODEL_LEVER = 'direction_model';
export const START_LINES_LEVER = 'start_lines';
export const EASIER_LINK_LEVER = 'easier_link';
export const CHANGE_MARK_LEVER = 'change_mark';
export const EASIER_CHANGE_LEVER = 'easier_change';
export const ZONE_PICTURES_LEVER = 'zone_pictures';
export const ITS_PARTNERS_LEVER = 'its_partners';
export const BODY_CLUES_LEVER = 'body_clues';
export const CARD_PICTURES_LEVER = 'card_pictures';
export const EASIER_CLAIM_LEVER = 'easier_claim';
export const SIMPLER_SUFFIX = '~simpler';
export const isSimplerItem = (id: string) => id.endsWith(SIMPLER_SUFFIX);

type HabitatData = { organisms: readonly Organism[]; relationships: readonly Relationship[] };

/** The picture a living thing gets on the habitat (moved here from the component so the levers can read it). */
export const organismEmoji = (organism: Pick<Organism, 'commonName' | 'imagePrompt' | 'role'>): string => {
  const name = `${organism.commonName} ${organism.imagePrompt}`.toLowerCase();
  if (organism.role === 'producer' || /tree|plant|grass|flower|algae/.test(name)) return '🌿';
  if (organism.role === 'decomposer' || /fung|mushroom|worm|bacter/.test(name)) return '🍄';
  if (/fish|shark|salmon|trout/.test(name)) return '🐟';
  if (/bird|owl|eagle|robin|raven/.test(name)) return '🦉';
  if (/bee|insect|butterfly|ant/.test(name)) return '🐝';
  if (/frog|toad/.test(name)) return '🐸';
  if (/bear/.test(name)) return '🐻';
  if (/wolf|fox|coyote/.test(name)) return '🦊';
  if (/deer|elk|antelope/.test(name)) return '🦌';
  if (/rabbit|hare/.test(name)) return '🐇';
  return organism.role === 'tertiary-consumer' ? '🦁' : '🐾';
};

// ── observe ─────────────────────────────────────────────────────────────────

/** `food_lines` leak rule: the arrows drawn are every relationship, and they must not all touch the answer. */
export function foodLinesLeak(item: HabitatItem, relationships: readonly Relationship[]): boolean {
  if (!FOOD_LINES_KINDS.includes(item.kind) || !relationships.length) return true;
  // defend's answer is a card, not a living thing: no arrow can single it out.
  if (item.kind === 'defend') return false;
  return relationships.every(r => r.fromId === item.focusOrganismId || r.toId === item.focusOrganismId);
}
/** The kinds `food_lines` serves: observe and predict (the answer is a living thing), defend (the arrows are evidence). */
export const FOOD_LINES_KINDS: readonly HabitatItem['kind'][] = ['observe', 'predict', 'defend'];

type RoleGroup = 'makes' | 'eats' | 'breaks';
const groupOf = (role: Organism['role']): RoleGroup =>
  role === 'producer' ? 'makes' : role === 'decomposer' ? 'breaks' : 'eats';
/** The plain role clue, in child words (no producer, consumer or decomposer). */
export const PLAIN_CLUE: Record<RoleGroup, string> = {
  makes: 'It makes its own food from sunlight.',
  eats: 'It gets its food by eating other living things.',
  breaks: 'It breaks down dead plants and animals.',
};

/**
 * The easier observe item: a plain role clue about a living thing whose role differs from the stuck answer's, and
 * two choices, the other of a third role-group where it can. Null when the item already has two choices or the
 * habitat has no such pair. The stuck answer is never the answer or a choice.
 */
export function easierObserveItem(item: HabitatItem | null, data: HabitatData): HabitatItem | null {
  if (item?.kind !== 'observe' || isSimplerItem(item.id) || item.optionTexts.length <= 2 || !item.focusRole) return null;
  const stuckGroup = groupOf(item.focusRole);
  const pool = data.organisms.filter(o => o.id !== item.focusOrganismId && o.commonName !== item.answerText);
  const names = Object.fromEntries(data.organisms.map(o => [o.id, o.commonName]));
  for (const focus of pool.filter(o => groupOf(o.role) !== stuckGroup)) {
    const clue = PLAIN_CLUE[groupOf(focus.role)];
    if (clue === item.prompt) continue;
    const foils = pool.filter(o => o.id !== focus.id && groupOf(o.role) !== groupOf(focus.role))
      .sort((a, b) => Number(groupOf(a.role) === stuckGroup) - Number(groupOf(b.role) === stuckGroup));
    for (const foil of foils) {
      const challenge: HabitatChallenge = { id: `${item.id}${SIMPLER_SUFFIX}`, type: 'observe', prompt: clue,
        explanation: `The ${focus.commonName}: ${clue.replace(/^It /, 'it ')}`, focusOrganismId: focus.id,
        optionOrganismIds: [focus.id, foil.id] };
      const built = itemFromChallenge(challenge, { organisms: [focus, foil], relationships: [...data.relationships] });
      if (built && !simplerLeaks(item, built)) return { ...built, organismNames: names };
    }
  }
  return null;
}

// ── connect ─────────────────────────────────────────────────────────────────

/** Two pictures and which way the arrow goes, per kind of relationship: the giver first, the arrow toward the taker. */
const MODEL_PAIRS: Record<Relationship['type'], ReadonlyArray<readonly [string, string]>> = {
  predation: [['🌾', '🐄'], ['🍎', '🐛'], ['🐛', '🐔']],
  'symbiosis-mutualism': [['🌸', '🐝'], ['🌻', '🦋']],
  'symbiosis-commensalism': [['🌳', '🐿️'], ['🌳', '🐦']],
  'symbiosis-parasitism': [['🐕', '🦟'], ['🐄', '🦟']],
  competition: [['🐄', '🐑'], ['🐔', '🦆']],
};
/** What the model's arrow means, in child words (shown above grade 2; voiced by the tutor below). */
export const MODEL_CAPTION: Record<Relationship['type'], string> = {
  predation: 'The arrow goes from the one that is eaten to the one that eats it.',
  'symbiosis-mutualism': 'The arrow goes from one partner to the partner it helps.',
  'symbiosis-commensalism': 'The arrow goes from the one that gives to the one that gets help.',
  'symbiosis-parasitism': 'The arrow goes from the host to the one that lives on it.',
  competition: 'The arrow goes from one to the one that wants the same food or space.',
};

/** `direction_model` leak rule: neither picture is one a living thing on screen wears. Null when every pair clashes. */
export function directionModel(type: Relationship['type'] | undefined, shown: readonly string[]): readonly [string, string] | null {
  if (!type) return null;
  return MODEL_PAIRS[type].find(pair => pair.every(p => !shown.includes(p))) ?? null;
}

/** `start_lines`: the partners of the start, either direction. Offered only with two or more (one line would be the answer). */
export function startPartners(item: HabitatItem, relationships: readonly Relationship[]): string[] {
  if (item.kind !== 'connect' || !item.fromId) return [];
  const ids = relationships.flatMap(r => r.fromId === item.fromId ? [r.toId] : r.toId === item.fromId ? [r.fromId] : []);
  const partners = Array.from(new Set(ids)).filter(id => id !== item.fromId);
  return partners.length >= 2 ? partners : [];
}

const degree = (id: string, relationships: readonly Relationship[]) =>
  new Set(relationships.flatMap(r => r.fromId === id ? [r.toId] : r.toId === id ? [r.fromId] : [])).size;
/** How hard a connect ask is: another kind than eating first, then how many partners the start has. */
const linkShape = (type: Relationship['type'], fromId: string, relationships: readonly Relationship[]) =>
  (type === 'predation' ? 0 : 100) + degree(fromId, relationships);

/**
 * The easier connect item: from another start, of a plainer shape than the stuck one, touching neither the stuck
 * start's destination nor starting where the stuck item starts. Null when no link is plainer.
 */
export function easierConnectItem(item: HabitatItem | null, data: HabitatData): HabitatItem | null {
  if (item?.kind !== 'connect' || isSimplerItem(item.id) || !item.fromId || !item.toId || !item.relationshipType) return null;
  const rs = data.relationships;
  const stuck = linkShape(item.relationshipType, item.fromId, rs);
  const candidates = rs
    .filter(r => r.fromId !== item.fromId && r.fromId !== item.toId && r.toId !== item.toId)
    .map(r => ({ r, shape: linkShape(r.type, r.fromId, rs) }))
    .filter(c => c.shape < stuck)
    .sort((a, b) => a.shape - b.shape);
  for (const { r } of candidates) {
    const from = data.organisms.find(o => o.id === r.fromId), to = data.organisms.find(o => o.id === r.toId);
    if (!from || !to) continue;
    const description = r.description?.trim() && r.description.length <= 300 ? r.description.trim() : `${from.commonName} to ${to.commonName}.`;
    const challenge: HabitatChallenge = { id: `${item.id}${SIMPLER_SUFFIX}`, type: 'connect', prompt: 'Make the connection.',
      explanation: description, fromId: r.fromId, toId: r.toId };
    const built = itemFromChallenge(challenge, data as never);
    if (built && !simplerLeaks(item, built)) return built;
  }
  return null;
}

/** The code check on a simpler item: never the stuck item, never its answer, never its answer as a choice. */
export function simplerLeaks(stuck: HabitatItem, simpler: HabitatItem): boolean {
  if (simpler.id === stuck.id || simpler.kind !== stuck.kind) return true;
  if (stuck.kind === 'observe') return simpler.focusOrganismId === stuck.focusOrganismId
    || simpler.optionTexts.includes(stuck.answerText) || simpler.prompt === stuck.prompt;
  if (stuck.kind === 'predict') return simpler.focusOrganismId === stuck.focusOrganismId
    || simpler.optionTexts.includes(stuck.answerText) || simpler.disruptionEvent === stuck.disruptionEvent
    || namedIds(stuck.disruptionEvent ?? '', stuck.organismNames).includes(simpler.focusOrganismId ?? '');
  if (stuck.kind === 'defend') {
    // The simpler item names no living thing the stuck claim or any stuck card names: its card cannot restate the key.
    const stuckNames = new Set(namedIds(`${stuck.prompt} ${stuck.optionTexts.join(' ')}`, stuck.organismNames));
    return simpler.prompt === stuck.prompt || simpler.optionTexts.some(t => stuck.optionTexts.includes(t))
      || namedIds(`${simpler.prompt} ${simpler.optionTexts.join(' ')}`, simpler.organismNames).some(id => stuckNames.has(id));
  }
  return simpler.fromId === stuck.fromId || simpler.toId === stuck.toId || simpler.fromId === stuck.toId;
}

// ── names in text ───────────────────────────────────────────────────────────

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * The living things a text names: the full common name, or its last word (the head noun: "Red Fox" names fox, foxes).
 * Over-matching is safe for every use here: a lever draws more alike, and the leak rules run on the result.
 */
export function namedIds(text: string, names: Readonly<Record<string, string>>): string[] {
  const t = ` ${text.toLowerCase()} `;
  return Object.entries(names).filter(([, name]) => {
    const full = name.toLowerCase().trim();
    const head = (full.split(/\s+/).at(-1) ?? '').replace(/[^a-z]/g, '');
    return (!!full && t.includes(full))
      || (head.length >= 3 && new RegExp(`[^a-z]${escapeRe(head)}(s|es)?[^a-z]`).test(t));
  }).map(([id]) => id);
}

// ── predict ─────────────────────────────────────────────────────────────────

/** `change_mark`: the living things the change names, never the answer. Empty means refused. */
export function changeMarks(item: HabitatItem): string[] {
  if (item.kind !== 'predict' || !item.disruptionEvent) return [];
  return namedIds(item.disruptionEvent, item.organismNames).filter(id => id !== item.focusOrganismId);
}

/** Links between two living things on the web, either direction (Infinity when not joined). */
function linkDistance(fromId: string, toId: string, relationships: readonly Relationship[]): number {
  const seen = new Map<string, number>([[fromId, 0]]);
  const queue = [fromId];
  while (queue.length) {
    const at = queue.shift()!;
    for (const r of relationships) {
      const next = r.fromId === at ? r.toId : r.toId === at ? r.fromId : null;
      if (next && !seen.has(next)) { seen.set(next, seen.get(at)! + 1); queue.push(next); }
    }
  }
  return seen.get(toId) ?? Infinity;
}

/**
 * The easier predict item: one step. Every one of a predator leaves; its prey increases. Two choices: the prey and a
 * living thing three or more links from the predator (so not next to the prey either, and it does not increase too).
 * Never the stuck answer, a living thing the stuck change names, or the stuck change. Null when the item has two
 * choices already or the web has no such link.
 */
export function easierPredictItem(item: HabitatItem | null, data: HabitatData): HabitatItem | null {
  if (item?.kind !== 'predict' || isSimplerItem(item.id) || item.optionTexts.length <= 2) return null;
  const avoid = new Set([item.focusOrganismId, ...namedIds(item.disruptionEvent ?? '', item.organismNames)]);
  const byId = (id: string) => data.organisms.find(o => o.id === id);
  const names = Object.fromEntries(data.organisms.map(o => [o.id, o.commonName]));
  for (const r of data.relationships) {
    const prey = byId(r.fromId), predator = byId(r.toId);
    if (r.type !== 'predation' || !prey || !predator || avoid.has(prey.id) || avoid.has(predator.id)
      || !predationDirectionOk(prey, predator)) continue;
    const foils = data.organisms
      .filter(o => !avoid.has(o.id) && o.id !== prey.id && o.id !== predator.id)
      .map(o => ({ o, d: linkDistance(predator.id, o.id, data.relationships) }))
      .filter(f => f.d >= 3)
      .sort((a, b) => b.d - a.d);
    for (const { o: foil } of foils) {
      const challenge: HabitatChallenge = { id: `${item.id}${SIMPLER_SUFFIX}`, type: 'predict', prompt: 'Predict the change.',
        explanation: `With no ${predator.commonName} left to eat it, more ${prey.commonName} survive.`,
        disruptionEvent: `Every ${predator.commonName} leaves the habitat`, affectedOrganismId: prey.id,
        expectedTrend: 'increase', optionOrganismIds: [prey.id, foil.id] };
      const built = itemFromChallenge(challenge, { organisms: [prey, foil], relationships: [...data.relationships] });
      if (built && !simplerLeaks(item, { ...built, organismNames: names })) return { ...built, organismNames: names };
    }
  }
  return null;
}

// ── restore ─────────────────────────────────────────────────────────────────

/** A picture per zone button, all six alike. */
export const ZONE_PICTURES: Record<HabitatZone, string> = {
  canopy: '🌳', 'open-land': '🌾', water: '🌊', shoreline: '🏖️', ground: '🍂', underground: '🪱',
};

/** `its_partners`: every living thing on the map the missing one has a relationship with, either way. */
export function restorePartners(item: HabitatItem, relationships: readonly Relationship[]): string[] {
  const id = item.kind === 'restore' ? item.restorationEntityId : undefined;
  if (!id) return [];
  const ids = relationships.flatMap(r => r.fromId === id ? [r.toId] : r.toId === id ? [r.fromId] : []);
  return Array.from(new Set(ids)).filter(p => p !== id && !!item.organismNames[p]);
}

/** A zone name or a place word: an adaptation that says one names where it lives, which is the answer. */
const PLACE_WORDS = /\b(canopy|tree ?tops?|open[- ]land|land|water|waters|underwater|shore|shoreline|ground|underground|soil|pond|lake|river|stream|ocean|sea|field|meadow|zone|marsh|swamp)\b/i;
/** `body_clues`: the missing one's adaptations that name no place. Empty means refused. */
export function bodyClues(item: HabitatItem, organisms: readonly Organism[]): string[] {
  const entity = item.kind === 'restore' ? organisms.find(o => o.id === item.restorationEntityId) : undefined;
  return (entity?.adaptations ?? []).map(a => a.trim()).filter(a => a && a.length <= 140 && !PLACE_WORDS.test(a)).slice(0, 3);
}

// ── defend ──────────────────────────────────────────────────────────────────

/**
 * `card_pictures`: per evidence card, the living things it names (drawn on it as pictures). Null when that would leak:
 * no card names one, only the key card would get pictures, or the key is the only card sharing one with the claim.
 */
export function cardPictures(item: HabitatItem): string[][] | null {
  if (item.kind !== 'defend' || !item.evidenceChoices?.length) return null;
  const per = item.evidenceChoices.map(c => namedIds(c.text, item.organismNames));
  const key = item.evidenceChoices.findIndex(c => c.id === item.correctEvidenceId);
  const pictured = per.flatMap((ids, i) => ids.length ? [i] : []);
  if (!pictured.length || (pictured.length === 1 && pictured[0] === key)) return null;
  const claim = new Set(namedIds(item.prompt, item.organismNames));
  const sharing = per.flatMap((ids, i) => ids.some(id => claim.has(id)) ? [i] : []);
  if (sharing.length === 1 && sharing[0] === key) return null;
  return per;
}

/**
 * The easier defend item: a plain claim about one eater and two cards, the eating link that supports it and a
 * true-looking card that does not. Built from a link whose living things the stuck item never names. Null on a
 * two-card item or when no such link exists.
 */
export function easierDefendItem(item: HabitatItem | null, data: HabitatData): HabitatItem | null {
  if (item?.kind !== 'defend' || isSimplerItem(item.id) || item.optionTexts.length <= 2) return null;
  const avoid = new Set(namedIds(`${item.prompt} ${item.optionTexts.join(' ')}`, item.organismNames));
  const byId = (id: string) => data.organisms.find(o => o.id === id);
  for (let index = 0; index < data.relationships.length; index++) {
    const r = data.relationships[index];
    const prey = byId(r.fromId), predator = byId(r.toId);
    if (r.type !== 'predation' || !prey || !predator || avoid.has(prey.id) || avoid.has(predator.id)
      || !predationDirectionOk(prey, predator)) continue;
    const supports = { id: 'eats', text: `The ${predator.commonName} eats the ${prey.commonName}.` };
    const looks = { id: 'lives', text: `The ${predator.commonName} lives in this habitat.` };
    const challenge: HabitatChallenge = { id: `${item.id}${SIMPLER_SUFFIX}`, type: 'defend',
      prompt: `The ${predator.commonName} needs other living things for its food.`,
      explanation: `It eats the ${prey.commonName}. Living here does not show what it eats.`,
      evidenceChoices: index % 2 ? [looks, supports] : [supports, looks], correctEvidenceId: 'eats' };
    const built = itemFromChallenge(challenge, data as never);
    if (built && !simplerLeaks(item, built)) return built;
  }
  return null;
}

// ── the lever set ───────────────────────────────────────────────────────────

/** What the lever set reads beside the item: the habitat, and the pictures its living things wear. */
export interface HabitatLeverCtx { data: HabitatData; shownEmojis: readonly string[] }

const named = (item: HabitatItem, ids: readonly string[]) => ids.map(id => item.organismNames[id]).filter(Boolean).join(', ');
const missingName = (item: HabitatItem) => item.organismNames[item.restorationEntityId ?? ''] ?? 'the missing living thing';
const PRACTICE_DOES = 'Opens an easier one of the same kind first. It is not graded; the full item comes back after it.';
const ZONE_MISSES = HABITAT_MISSES.restore;

/**
 * Every lever of every mode, by type, in the order a miss reaches them (`nextLever` takes the first that answers it).
 * A practice item gets none: the component declares levers on the session item only.
 */
export const HABITAT_LEVERS = leverSet<HabitatItem, HabitatLeverCtx>({
  modeOf: item => item.kind,
  missesOf: mode => HABITAT_MISSES[mode as keyof typeof HABITAT_MISSES] ?? [],
  // Only body_clues is worded: its clues never name the zone the missing living thing goes in.
  answersOf: item => (item.kind === 'restore' && item.restorationZone ? [ZONE_LABELS[item.restorationZone]] : [item.answerText]),
  // connect's model pair is a different relationship, drawn solved.
  support: {
    tier: item => item.supportTier ?? 'medium',
    different: 'two other pictures joined by an arrow the way this kind of relationship goes',
    own: 'which living thing this one connects to',
  },
  specs: [
    { id: CHANGE_MARK_LEVER, type: 'marks', modes: ['predict'], answers: ['other_choice'],
      when: 'The learner answers without finding where the change happens on the habitat.',
      does: 'Puts a ring on the habitat around each living thing the change names, so the learner can start from it. No choice is marked.',
      content: item => (changeMarks(item).length ? changeMarks(item) : null),
      fact: (ids: string[], item) => `A ring now marks ${named(item, ids)} on the habitat: the living thing the change names.` },
    { id: CARD_PICTURES_LEVER, type: 'marks', modes: ['defend'], answers: ['other_choice'],
      when: 'The learner cannot tell which living things each card is about.',
      does: 'Puts on each evidence card the pictures of the living things it names. Every card that names one gets them; no card is marked.',
      content: item => cardPictures(item),
      fact: 'Each evidence card now shows pictures of the living things it names. No card is marked.' },
    { id: FOOD_LINES_LEVER, type: 'marks', modes: FOOD_LINES_KINDS, answers: ['other_choice'],
      when: item => (item.kind === 'observe' ? 'The learner names a living thing the clue does not fit.'
        : item.kind === 'defend' ? 'The learner says a card that does not back the claim.'
          : 'The learner names a population the change does not move that way.'),
      does: 'Draws an arrow for every relationship in the habitat, from the one eaten or helped to the one that eats or gets help. No living thing is marked.',
      offer: (item, ctx) => !foodLinesLeak(item, ctx.data.relationships),
      fact: 'Arrows now join the living things for every relationship in the habitat, pointing to the one that eats or gets help. None is marked.' },
    { id: EASIER_CLUE_LEVER, type: 'easier', modes: ['observe'], answers: ['other_choice'],
      when: 'The learner cannot yet match this clue to a living thing.', does: PRACTICE_DOES,
      content: (item, ctx) => easierObserveItem(item, ctx.data) },
    { id: EASIER_CHANGE_LEVER, type: 'easier', modes: ['predict'], answers: ['other_choice'],
      when: 'The learner cannot yet follow this change through the habitat.', does: PRACTICE_DOES,
      content: (item, ctx) => easierPredictItem(item, ctx.data) },
    { id: EASIER_CLAIM_LEVER, type: 'easier', modes: ['defend'], answers: ['other_choice'],
      when: 'The learner cannot yet tell evidence that backs the claim from a true detail that does not.', does: PRACTICE_DOES,
      content: (item, ctx) => easierDefendItem(item, ctx.data) },
    { id: DIRECTION_MODEL_LEVER, type: 'model', modes: ['connect'], answers: ['leads_to_start', 'other_kind_link'],
      when: 'The learner connects the start the wrong way round, or by another kind of relationship.',
      does: 'Shows beside the habitat a model pair of two other pictures with an arrow the way this kind of relationship goes. It is not these living things.',
      content: (item, ctx) => directionModel(item.relationshipType, ctx.shownEmojis),
      fact: (model: readonly [string, string], item) => `Beside the habitat is a model pair, ${model[0]} → ${model[1]}, not living things `
        + `from this habitat. ${MODEL_CAPTION[item.relationshipType ?? 'predation']}` },
    { id: START_LINES_LEVER, type: 'marks', modes: ['connect'], answers: ['unconnected'],
      when: 'The learner taps a living thing the start has no relationship with.',
      does: 'Draws plain lines, with no arrowheads, from the start to every living thing it has a relationship with.',
      content: (item, ctx) => (startPartners(item, ctx.data.relationships).length ? startPartners(item, ctx.data.relationships) : null),
      fact: (_ids: string[], item) => `Plain lines with no arrowheads join ${item.organismNames[item.fromId ?? ''] ?? 'the start'} `
        + 'to each living thing it has a relationship with.' },
    { id: EASIER_LINK_LEVER, type: 'easier', modes: ['connect'], answers: ['unconnected', 'other_kind_link', 'leads_to_start'],
      when: 'The learner cannot yet find this connection.', does: PRACTICE_DOES,
      content: (item, ctx) => easierConnectItem(item, ctx.data) },
    { id: ZONE_PICTURES_LEVER, type: 'legend', modes: ['restore'], answers: ZONE_MISSES,
      when: 'The learner taps a zone without knowing what each zone is.',
      does: 'Puts a picture on each of the six zone buttons: tree tops, grass, open water, a beach, leaves, a worm. All six alike; none is marked.',
      fact: `Each zone button now has a picture: ${(Object.keys(ZONE_PICTURES) as HabitatZone[]).map(z => ZONE_PICTURES[z]).join(' ')}. None is marked.` },
    { id: ITS_PARTNERS_LEVER, type: 'marks', modes: ['restore'], answers: ZONE_MISSES,
      when: 'The learner places it where it could not get its food or live with its partners.',
      does: 'Puts a ring on the habitat around each living thing the missing one has a relationship with. No zone is marked.',
      content: (item, ctx) => (restorePartners(item, ctx.data.relationships).length ? restorePartners(item, ctx.data.relationships) : null),
      fact: (ids: string[], item) => `Rings now mark the living things ${missingName(item)} has a relationship with: ${named(item, ids)}. No zone is marked.` },
    { id: BODY_CLUES_LEVER, type: 'clue', modes: ['restore'], answers: ZONE_MISSES,
      when: 'The learner places it without thinking about its body.',
      does: 'Shows the missing living thing\'s body clues beside it (what its body has). None names a place.',
      content: (item, ctx) => (bodyClues(item, ctx.data.organisms).length ? bodyClues(item, ctx.data.organisms) : null),
      fact: (clues: string[], item) => `Beside ${missingName(item)} are its body clues: ${clues.map(c => `"${c}"`).join('; ')}.` },
    // build_habitat: knowing the needs IS the task, so the item starts bare and these come on a miss.
    { id: NEEDS_LIST_LEVER, type: 'legend', modes: ['build_habitat'], answers: ['several_needs_unmet', 'one_need_unmet'],
      when: 'The learner puts in pieces without thinking about what an animal needs to stay alive.',
      does: 'Shows beside the habitat the kinds of thing every animal needs to live. Nothing on it is ticked or crossed off.',
      fact: 'Beside the habitat is a list of the kinds of thing every animal needs to live.' },
    { id: PIECE_TAGS_LEVER, type: 'marks', modes: ['build_habitat'], answers: ['other_animals_piece', 'harmful_piece', 'one_need_unmet'],
      when: 'The learner puts in pieces that are for other animals, or one that would hurt this one.',
      does: 'Puts a small tag on each piece the learner put in the habitat: what it gives this animal, or that it is not for it.',
      fact: 'Each piece in the habitat has a tag saying what it gives this animal, or that it is not for it.' },
    { id: FEWER_NEEDS_LEVER, type: 'easier', modes: ['build_habitat'], answers: ['several_needs_unmet', 'other_animals_piece'],
      when: 'The learner cannot build the whole habitat yet.',
      does: 'Opens an easier ask first: the same animal on an empty habitat, with two of its needs named. It is not graded; '
        + 'the full habitat comes back after it.',
      content: item => fewerNeedsItem(item) },
  ],
});
