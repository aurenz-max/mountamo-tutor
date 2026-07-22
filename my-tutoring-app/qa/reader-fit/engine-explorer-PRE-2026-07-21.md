# Reader Fit: engine-explorer @ PRE (young-learner band) — 2026-07-21

Modes audited: unmoded (living steam-engine sim: explore zones / adjust fuel+load
sliders / energy-flow / MCQ challenges; `gradeBand: '1-2'` → K-2 config path) |
Probes: component census (real DEFAULT + generated content shapes) | live —
(needs browser)

Catalog targets K-5; the `gradeBand: '1-2'` path is the lowest claimed band =
K/PRE. Audited at the young-learner band. Real K draw is a living particle
simulation with a friendly, analogy-rich voice — but **every load-bearing block
(engine overview, tapped-zone explanation, MCQ challenge prompt, wrong-answer
hint) is prose a K–2 reader cannot decode.** Third engineering primitive to get
the young-learner read-aloud capability, same finding class and fix as
[[vehicle-comparison-lab]] and [[propulsion-timeline]] (both 2026-07-21).

## Audit A — text census
| String (abridged) | Where | Class | Spoken twin (before) | Verdict |
|---|---|---|---|---|
| `overview` ("This steam engine once pulled trains…") | card header, under engineName | Load-bearing (orient) | spoken once at `[ACTIVITY_START]` (silent → tutor), no on-demand replay | Partially → **COVERED** (overview 🔊 reads it verbatim, replayable) |
| tapped-zone `explanation` + `analogy` ("Water is heated… like a giant kettle") | zone-info panel (after tapping a canvas zone) | Load-bearing (the content) | narrated once on first tap via silent `[ZONE_EXPLORED]`; on-panel text unreadable, no replay | Partially → **COVERED** (zone 🔊 reads name + explanation + analogy, replayable) |
| challenge `instruction` ("What happens to the drops when you add coal?") | challenge panel, the question | Load-bearing (the task) | text only; `[CHALLENGE_*]` narration fires only AFTER answering | UNCOVERED → **COVERED** (ReadMeButton reads the question + answer-free ask) |
| challenge `hint` ("Think about heating water on a stove…") | challenge panel, after a wrong answer | Load-bearing (guidance) | sent to tutor on `[CHALLENGE_INCORRECT]` only; on-card text unreadable, no replay | UNCOVERED → **COVERED** (hint 🔊, reads what is already revealed) |
| MCQ option text (4 choices) | challenge panel | The answer surface | none (must stay unread) | Intentionally NOT read — answer-safety |
| energy-flow badges (input → transforms → output), efficiency, losses | energy-flow accordion | Supportive/discovery | narrates on open via silent `[ENERGY_FLOW_VIEWED]` | Supportive — left as-is (single-word badges, tutor already voices on open) |
| "Tap any zone to learn what it does", fuel/load slider labels, %s, RPM/PSI gauges, badges, phase/submit buttons | chrome | Load-bearing chrome | none | Residual (band chrome — Audit C) |

## Audit B — sufficiency contract
| Beat | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| explore zones | after: PASS (overview 🔊 + zone 🔊) | before: **FAIL** (zone prose never replayable) → after: PASS | n/a (free exploration) | PASS (tutor narrates zone on tap) | PASS (zone 🔊 replay) |
| challenge (MCQ) | after: PASS (question 🔊) | after: PASS (question voiced via ReadMeButton) | after: PASS (answer-free ask: "look at the choices, tap the one you think is right") | PASS (correct/incorrect colors + spoken `[CHALLENGE_*]`) | PASS (wrong-answer hint now has a 🔊) |

## Audit C — band contract (strict PRE)
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 Audio is instruction channel | FAIL→**mitigated** | Was text-only; four 🔊 buttons now voice all load-bearing text on demand |
| 2 Tap = choose | PARTIAL | Zone/MCQ taps are choose ✓; fuel/load are continuous range sliders (not a PRE affordance) |
| 3 Pictures are answer surface | PARTIAL | Canvas sim IS a picture surface ✓; MCQ options are text choices |
| 4 One thing per screen (≤5) | FAIL | Sim + 2 sliders + energy-flow + challenge + submit share one scroll |
| 7 No adult chrome | FAIL | %s, RPM/PSI gauges, "Challenge N of M", type badges, engineType badge |
| 8 Assessment hides in mechanics | PARTIAL | Challenges are an explicit 4-option MCQ quiz |

**Overall: PRIMITIVE-GAP (read-aloud gap) — RESOLVED for the load-bearing-text
blocker.** As with the two prior engineering pilots, at strict eyes-free-PRE this
remains a DEVELOPING/grades-1-5 instrument (range sliders, numeric gauges, MCQ
quiz, phase chrome = Audit C FAILs read-aloud does not fix); a full eyes-free-K
rebuild would be a REBUILD, out of scope. For the realistic K-2 audience — young
learners who can operate the living simulation but not decode the prose — the
blocker was unreadable load-bearing narration, now unblocked across overview,
zones, challenge prompt, and hint.

Findings → fix layer:
- **[DONE] Load-bearing narration unvoiced → COMPONENT (Tier 2).** Wired
  `LuminaReadAloud` (overview, tapped-zone explanation+analogy, wrong-answer hint)
  + shared `ReadMeButton` (challenge question + answer-free ask). All route to
  non-silent `sendText`; glyph ripples on `isAudioPlaying`. Cyan audio-out mark,
  learned once. No nested-button conversions were needed — every 🔊 sits inside a
  `LuminaPanel`/`<div>` frame, not inside a clickable `<button>` (the MCQ answer
  choices deliberately carry no 🔊, for answer-safety). Answer-safety held: the
  question uses `ReadMeButton` (answer-free by construction); the hint is only read
  after it is revealed on screen; the four option strings are never voiced.
- **[RESIDUAL, systemic] Audit C chrome at strict PRE.** Shared "K-stage"
  presentation-mode case (sliders, gauges, MCQ, phase chrome); recorded, not fixed
  inline (no design-system fork).

## [--fix] Loop log
| Iter | Change | Type check | Runtime check | Re-audit |
|---|---|---|---|---|
| 1 | Four 🔊 across overview/zone/challenge/hint; non-silent `sendText`; `isAudioPlaying` ripple; no nested-button conversion needed | EngineExplorer.tsx 0 errors (tsc `--noEmit` grep clean); `typecheck:lumina` had 3 pre-existing errors in an UNRELATED file (TransportChallenge.tsx, a concurrent workstream), none in this file | **PASS** — jsdom reader-fit test (`__tests__/EngineExplorer.reader-fit.test.tsx`, 4/4): overview 🔊 reads it verbatim; zone 🔊 reads explanation+analogy (canvas hit-test driven via stubbed rect); challenge 🔊 is answer-free (never names an option); hint 🔊 reads the hint | Audit A load-bearing strings COVERED; Audit B STIMULUS PASS both beats |

**Verification status:** type-checked (this file clean) + **4/4 behavioral tests**.
Residual: hearing the live tutor voice wants one browser pass on the Engineering
tester — logged to HUMAN-CHECKS by the parent. Message shape, targeting, and
answer-safety are runtime-verified.
