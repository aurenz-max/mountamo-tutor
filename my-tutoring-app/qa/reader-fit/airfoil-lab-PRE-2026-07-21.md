# Reader Fit: airfoil-lab @ PRE (young-learner band) — 2026-07-21

Modes audited: unmoded ("Living Wind Tunnel" single surface; K-2 config path via
`gradeBand '1-2'`) | Probes: jsdom reader-fit ✓ (real content shape) | live — (needs browser)

Catalog band spans **grades 1-2 / 3-5** (`gradeBand: '1-2' | '3-5'`), so the
lowest claimed band = grade-1/PRE. Audited at the young-learner band. The
interaction itself is strong and eyes-on: the student grabs the airfoil and
drags to rotate it, watching a living particle flow split above/below the wing
— direct manipulation, no reading needed to *operate* it. But **every
load-bearing explanation, prediction, and challenge prompt is prose a K–2 reader
cannot decode**, and the only spoken twin was silent `[…]`-tagged tutor telemetry
that never re-voices on demand.

Third engineering primitive to get the young-learner read-aloud capability —
same finding class and fix as [[vehicle-comparison-lab]] and
[[propulsion-timeline]] (both 2026-07-21).

## Audit A — text census
| String (abridged) | Where | Class | Spoken twin (before) | Verdict |
|---|---|---|---|---|
| `airfoil.description` ("A gently curved wing that sends the air racing over the top…") | header description block | Load-bearing (the frame) | none — only a silent `[ACTIVITY_START]` intro to the tutor; on-screen prose never voiced | UNCOVERED → **COVERED** (description 🔊, `[READ_INTRO]`) |
| "How Wings Create Lift" prose — airfoil / Bernoulli / **stall** / (L/D at 3-5) | educational panel | Load-bearing (the concept) | none | UNCOVERED → **COVERED** (panel 🔊 reads a spans-stripped plain-text twin, `[READ_HOW_LIFT]`; L/D sentence only when 3-5) |
| preset comparison `question` ("Which wing makes more lift…?") | compare mode | Load-bearing (prediction) | none | UNCOVERED → **COVERED** (`ReadMeButton`, answer-free, `[READ_COMPARE_Q]`) |
| preset comparison `explanation` | compare mode, inside `<details>` | Load-bearing (answer, self-revealed) | none | UNCOVERED → **COVERED** (explanation 🔊 reads what the student already opened, `[READ_COMPARE_EXPLANATION]`) |
| challenge `scenario` ("Make a wing that lifts a heavy glider…") | challenges grid | Load-bearing (the task) | narrated once, silent, only on `[CHALLENGE_RESULT]` after checking | UNCOVERED → **COVERED** (`ReadMeButton` reads task + answer-free ask restating the *visible* lift/drag goal, `[READ_CHALLENGE]`) |
| challenge `hint` | challenges grid, when card active | Load-bearing (guidance, revealed on tap) | none | UNCOVERED → **COVERED** (hint 🔊, reads what is already shown, `[READ_HINT]`) |
| "STALL! Particles detached…" banner | transient feedback | Supportive (tutor already speaks `[STALL_REACHED]` on the event) | narrated on stall (silent → tutor) | Supportive — left as-is |
| Observed-Lift caption, Results labels, shape names, wind-speed slider, "Grab the airfoil…" hint, progress counters | chrome | Load-bearing chrome | canvas grab-hint is drawn text; rest unspoken | Residual (band chrome — Audit C) |

## Audit B — sufficiency contract
| Beat | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| explore/operate | after: PASS (description 🔊 + How-Lift 🔊 voice the frame + concept) | before: **FAIL** (concept prose never read) → after: PASS | canvas grab-hint drawn + spoken `[AIRFOIL_GRABBED]` | PASS (tutor narrates AoA/stall on tap) | PASS (🔊 replay any time) |
| compare | after: PASS (question 🔊) | after: PASS (question voiced; explanation 🔊 on reveal) | after: PASS (ReadMeButton "Do NOT reveal the answer" clause) | PASS (live stat cards + spoken) | PASS (🔊 replay) |
| challenge | after: PASS (task 🔊) | after: PASS (task + visible goal voiced via ask) | after: PASS (ask says which lift/drag to aim for + "tap Check My Solution") | PASS (`[CHALLENGE_RESULT]` spoken + Score readout) | PASS (hint 🔊, re-checkable) |

## Audit C — band contract (strict PRE)
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 Audio is instruction channel | FAIL→**mitigated** | Was text-only; six 🔊 buttons now voice every load-bearing block on demand |
| 2 Tap = choose | PARTIAL | Core is a *drag-to-rotate* manipulation + a wind-speed slider + shape grid — richer than tap-to-choose (age-appropriate, but not strict-PRE) |
| 3 Pictures are answer surface | PARTIAL | The wind tunnel IS a picture surface (strong); compare/challenge use text prompts + badges |
| 4 One thing per screen (≤5) | FAIL | Canvas + shape grid + AoA card + wind slider + results + compare + challenges on one scroll |
| 7 No adult chrome | FAIL | gradeBand badge, "N/M shapes explored", "Variables tested 0/3", L/D-ratio readout, m/s units, degrees |
| 8 Assessment hides in mechanics | PARTIAL | Challenge is a set-the-target-and-check task with a Score/100 |

**Overall: PRIMITIVE-GAP (read-aloud gap) — RESOLVED for the load-bearing-text
blocker.** As with the two prior engineering pilots, at strict eyes-free-PRE this
stays a grades-1-5 instrument (single dense scroll, adult chrome, numeric
readouts = Audit C FAILs read-aloud does not fix); a full eyes-free-K rebuild
would be a REBUILD, out of scope. For the realistic young audience — a learner
who can grab and tilt the wing and watch the particles but cannot decode the
prose — the blocker was unreadable load-bearing text, now unblocked across the
description, the lift/stall concept panel, the compare prediction + its
explanation, and the challenge task + its hint.

Findings → fix layer:
- **[DONE] Load-bearing prose unvoiced → COMPONENT (Tier 2).** Wired
  `LuminaReadAloud` (description, How-Wings-Create-Lift concept panel, compare
  explanation, challenge hint) + shared `ReadMeButton` (compare question,
  challenge task with answer-free ask). All route to non-silent `sendText`;
  glyph ripples on `isAudioPlaying`. Cyan audio-out mark, learned once. The
  How-Lift 🔊 reads a spans-stripped plain-text twin so it matches the visible
  prose verbatim (L/D sentence included only for the 3-5 band, matching the
  gated render).
- **Nested-button safety:** the challenge cards are `SpotlightCard` `div[onClick]`
  (not `<button>`), so nesting a 🔊 button is valid HTML — no `<button>`-in-
  `<button>`. The two 🔊 inside a challenge card `stopPropagation` (scenario's
  `ReadMeButton` wrapped in a `span onClick={stopPropagation}`; the hint's
  `LuminaReadAloud` calls `e.stopPropagation()` in-handler) so a tap voices the
  text without toggling the card. Compare cards have no `onClick` — no guard needed.
- **[RESIDUAL, systemic] Audit C chrome at strict PRE.** Shared "K-stage"
  presentation-mode case (dense scroll, gradeBand badge, numeric readouts);
  recorded, not fixed inline (no design-system fork).

## [--fix] Loop log
| Iter | Change | Type check | Runtime check | Re-audit |
|---|---|---|---|---|
| 1 | Six 🔊 (description, How-Lift concept, compare question + explanation, challenge task + hint); non-silent `sendText`; `isAudioPlaying` ripple; stopPropagation on the two in-card 🔊 | AirfoilLab: 0 new errors; `typecheck:lumina` 0 | **PASS** — jsdom reader-fit test (`__tests__/AirfoilLab.reader-fit.test.tsx`, 6/6): description 🔊 reads it; How-Lift 🔊 reads lower-pressure + lift-collapses; compare question 🔊 answer-free (never leaks explanation); compare explanation 🔊 reads the revealed text; challenge 🔊 reads task + "Check My Solution" ask; hint 🔊 reads the hint | Audit A load-bearing strings COVERED; Audit B STIMULUS PASS all beats |

**Verification status:** type-checked + Lumina gate clean + **6/6 behavioral
tests**. Residual: hearing the live tutor voice wants one browser pass on the
Engineering tester — logged to HUMAN-CHECKS (not edited here). Message shape,
targeting, and answer-safety are runtime-verified.
