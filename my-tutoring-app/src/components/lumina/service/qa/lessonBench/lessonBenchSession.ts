/**
 * Lesson Bench session registry — which package is being replayed right now,
 * and the human label being written against it.
 *
 * A plain module registry (like clientRunId.ts), not React context: the hook
 * that starts a replay (useExhibitSession) and the rail that labels it
 * (LessonBenchRail) must not import each other.
 *
 * JOIN KEY. On replay the client run id is set to `<package>-<mint>` so the
 * FIRST live-tutor sitting on this package lands in the backend session
 * ledger and the DI run log under a key that names the package. Later DI
 * blocks mint their own ids (startDiRunLog claims a registered id once);
 * the rail appends whatever id is current at save time to `human.runIds`.
 *
 * PERSISTENCE. Labels autosave to localStorage per package id, and the rail
 * offers the labelled package as a JSON download. A backend endpoint beside
 * di_run_logs.py is the next slice — the label shape is already final.
 */
import { useSyncExternalStore } from 'react';
import { getClientRunId, mintRunId, setClientRunId } from '../../clientRunId';
import { emptyHumanLabel, type LessonBenchHumanLabel, type LessonPackage } from './lessonPackage';

let active: LessonPackage | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

const shortId = (id: string) => id.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 40);

export function setActiveLessonPackage(pkg: LessonPackage | null): void {
  active = pkg;
  if (pkg) setClientRunId(`${shortId(pkg.id)}-${mintRunId()}`);
  notify();
}

export function getActiveLessonPackage(): LessonPackage | null {
  return active;
}

export function subscribeActiveLessonPackage(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const getServerSnapshot = (): LessonPackage | null => null;

export function useActiveLessonPackage(): LessonPackage | null {
  return useSyncExternalStore(subscribeActiveLessonPackage, getActiveLessonPackage, getServerSnapshot);
}

// ── Human label persistence (localStorage, per package id) ─────────────────
const LABEL_KEY = 'lumina.lessonBench.human.v1';
const RECENT_KEY = 'lumina.lessonBench.recent.v1';

type LabelStore = Record<string, LessonBenchHumanLabel>;

function readStore<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined') return fallback;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key: string, value: unknown): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota or private mode — the download button is the durable path
  }
}

export function loadHumanLabel(packageId: string, seed?: LessonBenchHumanLabel | null): LessonBenchHumanLabel {
  const store = readStore<LabelStore>(LABEL_KEY, {});
  return store[packageId] ?? seed ?? emptyHumanLabel();
}

export function saveHumanLabel(packageId: string, label: LessonBenchHumanLabel): LessonBenchHumanLabel {
  const runId = getClientRunId();
  const runIds = runId && !label.runIds.includes(runId) ? [...label.runIds, runId] : label.runIds;
  const next: LessonBenchHumanLabel = { ...label, runIds, labeledAt: new Date().toISOString() };
  const store = readStore<LabelStore>(LABEL_KEY, {});
  store[packageId] = next;
  writeStore(LABEL_KEY, store);
  return next;
}

export interface RecentPackageSummary {
  id: string;
  topic: string;
  gradeLevel: string;
  blocks: number;
  loadedAt: string;
  labeled: boolean;
}

/** Summaries only — packages carry images and would blow the localStorage quota. */
export function rememberRecentPackage(pkg: LessonPackage): void {
  const recent = readStore<RecentPackageSummary[]>(RECENT_KEY, []).filter((r) => r.id !== pkg.id);
  const store = readStore<LabelStore>(LABEL_KEY, {});
  recent.unshift({
    id: pkg.id,
    topic: pkg.manifest.topic,
    gradeLevel: pkg.manifest.gradeLevel,
    blocks: pkg.components.length,
    loadedAt: new Date().toISOString(),
    labeled: !!store[pkg.id],
  });
  writeStore(RECENT_KEY, recent.slice(0, 8));
}

export function loadRecentPackages(): RecentPackageSummary[] {
  return readStore<RecentPackageSummary[]>(RECENT_KEY, []);
}
