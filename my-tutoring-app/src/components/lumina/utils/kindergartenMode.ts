'use client';

/**
 * kindergartenMode — the SESSION-LEVEL "stage mode" switch for pre-readers.
 *
 * Kindergarten mode swaps the scroll-down lesson page for a full-bleed,
 * on-rails stage: one section at a time, animated transitions, advance on
 * completion. It exists because the scrolling layout (section headers,
 * objective badges, a page of simultaneous content) assumes reading fluency
 * and self-navigation a pre-reader doesn't have.
 *
 * Resolution order (resolveKindergartenStage):
 *  1. Explicit override from this switch ('on' | 'off') — dev/parent control.
 *  2. 'auto' (default): stage mode when the lesson is a pre-reader lesson —
 *     band gradeLevel is kindergarten/preschool, or the canonical curriculum
 *     grade on the manifest objectives is 'K'.
 *
 * Ctrl+Alt+K cycles auto → on → off (ignored while typing). Persists per
 * device via localStorage. Structural clone of voiceMode.ts.
 */

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'lumina-kindergarten-mode';

export type KindergartenOverride = 'auto' | 'on' | 'off';

let override: KindergartenOverride = 'auto';
let loaded = false;
let hotkeyInstalled = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'on' || raw === 'off' || raw === 'auto') override = raw;
  } catch {
    /* storage unavailable — stay on the default */
  }
}

function emit() {
  listeners.forEach((fn) => fn());
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
}

function installHotkey() {
  if (hotkeyInstalled || typeof window === 'undefined') return;
  hotkeyInstalled = true;
  window.addEventListener('keydown', (e) => {
    if (!e.ctrlKey || !e.altKey || e.metaKey) return;
    if (e.key !== 'k' && e.key !== 'K') return;
    if (isTypingTarget(e.target)) return;
    e.preventDefault();
    const next: KindergartenOverride =
      override === 'auto' ? 'on' : override === 'on' ? 'off' : 'auto';
    KindergartenMode.setOverride(next);
    console.log(`[KindergartenMode] override → ${next}`);
  });
}

export const KindergartenMode = {
  getOverride(): KindergartenOverride {
    load();
    return override;
  },
  setOverride(next: KindergartenOverride) {
    load();
    if (override === next) return;
    override = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* non-fatal */
    }
    emit();
  },
  subscribe(fn: () => void): () => void {
    load();
    installHotkey();
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/** React subscription to the override switch. */
export function useKindergartenOverride(): KindergartenOverride {
  return useSyncExternalStore(KindergartenMode.subscribe, KindergartenMode.getOverride, () => 'auto');
}

/**
 * Grade strings that indicate a pre-reading student. Same class of signals as
 * CuratorBrief's local check — kept here as the shared, canonical copy for
 * lesson-level decisions.
 */
export function isPreReaderGrade(grade?: string | null): boolean {
  if (!grade) return false;
  return /(kinder|preschool|pre-?k\b|prek|toddler|pre-?reader|^\s*gk\s*$|grade\s*k\b|^\s*k\s*$)/i.test(grade);
}

/**
 * Should THIS lesson render on the Kindergarten stage?
 * `objectiveGrades` = canonical curriculum grades stamped on the manifest
 * ('K' | '1'..'12'); authoritative over the band selector, which defaults to
 * 'elementary' on the home screen.
 */
export function resolveKindergartenStage(
  overrideValue: KindergartenOverride,
  gradeLevel: string | undefined,
  objectiveGrades: Array<string | undefined>,
): boolean {
  if (overrideValue === 'on') return true;
  if (overrideValue === 'off') return false;
  if (objectiveGrades.some((g) => (g ?? '').trim().toUpperCase() === 'K')) return true;
  return isPreReaderGrade(gradeLevel);
}
