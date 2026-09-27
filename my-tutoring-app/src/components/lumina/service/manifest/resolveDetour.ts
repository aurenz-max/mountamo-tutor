/**
 * Live detour resolver (LA-15).
 *
 * The live tutor states a teaching NEED while a student is stuck on a mounted
 * primitive; it never names a primitive. This picks ONE catalog primitive for a
 * short, ungraded teaching detour and resolves its eval mode, reusing the two
 * selectors a lesson already uses:
 *   - stage 1 shortlists from the curator's catalog view (buildCatalogContext);
 *   - stage 2 picks one primitive and one mode from the shortlist's mode cards.
 * Nothing here maps needs to primitives; the pick is made against the live
 * catalog at call time (see LIVE_LESSON_ROADMAP.md LA-15).
 */
import { Type, type Schema, ThinkingLevel } from '@google/genai';
import type { ManifestItem } from '../../types';
import { ai } from '../geminiClient';
import { UNIVERSAL_CATALOG } from './catalog';
import { buildCatalogContext } from './gemini-manifest';

export interface DetourNeed {
  /** What the student cannot do yet, in terms of the task (e.g. "adds the denominators"). */
  obstacle: string;
  /** What the detour should make visible or let the student practise. */
  purpose: string;
  /** What the student said or did that shows the obstacle. */
  evidence?: string;
}

export interface DetourParent {
  componentId: string;
  evalMode?: string;
  objectiveId?: string;
  objectiveText: string;
  objectiveVerb?: string;
  /** Precise grade, 'K' or '1'..'12'. */
  grade: string;
  topic: string;
  /** Coarse grade band used by generators ('kindergarten', 'elementary', ...). */
  gradeLevel: string;
}

export interface DetourResolution {
  item: ManifestItem;
  rationale: string;
  shortlist: string[];
  /** 'single' | 'blend' | 'mixed' | 'none' — a targeted detour should be 'single'. */
  modeKind: 'single' | 'blend' | 'mixed' | 'none';
}

const MODEL = 'gemini-flash-latest';

function modeKindOf(pin: unknown): DetourResolution['modeKind'] {
  if (typeof pin !== 'string' || !pin) return 'none';
  if (pin === 'mixed') return 'mixed';
  return pin.includes('|') ? 'blend' : 'single';
}

type Candidate = (typeof UNIVERSAL_CATALOG)[number];

async function askJson<T>(prompt: string, schema: Schema): Promise<T> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature: 0.2,
    },
  });
  return JSON.parse(response.text ?? '{}') as T;
}

function situation(parent: DetourParent, need: DetourNeed, current?: Candidate): string {
  return `LESSON: "${parent.topic}" (Grade ${parent.grade})
OBJECTIVE: ${parent.objectiveText}
CURRENT ACTIVITY: ${parent.componentId}${parent.evalMode ? ` (task: ${parent.evalMode})` : ''} — ${current?.description ?? 'no description'}

The tutor paused the current activity because the student is stuck:
- Obstacle: ${need.obstacle}
- Evidence: ${need.evidence || 'not stated'}
- Detour purpose: ${need.purpose}

The detour is ungraded teaching. Afterwards the student returns to the current activity.`;
}

/** Mode card in the same shape resolveLessonEvalModes shows its model. */
function modeCards(c: Candidate): string {
  const modes = c.evalModes ?? [];
  if (!modes.length) return '  (no task modes — the generator decides the content)';
  return modes.map(m => `  - ${m.evalMode}: ${m.label}${m.description ? ` — ${m.description.slice(0, 160)}` : ''}`).join('\n');
}

/**
 * Stage 1 shortlists from the curator's catalog view (modes hidden, as the
 * curator sees it). Stage 2 sees the shortlist's task modes and picks ONE
 * primitive and ONE mode against the obstacle. The lesson mode resolver is not
 * used: it sees only an objective, and on the 2026-09-26 bench it returned
 * blends for a targeted detour and could not tell that fraction-circles has no
 * mode that combines parts.
 */
export async function resolveDetour(parent: DetourParent, need: DetourNeed): Promise<DetourResolution> {
  const candidates = UNIVERSAL_CATALOG.filter(c => c.id !== parent.componentId);
  const byId = new Map<string, Candidate>(candidates.map(c => [c.id, c]));
  const { catalogContext, affordanceLegend } = buildCatalogContext(true, candidates);
  const current = UNIVERSAL_CATALOG.find(c => c.id === parent.componentId);
  const context = situation(parent, need, current);

  // No enums on IDs: ~200 catalog IDs or ~660 mode keys exceed Gemini's
  // response-schema enum budget (400 INVALID_ARGUMENT). Values are validated here.
  const shortlistSchema: Schema = {
    type: Type.OBJECT,
    properties: { componentIds: { type: Type.ARRAY, items: { type: Type.STRING } } },
    required: ['componentIds'],
  };
  let shortlist: Candidate[] = [];
  for (let attempt = 0; attempt < 2 && !shortlist.length; attempt++) {
    const r = await askJson<{ componentIds?: string[] }>(`You shortlist activities for a short teaching detour inside a live lesson.

${context}

AVAILABLE COMPONENT TOOLS (the current activity is not listed):
${catalogContext}${affordanceLegend}

List up to 4 component ids (exact ids from the list, best first) that could let this student see or practise the specific missing step named by the obstacle. Prefer a simpler or more concrete representation of the same idea, or the prerequisite step the obstacle points to. Stay inside the objective and the grade.`, shortlistSchema);
    shortlist = Array.from(new Set(r.componentIds ?? []))
      .map(id => byId.get(id))
      .filter((c): c is Candidate => !!c)
      .slice(0, 4);
  }
  if (!shortlist.length) throw new Error('Detour resolver did not shortlist a catalog component');

  const pickSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      rationale: { type: Type.STRING },
      componentId: { type: Type.STRING },
      evalMode: { type: Type.STRING, description: 'One task mode key listed under the chosen component, or "" if it lists none.' },
      title: { type: Type.STRING },
      detourObjective: { type: Type.STRING },
      intent: { type: Type.STRING },
    },
    required: ['rationale', 'componentId', 'evalMode', 'title', 'detourObjective', 'intent'],
    propertyOrdering: ['rationale', 'componentId', 'evalMode', 'title', 'detourObjective', 'intent'],
  };
  const shortlistText = shortlist
    .map(c => `- ${c.id}: ${c.description}${c.constraints ? ` [${c.constraints}]` : ''}\n  Task modes:\n${modeCards(c)}`)
    .join('\n');
  type Pick = { rationale: string; componentId: string; evalMode: string; title: string; detourObjective: string; intent: string };
  let pick: Pick | null = null;
  for (let attempt = 0; attempt < 2 && !pick; attempt++) {
    const r = await askJson<Pick>(`You choose ONE activity and ONE task for a short teaching detour inside a live lesson.

${context}

SHORTLIST:
${shortlistText}

Choose the component and the single task mode whose task makes the specific missing step visible or practised. A component is only a good choice if one of its task modes actually does that step; if no mode does, prefer a component with no modes that can show it.
- detourObjective: one sentence naming what the student will do in the detour (the missing step, not the whole objective).
- intent: instructions for the content generator — the exact skill, the number or content range (no larger than the lesson's), and that its problems must differ from the student's current problem so they do not give that answer away.
- rationale: one or two sentences on why this task addresses the obstacle.`, pickSchema);
    const chosen = byId.get(r.componentId);
    const modes = chosen?.evalModes?.map(m => m.evalMode) ?? [];
    if (chosen && shortlist.includes(chosen) && (!modes.length || modes.includes(r.evalMode))) pick = r;
    else console.warn(`[resolveDetour] invalid pick ${r.componentId}/${r.evalMode}; retrying once`);
  }
  if (!pick) throw new Error('Detour resolver did not pick a valid component and mode');

  const objectiveId = `${parent.objectiveId ?? 'objective'}-detour`;
  const targetEvalMode = byId.get(pick.componentId)?.evalModes?.length ? pick.evalMode : undefined;
  return {
    rationale: pick.rationale,
    modeKind: modeKindOf(targetEvalMode),
    shortlist: shortlist.map(c => c.id),
    item: {
      componentId: pick.componentId as ManifestItem['componentId'],
      instanceId: `${objectiveId}-${pick.componentId}`,
      title: pick.title,
      intent: pick.intent,
      config: {
        intent: pick.intent,
        ...(targetEvalMode ? { targetEvalMode } : {}),
        difficulty: 'easy',
        objectiveGrade: parent.grade,
        objectiveId,
        objectiveText: pick.detourObjective,
        objectiveVerb: 'apply',
        detour: { parentComponentId: parent.componentId, obstacle: need.obstacle, ungraded: true },
      },
    },
  };
}
