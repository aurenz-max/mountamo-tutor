# Reader Fit: propulsion-timeline @ PRE (young-learner band) — 2026-07-21

Modes audited: unmoded (4 phases: explore / sequence / connect / speed; K-2 config path) | Probes: eval-test ✓ (K, real content) | live — (needs browser)

Catalog claims **K-5** ("Best for grades K-5. K-2: 6-8 milestones, simple
sequencing"), so lowest claimed band = K/PRE. Audited at the young-learner band.
Real K draw ("Moving Fast: A Story of Transportation"): 6 milestones (wheel →
engine → flight → space), each a paragraph of `description` + `significance`; one
sequencing challenge with a guidance `hint`. Friendly in spirit, but **every phase
carries load-bearing narration a K–2 reader cannot decode.**

Same finding class and fix as [[vehicle-comparison-lab]] (2026-07-21) — the second
engineering primitive to get the young-learner read-aloud capability.

## Audit A — text census
| String (abridged) | Where | Class | Spoken twin (before) | Verdict |
|---|---|---|---|---|
| milestone `description` ("People found that round wheels help things roll…") | explore, selected detail | Load-bearing (the content) | none — only `significance` was narrated once via silent `[MILESTONE_EXPLORED]`; `description` never voiced, no replay | UNCOVERED → **COVERED** (milestone 🔊 reads name + description + significance) |
| milestone `significance` ("Made it easier to carry heavy things.") | explore, "Why it mattered" | Load-bearing | narrated once on tap (silent → tutor), no on-demand replay | Partially → **COVERED** (same milestone 🔊, replayable) |
| "Put these in order!" + item names | sequence | Load-bearing (the task) | none | UNCOVERED → **COVERED** (ReadMeButton reads the task + answer-free ask) |
| sequencing `hint` ("Think about what happened first…") | sequence, post-check | Load-bearing (guidance) | sent to tutor on `[SEQUENCE_INCORRECT]` only; on-card text unreadable | UNCOVERED → **COVERED** (clue 🔊, reads what is already revealed) |
| "Trace how one invention led to the next:" | connect intro | Load-bearing (orient) | none | UNCOVERED → **COVERED** (connect 🔊) |
| "Watch how top speeds have changed over time:" | speed intro | Load-bearing (orient) | none | UNCOVERED → **COVERED** (speed 🔊) |
| chain `narrative` | connect | Supportive/discovery | narrates on tap (silent → tutor) | Supportive — left as-is |
| domain filter, era bands, "N/M explored", phase stepper | chrome | Load-bearing chrome | none | Residual (band chrome — Audit C) |

## Audit B — sufficiency contract
| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| explore | after: PASS (milestone 🔊 voices the story on demand) | before: **FAIL** (description never read) → after: PASS | n/a (exploration) | PASS (tutor narrates on tap) | PASS (🔊 replay) |
| sequence | after: PASS (task 🔊) | after: PASS (task + item names voiced via ask) | after: PASS (ask states "tap one at a time, look at the year") | PASS (`[SEQUENCE_*]` spoken + per-slot ✓/✗ colors) | PASS (post-check hint now has a 🔊) |
| connect/speed | after: PASS (intro 🔊) | after: PASS | n/a | PASS (spoken narration on tap / trend) | PASS |

## Audit C — band contract (strict PRE)
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 Audio is instruction channel | FAIL→**mitigated** | Was text-only; six 🔊 buttons now voice all load-bearing text on demand |
| 2 Tap = choose | PARTIAL | Explore/connect taps are choose ✓; sequence is a multi-tap build (Check button) + phase stepper |
| 3 Pictures are answer surface | FAIL | Timeline rows, sequence items, chains are text/badge surfaces (domain icon only) |
| 4 One thing per screen (≤5) | FAIL | Explore shows 6 milestone rows + domain filter + era band |
| 7 No adult chrome | FAIL | gradeBand badge, phase stepper (1–4), "N/M explored" counter, "(1/N)" counter, domain filter |
| 8 Assessment hides in mechanics | PARTIAL | Sequence is a build-and-check quiz |

**Overall: PRIMITIVE-GAP (read-aloud gap) — RESOLVED for the load-bearing-text
blocker.** As with vehicle-comparison-lab, at strict eyes-free-PRE this remains a
DEVELOPING/grades-2-5 instrument (timeline rows, sequence build, phase stepper,
counters = Audit C FAILs read-aloud does not fix); a full eyes-free-K rebuild
would be a REBUILD, out of scope. For the realistic K-2 audience — young learners
who can operate the timeline but not decode the prose — the blocker was unreadable
load-bearing narration, now unblocked in all four phases.

Findings → fix layer:
- **[DONE] Load-bearing narration unvoiced → COMPONENT (Tier 2).** Wired
  `LuminaReadAloud` (milestone story, post-check hint, connect intro, speed intro)
  + shared `ReadMeButton` (sequence task, answer-free ask). All route to non-silent
  `sendText`; glyph ripples on `isAudioPlaying`. Cyan audio-out mark, learned once.
  The explore milestone row was converted from `<button>` to `div[role=button]`
  (keyboard-accessible) so the read-aloud button could nest validly; its tap
  `stopPropagation`s so it doesn't re-fire the silent narration.
- **[RESIDUAL, systemic] Audit C chrome at strict PRE.** Shared "K-stage"
  presentation-mode case; recorded, not fixed inline (no design-system fork).

## [--fix] Loop log
| Iter | Change | Type check | Runtime check | Re-audit |
|---|---|---|---|---|
| 1 | Six 🔊 across explore/sequence/connect/speed; non-silent `sendText`; `isAudioPlaying` ripple; explore row → `div[role=button]` | 0 new errors; `typecheck:lumina` 0 | **PASS** — jsdom reader-fit test (`__tests__/PropulsionTimeline.reader-fit.test.tsx`, 4/4): milestone 🔊 reads description+significance; sequence task 🔊 is answer-free; clue 🔊 reads hint; connect/speed intros voiced | Audit A load-bearing strings COVERED; Audit B STIMULUS PASS all phases |

**Verification status:** type-checked + Lumina gate clean + **4/4 behavioral
tests**. Residual: hearing the live tutor voice wants one browser pass on the
Engineering tester — logged to HUMAN-CHECKS. Message shape, targeting, and
answer-safety are runtime-verified.
