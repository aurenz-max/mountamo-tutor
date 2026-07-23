# tutor-test — di-letter-sounds (L2 gate) — 2026-07-23

Run after `/add-tutoring-scaffold di-letter-sounds` (L2 layer, birth-cert follow-up #2).
The DI tutoring block moved from `diLetterSoundsScript.ts` into the catalog entry
(`catalog/di.ts`), gaining `contextKeys` + `commonStruggles`; the lesson-mode
connection gap was wired the same slice (see "What this layer changed").

## Status

| Tier | Result | Notes |
|---|---|---|
| 1 — static audit | **PASS (warn)** — 0 HIGH | 2 WARNs, both structural to the DI engine pattern (below) |
| 2 — probe (`letter_sound`, topic "letter sounds m s f", K) | **PASS** | all 4 contextKeys + `{{challengeType}}` resolve with real values; **0 `(not set)`** in the assembled prompt |
| 3 — live | NOT RUN | DI live gates have always been human mic sittings → HUMAN-CHECKS #45 (lesson mode); standalone loop already live-verified 07-21 (#36) |

## Findings (Tier 1)

| Check | Severity | Verdict |
|---|---|---|
| `data-bag-unparsed` | WARN | Expected: DI packs connect via `ctx.connect(...)`, not `useLuminaAI`, so the static analyzer can't see the bag. Verified by probe + by reading the connect bag / `updateContext` sync (both carry exactly the contextKeys: `challengeType`, `letter`, `keyword`, `letters`). |
| `no-sendtext-moments` | WARN | Expected: cues flow through the judged-loop engine (`useJudgedSpeechLoop` → `ctx.sendText(cue, {silent:true})`), not component-level sendText. The tutor definitively does not go silent — it IS the interaction surface. |

Directive tags `[DI_ITEM]` / `[DI_MOVE_ON]` / `[DI_COMPLETE]` all verified emitted
(script file). No answer-leak, indirection, or stacked-question findings. Sentinel
discipline re-checked on the new copy: no scaffolding level or struggle response
begins with "Yes" or "My turn" (standing gate 2 holds for the catalog block).

## Tier-2 varResolution

All keys resolve; `resolvedBy: generator-only` labels are an artifact of the
unparsed bag (the component forwards every one at runtime):

- `{{challengeType}}` / contextKey → `letter_sound`
- `letter` → `m`, `keyword` → `moon`
- `letters` → `m, s, f, a` (NEW top-level generator field, attached in code, so
  the auth-time prompt is truthful before the component's first context sync)

## What this layer changed

1. **Catalog `tutoring:` block** (`catalog/di.ts`) — single source of truth; script
   keeps only cue shapes. New `contextKeys` (challengeType/letter/keyword/letters)
   + 3 `commonStruggles` from birth QA (vowel-appended continuant "muh"; letter
   NAME "em"; silent after "Your turn").
2. **`AudioInputConfig` on `ComponentDefinition`** (`types.ts`) — both DI packs
   declare `audioInput: { manual_activity: true }` in the catalog.
3. **Lesson-mode connect wired** (`LuminaAIContext.tsx`): `connectLesson` scans the
   manifest — any item whose catalog entry declares `audioInput` makes the shared
   session open with it (Gemini audio config is fixed at session creation);
   `switch_primitive` now carries `tutoring` (already did) + `audio_input`
   (informational); standalone `connect` falls back to the catalog for both.
4. **Component** (`DiLetterSounds.tsx`): richer connect bag + a per-item
   `updateContext` sync (silent channel; provider dedupes) so RUNTIME STATE stays
   truthful as items advance. Explicit `tutoring`/`audio_input` passes removed —
   catalog resolves them in every path.
5. **Backend retrieval matcher**: `subject_for_domain('di') → LANGUAGE_ARTS`
   (removes the `--domain literacy` workaround; REVISIT at di-math-facts birth).
6. **Subskill carry**: nothing new needed — in lesson mode ManifestOrderRenderer
   already injects `subskillId` into the data and `usePrimitiveEvaluation` submits
   it; the 07-21 Gemini re-map happened only because the STANDALONE tester has no
   objective. The lesson path this slice unblocks carries the objective's subskill.

## Known trade-off (by design, watch in #45)

A lesson containing ANY DI primitive opens its whole shared session with manual
voice activity — Gemini's automatic VAD is off for the entire lesson. Non-DI
primitives in that lesson lose open-mic *conversation* turns (audio streams but no
turn opens unless something brackets it). Acceptable for K DI-focused lessons;
mixed-lesson chat degradation is a named watch-item for the browser sitting.

## Verdict

**L2 connection gate PASS** — 0 HIGH findings, probe prompt fully resolved.
Behavior (Tier 3) rides on HUMAN-CHECKS #45 (lesson-mode mic sitting).
