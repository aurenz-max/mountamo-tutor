# Reader Fit: curator-brief @ PRE — 2026-09-05

Scope: short audit run to give the `affordances.reader` tag a **source in the tree**. The
pre-reader scaffold itself shipped and was user-confirmed live on 2026-07-15
(`/add-tutoring-scaffold`, then `/tutor-test curator-brief` = pass) — but no reader-fit
report or contract line was ever written, so the tag had nothing to derive from.

Modes audited: none — curator-brief has no `supportsEvaluation` and no `evalModes`; it is the
always-first orientation block (`intro_briefing`, `role: introduce`).
Probes: `tutor-test?componentId=curator-brief&probe=1&gradeLevel=kindergarten` → **pass, 0 findings**
(`sendTextTags: [READ_SECTION]`, contextKeys resolve incl. `isPreReader`, dataBag static).
Live: not re-run this slice (the 07-15 live confirmation stands).

## Audit A — text census
| String | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| Section prose (hook, big idea, objectives, prerequisites, roadmap, connections) | content area | **Supportive, not load-bearing** — nothing is answered or gated on it | `[READ_SECTION]` auto-fires on every section CHANGE for `isPreReaderGrade`, and on demand from `<LuminaReadAloud size="lg">` | COVERED |
| Six tab labels ("The Hook", "Big Idea", …) | nav tabs | Navigational, text + icon | — | ACCEPTABLE — the child's path is the ← → arrows and the one primary button; the tabs are a shortcut, not the route |
| Quick Check question + "Reveal" | prerequisites section | Supportive; **not measured** (no eval mode, no score, no advance gate) | question voiced by `buildSectionSpeech`; the ANSWER travels in the sendText payload and is withheld by the NEVER-REVEAL directive | COVERED, no leak |
| subject / gradeLevel / "Prepared for X" / estimatedTime badges | header meta row | Adult chrome | none | rule 7 |
| "Use ← → arrow keys or buttons to navigate" | under content | Adult chrome (protocol hint the child cannot read) | none | rule 7 |
| Mindset "encouragement" + "Pro tip:" prose | footer | Adult chrome — the only student-facing prose **not** covered by `[READ_SECTION]` | none | rule 7 |
| "Next Step" / "I'm Ready to Start!" | primary button | Load-bearing protocol, but positionally unambiguous (one large primary button, bottom centre) | none | ACCEPTABLE by position |

## Audit B — sufficiency contract
| | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| intro_briefing | ✓ taskDescription names the section and says the student may be pre-reading | ✓ `[READ_SECTION]` carries the assembled section body | ✓ PRE-READER MODE directive: never ask them to read, guide by what they can see | n/a — nothing is judged | ✓ commonStruggles covers silence + cannot-read + rushing |

**Opening-section caveat (by design, not a gap):** the hook is deliberately NOT auto-narrated —
auto-firing on mount races the lesson greeting into a hallucination
(`ADDING_TUTORING_SCAFFOLD` "Avoiding Gemini Turn Races"), so `hasNavigatedRef` skips the initial
section and the greeting covers it. A pre-reader who never advances still has the 🔊 button.

## Audit C — band contract (PRE)
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 audio is the instruction channel | PASS | every section auto-voiced on change + 🔊 on demand |
| 2 tap = choose | PASS | arrows and the primary button are single-tap |
| 3 pictures are the answer surface | n/a | nothing is answered |
| 4 one thing per screen / ≤5 elements | **FAIL** | 6 tabs + 2 arrows + 🔊 + primary button visible at once |
| 5 feedback on the touched object | n/a | |
| 6 no typing | PASS | |
| 7 no adult chrome | **FAIL** | header meta row, keyboard hint, unvoiced mindset/"Pro tip" footer |
| 8 assessment in the mechanics | n/a | |

**Overall: READY @ PRE on the reading axis — PRIMITIVE-GAP on chrome (rules 4, 7).**
Nothing on the child's path requires reading: the block measures nothing, every section is
voiced, and advance is an arrow or one large button. The chrome findings are cosmetic at a
block with no success condition.

**Reader field derivation → `reader: 'none'`.** Load-bearing text: none (there is no task).
Supportive prose: fully covered by the `[READ_SECTION]` auto-narration + `LuminaReadAloud`.

## Queued, not fixed here
- **PRE chrome trim** (rules 4 + 7): hide the header meta row, the keyboard hint and the
  six-tab strip below Grade 1 (arrows only), and either voice the mindset footer through
  `[READ_SECTION]` or hide it at PRE. → `qa/reader-fit/BACKLOG.md`, executor `/reader-fit curator-brief --fix`.
