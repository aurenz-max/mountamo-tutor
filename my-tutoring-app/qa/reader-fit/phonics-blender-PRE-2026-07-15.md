# Reader Fit: phonics-blender @ PRE — 2026-07-15

Modes audited: cvc (the K census route) | Probes: eval-test ✓ · tutor-test --probe ✓ (0 findings) · live --lesson ✓ (3/3 PASS)

Census: demand CONFIRMED — phonics-blender routed in 2/6 K lessons. `cvc` is the
only K-band eval mode (cvce_blend/digraph/advanced are Grade 1-2 by the catalog
guidelines and the `clampGradeToK2` grade pin in `7cb5e5f`), so PRE = `cvc`.

## Audit A — text census

| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| `/k/` `/a/` `/t/` slash-notation on tiles | tile face (all phases) | Load-bearing (rule 6 — phoneme notation as the ONLY visible mark) | sound spoken on tap `[PRONOUNCE_SOUND]`, but the visible mark is unreadable | FAIL → letter-primary at K |
| "Tap each sound to hear it:" | listen phase | Load-bearing (what to do) | none guaranteed | FAIL → hide at K (tutor voices) |
| "Arrange the sounds to build the word:" / "Sound Bank:" | build phase | Load-bearing | none guaranteed | FAIL → hide at K |
| "Blended together:" / "Build this word" | listen/build | Supportive | — | hide at K (declutter) |
| "Perfect! You built the word correctly!" / "Not quite! Try rearranging the sounds." | build feedback card | Load-bearing (correction) | slot flash + SFX + `[BUILD_CORRECT/INCORRECT]` spoken | COVERED → text card hidden at K |
| "Word N of M" / "N completed" | counter | Decorative chrome | — | FAIL rule 7 → hide at K |
| "Listen"/"Build"/"Blend" + phase-description badge | phase stepper / header | Decorative chrome | — | FAIL rule 7 → hide at K |
| "Grade K" / "CVC Words" badges | header | Decorative chrome | — | FAIL rule 7 → hide at K |
| word emoji (🐱), targetWord "cat" | all phases | Picture / stimulus | tutor says the word | COVERED (emoji is schema-REQUIRED in the generator) |

## Audit B — sufficiency contract

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| cvc | PARTIAL→**PASS** | **PASS** | **PASS** | **PASS** | **PASS** |

- **ORIENT** — the how-to-play lived only in the component `[ACTIVITY_START]`
  sendText (asks for "2-3 sentences"), droppable under the lesson one-sentence
  cap. Fixed Tier 1: catalog **PRE-READER HOW TO PLAY** `aiDirective` (overrides
  the cap). Live 3/3: a tap/listen action + the word is voiced every run.
- **STIMULUS** — each sound and the blended word are spoken on TAP via
  `[PRONOUNCE_SOUND]`. This is a per-tap message, NOT the greeting/switch path, so
  it was never subject to the one-sentence cap. Already passing (the key contrast
  with addition-subtraction-scene, whose whole story had to ride the capped
  greeting).
- **FEEDBACK** — build correctness lands on the object (drop-zone slot flash) +
  `SoundManager.playCorrect/Incorrect` + the tutor's spoken `[BUILD_CORRECT/INCORRECT]`.
  Not text-only.
- **RECOVER** — `commonStruggles` (wrong order, can't blend, skipping listen,
  confusing sounds) are eyes-free and answer-free.

## Audit C — band contract

| Rule | PASS/FAIL (pre-fix) | Offender → resolution |
|---|---|---|
| 1 — audio is the instruction channel | FAIL → **PASS** | text instruction labels present → hidden at K; tutor voices via HOW-TO-PLAY directive |
| 2 — tap = choose | FAIL → **PASS** | Clear + Check + phase-gate buttons → Clear dropped at K (tap a placed tile to remove); Check KEPT (arranging sounds is a multi-part construction, rule-2 exception) |
| 3 — pictures are the answer surface | FAIL → **PASS** | tiles were slash-notation text → letter-primary at K; word emoji present |
| 4 — one thing / ≤5 elements | BORDERLINE → **PASS** | listen 3 tiles + 1 button; build 3 tiles + Check (Clear removed) |
| 5 — feedback on the object | PASS | slot flash + SFX (text card hidden at K) |
| 6 — no typing / no notation-only | FAIL → **PASS** | `/k/` was the only visible mark → letter-primary; no typing anywhere |
| 7 — no adult chrome | FAIL → **PASS** | phase stepper, word counter, badges hidden at K (PhaseSummaryPanel + button labels remain → K-stage systemic) |
| 8 — assessment in the mechanics | PASS | build-order + blend are instrument-like |

**Overall: PRIMITIVE-GAP + minor SCAFFOLD-GAP → READY @ PRE (cvc).** CVC blending
is a legitimate K skill and the catalog rightly claims K; the interaction core is
sound. Both findings closed in one `--fix` loop.

Findings → fix layer:
- **RF-1 (SCAFFOLD-GAP) → CATALOG:** PRE-READER HOW TO PLAY `aiDirective`.
- **RF-2 (PRIMITIVE-GAP) → COMPONENT:** K band-gate (`isPreReaderGrade`) —
  letter-primary tiles, chrome hidden, labels hidden, text-card hidden, Clear
  dropped; Check kept.

## [--fix] Loop log

| Iter | Change | Type/visual check | Re-audit |
|---|---|---|---|
| 1 | Catalog PRE-READER HOW TO PLAY directive (`literacy.ts`) | tutor-test `--probe`: pass, 0 findings, directive present in prompt preview | ORIENT resolves |
| 2 | Component K band-gate (`PhonicsBlender.tsx`): `isPreReaderGrade`, letter-primary tiles, hide stepper/counter/badges/labels/feedback-card, drop Clear, keep Check | tsc 808/808 (0 new) + `typecheck:lumina` 0; `PhonicsBlender.reader-fit.test.tsx` **7/7** | Audit C rules 1-7 PASS |
| 3 | Bespoke `build_phonics_blender_journey` in `run_tutor_live.py` | **live `--lesson` --runs 3 → 3/3 PASS, 0 findings** (K, cvc, "cat"/"dog") | ORIENT/STIMULUS confirmed at runtime, survives the lesson cap |

Verification (Verification Doctrine — exercised at runtime, not tsc alone):
- tsc: 808 total (baseline 808), 0 phonics-specific.
- `npm run typecheck:lumina`: 0 errors.
- vitest `PhonicsBlender.reader-fit.test.tsx`: 7/7.
- eval-test `cvc` @ K: pass — 5 CVC words, emoji present, letters concatenate to
  the target word.
- tutor-test `--probe`: pass, 0 findings, PRE directive in the prompt.
- **live `--lesson` --runs 3: 3/3 PASS** — `qa/tutor-reports/phonics-blender-live-lesson-2026-07-15.md`.

## Residuals

- **K-stage systemic (Audit-C chrome not removable per-primitive):** PhaseSummaryPanel
  % ledger + per-word score rows at completion; the "Ready to Build!", "Blend!",
  "Say it!", "Next Word"/"Finish" button labels (single prominent buttons, tutor
  voices the action). Recorded here for the K-stage full-bleed presentation case.
- **Pixel/browser glance (human):** the letter-primary tiles, hidden chrome, and
  Clear-dropped build layout are data/behavior-verified via jsdom but not
  eyeballed in a browser → HUMAN-CHECKS.
- **EMERGING (Grade 1) re-audit:** cvce_blend/digraph tiles keep `/k/` notation by
  design (reader grades) — revisit when the census re-runs at grade 1.
