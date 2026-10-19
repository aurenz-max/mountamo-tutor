/**
 * The in-item levers on 3d-shape-explorer's five spoken modes, as one lever set (`bossLevers.ts`; `/add-support-tiers`,
 * class sweep 2026-10-08; report qa/eval-reports/3d-shape-explorer-levers-2026-10-08.md). No real-learner evidence:
 * the misses are what `threeDShapeSpokenMisses` names, the catalog's commonStruggles and the pack's scripted signature
 * wrongs.
 *
 * Help (the screen shows more; the question is unchanged):
 * - `see_through` (identify): dashed lines on the learner's solid for its back edges and curves. Names nothing.
 * - `face_prints` (identify; count of flat faces): each flat face of the learner's solid drawn flat, once, like a
 *   print. No number. Not on a sphere (nothing to draw), never on a face-shape question (the print is the answer).
 * - `tint_surfaces` (faces_properties: counts, can-it-move, face shape): flat faces amber, curved surfaces blue on the
 *   learner's solid. Never on a "does it have any …" question, where an untinted kind is the answer.
 * - `edge_view` (2d_vs_3d): the same shape again, turned: a flat shape becomes a thin line, a solid stays a solid.
 * - `solid_shelf` (match, riddle): all five solids in a row, small, unlabeled, fixed order, none marked.
 * - `model_object` (match): a DIFFERENT object beside its solid; the tutor names both as its turn.
 * - `model_property` (yes/no and face-shape questions): a DIFFERENT solid showing the property asked (rolling,
 *   stacked, sliding, faces tinted, one face printed); the tutor says it as its turn.
 * Simplify:
 * - `fewer_faces` (count of flat faces, 2+): an ungraded count on a solid with fewer flat faces; then the full item.
 * No simplify on identify, match, riddle, 2d_vs_3d, yes/no or face-shape items: one solid and one word is already the
 * plainest shape, a name menu is the retired lower mode, and a riddle with a clue dropped is no longer unique.
 *
 * A model never shows the learner's solid, the solid most like it, or a solid a later item names or asks about.
 * Every scene fact that would state the item's answer is dropped (`leverLeak`).
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { OFF_BY } from '../../../components/live-activity/boss';
import { threeDShapeExplorerCard } from './threeDShapeExplorer.card';
import {
  SHAPE_FACTS, SHAPE_LABELS, THREE_D_SHAPES, buildThreeDShapeItems,
  type PropertyKey, type ThreeDShapeItem, type ThreeDShapeName, type TwoDShapeName,
} from './threeDShapeExplorerDomain';

export const SEE_THROUGH = 'see_through';
export const FACE_PRINTS = 'face_prints';
export const TINT_SURFACES = 'tint_surfaces';
export const EDGE_VIEW = 'edge_view';
export const SOLID_SHELF = 'solid_shelf';
export const MODEL_OBJECT = 'model_object';
export const MODEL_PROPERTY = 'model_property';
export const FEWER_FACES = 'fewer_faces';
export const SIMPLER_SUFFIX = '~simpler';

type Mode = keyof typeof threeDShapeExplorerCard.modes;
const NAME_MISSES = threeDShapeExplorerCard.modes.identify_3d.misses;
/** The solid shaped most like each one: a model of it answers the item by analogy or elimination. */
const SIMILAR: Partial<Record<ThreeDShapeName, ThreeDShapeName>> = {
  cube: 'rectangular-prism', 'rectangular-prism': 'cube', cylinder: 'cone', cone: 'cylinder',
};

/** The catalog mode an item belongs to. */
export const catalogModeOf = (item: ThreeDShapeItem): Mode => ({
  'identify-3d': 'identify_3d', 'match-to-real-world': 'match_real_world', '2d-vs-3d': '2d_vs_3d',
  'faces-and-properties': 'faces_properties', 'shape-riddle': 'shape_riddle',
} as const)[item.sourceMode];

const comingAfter = (item: ThreeDShapeItem, items: readonly ThreeDShapeItem[]) => {
  const at = items.findIndex(i => i.id === item.id);
  return at < 0 ? [] : items.slice(at + 1);
};
/** Solids a model must not show for this item: its own, the one most like it, and any a later item is about. */
function blockedSolids(item: ThreeDShapeItem, items: readonly ThreeDShapeItem[]): Set<string> {
  const out = new Set<string>();
  if (item.shape3d) { out.add(item.shape3d); if (SIMILAR[item.shape3d]) out.add(SIMILAR[item.shape3d]!); }
  for (const later of comingAfter(item, items)) if (later.shape3d) out.add(later.shape3d);
  return out;
}

/** True when `text` states the item's answer or one of its accepted forms (the code leak rule for scene facts). */
export function leverLeak(item: ThreeDShapeItem, text: string): string | null {
  const words = ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')} `;
  const keys = [item.answer, ...item.spokenAlternates, ...(item.kind === 'classify_dimension' ? ['flat', 'solid', '2d', '3d'] : [])];
  return keys.find(k => k && words.includes(` ${k.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim()} `)) ?? null;
}

// ── Models ───────────────────────────────────────────────────────────────────

export interface ModelObject { object: string; emoji: string; shape: ThreeDShapeName }
export const MODEL_OBJECTS: readonly ModelObject[] = [
  { object: 'ball', emoji: '⚽', shape: 'sphere' },
  { object: 'box', emoji: '📦', shape: 'rectangular-prism' },
  { object: 'drum', emoji: '🥁', shape: 'cylinder' },
  { object: 'ice cream cone', emoji: '🍦', shape: 'cone' },
  { object: 'dice', emoji: '🎲', shape: 'cube' },
];

/** The object `model_object` shows, or null: never the learner's object or its solid's neighbours. */
export function modelObjectFor(item: ThreeDShapeItem, items: readonly ThreeDShapeItem[]): ModelObject | null {
  if (item.kind !== 'match_object') return null;
  const blocked = blockedSolids(item, items);
  const objects = new Set([item, ...comingAfter(item, items)].map(i => i.objectName?.toLowerCase()).filter(Boolean));
  return MODEL_OBJECTS.find(o => !blocked.has(o.shape) && !objects.has(o.object)) ?? null;
}

/** What `model_property` shows: a different solid doing or having the property asked. */
export interface ModelProperty { shape: ThreeDShapeName; key: PropertyKey; face?: TwoDShapeName }
const MODEL_ORDER: Record<PropertyKey, ThreeDShapeName[]> = {
  canRoll: ['sphere', 'cylinder', 'cone'],
  canStack: ['cube', 'rectangular-prism', 'cylinder'],
  canSlide: ['cube', 'rectangular-prism', 'cylinder', 'cone'],
  flatFaces: ['cube', 'rectangular-prism', 'cylinder', 'cone'],
  curvedSurfaces: ['sphere', 'cylinder', 'cone'],
  faceShape: ['cube', 'cylinder', 'rectangular-prism', 'cone'],
};
/** A face name that is true of the item's face too (a square is a rectangle), or its outline seen from the side. */
const NEAR_FACE: Partial<Record<ThreeDShapeName, string[]>> = {
  cube: ['rectangle'], 'rectangular-prism': ['square'], cone: ['triangle'], cylinder: ['rectangle'],
};

/** The model `model_property` shows, or null. Only on yes/no and face-shape questions. */
export function modelPropertyFor(item: ThreeDShapeItem, items: readonly ThreeDShapeItem[]): ModelProperty | null {
  if ((item.kind !== 'judge_property' && item.kind !== 'name_face_shape') || !item.propertyKey || !item.shape3d) return null;
  const key = item.propertyKey, blocked = blockedSolids(item, items);
  for (const shape of MODEL_ORDER[key]) {
    if (blocked.has(shape)) continue;
    const facts = SHAPE_FACTS[shape];
    if (key === 'faceShape') {
      const face = facts.faceShapes[0];
      if (!face || face === item.answer || NEAR_FACE[item.shape3d]?.includes(face)) continue;
      return { shape, key, face };
    }
    const has = key === 'flatFaces' || key === 'curvedSurfaces' ? facts[key] > 0 : facts[key];
    if (has) return { shape, key };
  }
  return null;
}

// ── Simplify ─────────────────────────────────────────────────────────────────

/** The easier count `fewer_faces` opens: a solid with fewer flat faces (never one a later item is about). */
export function simplerFaces(item: ThreeDShapeItem | null, items: readonly ThreeDShapeItem[]): ThreeDShapeItem | null {
  if (!item || item.kind !== 'count_property' || item.propertyKey !== 'flatFaces' || !item.shape3d) return null;
  const n = SHAPE_FACTS[item.shape3d].flatFaces;
  const later = new Set(comingAfter(item, items).map(i => i.shape3d));
  const target = [...THREE_D_SHAPES]
    .filter(s => SHAPE_FACTS[s].flatFaces >= 1 && SHAPE_FACTS[s].flatFaces < n && !later.has(s))
    .sort((a, b) => SHAPE_FACTS[b].flatFaces - SHAPE_FACTS[a].flatFaces)[0];
  if (!target) return null;
  const built = buildThreeDShapeItems([{ id: `${item.challengeId}${SIMPLER_SUFFIX}`, type: 'faces-and-properties',
    displayShape: target, propertyQuestions: [{ propertyKey: 'flatFaces' }], supportTier: item.supportTier }]).items[0];
  return built ? { ...built, id: `${item.id}${SIMPLER_SUFFIX}` } : null;
}

/** A practice item, rebuilt from its parent with the component's builder (journey rows). */
export function simplerFromId(itemId: string, items: readonly ThreeDShapeItem[]): ThreeDShapeItem | null {
  if (!itemId.endsWith(SIMPLER_SUFFIX)) return null;
  const parent = items.find(i => `${i.id}${SIMPLER_SUFFIX}` === itemId);
  return parent ? simplerFaces(parent, items) : null;
}

// ── The set ──────────────────────────────────────────────────────────────────

const facePrintsDrawable = (item: ThreeDShapeItem) => !!item.shape3d && SHAPE_FACTS[item.shape3d].flatFaces > 0
  && (item.kind === 'identify_shape' || (item.kind === 'count_property' && item.propertyKey === 'flatFaces'));
const tintable = (item: ThreeDShapeItem) => item.kind === 'count_property' || item.kind === 'name_face_shape'
  || (item.kind === 'judge_property' && item.propertyKey !== 'flatFaces' && item.propertyKey !== 'curvedSurfaces');
const isCount = (item: ThreeDShapeItem) => item.kind === 'count_property';

/** Levers an item's tier starts with on screen. Not a pull; never recorded. Easy counts start with the tint. */
export const startingLevers = (item: ThreeDShapeItem | null): string[] =>
  item?.kind === 'count_property' && item.supportTier === 'easy' ? [TINT_SURFACES] : [];

/** What the levers read beyond the item: the session's items (a model never shows what a later item asks). */
export interface ThreeDShapeLeverContext { items: readonly ThreeDShapeItem[] }

const article = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
const MODEL_SHOWS: Record<PropertyKey, string> = {
  canRoll: 'rolling down a ramp', canStack: 'stacked on another one like it', canSlide: 'sliding down a ramp',
  flatFaces: 'with its flat faces tinted amber', curvedSurfaces: 'with its curved surface tinted blue', faceShape: '',
};
const FENCE = 'Never say what it means for the learner\'s own item; they still say the answer.';
const SHELF = 'Shows all five solids in a row, small and unlabeled; none is marked.';
const SHELF_WHY = 'It adds every solid the answer could be as an unlabeled reference row, which no stock type does.';
/** A scene fact, or nothing when it would state the item's answer. */
const safe = (item: ThreeDShapeItem, text: string) => (leverLeak(item, text) ? '' : text);
const facePrintsFact = (_on: unknown, item: ThreeDShapeItem) => safe(item,
  'Beside the learner\'s solid, each of its flat faces is drawn flat, once, like a paint print, without a number or a name.');
const shelfFact = (_on: unknown, item: ThreeDShapeItem) =>
  safe(item, 'All five solids are drawn in a row, small and unlabeled; none is marked.');

/** Every lever of the family, by type, in the order the tutor sees them. */
export const THREE_D_SHAPE_LEVERS = leverSet<ThreeDShapeItem, ThreeDShapeLeverContext>({
  modeOf: catalogModeOf,
  missesOf: mode => threeDShapeExplorerCard.modes[mode as Mode]?.misses ?? [],
  support: { tier: item => item.supportTier,
    different: item => (item.kind === 'match_object' ? 'a different object' : 'a different solid'),
    own: 'this answer' },
  specs: [
    { id: SEE_THROUGH, type: 'marks', modes: ['identify_3d'], answers: ['flat_look_alike', 'other_solid'],
      when: 'The learner names a flat shape, or a wrong solid, for the solid drawn.',
      does: `Draws dashed lines on the learner's solid for the edges and curves at its back. It names nothing. ${FENCE}`,
      fact: 'Dashed lines on the learner\'s solid show its back: the edges and curves that face away. Nothing is labeled.' },
    { id: FACE_PRINTS, type: 'layout', modes: ['identify_3d'], answers: ['similar_solid', 'other_solid'],
      offer: facePrintsDrawable,
      when: 'The learner names a solid that looks like this one but is not it.',
      does: `Draws each flat face of the learner's solid beside it, flat, once, like a paint print, without a number or a name. ${FENCE}`,
      fact: facePrintsFact },
    { id: SOLID_SHELF, type: 'custom', modes: ['match_real_world'], carrier: 'shown', answers: ['said_object', ...NAME_MISSES],
      why: SHELF_WHY,
      when: 'The learner says the object\'s own name, a flat shape, or a wrong solid.',
      does: `${SHELF} ${FENCE}`, fact: shelfFact },
    { id: MODEL_OBJECT, type: 'model', modes: ['match_real_world'], answers: ['said_object', 'other_solid'],
      when: 'The learner says the object\'s own name, or does not know how to start.',
      does: 'Shows a small card with a DIFFERENT object beside its solid (onScreen names both). Say it as your turn '
        + '("My turn: a … is like a …"), then ask about the learner\'s own object again. Never say what the model means for their object.',
      content: (item, { items }) => modelObjectFor(item, items),
      fact: (object: ModelObject, item) => safe(item, 'Beside the learner\'s object, a model card shows a different object, solved: '
        + `${article(object.object)} ${object.object} beside ${article(SHAPE_LABELS[object.shape])} ${SHAPE_LABELS[object.shape]}. `
        + 'It is not the learner\'s object.') },
    { id: EDGE_VIEW, type: 'layout', modes: ['2d_vs_3d'], answers: ['opposite_dimension', 'said_shape_name'],
      when: 'The learner gives the other answer, or says the shape\'s name.',
      does: 'Draws the same shape again beside it, turned to face its edge. Never tell the learner what the turned view means for their shape.',
      fact: (_on: unknown, item) => safe(item, item.is3d
        ? 'Beside the shape, the same shape is drawn again, turned on its side.'
        : 'Beside the shape, the same shape is drawn again, turned to face its edge: a thin line.') },
    { id: SOLID_SHELF, type: 'custom', modes: ['shape_riddle'], carrier: 'shown', answers: NAME_MISSES,
      why: SHELF_WHY,
      when: 'The learner names a solid that fits only some clues, or a flat shape.',
      does: `${SHELF} The learner checks each clue against them. ${FENCE}`, fact: shelfFact },
    { id: TINT_SURFACES, type: 'marks', modes: ['faces_properties'],
      answers: ['said_other_surface', 'said_all_surfaces', ...OFF_BY, 'said_solid', 'opposite_verdict'],
      answersOn: item => (isCount(item)
        ? ['said_other_surface', 'said_all_surfaces', ...(item.propertyKey === 'curvedSurfaces' ? OFF_BY : [])]
        : item.kind === 'name_face_shape' ? ['said_solid'] : ['opposite_verdict']),
      offer: tintable,
      when: item => (isCount(item) ? 'The learner counts the other kind of surface, or every surface together.'
        : item.kind === 'name_face_shape' ? 'The learner names the solid instead of its flat face.'
          : 'The learner gives the opposite verdict.'),
      does: `Tints the learner's solid: flat faces amber, curved surfaces blue, without a number. ${FENCE}`,
      fact: (_on: unknown, item) => safe(item,
        'On the learner\'s solid, flat faces are tinted amber and curved surfaces blue, without a number.') },
    { id: FACE_PRINTS, type: 'layout', modes: ['faces_properties'], answers: OFF_BY,
      offer: facePrintsDrawable,
      when: 'The learner counts a face twice or misses the faces at the back.',
      does: 'Draws each flat face of the learner\'s solid beside it, flat, once, like a paint print, without a number; '
        + `never count them aloud. ${FENCE}`,
      fact: facePrintsFact },
    { id: MODEL_PROPERTY, type: 'model', modes: ['faces_properties'],
      answers: ['said_solid', 'side_view_shape', 'other_flat_shape', 'opposite_verdict'],
      answersOn: item => (item.kind === 'name_face_shape' ? ['said_solid', 'side_view_shape', 'other_flat_shape'] : ['opposite_verdict']),
      when: item => (item.kind === 'name_face_shape' ? 'The learner names the solid, its side outline, or a wrong flat shape.'
        : 'The learner gives the opposite verdict, or does not know how to start.'),
      does: 'Shows a small card with a DIFFERENT solid showing the property asked (onScreen says what it shows). Say it as your '
        + 'turn ("My turn: this one …"), then ask about the learner\'s solid again. Never say what the model means for their solid.',
      content: (item, { items }) => modelPropertyFor(item, items),
      fact: (model: ModelProperty, item) => safe(item, 'Beside the learner\'s solid, a model card shows a different solid, solved: '
        + `${article(SHAPE_LABELS[model.shape])} ${SHAPE_LABELS[model.shape]} ${model.face
          ? `with one flat face printed beside it, ${article(model.face)} ${model.face}` : MODEL_SHOWS[model.key]}. `
        + 'It is not the learner\'s solid.') },
    { id: FEWER_FACES, type: 'easier', modes: ['faces_properties'], answers: OFF_BY,
      when: 'This many flat faces is too many to count yet.',
      does: 'Opens a count on a solid with fewer flat faces first. It is not graded; the full item comes back after it.',
      content: (item, { items }) => simplerFaces(item, items) },
  ],
});
