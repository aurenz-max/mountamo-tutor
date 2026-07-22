# Reader Fit: flight-forces-explorer @ PRE (young-learner band) — 2026-07-21

Modes audited: unmoded (single living-sim surface + optional challenge deck; `gradeBand: '1-2'` config path → `K-2` tutor) | Probes: component read + jsdom reader-fit test ✓ | live — (needs browser)

Config declares a `'1-2' | '3-5'` grade band and maps `'1-2'` to the `K-2`
tutor voice, so the lowest claimed band = grades 1-2 (young-learner PRE). The
sim itself is direct-manipulation and reads friendly — grab the plane, tilt the
nose, watch the particle airflow and force arrows. But **every load-bearing
STRING wrapped around it is prose a K–2 reader cannot decode:** the overview
orient, the prediction/observation questions, their hints, and the stall
explanation. This is the third engineering primitive to get the young-learner
read-aloud capability, same finding class and fix as [[vehicle-comparison-lab]]
and [[propulsion-timeline]] (both 2026-07-21).

## Audit A — text census
| String (abridged) | Where | Class | Spoken twin (before) | Verdict |
|---|---|---|---|---|
| `overview` ("A living flight simulation with particle airflow…") | card header subtitle | Load-bearing (orient) | sent once inside silent `[ACTIVITY_START]`; on-screen text never voiced on demand | UNCOVERED → **COVERED** (overview 🔊, `[READ_OVERVIEW]`) |
| challenge `instruction` ("What happens to the air particles above the wing…?") | challenge deck, active question | Load-bearing (the QUESTION) | named only inside silent `[CHALLENGE_*]` tutor messages; question text unreadable | UNCOVERED → **COVERED** (ReadMeButton reads the question + answer-free ask, `[READ_CHALLENGE]`) |
| challenge `hint` ("Watch the particles above and below the wing…") | challenge deck, post-incorrect | Load-bearing (guidance) | sent to tutor on `[CHALLENGE_INCORRECT]` only; on-card text unreadable | UNCOVERED → **COVERED** (hint 🔊 reads the revealed hint, `[READ_HINT]`) |
| Stall discovery prose ("When the angle of attack is too steep, air particles detach…") | discovery card (after a stall) | Load-bearing (explanation of lift/stall) | tutor prompted via silent `[STALL]`; on-card explanation unreadable | UNCOVERED → **COVERED** (stall 🔊 reads the explanation, `[READ_STALL]`) |
| canvas HUD ("STALL!", "LIFT/WEIGHT/THRUST/DRAG", "km/h", "ALT") | sim canvas | Semantic physics feedback (color + arrow direction carry meaning) | n/a | Not text-decode-blocking (glyph/arrow channel) |
| aircraft labels, "Thrust/Cargo/Angle of Attack", force readout, `Grades 1-2` badge, phase/stepper copy | chrome / control labels | Load-bearing chrome | none | Residual (band chrome — Audit C) |

## Audit B — sufficiency contract
| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| sim (free explore) | after: PASS (overview 🔊) | PASS (bespoke particle sim + force arrows; visual, not text) | n/a (exploration; ✋ grab hint is a glyph) | PASS (tutor narrates AoA/stall/grab on the silent event channel) | PASS (overview 🔊 replay) |
| challenge deck | after: PASS (question 🔊) | before: **FAIL** (question prose never voiced on demand) → after: PASS | after: PASS (ask states "look at the plane and the air, then tap the answer") | PASS (`[CHALLENGE_*]` spoken + answer-choice grading colors) | after: PASS (post-incorrect hint now has a 🔊) |
| stall discovery | n/a | after: PASS (explanation 🔊 once a stall is triggered) | n/a | PASS (spoken `[STALL]` + red turbulent particles) | PASS (🔊 replay) |

## Audit C — band contract (strict PRE)
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 Audio is instruction channel | FAIL→**mitigated** | Was text-only; four 🔊 buttons now voice all load-bearing text on demand |
| 2 Tap = choose | PARTIAL | Challenge answers are tap-to-choose ✓; the sim core is a grab-and-drag manipulation (correct for the concept) + thrust/cargo sliders |
| 3 Pictures are answer surface | PARTIAL | Sim is a rich picture surface ✓; the challenge options are text MC choices |
| 4 One thing per screen (≤5) | FAIL | Sim + aircraft selector + 3 sliders/readouts + 4-force readout + challenge deck coexist |
| 7 No adult chrome | FAIL | `Grades 1-2` badge, thrust/cargo sliders with %/kg, four-force N/kN readout, "Angle of Attack" degrees |
| 8 Assessment hides in mechanics | PARTIAL | Challenge deck is a visible MC quiz layered on the sim |

**Overall: PRIMITIVE-GAP (read-aloud gap) — RESOLVED for the load-bearing-text
blocker.** As with the two prior engineering primitives, at strict eyes-free-PRE
this remains a grades-2-5-leaning instrument (sliders, degree/Newton readouts,
MC quiz, grade badge = Audit C FAILs read-aloud does not fix); a full eyes-free-K
rebuild would be a REBUILD, out of scope and a shared "K-stage chrome" concern,
not a per-primitive one. For the realistic 1-2 audience — young learners who can
grab and tilt the plane but not decode the prose — the blocker was unreadable
load-bearing narration, now unblocked across the overview, the challenge
question, its hint, and the stall explanation.

Findings → fix layer:
- **[DONE] Load-bearing narration unvoiced → COMPONENT (Tier 2).** Wired
  `LuminaReadAloud` (overview, challenge hint, stall explanation) + shared
  `ReadMeButton` (challenge question + answer-free ask). All route to non-silent
  `sendText` via `readBlockAloud` / `onAskTutor`; glyph ripples on
  `isAudioPlaying`. Cyan audio-out mark, learned once. The question 🔊 uses
  `ReadMeButton` so it never names the correct option; the hint 🔊 fires only
  after the hint is already revealed (post-incorrect). No `<button>`-in-`<button>`
  nesting: every 🔊 sits beside a `<p>` inside a `LuminaPanel`/`<div>`, never
  inside an answer-choice or timeline button — no outer-button conversion needed.
- **[RESIDUAL, systemic] Audit C chrome at strict PRE.** Shared "K-stage"
  presentation-mode case (grade badge, sliders, Newton/degree readouts);
  recorded, not fixed inline (no design-system fork).

## [--fix] Loop log
| Iter | Change | Type check | Runtime check | Re-audit |
|---|---|---|---|---|
| 1 | Four 🔊 across overview / challenge question / hint / stall; non-silent `sendText` via `readBlockAloud` + `ReadMeButton`; `isAudioPlaying` ripple | 0 new errors on `FlightForcesExplorer.tsx`; `typecheck:lumina` 0 | **PASS** — jsdom reader-fit test (`__tests__/FlightForcesExplorer.reader-fit.test.tsx`, 3/3): overview 🔊 reads overview; question 🔊 is answer-free and never names the answer; post-incorrect hint 🔊 reads the hint | Audit A load-bearing strings COVERED; Audit B STIMULUS PASS on the challenge deck |

**Verification status:** type-checked + Lumina gate clean + **3/3 behavioral
tests**. The stall-explanation 🔊 is driven by the canvas physics loop (grab +
drag past the stall angle) and is not reachable under jsdom (`getContext()`
returns null there) — its wiring is code-identical to the three verified
placements; hearing the live tutor voice and triggering a real stall want one
browser pass on the Engineering tester, logged to HUMAN-CHECKS. Message shape,
targeting, and answer-safety are runtime-verified.
