import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { resolveEvalModes, type ChallengeTypeDoc } from "../evalMode";
import type { MapExplorerData } from "../../primitives/visual-primitives/history/MapExplorer";
import {
  NATIONAL_MALL, PLACE_KINDS, TASK_ORDER, buildSession, isTownTask, townCapacity,
  type MapDifficulty, type MapPlace, type MapTask, type PlaceKind, type TownMap,
} from "../../primitives/visual-primitives/history/map/mapModel";

export type { MapExplorerData };

/**
 * Map explorer generator (Fork A, with a grounded map for town tasks).
 *
 * Code owns every position, direction, ask and answer. Gemini writes only words, plus, for a town map, the
 * real places, in three steps:
 *   1. wrapper (structured): title, description, and the real city or neighborhood the lesson names, if any;
 *   2. grounded search (Google Maps tool, no schema: the Maps tool cannot be combined with structured output):
 *      kid-familiar places near that center, with coordinates;
 *   3. extraction (structured): the grounded answer as {name, kind, lat, lng, blurb}.
 * Code then validates every place (distance from the center, kind, name) and keeps them at their true
 * coordinates; the asks are only those the true bearings answer uniquely. No usable city → the National Mall
 * (curated). World tasks need no map call at all.
 */

const CORE: MapTask = "find_by_direction";

/** The five task identities. Code builds every ask, so these docs only feed intent resolution. */
const CHALLENGE_TYPE_DOCS: Record<MapTask, ChallengeTypeDoc> = {
  find_on_globe: { promptDoc: '"find_on_globe": spin a globe (or flat world map) and tap a named continent or ocean.', schemaDescription: "'find_on_globe' (continents and oceans)" },
  find_by_direction: { promptDoc: '"find_by_direction": on a town map with a compass rose, tap the place north/south/east/west of a named place.', schemaDescription: "'find_by_direction' (find a place by direction)" },
  name_direction: { promptDoc: '"name_direction": tap the compass arm that points from one named place to another (which way is it?).', schemaDescription: "'name_direction' (which way)" },
  world_direction: { promptDoc: '"world_direction": on the world map, tap the continent or ocean just north/south/east/west of a named continent.', schemaDescription: "'world_direction' (directions on the world)" },
  build_route: { promptDoc: '"build_route": plan a bus trip between two places on a town map with compass steps (north 2 blocks, then east 1).', schemaDescription: "'build_route' (plan a route)" },
};
const ASKS = 5;
const MIN_ASKS = 4;
const MODEL = "gemini-flash-lite-latest";
const MAX_KM = 3;
/** A grounded city that takes longer than this is skipped. */
const GROUNDING_TIMEOUT_MS = 30000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))]);
}

/** Well-known, walkable centers a child may have heard of; used when the lesson names no place. */
export const CITY_POOL: { name: string; city: string; lat: number; lng: number }[] = [
  { name: "The National Mall", city: "Washington, D.C.", lat: 38.8895, lng: -77.0230 },
  { name: "Downtown Boston", city: "Boston, Massachusetts", lat: 42.3550, lng: -71.0640 },
  { name: "Grant Park", city: "Chicago, Illinois", lat: 41.8757, lng: -87.6243 },
  { name: "Midtown Manhattan", city: "New York City", lat: 40.7650, lng: -73.9760 },
  { name: "Golden Gate Park", city: "San Francisco, California", lat: 37.7694, lng: -122.4700 },
  { name: "Seattle Center", city: "Seattle, Washington", lat: 47.6205, lng: -122.3493 },
  { name: "Westminster", city: "London, England", lat: 51.5045, lng: -0.1250 },
  { name: "Near the Eiffel Tower", city: "Paris, France", lat: 48.8570, lng: 2.3000 },
  { name: "Sydney Harbour", city: "Sydney, Australia", lat: -33.8650, lng: 151.2100 },
  { name: "Downtown Toronto", city: "Toronto, Canada", lat: 43.6450, lng: -79.3850 },
];

const wrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Names the activity, 2-5 words, e.g. 'Find Your Way Around Town', 'Spin the Globe'. Never names an answer." },
    description: { type: Type.STRING, description: "One child-friendly sentence inviting the learner to explore the map with the compass. Never names an answer." },
    realPlace: { type: Type.STRING, description: "The real city or neighborhood the lesson names for its map, e.g. 'downtown Chicago', 'Austin, Texas'. Empty string when the lesson names none (a generic town, 'our neighborhood', 'a map')." },
  },
  required: ["title", "description", "realPlace"],
};

const extractSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    mapName: { type: Type.STRING, description: "Short name of the area, 2-4 words, e.g. 'Downtown Boston'." },
    city: { type: Type.STRING, description: "City and state or country, e.g. 'Boston, Massachusetts'." },
    centerLat: { type: Type.NUMBER, description: "Latitude of the center of the area." },
    centerLng: { type: Type.NUMBER, description: "Longitude of the center of the area." },
    places: {
      type: Type.ARRAY,
      description: "Every place listed in the text, in order.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "The place's real name." },
          label: { type: Type.STRING, description: "A short map label a 6-year-old can read: 1-3 words, at most 18 letters, keeping the place's own name where it is short (e.g. 'Bryant Park', 'Central Park Zoo', 'Fire Station', 'City Library'). No numbers." },
          kind: { type: Type.STRING, enum: [...PLACE_KINDS], description: "The closest kind." },
          lat: { type: Type.NUMBER },
          lng: { type: Type.NUMBER },
          blurb: { type: Type.STRING, description: "One short, true, kid-friendly sentence about the place (at most 12 words)." },
        },
        required: ["name", "label", "kind", "lat", "lng", "blurb"],
      },
    },
  },
  required: ["mapName", "city", "centerLat", "centerLng", "places"],
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);


function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Names a first grader should not meet on a lesson map. */
const UNFIT = /\b(bar|pub|tavern|brewery|winery|liquor|casino|club|lounge|cannabis|dispensary|tattoo|jail|prison|cemetery)\b/i;

/** Real places a map can show: inside MAX_KM of the center, a known kind, a plain name, no repeats. */
type RealPlaceInput = Omit<MapPlace, 'id'>;

export function cleanPlaces(raw: unknown, center: { lat: number; lng: number }): RealPlaceInput[] {
  const out: RealPlaceInput[] = [];
  const seen = new Set<string>();
  for (const r of Array.isArray(raw) ? raw : []) {
    const fullName = str(r?.name).replace(/\s+/g, " ");
    const label = str(r?.label).replace(/\s+/g, " ");
    // The short label when it is short and plain; the real name otherwise.
    const name = label && label.length <= 18 && !/\d/.test(label) && !seen.has(label.toLowerCase()) ? label : fullName;
    const kind = str(r?.kind) as PlaceKind;
    const lat = num(r?.lat), lng = num(r?.lng);
    if (!name || name.length > 40 || UNFIT.test(name) || !(PLACE_KINDS as readonly string[]).includes(kind)) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || km(center, { lat, lng }) > MAX_KM) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const blurb = str(r?.blurb);
    out.push({ name, kind, lat, lng, ...(fullName !== name ? { fullName } : {}),
      ...(blurb && blurb.split(" ").length <= 16 ? { blurb } : {}) });
  }
  // Two pins closer than 60 m sit on top of each other: keep the first.
  return out.filter((p, i) => !out.slice(0, i).some(q => km(p, q) < 0.06)).slice(0, 9);
}

interface GroundingChunk { maps?: { uri?: string; title?: string } }

/** Attach each place's Google Maps link from the grounding sources, matched by name. */
function attachMapsLinks(places: RealPlaceInput[], chunks: GroundingChunk[]): RealPlaceInput[] {
  const sources = chunks.map(c => c.maps).filter((m): m is { uri: string; title: string } => !!m?.uri && !!m?.title)
    .map(m => ({ uri: m.uri, title: m.title.replace(/\s*-\s*Google Maps$/i, "").toLowerCase() }));
  return places.map(p => {
    const n = p.name.toLowerCase();
    const full = (p.fullName ?? p.name).toLowerCase();
    const hit = sources.find(s => s.title.includes(n) || n.includes(s.title) || s.title.includes(full) || full.includes(s.title));
    return hit ? { ...p, mapsUri: hit.uri } : p;
  });
}

async function writeWrapper(ctx: GenerationContext, task: MapTask) {
  const lines = [`LESSON TOPIC: ${ctx.topic}`];
  if (ctx.title) lines.push(`ACTIVITY TITLE: ${ctx.title}`);
  if (ctx.intent) lines.push(`ACTIVITY INTENT: ${ctx.intent}`);
  if (ctx.objective?.text) lines.push(`LEARNING OBJECTIVE: ${ctx.objective.text}`);
  const what = isTownTask(task)
    ? "a picture map of a neighborhood with a compass rose; the learner finds places using north, south, east and west"
    : "a globe of the whole world that unrolls into a flat map; the learner finds continents and oceans";
  try {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: `${lines.join("\n")}\n\nYou are framing a map activity for ${ctx.gradeContext || "grade 1"}: ${what}. The app `
        + `lays out the map and writes every question itself. Return a title, a one-sentence description (no answers, no `
        + `directions between specific places), and realPlace: the real city or neighborhood this lesson names, or "".`,
      config: { responseMimeType: "application/json", responseSchema: wrapperSchema },
    });
    const data = res.text ? JSON.parse(res.text) : null;
    return { title: str(data?.title), description: str(data?.description), realPlace: str(data?.realPlace) };
  } catch (err) {
    console.warn("[MapExplorer] wrapper failed:", err);
    return { title: "", description: "", realPlace: "" };
  }
}

/** Steps 2 and 3: a grounded list of real places, then the same list as data. */
export async function groundedTown(where: { label: string; lat?: number; lng?: number }): Promise<TownMap | null> {
  const ask = `Use Google Maps. Find 10 real places that a first grader would know, all within about one mile of `
    + `${where.label}: for example a school, a park, a library, a museum or aquarium or zoo, a playground, a fire station, `
    + `a market or grocery store, a train station, a famous landmark. Only places that are good for children. Spread them `
    + `out in every direction from the center. For each give its exact name, what kind of place it is, its latitude and `
    + `longitude to 5 decimal places, and one short true sentence a child would enjoy. Also give the latitude and `
    + `longitude of the center of the area.`;
  const t0 = Date.now();
  const grounded = await ai.models.generateContent({
    model: MODEL,
    contents: ask,
    config: {
      tools: [{ googleMaps: {} }],
      ...(where.lat != null && where.lng != null
        ? { toolConfig: { retrievalConfig: { latLng: { latitude: where.lat, longitude: where.lng } } } } : {}),
    },
  });
  const text = grounded.text ?? "";
  const chunks = (grounded.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) as GroundingChunk[];
  if (!text.trim()) return null;
  const extracted = await ai.models.generateContent({
    model: MODEL,
    contents: `Copy the places in this text into the schema. Do not add places that are not in the text.\n\n${text}`,
    config: { responseMimeType: "application/json", responseSchema: extractSchema },
  });
  const data = extracted.text ? JSON.parse(extracted.text) : null;
  if (!data) return null;
  const center = where.lat != null && where.lng != null ? { lat: where.lat, lng: where.lng }
    : { lat: num(data.centerLat), lng: num(data.centerLng) };
  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return null;
  const places = attachMapsLinks(cleanPlaces(data.places, center), chunks);
  console.log(`[MapExplorer] grounded ${where.label}: ${places.length} usable of ${Array.isArray(data.places) ? data.places.length : 0} `
    + `places, ${chunks.length} Maps sources, ${Date.now() - t0}ms`);
  if (places.length < 5) return null;
  return { name: str(data.mapName) || where.label, city: str(data.city) || where.label, source: "google_maps", center,
    places: places.map((p, i) => ({ id: `place-${i + 1}`, ...p })) };
}

export const generateMapExplorer = async (ctx: GenerationContext): Promise<MapExplorerData> => {
  const resolution = await resolveEvalModes("map-explorer",
    { targetEvalMode: ctx.targetEvalMode, intent: ctx.intent, objectiveText: ctx.objective?.text }, CHALLENGE_TYPE_DOCS);
  // Fork A: code builds every ask, so the mixed path (no resolution) is an explicit session over every task (SP-21).
  const tasks: MapTask[] = resolution
    ? TASK_ORDER.filter(t => resolution.allowedTypes.includes(t)) : [...TASK_ORDER];
  if (!tasks.length) tasks.push(CORE);
  const task = tasks[0];
  const townTasks = tasks.filter(isTownTask);
  // A map is laid out for one town task; a session with several lays it out for the strictest (finding by direction).
  const layoutTask = townTasks.includes("find_by_direction") ? "find_by_direction" : townTasks[0];
  console.log(`[MapExplorer] modes: ${resolution ? `${resolution.modes.map(m => m.evalMode).join("+")} (${resolution.source})` : "mixed"} `
    + `→ tasks [${tasks.join(", ")}]`);
  const difficulty: MapDifficulty = ctx.supportTier ?? "medium";
  const location = str(ctx.raw?.location);
  const storybookOnly = str(ctx.raw?.mapSource) === "storybook";

  const wrapperP = writeWrapper(ctx, task);
  let townMap: TownMap | undefined;
  if (layoutTask) {
    const wrapper = await wrapperP;
    const named = location || wrapper.realPlace;
    const pick = CITY_POOL[Math.floor(Math.random() * CITY_POOL.length)];
    const tries: { label: string; lat?: number; lng?: number }[] = named
      ? [{ label: named }, { label: `${pick.name}, ${pick.city}`, lat: pick.lat, lng: pick.lng }]
      : [{ label: `${pick.name}, ${pick.city}`, lat: pick.lat, lng: pick.lng }];
    for (const where of storybookOnly ? [] : tries) {
      try {
        const map = await withTimeout(groundedTown(where), GROUNDING_TIMEOUT_MS, `grounding ${where.label}`);
        const need = Math.min(MIN_ASKS, Math.ceil(ASKS / tasks.length));
        if (map && townTasks.every(t => townCapacity(map, t) >= need)) { townMap = map; break; }
        console.warn(`[MapExplorer] ${where.label}: map supports too few ${townTasks.join("/")} asks; trying the next`);
      } catch (err) {
        console.warn(`[MapExplorer] grounded map failed for ${where.label}:`, err);
      }
    }
    if (!townMap) {
      townMap = NATIONAL_MALL;
      console.log(`[MapExplorer] using the curated National Mall map`);
    }
  }
  const wrapper = await wrapperP;

  const count = townMap && tasks.length === 1 ? Math.min(ASKS, townCapacity(townMap, task)) : ASKS;
  const challenges = buildSession(tasks, townMap, count, difficulty);
  console.log(`[MapExplorer] tasks=${tasks.join("+")} difficulty=${difficulty} map=${townMap ? `${townMap.source}:${townMap.name}` : "world"} `
    + `asks=${challenges.length}`);

  const fallbackTitle = townMap && !tasks.some(t => !isTownTask(t)) ? `Explore ${townMap.name}` : "Spin the Globe";
  return {
    title: wrapper.title || fallbackTitle,
    description: wrapper.description || (townMap
      ? "Use the compass rose to find your way around the map!" : "Spin the globe and explore the continents and oceans!"),
    challenges,
    challengeType: task,
    ...(townMap ? { townMap } : {}),
    ...(ctx.supportTier ? { supportTier: ctx.supportTier } : {}),
  };
};
