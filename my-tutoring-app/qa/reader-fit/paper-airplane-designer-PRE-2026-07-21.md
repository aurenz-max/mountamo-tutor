# Reader Fit: paper-airplane-designer @ PRE (young-learner band) — 2026-07-21

Modes audited: unmoded (4 phases: build / launch / analyze / iterate; K-2 config path) | Probes: jsdom reader-fit ✓ (3/3) | live — (needs browser)

Component declares `gradeBand: 'K-2' | '3-5'` and ships a dedicated K-2 tips path,
so lowest claimed band = K/PRE. Audited at the young-learner band. This is a
design→build→test→iterate engineering lab: the student picks a template, tunes
sliders, launches a simulated flight, and reads per-flight results + challenge
goals. **The load-bearing prose — the lab instructions (`description`), each
challenge goal + hint, and the Design Tips coaching block — is text a K–2 reader
cannot decode.** Nothing here is a graded MCQ; every string is instruction /
guidance / explanation, so reading it verbatim is answer-safe.

Same finding class and fix as [[vehicle-comparison-lab]] and [[propulsion-timeline]]
(2026-07-21) — the third engineering primitive to get the young-learner read-aloud
capability.

## Audit A — text census
| String (abridged) | Where | Class | Spoken twin (before) | Verdict |
|---|---|---|---|---|
| `description` ("Build a paper airplane, throw it…") | header, all phases | Load-bearing (lab instructions) | none — never voiced, no replay | UNCOVERED → **COVERED** (`[READ_DESCRIPTION]` 🔊 reads it verbatim) |
| challenge `name` + `goal` ("Distance Champ / fly at least ten meters") | analyze, Challenges card | Load-bearing (the task) | none on-screen; only silent `[CHALLENGE_COMPLETE]` on success | UNCOVERED → **COVERED** (per-challenge `ReadMeButton` reads name+goal + hint as the answer-free ask) |
| challenge `hint` ("Try a pointy nose…") | analyze, per uncompleted challenge | Load-bearing (guidance) | none | UNCOVERED → **COVERED** (same challenge 🔊 reads the hint) |
| Design Tips block ("Pointy nose = less air resistance…", "Change ONE thing at a time…") | bottom panel, all phases | Load-bearing (coaching prose) | none | UNCOVERED → **COVERED** (`[READ_TIPS]` 🔊 reads the tips verbatim; K-2 gets base tips, 3-5 also gets flight-log tip) |
| slider captions ("Pointy = faster, Wide = more lift"), phase stepper, metric tiles (Distance/Hang Time/…), "Changes from last design" badges | build/analyze chrome | Load-bearing chrome | none | Residual (band chrome — Audit C) |
| per-flight coaching (`[IMPROVEMENT]`/`[NO_IMPROVEMENT]`/`[FIRST_FLIGHT]`) | analyze | Supportive/discovery | spoken via silent `sendText` → tutor on each launch | Supportive — already voiced by the tutor, left as-is |

## Audit B — sufficiency contract
| Phase | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| build | after: PASS (description 🔊 + Tips 🔊) | before: **FAIL** (instructions never read) → after: PASS | n/a (free design) | PASS (`[TEMPLATE_SELECTED]` spoken on tap) | PASS (🔊 replay) |
| launch | n/a (animation) | n/a | n/a | PASS (trajectory + progress) | n/a |
| analyze | after: PASS (challenge 🔊) | after: PASS (goal + name voiced) | after: PASS (hint read as answer-free ask) | PASS (spoken `[IMPROVEMENT]`/`[NO_IMPROVEMENT]` + metric tiles) | PASS (challenge 🔊 replay; Modify & Retest) |
| iterate | after: PASS (Tips 🔊 persistent) | after: PASS | n/a | PASS (spoken `[ITERATE]`) | PASS |

## Audit C — band contract (strict PRE)
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 Audio is instruction channel | FAIL→**mitigated** | Was text-only; three 🔊 surfaces now voice all load-bearing text on demand |
| 2 Tap = choose | PARTIAL | Template pick is a choose ✓; design is slider-tuning + a Launch button + phase stepper |
| 3 Pictures are answer surface | PARTIAL | Template cards carry an icon, but sliders/metrics/challenges are numeric/text surfaces |
| 4 One thing per screen (≤5) | FAIL | Build shows 5 templates + preview + 4 sliders + 2 toggles + launch settings |
| 7 No adult chrome | FAIL | gradeBand path, phase stepper (1–4), °/cm/% numeric readouts, metric tiles, flight-log table |
| 8 Assessment hides in mechanics | PASS | Evaluation is inferred from design iterations/improvement/variable-isolation — no visible quiz |

**Overall: PRIMITIVE-GAP (read-aloud gap) — RESOLVED for the load-bearing-text
blocker.** As with the two prior engineering pilots, at strict eyes-free-PRE this
remains a DEVELOPING/grades-2-5 instrument (sliders with numeric readouts, phase
stepper, metric tiles, flight-log table = Audit C FAILs read-aloud does not fix);
a full eyes-free-K rebuild would be a REBUILD, out of scope. For the realistic K-2
audience — young learners who can operate the sliders and launch button but not
decode the prose — the blocker was unreadable load-bearing instructions/challenge
goals/tips, now unblocked across build and analyze.

Findings → fix layer:
- **[DONE] Load-bearing prose unvoiced → COMPONENT (Tier 2).** Wired
  `LuminaReadAloud` (lab `description`, Design Tips block) + shared `ReadMeButton`
  (per-challenge goal + answer-free hint). All route to non-silent `sendText` via a
  local `readBlockAloud` helper; glyph ripples on `isAudioPlaying`. Cyan audio-out
  mark, learned once. No `<button>`-in-`<button>` conversions were needed — the
  description sits in a `<div>`, the Design Tips 🔊 in the panel header `<div>`, and
  each challenge row is already a `<div>` (not a `<button>`), so every 🔊 nests
  validly as a sibling.
- **[RESIDUAL, systemic] Audit C chrome at strict PRE.** Shared "K-stage"
  presentation-mode case (numeric slider readouts, phase stepper, metric/flight-log
  tables); recorded, not fixed inline (no design-system fork).

## [--fix] Loop log
| Iter | Change | Type check | Runtime check | Re-audit |
|---|---|---|---|---|
| 1 | Three 🔊 across build/analyze (`[READ_DESCRIPTION]`, `[READ_CHALLENGE]`, `[READ_TIPS]`); non-silent `sendText` via `readBlockAloud`; `isAudioPlaying` ripple | 0 new errors; `typecheck:lumina` 0 | **PASS** — jsdom reader-fit test (`__tests__/PaperAirplaneDesigner.reader-fit.test.tsx`, 3/3): instructions 🔊 reads `description`; Tips 🔊 reads coaching prose; analyze challenge 🔊 reads name+goal+hint | Audit A load-bearing strings COVERED; Audit B STIMULUS PASS build+analyze |

**Verification status:** type-checked (0 errors in file) + Lumina gate clean +
**3/3 behavioral tests**. Residual: hearing the live tutor voice wants one browser
pass on the Engineering tester — logged to HUMAN-CHECKS. Message shape, targeting,
and answer-safety are runtime-verified.
