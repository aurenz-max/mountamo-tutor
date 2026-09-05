/**
 * Lesson digest — the assembled lesson, compacted into what an objective-
 * coverage judge needs and nothing else: the declared objectives, every block
 * the child plays (with the catalog's facts about what it demands), each
 * block's items with a stable citable id, and any residual the generator
 * itself reported (`unaskableLetters`, …).
 *
 * Pure. Reads `ExhibitData` — the object the frontend renders — so a replayed
 * Lesson Bench package and a live build digest identically.
 *
 * Evidence ids are `<instanceId>` for a block and `<instanceId>#<path>[<i>]`
 * for an item. The evaluator may only cite ids from `evidenceIds`; anything
 * else is discarded downstream, so a judgment is inspectable to the item.
 */
import type { ExhibitData, ManifestItem, ObjectiveData } from '../../../types';
import { getComponentById } from '../../manifest/catalog';
import { resolveAffordances } from '../../manifest/catalog/affordances';
import type { DigestBlock, DigestItem, DigestObjective, LessonDigest } from './types';

/** Keys whose array-of-object value is the block's list of student-facing items. */
const ITEM_KEYS = [
  'challenges', 'problems', 'questions', 'items', 'words', 'cards', 'rounds', 'steps', 'prompts', 'pairs',
  'sentences', 'tasks', 'exercises', 'trials', 'scenes', 'puzzles', 'levels', 'facts', 'examples', 'stages',
  'phases', 'drills', 'sets', 'slides', 'stations', 'events', 'clues', 'passages', 'jobs', 'missions', 'segments',
];
/** Visual/noise leaves that carry no pedagogical demand. `id` is surfaced on the item header instead. */
const SKIP_KEYS = /^(__instanceId|visualPrompt|imagePrompt|image|imageUrl|imageData|imageBase64|emoji|cardEmoji|exampleEmoji|themeColor|color|colors|svg|icon|asrAliases|gradeLevel|gradeContext|id)$/;
/** Generator-reported residuals: things the generator could NOT do and said so. */
const REPORTED_KEYS = /^(unaskable|unmet|residual|skipped|dropped|omitted|fallback|warning|warnings|degraded|unresolved|missing)/i;

const LEAF_MAX = 160;
const ITEM_MAX = 480;
const FIELDS_MAX = 700;
const REPORTED_MAX = 240;
const MAX_LEAF_DEPTH = 4;
const ITEM_CAPS = [40, 12, 6];
const LESSON_MAX_CHARS = 60_000;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isPrimitive = (v: unknown) => v === null || ['string', 'number', 'boolean'].includes(typeof v);

function fmtLeaf(v: unknown): string {
  if (typeof v === 'string') {
    if (v.startsWith('data:') || v.length > 2000) return `[${v.length} chars omitted]`;
    const one = v.replace(/\s+/g, ' ').trim();
    return one.length > LEAF_MAX ? `${one.slice(0, LEAF_MAX)}…` : one;
  }
  return String(v);
}

function flatten(value: unknown, path: string, out: string[], depth = 0): void {
  if (depth > MAX_LEAF_DEPTH) return;
  if (Array.isArray(value)) {
    if (value.every(isPrimitive)) {
      const inline = `[${value.map(fmtLeaf).join(', ')}]`;
      out.push(`${path}=${inline.length > LEAF_MAX ? `${inline.slice(0, LEAF_MAX)}…]` : inline}`);
    } else {
      value.forEach((v, i) => flatten(v, `${path}[${i}]`, out, depth + 1));
    }
    return;
  }
  if (isObj(value)) {
    for (const [k, v] of Object.entries(value)) {
      if (v === null || v === undefined || SKIP_KEYS.test(k)) continue;
      flatten(v, path ? `${path}.${k}` : k, out, depth + 1);
    }
    return;
  }
  out.push(`${path}=${fmtLeaf(value)}`);
}

const cap = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}…` : s);

/** Item arrays at the top level or one object deep (`assessment.questions`). */
function collectItemArrays(data: Record<string, unknown>): Array<{ path: string; items: Record<string, unknown>[] }> {
  const found: Array<{ path: string; items: Record<string, unknown>[] }> = [];
  const scan = (obj: Record<string, unknown>, prefix: string, nested: boolean) => {
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (Array.isArray(v) && v.length > 0 && isObj(v[0]) && ITEM_KEYS.includes(k)) {
        found.push({ path, items: v.filter(isObj) });
      } else if (!nested && isObj(v)) {
        scan(v, path, true);
      }
    }
  };
  scan(data, '', false);
  return found;
}

function itemText(item: Record<string, unknown>): string {
  const leaves: string[] = [];
  flatten(item, '', leaves);
  const head = typeof item.id === 'string' || typeof item.id === 'number' ? `(id=${item.id}) ` : '';
  return cap(`${head}${leaves.join('; ')}`, ITEM_MAX);
}

const innerId = (item: Record<string, unknown>): string | null =>
  typeof item.id === 'string' && item.id.trim() ? item.id.trim() : typeof item.id === 'number' ? String(item.id) : null;

function digestBlockData(instanceId: string, data: unknown, itemCap: number): Pick<DigestBlock, 'fields' | 'items' | 'generatorReported' | 'itemsTruncated'> & { aliases: Array<[string, string]> } {
  if (!isObj(data)) return { fields: data === undefined || data === null ? '' : fmtLeaf(data), items: [], generatorReported: [], itemsTruncated: 0, aliases: [] };
  const arrays = collectItemArrays(data);
  const itemPaths = new Set(arrays.map((a) => a.path));
  const generatorReported: Array<{ key: string; value: string }> = [];
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (itemPaths.has(k)) continue;
    if (REPORTED_KEYS.test(k)) {
      generatorReported.push({ key: k, value: cap(JSON.stringify(v) ?? String(v), REPORTED_MAX) });
      continue;
    }
    if (isObj(v)) {
      // Keep the non-item part of a nested object (`assessment.title`), drop its item arrays.
      const inner = Object.fromEntries(Object.entries(v).filter(([ik]) => !itemPaths.has(`${k}.${ik}`)));
      if (Object.keys(inner).length) rest[k] = inner;
      continue;
    }
    rest[k] = v;
  }
  const leaves: string[] = [];
  flatten(rest, '', leaves);
  const items: DigestItem[] = [];
  const aliases: Array<[string, string]> = [];
  let itemsTruncated = 0;
  for (const { path, items: arr } of arrays) {
    arr.forEach((it, i) => {
      if (items.length >= itemCap) { itemsTruncated++; return; }
      const pointer = `${instanceId}#${path}[${i}]`;
      items.push({ id: pointer, text: itemText(it) });
      // The item's OWN id (dils-1-m, mc_1, ch3) is shown in the item text, so a
      // judge often cites THAT instead of the pointer. Alias it to the pointer
      // so a real item cited by its content id validates, never discarded as a
      // hallucination. (2026-09-05: obj2 of a phonics lesson was falsely zeroed
      // when the judge cited all 13 items as dils-N-x.)
      const inner = innerId(it);
      if (inner) aliases.push([inner, pointer]);
    });
  }
  return { fields: cap(leaves.join(' · '), FIELDS_MAX), items, generatorReported, itemsTruncated, aliases };
}

function modeDescription(componentId: string, pin: string | undefined): string | undefined {
  if (!pin) return undefined;
  const def = getComponentById(componentId);
  if (!def?.evalModes?.length) return undefined;
  const keys = pin === 'mixed' ? def.evalModes.map((m) => m.evalMode) : pin.split('|');
  const parts = keys
    .map((k) => def.evalModes!.find((m) => m.evalMode === k))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map((m) => `${m.evalMode}: ${m.description}`);
  return parts.length ? cap(parts.join(' | '), 400) : undefined;
}

function buildObjectives(exhibit: ExhibitData): DigestObjective[] {
  const manifest = exhibit.manifest;
  const briefObjectives: ObjectiveData[] = exhibit.introBriefing?.objectives ?? [];
  const byId = new Map<string, DigestObjective>();
  for (const o of briefObjectives) {
    if (!o?.id) continue;
    byId.set(o.id, { id: o.id, text: o.text, verb: o.verb, subskillId: o.subskillId, skillId: o.skillId, grade: o.grade, instanceIds: [] });
  }
  for (const block of manifest?.objectiveBlocks ?? []) {
    const existing = byId.get(block.objectiveId);
    const layoutFor = (manifest?.layout ?? []).filter((l) => l.objectiveIds?.length === 1 && l.objectiveIds[0] === block.objectiveId);
    const grade = layoutFor.find((l) => l.config?.objectiveGrade)?.config?.objectiveGrade as string | undefined;
    if (existing) {
      existing.instanceIds.push(...block.components.map((c) => c.instanceId));
      existing.subskillId ??= layoutFor.find((l) => l.config?.subskillId)?.config?.subskillId as string | undefined;
      existing.skillId ??= layoutFor.find((l) => l.config?.skillId)?.config?.skillId as string | undefined;
      existing.grade ??= grade;
    } else {
      byId.set(block.objectiveId, {
        id: block.objectiveId,
        text: block.objectiveText,
        verb: block.objectiveVerb,
        subskillId: layoutFor.find((l) => l.config?.subskillId)?.config?.subskillId as string | undefined,
        skillId: layoutFor.find((l) => l.config?.skillId)?.config?.skillId as string | undefined,
        grade,
        instanceIds: block.components.map((c) => c.instanceId),
      });
    }
  }
  const objectives = Array.from(byId.values());
  if (manifest?.finalAssessment) {
    const finalId = manifest.finalAssessment.instanceId;
    objectives.forEach((o) => o.instanceIds.push(finalId));
  }
  return objectives;
}

export function buildLessonDigest(exhibit: ExhibitData): LessonDigest {
  const manifest = exhibit.manifest;
  const layoutById = new Map<string, ManifestItem>((manifest?.layout ?? []).map((l) => [l.instanceId, l]));
  const objectives = buildObjectives(exhibit);
  const components = (exhibit.orderedComponents ?? []).filter((c) => c.componentId !== 'curator-brief');
  const present = new Set(components.map((c) => c.instanceId));
  const missingBlocks = (manifest?.layout ?? [])
    .filter((l) => l.componentId !== 'curator-brief' && !present.has(l.instanceId))
    .map((l) => ({ instanceId: l.instanceId, componentId: l.componentId, title: l.title, objectiveIds: l.objectiveIds ?? [] }));

  const build = (itemCap: number): LessonDigest => {
    const allAliases: Array<[string, string]> = [];
    const blocks: DigestBlock[] = components.map((c) => {
      const layout = layoutById.get(c.instanceId);
      const pin = layout?.config?.targetEvalMode as string | undefined;
      const def = getComponentById(c.componentId);
      const aff = def ? resolveAffordances(def, pin && pin !== 'mixed' && !pin.includes('|') ? pin : undefined) : null;
      const { aliases, ...blockData } = digestBlockData(c.instanceId, c.data, itemCap);
      allAliases.push(...aliases);
      return {
        instanceId: c.instanceId,
        componentId: c.componentId,
        title: c.title ?? layout?.title ?? '',
        intent: layout?.intent ?? '',
        objectiveIds: c.objectiveIds ?? layout?.objectiveIds ?? [],
        targetEvalMode: pin,
        role: aff?.role ?? [],
        answers: aff?.answers ?? [],
        modeDescription: modeDescription(c.componentId, pin),
        audience: c.audience ?? (aff?.audience ?? 'student'),
        ...blockData,
      };
    });
    const evidenceIds = blocks.flatMap((b) => [b.instanceId, ...b.items.map((i) => i.id)]);
    // An item's own id → its citation pointer. A content id reused across blocks
    // is ambiguous, so drop it rather than credit the wrong block.
    const seen = new Set(evidenceIds);
    const aliasCounts = new Map<string, number>();
    for (const [inner] of allAliases) aliasCounts.set(inner, (aliasCounts.get(inner) ?? 0) + 1);
    const evidenceAliases: Record<string, string> = {};
    for (const [inner, pointer] of allAliases) {
      if (aliasCounts.get(inner) === 1 && !seen.has(inner)) evidenceAliases[inner] = pointer;
    }
    const digest: LessonDigest = {
      topic: exhibit.topic ?? manifest?.topic ?? '',
      gradeLevel: manifest?.gradeLevel ?? exhibit.introBriefing?.gradeLevel ?? '',
      subject: manifest?.subject ?? exhibit.introBriefing?.subject,
      objectives,
      blocks,
      missingBlocks,
      evidenceIds,
      evidenceAliases,
      chars: 0,
      truncated: itemCap !== ITEM_CAPS[0] || blocks.some((b) => b.itemsTruncated > 0),
    };
    digest.chars = renderDigest(digest).length;
    return digest;
  };

  let digest = build(ITEM_CAPS[0]);
  for (let i = 1; i < ITEM_CAPS.length && digest.chars > LESSON_MAX_CHARS; i++) digest = build(ITEM_CAPS[i]);
  return digest;
}

/** The text the evaluator reads. Ids appear exactly as they must be cited. */
export function renderDigest(d: LessonDigest): string {
  const lines: string[] = [];
  lines.push(`LESSON: "${d.topic}" · grade level: ${d.gradeLevel || 'unknown'}${d.subject ? ` · subject: ${d.subject}` : ''}`);
  lines.push('');
  lines.push('DECLARED OBJECTIVES:');
  for (const o of d.objectives) {
    const tags = [o.verb ? `verb: ${o.verb}` : '', o.grade ? `grade ${o.grade}` : '', o.subskillId ? `subskill ${o.subskillId}` : ''].filter(Boolean).join(', ');
    lines.push(`- ${o.id}${tags ? ` (${tags})` : ''}: ${o.text.replace(/\s+/g, ' ').trim()}`);
    lines.push(`    dedicated blocks: ${o.instanceIds.join(', ') || '(none)'}`);
  }
  lines.push('');
  lines.push('BLOCKS, in the order the child plays them (cite ids exactly as written):');
  for (const b of d.blocks) {
    const answers = b.answers.length ? b.answers.join('+') : '(none — display only)';
    lines.push(
      `[${b.instanceId}] ${b.componentId} · objective(s): ${b.objectiveIds.join(', ') || '—'} · role: ${b.role.join('+') || 'untagged'} · answers: ${answers}` +
        `${b.targetEvalMode ? ` · eval mode: ${b.targetEvalMode}` : ''}${b.audience === 'caregiver' ? ' · AUDIENCE: CAREGIVER (parent card — not the child)' : ''}`,
    );
    if (b.modeDescription) lines.push(`  what the mode tests: ${b.modeDescription}`);
    if (b.title || b.intent) lines.push(`  title: ${b.title}${b.intent ? ` · intent: ${cap(b.intent, 300)}` : ''}`);
    if (b.fields) lines.push(`  fields: ${b.fields}`);
    if (b.items.length) {
      lines.push('  items:');
      for (const it of b.items) lines.push(`    ${it.id}: ${it.text}`);
      if (b.itemsTruncated) lines.push(`    … ${b.itemsTruncated} more item(s) not shown`);
    }
    for (const r of b.generatorReported) lines.push(`  GENERATOR-REPORTED RESIDUAL: ${r.key}=${r.value}`);
  }
  if (d.missingBlocks.length) {
    lines.push('');
    lines.push('MISSING BLOCKS — planned by the manifest, generation FAILED, the student never saw them:');
    for (const m of d.missingBlocks) lines.push(`- ${m.instanceId} (${m.componentId}) for ${m.objectiveIds.join(', ') || '—'}: "${m.title}"`);
  }
  return lines.join('\n');
}
