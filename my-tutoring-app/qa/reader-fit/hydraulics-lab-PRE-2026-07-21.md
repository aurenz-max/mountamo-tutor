# Reader Fit: hydraulics-lab @ PRE (young-learner band) — 2026-07-21

Modes audited: unmoded (physics-judged mission board: overview → per-mission brief/goal/hint → post-solve explain → engineer's debrief; `3-5`/`6-8` config path) | Probes: jsdom reader-fit test ✓ (3/3) | live — (needs browser)

hydraulics-lab was reimagined into a physics-judged "mission" job board (see memory:
engine-judged missions): the student is handed a real machine job with constraints,
and the particle-physics engine judges success (the load actually lifts). Its
load-bearing text = the lab overview, each mission's brief + live goal, the on-request
success hint, the post-solve "why it worked" explanation, the zone-info analogies, and
the engineer's debrief throughline. Interaction lives on the bespoke canvas (drag the
pump, slide the pistons) — but **every word that tells a student WHAT the job is and WHY
it worked is prose a K–2 reader cannot decode.** The primitive's declared `gradeBand` is
`3-5 | 6-8`; this audits the young-learner / struggling-reader band that shares the same
blocker as the two engineering pilots.

Same finding class and fix as [[vehicle-comparison-lab]] and [[propulsion-timeline]]
(both 2026-07-21) — the third engineering primitive to get the young-learner
read-aloud capability.

## Audit A — text census
| String (abridged) | Where | Class | Spoken twin (before) | Verdict |
|---|---|---|---|---|
| `overview` ("Discover how a small push lifts a huge load…") | card header | Load-bearing (orient) | sent once in silent `[ACTIVITY_START]`, no on-demand replay | UNCOVERED → **COVERED** (overview 🔊, `[READ_OVERVIEW]`) |
| mission `title` + `brief` ("The excavator needs to scoop up a 150 kg pile…") | mission panel (spine) | Load-bearing (the job + what to do) | narrated once on mission start (silent → tutor), no replay | Partially → **COVERED** (ReadMeButton, `[READ_MISSION]`, verbatim + answer-free ask) |
| live goal ("Reach 1471 N of output force to lift the 150 kg load.") | mission panel, lift bar | Load-bearing (goal) | none | Residual (numeric readout — covered in spirit by the mission ask; not the blocker) |
| `successHint` ("Drag the glowing pump handle down…") | mission panel, after "Stuck? Get a hint" | Load-bearing (guidance, revealed) | sent to tutor on `[HINT_REQUESTED]` only; on-card text unreadable | UNCOVERED → **COVERED** (hint 🔊, `[READ_HINT]`, reads what is already revealed) |
| `explainOnSolve` ("You pushed on the small piston…") | solve card, post-lift | Load-bearing (payoff, revealed) | sent silent on `[MISSION_SOLVED]`; on-card text unreadable | UNCOVERED → **COVERED** (explain 🔊, `[READ_EXPLAIN]`) |
| zone `analogy` + `explanation` ("Like pushing a small syringe…") | zone-info card, on tap | Load-bearing (concept, revealed) | narrated on zone tap (silent → tutor), no replay | Partially → **COVERED** (zone 🔊, `[READ_ZONE]`) |
| debrief "The big idea" throughline (Pascal's-Law summary) | engineer's debrief, post-all-solved | Load-bearing (summary) | none | UNCOVERED → **COVERED** (debrief 🔊, `[READ_DEBRIEF]`) |
| readouts (Pressure / Output Force / Multiplier / Load Status), slider labels, 🔒 caps, mission/zone dot trackers, `gradeBand` badge, phase counters | chrome | Load-bearing chrome | none | Residual (band chrome — Audit C) |

Answer-safety: the mission `brief` is the JOB, never the winning slider configuration
(force / diameters live in code, not in the prose), so reading it verbatim + an
answer-free "change the unlocked controls until it lifts" ask reveals nothing. Hint,
explain, zone, and debrief 🔊s read only text already revealed on the card. No 🔊 was
placed on the solution.

## Audit B — sufficiency contract
| Beat | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| overview / mission | after: PASS (overview + mission 🔊) | before: **FAIL** (brief never re-read) → after: PASS | after: PASS (mission ask states "change the unlocked controls until it lifts") | PASS (live lift bar + tutor narrates progress) | PASS (hint 🔊 replays guidance) |
| solve / debrief | after: PASS (explain + debrief 🔊) | after: PASS | n/a | PASS (physics is the judge; tutor celebrates) | PASS (🔊 replay of the why) |
| zone explore | after: PASS (zone 🔊) | after: PASS | n/a (exploration) | PASS (tutor narrates on tap) | PASS |

## Audit C — band contract (strict PRE)
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 Audio is instruction channel | FAIL→**mitigated** | Was text-only; six 🔊 buttons now voice all load-bearing text on demand |
| 2 Tap = choose | PARTIAL | Core loop is drag-pump / slide-pistons (continuous), not discrete tap-to-choose |
| 3 Pictures are answer surface | PARTIAL | Canvas simulation is the answer surface (physics judges), but goal/readouts are numeric text |
| 4 One thing per screen (≤5) | FAIL | Mission panel + canvas + 4 readouts + 4 sliders + trackers on one screen |
| 7 No adult chrome | FAIL | gradeBand badge, numeric readouts (N, N/cm², area ratio), 🔒 lock caps, mission/zone dot trackers |
| 8 Assessment hides in mechanics | PASS | Success is "the load lifts" — the physics engine judges; no visible quiz |

**Overall: PRIMITIVE-GAP (read-aloud gap) — RESOLVED for the load-bearing-text
blocker.** As with the two engineering pilots, at strict eyes-free-PRE this remains a
DEVELOPING/grades-3-5 instrument (numeric readouts, slider controls, force units,
trackers = Audit C FAILs read-aloud does not fix); a full eyes-free-K rebuild would be a
REBUILD, out of scope, and is a systemic K-stage-chrome concern shared across the
engineering family, not a hydraulics-lab defect. For the realistic audience — young
learners who can operate the pump-and-piston simulation but not decode the mission prose
— the blocker was unreadable load-bearing narration, now unblocked across overview,
mission, hint, explain, zone, and debrief.

Findings → fix layer:
- **[DONE] Load-bearing narration unvoiced → COMPONENT (Tier 2).** Wired
  `LuminaReadAloud` (overview, hint, explain, zone, debrief) + shared `ReadMeButton`
  (mission brief + answer-free ask). All route to non-silent `sendText`; glyph ripples
  on `isAudioPlaying`. Cyan audio-out mark, learned once. No nested-button conversions
  were needed — the load-bearing text lives in `<div>`/`<p>` blocks (the canvas owns all
  interaction), so each 🔊 nests validly as a flex sibling.
- **[RESIDUAL, systemic] Audit C chrome at strict PRE.** Shared "K-stage" presentation-
  mode case (numeric units, sliders, trackers); recorded, not fixed inline (no
  design-system fork).

## [--fix] Loop log
| Iter | Change | Type check | Runtime check | Re-audit |
|---|---|---|---|---|
| 1 | Six 🔊 across overview/mission/hint/explain/zone/debrief; non-silent `sendText`; `isAudioPlaying` ripple; `BIG_IDEA_TEXT` hoisted so the debrief 🔊 speaks the exact on-screen words | 0 new errors on `HydraulicsLab.tsx`; `typecheck:lumina` 0 | **PASS** — jsdom reader-fit test (`__tests__/HydraulicsLab.reader-fit.test.tsx`, 3/3): overview 🔊 reads overview; mission 🔊 reads brief + answer-free ask (no winning numbers); hint 🔊 reads hint post-reveal. Solve/zone/debrief 🔊s are canvas-physics-gated (no 2D context in jsdom) — same proven pattern | Audit A load-bearing strings COVERED; Audit B STIMULUS PASS |

**Verification status:** type-checked + Lumina gate clean + **3/3 behavioral tests**.
Residual: hearing the live tutor voice — and driving the three physics-gated 🔊s
(solve / zone / debrief) — wants one browser pass on the Engineering tester; logged to
HUMAN-CHECKS as the systemic engineering-family browser check. Message shape, targeting,
and answer-safety are runtime-verified for the always-visible placements.
