'use client';

/**
 * voiceMode — the SESSION-LEVEL auto-listen switch.
 *
 * One global gate above every primitive: may microphones open themselves
 * (auto-arm / always-listening), or only via an explicit tap? In a lesson or
 * Pulse run there are moments where hands-free listening should be off —
 * a noisy room, a parent's call — without hunting for the toggle inside
 * whichever primitive happens to be mounted.
 *
 * Semantics (deliberate):
 *  - OFF suppresses AUTO-starts and stops any live ambient session
 *    (useVoiceCapture enforces both).
 *  - Explicit gestures still work: push-to-talk taps, and manually pressing
 *    "Open mic", are the user choosing voice right now — the switch governs
 *    what happens WITHOUT a click, not what a click may do.
 *
 * Surface it with <LuminaVoiceToggle /> in any navbar; Ctrl+M toggles from
 * the keyboard (ignored while typing in an input). State persists per
 * device via localStorage.
 */

import { useSyncExternalStore } from 'react';
import { SoundManager } from './SoundManager';

const STORAGE_KEY = 'lumina-auto-listen';

let enabled = true;
let loaded = false;
let hotkeyInstalled = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== null) enabled = raw !== 'false';
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
    if (!e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key !== 'm' && e.key !== 'M') return;
    if (isTypingTarget(e.target)) return;
    e.preventDefault();
    VoiceMode.toggle();
  });
}

export const VoiceMode = {
  isEnabled(): boolean {
    load();
    return enabled;
  },
  setEnabled(on: boolean) {
    load();
    if (enabled === on) return;
    enabled = on;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(on));
    } catch {
      /* non-fatal */
    }
    SoundManager.toggle(on);
    emit();
  },
  toggle() {
    VoiceMode.setEnabled(!VoiceMode.isEnabled());
  },
  subscribe(fn: () => void): () => void {
    load();
    installHotkey();
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/** React subscription to the global auto-listen switch. */
export function useAutoListenEnabled(): boolean {
  return useSyncExternalStore(VoiceMode.subscribe, VoiceMode.isEnabled, () => true);
}
