# Place-value misconception pilot — 2026-09-12

**Implementation built; end-to-end gate BLOCKED.** Real engine evidence supports diagnosis, content targeting, Live correction and synthetic independent response. A curriculum mismatch and unavailable browser prevent claiming the production student journey is complete.

Revision inspected: `2add48dac6c6220b8525f6bc6a1fc783deb951bf`. Baseline already contained unrelated base-ten, fraction, catalog, drive-adapter and queue edits. The run JSON records tracked dirty files. Those changes were preserved. No commits or curriculum edits were made.

## Evidence gates

| Gate | Result | Evidence and boundary |
|---|---|---|
| D | PASS | Two actual Flash diagnoses identify face-value-for-worth; noisy/missing-transcript case abstains 3/3. Actual output feeds G. |
| G | PASS | Latest run has three real targeted draws; each has two surviving same-digit/different-place worth asks. Count, medium tier, four-digit range, uniqueness, privacy and same-payload hashes pass. |
| Controlled causality | PASS | Fixed fixture `[2345, 6789, 7526]`: baseline lacks a pair; selection produces a pair while preserving item IDs/roles/count. Removing selection fails the targeting assertion. |
| R | PASS, in memory | Weak, wrong-primitive and wrong-skill submissions stay active; score 90 with matched tags resolves after fan-out; next active read is empty. No browser capture is implied. |
| S4 | PASS, real Firestore | `place-value-chart::NBT003-02` exposed with `NBT003-02-a`; isolated synthetic parent created atomically. Cleanup verified absent. Manually seeded diagnosis, not S1. |
| Component/capture integration | PASS at mocked transport seam | Mounted React component and real runner reach a capped worth failure. Component-emitted evidence and curriculum IDs reach actual capture code; speech emissions and HTTP are mocked. |
| Live plain/signature | PASS | Real Live tutor, frozen payload, no findings. Bare “two” refused for two hundred and twenty; correct worth affirmed. |
| Live independent | PASS | On the same payload, later “twenty” is affirmed on the synthetic first response, before correction for that worth. |
| Live cap | PASS with existing warnings | Three bare-digit errors on first worth item, then move-on. Zero HIGH; two warning mechanisms across three beats: verbatim correction repeats and asking immediately before cap withdrawal. Script unchanged as requested. |
| S1 browser / production lesson | BLOCKED | Browser inventory returned zero browsers. Published Grade 3 worth objective is three-digit; compare mode is four-digit. |

## What was built

The catalog declares **skill** scope. The generator consumes a narrow typed `contrast_digit_worth` move in local code; diagnosis text never enters the Gemini wrapper or generated student data. It selects at most two analyze slots, recomputes derived choices, and accepts selection only after the production `itemsFromChallenges` compiler preserves the original item allocation. Nonzero-column count, magnitude, uniqueness, dictation separation and spent-value gates remain binding. Short/spent pools saturate honestly.

| Mode/tier | Pilot affordance |
|---|---|
| compare / medium / canonical Grade 3 | Tens and hundreds contrasts within four-digit whole numbers; only when scope allows. |
| compare / easy or hard | No-op in this bounded pilot. |
| identify, build, expanded_form / all tiers | No-op; no broader targeting claim. |

Named numeric anchors and incompatible three-digit/decimal/fraction objectives suppress remediation preference. This guard does not fix the generator's pre-existing scope behavior. No-focus, blank and unrelated paths retain controlled random-draw parity. Missing transcripts no longer claim silence; a transcript matching the expected answer alongside correction is explicitly marked contradictory.

The new local POST tutor-test transport validates a saved payload, runs the existing adapter/compiler, and returns its SHA-256. `--di-input` verifies the hash and records it in the Live report. `--di-independent-item` changes only the synthetic response sequence; it does not author alternate script items. Windows cap-item filenames are sanitized.

## Demonstration

**Synthetic student behavior → inference:** repeated “four” or “seven” for digit worth in separate non-ones columns led Flash to infer that the student treats digit value as face value. Missing/contradictory transcription with a generic correction led to abstention, not a mathematical diagnosis.

**Changed content:** the saved Live payload asks the worth of 2 in **2258** (hundreds), dictates **3997**, then asks the worth of 2 in **9027** (tens). The compiled script has five items: place, worth, dictation, place, worth. Dictation has not spoken “twenty.” Its hash is `13a3962701ae3c8a952e426b55180a4c9c54475050dc9d8908f3ecd05c3d0543`.

**Next response:** Live refuses “two” for “two hundred” and delivers the existing correction. In the independent drive the synthetic student later says “twenty” before correction for that worth, and Live affirms it. This demonstrates system behavior under a scripted persona; it is not evidence that a real learner improved.

**Stored state:** the isolated real-store probe exposes the composite skill key correctly, then removes its own data. Separately, the in-memory submission journey demonstrates the existing matched tagged score ≥80 resolution rule. These are separate station tests, not a continuous captured browser journey. Resolution is not durable mastery or delayed transfer.

## Verification and discovered failures

- Final full frontend suite: **5,965 passed, 10 skipped, one unrelated failure** in `catalog/affordances.test.ts`: concurrent fraction-circles work declares `audioInput` but lacks `spoken` in its answer affordances. Reproduced with the place-value scope addition removed, then restored. No unrelated source was repaired.
- Lumina typecheck: **0 errors**. Latest focused scope-guard tests pass.
- Backend state and Live harness suites: **34 passed**.
- Viewer check: all **69** cards retained, search works, real report hash visible, old fixture cannot pass, invalid JSON rejected. No visual browser verification was possible.
- First live D run uncovered a resolver false rejection of “naming only the digit itself rather than its place value.” Fixed narrowly and pinned with actual wording; original failed run retained.
- Second G run uncovered avoidable saturation when the first digit was fixed. Selector now searches alternative nonzero digits without raising structural demand. Genuine reduced compiled capacity remains saturation. Latest G is 3/3 targeted.
- Interrupted cap attempts retained: backend service restart; then a complete drive could not save a Windows filename containing `::`. Filename repaired and final cap report saved.
- Real-store probe originally left two owned synthetic parent documents because the store adds activity metadata. Their misconception records were already removed. Both parents were identified by this run's unique markers and removed; the corrected probe verifies parent and record absence before reporting PASS.

## Artifacts and rerun

- [Importable completed evidence bundle](place-value-chart/2026-09-12T18-53-12-730Z/run.json)
- [Run report and adjacent transcripts](place-value-chart/2026-09-12T18-53-12-730Z/report.md)
- [First D/G run, including original resolver miss](place-value-chart/2026-09-12T18-43-31-141Z/run.json)
- [Second D/G run, including saturation findings](place-value-chart/2026-09-12T18-47-31-324Z/run.json)
- [Exact commands and prerequisites](place-value-chart/README.md)
- [Offline HTML review](../../../artifacts/math-pedagogy-review/index.html)

From `my-tutoring-app`: `node scripts/probe-place-value-misconception.mjs --store --live`. This uses real engine quota. Import the resulting `run.json` into the review's place-value panel.

## Remaining acceptance

Resolve the curriculum/mode mismatch through a reviewed objective or explicit scope revision. Then, with an available authenticated browser and disposable student: produce a real capped failure, inspect emitted evidence and stored identity, generate the next lesson through generation context and flattening, demonstrate a later unseen first response, and inspect matched submission plus the next active-context read. HUMAN-CHECKS **#113 / #63 remain open**. The broader misconception/scaffolding portfolio remains open.
