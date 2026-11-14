/**
 * The wire contract of the `spoken_hear` observation: which of a closed set of answers the learner SAID, from their own
 * audio clip (gemini-decision-1). The model is never told the task or the answer; it picks among options code builds
 * from the item's spoken key and known misses (`hearCandidates`), and code reads the pick as correct, one of the item's
 * known misses, or neither. 11-13 bench (qa/typesafe/decisions-bench-2026-11-12-addendum.md): told the answer, the
 * model credited "hat" for "mat"; asked blind, it heard "hat" (0.95). Blind 27/32 right/wrong on words, 14/14 on letters.
 *
 * It is the audio form of `spoken_miss`, on the same key and misses. The spoken preset (`spokenAssignment`) sets `hear`
 * on every item whose key is closed and gives enough options; no primitive declares it. It names a miss only and is the
 * primary reading where it runs; the transcript reading stands when there is no clip or no answer. Credit stays with the tutor's verdict (USER RULING 2026-11-13).
 * Client-safe.
 */
import { boundedText as text, validItemScope, type ItemScope } from './observationContract';
import type { KnownMiss, SpokenMissDecision } from './spokenMissContract';
import { MAX_MISSES } from './spokenMissContract';

/** A closed spoken key as the blind hearing reads it: every accepted answer, and a menu key's words. A meaning key has
 *  none (its answer is open). */
export interface HearKey { answers: string[]; menu?: string[] }

export interface SpokenHearRequest {
  scope: ItemScope;
  hear: HearKey;
  /** The item's known misses: a word's wrong reads become options, and a pick is read back onto these ids. */
  misses: KnownMiss[];
  audioBase64: string;
}

export interface SpokenHearDecision extends SpokenMissDecision {
  /** The option the model picked (`hat`, `name_s`), whether or not it cleared the gate. */
  heard: string | null;
  /** The three likeliest options. */
  top: { key: string; p: number }[];
}

/** A pick names a miss (or settles the answer as correct) at this probability. The miss steers the lever, never credit. */
export const HEAR_GATE = 0.5;
/** The tutor credited the answer while the clip confidently says otherwise: recorded for review, credit unchanged. */
export const HEAR_FLAG = 0.8;
/** ~45 s of 16 kHz mono 16-bit WAV, base64 (as `spoken_miss_audio`). */
export const MAX_HEAR_AUDIO = 2_000_000;

const texts = (v: unknown, max: number) => Array.isArray(v) && v.length <= max && v.every(e => text(e, 80));
export const validHearKey = (v: any): v is HearKey => !!v && texts(v.answers, 8) && v.answers.length > 0
  && (v.menu === undefined || texts(v.menu, 12));

export const validSpokenHearRequest = (v: any): v is SpokenHearRequest =>
  !!v && validItemScope(v.scope) && validHearKey(v.hear)
  && Array.isArray(v.misses) && v.misses.length <= MAX_MISSES
  && v.misses.every((m: any) => !!m && typeof m.id === 'string' && text(m.pattern, 400)
    && (m.examples === undefined || Array.isArray(m.examples) && m.examples.every((e: unknown) => text(e, 200))))
  && typeof v.audioBase64 === 'string' && v.audioBase64.length >= 64 && v.audioBase64.length <= MAX_HEAR_AUDIO
  && /^[A-Za-z0-9+/=]+$/.test(v.audioBase64);

export const abstainSpokenHear = (reason: string, ms = 0): SpokenHearDecision =>
  ({ miss: null, reading: null, p: null, accepted: false, reason, ms, heard: null, top: [] });

/**
 * The miss a pick names on this item. A reading that is one of the item's miss ids is that miss; a word the item lists
 * as an example of a miss is that miss (a neighbour word read as `first_sound_changed` on an item whose misses use one
 * `near_word` id); anything else names none.
 */
export function missOfHearing(reading: string | null, heard: string | null, misses: readonly KnownMiss[]): string | null {
  if (!reading || reading === 'correct') return null;
  if (misses.some(m => m.id === reading)) return reading;
  return misses.find(m => heard && m.examples?.some(e => e.trim().toLowerCase() === heard))?.id ?? null;
}
