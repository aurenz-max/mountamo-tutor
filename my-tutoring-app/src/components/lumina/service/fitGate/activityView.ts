/**
 * The smallest picture of a generated activity that still shows what the
 * learner is asked to do and what counts as right: each task's prompt and its
 * answer key. Hints, narration, ids, layout and styling are dropped. Works on
 * any primitive's payload without per-primitive code, so a new primitive is
 * judged from its first generation. Kept small on purpose: it is the whole
 * input of a per-item Jev call.
 */

export interface ActivityView {
  title?: string;
  /** One line per task: "type | prompt | key fields". */
  tasks: string[];
  /** Tasks left out past the cap. */
  more?: number;
}

const MAX_TASKS = 6;
const MAX_TEXT = 140;
const MAX_LIST = 8;

/** Fields that carry what the learner is asked. */
const PROMPT_KEY = /^(instruction|question|prompt|ask|problem|statement|task|equation|text|sentence|word|target_?word|display)$/i;
/** Fields that carry the answer or the values the task is built on. */
const VALUE_KEY = /(target|correct|answer|start|end|value|number|operand|addend|minuend|subtrahend|result|count|change|total|sum|range|order|options|choices|events|items|label|sequence|stimulus|min$|max$|^a$|^b$)/i;
/** Never sent: scaffolding text, identity, layout, media. */
const DROP_KEY = /(hint|narration|feedback|explanation|rationale|teachingNote|^id$|Id$|color|colour|position|emoji|icon|image|audio|tts|style|show[A-Z]|support|arc|anchor|highlight|strategy|dayFraction)/;

const clip = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT - 1)}…` : s);

/** id -> label for the objects of one task, so an answer key written in ids ("e2, e1") reads as labels. */
type Labels = Map<string, string>;

function labelsOf(ch: Record<string, unknown>): Labels {
  const labels: Labels = new Map();
  for (const v of Object.values(ch)) {
    if (!Array.isArray(v)) continue;
    for (const x of v) {
      if (!x || typeof x !== 'object') continue;
      const o = x as Record<string, unknown>;
      const name = o.label ?? o.text ?? o.name ?? o.word;
      if (typeof o.id === 'string' && typeof name === 'string') labels.set(o.id, name);
    }
  }
  return labels;
}

let currentLabels: Labels = new Map();

function scalar(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = currentLabels.get(v) ?? v;
    return t.trim() ? clip(t.trim()) : null;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

/** A value as one short string: scalars, short lists, and objects by their label-ish fields. */
function compact(v: unknown, depth = 0): string | null {
  const s = scalar(v);
  if (s !== null) return s;
  if (Array.isArray(v)) {
    const parts = v.slice(0, MAX_LIST).map((x) => compact(x, depth + 1)).filter((x): x is string => !!x);
    if (!parts.length) return null;
    return `[${parts.join(', ')}${v.length > MAX_LIST ? ', …' : ''}]`;
  }
  if (v && typeof v === 'object' && depth < 2) {
    const parts = Object.entries(v as Record<string, unknown>)
      .filter(([k]) => !DROP_KEY.test(k) && (PROMPT_KEY.test(k) || VALUE_KEY.test(k) || /^(type|text|name)$/.test(k)))
      .map(([k, x]) => { const c = compact(x, depth + 1); return c ? `${k}=${c}` : null; })
      .filter((x): x is string => !!x);
    return parts.length ? `{${parts.join(' ')}}` : null;
  }
  return null;
}

function taskLine(ch: Record<string, unknown>): string {
  currentLabels = labelsOf(ch);
  const prompt: string[] = [];
  const values: string[] = [];
  for (const [k, v] of Object.entries(ch)) {
    if (DROP_KEY.test(k)) continue;
    if (PROMPT_KEY.test(k)) { const s = scalar(v); if (s) prompt.push(s); continue; }
    if (VALUE_KEY.test(k)) { const c = compact(v); if (c) values.push(`${k}=${c}`); }
  }
  currentLabels = new Map();
  const kind = ch.type ?? ch.challengeType ?? ch.kind;
  const type = typeof kind === 'string' ? kind : 'task';
  return [type, prompt.join(' / ') || '(no prompt text)', values.join(' ')].filter(Boolean).join(' | ');
}

/** The task list of a payload: `challenges`, else the first array of objects, else the payload itself. */
function taskObjects(data: Record<string, unknown>): Record<string, unknown>[] {
  const isObjArray = (v: unknown): v is Record<string, unknown>[] =>
    Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === 'object' && !Array.isArray(x));
  for (const key of ['challenges', 'problems', 'items', 'questions', 'rounds', 'tasks']) {
    if (isObjArray(data[key])) return data[key];
  }
  const first = Object.values(data).find(isObjArray);
  return first ?? [data];
}

export function activityView(payload: unknown): ActivityView {
  const root = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const data = (root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown>;
  const tasks = taskObjects(data);
  const view: ActivityView = { tasks: tasks.slice(0, MAX_TASKS).map(taskLine) };
  const title = scalar(data.title);
  if (title) view.title = title;
  if (tasks.length > MAX_TASKS) view.more = tasks.length - MAX_TASKS;
  return view;
}
