# Reader Fit: propulsion-lab @ PRE (young-learner band) — 2026-07-21

Modes audited: predict / observe / experiment (challenge eval modes; K-2 config
path, gradeBand `1-2`) + free-exploration sim | Probes: jsdom reader-fit ✓ (K
fixture, real content shape) | live — (needs browser)

Data declares `gradeBand: '1-2'`, so lowest band = grade-1/PRE. Audited at the
young-learner band. The lab is a living Newton's-Third-Law simulation (jet /
rocket / propeller / sail × air / water / vacuum, throttle slider) followed by
predict/observe/experiment challenges. The direct-manipulation sim is genuinely
pre-reader-friendly, but **every load-bearing string around it — the overview,
the propulsion "how it works" line, the Key Discovery synthesis, the challenge
question, and the after-wrong-answer hint — is text a K–2 reader cannot decode.**

Same finding class and fix as [[vehicle-comparison-lab]] and
[[propulsion-timeline]] (2026-07-21) — the third engineering primitive to get the
young-learner read-aloud capability.

## Audit A — text census
| String (abridged) | Where | Class | Spoken twin (before) | Verdict |
|---|---|---|---|---|
| `overview` ("Explore how engines push…") | card header | Load-bearing (orient) | narrated once via silent `[ACTIVITY_START]`, no on-demand replay | UNCOVERED → **COVERED** (overview 🔊, `[READ_OVERVIEW]`) |
| `pDef.pushesAgainst` ("Sucks in air, burns it, blasts it out faster") | propulsion controls, under type buttons | Load-bearing (the fact) | none — never voiced | UNCOVERED → **COVERED** (propulsion 🔊 reads label + how it works, `[READ_PROPULSION]`) |
| Key Discovery callout ("Some propulsion types need a medium… Rockets carry their own propellant…") | after `noThrustMoments > 0` | Load-bearing (synthesis) | none; text already revealed by sim discovery | UNCOVERED → **COVERED** (discovery 🔊, `[READ_DISCOVERY]`) |
| challenge `instruction` (predict/observe/experiment question) | challenge panel | Load-bearing (the QUESTION) | sent to tutor only on `[CHALLENGE_*]` after answering; on-card text unreadable pre-answer | UNCOVERED → **COVERED** (ReadMeButton: question + answer-free ask, `[READ_CHALLENGE]`) |
| challenge `hint` ("A propeller pushes air backward. What if there is no air?") | challenge panel, post-wrong-answer | Load-bearing (guidance) | sent to tutor on `[CHALLENGE_INCORRECT]` only; on-card text unreadable | UNCOVERED → **COVERED** (hint 🔊, reads what is already revealed, `[READ_HINT]`) |
| answer `options[].text` (4 MCQ choices, one correct) | challenge panel | Graded answer surface | n/a | PROTECTED — deliberately NOT read (would voice the correct option); ReadMeButton covers "what to do" answer-free |
| `title`, "Living Newton's Third Law", control labels, throttle %, speed/thrust gauges, "Grades 1-2" badge, "Ready for a Challenge?", "I'm Done Exploring", completion cards | header / controls / chrome | Load-bearing chrome | none | Residual (band chrome — Audit C) |
| `description` (data field) | — | — | not rendered anywhere | n/a |

## Audit B — sufficiency contract
| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| sim (free-explore) | after: PASS (overview 🔊 + propulsion 🔊) | PASS (canvas + particles, no reading needed) | n/a (exploration) | PASS (tutor narrates combo/no-thrust on tap, silent→spoken) | PASS (🔊 replay) |
| predict/observe/experiment | after: PASS (question ReadMeButton) | before: **FAIL** (question text never readable) → after: PASS | after: PASS (ask: "watch the sim, then tap the choice you think is right") | PASS (`[CHALLENGE_*]` spoken + answer-choice grading colors) | PASS (post-wrong hint now has a 🔊) |

## Audit C — band contract (strict PRE)
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 Audio is instruction channel | FAIL→**mitigated** | Was text-only; five 🔊 buttons now voice all load-bearing text on demand |
| 2 Tap = choose | PARTIAL | Sim taps/throttle-drag = manipulation ✓; challenge is a 4-option MCQ ✓; but throttle slider + type/medium steppers are adult controls |
| 3 Pictures are answer surface | PARTIAL | Challenge options are text (with A/B/C/D letters), not pictures |
| 4 One thing per screen (≤5) | FAIL | Sim + type row (4) + medium row (3) + throttle + challenge all co-present |
| 7 No adult chrome | FAIL | gradeBand badge, throttle %, speed/thrust km/h gauges, "Challenge N of M", monospace uppercase labels |
| 8 Assessment hides in mechanics | PARTIAL | Predict challenges are an explicit MCQ quiz atop the sim |

**Overall: PRIMITIVE-GAP (read-aloud gap) — RESOLVED for the load-bearing-text
blocker.** As with the two prior engineering pilots, at strict eyes-free-PRE this
remains a DEVELOPING/grades-2-5 instrument (throttle slider, numeric gauges, MCQ
quiz, phase chrome = Audit C FAILs read-aloud does not fix); a full eyes-free-K
rebuild would be a REBUILD, out of scope. For the realistic grade-1-2 audience —
young learners who can drive the simulation but not decode the prose — the blocker
was unreadable load-bearing text, now unblocked across sim orientation and all
three challenge eval modes.

Findings → fix layer:
- **[DONE] Load-bearing text unvoiced → COMPONENT (Tier 2).** Wired
  `LuminaReadAloud` (overview, propulsion how-it-works, Key Discovery synthesis,
  post-wrong hint) + shared `ReadMeButton` (challenge question + answer-free ask).
  All route to non-silent `sendText`; glyph ripples on `isAudioPlaying`. Cyan
  audio-out mark, learned once. Answer safety: the four MCQ options are never
  voiced, and the challenge ReadMeButton reads only the question + an answer-free
  "what to do" — the correct prediction is never spoken.
- **[RESIDUAL, systemic] Audit C chrome at strict PRE.** Shared "K-stage"
  presentation-mode case (throttle slider, numeric gauges, badges, phase
  counters); recorded, not fixed inline (no design-system fork).

## [--fix] Loop log
| Iter | Change | Type check | Runtime check | Re-audit |
|---|---|---|---|---|
| 1 | Five 🔊 across header/controls/discovery/challenge/hint; non-silent `sendText`; `isAudioPlaying` ripple; challenge question via `ReadMeButton` (answer-free) | 0 new errors for `PropulsionLab`; `typecheck:lumina` 0 | **PASS** — jsdom reader-fit test (`__tests__/PropulsionLab.reader-fit.test.tsx`, 4/4): overview 🔊 reads verbatim; propulsion 🔊 reads how-it-works; challenge 🔊 is answer-free (excludes correct option); hint 🔊 reads hint | Audit A load-bearing strings COVERED; Audit B STIMULUS PASS both surfaces |

**Verification status:** type-checked + Lumina gate clean + **4/4 behavioral
tests**. Residual: hearing the live tutor voice wants one browser pass on the
Engineering tester — logged to HUMAN-CHECKS. Message shape, targeting, and
answer-safety are runtime-verified. No nested-`<button>` conversions were needed
(every 🔊 sits beside a `<p>` or inside a callout, not inside a button).
